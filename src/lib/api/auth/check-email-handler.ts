import { createDb } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth";

export async function checkEmailHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Email inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  const existing = await findUserByEmail(db, email);

  return new Response(JSON.stringify({ available: !existing }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
