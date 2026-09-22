import { describe, it, expect } from "vitest";
import { resumirFinanceiroVenda } from "@/lib/orders/venda-financeiro";

describe("resumirFinanceiroVenda", () => {
  it("venda finalizada: só entrada liquidada", () => {
    const r = resumirFinanceiroVenda([{ tipo: "entrada", categoria: "venda", status: "liquidado", valor: "25.00" }]);
    expect(r).toEqual({ lancado: 25, estornado: 0, liquido: 25 });
  });

  // O caso real da venda #8 (R$ 25, PIX): entrada virou `estornado` e a saída
  // compensatória foi lançada — antes isso dava estornado=50 e líquido=-50.
  it("venda estornada de R$ 25 NÃO vira −50", () => {
    const r = resumirFinanceiroVenda([
      { tipo: "entrada", categoria: "venda",   status: "estornado", valor: "25.00" },
      { tipo: "saida",   categoria: "estorno", status: "liquidado", valor: "25.00" },
    ]);
    expect(r).toEqual({ lancado: 25, estornado: 25, liquido: 0 });
  });

  it("pagamento misto (duas entradas) estornado por inteiro", () => {
    const r = resumirFinanceiroVenda([
      { tipo: "entrada", categoria: "venda",   status: "estornado", valor: "10.00" },
      { tipo: "entrada", categoria: "venda",   status: "estornado", valor: "20.00" },
      { tipo: "saida",   categoria: "estorno", status: "liquidado", valor: "30.00" },
    ]);
    expect(r).toEqual({ lancado: 30, estornado: 30, liquido: 0 });
  });

  it("sem saída de estorno usa as entradas estornadas (uma vez só)", () => {
    const r = resumirFinanceiroVenda([{ tipo: "entrada", categoria: "venda", status: "estornado", valor: 40 }]);
    expect(r).toEqual({ lancado: 40, estornado: 40, liquido: 0 });
  });

  it("venda antiga sem entrada mas com estorno não fica negativa", () => {
    const r = resumirFinanceiroVenda([{ tipo: "saida", categoria: "estorno", status: "liquidado", valor: "15.00" }]);
    expect(r).toEqual({ lancado: 15, estornado: 15, liquido: 0 });
  });

  it("ignora entradas pendentes/canceladas e saídas que não são estorno", () => {
    const r = resumirFinanceiroVenda([
      { tipo: "entrada", categoria: "venda",   status: "pendente",  valor: "99.00" },
      { tipo: "saida",   categoria: "despesa", status: "liquidado", valor: "5.00" },
    ]);
    expect(r).toEqual({ lancado: 0, estornado: 0, liquido: 0 });
  });

  it("arredonda centavos sem erro de ponto flutuante", () => {
    const r = resumirFinanceiroVenda([
      { tipo: "entrada", categoria: "venda", status: "liquidado", valor: "0.10" },
      { tipo: "entrada", categoria: "venda", status: "liquidado", valor: "0.20" },
    ]);
    expect(r.lancado).toBe(0.3);
  });
});
