import { TrendingUp, Package, ShoppingBag, AlertTriangle } from "lucide-react";

export function Reports() {
  return (
    <section id="relatorios" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-sm font-semibold text-primary">Relatórios</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Decisões com clareza, não com achismo.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Visualize o que importa: vendas, produtos, estoque e desempenho — em um painel
            simples e direto.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Big chart card */}
          <div className="lg:col-span-2 rounded-4xl bg-surface border border-border shadow-soft p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-sm text-muted-foreground">Vendas nos últimos 7 dias</div>
                <div className="mt-1 text-3xl font-bold">R$ 18.420,90</div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-accent px-2.5 py-1 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                +8,2%
              </span>
            </div>
            <BarsChart />
            <div className="mt-4 grid grid-cols-7 gap-2 text-[11px] text-muted-foreground text-center">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </div>

          {/* Side stats */}
          <div className="flex flex-col gap-6">
            <StatCard
              Icon={ShoppingBag}
              label="Pedidos no mês"
              value="312"
              hint="+24 vs. mês anterior"
            />
            <StatCard
              Icon={Package}
              label="Produtos ativos"
              value="48"
              hint="3 atualizados hoje"
            />
            <StatCard
              Icon={AlertTriangle}
              label="Estoque baixo"
              value="5 itens"
              hint="Reposição sugerida"
              accent
            />
          </div>
        </div>

        {/* Top products table */}
        <div className="mt-6 rounded-4xl bg-surface border border-border shadow-soft p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Produtos mais vendidos</h3>
            <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
          </div>
          <ul className="divide-y divide-border">
            {[
              { name: "Camiseta Básica Preta", sales: 84, revenue: "R$ 4.196,00" },
              { name: "Tênis Run Light", sales: 47, revenue: "R$ 8.453,00" },
              { name: "Mochila Urban 20L", sales: 33, revenue: "R$ 2.937,00" },
              { name: "Boné Trucker Verde", sales: 21, revenue: "R$ 839,00" },
            ].map((p) => (
              <li key={p.name} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="flex items-center gap-6">
                  <span className="text-muted-foreground">{p.sales} vendas</span>
                  <span className="font-semibold">{p.revenue}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  Icon,
  label,
  value,
  hint,
  accent,
}: {
  Icon: typeof Package;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-4xl bg-surface border border-border shadow-soft p-6 flex items-center gap-4">
      <span
        className={`grid place-items-center w-12 h-12 rounded-2xl ${
          accent ? "bg-foreground text-background" : "bg-accent text-primary"
        }`}
      >
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold truncate">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      </div>
    </div>
  );
}

function BarsChart() {
  const bars = [42, 58, 36, 70, 64, 88, 76];
  const max = Math.max(...bars);
  return (
    <div className="flex items-end gap-3 h-40">
      {bars.map((v, i) => (
        <div key={i} className="flex-1 h-full flex items-end">
          <div
            className="w-full rounded-t-xl bg-gradient-primary"
            style={{ height: `${(v / max) * 100}%`, opacity: 0.85 }}
          />
        </div>
      ))}
    </div>
  );
}
