// ─────────────────────────────────────────────────────────────────────────
// Pontos de Atendimento — CRUD de Mesas e Comandas/Cartões do PDV.
// Nome é sempre "Mesa N" ou "Cartão N", gerado automaticamente (nunca texto
// livre) — o único dado extra que o lojista informa é, opcionalmente, um
// cliente já cadastrado atrelado ao ponto (ex: "Mesa 05" ocupada por
// "João Silva"). Generaliza o antigo endpoint de "mesas" (que substituía a
// lista inteira a cada save) por CRUD individual, com status ativo/inativo
// por item e um gerador em lote pra criar uma sequência de uma vez.
// ─────────────────────────────────────────────────────────────────────────

import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, asc, desc, isNull, isNotNull } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";

const { servicePoints, customers, servicePointSessions, caixaSessoes, orders } = schema;

const JSON_HDR = { "content-type": "application/json" };
const json     = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err      = (msg: string, status = 400) => json({ error: msg }, status);

const VALID_TYPES = ["MESA", "CARTAO"] as const;
type ServicePointType = typeof VALID_TYPES[number];

function isValidType(t: unknown): t is ServicePointType {
  return typeof t === "string" && (VALID_TYPES as readonly string[]).includes(t);
}

// Nome é sempre o rótulo do tipo + número — nunca digitado à mão.
const BASE_LABEL: Record<ServicePointType, string> = { MESA: "Mesa", CARTAO: "Cartão" };

// "Mesa 01", "Mesa 02"... — número sempre com pelo menos 2 dígitos, pra não
// misturar "Mesa1" (sem espaço) com "Mesa 11" na mesma listagem.
function formatPointName(type: ServicePointType, n: number): string {
  return `${BASE_LABEL[type]} ${String(n).padStart(2, "0")}`;
}

// Postgres unique_violation — usado como rede de segurança contra corrida
// (dois cadastros quase simultâneos calculando o mesmo próximo número).
function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505";
}

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

// Próximo número disponível pra "Mesa"/"Cartão" nessa loja — olha o maior
// número já usado (ativo ou inativo, pra nunca repetir) e soma 1.
async function nextNumberFor(
  db: ReturnType<typeof createDb>,
  storeId: string,
  type: ServicePointType,
): Promise<number> {
  const base = BASE_LABEL[type];
  const rows = await db
    .select({ nameOrNumber: servicePoints.nameOrNumber })
    .from(servicePoints)
    .where(and(eq(servicePoints.storeId, storeId), eq(servicePoints.type, type)));

  let max = 0;
  const re = new RegExp(`^${base}\\s*(\\d+)$`, "i");
  for (const r of rows) {
    const m = r.nameOrNumber.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

// customerId, quando informado, precisa ser um cliente de verdade dessa
// loja — nunca aceita um id de outro tenant nem texto livre.
async function customerBelongsToStore(
  db: ReturnType<typeof createDb>,
  storeId: string,
  customerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)))
    .limit(1);
  return !!row;
}

// "Cliente Padrão" da loja — todo ponto de atendimento sem cliente específico
// fica atrelado a ele (toda loja tem um desde a criação, ver
// register-handler.ts). Retorna null em vez de quebrar se por algum motivo
// não existir (loja antiga que ainda não rodou o backfill) — o ponto
// simplesmente fica sem cliente nesse caso, igual ao comportamento anterior.
async function getDefaultCustomerId(
  db: ReturnType<typeof createDb>,
  storeId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.storeId, storeId), eq(customers.isDefault, true), eq(customers.isSupplier, false)))
    .limit(1);
  return row?.id ?? null;
}

// ─── GET /api/service-points/list ─────────────────────────────────
export async function listServicePointsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = createDb(process.env.DATABASE_URL!);
  const rows = await db
    .select({
      id:            servicePoints.id,
      storeId:       servicePoints.storeId,
      nameOrNumber:  servicePoints.nameOrNumber,
      type:          servicePoints.type,
      isActive:      servicePoints.isActive,
      createdAt:     servicePoints.createdAt,
      customerId:    servicePoints.customerId,
      customerName:  customers.name,
      customerPhone: customers.phone,
      // Sessão aberta (se houver) — no máximo uma por ponto (índice
      // parcial), então o join não duplica linhas. null = livre.
      openSessionId: servicePointSessions.id,
      openedAt:      servicePointSessions.openedAt,
    })
    .from(servicePoints)
    .leftJoin(customers, eq(servicePoints.customerId, customers.id))
    .leftJoin(servicePointSessions, and(
      eq(servicePointSessions.servicePointId, servicePoints.id),
      isNull(servicePointSessions.closedAt),
    ))
    .where(eq(servicePoints.storeId, storeId))
    .orderBy(asc(servicePoints.type), asc(servicePoints.createdAt));

  return json({ servicePoints: rows });
}

