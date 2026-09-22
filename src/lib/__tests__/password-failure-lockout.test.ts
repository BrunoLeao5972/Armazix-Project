import { describe, it, expect, beforeEach } from "vitest";
import { getPasswordFailures, recordPasswordFailure, clearPasswordFailures } from "@/lib/cache/redis";

// Sem UPSTASH_REDIS_REST_URL no ambiente de teste → exercita o fallback em memória.
describe("bloqueio por conta (senha errada)", () => {
  const key = "pwdfail:test:loja:usuario";

  beforeEach(async () => { await clearPasswordFailures(key); });

  it("começa zerado", async () => {
    const { count } = await getPasswordFailures(key, 900);
    expect(count).toBe(0);
  });

  it("conta só as falhas registradas", async () => {
    await recordPasswordFailure(key, 900);
    await recordPasswordFailure(key, 900);
    await recordPasswordFailure(key, 900);
    const { count, ttlSeconds } = await getPasswordFailures(key, 900);
    expect(count).toBe(3);
    expect(ttlSeconds).toBeGreaterThan(0);
    expect(ttlSeconds).toBeLessThanOrEqual(900);
  });

  it("uma senha certa (clear) zera o contador", async () => {
    await recordPasswordFailure(key, 900);
    await recordPasswordFailure(key, 900);
    await clearPasswordFailures(key);
    const { count } = await getPasswordFailures(key, 900);
    expect(count).toBe(0);
  });

  it("contas diferentes não compartilham contador", async () => {
    await recordPasswordFailure(key, 900);
    const outra = await getPasswordFailures("pwdfail:test:loja:outro-usuario", 900);
    expect(outra.count).toBe(0);
  });
});
