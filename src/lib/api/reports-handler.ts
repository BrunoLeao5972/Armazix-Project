// ─────────────────────────────────────────────────────────────────────────
// Relatórios reais da Central de Relatórios (/admin/relatorios) — os 7
// marcados `destaque: true` no catálogo. Cada handler usa
// createTenantDbTransactional (RLS real via role armazix_tenant, sem
// BYPASSRLS) + setTenantContext(storeId) como primeira instrução da
// transação — eq(tabela.storeId, storeId) continua explícito em cada query
// como defesa em profundidade, mas a proteção de verdade agora também vem
// do banco, não só do filtro manual (auditoria de segurança, achado F4;
// RLS cobre products/orders/orderItems/customers/auditLogs desde
// drizzle/0030_rls_activate.sql, e financeiro_lancamentos desde
// drizzle/0045_rls_financeiro_lancamentos.sql).
// ─────────────────────────────────────────────────────────────────────────

import { createTenantDbTransactional, setTenantContext, schema } from "@/lib/db";
import { eq, and, gte, lte, ne, desc, asc, sql, inArray, isNotNull } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { CRITICAL_AUDIT_ACTIONS } from "@/lib/audit";
import { REPORT_REQUIRED_ROLES, temPermissao, type StoreRole } from "@/lib/reports-permissions";

const {
  products, orders, orderItems, customers, financeiroLancamentos, auditLogs,
  stockMovements, stockBalances, categories, caixaSessoes,
} = schema;

const JSON_HDR = { "content-type": "application/json" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err  = (msg: string, status = 400) => json({ error: msg }, status);

// Checa storeId (requireStoreAccess) e, em seguida, se o papel do usuário
// nesta loja está na lista de REPORT_REQUIRED_ROLES do relatório `reportId`
// — o mesmo mapeamento que o catálogo do frontend usa (src/lib/reports-permissions.ts),
// pra nunca dar acesso por API a um relatório que a UI já modela como
// restrito. Auditoria de segurança, achado F2.
async function resolveStoreId(auth: AuthContext | undefined, reportId: string): Promise<{ storeId: string } | Response> {
  try {
    const access = await requireStoreAccess(auth);
    const required = REPORT_REQUIRED_ROLES[reportId] ?? [];
    if (!temPermissao(auth?.storeRole as StoreRole | undefined, required)) {
      return err("Sem permissão para acessar este relatório", 403);
    }
    return { storeId: access.storeId };
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
  const resolved = await resolveStoreId(auth, "est-005");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
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
    });

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
  const resolved = await resolveStoreId(auth, "cli-002");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const { from, to } = parseDateRange(new URL(request.url));
  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
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
    });

    const clientes = rows.map(r => {
      // sql<number> é só type assertion — o driver Postgres devolve NUMERIC
      // como string em runtime. Sem o Number() aqui, o front recebia
      // totalGasto como string e quebrava ao formatar (fmtBRL chamando
      // .toFixed em string).
      const totalGasto = Number(r.totalGasto);
      return { id: r.id, nome: r.nome, pedidos: r.pedidos, totalGasto, ticketMedio: r.pedidos > 0 ? totalGasto / r.pedidos : 0 };
    });

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
  const resolved = await resolveStoreId(auth, "prod-003");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const { from, to } = parseDateRange(new URL(request.url));
  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
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
    });

    const comCusto: Array<{ id: string | null; nome: string; qtd: number; receita: number; custoTotal: number; margem: number; margemPct: number }> = [];
    const semCusto: Array<{ id: string | null; nome: string; qtd: number; receita: number }> = [];

    for (const r of rows) {
      // sql<number> é só type assertion — o driver Postgres devolve NUMERIC
      // como string em runtime. Sem o Number() aqui, o front recebia
      // receita como string e quebrava ao formatar (fmtBRL chamando
      // .toFixed em string).
      const receita = Number(r.receita);
      if (r.custoUnit != null) {
        const custoTotal = Number(r.custoUnit) * r.qtd;
        const margem = receita - custoTotal;
        comCusto.push({
          id: r.productId, nome: r.nome, qtd: r.qtd, receita, custoTotal, margem,
          margemPct: receita > 0 ? (margem / receita) * 100 : 0,
        });
      } else {
        semCusto.push({ id: r.productId, nome: r.nome, qtd: r.qtd, receita });
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
  const resolved = await resolveStoreId(auth, "vnd-001");
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

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        createdAt: orders.createdAt, total: orders.total, status: orders.status, paymentMethod: orders.paymentMethod,
      }).from(orders).where(and(...conditions));
    });

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
  const resolved = await resolveStoreId(auth, "fin-001");
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

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        tipo: financeiroLancamentos.tipo, valor: financeiroLancamentos.valor,
        dataCompetencia: financeiroLancamentos.dataCompetencia,
        categoria: financeiroLancamentos.categoria, descricao: financeiroLancamentos.descricao,
      }).from(financeiroLancamentos).where(and(...conditions)).orderBy(financeiroLancamentos.dataCompetencia);
    });

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
  const resolved = await resolveStoreId(auth, "fin-005");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to, fromStr, toStr } = parseDateRange(url);
  const categoria = url.searchParams.get("categoria");

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const { itemRows, despesaRows } = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));

      const itemRows = await tx.select({
        qtd: orderItems.quantity, total: orderItems.total, custoUnit: products.costPrice,
      })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(and(
          eq(orders.storeId, storeId), ne(orders.status, "cancelled"),
          gte(orders.createdAt, from), lte(orders.createdAt, to),
        ));

      const despesaConditions = [
        eq(financeiroLancamentos.storeId, storeId),
        eq(financeiroLancamentos.tipo, "saida"),
        sql`${financeiroLancamentos.dataCompetencia} >= ${fromStr}`,
        sql`${financeiroLancamentos.dataCompetencia} <= ${toStr}`,
      ];
      if (categoria) despesaConditions.push(eq(financeiroLancamentos.categoria, categoria));
      const despesaRows = await tx.select({ valor: financeiroLancamentos.valor })
        .from(financeiroLancamentos).where(and(...despesaConditions));

      return { itemRows, despesaRows };
    });

    let receita = 0, cmv = 0, receitaSemCusto = 0;
    for (const r of itemRows) {
      const t = parseFloat(r.total || "0");
      receita += t;
      if (r.custoUnit != null) cmv += Number(r.custoUnit) * r.qtd;
      else receitaSemCusto += t;
    }
    const lucroBruto = receita - cmv;
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
  const resolved = await resolveStoreId(auth, "aud-002");
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

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select().from(auditLogs)
        .where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(200);
    });

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
  const resolved = await resolveStoreId(auth, "fin-001");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.selectDistinct({ categoria: financeiroLancamentos.categoria })
        .from(financeiroLancamentos).where(eq(financeiroLancamentos.storeId, storeId));
    });
    return json({ categorias: rows.map(r => r.categoria).filter((c): c is string => !!c) });
  } catch (error) {
    console.error("[reports] categorias-financeiro error:", error);
    return err("Erro ao buscar categorias financeiras", 500);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 25 relatórios adicionados depois dos 7 originais — mesmo padrão acima
// (resolveStoreId com checagem de papel, createTenantDbTransactional +
// setTenantContext, nunca inventar dado: quando a tabela não sustenta uma
// métrica, devolve vazio com `aviso` explicando por quê, exatamente como
// avisoSaidas/avisoDespesas/avisoCmv acima).
// ═════════════════════════════════════════════════════════════════════════

// ─── 📦 ESTOQUE ──────────────────────────────────────────────────────────

// GET /api/reports/entrada-mercadorias?dataInicio&dataFim&fornecedorId&produtoId
export async function getEntradaMercadoriasHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "est-001");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const fornecedorId = url.searchParams.get("fornecedorId");
  const produtoId = url.searchParams.get("produtoId");

  const conditions = [
    eq(stockMovements.storeId, storeId), eq(stockMovements.type, "ENTRADA"),
    gte(stockMovements.createdAt, from), lte(stockMovements.createdAt, to),
  ];
  if (fornecedorId) conditions.push(eq(stockMovements.supplierId, fornecedorId));
  if (produtoId) conditions.push(eq(stockMovements.productId, produtoId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: stockMovements.id, data: stockMovements.createdAt, produto: stockMovements.productName,
        fornecedorNome: customers.name, qtd: stockMovements.quantity, custoUnit: stockMovements.costPrice,
        nf: stockMovements.nf, lote: stockMovements.lot, validade: stockMovements.expiry,
      }).from(stockMovements)
        .leftJoin(customers, eq(stockMovements.supplierId, customers.id))
        .where(and(...conditions)).orderBy(desc(stockMovements.createdAt));
    });

    const valorTotal = rows.reduce((s, r) => s + (r.custoUnit ? Number(r.custoUnit) * r.qtd : 0), 0);
    return json({
      movimentos: rows.map(r => ({
        id: r.id, data: r.data, produto: r.produto, fornecedor: r.fornecedorNome ?? "—",
        qtd: r.qtd, custoUnit: r.custoUnit ? Number(r.custoUnit) : null, nf: r.nf, lote: r.lote, validade: r.validade,
      })),
      kpis: { totalMovimentos: rows.length, totalQtd: rows.reduce((s, r) => s + r.qtd, 0), valorTotal },
    });
  } catch (error) {
    console.error("[reports] entrada-mercadorias error:", error);
    return err("Erro ao buscar entradas de mercadorias", 500);
  }
}

