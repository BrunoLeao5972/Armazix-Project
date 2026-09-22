import { describe, it, expect } from "vitest";
import { montarHistoricoVenda, type HistoricoInput } from "@/lib/orders/historico-venda";

// Espelha a venda #8 real: PDV, Mesa 01, PIX, R$ 25, estornada depois.
const base = (): HistoricoInput => ({
  venda: {
    data: "2026-09-19T03:52:31.487Z", saleStatus: "estornada", channel: "pdv", tipo: "delivery",
    notes: "PDV — Mesa 01", cliente: "Cliente não identificado", formaPagamento: "pix",
    installments: 1, gatewayPaymentId: null,
    concretizedAt: "2026-09-19T03:52:31.626Z", cancelledAt: "2026-09-22T01:50:14.533Z",
    refundedAt: "2026-09-22T01:50:14.553Z", motivoLabel: "Outro motivo",
  },
  timeline: [{ status: "cancelled", note: "Estorno: Outro motivo", data: "2026-09-22T01:50:14.533Z" }],
  lancamentos: [
    { tipo: "entrada", categoria: "venda", descricao: "Venda PDV #8 — Mesa 01", valor: 25, status: "estornado",
      metodoPagamento: "pix", data: "2026-09-19T03:52:31.487Z", sessaoId: "s1" },
    { tipo: "saida", categoria: "estorno", descricao: "Estorno — Pedido #8", valor: 25, status: "liquidado",
      metodoPagamento: "pix", data: "2026-09-22T01:50:14.533Z", sessaoId: "s1" },
  ],
  sessoes: { s1: { codigo: "D77Z2", abertoPor: "Bruno Leão" } },
  estoque: [
    { type: "VENDA", quantity: 1, productName: "Coca 2L", balanceBefore: 10, balanceAfter: 9,
      data: "2026-09-19T03:52:31.600Z", createdByName: null },
    { type: "DEVOLUCAO", quantity: 1, productName: "Coca 2L", balanceBefore: 9, balanceAfter: 10,
      data: "2026-09-22T01:50:14.540Z", createdByName: null },
  ],
  auditoria: [{ action: "VENDA_ESTORNAR", nomeUsuario: "Bruno Leão", data: "2026-09-22T01:50:14.600Z" }],
});

describe("montarHistoricoVenda", () => {
  it("conta a história do início ao estorno, em ordem", () => {
    const tipos = montarHistoricoVenda(base()).map(e => e.tipo);
    expect(tipos).toEqual(["criada", "pagamento", "estoque", "finalizada", "estoque", "estorno"]);
  });

  it("registra canal, origem e cliente na criação", () => {
    const criada = montarHistoricoVenda(base())[0];
    expect(criada.detalhes).toContain("Canal: PDV (frente de caixa)");
    expect(criada.detalhes).toContain("Origem: PDV — Mesa 01");
  });

  it("pagamento traz valor, forma e a sessão de caixa com o operador", () => {
    const pag = montarHistoricoVenda(base()).find(e => e.tipo === "pagamento")!;
    expect(pag.titulo).toBe("Pagamento recebido: R$ 25,00 (PIX)");
    expect(pag.detalhes).toContain("Caixa: sessão D77Z2 · operador Bruno Leão");
    expect(pag.ator).toBe("Bruno Leão");
  });

  it("estorno mostra o valor UMA vez (R$ 25, não 50), motivo e quem estornou", () => {
    const est = montarHistoricoVenda(base()).find(e => e.tipo === "estorno")!;
    expect(est.titulo).toBe("Venda estornada: R$ 25,00");
    expect(est.valor).toBe(25);
    expect(est.ator).toBe("Bruno Leão");
    expect(est.detalhes).toContain("Motivo: Outro motivo");
    expect(est.detalhes).toContain("Itens devolvidos ao estoque: 1");
  });

  it("não duplica a linha 'Estorno:' do order_timeline", () => {
    const eventos = montarHistoricoVenda(base());
    expect(eventos.filter(e => e.titulo.startsWith("Estorno:"))).toHaveLength(0);
  });

  it("venda online: mostra andamento do pedido e o ID do gateway", () => {
    const h = base();
    h.venda = { ...h.venda, saleStatus: "finalizada", channel: "online", notes: null, gatewayPaymentId: "MP-123", refundedAt: null };
    h.timeline = [
      { status: "received", note: "Pedido confirmado", data: "2026-09-19T03:53:00.000Z" },
      { status: "delivered", note: "Pedido entregue", data: "2026-09-19T04:10:00.000Z" },
    ];
    h.lancamentos = [h.lancamentos[0]];
    h.lancamentos[0] = { ...h.lancamentos[0], status: "liquidado" };
    h.estoque = [h.estoque[0]];
    h.auditoria = [];
    const eventos = montarHistoricoVenda(h);
    expect(eventos.map(e => e.tipo)).toEqual(["criada", "pagamento", "estoque", "finalizada", "status", "status"]);
    expect(eventos.find(e => e.tipo === "pagamento")!.detalhes).toContain("Gateway de pagamento · ID MP-123");
    expect(eventos.some(e => e.tipo === "estorno")).toBe(false);
  });

  it("venda cancelada antes de concretizar", () => {
    const h = base();
    h.venda = { ...h.venda, saleStatus: "cancelada", concretizedAt: null, refundedAt: null };
    h.lancamentos = []; h.estoque = []; h.auditoria = []; h.timeline = [];
    const eventos = montarHistoricoVenda(h);
    expect(eventos.map(e => e.tipo)).toEqual(["criada", "cancelada"]);
    expect(eventos[1].detalhes).toContain("Motivo: Outro motivo");
  });
});
