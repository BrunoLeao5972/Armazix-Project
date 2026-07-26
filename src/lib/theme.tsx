// Tema claro/escuro do painel administrativo.
//
// TanStack Start renderiza no servidor (Cloudflare Workers), então o SSR não
// tem acesso a localStorage nem a matchMedia — não há como o HTML já sair do
// servidor com a classe "dark" certa. Por isso o anti-flash não é feito aqui:
// é o NO_FLASH_THEME_SCRIPT (script síncrono, injetado no <head> antes de
// <HeadContent /> em __root.tsx) quem aplica a classe no <html> ANTES da
// primeira pintura da página. Este arquivo só sincroniza o estado do React
// com o que aquele script já decidiu, e cuida de persistir escolhas futuras.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "armazix-theme";

/**
 * Script estático (sem interpolação de dado nenhum) injetado como primeiro
 * filho de <head>. Roda antes de qualquer paint: lê a preferência salva, ou
 * cai para prefers-color-scheme do SO se o usuário nunca escolheu antes.
 */
export const NO_FLASH_THEME_SCRIPT = `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var dark=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`;

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // O valor inicial não decide nada visualmente — a classe .dark já foi
  // aplicada pelo NO_FLASH_THEME_SCRIPT antes deste componente sequer montar.
  // Isso só sincroniza o estado do React com o que já está no DOM.
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Enquanto o usuário nunca tiver escolhido manualmente (sem valor salvo),
  // acompanha em tempo real se o SO mudar de tema com a aba aberta.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (readStoredTheme() === null) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa ser usado dentro de <ThemeProvider>");
  return ctx;
}
