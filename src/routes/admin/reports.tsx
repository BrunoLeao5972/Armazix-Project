import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Users, Package, DollarSign, MoreHorizontal, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
const MonthlySalesChart = lazy(() => import("@/components/armazix/MonthlySalesChart"));

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [{ title: "Relatórios — ARMAZIX" }],
  }),
});

interface ReportStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageTicket: number;
}

interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

interface ReportsChartData {
  monthlySales: { name: string; vendas: number }[];
}

function ReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [chartData, setChartData] = useState<ReportsChartData>({ monthlySales: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) {
      setLoading(false);
      setError("Loja não encontrada");
      return;
    }
    fetchReportsData(storeId);
  }, []);

  const fetchReportsData = async (storeId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/stats?storeId=${storeId}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Erro ao carregar dados");
        return;
      }

      setStats(data.stats);
      setTopProducts(data.topProducts || []);

      // Fetch chart data
      try {
        const chartRes = await fetch(`/api/dashboard/charts?storeId=${storeId}`);
        const chartResp = await chartRes.json();
        if (chartRes.ok) {
          setChartData({ monthlySales: chartResp.monthlySales || [] });
        }
      } catch {}
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
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
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Análises e métricas da sua loja</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Receita total</span>
            </div>
            <div className="text-xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Pedidos total</span>
            </div>
            <div className="text-xl font-bold">{stats?.totalOrders || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Clientes</span>
            </div>
            <div className="text-xl font-bold">{stats?.totalCustomers || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Ticket médio</span>
            </div>
            <div className="text-xl font-bold">{formatCurrency(stats?.averageTicket || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Evolução mensal</CardTitle>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>}>
              <MonthlySalesChart data={chartData.monthlySales} />
            </Suspense>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Produtos mais vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum produto vendido ainda
              </div>
            ) : topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-primary/15 grid place-items-center text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{p.qty} un</span>
                  <span className="text-sm font-bold">{formatCurrency(p.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
