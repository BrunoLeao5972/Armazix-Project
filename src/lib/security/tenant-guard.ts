/**
 * Tenant Guard - Proteção Anti-Regressão
 * 
 * Este módulo fornece proteções contra regressão de segurança
 * no isolamento multi-tenant. Ele detecta e bloqueia tentativas
 * de usar storeId de fontes não confiáveis.
 * 
 * REGRA DE OURO: NUNCA confiar em storeId vindo do frontend
 * - body.storeId ❌
 * - query.storeId ❌
 * - params.storeId ❌
 * - localStorage ❌
 * 
 * SEMPRE usar: auth.storeId ✅ (do JWT token)
 */

import type { AuthContext } from "@/lib/auth/require-store-access";

export interface UntrustedSources {
  body?: Record<string, unknown>;
  query?: Record<string, string | null>;
  params?: Record<string, string>;
}

export interface GuardResult {
  safe: boolean;
  violations: string[];
  untrustedStoreId?: string;
}

/**
 * Verifica se há tentativas de IDOR via storeId em fontes não confiáveis.
 * Use em handlers que recebem auth para garantir que nenhum storeId
 * malicioso está sendo ignorado.
 */
export function detectIdorAttempt(
  auth: AuthContext,
  sources: UntrustedSources
): GuardResult {
  const violations: string[] = [];
  let untrustedStoreId: string | undefined;

  // Check body.storeId
  if (sources.body?.storeId && typeof sources.body.storeId === "string") {
    if (sources.body.storeId !== auth.storeId) {
      violations.push(`body.storeId (${sources.body.storeId}) !== auth.storeId (${auth.storeId})`);
      untrustedStoreId = sources.body.storeId;
    }
  }

  // Check query.storeId
  if (sources.query?.storeId && sources.query.storeId !== auth.storeId) {
    violations.push(`query.storeId (${sources.query.storeId}) !== auth.storeId (${auth.storeId})`);
    untrustedStoreId = sources.query.storeId;
  }

  // Check params.storeId
  if (sources.params?.storeId && sources.params.storeId !== auth.storeId) {
    violations.push(`params.storeId (${sources.params.storeId}) !== auth.storeId (${auth.storeId})`);
    untrustedStoreId = sources.params.storeId;
  }

  return {
    safe: violations.length === 0,
    violations,
    untrustedStoreId,
  };
}

/**
 * Middleware de proteção que pode ser usado para bloquear
 * automaticamente requests com IDOR detectado.
 * Em modo STRICT, bloqueia. Em modo LOG, apenas registra.
 */
export function createTenantGuard(options: { mode: "strict" | "log" }) {
  return function guardTenant(
    auth: AuthContext,
    sources: UntrustedSources
  ): { allowed: boolean; reason?: string } {
    const result = detectIdorAttempt(auth, sources);

    if (!result.safe) {
      const message = `TENANT GUARD: IDOR attempt detected: ${result.violations.join(", ")}`;
      
      if (options.mode === "strict") {
        console.error(message);
        return {
          allowed: false,
          reason: "Cross-tenant access attempt blocked",
        };
      } else {
        console.warn(message);
      }
    }

    return { allowed: true };
  };
}

/**
 * Sanitiza um body removendo qualquer storeId não confiável.
 * Use quando precisar garantir que o body não contém storeId
 * que possa ser acidentalmente usado.
 */
export function sanitizeBody<T extends Record<string, unknown>>(
  body: T,
  auth: AuthContext
): Omit<T, "storeId"> {
  const { storeId: _ignored, ...safeBody } = body;
  
  if (_ignored && _ignored !== auth.storeId) {
    console.warn(`TENANT GUARD: Ignoring untrusted body.storeId: ${_ignored}`);
  }
  
  return safeBody as Omit<T, "storeId">;
}

/**
 * Sanitiza query params removendo storeId.
 */
export function sanitizeQuery(
  query: Record<string, string | null>,
  auth: AuthContext
): Record<string, string | null> {
  const { storeId: _ignored, ...safeQuery } = query;
  
  if (_ignored && _ignored !== auth.storeId) {
    console.warn(`TENANT GUARD: Ignoring untrusted query.storeId: ${_ignored}`);
  }
  
  return safeQuery;
}

/**
 * Verificação runtime para garantir que um handler
 * não está usando storeId de fontes não confiáveis.
 * Lança erro se detectar uso inseguro.
 */
export function assertSafeTenantAccess(
  auth: AuthContext,
  sources: UntrustedSources,
  handlerName: string
): void {
  const result = detectIdorAttempt(auth, sources);
  
  if (!result.safe) {
    throw new Error(
      `TENANT GUARD VIOLATION in ${handlerName}: ${result.violations.join("; ")}`
    );
  }
}

// Guard global em modo STRICT para produção
export const strictTenantGuard = createTenantGuard({ mode: "strict" });

// Guard em modo LOG para desenvolvimento/debug
export const loggingTenantGuard = createTenantGuard({ mode: "log" });
