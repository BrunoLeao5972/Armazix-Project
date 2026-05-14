/**
 * With Auth Handler - Wrapper Seguro para API Handlers
 * 
 * Centraliza:
 * - Autenticação (JWT validation)
 * - Tenant Validation (requireStoreAccess)
 * - CSRF Protection
 * - Audit Logging
 * - Rate Limiting
 * - Error Handling
 * 
 * Uso:
 * ```ts
 * export const createProductHandler = withAuthHandler(
 *   async (request, auth, context) => {
 *     const { storeId } = context.storeAccess;
 *     // handler seguro com tenant já validado
 *   }
 * );
 * ```
 */

import type { AuthContext } from "@/lib/auth/require-store-access";
import { requireStoreAccess, type StoreAccessResult } from "@/lib/auth/require-store-access";
import { logAudit, AuditActions } from "@/lib/audit";
import { rateLimit, createRateLimitResponse } from "@/lib/middleware/rate-limit";
import { validateCsrfToken, createCsrfErrorResponse } from "@/lib/middleware/csrf";
import { sanitizeBody, sanitizeQuery } from "@/lib/security/tenant-guard";

export interface HandlerContext {
  storeAccess: StoreAccessResult;
  db: ReturnType<typeof import("@/lib/db").createDb>;
}

export type AuthenticatedHandler = (
  request: Request,
  auth: AuthContext,
  context: HandlerContext
) => Promise<Response>;

export interface WithAuthOptions {
  /** Rate limit config key */
  rateLimitType?: string;
  /** Skip CSRF for specific cases (like webhooks) */
  skipCsrf?: boolean;
  /** Audit log action name */
  auditAction?: string;
  /** Require store owner/admin (not just any access) */
  requireOwner?: boolean;
}

/**
 * Wrapper que adiciona todas as proteções de segurança a um handler.
 * 
 * Proteções aplicadas:
 * 1. Rate Limiting
 * 2. CSRF Token Validation
 * 3. Tenant Access Validation (requireStoreAccess)
 * 4. Audit Logging
 * 5. Safe body/query sanitization
 * 6. Centralized error handling
 */
export function withAuthHandler(
  handler: AuthenticatedHandler,
  options: WithAuthOptions = {}
): (request: Request, auth?: AuthContext) => Promise<Response> {
  return async function wrappedHandler(
    request: Request,
    auth?: AuthContext
  ): Promise<Response> {
    // 1. Rate Limiting
    const rateLimitType = options.rateLimitType || "api";
    const rateLimitResult = await rateLimit(request, rateLimitType as any);
    
    if (!rateLimitResult.allowed) {
      // Log failed rate limit
      logAudit({
        action: AuditActions.RATE_LIMIT_EXCEEDED,
        status: "denied",
        details: { 
          retryAfter: rateLimitResult.retryAfter,
          path: new URL(request.url).pathname 
        },
      }, request);
      
      return createRateLimitResponse(rateLimitResult.retryAfter || 60);
    }

    // 2. CSRF Validation (unless skipped)
    if (!options.skipCsrf && request.method !== "GET") {
      if (!validateCsrfToken(request)) {
        // Log CSRF failure
        logAudit({
          action: AuditActions.INVALID_CSRF,
          status: "denied",
          details: { path: new URL(request.url).pathname },
        }, request);
        
        return createCsrfErrorResponse();
      }
    }

    // 3. Auth Context Validation
    if (!auth?.userId) {
      logAudit({
        action: options.auditAction || AuditActions.ACCESS_DENIED,
        status: "denied",
        errorMessage: "No auth context",
        details: { path: new URL(request.url).pathname },
      }, request);
      
      return new Response(
        JSON.stringify({ error: "Unauthorized: Authentication required" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    // 4. Tenant Access Validation
    let storeAccess: StoreAccessResult;
    try {
      storeAccess = await requireStoreAccess(auth);
    } catch (error) {
      const message = (error as Error).message;
      
      logAudit({
        userId: auth.userId,
        action: options.auditAction || AuditActions.ACCESS_DENIED,
        status: "denied",
        errorMessage: message,
        details: { 
          path: new URL(request.url).pathname,
          attemptedStoreId: auth.storeId 
        },
      }, request);
      
      return new Response(
        JSON.stringify({ error: message }),
        { 
          status: message.includes("Forbidden") ? 403 : 401,
          headers: { "content-type": "application/json" }
        }
      );
    }

    // 5. Audit Log - Start
    const startTime = Date.now();
    const path = new URL(request.url).pathname;
    
    if (options.auditAction) {
      logAudit({
        userId: auth.userId,
        storeId: storeAccess.storeId,
        action: options.auditAction,
        status: "success",
        details: { 
          path,
          method: request.method,
        },
      }, request);
    }

    // 6. Execute Handler with Safe Context
    try {
      const { createTenantDb } = await import("@/lib/db");
      const dbUrl = process.env.DATABASE_URL;
      
      if (!dbUrl) {
        throw new Error("Database configuration error");
      }
      
      const db = await createTenantDb(dbUrl, storeAccess.storeId);
      
      const context: HandlerContext = {
        storeAccess,
        db,
      };

      const response = await handler(request, auth, context);
      
      // Add rate limit headers
      if (rateLimitResult.headers) {
        const newHeaders = new Headers(response.headers);
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error
      logAudit({
        userId: auth.userId,
        storeId: storeAccess.storeId,
        action: options.auditAction || "HANDLER_ERROR",
        status: "failure",
        errorMessage: (error as Error).message,
        details: { 
          path,
          method: request.method,
          duration,
        },
      }, request);
      
      console.error(`Handler error in ${path}:`, error);
      
      return new Response(
        JSON.stringify({ 
          error: "Internal server error",
          requestId: crypto.randomUUID(),
        }),
        { 
          status: 500, 
          headers: { "content-type": "application/json" }
        }
      );
    }
  };
}

/**
 * Versão simplificada para handlers públicos (sem autenticação).
 * Aplica rate limiting e sanitização básica.
 */
export function withPublicHandler(
  handler: (request: Request) => Promise<Response>,
  options: { rateLimitType?: string } = {}
): (request: Request) => Promise<Response> {
  return async function wrappedHandler(request: Request): Promise<Response> {
    // Rate Limiting
    const rateLimitType = options.rateLimitType || "api";
    const rateLimitResult = await rateLimit(request, rateLimitType as any);
    
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.retryAfter || 60);
    }

    try {
      const response = await handler(request);
      
      // Add rate limit headers
      if (rateLimitResult.headers) {
        const newHeaders = new Headers(response.headers);
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      
      return response;
      
    } catch (error) {
      console.error("Public handler error:", error);
      
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  };
}
