import { Redis } from "@upstash/redis";

let _client: Redis | null = null;

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_client) _client = new Redis({ url, token });
  return _client;
}

const TTL_SECONDS = 3_600; // 1 hora (padrão fresh)
const STALE_TTL   = 86_400; // 24 horas (janela stale padrão)

// ── Envelope interno ──────────────────────────────────────────────────────────
// Cada entrada no Redis carrega { v: dado, exp: timestamp } dentro de um único key.
// Key TTL = staleTtl (longo). Campo `exp` controla quando o dado é "fresh".
//
// FRESH  (exp > now)  → retorna imediatamente, zero queries no banco.
// STALE  (exp <= now) → retorna imediatamente + dispara refresh em background.
// MISS   (key ausente)→ single-flight lock garante apenas 1 query no banco.
interface CacheEnvelope<T> {
  v:   T;
  exp: number; // Date.now() + freshTtl*1000
}

function isEnvelope<T>(x: unknown): x is CacheEnvelope<T> {
  return (
    x !== null &&
    typeof x === "object" &&
    "v"   in (x as object) &&
    "exp" in (x as object) &&
    typeof (x as CacheEnvelope<T>).exp === "number"
  );
}

// Retry com backoff linear. Só retenta em throws — não em retorno null (dado não existe).
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) await new Promise<void>(r => setTimeout(r, 80 * (i + 1)));
    }
  }
  throw lastErr;
}

// Grava envelope no Redis em pipeline.
async function setEnvelope<T>(
  redis:    Redis,
  key:      string,
  data:     T,
  freshMs:  number,
  staleTtl: number,
  storeId?: string,
): Promise<void> {
  const envelope: CacheEnvelope<T> = { v: data, exp: Date.now() + freshMs };
  const p = redis.pipeline().set(key, envelope, { ex: staleTtl });
  if (storeId) {
    const idx = `store:${storeId}:_keys`;
    p.sadd(idx, key).expire(idx, staleTtl + 300);
  }
  await p.exec();
}

// Refresh em background (fire-and-forget). Usa o mesmo lock de cold miss para
// garantir single-flight: apenas 1 Worker vai ao banco por chave stale.
function bgRefresh<T>(
  redis:    Redis,
  key:      string,
  fetcher:  () => Promise<T>,
  freshMs:  number,
  staleTtl: number,
  storeId?: string,
): void {
  Promise.resolve().then(async () => {
    const lockKey = `_lk:${key}`;
    let acquired = false;
    try {
      acquired = !!(await redis.set(lockKey, "1", { nx: true, ex: 5 }));
    } catch { return; } // Redis instável → deixa o dado stale, próximo request tenta
    if (!acquired) return; // Outro Worker já está fazendo o refresh
    try {
      const data = await fetcher();
      await setEnvelope(redis, key, data, freshMs, staleTtl, storeId);
    } catch { /* stale data permanece; próximo request tenta de novo */ }
    finally { await redis.del(lockKey).catch(() => {}); }
  });
}

// ── Distributed lock (single-flight) para cold miss ──────────────────────────
// Garante que apenas 1 request vai ao banco enquanto os outros aguardam o cache.
// Sem isso, N requests simultâneos após um deleteKey / invalidateStoreCache
// disparariam N queries ao Neon ao mesmo tempo.
//
// Fluxo:
//   SET _lk:<key> 1 NX EX 5  → adquire o lock
//   HIT   → busca no banco, popula cache, libera lock
//   MISS  → tenta ler o cache 1× sem sleep; se vazio, vai ao banco direto
//
// Por que sem polling? setTimeout em Cloudflare Workers mantém o isolate vivo
// e acumula tempo de CPU residual a cada tick. 3×setTimeout = risco de Error 1102.
// Aceitar até 2 queries simultâneas no cold miss é melhor que matar o Worker.
async function acquireAndFetch<T>(
  redis:    Redis,
  key:      string,
  fetcher:  () => Promise<T>,
  freshMs:  number,
  staleTtl: number,
  storeId?: string,
): Promise<T> {
  const lockKey = `_lk:${key}`;

  let lockAcquired = false;
  try {
    lockAcquired = !!(await redis.set(lockKey, "1", { nx: true, ex: 5 }));
  } catch {
    return withRetry(fetcher);
  }

  if (lockAcquired) {
    try {
      const data = await withRetry(fetcher);
      await setEnvelope(redis, key, data, freshMs, staleTtl, storeId).catch(() => {});
      return data;
    } finally {
      await redis.del(lockKey).catch(() => {});
    }
  }

  // Lock não adquirido: outro Worker já está buscando.
  // Tenta o cache uma única vez — se o holder terminou rápido, já está lá.
  try {
    const cached = await redis.get<unknown>(key);
    if (cached !== null && isEnvelope<T>(cached)) return cached.v;
  } catch { }

  // Ainda vazio → vai ao banco sem esperar para não acumular CPU (Error 1102).
  return withRetry(fetcher);
}

