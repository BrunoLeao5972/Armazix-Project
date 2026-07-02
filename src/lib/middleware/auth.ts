import { verifyJWT } from "@/lib/auth";
import { createDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { logSecurityEvent, AuditActions } from "@/lib/audit";

const { storeUsers } = schema;

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  storeId?: string;
  storeRole?: string;
}

// ─── Isolate-level session cache ─────────────────────────────────────────────
// CF Workers are single-threaded per isolate but can handle multiple concurrent
// requests in the same V8 context. When a client fires several parallel API
// calls (e.g. dashboard load), each would re-derive the JWT independently.
// This Map caches the decoded payload for SESSION_CACHE_TTL ms, eliminating
// redundant crypto.subtle operations for rapid-fire identical tokens.
//
// Security: the cache is keyed by the full signed token string (not the payload),
// so forged or mutated tokens always produce a cache miss and go through jwtVerify.

const SESSION_CACHE_TTL = 10_000; // 10 seconds — short enough to be safe on key rotation
const _sessionCache = new Map<string, { auth: AuthContext; exp: number }>();
let   _lastPrune    = 0;

function pruneIfStale(): void {
  const now = Date.now();
  // Prune at most once per second to avoid O(n) on every request
  if (now - _lastPrune < 1_000) return;
  _lastPrune = now;
  for (const [k, v] of _sessionCache) {
    if (v.exp < now) _sessionCache.delete(k);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function requireAuth(request: Request): Promise<AuthContext | Response> {
  const cookieHeader = request.headers.get("cookie");
  const token = cookieHeader?.match(/armazix_token=([^;]+)/)?.[1];

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // ── Cache hit ──────────────────────────────────────────────────────────────
  pruneIfStale();
  const cached = _sessionCache.get(token);
  if (cached && cached.exp > Date.now()) {
    return cached.auth;
  }

  // ── Cache miss — full crypto verification ──────────────────────────────────
  const payload = await verifyJWT(token, process.env.JWT_SECRET || "dev-secret-mock");

  if (!payload) {
    _sessionCache.delete(token); // evict stale/invalid entry if any
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  const auth: AuthContext = {
    userId:  payload.userId,
    email:   payload.email,
    role:    payload.role,
    storeId: payload.storeId,
  };

  _sessionCache.set(token, { auth, exp: Date.now() + SESSION_CACHE_TTL });
  return auth;
}

export async function requireStoreAccess(
  request: Request,
  auth: AuthContext,
  requestedStoreId: string
): Promise<AuthContext | Response> {
  const jwtStoreId = auth.storeId;

  if (!jwtStoreId) {
    logSecurityEvent({
      action: AuditActions.MISSING_TENANT_CONTEXT,
      userId: auth.userId,
      handler: "requireStoreAccess (middleware)",
      request,
    });
    return new Response(
      JSON.stringify({ error: "Sem loja vinculada ao token" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  if (requestedStoreId !== jwtStoreId) {
    logSecurityEvent({
      action: AuditActions.IDOR_ATTEMPT,
      userId: auth.userId,
      jwtStoreId,
      requestedStoreId,
      handler: "requireStoreAccess (middleware)",
      request,
    });
    return new Response(
      JSON.stringify({ error: "Sem acesso a esta loja" }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  if (process.env.NODE_ENV === "development" && auth.userId === "mock-user-001" && jwtStoreId === "mock-store-001") {
    return { ...auth, storeId: jwtStoreId, storeRole: "owner" };
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    if (auth.role === "admin") {
      return { ...auth, storeId: jwtStoreId, storeRole: "admin" };
    }

    const access = await db.query.storeUsers.findFirst({
      where: and(
        eq(storeUsers.userId, auth.userId),
        eq(storeUsers.storeId, jwtStoreId)
      ),
    });

    if (!access) {
      logSecurityEvent({
        action: AuditActions.CROSS_TENANT_BLOCKED,
        userId: auth.userId,
        jwtStoreId,
        handler: "requireStoreAccess (DB check)",
        request,
      });
      return new Response(
        JSON.stringify({ error: "Sem acesso a esta loja" }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }

    return { ...auth, storeId: jwtStoreId, storeRole: access.role };
  } catch (error) {
    console.error("Store access check error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao verificar acesso" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

export function getStoreIdFromRequest(_request: Request): string | null {
  // SECURITY: storeId must come from the JWT — never from the request URL or body.
  return null;
}
