import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";

const { stores } = schema;
const MP_API = "https://api.mercadopago.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Plan definitions — single source of truth
export const PLANS: Record<string, { name: string; price: number; reason: string }> = {
  start: { name: "Start",  price: 19.90, reason: "Plano Start — Armazix" },
  pro:   { name: "Pro",    price: 39.90, reason: "Plano Pro — Armazix"   },
  full:  { name: "Full",   price: 79.90, reason: "Plano Full — Armazix"  },
};

// PDV add-on price
export const PDV_PRICE = 50.00;

// ─── POST /api/subscriptions/create ──────────────────────────────
// Creates a Mercado Pago preapproval (recurring subscription) and
// returns the init_point URL to redirect the user.
export async function createSubscriptionHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    planId: string;       // start | pro | full
    withPdv?: boolean;
    payerEmail: string;
    payerName?: string;
  };

  if (!body.planId || !body.payerEmail) {
    return json({ error: "planId e payerEmail são obrigatórios" }, 400);
  }

  const plan = PLANS[body.planId];
  if (!plan) return json({ error: "Plano inválido" }, 400);

  const accessToken = process.env.PLATFORM_MP_ACCESS_TOKEN;
  if (!accessToken) return json({ error: "Configuração de pagamento não encontrada" }, 500);

  const totalAmount = plan.price + (body.withPdv ? PDV_PRICE : 0);
  const reason = body.withPdv ? `${plan.reason} + PDV` : plan.reason;
  const origin = new URL(request.url).origin;

  const preapprovalBody = {
    reason,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: totalAmount,
      currency_id: "BRL",
    },
    back_url: `${origin}/admin/settings?tab=planos`,
    payer_email: body.payerEmail,
    external_reference: `${storeId}|${body.planId}${body.withPdv ? "|pdv" : ""}`,
  };

  const mpRes = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preapprovalBody),
  });

  if (!mpRes.ok) {
    const err = await mpRes.text();
    console.error("MP preapproval error:", err);
    return json({ error: "Erro ao criar assinatura no Mercado Pago" }, 502);
  }

  const preapproval = await mpRes.json() as { id: string; init_point: string };

  // Store the subscription ID immediately so we can track it
  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  await db.update(stores)
    .set({ mpSubscriptionId: preapproval.id, updatedAt: new Date() })
    .where(eq(stores.id, storeId));

  return json({ init_point: preapproval.init_point, subscriptionId: preapproval.id });
}

// ─── GET /api/subscriptions/status ───────────────────────────────
// Returns the current plan info for a store.
export async function getSubscriptionStatusHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
  if (!store) return json({ error: "Loja não encontrada" }, 404);

  return json({
    plan: store.plan ?? "free",
    planStatus: store.planStatus ?? "active",
    planExpiresAt: store.planExpiresAt,
    mpSubscriptionId: store.mpSubscriptionId,
  });
}

// ─── POST /api/subscriptions/mp-webhook ──────────────────────────
// Receives Mercado Pago preapproval/subscription webhooks and updates plan status.
export async function subscriptionWebhookHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") || url.searchParams.get("type");
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");

  if (!dataId) return new Response("ok", { status: 200 });

  // We only care about preapproval (subscription) events
  if (topic !== "preapproval" && topic !== "subscription_preapproval") {
    return new Response("ok", { status: 200 });
  }

  const accessToken = process.env.PLATFORM_MP_ACCESS_TOKEN;
  if (!accessToken) return new Response("ok", { status: 200 });

  // Fetch the preapproval from MP
  const mpRes = await fetch(`${MP_API}/preapproval/${dataId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mpRes.ok) return new Response("ok", { status: 200 });

  const preapproval = await mpRes.json() as {
    id: string;
    status: string;
    external_reference?: string;
    next_payment_date?: string;
  };

  if (!preapproval.external_reference) return new Response("ok", { status: 200 });

  const [storeId, planId] = preapproval.external_reference.split("|");
  if (!storeId || !planId) return new Response("ok", { status: 200 });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  let planStatus: string;
  let newPlan: string;
  let planExpiresAt: Date | null = null;

  switch (preapproval.status) {
    case "authorized":
      planStatus = "active";
      newPlan = planId;
      // Set expiry to next payment date + 1 day buffer, or +31 days
      planExpiresAt = preapproval.next_payment_date
        ? new Date(new Date(preapproval.next_payment_date).getTime() + 86400000)
        : new Date(Date.now() + 31 * 86400000);
      break;
    case "cancelled":
    case "paused":
      planStatus = preapproval.status;
      newPlan = "free";
      planExpiresAt = null;
      break;
    case "pending":
      planStatus = "pending";
      newPlan = planId;
      break;
    default:
      planStatus = preapproval.status;
      newPlan = planId;
  }

  await db.update(stores)
    .set({
      plan: newPlan,
      planStatus,
      planExpiresAt,
      mpSubscriptionId: preapproval.id,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));

  return new Response("ok", { status: 200 });
}
