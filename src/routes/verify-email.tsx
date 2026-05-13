import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShoppingBag, Mail, Loader2, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
  head: () => ({
    meta: [{ title: "Verificar email — ARMAZIX" }],
  }),
  validateSearch: (search: Record<string, string>) => ({
    email: search.email || "",
  }),
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (newCode.every((d) => d !== "") && value) {
      handleSubmit(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (codeStr?: string) => {
    const finalCode = codeStr || code.join("");
    if (finalCode.length !== 6) {
      setError("Digite o código completo de 6 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Código inválido");
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate({ to: "/login" }), 2000);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || !email) return;
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setCountdown(60);
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-primary flex items-center justify-center shadow-glow mb-6">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold">Email verificado!</h1>
          <p className="text-muted-foreground mt-2">Redirecionando para o login...</p>
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

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center">Verifique seu email</h1>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Enviamos um código de 6 dígitos para
          <br />
          <strong className="text-foreground">{email || "seu email"}</strong>
        </p>

        {/* Code inputs */}
        <div className="flex gap-2 justify-center mt-8" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <Input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl ${
                error ? "border-destructive" : digit ? "border-primary" : ""
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center mt-3">{error}</p>
        )}

        {/* Submit */}
        <Button
          onClick={() => handleSubmit()}
          disabled={loading || code.some((d) => !d)}
          className="w-full h-11 mt-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Verificar email
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>

        {/* Resend */}
        <div className="text-center mt-4">
          <button
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {countdown > 0
              ? `Reenviar em ${countdown}s`
              : resending
              ? "Enviando..."
              : "Reenviar código"}
          </button>
        </div>

        {/* Back to login */}
        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Voltar ao login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
