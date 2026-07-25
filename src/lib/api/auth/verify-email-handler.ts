import { createDb } from "@/lib/db";
import { validateVerificationCode, findUserByEmail } from "@/lib/auth";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const { users } = schema;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function verifyEmailHandler(request: Request): Promise<Response> {
  const { email, code } = await request.json() as { email: string; code: string };

  // Mesmo motivo do reset: sem o e-mail, o código seria procurado em toda a
  // plataforma e verificaria a conta de outra pessoa.
  if (!email?.trim()) {
    return json({ error: "E-mail é obrigatório" }, 400);
  }

  if (!code || code.length !== 6) {
    return json({ error: "Código inválido" }, 400);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const user = await findUserByEmail(db, email.trim().toLowerCase());
  const invalido = () => json({ error: "Código inválido ou expirado" }, 400);

  if (!user) return invalido();

  const result = await validateVerificationCode(db, user.id, code, "email_verification");
  if (!result.valid) return invalido();

  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, user.id));

  return json({ success: true, message: "Email verificado com sucesso!" }, 200);
}
