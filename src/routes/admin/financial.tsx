import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
const CashFlowChart = lazy(() => import("@/components/armazix/CashFlowChart"));
const PaymentMethodsChart = lazy(() => import("@/components/armazix/PaymentMethodsChart"));

export const Route = createFileRoute("/admin/financial")({
  component: FinancialPage,
  head: () => ({
    meta: [{ title: "Financeiro — ARMAZIX" }],
  }),
});

const cashFlowData: { name: string; receita: number; despesa: number }[] = [];
const paymentMethods: { name: string; value: number; color: string }[] = [];
const recentTransactions: { id: number; desc: string; type: string; value: string; date: string }[] = [];
const accountsPayable: { desc: string; value: string; due: string; status: string }[] = [];
const accountsReceivable: { desc: string; value: string; due: string; status: string }[] = [];

function FinancialPage() {
  return (
    <div
      className="space-y-6 animate-in fade-in duration-300"
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
            <div className="text-2xl font-bold">R$ 0</div>
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
            <div className="text-2xl font-bold">R$ 0</div>
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
            <div className="text-2xl font-bold text-gradient-primary">R$ 0</div>
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
            <div className="text-2xl font-bold">0%</div>
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
              <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>}>
                <CashFlowChart />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Métodos de pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>}>
                <PaymentMethodsChart />
              </Suspense>
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
    </div>
  );
}
