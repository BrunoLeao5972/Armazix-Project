// ─────────────────────────────────────────────────────────────────────────
// Conta em aberto de uma mesa/comanda — o painel de resumo do Mapa de
// Atendimentos do PDV. Antes disso "Lançar Item [F3]" era decorativo (só
// um setTimeout no front, nunca gravava nada) e o carrinho era um único
// estado local do navegador, não vinculado a mesa nenhuma no servidor —
// ver a nota em service_point_tab_items no schema. Aqui os itens já
// lançados numa sessão de atendimento aberta (service_point_sessions)
// passam a ser persistidos de verdade, e "Adiantamento" (pagamento
// parcial antes de fechar a conta) ganha um lançamento financeiro real.
// ─────────────────────────────────────────────────────────────────────────

import { createDb, createDbTransactional } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { hasPdvAccess } from "@/lib/plans";

const {
  servicePoints, servicePointSessions, servicePointTabItems, servicePointAdvances,
  caixaSessoes, financeiroLancamentos, stores,
} = schema;

const JSON_HDR = { "content-type": "application/json" };
const json     = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err      = (msg: string, status = 400) => json({ error: msg }, status);

async function resolveStoreId(auth?: AuthContext): Promise<{ storeId: string } | Response> {
  try {
    return { storeId: (await requireStoreAccess(auth)).storeId };
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: auth?.userId ? 403 : 401,
      headers: JSON_HDR,
    });
  }
}

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

// Sessão aberta (não fechada) de um ponto de atendimento, escopada à loja
// — add-items/advance recebem servicePointId (não sessionId), que é o que
// o front tem à mão a partir do mapa. Aceita tanto a conexão HTTP simples
// (createDb) quanto a conexão transacional (createDbTransactional, usada
// em registerAdvanceHandler) — mesmo schema, drivers diferentes.
type AnyDb = ReturnType<typeof createDb> | ReturnType<typeof createDbTransactional>;

async function findOpenSession(
  db: AnyDb, storeId: string, servicePointId: string,
) {
  const [session] = await db.select().from(servicePointSessions)
    .where(and(
      eq(servicePointSessions.servicePointId, servicePointId),
      eq(servicePointSessions.storeId, storeId),
      isNull(servicePointSessions.closedAt),
    )).limit(1);
  return session ?? null;
}

// ─── GET /api/service-points/tab?sessionId= ───────────────────────
export async function getServicePointTabHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url       = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return err("sessionId obrigatório");

  const db = createDb(process.env.DATABASE_URL!);

  const [session] = await db.select({ id: servicePointSessions.id })
    .from(servicePointSessions)
    .where(and(eq(servicePointSessions.id, sessionId), eq(servicePointSessions.storeId, storeId)))
    .limit(1);
  if (!session) return err("Sessão não encontrada", 404);

  const [items, advances] = await Promise.all([
    db.select().from(servicePointTabItems)
      .where(eq(servicePointTabItems.sessionId, sessionId))
      .orderBy(asc(servicePointTabItems.createdAt)),
    db.select().from(servicePointAdvances)
      .where(eq(servicePointAdvances.sessionId, sessionId))
      .orderBy(asc(servicePointAdvances.createdAt)),
  ]);

  return json({ items, advances });
}

// ─── POST /api/service-points/tab/add-items ───────────────────────
// "Lançar Pedido [F3]" de verdade — confirma na conta da mesa os itens do
// carrinho local montado no overlay de catálogo (aberto a partir de
// "Adicionar").
export async function addTabItemsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

  const body = await request.json() as {
    servicePointId?: string;
    items?: {
      productId: string | null; productName: string;
      productEmoji?: string | null; unitPrice: string; quantity: number;
    }[];
  };
  if (!body.servicePointId || !body.items?.length) return err("servicePointId e items obrigatórios");

  const db      = createDb(process.env.DATABASE_URL!);
  const session = await findOpenSession(db, storeId, body.servicePointId);
  if (!session) return err("Esse ponto de atendimento não está aberto", 409);

  const existentes = await db.select().from(servicePointTabItems)
    .where(eq(servicePointTabItems.sessionId, session.id));

  for (const item of body.items) {
    if (!item.productName?.trim() || !item.quantity || item.quantity <= 0) continue;

    // Merge com uma linha já existente do mesmo produto + mesmo preço —
    // mesma regra de "somar quantidade" que o carrinho local já fazia.
    const igual = existentes.find(e =>
      e.productId === (item.productId || null) &&
      e.unitPrice === item.unitPrice &&
      e.productName === item.productName);

    if (igual) {
      await db.update(servicePointTabItems)
        .set({ quantity: igual.quantity + item.quantity, updatedAt: new Date() })
        .where(eq(servicePointTabItems.id, igual.id));
      igual.quantity += item.quantity; // não soma de novo se o body repetir o mesmo produto
    } else {
      const [novo] = await db.insert(servicePointTabItems).values({
        storeId, sessionId: session.id,
        productId:    item.productId || null,
        productName:  item.productName.slice(0, 200),
        productEmoji: item.productEmoji || null,
        unitPrice:    item.unitPrice,
        quantity:     item.quantity,
      }).returning();
      existentes.push(novo);
    }
  }

  const itemsAtualizados = await db.select().from(servicePointTabItems)
    .where(eq(servicePointTabItems.sessionId, session.id))
    .orderBy(asc(servicePointTabItems.createdAt));

  return json({ success: true, items: itemsAtualizados });
}

