import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MessageCircle, Loader2, ArrowLeft } from "lucide-react";

interface PhoneAuthModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  onSuccess: (token: string, name: string, isNew: boolean) => void;
}

export function PhoneAuthModal({ open, onOpenChange, storeId, onSuccess }: PhoneAuthModalProps) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setOtp("");
      setError("");
      setPhone("");
    }
  }, [open]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const requestCode = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Digite um telefone válido com DDD"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: digits, storeId }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setStep("code");
        setCountdown(60);
      } else {
        setError(data.error || "Erro ao enviar código");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = useCallback(async (codeOverride?: string) => {
    const code = (codeOverride ?? otp).replace(/\D/g, "");
    if (code.length !== 6) { setError("Digite os 6 dígitos do código"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), storeId, code }),
      });
      const data = await res.json() as {
        token?: string;
        customer?: { name: string; isNew?: boolean };
        error?: string;
      };
      if (res.ok && data.token) {
        onSuccess(data.token, data.customer?.name || "", data.customer?.isNew ?? false);
        onOpenChange(false);
      } else {
        setError(data.error || "Código inválido");
        setOtp("");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [otp, phone, storeId, onSuccess, onOpenChange]);

  // Auto-submit ao digitar o 6º dígito
  useEffect(() => {
    if (otp.length === 6 && !loading) verifyCode(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const maskedPhone = (() => {
    const d = phone.replace(/\D/g, "");
    if (d.length >= 10) {
      const area = d.slice(0, 2);
      const num = d.slice(2);
      return `(${area}) ${num.slice(0, -4).replace(/./g, "*")}${num.slice(-4)}`;
    }
    return phone;
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92dvh] overflow-y-auto">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-lg">
            {step === "phone" ? "Entrar com Telefone" : "Confirmar código"}
          </SheetTitle>
        </SheetHeader>

        {step === "phone" ? (
          <div className="space-y-4 pt-2 pb-6">
            <p className="text-sm text-muted-foreground">
              Informe seu WhatsApp e enviaremos um código de confirmação.
            </p>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                WhatsApp com DDD
              </label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestCode()}
                className="w-full h-12 rounded-xl border border-border bg-surface px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              onClick={requestCode}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <MessageCircle className="w-4 h-4" />
              }
              Receber código via WhatsApp
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-2 pb-6">
            <p className="text-sm text-muted-foreground">
              Enviamos um código de 6 dígitos para{" "}
              <span className="font-medium text-foreground">{maskedPhone}</span>.
            </p>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Código de verificação
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full h-14 rounded-xl border border-border bg-surface px-4 text-2xl font-bold tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              onClick={() => verifyCode()}
              disabled={loading || otp.length < 6}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar código
            </button>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Alterar número
              </button>

              {countdown > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Reenviar código em {countdown}s
                </p>
              ) : (
                <button
                  onClick={requestCode}
                  disabled={loading}
                  className="text-sm text-primary font-medium disabled:opacity-50"
                >
                  Reenviar código
                </button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
