import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

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
    }[];
    subtotal: string;
    deliveryFee?: string;
    total: string;
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
    subtotal: body.subtotal,
    deliveryFee: body.deliveryFee || "0",
    discount: "0",
    total: body.total,
    addressSnapshot: body.addressSnapshot || null,
    estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : null,
  }).returning();

  // Insert order items
  const itemsValues = body.items.map((item) => ({
    orderId: order.id,
    productId: item.productId || null,
    productName: item.productName,
    productEmoji: item.productEmoji || null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    additionsTotal: "0",
    total: item.total,
  }));
  await db.insert(orderItems).values(itemsValues);

  // Insert timeline entry
  await db.insert(schema.orderTimeline).values({
    orderId: order.id,
    status: "received",
    note: "Pedido criado — aguardando pagamento via Mercado Pago",
  });

  // Deduct stock
  for (const item of body.items) {
    if (item.productId) {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
        .where(eq(products.id, item.productId));
    }
  }

  // Build the origin URL for back_urls and notification_url
  const origin = new URL(request.url).origin;

  // Build MP preference items
  const mpItems = body.items.map((item) => ({
    id: item.productId,
    title: item.productName,
    quantity: item.quantity,
    unit_price: parseFloat(item.unitPrice),
    currency_id: "BRL",
  }));

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
      Authorization: `Bearer ${store.mpAccessToken}`,
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
// Receives Mercado Pago IPN/webhook notifications and updates order status.
export async function mpWebhookHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // MP can send data-id as query param or in body
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const topic = url.searchParams.get("topic") || url.searchParams.get("type");

  if (!dataId || (topic !== "payment" && topic !== "payment_intent")) {
    return new Response("ok", { status: 200 });
  }

  // We need a store's MP access token to query the payment.
  // We'll fetch the payment using the storeId from the order (fetched by external_reference).
  // First get the payment from MP using a platform-level query or store token.
  // Since we don't know which store's token to use, we need to query the payment first
  // using the resource URL from the notification body.

  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    // body may be empty for old IPN format
  }

  const resource = (body.resource as string) || `${MP_API}/v1/payments/${dataId}`;
  const paymentId = dataId;

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  // Fetch the payment — we need to try with all store tokens or fetch order first.
  // Strategy: find payment notification, extract external_reference (orderId),
  // find the store for that order, then use that store's token to verify.

  // First attempt: try fetching payment without auth to get external_reference
  // (MP requires auth, so we query our DB for the order using the dataId pattern)
  // Better: just trust the webhook and update by external_reference if present in body.
  const externalRef = (body.external_reference as string) || undefined;

  if (externalRef) {
    // Find the order directly
    const order = await db.query.orders.findFirst({ where: eq(orders.id, externalRef) });
    if (order) {
      const store = await db.query.stores.findFirst({ where: eq(stores.id, order.storeId) });
      if (store?.mpAccessToken) {
        await verifyAndUpdatePayment(db, paymentId, store.mpAccessToken, externalRef);
      }
    }
    return new Response("ok", { status: 200 });
  }

  // If no external_reference in body, fetch payment from MP using each store token
  // (not ideal for multi-tenant; rely on external_reference being in query or body)
  // MP sends the payment URL in the resource field when using IPN
  if (resource && resource.includes("/v1/payments/")) {
    const pid = resource.split("/v1/payments/")[1];
    if (pid) {
      // Find all stores and try to fetch payment — limited, but works for single-store setups
      const allStores = await db.query.stores.findMany();
      for (const store of allStores) {
        if (!store.mpAccessToken) continue;
        const pmtRes = await fetch(`${MP_API}/v1/payments/${pid}`, {
          headers: { Authorization: `Bearer ${store.mpAccessToken}` },
        });
        if (pmtRes.ok) {
          const pmt = await pmtRes.json() as { external_reference?: string; status?: string };
          if (pmt.external_reference) {
            await verifyAndUpdatePayment(db, pid, store.mpAccessToken, pmt.external_reference);
            break;
          }
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
}

async function verifyAndUpdatePayment(
  db: ReturnType<typeof createDb>,
  paymentId: string,
  accessToken: string,
  orderId: string
) {
  const pmtRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!pmtRes.ok) return;

  const pmt = await pmtRes.json() as { status: string; status_detail: string };

  let orderPaymentStatus: string;
  let orderStatus: string;

  switch (pmt.status) {
    case "approved":
      orderPaymentStatus = "paid";
      orderStatus = "confirmed";
      break;
    case "rejected":
    case "cancelled":
      orderPaymentStatus = "failed";
      orderStatus = "cancelled";
      break;
    case "pending":
    case "in_process":
    case "authorized":
      orderPaymentStatus = "pending";
      orderStatus = "received";
      break;
    default:
      orderPaymentStatus = "pending";
      orderStatus = "received";
  }

  await db
    .update(orders)
    .set({ paymentStatus: orderPaymentStatus, status: orderStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(schema.orderTimeline).values({
    orderId,
    status: orderStatus,
    note: `Pagamento ${pmt.status} via Mercado Pago`,
  });
}

// ─── POST /api/payments/mp-token ────────────────────────────────
// Saves the MP access token for a store.
export async function saveMpTokenHandler(request: Request): Promise<Response> {
  const body = await request.json() as { storeId: string; accessToken: string };
  if (!body.storeId || !body.accessToken) {
    return json({ error: "storeId e accessToken são obrigatórios" }, 400);
  }

  // Basic validation: token must start with APP_USR- or TEST-
  if (!body.accessToken.startsWith("APP_USR-") && !body.accessToken.startsWith("TEST-")) {
    return json({ error: "Token inválido. Deve começar com APP_USR- (produção) ou TEST- (sandbox)" }, 400);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  await db
    .update(stores)
    .set({ mpAccessToken: body.accessToken, updatedAt: new Date() })
    .where(eq(stores.id, body.storeId));

  return json({ success: true });
}
