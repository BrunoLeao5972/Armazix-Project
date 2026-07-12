import { createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireStoreAccess, AuthContext } from "@/lib/auth/require-store-access";
import { deleteKey, storeCacheKey } from "@/lib/cache/redis";

const { banners, stores } = schema;

const MAX_BANNERS = 5;

export async function saveBannersHandler(request: Request, auth?: AuthContext): Promise<Response> {
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

  const body = await request.json() as { imageUrls?: unknown };

  if (!Array.isArray(body.imageUrls)) {
    return new Response(JSON.stringify({ error: "imageUrls deve ser um array" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const imageUrls = (body.imageUrls as unknown[])
    .filter((u) => typeof u === "string" && u.length > 0)
    .slice(0, MAX_BANNERS) as string[];

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    // Replace all banners atomically
    await db.delete(banners).where(eq(banners.storeId, storeId));

    if (imageUrls.length > 0) {
      await db.insert(banners).values(
        imageUrls.map((url, i) => ({
          storeId,
          title: `Banner ${i + 1}`,
          imageUrl: url,
          position: i,
          active: true,
        }))
      );
    }

    // Limpa o campo legado bannerUrl para evitar que o fallback da vitrine
    // exiba imagens antigas quando todos os banners são removidos
    await db.update(stores)
      .set({ bannerUrl: null })
      .where(eq(stores.id, storeId));

    // Invalida cache imediatamente (await garante que o próximo fetch já vê dados frescos)
    const storeRow = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
      columns: { slug: true },
    });
    await deleteKey(
      storeCacheKey(storeId),
      ...(storeRow?.slug ? [`store:slug:${storeRow.slug}:config`] : []),
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Error saving banners:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
