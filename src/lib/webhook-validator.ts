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

// ─────────────────────────────────────────────────────────────────────────
// Sobre as duas funções que existiam aqui e foram removidas:
//
//   validateWebhookQueryKey() — aceitava o segredo pela query string
//     (?key=...). Só a Appmax usava, e a URL completa vaza em log de acesso,
//     observabilidade e qualquer proxy no caminho.
//
//   validateWebhookApiKey() — exigia um header `x-api-key` que o Mercado Pago
//     nunca envia. Na prática o webhook de pedidos rejeitava tudo com 401, e a
//     chave compartilhada (WEBHOOK_API_KEY) dava uma falsa sensação de
//     proteção. Esse webhook agora não confia em nada do corpo: relê o
//     pagamento na API do MP e confere vínculo e valor (ver payment-handler.ts).
//
// Webhook novo deve validar por assinatura HMAC do corpo, como acima — ou,
// quando o segredo pertencer ao lojista e não a nós, tratar a notificação como
// mero gatilho e buscar a verdade no gateway.
// ─────────────────────────────────────────────────────────────────────────
