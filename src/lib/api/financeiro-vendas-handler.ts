// ─────────────────────────────────────────────────────────────────────────
// Financeiro → Vendas — histórico rastreável de cada venda: ID, valor que
// entrou, forma, status (Finalizada / Cancelada / Estornada) e o motivo.
// É a leitura que faltava sobre financeiro_lancamentos + orders, e o gatilho
// de estorno pelo módulo financeiro (o Kanban tem o seu próprio, via
// updateOrderStatusHandler — os dois chamam o mesmo motor, src/lib/orders/estorno.ts).
// ─────────────────────────────────────────────────────────────────────────

import { createUnscopedDb, createDbTransactional, schema } from "@/lib/db";
import { and, eq, gte, lte, desc, inArray } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { temPermissao, type StoreRole } from "@/lib/reports-permissions";
import { estornarVendaConcretizada, motivoLabel } from "@/lib/orders/estorno";
import { logFinanceiro, AuditActions, AuditModulos, ResourceTypes } from "@/lib/audit";

const { orders, orderItems, orderTimeline, financeiroLancamentos, customers } = schema;

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

    const porPedido = new Map<string, { lancado: number; estornado: number }>();
    for (const l of lancs) {
      if (!l.orderId) continue;
      const acc = porPedido.get(l.orderId) ?? { lancado: 0, estornado: 0 };
      const v = parseFloat(l.valor) || 0;
      if (l.tipo === "entrada" && l.status === "liquidado") acc.lancado += v;
      if (l.categoria === "estorno" || l.status === "estornado") acc.estornado += v;
      porPedido.set(l.orderId, acc);
    }

    let vendas = rows.map(v => {
      const fin = porPedido.get(v.id) ?? { lancado: 0, estornado: 0 };
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
        paymentStatus: orders.paymentStatus, tipo: orders.type,
        motivo: orders.cancelReason, motivoCode: orders.cancelReasonCode,
        concretizedAt: orders.concretizedAt, refundedAt: orders.refundedAt, cancelledAt: orders.cancelledAt,
        cliente: customers.name, clientePhone: customers.phone,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (!venda) return err("Venda não encontrada", 404);

    const [itens, timeline, lancamentos] = await Promise.all([
      db.select({ nome: orderItems.productName, qtd: orderItems.quantity, unit: orderItems.unitPrice, total: orderItems.total })
        .from(orderItems).where(eq(orderItems.orderId, orderId)),
      db.select({ status: orderTimeline.status, note: orderTimeline.note, data: orderTimeline.createdAt })
        .from(orderTimeline).where(eq(orderTimeline.orderId, orderId)).orderBy(orderTimeline.createdAt),
      db.select({
        tipo: financeiroLancamentos.tipo, categoria: financeiroLancamentos.categoria,
        descricao: financeiroLancamentos.descricao, valor: financeiroLancamentos.valor,
        status: financeiroLancamentos.status, metodoPagamento: financeiroLancamentos.metodoPagamento,
        data: financeiroLancamentos.createdAt,
      }).from(financeiroLancamentos)
        .where(and(eq(financeiroLancamentos.storeId, storeId), eq(financeiroLancamentos.orderId, orderId)))
        .orderBy(financeiroLancamentos.createdAt),
    ]);

    return json({
      venda: {
        ...venda,
        cliente: venda.cliente || "Cliente não identificado",
        total: Number(venda.total),
        motivoLabel: venda.motivoCode || venda.motivo ? motivoLabel(venda.motivoCode, venda.motivo) : "",
      },
      itens: itens.map(i => ({ ...i, qtd: i.qtd, unit: Number(i.unit), total: Number(i.total) })),
      timeline,
      lancamentos: lancamentos.map(l => ({ ...l, valor: Number(l.valor) })),
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

    const resultado = await db.transaction(async (tx) =>
      estornarVendaConcretizada(tx, {
        storeId,
        order: venda,
        motivoCode: body.motivoCode ?? null,
        motivoNote: body.motivoNote ?? null,
        now: new Date(),
      }),
    );

    logFinanceiro({
      action:       AuditActions.VENDA_ESTORNAR,
      modulo:       AuditModulos.FINANCEIRO_VENDAS,
      resourceType: ResourceTypes.ORDER,
      resourceId:   venda.id,
      userId:       auth?.userId,
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

    return json(rows.map(m => ({
      id: m.id,
      tipo: m.tipo,
      categoria: m.categoria || "",
      desc: m.desc,
      valor: Number(m.valor),
      formaPgto: m.metodoPagamento || "",
      responsavel: "",
      status: m.status,
      data: m.data,
      orderId: m.orderId,
    })));
  } catch (error) {
    console.error("[financeiro-vendas] movimentacoes error:", error);
    return err("Erro ao buscar movimentações", 500);
  }
}
