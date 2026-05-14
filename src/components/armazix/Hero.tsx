import { motion } from "framer-motion";
import { ArrowRight, Star, Zap, Bell } from "lucide-react";
import heroPhone from "@/assets/hero-phone.png";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] rounded-full bg-gradient-primary opacity-[0.08] blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-xl"
        >
          <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-accent-foreground border border-primary/15">
            <Zap className="w-3.5 h-3.5" />
            Plataforma brasileira • Pronta em minutos
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            Sua loja digital com a{" "}
            <span className="text-gradient-primary">velocidade de um clique.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            O ecossistema brasileiro para lojas digitais e marketplaces locais.
            Pensado por quem vive o varejo, desenvolvido para quem quer crescer.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="#cta"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.02] active:scale-[0.99] transition-transform"
            >
              Comece agora, é grátis
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-primary text-primary" />
              ))}
            </div>
            <span>
              <strong className="text-foreground">4,8/5</strong> por mais de{" "}
              <strong className="text-foreground">300 lojistas</strong>.
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div className="relative aspect-square">
            <img
              src={heroPhone}
              alt="Dashboard ARMAZIX em iPhone"
              width={1024}
              height={1024}
              className="w-full h-full object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.15)]"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute top-4 sm:top-6 left-0 sm:left-2 glass rounded-2xl p-3 pr-4 shadow-soft border border-border/60 flex items-center gap-3 z-10 max-w-[180px]"
            >
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-primary text-primary-foreground flex-shrink-0">
                <Bell className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Novo Pedido  #1007</div>
                <div className="text-sm font-semibold truncate">Isadora C.</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              className="absolute bottom-6 sm:bottom-10 right-0 sm:right-2 glass rounded-2xl p-3 pr-4 shadow-soft border border-border/60 z-10"
            >
              <div className="text-xs text-muted-foreground">Venda via PIX</div>
              <div className="text-lg font-bold text-gradient-primary">R$ 189,90</div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
