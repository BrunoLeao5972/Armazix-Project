// Webhook signature validation for MercadoPago
// Prevents webhook spoofing attacks

/**
 * Validates MercadoPago webhook signature
 * MP sends: X-Signature header with format: "ts=<timestamp>,v1=<signature>"
 * 
 * Signature is generated using HMAC-SHA256 of:
 * "id:<data.id>;request-id:<x-request-id>;<secret>"
 * 
 * For this implementation, we'll use a simpler approach since MP's signature
 * format can vary. We'll validate using a configured webhook secret.
 */

interface WebhookSignatureResult {
  valid: boolean;
  error?: string;
}

/**
 * Real MercadoPago HMAC-SHA256 webhook signature verification.
 * https://www.mercadopago.com.br/developers/en/docs/checkout-api/webhooks
 *
 * Header: X-Signature: "ts=<unix>,v1=<hex>"
 * Manifest: "id:<data.id lowercase>;request-id:<x-request-id>;ts:<ts>;"
 * Requires MP_WEBHOOK_SECRET (configurado no painel do MP em Webhooks →
 * chave secreta, e via `wrangler secret put MP_WEBHOOK_SECRET`).
 */
export async function validateMercadoPagoSignature(
  request: Request,
  dataId: string,
  secret: string,
): Promise<WebhookSignatureResult> {
  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!signatureHeader || !requestId) {
    return { valid: false, error: "Missing x-signature/x-request-id headers" };
  }

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const { ts, v1 } = parts;
  if (!ts || !v1) return { valid: false, error: "Invalid signature format" };

  const now = Math.floor(Date.now() / 1000);
  const webhookTs = parseInt(ts, 10);
  if (!Number.isFinite(webhookTs) || Math.abs(now - webhookTs) > 300) {
    return { valid: false, error: "Webhook timestamp too old" };
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (computed.length !== v1.length) return { valid: false, error: "Invalid signature" };
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0 ? { valid: true } : { valid: false, error: "Invalid signature" };
}

/**
 * Simple API key validation for webhooks
 * Use this if you configure a secret API key for webhook endpoints
 */
export function validateWebhookApiKey(
  request: Request,
  apiKey: string
): WebhookSignatureResult {
  const providedKey = request.headers.get("x-api-key") ||
                    request.headers.get("X-Api-Key");

  if (!providedKey) {
    return { valid: false, error: "Missing API key" };
  }

  // Timing-safe comparison
  if (providedKey.length !== apiKey.length) {
    return { valid: false, error: "Invalid API key" };
  }

  let result = 0;
  for (let i = 0; i < providedKey.length; i++) {
    result |= providedKey.charCodeAt(i) ^ apiKey.charCodeAt(i);
  }

  if (result !== 0) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}

/**
 * Query-string key validation for webhooks whose provider only lets you
 * configure a single fixed callback URL (no custom headers) — e.g. Appmax,
 * whose webhook host is set once when the platform app is created, not per
 * merchant. The secret is embedded in the registered URL itself:
 *   https://.../webhook?key=<WEBHOOK_API_KEY>
 */
export function validateWebhookQueryKey(
  request: Request,
  expectedKey: string,
  paramName: string = "key"
): WebhookSignatureResult {
  const url = new URL(request.url);
  const providedKey = url.searchParams.get(paramName);

  if (!providedKey) {
    return { valid: false, error: `Missing ${paramName} query param` };
  }

  if (providedKey.length !== expectedKey.length) {
    return { valid: false, error: "Invalid key" };
  }

  let result = 0;
  for (let i = 0; i < providedKey.length; i++) {
    result |= providedKey.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  }

  if (result !== 0) {
    return { valid: false, error: "Invalid key" };
  }

  return { valid: true };
}
