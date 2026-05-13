import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/armazix/Navbar";
import { Hero } from "@/components/armazix/Hero";
import { Categories } from "@/components/armazix/Categories";
import { Bento } from "@/components/armazix/Bento";
import { Reports } from "@/components/armazix/Reports";
import { Steps } from "@/components/armazix/Steps";
import { Pricing } from "@/components/armazix/Pricing";
import { CTA } from "@/components/armazix/CTA";
import { Footer } from "@/components/armazix/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ARMAZIX - Crie loja digital em apenas 2 minutos" },
      {
        name: "description",
        content:
          "Plataforma brasileira para organizar produtos, controlar estoque e vender pelo WhatsApp. Comece grátis em minutos.",
      },
      { property: "og:title", content: "ARMAZIX - Crie loja digital em apenas 2 minutos" },
      {
        property: "og:description",
        content:
          "Catálogo, estoque automático, alertas e relatórios — tudo em um painel simples.",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Categories />
        <Bento />
        <Reports />
        <Steps />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
