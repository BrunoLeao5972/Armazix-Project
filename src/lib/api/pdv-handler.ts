import { createDb, createDbTransactional, type Database } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, desc, sql, gte, lte, isNull } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { hasPdvAccess } from "@/lib/plans";
import { concretizeReservation } from "@/lib/inventory/stock-reservation";
import { getPasswordFailures, recordPasswordFailure, clearPasswordFailures } from "@/lib/cache/redis";

// 5 senhas erradas seguidas em 15min travam aquela conta pra abrir/fechar
// caixa — mesmo teto do login ("auth" em rate-limit.ts), só que por conta.
const SENHA_FALHAS_MAX  = 5;
const SENHA_JANELA_SEG  = 15 * 60;

const {
  caixaSessoes, caixaMovimentos, financeiroLancamentos,
  mesas, orders, orderItems, orderTimeline, products, stockMovements, stores,
  servicePointSessions, servicePointAdvances, users, storeUsers,
} = schema;

const JSON_HDR = { "content-type": "application/json" };
const json     = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err      = (msg: string, status = 400) => json({ error: msg }, status);

// ─── helpers ─────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L) — o código de sessão é lido
// e digitado por humano (ex: conferência de caixa por telefone com o
// suporte), não é segredo nem token de segurança, então não precisa da
// mesma amostragem sem viés de generateCode() (auth/index.ts).
const CODIGO_SESSAO_ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function gerarCodigoSessao(): string {
  const buf = new Uint8Array(5);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => CODIGO_SESSAO_ALFABETO[b % CODIGO_SESSAO_ALFABETO.length]).join("");
}

// Postgres unique_violation — mesmo padrão de service-points-handler.ts.
function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505";
}

/**
 * Garante que a loja tem PDV liberado: ou comprou o add-on separado
 * (pdvEnabled, planos Free/Start), ou está num plano que já inclui PDV sem
 * custo adicional (Pro/Full — ver PLANS[...].pdvIncluded em lib/plans.ts e
 * o texto "PDV incluso nos planos Pro e Full" em PlansSection.tsx). Checar
 * só pdvEnabled aqui deixava todo assinante Pro/Full barrado no PDV que
 * a própria tela de planos promete de graça.
 */
async function requirePdvAccess(storeId: string): Promise<Response | null> {
  const db = createDb(process.env.DATABASE_URL!);
  const [store] = await db
    .select({ pdvEnabled: stores.pdvEnabled, planStatus: stores.planStatus, plan: stores.plan })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!hasPdvAccess(store)) {
    return err("PDV não contratado para esta loja. Ative o add-on em Configurações → Planos.", 402);
  }
  return null;
}

// ─── Núcleo da reautenticação — confirma que a senha informada é de fato a
// senha do usuário indicado, DENTRO desta loja (qualquer membro, não só
// quem está logado no navegador agora — um gerente pode confirmar o
// fechamento de outro operador do turno). Usado tanto pelo endpoint de
// pré-checagem abaixo (feedback imediato no formulário) quanto DENTRO de
// abrirCaixaHandler/fecharCaixaHandler — a senha é conferida de novo no
// momento real da ação, não só numa etapa "de aviso" que um client
// modificado poderia pular mandando abertoPor/encerradoPor livre. ──
async function verificarSenhaOperador(
  db: Database, storeId: string, userId: string, password: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string; status: number }> {
  // O usuário precisa pertencer a ESTA loja — nunca confia num userId vindo
  // do body sem esse cross-check de tenant (mesmo princípio de
  // requireStoreAccess: o body nunca decide sozinho "de qual loja" algo é).
  const [membro] = await db
    .select({ userId: storeUsers.userId })
    .from(storeUsers)
    .where(and(eq(storeUsers.storeId, storeId), eq(storeUsers.userId, userId)))
    .limit(1);
  if (!membro) return { ok: false, error: "Usuário não encontrado nesta loja", status: 403 };

  const [user] = await db
    .select({ passwordHash: users.passwordHash, name: users.name, active: users.active })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.active === false) return { ok: false, error: "Usuário não encontrado", status: 404 };

  // Força bruta: bloqueia a CONTA-alvo depois de FALHAS_MAX senhas erradas
  // seguidas na janela. Não usa o rate limit por IP+tier do api-handler (ali
  // o balde é compartilhado com o login e conta requisições com sucesso, o
  // que travava a abertura de caixa) — aqui só senha errada conta, e uma
  // senha certa zera o contador.
  const lockKey = `pwdfail:pdv:${storeId}:${userId}`;
  const { count, ttlSeconds } = await getPasswordFailures(lockKey, SENHA_JANELA_SEG);
  if (count >= SENHA_FALHAS_MAX) {
    const min = Math.max(1, Math.ceil(ttlSeconds / 60));
    return { ok: false, error: `Muitas tentativas com senha incorreta para este usuário. Tente novamente em ${min} min.`, status: 429 };
  }

  const { verifyPassword } = await import("@/lib/auth");
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordPasswordFailure(lockKey, SENHA_JANELA_SEG);
    return { ok: false, error: "Senha incorreta", status: 401 };
  }

  await clearPasswordFailures(lockKey);
  return { ok: true, name: user.name };
}

