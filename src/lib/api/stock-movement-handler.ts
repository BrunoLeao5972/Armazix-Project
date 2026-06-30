/**
 * Handlers de Movimentação de Estoque
 *
 * Regras:
 *  - Toda operação de escrita roda dentro de db.transaction() (ACID).
 *  - Ajustes manuais gravam em stockMovements E em stockAdjustments (rastreio dedicado).
 *  - Saídas manuais gravam em stockMovements como SAIDA / PERDA / AVARIA.
 *  - O saldo do produto nunca fica negativo (Math.max(0, ...)).
 *  - Auditoria é fire-and-forget (nunca bloqueia a resposta).
 */

import { createDb, createTenantDb, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { requireStoreAccess } from "@/lib/auth/require-store-access";
import type { AuthContext } from "@/lib/auth/require-store-access";
import { logAudit, AuditModulos } from "@/lib/audit";

const { products, stockMovements, stockAdjustments, users } = schema;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function err(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

async function getUserName(dbUrl: string, userId: string): Promise<string> {
  try {
    const db = createDb(dbUrl);
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true },
    });
    return user?.name ?? "Sistema";
  } catch {
    return "Sistema";
  }
}

// ─── Entrada de Estoque ───────────────────────────────────────────
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
    supplierId: string;
    supplierName: string;
    nf?: string;
    date?: string;
    obs?: string;
    payMethod?: string;
    installments?: number;
    dueDate?: string;
    items: Array<{
      productId:   string;
      productName: string;
      qty:         number;
      cost?:       number;
      lot?:        string;
      expiry?:     string;
    }>;
  };

  if (!body.supplierId || !Array.isArray(body.items) || body.items.length === 0) {
    return err("supplierId e items são obrigatórios");
  }

  const badItems = body.items.filter(it => !it.productId || !(it.qty > 0));
  if (badItems.length > 0) {
    return err(`Todos os itens precisam de productId e qty > 0 (${badItems.length} inválidos)`);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db    = await createTenantDb(dbUrl, storeId);
  const nomeUsuario = await getUserName(dbUrl, userId);
  const origemBase  = `Entrada Manual${body.nf ? ` — NF ${body.nf}` : ""}`;

  try {
    const inserted: typeof stockMovements.$inferSelect[] = [];

    await db.transaction(async (tx) => {
      for (const item of body.items) {
        const [prod] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
          .limit(1);

        if (!prod) throw new Error(`Produto ${item.productId} não pertence a esta loja`);

        const balanceBefore = prod.stock ?? 0;
        const balanceAfter  = balanceBefore + item.qty;

        await tx
          .update(products)
          .set({ stock: balanceAfter, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            storeId,
            productId:    item.productId,
            productName:  item.productName,
            type:         "ENTRADA",
            quantity:     item.qty,
            balanceBefore,
            balanceAfter,
            origem:       origemBase,
            supplierId:   body.supplierId,
            nf:           body.nf    ?? null,
            lot:          item.lot   ?? null,
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

// ─── Saída Manual de Estoque ─────────────────────────────────────
// POST /api/stock/exit
// tipo: "SAIDA" | "PERDA" | "AVARIA"
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
    tipo:        string;   // "SAIDA" | "PERDA" | "AVARIA"
    responsavel?: string;
    obs?:        string;
    items: Array<{
      productId:   string;
      productName: string;
      qty:         number;
    }>;
  };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return err("items é obrigatório");
  }
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
  const db    = await createTenantDb(dbUrl, storeId);
  const nomeUsuario = await getUserName(dbUrl, userId);
  const origemText = `Saída Manual — ${body.tipo}${body.responsavel ? ` (${body.responsavel})` : ""}`;

  try {
    const inserted: typeof stockMovements.$inferSelect[] = [];

    await db.transaction(async (tx) => {
      for (const item of body.items) {
        const [prod] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
          .limit(1);

        if (!prod) throw new Error(`Produto ${item.productId} não pertence a esta loja`);

        const balanceBefore = prod.stock ?? 0;
        const balanceAfter  = Math.max(0, balanceBefore - item.qty);

        await tx
          .update(products)
          .set({ stock: balanceAfter, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            storeId,
            productId:    item.productId,
            productName:  item.productName,
            type:         movType,
            quantity:     item.qty,
            balanceBefore,
            balanceAfter,
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
        details: {
          tipo: movType, itemCount: body.items.length,
          totalQty: body.items.reduce((s, i) => s + i.qty, 0),
        },
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

// ─── Ajuste Manual de Estoque ─────────────────────────────────────
// POST /api/stock/adjustment
// qty positivo = acréscimo; negativo = redução.
// Grava em stockMovements E em stockAdjustments (rastreio dedicado).
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
    productId:    string;
    productName:  string;
    qty:          number;   // signed
    tipo:         string;   // Quebra | Furto | Sobra | Erro de Lançamento | Correção | Perda | Avaria | Recontagem
    motivo?:      string;
    observations?: string;
  };

  if (!body.productId || body.qty === undefined || body.qty === 0) {
    return err("productId e qty (≠ 0) são obrigatórios");
  }

  const TYPE_MAP: Record<string, string> = {
    Correção:            "AJUSTE",
    Perda:               "PERDA",
    Avaria:              "AVARIA",
    Recontagem:          "AJUSTE",
    Quebra:              "PERDA",
    Furto:               "PERDA",
    Sobra:               "AJUSTE",
    "Erro de Lançamento": "AJUSTE",
  };
  const movType    = TYPE_MAP[body.tipo] ?? "AJUSTE";
  const absQty     = Math.abs(body.qty);
  const origemText = `Ajuste Manual — ${body.tipo}${body.motivo ? `: ${body.motivo}` : ""}`;

  const dbUrl = process.env.DATABASE_URL!;
  const db    = await createTenantDb(dbUrl, storeId);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    let movementId: string | null = null;

    await db.transaction(async (tx) => {
      const [prod] = await tx
        .select({ stock: products.stock })
        .from(products)
        .where(and(eq(products.id, body.productId), eq(products.storeId, storeId)))
        .limit(1);

      if (!prod) throw new Error("Produto não encontrado nesta loja");

      const balanceBefore = prod.stock ?? 0;
      const balanceAfter  = Math.max(0, balanceBefore + body.qty);

      await tx
        .update(products)
        .set({ stock: balanceAfter, updatedAt: new Date() })
        .where(and(eq(products.id, body.productId), eq(products.storeId, storeId)));

      // Registro no histórico geral de movimentações
      const [movement] = await tx
        .insert(stockMovements)
        .values({
          storeId,
          productId:    body.productId,
          productName:  body.productName,
          type:         movType,
          quantity:     absQty,
          balanceBefore,
          balanceAfter,
          origem:       origemText,
          observations: body.observations ?? null,
          createdBy:    userId,
          createdByName: nomeUsuario,
        })
        .returning();

      movementId = movement.id;

      // Registro no histórico dedicado de ajustes (imutável)
      await tx
        .insert(stockAdjustments)
        .values({
          storeId,
          productId:    body.productId,
          productName:  body.productName,
          balanceBefore,
          balanceAfter,
          qty:          body.qty,   // preserva sinal original
          tipo:         body.tipo,
          motivo:       body.motivo      ?? null,
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
        details: { product: body.productName, tipo: body.tipo, qty: body.qty, motivo: body.motivo },
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

// ─── Listar Movimentações (Extrato / Histórico) ───────────────────
// GET /api/stock/movements?limit=150&type=ENTRADA
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

  const url   = new URL(request.url);
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "150")), 500);

  const dbUrl = process.env.DATABASE_URL!;
  const db    = await createTenantDb(dbUrl, storeId);

  try {
    const rows = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.storeId, storeId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return json({ movements: rows });
  } catch (e) {
    console.error("listStockMovementsHandler:", e);
    return err("Erro ao listar movimentações", 500);
  }
}

// ─── Listar Ajustes Manuais (Histórico dedicado) ──────────────────
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
  const db    = await createTenantDb(dbUrl, storeId);

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
