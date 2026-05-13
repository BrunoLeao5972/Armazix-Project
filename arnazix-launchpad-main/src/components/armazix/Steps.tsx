import { UserPlus, LayoutGrid, Wallet } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Cadastre",
    desc: "Crie sua conta em 30 segundos. Sem cartão, sem burocracia.",
  },
  {
    icon: LayoutGrid,
    title: "Personalize",
    desc: "Arraste e solte seus produtos, fotos e cores. Pronto para vender.",
  },
  {
    icon: Wallet,
    title: "Venda",
    desc: "Receba pagamentos e gerencie entregas direto pelo celular.",
  },
];

export function Steps() {
  return (
    <section className="py-16 lg:py-24 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-sm font-semibold text-primary">Como funciona</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Em 3 passos você está vendendo.
          </h2>
        </div>
        <ol className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="rounded-4xl bg-surface border border-border shadow-soft p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                  <s.icon className="w-5 h-5" />
                </span>
                <span className="text-5xl font-bold text-muted-foreground/20">
                  0{i + 1}
                </span>
              </div>
              <h3 className="text-xl font-bold">{s.title}</h3>
              <p className="text-muted-foreground mt-2">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
