import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Check, X, AlertTriangle, Plus, Search, RefreshCw, CreditCard, Clock, TrendingUp, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFinanceiroPagar } from "@/services/api";
import {
  type StatusPag, type ContaPagar, type NaturezaHist,
  HISTORICOS, historicoIndent, historicoLabel, ActionMenu, EmptyState, fmt, Toast, StatusIconBadge,
} from "./-fin-shared";

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

function StatusPagBadge({ status }: { status: StatusPag }) {
  return <StatusIconBadge status={status} pulse={status === "vencido"} />;
}

const CENTROS_CUSTO   = ["Todos","Compras","Infraestrutura","Marketing","RH","TI","Admin"];
const FORMAS_PAG      = ["Todas","Boleto","PIX","Transferência","Débito Auto","Cartão","Dinheiro"];
const CONTAS_PAG      = ["Todas","Banco","PIX","Caixa","Cartão","Débito"];
const DTR_PAG_DEFAULT = { dataInicio: "", horaInicio: "00:00", dataFim: "", horaFim: "23:59" };

// 3. CONTAS A PAGAR
export function SecaoPagar() {
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

  void modalAberto;

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
        <Button onClick={() => {}}
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
