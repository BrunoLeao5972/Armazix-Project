// Security headers para proteção contra ataques comuns

export function withSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  
  // Content Security Policy - previne XSS
  newHeaders.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.mercadopago.com https://api.mercadopago.com https://viacep.com.br",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
  
  // X-Frame-Options - previne clickjacking
  newHeaders.set("X-Frame-Options", "DENY");
  
  // X-Content-Type-Options - previne MIME sniffing
  newHeaders.set("X-Content-Type-Options", "nosniff");
  
  // Referrer-Policy - limita informação de referrer
  newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions-Policy - limita funcionalidades do browser
  newHeaders.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self)"
  );
  
  // Strict-Transport-Security - força HTTPS
  newHeaders.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // X-XSS-Protection (legado, mas ainda útil)
  newHeaders.set("X-XSS-Protection", "1; mode=block");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
