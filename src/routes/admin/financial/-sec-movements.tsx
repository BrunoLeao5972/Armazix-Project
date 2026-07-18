import { useState, useMemo, useEffect } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getFinanceiroMovimentacoes } from "@/services/api";
import {
  type TipoMov, type Movimentacao, type DateTimeRange,
  DTR_DEFAULT, SearchBar, SelectFilter, DateTimeRangeFilter, EmptyState, parseMovData, fmt,
} from "./-fin-shared";

// 5. MOVIMENTACOES (log somente-leitura)
export function SecaoMovimentacoes() {
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