// GET /api/reports/saida-produtos?dataInicio&dataFim&produtoId&responsavelId
// "Saída" manual (ajuste/perda/avaria/transferência) — vendas já têm
// relatório próprio (vnd-*), incluir de novo aqui duplicaria contagem.
export async function getSaidaProdutosHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "est-002");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const produtoId = url.searchParams.get("produtoId");
  const responsavelId = url.searchParams.get("responsavelId");

  const conditions = [
    eq(stockMovements.storeId, storeId),
    inArray(stockMovements.type, ["SAIDA", "PERDA", "AVARIA", "TRANSFERENCIA"]),
    gte(stockMovements.createdAt, from), lte(stockMovements.createdAt, to),
  ];
  if (produtoId) conditions.push(eq(stockMovements.productId, produtoId));
  if (responsavelId) conditions.push(eq(stockMovements.createdBy, responsavelId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: stockMovements.id, data: stockMovements.createdAt, produto: stockMovements.productName,
        tipo: stockMovements.type, qtd: stockMovements.quantity, responsavel: stockMovements.createdByName,
        origem: stockMovements.origem, observacoes: stockMovements.observations,
      }).from(stockMovements).where(and(...conditions)).orderBy(desc(stockMovements.createdAt));
    });

    return json({
      movimentos: rows.map(r => ({ ...r, responsavel: r.responsavel ?? "—" })),
      kpis: { totalMovimentos: rows.length, totalQtd: rows.reduce((s, r) => s + r.qtd, 0) },
    });
  } catch (error) {
    console.error("[reports] saida-produtos error:", error);
    return err("Erro ao buscar saídas de produtos", 500);
  }
}

// GET /api/reports/extrato-inventario?produtoId
// Posição ATUAL do estoque com valorização — foto do momento, não histórico
// (mesmo motivo de est-005/Estoque Baixo não ter filtro de período).
export async function getExtratoInventarioHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "est-003");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const produtoId = new URL(request.url).searchParams.get("produtoId");
  const conditions = [eq(products.storeId, storeId)];
  if (produtoId) conditions.push(eq(products.id, produtoId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: products.id, nome: products.name, sku: products.sku,
        estoqueAtual: products.stock, custoUnit: products.costPrice, ativo: products.active,
      }).from(products).where(and(...conditions)).orderBy(asc(products.name));
    });

    const valorTotalEstoque = rows.reduce((s, r) => s + (r.custoUnit ? Number(r.custoUnit) * (r.estoqueAtual ?? 0) : 0), 0);
    return json({
      produtos: rows.map(r => ({
        id: r.id, nome: r.nome, sku: r.sku, estoqueAtual: r.estoqueAtual ?? 0,
        custoUnit: r.custoUnit ? Number(r.custoUnit) : null,
        valorEstoque: r.custoUnit ? Number(r.custoUnit) * (r.estoqueAtual ?? 0) : null,
        ativo: r.ativo,
      })),
      kpis: { totalItens: rows.length, valorTotalEstoque },
    });
  } catch (error) {
    console.error("[reports] extrato-inventario error:", error);
    return err("Erro ao buscar extrato de inventário", 500);
  }
}

