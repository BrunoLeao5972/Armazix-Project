import { describe, it, expect } from "vitest";
import { montarLancamentosReais, type ContaPagarApi, type ContaReceberApi, type MovimentacaoApi } from "@/lib/financial/fluxo-real";
import { calcularTotais } from "@/lib/financial/useFluxoCaixa";
import * as fluxoHook from "@/lib/financial/useFluxoCaixa";

const contaPagar = (o: Partial<ContaPagarApi> = {}): ContaPagarApi => ({
  id: "p1", fornecedor: "Distribuidora Alfa", desc: "Reposição", documento: "NF-10", categoria: "Fornecedores",
  centroCusto: "", contaFinanceira: "", valor: 1000, juros: 20, desconto: 10, formaPgto: "pix",
  emissao: "01/09/2026", vencimento: "10/09/2026", pagamento: null, status: "pendente", obs: "", ...o,
});
const contaReceber = (o: Partial<ContaReceberApi> = {}): ContaReceberApi => ({
  id: "r1", cliente: "Maria", desc: "Fiado", documento: "", categoria: "Vendas", centroCusto: "", contaFinanceira: "",
  valor: 300, juros: 0, desconto: 0, formaPgto: "pix", emissao: "02/09/2026", vencimento: "20/09/2026",
  recebimento: null, status: "pendente", obs: "", ...o,
});
const mov = (o: Partial<MovimentacaoApi> = {}): MovimentacaoApi => ({
  id: "m1", tipo: "entrada", categoria: "venda", desc: "Venda PDV #8", valor: 25,
  data: "19/09/2026 00:52", origem: "Venda", origemTipo: "venda", status: "liquidado", formaPgto: "pix", ...o,
});

describe("montarLancamentosReais", () => {
  it("sem dados reais, não inventa nada (o mock antigo apareceria pra todas as lojas)", () => {
    expect(montarLancamentosReais({ pagar: [], receber: [], movimentacoes: [] })).toEqual([]);
  });

  it("conta a pagar vira DESPESA em aberto; total = valor + juros - desconto", () => {
    const [l] = montarLancamentosReais({ pagar: [contaPagar()], receber: [], movimentacoes: [] });
    expect(l).toMatchObject({ natureza: "DESPESA", status: "EM_ABERTO", favorecido: "Distribuidora Alfa", valor_total: 1010, data_pagamento: null });
  });

  it("conta paga vira EFETIVADO com a data do pagamento", () => {
    const [l] = montarLancamentosReais({ pagar: [contaPagar({ status: "pago", pagamento: "11/09/2026" })], receber: [], movimentacoes: [] });
    expect(l).toMatchObject({ status: "EFETIVADO", data_pagamento: "11/09/2026" });
  });

  it("conta a receber vira RECEITA", () => {
    const [l] = montarLancamentosReais({ pagar: [], receber: [contaReceber()], movimentacoes: [] });
    expect(l).toMatchObject({ natureza: "RECEITA", status: "EM_ABERTO", favorecido: "Maria", valor_total: 300 });
  });

  it("conta cancelada fica de fora", () => {
    const r = montarLancamentosReais({ pagar: [contaPagar({ status: "cancelado" })], receber: [contaReceber({ status: "cancelado" })], movimentacoes: [] });
    expect(r).toEqual([]);
  });

  it("venda e estorno entram como movimentos efetivados", () => {
    const r = montarLancamentosReais({
      pagar: [], receber: [],
      movimentacoes: [mov(), mov({ id: "m2", tipo: "saida", categoria: "estorno", desc: "Estorno #8", origemTipo: "estorno", origem: "Estorno de venda" })],
    });
    expect(r.map(l => [l.natureza, l.status, l.valor_total])).toEqual([["RECEITA", "EFETIVADO", 25], ["DESPESA", "EFETIVADO", 25]]);
    // venda estornada: entrada 25 - estorno 25 = saldo realizado 0
    expect(calcularTotais(r).saldo_realizado).toBe(0);
  });

  it("pagamento de conta NÃO é contado de novo (a própria conta já está na lista)", () => {
    const r = montarLancamentosReais({
      pagar: [contaPagar({ status: "pago", pagamento: "11/09/2026" })], receber: [],
      movimentacoes: [mov({ id: "m3", tipo: "saida", categoria: "Fornecedores", origemTipo: "conta_paga", valor: 1000 })],
    });
    expect(r).toHaveLength(1);
    expect(r[0].id_lancamento).toBe("pagar:p1");
  });

  it("ids não colidem entre fontes com o mesmo id de origem", () => {
    const r = montarLancamentosReais({ pagar: [contaPagar({ id: "x" })], receber: [contaReceber({ id: "x" })], movimentacoes: [mov({ id: "x" })] });
    expect(new Set(r.map(l => l.id_lancamento)).size).toBe(3);
  });
});

describe("Fluxo de Caixa sem mock", () => {
  it("o hook não exporta mais a lista fixa de lançamentos fictícios", () => {
    expect((fluxoHook as Record<string, unknown>).LANCAMENTOS_MOCK).toBeUndefined();
  });
});
