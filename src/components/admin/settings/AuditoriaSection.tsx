import { useMemo, useState } from "react";
import { ChevronDown, Search, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// ─── Auditoria Section ────────────────────────────────────────────
type ModuloAudit = "FINANCEIRO_RECEBER" | "FINANCEIRO_PAGAR" | "FINANCEIRO_FLUXO" | "VENDAS_PDV" | "ESTOQUE" | "AUTENTICACAO" | "CONFIGURACOES";
type StatusAudit = "success" | "failure" | "denied";
interface LogAudit {
  id: string; data_hora: string; nome_usuario: string; acao: string;
  modulo: ModuloAudit; recurso_id: string; recurso_tipo: string;
  status: StatusAudit; ip_origem: string; dispositivo: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
}

const MODULOS_AUDIT: ModuloAudit[] = ["FINANCEIRO_RECEBER","FINANCEIRO_PAGAR","FINANCEIRO_FLUXO","VENDAS_PDV","ESTOQUE","AUTENTICACAO","CONFIGURACOES"];
const STATUS_AUDIT_LIST: StatusAudit[] = ["success","failure","denied"];

function StatusAuditBadge({ status }: { status: StatusAudit }) {
  const map: Record<StatusAudit, { label: string; cls: string }> = {
    success: { label: "Sucesso", cls: "bg-emerald-50 text-emerald-700" },
    failure: { label: "Falha",   cls: "bg-rose-50 text-rose-700"      },
    denied:  { label: "Negado",  cls: "bg-amber-50 text-amber-700"    },
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
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${map[modulo]}`}>{modulo.replace(/_/g, " ")}</span>;
}

export function AuditoriaSection() {
  const [filterModulo, setFilterModulo] = useState<ModuloAudit | "TODOS">("TODOS");
  const [search,       setSearch]       = useState("");
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [dataInicio,   setDataInicio]   = useState("");
  const [dataFim,      setDataFim]      = useState("");

  const filtered = useMemo(() => ([] as LogAudit[]).filter(l => {
    if (filterModulo !== "TODOS" && l.modulo !== filterModulo) return false;
    if (search && !l.nome_usuario.toLowerCase().includes(search.toLowerCase())
      && !l.acao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [filterModulo, search]);

  const kpis = useMemo(() => ({
    total: 0,
  }), []);

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            {/* Módulo */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Módulo</p>
              <div className="relative">
                <select value={filterModulo} onChange={e => setFilterModulo(e.target.value as ModuloAudit | "TODOS")}
                  className="w-full h-9 px-3 pr-8 text-sm rounded-xl bg-secondary/40 border border-input appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
                  <option value="TODOS">Todos os Módulos</option>
                  {MODULOS_AUDIT.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Período */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  className="h-9 w-full rounded-xl text-sm bg-secondary/40 border-input" />
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="h-9 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
            </div>

            {/* Busca */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buscar</p>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Usuário ou ação..."
                  className="pl-10 h-9 w-full rounded-xl text-sm bg-secondary/40 border-input" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso imutabilidade */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">Registros protegidos.</span> Os logs de auditoria não podem ser alterados ou excluídos.
          Isso garante a segurança e integridade do histórico de atividades da sua loja.
        </p>
      </div>

      {/* Tabela */}
      <div>
        <p className="text-sm text-muted-foreground px-1 mb-3">{filtered.length} de {kpis.total} eventos</p>
        <Card className="rounded-2xl border-border/50 overflow-hidden">
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
                  ? <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Nenhum evento encontrado</td></tr>
                  : filtered.map(l => (
                    <>
                      <tr key={l.id} onClick={() => setExpanded(expanded === l.id ? null : l.id)}
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
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${expanded === l.id ? "rotate-180" : ""}`} />
                        </td>
                      </tr>
                      {expanded === l.id && (
                        <tr key={`${l.id}-d`} className="bg-secondary/20">
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
