import { createDb } from "@/lib/db";
import { validateVerificationCode, hashPassword } from "@/lib/auth";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const { users } = schema;

export async function resetPasswordHandler(request: Request): Promise<Response> {
  const { code, newPassword } = await request.json() as { code: string; newPassword: string };

  if (!code || code.length !== 6) {
    return new Response(JSON.stringify({ error: "Código inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!newPassword || newPassword.length < 8) {
    return new Response(JSON.stringify({ error: "A senha deve ter no mínimo 8 caracteres" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const result = await validateVerificationCode(db, code, "password_reset");

  if (!result.valid || !result.userId) {
    return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Update password
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, result.userId));

  return new Response(JSON.stringify({
    success: true,
    message: "Senha alterada com sucesso!",
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
