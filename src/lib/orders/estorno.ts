// ─────────────────────────────────────────────────────────────────────────
// Motor de estorno de venda — reverte uma venda JÁ finalizada (concretizada):
// desfaz o lançamento financeiro, devolve os itens ao estoque, ajusta a
// sessão de caixa (se ainda aberta) e marca o pedido como `estornada`.
//
// Chamado de três lugares, sempre dentro de uma transação já aberta (`tx`):
//   - updateOrderStatusHandler (Kanban cancela um pedido já finalizado)
//   - financeiro-vendas-handler (botão "Estornar" na tela Vendas)
//   - payment-handler / applyPaymentOutcome (webhook `refunded` do Mercado Pago)
//
// Idempotente pela guarda `saleStatus === 'finalizada'`: chamar de novo num
// pedido já `estornada` não faz nada.
// ─────────────────────────────────────────────────────────────────────────

import { and, eq, sql } from "drizzle-orm";
import { schema } from "@/lib/db";
import { reverseConcretization, type Tx } from "@/lib/inventory/stock-reservation";

const { orders, orderItems, orderTimeline, financeiroLancamentos, caixaSessoes } = schema;

// Motivos padrão + motivoLabel vivem num módulo puro (sem DB) pra poderem
// ser importados também pelo painel.
export { MOTIVOS_CANCELAMENTO, MOTIVOS_ESTORNO, motivoLabel, type MotivoOption } from "./motivos";
import { motivoLabel } from "./motivos";

// ── Mapa forma de pagamento → coluna de total da sessão de caixa ──────────
function colunaCaixa(metodo: string | null | undefined):
  "totalDinheiro" | "totalPix" | "totalCartao" | "totalDebito" | "totalOutros" {
  const m = (metodo || "").toLowerCase();
  if (m.includes("dinheiro") || m === "cash") return "totalDinheiro";
  if (m.includes("pix")) return "totalPix";
  if (m.includes("debit") || m.includes("débito") || m.includes("debito")) return "totalDebito";
  if (m.includes("card") || m.includes("credit") || m.includes("crédito") || m.includes("credito") || m.includes("cartao") || m.includes("cartão")) return "totalCartao";
  return "totalOutros";
}

export interface EstornarVendaParams {
  storeId: string;
  order: {
    id: string;
    number: number;
    total: string;
    saleStatus: string | null;
    cancelledAt: Date | null;
  };
  motivoCode?: string | null;
  motivoNote?: string | null;
  /** Nome do operador/ator, pra timeline e auditoria. */
  atorNome?: string | null;
  now?: Date;
}

export interface EstornoResult {
  jaEstornada: boolean;
  valorEstornado: number;
  itensDevolvidos: number;
  lancamentosEstornados: number;
}

