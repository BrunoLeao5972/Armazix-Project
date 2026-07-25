import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ShoppingBag, Lock, Loader2, ArrowRight, Eye, EyeOff,
  CheckCircle2, UserPlus, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/convite")({
  component: AcceptInvitePage,
  head: () => ({ meta: [{ title: "Convite de equipe — ARMAZIX" }] }),
  validateSearch: (search: Record<string, string>) => ({
    token: search.token || "",
  }),
});

interface InviteInfo {
  email:     string;
  name:      string;
  role:      string;
  roleLabel: string;
  storeName: string;
  expiresAt: string;
  /** true → define a senha agora; false → já tem conta, confirma com a senha atual */
  isNewUser: boolean;
}

function AcceptInvitePage() {
  const { token } = Route.useSearch();

  const [invite,  setInvite]  = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPw,          setShowPw]          = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    if (!token) { setLoadError("Convite inválido."); setLoading(false); return; }

    fetch(`/api/store-users/invite-info?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json() as { invite?: InviteInfo; error?: string };
        if (!r.ok || !data.invite) {
          setLoadError(data.error ?? "Convite inválido ou expirado.");
          return;
        }
        setInvite(data.invite);
      })
      .catch(() => setLoadError("Erro de conexão. Tente novamente."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    if (invite.isNewUser) {
      if (password.length < 8)         { setError("A senha deve ter no mínimo 8 caracteres"); return; }
      if (password !== confirmPassword) { setError("As senhas não coincidem"); return; }
    } else if (!currentPassword) {
      setError("Informe sua senha atual do Armazix");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/store-users/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          invite.isNewUser ? { token, password } : { token, currentPassword },
        ),
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok) { setError(data.error ?? "Não foi possível aceitar o convite"); return; }
      setSuccess(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Carregando ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Convite inválido ──────────────────────────────────────────────────────
  if (loadError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Convite indisponível</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {loadError || "Este convite não é mais válido."}
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Convites expiram em 7 dias. Peça um novo para quem administra a loja.
          </p>
          <Link to="/login">
            <Button variant="outline" className="mt-6 h-11 rounded-xl">Ir para login</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Aceito ────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center max-w-sm"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-primary flex items-center justify-center shadow-glow mb-6">
            <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Tudo certo!</h1>
          <p className="text-muted-foreground mt-2">
            Você agora faz parte da equipe de <strong className="text-foreground">{invite.storeName}</strong>.
          </p>
          <Link to="/login">
            <Button className="mt-6 h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
              Entrar no painel
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Formulário de aceite ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2.5 mb-8">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <ShoppingBag className="w-5 h-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">ARMAZIX</span>
        </div>

        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center">Convite para equipe</h1>
        <p className="text-sm text-muted-foreground text-center mt-2">
          <strong className="text-foreground">{invite.storeName}</strong> convidou você como{" "}
          <strong className="text-foreground">{invite.roleLabel}</strong>.
        </p>

        <div className="mt-5 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Seu acesso</p>
          <p className="text-sm font-medium mt-0.5 break-all">{invite.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {invite.isNewUser ? (
            <>
              <div className="space-y-2">
                <Label>Crie sua senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    className="pl-10 pr-10 h-11 rounded-xl"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use maiúscula, minúscula, número e caractere especial.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                    className="pl-10 h-11 rounded-xl"
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Sua senha do Armazix</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Senha da sua conta"
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setError(""); }}
                  className="pl-10 pr-10 h-11 rounded-xl"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Este e-mail já tem conta no Armazix. Confirme com a senha que você já usa —
                ela não será alterada.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Aceitando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Aceitar convite
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Não esperava este convite? É só ignorar — nada acontece sem você aceitar.
        </p>
      </motion.div>
    </div>
  );
}
