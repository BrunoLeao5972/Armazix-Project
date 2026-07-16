// Executa fetch com retry automático em falhas transitórias (5xx, erro de rede).
// Não retenta em erros definitivos (4xx).
// maxAttempts=3 → delays: 800ms, 1600ms (dobra a cada tentativa).
export async function fetchRetry(
  url: string,
  init?: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastRes: Response | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, init);
      // Não retenta em erros definitivos do cliente
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      lastRes = res;
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
    }
    if (i < maxAttempts - 1) {
      const retryAfterSec = lastRes?.headers.get("Retry-After");
      const delay = retryAfterSec ? Math.min(parseInt(retryAfterSec, 10) * 1000, 10_000) : 800 * (2 ** i);
      await new Promise<void>(r => setTimeout(r, delay));
    }
  }
  return lastRes ?? (await fetch(url, init));
}
