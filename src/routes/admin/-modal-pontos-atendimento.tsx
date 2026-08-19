import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  X, Plus, Pencil, CreditCard, Loader2, Layers,
  AlertCircle, CheckCircle2, User, ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { MesaTableIcon } from "./-icon-mesa";

// ─── Tipos ───────────────────────────────────────────────────────
export type ServicePointType = "MESA" | "CARTAO";
export interface ServicePoint {
  id: string;
  storeId: string;
  nameOrNumber: string;
  type: ServicePointType;
  isActive: boolean;
  createdAt: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
}

interface Customer { id: string; name: string; phone: string | null }

const TYPE_LABEL: Record<ServicePointType, string> = { MESA: "Mesa", CARTAO: "Comanda/Cartão" };
// Nome é sempre gerado automaticamente — "Mesa" ou "Cartão" + número.
const TYPE_BASE:  Record<ServicePointType, string> = { MESA: "Mesa", CARTAO: "Cartão" };
const TYPE_ICON  = { MESA: MesaTableIcon, CARTAO: CreditCard };

// Sort natural — "Mesa 2" antes de "Mesa 10", em vez de ordem alfabética pura.
const naturalSort = (a: ServicePoint, b: ServicePoint) =>
  a.nameOrNumber.localeCompare(b.nameOrNumber, "pt-BR", { numeric: true });

