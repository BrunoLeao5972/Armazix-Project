import { createDb, schema } from "@/lib/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { signCustomerJWT, verifyCustomerJWT } from "@/lib/auth";
import { waitUntil } from "@/lib/execution-context";
import { storeOtp, consumeOtp } from "@/lib/cache/redis";
import { sendWppText, normalizePhone } from "@/lib/whatsapp-sender";

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

// ─── POST /api/customer/auth/request-code ────────────────────────────────────
// Gera e armazena um OTP de 6 dígitos no Redis (TTL 5min) e envia via WhatsApp.
export async function requestOtpHandler(request: Request): Promise<Response> {
  const body = await request.json() as { phone?: string; storeId?: string };
  const rawPhone = body.phone?.replace(/\D/g, "");
  const storeId = body.storeId;

  if (!rawPhone || rawPhone.length < 10 || !storeId) {
    return json({ error: "Telefone e loja obrigatórios" }, 400);
  }

  const phone = normalizePhone(rawPhone);
  const code = String(Math.floor(100000 + Math.random() * 900000));

  const saved = await storeOtp(storeId, phone, code);
  if (!saved) {
    return json({ error: "Serviço de autenticação indisponível. Tente novamente." }, 503);
  }

  const text = `🔐 *Armazix*: Seu código de verificação é *${code}*.\n\nVálido por 5 minutos. Não compartilhe com ninguém.`;
  waitUntil(request, sendWppText(storeId, phone, text));

  return json({ success: true }, 200);
}

// ─── POST /api/customer/auth/verify-code ─────────────────────────────────────
// Valida o OTP, faz upsert do cliente e retorna um JWT de 30 dias.
export async function verifyOtpHandler(request: Request): Promise<Response> {
  const body = await request.json() as { phone?: string; storeId?: string; code?: string; name?: string };
  const rawPhone = body.phone?.replace(/\D/g, "");
  const storeId = body.storeId;
  const code = body.code?.trim();

  if (!rawPhone || rawPhone.length < 10 || !storeId || !code) {
    return json({ error: "Telefone, loja e código obrigatórios" }, 400);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return json({ error: "Configuração inválida" }, 500);

  const phone = normalizePhone(rawPhone);

  const valid = await consumeOtp(storeId, phone, code);
  if (!valid) {
    return json({ error: "Código inválido ou expirado" }, 401);
  }

  const db = createDb(process.env.DATABASE_URL!);

  try {
    // Lookup cliente existente pelo telefone normalizado
    const [existing] = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(and(
        eq(customers.storeId, storeId),
        sql`regexp_replace(${customers.phone}, '\D', '', 'g') = ${rawPhone}`,
      ))
      .limit(1);

    let customerId: string;
    let customerName: string;

    if (existing) {
      customerId = existing.id;
      customerName = existing.name ?? "";
    } else {
      // Cria cliente com o nome fornecido (opcional) ou telefone como fallback
      const name = body.name?.trim() || rawPhone;
      const [created] = await db
        .insert(customers)
        .values({ storeId, phone: rawPhone, name })
        .returning({ id: customers.id, name: customers.name });

      if (!created) return json({ error: "Erro ao criar conta" }, 500);
      customerId = created.id;
      customerName = created.name ?? "";
    }

    const token = await signCustomerJWT({ customerId, storeId }, secret);
    return json({ token, customer: { id: customerId, name: customerName } }, 200);
  } catch (err) {
    console.error("[customer/verify-code]", err);
    return json({ error: "Internal server error" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