// GET /api/reports/balanco-estoque?dataInicio&dataFim
// stock_balances já guarda exatamente isso (mesma tabela do recurso de
// Balanço do admin) — só nunca tinha sido exposto na Central de Relatórios.
export async function getBalancoEstoqueHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "est-004");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const { from, to } = parseDateRange(new URL(request.url));
  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select().from(stockBalances)
        .where(and(
          eq(stockBalances.storeId, storeId), eq(stockBalances.status, "encerrado"),
          gte(stockBalances.dataContagem, from), lte(stockBalances.dataContagem, to),
        )).orderBy(desc(stockBalances.dataContagem));
    });

    const balancos = rows.map(b => {
      const divergentes = b.items.filter(i => (i.diff ?? 0) !== 0);
      const valorDivergencia = divergentes.reduce((s, i) => s + (i.diff ?? 0) * (i.costPrice ?? 0), 0);
      return {
        id: b.id, codigo: b.codigo, dataContagem: b.dataContagem, dataEncerramento: b.dataEncerramento,
        totalItens: b.items.length, totalDivergencias: divergentes.length, valorDivergencia,
      };
    });
    return json({ balancos, kpis: { totalBalancos: balancos.length } });
  } catch (error) {
    console.error("[reports] balanco-estoque error:", error);
    return err("Erro ao buscar balanços de estoque", 500);
  }
}

// GET /api/reports/produtos-sem-movimentacao?dataInicio&dataFim&produtoId
export async function getProdutosSemMovimentacaoHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "est-006");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const produtoId = url.searchParams.get("produtoId");

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const { movidos, todos } = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      const movRows = await tx.select({ productId: stockMovements.productId }).from(stockMovements)
        .where(and(eq(stockMovements.storeId, storeId), gte(stockMovements.createdAt, from), lte(stockMovements.createdAt, to)));
      const prodConditions = [eq(products.storeId, storeId)];
      if (produtoId) prodConditions.push(eq(products.id, produtoId));
      const todos = await tx.select({ id: products.id, nome: products.name, sku: products.sku, estoqueAtual: products.stock })
        .from(products).where(and(...prodConditions)).orderBy(asc(products.name));
      return { movidos: movRows, todos };
    });

    const movidosSet = new Set(movidos.map(m => m.productId).filter((id): id is string => !!id));
    const semMovimentacao = todos.filter(p => !movidosSet.has(p.id));
    return json({
      produtos: semMovimentacao.map(p => ({ id: p.id, nome: p.nome, sku: p.sku, estoqueAtual: p.estoqueAtual ?? 0 })),
      kpis: { totalSemMovimentacao: semMovimentacao.length },
    });
  } catch (error) {
    console.error("[reports] produtos-sem-movimentacao error:", error);
    return err("Erro ao buscar produtos sem movimentação", 500);
  }
}

// GET /api/reports/historico-movimentacoes?dataInicio&dataFim&produtoId&responsavelId
export async function getHistoricoMovimentacoesHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "est-007");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const produtoId = url.searchParams.get("produtoId");
  const responsavelId = url.searchParams.get("responsavelId");

  const conditions = [eq(stockMovements.storeId, storeId), gte(stockMovements.createdAt, from), lte(stockMovements.createdAt, to)];
  if (produtoId) conditions.push(eq(stockMovements.productId, produtoId));
  if (responsavelId) conditions.push(eq(stockMovements.createdBy, responsavelId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: stockMovements.id, data: stockMovements.createdAt, produto: stockMovements.productName,
        tipo: stockMovements.type, qtd: stockMovements.quantity, balanceBefore: stockMovements.balanceBefore,
        balanceAfter: stockMovements.balanceAfter, responsavel: stockMovements.createdByName, origem: stockMovements.origem,
      }).from(stockMovements).where(and(...conditions)).orderBy(desc(stockMovements.createdAt)).limit(500);
    });

    return json({ movimentos: rows.map(r => ({ ...r, responsavel: r.responsavel ?? "—" })), kpis: { totalMovimentos: rows.length } });
  } catch (error) {
    console.error("[reports] historico-movimentacoes error:", error);
    return err("Erro ao buscar histórico de movimentações", 500);
  }
}

// ─── 👥 CLIENTES ─────────────────────────────────────────────────────────

// GET /api/reports/clientes-cadastrados?dataInicio&dataFim&status
// status aqui é o booleano customers.active (ativo/inativo) — não o status
// de pedido (received/preparing/...), que não se aplica a cliente.
export async function getClientesCadastradosHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "cli-001");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const status = url.searchParams.get("status"); // "ativo" | "inativo"

  const conditions = [
    eq(customers.storeId, storeId), eq(customers.isSupplier, false),
    gte(customers.createdAt, from), lte(customers.createdAt, to),
  ];
  if (status === "ativo") conditions.push(eq(customers.active, true));
  if (status === "inativo") conditions.push(eq(customers.active, false));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: customers.id, nome: customers.name, telefone: customers.phone,
        ativo: customers.active, cadastradoEm: customers.createdAt,
      }).from(customers).where(and(...conditions)).orderBy(desc(customers.createdAt));
    });

    return json({
      clientes: rows.map(r => ({ id: r.id, nome: r.nome, telefone: r.telefone ?? "—", status: r.ativo ? "Ativo" : "Inativo", cadastradoEm: r.cadastradoEm })),
      kpis: { total: rows.length, ativos: rows.filter(r => r.ativo).length, inativos: rows.filter(r => !r.ativo).length },
    });
  } catch (error) {
    console.error("[reports] clientes-cadastrados error:", error);
    return err("Erro ao buscar clientes cadastrados", 500);
  }
}

