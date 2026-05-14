import { createDb, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireStoreAccess, AuthContext } from "@/lib/auth/require-store-access";

const { stores, storeUsers, orders, products, customers } = schema;

// ─── Get Store by ID ────────────────────────────────────────────
export async function getStoreHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("id");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "Store ID required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });

    if (!store) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // SECURITY: Never expose sensitive payment/billing fields to public consumers.
    // These fields are internal and only needed by authenticated store management routes.
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

  try {
    const [updated] = await db
      .update(stores)
      .set({
        name: body.name,
        ownerName: body.ownerName,
        description: body.description,
        phone: body.phone,
        email: body.email,
        primaryColor: body.primaryColor,
        logoUrl: body.logoUrl,
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

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // Get orders stats
    const storeOrders = await db.query.orders.findMany({
      where: eq(orders.storeId, storeId),
    });

    const totalOrders = storeOrders.length;
    const pendingOrders = storeOrders.filter(o => 
      ["received", "preparing", "ready", "delivering"].includes(o.status)
    ).length;
    const completedOrders = storeOrders.filter(o => o.status === "delivered").length;
    const cancelledOrders = storeOrders.filter(o => o.status === "cancelled").length;

    // Calculate revenue
    const revenue = storeOrders
      .filter(o => o.status !== "cancelled")
      .reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);

    // Get products count
    const productsCount = await db.$count(products, eq(products.storeId, storeId));
    const lowStockProducts = await db.query.products.findMany({
      where: eq(products.storeId, storeId),
    }).then(p => p.filter(prod => (prod.stock ?? 0) <= (prod.lowStockThreshold || 5)).length);

    // Get customers count
    const customersCount = await db.$count(customers, eq(customers.storeId, storeId));

    // Get recent orders with customer info
    const recentOrders = await db.query.orders.findMany({
      where: eq(orders.storeId, storeId),
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      limit: 5,
      with: {
        customer: true,
      },
    });

    // Get top products
    const topProducts = await db.query.orderItems.findMany({
      limit: 5,
      with: {
        product: true,
      },
    }).then(items => {
      const productMap = new Map();
      items.forEach(item => {
        if (item.product) {
          const existing = productMap.get(item.productId) || { ...item.product, sold: 0 };
          existing.sold += item.quantity;
          productMap.set(item.productId, existing);
        }
      });
      return Array.from(productMap.values()).sort((a, b) => b.sold - a.sold).slice(0, 5);
    });

    return new Response(JSON.stringify({
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        revenue,
        productsCount,
        lowStockProducts,
        customersCount,
        averageTicket: totalOrders > 0 ? revenue / totalOrders : 0,
      },
      recentOrders,
      topProducts,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
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