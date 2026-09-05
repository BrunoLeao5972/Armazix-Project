// ─────────────────────────────────────────────────────────────────────────
// Relatórios reais da Central de Relatórios (/admin/relatorios) — os 7
// marcados `destaque: true` no catálogo. Cada handler segue o mesmo padrão
// já usado em getReportsStatsHandler/getFinancialStatsHandler
// (stock-handler.ts): requireStoreAccess → createUnscopedDb → queries com
// eq(tabela.storeId, storeId) explícito em cada uma (o driver unscoped não
// aplica RLS, o isolamento de tenant é manual em cada query).
// ─────────────────────────────────────────────────────────────────────────

import { createUnscopedDb, schema } from "@/lib/db";
import { eq, and, gte, lte, ne, desc, sql, inArray } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { CRITICAL_AUDIT_ACTIONS } from "@/lib/audit";

const { products, orders, orderItems, customers, financeiroLancamentos, auditLogs } = schema;

const JSON_HDR = { "content-type": "application/json" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err  = (msg: string, status = 400) => json({ error: msg }, status);

async function resolveStoreId(auth?: AuthContext): Promise<{ storeId: string } | Response> {
  try {
    return { storeId: (await requireStoreAccess(auth)).storeId };
  } catch (error) {
    return err((error as Error).message, auth?.userId ? 403 : 401);
  }
}

// Período padrão (últimos 30 dias) quando o filtro não é informado — os
// mesmos nomes de query param usados pelo drawer em relatorios.tsx.
function parseDateRange(url: URL): { from: Date; to: Date; fromStr: string; toStr: string } {
  const di = url.searchParams.get("dataInicio");
  const df = url.searchParams.get("dataFim");
  const to = df ? new Date(`${df}T23:59:59.999`) : new Date();
  const from = di ? new Date(`${di}T00:00:00`) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to, fromStr: from.toISOString().slice(0, 10), toStr: to.toISOString().slice(0, 10) };
}

// ─── GET /api/reports/estoque-baixo ─────────────────────────────────────────
// Sem filtro de período — é um alerta do estado atual do estoque, não uma
// consulta histórica. Mesma condição já usada em getStockStatsHandler
// (stock-handler.ts), sem o .limit(5) que existe lá (aqui é a lista cheia).
export async function getEstoqueBaixoHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select({
      id: products.id, nome: products.name, sku: products.sku,
      estoqueAtual: products.stock, estoqueMinimo: products.lowStockThreshold,
    })
      .from(products)
      .where(and(
        eq(products.storeId, storeId),
        sql`coalesce(${products.active}, true) = true`,
        sql`coalesce(${products.stock}, 0) < coalesce(${products.lowStockThreshold}, 5)`,
      ))
      .orderBy(sql`coalesce(${products.stock}, 0) - coalesce(${products.lowStockThreshold}, 5) asc`);

    return json({
      produtos: rows.map(p => ({
        id: p.id, nome: p.nome, sku: p.sku,
        estoqueAtual: p.estoqueAtual ?? 0, estoqueMinimo: p.estoqueMinimo ?? 5,
      })),
    });
  } catch (error) {
    console.error("[reports] estoque-baixo error:", error);
    return err("Erro ao buscar produtos com estoque baixo", 500);
  }
}

// ─── GET /api/reports/clientes-top?dataInicio&dataFim ───────────────────────
export async function getClientesTopHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const { from, to } = parseDateRange(new URL(request.url));
  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select({
      id:         orders.customerId,
      nome:       customers.name,
      pedidos:    sql<number>`cast(count(*) as int)`,
      totalGasto: sql<number>`coalesce(sum(cast(${orders.total} as numeric)), 0)`,
    })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(and(
        eq(orders.storeId, storeId),
        ne(orders.status, "cancelled"),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to),
      ))
      .groupBy(orders.customerId, customers.name)
      .orderBy(desc(sql`sum(cast(${orders.total} as numeric))`))
      .limit(50);

    const clientes = rows.map(r => ({
      id: r.id, nome: r.nome, pedidos: r.pedidos, totalGasto: r.totalGasto,
      ticketMedio: r.pedidos > 0 ? r.totalGasto / r.pedidos : 0,
    }));

    return json({ clientes });
  } catch (error) {
    console.error("[reports] clientes-top error:", error);
    return err("Erro ao buscar ranking de clientes", 500);
  }
}

