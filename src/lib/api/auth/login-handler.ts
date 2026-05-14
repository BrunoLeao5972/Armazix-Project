import { createDb, schema } from "@/lib/db";
import { findUserByEmail, verifyPassword, signJWT } from "@/lib/auth";
import { generateCsrfToken, createCsrfCookie } from "@/lib/middleware/csrf";
import { logAudit, AuditActions } from "@/lib/audit";
import { eq } from "drizzle-orm";

const { storeUsers } = schema;

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
  const secret = process.env.JWT_SECRET!;
  const token = await signJWT(
    { userId: user.id, email: user.email, role: user.role, storeId },
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

  return new Response(JSON.stringify({
    success: true,
    token,
    csrfToken, // Frontend precisa enviar isso no header x-csrf-token
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": [
        `armazix_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
        createCsrfCookie(csrfToken),
      ].join(", "),
    },
  });
}
