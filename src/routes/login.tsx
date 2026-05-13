import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  BarChart3,
  Package,
  TrendingUp,
  Bell,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Entrar — ARMAZIX" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNeedsVerification(false);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.needsVerification) {
          setNeedsVerification(true);
          setUnverifiedEmail(data.email || email);
        } else {
          setError(data.error || "Erro ao fazer login");
        }
        return;
      }

      // Store token and fetch user's store
      localStorage.setItem("armazix_token", data.token);
      localStorage.setItem("userId", data.user.id);
      
      // Fetch user's store
      try {
        const storeRes = await fetch(`/api/store/user?userId=${data.user.id}`);
        const storeData = await storeRes.json();
        if (storeRes.ok && storeData.store) {
          localStorage.setItem("storeId", storeData.store.id);
        }
      } catch (err) {
        console.error("Error fetching store:", err);
      }
      
      navigate({ to: "/admin/dashboard" });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side — Preview */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 items-center justify-center p-12">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-primary opacity-[0.06] blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative w-full max-w-lg"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ShoppingBag className="w-6 h-6" />
            </span>
            <span className="text-2xl font-bold tracking-tight">ARMAZIX</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Gerencie sua loja com{" "}
            <span className="text-gradient-primary">simplicidade</span>
          </h2>
          <p className="text-muted-foreground mb-8">
            Tudo o que você precisa para vender mais, em um único painel.
          </p>

          {/* Dashboard Preview Card */}
          <div className="bg-surface rounded-2xl border border-border/60 shadow-soft p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Visão Geral</span>
              <span className="text-xs text-muted-foreground">Hoje</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <PreviewCard icon={TrendingUp} label="Vendas" value="R$ 4.280" color="text-primary" />
              <PreviewCard icon={Package} label="Pedidos" value="47" color="text-blue-500" />
              <PreviewCard icon={BarChart3} label="Ticket" value="R$ 91" color="text-amber-500" />
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "72%" }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-primary"
              />
            </div>
          </div>

          {/* Floating notification */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute right-0 lg:-right-4 -top-2 glass rounded-2xl p-3 pr-4 shadow-soft border border-border/60 flex items-center gap-3 z-10 max-w-[200px]"
          >
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-primary text-primary-foreground flex-shrink-0">
              <Bell className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Novo Pedido</div>
              <div className="text-sm font-semibold truncate">#3208 • R$ 189,90</div>
            </div>
          </motion.div>

          {/* Floating revenue card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.3, duration: 0.5 }}
            className="absolute left-0 lg:-left-4 -bottom-2 glass rounded-2xl p-3 pr-4 shadow-soft border border-border/60 z-10"
          >
            <div className="text-xs text-muted-foreground">Venda via PIX</div>
            <div className="text-lg font-bold text-gradient-primary">R$ 1.249,00</div>
          </motion.div>
        </motion.div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">ARMAZIX</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Entre na sua conta para acessar o painel
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
              />
              <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
                Lembrar meu login
              </Label>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
                {error}
              </div>
            )}

            {needsVerification && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700">Email não verificado</p>
                    <p className="text-xs text-amber-600/80 mt-0.5">
                      Verifique sua caixa de entrada e insira o código de verificação para ativar sua conta.
                    </p>
                    <Link
                      to="/verify-email"
                      search={{ email: unverifiedEmail }}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Verificar email <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform"
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando...
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    Entrar no painel
                    <ArrowRight className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link
                to="/register"
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Criar conta grátis
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function PreviewCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3 text-center space-y-1">
      <Icon className={`w-5 h-5 mx-auto ${color}`} />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}
