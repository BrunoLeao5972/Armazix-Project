import { createDb, createDbTransactional, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { requireStoreAccess } from "@/lib/auth/require-store-access";
import type { AuthContext } from "@/lib/auth/require-store-access";
import { logAudit } from "@/lib/audit";
import type { BalancoItemJson } from "@/lib/db/schema";

const { stockBalances, stockMovements, products, users } = schema;

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
    return user?.name ?? "Usuário";
  } catch {
    return "Usuário";
  }
}

// ─── List Balances ────────────────────────────────────────────────
export async function listBalancesHandler(
  _request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (e) {
    return err((e as Error).message, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const rows = await db
      .select()
      .from(stockBalances)
      .where(eq(stockBalances.storeId, storeId))
      .orderBy(desc(stockBalances.createdAt))
      .limit(200);

    return json({ balances: rows });
  } catch (e) {
    console.error("listBalancesHandler:", e);
    return err("Erro ao listar balanços", 500);
  }
}

// ─── Create Balance ───────────────────────────────────────────────
// Salva progresso com status "em_aberto". Nunca altera o estoque.
export async function createBalanceHandler(
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
    codigo: string;
    prodScope: "todos" | "alguns";
    preco: string;
    dataContagem: string;
    items: BalancoItemJson[];
  };

  if (!body.codigo?.trim() || !body.dataContagem) {
    return err("codigo e dataContagem são obrigatórios");
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    const [balance] = await db
      .insert(stockBalances)
      .values({
        storeId,
        codigo:        body.codigo,
        prodScope:     body.prodScope ?? "todos",
        preco:         body.preco ?? "Preço de custo",
        dataContagem:  new Date(body.dataContagem),
        status:        "em_aberto",
        items:         body.items ?? [],
        createdBy:     userId,
        createdByName: nomeUsuario,
      })
      .returning();

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action:       "BALANCO_CRIAR",
        modulo:       "ESTOQUE",
        resourceType: "balanco",
        resourceId:   balance.id,
        dadosNovos:   balance as unknown as Record<string, unknown>,
        details: {
          message:    `Balanço ${body.codigo} criado por ${nomeUsuario} com ${body.items.length} itens.`,
          totalItems: body.items.length,
        },
        status: "success",
      },
      request,
    );

    return json({ success: true, balance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("createBalanceHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Update Balance ───────────────────────────────────────────────
// Atualiza itens de um balanço em aberto. Nunca altera o estoque.
export async function updateBalanceHandler(
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
    balanceId: string;
    dataContagem?: string;
    items?: BalancoItemJson[];
  };

  if (!body.balanceId) return err("balanceId obrigatório");

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    const existing = await db.query.stockBalances.findFirst({
      where: and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)),
    });

    if (!existing) return err("Balanço não encontrado", 404);
    if (existing.status === "encerrado") return err("Balanço encerrado não pode ser editado", 403);

    const newItems   = body.items ?? (existing.items as BalancoItemJson[]);
    const oldItems   = existing.items as BalancoItemJson[];
    const changedIds = newItems
      .filter((ni) => {
        const oi = oldItems.find((o) => o.productId === ni.productId);
        return oi?.counted !== ni.counted;
      })
      .map((ni) => ni.productId);

    const [updated] = await db
      .update(stockBalances)
      .set({
        dataContagem: body.dataContagem ? new Date(body.dataContagem) : existing.dataContagem,
        items:        newItems,
        updatedAt:    new Date(),
      })
      .where(and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)))
      .returning();

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action:          "BALANCO_EDITAR",
        modulo:          "ESTOQUE",
        resourceType:    "balanco",
        resourceId:      body.balanceId,
        dadosAnteriores: existing as unknown as Record<string, unknown>,
        dadosNovos:      updated  as unknown as Record<string, unknown>,
        details: {
          message:      `Balanço ${existing.codigo} editado. Itens alterados: ${changedIds.length}.`,
          changedCount: changedIds.length,
          changedIds,
        },
        status: "success",
      },
      request,
    );

    return json({ success: true, balance: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("updateBalanceHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Encerrar Balance (ACID) ──────────────────────────────────────
// Única rota que consolida o estoque real. Requer status "em_aberto".
export async function encerrarBalanceHandler(
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

  const body = await request.json() as { balanceId: string };
  if (!body.balanceId) return err("balanceId obrigatório");

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDbTransactional(dbUrl);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    // Leitura fora da transação (apenas validação)
    const existing = await db.query.stockBalances.findFirst({
      where: and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)),
    });

    if (!existing) return err("Balanço não encontrado", 404);
    if (existing.status === "encerrado") return err("Balanço já está encerrado", 409);

    const items = existing.items as BalancoItemJson[];
    let correctionCount = 0;
    let closedBalance: typeof stockBalances.$inferSelect;

    await db.transaction(async (tx) => {
      // 1. Consolidar estoque para cada item com divergência
      for (const item of items) {
        if (item.diff === null || item.diff === 0) continue;

        const [prod] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
          .limit(1);

        if (!prod) continue;

        const balanceBefore = prod.stock ?? 0;
        const balanceAfter  = Math.max(0, item.counted ?? 0);

        if (balanceBefore === balanceAfter) continue;

        await tx
          .update(products)
          .set({ stock: balanceAfter, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

        await tx
          .insert(stockMovements)
          .values({
            storeId,
            productId:     item.productId,
            productName:   item.productName,
            type:          "RECONTAGEM",
            quantity:      Math.abs(balanceAfter - balanceBefore),
            balanceBefore,
            balanceAfter,
            origem:        `Balanço ${existing.codigo} — Recontagem`,
            createdBy:     userId,
            createdByName: nomeUsuario,
          });

        correctionCount++;
      }

      // 2. Marcar o balanço como encerrado com timestamp atual
      const [updated] = await tx
        .update(stockBalances)
        .set({
          status:           "encerrado",
          dataEncerramento: new Date(),
          updatedAt:        new Date(),
        })
        .where(and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)))
        .returning();

      closedBalance = updated;
    });

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action:          "BALANCO_ENCERRAR",
        modulo:          "ESTOQUE",
        resourceType:    "balanco",
        resourceId:      body.balanceId,
        dadosAnteriores: existing     as unknown as Record<string, unknown>,
        dadosNovos:      closedBalance! as unknown as Record<string, unknown>,
        details: {
          message:          `Balanço ${existing.codigo} encerrado por ${nomeUsuario}. ${correctionCount} correções geradas.`,
          totalItems:       items.length,
          correcoesGeradas: correctionCount,
        },
        status: "success",
      },
      request,
    );

    return json({ success: true, balance: closedBalance!, correcoesGeradas: correctionCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("encerrarBalanceHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Reabrir Balance (ACID) ──────────────────────────────────────
// Reverte as correções de estoque do encerramento e volta a "em_aberto".
export async function reabrirBalanceHandler(
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

  const body = await request.json() as { balanceId: string };
  if (!body.balanceId) return err("balanceId obrigatório");

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDbTransactional(dbUrl);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    const existing = await db.query.stockBalances.findFirst({
      where: and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)),
    });

    if (!existing) return err("Balanço não encontrado", 404);
    if (existing.status !== "encerrado") return err("Balanço não está encerrado", 409);

    const items = existing.items as BalancoItemJson[];
    let reversionCount = 0;
    let reopenedBalance: typeof stockBalances.$inferSelect;

    await db.transaction(async (tx) => {
      // Reverter cada item que teve divergência (diff !== 0) quando foi encerrado
      for (const item of items) {
        if (item.diff === null || item.diff === 0) continue;

        const [prod] = await tx
          .select({ stock: products.stock })
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
          .limit(1);

        if (!prod) continue;

        // Restaura ao systemStock (valor antes do balanço ser aplicado)
        const balanceBefore = prod.stock ?? 0;
        const balanceAfter  = Math.max(0, item.systemStock ?? 0);

        if (balanceBefore === balanceAfter) continue;

        await tx
          .update(products)
          .set({ stock: balanceAfter, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

        await tx
          .insert(stockMovements)
          .values({
            storeId,
            productId:     item.productId,
            productName:   item.productName,
            type:          "RECONTAGEM",
            quantity:      Math.abs(balanceAfter - balanceBefore),
            balanceBefore,
            balanceAfter,
            origem:        `Balanço ${existing.codigo} — Reabertura (reversão)`,
            createdBy:     userId,
            createdByName: nomeUsuario,
          });

        reversionCount++;
      }

      // Marcar o balanço como em_aberto novamente
      const [updated] = await tx
        .update(stockBalances)
        .set({
          status:           "em_aberto",
          dataEncerramento: null,
          updatedAt:        new Date(),
        })
        .where(and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)))
        .returning();

      reopenedBalance = updated;
    });

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action:          "BALANCO_REABRIR",
        modulo:          "ESTOQUE",
        resourceType:    "balanco",
        resourceId:      body.balanceId,
        dadosAnteriores: existing       as unknown as Record<string, unknown>,
        dadosNovos:      reopenedBalance! as unknown as Record<string, unknown>,
        details: {
          message:          `Balanço ${existing.codigo} reaberto por ${nomeUsuario}. ${reversionCount} reversões de estoque geradas.`,
          totalItems:       items.length,
          reversoesGeradas: reversionCount,
        },
        status: "success",
      },
      request,
    );

    return json({ success: true, balance: reopenedBalance!, reversoesGeradas: reversionCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("reabrirBalanceHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Delete Balance ───────────────────────────────────────────────
export async function deleteBalanceHandler(
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

  const body = await request.json() as { balanceId: string };
  if (!body.balanceId) return err("balanceId obrigatório");

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    const existing = await db.query.stockBalances.findFirst({
      where: and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)),
    });

    if (!existing) return err("Balanço não encontrado", 404);
    if (existing.status === "encerrado") {
      return err("Balanços encerrados não podem ser excluídos", 403);
    }

    await db
      .delete(stockBalances)
      .where(and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)));

    logAudit(
      {
        userId, nomeUsuario, storeId,
        action:          "BALANCO_EXCLUIR",
        modulo:          "ESTOQUE",
        resourceType:    "balanco",
        resourceId:      body.balanceId,
        dadosAnteriores: existing as unknown as Record<string, unknown>,
        details: {
          message: `Balanço ${existing.codigo} excluído pelo usuário ${nomeUsuario}.`,
        },
        status: "success",
      },
      request,
    );

    return json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("deleteBalanceHandler:", msg);
    return err(msg, 500);
  }
}
