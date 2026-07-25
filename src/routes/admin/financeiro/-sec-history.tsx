import { useState, useMemo } from "react";
import { Tag, Check, X, Plus, Pencil, Trash2, MoreVertical, Search, ChevronDown, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type NaturezaHist, type HistoricoFinanceiro,
  HISTORICOS, EmptyState, Toast, fmt,
} from "./-fin-shared";

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
                      {h.nivel === 2 ? "  " : ""}{h.codigo} {h.descricao}
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
export function SecaoHistoricos() {
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

// Suppress unused variable warnings for audit helpers that are available for future use
void StatusAuditBadge;
void SecaoAuditoria;
