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

export async function requireAuth(request: Request): Promise<AuthContext | Response> {
  // Extrair token do cookie HttpOnly
  const cookieHeader = request.headers.get("cookie");
  const token = cookieHeader?.match(/armazix_token=([^;]+)/)?.[1];

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  const payload = await verifyJWT(token, process.env.JWT_SECRET!);
  
  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    storeId: payload.storeId, // From JWT — never from request
  };
}

export async function requireStoreAccess(
  request: Request,
  auth: AuthContext,
  requestedStoreId: string
): Promise<AuthContext | Response> {
  // SECURITY: requestedStoreId must ALWAYS equal auth.storeId (from JWT).
  // Never allow the frontend to switch tenants via query/body.
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

  // If a requestedStoreId was provided (legacy path), it must match the JWT storeId.
  // This prevents horizontal privilege escalation even if callers pass storeId from the request.
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

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    // Admin can access any store — but storeId must still be in JWT
    if (auth.role === "admin") {
      return { ...auth, storeId: jwtStoreId, storeRole: "admin" };
    }

    // Verify user has explicit DB-level access to this store
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

    return {
      ...auth,
      storeId: jwtStoreId,
      storeRole: access.role,
    };
  } catch (error) {
    console.error("Store access check error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao verificar acesso" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

export function getStoreIdFromRequest(_request: Request): string | null {
  // SECURITY: Do NOT read storeId from the request URL or body.
  // storeId must come from the JWT (auth.storeId set by requireAuth).
  // This function is intentionally a no-op to enforce the JWT-as-truth rule.
  return null;
}
