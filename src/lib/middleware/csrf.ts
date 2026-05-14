// CSRF Protection middleware
// Gera e valida tokens CSRF para proteger contra ataques CSRF

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// Gerar token CSRF aleatório
export function generateCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CSRF_TOKEN_LENGTH));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

// Extrair CSRF token do cookie
export function getCsrfTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  
  const match = cookieHeader.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  return match?.[1] || null;
}

// Extrair CSRF token do header
export function getCsrfTokenFromHeader(request: Request): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

// Validar token CSRF
export function validateCsrfToken(request: Request): boolean {
  // GET, HEAD, OPTIONS não precisam de CSRF
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(request.method)) {
    return true;
  }

  const cookieToken = getCsrfTokenFromCookie(request);
  const headerToken = getCsrfTokenFromHeader(request);

  // Ambos devem estar presentes e iguais
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Timing-safe comparison
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }

  return result === 0;
}

// Criar resposta de erro CSRF
export function createCsrfErrorResponse(): Response {
  return new Response(
    JSON.stringify({ error: "CSRF token inválido ou ausente" }),
    {
      status: 403,
      headers: { "content-type": "application/json" },
    }
  );
}

// Criar cookie CSRF
export function createCsrfCookie(token: string): string {
  const maxAge = 24 * 60 * 60; // 24 horas
  return `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
