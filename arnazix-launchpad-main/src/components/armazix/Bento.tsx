import { BarChart3, MessageCircle, Package, AlertTriangle, LineChart } from "lucide-react";

export function Bento() {
  return (
    <section id="funcionalidades" className="py-16 lg:py-24 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-sm font-semibold text-primary">Funcionalidades</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Tudo o que você precisa para organizar e vender melhor.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 lg:gap-6">
          {/* Big card */}
          <div className="md:col-span-4 md:row-span-2 rounded-4xl bg-surface border border-border shadow-soft p-8 lg:p-10 flex flex-col justify-between min-h-[420px] overflow-hidden relative">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-accent-foreground">
                <BarChart3 className="w-3.5 h-3.5" />
                Tempo Real
              </div>
              <h3 className="mt-5 text-2xl lg:text-3xl font-bold">Gestão em Tempo Real</h3>
              <p className="mt-3 text-muted-foreground max-w-md">
                Acompanhe vendas, produtos e estoque em um painel único, com a clareza
                que faltava na sua operação.
              </p>
            </div>
            <ChartPreview />
          </div>

          {/* Medium 1 */}
          <div className="md:col-span-2 rounded-4xl bg-gradient-primary text-primary-foreground p-8 shadow-ambient min-h-[200px] flex flex-col justify-between">
            <MessageCircle className="w-8 h-8" />
            <div>
              <h3 className="text-xl font-bold">Integração com WhatsApp</h3>
              <p className="text-sm opacity-90 mt-1">
                Receba pedidos e fale com seus clientes direto pelo canal que eles já usam.
              </p>
            </div>
          </div>

          {/* Medium 2 */}
          <div className="md:col-span-2 rounded-4xl bg-surface border border-border shadow-soft p-8 min-h-[200px] flex flex-col justify-between relative overflow-hidden">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-accent text-primary">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Controle de Estoque</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Atualização automática a cada venda. Saia das planilhas de uma vez por todas.
              </p>
            </div>
          </div>

          {/* Small */}
          <div className="md:col-span-2 rounded-4xl bg-surface border border-border shadow-soft p-8 min-h-[180px] flex flex-col justify-between">
            <AlertTriangle className="w-8 h-8 text-primary" />
            <div>
              <h3 className="text-xl font-bold">Alertas de Estoque Baixo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Saiba na hora certa quais produtos precisam ser repostos.
              </p>
            </div>
          </div>

          {/* Small accent */}
          <div className="md:col-span-4 rounded-4xl bg-foreground text-background p-8 min-h-[180px] flex items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/20 text-primary-glow">
                <LineChart className="w-3.5 h-3.5" />
                Decisões com dados
              </div>
              <h3 className="mt-3 text-2xl font-bold">Visão clara do seu negócio.</h3>
              <p className="text-sm text-background/70 mt-1">
                Relatórios diretos ao ponto para entender o que está vendendo, o que parou
                e onde focar a sua próxima ação.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChartPreview() {
  return (
    <div className="mt-8 rounded-3xl bg-secondary/60 p-5 border border-border">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs text-muted-foreground">Receita esta semana</div>
          <div className="text-2xl font-bold">R$ 24.890,50</div>
        </div>
        <div className="text-xs font-semibold text-primary bg-accent px-2 py-1 rounded-full">
          +12,4%
        </div>
      </div>
      <svg viewBox="0 0 300 80" className="w-full h-20">
        <defs>
          <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.21 145)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="oklch(0.72 0.21 145)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,60 C30,50 50,30 80,35 C110,40 130,55 160,40 C190,25 220,15 260,20 L300,15 L300,80 L0,80 Z"
          fill="url(#g)"
        />
        <path
          d="M0,60 C30,50 50,30 80,35 C110,40 130,55 160,40 C190,25 220,15 260,20 L300,15"
          fill="none"
          stroke="oklch(0.72 0.21 145)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