// ─── POST /api/pdv/caixa/verificar-operador ───────────────────────
// Pré-checagem chamada pelo formulário ANTES do popup "tem certeza?" —
// feedback imediato de senha errada sem precisar abrir o popup pra nada.
// Registrada em rateLimitConfigs (api-handler.ts) com o mesmo tier "auth"
// do login — sem isso, viraria um oráculo de força bruta.
export async function verificarOperadorHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const body = await request.json() as { userId?: string; password?: string };
  if (!body.userId || !body.password) return err("Usuário e senha obrigatórios");

  const db = createDb(process.env.DATABASE_URL!);
  const r  = await verificarSenhaOperador(db, storeId, body.userId, body.password);
  if (!r.ok) return err(r.error, r.status);

  return json({ success: true, name: r.name });
}

// ─── GET /api/pdv/caixa — sessão aberta atual ─────────────────────
export async function getCaixaAtualHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

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

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

  const body = await request.json() as {
    saldoInicial: string;
    operadorId?: string;
    senha?: string;
    /** De onde a abertura está sendo pedida — cada cliente manda o seu. */
    origem?: "web" | "desktop";
  };
  if (!body.operadorId || !body.senha) return err("Usuário e senha obrigatórios");
  const origem = body.origem === "desktop" ? "desktop" : "web";

  const db = createDb(process.env.DATABASE_URL!);

  // Confere a senha do responsável AQUI, não só numa etapa "de aviso" no
  // client — ver verificarSenhaOperador acima.
  const verificacao = await verificarSenhaOperador(db, storeId, body.operadorId, body.senha);
  if (!verificacao.ok) return err(verificacao.error, verificacao.status);
  const abertoPor = verificacao.name;

  // Verifica se já existe caixa aberto — em QUALQUER canal, o turno é único
  // por loja. Se foi aberto por outro canal, a mensagem diz isso
  // explicitamente pra não parecer um bug quando o operador só esqueceu que
  // já tinha aberto o caixa pelo painel web (ou vice-versa).
  const [jaAberto] = await db
    .select({ origem: caixaSessoes.origem, abertoPor: caixaSessoes.abertoPor })
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.storeId, storeId), eq(caixaSessoes.status, "aberta")))
    .limit(1);
  if (jaAberto) {
    const label = (o: string) => (o === "desktop" ? "App Desktop" : "Painel Web");
    const quem = jaAberto.abertoPor ? ` por ${jaAberto.abertoPor}` : "";
    const mensagem = jaAberto.origem === origem
      ? "Já existe um caixa aberto."
      : `Já existe um caixa aberto${quem} via ${label(jaAberto.origem)}. Feche-o por lá ou continue vendendo através do ${label(jaAberto.origem)}.`;
    return err(mensagem, 409);
  }

  // Retry em cima de colisão de código (23505 na uniqueIndex por loja) —
  // com 31^5 combinações por loja, na prática só serve de rede de segurança,
  // igual isUniqueViolation() já é usado em service-points-handler.ts.
  let sessao: typeof caixaSessoes.$inferSelect | undefined;
  for (let tentativa = 0; !sessao; tentativa++) {
    try {
      [sessao] = await db.insert(caixaSessoes).values({
        storeId,
        codigo:       gerarCodigoSessao(),
        saldoInicial: body.saldoInicial || "0",
        abertoPor,
        status:       "aberta",
        origem,
      }).returning();
    } catch (error) {
      if (!isUniqueViolation(error) || tentativa >= 4) throw error;
    }
  }

  return json({ success: true, sessao }, 201);
}

