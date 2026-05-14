import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Truck, Package, CreditCard, Smartphone, Banknote, CheckCircle2, ChevronRight, ChevronLeft, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useStore } from "../store";

export const Route = createFileRoute("/store/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [{ title: "Checkout — Mercado do Zé" }],
  }),
});

const STEPS = ["Endereço", "Entrega", "Pagamento", "Confirmação"];

function CheckoutPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const { cart, cartTotal, clearCart } = useStore();
  const [address, setAddress] = useState({ street: "Rua das Flores", number: "120", neighborhood: "Centro", city: "São Paulo" });
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");

  if (cart.length === 0 && !confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="text-sm text-muted-foreground">Seu carrinho está vazio</p>
        <Link to="/store" className="mt-3 text-sm font-semibold text-primary">Voltar à loja</Link>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow mb-5">
          <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Pedido confirmado!</h1>
        {orderNumber ? (
          <p className="text-sm text-muted-foreground mt-2">Seu pedido #{orderNumber} foi recebido com sucesso</p>
        ) : orderError ? (
          <p className="text-sm text-destructive mt-2">{orderError}</p>
        ) : null}
        <Badge className="mt-3 rounded-full bg-primary/15 text-primary text-sm px-4 py-1">Previsão: 35-50 min</Badge>
        <div className="mt-6 w-full max-w-sm">
          <Link to="/store">
            <Button className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
              Continuar comprando
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 animate-in fade-in duration-300">
      {/* Steps */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-[11px] font-medium truncate ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < 3 && <div className={`flex-1 h-0.5 rounded-full ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Endereço de entrega</h2>
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">{address.street}, {address.number}</p>
                <p className="text-xs text-muted-foreground">{address.neighborhood} — {address.city}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl text-xs">
              Alterar endereço
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Tipo de entrega</h2>
          <div className="space-y-2">
            <button
              onClick={() => setDeliveryType("delivery")}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                deliveryType === "delivery" ? "border-primary bg-primary/5" : "border-border/50"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${deliveryType === "delivery" ? "bg-primary/15" : "bg-secondary"}`}>
                <Truck className={`w-5 h-5 ${deliveryType === "delivery" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">Delivery</p>
                <p className="text-xs text-muted-foreground">30-50 minutos</p>
              </div>
              <span className="text-sm font-bold text-primary">Grátis</span>
            </button>
            <button
              onClick={() => setDeliveryType("pickup")}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                deliveryType === "pickup" ? "border-primary bg-primary/5" : "border-border/50"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${deliveryType === "pickup" ? "bg-primary/15" : "bg-secondary"}`}>
                <Package className={`w-5 h-5 ${deliveryType === "pickup" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">Retirada na loja</p>
                <p className="text-xs text-muted-foreground">Pronto em 20 min</p>
              </div>
              <span className="text-sm font-bold text-primary">Grátis</span>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Forma de pagamento</h2>
          <div className="space-y-2">
            {[
              { key: "mercadopago", label: "Mercado Pago", desc: "Cartão, PIX, boleto e mais", icon: ShoppingBag },
              { key: "pix", label: "PIX (na entrega)", desc: "Pagamento na entrega", icon: Smartphone },
              { key: "card", label: "Cartão de crédito", desc: "Visa, Master, Elo", icon: CreditCard },
              { key: "cash", label: "Dinheiro", desc: "Troco para quanto?", icon: Banknote },
            ].map((method) => (
              <button
                key={method.key}
                onClick={() => setPaymentMethod(method.key)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                  paymentMethod === method.key ? "border-primary bg-primary/5" : "border-border/50"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === method.key ? "bg-primary/15" : "bg-secondary"}`}>
                  <method.icon className={`w-5 h-5 ${paymentMethod === method.key ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold">{method.label}</p>
                  <p className="text-xs text-muted-foreground">{method.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === method.key ? "border-primary" : "border-border"
                }`}>
                  {paymentMethod === method.key && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Resumo do pedido</h2>
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-lg">{item.image}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.qty}x</p>
                </div>
                <span className="text-sm font-bold">R$ {(item.price * item.qty).toFixed(2).replace(".", ",")}</span>
              </div>
            ))}
            <div className="border-t border-border/50 pt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entrega ({deliveryType === "delivery" ? "Delivery" : "Retirada"})</span>
                <span className="text-primary font-medium">Grátis</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1">
                <span>Total</span>
                <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
            <div className="border-t border-border/50 pt-2 space-y-1.5 text-xs text-muted-foreground">
              <p>📍 {address.street}, {address.number}</p>
              <p>🚚 {deliveryType === "delivery" ? "Delivery — 30-50 min" : "Retirada — 20 min"}</p>
              <p>💳 {paymentMethod === "pix" ? "PIX (na entrega)" : paymentMethod === "card" ? "Cartão de crédito" : paymentMethod === "mercadopago" ? "Mercado Pago" : "Dinheiro"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-11 rounded-2xl font-semibold">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        )}
        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 2 && !paymentMethod}
            className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            Continuar <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={async () => {
              if (submitting) return;
              setSubmitting(true);
              setOrderError("");
              try {
                const storeId = localStorage.getItem("storeId");
                if (!storeId) { setOrderError("Loja não encontrada"); setSubmitting(false); return; }

                const items = cart.map(item => ({
                  productId: String(item.id),
                  productName: item.name,
                  productEmoji: item.image,
                  quantity: item.qty,
                  unitPrice: item.price.toFixed(2),
                  total: (item.price * item.qty).toFixed(2),
                }));

                // ── Mercado Pago Checkout Pro ─────────────────────
                if (paymentMethod === "mercadopago") {
                  const res = await api.post("/api/payments/mp-checkout", {
                    storeId,
                    type: deliveryType,
                    items,
                    subtotal: cartTotal.toFixed(2),
                    deliveryFee: "0",
                    total: cartTotal.toFixed(2),
                    addressSnapshot: {
                      street: address.street,
                      number: address.number,
                      neighborhood: address.neighborhood,
                      city: address.city,
                      state: "SP",
                      zip: "",
                    },
                    estimatedDelivery: new Date(Date.now() + (deliveryType === "delivery" ? 40 : 20) * 60000).toISOString(),
                  }, { skipCsrf: true });
                  const data = await res.json();
                  if (res.ok && data.init_point) {
                    clearCart();
                    window.location.href = data.init_point;
                    return;
                  } else {
                    setOrderError(data.error || "Erro ao iniciar pagamento no Mercado Pago");
                    setSubmitting(false);
                    return;
                  }
                }

                // ── Other payment methods (cash, card on delivery, pix) ──
                const res = await api.post("/api/orders/create", {
                  storeId,
                  type: deliveryType,
                  paymentMethod,
                  items,
                  subtotal: cartTotal.toFixed(2),
                  deliveryFee: "0",
                  total: cartTotal.toFixed(2),
                  addressSnapshot: {
                    street: address.street,
                    number: address.number,
                    neighborhood: address.neighborhood,
                    city: address.city,
                    state: "SP",
                    zip: "",
                  },
                  estimatedDelivery: new Date(Date.now() + (deliveryType === "delivery" ? 40 : 20) * 60000).toISOString(),
                }, { skipCsrf: true });
                const data = await res.json();
                if (res.ok && data.success) {
                  setOrderNumber(data.order.number);
                  clearCart();
                  setConfirmed(true);
                } else {
                  setOrderError(data.error || "Erro ao criar pedido");
                }
              } catch {
                setOrderError("Erro de conexão");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar pedido"}
          </Button>
        )}
      </div>
    </div>
  );
}
