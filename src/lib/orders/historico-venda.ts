// ─────────────────────────────────────────────────────────────────────────
// Histórico de UMA venda, do início ao pagamento e a um possível estorno —
// monta uma linha do tempo única a partir das várias fontes onde a venda
// deixa rastro (o pedido, order_timeline, lançamentos financeiros, sessão de
// caixa, movimentos de estoque e o log de auditoria). Módulo puro (sem DB):
// o handler busca os dados e só entrega pra cá, o que deixa a regra testável.
//
// Cada fonte guarda uma parte da história: o PDV, por exemplo, não escreve
// nada em order_timeline ao vender — só o lançamento financeiro e a sessão de
// caixa contam quem recebeu e quando. Por isso a linha do tempo é composta,
// não lida de uma tabela só.
// ─────────────────────────────────────────────────────────────────────────

import { resumirFinanceiroVenda } from "./venda-financeiro";

type Data = Date | string;

export interface HistoricoInput {
  venda: {
    data: Data;
    saleStatus: string;
    channel: string;
    tipo: string;
    notes: string | null;
    cliente: string;
    formaPagamento: string | null;
    installments: number | null;
    gatewayPaymentId: string | null;
    concretizedAt: Data | null;
    cancelledAt: Data | null;
    refundedAt: Data | null;
    motivoLabel: string;
  };
  timeline: { status: string; note: string | null; data: Data }[];
  lancamentos: {
    tipo: string; categoria: string | null; descricao: string; valor: number;
    status: string; metodoPagamento: string | null; data: Data; sessaoId: string | null;
  }[];
  /** sessaoId → dados da sessão de caixa (código curto + quem abriu). */
  sessoes: Record<string, { codigo: string; abertoPor: string | null }>;
  estoque: {
    type: string; quantity: number; productName: string;
    balanceBefore: number; balanceAfter: number; data: Data; createdByName: string | null;
  }[];
  auditoria: { action: string; nomeUsuario: string | null; data: Data }[];
}

export type TipoEvento =
  | "criada" | "status" | "pagamento" | "finalizada" | "estoque" | "cancelada" | "estorno";

export interface EventoHistorico {
  tipo: TipoEvento;
  titulo: string;
  detalhes: string[];
  /** ISO 8601. */
  data: string;
  /** Quem fez, quando o sistema sabe (operador do caixa, quem estornou...). */
  ator: string | null;
  valor: number | null;
  tom: "ok" | "alerta" | "neutro";
}

const FORMA: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Cartão de crédito", debit: "Cartão de débito",
  mercadopago: "Mercado Pago", misto: "Pagamento misto",
};
const CANAL: Record<string, string> = { pdv: "PDV (frente de caixa)", online: "Loja online" };
const TIPO: Record<string, string> = { delivery: "Entrega", pickup: "Retirada" };

const forma = (f: string | null | undefined) => (f ? (FORMA[f] ?? f) : "forma não informada");
const brl   = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const ms    = (d: Data) => new Date(d).getTime();
const iso   = (d: Data) => new Date(d).toISOString();

// Desempate quando dois eventos caem no mesmo instante (o PDV grava a venda,
// o pagamento e a baixa de estoque com milissegundos de diferença): a ordem
// lógica da história.
const PRIORIDADE: Record<TipoEvento, number> = {
  criada: 0, status: 1, pagamento: 2, estoque: 3, finalizada: 4, cancelada: 5, estorno: 6,
};
const JANELA_SIMULTANEO_MS = 1_500;

