import { createDb, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";

const { sectors, productSectors, products } = schema;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── GET /api/sectors/list ───────────────────────────────────────
export async function listSectorsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const rows = await db
      .select()
      .from(sectors)
      .where(eq(sectors.storeId, storeId))
      .orderBy(sectors.position, sectors.createdAt);
    return json({ sectors: rows });
  } catch (error) {
    console.error("List sectors error:", error);
    return json({ error: "Erro ao listar setores" }, 500);
  }
}

// ─── POST /api/sectors/create ────────────────────────────────────
export async function createSectorHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    name: string;
    description?: string;
    color?: string;
    active?: boolean;
    position?: number;
  };
  if (!body.name?.trim()) return json({ error: "name obrigatório" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const [sector] = await db.insert(sectors).values({
      storeId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      color: body.color || null,
      active: body.active ?? true,
      position: body.position ?? 0,
    }).returning();
    return json({ success: true, sector }, 201);
  } catch (error) {
    console.error("Create sector error:", error);
    return json({ error: "Erro ao criar setor" }, 500);
  }
}

// ─── POST /api/sectors/update ────────────────────────────────────
export async function updateSectorHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    sectorId: string;
    name?: string;
    description?: string;
    color?: string;
    active?: boolean;
    position?: number;
  };
  if (!body.sectorId) return json({ error: "sectorId obrigatório" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const existing = await db.query.sectors.findFirst({
      where: and(eq(sectors.id, body.sectorId), eq(sectors.storeId, storeId)),
    });
    if (!existing) return json({ error: "Setor não encontrado" }, 404);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.description !== undefined) patch.description = body.description?.trim() || null;
    if (body.color !== undefined) patch.color = body.color || null;
    if (body.active !== undefined) patch.active = body.active;
    if (body.position !== undefined) patch.position = body.position;

    const [updated] = await db
      .update(sectors)
      .set(patch)
      .where(and(eq(sectors.id, body.sectorId), eq(sectors.storeId, storeId)))
      .returning();
    return json({ success: true, sector: updated });
  } catch (error) {
    console.error("Update sector error:", error);
    return json({ error: "Erro ao atualizar setor" }, 500);
  }
}

// ─── POST /api/sectors/delete ────────────────────────────────────
export async function deleteSectorHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { sectorId: string };
  if (!body.sectorId) return json({ error: "sectorId obrigatório" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const existing = await db.query.sectors.findFirst({
      where: and(eq(sectors.id, body.sectorId), eq(sectors.storeId, storeId)),
    });
    if (!existing) return json({ error: "Setor não encontrado" }, 404);

    await db.delete(sectors).where(and(eq(sectors.id, body.sectorId), eq(sectors.storeId, storeId)));
    return json({ success: true });
  } catch (error) {
    console.error("Delete sector error:", error);
    return json({ error: "Erro ao deletar setor" }, 500);
  }
}

// ─── GET /api/product-sectors ────────────────────────────────────
export async function getProductSectorsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return json({ error: "productId required" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
      columns: { id: true },
    });
    if (!product) return json({ sectorIds: [] });

    const rows = await db
      .select({ sectorId: productSectors.sectorId })
      .from(productSectors)
      .where(eq(productSectors.productId, productId));
    return json({ sectorIds: rows.map(r => r.sectorId) });
  } catch (error) {
    console.error("Get product sectors error:", error);
    return json({ error: "Erro ao buscar setores do produto" }, 500);
  }
}

// ─── POST /api/product-sectors/set ───────────────────────────────
export async function setProductSectorsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { productId: string; sectorIds: string[] };
  if (!body.productId) return json({ error: "productId obrigatório" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, body.productId), eq(products.storeId, storeId)),
      columns: { id: true },
    });
    if (!product) return json({ error: "Produto não encontrado" }, 404);

    await db.delete(productSectors).where(eq(productSectors.productId, body.productId));

    if (body.sectorIds?.length > 0) {
      await db.insert(productSectors).values(
        body.sectorIds.map(sectorId => ({ productId: body.productId, sectorId }))
      );
    }

    return json({ success: true });
  } catch (error) {
    console.error("Set product sectors error:", error);
    return json({ error: "Erro ao salvar setores do produto" }, 500);
  }
}
