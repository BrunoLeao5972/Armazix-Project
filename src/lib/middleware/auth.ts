import { verifyJWT } from "@/lib/auth";
import { createDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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
  };
}

export async function requireStoreAccess(
  request: Request,
  auth: AuthContext,
  requestedStoreId: string
): Promise<AuthContext | Response> {
  // Admin pode acessar qualquer loja
  if (auth.role === "admin") {
    return { ...auth, storeId: requestedStoreId, storeRole: "admin" };
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    // Verificar se usuário tem acesso à loja
    const access = await db.query.storeUsers.findFirst({
      where: and(
        eq(storeUsers.userId, auth.userId),
        eq(storeUsers.storeId, requestedStoreId)
      ),
    });

    if (!access) {
      return new Response(
        JSON.stringify({ error: "Sem acesso a esta loja" }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }

    return {
      ...auth,
      storeId: requestedStoreId,
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

export function getStoreIdFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  
  // Tentar obter do query param
  const fromQuery = url.searchParams.get("storeId");
  if (fromQuery) return fromQuery;
  
  // Tentar obter do body (para POST requests)
  // Isso será tratado no handler específico
  
  return null;
}
