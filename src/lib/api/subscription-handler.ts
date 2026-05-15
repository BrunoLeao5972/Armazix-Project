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
export const PLANS: Record<string, { name: string; price: number; pixPrice: number; reason: string }> = {
  start: { name: "Start", price: 19.90, pixPrice: 24.90, reason: "Plano Start — Armazix" },
  pro:   { name: "Pro",   price: 39.90, pixPrice: 44.90, reason: "Plano Pro — Armazix"   },
  full:  { name: "Full",  price: 79.90, pixPrice: 84.90, reason: "Plano Full — Armazix"  },
};

// PDV add-on price
export const PDV_PRICE = 50.00;
// PIX surcharge
export const PIX_SURCHARGE = 5.00;

// ─── Helpers ─────────────────────────────────────────────────────

/** Check and auto-expire PIX plans that have passed their expiry date. */
async function autoExpirePixPlan(db: ReturnType<typeof createDb>, storeId: string, store: { planStatus: string | null; planExpiresAt: Date | null; paymentMethod: string | null }) {
  if (
    store.paymentMethod === "pix_manual" &&
    store.planStatus === "active" &&
    store.planExpiresAt &&
    new Date(store.planExpiresAt) < new Date()
  ) {
    await db.update(stores)
      .set({ plan: "free", planStatus: "expired", updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    return true;
  }
  return false;
}

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

  // Store the subscription ID and payment method immediately
  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  await db.update(stores)
    .set({
      mpSubscriptionId: preapproval.id,
      paymentMethod: "card_recurring",
      pdvEnabled: body.withPdv ?? false,
      updatedAt: new Date(),
    })
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

  // Auto-expire PIX plans that have passed their expiry date
  const didExpire = await autoExpirePixPlan(db, storeId, {
    planStatus: store.planStatus,
    planExpiresAt: store.planExpiresAt,
    paymentMethod: store.paymentMethod,
  });

  return json({
    plan: didExpire ? "free" : (store.plan ?? "free"),
    planStatus: didExpire ? "expired" : (store.planStatus ?? "active"),
    planExpiresAt: store.planExpiresAt,
    mpSubscriptionId: store.mpSubscriptionId,
    paymentMethod: store.paymentMethod ?? "card_recurring",
    pdvEnabled: store.pdvEnabled ?? false,
    mpPaymentId: store.mpPaymentId,
    amountPaid: store.amountPaid,
    paymentStatus: store.paymentStatus,
  });
}

// ─── POST /api/subscriptions/create-pix ─────────────────────────
// Creates a one-time PIX payment (non-recurring) via Mercado Pago.
export async function createPixPaymentHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    planId: string;      // start | pro | full
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

  const basePrice = plan.pixPrice;
  const totalAmount = +(basePrice + (body.withPdv ? PDV_PRICE : 0)).toFixed(2);
  const description = `${plan.reason} via PIX${body.withPdv ? " + PDV" : ""}`;
  const origin = new URL(request.url).origin;

  const paymentBody = {
    transaction_amount: totalAmount,
    description,
    payment_method_id: "pix",
    external_reference: `${storeId}|${body.planId}|pix_manual${body.withPdv ? "|pdv" : ""}`,
    notification_url: `${origin}/api/subscriptions/pix-webhook`,
    date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h to pay
    payer: {
      email: body.payerEmail,
      ...(body.payerName ? { first_name: body.payerName.split(" ")[0], last_name: body.payerName.split(" ").slice(1).join(" ") || body.payerName.split(" ")[0] } : {}),
    },
  };

  const mpRes = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymentBody),
  });

  if (!mpRes.ok) {
    const err = await mpRes.text();
    console.error("MP PIX payment error:", err);
    return json({ error: "Erro ao criar cobrança PIX no Mercado Pago" }, 502);
  }

  const payment = await mpRes.json() as {
    id: number;
    status: string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
        ticket_url?: string;
      };
    };
  };

  const pixData = payment.point_of_interaction?.transaction_data;
  if (!pixData?.qr_code) {
    return json({ error: "Dados PIX não encontrados na resposta" }, 502);
  }

  // Persist the pending payment reference
  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  await db.update(stores)
    .set({
      mpPaymentId: String(payment.id),
      paymentMethod: "pix_manual",
      pdvEnabled: body.withPdv ?? false,
      planStatus: "pending",
      amountPaid: String(totalAmount),
      paymentStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));

  return json({
    paymentId: payment.id,
    status: payment.status,
    qrCode: pixData.qr_code,
    qrCodeBase64: pixData.qr_code_base64,
    ticketUrl: pixData.ticket_url,
    totalAmount,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

// ─── POST /api/subscriptions/pix-webhook ─────────────────────────
// Receives Mercado Pago payment notifications for PIX charges.
export async function pixWebhookHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") || url.searchParams.get("type");
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");

  // MP also sends JSON body for some notification types
  let paymentId = dataId;
  if (!paymentId) {
    try {
      const body = await request.json() as { data?: { id?: string } };
      paymentId = body?.data?.id ?? null;
    } catch { /* ignore */ }
  }

  if (!paymentId) return new Response("ok", { status: 200 });

  // Only handle payment events
  if (topic && topic !== "payment") return new Response("ok", { status: 200 });

  const accessToken = process.env.PLATFORM_MP_ACCESS_TOKEN;
  if (!accessToken) return new Response("ok", { status: 200 });

  // Fetch the payment from MP
  const mpRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mpRes.ok) return new Response("ok", { status: 200 });

  const payment = await mpRes.json() as {
    id: number;
    status: string;
    external_reference?: string;
    transaction_amount?: number;
    payment_method_id?: string;
  };

  // Only process PIX payments
  if (payment.payment_method_id !== "pix") return new Response("ok", { status: 200 });

  if (!payment.external_reference) return new Response("ok", { status: 200 });

  const parts = payment.external_reference.split("|");
  const [payerStoreId, planId, type] = parts;
  if (!payerStoreId || !planId || type !== "pix_manual") return new Response("ok", { status: 200 });

  const withPdv = parts.includes("pdv");

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  if (payment.status === "approved") {
    const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
    await db.update(stores)
      .set({
        plan: planId,
        planStatus: "active",
        planExpiresAt,
        paymentMethod: "pix_manual",
        pdvEnabled: withPdv,
        mpPaymentId: String(payment.id),
        amountPaid: payment.transaction_amount ? String(payment.transaction_amount) : null,
        paymentStatus: "approved",
        updatedAt: new Date(),
      })
      .where(eq(stores.id, payerStoreId));
  } else if (payment.status === "rejected" || payment.status === "cancelled") {
    await db.update(stores)
      .set({
        paymentStatus: payment.status,
        planStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(stores.id, payerStoreId));
  }

  return new Response("ok", { status: 200 });
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
