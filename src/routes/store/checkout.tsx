import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MapPin, Truck, Package, CreditCard, Banknote,
  CheckCircle2, ChevronRight, ChevronLeft, Loader2, ShoppingBag,
  Tag, X, QrCode, User, Phone, Building2, MessageCircle,
  Smartphone, Globe, PlusCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useStore } from "../store";
import {
  formatPrice,
  DEFAULT_PAYMENT_CONFIG,
  type DeliveryRule,
} from "@/lib/store-context";

export const Route = createFileRoute("/store/checkout")({
  component: CheckoutPage,
});

const STEPS = ["Identificação & Entrega", "Pagamento", "Confirmação"];

// ── Masks ─────────────────────────────────────────────────────────────────────
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

// ── Delivery fee engine ───────────────────────────────────────────────────────
interface FeeResult { taxa: number; isGratis: boolean; label: string }
function calcDeliveryFee(bairro: string, subtotal: number, taxaGlobal: number, freeAbove: number | null, regras: DeliveryRule[]): FeeResult {
  const key = bairro.trim().toLowerCase();
  const regra = key ? regras.find(r => r.bairro.trim().toLowerCase() === key) : undefined;
  const taxa = regra !== undefined ? regra.taxa : taxaGlobal;
  if (freeAbove !== null && subtotal >= freeAbove) return { taxa: 0, isGratis: true, label: "Frete Grátis!" };
  if (taxa === 0) return { taxa: 0, isGratis: true, label: "Grátis" };
  return { taxa, isGratis: false, label: `R$ ${formatPrice(taxa)}` };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface SavedAddress {
  id: string;
  label: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean | null;
}

// ── StepBar ───────────────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${i <= current ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {i < current ? "✓" : i + 1}
          </div>
          <span className={`text-[10px] font-medium truncate ${i <= current ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full shrink-0 ${i < current ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
const inputCls = "w-full h-11 rounded-xl border border-border/50 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

// ── PaySectionLabel ───────────────────────────────────────────────────────────
function PaySectionLabel({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className="w-5 h-5 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-3 h-3 text-muted-foreground" />
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      {badge && (
        <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ── PayOptionRow ──────────────────────────────────────────────────────────────
function PayOptionRow({ active, icon: Icon, label, sub, onClick }: {
  active: boolean; icon: React.ElementType; label: string; sub?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
        active ? "border-primary bg-primary/5" : "border-border/50 hover:bg-accent/20"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-primary/15" : "bg-secondary"}`}>
        <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? "border-primary" : "border-border"}`}>
        {active && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </div>
    </button>
  );
}

// ── Labels de pagamento ───────────────────────────────────────────────────────
const PAYMENT_LABELS: Record<string, string> = {
  mp_pix: "Mercado Pago (PIX)", mp_credit: "Mercado Pago (Crédito)", mp_debit: "Mercado Pago (Débito)",
  delivery_cash: "Dinheiro", delivery_credit: "Cartão de Crédito", delivery_debit: "Cartão de Débito", delivery_pix: "PIX",
};
const MP_METHOD_KEY: Record<string, string> = {
  mp_pix: "pix", mp_credit: "credit_card", mp_debit: "debit_card",
};
const DELIVERY_PM_KEY: Record<string, string> = {
  delivery_cash: "cash", delivery_credit: "card", delivery_debit: "debit", delivery_pix: "pix",
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
function CheckoutPage() {
  const { store, cart, cartTotal, clearCart, configuracaoVitrine, setActiveCustomer } = useStore();
  const [step, setStep] = useState(0);

  // ── Fase de identificação por telefone (pré-etapa) ────────────────────────
  // "input" → aguardando telefone | "loading" → consultando API | "done" → liberado
  const [phonePhase, setPhonePhase] = useState<"input" | "loading" | "done">("input");
  const [phoneCheckError, setPhoneCheckError] = useState("");
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  // "new" = usando endereço manual; qualquer outro valor = id do endereço salvo
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");

  // ── Identificação ─────────────────────────────────────────────────────────
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  // ── Modalidade de entrega ─────────────────────────────────────────────────
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    store?.pickupEnabled === true && store?.deliveryEnabled === false ? "pickup" : "delivery"
  );

  // ── Endereço ──────────────────────────────────────────────────────────────
  const [address, setAddress] = useState({
    zip: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  // ── Pagamento ─────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [needsChange, setNeedsChange] = useState<boolean | null>(null);
  const [changeAmount, setChangeAmount] = useState("");
  const [installments, setInstallments] = useState(1);

  // ── Cupom ─────────────────────────────────────────────────────────────────
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponApplied, setCouponApplied] = useState("");

  // ── Pedido ────────────────────────────────────────────────────────────────
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");

  // ── PaymentConfig v2 ──────────────────────────────────────────────────────
  const payCfg = store?.paymentConfig ?? DEFAULT_PAYMENT_CONFIG;

  // ── Frete ─────────────────────────────────────────────────────────────────
  const feeResult = useMemo<FeeResult>(() => {
    if (deliveryType === "pickup") return { taxa: 0, isGratis: true, label: "Grátis" };
    const taxaGlobal = parseFloat(store?.deliveryFee || "0");
    const freeAbove = store?.freeShippingAbove ? parseFloat(store.freeShippingAbove) : null;
    const regras: DeliveryRule[] = store?.deliveryRules || [];
    return calcDeliveryFee(address.neighborhood, cartTotal, taxaGlobal, freeAbove, regras);
  }, [deliveryType, address.neighborhood, cartTotal, store]);

  const orderTotal = cartTotal + feeResult.taxa - couponDiscount;

  // ── Validações ────────────────────────────────────────────────────────────
  const step0Valid = useMemo(() => {
    if (nome.trim().length < 2) return false;
    if (deliveryType === "delivery") return !!(address.street && address.number && address.neighborhood && address.city);
    return true;
  }, [nome, deliveryType, address]);

  const step1Valid = useMemo(() => {
    if (!paymentMethod) return false;
    if (paymentMethod === "delivery_cash" && payCfg.delivery.cash.changeEnabled) {
      if (needsChange === null) return false;
      if (needsChange === true) { const amt = parseFloat(changeAmount); return !isNaN(amt) && amt > 0; }
    }
    return true;
  }, [paymentMethod, needsChange, changeAmount, payCfg]);

  // ── Aplicar endereço salvo no estado do formulário ────────────────────────
  const applyAddress = (addr: SavedAddress) => {
    setAddress({
      zip: addr.zip || "",
      street: addr.street,
      number: addr.number,
      complement: addr.complement || "",
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
    });
  };

  // ── Consulta API ao confirmar telefone ────────────────────────────────────
  const handlePhoneContinue = async () => {
    const digits = telefone.replace(/\D/g, "");
    if (digits.length < 10) return;
    setPhonePhase("loading");
    setPhoneCheckError("");
    try {
      const storeId = store?.id || localStorage.getItem("storeId");
      const res = await fetch(`/api/customer/check?storeId=${storeId}&phone=${digits}`);
      const data = await res.json() as {
        exists: boolean;
        customer?: { id: string; name: string; phone: string };
        addresses?: SavedAddress[];
      };

      if (data.exists && data.customer) {
        setNome(data.customer.name);
        setIsReturningCustomer(true);
        // Cliente reconhecido → define como ativo imediatamente, antes do pedido
        setActiveCustomer({ id: data.customer.id, name: data.customer.name, phone: digits });
        if (data.addresses && data.addresses.length > 0) {
          setSavedAddresses(data.addresses);
          const def = data.addresses.find(a => a.isDefault) ?? data.addresses[0];
          setSelectedAddressId(def.id);
          applyAddress(def);
        }
      }
      // "exists: false" → formulário em branco, sem tratamento extra
      setPhonePhase("done");
    } catch {
      setPhoneCheckError("Erro ao verificar telefone. Tente novamente.");
      setPhonePhase("input");
    }
  };

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    applyAddress(addr);
  };

  const selectPayment = (key: string) => {
    if (key === paymentMethod) return;
    setPaymentMethod(key);
    setNeedsChange(null);
    setChangeAmount("");
    setInstallments(1);
  };

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
        if (data.logradouro) setAddress(a => ({ ...a, street: data.logradouro, neighborhood: data.bairro || a.neighborhood, city: data.localidade || a.city, state: data.uf || a.state }));
      } catch { /* ignore */ } finally { setCepLoading(false); }
    }
  };

  // ── Cupom ─────────────────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !store?.id) return;
    setCouponLoading(true); setCouponError("");
    try {
      const res = await fetch(`/api/coupons/validate?storeId=${store.id}&code=${encodeURIComponent(couponCode.trim())}&orderValue=${cartTotal.toFixed(2)}`);
      const data = await res.json() as { error?: string; discountValue?: string; code?: string };
      if (!res.ok) { setCouponError(data.error || "Cupom inválido"); return; }
      setCouponDiscount(parseFloat(data.discountValue ?? "0"));
      setCouponApplied(data.code ?? couponCode.trim());
    } catch { setCouponError("Erro ao validar cupom"); }
    finally { setCouponLoading(false); }
  };
  const removeCoupon = () => { setCouponDiscount(0); setCouponApplied(""); setCouponCode(""); setCouponError(""); };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting || !paymentMethod) return;
    setSubmitting(true); setOrderError("");
    try {
      const storeId = store?.id || localStorage.getItem("storeId");
      if (!storeId) { setOrderError("Loja não encontrada"); return; }
      const items = cart.map(item => ({
        productId: item.id, productName: item.name, productEmoji: item.emoji || item.image || "📦",
        quantity: item.qty, unitPrice: item.price.toFixed(2),
        additionsTotal: item.additions ? item.additions.reduce((s, a) => s + a.price, 0).toFixed(2) : "0",
        total: (item.price * item.qty).toFixed(2), additionsSnapshot: item.additions || [], notes: item.obs || undefined,
      }));
      const addressSnapshot = deliveryType === "delivery" ? {
        street: address.street, number: address.number, neighborhood: address.neighborhood,
        city: address.city, state: address.state || "SP", zip: address.zip.replace(/\D/g, ""),
        complement: address.complement || undefined,
      } : undefined;
      const cliente = { nome: nome.trim(), telefone: telefone.replace(/\D/g, "") };
      const estimatedDelivery = new Date(Date.now() + (deliveryType === "delivery" ? 40 : 20) * 60_000).toISOString();
      const basePayload = {
        storeId, type: deliveryType, cliente, items,
        subtotal: cartTotal.toFixed(2), deliveryFee: feeResult.taxa.toFixed(2),
        discount: couponDiscount.toFixed(2), total: orderTotal.toFixed(2),
        addressSnapshot, couponCode: couponApplied || undefined, estimatedDelivery,
      };
      if (paymentMethod.startsWith("mp_")) {
        const res = await api.post("/api/payments/mp-checkout", { ...basePayload, mpMethod: MP_METHOD_KEY[paymentMethod] }, { skipCsrf: true });
        const data = await res.json() as { init_point?: string; error?: string };
        if (res.ok && data.init_point) { clearCart(); window.location.href = data.init_point; return; }
        setOrderError(data.error || "Erro ao iniciar pagamento no Mercado Pago"); return;
      }
      const changeInfo = paymentMethod === "delivery_cash"
        ? { needed: needsChange === true, amount: needsChange && changeAmount ? parseFloat(changeAmount) : null }
        : undefined;
      const res = await api.post("/api/orders/create", {
        ...basePayload,
        paymentMethod: DELIVERY_PM_KEY[paymentMethod] ?? paymentMethod,
        installments: paymentMethod === "delivery_credit" && installments > 1 ? installments : undefined,
        change: changeInfo,
      }, { skipCsrf: true });
      const data = await res.json() as { success?: boolean; order?: { number: number; customerId?: string | null }; error?: string };
      if (res.ok && data.success) {
        setOrderNumber(data.order?.number ?? null);
        // Consolida o cliente ativo com o ID gerado pelo servidor (novo ou existente)
        setActiveCustomer({
          id: data.order?.customerId ?? undefined,
          name: nome.trim(),
          phone: telefone.replace(/\D/g, ""),
        });
        clearCart();
        setConfirmed(true);
      }
      else setOrderError(data.error || "Erro ao criar pedido");
    } catch { setOrderError("Erro de conexão"); }
    finally { setSubmitting(false); }
  };

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const sendOrderViaWhatsApp = () => {
    const phone = configuracaoVitrine?.telefoneWhatsapp;
    if (!phone) return;
    const showPrice = configuracaoVitrine?.exibirPreco !== false;
    const itens = cart.map(item => {
      const sub = item.price * item.qty;
      const addText = item.additions?.length ? `\n   ↳ ${item.additions.map((a: { name: string }) => a.name).join(", ")}` : "";
      const obsText = item.obs ? `\n   📝 ${item.obs}` : "";
      return showPrice ? `• ${item.qty}× ${item.name} — R$ ${formatPrice(sub)}${addText}${obsText}` : `• ${item.qty}× ${item.name}${addText}${obsText}`;
    }).join("\n");
    const entregaSection = deliveryType === "delivery"
      ? [`🚚 *Entrega:*`, `${address.street}, ${address.number}${address.complement ? ` — ${address.complement}` : ""}`, `${address.neighborhood}, ${address.city}${address.state ? ` — ${address.state}` : ""}`, address.zip ? `CEP: ${address.zip}` : ""].filter(Boolean).join("\n")
      : `📍 *Retirada no local*`;
    const pagamento = PAYMENT_LABELS[paymentMethod ?? ""] || paymentMethod || "A combinar";
    const parcelasText = paymentMethod === "delivery_credit" && installments > 1 ? ` (${installments}×)` : "";
    const trocoText = paymentMethod === "delivery_cash" && needsChange ? `\n💵 Troco para: R$ ${formatPrice(parseFloat(changeAmount) || 0)}` : "";
    const financeiro = showPrice
      ? [``, `*Resumo:*`, `Subtotal: R$ ${formatPrice(cartTotal)}`, couponDiscount > 0 ? `Cupom (${couponApplied}): −R$ ${formatPrice(couponDiscount)}` : "", `Entrega: ${feeResult.isGratis ? feeResult.label : `R$ ${formatPrice(feeResult.taxa)}`}`, `*Total: R$ ${formatPrice(orderTotal)}*`].filter(Boolean).join("\n")
      : "";
    const msg = [`🛍️ *Pedido — ${store?.name || "Loja"}*`, ``, `👤 *${nome.trim()}*  📱 ${telefone}`, ``, `*Itens:*`, itens, ``, entregaSection, ``, `💳 *Pagamento:* ${pagamento}${parcelasText}${trocoText}`, financeiro].join("\n");
    clearCart();
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    setConfirmed(true);
  };

  // ── Carrinho vazio ────────────────────────────────────────────────────────
  if (cart.length === 0 && !confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <ShoppingBag className="w-12 h-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Seu carrinho está vazio</p>
        <Link to="/store" className="mt-3 text-sm font-semibold text-primary">Voltar à loja</Link>
      </div>
    );
  }

  // ── Pedido em análise — timeline stepper ─────────────────────────────────
  if (confirmed) {
    const timelineSteps = deliveryType === "pickup"
      ? [
          { label: "Em análise",          desc: "Aguardando confirmação do estabelecimento" },
          { label: "Em preparação",        desc: "Seu pedido está sendo feito" },
          { label: "Pronto para retirada", desc: "Pode vir buscar!" },
          { label: "Entregue",             desc: "Pedido concluído" },
        ]
      : [
          { label: "Em análise",     desc: "Aguardando confirmação do estabelecimento" },
          { label: "Em preparação",  desc: "Seu pedido está sendo feito" },
          { label: "Saiu p/ entrega", desc: "A caminho de você" },
          { label: "Entregue",       desc: "Pedido concluído" },
        ];
    return (
      <div className="flex flex-col items-center px-4 py-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold">Pedido recebido!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Olá, <span className="font-medium text-foreground">{nome.split(" ")[0] || "cliente"}</span>! Seu pedido está em análise pelo estabelecimento.
            </p>
            {orderNumber && (
              <p className="text-xs bg-primary/10 text-primary rounded-full px-4 py-1.5 mt-3 font-semibold inline-block">
                Pedido #{orderNumber}
              </p>
            )}
            {orderError && <p className="text-sm text-destructive mt-2">{orderError}</p>}
          </div>

          {/* Timeline */}
          <div className="mb-6">
            {timelineSteps.map((step, i) => {
              const isActive = i === 0;
              const isLast = i === timelineSteps.length - 1;
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-4 h-4 rounded-full shrink-0 mt-0.5 transition-all ${
                      isActive
                        ? "bg-amber-500 animate-pulse ring-4 ring-amber-500/20"
                        : "bg-border"
                    }`} />
                    {!isLast && <div className="w-0.5 flex-1 bg-border my-1 min-h-[20px]" />}
                  </div>
                  <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
                    <p className={`text-sm font-semibold leading-none ${isActive ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {step.label}
                    </p>
                    {isActive && (
                      <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center mb-6">
            {deliveryType === "delivery"
              ? `Previsão de entrega: ${store?.deliveryEstimate || "30–50 min"}`
              : "Pronto para retirada em ~20 min"}
          </p>

          <Link to="/store" className="block">
            <Button className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
              Continuar comprando
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRÉ-ETAPA — Tela de identificação por telefone
  // Bloqueia todo o restante do checkout enquanto phonePhase !== "done"
  // ══════════════════════════════════════════════════════════════════════════
  if (phonePhase !== "done") {
    return (
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        {/* Resumo rápido do carrinho no topo — contexto para o cliente */}
        <div className="flex items-center justify-between mb-8 p-3 rounded-2xl bg-surface border border-border/40">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>{cart.reduce((s, i) => s + i.qty, 0)} {cart.reduce((s, i) => s + i.qty, 0) === 1 ? "item" : "itens"}</span>
          </div>
          <span className="text-sm font-bold text-primary">R$ {formatPrice(cartTotal)}</span>
        </div>

        {/* Card de identificação centralizado */}
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 shadow-sm">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-center">Qual é o seu WhatsApp?</h1>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-6 max-w-xs">
            Usamos o número para identificar sua conta e agilizar o checkout.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <input
              value={telefone}
              onChange={e => setTelefone(maskPhone(e.target.value))}
              onKeyDown={e => e.key === "Enter" && handlePhoneContinue()}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              inputMode="numeric"
              autoFocus
              className="w-full h-14 rounded-2xl border border-border/50 bg-surface px-4 text-center text-lg font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />

            {phoneCheckError && (
              <p className="text-xs text-destructive text-center animate-in fade-in duration-150">
                {phoneCheckError}
              </p>
            )}

            <Button
              onClick={handlePhoneContinue}
              disabled={telefone.replace(/\D/g, "").length < 10 || phonePhase === "loading"}
              className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-50 text-base"
            >
              {phonePhase === "loading" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Continuar <ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              Seus dados são protegidos e usados apenas nesta compra.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Mini totals (steps 0 e 1) ─────────────────────────────────────────────
  const miniTotals = (
    <div className="bg-surface border border-border/40 rounded-2xl p-3 space-y-1.5 mt-5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} itens)</span>
        <span>R$ {formatPrice(cartTotal)}</span>
      </div>
      {couponDiscount > 0 && (
        <div className="flex justify-between text-xs text-emerald-600">
          <span>Cupom {couponApplied}</span><span>−R$ {formatPrice(couponDiscount)}</span>
        </div>
      )}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Entrega</span>
        {feeResult.isGratis ? <span className="text-emerald-600 font-medium">{feeResult.label}</span> : <span>R$ {formatPrice(feeResult.taxa)}</span>}
      </div>
      <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-1.5">
        <span>Total</span><span className="text-primary">R$ {formatPrice(orderTotal)}</span>
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-24 animate-in fade-in duration-300 max-w-lg mx-auto">
      <StepBar current={step} />

      {/* ══════════════════════════════════════════════════════════════
          STEP 0 — Identificação + Modalidade + Endereço
      ══════════════════════════════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-5">

          {/* ── Identificação ──────────────────────────────────────── */}
          <div>
            <h2 className="text-base font-bold flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary" /></div>
              Seus dados
            </h2>

            {/* Badge de cliente recorrente */}
            {isReturningCustomer && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-3 animate-in fade-in duration-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Olá, {nome.split(" ")[0]}! Encontramos seu cadastro.
              </div>
            )}

            <div className="space-y-3">
              {/* Telefone — somente leitura, com botão para voltar */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone / WhatsApp</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-11 rounded-xl border border-border/30 bg-muted/40 px-3 text-sm flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium text-foreground">{telefone}</span>
                  </div>
                  <button
                    onClick={() => { setPhonePhase("input"); setIsReturningCustomer(false); setSavedAddresses([]); setNome(""); setAddress({ zip:"",street:"",number:"",complement:"",neighborhood:"",city:"",state:"" }); }}
                    className="h-11 px-3 rounded-xl border border-border/50 text-xs text-muted-foreground hover:bg-accent/30 transition-colors shrink-0"
                  >
                    Trocar
                  </button>
                </div>
              </div>

              <Field label="Nome completo *">
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="João da Silva" autoComplete="name" className={inputCls} />
              </Field>
            </div>
          </div>

          {/* ── Modalidade ─────────────────────────────────────────── */}
          <div>
            <h2 className="text-base font-bold flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><Truck className="w-3.5 h-3.5 text-primary" /></div>
              Como deseja receber?
            </h2>
            <div className="flex gap-2 bg-secondary/60 p-1 rounded-2xl">
              {store?.deliveryEnabled !== false && (
                <button onClick={() => setDeliveryType("delivery")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${deliveryType === "delivery" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  <Truck className="w-4 h-4" /> Delivery
                </button>
              )}
              {store?.pickupEnabled !== false && (
                <button onClick={() => setDeliveryType("pickup")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${deliveryType === "pickup" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  <Package className="w-4 h-4" /> Retirada
                </button>
              )}
            </div>
          </div>

          {/* ── Endereço (Delivery) ────────────────────────────────── */}
          {deliveryType === "delivery" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">

              {/* Seletor de endereços salvos (apenas clientes recorrentes) */}
              {isReturningCustomer && savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endereços salvos</p>

                  {savedAddresses.map(addr => (
                    <button
                      key={addr.id}
                      onClick={() => handleSelectSavedAddress(addr)}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                        selectedAddressId === addr.id ? "border-primary bg-primary/5" : "border-border/50 hover:bg-accent/20"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${selectedAddressId === addr.id ? "border-primary" : "border-border"}`}>
                        {selectedAddressId === addr.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {addr.label && (
                          <span className="inline-block text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full mb-1">{addr.label}</span>
                        )}
                        <p className="text-sm font-medium leading-snug">
                          {addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{addr.neighborhood} · {addr.city} · {addr.state}</p>
                      </div>
                    </button>
                  ))}

                  {/* Opção de adicionar novo endereço */}
                  <button
                    onClick={() => {
                      setSelectedAddressId("new");
                      setAddress({ zip:"", street:"", number:"", complement:"", neighborhood:"", city:"", state:"" });
                    }}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all text-sm font-semibold ${
                      selectedAddressId === "new"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-dashed border-border text-muted-foreground hover:bg-accent/20"
                    }`}
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    Usar outro endereço
                  </button>
                </div>
              )}

              {/* Formulário de endereço — sempre visível, mas pré-preenchido se salvo */}
              <div className={`space-y-3 transition-opacity duration-200 ${isReturningCustomer && savedAddresses.length > 0 && selectedAddressId !== "new" ? "opacity-70" : "opacity-100"}`}>
                {isReturningCustomer && savedAddresses.length > 0 && selectedAddressId !== "new" && (
                  <p className="text-[11px] text-muted-foreground">Você pode editar os campos abaixo se necessário.</p>
                )}

                <Field label="CEP">
                  <div className="relative">
                    <input value={address.zip} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" inputMode="numeric" className={inputCls} />
                    {cepLoading && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Rua *"><input value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} placeholder="Rua das Flores" className={inputCls} /></Field>
                  </div>
                  <Field label="Número *"><input value={address.number} onChange={e => setAddress(a => ({ ...a, number: e.target.value }))} placeholder="123" inputMode="numeric" className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Bairro *"><input value={address.neighborhood} onChange={e => setAddress(a => ({ ...a, neighborhood: e.target.value }))} placeholder="Centro" className={inputCls} /></Field>
                  <Field label="Complemento"><input value={address.complement} onChange={e => setAddress(a => ({ ...a, complement: e.target.value }))} placeholder="Apto 12" className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Cidade *"><input value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} placeholder="São Paulo" className={inputCls} /></Field>
                  </div>
                  <Field label="UF"><input value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value.toUpperCase() }))} placeholder="SP" maxLength={2} className={inputCls} /></Field>
                </div>

                {address.neighborhood && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-sm transition-colors ${feeResult.isGratis ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-surface border border-border/40 text-muted-foreground"}`}>
                    <Truck className="w-4 h-4 shrink-0" />
                    <span className="flex-1">Taxa para <strong>{address.neighborhood}</strong></span>
                    <span className="font-bold">{feeResult.label}</span>
                  </div>
                )}
                {store?.freeShippingAbove && !feeResult.isGratis && (
                  <p className="text-xs text-center text-muted-foreground">Frete grátis a partir de R$ {formatPrice(parseFloat(store.freeShippingAbove))}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Retirada ───────────────────────────────────────────── */}
          {deliveryType === "pickup" && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-4 rounded-2xl border border-border/40 bg-surface space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold">{store?.name || "Nossa loja"}</p>
                  <p className="text-xs text-muted-foreground">Retirada no local · Grátis</p>
                </div>
              </div>
              {store?.address && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{store.address.street}, {store.address.number}{store.address.complement ? ` — ${store.address.complement}` : ""} · {store.address.neighborhood}, {store.address.city}</span>
                </div>
              )}
              {store?.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" /><span>{store.phone}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">⏱ Seu pedido ficará pronto em aproximadamente 20 minutos.</p>
            </div>
          )}

          {miniTotals}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 1 — Pagamento (dois grupos) + Cupom
      ══════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-5">

          {/* ── Pagamento Online ────────────────────────────────────── */}
          {payCfg.online.enabled && (
            <div>
              <PaySectionLabel icon={Globe} title="Pagamento Online" badge="Mercado Pago" />
              <div className="space-y-2">
                {payCfg.online.methods.creditCard && (
                  <PayOptionRow active={paymentMethod === "mp_credit"} icon={CreditCard} label="Cartão de Crédito" sub="Pague agora com segurança via Mercado Pago" onClick={() => selectPayment("mp_credit")} />
                )}
                {payCfg.online.methods.debitCard && (
                  <PayOptionRow active={paymentMethod === "mp_debit"} icon={CreditCard} label="Cartão de Débito" sub="Débito online via Mercado Pago" onClick={() => selectPayment("mp_debit")} />
                )}
                {payCfg.online.methods.pix && (
                  <PayOptionRow active={paymentMethod === "mp_pix"} icon={QrCode} label="PIX" sub="Aprovação imediata via Mercado Pago" onClick={() => selectPayment("mp_pix")} />
                )}
                {paymentMethod?.startsWith("mp_") && (
                  <div className="flex items-start gap-2 px-1 animate-in fade-in duration-200">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground">Você será redirecionado para o ambiente seguro do Mercado Pago para concluir o pagamento.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Pagamento na Entrega ─────────────────────────────────── */}
          {payCfg.delivery.enabled && (
            <div>
              <PaySectionLabel icon={Truck} title="Pagamento na Entrega" />
              <div className="space-y-2">

                {payCfg.delivery.cash.enabled && (
                  <>
                    <PayOptionRow active={paymentMethod === "delivery_cash"} icon={Banknote} label="Dinheiro" sub="Pague em espécie na hora da entrega" onClick={() => selectPayment("delivery_cash")} />
                    {paymentMethod === "delivery_cash" && payCfg.delivery.cash.changeEnabled && (
                      <div className="ml-3 pl-3 border-l-2 border-primary/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="text-sm font-medium pt-1">Precisa de troco?</p>
                        <div className="flex gap-2">
                          {(["Sim", "Não"] as const).map(opt => {
                            const val = opt === "Sim";
                            const active = needsChange === val;
                            return (
                              <button key={opt} onClick={() => { setNeedsChange(val); if (!val) setChangeAmount(""); }}
                                className={`flex-1 h-10 rounded-xl text-sm font-semibold border transition-all ${active ? "border-primary bg-primary/5 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/20"}`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {needsChange === true && (
                          <div className="animate-in fade-in slide-in-from-top-2 duration-150">
                            <label className="text-xs font-medium text-muted-foreground">Troco para quanto?</label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">R$</span>
                              <input type="number" min={orderTotal} step="0.01" value={changeAmount} onChange={e => setChangeAmount(e.target.value)}
                                placeholder={formatPrice(Math.ceil(orderTotal / 10) * 10)} inputMode="decimal"
                                className="w-full h-11 rounded-xl border border-border/50 bg-surface pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            </div>
                            {changeAmount && parseFloat(changeAmount) < orderTotal && (
                              <p className="text-[11px] text-destructive mt-1">O valor deve ser maior que o total (R$ {formatPrice(orderTotal)}).</p>
                            )}
                          </div>
                        )}
                        {needsChange === false && (
                          <p className="text-xs text-muted-foreground animate-in fade-in duration-150">Sem troco — valor exato: <strong>R$ {formatPrice(orderTotal)}</strong></p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {payCfg.delivery.creditCard.enabled && (
                  <>
                    <PayOptionRow active={paymentMethod === "delivery_credit"} icon={CreditCard}
                      label="Cartão de Crédito"
                      sub={payCfg.delivery.creditCard.installmentsEnabled ? `Parcelado em até ${payCfg.delivery.creditCard.maxInstallments}× na maquininha` : "Pague no crédito na entrega"}
                      onClick={() => selectPayment("delivery_credit")} />
                    {paymentMethod === "delivery_credit" && (
                      <div className="ml-3 pl-3 border-l-2 border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
                        {payCfg.delivery.creditCard.installmentsEnabled && payCfg.delivery.creditCard.maxInstallments > 1 ? (
                          <>
                            <p className="text-xs font-medium text-muted-foreground pt-1 mb-2">Número de parcelas</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {Array.from({ length: payCfg.delivery.creditCard.maxInstallments }, (_, i) => i + 1).map(n => (
                                <button key={n} onClick={() => setInstallments(n)}
                                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${installments === n ? "border-primary bg-primary/5 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/20"}`}>
                                  {n === 1 ? `À vista — R$ ${formatPrice(orderTotal)}` : `${n}× de R$ ${formatPrice(orderTotal / n)}`}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground py-2">Valor a ser pago na entrega: <strong className="text-foreground">R$ {formatPrice(orderTotal)}</strong></p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {payCfg.delivery.debitCard.enabled && (
                  <PayOptionRow active={paymentMethod === "delivery_debit"} icon={CreditCard} label="Cartão de Débito" sub="Débito na maquininha na hora da entrega" onClick={() => selectPayment("delivery_debit")} />
                )}
                {payCfg.delivery.pix.enabled && payCfg.delivery.pix.pixKey && (
                  <PayOptionRow active={paymentMethod === "delivery_pix"} icon={QrCode} label="PIX" sub="Transfira na hora da entrega" onClick={() => selectPayment("delivery_pix")} />
                )}
              </div>
            </div>
          )}

          {/* ── Cupom ──────────────────────────────────────────────── */}
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
                <button onClick={removeCoupon} className="text-emerald-500 hover:text-destructive transition-colors"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                  placeholder="Código do cupom" className="flex-1 h-10 rounded-xl border border-border/50 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <Button variant="outline" onClick={handleApplyCoupon} disabled={couponLoading} className="h-10 rounded-xl px-4 shrink-0">
                  {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
            {couponError && <p className="text-xs text-destructive mt-1">{couponError}</p>}
          </div>

          {miniTotals}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 2 — Resumo + Confirmação
      ══════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Resumo do pedido</h2>

          {/* Itens */}
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-lg">{item.emoji || "📦"}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.additions && item.additions.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">{item.additions.map(a => a.name).join(", ")}</p>
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
              <span>Subtotal</span><span>R$ {formatPrice(cartTotal)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{couponApplied}</span>
                <span>−R$ {formatPrice(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Entrega ({deliveryType === "delivery" ? "Delivery" : "Retirada"})</span>
              {feeResult.isGratis ? <span className="text-emerald-600 font-medium">{feeResult.label}</span> : <span>R$ {formatPrice(feeResult.taxa)}</span>}
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border/40">
              <span>Total</span><span className="text-primary">R$ {formatPrice(orderTotal)}</span>
            </div>
            {paymentMethod === "delivery_credit" && installments > 1 && (
              <p className="text-xs text-muted-foreground text-right">{installments}× de R$ {formatPrice(orderTotal / installments)}</p>
            )}
            {paymentMethod === "delivery_cash" && needsChange === true && changeAmount && (
              <p className="text-xs text-muted-foreground text-right">💵 Troco para R$ {formatPrice(parseFloat(changeAmount))}</p>
            )}
          </div>

          {/* Dados do cliente + entrega + pagamento */}
          <div className="p-4 rounded-2xl bg-surface border border-border/40 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span><strong className="text-foreground">{nome}</strong> · {telefone}</span>
            </div>
            <div className="flex items-start gap-2 min-w-0">
              {deliveryType === "delivery" ? <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <Package className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
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
                {PAYMENT_LABELS[paymentMethod ?? ""] || paymentMethod}
                {paymentMethod === "delivery_credit" && installments > 1 ? ` — ${installments}×` : ""}
                {paymentMethod === "delivery_cash" && needsChange === false ? " · sem troco" : ""}
              </span>
            </div>
          </div>

          {orderError && <p className="text-sm text-destructive text-center py-1">{orderError}</p>}
        </div>
      )}

      {/* ── Navegação ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mt-4">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-11 rounded-2xl font-semibold">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        )}

        {step < 2 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 0 ? !step0Valid : !step1Valid}
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
            <MessageCircle className="w-4 h-4" /> Enviar Pedido via WhatsApp
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-70"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar pedido"}
          </Button>
        )}
      </div>
    </div>
  );
}
