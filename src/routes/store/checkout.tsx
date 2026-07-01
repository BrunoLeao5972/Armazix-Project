import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MapPin, Truck, Package, CreditCard, Banknote,
  CheckCircle2, ChevronRight, ChevronLeft, Loader2, ShoppingBag,
  Tag, X, QrCode, User, Phone, Building2, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useStore } from "../store";
import {
  formatPrice,
  DEFAULT_PAYMENT_METHODS,
  type PaymentMethodConfig,
  type DeliveryRule,
} from "@/lib/store-context";

export const Route = createFileRoute("/store/checkout")({
  component: CheckoutPage,
});

const STEPS = ["Identificação & Entrega", "Pagamento", "Confirmação"];

// ─── Masks ───────────────────────────────────────────────────────────────────
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// ─── Delivery fee engine ──────────────────────────────────────────────────────
interface FeeResult { taxa: number; isGratis: boolean; label: string }

function calcDeliveryFee(
  bairro: string,
  subtotal: number,
  taxaGlobal: number,
  freeAbove: number | null,
  regras: DeliveryRule[]
): FeeResult {
  const bairroKey = bairro.trim().toLowerCase();
  const regra = bairroKey
    ? regras.find(r => r.bairro.trim().toLowerCase() === bairroKey)
    : undefined;
  const taxa = regra !== undefined ? regra.taxa : taxaGlobal;
  if (freeAbove !== null && subtotal >= freeAbove) {
    return { taxa: 0, isGratis: true, label: "Frete Grátis!" };
  }
  if (taxa === 0) {
    return { taxa: 0, isGratis: true, label: "Grátis" };
  }
  return { taxa, isGratis: false, label: `R$ ${formatPrice(taxa)}` };
}

