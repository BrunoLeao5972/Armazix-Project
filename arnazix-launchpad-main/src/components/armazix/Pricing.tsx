import { useState } from "react";
import { Check, Flame } from "lucide-react";

type Plan = {
  name: string;
  badge: string;
  tagline: string;
  price: string;
  period?: string;
  perDay?: string;
  capacity: string;
  description: string;
  features: string[];
  optional?: { title: string; desc: string };
  cta: string;
  footer: string;
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    badge: "Grátis",
    tagline: "Comece sem custo",
    price: "R$ 0",
    period: "/mês",
    capacity: "Até 5 produtos",
    description:
      "Para testar a Armazix, organizar seu estoque inicial e vender com mais clareza desde o primeiro dia.",
    features: [
      "Catálogo com até 5 produtos",
      "Integração com WhatsApp",
      "Controle de estoque manual",
      "Relatórios básicos",
      "Suporte normal",
    ],
    cta: "Começar grátis",
    footer: "Ideal para validar sua operação sem compromisso.",
  },
  {
    name: "Start",
    badge: "Para começar vendendo",
    tagline: "A partir de R$ 0,66/dia",
    price: "R$ 19,90",
    period: "/mês",
    capacity: "Até 30 produtos",
    description:
      "Ideal para pequenos lojistas que precisam ganhar tempo, evitar erros no estoque e profissionalizar a operação.",
    features: [
      "Catálogo com até 30 produtos",
      "Integração com WhatsApp",
      "Controle de estoque automático",
      "Alertas de estoque baixo",
      "Relatórios básicos",
      "Suporte normal",
    ],
    optional: { title: "Ponto de Venda", desc: "Terminal para loja física" },
    cta: "Assinar agora",
    footer: "Perfeito para sair das planilhas e ganhar agilidade.",
  },
  {
    name: "Pro",
    badge: "Mais escolhido",
    tagline: "A partir de R$ 1,33/dia",
    price: "R$ 39,90",
    period: "/mês",
    capacity: "Até 70 produtos",
    description:
      "O plano principal para quem quer ter controle total do negócio, evitar perder vendas e crescer com previsibilidade.",
    features: [
      "Catálogo com até 70 produtos",
      "Integração com WhatsApp",
      "Controle de estoque automático",
      "Alertas de estoque baixo",
      "Relatórios avançados",
      "Acesso para 2 usuários",
      "Suporte prioritário",
    ],
    optional: { title: "Ponto de Venda", desc: "Terminal para loja física" },
    cta: "Assinar agora",
    footer: "Melhor equilíbrio entre preço, automação e controle.",
    highlighted: true,
  },
  {
    name: "Full",
    badge: "Premium",
    tagline: "A partir de R$ 2,99/dia",
    price: "R$ 89,90",
    period: "/mês",
    capacity: "Produtos ilimitados",
    description:
      "Para operações mais robustas que precisam de liberdade total, equipe colaborando e visão completa do estoque.",
    features: [
      "Produtos ilimitados",
      "Integração com WhatsApp",
      "Controle de estoque automático",
      "Alertas de estoque baixo",
      "Relatórios avançados",
      "Multiusuário",
      "Suporte prioritário",
    ],
    optional: { title: "Ponto de Venda", desc: "Terminal para loja física" },
    cta: "Assinar agora",
    footer: "Liberdade total para operações em crescimento.",
  },
];

export function Pricing() {
  const [pdv, setPdv] = useState<Record<string, boolean>>({});
  return (
    <section id="precos" className="py-16 lg:py-24 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-sm font-semibold text-primary">Preços</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Um plano para cada estágio do seu negócio.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Comece grátis e evolua conforme sua operação cresce. Sem fidelidade, sem
            surpresas.
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
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  <span
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                      p.highlighted
                        ? "bg-primary/20 text-primary-glow"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {p.badge}
                  </span>
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

              {p.optional && (
                <div
                  className={`rounded-2xl p-4 mb-6 border ${
                    p.highlighted
                      ? "border-background/15 bg-background/5"
                      : "border-dashed border-border bg-secondary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className={`text-[11px] font-semibold uppercase tracking-wide ${
                          p.highlighted ? "text-background/60" : "text-muted-foreground"
                        }`}
                      >
                        Opcional
                      </div>
                      <div className="mt-1 text-sm font-semibold">{p.optional.title}</div>
                      <div
                        className={`text-xs ${
                          p.highlighted ? "text-background/60" : "text-muted-foreground"
                        }`}
                      >
                        {p.optional.desc}
                      </div>
                    </div>
                    <Toggle
                      checked={!!pdv[p.name]}
                      onChange={(v) => setPdv((s) => ({ ...s, [p.name]: v }))}
                      highlighted={p.highlighted}
                      label={`Ativar ${p.optional.title} no plano ${p.name}`}
                    />
                  </div>
                </div>
              )}

              <a
                href="#cta"
                className={`mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold transition-transform hover:scale-[1.02] active:scale-[0.99] ${
                  p.highlighted
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "bg-foreground text-background"
                }`}
              >
                {p.cta}
              </a>

              <p
                className={`mt-4 text-xs text-center ${
                  p.highlighted ? "text-background/60" : "text-muted-foreground"
                }`}
              >
                {p.footer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  highlighted,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  highlighted?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        checked
          ? "bg-gradient-primary shadow-glow"
          : highlighted
            ? "bg-background/20"
            : "bg-border"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow-soft transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
