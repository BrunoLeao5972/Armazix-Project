import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — ARMAZIX" }],
  }),
});

const revenueData = [
  { name: "Seg", valor: 1200 },
  { name: "Ter", valor: 1800 },
  { name: "Qua", valor: 1400 },
  { name: "Qui", valor: 2200 },
  { name: "Sex", valor: 2800 },
  { name: "Sáb", valor: 3200 },
  { name: "Dom", valor: 1900 },
];

const ordersData = [
  { name: "Seg", pedidos: 18 },
  { name: "Ter", pedidos: 25 },
  { name: "Qua", pedidos: 20 },
  { name: "Qui", pedidos: 32 },
  { name: "Sex", pedidos: 38 },
  { name: "Sáb", pedidos: 45 },
  { name: "Dom", pedidos: 28 },
];

const recentOrders = [
  { id: "#3208", customer: "Maria Silva", total: "R$ 189,90", status: "novo", time: "2 min" },
  { id: "#3207", customer: "João Santos", total: "R$ 342,50", status: "preparando", time: "15 min" },
  { id: "#3206", customer: "Ana Costa", total: "R$ 78,00", status: "saiu_entrega", time: "32 min" },
  { id: "#3205", customer: "Pedro Lima", total: "R$ 456,00", status: "concluido", time: "1h" },
  { id: "#3204", customer: "Lucia Ferreira", total: "R$ 124,90", status: "concluido", time: "2h" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-500/15 text-blue-600" },
  preparando: { label: "Preparando", color: "bg-amber-500/15 text-amber-600" },
  saiu_entrega: { label: "Saiu p/ entrega", color: "bg-purple-500/15 text-purple-600" },
  concluido: { label: "Concluído", color: "bg-primary/15 text-primary" },
  cancelado: { label: "Cancelado", color: "bg-destructive/15 text-destructive" },
};

function DashboardPage() {
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da sua loja hoje
        </p>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          title="Vendas do dia"
          value="R$ 4.280"
          change="+12%"
          up
          icon={DollarSign}
        />
        <KpiCard
          title="Faturamento"
          value="R$ 28.450"
          change="+8%"
          up
          icon={TrendingUp}
        />
        <KpiCard
          title="Pedidos"
          value="47"
          change="+5%"
          up
          icon={ShoppingCart}
        />
        <KpiCard
          title="Ticket médio"
          value="R$ 91,06"
          change="-2%"
          up={false}
          icon={Package}
        />
        <KpiCard
          title="Produtos vendidos"
          value="128"
          change="+15%"
          up
          icon={Package}
        />
        <KpiCard
          title="Estoque baixo"
          value="8"
          change=""
          up={false}
          icon={AlertTriangle}
          alert
        />
      </motion.div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div variants={item}>
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
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "12px",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="url(#colorValor)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "12px",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="pedidos" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Orders */}
      <motion.div variants={item}>
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
      </motion.div>
    </motion.div>
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
