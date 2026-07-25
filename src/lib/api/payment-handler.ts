import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { requireStoreOwner, type AuthContext } from "@/lib/auth/require-store-access";
import { waitUntil } from "@/lib/execution-context";
import { priceOrder, isPricingFailure } from "@/lib/pricing/order-pricing";

const { stores, orders, orderItems, products } = schema;

const MP_API = "https://api.mercadopago.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── POST /api/payments/mp-checkout ─────────────────────────────
// Creates an order in the DB + a Mercado Pago preference.
// Returns { init_point, orderId } for the frontend to redirect.
export async function createMpCheckoutHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    storeId: string;
    type: string;
    items: {
      productId: string;
      productName: string;
      productEmoji?: string;
      quantity: number;
      unitPrice: string;
      total: string;
      additionsSnapshot?: { name: string; price: string }[];
      notes?: string;
    }[];
    // Valores informativos: o servidor recalcula tudo em priceOrder().
    subtotal: string;
    deliveryFee?: string;
    total: string;
    couponCode?: string;
    couponId?: string;
    addressSnapshot?: {
      street: string;
      number: string;
      neighborhood: string;
      city: string;
      state: string;
      zip: string;
      complement?: string;
    };
    estimatedDelivery?: string;
    customerEmail?: string;
    customerName?: string;
  };

  if (!body.storeId || !body.items?.length || !body.total) {
    return json({ error: "storeId, items e total são obrigatórios" }, 400);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  // Fetch store to get MP access token
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, body.storeId),
  });

  if (!store) return json({ error: "Loja não encontrada" }, 404);
  if (!store.mpAccessToken) {
    return json({ error: "Token do Mercado Pago não configurado. Acesse Configurações → Pagamentos." }, 400);
  }

  // Decrypt MP access token
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("ENCRYPTION_KEY not set");
    return json({ error: "Configuração de segurança incompleta" }, 500);
  }

  const mpAccessToken = await decrypt(store.mpAccessToken, encryptionKey);
  if (!mpAccessToken) {
    return json({ error: "Erro ao descriptografar token de pagamento" }, 500);
  }

  // Lojas que salvaram o token antes de mpUserId existir não seriam
  // reconhecidas pelo webhook. Preenche na primeira venda, em background —
  // sem isso o lojista teria que reconfigurar o token na mão.
  if (!store.mpUserId) {
    waitUntil(request, (async () => {
      try {
        const meRes = await fetch(`${MP_API}/users/me`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
        if (!meRes.ok) return;
        const me = await meRes.json() as { id?: number | string };
        if (me.id === undefined) return;
        await db.update(stores)
          .set({ mpUserId: String(me.id) })
          .where(eq(stores.id, store.id));
      } catch (err) {
        console.error("[mp-checkout] falha ao resolver mpUserId:", err);
      }
    })());
  }

  // Preço recalculado do banco pelo motor compartilhado — mesma conta do
  // checkout comum. A versão anterior daqui só relia o preço-base, ignorando
  // adicionais, variação, promoção, frete e cupom.
  const priced = await priceOrder(db, {
    storeId:         body.storeId,
    type:            body.type,
    items:           body.items,
    addressSnapshot: body.addressSnapshot,
    couponCode:      body.couponCode,
    couponId:        body.couponId,
    channel:         "store",
  });

  if (isPricingFailure(priced)) {
    return json({ error: priced.error }, priced.status);
  }

  // Create the order with status awaiting_payment
  const [maxOrder] = await db
    .select({ max: sql<number>`COALESCE(MAX(${orders.number}), 0)` })
    .from(orders)
    .where(eq(orders.storeId, body.storeId));

  const nextNumber = (Number(maxOrder?.max) || 0) + 1;

  const [order] = await db.insert(orders).values({
    storeId: body.storeId,
    number: nextNumber,
    status: "received",
    type: body.type || "delivery",
    paymentMethod: "mercadopago",
    paymentStatus: "pending",
    subtotal: priced.subtotal,
    deliveryFee: priced.deliveryFee,
    discount: priced.discount,
    total: priced.total,
    couponId: priced.couponId,
    addressSnapshot: body.addressSnapshot || null,
    estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : null,
  }).returning();

  // Insert order items
  await db.insert(orderItems).values(priced.items.map((item) => ({
    orderId: order.id,
    productId: item.productId,
    productName: item.productName,
    productEmoji: item.productEmoji,
    productImage: item.productImage,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    additionsTotal: item.additionsTotal,
    total: item.total,
    additionsSnapshot: item.additionsSnapshot,
    notes: item.notes,
  })));

  // Insert timeline entry
  await db.insert(schema.orderTimeline).values({
    orderId: order.id,
    status: "received",
    note: "Pedido criado — aguardando pagamento via Mercado Pago",
  });

  // Deduct stock
  for (const item of priced.items) {
    await db
      .update(products)
      .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
      .where(and(eq(products.id, item.productId), eq(products.storeId, body.storeId)));
  }

  // Build the origin URL for back_urls and notification_url
  const origin = new URL(request.url).origin;

  // Itens da preferência com os preços calculados no servidor. O frete entra
  // como uma linha própria para o total do MP bater com o total do pedido.
  const mpItems: Array<Record<string, unknown>> = priced.items.map((item) => ({
    id: item.productId,
    title: item.productName,
    quantity: item.quantity,
    unit_price: parseFloat(item.unitPrice),
    currency_id: "BRL",
  }));

  const freteMp = parseFloat(priced.deliveryFee);
  if (freteMp > 0) {
    mpItems.push({
      id: "delivery-fee",
      title: "Taxa de entrega",
      quantity: 1,
      unit_price: freteMp,
      currency_id: "BRL",
    });
  }

  const preferenceBody: Record<string, unknown> = {
    items: mpItems,
    external_reference: order.id,
    back_urls: {
      success: `${origin}/store/payment?status=success&order=${order.id}`,
      failure: `${origin}/store/payment?status=failure&order=${order.id}`,
      pending: `${origin}/store/payment?status=pending&order=${order.id}`,
    },
    auto_return: "approved",
    notification_url: `${origin}/api/payments/mp-webhook`,
    statement_descriptor: store.name,
  };

  if (body.customerEmail) {
    preferenceBody.payer = {
      email: body.customerEmail,
      name: body.customerName,
    };
  }

  const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferenceBody),
  });

  if (!mpRes.ok) {
    const err = await mpRes.text();
    console.error("MP preference error:", err);
    return json({ error: "Erro ao criar preferência de pagamento no Mercado Pago" }, 502);
  }

  const preference = await mpRes.json() as { id: string; init_point: string };

  return json({ init_point: preference.init_point, orderId: order.id, orderNumber: order.number });
}

