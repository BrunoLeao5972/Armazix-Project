import { lazy, Suspense, useState, useMemo, useRef, useEffect } from "react";
import {
  useFluxoCaixa,
  type NaturezaLancamento,
  type StatusLancamento,
  type LancamentoFinanceiro,
  agruparComTotais,
  calcularTotais,
} from "@/lib/financial/useFluxoCaixa";
import { createFileRoute } from "@tanstack/react-router";
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, ReceiptText, CreditCard, BarChart2, ArrowLeftRight,
  Tag, Plus, Search, ChevronDown, Check, X, AlertTriangle, Clock,
  RefreshCw, Pencil, Trash2, CheckCircle2, CheckCircle, XCircle, PieChart,
  Calendar, MoreVertical, ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const CashFlowChart = lazy(() => import("@/components/armazix/CashFlowChart"));
import { getFinanceiroMovimentacoes, getFinanceiroReceber, getFinanceiroPagar } from "@/services/api";

export const Route = createFileRoute("/admin/financial")({
  component: FinancialPage,
  head: () => ({ meta: [{ title: "Financeiro — ARMAZIX" }] }),
});

// TIPOS
type FinTab = "dashboard" | "receber" | "pagar" | "fluxo" | "movimentacoes" | "historicos" | "dre";
type StatusFin = "pendente" | "pago" | "vencido" | "cancelado" | "parcial";
type TipoMov = "entrada" | "saida" | "ajuste";

type StatusRec = "pendente" | "pago" | "vencido" | "cancelado" | "parcial";
interface ContaReceber {
  id: string;
  cliente: string;
  desc: string;
  documento: string;
  categoria: string;
  centroCusto: string;
  contaFinanceira: string;
  valor: number;
  juros: number;
  desconto: number;
  valorRecebido: number;
  formaPgto: string;
  emissao: string;
  vencimento: string;
  recebimento: string | null;
  status: StatusRec;
  origem: string;
  responsavel: string;
  obs: string;
  parcelas: number;
  parcelaAtual: number;
}
type StatusPag = "pendente" | "pago" | "vencido" | "cancelado" | "parcial";
interface ContaPagar {
  id: string;
  fornecedor: string;
  desc: string;
  documento: string;
  categoria: string;
  centroCusto: string;
  contaFinanceira: string;
  valor: number;
  juros: number;
  desconto: number;
  valorPago: number;
  formaPgto: string;
  emissao: string;
  vencimento: string;
  pagamento: string | null;
  status: StatusPag;
  origem: string;
  responsavel: string;
  obs: string;
  parcelas: number;
  parcelaAtual: number;
}
interface Movimentacao {
  id: string; tipo: TipoMov; categoria: string;
  valor: number; data: string; origem: string; desc: string; responsavel: string;
}
interface Categoria {
  id: string; nome: string; tipo: "receita" | "despesa"; cor: string; status: "ativo" | "inativo";
}

// HELPERS
const fmt = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

// ─────────────────────────────────────────────────
// VALIDAÇÃO DE EXCLUSÃO — regras de integridade
// ─────────────────────────────────────────────────
interface ResultadoValidacao {
  permitido: boolean;
  motivo?: string;
}

/**
 * Valida se uma conta pode ser excluída.
 * Regra 1: Contas já efetivadas/pagas exigem estorno antes da exclusão.
 * Regra 2: Contas originadas por venda no caixa (PDV) só podem ser
 *          removidas via cancelamento da venda original.
 */
function validarExclusaoConta(
  status: string,
  origem: string,
): ResultadoValidacao {
  if (status === "pago" || status === "efetivado") {
    return {
      permitido: false,
      motivo:
        "Não é possível excluir uma conta já efetivada. Para fazer alterações, você deve estornar o lançamento primeiro.",
    };
  }
  if (
    origem === "FRENTE_CAIXA" ||
    origem === "Venda" ||
    origem === "Entrada de Mercadoria"
  ) {
    return {
      permitido: false,
      motivo:
        "Esta conta está vinculada a uma venda realizada no caixa e não pode ser excluída pelo módulo financeiro. A exclusão deve ser feita através do cancelamento da venda original.",
    };
  }
  return { permitido: true };
}

// ─────────────────────────────────────────────────
// VALIDAÇÃO DE EDIÇÃO — regras de integridade
// ─────────────────────────────────────────────────
interface RegraEdicao {
  bloquearValores: boolean;
  bloquearVencimento: boolean;
  bloquearTudo: boolean;
  aviso: string | null;
}

function validarEdicaoConta(status: string, origem: string): RegraEdicao {
  if (status === "pago" || status === "efetivado") {
    return {
      bloquearValores:    true,
      bloquearVencimento: true,
      bloquearTudo:       false,
      aviso: "Este lançamento já foi efetivado. Apenas Observações podem ser alteradas.",
    };
  }
  if (origem === "FRENTE_CAIXA" || origem === "Venda") {
    return {
      bloquearValores:    true,
      bloquearVencimento: true,
      bloquearTudo:       false,
      aviso: "Este lançamento originou-se no caixa. Valores e datas não podem ser alterados aqui.",
    };
  }
  return { bloquearValores: false, bloquearVencimento: false, bloquearTudo: false, aviso: null };
}

// Retorna apenas as chaves que mudaram, com antes/depois
function diffObjeto<T extends Record<string, unknown>>(
  antes: T,
  depois: T,
): { antes: Partial<T>; depois: Partial<T>; temDiff: boolean } {
  const antesOut: Partial<T> = {};
  const depoisOut: Partial<T> = {};
  for (const k in depois) {
    if (String(antes[k]) !== String(depois[k])) {
      antesOut[k]  = antes[k];
      depoisOut[k] = depois[k];
    }
  }
  return { antes: antesOut, depois: depoisOut, temDiff: Object.keys(depoisOut).length > 0 };
}

