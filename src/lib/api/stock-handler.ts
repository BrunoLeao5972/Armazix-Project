import { createDb, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, gte, ne, desc, sql } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { generateCleanSlug } from "@/lib/slug";

const { products, orders, orderItems, verificationCodes, users, storeUsers, customers } = schema;

// ─── Get Stock Stats ────────────────────────────────────────────
export async function getStockStatsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [productStats, lowStockItems, weeklyMovements] = await Promise.all([
      db.select({
        totalStock:    sql<number>`coalesce(sum(${products.stock}), 0)`,
        lowStockCount: sql<number>`cast(count(*) filter (where coalesce(${products.stock}, 0) < coalesce(${products.lowStockThreshold}, 5)) as int)`,
      }).from(products).where(eq(products.storeId, storeId))
        .then(r => r[0] ?? { totalStock: 0, lowStockCount: 0 }),

      db.select({ id: products.id, name: products.name, stock: products.stock, lowStockThreshold: products.lowStockThreshold })
        .from(products)
        .where(and(
          eq(products.storeId, storeId),
          sql`coalesce(${products.stock}, 0) < coalesce(${products.lowStockThreshold}, 5)`,
        ))
        .limit(5),

      db.select({
        productName: orderItems.productName,
        qty:         sql<number>`cast(sum(${orderItems.quantity}) as int)`,
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, oneWeekAgo)))
        .groupBy(orderItems.productName)
        .orderBy(desc(sql`sum(${orderItems.quantity})`))
        .limit(6),
    ]);

    const { totalStock, lowStockCount } = productStats;
    const weeklyOut = weeklyMovements.reduce((s, m) => s + m.qty, 0);
    const now = new Date();
    const movements = weeklyMovements.map(m => ({
      product: m.productName,
      type: "saida",
      qty: m.qty,
      date: now.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    }));
    const lowStock = lowStockItems.map(p => ({ id: p.id, name: p.name, stock: p.stock || 0, minStock: p.lowStockThreshold || 5 }));

    return new Response(JSON.stringify({
      stats: { totalStock, weeklyIn: 0, weeklyOut, lowStockCount },
      movements,
      lowStock,
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Stock stats error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch stock stats" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Get Reports Stats ──────────────────────────────────────────
export async function getReportsStatsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [globalStats, recentOrders, topProducts] = await Promise.all([
      db.select({
        totalRevenue:    sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then cast(${orders.total} as numeric) else 0 end), 0)`,
        totalOrders:     sql<number>`cast(count(*) filter (where ${orders.status} != 'cancelled') as int)`,
        totalCustomers:  sql<number>`cast(count(distinct ${orders.customerId}) as int)`,
      }).from(orders).where(eq(orders.storeId, storeId))
        .then(r => r[0] ?? { totalRevenue: 0, totalOrders: 0, totalCustomers: 0 }),

      db.select({ createdAt: orders.createdAt, total: orders.total })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, sixMonthsAgo), ne(orders.status, "cancelled"))),

      db.select({
        name:    orderItems.productName,
        qty:     sql<number>`cast(sum(${orderItems.quantity}) as int)`,
        revenue: sql<number>`sum(cast(${orderItems.total} as numeric))`,
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orders.storeId, storeId), ne(orders.status, "cancelled")))
        .groupBy(orderItems.productName)
        .orderBy(desc(sql`sum(${orderItems.quantity})`))
        .limit(5),
    ]);

    const { totalRevenue, totalOrders, totalCustomers } = globalStats;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthlyData: { name: string; vendas: number; pedidos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mOrders = recentOrders.filter(o => {
        const cd = new Date(o.createdAt);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      });
      const vendas = mOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0);
      monthlyData.push({ name: monthNames[d.getMonth()], vendas, pedidos: mOrders.length });
    }

    return new Response(JSON.stringify({
      stats: { totalRevenue, totalOrders, totalCustomers, averageTicket },
      monthlyData,
      topProducts,
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Reports stats error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch reports stats" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Validate CEP (ViaCEP) ──────────────────────────────────────
export async function validateCepHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cep = url.searchParams.get("cep")?.replace(/\D/g, "");

  if (!cep || cep.length !== 8) {
    return new Response(JSON.stringify({ error: "CEP inválido" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      return new Response(JSON.stringify({ error: "CEP não encontrado" }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
      zip: cep,
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("CEP validation error:", error);
    return new Response(JSON.stringify({ error: "Failed to validate CEP" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Update Store Address ───────────────────────────────────────
export async function updateAddressHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Use storeId exclusively from auth (JWT) — ignore any storeId in body
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as {
    address: { street: string; number: string; neighborhood: string; city: string; state: string; zip: string; complement?: string };
  };

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    await db.update(schema.stores).set({ address: body.address }).where(eq(schema.stores.id, storeId));
    return new Response(JSON.stringify({ success: true, address: body.address }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update address error:", error);
    return new Response(JSON.stringify({ error: "Failed to update address" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Get Business Hours ─────────────────────────────────────────
export async function getBusinessHoursHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const [store] = await db
      .select({ businessHours: schema.stores.businessHours })
      .from(schema.stores)
      .where(eq(schema.stores.id, storeId));

    return new Response(JSON.stringify({ businessHours: store?.businessHours || [] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Get business hours error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch business hours" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Update Business Hours ──────────────────────────────────────
export async function updateBusinessHoursHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Use storeId exclusively from auth (JWT) — ignore any storeId in body
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as {
    businessHours: Array<{ day: string; open: string; close: string; closed: boolean }>;
  };

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    await db.update(schema.stores).set({ businessHours: body.businessHours }).where(eq(schema.stores.id, storeId));
    return new Response(JSON.stringify({ success: true, businessHours: body.businessHours }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update business hours error:", error);
    return new Response(JSON.stringify({ error: "Failed to update business hours" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Send Email Verification Code ───────────────────────────────
export async function sendEmailVerificationCodeHandler(request: Request, auth?: { userId?: string }): Promise<Response> {
  // IDOR Fix: Use userId from auth context, never from body
  const userId = auth?.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const body = await request.json() as { newEmail: string };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db.insert(verificationCodes).values({
      userId: userId,
      code,
      type: "email_change",
      expiresAt,
    });

    // TODO: Send email with code via email service
    // NOTE: Code intentionally NOT logged — it is a one-time secret credential

    return new Response(JSON.stringify({ success: true, message: "Código enviado para o novo email" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Send verification code error:", error);
    return new Response(JSON.stringify({ error: "Failed to send code" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Verify Email Change ────────────────────────────────────────
export async function verifyEmailChangeHandler(request: Request, auth?: { userId?: string }): Promise<Response> {
  // IDOR Fix: Use userId from auth context, never from body
  const userId = auth?.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const body = await request.json() as { newEmail: string; code: string };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [vc] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.userId, userId),
          eq(verificationCodes.code, body.code),
          eq(verificationCodes.type, "email_change"),
          sql`${verificationCodes.usedAt} IS NULL`,
          sql`${verificationCodes.expiresAt} > NOW()`
        )
      )
      .limit(1);

    if (!vc) {
      return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    // Mark code as used
    await db.update(verificationCodes).set({ usedAt: new Date() }).where(eq(verificationCodes.id, vc.id));

    // Check if email already in use
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.newEmail));
    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: "Email já está em uso" }), {
        status: 409, headers: { "content-type": "application/json" },
      });
    }

    // Update email
    await db.update(users).set({ email: body.newEmail, emailVerified: true }).where(eq(users.id, userId));

    return new Response(JSON.stringify({ success: true, message: "Email atualizado com sucesso" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Verify email change error:", error);
    return new Response(JSON.stringify({ error: "Failed to verify email change" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Update User Password ───────────────────────────────────────
export async function updateUserPasswordHandler(request: Request, auth?: { userId?: string }): Promise<Response> {
  // IDOR Fix: Use userId from auth context, never from body
  const userId = auth?.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const body = await request.json() as { currentPassword: string; newPassword: string };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }

    const { verifyPassword } = await import("@/lib/auth");
    const isValid = await verifyPassword(body.currentPassword, user.passwordHash);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Senha atual incorreta" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }

    // SECURITY: Enforce password policy on new password
    const { hashPassword, validatePasswordPolicy } = await import("@/lib/auth");
    const policyResult = validatePasswordPolicy(body.newPassword);
    if (!policyResult.valid) {
      return new Response(JSON.stringify({ error: policyResult.errors.join(". ") }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    const newPasswordHash = await hashPassword(body.newPassword);

    await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));

    return new Response(JSON.stringify({ success: true, message: "Senha alterada com sucesso" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update password error:", error);
    return new Response(JSON.stringify({ error: "Failed to update password" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Get User Data ──────────────────────────────────────────────
export async function getUserDataHandler(request: Request, auth?: { userId?: string }): Promise<Response> {
  // IDOR Fix: Use userId from auth context, never from query params
  const userId = auth?.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, emailVerified: users.emailVerified, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Get user data error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch user data" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Update User Data ────────────────────────────────────────────
export async function updateUserDataHandler(request: Request, auth?: { userId?: string }): Promise<Response> {
  // IDOR Fix: Use userId from auth context, never from body
  const userId = auth?.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const body = await request.json() as { name?: string; phone?: string; avatarUrl?: string | null };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const updates: Record<string, string | null> = {};
    if (body.name) updates.name = body.name;
    if (body.phone) updates.phone = body.phone;
    if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl ?? null;

    await db.update(users).set(updates).where(eq(users.id, userId));

    return new Response(JSON.stringify({ success: true, message: "Dados atualizados" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update user data error:", error);
    return new Response(JSON.stringify({ error: "Failed to update user data" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

// ─── Check Store Slug ───────────────────────────────────────────
export async function checkStoreSlugHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawSlug = url.searchParams.get("slug");
  const slug = rawSlug ? generateCleanSlug(rawSlug) : "";

  if (!slug) {
    return new Response(JSON.stringify({ error: "slug required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const existing = await db.select({ id: schema.stores.id }).from(schema.stores).where(eq(schema.stores.slug, slug));
    return new Response(JSON.stringify({ available: existing.length === 0, slug }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Check slug error:", error);
    return new Response(JSON.stringify({ error: "Failed to check slug" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Update Store Slug ──────────────────────────────────────────
export async function updateStoreSlugHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Use storeId exclusively from auth (JWT) — ignore any storeId in body
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as { slug: string };

  const cleanSlug = generateCleanSlug(body.slug);

  if (!cleanSlug || cleanSlug.length < 3) {
    return new Response(JSON.stringify({ error: "Slug inválido (mínimo 3 caracteres alfanuméricos)" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const existing = await db.select({ id: schema.stores.id }).from(schema.stores).where(eq(schema.stores.slug, cleanSlug));
    if (existing.length > 0 && existing[0].id !== storeId) {
      return new Response(JSON.stringify({ error: "Slug já está em uso" }), {
        status: 409, headers: { "content-type": "application/json" },
      });
    }

    await db.update(schema.stores).set({ slug: cleanSlug }).where(eq(schema.stores.id, storeId));

    return new Response(JSON.stringify({ success: true, slug: cleanSlug }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update slug error:", error);
    return new Response(JSON.stringify({ error: "Failed to update slug" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Get Financial Stats ─────────────────────────────────────────
export async function getFinancialStatsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [monthRevenue, cashFlowRows, paymentRows, recentTx] = await Promise.all([
      db.select({
        revenue: sql<number>`coalesce(sum(cast(${orders.total} as numeric)), 0)`,
      }).from(orders)
        .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, monthStart), ne(orders.status, "cancelled")))
        .then(r => r[0]?.revenue ?? 0),

      db.select({ createdAt: orders.createdAt, total: orders.total })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, sixMonthsAgo), ne(orders.status, "cancelled"))),

      db.select({
        paymentMethod: orders.paymentMethod,
        count: sql<number>`cast(count(*) as int)`,
      }).from(orders)
        .where(and(eq(orders.storeId, storeId), ne(orders.status, "cancelled")))
        .groupBy(orders.paymentMethod),

      db.select({ id: orders.id, number: orders.number, status: orders.status, total: orders.total, createdAt: orders.createdAt })
        .from(orders)
        .where(eq(orders.storeId, storeId))
        .orderBy(desc(orders.createdAt))
        .limit(10),
    ]);

    const revenue = monthRevenue;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const cashFlow: { name: string; receita: number; despesa: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mOrders = cashFlowRows.filter(o => {
        const cd = new Date(o.createdAt);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      });
      cashFlow.push({ name: monthNames[d.getMonth()], receita: mOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0), despesa: 0 });
    }

    const totalMethods = paymentRows.reduce((s, r) => s + r.count, 0) || 1;
    const methodColors: Record<string, string> = { pix: "#00C853", card: "#3b82f6", cash: "#f59e0b", boleto: "#8b5cf6" };
    const methodLabels: Record<string, string> = { pix: "PIX", card: "Cartão", cash: "Dinheiro", boleto: "Boleto" };
    const paymentMethods = paymentRows
      .filter(r => r.paymentMethod)
      .map(r => ({
        name: methodLabels[r.paymentMethod!] || r.paymentMethod!,
        value: Math.round((r.count / totalMethods) * 100),
        color: methodColors[r.paymentMethod!] || "#94a3b8",
      }));

    const recentTransactions = recentTx.map(o => ({
      id: o.id,
      desc: `Pedido #${o.number}`,
      type: o.status === "cancelled" ? "despesa" : "receita",
      value: `R$ ${parseFloat(o.total || "0").toFixed(2).replace(".", ",")}`,
      date: new Date(o.createdAt).toLocaleDateString("pt-BR"),
    }));

    const profit = revenue;
    const margin = revenue > 0 ? "100" : "0";

    return new Response(JSON.stringify({
      stats: { revenue, expenses: 0, profit, margin: `${margin}%` },
      cashFlow,
      paymentMethods,
      recentTransactions,
      accountsPayable: [],
      accountsReceivable: [],
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Financial stats error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Get Delivery Orders ─────────────────────────────────────────
export async function getDeliveryOrdersHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // Explicit column selection — avoids pulling card_fee_amount (unmigrated column)
    // and fixes updatedAt.toISOString() crash if column returns string instead of Date.
    const deliveryOrders = await db.select({
      id:               orders.id,
      number:           orders.number,
      status:           orders.status,
      total:            orders.total,
      type:             orders.type,
      addressSnapshot:  orders.addressSnapshot,
      estimatedDelivery: orders.estimatedDelivery,
      updatedAt:        orders.updatedAt,
      createdAt:        orders.createdAt,
      customerName:     customers.name,
      customerPhone:    customers.phone,
    }).from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(and(eq(orders.storeId, storeId), eq(orders.type, "delivery")))
      .orderBy(desc(orders.createdAt));

    const deliveries = deliveryOrders.map(o => ({
      id: `#D${String(o.number).padStart(3, "0")}`,
      orderId: o.id,
      number: o.number,
      customer: o.customerName || "Cliente",
      address: o.addressSnapshot
        ? `${o.addressSnapshot.street}, ${o.addressSnapshot.number} — ${o.addressSnapshot.neighborhood}`
        : "",
      phone: o.customerPhone || "",
      status: o.status,
      total: parseFloat(o.total).toFixed(2),
      time: o.estimatedDelivery
        ? `~${Math.max(0, Math.round((new Date(o.estimatedDelivery).getTime() - Date.now()) / 60000))} min`
        : "",
      updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : new Date().toISOString(),
    }));

    const preparing = deliveries.filter(d => d.status === "received" || d.status === "preparing").length;
    const inRoute = deliveries.filter(d => d.status === "ready" || d.status === "delivering").length;
    const delivered = deliveries.filter(d => d.status === "delivered").length;

    return new Response(JSON.stringify({ deliveries, stats: { preparing, inRoute, delivered } }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Delivery orders error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Get Coupons ──────────────────────────────────────────────────
export async function getCouponsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const storeCoupons = await db.select().from(schema.coupons).where(eq(schema.coupons.storeId, storeId));

    const couponsList = storeCoupons.map(c => ({
      id: c.id,
      code: c.code,
      type: c.type,
      discount: c.type === "percent" ? `${c.discount}%` : c.type === "fixed" ? `R$ ${parseFloat(c.discount).toFixed(2).replace(".", ",")}` : c.discount,
      uses: c.usedCount || 0,
      maxUses: c.maxUses || 0,
      expires: c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Sem prazo",
      status: c.active && (!c.expiresAt || new Date(c.expiresAt) > new Date()) ? "active" : "expired",
    }));

    return new Response(JSON.stringify({ coupons: couponsList }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Coupons error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Get Dashboard Chart Data ─────────────────────────────────────
export async function getDashboardChartDataHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Mock store bypass — return empty chart data without hitting DB
  if (process.env.NODE_ENV === "development" && storeId === "mock-store-001") {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return new Response(JSON.stringify({
      revenueData: days.map(name => ({ name, valor: 0 })),
      ordersData: days.map(name => ({ name, pedidos: 0 })),
      monthlySales: Array.from({ length: 6 }, (_, i) => ({ name: `Mês ${i + 1}`, vendas: 0 })),
      stockMovement: Array.from({ length: 6 }, (_, i) => ({ name: `Mês ${i + 1}`, entrada: 0, saida: 0 })),
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [weekOrders, monthlyOrders] = await Promise.all([
      db.select({ createdAt: orders.createdAt, total: orders.total })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, weekStart), ne(orders.status, "cancelled"))),

      db.select({ createdAt: orders.createdAt, total: orders.total })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, sixMonthsAgo), ne(orders.status, "cancelled"))),
    ]);

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const revenueByDay: Record<number, number> = {};
    const ordersByDay: Record<number, number> = {};
    for (let i = 0; i < 7; i++) { revenueByDay[i] = 0; ordersByDay[i] = 0; }

    weekOrders.forEach(o => {
      const day = new Date(o.createdAt).getDay();
      revenueByDay[day] += parseFloat(o.total || "0");
      ordersByDay[day]++;
    });

    const revenueData = dayNames.map((name, i) => ({ name, valor: revenueByDay[i] }));
    const ordersData  = dayNames.map((name, i) => ({ name, pedidos: ordersByDay[i] }));

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthlySales: { name: string; vendas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mOrders = monthlyOrders.filter(o => {
        const cd = new Date(o.createdAt);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      });
      monthlySales.push({ name: monthNames[d.getMonth()], vendas: mOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0) });
    }

    const stockMovement = dayNames.map((name, i) => ({ name, entrada: 0, saida: ordersByDay[i] }));

    return new Response(JSON.stringify({ revenueData, ordersData, monthlySales, stockMovement }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Dashboard chart data error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}