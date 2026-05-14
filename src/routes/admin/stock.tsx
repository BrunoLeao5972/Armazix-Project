import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
const StockMovementChart = lazy(() => import("@/components/armazix/StockMovementChart"));

export const Route = createFileRoute("/admin/stock")({
  component: StockPage,
  head: () => ({
    meta: [{ title: "Estoque — ARMAZIX" }],
  }),
});

interface StockStats {
  totalStock: number;
  weeklyIn: number;
  weeklyOut: number;
  lowStockCount: number;
}

interface StockMovement {
  id: string;
  product: string;
  type: "entrada" | "saida" | "perda";
  qty: number;
  date: string;
}

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
}

interface StockChartData {
  stockMovement: { name: string; entrada: number; saida: number }[];
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  entrada: { label: "Entrada", icon: ArrowUpCircle, color: "text-primary", bgColor: "bg-primary/15" },
  saida: { label: "Saída", icon: ArrowDownCircle, color: "text-blue-600", bgColor: "bg-blue-500/15" },
  perda: { label: "Perda", icon: AlertTriangle, color: "text-amber-600", bgColor: "bg-amber-500/15" },
};

function StockPage() {
  const [stats, setStats] = useState<StockStats | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [chartData, setChartData] = useState<StockChartData>({ stockMovement: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) {
      setLoading(false);
      setError("Loja não encontrada");
      return;
    }
    fetchStockData(storeId);
  }, []);

  const fetchStockData = async (storeId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/stock/stats?storeId=${storeId}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Erro ao carregar dados");
        return;
      }

      setStats(data.stats);
      setMovements(data.movements || []);
      setLowStock(data.lowStock || []);

      // Fetch chart data
      try {
        const chartRes = await fetch(`/api/dashboard/charts?storeId=${storeId}`);
        const chartResp = await chartRes.json();
        if (chartRes.ok) {
          setChartData({ stockMovement: chartResp.stockMovement || [] });
        }
      } catch {}
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle de entradas, saídas e alertas
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/15">
                <Package className="w-4 h-4 text-primary" />
              </span>
            </div>
            <div className="text-2xl font-bold">{stats?.totalStock || 0}</div>
            <div className="text-xs text-muted-foreground">Total em estoque</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/15">
                <TrendingUp className="w-4 h-4 text-primary" />
              </span>
            </div>
            <div className="text-2xl font-bold">{stats?.weeklyIn || 0}</div>
            <div className="text-xs text-muted-foreground">Entradas na semana</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-blue-500/15">
                <TrendingDown className="w-4 h-4 text-blue-600" />
              </span>
            </div>
            <div className="text-2xl font-bold">{stats?.weeklyOut || 0}</div>
            <div className="text-xs text-muted-foreground">Saídas na semana</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-amber-500/15">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </span>
            </div>
            <div className="text-2xl font-bold">{stats?.lowStockCount || 0}</div>
            <div className="text-xs text-muted-foreground">Itens em alerta</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Movimentações da semana</CardTitle>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>}>
              <StockMovementChart data={chartData.stockMovement} />
            </Suspense>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Movements */}
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Movimentações recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {movements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma movimentação recente
                </div>
              ) : movements.map((m) => {
                const cfg = typeConfig[m.type];
                const Icon = cfg.icon;
                return (
                  <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`grid place-items-center w-8 h-8 rounded-lg ${cfg.bgColor}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </span>
                      <div>
                        <div className="text-sm font-medium">{m.product}</div>
                        <div className="text-xs text-muted-foreground">{m.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className={`rounded-full text-[11px] ${cfg.bgColor} ${cfg.color}`}>
                        {cfg.label} • {m.qty} un
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alertas de estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStock.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum item com estoque baixo
                </div>
              ) : lowStock.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className={`text-xs font-bold ${item.stock === 0 ? "text-destructive" : "text-amber-600"}`}>
                      {item.stock === 0 ? "Sem estoque" : `${item.stock}/${item.minStock}`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.stock === 0 ? "bg-destructive" : item.stock < item.minStock * 0.5 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min((item.stock / item.minStock) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
