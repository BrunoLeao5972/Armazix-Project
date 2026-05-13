import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, gte, desc, sql } from "drizzle-orm";

const { products, orders, orderItems, verificationCodes, users } = schema;

// ─── Get Stock Stats ────────────────────────────────────────────
export async function getStockStatsHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "Store ID required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const productsData = await db.select().from(products).where(eq(products.storeId, storeId));
    const totalStock = productsData.reduce((sum, p) => sum + (p.stock || 0), 0);

    const lowStockItems = productsData
      .filter(p => p.stock !== null && p.lowStockThreshold !== null && p.stock < (p.lowStockThreshold || 5))
      .map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock || 0,
        minStock: p.lowStockThreshold || 5,
      }));

    // Weekly movements from orders (stock out)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weekOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, oneWeekAgo)));

    const weekOrderIds = weekOrders.map(o => o.id);
    let weeklyOut = 0;
    const movementMap: Record<string, { product: string; type: string; qty: number; date: string }> = {};

    if (weekOrderIds.length > 0) {
      const items = await db
        .select()
        .from(orderItems)
        .where(sql`${orderItems.orderId} IN ${weekOrderIds}`);

      for (const item of items) {
        weeklyOut += item.quantity;
        const key = item.productName;
        if (!movementMap[key]) {
          movementMap[key] = {
            product: item.productName,
            type: "saida",
            qty: 0,
            date: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
          };
        }
        movementMap[key].qty += item.quantity;
      }
    }

    const movements = Object.values(movementMap).slice(0, 6);

    return new Response(JSON.stringify({
      stats: { totalStock, weeklyIn: 0, weeklyOut, lowStockCount: lowStockItems.length },
      movements,
      lowStock: lowStockItems.slice(0, 5),
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Stock stats error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch stock stats" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Get Reports Stats ──────────────────────────────────────────
export async function getReportsStatsHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "Store ID required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const ordersData = await db.select().from(orders).where(eq(orders.storeId, storeId));

    const completedOrders = ordersData.filter(o => o.status !== "cancelled");
    const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
    const totalOrders = completedOrders.length;

    const uniqueCustomers = new Set(ordersData.map(o => o.customerId).filter(Boolean));
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Monthly data (last 6 months)
    const monthlyData: { name: string; vendas: number; pedidos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.toLocaleString("pt-BR", { month: "short" });
      const monthOrders = completedOrders.filter(o => {
        const od = new Date(o.createdAt);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
      });
      const vendas = monthOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      monthlyData.push({ name: month.charAt(0).toUpperCase() + month.slice(1), vendas, pedidos: monthOrders.length });
    }

    // Top products
    const completedOrderIds = completedOrders.map(o => o.id);
    const topProductsMap: Record<string, { name: string; qty: number; revenue: number }> = {};

    if (completedOrderIds.length > 0) {
      const items = await db
        .select()
        .from(orderItems)
        .where(sql`${orderItems.orderId} IN ${completedOrderIds}`);

      for (const item of items) {
        if (!topProductsMap[item.productName]) {
          topProductsMap[item.productName] = { name: item.productName, qty: 0, revenue: 0 };
        }
        topProductsMap[item.productName].qty += item.quantity;
        topProductsMap[item.productName].revenue += parseFloat(item.total || "0");
      }
    }

    const topProducts = Object.values(topProductsMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return new Response(JSON.stringify({
      stats: { totalRevenue, totalOrders, totalCustomers: uniqueCustomers.size, averageTicket },
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
export async function updateAddressHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    storeId: string;
    address: { street: string; number: string; neighborhood: string; city: string; state: string; zip: string; complement?: string };
  };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    await db.update(schema.stores).set({ address: body.address }).where(eq(schema.stores.id, body.storeId));
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
export async function getBusinessHoursHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "Store ID required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

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
export async function updateBusinessHoursHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    storeId: string;
    businessHours: Array<{ day: string; open: string; close: string; closed: boolean }>;
  };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    await db.update(schema.stores).set({ businessHours: body.businessHours }).where(eq(schema.stores.id, body.storeId));
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
export async function sendEmailVerificationCodeHandler(request: Request): Promise<Response> {
  const body = await request.json() as { userId: string; newEmail: string };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db.insert(verificationCodes).values({
      userId: body.userId,
      code,
      type: "email_change",
      expiresAt,
    });

    // TODO: Send email with code via email service
    console.log(`[DEV] Email change code for ${body.newEmail}: ${code}`);

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
export async function verifyEmailChangeHandler(request: Request): Promise<Response> {
  const body = await request.json() as { userId: string; newEmail: string; code: string };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [vc] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.userId, body.userId),
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
    await db.update(users).set({ email: body.newEmail, emailVerified: true }).where(eq(users.id, body.userId));

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
export async function updateUserPasswordHandler(request: Request): Promise<Response> {
  const body = await request.json() as { userId: string; currentPassword: string; newPassword: string };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [user] = await db.select().from(users).where(eq(users.id, body.userId));

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

    const { hashPassword } = await import("@/lib/auth");
    const newPasswordHash = await hashPassword(body.newPassword);

    await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, body.userId));

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
export async function getUserDataHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return new Response(JSON.stringify({ error: "User ID required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, emailVerified: users.emailVerified })
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
export async function updateUserDataHandler(request: Request): Promise<Response> {
  const body = await request.json() as { userId: string; name?: string; phone?: string };

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const updates: Record<string, string> = {};
    if (body.name) updates.name = body.name;
    if (body.phone) updates.phone = body.phone;

    await db.update(users).set(updates).where(eq(users.id, body.userId));

    return new Response(JSON.stringify({ success: true, message: "Dados atualizados" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update user data error:", error);
    return new Response(JSON.stringify({ error: "Failed to update user data" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Check Store Slug ───────────────────────────────────────────
export async function checkStoreSlugHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const existing = await db.select({ id: schema.stores.id }).from(schema.stores).where(eq(schema.stores.slug, slug));
    return new Response(JSON.stringify({ available: existing.length === 0 }), {
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
export async function updateStoreSlugHandler(request: Request): Promise<Response> {
  const body = await request.json() as { storeId: string; slug: string };

  const cleanSlug = body.slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);

  if (!cleanSlug || cleanSlug.length < 3) {
    return new Response(JSON.stringify({ error: "Slug inválido (mínimo 3 caracteres alfanuméricos)" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const existing = await db.select({ id: schema.stores.id }).from(schema.stores).where(eq(schema.stores.slug, cleanSlug));
    if (existing.length > 0 && existing[0].id !== body.storeId) {
      return new Response(JSON.stringify({ error: "Slug já está em uso" }), {
        status: 409, headers: { "content-type": "application/json" },
      });
    }

    await db.update(schema.stores).set({ slug: cleanSlug }).where(eq(schema.stores.id, body.storeId));

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