export async function estornarVendaConcretizada(
  tx: Tx,
  { storeId, order, motivoCode, motivoNote, atorNome, now = new Date() }: EstornarVendaParams,
): Promise<EstornoResult> {
  // Guarda de idempotência — só finaliza→estorna. Qualquer outro estado
  // (aberta / cancelada / já estornada) é no-op.
  if (order.saleStatus !== "finalizada") {
    return { jaEstornada: order.saleStatus === "estornada", valorEstornado: 0, itensDevolvidos: 0, lancamentosEstornados: 0 };
  }

  const motivoTxt = motivoLabel(motivoCode, motivoNote);

  // ── 1. Financeiro: marca os lançamentos de entrada da venda como
  //       estornados e lança a saída compensatória (mantém os dois visíveis
  //       na trilha — o DRE/fluxo ignora `status <> 'liquidado'`).
  const lancamentos = await tx
    .select({ id: financeiroLancamentos.id, valor: financeiroLancamentos.valor, metodo: financeiroLancamentos.metodoPagamento, sessaoId: financeiroLancamentos.sessaoId })
    .from(financeiroLancamentos)
    .where(and(
      eq(financeiroLancamentos.storeId, storeId),
      eq(financeiroLancamentos.orderId, order.id),
      eq(financeiroLancamentos.tipo, "entrada"),
      eq(financeiroLancamentos.status, "liquidado"),
    ));

  let valorEstornado = 0;
  for (const l of lancamentos) valorEstornado += parseFloat(l.valor) || 0;
  // Sem lançamento encontrado (venda antiga sem integração): usa o total do pedido.
  if (lancamentos.length === 0) valorEstornado = parseFloat(order.total) || 0;

  const hoje = now.toISOString().split("T")[0];

  if (lancamentos.length > 0) {
    await tx.update(financeiroLancamentos)
      .set({ status: "estornado" })
      .where(and(
        eq(financeiroLancamentos.storeId, storeId),
        eq(financeiroLancamentos.orderId, order.id),
        eq(financeiroLancamentos.tipo, "entrada"),
        eq(financeiroLancamentos.status, "liquidado"),
      ));
  }

  await tx.insert(financeiroLancamentos).values({
    storeId,
    tipo:            "saida",
    categoria:       "estorno",
    descricao:       `Estorno — Pedido #${order.number} — ${motivoTxt}`.slice(0, 250),
    valor:           valorEstornado.toFixed(2),
    metodoPagamento: lancamentos[0]?.metodo ?? null,
    status:          "liquidado",
    dataCompetencia: hoje,
    dataPagamento:   hoje,
    orderId:         order.id,
    sessaoId:        lancamentos.find(l => l.sessaoId)?.sessaoId ?? null,
  });

  // ── 2. Caixa: se o lançamento tinha sessão E ela ainda está aberta,
  //       desconta o valor da forma correspondente e tira 1 da contagem.
  //       Mesmo padrão de update dinâmico do finalizarVendaPdvHandler.
  const COL_EXPR = {
    totalDinheiro: caixaSessoes.totalDinheiro,
    totalPix:      caixaSessoes.totalPix,
    totalCartao:   caixaSessoes.totalCartao,
    totalDebito:   caixaSessoes.totalDebito,
    totalOutros:   caixaSessoes.totalOutros,
  } as const;
  const sessoesTocadas = new Set<string>();
  for (const l of lancamentos) {
    if (!l.sessaoId || sessoesTocadas.has(l.sessaoId)) continue;
    const [sessao] = await tx
      .select({ id: caixaSessoes.id, status: caixaSessoes.status })
      .from(caixaSessoes)
      .where(and(eq(caixaSessoes.id, l.sessaoId), eq(caixaSessoes.storeId, storeId)))
      .limit(1);
    if (!sessao || sessao.status !== "aberta") continue;

    const valorSessao = lancamentos
      .filter(x => x.sessaoId === l.sessaoId)
      .reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
    const col = colunaCaixa(l.metodo);

    const updateSet: Record<string, unknown> = {
      [col]:       sql`GREATEST(0, ${COL_EXPR[col]} - ${valorSessao})`,
      totalVendas: sql`GREATEST(0, ${caixaSessoes.totalVendas} - 1)`,
    };
    await tx.update(caixaSessoes).set(updateSet).where(eq(caixaSessoes.id, l.sessaoId));
    sessoesTocadas.add(l.sessaoId);
  }

  // ── 3. Estoque: devolve os itens (movimento tipo DEVOLUCAO).
  const itens = await tx
    .select({ productId: orderItems.productId, productName: orderItems.productName, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  await reverseConcretization(tx, storeId, itens, order.id, order.number);
  const itensDevolvidos = itens.reduce((s, i) => s + (i.quantity || 0), 0);

  // ── 4. Pedido: marca como estornada + timeline.
  await tx.update(orders)
    .set({
      saleStatus:       "estornada",
      paymentStatus:    "refunded",
      refundedAt:       now,
      cancelledAt:      order.cancelledAt ?? now,
      cancelReasonCode: motivoCode ?? null,
      cancelReason:     motivoNote?.trim() || motivoTxt,
      updatedAt:        now,
    })
    .where(and(eq(orders.id, order.id), eq(orders.storeId, storeId)));

  await tx.insert(orderTimeline).values({
    orderId: order.id,
    status:  "cancelled",
    note:    `Estorno: ${motivoTxt}${atorNome ? ` (por ${atorNome})` : ""}`,
  });

  return {
    jaEstornada: false,
    valorEstornado,
    itensDevolvidos,
    lancamentosEstornados: lancamentos.length,
  };
}
