import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, desc, sql, and } from "drizzle-orm";

const { products, categories, orders, orderItems, coupons, customers, stores } = schema;

// ─── Create Product ──────────────────────────────────────────────
export async function createProductHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    storeId: string;
    name: string;
    description?: string;
    price: string;
    compareAtPrice?: string;
    costPrice?: string;
    categoryId?: string;
    stock?: number;
    lowStockThreshold?: number;
    sku?: string;
    barcode?: string;
    unit?: string;
    emoji?: string;
    imageUrl?: string;
    badge?: string;
    active?: boolean;
  };

  if (!body.storeId || !body.name || !body.price) {
    return new Response(JSON.stringify({ error: "storeId, name e price são obrigatórios" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [product] = await db.insert(products).values({
      storeId: body.storeId,
      name: body.name,
      description: body.description || null,
      price: body.price,
      compareAtPrice: body.compareAtPrice || null,
      costPrice: body.costPrice || null,
      categoryId: body.categoryId || null,
      stock: body.stock ?? 0,
      lowStockThreshold: body.lowStockThreshold ?? 5,
      sku: body.sku || null,
      barcode: body.barcode || null,
      unit: body.unit || "un",
      emoji: body.emoji || null,
      imageUrl: body.imageUrl || null,
      badge: body.badge || null,
      active: body.active !== false,
    }).returning();

    return new Response(JSON.stringify({ success: true, product }), {
      status: 201, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Create product error:", error);
    return new Response(JSON.stringify({ error: "Failed to create product" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── List Products ───────────────────────────────────────────────
export async function listProductsHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return new Response(JSON.stringify({ error: "Store ID required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const storeProducts = await db.select().from(products).where(eq(products.storeId, storeId));
    return new Response(JSON.stringify({ products: storeProducts }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("List products error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Update Product ──────────────────────────────────────────────
export async function updateProductHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    productId: string;
    name?: string;
    description?: string;
    price?: string;
    compareAtPrice?: string;
    costPrice?: string;
    categoryId?: string;
    stock?: number;
    lowStockThreshold?: number;
    sku?: string;
    barcode?: string;
    unit?: string;
    emoji?: string;
    imageUrl?: string;
    badge?: string;
    active?: boolean;
  };

  if (!body.productId) {
    return new Response(JSON.stringify({ error: "productId required" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = body.price;
    if (body.compareAtPrice !== undefined) updates.compareAtPrice = body.compareAtPrice;
    if (body.costPrice !== undefined) updates.costPrice = body.costPrice;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.stock !== undefined) updates.stock = body.stock;
    if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = body.lowStockThreshold;
    if (body.sku !== undefined) updates.sku = body.sku;
    if (body.barcode !== undefined) updates.barcode = body.barcode;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.emoji !== undefined) updates.emoji = body.emoji;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.badge !== undefined) updates.badge = body.badge;
    if (body.active !== undefined) updates.active = body.active;

    const [updated] = await db.update(products).set(updates).where(eq(products.id, body.productId)).returning();

    return new Response(JSON.stringify({ success: true, product: updated }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Update product error:", error);
    return new Response(JSON.stringify({ error: "Failed to update product" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Delete Product ──────────────────────────────────────────────
export async function deleteProductHandler(request: Request): Promise<Response> {
  const body = await request.json() as { productId: string };
  if (!body.productId) return new Response(JSON.stringify({ error: "productId required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    await db.delete(products).where(eq(products.id, body.productId));
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Delete product error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete product" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Create Category ─────────────────────────────────────────────
export async function createCategoryHandler(request: Request): Promise<Response> {
  const body = await request.json() as { storeId: string; name: string; emoji?: string; color?: string; imageUrl?: string };
  if (!body.storeId || !body.name) return new Response(JSON.stringify({ error: "storeId e name obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [cat] = await db.insert(categories).values({
      storeId: body.storeId,
      name: body.name,
      emoji: body.emoji || null,
      color: body.color || null,
      imageUrl: body.imageUrl || null,
    }).returning();

    return new Response(JSON.stringify({ success: true, category: cat }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Create category error:", error);
    return new Response(JSON.stringify({ error: "Failed to create category" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── List Categories ──────────────────────────────────────────────
export async function listCategoriesHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return new Response(JSON.stringify({ error: "Store ID required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const storeCategories = await db.select().from(categories).where(eq(categories.storeId, storeId));
    // Count products per category
    const catsWithCount = await Promise.all(storeCategories.map(async (cat) => {
      const count = await db.select({ count: sql<number>`count(*)` }).from(products).where(and(eq(products.storeId, storeId), eq(products.categoryId, cat.id)));
      return { ...cat, productsCount: Number(count[0]?.count) || 0 };
    }));
    return new Response(JSON.stringify({ categories: catsWithCount }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("List categories error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Delete Category ─────────────────────────────────────────────
export async function deleteCategoryHandler(request: Request): Promise<Response> {
  const body = await request.json() as { categoryId: string };
  if (!body.categoryId) return new Response(JSON.stringify({ error: "categoryId required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    await db.delete(categories).where(eq(categories.id, body.categoryId));
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Delete category error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete category" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Create Order ─────────────────────────────────────────────────
export async function createOrderHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    storeId: string;
    customerId?: string;
    type: string; // delivery | pickup
    paymentMethod: string; // pix | card | cash
    items: { productId: string; productName: string; productEmoji?: string; productImage?: string; quantity: number; unitPrice: string; additionsTotal?: string; total: string; additionsSnapshot?: { name: string; price: string }[]; notes?: string }[];
    subtotal: string;
    deliveryFee?: string;
    discount?: string;
    total: string;
    couponId?: string;
    notes?: string;
    addressSnapshot?: { street: string; number: string; neighborhood: string; city: string; state: string; zip: string; complement?: string };
    estimatedDelivery?: string;
  };

  if (!body.storeId || !body.items?.length || !body.total) {
    return new Response(JSON.stringify({ error: "storeId, items e total obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    // Get next order number for this store
    const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(${orders.number}), 0)` }).from(orders).where(eq(orders.storeId, body.storeId));
    const nextNumber = (Number(maxOrder?.max) || 0) + 1;

    const [order] = await db.insert(orders).values({
      storeId: body.storeId,
      customerId: body.customerId || null,
      number: nextNumber,
      status: "received",
      type: body.type || "delivery",
      paymentMethod: body.paymentMethod || null,
      paymentStatus: "pending",
      subtotal: body.subtotal,
      deliveryFee: body.deliveryFee || "0",
      discount: body.discount || "0",
      total: body.total,
      couponId: body.couponId || null,
      notes: body.notes || null,
      addressSnapshot: body.addressSnapshot || null,
      estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : null,
    }).returning();

    // Insert order items
    const itemsValues = body.items.map(item => ({
      orderId: order.id,
      productId: item.productId || null,
      productName: item.productName,
      productEmoji: item.productEmoji || null,
      productImage: item.productImage || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      additionsTotal: item.additionsTotal || "0",
      total: item.total,
      additionsSnapshot: item.additionsSnapshot || null,
      notes: item.notes || null,
    }));
    await db.insert(orderItems).values(itemsValues);

    // Insert timeline entry
    await db.insert(schema.orderTimeline).values({
      orderId: order.id,
      status: "received",
      note: "Pedido recebido",
    });

    // Update stock for each item
    for (const item of body.items) {
      if (item.productId) {
        await db.update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), eq(products.storeId, body.storeId)));
      }
    }

    // Update coupon usage if applicable
    if (body.couponId) {
      await db.update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1` })
        .where(eq(coupons.id, body.couponId));
    }

    return new Response(JSON.stringify({ success: true, order: { id: order.id, number: nextNumber } }), {
      status: 201, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Create order error:", error);
    return new Response(JSON.stringify({ error: "Failed to create order" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── List Orders ──────────────────────────────────────────────────
export async function listOrdersHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return new Response(JSON.stringify({ error: "Store ID required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const storeOrders = await db.query.orders.findMany({
      where: eq(orders.storeId, storeId),
      orderBy: desc(orders.createdAt),
      with: {
        customer: true,
        items: true,
      },
    });

    const formatted = storeOrders.map(o => ({
      id: `#${o.number}`,
      orderId: o.id,
      customer: o.customer?.name || "Cliente",
      items: o.items.map(i => `${i.quantity}x ${i.productName}`),
      total: `R$ ${parseFloat(o.total).toFixed(2).replace(".", ",")}`,
      payment: o.paymentMethod || "",
      status: o.status,
      time: new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      address: o.addressSnapshot ? `${o.addressSnapshot.street}, ${o.addressSnapshot.number}` : "",
      type: o.type,
      createdAt: o.createdAt,
    }));

    return new Response(JSON.stringify({ orders: formatted }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("List orders error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Update Order Status ─────────────────────────────────────────
export async function updateOrderStatusHandler(request: Request): Promise<Response> {
  const body = await request.json() as { orderId: string; status: string };
  if (!body.orderId || !body.status) return new Response(JSON.stringify({ error: "orderId e status obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    await db.update(orders).set({ status: body.status, updatedAt: new Date() }).where(eq(orders.id, body.orderId));

    // Insert timeline entry
    const statusLabels: Record<string, string> = {
      received: "Pedido recebido",
      preparing: "Preparando pedido",
      ready: "Pedido pronto",
      delivering: "Pedido saiu para entrega",
      delivered: "Pedido entregue",
      cancelled: "Pedido cancelado",
    };

    await db.insert(schema.orderTimeline).values({
      orderId: body.orderId,
      status: body.status,
      note: statusLabels[body.status] || body.status,
    });

    if (body.status === "delivered") {
      await db.update(orders).set({ deliveredAt: new Date() }).where(eq(orders.id, body.orderId));
    }
    if (body.status === "cancelled") {
      await db.update(orders).set({ cancelledAt: new Date() }).where(eq(orders.id, body.orderId));
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Update order status error:", error);
    return new Response(JSON.stringify({ error: "Failed to update order status" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Create Coupon ───────────────────────────────────────────────
export async function createCouponHandler(request: Request): Promise<Response> {
  const body = await request.json() as {
    storeId: string;
    code: string;
    type: string; // percent | fixed
    discount: string;
    minOrderValue?: string;
    maxUses?: number;
    expiresAt?: string;
    active?: boolean;
  };

  if (!body.storeId || !body.code || !body.type || !body.discount) {
    return new Response(JSON.stringify({ error: "storeId, code, type e discount obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    // Check if code already exists for this store
    const existing = await db.select().from(coupons).where(and(eq(coupons.storeId, body.storeId), eq(coupons.code, body.code.toUpperCase())));
    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: "Cupom com este código já existe" }), { status: 409, headers: { "content-type": "application/json" } });
    }

    const [coupon] = await db.insert(coupons).values({
      storeId: body.storeId,
      code: body.code.toUpperCase(),
      type: body.type,
      discount: body.discount,
      minOrderValue: body.minOrderValue || "0",
      maxUses: body.maxUses || null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      active: body.active !== false,
    }).returning();

    return new Response(JSON.stringify({ success: true, coupon }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Create coupon error:", error);
    return new Response(JSON.stringify({ error: "Failed to create coupon" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── List Customers ──────────────────────────────────────────────
export async function listCustomersHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return new Response(JSON.stringify({ error: "Store ID required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const storeCustomers = await db.select().from(customers).where(eq(customers.storeId, storeId));

    const customersWithStats = await Promise.all(storeCustomers.map(async (c) => {
      const customerOrders = await db.select().from(orders).where(and(eq(orders.storeId, storeId), eq(orders.customerId, c.id)));
      const totalSpent = customerOrders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      return {
        ...c,
        ordersCount: customerOrders.length,
        totalSpent: `R$ ${totalSpent.toFixed(2).replace(".", ",")}`,
        since: new Date(c.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
      };
    }));

    return new Response(JSON.stringify({ customers: customersWithStats }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("List customers error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Create Customer ─────────────────────────────────────────────
export async function createCustomerHandler(request: Request): Promise<Response> {
  const body = await request.json() as { storeId: string; name: string; email?: string; phone?: string; cpf?: string };
  if (!body.storeId || !body.name) return new Response(JSON.stringify({ error: "storeId e name obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [customer] = await db.insert(customers).values({
      storeId: body.storeId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      cpf: body.cpf || null,
    }).returning();

    return new Response(JSON.stringify({ success: true, customer }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Create customer error:", error);
    return new Response(JSON.stringify({ error: "Failed to create customer" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
