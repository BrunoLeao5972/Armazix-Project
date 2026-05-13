import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section id="cta" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-4xl bg-foreground text-background p-10 sm:p-16 lg:p-24 text-center">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary-glow opacity-20 blur-3xl" />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Seu negócio merece o{" "}
              <span className="text-gradient-primary">próximo nível.</span>
            </h2>
            <p className="mt-5 text-background/70 text-lg">
              Comece grátis hoje. Em 30 segundos sua loja está no ar.
            </p>
            <div className="mt-8 flex justify-center">
              <a
                href="#"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.02] active:scale-[0.99] transition-transform"
              >
                Criar minha loja ARMAZIX
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <p className="mt-4 text-xs text-background/50">
              Sem cartão de crédito. Sem taxas de adesão.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
