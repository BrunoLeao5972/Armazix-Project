import { useState, useMemo } from "react";
import {
  useFluxoCaixa,
  type NaturezaLancamento,
  type StatusLancamento,
  type LancamentoFinanceiro,
  agruparComTotais,
  calcularTotais,
} from "@/lib/financial/useFluxoCaixa";
import { ChevronDown, Search, X, RefreshCw, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmt, EmptyState } from "./-fin-shared";

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
export function SecaoFluxo() {
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
