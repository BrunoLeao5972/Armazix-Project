import { useEffect, useState } from "react";
import { Search, Download, FileText, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { EmptyState, MovTypeBadge, MOV_TYPE_CONFIG, fmtDate, dbTypeToKey, type Movement, type DbMovement } from "./-estoque-shared";

// ─── SEÇÃO: EXTRATO ───────────────────────────────────────────────
export function SecaoExtrato() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [movements, setMovements] = useState<Movement[]>([]);
  useEffect(() => {
    let mounted = true;
    api.get("/api/stock/movements?limit=500")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => {
        if (!mounted) return;
        setMovements(
          (d.movements ?? []).map(m => ({
            id:            m.id,
            date:          fmtDate(m.createdAt),
            product:       m.productName,
            type:          dbTypeToKey(m.type),
            qty:           m.quantity,
            balanceBefore: m.balanceBefore,
            balanceAfter:  m.balanceAfter,
            user:          m.createdByName ?? "—",
            note:          m.origem,
          }))
        );
      })
      .catch(() => { if (mounted) setMovements([]); });
    return () => { mounted = false; };
  }, []);

  const filtered = movements.filter(m => {
    const matchSearch = m.product.toLowerCase().includes(search.toLowerCase()) || m.note.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "todos" || m.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar produto" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["todos", "entrada", "saida", "ajuste", "transferencia", "perda"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filterType === t ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {t === "todos" ? "Todos" : MOV_TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
          <Button variant="outline" size="sm" className="rounded-xl h-8 gap-1.5"><Download className="w-3.5 h-3.5" />Exportar</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma movimentação" desc="Sem resultados para os filtros selecionados." />
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const cfg = MOV_TYPE_CONFIG[m.type] ?? { label: m.type, color: "text-foreground", bg: "bg-secondary", icon: Activity };
            const Icon = cfg.icon;
            const positive = m.qty > 0;
            return (
              <Card key={m.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{m.product}</span>
                        <MovTypeBadge type={m.type} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>Por {m.user}</span>
                        {m.note && <span className="truncate">{m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold text-base ${positive ? "text-emerald-600" : "text-destructive"}`}>
                        {positive ? "+" : ""}{m.qty} un
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.balanceBefore} → {m.balanceAfter}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
