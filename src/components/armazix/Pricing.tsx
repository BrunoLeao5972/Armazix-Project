import { Check, Flame } from "lucide-react";

type Plan = {
  name: string;
  badge: string;
  tagline: string;
  price: string;
  period?: string;
  capacity: string;
  description: string;
  features: string[];
  cta: string;
  footer: string;
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Experimente",
    badge: "",
    tagline: "Sem necessidade de cartão de crédito",
    price: "R$ 0",
    period: "/ 14 dias",
    capacity: "Todas as funcionalidades",
    description:
      "Teste todas as funcionalidades sem compromisso e configure sua loja em minutos",
    features: [
      "Acesso completo por 14 dias",
      "Integração com WhatsApp",
      "Controle de estoque automático",
      "Relatórios de vendas e desempenho",
      "Suporte durante o teste",
    ],
    cta: "Começar teste grátis",
    footer: "",
  },
  {
    name: "Start",
    badge: "Para começar vendendo",
    tagline: "O essencial para crescer",
    price: "R$ 79,90",
    period: "/mês",
    capacity: "Até 20 produtos",
    description:
      "Ideal para pequenos lojistas que precisam ganhar tempo, evitar erros no estoque e profissionalizar a operação",
    features: [
      "Catálogo com até 20 produtos",
      "Integração com WhatsApp",
      "Controle de estoque automático",
      "Alertas de estoque baixo",
      "Relatórios de vendas e desempenho",
      "Suporte normal",
    ],
    cta: "Assinar agora",
    footer: "Menos de R$ 2,70 por dia para profissionalizar o seu delivery",
  },
  {
    name: "Pro",
    badge: "",
    tagline: "Controle total do negócio",
    price: "R$ 149,90",
    period: "/mês",
    capacity: "Até 70 produtos",
    description:
      "O plano principal para quem quer ter controle total do negócio, evitar perder vendas e crescer com previsibilidade",
    features: [
      "Catálogo com até 70 produtos",
      "Integração com WhatsApp",
      "Controle de estoque automático",
      "Alertas de estoque baixo",
      "Relatórios avançados",
      "Acesso para 2 usuários",
      "🔥 Ponto de Venda (PDV/Caixa) incluso de graça",
      "Suporte prioritário",
    ],
    cta: "Assinar agora",
    footer: "Melhor equilíbrio entre preço, automação e controle",
    highlighted: true,
  },
  {
    name: "Plano Full",
    badge: "",
    tagline: "Liberdade e escala total",
    price: "R$ 249,90",
    period: "/mês",
    capacity: "Produtos ilimitados",
    description:
      "Para operações mais robustas que precisam de liberdade total, equipe colaborando e visão completa do negócio",
    features: [
      "Produtos ilimitados",
      "Integração com WhatsApp",
      "Controle de estoque automático",
      "Alertas de estoque baixo",
      "Relatórios avançados",
      "Multiusuário ilimitado",
      "Ponto de Venda (PDV) incluso",
      "Suporte prioritário VIP",
    ],
    cta: "Assinar agora",
    footer: "A estrutura definitiva para quem vende muito todos os dias",
  },
];

export function Pricing() {
  return (
    <section id="precos" className="py-16 lg:py-24 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-sm font-semibold text-primary">Preços</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Um plano para cada estágio do seu negócio
          </h2>
          <p className="mt-3 text-muted-foreground">
            Comece grátis e evolua conforme sua operação cresce. Sem fidelidade, sem
            surpresas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.map((p) => (
            <article
              key={p.name}
              className={`relative flex flex-col rounded-4xl p-8 border transition-all duration-300 ${
                p.highlighted
                  ? "bg-foreground text-background border-transparent shadow-ambient lg:scale-[1.02]"
                  : "bg-surface border-border shadow-soft hover:-translate-y-1 hover:shadow-ambient"
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
                  <Flame className="w-3.5 h-3.5" />
                  Mais escolhido
                </span>
              )}

              <div className="mb-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  {p.badge && (
                    <span
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${
                        p.highlighted
                          ? "bg-primary/20 text-primary-glow"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1 text-sm ${
                    p.highlighted ? "text-background/70" : "text-muted-foreground"
                  }`}
                >
                  {p.tagline}
                </p>
              </div>

              <div className="mb-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                {p.period && (
                  <span
                    className={`text-sm ${
                      p.highlighted ? "text-background/60" : "text-muted-foreground"
                    }`}
                  >
                    {p.period}
                  </span>
                )}
              </div>
              <div
                className={`text-sm font-medium mb-6 ${
                  p.highlighted ? "text-primary-glow" : "text-primary"
                }`}
              >
                {p.capacity}
              </div>

              <p
                className={`text-sm mb-6 ${
                  p.highlighted ? "text-background/70" : "text-muted-foreground"
                }`}
              >
                {p.description}
              </p>

              <ul className="space-y-3 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        p.highlighted ? "text-primary-glow" : "text-primary"
                      }`}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/register"
                className={`mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold transition-transform hover:scale-[1.02] active:scale-[0.99] ${
                  p.highlighted
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "bg-foreground text-background"
                }`}
              >
                {p.cta}
              </a>

              {p.footer && (
                <p
                  className={`mt-4 text-xs text-center ${
                    p.highlighted ? "text-background/60" : "text-muted-foreground"
                  }`}
                >
                  {p.footer}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

