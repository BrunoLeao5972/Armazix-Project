import { ShoppingBag, Package, ClipboardList, DollarSign, BarChart3, Monitor, ArrowRight } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

interface ModuleItem {
  icon: ComponentType<LucideProps>;
  name: string;
  description: string;
  highlight?: boolean;
}

const MODULES: ModuleItem[] = [
  {
    icon: ShoppingBag,
    name: "Loja Virtual",
    description: "Vitrine pública com carrinho, checkout integrado e link compartilhável via WhatsApp",
    highlight: true,
  },
  {
    icon: Package,
    name: "Gestão de Estoque",
    description: "Entradas, saídas e ajustes em tempo real — alertas automáticos para reposição",
  },
  {
    icon: ClipboardList,
    name: "Pedidos",
    description: "Acompanhe cada pedido por status com histórico completo e notificações",
  },
  {
    icon: DollarSign,
    name: "Financeiro",
    description: "Caixa, contas a pagar/receber e fluxo de caixa num painel simples e direto",
  },
  {
    icon: BarChart3,
    name: "Relatórios",
    description: "Métricas de vendas, produtos mais vendidos e desempenho por período",
  },
  {
    icon: Monitor,
    name: "PDV",
    description: "Ponto de venda para atendimentos presenciais com caixa e sangria integrados",
  },
];

export function Modules() {
  return (
    <section id="modulos" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-sm font-semibold text-primary">Ecossistema</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Tudo que sua operação precisa, num só lugar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Cada módulo foi desenhado para trabalhar junto — do pedido ao financeiro, sem integrações externas
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.name}
                className={`group relative rounded-3xl border p-7 flex flex-col gap-5 transition-all duration-300 cursor-default hover:-translate-y-1 ${
                  mod.highlight
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow hover:shadow-ambient"
                    : "bg-surface border-border hover:border-primary/30 hover:shadow-soft"
                }`}
              >
                <div
                  className={`grid place-items-center w-12 h-12 rounded-2xl transition-all duration-300 ${
                    mod.highlight
                      ? "bg-white/15 group-hover:bg-white/25"
                      : "bg-accent text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold">{mod.name}</h3>
                  <p
                    className={`text-sm mt-1.5 leading-relaxed ${
                      mod.highlight ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {mod.description}
                  </p>
                </div>

                <a
                  href="/register"
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-all ${
                    mod.highlight
                      ? "text-primary-foreground/80 hover:text-primary-foreground"
                      : "text-primary"
                  }`}
                >
                  Acessar
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