// ─── GET /api/reports/produtos-lucrativos?dataInicio&dataFim ────────────────
// products.costPrice é opcional — produtos sem custo cadastrado não entram
// no ranking de margem (não dá pra calcular lucro sem custo), mas aparecem
// à parte pra não sumir silenciosamente do relatório.
export async function getProdutosLucrativosHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const { from, to } = parseDateRange(new URL(request.url));
  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select({
      productId: orderItems.productId,
      nome:      orderItems.productName,
      qtd:       sql<number>`cast(sum(${orderItems.quantity}) as int)`,
      receita:   sql<number>`coalesce(sum(cast(${orderItems.total} as numeric)), 0)`,
      custoUnit: products.costPrice,
    })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(and(
        eq(orders.storeId, storeId),
        ne(orders.status, "cancelled"),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to),
      ))
      .groupBy(orderItems.productId, orderItems.productName, products.costPrice);

    const comCusto: Array<{ id: string | null; nome: string; qtd: number; receita: number; custoTotal: number; margem: number; margemPct: number }> = [];
    const semCusto: Array<{ id: string | null; nome: string; qtd: number; receita: number }> = [];

    for (const r of rows) {
      if (r.custoUnit != null) {
        const custoTotal = Number(r.custoUnit) * r.qtd;
        const margem = r.receita - custoTotal;
        comCusto.push({
          id: r.productId, nome: r.nome, qtd: r.qtd, receita: r.receita, custoTotal, margem,
          margemPct: r.receita > 0 ? (margem / r.receita) * 100 : 0,
        });
      } else {
        semCusto.push({ id: r.productId, nome: r.nome, qtd: r.qtd, receita: r.receita });
      }
    }
    comCusto.sort((a, b) => b.margem - a.margem);
    semCusto.sort((a, b) => b.receita - a.receita);

    return json({ comCusto, semCusto });
  } catch (error) {
    console.error("[reports] produtos-lucrativos error:", error);
    return err("Erro ao buscar ranking de produtos por margem", 500);
  }
}

// ─── GET /api/reports/vendas-periodo?dataInicio&dataFim&clienteId&formaPagamento&status ──
export async function getVendasPeriodoHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const clienteId      = url.searchParams.get("clienteId");
  const formaPagamento = url.searchParams.get("formaPagamento");
  const status         = url.searchParams.get("status");

  const conditions = [eq(orders.storeId, storeId), gte(orders.createdAt, from), lte(orders.createdAt, to)];
  if (clienteId)      conditions.push(eq(orders.customerId, clienteId));
  if (formaPagamento) conditions.push(eq(orders.paymentMethod, formaPagamento));
  if (status)          conditions.push(eq(orders.status, status));
  else                 conditions.push(ne(orders.status, "cancelled"));

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select({
      createdAt: orders.createdAt, total: orders.total, status: orders.status, paymentMethod: orders.paymentMethod,
    }).from(orders).where(and(...conditions));

    const totalVendido = rows.reduce((s, o) => s + parseFloat(o.total || "0"), 0);
    const numPedidos   = rows.length;
    const ticketMedio  = numPedidos > 0 ? totalVendido / numPedidos : 0;

    const porDia = new Map<string, { vendas: number; pedidos: number }>();
    for (const o of rows) {
      const dia = new Date(o.createdAt).toISOString().slice(0, 10);
      const cur = porDia.get(dia) ?? { vendas: 0, pedidos: 0 };
      cur.vendas += parseFloat(o.total || "0"); cur.pedidos += 1;
      porDia.set(dia, cur);
    }
    const serie = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, v]) => ({ data, ...v }));

    const porForma = new Map<string, number>();
    const porStatus = new Map<string, number>();
    for (const o of rows) {
      const forma = o.paymentMethod ?? "outro";
      porForma.set(forma, (porForma.get(forma) ?? 0) + 1);
      porStatus.set(o.status, (porStatus.get(o.status) ?? 0) + 1);
    }

    return json({
      kpis: { totalVendido, numPedidos, ticketMedio },
      serie,
      porFormaPagamento: [...porForma.entries()].map(([forma, count]) => ({ forma, count })),
      porStatus: [...porStatus.entries()].map(([status, count]) => ({ status, count })),
    });
  } catch (error) {
    console.error("[reports] vendas-periodo error:", error);
    return err("Erro ao buscar vendas do período", 500);
  }
}

