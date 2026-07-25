import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Check, X, AlertTriangle, Plus, Search, RefreshCw, DollarSign, ArrowUpRight, Clock, TrendingUp, ReceiptText, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFinanceiroReceber } from "@/services/api";
import {
  type StatusRec, type ContaReceber, type DateTimeRange, type NaturezaHist,
  DTR_DEFAULT, HISTORICOS, historicoLabel, historicoIndent,
  ActionMenu, EmptyState, KpiCard, fmt, Toast, StatusIconBadge, DateTimeRangeFilter,
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
export function SecaoReceber() {
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
