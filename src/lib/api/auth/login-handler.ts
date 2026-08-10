import { createDb, schema } from "@/lib/db";
import { findUserByEmail, verifyPassword, signJWT } from "@/lib/auth";
import { generateCsrfToken, createCsrfCookie } from "@/lib/middleware/csrf";
import { logAudit, AuditActions } from "@/lib/audit";
import { requireJwtSecret } from "@/lib/env";
import { eq } from "drizzle-orm";

const { storeUsers, stores } = schema;

export async function loginHandler(request: Request): Promise<Response> {
  const { email, password } = await request.json() as { email: string; password: string };

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const user = await findUserByEmail(db, email);

  if (!user) {
    logAudit({
      action: AuditActions.LOGIN,
      resourceType: "user",
      status: "failure",
      errorMessage: "Invalid email",
      details: { email },
    }, request);
    return new Response(JSON.stringify({ error: "Email ou senha incorretos" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    logAudit({
      userId: user.id,
      action: AuditActions.LOGIN,
      resourceType: "user",
      resourceId: user.id,
      status: "failure",
      errorMessage: "Invalid password",
    }, request);
    return new Response(JSON.stringify({ error: "Email ou senha incorretos" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  if (!user.emailVerified) {
    return new Response(JSON.stringify({
      error: "Email não verificado",
      needsVerification: true,
      email: user.email,
    }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  if (!user.active) {
    return new Response(JSON.stringify({ error: "Conta desativada" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  // Look up user's storeId — JWT is the single source of truth for tenant
  const storeUserRecord = await db.query.storeUsers.findFirst({
    where: eq(storeUsers.userId, user.id),
  });
  const storeId = storeUserRecord?.storeId;

  // Sign JWT with storeId embedded — NEVER read storeId from request
  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch {
    console.error("[login] JWT_SECRET ausente — recusando emitir sessão");
    return new Response(JSON.stringify({ error: "Erro de configuração do servidor" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const token = await signJWT(
    { userId: user.id, email: user.email, role: user.role, storeId, sessionVersion: user.sessionVersion },
    secret,
  );

  // Generate CSRF token
  const csrfToken = generateCsrfToken();

  // Audit log for successful login
  logAudit({
    userId: user.id,
    action: AuditActions.LOGIN,
    resourceType: "user",
    resourceId: user.id,
    status: "success",
  }, request);

  const responseHeaders = new Headers({ "content-type": "application/json" });
  responseHeaders.append("set-cookie", `armazix_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);
  responseHeaders.append("set-cookie", createCsrfCookie(csrfToken));

  return new Response(JSON.stringify({
    success: true,
    csrfToken, // Frontend precisa enviar isso no header x-csrf-token
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }), {
    status: 200,
    headers: responseHeaders,
  });
}

// ─── Login do app desktop (Armazix PDV) ───────────────────────────
// Mesma validação de credenciais do login web, mas devolve o JWT no corpo
// em vez de um cookie — o Electron não é o mesmo "site" de armazix.com.br,
// então um cookie SameSite=Strict nunca voltaria nas próximas chamadas.
// O app guarda esse token e manda em "Authorization: Bearer" — sem
// Set-Cookie nenhum aqui de propósito.
//
// SECURITY: nunca reaproveitar esse endpoint num contexto de navegador.
// Token no corpo da resposta é legível por qualquer script da página —
// é exatamente o que o cookie HttpOnly do login web evita. Só é seguro
// porque o único consumidor é o processo renderer do Electron, que guarda
// o token fora do alcance de scripts de terceiros.
export async function loginDesktopHandler(request: Request): Promise<Response> {
  const { email, password } = await request.json() as { email: string; password: string };

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const user = await findUserByEmail(db, email);

  if (!user) {
    logAudit({
      action: AuditActions.LOGIN,
      resourceType: "user",
      status: "failure",
      errorMessage: "Invalid email (desktop)",
      details: { email },
    }, request);
    return new Response(JSON.stringify({ error: "Email ou senha incorretos" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    logAudit({
      userId: user.id,
      action: AuditActions.LOGIN,
      resourceType: "user",
      resourceId: user.id,
      status: "failure",
      errorMessage: "Invalid password (desktop)",
    }, request);
    return new Response(JSON.stringify({ error: "Email ou senha incorretos" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  if (!user.emailVerified) {
    return new Response(JSON.stringify({
      error: "Email não verificado",
      needsVerification: true,
      email: user.email,
    }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  if (!user.active) {
    return new Response(JSON.stringify({ error: "Conta desativada" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const storeUserRecord = await db.query.storeUsers.findFirst({
    where: eq(storeUsers.userId, user.id),
  });
  const storeId = storeUserRecord?.storeId;
  if (!storeId) {
    return new Response(JSON.stringify({ error: "Usuário sem loja vinculada" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const [store] = await db
    .select({ id: stores.id, name: stores.name, slug: stores.slug })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch {
    console.error("[login-desktop] JWT_SECRET ausente — recusando emitir sessão");
    return new Response(JSON.stringify({ error: "Erro de configuração do servidor" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const token = await signJWT(
    { userId: user.id, email: user.email, role: user.role, storeId, sessionVersion: user.sessionVersion },
    secret,
  );

  logAudit({
    userId: user.id,
    action: AuditActions.LOGIN,
    resourceType: "user",
    resourceId: user.id,
    status: "success",
    details: { client: "desktop" },
  }, request);

  return new Response(JSON.stringify({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    store: store ? { id: store.id, name: store.name, slug: store.slug } : null,
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
