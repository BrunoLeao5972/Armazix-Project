import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { login as loginService, logout as logoutService, type AuthSession } from "../services/auth.service";
import { syncCatalog } from "../services/sync.service";

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = await loginService(email, password);
      setSession(s);
      // Login online: aproveita pra trazer o catálogo mais recente antes de
      // liberar a tela de vendas. Falha aqui não bloqueia o operador — o
      // caixa abre com o que já estiver em cache de sessões anteriores.
      if (s.token) {
        syncCatalog().catch((err) => console.warn("[auth] sync inicial falhou:", err));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    logoutService();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, error, signIn, signOut }),
    [session, loading, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
