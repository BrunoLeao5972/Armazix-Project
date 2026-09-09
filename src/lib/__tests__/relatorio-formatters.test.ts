// Regressão: os relatórios em destaque da Central de Relatórios paravam de
// funcionar (renderização quebrava com "v.toFixed is not a function")
// sempre que havia PELO MENOS UM registro com valor monetário, porque o
// Postgres devolve colunas NUMERIC/DECIMAL como string pelo driver — o
// cast `sql<number>` do drizzle é só type assertion, não converte nada em
// runtime — e fmtBRL/fmtPct chamavam `.toFixed()` direto no valor cru.
import { describe, it, expect } from "vitest";
import { toNum, fmtBRL, fmtPct } from "@/routes/admin/-modal-resultado-relatorio";

describe("toNum", () => {
  it("converte string numérica (formato do Postgres NUMERIC) para number", () => {
    expect(toNum("30.00")).toBe(30);
    expect(toNum("1234.56")).toBe(1234.56);
  });
  it("mantém number como está", () => {
    expect(toNum(42)).toBe(42);
  });
  it("null/undefined/string inválida caem para 0 em vez de NaN", () => {
    expect(toNum(null)).toBe(0);
    expect(toNum(undefined)).toBe(0);
    expect(toNum("abc")).toBe(0);
  });
});

describe("fmtBRL — não pode quebrar com string vinda do Postgres", () => {
  it("formata string numérica sem lançar exceção", () => {
    expect(fmtBRL("30.00")).toBe("R$ 30,00");
  });
  it("formata number normalmente", () => {
    expect(fmtBRL(30)).toBe("R$ 30,00");
  });
});

describe("fmtPct — mesma proteção pra percentuais (margem, giro)", () => {
  it("formata string numérica sem lançar exceção", () => {
    expect(fmtPct("12.345")).toBe("12.3%");
  });
  it("aceita casas decimais customizadas", () => {
    expect(fmtPct("12.345", 2)).toBe("12.35%");
  });
});
