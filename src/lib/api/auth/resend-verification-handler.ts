import { createDb } from "@/lib/db";
import { findUserByEmail, createVerificationCode } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth/email";

export async function resendVerificationHandler(request: Request): Promise<Response> {
  const { email } = await request.json() as { email: string };

  if (!email) {
    return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const user = await findUserByEmail(db, email);

  if (!user || user.emailVerified) {
    return new Response(JSON.stringify({ success: true, message: "Código reenviado" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const code = await createVerificationCode(db, user.id, "email_verification");

  try {
    await sendVerificationEmail(email, code, user.name);
  } catch (emailError) {
    console.error("Failed to resend verification email:", emailError);
  }

  return new Response(JSON.stringify({ success: true, message: "Código reenviado" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
