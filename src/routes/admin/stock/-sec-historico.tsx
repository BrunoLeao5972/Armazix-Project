import { useEffect, useState } from "react";
import { Search, Download, Loader2, History, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { EmptyState, MovTypeBadge, MOV_TYPE_CONFIG, type DbMovement } from "./-stock-shared";

export function SecaoHistorico() {
  const [search, setSearch] = useState("");
  const [movements, setMovements] = useState<DbMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMovements = () => {
    setLoading(true);
    api.get("/api/stock/movements?limit=200")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => setMovements(d.movements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchMovements, []);

  const filtered = movements.filter(m =>
    m.productName.toLowerCase().includes(search.toLowerCase()) ||
    (m.createdByName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    m.origem.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por produto ou usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5"><Download className="w-3.5 h-3.5" />Exportar log</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />Carregando movimentações...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title="Sem registros" desc="Nenhuma movimentação de estoque registrada ainda." />
      ) : (
        <div className="relative pl-6 space-y-0 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
          {filtered.map(m => {
            // DB usa uppercase (ENTRADA, VENDA, AJUSTE); config usa lowercase
            const typeKey = m.type.toLowerCase();
            const cfg = MOV_TYPE_CONFIG[typeKey] ?? MOV_TYPE_CONFIG[
              typeKey === "venda" ? "saida" : typeKey === "perda" || typeKey === "avaria" ? "perda" : "ajuste"
            ] ?? { label: m.type, color: "text-foreground", bg: "bg-secondary", icon: Activity };
            const Icon    = cfg.icon;
            // Entradas aumentam estoque; vendas/saídas/perdas reduzem
            const isPositive = ["entrada", "ENTRADA"].includes(m.type) || m.balanceAfter > m.balanceBefore;
            const displayQty = isPositive ? `+${m.quantity}` : `-${m.quantity}`;
            const fmtDate = new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

            return (
              <div key={m.id} className="relative pb-5">
                <div className={`absolute -left-[19px] w-4 h-4 rounded-full ${cfg.bg} border-2 border-background flex items-center justify-center`}>
                  <Icon className={`w-2 h-2 ${cfg.color}`} />
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{m.productName}</span>
                    <MovTypeBadge type={typeKey} />
                    <span className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
                      {displayQty} un
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate}</span>
                    {m.createdByName && <span>Por {m.createdByName}</span>}
                    <span className="text-muted-foreground/70">{m.origem}</span>
                    <span>Saldo: {m.balanceBefore} → {m.balanceAfter}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