// ─── POST /api/payments/mp-webhook ──────────────────────────────
//
// Modelo de confiança: a notificação é apenas um GATILHO. Nada que vem no
// corpo decide alguma coisa — nem o status, nem o valor, nem qual pedido foi
// pago. A única fonte de verdade é o recurso lido de volta na API do Mercado
// Pago com o token da própria loja.
//
// Por que não há validação de assinatura aqui, ao contrário do webhook de
// assinaturas: naquele, quem cobra é o Armazix, então o segredo do webhook é
// nosso (MP_WEBHOOK_SECRET). Aqui cada lojista usa a conta MP DELE — o segredo
// de assinatura fica no painel dele e nós não temos. Enquanto não existir um
// campo por loja para isso, a garantia vem da cadeia de verificação abaixo:
// mesmo que qualquer um dispare este endpoint com um corpo forjado, só
// aplicamos o que o MP confirmar, para o pedido que o MP disser, se o valor
// bater e se ainda não tiver sido aplicado.
export async function mpWebhookHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") || url.searchParams.get("type");

  let body: MpWebhookBody = {};
  try {
    body = await request.json() as MpWebhookBody;
  } catch {
    // IPN antigo manda tudo na query string — corpo vazio é esperado.
  }

  const eventType = topic ?? body.type ?? body.topic;
  if (eventType && eventType !== "payment" && eventType !== "payment_intent") {
    return ok();
  }

  const paymentId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    (body.data?.id !== undefined ? String(body.data.id) : null);

  if (!paymentId) return ok();

  const db = createDb(process.env.DATABASE_URL!);

  // ── 1. Descobrir com QUAL token consultar ────────────────────────────────
  // O MP identifica o lojista pelo `user_id` (o collector). Note que ele NÃO
  // manda o external_reference no webhook, então não dá para achar o pedido
  // primeiro. Varrer todas as lojas tentando cada token seria O(n) chamadas
  // externas por requisição — vetor de DoS trivial.
  const mpUserId = body.user_id !== undefined ? String(body.user_id) : null;
  if (!mpUserId) {
    console.error("[mp-webhook] Notificação sem user_id — impossível resolver a loja");
    return ok();
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.mpUserId, mpUserId) });
  if (!store?.mpAccessToken) {
    console.error(`[mp-webhook] Nenhuma loja com mpUserId=${mpUserId} (ou sem token salvo)`);
    return ok();
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("[mp-webhook] ENCRYPTION_KEY não configurada");
    return ok();
  }

  const accessToken = await decrypt(store.mpAccessToken, encryptionKey);
  if (!accessToken) {
    console.error("[mp-webhook] Falha ao descriptografar o token da loja");
    return ok();
  }

  // ── 2. Ler o pagamento REAL no Mercado Pago ──────────────────────────────
  const pmtRes = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!pmtRes.ok) {
    console.error(`[mp-webhook] GET /v1/payments/${paymentId} falhou: ${pmtRes.status}`);
    return ok();
  }

  const pmt = await pmtRes.json() as MpPayment;

  // ── 3. O pagamento precisa apontar de volta para um pedido nosso ─────────
  // Esta é a checagem de autorização: o vínculo pedido↔pagamento vem do
  // registro do MP, nunca do corpo da requisição.
  const orderId = pmt.external_reference;
  if (!orderId) {
    console.error(`[mp-webhook] Pagamento ${paymentId} sem external_reference — ignorado`);
    return ok();
  }

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) {
    console.error(`[mp-webhook] Pedido ${orderId} não encontrado`);
    return ok();
  }

  // O pedido tem que ser da mesma loja dona do token usado na consulta.
  if (order.storeId !== store.id) {
    console.error(
      `[mp-webhook] BLOQUEADO: pagamento ${paymentId} (loja ${store.id}) aponta para o pedido ${orderId} da loja ${order.storeId}`,
    );
    return ok();
  }

  const outcome = mapPaymentStatus(pmt.status);

  // ── 4. Conferência de valor — só para liberar como pago ─────────────────
  if (outcome.paymentStatus === "paid") {
    if (pmt.currency_id && pmt.currency_id !== "BRL") {
      console.error(`[mp-webhook] Moeda inesperada em ${paymentId}: ${pmt.currency_id}`);
      return ok();
    }
    const pago    = Number(pmt.transaction_amount ?? 0);
    const devido  = Number(order.total ?? 0);
    // Tolerância de 1 centavo para arredondamento de ponto flutuante.
    if (!Number.isFinite(pago) || pago + 0.01 < devido) {
      console.error(
        `[mp-webhook] BLOQUEADO: pagamento ${paymentId} de R$ ${pago} não cobre o pedido ${orderId} de R$ ${devido}`,
      );
      return ok();
    }
  }

  // ── 5. Aplicar, sem reprocessar e sem rebaixar ──────────────────────────
  await applyPaymentOutcome(db, order, paymentId, pmt.status, outcome);

  return ok();
}

