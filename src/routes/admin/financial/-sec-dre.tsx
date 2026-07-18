import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DreNode, type HistoricoFinanceiro, type LancamentoDRE,
  HISTORICOS, calcularDRE, fmt,
} from "./-fin-shared";

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
export function SecaoDre() {
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
