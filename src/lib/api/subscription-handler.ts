import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { PLANS as PLAN_DEFS } from "@/lib/plans";
import { validateMercadoPagoSignature } from "@/lib/webhook-validator";

const { stores } = schema;
const MP_API = "https://api.mercadopago.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Planos pagos (assinatura via Mercado Pago) — os dados de preço vêm de
// src/lib/plans.ts, a fonte única de verdade compartilhada com o front.
// "free" fica de fora aqui de propósito: não existe cobrança pro trial.
export const PLANS: Record<string, { name: string; price: number; pixPrice: number; reason: string }> = {
  start: { name: PLAN_DEFS.start.name, price: PLAN_DEFS.start.price, pixPrice: PLAN_DEFS.start.pixPrice, reason: PLAN_DEFS.start.mpReason },
  pro:   { name: PLAN_DEFS.pro.name,   price: PLAN_DEFS.pro.price,   pixPrice: PLAN_DEFS.pro.pixPrice,   reason: PLAN_DEFS.pro.mpReason   },
  full:  { name: PLAN_DEFS.full.name,  price: PLAN_DEFS.full.price,  pixPrice: PLAN_DEFS.full.pixPrice,  reason: PLAN_DEFS.full.mpReason  },
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

  // Store the subscription ID and payment method immediately.
  // pdvEnabled NÃO é setado aqui — a preapproval ainda não foi paga.
  // Só o webhook (subscriptionWebhookHandler), depois de confirmar o
  // pagamento com o Mercado Pago, libera o add-on.
  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  await db.update(stores)
    .set({
      mpSubscriptionId: preapproval.id,
      paymentMethod: "card_recurring",
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

  const idempotencyKey = `${storeId}-${body.planId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const mpRes = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(paymentBody),
  });

  if (!mpRes.ok) {
    const errText = await mpRes.text();
    console.error("MP PIX payment error:", mpRes.status, errText);
    let detail = "";
    try {
      const parsed = JSON.parse(errText) as { message?: string; error?: string; cause?: Array<{ description?: string }> };
      detail = parsed.message || parsed.error || parsed.cause?.[0]?.description || "";
    } catch { detail = errText.slice(0, 200); }
    return json({ error: `Erro ao criar cobrança PIX no Mercado Pago${detail ? `: ${detail}` : ""}` }, 502);
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

  // Persist the pending payment reference.
  // pdvEnabled NÃO é setado aqui — o PIX ainda não foi pago (planStatus
  // fica "pending"). Só pixWebhookHandler, no branch "approved", libera.
  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);
  await db.update(stores)
    .set({
      mpPaymentId: String(payment.id),
      paymentMethod: "pix_manual",
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

  // Valida que a notificação veio mesmo do Mercado Pago (fail closed).
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[pix-webhook] MP_WEBHOOK_SECRET não configurado — webhook bloqueado");
    return new Response("Webhook security not configured", { status: 500 });
  }
  const sig = await validateMercadoPagoSignature(request, paymentId, webhookSecret);
  if (!sig.valid) {
    console.error("[pix-webhook] Falha na verificação de assinatura:", sig.error);
    return new Response("Unauthorized", { status: 401 });
  }

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
    // Guarda de idempotência: só aplica se este payment.id ainda não foi
    // processado para esta loja — evita renovação grátis por replay do webhook.
    const [updated] = await db.update(stores)
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
      .where(and(
        eq(stores.id, payerStoreId),
        or(isNull(stores.mpPaymentId), ne(stores.mpPaymentId, String(payment.id))),
      ))
      .returning({ id: stores.id });

    if (!updated) {
      console.log(`[pix-webhook] payment ${payment.id} já aplicado para a loja ${payerStoreId} — ignorando replay`);
    }
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

  // Duas origens de evento nos interessam:
  // - preapproval / subscription_preapproval: mudança de status da assinatura
  //   em si (autorizada, cancelada, pausada). data.id = id do preapproval.
  // - subscription_authorized_payment: cada cobrança recorrente processada
  //   com sucesso. data.id = id do "authorized payment" (a cobrança), não da
  //   assinatura — é isso que efetivamente empurra next_payment_date pra
  //   frente no lado do MP, então precisamos reagir a ele pra planExpiresAt
  //   acompanhar a renovação mensal (sem isso, a assinatura "trava" na data
  //   da primeira autorização e nunca mais é confirmada como paga).
  const isPreapprovalStatus = topic === "preapproval" || topic === "subscription_preapproval";
  const isAuthorizedPayment = topic === "subscription_authorized_payment";
  if (!isPreapprovalStatus && !isAuthorizedPayment) {
    return new Response("ok", { status: 200 });
  }

  // Valida que a notificação veio mesmo do Mercado Pago (fail closed).
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[mp-webhook] MP_WEBHOOK_SECRET não configurado — webhook bloqueado");
    return new Response("Webhook security not configured", { status: 500 });
  }
  const sig = await validateMercadoPagoSignature(request, dataId, webhookSecret);
  if (!sig.valid) {
    console.error("[mp-webhook] Falha na verificação de assinatura:", sig.error);
    return new Response("Unauthorized", { status: 401 });
  }

  const accessToken = process.env.PLATFORM_MP_ACCESS_TOKEN;
  if (!accessToken) return new Response("ok", { status: 200 });

  // Resolve o id do preapproval — direto se o evento já é sobre a assinatura,
  // ou buscando o authorized_payment primeiro se o evento é de uma cobrança.
  let preapprovalId = dataId;
  if (isAuthorizedPayment) {
    const apRes = await fetch(`${MP_API}/authorized_payments/${dataId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!apRes.ok) {
      console.error(`[mp-webhook] Falha ao buscar authorized_payment ${dataId}: ${apRes.status}`);
      return new Response("ok", { status: 200 });
    }
    const authorizedPayment = await apRes.json() as { preapproval_id?: string; status?: string };
    if (!authorizedPayment.preapproval_id) return new Response("ok", { status: 200 });
    // Só renova em cobrança de fato processada — evita estender o acesso em
    // cima de uma tentativa de cobrança que falhou/está pendente.
    if (authorizedPayment.status && authorizedPayment.status !== "processed") {
      console.log(`[mp-webhook] authorized_payment ${dataId} com status "${authorizedPayment.status}" — ignorando`);
      return new Response("ok", { status: 200 });
    }
    preapprovalId = authorizedPayment.preapproval_id;
  }

  // Fetch the preapproval from MP
  const mpRes = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
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

  const refParts = preapproval.external_reference.split("|");
  const [storeId, planId] = refParts;
  if (!storeId || !planId) return new Response("ok", { status: 200 });
  const withPdv = refParts.includes("pdv");

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  let planStatus: string;
  let newPlan: string;
  let planExpiresAt: Date | null = null;
  // pdvEnabled só é liberado quando a assinatura está de fato ativa e paga —
  // em qualquer outro status (pending/cancelled/paused) fica desligado.
  let pdvEnabled = false;

  switch (preapproval.status) {
    case "authorized":
      planStatus = "active";
      newPlan = planId;
      pdvEnabled = withPdv;
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
      pdvEnabled,
      mpSubscriptionId: preapproval.id,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));

  return new Response("ok", { status: 200 });
}