// ─────────────────────────────────────────────────
// MODAL EDITAR — Conta a Receber
// ─────────────────────────────────────────────────
function ModalEditarContaReceber({
  conta, onClose, onSave,
}: {
  conta: ContaReceber;
  onClose: () => void;
  onSave: (atualizada: ContaReceber, diff: { antes: Partial<ContaReceber>; depois: Partial<ContaReceber> }) => void;
}) {
  const regra = validarEdicaoConta(conta.status, conta.origem);

  const [form, setForm] = useState({
    valor:     String(conta.valor),
    juros:     String(conta.juros),
    desconto:  String(conta.desconto),
    vencimento: conta.vencimento,
    categoria:  conta.categoria,
    centroCusto: conta.centroCusto,
    obs:        conta.obs,
  });

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = () => {
    const atualizada: ContaReceber = {
      ...conta,
      valor:      parseFloat(form.valor.replace(",", ".")) || conta.valor,
      juros:      parseFloat(form.juros.replace(",", ".")) || 0,
      desconto:   parseFloat(form.desconto.replace(",", ".")) || 0,
      vencimento: form.vencimento,
      categoria:  form.categoria,
      centroCusto: form.centroCusto,
      obs:        form.obs,
    };

    // Snapshot diff — só campos editáveis
    const camposAnteriores = {
      valor: conta.valor, juros: conta.juros, desconto: conta.desconto,
      vencimento: conta.vencimento, categoria: conta.categoria,
      centroCusto: conta.centroCusto, obs: conta.obs,
    } as unknown as ContaReceber;
    const camposNovos = {
      valor: atualizada.valor, juros: atualizada.juros, desconto: atualizada.desconto,
      vencimento: atualizada.vencimento, categoria: atualizada.categoria,
      centroCusto: atualizada.centroCusto, obs: atualizada.obs,
    } as unknown as ContaReceber;

    const { antes, depois } = diffObjeto(
      camposAnteriores as unknown as Record<string, unknown>,
      camposNovos as unknown as Record<string, unknown>,
    ) as { antes: Partial<ContaReceber>; depois: Partial<ContaReceber>; temDiff: boolean };

    onSave(atualizada, { antes, depois });
  };

  const ROLabel = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground/60 bg-secondary/30 rounded-xl px-3 py-2 border border-dashed border-border/40">{value || "—"}</p>
    </div>
  );

  const Field = ({ label, k, disabled, placeholder }: { label: string; k: keyof typeof form; disabled?: boolean; placeholder?: string }) => (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input value={form[k]} onChange={e => set(k, e.target.value)} disabled={disabled}
        placeholder={placeholder}
        className={`h-9 rounded-xl text-sm ${disabled ? "opacity-50 cursor-not-allowed bg-secondary/30" : ""}`} />
    </div>
  );

  const Sel = ({ label, k, opts, disabled }: { label: string; k: keyof typeof form; opts: string[]; disabled?: boolean }) => (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select value={form[k]} onChange={e => set(k, e.target.value)} disabled={disabled}
          className={`w-full h-9 pl-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed bg-secondary/30" : ""}`}>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Editar Conta a Receber
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{conta.documento || conta.id} · {conta.cliente}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Aviso de regra */}
          {regra.aviso && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">{regra.aviso}</p>
            </div>
          )}

          {/* Read-only */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Informações da Origem (somente leitura)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ROLabel label="Documento" value={conta.documento} />
              <ROLabel label="Emissão" value={conta.emissao} />
              <ROLabel label="Origem" value={conta.origem} />
              <ROLabel label="Status" value={conta.status} />
              <ROLabel label="Responsável" value={conta.responsavel} />
            </div>
          </div>

          {/* Valores editáveis */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Valores</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Valor Nominal" k="valor" disabled={regra.bloquearValores} placeholder="0,00" />
              <Field label="Acréscimo" k="juros" disabled={regra.bloquearValores} placeholder="0,00" />
              <Field label="Desconto" k="desconto" disabled={regra.bloquearValores} placeholder="0,00" />
            </div>
          </div>

          {/* Datas/Categorização */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Classificação</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vencimento" k="vencimento" disabled={regra.bloquearVencimento} placeholder="DD/MM/AAAA" />
              <Sel label="Histórico" k="categoria" disabled={false}
                opts={HISTORICOS.filter(h => h.natureza === "RECEITA" && h.nivel === 3).map(h => historicoLabel(h))} />
              <Sel label="Centro de Custo" k="centroCusto" disabled={false}
                opts={["Loja","Admin","Operacional"]} />
            </div>
          </div>

          {/* Obs — sempre editável */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Observações</p>
            <textarea value={form.obs} onChange={e => set("obs", e.target.value)}
              placeholder="Informações adicionais..."
              className="w-full rounded-xl border border-input bg-background text-sm p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">Cancelar</button>
          <Button onClick={handleSalvar} className="rounded-xl gap-1.5 h-9 text-sm bg-gradient-primary text-primary-foreground">
            <Check className="w-3.5 h-3.5" />Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// MODAL EDITAR — Conta a Pagar
// ─────────────────────────────────────────────────
function ModalEditarContaPagar({
  conta, onClose, onSave,
}: {
  conta: ContaPagar;
  onClose: () => void;
  onSave: (atualizada: ContaPagar, diff: { antes: Partial<ContaPagar>; depois: Partial<ContaPagar> }) => void;
}) {
  const regra = validarEdicaoConta(conta.status, conta.origem);

  const [form, setForm] = useState({
    valor:      String(conta.valor),
    juros:      String(conta.juros),
    desconto:   String(conta.desconto),
    vencimento: conta.vencimento,
    categoria:  conta.categoria,
    centroCusto: conta.centroCusto,
    obs:        conta.obs,
  });

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = () => {
    const atualizada: ContaPagar = {
      ...conta,
      valor:      parseFloat(form.valor.replace(",", ".")) || conta.valor,
      juros:      parseFloat(form.juros.replace(",", ".")) || 0,
      desconto:   parseFloat(form.desconto.replace(",", ".")) || 0,
      vencimento: form.vencimento,
      categoria:  form.categoria,
      centroCusto: form.centroCusto,
      obs:        form.obs,
    };

    const camposAnteriores = {
      valor: conta.valor, juros: conta.juros, desconto: conta.desconto,
      vencimento: conta.vencimento, categoria: conta.categoria,
      centroCusto: conta.centroCusto, obs: conta.obs,
    } as unknown as ContaPagar;
    const camposNovos = {
      valor: atualizada.valor, juros: atualizada.juros, desconto: atualizada.desconto,
      vencimento: atualizada.vencimento, categoria: atualizada.categoria,
      centroCusto: atualizada.centroCusto, obs: atualizada.obs,
    } as unknown as ContaPagar;

    const { antes, depois } = diffObjeto(
      camposAnteriores as unknown as Record<string, unknown>,
      camposNovos as unknown as Record<string, unknown>,
    ) as { antes: Partial<ContaPagar>; depois: Partial<ContaPagar>; temDiff: boolean };

    onSave(atualizada, { antes, depois });
  };

  const ROLabel = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground/60 bg-secondary/30 rounded-xl px-3 py-2 border border-dashed border-border/40">{value || "—"}</p>
    </div>
  );

  const Field = ({ label, k, disabled, placeholder }: { label: string; k: keyof typeof form; disabled?: boolean; placeholder?: string }) => (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input value={form[k]} onChange={e => set(k, e.target.value)} disabled={disabled}
        placeholder={placeholder}
        className={`h-9 rounded-xl text-sm ${disabled ? "opacity-50 cursor-not-allowed bg-secondary/30" : ""}`} />
    </div>
  );

  const Sel = ({ label, k, opts, disabled }: { label: string; k: keyof typeof form; opts: string[]; disabled?: boolean }) => (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select value={form[k]} onChange={e => set(k, e.target.value)} disabled={disabled}
          className={`w-full h-9 pl-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed bg-secondary/30" : ""}`}>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Editar Conta a Pagar
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{conta.documento || conta.id} · {conta.fornecedor}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {regra.aviso && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">{regra.aviso}</p>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Informações da Origem (somente leitura)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ROLabel label="Documento" value={conta.documento} />
              <ROLabel label="Emissão" value={conta.emissao} />
              <ROLabel label="Origem" value={conta.origem} />
              <ROLabel label="Status" value={conta.status} />
              <ROLabel label="Fornecedor" value={conta.fornecedor} />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Valores</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Valor Nominal" k="valor" disabled={regra.bloquearValores} placeholder="0,00" />
              <Field label="Juros" k="juros" disabled={regra.bloquearValores} placeholder="0,00" />
              <Field label="Desconto" k="desconto" disabled={regra.bloquearValores} placeholder="0,00" />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Classificação</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vencimento" k="vencimento" disabled={regra.bloquearVencimento} placeholder="DD/MM/AAAA" />
              <Sel label="Histórico" k="categoria" disabled={false}
                opts={HISTORICOS.filter(h => h.natureza === "DESPESA" && h.nivel === 3).map(h => historicoLabel(h))} />
              <Sel label="Centro de Custo" k="centroCusto" disabled={false}
                opts={["Compras","Infraestrutura","Marketing","RH","TI","Admin"]} />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Observações</p>
            <textarea value={form.obs} onChange={e => set("obs", e.target.value)}
              placeholder="Informações adicionais..."
              className="w-full rounded-xl border border-input bg-background text-sm p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">Cancelar</button>
          <Button onClick={handleSalvar} className="rounded-xl gap-1.5 h-9 text-sm bg-gradient-primary text-primary-foreground">
            <Check className="w-3.5 h-3.5" />Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// MODAL DE BLOQUEIO — ação não permitida
// ─────────────────────────────────────────────────
function ModalBloqueio({ motivo, onClose }: { motivo: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800 mb-1">Ação Não Permitida</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{motivo}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose}
            className="h-9 px-5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// MODAL DE CONFIRMAÇÃO — exclusão
// ─────────────────────────────────────────────────
function ModalConfirmacao({
  titulo,
  descricao,
  onConfirm,
  onClose,
}: {
  titulo: string;
  descricao: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800 mb-1">{titulo}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{descricao}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
            className="h-9 px-4 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button onClick={() => { onConfirm(); onClose(); }}
            className="h-9 px-4 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// ACTION MENU — dropdown ⋮ por linha da tabela
// ─────────────────────────────────────────────────
interface ActionMenuProps {
  status: string;
  origem: string;
  onEfetivar?: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}

function ActionMenu({ status, origem, onEfetivar, onEditar, onExcluir }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExcluirClick = () => {
    setOpen(false);
    const resultado = validarExclusaoConta(status, origem);
    if (!resultado.permitido) {
      setBloqueio(resultado.motivo!);
    } else {
      setConfirmacao(true);
    }
  };

  const podeEfetivar = status === "pendente" || status === "parcial" || status === "EM_ABERTO";

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-white border border-slate-100 rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-100">
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onEditar(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
              Editar
            </button>

            {podeEfetivar && onEfetivar && (
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); onEfetivar(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Efetivar
              </button>
            )}

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={e => { e.stopPropagation(); handleExcluirClick(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
          </div>
        )}
      </div>

      {bloqueio && (
        <ModalBloqueio motivo={bloqueio} onClose={() => setBloqueio(null)} />
      )}
      {confirmacao && (
        <ModalConfirmacao
          titulo="Excluir conta?"
          descricao="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita."
          onConfirm={onExcluir}
          onClose={() => setConfirmacao(false)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────
// HISTÓRICOS ESTRUTURADOS — seed ERP
// ─────────────────────────────────────────────────
type NaturezaHist = "RECEITA" | "DESPESA";
interface HistoricoFinanceiro {
  id: string;
  codigo: string;
  descricao: string;
  natureza: NaturezaHist;
  nivel: number; // 1=grupo, 2=subgrupo, 3=analítico
}
const HISTORICOS: HistoricoFinanceiro[] = [
  { id: "h1",    codigo: "1.",       descricao: "RECEITAS",                        natureza: "RECEITA",  nivel: 1 },
  { id: "h101",  codigo: "1.01",     descricao: "RECEITAS OPERACIONAIS",           natureza: "RECEITA",  nivel: 2 },
  { id: "h1011", codigo: "1.01.01",  descricao: "VENDAS DE MERCADORIAS",           natureza: "RECEITA",  nivel: 3 },
  { id: "h1012", codigo: "1.01.02",  descricao: "PRESTAÇÃO DE SERVIÇOS",           natureza: "RECEITA",  nivel: 3 },
  { id: "h102",  codigo: "1.02",     descricao: "RECEITAS NÃO OPERACIONAIS",       natureza: "RECEITA",  nivel: 2 },
  { id: "h1021", codigo: "1.02.01",  descricao: "RENDIMENTOS DE APLICAÇÃO",        natureza: "RECEITA",  nivel: 3 },
  { id: "h2",    codigo: "2.",       descricao: "DESPESAS",                        natureza: "DESPESA",  nivel: 1 },
  { id: "h201",  codigo: "2.01",     descricao: "CUSTOS OPERACIONAIS",             natureza: "DESPESA",  nivel: 2 },
  { id: "h2011", codigo: "2.01.01",  descricao: "FORNECEDORES DE MERCADORIAS",     natureza: "DESPESA",  nivel: 3 },
  { id: "h2012", codigo: "2.01.02",  descricao: "FOLHA DE PAGAMENTO / SALÁRIOS",   natureza: "DESPESA",  nivel: 3 },
  { id: "h2013", codigo: "2.01.03",  descricao: "IMPOSTOS E TAXAS",               natureza: "DESPESA",  nivel: 3 },
  { id: "h202",  codigo: "2.02",     descricao: "DESPESAS ADMINISTRATIVAS",        natureza: "DESPESA",  nivel: 2 },
  { id: "h2021", codigo: "2.02.01",  descricao: "ALUGUEL, ÁGUA E ENERGIA",         natureza: "DESPESA",  nivel: 3 },
  { id: "h2022", codigo: "2.02.02",  descricao: "MARKETING E PUBLICIDADE",         natureza: "DESPESA",  nivel: 3 },
];
// Retorna label formatado para selects: "1.01.01 | VENDAS DE MERCADORIAS"
const historicoLabel = (h: HistoricoFinanceiro) => `${h.codigo} | ${h.descricao}`;
// Indentação visual por nível para os selects
const historicoIndent = (h: HistoricoFinanceiro) =>
  h.nivel === 1 ? h.codigo + " " + h.descricao
  : h.nivel === 2 ? "\u00a0\u00a0" + historicoLabel(h)
  : "\u00a0\u00a0\u00a0\u00a0" + historicoLabel(h);

// ─────────────────────────────────────────────────
// AGREGAÇÃO HIERÁRQUICA DE HISTÓRICOS
// ─────────────────────────────────────────────────
interface LancamentoDRE {
  categoria: string; // descricao do histórico
  valor: number;
  tipo: "entrada" | "saida" | "ajuste";
}

// Soma direta dos lançamentos cujo histórico bate exatamente com a descrição do nó
function somaAnalitica(desc: string, lancamentos: LancamentoDRE[]): number {
  return lancamentos
    .filter(l => l.categoria === desc)
    .reduce((s, l) => s + l.valor, 0);
}

// Soma em cascata: dado um histórico pai, soma todos os filhos (por prefixo de código)
function somaHierarquica(
  h: HistoricoFinanceiro,
  todos: HistoricoFinanceiro[],
  lancamentos: LancamentoDRE[]
): number {
  const prefixo = h.nivel === 1 ? h.codigo.replace(".", "") : h.codigo;
  const nos = todos.filter(x => {
    if (x.nivel === 1) return x.id === h.id;
    const c = x.codigo;
    return c === h.codigo || c.startsWith(prefixo + ".");
  });
  return nos.reduce((s, x) => s + somaAnalitica(x.descricao, lancamentos), 0);
}

// Constrói a estrutura completa da DRE com totais por nó
interface DreNode {
  historico: HistoricoFinanceiro;
  total: number;         // soma cascata deste nó
  direto: number;        // lançamentos diretos neste nó
}
function calcularDRE(
  historicos: HistoricoFinanceiro[],
  lancamentos: LancamentoDRE[]
): DreNode[] {
  return historicos
    .slice()
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
    .map(h => ({
      historico: h,
      total: somaHierarquica(h, historicos, lancamentos),
      direto: somaAnalitica(h.descricao, lancamentos),
    }));
}

// Top 5 Despesas e Top 5 Receitas — apenas nós analíticos (nível 3)
function top5Historicos(
  historicos: HistoricoFinanceiro[],
  lancamentos: LancamentoDRE[]
) {
  const analiticos = historicos.filter(h => h.nivel === 3);
  const calculo = analiticos.map(h => ({
    descricao: h.descricao,
    codigo: h.codigo,
    natureza: h.natureza,
    total: somaAnalitica(h.descricao, lancamentos),
  }));
  const despesas = calculo
    .filter(x => x.natureza === "DESPESA" && x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const receitas = calculo
    .filter(x => x.natureza === "RECEITA" && x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  return { despesas, receitas };
}

// TABS
const TABS: { id: FinTab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { id: "receber",       label: "A Receber",      icon: ArrowUpRight    },
  { id: "pagar",         label: "A Pagar",        icon: ArrowDownRight  },
  { id: "fluxo",         label: "Fluxo de Caixa", icon: BarChart2       },
  { id: "movimentacoes", label: "Movimentacoes",  icon: ArrowLeftRight  },
  { id: "dre",           label: "DRE",            icon: BarChart2       },
  { id: "historicos",    label: "Históricos",     icon: Tag             },
];

// COMPONENTES BASE
function KpiCard({ icon: Icon, label, value, sub, iconBg, iconColor, highlight }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  iconBg: string; iconColor: string; highlight?: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-soft">
      <CardContent className="p-4">
        <div className="mb-3">
          <span className={`grid place-items-center w-9 h-9 rounded-xl ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </span>
        </div>
        <div className={`text-2xl font-bold tracking-tight ${highlight ? "text-gradient-primary" : ""}`}>{value}</div>
        <div className="text-xs font-medium text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: StatusFin }) {
  const map: Record<StatusFin, { label: string; cls: string }> = {
    pendente:  { label: "Pendente",  cls: "bg-amber-500/15 text-amber-600"     },
    pago:      { label: "Pago",      cls: "bg-emerald-500/15 text-emerald-600" },
    vencido:   { label: "Vencido",   cls: "bg-destructive/15 text-destructive" },
    cancelado: { label: "Cancelado", cls: "bg-secondary text-muted-foreground" },
    parcial:   { label: "Parcial",   cls: "bg-blue-500/15 text-blue-700"       },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function SelectFilter({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-9 pl-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function SearchBar({ value, onChange, placeholder = "Buscar..." }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <Input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="pl-9 h-9 rounded-xl text-sm" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
    </div>
  );
}

// ── Componente reutilizável de filtro data+hora ──────────────────
interface DateTimeRange {
  dataInicio: string; horaInicio: string;
  dataFim:    string; horaFim:    string;
}
const DTR_DEFAULT: DateTimeRange = { dataInicio: "", horaInicio: "00:00", dataFim: "", horaFim: "23:59" };

function DateTimeRangeFilter({ value, onChange }: {
  value: DateTimeRange;
  onChange: (v: DateTimeRange) => void;
}) {
  const set = (k: keyof DateTimeRange, v: string) => onChange({ ...value, [k]: v });
  const hasFilter = value.dataInicio || value.dataFim;

  const CapsuleInput = ({
    label, dateVal, timeVal, onDateChange, onTimeChange,
  }: {
    label: string;
    dateVal: string; timeVal: string;
    onDateChange: (v: string) => void;
    onTimeChange: (v: string) => void;
  }) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</span>
      <div className="flex items-center bg-secondary/50 border border-border/50 rounded-xl px-2 h-10 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          type="date"
          value={dateVal}
          onChange={e => onDateChange(e.target.value)}
          className="bg-transparent border-none outline-none text-xs text-foreground w-28 mx-1.5 cursor-pointer"
        />
        <div className="w-px h-4 bg-border/60 shrink-0" />
        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1.5" />
        <input
          type="time"
          value={timeVal}
          onChange={e => onTimeChange(e.target.value)}
          className="bg-transparent border-none outline-none text-xs text-foreground w-16 ml-1 cursor-pointer"
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <CapsuleInput
        label="De"
        dateVal={value.dataInicio}
        timeVal={value.horaInicio}
        onDateChange={v => set("dataInicio", v)}
        onTimeChange={v => set("horaInicio", v)}
      />
      <div className="pb-1 text-muted-foreground/50 text-xs self-end mb-2.5">→</div>
      <CapsuleInput
        label="Até"
        dateVal={value.dataFim}
        timeVal={value.horaFim}
        onDateChange={v => set("dataFim", v)}
        onTimeChange={v => set("horaFim", v)}
      />
      {hasFilter && (
        <button
          onClick={() => onChange(DTR_DEFAULT)}
          className="self-end mb-0.5 h-10 px-3 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive flex items-center gap-1.5 border border-border/40 hover:border-destructive/30 bg-secondary/30 hover:bg-destructive/5 transition-all"
        >
          <X className="w-3 h-3" />Limpar
        </button>
      )}
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm font-medium">
      <CheckCircle2 className="w-4 h-4 shrink-0" />{msg}
    </div>
  );
}

// helper: "DD/MM/YYYY HH:mm" → timestamp
function parseMovData(s: string): number {
  const [datePart = "", timePart = "00:00"] = s.split(" ");
  const [d, m, y] = datePart.split("/");
  return Date.parse(`${y}-${m}-${d}T${timePart}:00`) || 0;
}

// 1. DASHBOARD
function SecaoDashboard() {
  const [dtr, setDtr] = useState<DateTimeRange>(DTR_DEFAULT);
  const [mov, setMov] = useState<Movimentacao[]>([]);
  const [rec, setRec] = useState<ContaReceber[]>([]);
  const [pag, setPag] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [m, r, p] = await Promise.all([
          getFinanceiroMovimentacoes().catch(() => []),
          getFinanceiroReceber().catch(() => []),
          getFinanceiroPagar().catch(() => []),
        ]);
        if (!mounted) return;
        setMov(Array.isArray(m) ? (m as unknown as Movimentacao[]) : []);
        setRec(Array.isArray(r) ? (r as unknown as ContaReceber[]) : []);
        setPag(Array.isArray(p) ? (p as unknown as ContaPagar[]) : []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const movFiltradas = useMemo(() => {
    const base = mov;
    if (!dtr.dataInicio && !dtr.dataFim) return base;
    const tsI = dtr.dataInicio ? Date.parse(`${dtr.dataInicio}T${dtr.horaInicio}:00`) : 0;
    const tsF = dtr.dataFim    ? Date.parse(`${dtr.dataFim}T${dtr.horaFim}:00`)    : Infinity;
    return base.filter(m => { const ts = parseMovData(m.data); return ts >= tsI && ts <= tsF; });
  }, [dtr, mov]);

  const entradas = movFiltradas.filter(m => m.tipo === "entrada").reduce((s, m) => s + (m.valor || 0), 0);
  const saidas   = movFiltradas.filter(m => m.tipo === "saida").reduce((s, m) => s + (m.valor || 0), 0);
  const saldo    = entradas - saidas;
  const vencidas = useMemo(() => [...rec, ...pag].filter(c => c.status === "vencido").length, [rec, pag]);
  const aVencer  = useMemo(() => [...rec, ...pag].filter(c => c.status === "pendente").length, [rec, pag]);

  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  // Agrupa movFiltradas por mês/ano e acumula receita e despesa
  const cashflowData = useMemo(() => {
    const map = new Map<string, { name: string; receita: number; despesa: number; order: number }>();
    const base = dtr.dataInicio || dtr.dataFim ? movFiltradas : mov;
    base.forEach(m => {
      const [datePart = ""] = m.data.split(" ");
      const [, mm = "01", yyyy = "2026"] = datePart.split("/");
      const key = `${yyyy}-${mm}`;
      if (!map.has(key)) map.set(key, { name: `${MESES[parseInt(mm, 10) - 1]}/${yyyy.slice(2)}`, receita: 0, despesa: 0, order: parseInt(`${yyyy}${mm}`, 10) });
      const entry = map.get(key)!;
      if (m.tipo === "entrada") entry.receita += m.valor;
      else if (m.tipo === "saida") entry.despesa += m.valor;
    });
    const sorted = Array.from(map.values()).sort((a, b) => a.order - b.order);
    return sorted;
  }, [movFiltradas, dtr.dataInicio, dtr.dataFim, mov]);

  const fmtDtrLabel = (date: string, time: string) => {
    if (!date) return "…";
    const [y, m, d] = date.split("-");
    const base = `${d}/${m}/${y}`;
    return time && time !== "00:00" && time !== "23:59" ? `${base} ${time}` : base;
  };
  const chartTitle = dtr.dataInicio || dtr.dataFim
    ? `Entradas x Saidas - ${fmtDtrLabel(dtr.dataInicio, dtr.horaInicio)} → ${fmtDtrLabel(dtr.dataFim, dtr.horaFim)}`
    : "Entradas x Saidas - ultimos 5 meses";

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Período</span>
        <DateTimeRangeFilter value={dtr} onChange={setDtr} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={DollarSign}     label="Saldo atual"     value={fmt(saldo)}       iconBg="bg-primary/15"     iconColor="text-primary"    highlight />
        <KpiCard icon={ArrowUpRight}   label="Entradas do mes" value={fmt(entradas)}    iconBg="bg-emerald-500/15" iconColor="text-emerald-600" />
        <KpiCard icon={ArrowDownRight} label="Saidas do mes"   value={fmt(saidas)}      iconBg="bg-destructive/15" iconColor="text-destructive" />
        <KpiCard icon={AlertTriangle}  label="Contas vencidas" value={String(vencidas)} iconBg="bg-amber-500/15"   iconColor="text-amber-600"   sub="titulos em atraso" />
        <KpiCard icon={Clock}          label="A vencer"        value={String(aVencer)}  iconBg="bg-blue-500/15"    iconColor="text-blue-600"    sub="proximos vencimentos" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{chartTitle}</CardTitle>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Entradas</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive inline-block" />Saidas</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-muted-foreground">Carregando grafico...</div>}>
                <CashFlowChart data={cashflowData} />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Históricos — Despesas</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-1">
            {(() => {
              const lacs: LancamentoDRE[] = [
                ...pag.map(c => ({ categoria: c.categoria, valor: c.valorPago > 0 ? c.valorPago : c.valor, tipo: "saida" as const })),
                ...mov.filter(m => m.tipo === "saida").map(m => ({ categoria: m.categoria, valor: m.valor, tipo: "saida" as const })),
              ];
              const { despesas } = top5Historicos(HISTORICOS, lacs);
              const maxVal = despesas[0]?.total ?? 1;
              const CORES_DESP = ["#ef4444","#f97316","#eab308","#8b5cf6","#ec4899"];
              return despesas.length === 0
                ? <p className="text-xs text-muted-foreground">Sem dados de despesas nos históricos.</p>
                : despesas.map((d, i) => (
                  <div key={d.codigo}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs flex items-center gap-1.5 font-medium" title={d.codigo}>
                        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: CORES_DESP[i] }} />
                        {d.descricao.length > 22 ? d.descricao.slice(0, 22) + "…" : d.descricao}
                      </span>
                      <span className="text-xs font-semibold">{fmt(d.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((d.total / maxVal) * 100, 100)}%`, background: CORES_DESP[i] }} />
                    </div>
                  </div>
                ));
            })()}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Movimentacoes recentes</CardTitle>
            <span className="text-xs text-muted-foreground">{mov.length} registros</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            {mov.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 ${
                    m.tipo === "entrada" ? "bg-emerald-500/15" : m.tipo === "saida" ? "bg-destructive/15" : "bg-secondary"
                  }`}>
                    {m.tipo === "entrada"
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                      : m.tipo === "saida"
                      ? <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                      : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{m.desc}</p>
                    <p className="text-xs text-muted-foreground">{m.data} - {m.categoria}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${
                  m.tipo === "entrada" ? "text-emerald-600" : m.tipo === "saida" ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {m.tipo === "saida" ? "-" : "+"}{fmt(m.valor)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Badge de status — ícone vetorial com tooltip ──
function StatusIconBadge({ status, pulse = false }: { status: StatusRec | StatusPag; pulse?: boolean }) {
  const MAP: Record<string, { label: string; icon: React.ReactNode; wrap: string }> = {
    pendente:  { label: "Situação: Pendente",  wrap: "bg-amber-50 border border-amber-100",   icon: <Clock      className="w-3.5 h-3.5 text-amber-500" /> },
    pago:      { label: "Situação: Pago",      wrap: "bg-emerald-50 border border-emerald-100", icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> },
    vencido:   { label: "Situação: Vencido",   wrap: "bg-rose-50 border border-rose-100",      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> },
    cancelado: { label: "Situação: Cancelado", wrap: "bg-slate-100 border border-slate-200",   icon: <XCircle    className="w-3.5 h-3.5 text-slate-400" /> },
    parcial:   { label: "Situação: Parcial",   wrap: "bg-blue-50 border border-blue-100",      icon: <PieChart   className="w-3.5 h-3.5 text-blue-500" /> },
  };
  const entry = MAP[status] ?? MAP["pendente"];
  return (
    <span title={entry.label}
      className={`inline-grid place-items-center w-7 h-7 rounded-full ${entry.wrap} ${pulse ? "animate-pulse" : ""}`}>
      {entry.icon}
    </span>
  );
}
function StatusRecBadge({ status }: { status: StatusRec }) {
  return <StatusIconBadge status={status} />;
}

// ── Modal Nova Conta a Receber ──
function ModalNovaContaReceber({ onClose, onSave }: { onClose: () => void; onSave: (c: ContaReceber) => void }) {
  const [form, setForm] = useState({
    cliente: "", desc: "", documento: "", categoria: "Vendas", centroCusto: "Loja",
    contaFinanceira: "Caixa", valor: "", juros: "0", desconto: "0",
    formaPgto: "PIX", emissao: new Date().toLocaleDateString("pt-BR"),
    vencimento: "", obs: "", parcelas: "1", responsavel: "Admin",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const f = form as Record<string, string>;

  const handleSubmit = () => {
    if (!form.cliente.trim() || !form.valor || !form.vencimento) return;
    onSave({
      id: `r${Date.now()}`, cliente: form.cliente, desc: form.desc, documento: form.documento,
      categoria: form.categoria, centroCusto: form.centroCusto, contaFinanceira: form.contaFinanceira,
      valor: parseFloat(form.valor.replace(",", ".")) || 0,
      juros: parseFloat(form.juros.replace(",", ".")) || 0,
      desconto: parseFloat(form.desconto.replace(",", ".")) || 0,
      valorRecebido: 0, formaPgto: form.formaPgto, emissao: form.emissao,
      vencimento: form.vencimento, recebimento: null, status: "pendente",
      origem: "Manual", responsavel: form.responsavel, obs: form.obs,
      parcelas: parseInt(form.parcelas) || 1, parcelaAtual: 1,
    });
  };

  const Field = ({ label, k, placeholder, type = "text" }: { label: string; k: string; placeholder?: string; type?: string }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <Input value={f[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} type={type}
        className="h-9 rounded-xl text-sm" />
    </div>
  );
  const Sel = ({ label, k, opts }: { label: string; k: string; opts: string[] }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="relative">
        <select value={f[k]} onChange={e => set(k, e.target.value)}
          className="w-full h-9 pl-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
  const Sep = ({ title }: { title: string }) => (
    <div className="border-t border-border/30 pt-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h2 className="text-base font-semibold">Nova Conta a Receber</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados do recebimento</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Informações Principais</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cliente *" k="cliente" placeholder="Nome do cliente" />
            <Field label="Documento" k="documento" placeholder="Ex: VD-1099" />
            <Field label="Descrição *" k="desc" placeholder="Ex: Venda #1099" />
            <Sel label="Histórico" k="categoria" opts={HISTORICOS.filter(h => h.natureza === "RECEITA" && h.nivel === 3).map(h => historicoLabel(h))} />
            <Sel label="Centro de Custo" k="centroCusto" opts={["Loja","Admin","Operacional"]} />
            <Field label="Responsável" k="responsavel" placeholder="Nome" />
          </div>
          <Sep title="Valores" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor *" k="valor" placeholder="0,00" />
            <Field label="Juros" k="juros" placeholder="0,00" />
            <Field label="Desconto" k="desconto" placeholder="0,00" />
          </div>
          <Sep title="Pagamento" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Sel label="Forma de Pagamento" k="formaPgto" opts={["PIX","Dinheiro","Cartao","Boleto","Transferencia"]} />
            <Sel label="Conta Financeira" k="contaFinanceira" opts={["Caixa","Banco","Carteira"]} />
            <Sel label="Parcelas" k="parcelas" opts={["1","2","3","6","12"]} />
          </div>
          <Sep title="Datas" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Emissão" k="emissao" placeholder="DD/MM/AAAA" />
            <Field label="Vencimento *" k="vencimento" placeholder="DD/MM/AAAA" />
          </div>
          <div className="border-t border-border/30 pt-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Observações</label>
              <textarea value={form.obs} onChange={e => set("obs", e.target.value)}
                placeholder="Informações adicionais..."
                className="w-full rounded-xl border border-input bg-background text-sm p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">Cancelar</button>
          <Button onClick={handleSubmit} className="rounded-xl gap-1.5 h-9 text-sm bg-gradient-primary text-primary-foreground">
            <Check className="w-3.5 h-3.5" />Salvar Conta
          </Button>
        </div>
      </div>
    </div>
  );
}

// 2. CONTAS A RECEBER
function SecaoReceber() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusRec[]>([]);
  const [filterForma, setFilterForma] = useState("TODAS");
  const [filterHistorico, setFilterHistorico] = useState("TODAS");
  const [filterConta, setFilterConta] = useState("TODAS");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterValMin, setFilterValMin] = useState("");
  const [filterValMax, setFilterValMax] = useState("");
  const [dtrVenc, setDtrVenc] = useState<DateTimeRange>(DTR_DEFAULT);
  const [dtrEmis, setDtrEmis] = useState<DateTimeRange>(DTR_DEFAULT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ContaReceber | null>(null);
  const [toast, setToast] = useState("");
  const [filtrosAbertosRec, setFiltrosAbertosRec] = useState(true);
  const [sortCol, setSortCol] = useState<keyof ContaReceber>("vencimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getFinanceiroReceber();
        if (mounted) setContas(Array.isArray(data) ? (data as unknown as ContaReceber[]) : []);
      } catch {
        if (mounted) setContas([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2800); };
  const parseDate = (s: string) => { const [d, m, y] = s.split("/"); return Date.parse(`${y}-${m}-${d}T00:00:00`) || 0; };

  const hoje = new Date().toLocaleDateString("pt-BR");

  const filtered = useMemo(() => {
    let list = contas.filter(c => {
      const q = search.toLowerCase();
      if (q && !c.cliente.toLowerCase().includes(q) && !c.desc.toLowerCase().includes(q) && !c.documento.toLowerCase().includes(q)) return false;
      if (filterStatus.length && !filterStatus.includes(c.status)) return false;
      if (filterForma !== "TODAS" && c.formaPgto !== filterForma) return false;
      if (filterHistorico !== "TODAS" && c.categoria !== filterHistorico) return false;
      if (filterConta !== "TODAS" && c.contaFinanceira !== filterConta) return false;
      if (filterCliente && !c.cliente.toLowerCase().includes(filterCliente.toLowerCase())) return false;
      if (filterValMin && c.valor < parseFloat(filterValMin)) return false;
      if (filterValMax && c.valor > parseFloat(filterValMax)) return false;
      if (dtrVenc.dataInicio || dtrVenc.dataFim) {
        const ts = parseDate(c.vencimento);
        const tsI = dtrVenc.dataInicio ? Date.parse(`${dtrVenc.dataInicio}T${dtrVenc.horaInicio}:00`) : 0;
        const tsF = dtrVenc.dataFim ? Date.parse(`${dtrVenc.dataFim}T${dtrVenc.horaFim}:00`) : Infinity;
        if (ts < tsI || ts > tsF) return false;
      }
      if (dtrEmis.dataInicio || dtrEmis.dataFim) {
        const ts = parseDate(c.emissao);
        const tsI = dtrEmis.dataInicio ? Date.parse(`${dtrEmis.dataInicio}T${dtrEmis.horaInicio}:00`) : 0;
        const tsF = dtrEmis.dataFim ? Date.parse(`${dtrEmis.dataFim}T${dtrEmis.horaFim}:00`) : Infinity;
        if (ts < tsI || ts > tsF) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const va = String(a[sortCol]); const vb = String(b[sortCol]);
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [contas, search, filterStatus, filterForma, filterHistorico, filterConta, filterCliente, filterValMin, filterValMax, dtrVenc, dtrEmis, sortCol, sortDir]);

  const kpis = useMemo(() => ({
    totalAberto:    contas.filter(c => c.status !== "pago" && c.status !== "cancelado").reduce((s, c) => s + (c.valor - c.valorRecebido), 0),
    recebidoMes:   contas.filter(c => c.status === "pago" || c.status === "parcial").reduce((s, c) => s + c.valorRecebido, 0),
    vencidas:      contas.filter(c => c.status === "vencido").length,
    hoje:          contas.filter(c => c.vencimento === hoje && c.status === "pendente").length,
    futuras:       contas.filter(c => c.status === "pendente" && parseDate(c.vencimento) > Date.now()).length,
    inadimplencia: contas.length ? Math.round((contas.filter(c => c.status === "vencido").length / contas.length) * 100) : 0,
  }), [contas, hoje]);

  const handleBaixa = (ids: string[]) => {
    setContas(prev => prev.map(c => ids.includes(c.id) && c.status !== "pago" && c.status !== "cancelado"
      ? { ...c, status: "pago" as StatusRec, valorRecebido: c.valor, recebimento: hoje } : c));
    setSelectedIds(new Set());
    showToast(`${ids.length} conta(s) recebida(s) com sucesso!`);
  };
  const handleCancelar = (ids: string[]) => {
    setContas(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: "cancelado" as StatusRec } : c));
    setSelectedIds(new Set());
    showToast(`${ids.length} conta(s) cancelada(s).`);
  };
  const handleNovaConta = (c: ContaReceber) => { setContas(prev => [...prev, c]); setModalAberto(false); showToast("Conta criada com sucesso!"); };
  const handleSalvarEdicaoRec = (atualizada: ContaReceber, diff: { antes: Partial<ContaReceber>; depois: Partial<ContaReceber> }) => {
    setContas(prev => prev.map(c => c.id === atualizada.id ? atualizada : c));
    setEditando(null);
    const campos = Object.keys(diff.depois);
    if (campos.length > 0) {
      console.log("[AUDITORIA] RECEBER_ATUALIZAR", { id: atualizada.id, antes: diff.antes, depois: diff.depois });
      showToast(`Conta atualizada! Campos alterados: ${campos.join(", ")}`);
    } else {
      showToast("Nenhuma alteração detectada.");
    }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));

  const sortBy = (col: keyof ContaReceber) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const FORMAS = ["TODAS", "PIX", "Dinheiro", "Cartao", "Boleto", "Transferencia"];
  const CONTAS_FIN = ["TODAS", ...Array.from(new Set(contas.map(c => c.contaFinanceira)))];

  const limparFiltros = () => {
    setSearch(""); setFilterStatus([]); setFilterForma("TODAS"); setFilterHistorico("TODAS");
    setFilterConta("TODAS"); setFilterCliente(""); setFilterValMin(""); setFilterValMax("");
    setDtrVenc(DTR_DEFAULT); setDtrEmis(DTR_DEFAULT);
  };

  const TH = ({ col, label }: { col?: keyof ContaReceber; label: string }) => (
    <th onClick={col ? () => sortBy(col) : undefined}
      className={`px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap ${col ? "cursor-pointer hover:text-foreground select-none" : ""}`}>
      {label}
      {col && <ChevronDown className={`w-3 h-3 inline ml-0.5 transition-transform ${sortCol === col ? (sortDir === "asc" ? "" : "rotate-180") : "opacity-30"}`} />}
    </th>
  );

  const FiltroSel = ({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) => (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-9 pl-3 pr-8 text-xs rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast} />}
      {modalAberto && <ModalNovaContaReceber onClose={() => setModalAberto(false)} onSave={handleNovaConta} />}
      {editando && <ModalEditarContaReceber conta={editando} onClose={() => setEditando(null)} onSave={handleSalvarEdicaoRec} />}

      {/* ── BARRA DE AÇÕES ── */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setModalAberto(true)}
          className="rounded-xl gap-1.5 h-9 text-sm bg-gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4" />Nova Conta
        </Button>
        {selectedIds.size > 0 && (<>
          <button onClick={() => handleBaixa(Array.from(selectedIds))}
            className="h-9 px-3 rounded-xl text-sm font-medium bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 flex items-center gap-1.5 transition-colors">
            <Check className="w-3.5 h-3.5" />Receber ({selectedIds.size})
          </button>
          <button onClick={() => handleCancelar(Array.from(selectedIds))}
            className="h-9 px-3 rounded-xl text-sm font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 flex items-center gap-1.5 transition-colors">
            <X className="w-3.5 h-3.5" />Cancelar
          </button>
        </>)}
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total a Receber",  value: fmt(kpis.totalAberto),    icon: DollarSign,    bg: "bg-primary/15",     fg: "text-primary",     hl: true  },
          { label: "Recebido no Mês",  value: fmt(kpis.recebidoMes),    icon: ArrowUpRight,  bg: "bg-emerald-500/15", fg: "text-emerald-600", hl: false },
          { label: "Contas Vencidas",  value: String(kpis.vencidas),    icon: AlertTriangle, bg: "bg-destructive/15", fg: "text-destructive", hl: false },
          { label: "Vencem Hoje",      value: String(kpis.hoje),        icon: Clock,         bg: "bg-amber-500/15",   fg: "text-amber-600",   hl: false },
          { label: "Contas Futuras",   value: String(kpis.futuras),     icon: TrendingUp,    bg: "bg-blue-500/15",    fg: "text-blue-600",    hl: false },
          { label: "Inadimplência",    value: `${kpis.inadimplencia}%`, icon: ReceiptText,   bg: "bg-rose-500/15",    fg: "text-rose-600",    hl: false },
        ].map(k => (
          <Card key={k.label} className="rounded-2xl border-border/50 shadow-soft">
            <CardContent className="p-3">
              <div className={`w-8 h-8 rounded-xl ${k.bg} grid place-items-center mb-2`}>
                <k.icon className={`w-4 h-4 ${k.fg}`} />
              </div>
              <div className={`text-xl font-bold tracking-tight ${k.hl ? "text-gradient-primary" : ""}`}>{k.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-soft p-6">

        {/* TOP BAR */}
        <div className={`flex items-center justify-between ${filtrosAbertosRec ? "mb-6" : ""}`}>
          <button onClick={() => setFiltrosAbertosRec(v => !v)} className="flex items-center gap-2 group">
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${filtrosAbertosRec ? "rotate-180" : ""}`} />
            <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">Filtros Avançados</span>
          </button>
          {filtrosAbertosRec && (
            <button onClick={limparFiltros}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Limpar filtros
            </button>
          )}
        </div>

        {/* MAIN GRID — 4 colunas responsivas */}
        {filtrosAbertosRec && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">

          {/* Col 1 — Situação */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Situação</p>
            <div className="flex flex-col gap-2">
              {(["pendente","pago","vencido","parcial","cancelado"] as StatusRec[]).map(s => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer group">
                  <input type="checkbox" checked={filterStatus.includes(s)}
                    onChange={() => setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0" />
                  <StatusRecBadge status={s} />
                  <span className="text-xs text-foreground/80">{{ pendente:"Pendente", pago:"Recebido", vencido:"Vencido", parcial:"Parcial", cancelado:"Cancelado" }[s]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Col 2 — Período */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
            <div className="relative">
              <select value="vencimento"
                className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer">
                <option value="vencimento">Por Vencimento</option>
                <option value="emissao">Por Emissão</option>
                <option value="recebimento">Por Recebimento</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">De</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dtrVenc.dataInicio} onChange={e => setDtrVenc(p => ({ ...p, dataInicio: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input type="time" value={dtrVenc.horaInicio} onChange={e => setDtrVenc(p => ({ ...p, horaInicio: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Até</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dtrVenc.dataFim} onChange={e => setDtrVenc(p => ({ ...p, dataFim: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input type="time" value={dtrVenc.horaFim} onChange={e => setDtrVenc(p => ({ ...p, horaFim: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
              {(dtrVenc.dataInicio || dtrVenc.dataFim) && (
                <button onClick={() => setDtrVenc(DTR_DEFAULT)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />Limpar datas
                </button>
              )}
            </div>
          </div>

          {/* Col 3 — Forma de Pgto + Conta Financeira */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forma de Pgto</p>
              <div className="relative">
                <select value={filterForma} onChange={e => setFilterForma(e.target.value)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer">
                  {FORMAS.map(f => <option key={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conta Financeira</p>
              <div className="relative">
                <select value={filterConta} onChange={e => setFilterConta(e.target.value)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer">
                  {CONTAS_FIN.map(f => <option key={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Col 4 — Histórico + Valor */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</p>
              <div className="relative">
                {(() => {
                  const nat: NaturezaHist | null =
                    filterStatus.every(s => s === "pago" || s === "parcial") ? "RECEITA" : null;
                  const lista = HISTORICOS.filter(h =>
                    nat ? h.natureza === nat : true
                  );
                  return (
                    <select value={filterHistorico} onChange={e => setFilterHistorico(e.target.value)}
                      className="w-full h-10 px-3 pr-8 text-xs rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer font-mono">
                      <option value="TODAS">Todos os históricos</option>
                      {lista.map(h => (
                        <option key={h.id} value={h.descricao}>{historicoIndent(h)}</option>
                      ))}
                    </select>
                  );
                })()}
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={filterValMin} onChange={e => setFilterValMin(e.target.value)} placeholder="Mín"
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input value={filterValMax} onChange={e => setFilterValMax(e.target.value)} placeholder="Máx"
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
            </div>
          </div>

        </div>}

        {/* BOTTOM BAR — Busca textual */}
        {filtrosAbertosRec && (
          <div className="mt-6 pt-5 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
                placeholder="Buscar por Cliente..."
                className="pl-10 h-10 w-full rounded-xl text-sm bg-secondary/40 focus:bg-background border-input" />
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por Documento ou Descrição..."
                className="pl-10 h-10 w-full rounded-xl text-sm bg-secondary/40 focus:bg-background border-input" />
            </div>
          </div>
        )}

      </div>

      {/* ── INFO + TABELA ── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} de {contas.length} registro{contas.length !== 1 ? "s" : ""}
            {selectedIds.size > 0 && <span className="ml-2 text-primary font-semibold">· {selectedIds.size} selecionado(s)</span>}
          </span>
          <span className="text-sm text-muted-foreground">
            Total filtrado: <span className="font-semibold text-foreground">{fmt(filtered.reduce((s, c) => s + c.valor, 0))}</span>
          </span>
        </div>
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 border-b border-border/40">
                  <tr>
                    <th className="px-3 py-2.5 w-8">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
                    </th>
                    <TH col="status" label="" />
                    <TH col="cliente" label="Cliente" />
                    <TH col="documento" label="Doc." />
                    <TH col="categoria" label="Histórico" />
                    <TH col="formaPgto" label="Forma Pgto" />
                    <TH col="emissao" label="Emissão" />
                    <TH col="vencimento" label="Vencimento" />
                    <TH col="recebimento" label="Recebimento" />
                    <TH col="valor" label="Valor" />
                    <TH col="juros" label="Juros" />
                    <TH col="desconto" label="Desc." />
                    <TH col="valorRecebido" label="Recebido" />
                    <TH col="contaFinanceira" label="Conta" />
                    <TH col="responsavel" label="Responsável" />
                    <TH label="Ações" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.length === 0
                    ? <tr><td colSpan={16}><EmptyState icon={ReceiptText} title="Nenhuma conta encontrada" desc="Ajuste os filtros ou adicione uma nova conta." /></td></tr>
                    : filtered.map(c => {
                      const sel = selectedIds.has(c.id);
                      return (
                        <tr key={c.id} onClick={() => toggleSelect(c.id)}
                          className={`transition-colors cursor-pointer ${sel ? "bg-primary/5" : "hover:bg-secondary/20"}`}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={sel} onChange={() => toggleSelect(c.id)}
                              onClick={e => e.stopPropagation()} className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
                          </td>
                          <td className="px-3 py-2.5"><StatusRecBadge status={c.status} /></td>
                          <td className="px-3 py-2.5 font-medium whitespace-nowrap">{c.cliente}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{c.documento || "—"}</td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap">{(() => {
                            const h = HISTORICOS.find(x => x.descricao === c.categoria);
                            return h
                              ? <span title={`Código Contábil: ${h.codigo}`} className="text-muted-foreground cursor-default">{h.descricao}</span>
                              : <span className="text-muted-foreground">{c.categoria}</span>;
                          })()}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.formaPgto}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.emissao}</td>
                          <td className={`px-3 py-2.5 text-xs whitespace-nowrap font-medium ${c.status === "vencido" ? "text-destructive" : "text-muted-foreground"}`}>{c.vencimento}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.recebimento ?? "—"}</td>
                          <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-right">{fmt(c.valor)}</td>
                          <td className="px-3 py-2.5 text-xs text-amber-600 whitespace-nowrap text-right">{c.juros > 0 ? fmt(c.juros) : "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-emerald-600 whitespace-nowrap text-right">{c.desconto > 0 ? fmt(c.desconto) : "—"}</td>
                          <td className="px-3 py-2.5 text-emerald-700 font-semibold whitespace-nowrap text-right">{fmt(c.valorRecebido)}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.contaFinanceira}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.responsavel}</td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <ActionMenu
                              status={c.status}
                              origem={c.origem}
                              onEfetivar={() => handleBaixa([c.id])}
                              onEditar={() => setEditando(c)}
                              onExcluir={() => setContas(prev => prev.filter(x => x.id !== c.id))}
                            />
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
                {filtered.length > 0 && (
                  <tfoot className="bg-secondary/60 border-t border-border/40">
                    <tr>
                      <td colSpan={9} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                        Totais ({filtered.length} registros)
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-right whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.valor, 0))}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-right text-amber-600 whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.juros, 0))}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-right text-emerald-600 whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.desconto, 0))}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-right text-emerald-700 whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.valorRecebido, 0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
      </div>
    </div>
  );
}

function StatusPagBadge({ status }: { status: StatusPag }) {
  return <StatusIconBadge status={status} pulse={status === "vencido"} />;
}

const CENTROS_CUSTO   = ["Todos","Compras","Infraestrutura","Marketing","RH","TI","Admin"];
const FORMAS_PAG      = ["Todas","Boleto","PIX","Transferência","Débito Auto","Cartão","Dinheiro"];
const CONTAS_PAG      = ["Todas","Banco","PIX","Caixa","Cartão","Débito"];
const CATS_PAG        = ["Todas","Estoque","Despesa Fixa","Utilidades","Marketing","Pessoal","Tecnologia","Serviços"];
const DTR_PAG_DEFAULT = { dataInicio: "", horaInicio: "00:00", dataFim: "", horaFim: "23:59" };

// 3. CONTAS A PAGAR
function SecaoPagar() {
  const [contas, setContas]                   = useState<ContaPagar[]>([]);
  const [toast, setToast]                     = useState("");
  const [modalAberto, setModalAberto]         = useState(false);
  const [editando, setEditando]               = useState<ContaPagar | null>(null);
  const [filtrosAbertos, setFiltrosAbertos]   = useState(true);
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [sortCol, setSortCol]                 = useState<keyof ContaPagar>("vencimento");
  const [sortAsc, setSortAsc]                 = useState(true);

  // filtros
  const [filterStatus,     setFilterStatus]     = useState<StatusPag[]>([]);
  const [filterCentro,     setFilterCentro]     = useState("Todos");
  const [filterConta,      setFilterConta]      = useState("Todas");
  const [filterForma,      setFilterForma]      = useState("Todas");
  const [filterHistorico,  setFilterHistorico]  = useState("Todas");
  const [filterValMin,     setFilterValMin]      = useState("");
  const [filterValMax,     setFilterValMax]      = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState("");
  const [search,           setSearch]           = useState("");
  const [dtrPag, setDtrPag]                     = useState(DTR_PAG_DEFAULT);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getFinanceiroPagar();
        if (mounted) setContas(Array.isArray(data) ? (data as unknown as ContaPagar[]) : []);
      } catch {
        if (mounted) setContas([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const limparFiltros = () => {
    setFilterStatus([]); setFilterCentro("Todos"); setFilterConta("Todas");
    setFilterForma("Todas"); setFilterHistorico("Todas");
    setFilterValMin(""); setFilterValMax("");
    setFilterFornecedor(""); setSearch(""); setDtrPag(DTR_PAG_DEFAULT);
  };

  const filtered = useMemo(() => {
    let list = contas.filter(c => {
      if (filterStatus.length > 0 && !filterStatus.includes(c.status)) return false;
      if (filterCentro    !== "Todos"  && c.centroCusto     !== filterCentro)    return false;
      if (filterConta     !== "Todas"  && c.contaFinanceira !== filterConta)     return false;
      if (filterForma     !== "Todas"  && c.formaPgto       !== filterForma)     return false;
      if (filterHistorico !== "Todas"  && c.categoria       !== filterHistorico) return false;
      if (filterValMin && c.valor < parseFloat(filterValMin.replace(",", ".")))  return false;
      if (filterValMax && c.valor > parseFloat(filterValMax.replace(",", ".")))  return false;
      if (filterFornecedor && !c.fornecedor.toLowerCase().includes(filterFornecedor.toLowerCase())) return false;
      if (search && !c.documento.toLowerCase().includes(search.toLowerCase()) && !c.desc.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const va = String(a[sortCol] ?? ""); const vb = String(b[sortCol] ?? "");
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [contas, filterStatus, filterCentro, filterConta, filterForma, filterHistorico,
      filterValMin, filterValMax, filterFornecedor, search, dtrPag, sortCol, sortAsc]);

  const kpis = useMemo(() => {
    const hoje = new Date(); const mesAtual = hoje.getMonth(); const anoAtual = hoje.getFullYear();
    const totalAberto  = contas.filter(c => c.status !== "pago" && c.status !== "cancelado").reduce((s, c) => s + c.valor, 0);
    const pagoMes      = contas.filter(c => { if (c.status !== "pago" || !c.pagamento) return false; const [d,m,a] = c.pagamento.split("/").map(Number); return m-1 === mesAtual && a === anoAtual; }).reduce((s, c) => s + c.valorPago, 0);
    const vencidas     = contas.filter(c => c.status === "vencido").length;
    const hoje2        = contas.filter(c => c.status === "pendente" && c.vencimento === `${String(hoje.getDate()).padStart(2,"0")}/${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`).length;
    const totalJuros   = contas.filter(c => c.status === "vencido").reduce((s, c) => s + c.juros, 0);
    return { totalAberto, pagoMes, vencidas, hoje: hoje2, totalJuros };
  }, [contas]);

  const toggleSort = (col: keyof ContaPagar) => { if (sortCol === col) setSortAsc(v => !v); else { setSortCol(col); setSortAsc(true); } };
  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(selectedIds.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(c => c.id)));

  const handleBaixa = (ids: string[]) => {
    setContas(prev => prev.map(c => ids.includes(c.id) && c.status !== "pago" && c.status !== "cancelado"
      ? { ...c, status: "pago" as StatusPag, valorPago: c.valor, pagamento: new Date().toLocaleDateString("pt-BR") } : c));
    setSelectedIds(new Set());
    showToast(`${ids.length} pagamento${ids.length > 1 ? "s" : ""} registrado${ids.length > 1 ? "s" : ""}!`);
  };
  const handleCancelar = (ids: string[]) => {
    setContas(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: "cancelado" as StatusPag } : c));
    setSelectedIds(new Set());
  };
  const handleSalvarEdicaoPag = (atualizada: ContaPagar, diff: { antes: Partial<ContaPagar>; depois: Partial<ContaPagar> }) => {
    setContas(prev => prev.map(c => c.id === atualizada.id ? atualizada : c));
    setEditando(null);
    const campos = Object.keys(diff.depois);
    if (campos.length > 0) {
      console.log("[AUDITORIA] PAGAR_ATUALIZAR", { id: atualizada.id, antes: diff.antes, depois: diff.depois });
      showToast(`Conta atualizada! Campos alterados: ${campos.join(", ")}`);
    } else {
      showToast("Nenhuma alteração detectada.");
    }
  };

  const TH = ({ col, label }: { col?: keyof ContaPagar; label: string }) => (
    <th onClick={col ? () => toggleSort(col) : undefined}
      className={`text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground whitespace-nowrap select-none ${col ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}>
      {label}{col && sortCol === col ? (sortAsc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast} />}
      {editando && <ModalEditarContaPagar conta={editando} onClose={() => setEditando(null)} onSave={handleSalvarEdicaoPag} />}

      {/* ── BARRA DE AÇÕES ── */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setModalAberto(true)}
          className="rounded-xl gap-1.5 h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
          <Plus className="w-4 h-4" />Nova Conta a Pagar
        </Button>
        {selectedIds.size > 0 && (<>
          <button onClick={() => handleBaixa(Array.from(selectedIds))}
            className="h-9 px-3 rounded-xl text-sm font-medium bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/25 flex items-center gap-1.5 transition-colors">
            <Check className="w-3.5 h-3.5" />Pagar ({selectedIds.size})
          </button>
          <button onClick={() => handleCancelar(Array.from(selectedIds))}
            className="h-9 px-3 rounded-xl text-sm font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 flex items-center gap-1.5 transition-colors">
            <X className="w-3.5 h-3.5" />Cancelar
          </button>
        </>)}
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total a Pagar",  value: fmt(kpis.totalAberto), icon: CreditCard,    bg: "bg-indigo-500/15",  fg: "text-indigo-600",  hl: true  },
          { label: "Pago no Mês",    value: fmt(kpis.pagoMes),     icon: Check,         bg: "bg-emerald-500/15", fg: "text-emerald-600", hl: false },
          { label: "Contas Vencidas",value: String(kpis.vencidas), icon: AlertTriangle, bg: "bg-rose-500/15",    fg: "text-rose-600",    hl: false },
          { label: "Vencem Hoje",    value: String(kpis.hoje),     icon: Clock,         bg: "bg-amber-500/15",   fg: "text-amber-600",   hl: false },
          { label: "Juros Acum.",    value: fmt(kpis.totalJuros),  icon: TrendingUp,    bg: "bg-rose-500/10",    fg: "text-rose-500",    hl: false },
        ].map(k => (
          <Card key={k.label} className="rounded-2xl border-border/50 shadow-soft">
            <CardContent className="p-3">
              <div className={`w-8 h-8 rounded-xl ${k.bg} grid place-items-center mb-2`}>
                <k.icon className={`w-4 h-4 ${k.fg}`} />
              </div>
              <div className={`text-xl font-bold tracking-tight ${k.hl ? "text-indigo-600" : ""}`}>{k.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-soft p-6">

        {/* TOP BAR */}
        <div className={`flex items-center justify-between ${filtrosAbertos ? "mb-6" : ""}`}>
          <button onClick={() => setFiltrosAbertos(v => !v)} className="flex items-center gap-2 group">
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${filtrosAbertos ? "rotate-180" : ""}`} />
            <span className="text-base font-semibold text-foreground group-hover:text-indigo-600 transition-colors">Filtros Avançados</span>
          </button>
          {filtrosAbertos && (
            <button onClick={limparFiltros}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Limpar filtros
            </button>
          )}
        </div>

        {/* GRID 4 COLUNAS */}
        {filtrosAbertos && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">

          {/* Col 1 — Situação */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Situação</p>
            <div className="flex flex-col gap-2">
              {(["pendente","pago","vencido","parcial","cancelado"] as StatusPag[]).map(s => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer group">
                  <input type="checkbox" checked={filterStatus.includes(s)}
                    onChange={() => setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0" />
                  <StatusPagBadge status={s} />
                  <span className="text-xs text-foreground/80">{{ pendente:"Pendente", pago:"Pago", vencido:"Vencido", parcial:"Parcial", cancelado:"Cancelado" }[s]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Col 2 — Período */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
            <div className="relative">
              <select className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-background transition-all cursor-pointer">
                <option>Por Vencimento</option>
                <option>Por Emissão</option>
                <option>Por Data de Pagamento</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">De</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dtrPag.dataInicio} onChange={e => setDtrPag(p => ({ ...p, dataInicio: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input type="time" value={dtrPag.horaInicio} onChange={e => setDtrPag(p => ({ ...p, horaInicio: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Até</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dtrPag.dataFim} onChange={e => setDtrPag(p => ({ ...p, dataFim: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input type="time" value={dtrPag.horaFim} onChange={e => setDtrPag(p => ({ ...p, horaFim: e.target.value }))}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
              {(dtrPag.dataInicio || dtrPag.dataFim) && (
                <button onClick={() => setDtrPag(DTR_PAG_DEFAULT)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />Limpar datas
                </button>
              )}
            </div>
          </div>

          {/* Col 3 — Centro de Custo + Conta Financeira */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Centro de Custo</p>
              <div className="relative">
                <select value={filterCentro} onChange={e => setFilterCentro(e.target.value)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-background transition-all cursor-pointer">
                  {CENTROS_CUSTO.map(f => <option key={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conta Financeira</p>
              <div className="relative">
                <select value={filterConta} onChange={e => setFilterConta(e.target.value)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-background transition-all cursor-pointer">
                  {CONTAS_PAG.map(f => <option key={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Col 4 — Histórico + Forma de Pgto + Valor */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</p>
              <div className="relative">
                {(() => {
                  const nat: NaturezaHist = "DESPESA";
                  const lista = HISTORICOS.filter(h => h.natureza === nat);
                  return (
                    <select value={filterHistorico} onChange={e => setFilterHistorico(e.target.value)}
                      className="w-full h-10 px-3 pr-8 text-xs rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-background transition-all cursor-pointer font-mono">
                      <option value="Todas">Todos os históricos</option>
                      {lista.map(h => (
                        <option key={h.id} value={h.descricao}>{historicoIndent(h)}</option>
                      ))}
                    </select>
                  );
                })()}
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forma de Pgto</p>
              <div className="relative">
                <select value={filterForma} onChange={e => setFilterForma(e.target.value)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-background transition-all cursor-pointer">
                  {FORMAS_PAG.map(f => <option key={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={filterValMin} onChange={e => setFilterValMin(e.target.value)} placeholder="Mín"
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input value={filterValMax} onChange={e => setFilterValMax(e.target.value)} placeholder="Máx"
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
            </div>
          </div>

        </div>}

        {/* BOTTOM BAR — Busca textual */}
        {filtrosAbertos && (
          <div className="mt-6 pt-5 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={filterFornecedor} onChange={e => setFilterFornecedor(e.target.value)}
                placeholder="Buscar por Fornecedor..."
                className="pl-10 h-10 w-full rounded-xl text-sm bg-secondary/40 focus:bg-background border-input" />
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por Documento ou Descrição..."
                className="pl-10 h-10 w-full rounded-xl text-sm bg-secondary/40 focus:bg-background border-input" />
            </div>
          </div>
        )}

      </div>

      {/* ── INFO + TABELA ── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} de {contas.length} registro{contas.length !== 1 ? "s" : ""}
            {selectedIds.size > 0 && <span className="ml-2 text-indigo-600 font-semibold">· {selectedIds.size} selecionado(s)</span>}
          </span>
          <span className="text-sm text-muted-foreground">
            Total filtrado: <span className="font-semibold text-foreground">{fmt(filtered.reduce((s, c) => s + c.valor, 0))}</span>
          </span>
        </div>
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer" />
                  </th>
                  <TH col="status"         label=""             />
                  <TH col="fornecedor"     label="Fornecedor"   />
                  <TH col="documento"      label="Doc."         />
                  <TH col="centroCusto"    label="Centro Custo" />
                  <TH col="categoria"      label="Histórico"    />
                  <TH col="formaPgto"      label="Forma Pgto"   />
                  <TH col="emissao"        label="Emissão"      />
                  <TH col="vencimento"     label="Vencimento"   />
                  <TH col="pagamento"      label="Pagamento"    />
                  <TH col="valor"          label="Valor"        />
                  <TH col="juros"          label="Juros"        />
                  <TH col="desconto"       label="Desc."        />
                  <TH col="valorPago"      label="Pago"         />
                  <TH col="contaFinanceira"label="Conta"        />
                  <TH col="responsavel"    label="Responsável"  />
                  <TH label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.length === 0
                  ? <tr><td colSpan={16}><EmptyState icon={CreditCard} title="Nenhuma conta encontrada" desc="Ajuste os filtros ou adicione uma nova conta a pagar." /></td></tr>
                  : filtered.map(c => {
                    const sel = selectedIds.has(c.id);
                    return (
                      <tr key={c.id} onClick={() => toggleSelect(c.id)}
                        className={`transition-colors cursor-pointer ${sel ? "bg-indigo-500/5" : "hover:bg-secondary/20"}`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={sel} onChange={() => toggleSelect(c.id)}
                            onClick={e => e.stopPropagation()} className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5"><StatusPagBadge status={c.status} /></td>
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap">{c.fornecedor}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{c.documento || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.centroCusto}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">{(() => {
                          const h = HISTORICOS.find(x => x.descricao === c.categoria);
                          return h
                            ? <span title={`Código Contábil: ${h.codigo}`} className="text-muted-foreground cursor-default">{h.descricao}</span>
                            : <span className="text-muted-foreground">{c.categoria}</span>;
                        })()}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.formaPgto}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.emissao}</td>
                        <td className={`px-3 py-2.5 text-xs whitespace-nowrap font-medium ${c.status === "vencido" ? "text-rose-600" : "text-muted-foreground"}`}>{c.vencimento}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.pagamento ?? "—"}</td>
                        <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-right">{fmt(c.valor)}</td>
                        <td className="px-3 py-2.5 text-xs text-rose-500 whitespace-nowrap text-right">{c.juros > 0 ? fmt(c.juros) : "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-emerald-600 whitespace-nowrap text-right">{c.desconto > 0 ? fmt(c.desconto) : "—"}</td>
                        <td className="px-3 py-2.5 text-indigo-700 font-semibold whitespace-nowrap text-right">{fmt(c.valorPago)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.contaFinanceira}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.responsavel}</td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <ActionMenu
                            status={c.status}
                            origem={c.origem}
                            onEfetivar={() => handleBaixa([c.id])}
                            onEditar={() => setEditando(c)}
                            onExcluir={() => setContas(prev => prev.filter(x => x.id !== c.id))}
                          />
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-secondary/60 border-t border-border/40">
                  <tr>
                    <td colSpan={9} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                      Totais ({filtered.length} registros)
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.valor, 0))}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right text-rose-500 whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.juros, 0))}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right text-emerald-600 whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.desconto, 0))}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right text-indigo-700 whitespace-nowrap">{fmt(filtered.reduce((s, c) => s + c.valorPago, 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── badge de natureza ──
function NaturezaBadge({ natureza }: { natureza: NaturezaLancamento }) {
  const map: Record<NaturezaLancamento, { label: string; cls: string }> = {
    RECEITA:       { label: "Receita",      cls: "bg-emerald-500/15 text-emerald-700" },
    DESPESA:       { label: "Despesa",      cls: "bg-destructive/15 text-destructive" },
    TRANSFERENCIA: { label: "Transferencia", cls: "bg-blue-500/15 text-blue-700"     },
  };
  const { label, cls } = map[natureza];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

function StatusLancBadge({ status }: { status: StatusLancamento }) {
  return status === "EFETIVADO"
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary whitespace-nowrap">Efetivado</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 whitespace-nowrap">Em aberto</span>;
}

// ── painel de totais ──
function PainelTotais({ totais }: { totais: ReturnType<typeof calcularTotais> }) {
  const items = [
    { label: "Receitas em aberto",  value: totais.total_receitas_em_aberto,  color: "text-emerald-600", bg: "bg-emerald-500/15" },
    { label: "Receitas efetivadas", value: totais.total_receitas_efetivadas, color: "text-emerald-700", bg: "bg-emerald-500/10" },
    { label: "Despesas em aberto",  value: totais.total_despesas_em_aberto,  color: "text-destructive", bg: "bg-destructive/15" },
    { label: "Despesas efetivadas", value: totais.total_despesas_efetivadas, color: "text-red-700",     bg: "bg-destructive/10" },
    { label: "Saldo previsto",      value: totais.saldo_previsto,  color: totais.saldo_previsto  >= 0 ? "text-primary"      : "text-destructive", bg: "bg-primary/10"  },
    { label: "Saldo realizado",     value: totais.saldo_realizado, color: totais.saldo_realizado >= 0 ? "text-emerald-700"   : "text-destructive", bg: "bg-primary/15"  },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map(i => (
        <Card key={i.label} className="rounded-xl border-border/50 shadow-soft">
          <CardContent className="p-3">
            <div className={`text-base font-bold ${i.color}`}>{fmt(i.value)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{i.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// 4. FLUXO DE CAIXA (unificado com Contas a Pagar / Receber)
function SecaoFluxo() {
  const { filtros, setFiltro, resetFiltros, resultado, chaveAgrupamento, setChaveAgrupamento, opcoesUnicas } = useFluxoCaixa();
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  const toggleGrupo = (chave: string) =>
    setExpandidos(prev => ({ ...prev, [chave]: !prev[chave] }));

  const grupos = useMemo(() =>
    chaveAgrupamento ? agruparComTotais(resultado.registros, chaveAgrupamento) : null,
    [resultado.registros, chaveAgrupamento]
  );

  const COLUNAS_AGRUPA: { value: keyof LancamentoFinanceiro; label: string }[] = [
    { value: "natureza",       label: "Natureza"       },
    { value: "status",         label: "Status"         },
    { value: "unidade",        label: "Unidade"        },
    { value: "favorecido",     label: "Favorecido"     },
    { value: "forma_pagamento",label: "Forma de Pgto"  },
    { value: "conta_corrente", label: "Conta Corrente" },
    { value: "centro_custo",   label: "Centro de Custo"},
  ];

  const TH = "text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground whitespace-nowrap";
  const TD = "px-3 py-2.5 text-sm";
  const TR = "hover:bg-secondary/30 transition-colors";

  const valorColor = (n: NaturezaLancamento) =>
    n === "RECEITA" ? "text-emerald-600" : n === "DESPESA" ? "text-destructive" : "text-muted-foreground";

  const LancamentoRow = ({ l }: { l: LancamentoFinanceiro }) => (
    <tr className={TR}>
      <td className={TD}><NaturezaBadge natureza={l.natureza} /></td>
      <td className={TD}><StatusLancBadge status={l.status} /></td>
      <td className={`${TD} font-medium max-w-[160px] truncate`}>{l.favorecido}</td>
      <td className={`${TD} text-muted-foreground max-w-[180px] truncate`}>{l.historico_1}</td>
      <td className={`${TD} font-mono text-xs text-muted-foreground whitespace-nowrap`}>{l.num_documento || l.num_nota_fiscal || "—"}</td>
      <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap`}>{l.data_vencimento}</td>
      <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap`}>{l.data_pagamento ?? "—"}</td>
      <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap`}>{l.forma_pagamento}</td>
      <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap`}>{l.unidade}</td>
      {/* ── Valor | Acréscimo | Desconto | Valor Total ── */}
      <td className={`${TD} font-semibold text-right whitespace-nowrap ${valorColor(l.natureza)}`}>
        {fmt(l.valor_nominal)}
      </td>
      <td className={`${TD} text-right whitespace-nowrap text-xs ${l.acrescimo > 0 ? "text-amber-600 font-medium" : "text-muted-foreground/40"}`}>
        {l.acrescimo > 0 ? `+${fmt(l.acrescimo)}` : "—"}
      </td>
      <td className={`${TD} text-right whitespace-nowrap text-xs ${l.desconto > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground/40"}`}>
        {l.desconto > 0 ? `-${fmt(l.desconto)}` : "—"}
      </td>
      <td className={`${TD} font-bold text-right whitespace-nowrap border-l border-border/30 ${
        l.natureza === "RECEITA" ? "text-emerald-700" : l.natureza === "DESPESA" ? "text-red-700" : "text-muted-foreground"
      }`}>
        {fmt(l.valor_total)}
      </td>
    </tr>
  );

  const TabelaHeaders = () => (
    <tr>
      {["Natureza","Status","Favorecido","Histórico","Documento","Vencimento","Pagamento","Forma Pgto","Unidade"].map(h => (
        <th key={h} className={TH}>{h}</th>
      ))}
      <th className={`${TH} text-right`}>Valor</th>
      <th className={`${TH} text-right`}>Acréscimo</th>
      <th className={`${TH} text-right`}>Desconto</th>
      <th className={`${TH} text-right border-l border-border/30`}>Valor Total</th>
    </tr>
  );

  return (
    <div className="space-y-4">

      {/* ── FILTROS ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-soft p-6">

        {/* TOP BAR */}
        <div className={`flex items-center justify-between ${filtrosAbertos ? "mb-6" : ""}`}>
          <button
            onClick={() => setFiltrosAbertos(v => !v)}
            className="flex items-center gap-2 group"
          >
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${filtrosAbertos ? "rotate-180" : ""}`} />
            <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">Filtros Avançados</span>
          </button>
          {filtrosAbertos && (
            <button onClick={resetFiltros}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Limpar filtros
            </button>
          )}
        </div>

        {/* MAIN GRID — 4 colunas responsivas */}
        {filtrosAbertos && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">

          {/* Col 1 — Natureza + Status */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Natureza</p>
              <div className="flex flex-col gap-2">
                {(["RECEITA", "DESPESA", "TRANSFERENCIA"] as NaturezaLancamento[]).map(n => (
                  <label key={n} className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input type="checkbox"
                      checked={filtros.natureza_filtro.includes(n)}
                      onChange={e => {
                        const cur = filtros.natureza_filtro;
                        setFiltro("natureza_filtro", e.target.checked ? [...cur, n] : cur.filter(x => x !== n));
                      }}
                      className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                    />
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {n === "RECEITA" ? "Receita" : n === "DESPESA" ? "Despesa" : "Transferência"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
              <div className="flex flex-col gap-2">
                {(["EM_ABERTO", "EFETIVADO"] as StatusLancamento[]).map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input type="checkbox"
                      checked={filtros.status_filtro.includes(s)}
                      onChange={e => {
                        const cur = filtros.status_filtro;
                        setFiltro("status_filtro", e.target.checked ? [...cur, s] : cur.filter(x => x !== s));
                      }}
                      className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                    />
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {s === "EM_ABERTO" ? "Em aberto" : "Efetivado"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Col 2 — Período */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
            <div className="relative">
              <select
                value={filtros.tipo_data_filtro}
                onChange={e => setFiltro("tipo_data_filtro", e.target.value as typeof filtros.tipo_data_filtro)}
                className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer"
              >
                <option value="vencimento">Por Vencimento</option>
                <option value="inclusao">Por Inclusão</option>
                <option value="emissao">Por Emissão</option>
                <option value="pagamento">Por Pagamento</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">De</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date"
                  value={filtros.periodo_data?.data_inicio ?? ""}
                  onChange={e => setFiltro("periodo_data", {
                    ...(filtros.periodo_data ?? { hora_inicio: "00:00", data_fim: "", hora_fim: "23:59" }),
                    data_inicio: e.target.value,
                  })}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input"
                />
                <Input type="time"
                  value={filtros.periodo_data?.hora_inicio ?? "00:00"}
                  onChange={e => setFiltro("periodo_data", {
                    ...(filtros.periodo_data ?? { data_inicio: "", data_fim: "", hora_fim: "23:59" }),
                    hora_inicio: e.target.value,
                  })}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input"
                />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Até</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date"
                  value={filtros.periodo_data?.data_fim ?? ""}
                  onChange={e => setFiltro("periodo_data", {
                    ...(filtros.periodo_data ?? { data_inicio: "", hora_inicio: "00:00", hora_fim: "23:59" }),
                    data_fim: e.target.value,
                  })}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input"
                />
                <Input type="time"
                  value={filtros.periodo_data?.hora_fim ?? "23:59"}
                  onChange={e => setFiltro("periodo_data", {
                    ...(filtros.periodo_data ?? { data_inicio: "", hora_inicio: "00:00", data_fim: "" }),
                    hora_fim: e.target.value,
                  })}
                  className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input"
                />
              </div>
              {filtros.periodo_data && (
                <button onClick={() => setFiltro("periodo_data", null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />Limpar datas
                </button>
              )}
            </div>
          </div>

          {/* Col 3 — Forma de Pgto + Unidade */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forma de Pgto</p>
              <div className="relative">
                <select
                  value={filtros.forma_pagamento_id}
                  onChange={e => setFiltro("forma_pagamento_id", e.target.value)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer"
                >
                  <option value="TODAS">Todas</option>
                  {opcoesUnicas("forma_pagamento").map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unidade</p>
              <div className="relative">
                <select
                  value={filtros.unidade_id}
                  onChange={e => setFiltro("unidade_id", e.target.value)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer"
                >
                  <option value="TODAS">Todas</option>
                  {opcoesUnicas("unidade").map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Col 4 — Agrupar por */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agrupar por</p>
            <div className="relative">
              <select
                value={chaveAgrupamento ?? ""}
                onChange={e => setChaveAgrupamento(e.target.value === "" ? null : e.target.value as keyof LancamentoFinanceiro)}
                className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all cursor-pointer"
              >
                <option value="">Sem agrupamento</option>
                {COLUNAS_AGRUPA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1">
              Agrupa os lançamentos abaixo por categoria, alterando a estrutura da tabela.
            </p>
          </div>

        </div>}

        {/* BOTTOM BAR — Busca textual */}
        {filtrosAbertos && (
          <div className="mt-6 pt-5 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={filtros.busca_documento}
                onChange={e => setFiltro("busca_documento", e.target.value)}
                placeholder="Buscar por Documento (ex: NF-4521)"
                className="pl-10 h-10 w-full rounded-xl text-sm bg-secondary/40 focus:bg-background border-input"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={filtros.busca_cheque}
                onChange={e => setFiltro("busca_cheque", e.target.value)}
                placeholder="Buscar por Num. Cheque (ex: CHQ-001)"
                className="pl-10 h-10 w-full rounded-xl text-sm bg-secondary/40 focus:bg-background border-input"
              />
            </div>
          </div>
        )}

      </div>

      {/* ── TOTAIS ──────────────────────────────────────── */}
      <PainelTotais totais={resultado.totais} />

      {/* ── INFO BAR ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
        <span>{resultado.total_bruto} registro{resultado.total_bruto !== 1 ? "s" : ""}</span>
        <span className="w-px h-3 bg-border/60 hidden sm:block" />
        <span>Acréscimos: <span className="font-semibold text-amber-600">{fmt(resultado.totais.total_acrescimos)}</span></span>
        <span>Descontos: <span className="font-semibold text-emerald-600">{fmt(resultado.totais.total_descontos)}</span></span>
      </div>

      {/* ── TABELA ──────────────────────────────────────── */}
      {!grupos ? (
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40"><TabelaHeaders /></thead>
              <tbody className="divide-y divide-border/30">
                {resultado.registros.length === 0
                  ? <tr><td colSpan={13}><EmptyState icon={BarChart2} title="Nenhum lançamento encontrado" desc="Ajuste os filtros para ver os lançamentos." /></td></tr>
                  : resultado.registros.map(l => <LancamentoRow key={l.id_lancamento} l={l} />)
                }
              </tbody>
              {resultado.registros.length > 0 && (
                <tfoot className="bg-secondary/60 border-t border-border/40">
                  <tr>
                    <td colSpan={9} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Totais do período</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right text-foreground whitespace-nowrap">
                      {fmt(resultado.registros.reduce((s, l) => s + l.valor_nominal, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right text-amber-600 whitespace-nowrap">
                      +{fmt(resultado.totais.total_acrescimos)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right text-emerald-600 whitespace-nowrap">
                      -{fmt(resultado.totais.total_descontos)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right border-l border-border/30 text-primary whitespace-nowrap">
                      {fmt(resultado.registros.reduce((s, l) => s + l.valor_total, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {grupos.map(g => (
            <Card key={g.chave} className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
              <button
                onClick={() => toggleGrupo(g.chave)}
                className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandidos[g.chave] ? "rotate-180" : ""}`} />
                  <span className="font-semibold text-sm">{g.chave}</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{g.registros.length}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-emerald-600 font-semibold">Rec: {fmt(g.totais.total_receitas_em_aberto + g.totais.total_receitas_efetivadas)}</span>
                  <span className="text-destructive font-semibold">Desp: {fmt(g.totais.total_despesas_em_aberto + g.totais.total_despesas_efetivadas)}</span>
                  <span className={`font-bold ${(g.totais.saldo_realizado + g.totais.saldo_previsto) >= 0 ? "text-primary" : "text-destructive"}`}>
                    Saldo: {fmt(g.totais.saldo_realizado + g.totais.saldo_previsto)}
                  </span>
                </div>
              </button>
              {!expandidos[g.chave] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/20 border-b border-border/30"><TabelaHeaders /></thead>
                    <tbody className="divide-y divide-border/20">
                      {g.registros.map(l => <LancamentoRow key={l.id_lancamento} l={l} />)}
                    </tbody>
                    <tfoot className="bg-secondary/40 border-t border-border/30">
                      <tr>
                        <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-muted-foreground">Subtotal</td>
                        <td className="px-3 py-2 text-xs font-bold text-right text-foreground whitespace-nowrap">
                          {fmt(g.registros.reduce((s, l) => s + l.valor_nominal, 0))}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-right text-amber-600 whitespace-nowrap">
                          +{fmt(g.totais.total_acrescimos)}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-right text-emerald-600 whitespace-nowrap">
                          -{fmt(g.totais.total_descontos)}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-right border-l border-border/30 text-primary whitespace-nowrap">
                          {fmt(g.registros.reduce((s, l) => s + l.valor_total, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// 5. MOVIMENTACOES (log somente-leitura)
function SecaoMovimentacoes() {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [dtr, setDtr] = useState<DateTimeRange>(DTR_DEFAULT);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getFinanceiroMovimentacoes();
        if (mounted) setMovs(Array.isArray(data) ? (data as unknown as Movimentacao[]) : []);
      } catch {
        if (mounted) setMovs([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const tsI = dtr.dataInicio ? Date.parse(`${dtr.dataInicio}T${dtr.horaInicio}:00`) : 0;
    const tsF = dtr.dataFim    ? Date.parse(`${dtr.dataFim}T${dtr.horaFim}:00`)    : Infinity;
    const q = search.toLowerCase();
    return movs.filter(m => {
      if (filterTipo !== "todos" && m.tipo !== filterTipo) return false;
      if (q && !m.desc.toLowerCase().includes(q) && !m.categoria.toLowerCase().includes(q) && !m.responsavel.toLowerCase().includes(q)) return false;
      if (dtr.dataInicio || dtr.dataFim) {
        const ts = parseMovData(m.data);
        if (ts < tsI || ts > tsF) return false;
      }
      return true;
    });
  }, [search, filterTipo, dtr, movs]);

  const tipoCls: Record<TipoMov, string> = {
    entrada: "bg-emerald-500/15 text-emerald-700",
    saida:   "bg-destructive/15 text-destructive",
    ajuste:  "bg-secondary text-muted-foreground",
  };
  const tipoLabel: Record<TipoMov, string> = { entrada: "Entrada", saida: "Saida", ajuste: "Ajuste" };

  return (
    <div className="space-y-4">
      {/* Filtros — sem botão de novo lançamento (log) */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar movimentacao..." />
          <SelectFilter value={filterTipo} onChange={setFilterTipo} options={[
            { value: "todos",   label: "Todos"    },
            { value: "entrada", label: "Entradas" },
            { value: "saida",   label: "Saidas"   },
            { value: "ajuste",  label: "Ajustes"  },
          ]} />
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="border-t border-border/30 pt-3">
          <DateTimeRangeFilter value={dtr} onChange={setDtr} />
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/40">
              <tr>
                {["Tipo","Descricao","Categoria","Valor","Origem","Responsavel","Data"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.length === 0
                ? <tr><td colSpan={7}><EmptyState icon={ArrowLeftRight} title="Nenhuma movimentacao" desc="Nenhuma movimentacao encontrada para os filtros selecionados." /></td></tr>
                : filtered.map(m => (
                  <tr key={m.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${tipoCls[m.tipo]}`}>
                        {tipoLabel[m.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{m.desc}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.categoria}</td>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap ${
                      m.tipo === "entrada" ? "text-emerald-600" : m.tipo === "saida" ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {m.tipo === "saida" ? "-" : "+"}{fmt(m.valor)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{m.origem}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{m.responsavel}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{m.data}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
// DRE — TreeView de totais por histórico
// ─────────────────────────────────────────────────
function DreTreeView({
  nodes, titulo, natureza,
}: {
  nodes: DreNode[];
  titulo: string;
  natureza: "RECEITA" | "DESPESA";
}) {
  const cor = natureza === "RECEITA" ? "text-emerald-700" : "text-rose-700";
  const bgGrupo = natureza === "RECEITA" ? "bg-emerald-50/60" : "bg-rose-50/60";
  const filtered = nodes.filter(n => n.historico.natureza === natureza);
  const totalGeral = filtered.filter(n => n.historico.nivel === 1).reduce((s, n) => s + n.total, 0);

  const rowStyle = (nivel: number) =>
    nivel === 1
      ? `font-bold text-sm text-slate-900 ${bgGrupo} border-t border-border/40`
      : nivel === 2
      ? "font-semibold text-sm text-slate-700 bg-secondary/10"
      : "font-normal text-sm text-slate-600 hover:bg-secondary/10 transition-colors";

  const indent = (nivel: number) =>
    nivel === 1 ? "" : nivel === 2 ? "pl-6" : "pl-12";

  return (
    <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-bold ${cor}`}>{titulo}</CardTitle>
          <span className={`text-sm font-bold ${cor}`}>{fmt(totalGeral)}</span>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 border-b border-border/40">
            <tr>
              <th className="text-left px-4 py-2 text-[11px] font-semibold text-muted-foreground w-28">Código</th>
              <th className="text-left px-4 py-2 text-[11px] font-semibold text-muted-foreground">Histórico</th>
              <th className="text-right px-4 py-2 text-[11px] font-semibold text-muted-foreground w-32">Total Período</th>
              <th className="text-right px-4 py-2 text-[11px] font-semibold text-muted-foreground w-28">Lançamentos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {filtered.map(({ historico: h, total, direto }) => (
              <tr key={h.id} className={rowStyle(h.nivel)}>
                <td className={`px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap ${indent(h.nivel)}`}>
                  {h.codigo}
                </td>
                <td className={`px-4 py-2.5 ${indent(h.nivel)}`}>{h.descricao}</td>
                <td className={`px-4 py-2.5 text-right whitespace-nowrap tabular-nums ${
                  total > 0 ? (natureza === "RECEITA" ? "text-emerald-700" : "text-rose-700") : "text-muted-foreground"
                }`}>
                  {total > 0 ? fmt(total) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                  {direto > 0 ? fmt(direto) : h.nivel === 3 ? "—" : "↑ cascata"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className={`border-t-2 border-border/60 ${bgGrupo}`}>
            <tr>
              <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-muted-foreground">TOTAL {titulo.toUpperCase()}</td>
              <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${cor}`}>{fmt(totalGeral)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────
// 7. SEÇÃO DRE — Demonstrativo de Resultado
// ─────────────────────────────────────────────────
function SecaoDre() {
  const [dtrInicio, setDtrInicio] = useState("");
  const [dtrFim,    setDtrFim]    = useState("");

  const lancamentos = useMemo<LancamentoDRE[]>(() => [], []);

  const nodes = useMemo(() => calcularDRE(HISTORICOS, lancamentos), [lancamentos]);

  const totalReceitas  = nodes.filter(n => n.historico.nivel === 1 && n.historico.natureza === "RECEITA").reduce((s, n) => s + n.total, 0);
  const totalDespesas  = nodes.filter(n => n.historico.nivel === 1 && n.historico.natureza === "DESPESA").reduce((s, n) => s + n.total, 0);
  const resultado = totalReceitas - totalDespesas;

  return (
    <div className="space-y-5">
      {/* Header + filtro de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Demonstrativo de Resultado (DRE)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Totais hierárquicos por histórico contábil</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">De</span>
          <input type="date" value={dtrInicio} onChange={e => setDtrInicio(e.target.value)}
            className="h-8 px-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          <span className="font-medium">Até</span>
          <input type="date" value={dtrFim} onChange={e => setDtrFim(e.target.value)}
            className="h-8 px-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          {(dtrInicio || dtrFim) && (
            <button onClick={() => { setDtrInicio(""); setDtrFim(""); }}
              className="text-destructive hover:underline text-[11px]">Limpar</button>
          )}
        </div>
      </div>

      {/* KPIs de resultado */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 shadow-soft">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Total Receitas</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{fmt(totalReceitas)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-200 bg-rose-50/50 shadow-soft">
          <CardContent className="p-4">
            <p className="text-xs text-rose-700 font-semibold uppercase tracking-wider">Total Despesas</p>
            <p className="text-xl font-bold text-rose-700 mt-1">{fmt(totalDespesas)}</p>
          </CardContent>
        </Card>
        <Card className={`rounded-2xl shadow-soft ${resultado >= 0 ? "border-primary/30 bg-primary/5" : "border-rose-300 bg-rose-50/50"}`}>
          <CardContent className="p-4">
            <p className={`text-xs font-semibold uppercase tracking-wider ${resultado >= 0 ? "text-primary" : "text-rose-700"}`}>
              {resultado >= 0 ? "Lucro Líquido" : "Prejuízo"}
            </p>
            <p className={`text-xl font-bold mt-1 ${resultado >= 0 ? "text-primary" : "text-rose-700"}`}>{fmt(Math.abs(resultado))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Árvores lado a lado */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DreTreeView nodes={nodes} titulo="Receitas" natureza="RECEITA" />
        <DreTreeView nodes={nodes} titulo="Despesas" natureza="DESPESA" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// HISTÓRICOS — helpers de código automático
// ─────────────────────────────────────────────────
function gerarProximoCodigo(lista: HistoricoFinanceiro[], paiId: string | null): string {
  if (!paiId) {
    const raizes = lista.filter(h => h.nivel === 1);
    const maxNum = raizes.reduce((m, h) => {
      const n = parseInt(h.codigo.replace(".", "")) || 0;
      return n > m ? n : m;
    }, 0);
    return `${maxNum + 1}.`;
  }
  const pai = lista.find(h => h.id === paiId);
  if (!pai) return "?";
  const filhos = lista.filter(h => {
    const pfx = pai.codigo.endsWith(".") ? pai.codigo.slice(0, -1) : pai.codigo;
    if (pai.nivel === 1) return h.nivel === 2 && h.codigo.startsWith(pfx + ".");
    if (pai.nivel === 2) return h.nivel === 3 && h.codigo.startsWith(pfx + ".");
    return false;
  });
  const maxSub = filhos.reduce((m, h) => {
    const parts = h.codigo.split(".");
    const n = parseInt(parts[parts.length - 1]) || 0;
    return n > m ? n : m;
  }, 0);
  const nextSub = String(maxSub + 1).padStart(2, "0");
  if (pai.nivel === 1) {
    const base = pai.codigo.replace(".", "");
    return `${base}.${nextSub}`;
  }
  return `${pai.codigo}.${nextSub}`;
}

// ─────────────────────────────────────────────────
// MODAL CRIAR / EDITAR HISTÓRICO
// ─────────────────────────────────────────────────
function ModalHistorico({
  lista, editando, onClose, onSave,
}: {
  lista: HistoricoFinanceiro[];
  editando: HistoricoFinanceiro | null;
  onClose: () => void;
  onSave: (h: HistoricoFinanceiro, anterior: HistoricoFinanceiro | null) => void;
}) {
  const isEdit = !!editando;
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [natureza, setNatureza] = useState<NaturezaHist>(editando?.natureza ?? "RECEITA");
  const [isRaiz, setIsRaiz] = useState(editando ? editando.nivel === 1 : false);
  const [paiId, setPaiId] = useState<string>(
    editando && editando.nivel > 1
      ? (lista.find(h => h.nivel === editando.nivel - 1 && editando.codigo.startsWith(
          h.nivel === 1 ? h.codigo.replace(".", "") : h.codigo
        ))?.id ?? "")
      : ""
  );

  const paiOptions = lista.filter(h => h.nivel < 3 && h.nivel === (isRaiz ? -1 : (
    isEdit && editando ? editando.nivel - 1 : 99
  )));
  const todosGrupos = lista.filter(h => h.nivel === 1 || h.nivel === 2);

  const codigoSugerido = useMemo(() => {
    if (isEdit && editando) return editando.codigo;
    if (isRaiz) return gerarProximoCodigo(lista, null);
    if (paiId) return gerarProximoCodigo(lista, paiId);
    return "—";
  }, [isRaiz, paiId, lista, editando, isEdit]);

  const nivelSugerido = useMemo(() => {
    if (isEdit && editando) return editando.nivel;
    if (isRaiz) return 1;
    const pai = lista.find(h => h.id === paiId);
    return pai ? pai.nivel + 1 : 0;
  }, [isRaiz, paiId, lista, editando, isEdit]);

  const canSave = descricao.trim().length > 0 && (isRaiz || paiId !== "");

  const handleSave = () => {
    if (!canSave) return;
    const novo: HistoricoFinanceiro = {
      id: editando?.id ?? `h_${Date.now()}`,
      codigo: codigoSugerido,
      descricao: descricao.trim().toUpperCase(),
      natureza,
      nivel: nivelSugerido,
    };
    onSave(novo, editando ?? null);
    onClose();
  };

  const nivelLabel = nivelSugerido === 1 ? "Grupo" : nivelSugerido === 2 ? "Subgrupo" : nivelSugerido === 3 ? "Analítico" : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              {isEdit ? "Editar Histórico" : "Novo Histórico"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Plano de Contas — Históricos Estruturados</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value.toUpperCase())}
              placeholder="Ex: VENDAS DE MERCADORIAS"
              className="h-9 rounded-xl text-sm font-mono uppercase" />
          </div>

          {/* Natureza */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Natureza</label>
            <div className="flex gap-2">
              {(["RECEITA", "DESPESA"] as NaturezaHist[]).map(n => (
                <button key={n} onClick={() => setNatureza(n)}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold border transition-all ${
                    natureza === n
                      ? n === "RECEITA" ? "bg-emerald-500 text-white border-emerald-500"
                        : n === "DESPESA" ? "bg-rose-500 text-white border-rose-500"
                        : "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/40 text-muted-foreground border-input hover:bg-secondary"
                  }`}>
                  {n === "RECEITA" ? "Receita" : "Despesa"}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Categoria Raiz */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40">
            <div>
              <p className="text-xs font-semibold">Categoria Raiz (nível principal)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ative se este item não possui pai (ex: 1. RECEITAS)</p>
            </div>
            <button onClick={() => { setIsRaiz(v => !v); setPaiId(""); }}
              className={`relative w-10 h-5 rounded-full transition-all ${isRaiz ? "bg-primary" : "bg-border"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isRaiz ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          {/* Select Categoria Pai */}
          {!isRaiz && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria Pai</label>
              <div className="relative">
                <select value={paiId} onChange={e => setPaiId(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 text-xs rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring font-mono cursor-pointer">
                  <option value="">— Selecione o pai —</option>
                  {todosGrupos.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nivel === 2 ? "\u00a0\u00a0" : ""}{h.codigo} {h.descricao}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Preview do código gerado */}
          {(isRaiz || paiId) && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Código</p>
                <p className="text-base font-bold font-mono text-primary">{codigoSugerido}</p>
              </div>
              <div className="w-px h-8 bg-border/60" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nível</p>
                <p className="text-sm font-semibold">{nivelLabel}</p>
              </div>
              <div className="w-px h-8 bg-border/60" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Natureza</p>
                <p className={`text-xs font-semibold ${natureza === "RECEITA" ? "text-emerald-600" : natureza === "DESPESA" ? "text-rose-600" : "text-primary"}`}>{natureza}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border/40">
          <button onClick={onClose} className="flex-1 h-9 rounded-xl text-sm font-medium text-muted-foreground bg-secondary/50 hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <Button onClick={handleSave} disabled={!canSave}
            className="flex-1 h-9 rounded-xl text-sm bg-gradient-primary text-primary-foreground gap-1.5">
            <Check className="w-3.5 h-3.5" />{isEdit ? "Salvar" : "Criar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// 6. HISTÓRICOS — CRUD completo
// ─────────────────────────────────────────────────
function SecaoHistoricos() {
  const [lista, setLista] = useState<HistoricoFinanceiro[]>(HISTORICOS);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<HistoricoFinanceiro | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const emUso = (_h: HistoricoFinanceiro) => false;

  const handleSave = (novo: HistoricoFinanceiro, anterior: HistoricoFinanceiro | null) => {
    if (anterior) {
      setLista(prev => prev.map(h => h.id === novo.id ? novo : h));
      console.log("[AUDITORIA] CONFIG_HISTORICOS:EDITAR", {
        modulo: "CONFIG_HISTORICOS",
        dados_anteriores: anterior,
        dados_novos: novo,
      });
      showToast(`Histórico "${novo.codigo}" atualizado.`);
    } else {
      setLista(prev => {
        const pai = prev.find(h => h.nivel === novo.nivel - 1 &&
          (novo.nivel === 2
            ? novo.codigo.startsWith(h.codigo.replace(".", ""))
            : novo.codigo.startsWith(h.codigo + ".")));
        const idx = pai ? prev.findIndex(h => {
          const irmaos = prev.filter(x => x.nivel === novo.nivel && x.codigo.startsWith(
            novo.nivel === 2 ? novo.codigo.split(".")[0] + "." : novo.codigo.split(".").slice(0,2).join(".") + "."
          ));
          return h.id === (irmaos[irmaos.length - 1]?.id ?? pai?.id);
        }) : prev.length - 1;
        const next = [...prev];
        next.splice(idx + 1, 0, novo);
        return next;
      });
      console.log("[AUDITORIA] CONFIG_HISTORICOS:CRIAR", {
        modulo: "CONFIG_HISTORICOS",
        dados_anteriores: null,
        dados_novos: novo,
      });
      showToast(`Histórico "${novo.codigo} ${novo.descricao}" criado.`);
    }
  };

  const handleExcluir = (h: HistoricoFinanceiro) => {
    setMenuAberto(null);
    // Bloqueio total - históricos não podem ser excluídos para preservar integridade dos relatórios
    setBloqueio(
      `Não é possível excluir "${h.descricao}". ` +
      `Históricos são estruturas permanentes do plano de contas e sua exclusão impactaria ` +
      `na visualização e cálculo de relatórios financeiros como a DRE (Demonstração do Resultado do Exercício). ` +
      `Se necessário, você pode inativar ou renomear este histórico através da função Editar.`
    );
  };

  const abrirNovo = () => { setEditando(null); setModalAberto(true); };
  const abrirEditar = (h: HistoricoFinanceiro) => { setEditando(h); setModalAberto(true); setMenuAberto(null); };

  const sorted = useMemo(() => [...lista].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true })), [lista]);

  const indentClass = (nivel: number) => nivel === 1 ? "" : nivel === 2 ? "pl-6" : "pl-12";
  const nivelLabel = (nivel: number) => nivel === 1 ? "Grupo" : nivel === 2 ? "Subgrupo" : "Analítico";
  const nivelBadge = (nivel: number) => nivel === 1
    ? "bg-slate-100 text-slate-600"
    : nivel === 2 ? "bg-blue-50 text-blue-700"
    : "bg-primary/10 text-primary";
  const naturezaBadge = (n: NaturezaHist) => n === "RECEITA"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700";

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast} />}
      {modalAberto && (
        <ModalHistorico lista={lista} editando={editando} onClose={() => setModalAberto(false)} onSave={handleSave} />
      )}
      {bloqueio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setBloqueio(null)}>
          <div className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground mb-1">Exclusão Bloqueada</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{bloqueio}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setBloqueio(null)} className="h-9 px-5 rounded-xl text-sm font-semibold bg-secondary hover:bg-secondary/80 transition-colors">Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Plano de Contas — Históricos Estruturados</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sorted.length} entradas · {sorted.filter(h => h.nivel === 3).length} analíticos
          </p>
        </div>
        <Button onClick={abrirNovo} className="rounded-xl gap-1.5 h-9 text-sm bg-gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4" />Novo Histórico
        </Button>
      </div>

      {/* Tabela árvore unificada */}
      <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/40">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground w-28">Código</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">Descrição</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground w-28">Natureza</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground w-24">Nível</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {sorted.map(h => {
                const isGroup = h.nivel < 3;
                return (
                  <tr key={h.id} className={`${isGroup ? "bg-secondary/15" : "hover:bg-secondary/10 transition-colors"}`}>
                    <td className={`px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap ${indentClass(h.nivel)}`}>
                      {h.codigo}
                    </td>
                    <td className={`px-4 py-2.5 ${indentClass(h.nivel)} ${isGroup ? "font-semibold text-sm" : "text-sm text-foreground/80"}`}>
                      {h.descricao}
                      {emUso(h) && <span className="ml-2 text-[10px] text-primary/60 font-normal">● em uso</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${naturezaBadge(h.natureza)}`}>
                        {h.natureza === "RECEITA" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${nivelBadge(h.nivel)}`}>
                        {nivelLabel(h.nivel)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 relative" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setMenuAberto(menuAberto === h.id ? null : h.id)}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      {menuAberto === h.id && (
                        <div className="absolute right-4 top-8 z-20 bg-card border border-border/50 rounded-xl shadow-xl py-1 min-w-[130px] animate-in fade-in zoom-in-95 duration-100">
                          <button onClick={() => abrirEditar(h)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-secondary transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />Editar
                          </button>
                          <button onClick={() => handleExcluir(h)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={Tag} title="Nenhum histórico" desc="Clique em '+ Novo Histórico' para começar." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── MOCK AUDITORIA ────────────────────────────────────────────────
type ModuloAudit = "FINANCEIRO_RECEBER" | "FINANCEIRO_PAGAR" | "FINANCEIRO_FLUXO" | "VENDAS_PDV" | "ESTOQUE" | "AUTENTICACAO" | "CONFIGURACOES";
type StatusAudit = "success" | "failure" | "denied";
interface LogAudit {
  id: string;
  data_hora: string;
  nome_usuario: string;
  acao: string;
  modulo: ModuloAudit;
  recurso_id: string;
  recurso_tipo: string;
  status: StatusAudit;
  ip_origem: string;
  dispositivo: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
}

const MODULOS_AUDIT: ModuloAudit[] = ["FINANCEIRO_RECEBER","FINANCEIRO_PAGAR","FINANCEIRO_FLUXO","VENDAS_PDV","ESTOQUE","AUTENTICACAO","CONFIGURACOES"];
const STATUS_AUDIT: StatusAudit[] = ["success","failure","denied"];

function StatusAuditBadge({ status }: { status: StatusAudit }) {
  const map: Record<StatusAudit, { label: string; cls: string }> = {
    success: { label: "Sucesso",  cls: "bg-emerald-50 text-emerald-700" },
    failure: { label: "Falha",    cls: "bg-rose-50 text-rose-700"     },
    denied:  { label: "Negado",   cls: "bg-amber-50 text-amber-700"   },
  };
  const { label, cls } = map[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

function ModuloBadge({ modulo }: { modulo: ModuloAudit }) {
  const map: Record<ModuloAudit, string> = {
    FINANCEIRO_RECEBER: "bg-emerald-500/10 text-emerald-700",
    FINANCEIRO_PAGAR:   "bg-indigo-500/10 text-indigo-700",
    FINANCEIRO_FLUXO:   "bg-blue-500/10 text-blue-700",
    VENDAS_PDV:         "bg-violet-500/10 text-violet-700",
    ESTOQUE:            "bg-amber-500/10 text-amber-700",
    AUTENTICACAO:       "bg-slate-200 text-slate-700",
    CONFIGURACOES:      "bg-pink-500/10 text-pink-700",
  };
  const label = modulo.replace(/_/g, " ");
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${map[modulo]}`}>{label}</span>;
}

// 7. AUDITORIA
function SecaoAuditoria() {
  const [logs] = useState<LogAudit[]>([]);
  const [filterModulo,  setFilterModulo]  = useState<ModuloAudit | "TODOS">("TODOS");
  const [search,        setSearch]        = useState("");
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [dataInicio,    setDataInicio]     = useState("");
  const [dataFim,       setDataFim]        = useState("");

  const filtered = useMemo(() => logs.filter(l => {
    if (filterModulo !== "TODOS" && l.modulo !== filterModulo) return false;
    if (search && !l.nome_usuario.toLowerCase().includes(search.toLowerCase())
      && !l.acao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [logs, filterModulo, search]);

  const kpis = useMemo(() => ({
    total: logs.length,
  }), [logs]);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 grid place-items-center mb-2">
              <CheckCircle2 className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-xl font-bold tracking-tight">{kpis.total}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Total de Eventos</div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-soft p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Módulo</p>
            <div className="relative">
              <select value={filterModulo} onChange={e => setFilterModulo(e.target.value as ModuloAudit | "TODOS")}
                className="w-full h-10 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
                <option value="TODOS">Todos os Módulos</option>
                {MODULOS_AUDIT.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar usuário ou ação..."
              className="pl-10 h-10 w-full rounded-xl text-sm bg-secondary/40 border-input" />
          </div>
        </div>
      </div>

      {/* AVISO IMUTABILIDADE */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">Logs de auditoria são imutáveis.</span> Esta tabela é append-only por design — nenhum registro pode ser editado ou excluído.
          Um trigger PostgreSQL (<code className="font-mono bg-amber-100 px-1 rounded">trg_audit_logs_imutavel</code>) bloqueia qualquer
          tentativa de UPDATE ou DELETE diretamente no banco, garantindo conformidade e trilha de auditoria interna.
        </p>
      </div>

      {/* TABELA */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <span className="text-sm text-muted-foreground">{filtered.length} de {logs.length} eventos</span>
        </div>
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  {["Quando","Quem","O que","Onde",""].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.length === 0
                  ? <tr><td colSpan={5}><EmptyState icon={CheckCircle2} title="Nenhum evento encontrado" desc="Ajuste os filtros para ver os logs de auditoria." /></td></tr>
                  : filtered.map(l => (
                    <>
                      <tr key={l.id}
                        onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                        className="transition-colors cursor-pointer hover:bg-secondary/20">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{l.data_hora}</td>
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap">{l.nome_usuario}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            {l.acao.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><ModuloBadge modulo={l.modulo} /></td>
                        <td className="px-3 py-2.5 w-10">
                          <button className="p-1 rounded-lg hover:bg-secondary transition-colors">
                            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${expanded === l.id ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                      </tr>
                      {expanded === l.id && (
                        <tr key={`${l.id}-detail`} className="bg-secondary/20">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="space-y-3">
                              {(l.dados_anteriores || l.dados_novos) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {l.dados_anteriores && (
                                    <div className="space-y-2">
                                      <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Antes</p>
                                      <div className="space-y-1">
                                        {Object.entries(l.dados_anteriores).map(([k, v]) => (
                                          <div key={k} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                                            <span className="text-muted-foreground">{k}</span>
                                            <span className="font-mono text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded">{String(v)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {l.dados_novos && (
                                    <div className="space-y-2">
                                      <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Depois</p>
                                      <div className="space-y-1">
                                        {Object.entries(l.dados_novos).map(([k, v]) => (
                                          <div key={k} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                                            <span className="text-muted-foreground">{k}</span>
                                            <span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{String(v)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {(!l.dados_anteriores && !l.dados_novos) && (
                                <p className="text-sm text-muted-foreground italic">Sem alterações de dados para este evento.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// PAGINA PRINCIPAL
function FinancialPage() {
  const [tab, setTab] = useState<FinTab>("dashboard");

  const sections: Record<FinTab, React.ReactElement> = {
    dashboard:     <SecaoDashboard />,
    receber:       <SecaoReceber />,
    pagar:         <SecaoPagar />,
    fluxo:         <SecaoFluxo />,
    movimentacoes: <SecaoMovimentacoes />,
    dre:           <SecaoDre />,
    historicos:    <SecaoHistoricos />,
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de contas, fluxo de caixa e movimentacoes</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 border-b border-border/40">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 transition-colors ${
                active
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="pt-1">{sections[tab]}</div>
    </div>
  );
}