// GET /api/reports/historico-compras-cliente?clienteId&dataInicio&dataFim
// Exige um cliente selecionado — sem isso não tem o que agregar.
export async function getHistoricoComprasClienteHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "cli-003");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const clienteId = url.searchParams.get("clienteId");
  if (!clienteId) return err("Selecione um cliente para gerar este relatório", 400);
  const { from, to } = parseDateRange(url);

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const { cliente, rows } = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      const [cliente] = await tx.select({ id: customers.id, nome: customers.name })
        .from(customers).where(and(eq(customers.id, clienteId), eq(customers.storeId, storeId))).limit(1);
      const rows = await tx.select({
        id: orders.id, numero: orders.number, data: orders.createdAt, status: orders.status, total: orders.total,
      }).from(orders)
        .where(and(eq(orders.storeId, storeId), eq(orders.customerId, clienteId), gte(orders.createdAt, from), lte(orders.createdAt, to)))
        .orderBy(desc(orders.createdAt));
      return { cliente, rows };
    });

    if (!cliente) return err("Cliente não encontrado", 404);
    const totalGasto = rows.reduce((s, o) => s + parseFloat(o.total || "0"), 0);
    return json({
      cliente: { id: cliente.id, nome: cliente.nome },
      pedidos: rows,
      kpis: { totalPedidos: rows.length, totalGasto, ticketMedio: rows.length > 0 ? totalGasto / rows.length : 0 },
    });
  } catch (error) {
    console.error("[reports] historico-compras-cliente error:", error);
    return err("Erro ao buscar histórico de compras do cliente", 500);
  }
}

// GET /api/reports/clientes-inativos?dataInicio&dataFim
export async function getClientesInativosHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "cli-004");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const { from, to } = parseDateRange(new URL(request.url));
  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const { comPedido, todos } = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      const comPedido = await tx.select({ customerId: orders.customerId }).from(orders)
        .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, from), lte(orders.createdAt, to)));
      const todos = await tx.select({ id: customers.id, nome: customers.name, telefone: customers.phone })
        .from(customers).where(and(eq(customers.storeId, storeId), eq(customers.isSupplier, false), eq(customers.active, true)))
        .orderBy(asc(customers.name));
      return { comPedido, todos };
    });

    const ativosSet = new Set(comPedido.map(o => o.customerId).filter((id): id is string => !!id));
    const inativos = todos.filter(c => !ativosSet.has(c.id));
    return json({
      clientes: inativos.map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone ?? "—" })),
      kpis: { totalInativos: inativos.length },
    });
  } catch (error) {
    console.error("[reports] clientes-inativos error:", error);
    return err("Erro ao buscar clientes inativos", 500);
  }
}

// ─── 🏷️ PRODUTOS ────────────────────────────────────────────────────────

// GET /api/reports/lista-produtos?produtoId&status
export async function getListaProdutosHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "prod-001");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const produtoId = url.searchParams.get("produtoId");
  const status = url.searchParams.get("status"); // "ativo" | "inativo"

  const conditions = [eq(products.storeId, storeId)];
  if (produtoId) conditions.push(eq(products.id, produtoId));
  if (status === "ativo") conditions.push(eq(products.active, true));
  if (status === "inativo") conditions.push(eq(products.active, false));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: products.id, nome: products.name, sku: products.sku, categoriaNome: categories.name,
        preco: products.price, estoqueAtual: products.stock, ativo: products.active,
      }).from(products).leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...conditions)).orderBy(asc(products.name));
    });

    return json({
      produtos: rows.map(r => ({
        id: r.id, nome: r.nome, sku: r.sku, categoria: r.categoriaNome ?? "Sem categoria",
        preco: Number(r.preco), estoqueAtual: r.estoqueAtual ?? 0, status: r.ativo ? "Ativo" : "Inativo",
      })),
      kpis: { total: rows.length },
    });
  } catch (error) {
    console.error("[reports] lista-produtos error:", error);
    return err("Erro ao buscar lista de produtos", 500);
  }
}

// GET /api/reports/produtos-por-categoria
// Foto do catálogo atual — sem filtro de período (mesmo motivo de est-003).
export async function getProdutosPorCategoriaHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "prod-002");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        categoria: sql<string>`coalesce(${categories.name}, 'Sem categoria')`,
        totalProdutos: sql<number>`cast(count(*) as int)`,
        valorEstoque: sql<number>`coalesce(sum(coalesce(${products.stock}, 0) * coalesce(${products.costPrice}, 0)), 0)`,
      }).from(products).leftJoin(categories, eq(products.categoryId, categories.id))
        .where(eq(products.storeId, storeId))
        .groupBy(categories.name)
        .orderBy(desc(sql`count(*)`));
    });

    // valorEstoque vem de sum(numeric) — Postgres devolve isso como string;
    // sql<number> não converte nada em runtime, só no tipo declarado.
    const categorias = rows.map(r => ({ ...r, valorEstoque: Number(r.valorEstoque) }));
    return json({ categorias, kpis: { totalCategorias: categorias.length } });
  } catch (error) {
    console.error("[reports] produtos-por-categoria error:", error);
    return err("Erro ao buscar produtos por categoria", 500);
  }
}

// GET /api/reports/produtos-baixa-margem?produtoId
// Corte de margem baixa: abaixo de 20% (mesmo critério informal já usado
// em outros pontos do sistema pra sinalizar produto com margem apertada).
const MARGEM_BAIXA_LIMITE_PCT = 20;

export async function getProdutosBaixaMargemHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "prod-004");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const produtoId = new URL(request.url).searchParams.get("produtoId");
  const conditions = [eq(products.storeId, storeId), isNotNull(products.costPrice)];
  if (produtoId) conditions.push(eq(products.id, produtoId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({ id: products.id, nome: products.name, preco: products.price, custo: products.costPrice })
        .from(products).where(and(...conditions));
    });

    const baixaMargem = rows
      .map(r => {
        const preco = Number(r.preco), custo = Number(r.custo);
        const margemPct = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
        return { id: r.id, nome: r.nome, preco, custo, margemPct };
      })
      .filter(p => p.margemPct < MARGEM_BAIXA_LIMITE_PCT)
      .sort((a, b) => a.margemPct - b.margemPct);

    return json({ produtos: baixaMargem, kpis: { totalProdutos: baixaMargem.length, limiteMargemPct: MARGEM_BAIXA_LIMITE_PCT } });
  } catch (error) {
    console.error("[reports] produtos-baixa-margem error:", error);
    return err("Erro ao buscar produtos com baixa margem", 500);
  }
}

