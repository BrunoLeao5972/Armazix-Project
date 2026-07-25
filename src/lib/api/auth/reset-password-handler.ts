import { createDb } from "@/lib/db";
import { validateVerificationCode, hashPassword, findUserByEmail, validatePasswordPolicy } from "@/lib/auth";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { logAudit, AuditActions } from "@/lib/audit";

const { users } = schema;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function resetPasswordHandler(request: Request): Promise<Response> {
  const { email, code, newPassword } = await request.json() as {
    email: string; code: string; newPassword: string;
  };

  // O e-mail é obrigatório: sem ele o código seria buscado na plataforma
  // inteira, e acertar qualquer código ativo daria acesso à conta do dono dele.
  if (!email?.trim()) {
    return json({ error: "E-mail é obrigatório" }, 400);
  }

  if (!code || code.length !== 6) {
    return json({ error: "Código inválido" }, 400);
  }

  const pwCheck = validatePasswordPolicy(newPassword ?? "");
  if (!pwCheck.valid) {
    return json({ error: pwCheck.errors[0] ?? "Senha inválida" }, 400);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const user = await findUserByEmail(db, email.trim().toLowerCase());

  // Resposta idêntica para e-mail inexistente e código errado — não revela
  // quais contas existem nem se há um código pendente.
  const invalido = () => json({ error: "Código inválido ou expirado" }, 400);

  if (!user) return invalido();

  const result = await validateVerificationCode(db, user.id, code, "password_reset");
  if (!result.valid) {
    logAudit({
      userId:       user.id,
      action:       AuditActions.PASSWORD_RESET,
      resourceType: "user",
      resourceId:   user.id,
      status:       "failure",
      errorMessage: "Código inválido, expirado ou tentativas esgotadas",
    }, request);
    return invalido();
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  logAudit({
    userId:       user.id,
    action:       AuditActions.PASSWORD_RESET,
    resourceType: "user",
    resourceId:   user.id,
    status:       "success",
  }, request);

  return json({ success: true, message: "Senha alterada com sucesso!" }, 200);
}