// ─── Step bar ─────────────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
            i <= current ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}>
            {i < current ? "✓" : i + 1}
          </div>
          <span className={`text-[10px] font-medium truncate ${i <= current ? "text-foreground" : "text-muted-foreground"}`}>
            {s}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 rounded-full shrink-0 ${i < current ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

// ─── Main component ───────────────────────────────────────────────────────────
function CheckoutPage() {
  const { store, cart, cartTotal, clearCart, configuracaoVitrine } = useStore();
  const [step, setStep] = useState(0);

  // identification
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  // delivery mode
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    store?.pickupEnabled === true && store?.deliveryEnabled === false ? "pickup" : "delivery"
  );

  // address
  const [address, setAddress] = useState({
    zip: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  // payment
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [installments, setInstallments] = useState(1);

  // coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponApplied, setCouponApplied] = useState("");

  // order result
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");

  // ── Delivery fee ──────────────────────────────────────────────────────────
  const feeResult = useMemo<FeeResult>(() => {
    if (deliveryType === "pickup") return { taxa: 0, isGratis: true, label: "Grátis" };
    const taxaGlobal = parseFloat(store?.deliveryFee || "0");
    const freeAbove = store?.freeShippingAbove ? parseFloat(store.freeShippingAbove) : null;
    const regras: DeliveryRule[] = store?.deliveryRules || [];
    return calcDeliveryFee(address.neighborhood, cartTotal, taxaGlobal, freeAbove, regras);
  }, [deliveryType, address.neighborhood, cartTotal, store]);

  const baseTotal  = cartTotal + feeResult.taxa - couponDiscount;

  // ── Step 0 validation ─────────────────────────────────────────────────────
  const step0Valid = useMemo(() => {
    const nameOk = nome.trim().length >= 2;
    const phoneOk = telefone.replace(/\D/g, "").length >= 10;
    if (!nameOk || !phoneOk) return false;
    if (deliveryType === "delivery") {
      return !!(address.street && address.number && address.neighborhood && address.city);
    }
    return true;
  }, [nome, telefone, deliveryType, address]);

  // ── CEP autocomplete ──────────────────────────────────────────────────────
  const handleCepChange = async (raw: string) => {
    const masked = maskCep(raw);
    const digits = masked.replace(/\D/g, "");
    setAddress(a => ({ ...a, zip: masked }));
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`/api/validate-cep?cep=${digits}`);
        const data = await res.json() as Record<string, string>;
        if (data.logradouro) {
          setAddress(a => ({
            ...a,
            street: data.logradouro,
            neighborhood: data.bairro || a.neighborhood,
            city: data.localidade || a.city,
            state: data.uf || a.state,
          }));
        }
      } catch { /* ignore */ } finally { setCepLoading(false); }
    }
  };

  // ── Coupon ────────────────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !store?.id) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await fetch(
        `/api/coupons/validate?storeId=${store.id}&code=${encodeURIComponent(couponCode.trim())}&orderValue=${cartTotal.toFixed(2)}`
      );
      const data = await res.json() as { error?: string; discountValue?: string; code?: string };
      if (!res.ok) { setCouponError(data.error || "Cupom inválido"); return; }
      setCouponDiscount(parseFloat(data.discountValue ?? "0"));
      setCouponApplied(data.code ?? couponCode.trim());
    } catch { setCouponError("Erro ao validar cupom"); }
    finally { setCouponLoading(false); }
  };

  const removeCoupon = () => {
    setCouponDiscount(0); setCouponApplied(""); setCouponCode(""); setCouponError("");
  };

  // ── Payment config ────────────────────────────────────────────────────────
  const paymentConfig: PaymentMethodConfig[] =
    store?.paymentMethodsConfig?.length
      ? (store.paymentMethodsConfig as PaymentMethodConfig[])
      : DEFAULT_PAYMENT_METHODS;
  const deliveryPayOk = (store as { deliveryPaymentEnabled?: boolean | null } | null)?.deliveryPaymentEnabled !== false;
  const availableMethods = paymentConfig.filter(
    m => m.enabled && (m.key === "mercadopago" || deliveryPayOk)
  );
  const selectedPayConfig = paymentConfig.find(m => m.key === paymentMethod);

  // Taxa da maquineta por parcelamento ─────────────────────────────────────
  const cardFeePercent = useMemo(() => {
    if (!selectedPayConfig?.parcelamentoAtivo) return 0;
    return selectedPayConfig.taxasPorParcela?.find(t => t.parcela === installments)?.taxa ?? 0;
  }, [selectedPayConfig, installments]);

  const cardFeeAmount = cardFeePercent > 0 ? baseTotal * cardFeePercent / 100 : 0;
  // Se repasse ativo, o cliente paga total + taxa; senão a loja absorve (mas registra para conciliação)
  const orderTotal = selectedPayConfig?.repassarTaxaCliente
    ? baseTotal + cardFeeAmount
    : baseTotal;

  const METHOD_ICONS: Record<string, React.ElementType> = {
    cash: Banknote, pix: QrCode, card: CreditCard, debit: CreditCard, mercadopago: ShoppingBag,
  };
  const METHOD_DESC: Record<string, string> = {
    cash: "Pagar na entrega",
    pix: "Chave PIX — pagar na entrega",
    card: "Crédito — pagar na entrega",
    debit: "Débito — pagar na entrega",
    mercadopago: "Cartão, PIX, boleto e mais",
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setOrderError("");
    try {
      const storeId = store?.id || localStorage.getItem("storeId");
      if (!storeId) { setOrderError("Loja não encontrada"); return; }

      const items = cart.map(item => ({
        productId: item.id,
        productName: item.name,
        productEmoji: item.emoji || item.image || "📦",
        quantity: item.qty,
        unitPrice: item.price.toFixed(2),
        additionsTotal: item.additions
          ? item.additions.reduce((s, a) => s + a.price, 0).toFixed(2)
          : "0",
        total: (item.price * item.qty).toFixed(2),
        additionsSnapshot: item.additions || [],
        notes: item.obs || undefined,
      }));

      const addressSnapshot =
        deliveryType === "delivery"
          ? {
              street: address.street,
              number: address.number,
              neighborhood: address.neighborhood,
              city: address.city,
              state: address.state || "SP",
              zip: address.zip.replace(/\D/g, ""),
              complement: address.complement || undefined,
            }
          : undefined;

      const cliente = { nome: nome.trim(), telefone: telefone.replace(/\D/g, "") };
      const estimatedDelivery = new Date(
        Date.now() + (deliveryType === "delivery" ? 40 : 20) * 60_000
      ).toISOString();

      const basePayload = {
        storeId,
        type: deliveryType,
        cliente,
        items,
        subtotal: cartTotal.toFixed(2),
        deliveryFee: feeResult.taxa.toFixed(2),
        discount: couponDiscount.toFixed(2),
        total: orderTotal.toFixed(2),
        cardFeeAmount: cardFeeAmount > 0 ? cardFeeAmount.toFixed(2) : undefined,
        addressSnapshot,
        couponCode: couponApplied || undefined,
        estimatedDelivery,
      };

      if (paymentMethod === "mercadopago") {
        const res = await api.post("/api/payments/mp-checkout", basePayload, { skipCsrf: true });
        const data = await res.json() as { init_point?: string; error?: string };
        if (res.ok && data.init_point) { clearCart(); window.location.href = data.init_point; return; }
        setOrderError(data.error || "Erro ao iniciar pagamento no Mercado Pago");
        return;
      }

      const res = await api.post("/api/orders/create", {
        ...basePayload,
        paymentMethod,
        installments: installments > 1 ? installments : undefined,
      }, { skipCsrf: true });
      const data = await res.json() as { success?: boolean; order?: { number: number }; error?: string };
      if (res.ok && data.success) {
        setOrderNumber(data.order?.number ?? null);
        clearCart();
        setConfirmed(true);
      } else {
        setOrderError(data.error || "Erro ao criar pedido");
      }
    } catch { setOrderError("Erro de conexão"); }
    finally { setSubmitting(false); }
  };

  // ── WhatsApp send ─────────────────────────────────────────────────────────
  const sendOrderViaWhatsApp = () => {
    const phone = configuracaoVitrine?.telefoneWhatsapp;
    if (!phone) return;

    const storeName = store?.name || "Loja";
    const showPrice = configuracaoVitrine?.exibirPreco !== false;

    const itens = cart
      .map(item => {
        const sub = item.price * item.qty;
        const addText = item.additions?.length
          ? `\n   ↳ ${item.additions.map((a: { name: string }) => a.name).join(", ")}`
          : "";
        const obsText = item.obs ? `\n   📝 ${item.obs}` : "";
        return showPrice
          ? `• ${item.qty}× ${item.name} — R$ ${formatPrice(sub)}${addText}${obsText}`
          : `• ${item.qty}× ${item.name}${addText}${obsText}`;
      })
      .join("\n");

    const entregaSection =
      deliveryType === "delivery"
        ? [
            `🚚 *Entrega:*`,
            `${address.street}, ${address.number}${address.complement ? ` — ${address.complement}` : ""}`,
            `${address.neighborhood}, ${address.city}${address.state ? ` — ${address.state}` : ""}`,
            address.zip ? `CEP: ${address.zip}` : "",
          ].filter(Boolean).join("\n")
        : `📍 *Retirada no local*`;

    const pagamento = selectedPayConfig?.label || paymentMethod || "A combinar";
    const parcelasText = installments > 1 ? ` (${installments}×)` : "";

    const financeiro = showPrice
      ? [
          ``,
          `*Resumo:*`,
          `Subtotal: R$ ${formatPrice(cartTotal)}`,
          couponDiscount > 0 ? `Cupom (${couponApplied}): −R$ ${formatPrice(couponDiscount)}` : "",
          `Entrega: ${feeResult.isGratis ? feeResult.label : `R$ ${formatPrice(feeResult.taxa)}`}`,
          `*Total: R$ ${formatPrice(orderTotal)}*`,
        ].filter(Boolean).join("\n")
      : "";

    const msg = [
      `🛍️ *Pedido — ${storeName}*`,
      ``,
      `👤 *${nome.trim()}*  📱 ${telefone}`,
      ``,
      `*Itens:*`,
      itens,
      ``,
      entregaSection,
      ``,
      `💳 *Pagamento:* ${pagamento}${parcelasText}`,
      financeiro,
    ].join("\n");

    clearCart();
    window.open(
      `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setConfirmed(true);
  };

  // ── Empty cart ────────────────────────────────────────────────────────────
  if (cart.length === 0 && !confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <ShoppingBag className="w-12 h-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Seu carrinho está vazio</p>
        <Link to="/store" className="mt-3 text-sm font-semibold text-primary">Voltar à loja</Link>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow mb-5">
          <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Pedido confirmado!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Olá, {nome.split(" ")[0] || "cliente"}! Recebemos seu pedido.
        </p>
        {orderNumber && (
          <p className="text-xs bg-primary/10 text-primary rounded-full px-4 py-1 mt-2 font-semibold">
            Pedido #{orderNumber}
          </p>
        )}
        {orderError && <p className="text-sm text-destructive mt-2">{orderError}</p>}
        <p className="text-xs text-muted-foreground mt-3">
          {deliveryType === "delivery"
            ? `Previsão: ${store?.deliveryEstimate || "30-50 min"}`
            : "Pronto para retirada em ~20 min"}
        </p>
        <Link to="/store" className="mt-6 w-full max-w-sm block">
          <Button className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
            Continuar comprando
          </Button>
        </Link>
      </div>
    );
  }

  // ── Mini totals panel (shown on steps 0 and 1) ────────────────────────────
  const miniTotals = (
    <div className="bg-surface border border-border/40 rounded-2xl p-3 space-y-1.5 mt-5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} itens)</span>
        <span>R$ {formatPrice(cartTotal)}</span>
      </div>
      {couponDiscount > 0 && (
        <div className="flex justify-between text-xs text-emerald-600">
          <span>Cupom {couponApplied}</span>
          <span>−R$ {formatPrice(couponDiscount)}</span>
        </div>
      )}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Entrega</span>
        {feeResult.isGratis
          ? <span className="text-emerald-600 font-medium">{feeResult.label}</span>
          : <span>R$ {formatPrice(feeResult.taxa)}</span>
        }
      </div>
      <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-1.5">
        <span>Total</span>
        <span className="text-primary">R$ {formatPrice(orderTotal)}</span>
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-24 animate-in fade-in duration-300 max-w-lg mx-auto">
      <StepBar current={step} />

      {/* ════════════════════════════════════════════════════════════════
          STEP 0 — Identificação + Modalidade + Endereço
      ════════════════════════════════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-5">

          {/* Identificação */}
          <div>
            <h2 className="text-base font-bold flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              Seus dados
            </h2>
            <div className="space-y-3">
              <Field label="Nome completo *">
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="João da Silva"
                  autoComplete="name"
                  className={inputCls}
                />
              </Field>
              <Field label="Telefone / WhatsApp *">
                <input
                  value={telefone}
                  onChange={e => setTelefone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  inputMode="numeric"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          {/* Modalidade */}
          <div>
            <h2 className="text-base font-bold flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="w-3.5 h-3.5 text-primary" />
              </div>
              Como deseja receber?
            </h2>
            <div className="flex gap-2 bg-secondary/60 p-1 rounded-2xl">
              {store?.deliveryEnabled !== false && (
                <button
                  onClick={() => setDeliveryType("delivery")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    deliveryType === "delivery"
                      ? "bg-white shadow-sm text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Truck className="w-4 h-4" /> Delivery
                </button>
              )}
              {store?.pickupEnabled !== false && (
                <button
                  onClick={() => setDeliveryType("pickup")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    deliveryType === "pickup"
                      ? "bg-white shadow-sm text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Package className="w-4 h-4" /> Retirada
                </button>
              )}
            </div>
          </div>

          {/* Delivery: endereço */}
          {deliveryType === "delivery" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <Field label="CEP">
                <div className="relative">
                  <input
                    value={address.zip}
                    onChange={e => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                    className={inputCls}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </Field>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Field label="Rua *">
                    <input
                      value={address.street}
                      onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                      placeholder="Rua das Flores"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Número *">
                  <input
                    value={address.number}
                    onChange={e => setAddress(a => ({ ...a, number: e.target.value }))}
                    placeholder="123"
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Bairro *">
                  <input
                    value={address.neighborhood}
                    onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))}
                    placeholder="Centro"
                    className={inputCls}
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    value={address.complement}
                    onChange={e => setAddress(a => ({ ...a, complement: e.target.value }))}
                    placeholder="Apto 12"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Field label="Cidade *">
                    <input
                      value={address.city}
                      onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                      placeholder="São Paulo"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="UF">
                  <input
                    value={address.state}
                    onChange={e => setAddress(a => ({ ...a, state: e.target.value.toUpperCase() }))}
                    placeholder="SP"
                    maxLength={2}
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Live frete preview */}
              {address.neighborhood && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm transition-colors ${
                  feeResult.isGratis
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-surface border border-border/40 text-muted-foreground"
                }`}>
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="flex-1">
                    Taxa para <strong>{address.neighborhood}</strong>
                  </span>
                  <span className="font-bold">{feeResult.label}</span>
                </div>
              )}

              {/* Free shipping hint */}
              {store?.freeShippingAbove && !feeResult.isGratis && (
                <p className="text-xs text-center text-muted-foreground">
                  Frete grátis a partir de R$ {formatPrice(parseFloat(store.freeShippingAbove))}
                </p>
              )}
            </div>
          )}

          {/* Pickup: info da loja */}
          {deliveryType === "pickup" && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-4 rounded-2xl border border-border/40 bg-surface space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{store?.name || "Nossa loja"}</p>
                  <p className="text-xs text-muted-foreground">Retirada no local · Grátis</p>
                </div>
              </div>
              {store?.address && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {store.address.street}, {store.address.number}
                    {store.address.complement ? ` — ${store.address.complement}` : ""} ·{" "}
                    {store.address.neighborhood}, {store.address.city}
                  </span>
                </div>
              )}
              {store?.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{store.phone}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                ⏱ Seu pedido ficará pronto em aproximadamente 20 minutos.
              </p>
            </div>
          )}

          {miniTotals}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP 1 — Pagamento + Cupom
      ════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Forma de pagamento</h2>

          <div className="space-y-2">
            {availableMethods.map(m => {
              const Icon = METHOD_ICONS[m.key] ?? CreditCard;
              const active = paymentMethod === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => { setPaymentMethod(m.key); setInstallments(1); }}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    active ? "border-primary bg-primary/5" : "border-border/50"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    active ? "bg-primary/15" : "bg-secondary"
                  }`}>
                    <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{METHOD_DESC[m.key] ?? ""}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? "border-primary" : "border-border"
                  }`}>
                    {active && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Parcelamento */}
          {selectedPayConfig && selectedPayConfig.maxInstallments > 1 && selectedPayConfig.key !== "mercadopago" && (
            <div className="space-y-2 pt-1">
              <p className="text-sm font-semibold">Parcelamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: selectedPayConfig.maxInstallments }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setInstallments(n)}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      installments === n
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/50 text-muted-foreground"
                    }`}
                  >
                    {(() => {
                      const rate = selectedPayConfig?.taxasPorParcela?.find(t => t.parcela === n)?.taxa ?? 0;
                      const totalWithFee = selectedPayConfig?.repassarTaxaCliente && rate > 0
                        ? baseTotal * (1 + rate / 100)
                        : baseTotal;
                      if (n === 1) return `À vista — R$ ${formatPrice(baseTotal)}`;
                      const parcelVal = totalWithFee / n;
                      return rate > 0 && selectedPayConfig?.repassarTaxaCliente
                        ? `${n}× R$ ${formatPrice(parcelVal)} (+${rate}% taxa)`
                        : `${n}× de R$ ${formatPrice(baseTotal / n)}`;
                    })()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cupom */}
          <div className="pt-1">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" /> Cupom de desconto
            </h3>
            {couponApplied ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">{couponApplied}</span>
                  <span className="text-xs text-emerald-600">−R$ {formatPrice(couponDiscount)}</span>
                </div>
                <button onClick={removeCoupon} className="text-emerald-500 hover:text-destructive transition-colors">
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
                <Button
                  variant="outline"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading}
                  className="h-10 rounded-xl px-4 shrink-0"
                >
                  {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
            {couponError && <p className="text-xs text-destructive mt-1">{couponError}</p>}
          </div>

          {miniTotals}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP 2 — Resumo + Confirmação
      ════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Resumo do pedido</h2>

          {/* Itens */}
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    : <span className="text-lg">{item.emoji || "📦"}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.additions && item.additions.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.additions.map(a => a.name).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{item.qty}× R$ {formatPrice(item.price)}</p>
                </div>
                <span className="text-sm font-bold shrink-0">R$ {formatPrice(item.price * item.qty)}</span>
              </div>
            ))}
          </div>

          {/* Financeiro */}
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>R$ {formatPrice(cartTotal)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{couponApplied}</span>
                <span>−R$ {formatPrice(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Entrega ({deliveryType === "delivery" ? "Delivery" : "Retirada"})</span>
              {feeResult.isGratis
                ? <span className="text-emerald-600 font-medium">{feeResult.label}</span>
                : <span>R$ {formatPrice(feeResult.taxa)}</span>
              }
            </div>
            {cardFeeAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Taxa maquineta ({cardFeePercent}%)
                  {!selectedPayConfig?.repassarTaxaCliente && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium">loja absorve</span>
                  )}
                </span>
                <span className={selectedPayConfig?.repassarTaxaCliente ? "text-destructive/80" : "text-muted-foreground"}>
                  {selectedPayConfig?.repassarTaxaCliente ? "+" : ""}R$ {formatPrice(cardFeeAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border/40">
              <span>Total</span>
              <span className="text-primary">R$ {formatPrice(orderTotal)}</span>
            </div>
          </div>

          {/* Dados do cliente + entrega + pagamento */}
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong className="text-foreground">{nome}</strong> · {telefone}
              </span>
            </div>
            <div className="flex items-start gap-2 min-w-0">
              {deliveryType === "delivery"
                ? <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                : <Package className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              }
              <span className="break-words min-w-0">
                {deliveryType === "delivery"
                  ? `${address.street}, ${address.number}${address.complement ? ` — ${address.complement}` : ""} · ${address.neighborhood}, ${address.city}`
                  : `Retirada · ${store?.name || "nossa loja"}`
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>
                {selectedPayConfig?.label || paymentMethod}
                {installments > 1 ? ` — ${installments}×` : ""}
              </span>
            </div>
          </div>

          {orderError && (
            <p className="text-sm text-destructive text-center py-1">{orderError}</p>
          )}
        </div>
      )}

      {/* ─── Navigation ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mt-4">
        {step > 0 && (
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            className="flex-1 h-11 rounded-2xl font-semibold"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        )}

        {step < 2 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 0 ? !step0Valid : !paymentMethod}
            className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-50"
          >
            Continuar <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : configuracaoVitrine?.pedidoWhatsapp && configuracaoVitrine?.telefoneWhatsapp ? (
          <Button
            onClick={sendOrderViaWhatsApp}
            className="flex-1 h-11 rounded-2xl text-white font-semibold hover:opacity-90 active:scale-[0.99] transition-all shadow-lg gap-2"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle className="w-4 h-4" />
            Enviar Pedido via WhatsApp
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-70"
          >
            {submitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : "Confirmar pedido"
            }
          </Button>
        )}
      </div>
    </div>
  );
}