// Próximo número livre pra um tipo — espelha a mesma lógica do servidor
// (maior número já usado, ativo ou inativo, + 1), só pra preview na hora.
function nextNumberFor(points: ServicePoint[], type: ServicePointType): number {
  const base = TYPE_BASE[type];
  const re = new RegExp(`^${base}\\s*(\\d+)$`, "i");
  let max = 0;
  for (const p of points) {
    if (p.type !== type) continue;
    const m = p.nameOrNumber.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

// "Mesa 01", "Cartão 02"... — espelha o zero-padding de 2 dígitos aplicado
// no servidor (service-points-handler.ts).
function formatPointName(type: ServicePointType, n: number): string {
  return `${TYPE_BASE[type]} ${String(n).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────
// Modal compacto de gerenciamento — mesmo padrão visual do cadastro de
// produtos/cupons/sessões de caixa (janela centralizada, não tela cheia).
// ─────────────────────────────────────────────────────────────────
export function ModalPontosAtendimento({ onClose }: { onClose: () => void }) {
  const [points, setPoints]   = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"all" | "MESA" | "CARTAO">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePoint | null>(null);
  const [toast, setToast]     = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const fetchPoints = useCallback(async () => {
    try {
      const res  = await fetch("/api/service-points/list");
      const data = await res.json() as { servicePoints?: ServicePoint[] };
      setPoints((data.servicePoints || []).slice().sort(naturalSort));
    } catch { showToast("Erro ao carregar pontos de atendimento", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);

  const filtered = useMemo(
    () => tab === "all" ? points : points.filter(p => p.type === tab),
    [points, tab],
  );
  const counts = useMemo(() => ({
    all:    points.length,
    MESA:   points.filter(p => p.type === "MESA").length,
    CARTAO: points.filter(p => p.type === "CARTAO").length,
  }), [points]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (p: ServicePoint) => { setEditing(p); setFormOpen(true); };

  const handleToggleActive = async (p: ServicePoint) => {
    // Otimista — precisa responder na hora, sem esperar round-trip.
    setPoints(prev => prev.map(x => x.id === p.id ? { ...x, isActive: !x.isActive } : x));
    try {
      const res  = await api.post("/api/service-points/update", { id: p.id, isActive: !p.isActive });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setPoints(prev => prev.map(x => x.id === p.id ? { ...x, isActive: p.isActive } : x));
        showToast(data.error || "Erro ao atualizar status", "error");
      }
    } catch {
      setPoints(prev => prev.map(x => x.id === p.id ? { ...x, isActive: p.isActive } : x));
      showToast("Erro de conexão", "error");
    }
  };

  // Recarrega a lista inteira em vez de tentar reconciliar localmente — o
  // create/update não faz join com customers no retorno, então o nome do
  // cliente atrelado (inclusive o Cliente Padrão automático) só vem certo
  // buscando de novo do /list.
  const handleSaved = (count: number) => {
    fetchPoints();
    setFormOpen(false);
    showToast(count > 1 ? `${count} pontos criados!` : "Salvo com sucesso!", "success");
  };

  const TABS: { id: "all" | "MESA" | "CARTAO"; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "MESA", label: "Mesas" },
    { id: "CARTAO", label: "Comandas/Cartões" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Layers className="w-4 h-4 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-bold text-foreground flex-1">Pontos de Atendimento</h3>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors">
            <Plus className="w-3.5 h-3.5" />Novo
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-border shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === t.id
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
              <span className={`text-[10px] font-bold rounded-full px-1.5 ${tab === t.id ? "bg-white/25" : "bg-card"}`}>
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-5">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                <MesaTableIcon className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-muted-foreground text-sm">Nenhum ponto de atendimento cadastrado</p>
                <p className="text-xs text-muted-foreground mt-1">Crie mesas ou comandas/cartões pra organizar o atendimento</p>
              </div>
              <button onClick={openCreate}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors">
                <Plus className="w-3.5 h-3.5" />Cadastrar agora
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(p => {
                const Icon = TYPE_ICON[p.type];
                return (
                  <div key={p.id} className={`flex items-center gap-3 px-5 py-3 ${!p.isActive ? "opacity-50" : ""}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      p.type === "MESA" ? "bg-blue-500/10 text-blue-600" : "bg-violet-500/10 text-violet-600"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.nameOrNumber}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                          p.type === "MESA" ? "bg-blue-500/10 text-blue-600" : "bg-violet-500/10 text-violet-600"
                        }`}>
                          {TYPE_LABEL[p.type]}
                        </span>
                        {p.customerName && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                            <User className="w-3 h-3 shrink-0" />{p.customerName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold shrink-0 ${p.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {p.isActive ? "Ativo" : "Inativo"}
                    </span>
                    <button
                      type="button" role="switch" aria-checked={p.isActive}
                      onClick={() => handleToggleActive(p)}
                      className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${
                        p.isActive ? "bg-emerald-500" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                        p.isActive ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                    <button onClick={() => openEdit(p)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <ModalCadastroPonto
          editing={editing}
          points={points}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Combobox de cliente — seleção obrigatória de um cliente já cadastrado,
// nunca texto livre. Mesmo padrão de SupplierCombobox.tsx (busca
// debounced, dropdown, clear button), só que contra /api/customers/search.
// ─────────────────────────────────────────────────────────────────
function CustomerCombobox({ value, onChange }: { value: Customer | null; onChange: (v: Customer | null) => void }) {
  const [query, setQuery]     = useState(value?.name ?? "");
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const qs  = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/customers/search${qs}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { customers: Customer[] };
        setResults(data.customers || []);
      }
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 280);
  };

  const handleFocus = () => {
    setOpen(true);
    if (results.length === 0) search(query);
  };

  const handleSelect = (c: Customer) => {
    onChange(c);
    setQuery(c.name);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!value) setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  useEffect(() => {
    setQuery(value ? value.name : "");
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center h-11 rounded-xl border border-input bg-background px-3 gap-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-shadow">
        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          placeholder="Buscar cliente cadastrado..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />}
        {value && !loading && (
          <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!value && !loading && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-md overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              {loading ? "Buscando..." : query ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
              {results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(c); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/60 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium truncate">{c.name}</span>
                  {c.phone && <span className="text-xs text-muted-foreground shrink-0">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal: Cadastrar/Editar (individual) + aba "Em Lote" pra criar sequência
// ─────────────────────────────────────────────────────────────────
function ModalCadastroPonto({
  editing, points, onClose, onSaved,
}: {
  editing: ServicePoint | null;
  points: ServicePoint[];
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const isEditing = !!editing;
  const [mode, setMode] = useState<"single" | "batch">("single");

  // ── Individual ──
  const [type, setType]         = useState<ServicePointType>(editing?.type ?? "MESA");
  const [customer, setCustomer] = useState<Customer | null>(
    editing?.customerId ? { id: editing.customerId, name: editing.customerName ?? "", phone: editing.customerPhone } : null,
  );
  const [active, setActive]     = useState(editing?.isActive ?? true);

  // Nome sempre gerado automaticamente — nunca digitado.
  const previewName = isEditing ? editing!.nameOrNumber : formatPointName(type, nextNumberFor(points, type));

  // ── Em lote ──
  const [batchType, setBatchType]         = useState<ServicePointType>("MESA");
  const [batchQuantity, setBatchQuantity] = useState("10");

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleSaveSingle = async () => {
    setError(""); setSaving(true);
    try {
      const res = isEditing
        ? await api.post("/api/service-points/update", { id: editing!.id, customerId: customer?.id ?? null, isActive: active })
        : await api.post("/api/service-points/create", { type, customerId: customer?.id ?? null, isActive: active });
      const data = await res.json() as { success?: boolean; servicePoint?: ServicePoint; error?: string };
      if (!res.ok || !data.success || !data.servicePoint) {
        setError(data.error || "Erro ao salvar");
        return;
      }
      onSaved(1);
    } catch { setError("Erro de conexão"); }
    finally { setSaving(false); }
  };

  const handleBatchCreate = async () => {
    const quantity = Number(batchQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Informe uma quantidade válida (mínimo 1)");
      return;
    }
    setError(""); setSaving(true);
    try {
      const res  = await api.post("/api/service-points/batch-create", { type: batchType, quantity });
      const data = await res.json() as { success?: boolean; created?: ServicePoint[]; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao gerar em lote");
        return;
      }
      if (data.created?.length) onSaved(data.created.length);
    } catch { setError("Erro de conexão"); }
    finally { setSaving(false); }
  };

  const batchStart = nextNumberFor(points, batchType);
  const previewCount = (() => {
    const q = Number(batchQuantity);
    return Number.isInteger(q) && q > 0 ? q : 0;
  })();

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-bold text-foreground">
            {isEditing ? "Editar Ponto de Atendimento" : "Cadastrar Ponto de Atendimento"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs Individual/Lote — só faz sentido pra cadastro novo */}
        {!isEditing && (
          <div className="flex gap-1 mx-5 mt-4 p-1 bg-secondary rounded-xl shrink-0">
            {(["single", "batch"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {m === "single" ? "Individual" : "Cadastrar em Lote"}
              </button>
            ))}
          </div>
        )}

        <div className="p-5 space-y-4 overflow-y-auto">
          {(isEditing || mode === "single") ? (
            <>
              {isEditing ? (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Identificação</p>
                  <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-border bg-secondary/40 text-sm font-semibold text-foreground">
                    {(() => { const Icon = TYPE_ICON[editing!.type]; return <Icon className="w-4 h-4 text-muted-foreground shrink-0" />; })()}
                    {previewName}
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{TYPE_LABEL[editing!.type]}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tipo</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["MESA", "CARTAO"] as const).map(t => (
                        <button key={t} onClick={() => setType(t)}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold border transition-all ${
                            type === t
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100"
                              : "bg-card text-muted-foreground border-border hover:border-emerald-300"
                          }`}>
                          {t === "MESA" ? <MesaTableIcon className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                          {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Identificação</p>
                    <div className="flex items-center h-11 px-3.5 rounded-xl border border-dashed border-border bg-secondary/40 text-sm font-semibold text-foreground">
                      {previewName}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Gerado automaticamente — não pode ser editado</p>
                  </div>
                </>
              )}

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Cliente</p>
                <CustomerCombobox value={customer} onChange={setCustomer} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {customer ? "Substitui o Cliente Padrão enquanto atrelado" : "Sem seleção, fica com o Cliente Padrão"}
                </p>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/40">
                <div>
                  <p className="text-sm font-medium text-foreground">Ativo</p>
                  <p className="text-xs text-muted-foreground">Disponível pra uso no PDV</p>
                </div>
                <button type="button" role="switch" aria-checked={active} onClick={() => setActive(!active)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                    active ? "bg-primary" : "bg-muted-foreground/30"
                  }`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    active ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tipo</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["MESA", "CARTAO"] as const).map(t => (
                    <button key={t} onClick={() => setBatchType(t)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold border transition-all ${
                        batchType === t
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100"
                          : "bg-card text-muted-foreground border-border hover:border-emerald-300"
                      }`}>
                      {t === "MESA" ? <MesaTableIcon className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Quantidade</p>
                <Input type="number" min={1} value={batchQuantity} onChange={e => setBatchQuantity(e.target.value)} className="h-11 rounded-xl" autoFocus />
              </div>

              {previewCount > 0 && (
                <p className="text-xs text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2">
                  Vai criar <strong className="text-foreground">{previewCount}</strong> pontos: de{" "}
                  <span className="font-mono">{formatPointName(batchType, batchStart)}</span> até{" "}
                  <span className="font-mono">{formatPointName(batchType, batchStart + previewCount - 1)}</span>
                </p>
              )}
            </>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
        </div>

        <div className="px-5 pb-5 shrink-0">
          <button
            onClick={(isEditing || mode === "single") ? handleSaveSingle : handleBatchCreate}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-100"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : (isEditing || mode === "single") ? "Salvar" : `Gerar ${previewCount || ""} pontos`}
          </button>
        </div>
      </div>
    </div>
  );
}