// ─── POST /api/pdv/caixa/fechar ───────────────────────────────────
// ─── Núcleo do fechamento de caixa — única fonte de verdade da regra,
// reaproveitada pelo fechamento manual (fecharCaixaHandler, logo abaixo) E
// pelo encerramento automático diário (src/lib/jobs/caixa-auto-close.ts).
// Nunca duplicar este UPDATE em outro lugar — qualquer ajuste na regra de
// fechamento (o que acontece com saldoFinal, o que fica registrado em
// encerradoPor, etc.) precisa valer pros dois caminhos ao mesmo tempo. ───
export async function closeCaixaSessao(
  db: Database,
  params: {
    sessaoId: string; storeId: string;
    saldoFinal?: string | null; encerradoPor?: string | null; observations?: string | null;
    conferencia?: Array<{ metodo: string; label: string; sistema: string; informado: string; diferenca: string }> | null;
  },
): Promise<
  | { ok: true; sessao: typeof caixaSessoes.$inferSelect; movimentos: (typeof caixaMovimentos.$inferSelect)[] }
  | { ok: false; error: string; status: number }
> {
  const [sessao] = await db
    .select()
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.id, params.sessaoId), eq(caixaSessoes.storeId, params.storeId)))
    .limit(1);
  if (!sessao) return { ok: false, error: "Sessão não encontrada", status: 404 };
  if (sessao.status === "encerrada") return { ok: false, error: "Sessão já encerrada", status: 409 };

  const [fechada] = await db
    .update(caixaSessoes)
    .set({
      status:       "encerrada",
      saldoFinal:   params.saldoFinal   ?? null,
      encerradoPor: params.encerradoPor ?? null,
      observations: params.observations ?? null,
      conferencia:  params.conferencia  ?? null,
      closedAt:     new Date(),
    })
    .where(and(eq(caixaSessoes.id, params.sessaoId), eq(caixaSessoes.storeId, params.storeId)))
    .returning();

  // Totais de movimentações (para resumo)
  const movimentos = await db.select().from(caixaMovimentos)
    .where(eq(caixaMovimentos.sessaoId, params.sessaoId));

  return { ok: true, sessao: fechada, movimentos };
}

export async function fecharCaixaHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

  const body = await request.json() as {
    sessaoId: string;
    saldoFinal?: string;
    operadorId?: string;
    senha?: string;
    observations?: string;
    conferencia?: Array<{ metodo: string; label: string; sistema: string; informado: string; diferenca: string }>;
  };
  if (!body.sessaoId) return err("sessaoId obrigatório");
  if (!body.operadorId || !body.senha) return err("Usuário e senha obrigatórios");

  const db = createDb(process.env.DATABASE_URL!);

  // Confere a senha do responsável AQUI, não só numa etapa "de aviso" no
  // client — ver verificarSenhaOperador acima.
  const verificacao = await verificarSenhaOperador(db, storeId, body.operadorId, body.senha);
  if (!verificacao.ok) return err(verificacao.error, verificacao.status);

  const result = await closeCaixaSessao(db, {
    sessaoId: body.sessaoId, storeId,
    saldoFinal: body.saldoFinal, encerradoPor: verificacao.name, observations: body.observations,
    conferencia: body.conferencia,
  });
  if (!result.ok) return err(result.error, result.status);

  return json({ success: true, sessao: result.sessao, movimentos: result.movimentos });
}

