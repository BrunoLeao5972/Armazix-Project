import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleApiRequest } from "./lib/api-handler";
import { isCleanSlug } from "./lib/slug";

// ============================================================================
// SECURITY HEADERS
// ============================================================================
const SECURITY_HEADERS = {
  // Content Security Policy - Strict
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for React
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' https: data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.mercadopago.com https://*.workers.dev",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // Prevent MIME sniffing
  "X-Content-Type-Options": "nosniff",
  // XSS Protection
  "X-XSS-Protection": "1; mode=block",
  // Referrer Policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Permissions Policy
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  // HSTS - Force HTTPS (2 years)
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Certificate Transparency
  "Expect-CT": "max-age=86400, enforce",
  // Remove server identification
  "X-Powered-By": "",
};

// Add security headers to any response
function addSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  
  // Add all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value) newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// ============================================================================
// SUBDOMAIN RESOLVER
// Detects loja slug from subdomain: slug.armazix.com.br
// Injects x-store-slug header so store routes can resolve the tenant.
// ============================================================================
const MAIN_DOMAINS = ["armazix.com.br", "armazix.workers.dev", "localhost"];

function extractStoreSlug(hostname: string): string | null {
  for (const domain of MAIN_DOMAINS) {
    if (hostname === domain) return null;
    if (hostname.endsWith(`.${domain}`)) {
      const sub = hostname.slice(0, hostname.length - domain.length - 1).toLowerCase();
      // Only single-level clean subdomains (no www, no nested, no hyphens)
      if (sub && !sub.includes(".") && sub !== "www" && sub !== "api" && isCleanSlug(sub)) {
        return sub;
      }
    }
  }
  return null;
}

const IS_DEV = import.meta.env.DEV;

const SECURITY_TXT = [
  "Contact: mailto:security@armazix.com.br",
  "Preferred-Languages: pt-BR, en",
  "Canonical: https://armazix.com.br/.well-known/security.txt",
  "Policy: https://armazix.com.br/privacy",
  "",
].join("\n");

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    if (!IS_DEV && url.protocol === "http:") {
      url.protocol = "https:";
      return addSecurityHeaders(
        Response.redirect(url.toString(), 301),
      );
    }

    if (url.pathname === "/.well-known/security.txt" || url.pathname === "/security.txt") {
      return addSecurityHeaders(
        new Response(SECURITY_TXT, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        }),
      );
    }

    // Intercept API routes before TanStack Start
    if (url.pathname.startsWith("/api/")) {
      const response = await handleApiRequest(request);
      return IS_DEV ? response : addSecurityHeaders(response);
    }

    // Detect subdomain slug and rewrite to /store if needed
    const storeSlug = extractStoreSlug(url.hostname);
    let resolvedRequest = request;

    if (storeSlug) {
      // Rewrite URL to /store/* preserving the path
      const newPath = url.pathname === "/" ? "/store" : `/store${url.pathname === "/store" ? "" : url.pathname}`;
      const newUrl = new URL(newPath + url.search, url.origin);
      const headers = new Headers(request.headers);
      headers.set("x-store-slug", storeSlug);
      resolvedRequest = new Request(newUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: request.redirect,
      });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(resolvedRequest, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response);
      return IS_DEV ? normalizedResponse : addSecurityHeaders(normalizedResponse);
    } catch (error) {
      console.error(error);
      return IS_DEV ? brandedErrorResponse() : addSecurityHeaders(brandedErrorResponse());
    }
  },
};