export function montarHistoricoVenda(input: HistoricoInput): EventoHistorico[] {
  const { venda, timeline, lancamentos, sessoes, estoque, auditoria } = input;
  const eventos: EventoHistorico[] = [];

  // 1. Criação
  const detalhesCriacao = [
    `Canal: ${CANAL[venda.channel] ?? venda.channel}`,
    `Tipo: ${TIPO[venda.tipo] ?? venda.tipo}`,
  ];
  if (venda.notes?.trim()) detalhesCriacao.push(`Origem: ${venda.notes.trim()}`);
  detalhesCriacao.push(`Cliente: ${venda.cliente}`);
  eventos.push({
    tipo: "criada", titulo: "Venda criada", detalhes: detalhesCriacao,
    data: iso(venda.data), ator: null, valor: null, tom: "neutro",
  });

  // 2. Andamento do pedido (order_timeline). As linhas "Estorno: …" ficam de
  //    fora — o estorno tem evento próprio (com valor e quem fez).
  const estornada = venda.saleStatus === "estornada";
  for (const t of timeline) {
    if (estornada && t.note?.startsWith("Estorno:")) continue;
    eventos.push({
      tipo: "status", titulo: t.note?.trim() || t.status, detalhes: [],
      data: iso(t.data), ator: null, valor: null, tom: "neutro",
    });
  }

  // 3. Pagamento — uma linha por entrada financeira da venda.
  const entradas = lancamentos.filter(l => l.tipo === "entrada" && (l.status === "liquidado" || l.status === "estornado"));
  entradas.forEach((l, i) => {
    const sessao = l.sessaoId ? sessoes[l.sessaoId] : undefined;
    const detalhes: string[] = [];
    if (sessao) detalhes.push(`Caixa: sessão ${sessao.codigo}${sessao.abertoPor ? ` · operador ${sessao.abertoPor}` : ""}`);
    if (i === 0 && venda.installments && venda.installments > 1) detalhes.push(`Parcelas: ${venda.installments}x`);
    if (i === 0 && venda.gatewayPaymentId) detalhes.push(`Gateway de pagamento · ID ${venda.gatewayPaymentId}`);
    detalhes.push(`Lançamento: ${l.descricao}`);
    eventos.push({
      tipo: "pagamento",
      titulo: `Pagamento recebido: ${brl(l.valor)} (${forma(l.metodoPagamento)})`,
      detalhes, data: iso(l.data), ator: sessao?.abertoPor ?? null, valor: l.valor, tom: "ok",
    });
  });

  // 4. Conclusão (baixa real de estoque + lançamento financeiro)
  if (venda.concretizedAt) {
    eventos.push({
      tipo: "finalizada", titulo: "Venda finalizada",
      detalhes: ["Baixa de estoque e lançamento financeiro concluídos"],
      data: iso(venda.concretizedAt), ator: null, valor: null, tom: "ok",
    });
  }

  // 5. Estoque — baixa (VENDA) e devolução (DEVOLUCAO), agrupados por instante
  //    pra uma venda com vários itens não virar dezenas de linhas.
  const grupos = new Map<string, HistoricoInput["estoque"]>();
  for (const m of estoque) {
    if (m.type !== "VENDA" && m.type !== "DEVOLUCAO") continue;
    const chave = `${m.type}:${Math.floor(ms(m.data) / 10_000)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
  }
  for (const itens of grupos.values()) {
    const devolucao = itens[0].type === "DEVOLUCAO";
    const primeiro = itens.reduce((a, b) => (ms(a.data) <= ms(b.data) ? a : b));
    eventos.push({
      tipo: "estoque",
      titulo: devolucao ? "Estoque devolvido" : "Baixa de estoque",
      detalhes: itens.map(i => `${i.quantity}× ${i.productName} (saldo ${i.balanceBefore} → ${i.balanceAfter})`),
      data: iso(primeiro.data),
      ator: itens.find(i => i.createdByName)?.createdByName ?? null,
      valor: null, tom: devolucao ? "alerta" : "neutro",
    });
  }

  // 6. Cancelamento (antes de concretizar)
  if (venda.saleStatus === "cancelada") {
    eventos.push({
      tipo: "cancelada", titulo: "Venda cancelada",
      detalhes: venda.motivoLabel ? [`Motivo: ${venda.motivoLabel}`] : [],
      data: iso(venda.cancelledAt ?? venda.data), ator: null, valor: null, tom: "alerta",
    });
  }

  // 7. Estorno
  const saidaEstorno = lancamentos.find(l => l.tipo === "saida" && l.categoria === "estorno");
  if (estornada || saidaEstorno) {
    const { estornado } = resumirFinanceiroVenda(lancamentos);
    const quemEstornou = auditoria.find(a => a.action === "VENDA_ESTORNAR")?.nomeUsuario ?? null;
    const devolvidos = estoque.filter(m => m.type === "DEVOLUCAO").reduce((s, m) => s + m.quantity, 0);
    const detalhes: string[] = [];
    if (venda.motivoLabel) detalhes.push(`Motivo: ${venda.motivoLabel}`);
    detalhes.push(`Valor devolvido: ${brl(estornado)} (${forma(saidaEstorno?.metodoPagamento ?? venda.formaPagamento)})`);
    if (devolvidos > 0) detalhes.push(`Itens devolvidos ao estoque: ${devolvidos}`);
    eventos.push({
      tipo: "estorno", titulo: `Venda estornada: ${brl(estornado)}`, detalhes,
      data: iso(saidaEstorno?.data ?? venda.refundedAt ?? venda.data),
      ator: quemEstornou, valor: estornado, tom: "alerta",
    });
  }

  // Ordem cronológica; eventos praticamente simultâneos (mesma transação, a
  // poucos ms um do outro — a ordem entre eles variaria de venda pra venda
  // se dependesse só do relógio) seguem a sequência lógica. A janela é curta
  // de propósito: com uma maior, uma cadeia de mudanças de status a cada
  // poucos segundos arrastaria o pagamento pra depois delas.
  const ordenados = [...eventos].sort((a, b) => ms(a.data) - ms(b.data));
  const resultado: EventoHistorico[] = [];
  let grupo: EventoHistorico[] = [];
  const fecharGrupo = () => {
    resultado.push(...grupo.sort((a, b) => PRIORIDADE[a.tipo] - PRIORIDADE[b.tipo] || ms(a.data) - ms(b.data)));
    grupo = [];
  };
  for (const e of ordenados) {
    if (grupo.length && ms(e.data) - ms(grupo[grupo.length - 1].data) > JANELA_SIMULTANEO_MS) fecharGrupo();
    grupo.push(e);
  }
  fecharGrupo();
  return resultado;
}
