import { createDb, createDbTransactional, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";

const {
  caixaSessoes, caixaMovimentos, financeiroLancamentos,
  mesas, orders, products, stockMovements,
} = schema;

const JSON_HDR = { "content-type": "application/json" };
const json     = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err      = (msg: string, status = 400) => json({ error: msg }, status);

// ─── helpers ─────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── GET /api/pdv/caixa — sessão aberta atual ─────────────────────
export async function getCaixaAtualHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const db = createDb(process.env.DATABASE_URL!);
  const [sessao] = await db
    .select()
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.storeId, storeId), eq(caixaSessoes.status, "aberta")))
    .orderBy(desc(caixaSessoes.openedAt))
    .limit(1);

  const movimentos = sessao
    ? await db.select().from(caixaMovimentos)
        .where(eq(caixaMovimentos.sessaoId, sessao.id))
        .orderBy(desc(caixaMovimentos.createdAt))
    : [];

  return json({ sessao: sessao ?? null, movimentos });
}

// ─── POST /api/pdv/caixa/abrir ────────────────────────────────────
export async function abrirCaixaHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const body = await request.json() as {
    saldoInicial: string;
    abertoPor?: string;
  };

  const db = createDb(process.env.DATABASE_URL!);

  // Verifica se já existe caixa aberto
  const [jaAberto] = await db
    .select({ id: caixaSessoes.id })
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.storeId, storeId), eq(caixaSessoes.status, "aberta")))
    .limit(1);
  if (jaAberto) return err("Já existe um caixa aberto.", 409);

  const [sessao] = await db.insert(caixaSessoes).values({
    storeId,
    saldoInicial: body.saldoInicial || "0",
    abertoPor:    body.abertoPor   || null,
    status:       "aberta",
  }).returning();

  return json({ success: true, sessao }, 201);
}

// ─── POST /api/pdv/caixa/fechar ───────────────────────────────────
export async function fecharCaixaHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const body = await request.json() as {
    sessaoId: string;
    saldoFinal?: string;
    encerradoPor?: string;
    observations?: string;
  };
  if (!body.sessaoId) return err("sessaoId obrigatório");

  const db = createDb(process.env.DATABASE_URL!);

  const [sessao] = await db
    .select()
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.id, body.sessaoId), eq(caixaSessoes.storeId, storeId)))
    .limit(1);
  if (!sessao) return err("Sessão não encontrada", 404);
  if (sessao.status === "encerrada") return err("Sessão já encerrada", 409);

  const [fechada] = await db
    .update(caixaSessoes)
    .set({
      status:       "encerrada",
      saldoFinal:   body.saldoFinal  || null,
      encerradoPor: body.encerradoPor || null,
      observations: body.observations || null,
      closedAt:     new Date(),
    })
    .where(and(eq(caixaSessoes.id, body.sessaoId), eq(caixaSessoes.storeId, storeId)))
    .returning();

  // Totais de movimentações (para resumo)
  const movimentos = await db.select().from(caixaMovimentos)
    .where(eq(caixaMovimentos.sessaoId, body.sessaoId));

  return json({ success: true, sessao: fechada, movimentos });
}

// ─── POST /api/pdv/caixa/movimentar — Sangria / Suprimento ───────
export async function movimentarCaixaHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const body = await request.json() as {
    sessaoId: string;
    tipo: "sangria" | "suprimento";
    valor: string;
    motivo?: string;
    criadoPor?: string;
  };
  if (!body.sessaoId || !body.tipo || !body.valor) {
    return err("sessaoId, tipo e valor obrigatórios");
  }

  const db = createDb(process.env.DATABASE_URL!);

  const [sessao] = await db
    .select({ id: caixaSessoes.id, status: caixaSessoes.status })
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.id, body.sessaoId), eq(caixaSessoes.storeId, storeId)))
    .limit(1);
  if (!sessao || sessao.status !== "aberta") return err("Sessão não encontrada ou encerrada", 404);

  const [mov] = await db.insert(caixaMovimentos).values({
    sessaoId:  body.sessaoId,
    storeId,
    tipo:      body.tipo,
    valor:     body.valor,
    motivo:    body.motivo    || null,
    criadoPor: body.criadoPor || null,
  }).returning();

  return json({ success: true, movimento: mov }, 201);
}

