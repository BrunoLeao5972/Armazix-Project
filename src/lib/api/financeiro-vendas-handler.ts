// ─────────────────────────────────────────────────────────────────────────
// Financeiro → Vendas — histórico rastreável de cada venda: ID, valor que
// entrou, forma, status (Finalizada / Cancelada / Estornada) e o motivo.
// É a leitura que faltava sobre financeiro_lancamentos + orders, e o gatilho
// de estorno pelo módulo financeiro (o Kanban tem o seu próprio, via
// updateOrderStatusHandler — os dois chamam o mesmo motor, src/lib/orders/estorno.ts).
// ─────────────────────────────────────────────────────────────────────────

import { createUnscopedDb, createDbTransactional, schema } from "@/lib/db";
import { and, eq, gte, lte, desc, inArray, isNotNull } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { temPermissao, type StoreRole } from "@/lib/reports-permissions";
import { estornarVendaConcretizada, motivoLabel } from "@/lib/orders/estorno";
import { logFinanceiro, AuditActions, AuditModulos, ResourceTypes } from "@/lib/audit";
import { resumirFinanceiroVenda, type LancamentoResumo } from "@/lib/orders/venda-financeiro";
import { montarHistoricoVenda } from "@/lib/orders/historico-venda";
import { classificarMovimentacao, formatarDataHoraBR, ORIGEM_LABEL } from "@/lib/financeiro/movimentacoes";

const {
  orders, orderItems, orderTimeline, orderPayments, financeiroLancamentos, customers,
  caixaSessoes, stockMovements, auditLogs, coupons, users,
  financeiroContasPagar, financeiroContasReceber,
} = schema;