// ─────────────────────────────────────────────────────────────────────────────
// getCached — ponto de entrada central de cache
//
// FRESH HIT  → retorna em ~1ms (apenas GET no Redis)
// STALE HIT  → retorna em ~1ms + refresh em background (1 query no banco)
// COLD MISS  → lock distribído garante 1 query no banco; outros aguardam até 1s
// REDIS DOWN → cai diretamente no banco com retry
// ─────────────────────────────────────────────────────────────────────────────
export async function getCached<T>(
  key:     string,
  fetcher: () => Promise<T>,
  opts?:   { ttl?: number; staleTtl?: number; storeId?: string },
): Promise<T> {
  const redis    = getRedis();
  const freshTtl = opts?.ttl      ?? TTL_SECONDS;
  const staleTtl = opts?.staleTtl ?? STALE_TTL;
  const freshMs  = freshTtl * 1_000;
  const now      = Date.now();

  if (redis) {
    // ── 1. Tenta ler do cache ────────────────────────────────────────
    let raw: unknown = null;
    try { raw = await redis.get<unknown>(key); } catch { /* fall through */ }

    if (raw !== null) {
      if (isEnvelope<T>(raw)) {
        if (raw.exp > now) return raw.v; // ✓ FRESH

        // STALE: retorna imediato, refresh async
        bgRefresh(redis, key, fetcher, freshMs, staleTtl, opts?.storeId);
        return raw.v;
      }

      // Formato legado (sem envelope) → migra em background
      bgRefresh(redis, key, fetcher, freshMs, staleTtl, opts?.storeId);
      return raw as T;
    }

    // ── 2. COLD MISS: lock distribído → apenas 1 query no banco ─────
    return acquireAndFetch(redis, key, fetcher, freshMs, staleTtl, opts?.storeId);
  }

  // Redis indisponível → banco com retry
  return withRetry(fetcher);
}

// ─────────────────────────────────────────────────────────────────────────────
// warmCached — escreve dado fresco diretamente no Redis sem cold miss.
// Use em mutations onde o dado atualizado já está disponível (ex.: updateStore).
// Evita o intervalo de cache vazio que acontece entre deleteKey + próximo GET.
// ─────────────────────────────────────────────────────────────────────────────
export async function warmCached<T>(
  keys:  string[],
  data:  T,
  opts?: { ttl?: number; staleTtl?: number },
): Promise<void> {
  const redis = getRedis();
  if (!redis || data == null) return;
  const freshTtl = opts?.ttl      ?? TTL_SECONDS;
  const staleTtl = opts?.staleTtl ?? STALE_TTL;
  const envelope: CacheEnvelope<T> = { v: data, exp: Date.now() + freshTtl * 1_000 };
  try {
    const p = redis.pipeline();
    for (const k of keys) p.set(k, envelope, { ex: staleTtl });
    await p.exec();
  } catch (err) {
    console.error("[redis] warmCached error (non-fatal):", (err as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// invalidateStoreCache — deleta todas as chaves cacheadas do store.
//
// Por que delete (não mark-as-stale)?
// Mark-as-stale requereria GET+SET de todos os valores — se houver 50 entradas
// de produtos cacheadas cada uma com 100KB, seriam 5MB de JSON processado em
// CPU sincronamente → 1102 (Worker exceeded resource limits).
//
// O cold miss resultante é protegido pelo distributed lock em acquireAndFetch:
// apenas 1 request vai ao banco; os demais aguardam o cache ser populado.
// ─────────────────────────────────────────────────────────────────────────────
export async function invalidateStoreCache(storeId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const indexKey = `store:${storeId}:_keys`;
    const keys     = await redis.smembers<string[]>(indexKey);
    if (keys.length === 0) return;

    const p = redis.pipeline();
    keys.forEach(k => p.del(k));
    p.del(indexKey);
    await p.exec();
  } catch (err) {
    console.error("[redis] invalidation error (non-fatal):", (err as Error).message);
  }
}

export function productsCacheKey(storeId: string, limit: number, offset: number, catIds: string): string {
  return `store:${storeId}:products:${limit}:${offset}:${catIds}`;
}
export function categoriesCacheKey(storeId: string): string { return `store:${storeId}:categories`; }
export function customersCacheKey(storeId: string): string  { return `store:${storeId}:customers:list`; }
export function storeCacheKey(storeId: string): string      { return `store:${storeId}:config`; }

// Rate Limiting distribuído — sliding fixed-window counter.
export async function redisRateLimit(
  key:           string,
  max:           number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number; remaining: number; ttlSeconds: number }> {
  const redis = getRedis();
  if (!redis) return { allowed: true, count: 0, remaining: max, ttlSeconds: windowSeconds };

  try {
    const [count, , ttl] = await redis.pipeline()
      .incr(key)
      .expire(key, windowSeconds, "NX")
      .ttl(key)
      .exec() as [number, 0 | 1, number];

    const effectiveTtl = ttl > 0 ? ttl : windowSeconds;
    return { allowed: count <= max, count, remaining: Math.max(0, max - count), ttlSeconds: effectiveTtl };
  } catch (err) {
    console.error("[redis] rateLimit error (fail-open):", (err as Error).message);
    return { allowed: true, count: 0, remaining: max, ttlSeconds: windowSeconds };
  }
}

// OTP — armazena/verifica/consome códigos temporários por telefone+store.
const OTP_TTL = 300;

export async function storeOtp(storeId: string, phone: string, code: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.set(`otp:${storeId}:${phone}`, code, { ex: OTP_TTL });
    return true;
  } catch { return false; }
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
  } catch { return false; }
}

// deleteKey — mantido para OTP, payment config e outros casos pontuais.
// Para store config, prefira warmCached. Para produtos/categorias, prefira invalidateStoreCache.
export async function deleteKey(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  try {
    const p = redis.pipeline();
    keys.forEach(k => p.del(k));
    await p.exec();
  } catch (err) {
    console.error("[redis] deleteKey error (non-fatal):", (err as Error).message);
  }
}
