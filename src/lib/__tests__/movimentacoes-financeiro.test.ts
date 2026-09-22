import { describe, it, expect } from "vitest";
import { classificarMovimentacao, comporSaidas, formatarDataHoraBR } from "@/lib/financeiro/movimentacoes";

const base = { categoria: null as string | null, orderId: null as string | null, contaPaga: false, contaRecebida: false };

describe("classificarMovimentacao", () => {
  it("saída ligada a uma conta a pagar = pagamento de conta", () => {
    expect(classificarMovimentacao({ ...base, tipo: "saida", categoria: "Fornecedores", contaPaga: true })).toBe("conta_paga");
  });

  it("saída de categoria estorno = estorno de venda", () => {
    expect(classificarMovimentacao({ ...base, tipo: "saida", categoria: "estorno", orderId: "o1" })).toBe("estorno");
  });

  it("conta paga cuja categoria se chama 'estorno' continua sendo conta paga", () => {
    expect(classificarMovimentacao({ ...base, tipo: "saida", categoria: "estorno", contaPaga: true })).toBe("conta_paga");
  });

  it("outra saída avulsa", () => {
    expect(classificarMovimentacao({ ...base, tipo: "saida", categoria: "despesa" })).toBe("outra_saida");
  });

  it("entradas: venda, recebimento de conta e outras", () => {
    expect(classificarMovimentacao({ ...base, tipo: "entrada", orderId: "o1" })).toBe("venda");
    expect(classificarMovimentacao({ ...base, tipo: "entrada", contaRecebida: true })).toBe("conta_recebida");
    expect(classificarMovimentacao({ ...base, tipo: "entrada" })).toBe("outra_entrada");
  });
});

describe("comporSaidas", () => {
  it("separa contas pagas de estornos e o total bate com a soma das saídas", () => {
    const c = comporSaidas([
      { tipo: "entrada", valor: 500, origemTipo: "venda" },
      { tipo: "saida", valor: 120.5, origemTipo: "conta_paga" },
      { tipo: "saida", valor: 79.5, origemTipo: "conta_paga" },
      { tipo: "saida", valor: 25, origemTipo: "estorno" },
      { tipo: "saida", valor: 10, origemTipo: "outra_saida" },
    ]);
    expect(c).toMatchObject({ contasPagas: 200, estornos: 25, outras: 10, total: 235 });
    expect(c).toMatchObject({ qtdContasPagas: 2, qtdEstornos: 1, qtdOutras: 1 });
  });

  it("origem ausente (API antiga) cai em 'outras' sem perder valor", () => {
    const c = comporSaidas([{ tipo: "saida", valor: 40 }]);
    expect(c).toMatchObject({ outras: 40, total: 40, contasPagas: 0, estornos: 0 });
  });

  it("sem saídas devolve tudo zerado", () => {
    expect(comporSaidas([{ tipo: "entrada", valor: 10 }]).total).toBe(0);
  });
});

describe("formatarDataHoraBR", () => {
  it("formata em dd/mm/aaaa hh:mm no horário de Brasília (o formato que o parseMovData lê)", () => {
    expect(formatarDataHoraBR("2026-09-19T03:52:31.487Z")).toBe("19/09/2026 00:52");
  });
});