// ─── GET /api/pdv/caixa/sessoes — Histórico de sessões ───────────
export async function listCaixaSessoesHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const url       = new URL(request.url);
  const status    = url.searchParams.get("status");   // aberta | encerrada | all
  const dateFrom  = url.searchParams.get("dateFrom"); // YYYY-MM-DD
  const dateTo    = url.searchParams.get("dateTo");   // YYYY-MM-DD

  const db = createDb(process.env.DATABASE_URL!);

  const conditions = [eq(caixaSessoes.storeId, storeId)];
  if (status && status !== "all") {
    conditions.push(eq(caixaSessoes.status, status));
  }
  if (dateFrom) {
    conditions.push(gte(caixaSessoes.openedAt, new Date(dateFrom + "T00:00:00")));
  }
  if (dateTo) {
    conditions.push(lte(caixaSessoes.openedAt, new Date(dateTo   + "T23:59:59")));
  }

  const sessoes = await db
    .select()
    .from(caixaSessoes)
    .where(and(...conditions))
    .orderBy(desc(caixaSessoes.openedAt))
    .limit(100);

  return json({ sessoes });
}

// ─── GET /api/pdv/mesas — Mesas com status derivado de pedidos ───
export async function listMesasHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const db = createDb(process.env.DATABASE_URL!);

  const mesasList = await db
    .select()
    .from(mesas)
    .where(and(eq(mesas.storeId, storeId), eq(mesas.active, true)))
    .orderBy(mesas.position, mesas.numero);

  // Pedidos abertos: received | preparing | ready → "atendimento"
  // Pedidos aguardando pagamento (status=ready e sem deliveredAt) → "aguardando"
  // Sem pedido → "livre"
  // Nota: mesa é associada ao pedido via notes = "Mesa XX" (MVP)
  // Futuramente haverá campo mesa_id no pedido.

  return json({ mesas: mesasList });
}

// ─── POST /api/pdv/mesas/salvar — Criar / Atualizar mesas ────────
export async function salvarMesasHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const body = await request.json() as {
    mesas: Array<{
      id?: string; numero: number; label: string; capacidade?: number; position?: number;
    }>;
  };
  if (!body.mesas?.length) return err("mesas obrigatório");

  const db = createDb(process.env.DATABASE_URL!);

  // Deletar as existentes e reinserir (upsert simples para MVP)
  await db.delete(mesas).where(eq(mesas.storeId, storeId));
  const inserted = await db.insert(mesas).values(
    body.mesas.map((m, i) => ({
      storeId,
      numero:     m.numero,
      label:      m.label,
      capacidade: m.capacidade ?? 4,
      position:   m.position   ?? i,
      active:     true,
    })),
  ).returning();

  return json({ success: true, mesas: inserted });
}