// ─── POST /api/pdv/caixa/movimentar — Sangria / Suprimento ───────
export async function movimentarCaixaHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

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

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

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

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

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

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

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

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

  const body = await request.json() as {
    sessaoId: string;
    mesaLabel?: string;
    servicePointId?: string;
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

  try {
  // Transação ACID: pedido + itens + estoque + financeiro + caixa
  const result = await db.transaction(async (tx) => {
    // 1a. Se veio de um ponto de atendimento (mesa/comanda) aberto pelo
    // mapa, RESERVA a sessão primeiro — antes de criar qualquer coisa —
    // com uma trava atômica (UPDATE ... WHERE closed_at IS NULL). Sem
    // isso, um duplo clique ou um retry de rede em "Finalizar Venda"
    // podia criar DOIS pedidos pra mesma mesa (só a atualização da sessão
    // tinha essa guarda antes; a criação do pedido, baixa de estoque e
    // lançamento financeiro rodavam de novo mesmo se a sessão já tivesse
    // sido fechada por uma chamada concorrente). Mesmo padrão de
    // `AlreadyClosedError` + WHERE ... IS NULL de encerrarEncomendaHandler.
    let claimedSession: typeof servicePointSessions.$inferSelect | null = null;
    if (body.servicePointId) {
      const [claimed] = await tx.update(servicePointSessions)
        .set({ closedAt: new Date() })
        .where(and(
          eq(servicePointSessions.servicePointId, body.servicePointId),
          eq(servicePointSessions.storeId, storeId),
          isNull(servicePointSessions.closedAt),
        ))
        .returning();
      if (!claimed) throw new AlreadySoldError();
      claimedSession = claimed;
    }

    // 1b. Adiantamentos já registrados nessa sessão (pagamento parcial
    // feito antes de fechar a conta) — abatem do valor cobrado agora, pra
    // não contar o dinheiro duas vezes (o adiantamento já incrementou os
    // totais de caixa no momento em que foi registrado). O pedido em si
    // guarda o total CHEIO — o histórico do pedido reflete o consumo real.
    let jaAdiantado = 0;
    if (claimedSession) {
      const advRows = await tx.select({ valor: servicePointAdvances.valor })
        .from(servicePointAdvances)
        .where(eq(servicePointAdvances.sessionId, claimedSession.id));
      jaAdiantado = advRows.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
    }

    // 2. Cria pedido
    const [order] = await tx.insert(schema.orders).values({
      storeId,
      number:        nextNumber,
      status:        "delivered",
      type:          "pickup",
      channel:       "pdv",
      paymentMethod: body.paymentMethod,
      paymentStatus: "paid",
      // Venda do PDV nasce concretizada e finalizada — a baixa de estoque e o
      // lançamento financeiro acontecem logo abaixo, na mesma transação.
      saleStatus:    "finalizada",
      concretizedAt: new Date(),
      installments:  body.installments && body.installments > 1 ? body.installments : 1,
      subtotal:      body.subtotal,
      deliveryFee:   "0",
      discount:      body.discount || "0",
      total:         body.total,
      notes:         body.mesaLabel ? `PDV — ${body.mesaLabel}` : "PDV",
      deliveredAt:   new Date(),
    }).returning();

    if (claimedSession) {
      await tx.update(servicePointSessions)
        .set({ orderId: order.id })
        .where(eq(servicePointSessions.id, claimedSession.id));
    }

    // 3. Itens
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

    // 4. Baixa de estoque (apenas produtos com trackStock = true)
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

    // 5. Lançamento financeiro — só do valor cobrado AGORA (total menos o
    // que já foi adiantado antes; esse adiantamento já gerou o próprio
    // lançamento quando foi registrado). Se o adiantamento já cobriu tudo,
    // não sobra nada pra lançar aqui (a receita inteira já está nos
    // lançamentos de adiantamento) — mas o pedido continua criado normal.
    const totalVal = parseFloat(body.total) || 0;
    const restante = Math.max(0, totalVal - jaAdiantado);
    const metodo   = body.paymentMethod;

    let lancamento: typeof financeiroLancamentos.$inferSelect | null = null;
    if (restante > 0.004) {
      [lancamento] = await tx.insert(financeiroLancamentos).values({
        storeId,
        tipo:            "entrada",
        categoria:       "venda",
        descricao:       `Venda PDV #${nextNumber}${body.mesaLabel ? ` — ${body.mesaLabel}` : ""}`,
        valor:           restante.toFixed(2),
        metodoPagamento: body.paymentMethod,
        status:          "liquidado",
        dataCompetencia: todayStr,
        dataPagamento:   todayStr,
        orderId:         order.id,
        sessaoId:        body.sessaoId,
      }).returning();
    }

    // 6. Atualiza totais da sessão de caixa — mesma regra: só o restante,
    // pra não contar o adiantamento duas vezes.
    const updateSet: Record<string, unknown> = {
      totalVendas: sql`${caixaSessoes.totalVendas} + 1`,
    };
    if (restante > 0.004) {
      if (metodo === "cash")        updateSet.totalDinheiro = sql`${caixaSessoes.totalDinheiro} + ${restante}`;
      else if (metodo === "pix")    updateSet.totalPix      = sql`${caixaSessoes.totalPix}      + ${restante}`;
      else if (metodo === "card")   updateSet.totalCartao   = sql`${caixaSessoes.totalCartao}   + ${restante}`;
      else if (metodo === "debit")  updateSet.totalDebito   = sql`${caixaSessoes.totalDebito}   + ${restante}`;
      else                          updateSet.totalOutros   = sql`${caixaSessoes.totalOutros}   + ${restante}`;
    }

    await tx.update(caixaSessoes)
      .set(updateSet)
      .where(eq(caixaSessoes.id, body.sessaoId));

    return { order, lancamento };
  });

  return json({ success: true, order: result.order, lancamento: result.lancamento }, 201);
  } catch (e) {
    if (e instanceof AlreadySoldError) {
      return err("Esse atendimento já foi finalizado.", 409);
    }
    throw e;
  }
}

