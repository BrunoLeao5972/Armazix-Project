import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@/lib/db";
import { signJWT } from "@/lib/auth";
import { generateCsrfToken, createCsrfCookie } from "@/lib/middleware/csrf";
import { logAudit, AuditActions } from "@/lib/audit";

const { users, storeUsers } = schema;

interface ImpersonationClaims {
  userId: string;
  storeId: string;
  actorEmail: string;
  purpose: string;
}

async function verifyImpersonationToken(token: string, secret: string): Promise<ImpersonationClaims | null> {
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    );
    const { payload } = await jwtVerify(token, key);
    const p = payload as Record<string, unknown>;
    if (
      p.purpose !== "impersonation" ||
      typeof p.userId !== "string" ||
      typeof p.storeId !== "string" ||
      typeof p.actorEmail !== "string"
    ) return null;
    return { userId: p.userId, storeId: p.storeId, actorEmail: p.actorEmail, purpose: p.purpose };
  } catch {
    return null;
  }
}

// ─── GET /api/auth/impersonate-consume?token=... ────────────────────────────
// Troca um token curto assinado pelo Gerenciador Armazix (portal SuperAdmin,
// projeto separado) por uma sessão de admin real neste ERP. O segredo é o
// MESMO JWT_SECRET usado pra assinar as sessões normais — é o único segredo
// compartilhado entre os dois projetos, de propósito.
//
// storeId nunca é confiado cegamente do token: é sempre re-derivado de
// `storeUsers` pra este userId, exatamente como no login normal — o token só
// prova "pode vestir este userId", quem decide em qual loja é a tabela real.
export async function impersonateConsumeHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Token ausente", { status: 400 });

  const secret = process.env.JWT_SECRET;
  if (!secret) return new Response("Configuração inválida", { status: 500 });

  const claims = await verifyImpersonationToken(token, secret);
  if (!claims) return new Response("Token de impersonation inválido ou expirado", { status: 401 });

  const db = createDb(process.env.DATABASE_URL!);

  const [user] = await db.select().from(users).where(eq(users.id, claims.userId)).limit(1);
  if (!user || !user.active) return new Response("Usuário não encontrado ou inativo", { status: 404 });

  const storeUserRecord = await db.query.storeUsers.findFirst({
    where: eq(storeUsers.userId, user.id),
  });
  const storeId = storeUserRecord?.storeId;

  if (!storeId || storeId !== claims.storeId) {
    logAudit({
      userId: user.id, storeId: claims.storeId, action: AuditActions.IMPERSONATE,
      resourceType: "user", resourceId: user.id, status: "denied",
      errorMessage: "storeId do token não bate com a loja real do usuário",
      details: { actorEmail: claims.actorEmail },
    }, request);
    return new Response("Loja não corresponde ao usuário", { status: 403 });
  }

  // Sessão de suporte — vida curta de propósito (2h, contra 7d do login normal).
  const jwt = await signJWT({ userId: user.id, email: user.email, role: user.role, storeId }, secret, "2h");
  const csrfToken = generateCsrfToken();

  logAudit({
    userId: user.id, storeId, action: AuditActions.IMPERSONATE,
    resourceType: "user", resourceId: user.id, status: "success",
    details: { actorEmail: claims.actorEmail },
  }, request);

  const headers = new Headers({ location: "/admin/dashboard" });
  headers.append("set-cookie", `armazix_token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${2 * 60 * 60}`);
  headers.append("set-cookie", createCsrfCookie(csrfToken));

  return new Response(null, { status: 302, headers });
}