// GET /api/reports/produtos-sem-estoque?produtoId
export async function getProdutosSemEstoqueHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "prod-005");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const produtoId = new URL(request.url).searchParams.get("produtoId");
  const conditions = [eq(products.storeId, storeId), sql`coalesce(${products.stock}, 0) - coalesce(${products.reserved}, 0) <= 0`];
  if (produtoId) conditions.push(eq(products.id, produtoId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({ id: products.id, nome: products.name, sku: products.sku, estoqueAtual: products.stock, ativo: products.active })
        .from(products).where(and(...conditions)).orderBy(asc(products.name));
    });

    return json({ produtos: rows.map(r => ({ ...r, estoqueAtual: r.estoqueAtual ?? 0 })), kpis: { total: rows.length } });
  } catch (error) {
    console.error("[reports] produtos-sem-estoque error:", error);
    return err("Erro ao buscar produtos sem estoque", 500);
  }
}

// GET /api/reports/produtos-maior-giro?dataInicio&dataFim&produtoId
// Giro = quantidade vendida no período / estoque atual — quanto maior,
// mais rápido o produto "roda". Produto sem estoque atual cadastrado
// (0 ou null) fica fora da divisão (giro indefinido), mas ainda aparece
// listado com giro null pra não sumir do relatório.
export async function getProdutosMaiorGiroHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "prod-006");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const produtoId = url.searchParams.get("produtoId");

  const conditions = [eq(orders.storeId, storeId), ne(orders.status, "cancelled"), gte(orders.createdAt, from), lte(orders.createdAt, to)];
  if (produtoId) conditions.push(eq(orderItems.productId, produtoId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        productId: orderItems.productId, nome: orderItems.productName,
        qtdVendida: sql<number>`cast(sum(${orderItems.quantity}) as int)`, estoqueAtual: products.stock,
      }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(products, eq(orderItems.productId, products.id))
        .where(and(...conditions)).groupBy(orderItems.productId, orderItems.productName, products.stock);
    });

    const produtos = rows.map(r => ({
      id: r.productId, nome: r.nome, qtdVendida: r.qtdVendida, estoqueAtual: r.estoqueAtual ?? null,
      giro: r.estoqueAtual ? r.qtdVendida / r.estoqueAtual : null,
    })).sort((a, b) => (b.giro ?? 0) - (a.giro ?? 0));

    return json({ produtos, kpis: { totalProdutos: produtos.length } });
  } catch (error) {
    console.error("[reports] produtos-maior-giro error:", error);
    return err("Erro ao buscar produtos com maior giro", 500);
  }
}

// ─── 📊 VENDAS & PDV ─────────────────────────────────────────────────────

// orders não tem operador próprio, mas um pedido de PDV grava
// financeiro_lancamentos com orderId+sessaoId, e caixa_sessoes.abertoPor é
// o nome de quem operou aquele caixa — a única atribuição de "vendedor"
// que existe de verdade hoje. Pedido de loja online nunca passa por um
// caixa PDV, então aparece como "Loja Online". Busca em lote (1 query pra
// N pedidos) reaproveitada pelos 3 relatórios de vendas que pedem esse filtro.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tx é o
// parâmetro da callback de db.transaction(); seu tipo real é um union
// gigante gerado pelo Drizzle que não vale a pena expandir aqui.
async function fetchOperadoresPorPedido(
  tx: any,
  orderIds: string[],
): Promise<Map<string, string>> {
  if (orderIds.length === 0) return new Map();
  const rows = await tx.select({ orderId: financeiroLancamentos.orderId, operador: caixaSessoes.abertoPor })
    .from(financeiroLancamentos)
    .innerJoin(caixaSessoes, eq(financeiroLancamentos.sessaoId, caixaSessoes.id))
    .where(inArray(financeiroLancamentos.orderId, orderIds));
  const mapa = new Map<string, string>();
  for (const r of rows) if (r.orderId && r.operador) mapa.set(r.orderId, r.operador);
  return mapa;
}

// GET /api/reports/vendas-por-produto?dataInicio&dataFim&produtoId&formaPagamento&vendedor
export async function getVendasPorProdutoHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "vnd-002");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const produtoId = url.searchParams.get("produtoId");
  const formaPagamento = url.searchParams.get("formaPagamento");
  const vendedor = url.searchParams.get("vendedor");

  const conditions = [eq(orders.storeId, storeId), ne(orders.status, "cancelled"), gte(orders.createdAt, from), lte(orders.createdAt, to)];
  if (produtoId) conditions.push(eq(orderItems.productId, produtoId));
  if (formaPagamento) conditions.push(eq(orders.paymentMethod, formaPagamento));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const produtos = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));

      if (!vendedor) {
        // Sem filtro de vendedor, agrega direto no banco (mais rápido).
        return tx.select({
          productId: orderItems.productId, nome: orderItems.productName,
          qtd: sql<number>`cast(sum(${orderItems.quantity}) as int)`,
          receita: sql<number>`coalesce(sum(cast(${orderItems.total} as numeric)), 0)`,
        }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(...conditions)).groupBy(orderItems.productId, orderItems.productName)
          .orderBy(desc(sql`sum(cast(${orderItems.total} as numeric))`));
      }

      // Com filtro de vendedor: precisa saber o operador de cada pedido antes
      // de agregar, então busca os itens crus e agrega em JS.
      const itemRows = await tx.select({
        orderId: orderItems.orderId, productId: orderItems.productId, nome: orderItems.productName,
        qtd: orderItems.quantity, total: orderItems.total,
      }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(...conditions));

      const operadores = await fetchOperadoresPorPedido(tx, [...new Set(itemRows.map(r => r.orderId))]);
      const porProduto = new Map<string, { nome: string; qtd: number; receita: number }>();
      for (const r of itemRows) {
        if ((operadores.get(r.orderId) ?? "Loja Online") !== vendedor) continue;
        const chave = r.productId ?? r.nome;
        const cur = porProduto.get(chave) ?? { nome: r.nome, qtd: 0, receita: 0 };
        cur.qtd += r.qtd; cur.receita += parseFloat(r.total || "0");
        porProduto.set(chave, cur);
      }
      return [...porProduto.entries()].map(([productId, v]) => ({ productId, ...v })).sort((a, b) => b.receita - a.receita);
    });

    // receita pode vir como string (caminho sem filtro de vendedor agrega
    // sum(numeric) direto no banco — sql<number> não converte em runtime).
    const produtosNorm = produtos.map(p => ({ ...p, receita: Number(p.receita) }));
    return json({ produtos: produtosNorm, kpis: { totalProdutos: produtosNorm.length, receitaTotal: produtosNorm.reduce((s, p) => s + p.receita, 0) } });
  } catch (error) {
    console.error("[reports] vendas-por-produto error:", error);
    return err("Erro ao buscar vendas por produto", 500);
  }
}

