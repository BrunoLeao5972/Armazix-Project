import { createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireStoreAccess, AuthContext } from "@/lib/auth/require-store-access";

const { banners } = schema;

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
