import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/armazix/Navbar";
import { Hero } from "@/components/armazix/Hero";
import { Categories } from "@/components/armazix/Categories";
import { Bento } from "@/components/armazix/Bento";
import { Modules } from "@/components/armazix/Modules";
import { Features } from "@/components/armazix/Features";
import { Reports } from "@/components/armazix/Reports";
import { Steps } from "@/components/armazix/Steps";
import { FAQ } from "@/components/armazix/FAQ";
import { Pricing } from "@/components/armazix/Pricing";
import { CTA } from "@/components/armazix/CTA";
import { Footer } from "@/components/armazix/Footer";
import { useEffect, useState } from "react";
import { resolveHostnameStoreSlug } from "@/lib/store-context";
import { Loader2 } from "lucide-react";

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
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const slug = typeof window !== "undefined" ? resolveHostnameStoreSlug(window.location.hostname) : null;
    if (!slug) return;
    setRedirecting(true);
    navigate({ to: "/store" }).catch(() => {});
  }, [navigate]);

  if (redirecting) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Categories />
        <Bento />
        <Modules />
        <Features />
        <Reports />
        <Steps />
        <FAQ />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