const JSON_HDR = { "content-type": "application/json" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err  = (msg: string, status = 400) => json({ error: msg }, status);

const PAPEIS_FINANCEIRO = ["admin", "gerente", "financeiro"] as const;
const PAPEIS_ESTORNO    = ["admin", "gerente"] as const;

async function resolve(auth: AuthContext | undefined): Promise<{ storeId: string } | Response> {
  try {
    const access = await requireStoreAccess(auth);
    if (!temPermissao(auth?.storeRole as StoreRole | undefined, PAPEIS_FINANCEIRO)) {
      return err("Sem permissão para acessar o módulo financeiro", 403);
    }
    return { storeId: access.storeId };
  } catch (error) {
    return err((error as Error).message, auth?.userId ? 403 : 401);
  }
}

function parsePeriodo(url: URL): { from: Date; to: Date } {
  const fromStr = url.searchParams.get("from");
  const toStr   = url.searchParams.get("to");
  const to   = toStr   ? new Date(`${toStr}T23:59:59`)   : new Date();
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : new Date(to.getTime() - 30 * 864e5);
  return { from, to };
}

// ─── GET /api/financeiro/vendas ────────────────────────────────────────────
export async function listVendasHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const r = await resolve(auth);
  if (r instanceof Response) return r;
  const { storeId } = r;

  const url = new URL(request.url);
  const { from, to } = parsePeriodo(url);
  const statusFiltro = url.searchParams.get("status"); // finalizada | cancelada | estornada
  const metodoFiltro = url.searchParams.get("metodo");
  const busca = (url.searchParams.get("q") || "").trim().toLowerCase();

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db
      .select({
        id:            orders.id,
        numero:        orders.number,
        data:          orders.createdAt,
        total:         orders.total,
        formaPagamento: orders.paymentMethod,
        saleStatus:    orders.saleStatus,
        statusPedido:  orders.status,
        paymentStatus: orders.paymentStatus,
        motivo:        orders.cancelReason,
        motivoCode:    orders.cancelReasonCode,
        concretizedAt: orders.concretizedAt,
        refundedAt:    orders.refundedAt,
        cliente:       customers.name,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(and(
        eq(orders.storeId, storeId),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to),
        // Só o que teve vida financeira — ignora pedido aberto/em preparo.
        inArray(orders.saleStatus, ["finalizada", "cancelada", "estornada"]),
      ))
      .orderBy(desc(orders.createdAt));

    const ids = rows.map(v => v.id);
    const lancs = ids.length
      ? await db.select({
          orderId:   financeiroLancamentos.orderId,
          tipo:      financeiroLancamentos.tipo,
          categoria: financeiroLancamentos.categoria,
          valor:     financeiroLancamentos.valor,
          status:    financeiroLancamentos.status,
        }).from(financeiroLancamentos)
          .where(and(eq(financeiroLancamentos.storeId, storeId), inArray(financeiroLancamentos.orderId, ids)))
      : [];

    // O estorno deixa dois rastros do MESMO valor (entrada marcada estornada +
    // saída compensatória) — resumirFinanceiroVenda conta cada um uma vez só.
    const porPedido = new Map<string, LancamentoResumo[]>();
    for (const l of lancs) {
      if (!l.orderId) continue;
      const lista = porPedido.get(l.orderId) ?? [];
      lista.push({ tipo: l.tipo, categoria: l.categoria, status: l.status, valor: l.valor });
      porPedido.set(l.orderId, lista);
    }

    let vendas = rows.map(v => {
      const fin = resumirFinanceiroVenda(porPedido.get(v.id) ?? []);
      return {
        id: v.id,
        numero: v.numero,
        data: v.data,
        cliente: v.cliente || "Cliente não identificado",
        total: Number(v.total),
        formaPagamento: v.formaPagamento || "",
        saleStatus: v.saleStatus,
        statusPedido: v.statusPedido,
        motivo: v.motivo || "",
        motivoLabel: v.motivoCode || v.motivo ? motivoLabel(v.motivoCode, v.motivo) : "",
        valorLancado: fin.lancado,
        valorEstornado: fin.estornado,
        concretizedAt: v.concretizedAt,
        refundedAt: v.refundedAt,
      };
    });

    if (statusFiltro) vendas = vendas.filter(v => v.saleStatus === statusFiltro);
    if (metodoFiltro) vendas = vendas.filter(v => v.formaPagamento === metodoFiltro);
    if (busca) vendas = vendas.filter(v =>
      String(v.numero).includes(busca) || v.cliente.toLowerCase().includes(busca));

    const kpis = {
      total: vendas.length,
      finalizadas: vendas.filter(v => v.saleStatus === "finalizada").length,
      canceladas:  vendas.filter(v => v.saleStatus === "cancelada").length,
      estornadas:  vendas.filter(v => v.saleStatus === "estornada").length,
      receitaLiquida: vendas.reduce((s, v) => s + v.valorLancado - v.valorEstornado, 0),
      totalEstornado: vendas.reduce((s, v) => s + v.valorEstornado, 0),
    };

    return json({ vendas, kpis });
  } catch (error) {
    console.error("[financeiro-vendas] list error:", error);
    return err("Erro ao buscar vendas", 500);
  }
}