// ─── GET /api/reports/fluxo-caixa?dataInicio&dataFim&categoria ──────────────
// Lê financeiro_lancamentos de verdade — hoje só existem lançamentos de
// entrada (vendas de PDV/encomenda concretizada); nenhum fluxo do sistema
// grava saída ainda, então o total de saídas será honestamente 0 até esse
// recurso existir (fora de escopo aqui — ver plano).
export async function getFluxoCaixaHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { fromStr, toStr } = parseDateRange(url);
  const categoria = url.searchParams.get("categoria");

  const conditions = [
    eq(financeiroLancamentos.storeId, storeId),
    sql`${financeiroLancamentos.dataCompetencia} >= ${fromStr}`,
    sql`${financeiroLancamentos.dataCompetencia} <= ${toStr}`,
  ];
  if (categoria) conditions.push(eq(financeiroLancamentos.categoria, categoria));

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select({
      tipo: financeiroLancamentos.tipo, valor: financeiroLancamentos.valor,
      dataCompetencia: financeiroLancamentos.dataCompetencia,
      categoria: financeiroLancamentos.categoria, descricao: financeiroLancamentos.descricao,
    }).from(financeiroLancamentos).where(and(...conditions)).orderBy(financeiroLancamentos.dataCompetencia);

    let totalEntradas = 0, totalSaidas = 0;
    const porDia = new Map<string, { entradas: number; saidas: number }>();
    for (const r of rows) {
      const cur = porDia.get(r.dataCompetencia) ?? { entradas: 0, saidas: 0 };
      const v = parseFloat(r.valor || "0");
      if (r.tipo === "entrada") { cur.entradas += v; totalEntradas += v; } else { cur.saidas += v; totalSaidas += v; }
      porDia.set(r.dataCompetencia, cur);
    }
    let saldoAcumulado = 0;
    const serie = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, v]) => {
      saldoAcumulado += v.entradas - v.saidas;
      return { data, entradas: v.entradas, saidas: v.saidas, saldoAcumulado };
    });

    return json({
      kpis: { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas },
      serie,
      lancamentos: rows,
      avisoSaidas: totalSaidas === 0
        ? "Nenhuma saída registrada no período — o sistema ainda não tem um fluxo de lançamento de despesas."
        : null,
    });
  } catch (error) {
    console.error("[reports] fluxo-caixa error:", error);
    return err("Erro ao buscar fluxo de caixa", 500);
  }
}

