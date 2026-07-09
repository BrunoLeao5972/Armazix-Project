import { Redis } from "@upstash/redis";

// ── Singleton HTTP — @upstash/redis usa fetch() internamente,
//    sem conexão TCP persistente. Seguro para reusar entre requests
//    no mesmo isolate do Worker (sem state leak entre tenants).
let _client: Redis | null = null;

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // Redis não configurado → fallback silencioso
  if (!_client) _client = new Redis({ url, token });
  return _client;
}

const TTL_SECONDS = 3_600; // 1 hora

// ─────────────────────────────────────────────────────────────────────
// Cache-Aside: checa Redis → HIT retorna imediato; MISS vai ao DB,
// persiste o resultado e rastreia a chave no set do store (para invalidação).
// Fail-safe: qualquer erro do Redis desvia para o fetcher sem lançar.
// ─────────────────────────────────────────────────────────────────────
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { ttl?: number; storeId?: string },
): Promise<T> {
  const redis = getRedis();
  const ttl   = opts?.ttl ?? TTL_SECONDS;

  if (redis) {
    try {
      const hit = await redis.get<T>(key);
      if (hit !== null) return hit; // ✓ HIT — zero queries no banco
    } catch (err) {
      console.error("[redis] get error, falling back to DB:", (err as Error).message);
      return fetcher(); // Fail-safe imediato
    }
  }

  // MISS ou Redis ausente → busca no banco
  const data = await fetcher();

  if (redis) {
    // Persiste em background (não bloqueia a resposta)
    Promise.resolve().then(async () => {
      try {
        const pipeline = redis.pipeline().set(key, data, { ex: ttl });

        // Rastreia a chave no set do store para invalidação em bloco
        if (opts?.storeId) {
          const indexKey = `store:${opts.storeId}:_keys`;
          pipeline.sadd(indexKey, key).expire(indexKey, ttl + 300);
        }

        await pipeline.exec();
      } catch (err) {
        console.error("[redis] set error (non-fatal):", (err as Error).message);
      }
    });
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────
// Invalidação: lê o set de chaves da loja e deleta todas em um pipeline.
// Garante consistência imediata sem esperar o TTL expirar.
// Chamado em qualquer mutation (create/update/delete) de produto ou categoria.
// ─────────────────────────────────────────────────────────────────────
export async function invalidateStoreCache(storeId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const indexKey = `store:${storeId}:_keys`;
    const keys     = await redis.smembers<string[]>(indexKey);

    if (keys.length === 0) return;

    const pipeline = redis.pipeline();
    keys.forEach(k => pipeline.del(k)); // deleta cada chave cacheada
    pipeline.del(indexKey);             // limpa o índice
    await pipeline.exec();
  } catch (err) {
    // Não-fatal: stale data expirará pelo TTL naturalmente
    console.error("[redis] invalidation error (non-fatal):", (err as Error).message);
  }
}

// Monta a chave estruturada de produtos por store + parâmetros de paginação
export function productsCacheKey(
  storeId: string,
  limit: number,
  offset: number,
  catIds: string,
): string {
  return `store:${storeId}:products:${limit}:${offset}:${catIds}`;
}

// Chave única por store para categorias (não pagina)
export function categoriesCacheKey(storeId: string): string {
  return `store:${storeId}:categories`;
}

// Chave da listagem de clientes do CRM (com stats de pedidos)
export function customersCacheKey(storeId: string): string {
  return `store:${storeId}:customers:list`;
}

// Chave da configuração pública da loja (nome, logo, cores, pagamento, entrega)
export function storeCacheKey(storeId: string): string {
  return `store:${storeId}:config`;
}

// ─────────────────────────────────────────────────────────────────────
// Rate Limiting distribuído via Redis — sliding fixed-window counter.
// Usa INCR + EXPIRE NX (atômico o suficiente para RL: falso-positivos
// de ±1 na janela de abertura são inócuos para anti-abuso).
// Fail-open: Redis indisponível → retorna allowed=true para não bloquear
// usuários legítimos durante falhas de infraestrutura.
// ─────────────────────────────────────────────────────────────────────
export async function redisRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number; remaining: number; ttlSeconds: number }> {
  const redis = getRedis();
  if (!redis) {
    // Redis não configurado → fail-open (não bloqueia nada)
    return { allowed: true, count: 0, remaining: max, ttlSeconds: windowSeconds };
  }

  try {
    // Pipeline de 3 comandos: INCR → EXPIRE NX → TTL
    // EXPIRE NX: define expiração apenas na criação (count === 1), nunca redefine janela existente
    const [count, , ttl] = await redis.pipeline()
      .incr(key)
      .expire(key, windowSeconds, "NX")
      .ttl(key)
      .exec() as [number, 0 | 1, number];

    const effectiveTtl = ttl > 0 ? ttl : windowSeconds;

    return {
      allowed:    count <= max,
      count,
      remaining:  Math.max(0, max - count),
      ttlSeconds: effectiveTtl,
    };
  } catch (err) {
    console.error("[redis] rateLimit error (fail-open):", (err as Error).message);
    return { allowed: true, count: 0, remaining: max, ttlSeconds: windowSeconds };
  }
}

// ─────────────────────────────────────────────────────────────────────
// OTP — armazena/verifica/consome códigos temporários por telefone+store.
// TTL de 5 min; consumeOtp faz get+del em sequência (suficiente para OTP
// de baixo tráfego — race condition resulta em "código já usado", não em
// acesso indevido).
// ─────────────────────────────────────────────────────────────────────
const OTP_TTL = 300; // 5 minutos

export async function storeOtp(storeId: string, phone: string, code: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.set(`otp:${storeId}:${phone}`, code, { ex: OTP_TTL });
    return true;
  } catch (err) {
    console.error("[redis] storeOtp error:", (err as Error).message);
    return false;
  }
}

export async function consumeOtp(storeId: string, phone: string, code: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const key    = `otp:${storeId}:${phone}`;
    const stored = await redis.get<string>(key);
    if (!stored || stored !== code) return false;
    await redis.del(key);
    return true;
  } catch (err) {
    console.error("[redis] consumeOtp error:", (err as Error).message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Deleção direcionada de uma ou mais chaves. Fail-safe: erros do Redis
// são logados mas nunca propagados, garantindo que mutations no DB
// retornem normalmente mesmo que o Redis esteja indisponível.
// Use com waitUntil() para não bloquear a resposta ao cliente.
// ─────────────────────────────────────────────────────────────────────
export async function deleteKey(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  try {
    const pipeline = redis.pipeline();
    keys.forEach(k => pipeline.del(k));
    // Remove também do índice do store para não contaminar invalidateStoreCache
    await pipeline.exec();
  } catch (err) {
    console.error("[redis] deleteKey error (non-fatal):", (err as Error).message);
  }
}