// GET /api/reports/vendas-por-cliente?dataInicio&dataFim&clienteId&vendedor
// Mesmo formato de cli-002 (Clientes que Mais Compram), sem o limit(50) de
// "top" — aqui é a visão completa por cliente, não um ranking curado.
export async function getVendasPorClienteHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "vnd-003");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const clienteId = url.searchParams.get("clienteId");
  const vendedor = url.searchParams.get("vendedor");

  const conditions = [eq(orders.storeId, storeId), ne(orders.status, "cancelled"), gte(orders.createdAt, from), lte(orders.createdAt, to)];
  if (clienteId) conditions.push(eq(orders.customerId, clienteId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const clientes = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      const rows = await tx.select({
        orderId: orders.id, customerId: orders.customerId, nome: customers.name, total: orders.total,
      }).from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).where(and(...conditions));

      const operadores = vendedor ? await fetchOperadoresPorPedido(tx, rows.map(r => r.orderId)) : null;
      const porCliente = new Map<string, { nome: string; pedidos: number; totalGasto: number }>();
      for (const r of rows) {
        if (operadores && (operadores.get(r.orderId) ?? "Loja Online") !== vendedor) continue;
        const cur = porCliente.get(r.customerId!) ?? { nome: r.nome, pedidos: 0, totalGasto: 0 };
        cur.pedidos += 1; cur.totalGasto += parseFloat(r.total || "0");
        porCliente.set(r.customerId!, cur);
      }
      return [...porCliente.entries()]
        .map(([id, v]) => ({ id, nome: v.nome, pedidos: v.pedidos, totalGasto: v.totalGasto, ticketMedio: v.totalGasto / v.pedidos }))
        .sort((a, b) => b.totalGasto - a.totalGasto);
    });

    return json({ clientes, kpis: { totalClientes: clientes.length } });
  } catch (error) {
    console.error("[reports] vendas-por-cliente error:", error);
    return err("Erro ao buscar vendas por cliente", 500);
  }
}

// GET /api/reports/vendas-por-forma-pagamento?dataInicio&dataFim&formaPagamento
export async function getVendasPorFormaPagamentoHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "vnd-004");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const formaPagamento = url.searchParams.get("formaPagamento");

  const conditions = [eq(orders.storeId, storeId), ne(orders.status, "cancelled"), gte(orders.createdAt, from), lte(orders.createdAt, to)];
  if (formaPagamento) conditions.push(eq(orders.paymentMethod, formaPagamento));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        forma: sql<string>`coalesce(${orders.paymentMethod}, 'outro')`,
        pedidos: sql<number>`cast(count(*) as int)`,
        total: sql<number>`coalesce(sum(cast(${orders.total} as numeric)), 0)`,
      }).from(orders).where(and(...conditions)).groupBy(orders.paymentMethod).orderBy(desc(sql`sum(cast(${orders.total} as numeric))`));
    });

    // total vem de sum(numeric) — Postgres devolve isso como string;
    // sql<number> não converte nada em runtime, só no tipo declarado.
    const formas = rows.map(r => ({ ...r, total: Number(r.total) }));
    return json({ formas, kpis: { totalGeral: formas.reduce((s, r) => s + r.total, 0) } });
  } catch (error) {
    console.error("[reports] vendas-por-forma-pagamento error:", error);
    return err("Erro ao buscar vendas por forma de pagamento", 500);
  }
}

// GET /api/reports/produtos-mais-vendidos?dataInicio&dataFim&produtoId
// Ranking por QUANTIDADE (não margem/receita, que já são prod-003/prod-006).
export async function getProdutosMaisVendidosHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "vnd-005");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const produtoId = url.searchParams.get("produtoId");

  const conditions = [eq(orders.storeId, storeId), ne(orders.status, "cancelled"), gte(orders.createdAt, from), lte(orders.createdAt, to)];
  if (produtoId) conditions.push(eq(orderItems.productId, produtoId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        productId: orderItems.productId, nome: orderItems.productName,
        qtd: sql<number>`cast(sum(${orderItems.quantity}) as int)`,
        receita: sql<number>`coalesce(sum(cast(${orderItems.total} as numeric)), 0)`,
      }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(...conditions)).groupBy(orderItems.productId, orderItems.productName)
        .orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(50);
    });

    // receita vem de sum(numeric) — Postgres devolve isso como string;
    // sql<number> não converte nada em runtime, só no tipo declarado.
    const produtos = rows.map(r => ({ ...r, receita: Number(r.receita) }));
    return json({ produtos, kpis: { totalProdutos: produtos.length } });
  } catch (error) {
    console.error("[reports] produtos-mais-vendidos error:", error);
    return err("Erro ao buscar produtos mais vendidos", 500);
  }
}

// GET /api/reports/ticket-medio?dataInicio&dataFim&clienteId&vendedor
export async function getTicketMedioHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "vnd-006");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const clienteId = url.searchParams.get("clienteId");
  const vendedor = url.searchParams.get("vendedor");

  const conditions = [eq(orders.storeId, storeId), ne(orders.status, "cancelled"), gte(orders.createdAt, from), lte(orders.createdAt, to)];
  if (clienteId) conditions.push(eq(orders.customerId, clienteId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const { kpis, porVendedor } = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      const rows = await tx.select({ id: orders.id, total: orders.total }).from(orders).where(and(...conditions));

      const operadores = await fetchOperadoresPorPedido(tx, rows.map(r => r.id));
      const porOp = new Map<string, { pedidos: number; total: number }>();
      for (const r of rows) {
        const nome = operadores.get(r.id) ?? "Loja Online";
        const cur = porOp.get(nome) ?? { pedidos: 0, total: 0 };
        cur.pedidos += 1; cur.total += parseFloat(r.total || "0");
        porOp.set(nome, cur);
      }
      const totalVendido = rows.reduce((s, r) => s + parseFloat(r.total || "0"), 0);
      const porVendedorArr = [...porOp.entries()]
        .filter(([nome]) => !vendedor || nome === vendedor)
        .map(([vendedorNome, v]) => ({ vendedor: vendedorNome, pedidos: v.pedidos, ticketMedio: v.total / v.pedidos }));

      return {
        kpis: { numPedidos: rows.length, totalVendido, ticketMedio: rows.length > 0 ? totalVendido / rows.length : 0 },
        porVendedor: porVendedorArr,
      };
    });

    return json({ kpis, porVendedor });
  } catch (error) {
    console.error("[reports] ticket-medio error:", error);
    return err("Erro ao calcular ticket médio", 500);
  }
}

