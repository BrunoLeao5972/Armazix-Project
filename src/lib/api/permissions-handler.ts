import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireStoreOwner } from "@/lib/auth/require-store-access";
import { SYSTEM_ROLES, SYSTEM_ROLE_DEFAULTS, ALL_PERMISSION_KEYS } from "@/lib/permissions";
import type { AuthContext } from "@/lib/middleware/auth";

const { roleProfiles } = schema;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

// ─── GET /api/role-profiles/list ─────────────────────────────────────────────
// Returns all profiles for the store. Auto-seeds system roles on first call.
export async function listRoleProfilesHandler(
  _request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const db = createDb(process.env.DATABASE_URL!);

  const existing = await db
    .select()
    .from(roleProfiles)
    .where(eq(roleProfiles.storeId, storeAccess.storeId));

  // Seed missing system roles
  const existingSlugs = new Set(existing.map(p => p.slug));
  const toInsert = SYSTEM_ROLES.filter(r => !existingSlugs.has(r.slug));

  if (toInsert.length > 0) {
    await db.insert(roleProfiles).values(
      toInsert.map(r => ({
        storeId:     storeAccess.storeId,
        name:        r.name,
        slug:        r.slug,
        isSystem:    true,
        permissions: SYSTEM_ROLE_DEFAULTS[r.slug] ?? {},
      })),
    );
    // Re-fetch after seed
    const all = await db
      .select()
      .from(roleProfiles)
      .where(eq(roleProfiles.storeId, storeAccess.storeId));
    return json({ profiles: all });
  }

  return json({ profiles: existing });
}

// ─── POST /api/role-profiles/save ────────────────────────────────────────────
// Updates the permissions object of a profile.
export async function saveRoleProfileHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    profileId?:  string;
    permissions?: Record<string, boolean>;
  };

  if (!body.profileId || !body.permissions) {
    return json({ error: "profileId e permissions são obrigatórios" }, 400);
  }

  // Validate permission keys (only known keys allowed)
  const sanitized: Record<string, boolean> = {};
  for (const key of ALL_PERMISSION_KEYS) {
    sanitized[key] = body.permissions[key] === true;
  }

  const db = createDb(process.env.DATABASE_URL!);

  // Verify the profile belongs to this store
  const [profile] = await db
    .select({ id: roleProfiles.id, storeId: roleProfiles.storeId })
    .from(roleProfiles)
    .where(and(
      eq(roleProfiles.id, body.profileId),
      eq(roleProfiles.storeId, storeAccess.storeId),
    ))
    .limit(1);

  if (!profile) {
    return json({ error: "Perfil não encontrado" }, 404);
  }

  await db
    .update(roleProfiles)
    .set({ permissions: sanitized, updatedAt: new Date() })
    .where(eq(roleProfiles.id, body.profileId));

  return json({ success: true });
}

// ─── POST /api/role-profiles/create ──────────────────────────────────────────
export async function createRoleProfileHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return json({ error: "Nome do perfil é obrigatório" }, 400);
  }

  // Reject system role names
  const systemNames = SYSTEM_ROLES.map(r => r.name.toLowerCase());
  if (systemNames.includes(name.toLowerCase())) {
    return json({ error: "Este nome é reservado para perfis do sistema" }, 409);
  }

  const slug = slugify(name);

  const db = createDb(process.env.DATABASE_URL!);

  // Check slug uniqueness within store
  const [existing] = await db
    .select({ id: roleProfiles.id })
    .from(roleProfiles)
    .where(and(
      eq(roleProfiles.storeId, storeAccess.storeId),
      eq(roleProfiles.slug, slug),
    ))
    .limit(1);

  if (existing) {
    return json({ error: "Já existe um perfil com nome similar" }, 409);
  }

  // Start with all permissions false for custom roles
  const defaultPerms: Record<string, boolean> = {};
  for (const key of ALL_PERMISSION_KEYS) defaultPerms[key] = false;

  const [created] = await db
    .insert(roleProfiles)
    .values({
      storeId:     storeAccess.storeId,
      name,
      slug,
      isSystem:    false,
      permissions: defaultPerms,
    })
    .returning();

  return json({ success: true, profile: created });
}

// ─── POST /api/role-profiles/delete ──────────────────────────────────────────
export async function deleteRoleProfileHandler(
  request: Request,
  auth?: AuthContext,
): Promise<Response> {
  let storeAccess: { storeId: string; userId: string };
  try {
    storeAccess = await requireStoreOwner(auth);
  } catch (e) {
    return json({ error: (e as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as { profileId?: string };

  if (!body.profileId) {
    return json({ error: "profileId é obrigatório" }, 400);
  }

  const db = createDb(process.env.DATABASE_URL!);

  const [profile] = await db
    .select({ id: roleProfiles.id, isSystem: roleProfiles.isSystem, storeId: roleProfiles.storeId })
    .from(roleProfiles)
    .where(and(
      eq(roleProfiles.id, body.profileId),
      eq(roleProfiles.storeId, storeAccess.storeId),
    ))
    .limit(1);

  if (!profile) {
    return json({ error: "Perfil não encontrado" }, 404);
  }

  if (profile.isSystem) {
    return json({ error: "Perfis predefinidos do sistema não podem ser excluídos" }, 403);
  }

  await db
    .delete(roleProfiles)
    .where(eq(roleProfiles.id, body.profileId));

  return json({ success: true });
}
