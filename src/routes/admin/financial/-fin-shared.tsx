// Shared types, constants, helpers and UI primitives used across financial sections.
// Each section file imports from here — this becomes its own Vite chunk and is
// cached after the first financial page visit.
import { type ElementType, type ReactNode, useState, useMemo, useRef, useEffect } from "react";
import {
  Search, ChevronDown, Check, X, AlertTriangle, Clock,
  RefreshCw, Pencil, Trash2, CheckCircle2, CheckCircle, XCircle, PieChart,
  Calendar, MoreVertical, ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusFin = "pendente" | "pago" | "vencido" | "cancelado" | "parcial";
export type TipoMov = "entrada" | "saida" | "ajuste";

export type StatusRec = "pendente" | "pago" | "vencido" | "cancelado" | "parcial";
export interface ContaReceber {
  id: string; cliente: string; desc: string; documento: string;
  categoria: string; centroCusto: string; contaFinanceira: string;
  valor: number; juros: number; desconto: number; valorRecebido: number;
  formaPgto: string; emissao: string; vencimento: string;
  recebimento: string | null; status: StatusRec;
  origem: string; responsavel: string; obs: string;
  parcelas: number; parcelaAtual: number;
}
export type StatusPag = "pendente" | "pago" | "vencido" | "cancelado" | "parcial";
export interface ContaPagar {
  id: string; fornecedor: string; desc: string; documento: string;
  categoria: string; centroCusto: string; contaFinanceira: string;
  valor: number; juros: number; desconto: number; valorPago: number;
  formaPgto: string; emissao: string; vencimento: string;
  pagamento: string | null; status: StatusPag;
  origem: string; responsavel: string; obs: string;
  parcelas: number; parcelaAtual: number;
}
export interface Movimentacao {
  id: string; tipo: TipoMov; categoria: string;
  valor: number; data: string; origem: string; desc: string; responsavel: string;
}
export interface Categoria {
  id: string; nome: string; tipo: "receita" | "despesa"; cor: string; status: "ativo" | "inativo";
}

export type NaturezaHist = "RECEITA" | "DESPESA";
export interface HistoricoFinanceiro {
  id: string; codigo: string; descricao: string; natureza: NaturezaHist; nivel: number;
}
export interface LancamentoDRE {
  categoria: string; valor: number; tipo: "entrada" | "saida" | "ajuste";
}
export interface DreNode {
  historico: HistoricoFinanceiro; total: number; direto: number;
}
export interface DateTimeRange {
  dataInicio: string; horaInicio: string; dataFim: string; horaFim: string;
}
export interface ResultadoValidacao { permitido: boolean; motivo?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

export const DTR_DEFAULT: DateTimeRange = {
  dataInicio: "", horaInicio: "00:00", dataFim: "", horaFim: "23:59",
};

export const HISTORICOS: HistoricoFinanceiro[] = [
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const fmt = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export const historicoLabel = (h: HistoricoFinanceiro) => `${h.codigo} | ${h.descricao}`;
export const historicoIndent = (h: HistoricoFinanceiro) =>
  h.nivel === 1 ? h.codigo + " " + h.descricao
  : h.nivel === 2 ? "  " + historicoLabel(h)
  : "    " + historicoLabel(h);

export function parseMovData(s: string): number {
  const [datePart = "", timePart = "00:00"] = s.split(" ");
  const [d, m, y] = datePart.split("/");
  return Date.parse(`${y}-${m}-${d}T${timePart}:00`) || 0;
}

export function validarExclusaoConta(status: string, origem: string): ResultadoValidacao {
  if (status === "pago" || status === "efetivado") {
    return {
      permitido: false,
      motivo: "Não é possível excluir uma conta já efetivada. Para fazer alterações, você deve estornar o lançamento primeiro.",
    };
  }
  if (origem === "FRENTE_CAIXA" || origem === "Venda" || origem === "Entrada de Mercadoria") {
    return {
      permitido: false,
      motivo: "Esta conta está vinculada a uma venda realizada no caixa e não pode ser excluída pelo módulo financeiro. A exclusão deve ser feita através do cancelamento da venda original.",
    };
  }
  return { permitido: true };
}

// ─── DRE helpers ─────────────────────────────────────────────────────────────

export function somaAnalitica(desc: string, lancamentos: LancamentoDRE[]): number {
  return lancamentos.filter(l => l.categoria === desc).reduce((s, l) => s + l.valor, 0);
}

export function somaHierarquica(
  h: HistoricoFinanceiro, todos: HistoricoFinanceiro[], lancamentos: LancamentoDRE[],
): number {
  const prefixo = h.nivel === 1 ? h.codigo.replace(".", "") : h.codigo;
  const nos = todos.filter(x => {
    if (x.nivel === 1) return x.id === h.id;
    const c = x.codigo;
    return c === h.codigo || c.startsWith(prefixo + ".");
  });
  return nos.reduce((s, x) => s + somaAnalitica(x.descricao, lancamentos), 0);
}

export function calcularDRE(historicos: HistoricoFinanceiro[], lancamentos: LancamentoDRE[]): DreNode[] {
  return historicos
    .slice()
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
    .map(h => ({
      historico: h,
      total: somaHierarquica(h, historicos, lancamentos),
      direto: somaAnalitica(h.descricao, lancamentos),
    }));
}

export function top5Historicos(historicos: HistoricoFinanceiro[], lancamentos: LancamentoDRE[]) {
  const analiticos = historicos.filter(h => h.nivel === 3);
  const calculo = analiticos.map(h => ({
    descricao: h.descricao, codigo: h.codigo, natureza: h.natureza,
    total: somaAnalitica(h.descricao, lancamentos),
  }));
  const despesas = calculo.filter(x => x.natureza === "DESPESA" && x.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const receitas = calculo.filter(x => x.natureza === "RECEITA" && x.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  return { despesas, receitas };
}

// ─── Base UI components ───────────────────────────────────────────────────────

export function KpiCard({ icon: Icon, label, value, sub, iconBg, iconColor, highlight }: {
  icon: ElementType; label: string; value: string; sub?: string;
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

export function StatusBadge({ status }: { status: StatusFin }) {
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

export function StatusIconBadge({ status, pulse = false }: { status: StatusRec | StatusPag; pulse?: boolean }) {
  const MAP: Record<string, { label: string; icon: ReactNode; wrap: string }> = {
    pendente:  { label: "Situação: Pendente",  wrap: "bg-amber-50 border border-amber-100",    icon: <Clock        className="w-3.5 h-3.5 text-amber-500" /> },
    pago:      { label: "Situação: Pago",      wrap: "bg-emerald-50 border border-emerald-100",icon: <CheckCircle  className="w-3.5 h-3.5 text-emerald-500" /> },
    vencido:   { label: "Situação: Vencido",   wrap: "bg-rose-50 border border-rose-100",      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> },
    cancelado: { label: "Situação: Cancelado", wrap: "bg-slate-100 border border-slate-200",   icon: <XCircle      className="w-3.5 h-3.5 text-slate-400" /> },
    parcial:   { label: "Situação: Parcial",   wrap: "bg-blue-50 border border-blue-100",      icon: <PieChart     className="w-3.5 h-3.5 text-blue-500" /> },
  };
  const entry = MAP[status] ?? MAP["pendente"];
  return (
    <span title={entry.label}
      className={`inline-grid place-items-center w-7 h-7 rounded-full ${entry.wrap} ${pulse ? "animate-pulse" : ""}`}>
      {entry.icon}
    </span>
  );
}

export function SelectFilter({ value, onChange, options }: {
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

export function SearchBar({ value, onChange, placeholder = "Buscar..." }: {
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

export function EmptyState({ icon: Icon, title, desc }: { icon: ElementType; title: string; desc: string }) {
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

export function DateTimeRangeFilter({ value, onChange }: {
  value: DateTimeRange; onChange: (v: DateTimeRange) => void;
}) {
  const set = (k: keyof DateTimeRange, v: string) => onChange({ ...value, [k]: v });
  const hasFilter = value.dataInicio || value.dataFim;

  const CapsuleInput = ({
    label, dateVal, timeVal, onDateChange, onTimeChange,
  }: {
    label: string; dateVal: string; timeVal: string;
    onDateChange: (v: string) => void; onTimeChange: (v: string) => void;
  }) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</span>
      <div className="flex items-center bg-secondary/50 border border-border/50 rounded-xl px-2 h-10 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input type="date" value={dateVal} onChange={e => onDateChange(e.target.value)}
          className="bg-transparent border-none outline-none text-xs text-foreground w-28 mx-1.5 cursor-pointer" />
        <div className="w-px h-4 bg-border/60 shrink-0" />
        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1.5" />
        <input type="time" value={timeVal} onChange={e => onTimeChange(e.target.value)}
          className="bg-transparent border-none outline-none text-xs text-foreground w-16 ml-1 cursor-pointer" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <CapsuleInput label="De" dateVal={value.dataInicio} timeVal={value.horaInicio}
        onDateChange={v => set("dataInicio", v)} onTimeChange={v => set("horaInicio", v)} />
      <div className="pb-1 text-muted-foreground/50 text-xs self-end mb-2.5">→</div>
      <CapsuleInput label="Até" dateVal={value.dataFim} timeVal={value.horaFim}
        onDateChange={v => set("dataFim", v)} onTimeChange={v => set("horaFim", v)} />
      {hasFilter && (
        <button onClick={() => onChange(DTR_DEFAULT)}
          className="self-end mb-0.5 h-10 px-3 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive flex items-center gap-1.5 border border-border/40 hover:border-destructive/30 bg-secondary/30 hover:bg-destructive/5 transition-all">
          <X className="w-3 h-3" />Limpar
        </button>
      )}
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm font-medium">
      <CheckCircle2 className="w-4 h-4 shrink-0" />{msg}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

export function ModalBloqueio({ motivo, onClose }: { motivo: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
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
          <button onClick={onClose} className="h-9 px-5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">Entendido</button>
        </div>
      </div>
    </div>
  );
}

export function ModalConfirmacao({ titulo, descricao, onConfirm, onClose }: {
  titulo: string; descricao: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
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
          <button onClick={onClose} className="h-9 px-4 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">Cancelar</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="h-9 px-4 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors">Excluir</button>
        </div>
      </div>
    </div>
  );
}

export interface ActionMenuProps {
  status: string; origem: string;
  onEfetivar?: () => void; onEditar: () => void; onExcluir: () => void;
}

export function ActionMenu({ status, origem, onEfetivar, onEditar, onExcluir }: ActionMenuProps) {
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
    if (!resultado.permitido) setBloqueio(resultado.motivo!);
    else setConfirmacao(true);
  };

  const podeEfetivar = status === "pendente" || status === "parcial" || status === "EM_ABERTO";

  return (
    <>
      <div ref={ref} className="relative">
        <button onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-white border border-slate-100 rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-100">
            <button onClick={e => { e.stopPropagation(); setOpen(false); onEditar(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Pencil className="w-3.5 h-3.5 text-slate-400" />Editar
            </button>
            {podeEfetivar && onEfetivar && (
              <button onClick={e => { e.stopPropagation(); setOpen(false); onEfetivar(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors">
                <Check className="w-3.5 h-3.5 text-emerald-500" />Efetivar
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button onClick={e => { e.stopPropagation(); handleExcluirClick(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />Excluir
            </button>
          </div>
        )}
      </div>
      {bloqueio && <ModalBloqueio motivo={bloqueio} onClose={() => setBloqueio(null)} />}
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

