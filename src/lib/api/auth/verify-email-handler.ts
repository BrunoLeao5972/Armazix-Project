import { createDb } from "@/lib/db";
import { validateVerificationCode } from "@/lib/auth";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const { users } = schema;

export async function verifyEmailHandler(request: Request): Promise<Response> {
  const { code } = await request.json() as { code: string };

  if (!code || code.length !== 6) {
    return new Response(JSON.stringify({ error: "Código inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const result = await validateVerificationCode(db, code, "email_verification");

  if (!result.valid || !result.userId) {
    return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, result.userId));

  return new Response(JSON.stringify({
    success: true,
    message: "Email verificado com sucesso!",
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
