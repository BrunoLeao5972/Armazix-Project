// ─────────────────────────────────────────────────────────────────────────
// Backend real de "Contas a Receber" (src/routes/admin/financeiro/-sec-receivables.tsx).
// Espelha financeiro-pagar-handler.ts — mesmo problema (GET /api/financeiro/
// contas-receber não existia, lista sempre vazia; botão/modal já existiam
// no front, só a persistência era 100% local, some no F5).
//
// Tabela dedicada financeiro_contas_receber, RLS completo (FOR ALL) —
// drizzle/0048_financeiro_contas_receber.sql. Ao "Receber", grava também
// uma linha em financeiro_lancamentos (tipo="entrada").
// ─────────────────────────────────────────────────────────────────────────

import { createUnscopedDb, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { temPermissao, type StoreRole } from "@/lib/reports-permissions";
import { sanitizeString } from "@/lib/validation/schemas";

const { financeiroContasReceber, financeiroLancamentos } = schema;

const JSON_HDR = { "content-type": "application/json" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err  = (msg: string, status = 400) => json({ error: msg }, status);

const PAPEIS_FINANCEIRO = ["admin", "gerente", "financeiro"] as const;

async function resolveStoreId(auth: AuthContext | undefined): Promise<{ storeId: string } | Response> {
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

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function brParaIso(br: string | null | undefined): string | null {
  if (!br) return null;
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(br.trim())) return br.trim();
  return null;
}

function isoParaBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function paraNumero(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return NaN;
  return parseFloat(v.replace(",", "."));
}

type LinhaContaReceber = typeof financeiroContasReceber.$inferSelect;

function paraContaReceber(r: LinhaContaReceber) {
  const vencidaHoje = (r.status === "pendente" || r.status === "parcial") && r.vencimento < hojeISO();
  return {
    id: r.id,
    cliente: r.cliente,
    desc: r.descricao,
    documento: r.documento ?? "",
    categoria: r.categoria ?? "",
    centroCusto: r.centroCusto ?? "",
    contaFinanceira: r.contaFinanceira ?? "",
    valor: Number(r.valor),
    juros: Number(r.juros),
    desconto: Number(r.desconto),
    valorRecebido: Number(r.valorRecebido),
    formaPgto: r.formaPgto ?? "",
    emissao: isoParaBr(r.emissao) ?? "",
    vencimento: isoParaBr(r.vencimento) ?? "",
    recebimento: isoParaBr(r.recebimento),
    status: vencidaHoje ? "vencido" : r.status,
    origem: r.origem,
    responsavel: r.responsavel ?? "",
    obs: r.obs ?? "",
    parcelas: r.parcelas,
    parcelaAtual: r.parcelaAtual,
  };
}

// ─── GET /api/financeiro/contas-receber ─────────────────────────────────────
export async function listContasReceberHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select().from(financeiroContasReceber)
      .where(eq(financeiroContasReceber.storeId, storeId))
      .orderBy(financeiroContasReceber.vencimento);
    return json(rows.map(paraContaReceber));
  } catch (error) {
    console.error("[financeiro-receber] list error:", error);
    return err("Erro ao buscar contas a receber", 500);
  }
}

// ─── POST /api/financeiro/contas-receber/create ─────────────────────────────
export async function createContaReceberHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as {
    cliente?: string; desc?: string; documento?: string; categoria?: string;
    centroCusto?: string; contaFinanceira?: string; valor?: string | number;
    juros?: string | number; desconto?: string | number; formaPgto?: string;
    emissao?: string; vencimento?: string; obs?: string; parcelas?: string | number;
    responsavel?: string;
  };

  const cliente   = sanitizeString(body.cliente ?? "");
  const descricao = sanitizeString(body.desc ?? "");
  const valor     = paraNumero(body.valor);
  const vencimentoIso = brParaIso(body.vencimento);

  if (!cliente || !descricao || !Number.isFinite(valor) || valor <= 0 || !vencimentoIso) {
    return err("Cliente, descrição, valor e vencimento são obrigatórios", 400);
  }

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const [criada] = await db.insert(financeiroContasReceber).values({
      storeId,
      cliente, descricao,
      documento:       body.documento ? sanitizeString(body.documento) : null,
      categoria:       body.categoria ?? null,
      centroCusto:     body.centroCusto ?? null,
      contaFinanceira: body.contaFinanceira ?? null,
      valor:           valor.toFixed(2),
      juros:           (paraNumero(body.juros) || 0).toFixed(2),
      desconto:        (paraNumero(body.desconto) || 0).toFixed(2),
      formaPgto:       body.formaPgto ?? null,
      emissao:         brParaIso(body.emissao) ?? hojeISO(),
      vencimento:      vencimentoIso,
      obs:             body.obs ? sanitizeString(body.obs) : null,
      parcelas:        Number(body.parcelas) || 1,
      responsavel:     body.responsavel ? sanitizeString(body.responsavel) : null,
      origem:          "Manual",
      status:          "pendente",
    }).returning();

    return json(paraContaReceber(criada), 201);
  } catch (error) {
    console.error("[financeiro-receber] create error:", error);
    return err("Erro ao criar conta a receber", 500);
  }
}

