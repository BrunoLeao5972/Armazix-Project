import { signJWT } from "@/lib/auth";
import { generateCsrfToken, createCsrfCookie } from "@/lib/middleware/csrf";

const MOCK_USER = {
  id: "mock-user-001",
  name: "Bruno (Dev)",
  email: "dev@armazix.com",
  password: "dev123",
  role: "owner",
  storeId: "mock-store-001",
};

export async function mockLoginHandler(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.json() as { password?: string };

  if (body.password !== MOCK_USER.password) {
    return new Response(JSON.stringify({ error: "Senha incorreta" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const secret = process.env.JWT_SECRET || "dev-secret-mock";
  const token = await signJWT(
    { userId: MOCK_USER.id, email: MOCK_USER.email, role: MOCK_USER.role, storeId: MOCK_USER.storeId },
    secret,
  );

  const csrfToken = generateCsrfToken();

  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", `armazix_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
  headers.append("set-cookie", createCsrfCookie(csrfToken));

  return new Response(JSON.stringify({
    success: true,
    csrfToken,
    user: { id: MOCK_USER.id, name: MOCK_USER.name, email: MOCK_USER.email, role: MOCK_USER.role },
    storeId: MOCK_USER.storeId,
  }), { status: 200, headers });
}
