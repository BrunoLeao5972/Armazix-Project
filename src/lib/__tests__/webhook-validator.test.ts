import { describe, it, expect } from "vitest";
import { validateWebhookApiKey, validateWebhookQueryKey } from "@/lib/webhook-validator";

describe("validateWebhookQueryKey", () => {
  const SECRET = "super-secret-key-123";

  it("aceita quando a query string tem a chave correta", () => {
    const req = new Request(`https://app.test/webhook?key=${SECRET}`);
    expect(validateWebhookQueryKey(req, SECRET).valid).toBe(true);
  });

  it("rejeita quando o parâmetro está ausente", () => {
    const req = new Request("https://app.test/webhook");
    const result = validateWebhookQueryKey(req, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/missing/i);
  });

  it("rejeita chave de tamanho diferente", () => {
    const req = new Request("https://app.test/webhook?key=curta");
    expect(validateWebhookQueryKey(req, SECRET).valid).toBe(false);
  });

  it("rejeita chave de mesmo tamanho mas valor errado", () => {
    const wrong = "x".repeat(SECRET.length);
    const req = new Request(`https://app.test/webhook?key=${wrong}`);
    expect(validateWebhookQueryKey(req, SECRET).valid).toBe(false);
  });

  it("aceita um nome de parâmetro customizado", () => {
    const req = new Request(`https://app.test/webhook?token=${SECRET}`);
    expect(validateWebhookQueryKey(req, SECRET, "token").valid).toBe(true);
    expect(validateWebhookQueryKey(req, SECRET, "key").valid).toBe(false);
  });
});

describe("validateWebhookApiKey (regressão — não deve quebrar com a nova função)", () => {
  it("continua exigindo o header x-api-key", () => {
    const req = new Request("https://app.test/webhook", { headers: { "x-api-key": "abc" } });
    expect(validateWebhookApiKey(req, "abc").valid).toBe(true);
    expect(validateWebhookApiKey(req, "def").valid).toBe(false);
  });
});
