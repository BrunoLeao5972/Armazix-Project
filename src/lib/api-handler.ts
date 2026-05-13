import { registerHandler } from "./api/auth/register-handler";
import { verifyEmailHandler } from "./api/auth/verify-email-handler";
import { loginHandler } from "./api/auth/login-handler";
import { forgotPasswordHandler } from "./api/auth/forgot-password-handler";
import { resetPasswordHandler } from "./api/auth/reset-password-handler";
import { resendVerificationHandler } from "./api/auth/resend-verification-handler";

type ApiHandler = (request: Request) => Promise<Response>;

const routes: Record<string, ApiHandler> = {
  "/api/auth/register": registerHandler,
  "/api/auth/verify-email": verifyEmailHandler,
  "/api/auth/login": loginHandler,
  "/api/auth/forgot-password": forgotPasswordHandler,
  "/api/auth/reset-password": resetPasswordHandler,
  "/api/auth/resend-verification": resendVerificationHandler,
};

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const handler = routes[url.pathname];

  if (!handler) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    return await handler(request);
  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
