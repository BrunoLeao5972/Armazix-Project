import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/admin/stock")({
  component: StockPage,
  head: () => ({
    meta: [{ title: "Estoque — ARMAZIX" }],
  }),
});

const stockMovements = [
  { id: 1, product: "Arroz 5kg", type: "entrada", qty: 50, date: "Hoje, 10:30", supplier: "Distribuidora ABC" },
  { id: 2, product: "Feijão 1kg", type: "saida", qty: 12, date: "Hoje, 09:15", supplier: "" },
  { id: 3, product: "Leite 1L", type: "perda", qty: 3, date: "Hoje, 08:00", supplier: "" },
  { id: 4, product: "Café 500g", type: "entrada", qty: 30, date: "Ontem, 16:00", supplier: "Café do Brasil" },
  { id: 5, product: "Açúcar 1kg", type: "saida", qty: 8, date: "Ontem, 14:30", supplier: "" },
  { id: 6, product: "Óleo 900ml", type: "entrada", qty: 25, date: "Ontem, 11:00", supplier: "Distribuidora ABC" },
];

const lowStockItems = [
  { name: "Leite Integral 1L", stock: 12, min: 30 },
  { name: "Biscoito Cream 200g", stock: 5, min: 20 },
  { name: "Macarrão Espaguete 500g", stock: 0, min: 25 },
  { name: "Sabonete Liquido 250ml", stock: 8, min: 15 },
];

const movementData = [
  { name: "Seg", entrada: 80, saida: 45 },
  { name: "Ter", entrada: 50, saida: 30 },
  { name: "Qua", entrada: 70, saida: 55 },
  { name: "Qui", entrada: 90, saida: 40 },
  { name: "Sex", entrada: 60, saida: 50 },
  { name: "Sáb", entrada: 40, saida: 65 },
  { name: "Dom", entrada: 30, saida: 25 },
];

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  entrada: { label: "Entrada", icon: ArrowUpCircle, color: "text-primary", bgColor: "bg-primary/15" },
  saida: { label: "Saída", icon: ArrowDownCircle, color: "text-blue-600", bgColor: "bg-blue-500/15" },
  perda: { label: "Perda", icon: AlertTriangle, color: "text-amber-600", bgColor: "bg-amber-500/15" },
};

function StockPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="space-y-6"
    >
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
            <div className="text-2xl font-bold">1.280</div>
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
            <div className="text-2xl font-bold">155</div>
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
            <div className="text-2xl font-bold">310</div>
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
            <div className="text-2xl font-bold">4</div>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementData}>
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
                <Bar dataKey="entrada" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saida" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
              {stockMovements.map((m) => {
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
              {lowStockItems.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className={`text-xs font-bold ${item.stock === 0 ? "text-destructive" : "text-amber-600"}`}>
                      {item.stock === 0 ? "Sem estoque" : `${item.stock}/${item.min}`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.stock === 0 ? "bg-destructive" : item.stock < item.min * 0.5 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min((item.stock / item.min) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
