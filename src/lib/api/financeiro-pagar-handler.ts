// ─────────────────────────────────────────────────────────────────────────
// Backend real de "Contas a Pagar" (src/routes/admin/financeiro/-sec-payables.tsx).
// A tela nunca teve backend: GET /api/financeiro/contas-pagar não existia
// (lista sempre vazia, erro engolido no catch) e o botão "Nova Conta a
// Pagar" era um onClick vazio desde a criação do arquivo — nenhuma
// regressão, nunca funcionou.
//
// Tabela dedicada financeiro_contas_pagar (não financeiro_lancamentos, que
// é o livro-razão de valores já liquidados, sem vencimento/parcela/edição
// pré-liquidação). RLS completo (FOR ALL) — drizzle/0047_financeiro_contas_pagar.sql.
//
// Regras de edição/exclusão replicadas aqui em cima do que já existe no
// front (-sec-payables.tsx: validarEdicaoConta/validarExclusaoConta) —
// nunca confiar só na checagem client-side, um POST direto contornaria.
// ─────────────────────────────────────────────────────────────────────────

import { createUnscopedDb, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { temPermissao, type StoreRole } from "@/lib/reports-permissions";
import { sanitizeString } from "@/lib/validation/schemas";

const { financeiroContasPagar, financeiroLancamentos } = schema;

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

// dd/mm/aaaa <-> yyyy-mm-dd — o front trabalha com data brasileira em texto
// livre (input type="text", não type="date"); o banco guarda ISO (mesmo
// formato de financeiro_lancamentos.data_competencia) pra ordenar/comparar
// como string funcionar direito.
function brParaIso(br: string | null | undefined): string | null {
  if (!br) return null;
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(br.trim())) return br.trim(); // já veio ISO
  return null;
}

function isoParaBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Valor monetário vem do front como string com vírgula decimal ("150,00")
// — Number() direto retorna NaN nesse formato, mesma conversão que o front
// já faz em todo outro lugar (ex: ModalNovaContaReceber, parseFloat(form.valor.replace(",", "."))).
function paraNumero(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return NaN;
  return parseFloat(v.replace(",", "."));
}

type LinhaContaPagar = typeof financeiroContasPagar.$inferSelect;

// Row do banco -> formato ContaPagar do front (-fin-shared.tsx). "vencido"
// é calculado aqui, nunca gravado — pendente/parcial com vencimento no
// passado vira "vencido" só na resposta, pra nunca desincronizar do status
// de verdade guardado na coluna.
function paraContaPagar(r: LinhaContaPagar) {
  const vencidaHoje = (r.status === "pendente" || r.status === "parcial") && r.vencimento < hojeISO();
  return {
    id: r.id,
    fornecedor: r.fornecedor,
    desc: r.descricao,
    documento: r.documento ?? "",
    categoria: r.categoria ?? "",
    centroCusto: r.centroCusto ?? "",
    contaFinanceira: r.contaFinanceira ?? "",
    valor: Number(r.valor),
    juros: Number(r.juros),
    desconto: Number(r.desconto),
    valorPago: Number(r.valorPago),
    formaPgto: r.formaPgto ?? "",
    emissao: isoParaBr(r.emissao) ?? "",
    vencimento: isoParaBr(r.vencimento) ?? "",
    pagamento: isoParaBr(r.pagamento),
    status: vencidaHoje ? "vencido" : r.status,
    origem: r.origem,
    responsavel: r.responsavel ?? "",
    obs: r.obs ?? "",
    parcelas: r.parcelas,
    parcelaAtual: r.parcelaAtual,
  };
}

// ─── GET /api/financeiro/contas-pagar ───────────────────────────────────────
export async function listContasPagarHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const rows = await db.select().from(financeiroContasPagar)
      .where(eq(financeiroContasPagar.storeId, storeId))
      .orderBy(financeiroContasPagar.vencimento);
    return json(rows.map(paraContaPagar));
  } catch (error) {
    console.error("[financeiro-pagar] list error:", error);
    return err("Erro ao buscar contas a pagar", 500);
  }
}

// ─── POST /api/financeiro/contas-pagar/create ───────────────────────────────
export async function createContaPagarHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as {
    fornecedor?: string; desc?: string; documento?: string; categoria?: string;
    centroCusto?: string; contaFinanceira?: string; valor?: string | number;
    juros?: string | number; desconto?: string | number; formaPgto?: string;
    emissao?: string; vencimento?: string; obs?: string; parcelas?: string | number;
    responsavel?: string;
  };

  const fornecedor = sanitizeString(body.fornecedor ?? "");
  const descricao  = sanitizeString(body.desc ?? "");
  const valor      = paraNumero(body.valor);
  const vencimentoIso = brParaIso(body.vencimento);

  if (!fornecedor || !descricao || !Number.isFinite(valor) || valor <= 0 || !vencimentoIso) {
    return err("Fornecedor, descrição, valor e vencimento são obrigatórios", 400);
  }

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const [criada] = await db.insert(financeiroContasPagar).values({
      storeId,
      fornecedor, descricao,
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

    return json(paraContaPagar(criada), 201);
  } catch (error) {
    console.error("[financeiro-pagar] create error:", error);
    return err("Erro ao criar conta a pagar", 500);
  }
}

