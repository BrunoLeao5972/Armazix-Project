// Distributed rate limiter using Cloudflare Cache API
// Works across multiple Cloudflare Workers instances

interface RateLimitConfig {
  windowMs: number;  // Janela de tempo em ms
  max: number;       // Máximo de requisições na janela
}

const configs: Record<string, RateLimitConfig> = {
  // Autenticação - muito restritivo
  auth: { windowMs: 15 * 60 * 1000, max: 5 },      // 5 tentativas em 15 min
  "verify-email": { windowMs: 15 * 60 * 1000, max: 10 },
  "forgot-password": { windowMs: 60 * 60 * 1000, max: 3 }, // 3 por hora
  "reset-password": { windowMs: 15 * 60 * 1000, max: 5 },
  
  // API geral - mais restritivo
  api: { windowMs: 60 * 1000, max: 60 },           // 60 por minuto
  
  // Webhooks - mais permissivo
  webhook: { windowMs: 60 * 1000, max: 1000 },    // 1000 por minuto
};

// Fallback in-memory store for when cache is unavailable
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  request: Request,
  type: keyof typeof configs = "api",
  cache?: Cache
): Promise<{ allowed: boolean; retryAfter?: number; headers?: Record<string, string> }> {
  const config = configs[type];
  const ip = request.headers.get("cf-connecting-ip") || 
             request.headers.get("x-forwarded-for")?.split(",")[0] || 
             "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 50) || "unknown";
  
  // Create unique key per IP + endpoint type + user agent fingerprint
  const keyBase = `${ip}:${type}:${userAgent}`;
  const keyHash = await hashKey(keyBase);
  const cacheKey = `https://rate-limit.armazix.internal/${keyHash}`;
  const now = Date.now();
  
  try {
    // Try distributed cache first
    if (cache) {
      const cached = await cache.match(new Request(cacheKey));
      if (cached) {
        const data = await cached.json() as { count: number; resetTime: number };
        
        if (now > data.resetTime) {
          // Window expired - reset
          await cache.put(
            new Request(cacheKey),
            new Response(JSON.stringify({ count: 1, resetTime: now + config.windowMs }), {
              headers: { "Cache-Control": `max-age=${Math.ceil(config.windowMs / 1000)}` }
            })
          );
          return { 
            allowed: true, 
            headers: {
              "X-RateLimit-Limit": String(config.max),
              "X-RateLimit-Remaining": String(config.max - 1),
              "X-RateLimit-Reset": String(Math.ceil((now + config.windowMs) / 1000))
            }
          };
        }
        
        if (data.count >= config.max) {
          const retryAfter = Math.ceil((data.resetTime - now) / 1000);
          return { 
            allowed: false, 
            retryAfter,
            headers: {
              "X-RateLimit-Limit": String(config.max),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil(data.resetTime / 1000)),
              "Retry-After": String(retryAfter)
            }
          };
        }
        
        // Increment counter
        await cache.put(
          new Request(cacheKey),
          new Response(JSON.stringify({ count: data.count + 1, resetTime: data.resetTime }), {
            headers: { "Cache-Control": `max-age=${Math.ceil(config.windowMs / 1000)}` }
          })
        );
        
        return { 
          allowed: true,
          headers: {
            "X-RateLimit-Limit": String(config.max),
            "X-RateLimit-Remaining": String(config.max - data.count - 1),
            "X-RateLimit-Reset": String(Math.ceil(data.resetTime / 1000))
          }
        };
      }
      
      // First request in window
      await cache.put(
        new Request(cacheKey),
        new Response(JSON.stringify({ count: 1, resetTime: now + config.windowMs }), {
          headers: { "Cache-Control": `max-age=${Math.ceil(config.windowMs / 1000)}` }
        })
      );
      
      return { 
        allowed: true,
        headers: {
          "X-RateLimit-Limit": String(config.max),
          "X-RateLimit-Remaining": String(config.max - 1),
          "X-RateLimit-Reset": String(Math.ceil((now + config.windowMs) / 1000))
        }
      };
    }
  } catch (e) {
    // Cache failed, fall through to memory-based
    console.error("Cache rate limit failed:", e);
  }
  
  // Fallback to memory-based (for when cache is unavailable)
  const key = `${ip}:${type}`;
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + config.windowMs });
    return { 
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(config.max),
        "X-RateLimit-Remaining": String(config.max - 1)
      }
    };
  }
  
  if (entry.count >= config.max) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { 
      allowed: false, 
      retryAfter,
      headers: {
        "X-RateLimit-Limit": String(config.max),
        "X-RateLimit-Remaining": "0",
        "Retry-After": String(retryAfter)
      }
    };
  }
  
  entry.count++;
  return { 
    allowed: true,
    headers: {
      "X-RateLimit-Limit": String(config.max),
      "X-RateLimit-Remaining": String(config.max - entry.count)
    }
  };
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
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
        "X-RateLimit-Reset": String(retryAfter),
      },
    }
  );
}