// ─── Tipos do payload/recurso do MP ─────────────────────────────
interface MpWebhookBody {
  type?: string;
  topic?: string;
  user_id?: number | string;
  data?: { id?: number | string };
}

interface MpPayment {
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
}

interface PaymentOutcome {
  paymentStatus: "paid" | "failed" | "pending" | "refunded";
  orderStatus: "confirmed" | "cancelled" | "received";
}

function ok(): Response {
  return new Response("ok", { status: 200 });
}

function mapPaymentStatus(status?: string): PaymentOutcome {
  switch (status) {
    case "approved":
      return { paymentStatus: "paid", orderStatus: "confirmed" };
    case "refunded":
    case "charged_back":
      return { paymentStatus: "refunded", orderStatus: "cancelled" };
    case "rejected":
    case "cancelled":
      return { paymentStatus: "failed", orderStatus: "cancelled" };
    default:
      // pending | in_process | authorized | desconhecido
      return { paymentStatus: "pending", orderStatus: "received" };
  }
}

async function applyPaymentOutcome(
  db: ReturnType<typeof createDb>,
  order: { id: string; paymentStatus: string | null; gatewayPaymentId: string | null },
  paymentId: string,
  rawStatus: string | undefined,
  outcome: PaymentOutcome,
): Promise<void> {
  // Idempotência: reenvio do MP e replay de uma notificação capturada chegam
  // com o mesmo payment id. Se já foi aplicado, não há o que fazer.
  if (order.gatewayPaymentId === paymentId && order.paymentStatus === outcome.paymentStatus) {
    return;
  }

  // Um evento "pending" atrasado não pode desfazer um pagamento já confirmado.
  // Estorno é a única transição que sai de "paid".
  if (order.paymentStatus === "paid" && outcome.paymentStatus !== "refunded") {
    console.error(
      `[mp-webhook] Ignorando transição paid → ${outcome.paymentStatus} no pedido ${order.id} (evento fora de ordem)`,
    );
    return;
  }

  const [updated] = await db
    .update(orders)
    .set({
      paymentStatus:    outcome.paymentStatus,
      status:           outcome.orderStatus,
      gatewayPaymentId: paymentId,
      updatedAt:        new Date(),
    })
    .where(eq(orders.id, order.id))
    .returning({ id: orders.id });

  if (!updated) return;

  await db.insert(schema.orderTimeline).values({
    orderId: order.id,
    status:  outcome.orderStatus,
    note:    `Pagamento ${rawStatus ?? outcome.paymentStatus} via Mercado Pago`,
  });
}

