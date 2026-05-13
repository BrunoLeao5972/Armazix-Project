import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Banknote,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/admin/financial")({
  component: FinancialPage,
  head: () => ({
    meta: [{ title: "Financeiro — ARMAZIX" }],
  }),
});

const cashFlowData = [
  { name: "Jan", receita: 18500, despesa: 8200 },
  { name: "Fev", receita: 22000, despesa: 9100 },
  { name: "Mar", receita: 19800, despesa: 8800 },
  { name: "Abr", receita: 24500, despesa: 10200 },
  { name: "Mai", receita: 28450, despesa: 11500 },
  { name: "Jun", receita: 26000, despesa: 10800 },
];

const paymentMethods = [
  { name: "PIX", value: 45, color: "#00C853" },
  { name: "Cartão", value: 30, color: "#3b82f6" },
  { name: "Dinheiro", value: 15, color: "#f59e0b" },
  { name: "Boleto", value: 10, color: "#8b5cf6" },
];

const recentTransactions = [
  { id: 1, desc: "Venda #3208 — Maria Silva", type: "receita", value: "R$ 189,90", date: "Hoje, 14:30" },
  { id: 2, desc: "Venda #3207 — João Santos", type: "receita", value: "R$ 342,50", date: "Hoje, 13:15" },
  { id: 3, desc: "Fornecedor — Distribuidora ABC", type: "despesa", value: "R$ 1.200,00", date: "Hoje, 10:00" },
  { id: 4, desc: "Venda #3206 — Ana Costa", type: "receita", value: "R$ 78,00", date: "Hoje, 09:45" },
  { id: 5, desc: "Aluguel do ponto", type: "despesa", value: "R$ 3.500,00", date: "01/Mai" },
  { id: 6, desc: "Venda #3205 — Pedro Lima", type: "receita", value: "R$ 456,00", date: "Ontem, 18:00" },
];

const accountsPayable = [
  { desc: "Fornecedor Café do Brasil", value: "R$ 2.400,00", due: "15/Mai", status: "pendente" },
  { desc: "Energia elétrica", value: "R$ 380,00", due: "10/Mai", status: "vencido" },
  { desc: "Internet fibra", value: "R$ 150,00", due: "20/Mai", status: "pendente" },
];

const accountsReceivable = [
  { desc: "Pedido #3198 — Carlos M.", value: "R$ 245,00", due: "Vencido", status: "vencido" },
  { desc: "Pedido #3200 — Fernanda L.", value: "R$ 189,90", due: "12/Mai", status: "pendente" },
  { desc: "Assinatura mensal — Cliente X", value: "R$ 99,00", due: "25/Mai", status: "pendente" },
];

function FinancialPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fluxo de caixa, contas e indicadores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/15">
                <DollarSign className="w-4 h-4 text-primary" />
              </span>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
                <ArrowUpRight className="w-3 h-3" />+12%
              </span>
            </div>
            <div className="text-2xl font-bold">R$ 28.450</div>
            <div className="text-xs text-muted-foreground">Receita do mês</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-blue-500/15">
                <TrendingDown className="w-4 h-4 text-blue-600" />
              </span>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-destructive">
                <ArrowDownRight className="w-3 h-3" />+8%
              </span>
            </div>
            <div className="text-2xl font-bold">R$ 11.500</div>
            <div className="text-xs text-muted-foreground">Despesas do mês</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/15">
                <TrendingUp className="w-4 h-4 text-primary" />
              </span>
            </div>
            <div className="text-2xl font-bold text-gradient-primary">R$ 16.950</div>
            <div className="text-xs text-muted-foreground">Lucro líquido</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-purple-500/15">
                <CreditCard className="w-4 h-4 text-purple-600" />
              </span>
            </div>
            <div className="text-2xl font-bold">59,7%</div>
            <div className="text-xs text-muted-foreground">Margem de lucro</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Fluxo de caixa</CardTitle>
              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C853" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                  <Area type="monotone" dataKey="receita" stroke="#00C853" strokeWidth={2} fill="url(#colorReceita)" />
                  <Area type="monotone" dataKey="despesa" stroke="#3b82f6" strokeWidth={2} fill="url(#colorDespesa)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Métodos de pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "12px",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {paymentMethods.map((m) => (
                <div key={m.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-xs text-muted-foreground">{m.name}</span>
                  </div>
                  <span className="text-xs font-semibold">{m.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions + Accounts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Transações recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`grid place-items-center w-8 h-8 rounded-lg ${
                      t.type === "receita" ? "bg-primary/15" : "bg-blue-500/15"
                    }`}>
                      {t.type === "receita" ? (
                        <ArrowUpRight className="w-4 h-4 text-primary" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-blue-600" />
                      )}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{t.desc}</div>
                      <div className="text-xs text-muted-foreground">{t.date}</div>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${t.type === "receita" ? "text-primary" : "text-blue-600"}`}>
                    {t.type === "despesa" ? "−" : "+"}{t.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accounts */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="w-4 h-4 text-amber-500" />
                Contas a pagar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {accountsPayable.map((a) => (
                  <div key={a.desc} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{a.desc}</div>
                      <div className="text-xs text-muted-foreground">Vence: {a.due}</div>
                    </div>
                    <Badge variant="secondary" className={`rounded-full text-[10px] ${
                      a.status === "vencido" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-600"
                    }`}>
                      {a.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Contas a receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {accountsReceivable.map((a) => (
                  <div key={a.desc} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{a.desc}</div>
                      <div className="text-xs text-muted-foreground">{a.due}</div>
                    </div>
                    <Badge variant="secondary" className={`rounded-full text-[10px] ${
                      a.status === "vencido" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                    }`}>
                      {a.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
