import { generateCsrfToken, createCsrfCookie } from "@/lib/middleware/csrf";

export async function refreshCsrfHandler(_request: Request): Promise<Response> {
  const csrfToken = generateCsrfToken();

  return new Response(JSON.stringify({ csrfToken }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": createCsrfCookie(csrfToken),
    },
  });
}