// ─── POST /api/service-points/create ──────────────────────────────
export async function createServicePointHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as {
    type?: string;
    customerId?: string | null;
    isActive?: boolean;
  };

  if (!isValidType(body.type)) return err('Tipo inválido — use "MESA" ou "CARTAO"');
  const type = body.type;
  const isActive = body.isActive !== false;

  const db = createDb(process.env.DATABASE_URL!);

  // Sem cliente informado, o ponto nasce atrelado ao Cliente Padrão — nunca
  // sem ninguém. Se um cliente específico for informado, ele que prevalece.
  let customerId: string | null;
  if (body.customerId) {
    const ok = await customerBelongsToStore(db, storeId, body.customerId);
    if (!ok) return err("Cliente não encontrado", 404);
    customerId = body.customerId;
  } else {
    customerId = await getDefaultCustomerId(db, storeId);
  }

  try {
    const nextNumber   = await nextNumberFor(db, storeId, type);
    const nameOrNumber = formatPointName(type, nextNumber);

    const [point] = await db.insert(servicePoints).values({
      storeId,
      nameOrNumber,
      type,
      isActive,
      customerId,
    }).returning();

    return json({ success: true, servicePoint: point }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return err("Já existe um ponto com esse número — tente novamente", 409);
    }
    console.error("[service-points] create error:", error);
    return err("Erro ao criar ponto de atendimento", 500);
  }
}

// ─── POST /api/service-points/update ──────────────────────────────
// Só altera status (ativo/inativo) e o cliente atrelado — o nome ("Mesa N"/
// "Cartão N") e o tipo são fixados na criação e não mudam depois, pra nunca
// haver uma "Mesa 5" que na verdade virou uma comanda ou foi renomeada.
export async function updateServicePointHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as {
    id?: string;
    customerId?: string | null;
    isActive?: boolean;
  };
  if (!body.id) return err("id obrigatório");

  const db = createDb(process.env.DATABASE_URL!);

  const [existing] = await db
    .select({ id: servicePoints.id })
    .from(servicePoints)
    .where(and(eq(servicePoints.id, body.id), eq(servicePoints.storeId, storeId)))
    .limit(1);
  if (!existing) return err("Ponto de atendimento não encontrado", 404);

  if (body.customerId) {
    const ok = await customerBelongsToStore(db, storeId, body.customerId);
    if (!ok) return err("Cliente não encontrado", 404);
  }

  const updates: Partial<typeof servicePoints.$inferInsert> = {};
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.customerId !== undefined) {
    // Limpar a seleção não deixa o ponto sem cliente — volta pro Cliente
    // Padrão, que é o estado de repouso. Um cliente específico substitui.
    updates.customerId = body.customerId || await getDefaultCustomerId(db, storeId);
  }

  const [updated] = await db.update(servicePoints)
    .set(updates)
    .where(and(eq(servicePoints.id, body.id), eq(servicePoints.storeId, storeId)))
    .returning();

  return json({ success: true, servicePoint: updated });
}

// ─── POST /api/service-points/delete ──────────────────────────────
// Soft delete (inativa) — mesmo padrão do resto do admin (produtos, mesas):
// nunca apaga de vez, só tira de circulação. Preserva histórico de vendas
// que citam o nome do ponto (ex: "PDV — Mesa 05" nas notas do pedido).
export async function deleteServicePointHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { id?: string };
  if (!body.id) return err("id obrigatório");

  const db = createDb(process.env.DATABASE_URL!);

  const [updated] = await db.update(servicePoints)
    .set({ isActive: false })
    .where(and(eq(servicePoints.id, body.id), eq(servicePoints.storeId, storeId)))
    .returning({ id: servicePoints.id });

  if (!updated) return err("Ponto de atendimento não encontrado", 404);
  return json({ success: true });
}

// ─── POST /api/service-points/batch-create ────────────────────────
// Gerador de sequência: "Mesa 1" até "Mesa 30" de uma vez, continuando a
// partir do maior número já usado pra esse tipo (nunca reaproveita número
// de um ponto que já existe, mesmo inativo).
const BATCH_MAX_RANGE = 500;