// ─── GET /api/financeiro/vendas/detalhe?orderId= ───────────────────────────
// Tudo o que se sabe de UMA venda: dados do pedido, itens, pagamento(s),
// caixa, lançamentos financeiros e a linha do tempo completa (criação →
// pagamento → conclusão → possível estorno), montada por montarHistoricoVenda.
export async function detalheVendaHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const r = await resolve(auth);
  if (r instanceof Response) return r;
  const { storeId } = r;

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) return err("orderId é obrigatório", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const [venda] = await db
      .select({
        id: orders.id, numero: orders.number, data: orders.createdAt,
        total: orders.total, subtotal: orders.subtotal, deliveryFee: orders.deliveryFee, discount: orders.discount,
        formaPagamento: orders.paymentMethod, saleStatus: orders.saleStatus, statusPedido: orders.status,
        paymentStatus: orders.paymentStatus, tipo: orders.type, channel: orders.channel, notes: orders.notes,
        installments: orders.installments, cardFeeAmount: orders.cardFeeAmount,
        gatewayPaymentId: orders.gatewayPaymentId, addressSnapshot: orders.addressSnapshot,
        estimatedDelivery: orders.estimatedDelivery, deliveredAt: orders.deliveredAt,
        motivo: orders.cancelReason, motivoCode: orders.cancelReasonCode,
        concretizedAt: orders.concretizedAt, refundedAt: orders.refundedAt, cancelledAt: orders.cancelledAt,
        cliente: customers.name, clientePhone: customers.phone, cupom: coupons.code,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(coupons, eq(orders.couponId, coupons.id))
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (!venda) return err("Venda não encontrada", 404);

    const [itens, timeline, lancamentos, pagamentos, movimentos, auditoria] = await Promise.all([
      db.select({
        nome: orderItems.productName, emoji: orderItems.productEmoji, qtd: orderItems.quantity,
        unit: orderItems.unitPrice, adicionaisTotal: orderItems.additionsTotal,
        adicionais: orderItems.additionsSnapshot, obs: orderItems.notes, total: orderItems.total,
      }).from(orderItems).where(eq(orderItems.orderId, orderId)),
      db.select({ status: orderTimeline.status, note: orderTimeline.note, data: orderTimeline.createdAt })
        .from(orderTimeline).where(eq(orderTimeline.orderId, orderId)).orderBy(orderTimeline.createdAt),
      db.select({
        tipo: financeiroLancamentos.tipo, categoria: financeiroLancamentos.categoria,
        descricao: financeiroLancamentos.descricao, valor: financeiroLancamentos.valor,
        status: financeiroLancamentos.status, metodoPagamento: financeiroLancamentos.metodoPagamento,
        sessaoId: financeiroLancamentos.sessaoId, data: financeiroLancamentos.createdAt,
      }).from(financeiroLancamentos)
        .where(and(eq(financeiroLancamentos.storeId, storeId), eq(financeiroLancamentos.orderId, orderId)))
        .orderBy(financeiroLancamentos.createdAt),
      db.select({ forma: orderPayments.formaPagamento, valor: orderPayments.valor, data: orderPayments.createdAt })
        .from(orderPayments)
        .where(and(eq(orderPayments.storeId, storeId), eq(orderPayments.orderId, orderId)))
        .orderBy(orderPayments.createdAt),
      db.select({
        type: stockMovements.type, quantity: stockMovements.quantity, productName: stockMovements.productName,
        balanceBefore: stockMovements.balanceBefore, balanceAfter: stockMovements.balanceAfter,
        data: stockMovements.createdAt, createdByName: stockMovements.createdByName,
      }).from(stockMovements)
        .where(and(eq(stockMovements.storeId, storeId), eq(stockMovements.orderId, orderId)))
        .orderBy(stockMovements.createdAt),
      db.select({
        action: auditLogs.action, nomeUsuario: auditLogs.nomeUsuario, userId: auditLogs.userId, data: auditLogs.createdAt,
      }).from(auditLogs)
        .where(and(
          eq(auditLogs.storeId, storeId),
          eq(auditLogs.resourceType, ResourceTypes.ORDER),
          eq(auditLogs.resourceId, orderId),
        ))
        .orderBy(auditLogs.createdAt),
    ]);

    // Sessões de caixa citadas pelos lançamentos (código curto + operador).
    const sessaoIds = [...new Set(lancamentos.map(l => l.sessaoId).filter((x): x is string => !!x))];
    const sessoesRows = sessaoIds.length
      ? await db.select({
          id: caixaSessoes.id, codigo: caixaSessoes.codigo, abertoPor: caixaSessoes.abertoPor,
          encerradoPor: caixaSessoes.encerradoPor, status: caixaSessoes.status,
          openedAt: caixaSessoes.openedAt, closedAt: caixaSessoes.closedAt,
        }).from(caixaSessoes).where(and(eq(caixaSessoes.storeId, storeId), inArray(caixaSessoes.id, sessaoIds)))
      : [];

    // Auditorias antigas guardam só o userId — resolve o nome pra mostrar
    // "quem estornou" também em estornos feitos antes desse histórico existir.
    const semNome = [...new Set(auditoria.filter(a => !a.nomeUsuario && a.userId).map(a => a.userId!))];
    const nomes = semNome.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, semNome))
      : [];
    const nomePorId = new Map(nomes.map(n => [n.id, n.name]));
    const auditoriaComNome = auditoria.map(a => ({
      action: a.action, data: a.data,
      nomeUsuario: a.nomeUsuario ?? (a.userId ? nomePorId.get(a.userId) ?? null : null),
    }));

    const lancNum = lancamentos.map(l => ({ ...l, valor: Number(l.valor) }));
    const fin = resumirFinanceiroVenda(lancNum);
    const motivoTxt = venda.motivoCode || venda.motivo ? motivoLabel(venda.motivoCode, venda.motivo) : "";
    const clienteNome = venda.cliente || "Cliente não identificado";
    const sessoes = Object.fromEntries(sessoesRows.map(s => [s.id, { codigo: s.codigo, abertoPor: s.abertoPor }]));

    const historico = montarHistoricoVenda({
      venda: {
        data: venda.data, saleStatus: venda.saleStatus, channel: venda.channel, tipo: venda.tipo,
        notes: venda.notes, cliente: clienteNome, formaPagamento: venda.formaPagamento,
        installments: venda.installments, gatewayPaymentId: venda.gatewayPaymentId,
        concretizedAt: venda.concretizedAt, cancelledAt: venda.cancelledAt, refundedAt: venda.refundedAt,
        motivoLabel: motivoTxt,
      },
      timeline,
      lancamentos: lancNum,
      sessoes,
      estoque: movimentos,
      auditoria: auditoriaComNome,
    });

    return json({
      venda: {
        ...venda,
        cliente: clienteNome,
        total: Number(venda.total),
        motivoLabel: motivoTxt,
        valorLancado: fin.lancado,
        valorEstornado: fin.estornado,
        valorLiquido: fin.liquido,
      },
      itens: itens.map(i => ({
        ...i, qtd: i.qtd, unit: Number(i.unit), adicionaisTotal: Number(i.adicionaisTotal ?? 0), total: Number(i.total),
      })),
      timeline,
      lancamentos: lancNum.map(l => ({ ...l, sessaoCodigo: l.sessaoId ? sessoes[l.sessaoId]?.codigo ?? null : null })),
      pagamentos: pagamentos.map(p => ({ ...p, valor: Number(p.valor) })),
      caixa: sessoesRows,
      historico,
    });
  } catch (error) {
    console.error("[financeiro-vendas] detalhe error:", error);
    return err("Erro ao buscar detalhe da venda", 500);
  }
}

