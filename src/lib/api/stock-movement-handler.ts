/**
 * Handlers de Movimentação de Estoque (com rastreio por setor)
 *
 * Regras:
 *  - sectorId é obrigatório em entrada, saída, ajuste e transferência.
 *  - products.stock = total global (soma manual + vendas sem contexto de setor).
 *  - stockProductBalances rastreia o saldo de cada produto dentro de cada setor.
 *  - As duas tabelas são atualizadas atomicamente no mesmo db.transaction().
 *  - O saldo nunca fica negativo em nenhuma das duas fontes.
 *  - Auditoria é fire-and-forget (nunca bloqueia a resposta).
 */

import { createDb, createDbTransactional, schema } from "@/lib/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { requireStoreAccess } from "@/lib/auth/require-store-access";
import type { AuthContext } from "@/lib/auth/require-store-access";
import { logAudit, AuditModulos } from "@/lib/audit";

const { products, stockMovements, stockAdjustments, stockProductBalances, sectors, users } = schema;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function err(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

// ─── Helpers de saldo por setor ──────────────────────────────────────────────

/** Retorna o saldo atual do produto no setor; 0 se não existir ainda. */
async function getSectorBalance(
  tx: ReturnType<typeof createDbTransactional> | ReturnType<typeof createDb>,
  productId: string,
  sectorId:  string,
): Promise<number> {
  const [row] = await (tx as ReturnType<typeof createDb>)
    .select({ quantity: stockProductBalances.quantity })
    .from(stockProductBalances)
    .where(and(
      eq(stockProductBalances.productId, productId),
      eq(stockProductBalances.sectorId, sectorId),
    ))
    .limit(1);
  return row ? Number(row.quantity) : 0;
}

/**
 * Aplica `delta` (positivo ou negativo) ao saldo do setor, criando o registro
 * se ainda não existir (upsert via ON CONFLICT).
 */
async function applyDeltaToSector(
  tx: Parameters<Parameters<ReturnType<typeof createDbTransactional>["transaction"]>[0]>[0],
  storeId:   string,
  productId: string,
  sectorId:  string,
  delta:     number,
): Promise<void> {
  await tx.insert(stockProductBalances)
    .values({
      storeId,
      productId,
      sectorId,
      quantity:    String(Math.max(0, delta)),
      updatedAt:   new Date(),
    })
    .onConflictDoUpdate({
      target: [stockProductBalances.productId, stockProductBalances.sectorId],
      set: {
        quantity:  sql`GREATEST(0, ${stockProductBalances.quantity} + ${delta})`,
        updatedAt: new Date(),
      },
    });
}

/** Define um saldo absoluto para o setor (usado em Correção). */
async function setSectorBalance(
  tx: Parameters<Parameters<ReturnType<typeof createDbTransactional>["transaction"]>[0]>[0],
  storeId:   string,
  productId: string,
  sectorId:  string,
  newQty:    number,
): Promise<void> {
  await tx.insert(stockProductBalances)
    .values({
      storeId,
      productId,
      sectorId,
      quantity:  String(Math.max(0, newQty)),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [stockProductBalances.productId, stockProductBalances.sectorId],
      set: {
        quantity:  String(Math.max(0, newQty)),
        updatedAt: new Date(),
      },
    });
}

// ─── Entrada de Estoque ───────────────────────────────────────────────────────
// POST /api/stock/entry
export async function stockEntryHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  let userId: string;
  try {
    ({ storeId, userId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    sectorId:    string;
    supplierId:  string;
    supplierName: string;
    nf?:         string;
    date?:       string;
    obs?:        string;
    payMethod?:  string;
    installments?: number;
    dueDate?:    string;
    items: Array<{
      productId:   string;
      productName: string;
      qty:         number;
      cost?:       number;
      lot?:        string;
      expiry?:     string;
    }>;
  };

  if (!body.sectorId)   return err("sectorId é obrigatório");
  if (!body.supplierId || !Array.isArray(body.items) || body.items.length === 0) {
    return err("supplierId e items são obrigatórios");
  }
  const badItems = body.items.filter(it => !it.productId || !(it.qty > 0));
  if (badItems.length > 0) {
    return err(`Todos os itens precisam de productId e qty > 0 (${badItems.length} inválidos)`);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db    = createDbTransactional(dbUrl);
  const origemBase  = `Entrada Manual${body.nf ? ` — NF ${body.nf}` : ""}`;

  try {
    const inserted: typeof stockMovements.$inferSelect[] = [];
    let nomeUsuario = "Sistema";

    await db.transaction(async (tx) => {
      const [userRow] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      nomeUsuario = userRow?.name ?? "Sistema";

      // Valida que o setor pertence à loja
      const sector = await tx.query.sectors.findFirst({
        where: and(eq(sectors.id, body.sectorId), eq(sectors.storeId, storeId)),
        columns: { id: true },
      });
      if (!sector) throw new Error("Setor não encontrado nesta loja");

      for (const item of body.items) {
        const [prod] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
          .limit(1);

        if (!prod) throw new Error(`Produto ${item.productId} não pertence a esta loja`);

        // balanceBefore/After refletem o saldo do SETOR (para rastreio no movimento)
        const sectorBefore = await getSectorBalance(tx as unknown as ReturnType<typeof createDb>, item.productId, body.sectorId);
        const sectorAfter  = sectorBefore + item.qty;

        // Atualiza saldo do setor
        await applyDeltaToSector(tx, storeId, item.productId, body.sectorId, item.qty);

        // Atualiza saldo global do produto
        const globalBefore = prod.stock ?? 0;
        const globalAfter  = globalBefore + item.qty;
        await tx
          .update(products)
          .set({ stock: globalAfter, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            storeId,
            productId:    item.productId,
            productName:  item.productName,
            type:         "ENTRADA",
            quantity:     item.qty,
            balanceBefore: sectorBefore,
            balanceAfter:  sectorAfter,
            sectorId:     body.sectorId,
            origem:       origemBase,
            supplierId:   body.supplierId,
            nf:           body.nf     ?? null,
            lot:          item.lot    ?? null,
            expiry:       item.expiry ?? null,
            costPrice:    item.cost != null ? String(item.cost) : null,
            payMethod:    body.payMethod ?? null,
            dueDate:      body.dueDate   ?? null,
            observations: body.obs       ?? null,
            createdBy:    userId,
            createdByName: nomeUsuario,
          })
          .returning();

        inserted.push(movement);
      }
    });

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action: "ESTOQUE_ENTRADA", modulo: AuditModulos.ESTOQUE,
        resourceType: "stock_movement",
        details: {
          sectorId: body.sectorId,
          supplierId: body.supplierId, supplierName: body.supplierName,
          nf: body.nf, itemCount: body.items.length,
          totalQty: body.items.reduce((s, i) => s + i.qty, 0),
        },
        status: "success",
      },
      request,
    );

    return json({ success: true, movements: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("stockEntryHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Saída Manual de Estoque ──────────────────────────────────────────────────
// POST /api/stock/exit
export async function stockExitHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  let userId: string;
  try {
    ({ storeId, userId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    sectorId:    string;
    tipo:        string;
    responsavel?: string;
    obs?:        string;
    items: Array<{
      productId:   string;
      productName: string;
      qty:         number;
    }>;
  };

  if (!body.sectorId)   return err("sectorId é obrigatório");
  if (!Array.isArray(body.items) || body.items.length === 0) return err("items é obrigatório");
  const badItems = body.items.filter(it => !it.productId || !(it.qty > 0));
  if (badItems.length > 0) {
    return err(`Todos os itens precisam de productId e qty > 0 (${badItems.length} inválidos)`);
  }

  const VALID_TYPES: Record<string, string> = {
    SAIDA: "SAIDA", PERDA: "PERDA", AVARIA: "AVARIA",
    Venda: "SAIDA", Perda: "PERDA", "Uso interno": "SAIDA", Troca: "SAIDA", Avaria: "AVARIA",
  };
  const movType = VALID_TYPES[body.tipo] ?? "SAIDA";

  const dbUrl = process.env.DATABASE_URL!;
  const db    = createDbTransactional(dbUrl);
  const origemText = `Saída Manual — ${body.tipo}${body.responsavel ? ` (${body.responsavel})` : ""}`;

  try {
    const inserted: typeof stockMovements.$inferSelect[] = [];
    let nomeUsuario = "Sistema";

    await db.transaction(async (tx) => {
      const [userRow] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      nomeUsuario = userRow?.name ?? "Sistema";

      const sector = await tx.query.sectors.findFirst({
        where: and(eq(sectors.id, body.sectorId), eq(sectors.storeId, storeId)),
        columns: { id: true },
      });
      if (!sector) throw new Error("Setor não encontrado nesta loja");

      for (const item of body.items) {
        const [prod] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
          .limit(1);

        if (!prod) throw new Error(`Produto ${item.productId} não pertence a esta loja`);

        const sectorBefore = await getSectorBalance(tx as unknown as ReturnType<typeof createDb>, item.productId, body.sectorId);
        if (sectorBefore < item.qty) {
          throw new Error(`Estoque insuficiente no setor para "${item.productName}": disponível ${sectorBefore}, solicitado ${item.qty}`);
        }
        const sectorAfter = sectorBefore - item.qty;

        await applyDeltaToSector(tx, storeId, item.productId, body.sectorId, -item.qty);

        const globalBefore = prod.stock ?? 0;
        const globalAfter  = Math.max(0, globalBefore - item.qty);
        await tx
          .update(products)
          .set({ stock: globalAfter, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            storeId,
            productId:    item.productId,
            productName:  item.productName,
            type:         movType,
            quantity:     item.qty,
            balanceBefore: sectorBefore,
            balanceAfter:  sectorAfter,
            sectorId:     body.sectorId,
            origem:       origemText,
            observations: body.obs ?? null,
            createdBy:    userId,
            createdByName: nomeUsuario,
          })
          .returning();

        inserted.push(movement);
      }
    });

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action: "ESTOQUE_SAIDA", modulo: AuditModulos.ESTOQUE,
        resourceType: "stock_movement",
        details: { sectorId: body.sectorId, tipo: movType, itemCount: body.items.length,
          totalQty: body.items.reduce((s, i) => s + i.qty, 0) },
        status: "success",
      },
      request,
    );

    return json({ success: true, movements: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("stockExitHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Ajuste Manual de Estoque ─────────────────────────────────────────────────
// POST /api/stock/adjustment
export async function stockAdjustmentHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  let userId: string;
  try {
    ({ storeId, userId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    sectorId:      string;
    productId:     string;
    productName:   string;
    qty:           number;
    tipo:          "Correção" | "Perda" | "Avaria";
    motivo?:       string;
    observations?: string;
  };

  if (!body.sectorId)                            return err("sectorId é obrigatório");
  if (!body.productId || !body.productName || !body.tipo) return err("productId, productName e tipo são obrigatórios");
  if (body.qty === undefined || body.qty === null || isNaN(body.qty) || body.qty < 0)
    return err("qty deve ser um número maior ou igual a zero");
  if ((body.tipo === "Perda" || body.tipo === "Avaria") && body.qty <= 0)
    return err(`Para ajuste do tipo "${body.tipo}", a quantidade deve ser maior que zero`);
  if (!["Correção", "Perda", "Avaria"].includes(body.tipo))
    return err("Tipo de ajuste inválido. Valores aceitos: Correção, Perda, Avaria");

  const TYPE_MAP: Record<string, string> = { Correção: "AJUSTE", Perda: "PERDA", Avaria: "AVARIA" };
  const movType    = TYPE_MAP[body.tipo];
  const origemText = `Ajuste Manual — ${body.tipo}${body.motivo ? `: ${body.motivo}` : ""}`;

  const dbUrl = process.env.DATABASE_URL!;
  const db    = createDbTransactional(dbUrl);

  try {
    let movementId: string | null = null;
    let nomeUsuario = "Sistema";

    await db.transaction(async (tx) => {
      const [userRow] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      nomeUsuario = userRow?.name ?? "Sistema";

      const sector = await tx.query.sectors.findFirst({
        where: and(eq(sectors.id, body.sectorId), eq(sectors.storeId, storeId)),
        columns: { id: true },
      });
      if (!sector) throw new Error("Setor não encontrado nesta loja");

      const [prod] = await tx
        .select({ stock: products.stock })
        .from(products)
        .where(and(eq(products.id, body.productId), eq(products.storeId, storeId)))
        .limit(1);
      if (!prod) throw new Error("Produto não encontrado nesta loja");

      // Saldo do setor (balanceBefore do movimento)
      const sectorBefore = await getSectorBalance(tx as unknown as ReturnType<typeof createDb>, body.productId, body.sectorId);
      const globalBefore = prod.stock ?? 0;

      let sectorAfter: number;
      let globalAfter:  number;
      let signedQty:    number;

      if (body.tipo === "Correção") {
        sectorAfter = Math.max(0, body.qty);
        signedQty   = sectorAfter - sectorBefore;
        globalAfter = Math.max(0, globalBefore + signedQty);
        await setSectorBalance(tx, storeId, body.productId, body.sectorId, sectorAfter);
      } else {
        // Perda | Avaria — quantidade a subtrair do setor
        if (body.qty > sectorBefore) {
          throw new Error(
            `Quantidade a subtrair (${body.qty}) é maior que o estoque neste setor (${sectorBefore}).`,
          );
        }
        sectorAfter = sectorBefore - body.qty;
        signedQty   = -body.qty;
        globalAfter = Math.max(0, globalBefore - body.qty);
        await applyDeltaToSector(tx, storeId, body.productId, body.sectorId, -body.qty);
      }

      await tx
        .update(products)
        .set({ stock: globalAfter, updatedAt: new Date() })
        .where(and(eq(products.id, body.productId), eq(products.storeId, storeId)));

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          storeId,
          productId:    body.productId,
          productName:  body.productName,
          type:         movType,
          quantity:     Math.abs(signedQty),
          balanceBefore: sectorBefore,
          balanceAfter:  sectorAfter,
          sectorId:     body.sectorId,
          origem:       origemText,
          observations: body.observations ?? null,
          createdBy:    userId,
          createdByName: nomeUsuario,
        })
        .returning();

      movementId = movement.id;

      await tx
        .insert(stockAdjustments)
        .values({
          storeId,
          productId:    body.productId,
          productName:  body.productName,
          sectorId:     body.sectorId,
          balanceBefore: sectorBefore,
          balanceAfter:  sectorAfter,
          qty:          signedQty,
          tipo:         body.tipo,
          motivo:       body.motivo       ?? null,
          observations: body.observations ?? null,
          movementId:   movement.id,
          createdBy:    userId,
          createdByName: nomeUsuario,
        });
    });

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action: "ESTOQUE_AJUSTE", modulo: AuditModulos.ESTOQUE,
        resourceType: "stock_adjustment",
        resourceId: body.productId,
        details: { sectorId: body.sectorId, product: body.productName, tipo: body.tipo, qty: body.qty, motivo: body.motivo },
        status: "success",
      },
      request,
    );

    return json({ success: true, movementId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("stockAdjustmentHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Transferência entre Setores ──────────────────────────────────────────────
// POST /api/stock/transfer
// Debita do setor de origem e credita no setor de destino.
// products.stock não muda (transferência é neutra no saldo global).
export async function stockTransferHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  let userId: string;
  try {
    ({ storeId, userId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    sourceSectorId:      string;
    destinationSectorId: string;
    obs?:                string;
    items: Array<{
      productId:   string;
      productName: string;
      qty:         number;
    }>;
  };

  if (!body.sourceSectorId)      return err("sourceSectorId é obrigatório");
  if (!body.destinationSectorId) return err("destinationSectorId é obrigatório");
  if (body.sourceSectorId === body.destinationSectorId) return err("Setor de origem e destino devem ser diferentes");
  if (!Array.isArray(body.items) || body.items.length === 0) return err("items é obrigatório");
  const badItems = body.items.filter(it => !it.productId || !(it.qty > 0));
  if (badItems.length > 0) return err(`Todos os itens precisam de productId e qty > 0 (${badItems.length} inválidos)`);

  const dbUrl = process.env.DATABASE_URL!;
  const db    = createDbTransactional(dbUrl);

  try {
    const inserted: typeof stockMovements.$inferSelect[] = [];
    let nomeUsuario = "Sistema";

    await db.transaction(async (tx) => {
      const [userRow] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      nomeUsuario = userRow?.name ?? "Sistema";

      // Valida ambos os setores
      const [srcSector, dstSector] = await Promise.all([
        tx.query.sectors.findFirst({ where: and(eq(sectors.id, body.sourceSectorId),      eq(sectors.storeId, storeId)), columns: { id: true, name: true } }),
        tx.query.sectors.findFirst({ where: and(eq(sectors.id, body.destinationSectorId), eq(sectors.storeId, storeId)), columns: { id: true, name: true } }),
      ]);
      if (!srcSector) throw new Error("Setor de origem não encontrado nesta loja");
      if (!dstSector) throw new Error("Setor de destino não encontrado nesta loja");

      for (const item of body.items) {
        const [prod] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
          .limit(1);
        if (!prod) throw new Error(`Produto ${item.productId} não pertence a esta loja`);

        const srcBefore = await getSectorBalance(tx as unknown as ReturnType<typeof createDb>, item.productId, body.sourceSectorId);
        if (srcBefore < item.qty) {
          throw new Error(`Estoque insuficiente no setor de origem para "${item.productName}": disponível ${srcBefore}, solicitado ${item.qty}`);
        }

        const srcAfter = srcBefore - item.qty;
        const dstBefore = await getSectorBalance(tx as unknown as ReturnType<typeof createDb>, item.productId, body.destinationSectorId);
        const dstAfter  = dstBefore + item.qty;

        await applyDeltaToSector(tx, storeId, item.productId, body.sourceSectorId,      -item.qty);
        await applyDeltaToSector(tx, storeId, item.productId, body.destinationSectorId, +item.qty);

        // products.stock não muda (transferência é zero-sum no total global)

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            storeId,
            productId:           item.productId,
            productName:         item.productName,
            type:                "TRANSFERENCIA",
            quantity:            item.qty,
            balanceBefore:       srcBefore,
            balanceAfter:        srcAfter,
            sourceSectorId:      body.sourceSectorId,
            destinationSectorId: body.destinationSectorId,
            origem:              `Transferência: ${srcSector.name} → ${dstSector.name}`,
            observations:        body.obs ?? null,
            createdBy:           userId,
            createdByName:       nomeUsuario,
          })
          .returning();

        inserted.push(movement);
      }
    });

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action: "ESTOQUE_TRANSFERENCIA", modulo: AuditModulos.ESTOQUE,
        resourceType: "stock_movement",
        details: {
          sourceSectorId: body.sourceSectorId,
          destinationSectorId: body.destinationSectorId,
          itemCount: body.items.length,
        },
        status: "success",
      },
      request,
    );

    return json({ success: true, movements: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("stockTransferHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Saldos por setor ─────────────────────────────────────────────────────────
// GET /api/stock/balances-by-sector?sectorId=X[&productId=Y]
export async function listStockProductBalancesHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const url       = new URL(request.url);
  const sectorId  = url.searchParams.get("sectorId");
  const productId = url.searchParams.get("productId");

  if (!sectorId) return err("sectorId é obrigatório");

  const dbUrl = process.env.DATABASE_URL!;
  const db    = createDb(dbUrl);

  try {
    const conds = [
      eq(stockProductBalances.storeId,  storeId),
      eq(stockProductBalances.sectorId, sectorId),
    ];
    if (productId) conds.push(eq(stockProductBalances.productId, productId));

    const balances = await db.query.stockProductBalances.findMany({
      where: and(...conds),
      with: {
        product: {
          columns: { id: true, name: true, sku: true, costPrice: true, price: true, unit: true, lowStockThreshold: true, active: true, trackStock: true, pdvCode: true, categoryId: true },
        },
      },
    });

    return json({ balances });
  } catch (e) {
    console.error("listStockProductBalancesHandler:", e);
    return err("Erro ao listar saldos por setor", 500);
  }
}

// ─── Listar Movimentações (Extrato / Histórico) ───────────────────────────────
// GET /api/stock/movements?limit=150&productId=X&sectorId=Y&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function listStockMovementsHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const url       = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const sectorId  = url.searchParams.get("sectorId");
  const startDate = url.searchParams.get("startDate");
  const endDate   = url.searchParams.get("endDate");
  const maxLimit  = productId ? 2000 : 500;
  const limit     = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "150")), maxLimit);

  const dbUrl = process.env.DATABASE_URL!;
  const db    = createDb(dbUrl);

  const conds = [eq(stockMovements.storeId, storeId)];
  if (productId) conds.push(eq(stockMovements.productId, productId));
  if (sectorId)  conds.push(eq(stockMovements.sectorId, sectorId));
  if (startDate) conds.push(gte(stockMovements.createdAt, new Date(startDate + "T00:00:00.000Z")));
  if (endDate)   conds.push(lte(stockMovements.createdAt, new Date(endDate   + "T23:59:59.999Z")));

  try {
    const rows = await db
      .select()
      .from(stockMovements)
      .where(and(...conds))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return json({ movements: rows });
  } catch (e) {
    console.error("listStockMovementsHandler:", e);
    return err("Erro ao listar movimentações", 500);
  }
}

// ─── Listar Ajustes Manuais (Histórico dedicado) ──────────────────────────────
// GET /api/stock/adjustments?limit=100
export async function listStockAdjustmentsHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const url   = new URL(request.url);
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "100")), 500);

  const dbUrl = process.env.DATABASE_URL!;
  const db    = createDb(dbUrl);

  try {
    const rows = await db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.storeId, storeId))
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(limit);

    return json({ adjustments: rows });
  } catch (e) {
    console.error("listStockAdjustmentsHandler:", e);
    return err("Erro ao listar ajustes", 500);
  }
}
