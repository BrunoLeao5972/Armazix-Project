import { createDb, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { requireStoreAccess, requireStoreOwner, AuthContext } from "@/lib/auth/require-store-access";
import { generateCleanSlug } from "@/lib/slug";

const { stores, storeUsers, orders, orderItems, products, customers } = schema;

// ─── Get Store by ID or Slug ─────────────────────────────────────
export async function getStoreHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");

  if (!storeId && !slug) {
    return new Response(JSON.stringify({ error: "Store ID or slug required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const store = await db.query.stores.findFirst({
      where: storeId ? eq(stores.id, storeId) : eq(stores.slug, slug!),
      with: { banners: { where: (b, { eq }) => eq(b.active, true), orderBy: (b, { asc }) => [asc(b.position)] } },
    });

    if (!store) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // SECURITY: Never expose sensitive payment/billing fields to public consumers.
    const { mpAccessToken: _mpToken, plan: _plan, planStatus: _planStatus,
            planExpiresAt: _planExpiry, mpSubscriptionId: _subId, ...publicStoreData } = store;

    return new Response(JSON.stringify({ store: publicStoreData }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching store:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

// ─── Update Store ───────────────────────────────────────────────
export async function updateStoreHandler(request: Request, auth?: AuthContext): Promise<Response> {
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
    name?: string;
    ownerName?: string;
    description?: string;
    phone?: string;
    email?: string;
    primaryColor?: string;
    logoUrl?: string;
    paymentMethodsConfig?: Array<{ key: string; label: string; enabled: boolean; maxInstallments: number; payAtDelivery?: boolean }>;
    deliveryPaymentEnabled?: boolean;
    backgroundColor?: string;
    textColor?: string;
    showPrice?: boolean;
    whatsappOrderEnabled?: boolean;
    whatsappPhone?: string;
    highlightLowStock?: boolean;
    address?: {
      street: string;
      number: string;
      neighborhood: string;
      city: string;
      state: string;
      zip: string;
      complement?: string;
    };
  };

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  const nextSlug = body.name ? generateCleanSlug(body.name) : null;
  if (body.name && (!nextSlug || nextSlug.length < 3)) {
    return new Response(JSON.stringify({ error: "Nome da loja gera um slug inválido (mínimo 3 caracteres alfanuméricos)" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    if (nextSlug) {
      const existing = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, nextSlug));
      if (existing.length > 0 && existing[0].id !== storeId) {
        return new Response(JSON.stringify({ error: "Slug já está em uso" }), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
    }

    const [updated] = await db
      .update(stores)
      .set({
        name: body.name,
        ...(nextSlug ? { slug: nextSlug } : {}),
        ownerName: body.ownerName,
        description: body.description,
        phone: body.phone,
        email: body.email,
        primaryColor: body.primaryColor,
        logoUrl: body.logoUrl,
        ...(body.paymentMethodsConfig !== undefined ? { paymentMethodsConfig: body.paymentMethodsConfig } : {}),
        ...(body.deliveryPaymentEnabled !== undefined ? { deliveryPaymentEnabled: body.deliveryPaymentEnabled } : {}),
        backgroundColor: body.backgroundColor,
        textColor: body.textColor,
        showPrice: body.showPrice,
        whatsappOrderEnabled: body.whatsappOrderEnabled,
        whatsappPhone: body.whatsappPhone,
        highlightLowStock: body.highlightLowStock,
        address: body.address,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId))
      .returning();

    return new Response(JSON.stringify({ success: true, store: updated }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating store:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

// ─── Get Dashboard Stats ────────────────────────────────────────
export async function getDashboardStatsHandler(
  request: Request,
  auth?: AuthContext
): Promise<Response> {
  // IDOR Fix: Validate store access using auth context only
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
      }),
      {
        status: auth?.userId ? 403 : 401,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }

  // Mock store bypass — return empty stats without hitting DB
  if (process.env.NODE_ENV === "development" && storeId === "mock-store-001") {
    return new Response(JSON.stringify({
      stats: { totalOrders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0, productsCount: 0, lowStockProducts: 0, customersCount: 0, averageTicket: 0 },
      recentOrders: [],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // Explicit column selection avoids pulling unmigrated columns (e.g. card_fee_amount)
    // and lets the query succeed even if the DB is one migration behind.
    const [storeOrders, productsData, customersCount] = await Promise.all([
      db.select({
        id:            orders.id,
        number:        orders.number,
        status:        orders.status,
        total:         orders.total,
        customerId:    orders.customerId,
        paymentMethod: orders.paymentMethod,
        createdAt:     orders.createdAt,
      }).from(orders).where(eq(orders.storeId, storeId)),

      db.select({
        stock:             products.stock,
        lowStockThreshold: products.lowStockThreshold,
      }).from(products).where(eq(products.storeId, storeId)),

      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(customers).where(eq(customers.storeId, storeId))
        .then(r => r[0]?.count ?? 0),
    ]);

    const totalOrders     = storeOrders.length;
    const pendingOrders   = storeOrders.filter(o => ["received","preparing","ready","delivering"].includes(o.status)).length;
    const completedOrders = storeOrders.filter(o => o.status === "delivered").length;
    const cancelledOrders = storeOrders.filter(o => o.status === "cancelled").length;
    const revenue         = storeOrders.filter(o => o.status !== "cancelled").reduce((s, o) => s + parseFloat(o.total || "0"), 0);
    const productsCount   = productsData.length;
    const lowStockProducts = productsData.filter(p => (p.stock ?? 0) <= (p.lowStockThreshold || 5)).length;

    // Recent orders with customer name via LEFT JOIN (no findMany → no card_fee_amount)
    const recentOrders = await db.select({
      id:           orders.id,
      number:       orders.number,
      status:       orders.status,
      total:        orders.total,
      createdAt:    orders.createdAt,
      customerName: customers.name,
    }).from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.storeId, storeId))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    // Top products — filtered to this store via JOIN on orders (no cross-tenant leak)
    const topProducts = await db.select({
      productId:   orderItems.productId,
      productName: orderItems.productName,
      sold:        sql<number>`cast(sum(${orderItems.quantity}) as int)`,
      revenue:     sql<number>`sum(cast(${orderItems.total} as numeric))`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.storeId, storeId), ne(orders.status, "cancelled")))
      .groupBy(orderItems.productId, orderItems.productName)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(5);

    return new Response(JSON.stringify({
      stats: {
        totalOrders, pendingOrders, completedOrders, cancelledOrders,
        revenue, productsCount, lowStockProducts,
        customersCount,
        averageTicket: totalOrders > 0 ? revenue / totalOrders : 0,
      },
      recentOrders,
      topProducts,
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── Get User's Store ────────────────────────────────────────────
export async function getUserStoreHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // IDOR Fix: NEVER accept userId from query params — use auth context only
  if (!auth?.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const userId = auth.userId;

  // Mock user bypass — only in development
  if (process.env.NODE_ENV === "development" && userId === "mock-user-001") {
    return new Response(JSON.stringify({
      store: {
        id: "mock-store-001",
        name: "Loja Demo",
        slug: "demo",
        plan: "full",
        primaryColor: "#7c3aed",
        deliveryEstimate: "30-45 min",
        active: true,
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const storeUser = await db.query.storeUsers.findFirst({
      where: eq(storeUsers.userId, userId),
      with: {
        store: true,
      },
    });

    if (!storeUser) {
      return new Response(JSON.stringify({ error: "Store not found for user" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ store: storeUser.store }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching user store:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

// ─── PUT /api/store/payment-config ──────────────────────────────────────────
// Salva a configuração estruturada de pagamento v2 (dois grupos: online + entrega).
// Requer owner/admin — mesmo nível de segurança do saveMpTokenHandler.
export async function savePaymentConfigHandler(
  request: Request,
  auth?: AuthContext
): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreOwner(auth);
    storeId = access.storeId;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unauthorized" }),
      { status: auth?.userId ? 403 : 401, headers: { "content-type": "application/json" } }
    );
  }

  const body = await request.json() as {
    paymentConfig: import("@/lib/store-context").PaymentConfig;
  };

  if (!body.paymentConfig) {
    return new Response(
      JSON.stringify({ error: "paymentConfig é obrigatório" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const cfg = body.paymentConfig;

  // ── Validação estrutural básica ──────────────────────────────────────────
  if (typeof cfg.online?.enabled !== "boolean") {
    return new Response(
      JSON.stringify({ error: "paymentConfig.online.enabled deve ser boolean" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }
  if (typeof cfg.delivery?.enabled !== "boolean") {
    return new Response(
      JSON.stringify({ error: "paymentConfig.delivery.enabled deve ser boolean" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const maxInstallments = cfg.delivery?.creditCard?.maxInstallments ?? 1;
  if (cfg.delivery?.creditCard?.installmentsEnabled && (maxInstallments < 2 || maxInstallments > 12)) {
    return new Response(
      JSON.stringify({ error: "maxInstallments deve ser entre 2 e 12 quando parcelamento está ativo" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const dbUrl = process.env.DATABASE_URL!;
    const db = createDb(dbUrl);

    await db
      .update(stores)
      .set({
        paymentConfig: cfg,
        // Mantém campos legados em sincronia para retrocompatibilidade
        deliveryPaymentEnabled: cfg.delivery.enabled,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId));

    return new Response(
      JSON.stringify({ success: true, paymentConfig: cfg }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (error) {
    console.error("Error saving paymentConfig:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao salvar configuração de pagamento" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
