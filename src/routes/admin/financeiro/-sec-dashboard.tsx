import { lazy, Suspense, useState, useMemo, useEffect } from "react";
import { DollarSign, ArrowUpRight, ArrowDownRight, Receipt, Undo2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFinanceiroMovimentacoes, getFinanceiroPagar } from "@/services/api";
import { comporSaidas, type ComposicaoSaidas } from "@/lib/financeiro/movimentacoes";
import {
  type DateTimeRange, type Movimentacao, type ContaPagar, type LancamentoDRE,
  DTR_DEFAULT, HISTORICOS, DateTimeRangeFilter, KpiCard, fmt, parseMovData, top5Historicos,
} from "./-fin-shared";

const CashFlowChart = lazy(() => import("@/components/armazix/CashFlowChart"));

// Cores de cada tipo de saída. Os cards "Pagamentos" e "Estornos" no topo usam
// as mesmas cores da legenda do card "Composição das saídas", pra ler como um
// conjunto só.
const COR_PAGAMENTOS = { ponto: "bg-rose-500",  iconBg: "bg-rose-500/15",  icone: "text-rose-600"  };
const COR_ESTORNOS   = { ponto: "bg-amber-500", iconBg: "bg-amber-500/15", icone: "text-amber-600" };

// Fatia de um tipo de saída no total, como texto ("45%", "<1%"); vazio sem saídas.
function pctDasSaidas(valor: number, total: number): string {
  if (total <= 0) return "";
  const pct = (valor / total) * 100;
  return `${valor > 0 && pct < 1 ? "<1" : Math.round(pct)}%`;
}

// Subtítulo dos cards Pagamentos/Estornos: quantidade e fatia nas saídas. Curto
// de propósito — no celular o card tem ~120px de texto e o resto seria cortado.
function detalheSaida(qtd: number, singular: string, plural: string, valor: number, total: number): string {
  const pct = pctDasSaidas(valor, total);
  const qtdTxt = `${qtd} ${qtd === 1 ? singular : plural}`;
  return pct ? `${qtdTxt} · ${pct}` : qtdTxt;
}

// Saídas do período separadas por tipo: o que foi pagamento de conta, o que foi
// estorno de venda (dinheiro devolvido ao cliente) e o resto. A soma é o total de
// saídas que abate do saldo — aqui mostra de onde ele vem.
function ComposicaoSaidasCard({ c }: { c: ComposicaoSaidas }) {
  const itens = [
    { chave: "contas",   label: "Pagamento de contas", valor: c.contasPagas, qtd: c.qtdContasPagas, cor: COR_PAGAMENTOS.ponto },
    { chave: "estornos", label: "Estornos de venda",   valor: c.estornos,    qtd: c.qtdEstornos,    cor: COR_ESTORNOS.ponto },
    { chave: "outras",   label: "Outras saídas",       valor: c.outras,      qtd: c.qtdOutras,      cor: "bg-slate-400" },
  ].filter(i => i.chave !== "outras" || i.valor > 0);

  return (
    <Card className="rounded-xl border-border/50 shadow-soft">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Composição das saídas</p>
          <p className="text-sm font-bold tabular-nums">{fmt(c.total)}</p>
        </div>
        {c.total > 0 && (
          <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
            {itens.map(i => i.valor > 0 && (
              <div key={i.chave} className={i.cor} style={{ width: `${(i.valor / c.total) * 100}%` }} />
            ))}
          </div>
        )}
        <div className={`grid grid-cols-1 gap-2 ${itens.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {itens.map(i => (
            <div key={i.chave} className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${i.cor}`} />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight truncate">
                  {i.label}{i.qtd > 0 ? ` (${i.qtd})` : ""}
                </p>
                <p className="text-sm font-bold tabular-nums leading-tight">
                  {fmt(i.valor)}
                  {c.total > 0 && <span className="text-[11px] font-medium text-muted-foreground"> · {pctDasSaidas(i.valor, c.total)}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// 1. DASHBOARD
export function SecaoDashboard() {
  const [dtr, setDtr] = useState<DateTimeRange>(DTR_DEFAULT);
  const [mov, setMov] = useState<Movimentacao[]>([]);
  const [pag, setPag] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [m, p] = await Promise.all([
          getFinanceiroMovimentacoes().catch(() => []),
          getFinanceiroPagar().catch(() => []),
        ]);
        if (!mounted) return;
        setMov(Array.isArray(m) ? (m as unknown as Movimentacao[]) : []);
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
  const composicaoSaidas = useMemo(() => comporSaidas(movFiltradas), [movFiltradas]);

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

  void loading;

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Período</span>
        <DateTimeRangeFilter value={dtr} onChange={setDtr} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign}   label="Saldo atual"     value={fmt(saldo)}    iconBg="bg-primary/15"     iconColor="text-primary"    highlight />
        <KpiCard icon={ArrowUpRight} label="Entradas do mês" value={fmt(entradas)} iconBg="bg-emerald-500/15" iconColor="text-emerald-600" />
        <KpiCard
          icon={Receipt} label="Pagamentos" value={fmt(composicaoSaidas.contasPagas)}
          iconBg={COR_PAGAMENTOS.iconBg} iconColor={COR_PAGAMENTOS.icone}
          sub={detalheSaida(composicaoSaidas.qtdContasPagas, "conta", "contas", composicaoSaidas.contasPagas, composicaoSaidas.total)}
        />
        <KpiCard
          icon={Undo2} label="Estornos" value={fmt(composicaoSaidas.estornos)}
          iconBg={COR_ESTORNOS.iconBg} iconColor={COR_ESTORNOS.icone}
          sub={detalheSaida(composicaoSaidas.qtdEstornos, "venda", "vendas", composicaoSaidas.estornos, composicaoSaidas.total)}
        />
      </div>

      <ComposicaoSaidasCard c={composicaoSaidas} />

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
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{m.data} - {m.categoria}</span>
                      {m.origem && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          m.origemTipo === "estorno" ? "bg-amber-500/15 text-amber-700"
                            : m.origemTipo === "conta_paga" ? "bg-rose-500/15 text-rose-700"
                            : "bg-secondary text-muted-foreground"
                        }`}>{m.origem}</span>
                      )}
                    </p>
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
