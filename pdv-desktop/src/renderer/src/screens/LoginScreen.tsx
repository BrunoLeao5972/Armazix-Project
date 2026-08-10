import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock, Mail, Store, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { cn } from "../lib/cn";

const CAIXA_LABEL_KEY = "armazix_pdv_caixa_label";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://armazix.com.br";

export function LoginScreen() {
  const { signIn, loading, error } = useAuth();
  const online = useOnlineStatus();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [caixaLabel, setCaixaLabel] = useState(
    () => localStorage.getItem(CAIXA_LABEL_KEY) || "Caixa 1",
  );
  const [appVersion, setAppVersion] = useState("—");

  useEffect(() => {
    window.armazixDesktop?.getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem(CAIXA_LABEL_KEY, caixaLabel);
    try {
      await signIn(email.trim(), password);
    } catch {
      // erro já fica exposto via `error` do contexto — nada a fazer aqui
    }
  };

  return (
    <div className="h-screen w-screen flex">
      {/* ── Esquerda: formulário ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between px-10 py-8 lg:px-20 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-glow">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Armazix PDV</span>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-ink">Entrar no caixa</h1>
          <p className="text-sm text-ink/60 mt-1.5">
            Use o mesmo login do painel Armazix. Depois do primeiro acesso, funciona sem internet.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink/70 uppercase tracking-wide">Usuário</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-12 rounded-xl border border-black/10 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink/70 uppercase tracking-wide">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 rounded-xl border border-black/10 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink/70 uppercase tracking-wide">Perfil / Caixa</label>
              <select
                value={caixaLabel}
                onChange={(e) => setCaixaLabel(e.target.value)}
                className="w-full h-12 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white transition-shadow"
              >
                <option>Caixa 1</option>
                <option>Caixa 2</option>
                <option>Caixa 3</option>
                <option>Balcão</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            {!online && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                Sem conexão agora — o login vai usar os dados salvos no último acesso online deste computador.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm shadow-glow transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
            </button>
          </form>
        </div>

        {/* ── Rodapé: servidor / versão / status ────────────────── */}
        <div className="flex items-center justify-between text-xs text-ink/45">
          <span>{API_BASE_URL.replace(/^https?:\/\//, "")}</span>
          <div className="flex items-center gap-4">
            <span>v{appVersion}</span>
            <span className={cn("flex items-center gap-1.5 font-medium", online ? "text-primary" : "text-amber-600")}>
              {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Direita: ilustração ──────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary to-primary-dark">
        <DecorativeMap />
        <div className="relative z-10 flex flex-col justify-end p-14 text-white">
          <h2 className="text-3xl font-bold leading-tight max-w-md">
            Sua loja funciona mesmo quando a internet cai.
          </h2>
          <p className="text-white/80 mt-3 max-w-sm text-sm leading-relaxed">
            Vendas feitas offline entram na fila e sincronizam sozinhas assim que a
            conexão voltar — nada fica pra trás.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Ilustração abstrata (pontos de mapa + pino) — placeholder até termos a arte final da marca. */
function DecorativeMap() {
  return (
    <svg
      viewBox="0 0 400 600"
      className="absolute inset-0 w-full h-full opacity-90"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill="url(#glow)" />
      {Array.from({ length: 12 }).map((_, row) =>
        Array.from({ length: 8 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={30 + col * 48}
            cy={40 + row * 48}
            r={1.6}
            fill="#ffffff"
            opacity={0.18}
          />
        )),
      )}
      <circle cx="180" cy="230" r="70" fill="#ffffff" opacity="0.06" />
      <circle cx="260" cy="360" r="110" fill="#ffffff" opacity="0.05" />
    </svg>
  );
}

