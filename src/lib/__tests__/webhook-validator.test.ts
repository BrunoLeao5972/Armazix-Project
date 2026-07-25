/**
 * validateMercadoPagoSignature é a única validação de assinatura de webhook
 * que sobrou no projeto — guarda os webhooks de assinatura/PIX, onde quem
 * cobra é o Armazix e portanto o segredo é nosso. Não tinha teste nenhum.
 *
 * (O webhook de pedidos usa outro modelo: o segredo pertence ao lojista, então
 * a notificação é tratada como gatilho e a verdade vem da API do MP. Ver
 * mp-webhook.test.ts.)
 */

import { describe, it, expect } from "vitest";
import { validateMercadoPagoSignature } from "@/lib/webhook-validator";

const SECRET  = "segredo-do-painel-mp";
const DATA_ID = "1234567890";
const REQ_ID  = "req-abc-123";

/** Reproduz o manifesto que o MP assina: id, request-id e timestamp. */
async function sign(dataId: string, requestId: string, ts: number, secret = SECRET) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function req(headers: Record<string, string>) {
  return new Request("https://armazix.com.br/api/subscriptions/mp-webhook", { headers });
}

const agora = () => Math.floor(Date.now() / 1000);

describe("validateMercadoPagoSignature", () => {
  it("aceita uma assinatura íntegra e recente", async () => {
    const ts = agora();
    const v1 = await sign(DATA_ID, REQ_ID, ts);

    const result = await validateMercadoPagoSignature(
      req({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": REQ_ID }),
      DATA_ID, SECRET,
    );

    expect(result.valid).toBe(true);
  });

  it("rejeita quando faltam os headers", async () => {
    const result = await validateMercadoPagoSignature(req({}), DATA_ID, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/missing/i);
  });

  it("rejeita assinatura feita com outro segredo", async () => {
    const ts = agora();
    const v1 = await sign(DATA_ID, REQ_ID, ts, "segredo-do-atacante");

    const result = await validateMercadoPagoSignature(
      req({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": REQ_ID }),
      DATA_ID, SECRET,
    );

    expect(result.valid).toBe(false);
  });

  it("rejeita quando o data.id não é o que foi assinado", async () => {
    const ts = agora();
    const v1 = await sign(DATA_ID, REQ_ID, ts);

    // Assinatura legítima de outro pagamento, reaproveitada.
    const result = await validateMercadoPagoSignature(
      req({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": REQ_ID }),
      "9999999999", SECRET,
    );

    expect(result.valid).toBe(false);
  });

  it("rejeita replay antigo (fora da janela de 5 min)", async () => {
    const ts = agora() - 600;
    const v1 = await sign(DATA_ID, REQ_ID, ts);

    const result = await validateMercadoPagoSignature(
      req({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": REQ_ID }),
      DATA_ID, SECRET,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too old/i);
  });

  it("rejeita header em formato inesperado", async () => {
    const result = await validateMercadoPagoSignature(
      req({ "x-signature": "formato-errado", "x-request-id": REQ_ID }),
      DATA_ID, SECRET,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/format/i);
  });
});