// GET /api/reports/cancelamentos-devolucoes?dataInicio&dataFim&status
// Cancelamento = orders.status='cancelled'; Devolução = orders.paymentStatus
// ='refunded' (um estorno pode acontecer num pedido não-cancelado). status
// aqui filtra entre os dois casos; sem filtro, mostra os dois juntos.
export async function getCancelamentosDevolucoesHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "vnd-007");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const status = url.searchParams.get("status"); // "cancelled" | "refunded"

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      const base = [eq(orders.storeId, storeId), gte(orders.createdAt, from), lte(orders.createdAt, to)];
      if (status === "cancelled") base.push(eq(orders.status, "cancelled"));
      else if (status === "refunded") base.push(eq(orders.paymentStatus, "refunded"));
      else base.push(sql`(${orders.status} = 'cancelled' or ${orders.paymentStatus} = 'refunded')`);

      return tx.select({
        id: orders.id, numero: orders.number, data: orders.createdAt, status: orders.status,
        paymentStatus: orders.paymentStatus, total: orders.total, motivo: orders.cancelReason,
      }).from(orders).where(and(...base)).orderBy(desc(orders.createdAt));
    });

    return json({
      pedidos: rows,
      kpis: {
        totalOcorrencias: rows.length,
        cancelados: rows.filter(r => r.status === "cancelled").length,
        devolvidos: rows.filter(r => r.paymentStatus === "refunded").length,
        valorTotal: rows.reduce((s, r) => s + parseFloat(r.total || "0"), 0),
      },
    });
  } catch (error) {
    console.error("[reports] cancelamentos-devolucoes error:", error);
    return err("Erro ao buscar cancelamentos e devoluções", 500);
  }
}

// ─── 💰 FINANCEIRO INTEGRADO ─────────────────────────────────────────────

// GET /api/reports/contas-receber?dataInicio&dataFim&clienteId&status&categoria
export async function getContasReceberHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "fin-002");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { fromStr, toStr } = parseDateRange(url);
  const clienteId = url.searchParams.get("clienteId");
  const status = url.searchParams.get("status");
  const categoria = url.searchParams.get("categoria");

  const conditions = [
    eq(financeiroLancamentos.storeId, storeId), eq(financeiroLancamentos.tipo, "entrada"),
    sql`${financeiroLancamentos.dataCompetencia} >= ${fromStr}`, sql`${financeiroLancamentos.dataCompetencia} <= ${toStr}`,
  ];
  if (status) conditions.push(eq(financeiroLancamentos.status, status));
  if (categoria) conditions.push(eq(financeiroLancamentos.categoria, categoria));
  if (clienteId) conditions.push(eq(orders.customerId, clienteId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: financeiroLancamentos.id, descricao: financeiroLancamentos.descricao, valor: financeiroLancamentos.valor,
        status: financeiroLancamentos.status, dataCompetencia: financeiroLancamentos.dataCompetencia,
        dataPagamento: financeiroLancamentos.dataPagamento, categoria: financeiroLancamentos.categoria,
        clienteNome: customers.name,
      }).from(financeiroLancamentos).leftJoin(orders, eq(financeiroLancamentos.orderId, orders.id))
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(desc(financeiroLancamentos.dataCompetencia));
    });

    const totalLiquidado = rows.filter(r => r.status === "liquidado").reduce((s, r) => s + parseFloat(r.valor || "0"), 0);
    const totalPendente = rows.filter(r => r.status === "pendente").reduce((s, r) => s + parseFloat(r.valor || "0"), 0);
    return json({
      lancamentos: rows.map(r => ({ ...r, cliente: r.clienteNome ?? "—" })),
      kpis: { totalLiquidado, totalPendente, totalGeral: totalLiquidado + totalPendente },
    });
  } catch (error) {
    console.error("[reports] contas-receber error:", error);
    return err("Erro ao buscar contas a receber", 500);
  }
}

// GET /api/reports/contas-pagar?dataInicio&dataFim&categoria
// Query correta, mas hoje SEMPRE vazia — nenhum fluxo do sistema grava
// financeiro_lancamentos com tipo='saida' ainda (mesma ressalva já
// documentada em fluxo-caixa/lucro-bruto-liquido acima).
export async function getContasPagarHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "fin-003");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { fromStr, toStr } = parseDateRange(url);
  const categoria = url.searchParams.get("categoria");
  const status = url.searchParams.get("status");

  const conditions = [
    eq(financeiroLancamentos.storeId, storeId), eq(financeiroLancamentos.tipo, "saida"),
    sql`${financeiroLancamentos.dataCompetencia} >= ${fromStr}`, sql`${financeiroLancamentos.dataCompetencia} <= ${toStr}`,
  ];
  if (categoria) conditions.push(eq(financeiroLancamentos.categoria, categoria));
  if (status) conditions.push(eq(financeiroLancamentos.status, status));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: financeiroLancamentos.id, descricao: financeiroLancamentos.descricao, valor: financeiroLancamentos.valor,
        status: financeiroLancamentos.status, dataCompetencia: financeiroLancamentos.dataCompetencia, categoria: financeiroLancamentos.categoria,
      }).from(financeiroLancamentos).where(and(...conditions)).orderBy(desc(financeiroLancamentos.dataCompetencia));
    });

    return json({
      lancamentos: rows,
      kpis: { totalPagar: rows.reduce((s, r) => s + parseFloat(r.valor || "0"), 0) },
      aviso: rows.length === 0 ? "Nenhuma saída registrada — o sistema ainda não tem um fluxo de lançamento de despesas/contas a pagar." : null,
    });
  } catch (error) {
    console.error("[reports] contas-pagar error:", error);
    return err("Erro ao buscar contas a pagar", 500);
  }
}

