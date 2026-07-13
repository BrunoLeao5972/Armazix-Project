import { createDb, schema } from "@/lib/db";
import { eq, and, desc, sql, inArray, gt } from "drizzle-orm";
import { signCustomerJWT, verifyCustomerJWT } from "@/lib/auth";
import { waitUntil } from "@/lib/execution-context";
import { storeOtp, consumeOtp } from "@/lib/cache/redis";
import { sendWppText, normalizePhone } from "@/lib/whatsapp-sender";

const { customers, orders, orderItems, customerOtps, addresses } = schema;

// ── DB OTP helpers (fallback when Redis is not configured) ────────────────────
async function storeOtpInDb(
  db: ReturnType<typeof createDb>,
  storeId: string,
  phone: string,
  code: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.delete(customerOtps).where(
    and(eq(customerOtps.storeId, storeId), eq(customerOtps.phone, phone)),
  );
  await db.insert(customerOtps).values({ storeId, phone, code, expiresAt });
}

async function consumeOtpFromDb(
  db: ReturnType<typeof createDb>,
  storeId: string,
  phone: string,
  code: string,
): Promise<boolean> {
  const [record] = await db
    .select({ id: customerOtps.id })
    .from(customerOtps)
    .where(
      and(
        eq(customerOtps.storeId, storeId),
        eq(customerOtps.phone, phone),
        eq(customerOtps.code, code),
        gt(customerOtps.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!record) return false;
  await db.delete(customerOtps).where(eq(customerOtps.id, record.id));
  return true;
}

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
    // Redis unavailable — persist OTP in the database instead
    try {
      const db = createDb(process.env.DATABASE_URL!);
      await storeOtpInDb(db, storeId, phone, code);
    } catch (err) {
      console.error("[customer/request-code] DB OTP fallback error:", err);
      return json({ error: "Serviço de autenticação indisponível. Tente novamente." }, 503);
    }
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
  const db = createDb(process.env.DATABASE_URL!);

  let valid = await consumeOtp(storeId, phone, code);
  if (!valid) {
    // Redis unavailable or code not found — check DB fallback
    valid = await consumeOtpFromDb(db, storeId, phone, code);
  }
  if (!valid) {
    return json({ error: "Código inválido ou expirado" }, 401);
  }

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
    return json({ token, customer: { id: customerId, name: customerName, isNew: !existing } }, 200);
  } catch (err) {
    console.error("[customer/verify-code]", err);
    return json({ error: "Internal server error" }, 500);
  }
}

// ─── POST /api/customer/profile ──────────────────────────────────────────────
// Atualiza nome e salva endereço estruturado do cliente autenticado.
// Auth: Bearer <customerJWT>
// Body: { name: string; address?: { cep, street, number, neighborhood, city, state, complement?, obs? } }
export async function patchCustomerProfileHandler(request: Request): Promise<Response> {
  const raw = request.headers.get("Authorization");
  const token = raw?.startsWith("Bearer ") ? raw.slice(7) : null;
  if (!token) return json({ error: "Não autorizado" }, 401);

  const secret = process.env.JWT_SECRET;
  if (!secret) return json({ error: "Configuração inválida" }, 500);

  const auth = await verifyCustomerJWT(token, secret);
  if (!auth) return json({ error: "Token inválido ou expirado" }, 401);

  const body = await request.json() as {
    name?: string;
    address?: {
      cep?: string;
      street?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      complement?: string;
      obs?: string;
    };
  };

  const name = body.name?.trim();
  if (!name) return json({ error: "Nome obrigatório" }, 400);

  const db = createDb(process.env.DATABASE_URL!);

  try {
    const [updated] = await db
      .update(customers)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(customers.id, auth.customerId), eq(customers.storeId, auth.storeId)))
      .returning({ id: customers.id, name: customers.name });

    if (!updated) return json({ error: "Cliente não encontrado" }, 404);

    const addr = body.address;
    if (addr?.street && addr?.number && addr?.city && addr?.state) {
      const cepDigits = (addr.cep ?? "").replace(/\D/g, "");
      const zip = cepDigits.length === 8
        ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`
        : cepDigits.slice(0, 9) || "00000-000";

      // Substitui endereço padrão existente (upsert via delete + insert)
      await db.delete(addresses).where(
        and(eq(addresses.customerId, auth.customerId), eq(addresses.isDefault, true)),
      );

      await db.insert(addresses).values({
        customerId:   auth.customerId,
        label:        "Principal",
        street:       addr.street.slice(0, 200),
        number:       addr.number.slice(0, 20),
        neighborhood: (addr.neighborhood || "-").slice(0, 80),
        city:         addr.city.slice(0, 80),
        state:        addr.state.toUpperCase().slice(0, 2),
        zip:          zip,
        complement:   addr.complement ? addr.complement.slice(0, 80) : null,
        isDefault:    true,
      });
    }

    return json({ customer: { id: updated.id, name: updated.name } }, 200);
  } catch (err) {
    console.error("[customer/profile]", err);
    return json({ error: "Internal server error" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
