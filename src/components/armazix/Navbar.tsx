import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#categorias", label: "Categorias" },
  { href: "#relatorios", label: "Relatórios" },
  { href: "#precos", label: "Preços" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className={`transition-all duration-300 ${
          scrolled ? "glass border-b border-border/50" : "bg-transparent"
        }`}
      >
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-bold text-lg">
            <img src="/logo.png" alt="Armazix" className="w-9 h-9" />
            ARMAZIX
          </a>
          <ul className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="hover:text-foreground transition-colors">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm font-medium px-4 py-2 rounded-full hover:bg-secondary transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-[0.99] transition-transform"
            >
              Criar Loja Grátis
            </Link>
          </div>
          <button
            className="md:hidden p-2 rounded-xl hover:bg-secondary"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>
        {open && (
          <div className="md:hidden border-t border-border/50 px-4 py-4 glass">
            <ul className="flex flex-col gap-3 text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setOpen(false)} className="block py-2">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#cta"
                  onClick={() => setOpen(false)}
                  className="block text-center py-3 rounded-full bg-gradient-primary text-primary-foreground font-semibold mt-2"
                >
                  Criar Loja Grátis
                </a>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