// ─── POST /api/payments/mp-token ────────────────────────────────
// Saves the MP access token for a store (encrypted).
// CRITICAL: Only store owner/admin can set payment tokens to prevent revenue theft.
export async function saveMpTokenHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // CRITICAL IDOR Fix: Validate store owner access for sensitive payment configuration
  let storeId: string;
  try {
    const access = await requireStoreOwner(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ 
      error: (error as Error).message || "Unauthorized" 
    }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { accessToken: string; publicKey?: string };
  if (!body.accessToken) {
    return json({ error: "accessToken é obrigatório" }, 400);
  }

  // Basic validation: token must start with APP_USR- or TEST-
  if (!body.accessToken.startsWith("APP_USR-") && !body.accessToken.startsWith("TEST-")) {
    return json({ error: "Token inválido. Deve começar com APP_USR- (produção) ou TEST- (sandbox)" }, 400);
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("ENCRYPTION_KEY not set");
    return json({ error: "Configuração de segurança incompleta" }, 500);
  }

  // Resolve o id da conta MP do lojista. É por ele que o webhook reconhece de
  // qual loja é a notificação (o MP manda `user_id`, não o external_reference).
  // De quebra, confirma que o token é aceito pelo MP antes de salvarmos.
  const meRes = await fetch(`${MP_API}/users/me`, {
    headers: { Authorization: `Bearer ${body.accessToken}` },
  });
  if (!meRes.ok) {
    return json({ error: "O Mercado Pago recusou este token. Confira se copiou o Access Token correto." }, 400);
  }
  const me = await meRes.json() as { id?: number | string };
  const mpUserId = me.id !== undefined ? String(me.id) : null;

  try {
    const encryptedToken = await encrypt(body.accessToken, encryptionKey);

    const dbUrl = process.env.DATABASE_URL!;
    const db = createDb(dbUrl);

    await db
      .update(stores)
      .set({
        mpAccessToken: encryptedToken,
        mpUserId,
        // Public key is not sensitive; stored in plaintext
        ...(body.publicKey !== undefined ? { mpPublicKey: body.publicKey || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId));

    return json({ success: true });
  } catch (error) {
    console.error("Error saving MP token:", error);
    return json({ error: "Erro ao salvar token" }, 500);
  }
}