// ─── GET /api/reports/lucro-bruto-liquido?dataInicio&dataFim&categoria ──────
// Lucro Bruto = receita − CMV (custo ATUAL do produto × quantidade vendida —
// não há snapshot do custo no momento da venda, então é uma aproximação,
// sinalizada no retorno). Lucro Líquido = Lucro Bruto − despesas
// (financeiro_lancamentos tipo "saida" — hoje sempre 0, mesma ressalva do
// Fluxo de Caixa).
export async function getLucroBrutoLiquidoHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to, fromStr, toStr } = parseDateRange(url);
  const categoria = url.searchParams.get("categoria");

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const itemRows = await db.select({
      qtd: orderItems.quantity, total: orderItems.total, custoUnit: products.costPrice,
    })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(and(
        eq(orders.storeId, storeId), ne(orders.status, "cancelled"),
        gte(orders.createdAt, from), lte(orders.createdAt, to),
      ));

    let receita = 0, cmv = 0, receitaSemCusto = 0;
    for (const r of itemRows) {
      const t = parseFloat(r.total || "0");
      receita += t;
      if (r.custoUnit != null) cmv += Number(r.custoUnit) * r.qtd;
      else receitaSemCusto += t;
    }
    const lucroBruto = receita - cmv;

    const despesaConditions = [
      eq(financeiroLancamentos.storeId, storeId),
      eq(financeiroLancamentos.tipo, "saida"),
      sql`${financeiroLancamentos.dataCompetencia} >= ${fromStr}`,
      sql`${financeiroLancamentos.dataCompetencia} <= ${toStr}`,
    ];
    if (categoria) despesaConditions.push(eq(financeiroLancamentos.categoria, categoria));
    const despesaRows = await db.select({ valor: financeiroLancamentos.valor })
      .from(financeiroLancamentos).where(and(...despesaConditions));
    const despesas = despesaRows.reduce((s, r) => s + parseFloat(r.valor || "0"), 0);

    const lucroLiquido  = lucroBruto - despesas;
    const margemBruta   = receita > 0 ? (lucroBruto / receita) * 100 : 0;
    const margemLiquida = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

    return json({
      receita, cmv, lucroBruto, despesas, lucroLiquido, margemBruta, margemLiquida,
      avisoCmv: receitaSemCusto > 0
        ? `R$ ${receitaSemCusto.toFixed(2)} em vendas de produtos sem custo cadastrado — o CMV pode estar subestimado.`
        : null,
      avisoDespesas: despesas === 0
        ? "Nenhuma despesa registrada no período — o sistema ainda não tem um fluxo de lançamento de despesas."
        : null,
    });
  } catch (error) {
    console.error("[reports] lucro-bruto-liquido error:", error);
    return err("Erro ao calcular lucro bruto e líquido", 500);
  }
}

// ─── GET /api/reports/logs-criticos?dataInicio&dataFim&userId&status ────────
// CRITICAL_AUDIT_ACTIONS (src/lib/audit/index.ts) já é curada pra nunca
// incluir MERCHANT_HIDDEN_ACTIONS (ex: IMPERSONATE) — não precisa de um
// filtro adicional aqui.
export async function getLogsCriticosHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const userId = url.searchParams.get("userId");
  const status = url.searchParams.get("status");

  const conditions = [
    eq(auditLogs.storeId, storeId),
    gte(auditLogs.createdAt, from),
    lte(auditLogs.createdAt, to),
    inArray(auditLogs.action, CRITICAL_AUDIT_ACTIONS as string[]),
  ];
  if (userId) conditions.push(eq(auditLogs.userId, userId));
  if (status) conditions.push(eq(auditLogs.status, status));

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select().from(auditLogs)
      .where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(200);

    return json({
      logs: rows.map(l => ({
        id: l.id, dataHora: l.createdAt, usuario: l.nomeUsuario ?? "—", acao: l.action,
        modulo: l.modulo, status: l.status, recursoTipo: l.resourceType, recursoId: l.resourceId,
        dadosAnteriores: l.dadosAnteriores, dadosNovos: l.dadosNovos,
      })),
    });
  } catch (error) {
    console.error("[reports] logs-criticos error:", error);
    return err("Erro ao buscar logs de alterações críticas", 500);
  }
}

// ─── GET /api/reports/categorias-financeiro ─────────────────────────────────
// Alimenta o filtro "histórico" (categoria) do drawer em Fluxo de Caixa e
// Lucro Bruto/Líquido — categoria é string livre em financeiro_lancamentos
// (não existe tabela de plano de contas), então isso é sempre um DISTINCT
// dos valores já usados pela própria loja.
export async function getCategoriasFinanceiroHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.selectDistinct({ categoria: financeiroLancamentos.categoria })
      .from(financeiroLancamentos).where(eq(financeiroLancamentos.storeId, storeId));
    return json({ categorias: rows.map(r => r.categoria).filter((c): c is string => !!c) });
  } catch (error) {
    console.error("[reports] categorias-financeiro error:", error);
    return err("Erro ao buscar categorias financeiras", 500);
  }
}
