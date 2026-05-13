import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShoppingBag, Mail, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [{ title: "Recuperar senha — ARMAZIX" }],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao processar solicitação");
        return;
      }

      setSent(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Código enviado!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Se <strong>{email}</strong> estiver cadastrado, você receberá um código de recuperação.
          </p>
          <Link to="/reset-password" search={{ email }}>
            <Button className="w-full h-11 mt-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
              Digitar código
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link to="/login" className="block mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Voltar ao login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <ShoppingBag className="w-5 h-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">ARMAZIX</span>
        </div>

        <h1 className="text-2xl font-bold">Esqueceu a senha?</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Informe seu email e enviaremos um código para redefinir sua senha.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 rounded-xl"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Enviar código
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Voltar ao login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