export async function batchCreateServicePointsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as {
    type?: string;
    quantity?: number;
  };

  if (!isValidType(body.type)) return err('Tipo inválido — use "MESA" ou "CARTAO"');
  const type = body.type;
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return err("Informe uma quantidade válida (mínimo 1)");
  }
  if (quantity > BATCH_MAX_RANGE) {
    return err(`Intervalo muito grande — máximo de ${BATCH_MAX_RANGE} pontos por vez`);
  }

  const db = createDb(process.env.DATABASE_URL!);

  try {
    const start = await nextNumberFor(db, storeId, type);
    const names = Array.from({ length: quantity }, (_, i) => formatPointName(type, start + i));
    const customerId = await getDefaultCustomerId(db, storeId);

    const created = await db.insert(servicePoints).values(
      names.map(nameOrNumber => ({ storeId, nameOrNumber, type, isActive: true, customerId })),
    ).returning();

    return json({ success: true, created }, 201);
  } catch (error) {
    console.error("[service-points] batch-create error:", error);
    return err("Erro ao gerar pontos de atendimento em lote", 500);
  }
}

// ─── POST /api/service-points/sessions/open ────────────────────────
// Abre uma sessão pro ponto — cliente sentou/comanda foi entregue. No
// máximo uma sessão aberta por ponto (índice parcial); uma corrida de
// clique duplo cai no catch de unique_violation abaixo.
export async function openServicePointSessionHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { servicePointId?: string };
  if (!body.servicePointId) return err("servicePointId obrigatório");

  const db = createDb(process.env.DATABASE_URL!);

  const [point] = await db
    .select({ id: servicePoints.id, isActive: servicePoints.isActive })
    .from(servicePoints)
    .where(and(eq(servicePoints.id, body.servicePointId), eq(servicePoints.storeId, storeId)))
    .limit(1);
  if (!point) return err("Ponto de atendimento não encontrado", 404);
  if (!point.isActive) return err("Esse ponto de atendimento está inativo", 409);

  // Sessão de caixa em andamento (se houver) — capturada aqui pra a aba
  // "Encerrados" conseguir escopar até sessões fechadas sem pedido.
  const [caixaSessao] = await db
    .select({ id: caixaSessoes.id })
    .from(caixaSessoes)
    .where(and(eq(caixaSessoes.storeId, storeId), eq(caixaSessoes.status, "aberta")))
    .limit(1);

  try {
    const [session] = await db.insert(servicePointSessions).values({
      storeId,
      servicePointId: body.servicePointId,
      caixaSessaoId: caixaSessao?.id ?? null,
    }).returning();

    return json({ success: true, session }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return err("Esse ponto já está ocupado", 409);
    }
    console.error("[service-points] open session error:", error);
    return err("Erro ao abrir atendimento", 500);
  }
}

// ─── POST /api/service-points/sessions/close ───────────────────────
// Libera o ponto manualmente, sem pedido vinculado (cliente foi embora
// sem pedir). O fechamento vinculado a uma venda de verdade acontece
// dentro de finalizarVendaPdvHandler (pdv-handler.ts), não aqui.
export async function closeServicePointSessionHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { servicePointId?: string };
  if (!body.servicePointId) return err("servicePointId obrigatório");

  const db = createDb(process.env.DATABASE_URL!);

  const [closed] = await db.update(servicePointSessions)
    .set({ closedAt: new Date() })
    .where(and(
      eq(servicePointSessions.servicePointId, body.servicePointId),
      eq(servicePointSessions.storeId, storeId),
      isNull(servicePointSessions.closedAt),
    ))
    .returning();

  if (!closed) return err("Esse ponto já está livre", 409);
  return json({ success: true, session: closed });
}

// ─── GET /api/service-points/sessions/closed?sessaoId= ─────────────
// Histórico de atendimentos encerrados — escopado à sessão de caixa
// informada (mesma unidade natural já usada em Posição/Apontamento no
// resto do PDV), não um intervalo de datas.
export async function listClosedServicePointSessionsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const url = new URL(request.url);
  const sessaoId = url.searchParams.get("sessaoId");
  if (!sessaoId) return err("sessaoId obrigatório");

  const db = createDb(process.env.DATABASE_URL!);
  const rows = await db
    .select({
      id:            servicePointSessions.id,
      nameOrNumber:  servicePoints.nameOrNumber,
      type:          servicePoints.type,
      openedAt:      servicePointSessions.openedAt,
      closedAt:      servicePointSessions.closedAt,
      orderId:       servicePointSessions.orderId,
      orderNumber:   orders.number,
      orderTotal:    orders.total,
      paymentMethod: orders.paymentMethod,
    })
    .from(servicePointSessions)
    .innerJoin(servicePoints, eq(servicePointSessions.servicePointId, servicePoints.id))
    .leftJoin(orders, eq(servicePointSessions.orderId, orders.id))
    .where(and(
      eq(servicePointSessions.storeId, storeId),
      eq(servicePointSessions.caixaSessaoId, sessaoId),
      isNotNull(servicePointSessions.closedAt),
    ))
    .orderBy(desc(servicePointSessions.closedAt));

  return json({ sessions: rows });
}