// ─── POST /api/financeiro/vendas/estornar ──────────────────────────────────
export async function estornarVendaHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const r = await resolve(auth);
  if (r instanceof Response) return r;
  const { storeId } = r;

  if (!temPermissao(auth?.storeRole as StoreRole | undefined, PAPEIS_ESTORNO)) {
    return err("Só administrador ou gerente pode estornar uma venda", 403);
  }

  const body = await request.json() as { orderId?: string; motivoCode?: string; motivoNote?: string };
  if (!body.orderId) return err("orderId é obrigatório", 400);

  const db = createDbTransactional(process.env.DATABASE_URL!);
  try {
    const [venda] = await db
      .select({
        id: orders.id, number: orders.number, total: orders.total,
        saleStatus: orders.saleStatus, cancelledAt: orders.cancelledAt,
      })
      .from(orders)
      .where(and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (!venda) return err("Venda não encontrada", 404);
    if (venda.saleStatus === "estornada") return err("Esta venda já foi estornada", 409);
    if (venda.saleStatus !== "finalizada") {
      return err("Só é possível estornar uma venda finalizada", 409);
    }

    // Quem está estornando — vai pra timeline do pedido e pro log de auditoria
    // (o histórico da venda mostra "por <nome>").
    const [ator] = auth?.userId
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, auth.userId)).limit(1)
      : [];

    const resultado = await db.transaction(async (tx) =>
      estornarVendaConcretizada(tx, {
        storeId,
        order: venda,
        motivoCode: body.motivoCode ?? null,
        motivoNote: body.motivoNote ?? null,
        atorNome: ator?.name ?? null,
        now: new Date(),
      }),
    );

    logFinanceiro({
      action:       AuditActions.VENDA_ESTORNAR,
      modulo:       AuditModulos.FINANCEIRO_VENDAS,
      resourceType: ResourceTypes.ORDER,
      resourceId:   venda.id,
      userId:       auth?.userId,
      nomeUsuario:  ator?.name,
      storeId,
      dadosNovos: {
        numero:          venda.number,
        motivo:          motivoLabel(body.motivoCode, body.motivoNote),
        valorEstornado:  resultado.valorEstornado,
        itensDevolvidos: resultado.itensDevolvidos,
        origem:          "financeiro",
      },
    }, request);

    return json({ success: true, ...resultado });
  } catch (error) {
    console.error("[financeiro-vendas] estornar error:", error);
    return err("Erro ao estornar a venda", 500);
  }
}