// ─── POST /api/service-points/tab/update-item ─────────────────────
// "Editar" — ajusta a quantidade de um item já lançado na conta
// (quantity <= 0 remove a linha).
export async function updateTabItemHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { itemId?: string; quantity?: number };
  if (!body.itemId || body.quantity === undefined) return err("itemId e quantity obrigatórios");

  const db = createDb(process.env.DATABASE_URL!);
  const [item] = await db.select({ id: servicePointTabItems.id })
    .from(servicePointTabItems)
    .where(and(eq(servicePointTabItems.id, body.itemId), eq(servicePointTabItems.storeId, storeId)))
    .limit(1);
  if (!item) return err("Item não encontrado", 404);

  if (body.quantity <= 0) {
    await db.delete(servicePointTabItems).where(eq(servicePointTabItems.id, body.itemId));
    return json({ success: true, removed: true });
  }

  const [updated] = await db.update(servicePointTabItems)
    .set({ quantity: body.quantity, updatedAt: new Date() })
    .where(eq(servicePointTabItems.id, body.itemId))
    .returning();

  return json({ success: true, item: updated });
}

// ─── POST /api/service-points/tab/advance ─────────────────────────
// "Adiantamento" — pagamento parcial registrado numa conta ainda aberta.
// Incrementa os totais de caixa igual a uma venda de verdade e gera um
// lançamento financeiro próprio; finalizarVendaPdvHandler soma essas
// linhas na hora de fechar a mesa pra não contar o dinheiro duas vezes.
export async function registerAdvanceHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const pdvBlocked = await requirePdvAccess(storeId);
  if (pdvBlocked) return pdvBlocked;

  const body = await request.json() as {
    servicePointId?: string; valor?: string; formaPagamento?: string; criadoPor?: string;
  };
  const valorNum = parseFloat((body.valor || "").replace(",", "."));
  if (!body.servicePointId || !body.formaPagamento || !valorNum || valorNum <= 0) {
    return err("servicePointId, valor e formaPagamento obrigatórios");
  }

  const db      = createDbTransactional(process.env.DATABASE_URL!);
  const session = await findOpenSession(db, storeId, body.servicePointId);
  if (!session) return err("Esse ponto de atendimento não está aberto", 409);

  const [caixaSessao] = await db.select({ id: caixaSessoes.id })
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.storeId, storeId), eq(caixaSessoes.status, "aberta")))
    .limit(1);
  if (!caixaSessao) return err("Nenhum caixa aberto — abra o caixa antes de registrar um adiantamento.", 409);

  const [ponto] = await db.select({ nameOrNumber: servicePoints.nameOrNumber })
    .from(servicePoints)
    .where(eq(servicePoints.id, body.servicePointId))
    .limit(1);

  const valorStr = valorNum.toFixed(2);
  const formaPagamento = body.formaPagamento;

  const advance = await db.transaction(async (tx) => {
    const [advance] = await tx.insert(servicePointAdvances).values({
      storeId, sessionId: session.id, caixaSessaoId: caixaSessao.id,
      valor: valorStr, formaPagamento, criadoPor: body.criadoPor || null,
    }).returning();

    const updateSet: Record<string, unknown> = {};
    if (formaPagamento === "cash")        updateSet.totalDinheiro = sql`${caixaSessoes.totalDinheiro} + ${valorNum}`;
    else if (formaPagamento === "pix")    updateSet.totalPix      = sql`${caixaSessoes.totalPix}      + ${valorNum}`;
    else if (formaPagamento === "card")   updateSet.totalCartao   = sql`${caixaSessoes.totalCartao}   + ${valorNum}`;
    else if (formaPagamento === "debit")  updateSet.totalDebito   = sql`${caixaSessoes.totalDebito}   + ${valorNum}`;
    else                                   updateSet.totalOutros   = sql`${caixaSessoes.totalOutros}   + ${valorNum}`;
    await tx.update(caixaSessoes).set(updateSet).where(eq(caixaSessoes.id, caixaSessao.id));

    const todayStr = new Date().toISOString().slice(0, 10);
    await tx.insert(financeiroLancamentos).values({
      storeId,
      tipo:            "entrada",
      categoria:       "adiantamento",
      descricao:       `Adiantamento — ${ponto?.nameOrNumber || "Atendimento"}`,
      valor:           valorStr,
      metodoPagamento: formaPagamento,
      status:          "liquidado",
      dataCompetencia: todayStr,
      dataPagamento:   todayStr,
      sessaoId:        caixaSessao.id,
    });

    return advance;
  });

  return json({ success: true, advance }, 201);
}
