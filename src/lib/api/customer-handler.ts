import { createDb, schema } from "@/lib/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { signCustomerJWT, verifyCustomerJWT } from "@/lib/auth";

const { customers, orders, orderItems } = schema;

// ─── POST /api/customer/login ─────────────────────────────────────────────────
// Passwordless: lookup by phone+storeId, return a signed customer JWT.
// No OTP required — phone acts as the single factor for checkout accounts.
export async function loginPasswordlessHandler(request: Request): Promise<Response> {
  const body = await request.json() as { phone?: string; storeId?: string };
  const phone = body.phone?.replace(/\D/g, "");
  const storeId = body.storeId;

  if (!phone || phone.length < 10 || !storeId) {
    return json({ error: "Telefone e loja obrigatórios" }, 400);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return json({ error: "Configuração inválida" }, 500);

  const db = createDb(process.env.DATABASE_URL!);

  try {
    const [customer] = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(and(
        eq(customers.storeId, storeId),
        sql`regexp_replace(${customers.phone}, '\D', '', 'g') = ${phone}`,
      ))
      .limit(1);

    if (!customer) {
      return json(
        { error: "Telefone não encontrado. Finalize um pedido primeiro para criar sua conta." },
        404,
      );
    }

    const token = await signCustomerJWT({ customerId: customer.id, storeId }, secret);
    return json({ token, customer: { id: customer.id, name: customer.name } }, 200);
  } catch (err) {
    console.error("[customer/login]", err);
    return json({ error: "Internal server error" }, 500);
  }
}

// ─── GET /api/customer/orders ─────────────────────────────────────────────────
// Returns the last 20 orders for the authenticated customer at their store.
// Auth: Bearer <customerJWT> in Authorization header.
export async function getCustomerOrdersHandler(request: Request): Promise<Response> {
  const raw = request.headers.get("Authorization");
  const token = raw?.startsWith("Bearer ") ? raw.slice(7) : null;
  if (!token) return json({ error: "Não autorizado" }, 401);

  const secret = process.env.JWT_SECRET;
  if (!secret) return json({ error: "Configuração inválida" }, 500);

  const auth = await verifyCustomerJWT(token, secret);
  if (!auth) return json({ error: "Token inválido ou expirado" }, 401);

  const db = createDb(process.env.DATABASE_URL!);

  try {
    const orderList = await db
      .select({
        id:        orders.id,
        number:    orders.number,
        status:    orders.status,
        total:     orders.total,
        createdAt: orders.createdAt,
        type:      orders.type,
      })
      .from(orders)
      .where(and(
        eq(orders.customerId, auth.customerId),
        eq(orders.storeId, auth.storeId),
      ))
      .orderBy(desc(orders.createdAt))
      .limit(20);

    if (orderList.length === 0) return json({ orders: [] }, 200);

    const ids = orderList.map(o => o.id);
    const allItems = await db
      .select({ orderId: orderItems.orderId, productName: orderItems.productName, quantity: orderItems.quantity })
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids));

    const byOrder: Record<string, { productName: string; quantity: number }[]> = {};
    for (const item of allItems) {
      (byOrder[item.orderId] ??= []).push({ productName: item.productName, quantity: item.quantity });
    }

    return json({ orders: orderList.map(o => ({ ...o, items: byOrder[o.id] ?? [] })) }, 200);
  } catch (err) {
    console.error("[customer/orders]", err);
    return json({ error: "Internal server error" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
