import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CreditCard,
  Smartphone,
  Building2,
  Clock,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  X,
  QrCode,
  Copy,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";

// ─── Types ───────────────────────────────────────────────────────
interface PlanDef {
  id: string;
  name: string;
  price: number;
  pixPrice: number;
  description: string;
  features: { text: string; included: boolean }[];
  color: string;
  badge: string | null;
}

interface PixPaymentData {
  paymentId: number;
  qrCode: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  totalAmount: number;
  expiresAt: string;
  planName: string;
}

interface SubStatus {
  plan: string;
  planStatus: string;
  planExpiresAt: string | null;
  paymentMethod: string;
  pdvEnabled: boolean;
  mpPaymentId: string | null;
  amountPaid: string | null;
  paymentStatus: string | null;
}

const PLANS_DEF: PlanDef[] = [
  {
    id: "free", name: "Teste Grátis", price: 0, pixPrice: 0,
    description: "10 dias sem compromisso",
    features: [
      { text: "Acesso completo por 10 dias", included: true },
      { text: "Até 15 produtos", included: true },
      { text: "Pedidos online", included: true },
      { text: "Relatórios básicos", included: true },
      { text: "1 usuário", included: true },
      { text: "Suporte por email", included: true },
    ],
    color: "border-border", badge: null,
  },
  {
    id: "start", name: "Start", price: 79.90, pixPrice: 84.90,
    description: "O essencial para crescer",
    features: [
      { text: "Até 25 produtos", included: true },
      { text: "Pedidos online + Delivery", included: true },
      { text: "Relatórios básicos", included: true },
      { text: "1 usuário", included: true },
      { text: "Suporte por email", included: true },
    ],
    color: "border-blue-400", badge: null,
  },
  {
    id: "pro", name: "Pro", price: 149.90, pixPrice: 154.90,
    description: "Controle total do negócio",
    features: [
      { text: "Até 70 produtos", included: true },
      { text: "Pedidos online + Delivery", included: true },
      { text: "Relatórios avançados", included: true },
      { text: "Até 3 usuários", included: true },
      { text: "Ponto de Venda (PDV) incluso", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    color: "border-primary shadow-glow", badge: "Mais escolhido",
  },
  {
    id: "full", name: "Full", price: 249.90, pixPrice: 254.90,
    description: "Liberdade e escala total",
    features: [
      { text: "Produtos ilimitados", included: true },
      { text: "Pedidos online + Delivery", included: true },
      { text: "Relatórios avançados", included: true },
      { text: "Usuários ilimitados", included: true },
      { text: "Ponto de Venda (PDV) incluso", included: true },
      { text: "Suporte prioritário VIP", included: true },
    ],
    color: "border-amber-500", badge: "Premium",
  },
];
const fmtPrice = (v: number) => v.toFixed(2).replace(".", ",");

// ─── Plans Section Component ─────────────────────────────────────
export function PlansSection() {
  const [status, setStatus] = useState<SubStatus>({
    plan: "free", planStatus: "active", planExpiresAt: null,
    paymentMethod: "card_recurring", pdvEnabled: false,
    mpPaymentId: null, amountPaid: null, paymentStatus: null,
  });
  const [statusLoading, setStatusLoading] = useState(true);
  const [subError, setSubError] = useState("");
  const [paymentModalPlan, setPaymentModalPlan] = useState<PlanDef | null>(null);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  // Card redirect countdown
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [initPoint, setInitPoint] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = () => {
    api.get("/api/subscriptions/status")
      .then(r => r.json())
      .then((d: Partial<SubStatus>) => {
        setStatus({
          plan: d.plan || "free",
          planStatus: d.planStatus || "active",
          planExpiresAt: d.planExpiresAt ?? null,
          paymentMethod: d.paymentMethod || "card_recurring",
          pdvEnabled: d.pdvEnabled ?? false,
          mpPaymentId: d.mpPaymentId ?? null,
          amountPaid: d.amountPaid ?? null,
          paymentStatus: d.paymentStatus ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const getPayerInfo = async () => {
    const res = await api.get("/api/user/get");
    if (!res.ok) return null;
    const data = await res.json() as { user?: { email?: string; name?: string } };
    return { email: data.user?.email || "", name: data.user?.name || "" };
  };

  const handleCardPayment = async (plan: PlanDef, withPdv: boolean) => {
    setSubError("");
    setPaymentModalPlan(null);
    try {
      const payer = await getPayerInfo();
      if (!payer?.email) { setSubError("Email não encontrado. Faça login novamente."); return; }
      const res = await api.post("/api/subscriptions/create", {
        planId: plan.id, withPdv, payerEmail: payer.email, payerName: payer.name,
      });
      const data = await res.json() as { init_point?: string; error?: string };
      if (res.ok && data.init_point) {
        setInitPoint(data.init_point);
        setConfirmPlan(plan.name);
        setCountdown(5);
        countdownRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) { clearInterval(countdownRef.current!); window.location.href = data.init_point!; return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        setSubError(data.error || "Erro ao iniciar assinatura");
      }
    } catch { setSubError("Erro de conexão"); }
  };

  const handlePixPayment = async (plan: PlanDef, withPdv: boolean) => {
    setSubError("");
    setPaymentModalPlan(null);
    try {
      const payer = await getPayerInfo();
      if (!payer?.email) { setSubError("Email não encontrado. Faça login novamente."); return; }
      const res = await api.post("/api/subscriptions/create-pix", {
        planId: plan.id, withPdv, payerEmail: payer.email, payerName: payer.name,
      });
      const data = await res.json() as { qrCode?: string; qrCodeBase64?: string; ticketUrl?: string; totalAmount?: number; expiresAt?: string; paymentId?: number; error?: string };
      if (res.ok && data.qrCode) {
        setPixData({
          paymentId: data.paymentId!,
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          ticketUrl: data.ticketUrl,
          totalAmount: data.totalAmount!,
          expiresAt: data.expiresAt!,
          planName: plan.name,
        });
      } else {
        setSubError(data.error || "Erro ao gerar cobrança PIX");
      }
    } catch { setSubError("Erro de conexão"); }
  };

  const cancelRedirect = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setConfirmPlan(null); setInitPoint(null); setCountdown(5);
  };

  const currentPlanDef = PLANS_DEF.find(p => p.id === status.plan) || PLANS_DEF[0];

  const planStatusBadge: Record<string, { label: string; cls: string }> = {
    active:    { label: "Ativo",                cls: "bg-primary text-primary-foreground" },
    pending:   { label: "Aguardando pagamento", cls: "bg-yellow-500 text-white" },
    expired:   { label: "Expirado",             cls: "bg-destructive text-destructive-foreground" },
    paused:    { label: "Pausado",              cls: "bg-orange-500 text-white" },
    cancelled: { label: "Cancelado",            cls: "bg-muted text-muted-foreground" },
  };
  const badge = planStatusBadge[status.planStatus] || { label: status.planStatus, cls: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card className="rounded-2xl border-border/50 shadow-soft bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-5">
          {statusLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-28 rounded bg-muted animate-pulse" />
                <div className="h-3 w-40 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Plano atual</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{currentPlanDef.name}</p>
                  <Badge className={`rounded-full text-xs ${badge.cls}`}>{badge.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {currentPlanDef.price > 0 && (
                    <span className="flex items-center gap-1.5">
                      {status.paymentMethod === "pix_manual"
                        ? <Smartphone className="w-3.5 h-3.5" />
                        : <CreditCard className="w-3.5 h-3.5" />}
                      {status.paymentMethod === "pix_manual" ? "PIX mensal" : "Cartão recorrente"}
                    </span>
                  )}
                  {status.pdvEnabled && (
                    <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />PDV incluído</span>
                  )}
                  {status.planExpiresAt && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Vence {new Date(status.planExpiresAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {status.amountPaid && (
                    <span className="text-xs">Último pagamento: R$ {Number(status.amountPaid).toFixed(2).replace(".", ",")}</span>
                  )}
                </div>
              </div>
              {status.paymentMethod === "pix_manual" && currentPlanDef.price > 0 && (
                <Button
                  size="sm" variant="outline"
                  className="shrink-0 rounded-xl h-9 gap-1.5 text-sm"
                  onClick={() => setPaymentModalPlan(currentPlanDef)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Renovar PIX
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {subError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {subError}
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid gap-4">
        {PLANS_DEF.map((plan) => {
          const isCurrent = status.plan === plan.id;
          return (
            <Card key={plan.id} className={`rounded-2xl border-2 shadow-soft transition-all ${isCurrent ? plan.color : "border-border hover:border-border/80"}`}>
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold">{plan.name}</span>
                      {plan.badge && <Badge className="rounded-full text-[10px] px-2">{plan.badge}</Badge>}
                      {isCurrent && <Badge variant="outline" className="rounded-full text-[10px] px-2 border-primary text-primary">Atual</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {plan.price === 0 ? (
                      <div className="text-xl font-bold">Gratuito</div>
                    ) : (
                      <>
                        <div className="text-xl font-bold">R$ {fmtPrice(plan.price)}</div>
                        <div className="text-xs text-muted-foreground">/mês no cartão</div>
                        <div className="text-xs text-primary font-semibold mt-0.5">
                          R$ {fmtPrice(plan.pixPrice)} via PIX
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Features */}
                <div className="grid sm:grid-cols-2 gap-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {f.included
                        ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        : <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                      <span className={f.included ? "" : "text-muted-foreground"}>{f.text}</span>
                    </div>
                  ))}
                </div>
                {/* CTA */}
                {isCurrent ? (
                  <Button disabled className="w-full h-10 rounded-xl">Plano atual</Button>
                ) : plan.id === "free" ? (
                  <Button variant="outline" disabled className="w-full h-10 rounded-xl">Gratuito</Button>
                ) : (
                  <Button
                    onClick={() => { setSubError(""); setPaymentModalPlan(plan); }}

                    variant={plan.id === "pro" ? "default" : "outline"}
                    className={`w-full h-10 rounded-xl font-medium ${plan.id === "pro" ? "bg-gradient-primary shadow-glow" : ""}`}
                  >
                    {PLANS_DEF.findIndex(p => p.id === status.plan) < PLANS_DEF.findIndex(p => p.id === plan.id)
                      ? "Fazer upgrade" : "Fazer downgrade"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Cartão recorrente: renovação automática mensal. PIX mensal: validade de 30 dias, renovação manual.
        PDV incluso nos planos Pro e Full sem custo adicional.
      </p>

      {/* Payment Method Modal */}
      {paymentModalPlan && createPortal(
        <PaymentModal
          plan={paymentModalPlan}
          withPdv={false}
          onClose={() => setPaymentModalPlan(null)}
          onCard={handleCardPayment}
          onPix={handlePixPayment}
        />,
        document.body
      )}

      {/* Card Redirect Countdown */}
      {confirmPlan && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 5)}`}
                    strokeLinecap="round" className="text-primary transition-all duration-1000" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">{countdown}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">Redirecionando para o Mercado Pago</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Você será levado para a página de assinatura do plano{" "}
                  <span className="font-semibold text-foreground">{confirmPlan}</span>.
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={cancelRedirect}>Cancelar</Button>
                <Button className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow"
                  onClick={() => { if (initPoint) window.location.href = initPoint; }}>
                  Ir agora
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PIX QR Code Modal */}
      {pixData && createPortal(
        <PixModal
          data={pixData}
          onClose={() => {
            setPixData(null);
            loadStatus();
          }}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Payment Method Selection Modal ──────────────────────────────
function PaymentModal({
  plan, withPdv, onClose, onCard, onPix,
}: {
  plan: PlanDef;
  withPdv: boolean;
  onClose: () => void;
  onCard: (plan: PlanDef, withPdv: boolean) => void;
  onPix: (plan: PlanDef, withPdv: boolean) => void;
}) {
  const [selected, setSelected] = useState<"card" | "pix" | null>(null);
  const [loading, setLoading] = useState(false);

  const cardTotal = plan.price;
  const pixTotal  = plan.pixPrice;

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    if (selected === "card") { onCard(plan, withPdv); }
    else { onPix(plan, withPdv); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Forma de pagamento</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Plano <span className="font-semibold text-foreground">{plan.name}</span>{withPdv ? " + PDV" : ""}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-3">
          {/* Features summary */}
          <div className="p-3 rounded-xl bg-secondary/50 space-y-1">
            {plan.features.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{f.text}</span>
              </div>
            ))}
            {withPdv && (
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>PDV — Ponto de Venda</span>
              </div>
            )}
          </div>

          {/* Card option */}
          <button
            type="button"
            onClick={() => setSelected("card")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selected === "card" ? "border-primary bg-primary/5" : "border-border hover:border-border/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selected === "card" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Cartão de crédito</div>
                  <div className="text-xs text-muted-foreground">Renovação automática mensal</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">R$ {fmtPrice(cardTotal)}</div>
                <div className="text-xs text-muted-foreground">/mês</div>
              </div>
            </div>
          </button>

          {/* PIX option */}
          <button
            type="button"
            onClick={() => setSelected("pix")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selected === "pix" ? "border-primary bg-primary/5" : "border-border hover:border-border/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selected === "pix" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm">PIX mensal</div>
                  <div className="text-xs text-muted-foreground">Validade de 30 dias · renovação manual</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">R$ {fmtPrice(pixTotal)}</div>
                <div className="text-xs text-primary font-medium">+R$ 5,00</div>
              </div>
            </div>
          </button>

          {/* Price summary */}
          {selected && (
            <div className="p-3 rounded-xl bg-secondary/30 text-sm space-y-1 animate-in fade-in duration-150">
              <div className="flex justify-between text-muted-foreground">
                <span>Plano {plan.name}</span>
                <span>R$ {fmtPrice(selected === "card" ? plan.price : plan.pixPrice)}</span>
              </div>
              {selected === "pix" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa PIX</span>
                  <span>R$ 5,00</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>R$ {fmtPrice(selected === "card" ? cardTotal : pixTotal)}/mês</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
            disabled={!selected || loading}
            onClick={handleConfirm}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : selected === "pix" ? "Gerar QR Code PIX" : "Continuar para pagamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PIX QR Code Modal ────────────────────────────────────────────
function PixModal({ data, onClose }: { data: PixPaymentData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"approved" | "pending" | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await api.get("/api/subscriptions/status");
      const d = await res.json() as { planStatus?: string };
      setCheckResult(d.planStatus === "active" ? "approved" : "pending");
    } catch { setCheckResult("pending"); }
    finally { setChecking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Pagar via PIX</h2>
              <p className="text-xs text-muted-foreground">Plano {data.planName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="text-center py-1">
            <p className="text-xs text-muted-foreground">Valor a pagar</p>
            <p className="text-3xl font-bold">R$ {fmtPrice(data.totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vencimento da cobrança: {new Date(data.expiresAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>

          {/* QR Code Image */}
          {data.qrCodeBase64 ? (
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${data.qrCodeBase64}`}
                alt="QR Code PIX"
                className="w-48 h-48 rounded-xl border border-border"
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-xl border border-border bg-muted flex items-center justify-center">
                <QrCode className="w-16 h-16 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Copy paste */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Código PIX copia e cola</p>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 rounded-xl bg-muted text-xs font-mono truncate border border-border">
                {data.qrCode.slice(0, 40)}…
              </div>
              <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl shrink-0" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-medium">Como pagar:</p>
            <ol className="list-decimal list-inside space-y-0.5 opacity-90">
              <li>Abra o app do seu banco</li>
              <li>Acesse PIX → Pagar com QR Code ou Copia e Cola</li>
              <li>Após confirmação, seu plano será ativado em instantes</li>
            </ol>
          </div>

          {/* Check status */}
          {checkResult === "approved" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-700 dark:text-green-300">
              <Check className="w-4 h-4 shrink-0" />
              Pagamento confirmado! Seu plano foi ativado.
            </div>
          )}
          {checkResult === "pending" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-700 dark:text-yellow-300">
              <Clock className="w-4 h-4 shrink-0" />
              Pagamento ainda não confirmado. Aguarde alguns instantes.
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={onClose}>
            Fechar
          </Button>
          <Button
            className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground text-sm shadow-glow"
            disabled={checking}
            onClick={checkResult === "approved" ? onClose : handleCheckStatus}
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : checkResult === "approved" ? "Concluir" : "Verificar pagamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}