// ─── GET /api/financeiro/movimentacoes ─────────────────────────────────────
// Implementa a rota que getFinanceiroMovimentacoes() já chamava e nunca
// existiu — destrava Dashboard/Movimentações do Financeiro (ficavam vazios).
export async function listMovimentacoesHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const r = await resolve(auth);
  if (r instanceof Response) return r;
  const { storeId } = r;

  const url = new URL(request.url);
  const { from, to } = parsePeriodo(url);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db
      .select({
        id: financeiroLancamentos.id,
        tipo: financeiroLancamentos.tipo,
        categoria: financeiroLancamentos.categoria,
        desc: financeiroLancamentos.descricao,
        valor: financeiroLancamentos.valor,
        metodoPagamento: financeiroLancamentos.metodoPagamento,
        status: financeiroLancamentos.status,
        data: financeiroLancamentos.dataCompetencia,
        createdAt: financeiroLancamentos.createdAt,
        orderId: financeiroLancamentos.orderId,
      })
      .from(financeiroLancamentos)
      .where(and(
        eq(financeiroLancamentos.storeId, storeId),
        gte(financeiroLancamentos.createdAt, from),
        lte(financeiroLancamentos.createdAt, to),
      ))
      .orderBy(desc(financeiroLancamentos.createdAt));

    // Quais lançamentos são o pagamento/recebimento de uma conta — é o vínculo
    // contas_pagar.lancamento_id / contas_receber.lancamento_id (gravado ao
    // efetivar) que separa "conta paga" de qualquer outra saída.
    const [pagas, recebidas] = await Promise.all([
      db.select({ id: financeiroContasPagar.lancamentoId }).from(financeiroContasPagar)
        .where(and(eq(financeiroContasPagar.storeId, storeId), isNotNull(financeiroContasPagar.lancamentoId))),
      db.select({ id: financeiroContasReceber.lancamentoId }).from(financeiroContasReceber)
        .where(and(eq(financeiroContasReceber.storeId, storeId), isNotNull(financeiroContasReceber.lancamentoId))),
    ]);
    const idsPagos = new Set(pagas.map(x => x.id));
    const idsRecebidos = new Set(recebidas.map(x => x.id));

    return json(rows.map(m => {
      const origemTipo = classificarMovimentacao({
        tipo: m.tipo, categoria: m.categoria, orderId: m.orderId,
        contaPaga: idsPagos.has(m.id), contaRecebida: idsRecebidos.has(m.id),
      });
      return {
        id: m.id,
        tipo: m.tipo,
        categoria: m.categoria || "",
        desc: m.desc,
        valor: Number(m.valor),
        formaPgto: m.metodoPagamento || "",
        responsavel: "",
        status: m.status,
        // dd/mm/aaaa hh:mm (Brasília): é o formato que Dashboard e
        // Movimentações leem (parseMovData) pra filtrar por período e montar
        // o gráfico por mês — com a data ISO o filtro nunca casava.
        data: formatarDataHoraBR(m.createdAt),
        origem: ORIGEM_LABEL[origemTipo],
        origemTipo,
        orderId: m.orderId,
      };
    }));
  } catch (error) {
    console.error("[financeiro-vendas] movimentacoes error:", error);
    return err("Erro ao buscar movimentações", 500);
  }
}
