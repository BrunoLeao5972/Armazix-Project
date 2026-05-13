import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const RevenueChart = lazy(() => import("@/components/armazix/RevenueChart"));
const OrdersChart = lazy(() => import("@/components/armazix/OrdersChart"));

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — ARMAZIX" }],
  }),
});

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  productsCount: number;
  lowStockProducts: number;
  customersCount: number;
  averageTicket: number;
}

interface RecentOrder {
  id: string;
  customer: string;
  total: string;
  status: string;
  time: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  received: { label: "Novo", color: "bg-blue-500/15 text-blue-600" },
  preparing: { label: "Preparando", color: "bg-amber-500/15 text-amber-600" },
  ready: { label: "Pronto", color: "bg-indigo-500/15 text-indigo-600" },
  delivering: { label: "Em entrega", color: "bg-purple-500/15 text-purple-600" },
  delivered: { label: "Entregue", color: "bg-primary/15 text-primary" },
  cancelled: { label: "Cancelado", color: "bg-destructive/15 text-destructive" },
};

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Get store ID from localStorage or session
    const storeId = localStorage.getItem("storeId");
    if (!storeId) {
      setLoading(false);
      setError("Loja não encontrada");
      return;
    }

    fetchDashboardData(storeId);
  }, []);

  const fetchDashboardData = async (storeId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard/stats?storeId=${storeId}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Erro ao carregar dados");
        return;
      }

      setStats(data.stats);
      setRecentOrders(data.recentOrders?.map((o: any) => ({
        id: `#${o.number || o.id.slice(-4)}`,
        customer: o.customer?.name || "Cliente",
        total: `R$ ${parseFloat(o.total).toFixed(2).replace(".", ",")}`,
        status: o.status,
        time: new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      })) || []);
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
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
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados da sua loja
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard title="Faturamento" value={formatCurrency(stats?.revenue || 0)} change="" up icon={DollarSign} />
        <KpiCard title="Pedidos" value={String(stats?.totalOrders || 0)} change="" up icon={ShoppingCart} />
        <KpiCard title="Pendentes" value={String(stats?.pendingOrders || 0)} change="" up icon={TrendingUp} />
        <KpiCard title="Concluídos" value={String(stats?.completedOrders || 0)} change="" up icon={Package} />
        <KpiCard title="Clientes" value={String(stats?.customersCount || 0)} change="" up icon={Package} />
        <KpiCard title="Estoque baixo" value={String(stats?.lowStockProducts || 0)} change="" up={false} icon={AlertTriangle} alert />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Receita semanal</CardTitle>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>}>
                  <RevenueChart />
                </Suspense>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Pedidos semanal</CardTitle>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>}>
                  <OrdersChart />
                </Suspense>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
      <div>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Pedidos recentes</CardTitle>
              <Button variant="outline" size="sm" className="rounded-xl text-xs">
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{order.id}</span>
                    <span className="text-sm text-muted-foreground">{order.customer}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{order.total}</span>
                    <Badge
                      variant="secondary"
                      className={`rounded-full text-[11px] font-medium ${statusConfig[order.status]?.color}`}
                    >
                      {statusConfig[order.status]?.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{order.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  change,
  up,
  icon: Icon,
  alert,
}: {
  title: string;
  value: string;
  change: string;
  up: boolean;
  icon: React.ElementType;
  alert?: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary text-muted-foreground">
            <Icon className={`w-4.5 h-4.5 ${alert ? "text-amber-500" : ""}`} />
          </span>
          {change && (
            <span
              className={`flex items-center gap-0.5 text-xs font-semibold ${
                up ? "text-primary" : "text-destructive"
              }`}
            >
              {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {change}
            </span>
          )}
        </div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{title}</div>
      </CardContent>
    </Card>
  );
}
