import { createDb, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";

const { paymentPlans } = schema;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TIPOS_PLANO = ["avista", "dia", "mes"] as const;
type TipoPlano = typeof TIPOS_PLANO[number];

// ─── GET /api/payment-plans/list ──────────────────────────────────
export async function listPaymentPlansHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const rows = await db.select().from(paymentPlans)
      .where(eq(paymentPlans.storeId, storeId))
      .orderBy(paymentPlans.codigo);
    return json({ plans: rows });
  } catch (error) {
    console.error("List payment plans error:", error);
    return json({ error: "Erro ao listar planos de pagamento" }, 500);
  }
}

// ─── POST /api/payment-plans/create ───────────────────────────────
export async function createPaymentPlanHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    nome: string; tipo: TipoPlano; parcelas: number; quantidade: number;
  };
  if (!body.nome?.trim()) return json({ error: "nome obrigatório" }, 400);
  if (!TIPOS_PLANO.includes(body.tipo)) return json({ error: "tipo inválido" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const [{ nextCodigo }] = await db
      .select({ nextCodigo: sql<number>`coalesce(max(${paymentPlans.codigo}), 0) + 1` })
      .from(paymentPlans)
      .where(eq(paymentPlans.storeId, storeId));

    const [plan] = await db.insert(paymentPlans).values({
      storeId,
      codigo: nextCodigo,
      nome: body.nome.trim(),
      ativo: true,
      parcelas: Math.max(1, body.parcelas || 1),
      tipo: body.tipo,
      quantidade: body.tipo === "avista" ? 0 : Math.max(0, body.quantidade || 0),
    }).returning();

    return json({ success: true, plan }, 201);
  } catch (error) {
    console.error("Create payment plan error:", error);
    return json({ error: "Erro ao criar plano de pagamento" }, 500);
  }
}

// ─── POST /api/payment-plans/update ───────────────────────────────
export async function updatePaymentPlanHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    planId: string; nome?: string; tipo?: TipoPlano; parcelas?: number;
    quantidade?: number; ativo?: boolean;
  };
  if (!body.planId) return json({ error: "planId obrigatório" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const existing = await db.query.paymentPlans.findFirst({
      where: and(eq(paymentPlans.id, body.planId), eq(paymentPlans.storeId, storeId)),
    });
    if (!existing) return json({ error: "Plano não encontrado" }, 404);

    if (body.tipo !== undefined && !TIPOS_PLANO.includes(body.tipo)) {
      return json({ error: "tipo inválido" }, 400);
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.nome !== undefined) patch.nome = body.nome.trim();
    if (body.tipo !== undefined) patch.tipo = body.tipo;
    if (body.parcelas !== undefined) patch.parcelas = Math.max(1, body.parcelas || 1);
    if (body.quantidade !== undefined) patch.quantidade = Math.max(0, body.quantidade || 0);
    if (body.ativo !== undefined) patch.ativo = body.ativo;

    const [updated] = await db.update(paymentPlans).set(patch)
      .where(and(eq(paymentPlans.id, body.planId), eq(paymentPlans.storeId, storeId)))
      .returning();

    return json({ success: true, plan: updated });
  } catch (error) {
    console.error("Update payment plan error:", error);
    return json({ error: "Erro ao atualizar plano de pagamento" }, 500);
  }
}