// ─── POST /api/pdv/finalizar-venda ────────────────────────────────
// Cria o pedido, dá baixa de estoque e gera lançamento financeiro.
export async function finalizarVendaPdvHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const body = await request.json() as {
    sessaoId: string;
    mesaLabel?: string;
    paymentMethod: string;
    installments?: number;
    items: {
      productId: string;
      productName: string;
      productEmoji?: string;
      quantity: number;
      unitPrice: string;
      total: string;
    }[];
    subtotal: string;
    discount?: string;
    total: string;
  };

  if (!body.sessaoId || !body.items?.length || !body.total) {
    return err("sessaoId, items e total obrigatórios");
  }

  const db = createDbTransactional(process.env.DATABASE_URL!);

  // Valida sessão aberta
  const [sessao] = await db
    .select()
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.id, body.sessaoId), eq(caixaSessoes.storeId, storeId)))
    .limit(1);
  if (!sessao || sessao.status !== "aberta") {
    return err("Sessão de caixa não encontrada ou encerrada", 409);
  }

  // Próximo número de pedido
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${orders.number}), 0)` })
    .from(orders)
    .where(eq(orders.storeId, storeId));
  const nextNumber = (Number(maxRow?.max) || 0) + 1;

  const todayStr = today();

  // Transação ACID: pedido + itens + estoque + financeiro + caixa
  const result = await db.transaction(async (tx) => {
    // 1. Cria pedido
    const [order] = await tx.insert(schema.orders).values({
      storeId,
      number:        nextNumber,
      status:        "delivered",
      type:          "pickup",
      paymentMethod: body.paymentMethod,
      paymentStatus: "paid",
      installments:  body.installments && body.installments > 1 ? body.installments : 1,
      subtotal:      body.subtotal,
      deliveryFee:   "0",
      discount:      body.discount || "0",
      total:         body.total,
      notes:         body.mesaLabel ? `PDV — ${body.mesaLabel}` : "PDV",
      deliveredAt:   new Date(),
    }).returning();

    // 2. Itens
    await tx.insert(schema.orderItems).values(
      body.items.map(item => ({
        orderId:      order.id,
        productId:    item.productId || null,
        productName:  item.productName,
        productEmoji: item.productEmoji || null,
        quantity:     item.quantity,
        unitPrice:    item.unitPrice,
        total:        item.total,
      })),
    );

    // 3. Baixa de estoque (apenas produtos com trackStock = true)
    for (const item of body.items) {
      if (!item.productId) continue;
      const [prod] = await tx
        .select({ stock: products.stock, trackStock: products.trackStock })
        .from(products)
        .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
        .limit(1);
      if (!prod?.trackStock) continue;

      const before = prod.stock ?? 0;
      const after  = Math.max(0, before - item.quantity);
      await tx.update(products)
        .set({ stock: after, updatedAt: new Date() })
        .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));
      await tx.insert(stockMovements).values({
        storeId,
        productId:    item.productId,
        productName:  item.productName,
        type:         "VENDA",
        quantity:     item.quantity,
        balanceBefore: before,
        balanceAfter:  after,
        origem:       `Venda PDV — Pedido #${nextNumber}${body.mesaLabel ? ` (${body.mesaLabel})` : ""}`,
        orderId:      order.id,
      });
    }

    // 4. Lançamento financeiro
    const [lancamento] = await tx.insert(financeiroLancamentos).values({
      storeId,
      tipo:            "entrada",
      categoria:       "venda",
      descricao:       `Venda PDV #${nextNumber}${body.mesaLabel ? ` — ${body.mesaLabel}` : ""}`,
      valor:           body.total,
      metodoPagamento: body.paymentMethod,
      status:          "liquidado",
      dataCompetencia: todayStr,
      dataPagamento:   todayStr,
      orderId:         order.id,
      sessaoId:        body.sessaoId,
    }).returning();

    // 5. Atualiza totais da sessão de caixa
    const metodo = body.paymentMethod;
    const totalVal = parseFloat(body.total) || 0;
    const updateSet: Record<string, unknown> = {
      totalVendas: sql`${caixaSessoes.totalVendas} + 1`,
    };
    if (metodo === "cash")        updateSet.totalDinheiro = sql`${caixaSessoes.totalDinheiro} + ${totalVal}`;
    else if (metodo === "pix")    updateSet.totalPix      = sql`${caixaSessoes.totalPix}      + ${totalVal}`;
    else if (metodo === "card")   updateSet.totalCartao   = sql`${caixaSessoes.totalCartao}   + ${totalVal}`;
    else if (metodo === "debit")  updateSet.totalDebito   = sql`${caixaSessoes.totalDebito}   + ${totalVal}`;
    else                          updateSet.totalOutros   = sql`${caixaSessoes.totalOutros}   + ${totalVal}`;

    await tx.update(caixaSessoes)
      .set(updateSet)
      .where(eq(caixaSessoes.id, body.sessaoId));

    return { order, lancamento };
  });

  return json({ success: true, order: result.order, lancamento: result.lancamento }, 201);
}

// ─── GET /api/pdv/financeiro — Lançamentos para tela financeiro ──
export async function listFinanceiroLancamentosHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const url      = new URL(request.url);
  const sessaoId = url.searchParams.get("sessaoId");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo   = url.searchParams.get("dateTo");

  const db = createDb(process.env.DATABASE_URL!);
  const conditions = [eq(financeiroLancamentos.storeId, storeId)];
  if (sessaoId) conditions.push(eq(financeiroLancamentos.sessaoId, sessaoId));
  if (dateFrom) conditions.push(sql`${financeiroLancamentos.dataCompetencia} >= ${dateFrom}`);
  if (dateTo)   conditions.push(sql`${financeiroLancamentos.dataCompetencia} <= ${dateTo}`);

  const lancamentos = await db
    .select()
    .from(financeiroLancamentos)
    .where(and(...conditions))
    .orderBy(desc(financeiroLancamentos.createdAt))
    .limit(500);

  return json({ lancamentos });
}
