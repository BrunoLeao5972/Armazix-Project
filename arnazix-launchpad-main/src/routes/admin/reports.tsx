import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Users, Package, DollarSign, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
const MonthlySalesChart = lazy(() => import("@/components/armazix/MonthlySalesChart"));

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [{ title: "Relatórios — ARMAZIX" }],
  }),
});

const monthlyData = [
  { name: "Jan", vendas: 18500, pedidos: 120 },
  { name: "Fev", vendas: 22000, pedidos: 145 },
  { name: "Mar", vendas: 19800, pedidos: 130 },
  { name: "Abr", vendas: 24500, pedidos: 160 },
  { name: "Mai", vendas: 28450, pedidos: 185 },
  { name: "Jun", vendas: 26000, pedidos: 170 },
];

const topProducts = [
  { name: "Arroz 5kg", qty: 280, revenue: "R$ 6.972" },
  { name: "Feijão 1kg", qty: 195, revenue: "R$ 1.735" },
  { name: "Café 500g", qty: 150, revenue: "R$ 2.835" },
  { name: "Leite 1L", qty: 140, revenue: "R$ 868" },
  { name: "Óleo 900ml", qty: 120, revenue: "R$ 936" },
];

function ReportsPage() {
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
            <div className="text-xl font-bold">R$ 139.250</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Pedidos total</span>
            </div>
            <div className="text-xl font-bold">910</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Clientes</span>
            </div>
            <div className="text-xl font-bold">342</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Ticket médio</span>
            </div>
            <div className="text-xl font-bold">R$ 153,02</div>
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
              <MonthlySalesChart />
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
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-primary/15 grid place-items-center text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{p.qty} un</span>
                  <span className="text-sm font-bold">{p.revenue}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
