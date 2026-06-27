import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Truck, Package, CreditCard, Smartphone, Banknote, CheckCircle2, ChevronRight, ChevronLeft, Loader2, ShoppingBag, Tag, X, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useStore } from "../store";
import { formatPrice, DEFAULT_PAYMENT_METHODS, type PaymentMethodConfig } from "@/lib/store-context";

export const Route = createFileRoute("/store/checkout")({
  component: CheckoutPage,
});

const STEPS = ["Endereço", "Entrega", "Pagamento", "Confirmação"];

function CheckoutPage() {
  const [step, setStep] = useState(0);
  const { store, cart, cartTotal, clearCart } = useStore();
  const [address, setAddress] = useState({ zip: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
  const [cepLoading, setCepLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [installments, setInstallments] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponApplied, setCouponApplied] = useState("");

  const storeDeliveryFee = deliveryType === "delivery" ? parseFloat(store?.deliveryFee || "0") : 0;
  const orderTotal = cartTotal + storeDeliveryFee - couponDiscount;

  // CEP autocomplete
  const handleCepChange = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    setAddress(a => ({ ...a, zip: clean }));
    if (clean.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`/api/validate-cep?cep=${clean}`);
        const data = await res.json();
        if (data.logradouro) {
          setAddress(a => ({ ...a, street: data.logradouro, neighborhood: data.bairro || a.neighborhood, city: data.localidade || a.city, state: data.uf || a.state }));
        }
      } catch {} finally { setCepLoading(false); }
    }
  };

  // Coupon validation via public endpoint
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !store?.id) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await fetch(
        `/api/coupons/validate?storeId=${store.id}&code=${encodeURIComponent(couponCode.trim())}&orderValue=${cartTotal.toFixed(2)}`
      );
      const data = await res.json();
      if (!res.ok) { setCouponError(data.error || "Cupom inválido"); return; }
      setCouponDiscount(parseFloat(data.discountValue));
      setCouponApplied(data.code);
    } catch { setCouponError("Erro ao validar cupom"); }
    finally { setCouponLoading(false); }
  };

  const removeCoupon = () => { setCouponDiscount(0); setCouponApplied(""); setCouponCode(""); setCouponError(""); };

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
          <div className="space-y-3">
            {/* CEP */}
            <div className="relative">
              <label className="text-xs font-medium text-muted-foreground">CEP</label>
              <div className="relative mt-1">
                <input
                  value={address.zip}
                  onChange={e => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {cepLoading && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            {/* Street + Number */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Rua</label>
                <input value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} placeholder="Rua das Flores" className="w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Número</label>
                <input value={address.number} onChange={e => setAddress(a => ({ ...a, number: e.target.value }))} placeholder="123" className="w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            {/* Complement + Neighborhood */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Complemento</label>
                <input value={address.complement} onChange={e => setAddress(a => ({ ...a, complement: e.target.value }))} placeholder="Apto, Bloco..." className="w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bairro</label>
                <input value={address.neighborhood} onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))} placeholder="Centro" className="w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            {/* City + State */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <input value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} placeholder="São Paulo" className="w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">UF</label>
                <input value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} placeholder="SP" maxLength={2} className="w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
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
              <span className="text-sm font-bold text-primary">
                {storeDeliveryFee === 0 ? "Grátis" : `R$ ${formatPrice(storeDeliveryFee)}`}
              </span>
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

          {/* Coupon */}
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2">Cupom de desconto</h3>
            {couponApplied ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">{couponApplied}</span>
                  <span className="text-xs text-muted-foreground">−R$ {formatPrice(couponDiscount)}</span>
                </div>
                <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                  placeholder="Código do cupom"
                  className="flex-1 h-10 rounded-xl border border-border/50 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button variant="outline" onClick={handleApplyCoupon} disabled={couponLoading} className="h-10 rounded-xl px-4 shrink-0">
                  {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
            {couponError && <p className="text-xs text-destructive mt-1">{couponError}</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Forma de pagamento</h2>
          {(() => {
            const paymentConfig: PaymentMethodConfig[] =
              store?.paymentMethodsConfig?.length
                ? (store.paymentMethodsConfig as PaymentMethodConfig[])
                : DEFAULT_PAYMENT_METHODS;

            // Global delivery payment toggle (default true if not set)
            const deliveryOk = (store as { deliveryPaymentEnabled?: boolean | null } | null)?.deliveryPaymentEnabled !== false;

            const METHOD_ICONS: Record<string, React.ElementType> = {
              cash: Banknote, pix: QrCode, card: CreditCard, debit: CreditCard, mercadopago: ShoppingBag,
            };
            const METHOD_DESC: Record<string, string> = {
              cash: "Pagar na entrega",
              pix: "Pagar na entrega",
              card: "Crédito — pagar na entrega",
              debit: "Débito — pagar na entrega",
              mercadopago: "Cartão, PIX, boleto e mais",
            };

            const selectedConfig = paymentConfig.find(m => m.key === paymentMethod);

            // MP always available if enabled; non-MP only if deliveryPaymentEnabled
            const availableMethods = paymentConfig.filter(m =>
              m.enabled && (m.key === "mercadopago" || deliveryOk)
            );

            return (
              <div className="space-y-3">
                <div className="space-y-2">
                  {availableMethods.map((m) => {
                    const Icon = METHOD_ICONS[m.key] ?? CreditCard;
                    return (
                      <button
                        key={m.key}
                        onClick={() => { setPaymentMethod(m.key); setInstallments(1); }}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                          paymentMethod === m.key ? "border-primary bg-primary/5" : "border-border/50"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === m.key ? "bg-primary/15" : "bg-secondary"}`}>
                          <Icon className={`w-5 h-5 ${paymentMethod === m.key ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold">{m.label}</p>
                          <p className="text-xs text-muted-foreground">{METHOD_DESC[m.key] ?? ""}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          paymentMethod === m.key ? "border-primary" : "border-border"
                        }`}>
                          {paymentMethod === m.key && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Seletor de parcelas */}
                {selectedConfig && selectedConfig.maxInstallments > 1 && selectedConfig.key !== "mercadopago" && (
                  <div className="pt-1 space-y-2">
                    <p className="text-sm font-semibold">Parcelamento</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: selectedConfig.maxInstallments }, (_, i) => i + 1).map(n => (
                        <button key={n} onClick={() => setInstallments(n)}
                          className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                            installments === n ? "border-primary bg-primary/5 text-primary" : "border-border/50 text-muted-foreground"
                          }`}>
                          {n === 1 ? `À vista — R$ ${formatPrice(orderTotal)}` : `${n}x de R$ ${formatPrice(orderTotal / n)}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Resumo do pedido</h2>
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    : <span className="text-lg">{item.emoji || "📦"}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.additions && item.additions.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">{item.additions.map(a => a.name).join(", ")}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{item.qty}x · R$ {formatPrice(item.price)}</p>
                </div>
                <span className="text-sm font-bold">R$ {formatPrice(item.price * item.qty)}</span>
              </div>
            ))}
            <div className="border-t border-border/50 pt-2 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {formatPrice(cartTotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {couponApplied}</span>
                  <span>−R$ {formatPrice(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entrega ({deliveryType === "delivery" ? "Delivery" : "Retirada"})</span>
                {storeDeliveryFee === 0
                  ? <span className="text-primary font-medium">Grátis</span>
                  : <span>R$ {formatPrice(storeDeliveryFee)}</span>
                }
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-border/50">
                <span>Total</span>
                <span>R$ {formatPrice(orderTotal)}</span>
              </div>
            </div>
            <div className="border-t border-border/50 pt-2 space-y-1 text-xs text-muted-foreground">
              {deliveryType === "delivery" && address.street && <p>📍 {address.street}, {address.number} — {address.neighborhood}, {address.city}</p>}
              <p>🚚 {deliveryType === "delivery" ? `Delivery · ${store?.deliveryEstimate || "30-50 min"}` : "Retirada — pronto em 20 min"}</p>
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
            disabled={
              (step === 0 && deliveryType === "delivery" && (!address.street || !address.number)) ||
              (step === 2 && !paymentMethod)
            }
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
                const storeId = store?.id || localStorage.getItem("storeId");
                if (!storeId) { setOrderError("Loja não encontrada"); setSubmitting(false); return; }

                const items = cart.map(item => ({
                  productId: item.id,
                  productName: item.name,
                  productEmoji: item.emoji || item.image || "📦",
                  quantity: item.qty,
                  unitPrice: item.price.toFixed(2),
                  additionsTotal: item.additions ? item.additions.reduce((s, a) => s + a.price, 0).toFixed(2) : "0",
                  total: (item.price * item.qty).toFixed(2),
                  additionsSnapshot: item.additions || [],
                  notes: item.obs || undefined,
                }));

                const addressSnapshot = deliveryType === "delivery" ? {
                  street: address.street, number: address.number,
                  neighborhood: address.neighborhood, city: address.city,
                  state: address.state || "SP", zip: address.zip,
                  complement: address.complement || undefined,
                } : undefined;

                // ── Mercado Pago Checkout Pro ─────────────────────
                if (paymentMethod === "mercadopago") {
                  const res = await api.post("/api/payments/mp-checkout", {
                    storeId,
                    type: deliveryType,
                    items,
                    subtotal: cartTotal.toFixed(2),
                    deliveryFee: storeDeliveryFee.toFixed(2),
                    discount: couponDiscount.toFixed(2),
                    total: orderTotal.toFixed(2),
                    addressSnapshot,
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
                  installments: installments > 1 ? installments : undefined,
                  items,
                  subtotal: cartTotal.toFixed(2),
                  deliveryFee: storeDeliveryFee.toFixed(2),
                  discount: couponDiscount.toFixed(2),
                  total: orderTotal.toFixed(2),
                  addressSnapshot,
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