// ─── POST /api/financeiro/contas-pagar/update ───────────────────────────────
// Reaplica no servidor a mesma regra de validarEdicaoConta do front: bloqueia
// alterar valor/juros/desconto/vencimento se já pago ou se a origem não for
// "Manual" (lançamento vindo do caixa/venda só pode ter obs/categoria/centro
// de custo alterados por aqui).
export async function updateContaPagarHandler(request: Request, auth?: AuthContext): Promise<Response> {
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
    const [atual] = await db.select().from(financeiroContasPagar)
      .where(and(eq(financeiroContasPagar.id, body.id), eq(financeiroContasPagar.storeId, storeId))).limit(1);
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

    const [atualizada] = await db.update(financeiroContasPagar).set({
      ...(body.valor      !== undefined ? { valor: paraNumero(body.valor).toFixed(2) } : {}),
      ...(body.juros      !== undefined ? { juros: paraNumero(body.juros).toFixed(2) } : {}),
      ...(body.desconto   !== undefined ? { desconto: paraNumero(body.desconto).toFixed(2) } : {}),
      ...(body.vencimento !== undefined ? { vencimento: brParaIso(body.vencimento) ?? atual.vencimento } : {}),
      ...(body.categoria    !== undefined ? { categoria: body.categoria } : {}),
      ...(body.centroCusto  !== undefined ? { centroCusto: body.centroCusto } : {}),
      ...(body.obs          !== undefined ? { obs: sanitizeString(body.obs) } : {}),
      updatedAt: new Date(),
    }).where(and(eq(financeiroContasPagar.id, body.id), eq(financeiroContasPagar.storeId, storeId))).returning();

    return json(paraContaPagar(atualizada));
  } catch (error) {
    console.error("[financeiro-pagar] update error:", error);
    return err("Erro ao atualizar conta a pagar", 500);
  }
}

// ─── POST /api/financeiro/contas-pagar/efetivar ─────────────────────────────
// Marca pago e grava uma linha em financeiro_lancamentos (tipo="saida") —
// é isso que faz Fluxo de Caixa/Lucro Bruto/Contas a Pagar (relatórios)
// pararem de vir sempre vazios de despesa.
export async function efetivarContaPagarHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { ids?: string[] };
  const ids = (body.ids ?? []).filter(Boolean);
  if (ids.length === 0) return err("Informe ao menos um id", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const contas = await db.select().from(financeiroContasPagar)
      .where(and(eq(financeiroContasPagar.storeId, storeId), inArray(financeiroContasPagar.id, ids)));

    const elegiveis = contas.filter(c => c.status !== "pago" && c.status !== "cancelado");
    const hoje = hojeISO();
    const atualizadas = [];
    for (const conta of elegiveis) {
      const [lancamento] = await db.insert(financeiroLancamentos).values({
        storeId,
        tipo: "saida",
        categoria: conta.categoria || "despesa",
        descricao: `Pagamento — ${conta.descricao} (${conta.fornecedor})`,
        valor: conta.valor,
        metodoPagamento: conta.formaPgto || undefined,
        status: "liquidado",
        dataCompetencia: hoje,
        dataPagamento: hoje,
      }).returning();

      const [atualizada] = await db.update(financeiroContasPagar).set({
        status: "pago",
        valorPago: conta.valor,
        pagamento: hoje,
        lancamentoId: lancamento.id,
        updatedAt: new Date(),
      }).where(eq(financeiroContasPagar.id, conta.id)).returning();
      atualizadas.push(atualizada);
    }

    return json({ contas: atualizadas.map(paraContaPagar), efetivadas: atualizadas.length });
  } catch (error) {
    console.error("[financeiro-pagar] efetivar error:", error);
    return err("Erro ao efetivar pagamento", 500);
  }
}

// ─── POST /api/financeiro/contas-pagar/cancelar ─────────────────────────────
export async function cancelarContaPagarHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { ids?: string[] };
  const ids = (body.ids ?? []).filter(Boolean);
  if (ids.length === 0) return err("Informe ao menos um id", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    // Só cancela quem ainda não foi pago — um pagamento já efetivado (com
    // lançamento financeiro já gravado) precisa de estorno, não de cancelamento.
    const atualizadas = await db.update(financeiroContasPagar)
      .set({ status: "cancelado", updatedAt: new Date() })
      .where(and(
        eq(financeiroContasPagar.storeId, storeId),
        inArray(financeiroContasPagar.id, ids),
        eq(financeiroContasPagar.status, "pendente"),
      )).returning();

    return json({ contas: atualizadas.map(paraContaPagar), canceladas: atualizadas.length });
  } catch (error) {
    console.error("[financeiro-pagar] cancelar error:", error);
    return err("Erro ao cancelar conta a pagar", 500);
  }
}

// ─── POST /api/financeiro/contas-pagar/delete ───────────────────────────────
// Reaplica no servidor a mesma regra de validarExclusaoConta do front.
export async function deleteContaPagarHandler(request: Request, auth?: AuthContext): Promise<Response> {
  const resolved = await resolveStoreId(auth);
  if (resolved instanceof Response) return resolved;
  const { storeId } = resolved;

  const body = await request.json() as { id?: string };
  if (!body.id) return err("id é obrigatório", 400);

  const db = await createUnscopedDb(process.env.DATABASE_URL!, storeId);
  try {
    const [atual] = await db.select().from(financeiroContasPagar)
      .where(and(eq(financeiroContasPagar.id, body.id), eq(financeiroContasPagar.storeId, storeId))).limit(1);
    if (!atual) return err("Conta não encontrada", 404);

    if (atual.status === "pago") {
      return err("Não é possível excluir uma conta já efetivada. Estorne o lançamento primeiro.", 409);
    }
    if (atual.origem !== "Manual") {
      return err("Esta conta está vinculada a outro módulo e não pode ser excluída por aqui.", 409);
    }

    await db.delete(financeiroContasPagar)
      .where(and(eq(financeiroContasPagar.id, body.id), eq(financeiroContasPagar.storeId, storeId)));

    return json({ success: true });
  } catch (error) {
    console.error("[financeiro-pagar] delete error:", error);
    return err("Erro ao excluir conta a pagar", 500);
  }
}
