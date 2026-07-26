import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/**
 * Botão de alternância claro/escuro do painel. Os dois ícones ficam
 * sobrepostos e alternam opacidade/rotação — evita o "pulo" de layout que um
 * ícone só trocando teria.
 *
 * Antes de montar no client, sempre renderiza como se fosse claro (mesma
 * saída do servidor, que não tem como saber o tema real). Isso evita o
 * warning de hydration mismatch: o ícone real só aparece depois do primeiro
 * effect, quando o React já sabe o tema de verdade. A cor de fundo da página
 * já está certa desde antes disso — quem cuida disso é o script anti-flash
 * no <head>, não este componente.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";
  const label = isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={[
        "relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
        "hover:bg-secondary transition-colors",
        className,
      ].join(" ")}
    >
      <Sun
        aria-hidden="true"
        className={[
          "absolute w-5 h-5 transition-all duration-300",
          isDark ? "opacity-0 scale-50 -rotate-90" : "opacity-100 scale-100 rotate-0",
        ].join(" ")}
      />
      <Moon
        aria-hidden="true"
        className={[
          "absolute w-5 h-5 transition-all duration-300",
          isDark ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90",
        ].join(" ")}
      />
    </button>
  );
}
