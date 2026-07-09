// Distributed rate limiter — Redis primary, in-memory fallback.
// Uses fixed-window counter (INCR + EXPIRE NX) via Upstash Redis REST API,
// which works across all Cloudflare Worker PoPs without TCP connections.
// Falls back to per-isolate in-memory when Redis is unavailable (fail-open).

import { redisRateLimit } from "@/lib/cache/redis";

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const configs: Record<string, RateLimitConfig> = {
  // Autenticação — muito restritivo
  auth:              { windowMs: 15 * 60 * 1000, max: 5    },
  "verify-email":    { windowMs: 15 * 60 * 1000, max: 10   },
  "forgot-password": { windowMs: 60 * 60 * 1000, max: 3    },
  "reset-password":  { windowMs: 15 * 60 * 1000, max: 5    },
  // API geral
  api:               { windowMs: 60 * 1000,       max: 60   },
  // Pagamentos — restritivo para prevenir card testing
  payments:          { windowMs: 60 * 60 * 1000,  max: 10   },
  // Operações sensíveis (configs, senha, tokens)
  sensitive:         { windowMs: 15 * 60 * 1000,  max: 20   },
  // Webhooks externos — permissivo
  webhook:           { windowMs: 60 * 1000,        max: 1000 },
};

// Fallback in-memory — per-isolate, não distribuído.
// Usado apenas quando Redis está indisponível. No CF Workers cada isolate
// tem seu próprio Map, então não oferece proteção global — é apenas um
// safety-net local para prevenir picos extremos por isolate.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  request: Request,
  type: keyof typeof configs = "api",
): Promise<{ allowed: boolean; retryAfter?: number; headers?: Record<string, string> }> {
  const config = configs[type] ?? configs.api;
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  const now = Date.now();

  // ── Primary: Redis (global — funciona entre todos os PoPs do CF) ────
  const redisKey = `rl:${type}:${ip}`;
  const result = await redisRateLimit(redisKey, config.max, windowSeconds);

  // Redis respondeu (seja allowed ou denied)
  if (result.count > 0 || !result.allowed) {
    const resetEpoch = Math.ceil((now / 1000) + result.ttlSeconds);
    const headers: Record<string, string> = {
      "X-RateLimit-Limit":     String(config.max),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset":     String(resetEpoch),
    };
    if (!result.allowed) {
      headers["Retry-After"] = String(result.ttlSeconds);
      return { allowed: false, retryAfter: result.ttlSeconds, headers };
    }
    return { allowed: true, headers };
  }

  // ── Fallback: in-memory por isolate (Redis indisponível) ────────────
  const key = `${ip}:${type}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + config.windowMs });
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit":     String(config.max),
        "X-RateLimit-Remaining": String(config.max - 1),
        "X-RateLimit-Reset":     String(Math.ceil((now + config.windowMs) / 1000)),
      },
    };
  }

  if (entry.count >= config.max) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      headers: {
        "X-RateLimit-Limit":     String(config.max),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset":     String(Math.ceil(entry.resetTime / 1000)),
        "Retry-After":           String(retryAfter),
      },
    };
  }

  entry.count++;
  return {
    allowed: true,
    headers: {
      "X-RateLimit-Limit":     String(config.max),
      "X-RateLimit-Remaining": String(config.max - entry.count),
      "X-RateLimit-Reset":     String(Math.ceil(entry.resetTime / 1000)),
    },
  };
}

export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "Muitas requisições. Tente novamente mais tarde.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "Retry-After":  String(retryAfter),
      },
    }
  );
}