// GET /api/reports/inadimplencia?dataInicio&dataFim&clienteId
// Idem: hoje nenhum código grava financeiro_lancamentos.status='pendente'
// (tudo é liquidado na hora), então também vem sempre vazio, com aviso.
export async function getInadimplenciaHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "fin-004");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { fromStr, toStr } = parseDateRange(url);
  const clienteId = url.searchParams.get("clienteId");
  const hojeStr = new Date().toISOString().slice(0, 10);

  const conditions = [
    eq(financeiroLancamentos.storeId, storeId), eq(financeiroLancamentos.tipo, "entrada"), eq(financeiroLancamentos.status, "pendente"),
    sql`${financeiroLancamentos.dataCompetencia} >= ${fromStr}`, sql`${financeiroLancamentos.dataCompetencia} <= ${toStr}`,
    sql`${financeiroLancamentos.dataCompetencia} < ${hojeStr}`,
  ];
  if (clienteId) conditions.push(eq(orders.customerId, clienteId));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        id: financeiroLancamentos.id, descricao: financeiroLancamentos.descricao, valor: financeiroLancamentos.valor,
        dataCompetencia: financeiroLancamentos.dataCompetencia, clienteNome: customers.name,
      }).from(financeiroLancamentos).leftJoin(orders, eq(financeiroLancamentos.orderId, orders.id))
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(financeiroLancamentos.dataCompetencia);
    });

    return json({
      lancamentos: rows.map(r => ({ ...r, cliente: r.clienteNome ?? "—" })),
      kpis: { totalAtraso: rows.reduce((s, r) => s + parseFloat(r.valor || "0"), 0), qtd: rows.length },
      aviso: rows.length === 0 ? "Nenhum lançamento pendente em atraso — hoje todo recebimento do sistema é liquidado na hora, não há fluxo de título a prazo ainda." : null,
    });
  } catch (error) {
    console.error("[reports] inadimplencia error:", error);
    return err("Erro ao buscar inadimplência", 500);
  }
}

// GET /api/reports/receitas-despesas-historico?dataInicio&dataFim&categoria
export async function getReceitasDespesasHistoricoHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "fin-006");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { fromStr, toStr } = parseDateRange(url);
  const categoria = url.searchParams.get("categoria");

  const conditions = [
    eq(financeiroLancamentos.storeId, storeId),
    sql`${financeiroLancamentos.dataCompetencia} >= ${fromStr}`, sql`${financeiroLancamentos.dataCompetencia} <= ${toStr}`,
  ];
  if (categoria) conditions.push(eq(financeiroLancamentos.categoria, categoria));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select({
        categoria: sql<string>`coalesce(${financeiroLancamentos.categoria}, 'Sem categoria')`,
        tipo: financeiroLancamentos.tipo,
        total: sql<number>`coalesce(sum(cast(${financeiroLancamentos.valor} as numeric)), 0)`,
      }).from(financeiroLancamentos).where(and(...conditions))
        .groupBy(financeiroLancamentos.categoria, financeiroLancamentos.tipo)
        .orderBy(desc(sql`sum(cast(${financeiroLancamentos.valor} as numeric))`));
    });

    // total vem de sum(numeric) — Postgres devolve isso como string;
    // sql<number> não converte nada em runtime, só no tipo declarado.
    const categorias = rows.map(r => ({ ...r, total: Number(r.total) }));
    const totalEntradas = categorias.filter(r => r.tipo === "entrada").reduce((s, r) => s + r.total, 0);
    const totalSaidas = categorias.filter(r => r.tipo === "saida").reduce((s, r) => s + r.total, 0);
    return json({ categorias, kpis: { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas } });
  } catch (error) {
    console.error("[reports] receitas-despesas-historico error:", error);
    return err("Erro ao buscar receitas e despesas por histórico", 500);
  }
}

// ─── 🔍 AUDITORIA & SEGURANÇA ────────────────────────────────────────────

// GET /api/reports/fechamento-caixa?dataInicio&dataFim&responsavel
// caixa_sessoes já guarda exatamente esse formato pronto — o mais direto
// dos 25, sem nenhuma agregação extra necessária.
export async function getFechamentoCaixaHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth, "aud-001");
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const { from, to } = parseDateRange(url);
  const responsavel = url.searchParams.get("responsavel");

  const conditions = [
    eq(caixaSessoes.storeId, storeId), eq(caixaSessoes.status, "encerrada"),
    gte(caixaSessoes.closedAt, from), lte(caixaSessoes.closedAt, to),
  ];
  if (responsavel) conditions.push(eq(caixaSessoes.encerradoPor, responsavel));

  const db = await createTenantDbTransactional(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));
      return tx.select().from(caixaSessoes).where(and(...conditions)).orderBy(desc(caixaSessoes.closedAt));
    });

    const sessoes = rows.map(s => ({
      id: s.id, abertoPor: s.abertoPor ?? "—", encerradoPor: s.encerradoPor ?? "—",
      openedAt: s.openedAt, closedAt: s.closedAt,
      saldoInicial: Number(s.saldoInicial), saldoFinal: s.saldoFinal ? Number(s.saldoFinal) : null,
      totalDinheiro: Number(s.totalDinheiro), totalPix: Number(s.totalPix), totalCartao: Number(s.totalCartao),
      totalDebito: Number(s.totalDebito), totalOutros: Number(s.totalOutros), totalVendas: s.totalVendas,
    }));
    return json({
      sessoes,
      kpis: {
        totalSessoes: sessoes.length, totalVendas: sessoes.reduce((s, r) => s + r.totalVendas, 0),
        totalGeral: sessoes.reduce((s, r) => s + r.totalDinheiro + r.totalPix + r.totalCartao + r.totalDebito + r.totalOutros, 0),
      },
    });
  } catch (error) {
    console.error("[reports] fechamento-caixa error:", error);
    return err("Erro ao buscar fechamentos de caixa", 500);
  }
}