// Corrida de duplo clique / retry de rede em "Finalizar Venda" pra a mesma
// mesa — a trava atômica em service_point_sessions (WHERE closed_at IS
// NULL) já barra a segunda chamada antes de criar um segundo pedido.
class AlreadySoldError extends Error {}

// ─── POST /api/pdv/encerrar-encomenda ─────────────────────────────
// Encerra um pedido de delivery/retirada do site que chegou como "encomenda
// pendente" (reserva de estoque, ainda sem forma de pagamento real
// confirmada): concretiza a reserva (baixa real de estoque), grava o
// lançamento financeiro atrelado à sessão de caixa aberta, e — se
// `expedir` — avança o pedido pro status "Saiu para entrega" (o kanban já
// imprime a ficha de entrega automaticamente nessa transição, se
// configurado).
//
// Usa createDbTransactional (BYPASSRLS), igual ao resto deste arquivo —
// achado nessa sessão: a versão anterior usava createTenantDbTransactional
// (RLS real) achando que era "mais hardened", mas financeiro_lancamentos só
// tem policy de SELECT pra armazix_tenant
// (drizzle/0045_rls_financeiro_lancamentos.sql — escrita nessa tabela
// sempre foi pra ser feita via BYPASSRLS). Na prática, TODA encomenda
// encerrada por aqui vinha caindo com "new row violates row-level security
// policy" no insert do lançamento, e a transação inteira desfazia — ou
// seja, "Encerrar Encomenda" nunca funcionava de verdade. O isolamento
// continua garantido pelo filtro manual eq(storeId, ...) já presente em
// toda query, mesmo padrão de finalizarVendaPdvHandler acima.
const VALID_CLOSE_PAYMENT_METHODS = ["pix", "card", "debit", "cash", "mercadopago"];

