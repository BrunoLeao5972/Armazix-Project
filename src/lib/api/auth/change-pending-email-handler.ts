import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, ne } from "drizzle-orm";
import { createVerificationCode } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth/email";
import type { AuthContext } from "@/lib/middleware/auth";

const { users } = schema;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── POST /api/auth/change-pending-email ─────────────────────────
// Corrige o email de uma conta recém-criada e ainda não verificada (ex:
// erro de digitação no cadastro), reenviando o código pra o endereço novo.
// Protegida pelo cookie de sessão que o registro já deixa gravado — depois
// que o email é verificado, a troca passa a ser outro fluxo (Configurações).
export async function changePendingEmailHandler(request: Request, auth?: AuthContext): Promise<Response> {
  if (!auth?.userId) {
    return json({ error: "Não autenticado" }, 401);
  }

  const body = await request.json() as { newEmail?: string };
  const trimmed = body.newEmail?.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return json({ error: "Email inválido" }, 400);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const [current] = await db
      .select({ id: users.id, name: users.name, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (!current) return json({ error: "Usuário não encontrado" }, 404);
    if (current.emailVerified) {
      return json({ error: "Email já verificado. Para alterar, use Configurações da conta." }, 400);
    }

    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, trimmed), ne(users.id, auth.userId)))
      .limit(1);
    if (taken) return json({ error: "Este email já está em uso" }, 409);

    await db.update(users).set({ email: trimmed }).where(eq(users.id, auth.userId));

    const code = await createVerificationCode(db, auth.userId, "email_verification");
    try {
      await sendVerificationEmail(trimmed, code, current.name);
    } catch (emailError) {
      console.error("Failed to send verification email after change:", emailError);
    }

    return json({ success: true, email: trimmed });
  } catch (err) {
    console.error("[change-pending-email]", err);
    return json({ error: "Internal server error" }, 500);
  }
}
