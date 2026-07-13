import { createDb, createTenantDb } from "@/lib/db";
import type { PromoConfig } from "@/lib/promo-engine";
import { schema } from "@/lib/db";
import { eq, desc, sql, and, ne, isNotNull, inArray } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { notifyOwnerNewOrder, notifyCustomerStatus, normalizePhone, DEFAULT_WPP_CONFIG } from "@/lib/whatsapp-sender";
import { getCached, invalidateStoreCache, productsCacheKey, categoriesCacheKey, customersCacheKey, deleteKey } from "@/lib/cache/redis";
import { waitUntil } from "@/lib/execution-context";

const { products, categories, orders, orderItems, coupons, customers, stores, productAdditions, stockMovements, addresses } = schema;

// ─── Create Product ──────────────────────────────────────────────
export async function createProductHandler(request: Request, auth?: AuthContext): Promise<Response> {
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

  type ProductImageEntry = { url: string; isPrimary: boolean };
  const body = await request.json() as {
    name: string;
    description?: string;
    price: string;
    costPrice?: string;
    categoryId?: string;
    lowStockThreshold?: number;
    sku?: string;
    barcode?: string;
    unit?: string;
    emoji?: string;
    imageUrl?: string;
    images?: ProductImageEntry[];
    badge?: string;
    trackStock?: boolean;
    active?: boolean | null;
    allowObservation?: boolean;
    promoConfig?: PromoConfig | null;
    productType?: string;
    isWeightScale?: boolean;
    variationGroups?: Array<{ id: string; groupName: string; options: Array<{ id: string; name: string; price: string; images: Array<{ url: string; isPrimary: boolean }> }> }>;
  };

  if (!body.name || !body.price) {
    return new Response(JSON.stringify({ error: "name e price são obrigatórios" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  // Derive imageUrl from gallery primary, or fall back to explicit imageUrl
  const imagesArr: ProductImageEntry[] = body.images || [];
  const primaryUrl = imagesArr.find(i => i.isPrimary)?.url ?? imagesArr[0]?.url ?? body.imageUrl ?? null;

  try {
    const [product] = await db.insert(products).values({
      storeId,
      name: body.name,
      description: body.description || null,
      price: body.price,
      costPrice: body.costPrice || null,
      categoryId: body.categoryId || null,
      stock: 0,
      lowStockThreshold: body.lowStockThreshold ?? 5,
      sku: body.sku || null,
      barcode: body.barcode || null,
      unit: body.unit || "un",
      emoji: body.emoji || null,
      imageUrl: primaryUrl,
      images: imagesArr,
      badge: body.badge || null,
      trackStock: body.trackStock ?? false,
      active: body.active !== undefined ? body.active : true,
      allowObservation: body.allowObservation ?? false,
      promoConfig: body.promoConfig ?? null,
      productType: body.productType || "Produto",
      isWeightScale: body.isWeightScale ?? false,
      variationGroups: body.variationGroups ?? [],
    }).returning();

    // Invalida cache da vitrine — novo produto deve aparecer imediatamente
    waitUntil(request, invalidateStoreCache(storeId));

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

  // Fetch additions for a specific product
  const productId = url.searchParams.get("productId");
  const fetchAdditions = url.searchParams.get("additions") === "true";
  if (productId && fetchAdditions) {
    try {
      const additionRows = await db.select().from(productAdditions)
        .where(eq(productAdditions.productId, productId))
        .orderBy(productAdditions.position);
      return new Response(JSON.stringify({ additions: additionRows }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      console.error("List additions error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  // scope=public  → loja pública / vitrine (paginado, projeção mínima)
  // scope=pdv     → active=true OR active=null (suspenso aparece no PDV)
  // default       → all products (admin retaguarda)
  const scope = url.searchParams.get("scope");

  // ── Vitrine pública: projeção mínima + paginação ─────────────────
  if (scope === "public") {
    const limitNum  = Math.min(Math.max(parseInt(url.searchParams.get("limit")  || "20"), 1), 100);
    const offsetNum = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
    const categoryIdsParam = url.searchParams.get("categoryIds");
    const categoryIds = categoryIdsParam ? categoryIdsParam.split(",").filter(Boolean) : null;

    const cacheKey = productsCacheKey(
      storeId,
      limitNum,
      offsetNum,
      categoryIds?.join(",") ?? "all",
    );

    try {
      const result = await getCached(
        cacheKey,
        async () => {
          const where = and(
            eq(products.storeId, storeId),
            eq(products.active, true),
            categoryIds?.length ? inArray(products.categoryId, categoryIds) : undefined,
          );
          const [rows, countResult] = await Promise.all([
            db
              .select({
                id:                products.id,
                name:              products.name,
                description:       products.description,
                price:             products.price,
                compareAtPrice:    products.compareAtPrice,
                categoryId:        products.categoryId,
                imageUrl:          products.imageUrl,
                images:            products.images,
                emoji:             products.emoji,
                badge:             products.badge,
                promoConfig:       products.promoConfig,
                stock:             products.stock,
                lowStockThreshold: products.lowStockThreshold,
                rating:            products.rating,
                reviewCount:       products.reviewCount,
                allowObservation:  products.allowObservation,
              })
              .from(products)
              .where(where)
              .limit(limitNum)
              .offset(offsetNum)
              .orderBy(desc(products.featured), desc(products.createdAt)),
            db.select({ count: sql<number>`COUNT(*)` }).from(products).where(where),
          ]);
          const total = Number(countResult[0]?.count) || 0;
          return { products: rows, total, hasMore: offsetNum + rows.length < total };
        },
        { ttl: 3_600, storeId },
      );

      return new Response(JSON.stringify(result), {
        status: 200, headers: { "content-type": "application/json" },
      });
    } catch (error) {
      console.error("List products (public) error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  // ── Admin / PDV: comportamento existente (sem paginação) ─────────
  try {
    const baseWhere = eq(products.storeId, storeId);
    const where =
      scope === "pdv" ? and(baseWhere, ne(products.active, false)) :
      baseWhere;

    const storeProducts = await db.select().from(products).where(where);
    return new Response(JSON.stringify({ products: storeProducts }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("List products error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Update Product ──────────────────────────────────────────────
export async function updateProductHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // DB-verified tenant isolation — revoked store members are blocked immediately
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

  type ProductImageEntry2 = { url: string; isPrimary: boolean };
  const body = await request.json() as {
    productId: string;
    name?: string;
    description?: string;
    price?: string;
    costPrice?: string;
    categoryId?: string;
    lowStockThreshold?: number;
    sku?: string;
    barcode?: string;
    unit?: string;
    emoji?: string;
    imageUrl?: string;
    images?: ProductImageEntry2[];
    badge?: string;
    trackStock?: boolean;
    active?: boolean | null;
    allowObservation?: boolean;
    promoConfig?: PromoConfig | null;
    productType?: string;
    isWeightScale?: boolean;
    variationGroups?: Array<{ id: string; groupName: string; options: Array<{ id: string; name: string; price: string; images: Array<{ url: string; isPrimary: boolean }> }> }>;
  };

  if (!body.productId) {
    return new Response(JSON.stringify({ error: "productId required" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // IDOR: verify product belongs to this tenant
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, body.productId), eq(products.storeId, storeId)))
      .limit(1);

    if (!existing) {
      return new Response(JSON.stringify({ error: "Product not found or no access" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    const updates: Partial<typeof products.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (body.name        !== undefined) updates.name        = body.name;
    if (body.description !== undefined) updates.description = body.description || null;
    if (body.price       !== undefined) updates.price       = body.price;
    if (body.costPrice   !== undefined) updates.costPrice   = body.costPrice   || null;
    if (body.categoryId  !== undefined) updates.categoryId  = body.categoryId  || null;
    if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = body.lowStockThreshold;
    if (body.sku         !== undefined) updates.sku         = body.sku         || null;
    if (body.barcode     !== undefined) updates.barcode     = body.barcode     || null;
    if (body.unit        !== undefined) updates.unit        = body.unit;
    if (body.emoji       !== undefined) updates.emoji       = body.emoji       || null;
    if (body.images !== undefined) {
      updates.images = body.images;
      const primary = body.images.find(i => i.isPrimary) ?? body.images[0];
      updates.imageUrl = primary?.url ?? null;
    } else if (body.imageUrl !== undefined) {
      updates.imageUrl = body.imageUrl || null;
    }
    if (body.badge       !== undefined) updates.badge       = body.badge       || null;
    if (body.trackStock  !== undefined) updates.trackStock  = body.trackStock;
    if (body.active      !== undefined) updates.active      = body.active;
    if (body.allowObservation !== undefined) updates.allowObservation = body.allowObservation;
    if (body.promoConfig      !== undefined) updates.promoConfig      = body.promoConfig;
    if (body.productType      !== undefined) updates.productType      = body.productType;
    if (body.isWeightScale    !== undefined) updates.isWeightScale    = body.isWeightScale;
    if (body.variationGroups  !== undefined) updates.variationGroups  = body.variationGroups;

    const [updated] = await db.update(products)
      .set(updates)
      .where(and(eq(products.id, body.productId), eq(products.storeId, storeId)))
      .returning();

    // Invalida cache — alterações de preço/promo/estoque devem refletir imediatamente
    waitUntil(request, invalidateStoreCache(storeId));

    return new Response(JSON.stringify({ success: true, product: updated }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Update product error:", msg, { productId: body.productId, storeId });
    return new Response(JSON.stringify({ error: msg || "Failed to update product" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Delete Product ──────────────────────────────────────────────
export async function deleteProductHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // DB-verified tenant isolation — revoked store members are blocked immediately
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

  const body = await request.json() as { productId: string };
  if (!body.productId) return new Response(JSON.stringify({ error: "productId required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // IDOR: verify product belongs to tenant before deleting
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, body.productId), eq(products.storeId, storeId)))
      .limit(1);

    if (!existing) {
      return new Response(JSON.stringify({ error: "Product not found or no access" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    // Soft delete: preserves product history in orders and stock movements
    await db.update(products).set({ active: false, updatedAt: new Date() }).where(and(eq(products.id, body.productId), eq(products.storeId, storeId)));

    // Invalida cache — produto removido não deve aparecer na vitrine
    waitUntil(request, invalidateStoreCache(storeId));

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Delete product error:", msg);
    return new Response(JSON.stringify({ error: msg || "Failed to delete product" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Create Category ─────────────────────────────────────────────
export async function createCategoryHandler(request: Request, auth?: AuthContext): Promise<Response> {
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

  const body = await request.json() as {
    name: string; slug?: string; emoji?: string; icon?: string; color?: string; imageUrl?: string;
    parentId?: string; position?: number; active?: boolean; showInMenu?: boolean;
    featured?: boolean; analytic?: boolean; metaTitle?: string; metaDescription?: string;
  };
  if (!body.name) return new Response(JSON.stringify({ error: "name obrigatório" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const autoSlug = (body.slug || body.name)
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const [cat] = await db.insert(categories).values({
      storeId,
      name: body.name,
      slug: autoSlug,
      emoji: body.emoji || null,
      icon: body.icon || null,
      color: body.color || null,
      imageUrl: body.imageUrl || null,
      parentId: body.parentId || null,
      position: body.position ?? 0,
      active: body.active ?? true,
      showInMenu: body.showInMenu ?? true,
      featured: body.featured ?? false,
      analytic: body.analytic ?? false,
      metaTitle: body.metaTitle || null,
      metaDescription: body.metaDescription || null,
    }).returning();

    waitUntil(request, invalidateStoreCache(storeId));

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
  const scope = url.searchParams.get("scope");

  // ── Vitrine pública: projeção mínima, sem N+1 de contagem ────────
  if (scope === "public") {
    try {
      const result = await getCached(
        categoriesCacheKey(storeId),
        async () => {
          const rows = await db
            .select({
              id:       categories.id,
              name:     categories.name,
              emoji:    categories.emoji,
              icon:     categories.icon,
              imageUrl: categories.imageUrl,
              parentId: categories.parentId,
              position: categories.position,
            })
            .from(categories)
            .where(and(eq(categories.storeId, storeId), eq(categories.active, true)))
            .orderBy(categories.position, categories.createdAt);
          return { categories: rows };
        },
        { ttl: 3_600, storeId },
      );

      return new Response(JSON.stringify(result), {
        status: 200, headers: { "content-type": "application/json" },
      });
    } catch (error) {
      console.error("List categories (public) error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  // ── Admin: categoria list + contagem em 2 queries paralelas (era N+1) ──────
  try {
    const [storeCategories, countRows] = await Promise.all([
      db.select().from(categories)
        .where(eq(categories.storeId, storeId))
        .orderBy(categories.position, categories.createdAt),
      db.select({
        categoryId: products.categoryId,
        count: sql<number>`cast(count(*) as int)`,
      })
        .from(products)
        .where(and(eq(products.storeId, storeId), isNotNull(products.categoryId)))
        .groupBy(products.categoryId),
    ]);

    const countMap = new Map(countRows.map(r => [r.categoryId, r.count]));
    const catsWithCount = storeCategories.map(cat => ({
      ...cat,
      productsCount: countMap.get(cat.id) ?? 0,
    }));

    return new Response(JSON.stringify({ categories: catsWithCount }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("List categories error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Update Category ──────────────────────────────────────────────
export async function updateCategoryHandler(request: Request, auth?: AuthContext): Promise<Response> {
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
    categoryId: string; name?: string; slug?: string; emoji?: string; icon?: string; color?: string;
    imageUrl?: string; parentId?: string | null; position?: number; active?: boolean;
    showInMenu?: boolean; featured?: boolean; analytic?: boolean; metaTitle?: string; metaDescription?: string;
  };
  if (!body.categoryId) return new Response(JSON.stringify({ error: "categoryId required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const existing = await db.query.categories.findFirst({
      where: and(eq(categories.id, body.categoryId), eq(categories.storeId, storeId))
    });
    if (!existing) return new Response(JSON.stringify({ error: "Category not found or no access" }), { status: 404, headers: { "content-type": "application/json" } });

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.slug !== undefined) {
      patch.slug = body.slug.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    } else if (body.name !== undefined) {
      patch.slug = body.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    if (body.emoji !== undefined) patch.emoji = body.emoji || null;
    if (body.icon !== undefined) patch.icon = body.icon || null;
    if (body.color !== undefined) patch.color = body.color || null;
    if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl || null;
    if (body.parentId !== undefined) patch.parentId = body.parentId || null;
    if (body.position !== undefined) patch.position = body.position;
    if (body.active !== undefined) patch.active = body.active;
    if (body.showInMenu !== undefined) patch.showInMenu = body.showInMenu;
    if (body.featured !== undefined) patch.featured = body.featured;
    if (body.analytic !== undefined) patch.analytic = body.analytic;
    if (body.metaTitle !== undefined) patch.metaTitle = body.metaTitle || null;
    if (body.metaDescription !== undefined) patch.metaDescription = body.metaDescription || null;

    const [updated] = await db.update(categories).set(patch).where(and(eq(categories.id, body.categoryId), eq(categories.storeId, storeId))).returning();

    waitUntil(request, invalidateStoreCache(storeId));

    return new Response(JSON.stringify({ success: true, category: updated }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Update category error:", error);
    return new Response(JSON.stringify({ error: "Failed to update category" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Delete Category ─────────────────────────────────────────────
export async function deleteCategoryHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // DB-verified tenant isolation — revoked store members are blocked immediately
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

  const body = await request.json() as { categoryId: string };
  if (!body.categoryId) return new Response(JSON.stringify({ error: "categoryId required" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // IDOR Fix: Verify category belongs to tenant before deleting
    const existingCategory = await db.query.categories.findFirst({
      where: and(eq(categories.id, body.categoryId), eq(categories.storeId, storeId))
    });

    if (!existingCategory) {
      return new Response(JSON.stringify({ error: "Category not found or no access" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    // Limpar parentId das filhas antes de deletar para evitar órfãos
    await db.update(categories)
      .set({ parentId: null })
      .where(and(eq(categories.parentId, body.categoryId), eq(categories.storeId, storeId)));

    // IDOR Fix: Include storeId in WHERE clause
    await db.delete(categories).where(and(eq(categories.id, body.categoryId), eq(categories.storeId, storeId)));

    waitUntil(request, invalidateStoreCache(storeId));

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
    cliente?: { nome: string; telefone: string };
    type: string;
    paymentMethod: string;
    installments?: number;
    cardFeeAmount?: string;
    couponCode?: string; // código legível enviado pelo checkout público
    couponId?: string;   // UUID (compatibilidade PDV/admin)
    items: { productId: string; productName: string; productEmoji?: string; productImage?: string; quantity: number; unitPrice: string; additionsTotal?: string; total: string; additionsSnapshot?: { name: string; price: string }[]; notes?: string }[];
    subtotal: string;
    deliveryFee?: string;
    discount?: string;
    total: string;
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
    // ── 1. Número sequencial por loja ─────────────────────────────────────────
    const [maxOrder] = await db
      .select({ max: sql<number>`COALESCE(MAX(${orders.number}), 0)` })
      .from(orders)
      .where(eq(orders.storeId, body.storeId));
    const nextNumber = (Number(maxOrder?.max) || 0) + 1;

    // ── 2. Resolver couponId a partir do código legível enviado pelo checkout ─
    // O checkout público envia `couponCode` (ex: "SAVE10"), não o UUID.
    let resolvedCouponId: string | null = body.couponId || null;
    if (!resolvedCouponId && body.couponCode) {
      const [coupon] = await db
        .select({ id: coupons.id })
        .from(coupons)
        .where(and(
          eq(coupons.storeId, body.storeId),
          eq(coupons.code, body.couponCode.toUpperCase()),
          eq(coupons.active, true),
        ))
        .limit(1);
      resolvedCouponId = coupon?.id ?? null;
    }

    // ── 3. Inserir pedido ─────────────────────────────────────────────────────
    const [order] = await db.insert(orders).values({
      storeId:           body.storeId,
      customerId:        body.customerId || null,
      number:            nextNumber,
      status:            "received",
      type:              body.type || "delivery",
      paymentMethod:     body.paymentMethod || null,
      installments:      body.installments && body.installments > 1 ? body.installments : 1,
      cardFeeAmount:     body.cardFeeAmount || null,
      paymentStatus:     "pending",
      subtotal:          body.subtotal,
      deliveryFee:       body.deliveryFee || "0",
      discount:          body.discount || "0",
      total:             body.total,
      couponId:          resolvedCouponId,
      notes:             body.notes || null,
      addressSnapshot:   body.addressSnapshot || null,
      estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : null,
    }).returning();

    // ── 4. Itens + entrada na timeline — independentes, rodam em paralelo ─────
    await Promise.all([
      db.insert(orderItems).values(body.items.map(item => ({
        orderId:           order.id,
        productId:         item.productId || null,
        productName:       item.productName,
        productEmoji:      item.productEmoji || null,
        productImage:      item.productImage || null,
        quantity:          item.quantity,
        unitPrice:         item.unitPrice,
        additionsTotal:    item.additionsTotal || "0",
        total:             item.total,
        additionsSnapshot: item.additionsSnapshot || null,
        notes:             item.notes || null,
      }))),
      db.insert(schema.orderTimeline).values({
        orderId: order.id,
        status:  "received",
        note:    "Pedido recebido e confirmado",
      }),
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // ACIMA: caminho crítico — falha retorna 500 antes de qualquer dado persistido.
    // ABAIXO: enriquecimento — falhas são não-fatais; o pedido já existe no banco.
    // ══════════════════════════════════════════════════════════════════════════

    // ── 5. Upsert do cliente + vínculo ao pedido ──────────────────────────────
    // Roda de forma síncrona (precisa do customerId para a resposta), mas
    // envolto em try/catch para não derrubar a confirmação ao cliente.
    let resolvedCustomerId: string | null = body.customerId || null;
    const rawPhone = body.cliente?.telefone?.replace(/\D/g, "") || null;

    if (rawPhone && !resolvedCustomerId) {
      try {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(
            eq(customers.storeId, body.storeId),
            sql`regexp_replace(${customers.phone}, '\D', '', 'g') = ${rawPhone}`,
          ))
          .limit(1);

        if (existing) {
          resolvedCustomerId = existing.id;
        } else {
          const [created] = await db
            .insert(customers)
            .values({
              storeId: body.storeId,
              name:    body.cliente?.nome?.trim() || "Cliente",
              phone:   rawPhone,
              status:  "ativo",
              active:  true,
            })
            .returning({ id: customers.id });
          resolvedCustomerId = created?.id ?? null;
          waitUntil(request, deleteKey(customersCacheKey(body.storeId)));
        }

        if (resolvedCustomerId) {
          await db.update(orders)
            .set({ customerId: resolvedCustomerId })
            .where(eq(orders.id, order.id));
        }
      } catch (custErr) {
        console.error("[createOrder] customer upsert failed (non-fatal):", custErr);
      }
    }

    // ── 6. Estoque + cupom — background, nunca bloqueia a resposta ───────────
    // Separado do caminho principal para que falhas de stock_movements ou de
    // tabelas inexistentes não causem 500 ao cliente.
    waitUntil(request, (async () => {
      try {
        for (const item of body.items) {
          if (!item.productId) continue;

          const [prod] = await db
            .select({ stock: products.stock, trackStock: products.trackStock })
            .from(products)
            .where(and(eq(products.id, item.productId), eq(products.storeId, body.storeId)))
            .limit(1);

          // Pula produtos sem rastreio de estoque
          if (!prod?.trackStock) continue;

          const balanceBefore = prod.stock ?? 0;
          const balanceAfter  = Math.max(0, balanceBefore - item.quantity);

          await db.update(products)
            .set({ stock: balanceAfter, updatedAt: new Date() })
            .where(and(eq(products.id, item.productId), eq(products.storeId, body.storeId)));

          await db.insert(stockMovements).values({
            storeId:      body.storeId,
            productId:    item.productId,
            productName:  item.productName,
            type:         "VENDA",
            quantity:     item.quantity,
            balanceBefore,
            balanceAfter,
            origem:       `Venda — Pedido #${nextNumber}`,
            orderId:      order.id,
          });
        }

        // Incrementa uso do cupom (usa o UUID resolvido acima)
        if (resolvedCouponId) {
          await db.update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(and(eq(coupons.id, resolvedCouponId), eq(coupons.storeId, body.storeId)));
        }
      } catch (err) {
        console.error("[createOrder] stock/coupon background task failed:", err);
      }
    })());

    // ── 7. WhatsApp — background ──────────────────────────────────────────────
    waitUntil(request, (async () => {
      try {
        const [storeRow, custRow] = await Promise.all([
          db.select({ name: stores.name, wppConfig: stores.wppConfig })
            .from(stores).where(eq(stores.id, body.storeId)).limit(1)
            .then(r => r[0] ?? null),
          resolvedCustomerId
            ? db.select({ name: customers.name, phone: customers.phone })
                .from(customers).where(eq(customers.id, resolvedCustomerId)).limit(1)
                .then(r => r[0] ?? null)
            : Promise.resolve(null),
        ]);

        if (!storeRow) return;

        // Fallback to defaults so stores that never saved config still get notifications
        const cfg = storeRow.wppConfig ?? DEFAULT_WPP_CONFIG;

        // Phone: prefer CRM record (already E.164), fall back to checkout form digits
        const customerPhone = custRow?.phone
          ? normalizePhone(custRow.phone)
          : rawPhone
          ? normalizePhone(rawPhone)
          : null;
        const customerName = custRow?.name ?? body.cliente?.nome ?? "Cliente";

        const itemsOwner = body.items.map(i => `• ${i.productName} ×${i.quantity}`).join("\n");
        const itemsCustomer = body.items.slice(0, 3).map(i => `• ${i.productName} ×${i.quantity}`).join("\n");

        const entregaText = (() => {
          const t = (body.type ?? "").toLowerCase();
          if (t === "pickup" || t === "retirada") return "Retirada no local";
          if (t === "local" || t === "dine-in" || t === "mesa") return "Consumo no local";
          if (body.addressSnapshot) {
            const a = body.addressSnapshot;
            const parts = [`${a.street}, ${a.number}`, a.neighborhood, `${a.city}/${a.state}`, `CEP: ${a.zip}`];
            if (a.complement) parts.splice(2, 0, a.complement);
            return `Delivery\n📍 ${parts.filter(Boolean).join(" — ")}`;
          }
          return "Delivery";
        })();

        await Promise.all([
          notifyOwnerNewOrder({
            storeId:       body.storeId,
            storeName:     storeRow.name,
            orderNumber:   nextNumber,
            customerName,
            customerPhone,
            total:         body.total,
            subtotal:      body.subtotal,
            deliveryFee:   body.deliveryFee ?? null,
            paymentMethod: body.paymentMethod ?? null,
            entrega:       entregaText,
            items:         itemsOwner,
            status:        "received",
            wppConfig:     cfg,
          }),
          notifyCustomerStatus({
            storeId:       body.storeId,
            storeName:     storeRow.name,
            orderNumber:   nextNumber,
            customerName,
            customerPhone,
            total:         body.total,
            paymentMethod: body.paymentMethod ?? null,
            items:         itemsCustomer,
            status:        "received",
            wppConfig:     cfg,
          }),
        ]);
      } catch (err) {
        console.error("[createOrder] WhatsApp notification failed:", err);
      }
    })());

    // ── 8. Resposta — sempre atingida se order + items foram inseridos ─────────
    return new Response(
      JSON.stringify({ success: true, order: { id: order.id, number: nextNumber, customerId: resolvedCustomerId } }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    console.error("[createOrder] critical path error:", error);
    return new Response(JSON.stringify({ error: "Failed to create order" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

// ─── List Orders ──────────────────────────────────────────────────
export async function listOrdersHandler(request: Request, auth?: AuthContext): Promise<Response> {
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
    const storeOrders = await db.query.orders.findMany({
      where: eq(orders.storeId, storeId),
      orderBy: desc(orders.createdAt),
      with: { items: true, customer: true },
    });

    const formatted = storeOrders.map(o => ({
      ...o,
      totalFormatted: `R$ ${parseFloat(o.total).toFixed(2).replace(".", ",")}`,
      date: new Date(o.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    }));

    return new Response(JSON.stringify({ orders: formatted }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("List orders error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Update Order Status ─────────────────────────────────────────
const VALID_ORDER_STATUSES = ["pending", "received", "preparing", "ready", "delivering", "delivered", "cancelled"] as const;
type OrderStatus = typeof VALID_ORDER_STATUSES[number];

export async function updateOrderStatusHandler(request: Request, auth?: AuthContext): Promise<Response> {
  // DB-verified tenant isolation — revoked store members are blocked immediately
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

  const body = await request.json() as { orderId: string; status: string };
  if (!body.orderId || !body.status) return new Response(JSON.stringify({ error: "orderId e status obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });

  // SECURITY: Whitelist valid statuses to prevent arbitrary status injection
  if (!VALID_ORDER_STATUSES.includes(body.status as OrderStatus)) {
    return new Response(JSON.stringify({ error: `Status inválido. Deve ser: ${VALID_ORDER_STATUSES.join(", ")}` }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // IDOR Fix: Verify order belongs to tenant before updating
    const existingOrder = await db.query.orders.findFirst({
      where: and(eq(orders.id, body.orderId), eq(orders.storeId, storeId))
    });

    if (!existingOrder) {
      return new Response(JSON.stringify({ error: "Order not found or no access" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    const statusLabels: Record<string, string> = {
      pending:    "Pedido recebido — aguardando confirmação",
      received:   "Pedido confirmado pelo estabelecimento",
      preparing:  "Preparando pedido",
      ready:      "Pedido pronto",
      delivering: "Pedido saiu para entrega",
      delivered:  "Pedido entregue",
      cancelled:  "Pedido cancelado",
    };

    const now = new Date();
    const statusPatch: Record<string, unknown> = {
      status:    body.status,
      updatedAt: now,
      // Merge dos timestamps condicionais — 1 UPDATE ao invés de 3 sequenciais
      ...(body.status === "delivered" && { deliveredAt: now }),
      ...(body.status === "cancelled" && { cancelledAt: now }),
    };

    // UPDATE de status + INSERT de timeline em paralelo (independentes)
    await Promise.all([
      db.update(orders)
        .set(statusPatch)
        .where(and(eq(orders.id, body.orderId), eq(orders.storeId, storeId))),
      db.insert(schema.orderTimeline).values({
        orderId: body.orderId,
        status:  body.status,
        note:    statusLabels[body.status] || body.status,
      }),
    ]);

    // ── WhatsApp notification — background via ctx.waitUntil ──────────────────
    waitUntil(request, (async () => {
      const [storeRow, orderWithCustomer] = await Promise.all([
        db.select({ name: stores.name, wppConfig: stores.wppConfig, address: stores.address })
          .from(stores).where(eq(stores.id, storeId)).limit(1)
          .then(r => r[0] ?? null),
        db.query.orders.findFirst({
          where: and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)),
          with: { customer: true, items: true },
        }),
      ]);

      if (!storeRow?.wppConfig?.notifyCustomer) return;
      if (!orderWithCustomer?.customer?.phone) return;

      const itemsSummary = (orderWithCustomer.items ?? [])
        .slice(0, 3)
        .map(i => `• ${i.productName} ×${i.quantity}`)
        .join("\n");

      await notifyCustomerStatus({
        storeId,
        storeName:     storeRow.name,
        orderNumber:   orderWithCustomer.number,
        customerName:  orderWithCustomer.customer.name,
        customerPhone: orderWithCustomer.customer.phone,
        total:         orderWithCustomer.total,
        paymentMethod: orderWithCustomer.paymentMethod ?? null,
        storeAddress:  storeRow.address ?? null,
        items:         itemsSummary,
        status:        body.status,
        wppConfig:     storeRow.wppConfig,
      });
    })());
    // ─────────────────────────────────────────────────────────────────────────

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Update order status error:", error);
    return new Response(JSON.stringify({ error: "Failed to update order status" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Create Coupon ───────────────────────────────────────────────
export async function createCouponHandler(request: Request, auth?: AuthContext): Promise<Response> {
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

  const body = await request.json() as {
    code: string;
    type: string; // percent | fixed
    discount: string;
    minOrderValue?: string;
    maxUses?: number;
    expiresAt?: string;
    active?: boolean;
  };

  if (!body.code || !body.type || !body.discount) {
    return new Response(JSON.stringify({ error: "code, type e discount obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // Check if code already exists for this store
    const existing = await db.select().from(coupons).where(and(eq(coupons.storeId, storeId), eq(coupons.code, body.code.toUpperCase())));
    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: "Cupom com este código já existe" }), { status: 409, headers: { "content-type": "application/json" } });
    }

    const [coupon] = await db.insert(coupons).values({
      storeId,
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
// LGPD: Customer data is masked in list view to minimize PII exposure
export async function listCustomersHandler(request: Request, auth?: AuthContext): Promise<Response> {
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
    // Cache-Aside: query N+1 cara (orders por cliente) — vale cachear por 5 min.
    // Invalidada imediatamente após create/update de customer (deleteKey abaixo).
    const customersWithStats = await getCached(
      customersCacheKey(storeId),
      async () => {
        const storeCustomers = await db.select().from(customers).where(eq(customers.storeId, storeId));

        return Promise.all(storeCustomers.map(async (c) => {
          const customerOrders = await db.select().from(orders).where(and(eq(orders.storeId, storeId), eq(orders.customerId, c.id)));
          const totalSpent = customerOrders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);

          // LGPD: Mask sensitive data in list view
          const maskCPF = (cpf?: string | null) => {
            if (!cpf || cpf.length < 11) return cpf;
            return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
          };
          const maskPhone = (phone?: string | null) => {
            if (!phone || phone.length < 8) return phone;
            const cleaned = phone.replace(/\D/g, "");
            if (cleaned.length < 10) return phone;
            return `(${cleaned.slice(0, 2)}) *****-${cleaned.slice(-4)}`;
          };
          const maskEmail = (email?: string | null) => {
            if (!email || !email.includes("@")) return email;
            const [local, domain] = email.split("@");
            if (local.length <= 3) return `***@${domain}`;
            return `${local.slice(0, 2)}***@${domain}`;
          };

          return {
            id: c.id,
            name: c.name,
            email: maskEmail(c.email),
            phone: maskPhone(c.phone),
            cpf: maskCPF(c.cpf),
            isSupplier: c.isSupplier ?? false,
            isDeliverer: c.isDeliverer ?? false,
            status: c.status ?? "ativo",
            ordersCount: customerOrders.length,
            totalSpent: `R$ ${totalSpent.toFixed(2).replace(".", ",")}`,
            since: new Date(c.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
          };
        }));
      },
      { ttl: 300, storeId }, // 5 min — registra a chave no índice do store
    );

    return new Response(JSON.stringify({ customers: customersWithStats }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("List customers error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── List Suppliers (autocomplete) ───────────────────────────────
export async function listSuppliersHandler(request: Request, auth?: AuthContext): Promise<Response> {
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

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const rows = await db.select({ id: customers.id, name: customers.name, phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), eq(customers.isSupplier, true), eq(customers.active, true)));

    const filtered = q ? rows.filter(s => s.name.toLowerCase().includes(q)) : rows;
    return new Response(JSON.stringify({ suppliers: filtered.slice(0, 20) }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("List suppliers error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Create Customer ─────────────────────────────────────────────
export async function createCustomerHandler(request: Request, auth?: AuthContext): Promise<Response> {
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

  const body = await request.json() as { name: string; email?: string; phone?: string; cpf?: string; isSupplier?: boolean; isDeliverer?: boolean; status?: string };
  if (!body.name) return new Response(JSON.stringify({ error: "name obrigatório" }), { status: 400, headers: { "content-type": "application/json" } });

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const [customer] = await db.insert(customers).values({
      storeId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      cpf: body.cpf || null,
      isSupplier: body.isSupplier ?? false,
      isDeliverer: body.isDeliverer ?? false,
      status: body.status ?? "ativo",
      active: (body.status ?? "ativo") === "ativo",
    }).returning();

    // Invalida cache da listagem do CRM em background — não bloqueia a resposta.
    // Fail-safe: erros do Redis são absorvidos dentro de deleteKey().
    waitUntil(request, deleteKey(customersCacheKey(storeId)));

    return new Response(JSON.stringify({ success: true, customer }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Create customer error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Update Customer ─────────────────────────────────────────────
export async function updateCustomerHandler(request: Request, auth?: AuthContext): Promise<Response> {
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
    customerId: string;
    name?: string;
    email?: string;
    phone?: string;
    cpf?: string;
    isSupplier?: boolean;
    isDeliverer?: boolean;
    status?: string;
  };

  if (!body.customerId) {
    return new Response(JSON.stringify({ error: "customerId obrigatório" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // IDOR: verify the customer belongs to this store before updating
    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.id, body.customerId), eq(customers.storeId, storeId)),
    });

    if (!existing) {
      return new Response(JSON.stringify({ error: "Contato não encontrado" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    const newStatus = body.status ?? existing.status ?? "ativo";

    const [customer] = await db.update(customers)
      .set({
        name:       body.name       ?? existing.name,
        email:      body.email      !== undefined ? (body.email || null)  : existing.email,
        phone:      body.phone      !== undefined ? (body.phone || null)  : existing.phone,
        cpf:        body.cpf        !== undefined ? (body.cpf   || null)  : existing.cpf,
        isSupplier:  body.isSupplier  !== undefined ? body.isSupplier  : existing.isSupplier,
        isDeliverer: body.isDeliverer !== undefined ? body.isDeliverer : existing.isDeliverer,
        status:     newStatus,
        active:     newStatus === "ativo",
        updatedAt:  new Date(),
      })
      .where(and(eq(customers.id, body.customerId), eq(customers.storeId, storeId)))
      .returning();

    // Invalida cache da listagem do CRM em background — não bloqueia a resposta.
    waitUntil(request, deleteKey(customersCacheKey(storeId)));

    return new Response(JSON.stringify({ success: true, customer }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Update customer error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── Validate Public Coupon (storefront, no auth) ───────────────
export async function validatePublicCouponHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");
  const code = url.searchParams.get("code");
  const orderValue = parseFloat(url.searchParams.get("orderValue") || "0");

  if (!storeId || !code) {
    return new Response(JSON.stringify({ error: "storeId e code são obrigatórios" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const coupon = await db.query.coupons.findFirst({
      where: and(eq(coupons.storeId, storeId), eq(coupons.code, code.toUpperCase())),
    });

    if (!coupon || !coupon.active) {
      return new Response(JSON.stringify({ error: "Cupom inválido ou expirado" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return new Response(JSON.stringify({ error: "Cupom expirado" }), { status: 400, headers: { "content-type": "application/json" } });
    }

    const minOrder = parseFloat(coupon.minOrderValue || "0");
    if (orderValue > 0 && orderValue < minOrder) {
      return new Response(JSON.stringify({ error: `Pedido mínimo de R$ ${minOrder.toFixed(2).replace(".", ",")} para este cupom` }), { status: 400, headers: { "content-type": "application/json" } });
    }

    const discountValue = coupon.type === "percent"
      ? (orderValue * parseFloat(coupon.discount || "0")) / 100
      : parseFloat(coupon.discount || "0");

    return new Response(JSON.stringify({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      discount: coupon.discount,
      discountValue: Math.min(discountValue, orderValue).toFixed(2),
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("Validate coupon error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// ─── GET /api/customer/check?storeId=X&phone=Y ──────────────────────────────
// Busca rápida por telefone para pré-preenchimento do checkout (fluxo público).
// Normaliza o telefone dos dois lados (regexp_replace) para ignorar formatação.
export async function checkCustomerByPhoneHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId");
  const rawPhone = url.searchParams.get("phone");

  if (!storeId || !rawPhone) {
    return new Response(JSON.stringify({ error: "storeId e phone são obrigatórios" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  // Aceita tanto "5511999999999" quanto "(11) 99999-9999" — normaliza para só dígitos
  const cleanPhone = rawPhone.replace(/\D/g, "");
  if (cleanPhone.length < 10 || cleanPhone.length > 13) {
    return new Response(JSON.stringify({ error: "Telefone inválido" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const db = createDb(process.env.DATABASE_URL!);

  try {
    // Seleciona apenas os campos necessários para o checkout (evita CPF, email, avatarUrl, etc.)
    const [customer] = await db
      .select({
        id:    customers.id,
        name:  customers.name,
        phone: customers.phone,
      })
      .from(customers)
      .where(
        and(
          eq(customers.storeId, storeId),
          sql`regexp_replace(${customers.phone}, '\D', '', 'g') = ${cleanPhone}`,
        )
      )
      .limit(1);

    if (!customer) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }

    // Busca endereços do cliente — apenas campos de entrega
    const customerAddresses = await db
      .select({
        id:           addresses.id,
        label:        addresses.label,
        street:       addresses.street,
        number:       addresses.number,
        complement:   addresses.complement,
        neighborhood: addresses.neighborhood,
        city:         addresses.city,
        state:        addresses.state,
        zip:          addresses.zip,
        isDefault:    addresses.isDefault,
      })
      .from(addresses)
      .where(eq(addresses.customerId, customer.id))
      .orderBy(addresses.isDefault, addresses.createdAt);

    return new Response(JSON.stringify({ exists: true, customer, addresses: customerAddresses }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("checkCustomerByPhone error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}