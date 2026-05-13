import { createDb } from "@/lib/db";
import { findUserByEmail, createVerificationCode } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/auth/email";

export async function forgotPasswordHandler(request: Request): Promise<Response> {
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

  // Always return success to prevent email enumeration
  if (!user) {
    return new Response(JSON.stringify({
      success: true,
      message: "Se o email existir, enviaremos o código de recuperação.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Generate reset code
  const code = await createVerificationCode(db, user.id, "password_reset");

  // Send email
  try {
    await sendPasswordResetEmail(email, code, user.name);
  } catch (emailError) {
    console.error("Failed to send reset email:", emailError);
  }

  return new Response(JSON.stringify({
    success: true,
    message: "Se o email existir, enviaremos o código de recuperação.",
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