export async function encerrarEncomendaHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

  const body = await request.json() as {
    sessaoId: string;
    orderId: string;
    paymentMethod: string;
    installments?: number;
    expedir?: boolean;
  };
  if (!body.sessaoId || !body.orderId || !body.paymentMethod) {
    return err("sessaoId, orderId e paymentMethod obrigatórios");
  }
  if (!VALID_CLOSE_PAYMENT_METHODS.includes(body.paymentMethod)) {
    return err("Método de pagamento inválido");
  }

  const db = createDb(process.env.DATABASE_URL!);

  const [sessao] = await db
    .select({ id: caixaSessoes.id, status: caixaSessoes.status })
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.id, body.sessaoId), eq(caixaSessoes.storeId, storeId)))
    .limit(1);
  if (!sessao || sessao.status !== "aberta") return err("Sessão de caixa não encontrada ou encerrada", 409);

  const [existingOrder] = await db
    .select({ id: orders.id, concretizedAt: orders.concretizedAt })
    .from(orders)
    .where(and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)))
    .limit(1);
  if (!existingOrder) return err("Pedido não encontrado", 404);
  if (existingOrder.concretizedAt !== null) return err("Pedido já foi encerrado", 409);

  const txDb = createDbTransactional(process.env.DATABASE_URL!);

  try {
    const result = await txDb.transaction(async (tx) => {
      const now = new Date();
      const novoStatus = body.expedir ? "delivering" : "delivered";

      // Guard atômico de idempotência: o WHERE só bate a primeira vez
      // (concretized_at IS NULL) — evita concretizar duas vezes numa
      // corrida de clique duplo.
      const [claimed] = await tx.update(orders)
        .set({
          paymentMethod: body.paymentMethod,
          paymentStatus: "paid",
          status:        novoStatus,
          installments:  body.installments && body.installments > 1 ? body.installments : 1,
          concretizedAt: now,
          ...(novoStatus === "delivered" && { deliveredAt: now }),
          updatedAt:     now,
        })
        .where(and(
          eq(orders.id, body.orderId),
          eq(orders.storeId, storeId),
          isNull(orders.concretizedAt),
        ))
        .returning();

      if (!claimed) {
        throw new AlreadyClosedError();
      }

      const items = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderId, body.orderId),
        columns: { productId: true, productName: true, quantity: true },
      });

      await concretizeReservation(tx, storeId, items, body.orderId, claimed.number);

      const todayStr = today();
      const [lancamento] = await tx.insert(financeiroLancamentos).values({
        storeId,
        tipo:            "entrada",
        categoria:       "venda",
        descricao:       `Encomenda encerrada — Pedido #${claimed.number}`,
        valor:           claimed.total,
        metodoPagamento: body.paymentMethod,
        status:          "liquidado",
        dataCompetencia: todayStr,
        dataPagamento:   todayStr,
        orderId:         body.orderId,
        sessaoId:        body.sessaoId,
      }).returning();

      const totalVal = parseFloat(claimed.total) || 0;
      const updateSet: Record<string, unknown> = {
        totalVendas: sql`${caixaSessoes.totalVendas} + 1`,
      };
      if (body.paymentMethod === "cash")        updateSet.totalDinheiro = sql`${caixaSessoes.totalDinheiro} + ${totalVal}`;
      else if (body.paymentMethod === "pix")    updateSet.totalPix      = sql`${caixaSessoes.totalPix}      + ${totalVal}`;
      else if (body.paymentMethod === "card")   updateSet.totalCartao   = sql`${caixaSessoes.totalCartao}   + ${totalVal}`;
      else if (body.paymentMethod === "debit")  updateSet.totalDebito   = sql`${caixaSessoes.totalDebito}   + ${totalVal}`;
      else                                       updateSet.totalOutros   = sql`${caixaSessoes.totalOutros}   + ${totalVal}`;

      await tx.update(caixaSessoes)
        .set(updateSet)
        .where(eq(caixaSessoes.id, body.sessaoId));

      await tx.insert(orderTimeline).values({
        orderId: body.orderId,
        status:  novoStatus,
        note:    body.expedir
          ? "Encomenda encerrada e expedida pelo PDV"
          : "Encomenda encerrada pelo PDV",
      });

      return { order: claimed, lancamento };
    });

    return json({ success: true, order: result.order, lancamento: result.lancamento }, 200);
  } catch (e) {
    if (e instanceof AlreadyClosedError) {
      return err("Pedido já foi encerrado", 409);
    }
    throw e;
  }
}

class AlreadyClosedError extends Error {}

// ─── GET /api/pdv/financeiro — Lançamentos para tela financeiro ──
export async function listFinanceiroLancamentosHandler(
  request: Request, auth?: AuthContext,
): Promise<Response> {
  let storeId: string;
  try { ({ storeId } = await requireStoreAccess(auth)); }
  catch (e) { return err((e as Error).message, auth?.userId ? 403 : 401); }

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

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