// ─── POST /api/financeiro/contas-receber/update ─────────────────────────────
export async function updateContaReceberHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as {
    id?: string; valor?: string | number; juros?: string | number; desconto?: string | number;
    vencimento?: string; categoria?: string; centroCusto?: string; obs?: string;
  };
  if (!body.id) return err("id é obrigatório", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const [atual] = await db.select().from(financeiroContasReceber)
      .where(and(eq(financeiroContasReceber.id, body.id), eq(financeiroContasReceber.storeId, storeId))).limit(1);
    if (!atual) return err("Conta não encontrada", 404);

    const bloqueiaValoresEVencimento = atual.status === "pago" || atual.origem !== "Manual";
    if (bloqueiaValoresEVencimento && (body.valor !== undefined || body.juros !== undefined || body.desconto !== undefined || body.vencimento !== undefined)) {
      return err(
        atual.status === "pago"
          ? "Este lançamento já foi efetivado. Apenas observações/categoria/centro de custo podem ser alterados."
          : "Este lançamento originou-se em outro módulo. Valores e vencimento não podem ser alterados aqui.",
        409,
      );
    }

    const [atualizada] = await db.update(financeiroContasReceber).set({
      ...(body.valor      !== undefined ? { valor: paraNumero(body.valor).toFixed(2) } : {}),
      ...(body.juros      !== undefined ? { juros: paraNumero(body.juros).toFixed(2) } : {}),
      ...(body.desconto   !== undefined ? { desconto: paraNumero(body.desconto).toFixed(2) } : {}),
      ...(body.vencimento !== undefined ? { vencimento: brParaIso(body.vencimento) ?? atual.vencimento } : {}),
      ...(body.categoria    !== undefined ? { categoria: body.categoria } : {}),
      ...(body.centroCusto  !== undefined ? { centroCusto: body.centroCusto } : {}),
      ...(body.obs          !== undefined ? { obs: sanitizeString(body.obs) } : {}),
      updatedAt: new Date(),
    }).where(and(eq(financeiroContasReceber.id, body.id), eq(financeiroContasReceber.storeId, storeId))).returning();

    return json(paraContaReceber(atualizada));
  } catch (error) {
    console.error("[financeiro-receber] update error:", error);
    return err("Erro ao atualizar conta a receber", 500);
  }
}

// ─── POST /api/financeiro/contas-receber/efetivar ───────────────────────────
export async function efetivarContaReceberHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { ids?: string[] };
  const ids = (body.ids ?? []).filter(Boolean);
  if (ids.length === 0) return err("Informe ao menos um id", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const contas = await db.select().from(financeiroContasReceber)
      .where(and(eq(financeiroContasReceber.storeId, storeId), inArray(financeiroContasReceber.id, ids)));

    const elegiveis = contas.filter(c => c.status !== "pago" && c.status !== "cancelado");
    const hoje = hojeISO();
    const atualizadas = [];
    for (const conta of elegiveis) {
      const [lancamento] = await db.insert(financeiroLancamentos).values({
        storeId,
        tipo: "entrada",
        categoria: conta.categoria || "recebimento",
        descricao: `Recebimento — ${conta.descricao} (${conta.cliente})`,
        valor: conta.valor,
        metodoPagamento: conta.formaPgto || undefined,
        status: "liquidado",
        dataCompetencia: hoje,
        dataPagamento: hoje,
      }).returning();

      const [atualizada] = await db.update(financeiroContasReceber).set({
        status: "pago",
        valorRecebido: conta.valor,
        recebimento: hoje,
        lancamentoId: lancamento.id,
        updatedAt: new Date(),
      }).where(eq(financeiroContasReceber.id, conta.id)).returning();
      atualizadas.push(atualizada);
    }

    return json({ contas: atualizadas.map(paraContaReceber), efetivadas: atualizadas.length });
  } catch (error) {
    console.error("[financeiro-receber] efetivar error:", error);
    return err("Erro ao registrar recebimento", 500);
  }
}

// ─── POST /api/financeiro/contas-receber/cancelar ───────────────────────────
export async function cancelarContaReceberHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { ids?: string[] };
  const ids = (body.ids ?? []).filter(Boolean);
  if (ids.length === 0) return err("Informe ao menos um id", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const atualizadas = await db.update(financeiroContasReceber)
      .set({ status: "cancelado", updatedAt: new Date() })
      .where(and(
        eq(financeiroContasReceber.storeId, storeId),
        inArray(financeiroContasReceber.id, ids),
        eq(financeiroContasReceber.status, "pendente"),
      )).returning();

    return json({ contas: atualizadas.map(paraContaReceber), canceladas: atualizadas.length });
  } catch (error) {
    console.error("[financeiro-receber] cancelar error:", error);
    return err("Erro ao cancelar conta a receber", 500);
  }
}

// ─── POST /api/financeiro/contas-receber/delete ─────────────────────────────
export async function deleteContaReceberHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { id?: string };
  if (!body.id) return err("id é obrigatório", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const [atual] = await db.select().from(financeiroContasReceber)
      .where(and(eq(financeiroContasReceber.id, body.id), eq(financeiroContasReceber.storeId, storeId))).limit(1);
    if (!atual) return err("Conta não encontrada", 404);

    if (atual.status === "pago") {
      return err("Não é possível excluir uma conta já efetivada. Estorne o lançamento primeiro.", 409);
    }
    if (atual.origem !== "Manual") {
      return err("Esta conta está vinculada a outro módulo e não pode ser excluída por aqui.", 409);
    }

    await db.delete(financeiroContasReceber)
      .where(and(eq(financeiroContasReceber.id, body.id), eq(financeiroContasReceber.storeId, storeId)));

    return json({ success: true });
  } catch (error) {
    console.error("[financeiro-receber] delete error:", error);
    return err("Erro ao excluir conta a receber", 500);
  }
}
