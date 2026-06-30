import { createDb, createTenantDb, schema } from "@/lib/db";
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
  const db = await createTenantDb(dbUrl, storeId);

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
    dataEncerramento?: string | null;
    status: "aberto" | "encerrado";
    items: BalancoItemJson[];
  };

  if (!body.codigo?.trim() || !body.dataContagem) {
    return err("codigo e dataContagem são obrigatórios");
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    let balance: typeof stockBalances.$inferSelect;
    let correctionCount = 0;

    await db.transaction(async (tx) => {
      // 1. Inserir o balanço
      const [newBalance] = await tx
        .insert(stockBalances)
        .values({
          storeId,
          codigo:           body.codigo,
          prodScope:        body.prodScope ?? "todos",
          preco:            body.preco ?? "Preço de custo",
          dataContagem:     new Date(body.dataContagem),
          dataEncerramento: body.dataEncerramento ? new Date(body.dataEncerramento) : null,
          status:           body.status ?? "aberto",
          items:            body.items ?? [],
          createdBy:        userId,
          createdByName:    nomeUsuario,
        })
        .returning();

      balance = newBalance;

      // 2. Se encerrado, gerar movimentações corretivas para divergências
      if (body.status === "encerrado" && Array.isArray(body.items)) {
        for (const item of body.items) {
          if (item.diff === null || item.diff === 0) continue;
          // diff = counted - systemStock
          // diff > 0 → sobra (acréscimo), diff < 0 → falta (redução)

          // Ler o saldo atual real (pode ter mudado desde que o balanço foi aberto)
          const [prod] = await tx
            .select({ stock: products.stock })
            .from(products)
            .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
            .limit(1);

          if (!prod) continue;

          const balanceBefore = prod.stock ?? 0;
          // O counted do balanço é o valor real físico confirmado
          const balanceAfter = Math.max(0, item.counted ?? 0);

          if (balanceBefore === balanceAfter) continue; // já está correto

          await tx
            .update(products)
            .set({ stock: balanceAfter, updatedAt: new Date() })
            .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

          await tx
            .insert(stockMovements)
            .values({
              storeId,
              productId:    item.productId,
              productName:  item.productName,
              type:         "RECONTAGEM",
              quantity:     Math.abs(balanceAfter - balanceBefore),
              balanceBefore,
              balanceAfter,
              origem:       `Balanço ${body.codigo} — Recontagem`,
              createdBy:    userId,
              createdByName: nomeUsuario,
            });

          correctionCount++;
        }
      }
    });

    logAudit(
      {
        userId,
        nomeUsuario,
        storeId,
        action:       "BALANCO_CRIAR",
        modulo:       "ESTOQUE",
        resourceType: "balanco",
        resourceId:   balance!.id,
        dadosNovos:   balance! as unknown as Record<string, unknown>,
        details: {
          message: `Balanço ${body.codigo} criado por ${nomeUsuario} com ${body.items.length} itens.`,
          totalItems: body.items.length,
          encerrado: body.status === "encerrado",
          correcoesGeradas: correctionCount,
        },
        status: "success",
      },
      request,
    );

    return json({ success: true, balance: balance!, correcoesGeradas: correctionCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("createBalanceHandler:", msg);
    return err(msg, 500);
  }
}

// ─── Update Balance ───────────────────────────────────────────────
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
    dataEncerramento?: string | null;
    status?: "aberto" | "encerrado";
    items?: BalancoItemJson[];
  };

  if (!body.balanceId) return err("balanceId obrigatório");

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    const existing = await db.query.stockBalances.findFirst({
      where: and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)),
    });

    if (!existing) return err("Balanço não encontrado", 404);

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
        dataEncerramento:
          body.dataEncerramento !== undefined
            ? (body.dataEncerramento ? new Date(body.dataEncerramento) : null)
            : existing.dataEncerramento,
        status:    body.status ?? existing.status,
        items:     newItems,
        updatedAt: new Date(),
      })
      .where(and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)))
      .returning();

    logAudit(
      {
        userId,
        nomeUsuario,
        storeId,
        action:          "BALANCO_EDITAR",
        modulo:          "ESTOQUE",
        resourceType:    "balanco",
        resourceId:      body.balanceId,
        dadosAnteriores: existing as unknown as Record<string, unknown>,
        dadosNovos:      updated  as unknown as Record<string, unknown>,
        details: {
          message:      `Balanço ${existing.codigo} editado pelo usuário ${nomeUsuario}. Itens alterados: ${changedIds.length} (IDs: ${changedIds.join(", ") || "nenhum"}).`,
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
  const db = await createTenantDb(dbUrl, storeId);
  const nomeUsuario = await getUserName(dbUrl, userId);

  try {
    const existing = await db.query.stockBalances.findFirst({
      where: and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)),
    });

    if (!existing) return err("Balanço não encontrado", 404);

    await db
      .delete(stockBalances)
      .where(and(eq(stockBalances.id, body.balanceId), eq(stockBalances.storeId, storeId)));

    logAudit(
      {
        userId,
        nomeUsuario,
        storeId,
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
