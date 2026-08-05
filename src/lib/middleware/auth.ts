import { verifyJWT } from "@/lib/auth";
import { createDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireJwtSecret } from "@/lib/env";

const { users } = schema;

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  storeId?: string;
  storeRole?: string;
}

// ─── Isolate-level session cache ─────────────────────────────────────────────
// CF Workers are single-threaded per isolate but can handle multiple concurrent
// requests in the same V8 context. When a client fires several parallel API
// calls (e.g. dashboard load), each would re-derive the JWT independently.
// This Map caches the decoded payload for SESSION_CACHE_TTL ms, eliminating
// redundant crypto.subtle operations for rapid-fire identical tokens.
//
// Security: the cache is keyed by the full signed token string (not the payload),
// so forged or mutated tokens always produce a cache miss and go through jwtVerify.

const SESSION_CACHE_TTL = 10_000; // 10 seconds — short enough to be safe on key rotation
const _sessionCache = new Map<string, { auth: AuthContext; exp: number }>();
let   _lastPrune    = 0;

function pruneIfStale(): void {
  const now = Date.now();
  // Prune at most once per second to avoid O(n) on every request
  if (now - _lastPrune < 1_000) return;
  _lastPrune = now;
  for (const [k, v] of _sessionCache) {
    if (v.exp < now) _sessionCache.delete(k);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function requireAuth(request: Request): Promise<AuthContext | Response> {
  const cookieHeader = request.headers.get("cookie");
  const token = cookieHeader?.match(/armazix_token=([^;]+)/)?.[1];

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // ── Cache hit ──────────────────────────────────────────────────────────────
  pruneIfStale();
  const cached = _sessionCache.get(token);
  if (cached && cached.exp > Date.now()) {
    return cached.auth;
  }

  // ── Cache miss — full crypto verification ──────────────────────────────────
  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch {
    // Nunca aceitar um segredo default — erro de configuração deve ser visível,
    // não um bypass silencioso de autenticação.
    console.error("[requireAuth] JWT_SECRET ausente — recusando autenticar");
    return new Response(
      JSON.stringify({ error: "Erro de configuração do servidor" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const payload = await verifyJWT(token, secret);

  if (!payload) {
    _sessionCache.delete(token); // evict stale/invalid entry if any
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // Revogação de sessão: uma troca de senha incrementa users.session_version,
  // derrubando instantaneamente qualquer JWT emitido antes da troca (o token
  // em si continua criptograficamente válido até expirar, mas deixa de bater
  // com a versão atual do usuário). Reaproveita a mesma query pra checar
  // `active`: sem isso, desativar um usuário (toggle-status) não tinha efeito
  // nenhum sobre um token já emitido — a conta ficava "desativada" só pra
  // logins novos, mas continuava com acesso total via sessão existente por
  // até 7 dias.
  // Usuário mock (dev-only, id não é UUID real) fica fora dessa checagem.
  const isMockUser = process.env.NODE_ENV === "development" && payload.userId === "mock-user-001";

  if (!isMockUser) {
    const dbUrl = process.env.DATABASE_URL!;
    const db = createDb(dbUrl);
    const [current] = await db
      .select({ sessionVersion: users.sessionVersion, active: users.active })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!current || current.sessionVersion !== payload.sessionVersion || !current.active) {
      return new Response(
        JSON.stringify({ error: "Sessão expirada, faça login novamente" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }
  }

  const auth: AuthContext = {
    userId:  payload.userId,
    email:   payload.email,
    role:    payload.role,
    storeId: payload.storeId,
  };

  _sessionCache.set(token, { auth, exp: Date.now() + SESSION_CACHE_TTL });
  return auth;
}

// Havia uma segunda implementação de requireStoreAccess aqui (3 argumentos,
// com bypass para auth.role === "admin" e para o usuário mock) que NENHUM
// handler real chamava — só os próprios testes dela. A role global "admin"
// em `users.role` nunca é atribuída em nenhum fluxo do produto (auditoria de
// segurança, módulo Autorização); mantê-la viva era só risco de alguém
// importar a implementação errada por engano (mesmo nome, comportamento
// diferente). A única em uso de verdade é `requireStoreAccess` de
// src/lib/auth/require-store-access.ts — sem bypass de role nenhum, sempre
// verifica a tabela storeUsers.

export function getStoreIdFromRequest(_request: Request): string | null {
  // SECURITY: storeId must come from the JWT — never from the request URL or body.
  return null;
}
