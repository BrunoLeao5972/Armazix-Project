import { useState, createContext, useContext, useEffect, useMemo, useCallback, useRef, type CSSProperties } from "react";
import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import {
  Home,
  LayoutGrid,
  Search,
  ShoppingCart,
  User,
  Loader2,
  Store,
  MessageCircle,
  ClipboardList,
  Phone,
  MapPin,
  Mail,
  Clock,
  QrCode,
  Banknote,
  CreditCard,
  Truck,
  Package,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type CartItem, type ConfiguracaoVitrine, type StorePublicData, resolveStoreSlug, formatPrice } from "@/lib/store-context";

export interface ActiveCustomer {
  id?: string;   // undefined = novo cliente ainda não persistido no CRM
  name: string;
  phone: string; // apenas dígitos
}

type StoreContextType = {
  store: StorePublicData | null;
  configuracaoVitrine: ConfiguracaoVitrine;
  storeLoading: boolean;
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "qty">) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  /** Cliente identificado na sessão de checkout atual */
  activeCustomer: ActiveCustomer | null;
  setActiveCustomer: (c: ActiveCustomer | null) => void;
  /** Sessão do cliente autenticado por telefone/OTP */
  customerToken: string | null;
  customerName: string;
  loginCustomer: (token: string, name: string) => void;
  logoutCustomer: () => void;
};

export const StoreContext = createContext<StoreContextType>({
  store: null,
  configuracaoVitrine: {
    lojaId: "",
    logoUrl: "",
    bannerUrl: "",
    bannerMobileUrl: "",
    corPrimaria: "#2A69E5",
    corFundo: "#ffffff",
    corTextos: "#0f172a",
    exibirPreco: true,
    pedidoWhatsapp: false,
    telefoneWhatsapp: undefined,
    destacarEstoqueBaixo: false,
  },
  storeLoading: true,
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQty: () => {},
  clearCart: () => {},
  cartCount: 0,
  cartTotal: 0,
  favorites: [],
  toggleFavorite: () => {},
  activeCustomer: null,
  setActiveCustomer: () => {},
  customerToken: null,
  customerName: "",
  loginCustomer: () => {},
  logoutCustomer: () => {},
});

export const useStore = () => useContext(StoreContext);

export const Route = createFileRoute("/store")({
  component: StoreLayout,
});

// ─── Central do Cliente — types & constants ───────────────────────────────────
interface CustomerOrder {
  id: string;
  number: number;
  status: string;
  total: string;
  createdAt: string;
  type: string;
  items: { productName: string; quantity: number }[];
}

const ORDER_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Em Análise",  cls: "bg-amber-100 text-amber-700" },
  received:   { label: "Confirmado",  cls: "bg-blue-100 text-blue-700" },
  preparing:  { label: "Preparando",  cls: "bg-orange-100 text-orange-700" },
  ready:      { label: "Pronto",      cls: "bg-indigo-100 text-indigo-700" },
  delivering: { label: "Em Rota",     cls: "bg-purple-100 text-purple-700" },
  delivered:  { label: "Entregue",    cls: "bg-green-100 text-green-700" },
  cancelled:  { label: "Cancelado",   cls: "bg-red-100 text-red-700" },
};
const ACTIVE_STATUSES = new Set(["pending", "received", "preparing", "delivering"]);

const maskPhoneStore = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function CustomerOrdersSheet({
  open,
  onOpenChange,
  storeId,
  token,
  customerName,
  onLogin,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  token: string | null;
  customerName: string;
  onLogin: (token: string, name: string) => void;
  onLogout: () => void;
}) {
  // ── Login state ──────────────────────────────────────────────────────────
  const [loginStep, setLoginStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // ── Orders state ─────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const hasActiveRef = useRef(false);
  const onLogoutRef = useRef(onLogout);
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  // Reset login state when sheet closes
  useEffect(() => {
    if (!open) { setLoginStep("phone"); setOtp(""); setLoginError(""); }
  }, [open]);

  // Countdown tick for "Reenviar código"
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCountdown]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/customer/orders", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.status === 401) { onLogoutRef.current(); return; }
      if (res.ok) {
        const data = await res.json() as { orders: CustomerOrder[] };
        const list = data.orders || [];
        setOrders(list);
        hasActiveRef.current = list.some(o => ACTIVE_STATUSES.has(o.status));
      }
    } catch {}
  }, [token]);

  // Initial fetch when drawer opens with a valid token
  useEffect(() => {
    if (!open || !token) return;
    setOrdersLoading(true);
    fetchOrders().finally(() => setOrdersLoading(false));
  }, [open, token, fetchOrders]);

  // Polling — 15 s when there are active orders
  useEffect(() => {
    if (!open || !token) return;
    const id = setInterval(() => { if (hasActiveRef.current) fetchOrders(); }, 15_000);
    return () => clearInterval(id);
  }, [open, token, fetchOrders]);

  // ── Step 1: solicita código OTP ──────────────────────────────────────────
  const handleRequestCode = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setLoginError("Digite um telefone válido"); return; }
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/customer/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: digits, storeId }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setLoginStep("code");
        setResendCountdown(60);
      } else {
        setLoginError(data.error || "Erro ao enviar código");
      }
    } catch {
      setLoginError("Erro de conexão. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Step 2: valida OTP e autentica ───────────────────────────────────────
  const handleVerifyCode = useCallback(async (codeOverride?: string) => {
    const code = (codeOverride ?? otp).replace(/\D/g, "");
    if (code.length !== 6) { setLoginError("Digite os 6 dígitos do código"); return; }
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/customer/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), storeId, code }),
      });
      const data = await res.json() as { token?: string; customer?: { name: string }; error?: string };
      if (res.ok && data.token) {
        onLogin(data.token, data.customer?.name || "");
      } else {
        setLoginError(data.error || "Código inválido");
        setOtp("");
      }
    } catch {
      setLoginError("Erro de conexão. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  }, [otp, phone, storeId, onLogin]);

  // Auto-submit ao digitar o 6º dígito
  useEffect(() => {
    if (otp.length === 6 && !loginLoading) handleVerifyCode(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const maskedPhone = (() => {
    const d = phone.replace(/\D/g, "");
    if (d.length >= 10) {
      const area = d.slice(0, 2);
      const num = d.slice(2);
      const masked = num.slice(0, 3) + "***" + num.slice(-2);
      return `(${area}) ${masked}`;
    }
    return phone;
  })();

  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      }).format(new Date(iso));
    } catch { return ""; }
  };

  const summarize = (items: CustomerOrder["items"]) =>
    items.slice(0, 3).map(i => `${i.quantity}x ${i.productName}`).join(", ") +
    (items.length > 3 ? ` +${items.length - 3}` : "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0">
        <SheetHeader className="pb-4 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Meus Pedidos
          </SheetTitle>
        </SheetHeader>

        {!token ? (
          /* ── Login ── */
          <div className="flex flex-col items-center justify-center flex-1 px-2 gap-5 py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm">
              <Phone className="w-8 h-8 text-primary" />
            </div>

            {loginStep === "phone" ? (
              /* ── Etapa 1: telefone ── */
              <>
                <div className="text-center">
                  <p className="font-semibold text-base">Identifique-se</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Digite seu WhatsApp para ver o histórico de pedidos
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-3">
                  <input
                    value={phone}
                    onChange={e => setPhone(maskPhoneStore(e.target.value))}
                    onKeyDown={e => e.key === "Enter" && handleRequestCode()}
                    placeholder="(11) 99999-9999"
                    inputMode="numeric"
                    autoFocus
                    className="w-full h-12 rounded-2xl border border-border/50 bg-background px-4 text-center text-lg font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                  />
                  {loginError && (
                    <p className="text-sm text-destructive text-center">{loginError}</p>
                  )}
                  <Button
                    className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
                    onClick={handleRequestCode}
                    disabled={loginLoading}
                  >
                    {loginLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : "Receber código por WhatsApp"}
                  </Button>
                </div>
              </>
            ) : (
              /* ── Etapa 2: código OTP ── */
              <>
                <div className="text-center">
                  <p className="font-semibold text-base">Código enviado!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enviamos um código para o WhatsApp
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{maskedPhone}</p>
                </div>
                <div className="w-full max-w-xs space-y-4">
                  <input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={e => e.key === "Enter" && handleVerifyCode()}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    className="w-full h-14 rounded-2xl border border-border/50 bg-background px-4 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                  />
                  {loginError && (
                    <p className="text-sm text-destructive text-center">{loginError}</p>
                  )}
                  <Button
                    className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
                    onClick={() => handleVerifyCode()}
                    disabled={loginLoading || otp.replace(/\D/g, "").length < 6}
                  >
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                  </Button>
                  <div className="text-center">
                    {resendCountdown > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Reenviar em{" "}
                        <span className="tabular-nums font-semibold text-foreground">
                          {resendCountdown}s
                        </span>
                      </p>
                    ) : (
                      <button
                        onClick={handleRequestCode}
                        disabled={loginLoading}
                        className="text-xs text-primary hover:underline disabled:opacity-50 transition-opacity"
                      >
                        Reenviar código
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setLoginStep("phone"); setOtp(""); setLoginError(""); }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                  >
                    ← Trocar número
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ── Orders list ── */
          <div className="flex flex-col flex-1 overflow-hidden pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                Olá, <span className="font-medium text-foreground">{customerName.split(" ")[0]}</span>!
              </p>
              <button
                onClick={onLogout}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Sair
              </button>
            </div>

            {ordersLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <ClipboardList className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Nenhum pedido ainda</p>
                <p className="text-xs text-muted-foreground">Seus pedidos aparecem aqui</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {orders.map(order => {
                  const sc = ORDER_STATUS_MAP[order.status] ?? { label: order.status, cls: "bg-secondary text-foreground" };
                  return (
                    <div key={order.id} className="p-4 rounded-2xl border border-border/40 bg-secondary/20 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">#{order.number}</span>
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{summarize(order.items)}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</span>
                        <span className="text-sm font-bold" style={{ color: "var(--cor-primaria)" }}>
                          R$ {parseFloat(order.total).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── StoreFooter helpers ───────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` : hex;
}

// ── StoreFooter ───────────────────────────────────────────────────────────────
function StoreFooter({ store }: { store: StorePublicData }) {
  // ── Paleta derivada do tema da loja ──────────────────────────────────────
  //   footerBg  → mesma cor de fundo configurada pelo lojista (ou navy escuro como padrão)
  //   textMain  → cor de texto configurada (ou branco para o fundo escuro padrão)
  //   accent    → cor primária da marca, usada em ícones, badges e labels
  const footerBg = store.backgroundColor || "#0f172a";
  const textMain = store.textColor       || "#f8fafc";
  const accent   = store.primaryColor    || "#22c55e";

  // Todos os tokens derivam de textMain (opacidade) + accent (acentos)
  const C = {
    main:        textMain,
    body:        withAlpha(textMain, 0.72),
    muted:       withAlpha(textMain, 0.42),
    border:      withAlpha(textMain, 0.10),
    subtleBg:    withAlpha(textMain, 0.05),
    badgeBg:     withAlpha(accent,   0.10),
    badgeBorder: withAlpha(accent,   0.25),
    iconFg:      accent,
    link:        accent,
  } as const;

  // ── Formas de pagamento ──────────────────────────────────────────────────
  // Cada método só aparece se o grupo ao qual pertence estiver ativo.
  const payCfg   = store.paymentConfig;
  const onlineOn = payCfg?.online?.enabled   === true;
  const delivOn  = payCfg?.delivery?.enabled === true;

  type PayMethod = { key: string; label: string; icon: React.ElementType; accent?: string };
  const payMethods: PayMethod[] = [];

  // Mercado Pago — gateway do grupo online
  if (onlineOn && store.mpPublicKey)
    payMethods.push({ key: "mp",     label: "Mercado Pago",      icon: Wallet,     accent: "#009ee3" });

  // PIX — via entrega (chave configurada) ou via MP online
  const pixOnline   = onlineOn  && payCfg!.online.methods.pix;
  const pixDelivery = delivOn   && payCfg!.delivery.pix.enabled && !!payCfg!.delivery.pix.pixKey;
  if (pixOnline || pixDelivery)
    payMethods.push({ key: "pix",    label: "PIX",               icon: QrCode });

  // Cartão de crédito — via entrega (maquininha) ou via MP
  const creditOnline   = onlineOn && payCfg!.online.methods.creditCard;
  const creditDelivery = delivOn  && payCfg!.delivery.creditCard.enabled;
  if (creditOnline || creditDelivery)
    payMethods.push({ key: "credit", label: "Cartão de Crédito", icon: CreditCard });

  // Cartão de débito — via entrega ou via MP
  const debitOnline   = onlineOn && payCfg!.online.methods.debitCard;
  const debitDelivery = delivOn  && payCfg!.delivery.debitCard.enabled;
  if (debitOnline || debitDelivery)
    payMethods.push({ key: "debit",  label: "Cartão de Débito",  icon: CreditCard });

  // Dinheiro — exclusivo entrega
  if (delivOn && payCfg!.delivery.cash.enabled)
    payMethods.push({ key: "cash",   label: "Dinheiro",          icon: Banknote });

  // Fallback: config legada (deprecated) se v2 não estiver preenchida
  if (!payCfg && store.paymentMethodsConfig) {
    const legacyMap: Record<string, PayMethod> = {
      pix:         { key: "pix",    label: "PIX",               icon: QrCode },
      card:        { key: "credit", label: "Cartão de Crédito", icon: CreditCard },
      debit:       { key: "debit",  label: "Cartão de Débito",  icon: CreditCard },
      cash:        { key: "cash",   label: "Dinheiro",          icon: Banknote },
      mercadopago: { key: "mp",     label: "Mercado Pago",      icon: Wallet,    accent: "#009ee3" },
    };
    store.paymentMethodsConfig
      .filter(m => m.enabled)
      .forEach(m => { const mapped = legacyMap[m.key]; if (mapped) payMethods.push(mapped); });
  }

  // ── Links e endereço ─────────────────────────────────────────────────────
  const waRaw   = (store.whatsappPhone || store.phone || "").replace(/\D/g, "");
  const waPhone = waRaw.startsWith("55") ? waRaw : `55${waRaw}`;
  const waUrl   = waRaw ? `https://wa.me/${waPhone}` : null;
  const addr    = store.address;
  const mapsUrl = addr
    ? `https://maps.google.com/?q=${encodeURIComponent(`${addr.street}, ${addr.number}, ${addr.city}, ${addr.state}`)}`
    : null;
  const freeAbove = store.freeShippingAbove ? parseFloat(store.freeShippingAbove) : null;
  const baseFee   = store.deliveryFee ? parseFloat(store.deliveryFee) : 0;

  return (
    <footer style={{ backgroundColor: footerBg, color: C.body, borderTop: `3px solid ${withAlpha(accent, 0.55)}` }}>
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-10">

          {/* ── Col 1: Sobre & Horários ─────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={store.name}
                  className="w-10 h-10 rounded-xl object-contain p-1 shrink-0"
                  style={{ background: C.subtleBg }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: C.subtleBg, color: C.main }}
                >
                  {store.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <p className="text-base font-bold leading-tight" style={{ color: C.main }}>{store.name}</p>
            </div>

            {store.description && (
              <p className="text-sm leading-relaxed line-clamp-3" style={{ color: C.body }}>
                {store.description}
              </p>
            )}

            {store.businessHours && store.businessHours.length > 0 && (
              <div className="space-y-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.muted }}>
                  <Clock className="w-3.5 h-3.5" /> Horários
                </p>
                <ul className="space-y-1.5">
                  {store.businessHours.map((h) => (
                    <li key={h.day} className="flex items-center justify-between gap-3 text-xs">
                      <span className="shrink-0 w-20" style={{ color: C.body }}>{h.day}</span>
                      <span
                        className={h.closed ? "italic" : "font-medium tabular-nums"}
                        style={{ color: h.closed ? C.muted : C.main }}
                      >
                        {h.closed ? "Fechado" : `${h.open} – ${h.close}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Col 2: Endereço & Entrega ───────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.muted }}>
              Endereço &amp; Entrega
            </p>

            {addr ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: C.iconFg }} />
                  <div className="text-sm space-y-0.5 leading-relaxed" style={{ color: C.body }}>
                    <p>
                      {addr.street?.slice(0, 50)}, {addr.number?.slice(0, 5)}
                      {addr.complement ? `, ${addr.complement.slice(0, 100)}` : ""}
                    </p>
                    <p>{addr.neighborhood?.slice(0, 50)}</p>
                    <p>{addr.city?.slice(0, 50)} — {addr.state?.slice(0, 2).toUpperCase()} · CEP {addr.zip}</p>
                  </div>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
                    style={{ color: C.link }}
                  >
                    Ver no Maps <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: C.muted }}>Endereço não informado</p>
            )}

            <div className="pt-3 space-y-2" style={{ borderTop: `1px solid ${C.border}` }}>
              {store.deliveryEnabled && (
                <div className="flex items-center gap-2 text-xs" style={{ color: C.body }}>
                  <Truck className="w-3.5 h-3.5 shrink-0" style={{ color: C.iconFg }} />
                  <span>
                    {freeAbove !== null
                      ? `Frete grátis acima de R$ ${formatPrice(freeAbove)}`
                      : baseFee === 0
                      ? "Frete grátis"
                      : `Taxa de entrega: R$ ${formatPrice(baseFee)}`}
                  </span>
                </div>
              )}
              {store.pickupEnabled && (
                <div className="flex items-center gap-2 text-xs" style={{ color: C.body }}>
                  <Package className="w-3.5 h-3.5 shrink-0" style={{ color: C.iconFg }} />
                  <span>Retirada no local disponível</span>
                </div>
              )}
              {store.deliveryEstimate && (
                <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                  <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: C.iconFg }} />
                  <span>Prazo estimado: {store.deliveryEstimate}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Col 3: Formas de Pagamento ──────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.muted }}>
              Pagamentos
            </p>
            {payMethods.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {payMethods.map(({ key, label, icon: Icon, accent }) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{
                      background: accent ? withAlpha(accent, 0.10) : C.badgeBg,
                      border:     `1px solid ${accent ? withAlpha(accent, 0.25) : C.badgeBorder}`,
                      color:      C.main,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: accent ?? C.iconFg }} />
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm italic leading-relaxed" style={{ color: C.muted }}>
                Consulte as formas de pagamento na finalização do pedido.
              </p>
            )}
          </div>

          {/* ── Col 4: Atendimento ──────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.muted }}>
              Atendimento
            </p>
            <ul className="space-y-3">
              {waUrl && (
                <li>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm transition-opacity hover:opacity-80"
                    style={{ color: C.body }}
                  >
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(37,211,102,0.15)" }}
                    >
                      <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
                    </span>
                    WhatsApp
                  </a>
                </li>
              )}
              {store.phone && (
                <li>
                  <a
                    href={`tel:${store.phone.replace(/\D/g, "")}`}
                    className="flex items-center gap-2.5 text-sm transition-opacity hover:opacity-80"
                    style={{ color: C.body }}
                  >
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: C.subtleBg }}
                    >
                      <Phone className="w-4 h-4" style={{ color: C.iconFg }} />
                    </span>
                    {store.phone}
                  </a>
                </li>
              )}
              {store.email && (
                <li>
                  <a
                    href={`mailto:${store.email}`}
                    className="flex items-center gap-2.5 text-sm transition-opacity hover:opacity-80"
                    style={{ color: C.body }}
                  >
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: C.subtleBg }}
                    >
                      <Mail className="w-4 h-4" style={{ color: C.iconFg }} />
                    </span>
                    {store.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <p className="text-xs" style={{ color: C.muted }}>
            © {new Date().getFullYear()} {store.name} · Todos os direitos reservados
          </p>
          <p className="text-xs" style={{ color: C.muted }}>
            Desenvolvido com <span style={{ color: C.body }}>Armazix</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

const BOTTOM_ITEMS = [
  { href: "/store", label: "Início", icon: Home },
  { href: "/store/categories", label: "Categorias", icon: LayoutGrid },
  { href: "/store/search", label: "Buscar", icon: Search },
  { href: "/store/cart", label: "Carrinho", icon: ShoppingCart },
  { href: "/store/account", label: "Perfil", icon: User },
];

function StoreLayout() {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [store, setStore] = useState<StorePublicData | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [desktopSearch, setDesktopSearch] = useState("");
  const [activeCustomer, setActiveCustomer] = useState<ActiveCustomer | null>(null);
  // ── Central do Cliente ────────────────────────────────────────────────────
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [ordersOpen, setOrdersOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("storeCart");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const sanitized = parsed
        .filter((i: any) => i && typeof i.id === "string" && typeof i.name === "string" && typeof i.qty === "number")
        .map((i: any) => ({
          id: i.id,
          name: i.name,
          price: typeof i.price === "number" ? i.price : 0,
          image: typeof i.image === "string" ? i.image : null,
          emoji: typeof i.emoji === "string" ? i.emoji : null,
          qty: i.qty,
          obs: typeof i.obs === "string" ? i.obs : undefined,
          additions: Array.isArray(i.additions) ? i.additions : undefined,
        })) as CartItem[];
      setCart(sanitized);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("storeCart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Load real store data from slug or subdomain
  useEffect(() => {
    async function loadStore() {
      const slug = resolveStoreSlug();
      if (!slug) { setStoreLoading(false); return; }

      try {
        const res = await fetch(`/api/store/get?slug=${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          setStore(data.store);
          // Store storeId for checkout API calls
          if (data.store?.id) localStorage.setItem("storeId", data.store.id);
          if (data.store?.slug) localStorage.setItem("storeSlug", data.store.slug);
        }
      } catch {}
      finally { setStoreLoading(false); }
    }
    loadStore();
  }, []);

  // Load customer session from localStorage (scoped per store to avoid cross-store leaks)
  useEffect(() => {
    if (!store?.id) return;
    try {
      const token = localStorage.getItem(`customerToken_${store.id}`);
      const name  = localStorage.getItem(`customerName_${store.id}`);
      if (token) { setCustomerToken(token); setCustomerName(name || ""); }
    } catch {}
  }, [store?.id]);

  const handleCustomerLogin = (token: string, name: string) => {
    if (!store?.id) return;
    setCustomerToken(token);
    setCustomerName(name);
    try {
      localStorage.setItem(`customerToken_${store.id}`, token);
      localStorage.setItem(`customerName_${store.id}`, name);
    } catch {}
  };

  const handleCustomerLogout = () => {
    if (!store?.id) return;
    setCustomerToken(null);
    setCustomerName("");
    try {
      localStorage.removeItem(`customerToken_${store.id}`);
      localStorage.removeItem(`customerName_${store.id}`);
    } catch {}
  };

  const addToCart = (item: Omit<CartItem, "qty">) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));
  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty } : c)));
  };
  const cartCount = cart.reduce((a, c) => a + c.qty, 0);
  const cartTotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const toggleFavorite = (id: string) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  const clearCart = () => {
    setCart([]);
    try {
      localStorage.removeItem("storeCart");
    } catch {}
  };

  const deliveryFee = store?.deliveryEnabled
    ? parseFloat(store.deliveryFee || "0")
    : 0;
  const cartTotalWithFee = cartTotal + deliveryFee;

  const configuracaoVitrine = useMemo<ConfiguracaoVitrine>(() => {
    const phone = (store?.whatsappPhone || store?.phone || "").replace(/\D/g, "");
    return {
      lojaId: store?.id || "",
      logoUrl: store?.logoUrl || "",
      bannerUrl: store?.bannerUrl || "",
      bannerMobileUrl: store?.bannerMobileUrl || "",
      corPrimaria: store?.primaryColor || "#2A69E5",
      corFundo: store?.backgroundColor || "#ffffff",
      corTextos: store?.textColor || "#0f172a",
      exibirPreco: store?.showPrice !== false,
      pedidoWhatsapp: store?.whatsappOrderEnabled === true,
      telefoneWhatsapp: phone || undefined,
      destacarEstoqueBaixo: store?.highlightLowStock === true,
    };
  }, [
    store?.backgroundColor,
    store?.bannerMobileUrl,
    store?.bannerUrl,
    store?.highlightLowStock,
    store?.id,
    store?.logoUrl,
    store?.phone,
    store?.primaryColor,
    store?.showPrice,
    store?.textColor,
    store?.whatsappOrderEnabled,
    store?.whatsappPhone,
  ]);

  const themeStyle = useMemo(
    () =>
      ({
        "--cor-primaria": configuracaoVitrine.corPrimaria,
        "--cor-fundo": configuracaoVitrine.corFundo,
        "--cor-texto": configuracaoVitrine.corTextos,
      }) as CSSProperties,
    [configuracaoVitrine.corFundo, configuracaoVitrine.corPrimaria, configuracaoVitrine.corTextos]
  );

  const sendCartToWhatsApp = () => {
    if (!configuracaoVitrine.pedidoWhatsapp || !configuracaoVitrine.telefoneWhatsapp || cart.length === 0) return;

    const lines = [
      `Pedido da loja ${store?.name || "Armazix"}`,
      "",
      ...cart.map((item) => {
        const subtotal = item.price * item.qty;
        if (configuracaoVitrine.exibirPreco) {
          return `${item.qty}x ${item.name} - R$ ${formatPrice(subtotal)}`;
        }
        return `${item.qty}x ${item.name}`;
      }),
      "",
      configuracaoVitrine.exibirPreco ? `Total: R$ ${formatPrice(cartTotalWithFee)}` : "Total: sob consulta",
    ];

    const url = `https://wa.me/${configuracaoVitrine.telefoneWhatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Initials from store name
  const initials = store?.name
    ? store.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "...";

  // Open/closed status based on today's businessHours
  const isOpen = useMemo<boolean | null>(() => {
    const hours = store?.businessHours;
    if (!hours || hours.length === 0) return null;
    const now = new Date();
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const todayName = dayNames[now.getDay()];
    const todayH = hours.find(h => h.day.toLowerCase().slice(0, 3) === todayName.toLowerCase().slice(0, 3));
    if (!todayH) return null;
    if (todayH.closed) return false;
    const [oh, om] = todayH.open.split(":").map(Number);
    const [ch, cm] = todayH.close.split(":").map(Number);
    const m = now.getHours() * 60 + now.getMinutes();
    return m >= oh * 60 + om && m < ch * 60 + cm;
  }, [store?.businessHours]);

  return (
    <StoreContext.Provider value={{ store, configuracaoVitrine, storeLoading, cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, cartTotal, favorites, toggleFavorite, activeCustomer, setActiveCustomer, customerToken, customerName, loginCustomer: handleCustomerLogin, logoutCustomer: handleCustomerLogout }}>
      <div style={themeStyle} className="min-h-screen bg-[var(--cor-fundo)] text-[var(--cor-texto)] flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-3 md:px-6 h-14 md:h-16 flex items-center justify-between gap-3">
            {/* Logo + Store Name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Link to="/store" className="flex items-center gap-2 shrink-0">
                {store?.logoUrl ? (
                  <img src={store.logoUrl} alt={store.name} className="w-9 h-9 rounded-xl object-contain bg-slate-100 shadow-sm" />
                ) : (
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-glow text-xs font-bold shrink-0">
                    {storeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : initials}
                  </span>
                )}
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold truncate leading-tight">
                    {storeLoading ? "Carregando..." : store?.name || "Loja"}
                  </p>
                  {isOpen !== null && (
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-green-500" : "bg-red-500"}`} />
                      {isOpen ? "Aberto" : "Fechado"}
                    </span>
                  )}
                </div>
                {store?.deliveryEstimate && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{store.deliveryEstimate} · {deliveryFee === 0 ? "Frete grátis" : `R$ ${formatPrice(deliveryFee)}`}</p>
                )}
              </div>
            </div>

            {/* Desktop Search — expanded, sem links de navegação */}
            <div className="hidden md:flex items-center flex-1 mx-4">
              <form
                className="w-full"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = desktopSearch.trim();
                  window.location.href = q ? `/store/search?q=${encodeURIComponent(q)}` : "/store/search";
                }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={desktopSearch}
                    onChange={(e) => setDesktopSearch(e.target.value)}
                    placeholder="Buscar produtos, categorias..."
                    className="h-10 rounded-2xl border-0 bg-[#F1F3F5] pl-9 focus-visible:ring-2 focus-visible:ring-[var(--cor-primaria)]/30 w-full"
                  />
                </div>
              </form>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Link
                to="/store/search"
                className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <Search className="w-4.5 h-4.5 text-slate-600" />
              </Link>

              {/* Meus Pedidos */}
              <button
                onClick={() => setOrdersOpen(true)}
                aria-label="Meus pedidos"
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors relative"
              >
                <ClipboardList className="w-4.5 h-4.5 text-slate-700" />
                {customerToken && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white" />
                )}
              </button>

              {/* Cart */}
              <Sheet>
                <SheetTrigger asChild>
                  <button className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors relative">
                    <ShoppingCart className="w-4.5 h-4.5 text-slate-700" />
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[18px] h-[18px] rounded-full bg-[#163B78] text-white text-[10px] font-bold leading-none px-1">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Seu carrinho
                      {cartCount > 0 && (
                        <Badge className="rounded-full bg-primary/15 text-primary text-xs">{cartCount} {cartCount === 1 ? "item" : "itens"}</Badge>
                      )}
                    </SheetTitle>
                  </SheetHeader>
                  {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                        <ShoppingCart className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Seu carrinho está vazio</p>
                      <p className="text-xs text-muted-foreground">Adicione produtos para começar</p>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <div className="flex-1 overflow-y-auto py-4 space-y-3">
                        {cart.map((item) => (
                          <div key={item.id} className="flex gap-3 p-3 rounded-2xl bg-secondary/40">
                            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-2xl">{item.emoji || "📦"}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              {item.additions && item.additions.length > 0 && (
                                <p className="text-[10px] text-muted-foreground truncate">{item.additions.map(a => a.name).join(", ")}</p>
                              )}
                              {configuracaoVitrine.exibirPreco ? (
                                <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cor-primaria)" }}>
                                  R$ {formatPrice(item.price)}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-0.5">Sob consulta</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-secondary transition-colors">−</button>
                                <span className="text-sm font-semibold w-5 text-center">{item.qty}</span>
                                <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-secondary transition-colors">+</button>
                              </div>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="self-start text-muted-foreground hover:text-destructive transition-colors p-1 text-lg leading-none">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border/50 pt-4 space-y-2">
                        {configuracaoVitrine.exibirPreco && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span className="font-medium">R$ {formatPrice(cartTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Entrega</span>
                              {deliveryFee === 0
                                ? <span className="font-medium" style={{ color: "var(--cor-primaria)" }}>Grátis</span>
                                : <span className="font-medium">R$ {formatPrice(deliveryFee)}</span>
                              }
                            </div>
                            <div className="flex justify-between text-base font-bold pt-2 border-t border-border/50">
                              <span>Total</span>
                              <span>R$ {formatPrice(cartTotalWithFee)}</span>
                            </div>
                          </>
                        )}
                        {/* Sempre leva ao checkout — nunca dispara WhatsApp direto do carrinho */}
                        <Link
                          to="/store/checkout"
                          className="w-full h-12 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 mt-2 hover:opacity-90 active:scale-[0.99] transition-all shadow-lg"
                          style={{ backgroundColor: configuracaoVitrine.pedidoWhatsapp ? "#25D366" : "var(--cor-primaria)" }}
                        >
                          {configuracaoVitrine.pedidoWhatsapp
                            ? <><MessageCircle className="w-4 h-4" /> Preencher Dados de Entrega</>
                            : "Finalizar pedido"
                          }
                        </Link>
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto">
            {storeLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando loja...</p>
              </div>
            ) : !store ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 px-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                  <Store className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-bold">Loja não encontrada</h2>
                <p className="text-sm text-muted-foreground">Verifique o endereço e tente novamente.</p>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>

        {/* Footer */}
        {store && <StoreFooter store={store} />}

        {/* Bottom Navigation - Mobile */}
        {store && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-t border-border/40 lg:hidden safe-area-bottom">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
              {BOTTOM_ITEMS.map((item) => {
                const active = item.href === "/store" ? pathname === "/store" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex flex-col items-center gap-0.5 min-w-[48px] py-1"
                  >
                    <div className={`relative flex items-center justify-center w-10 h-7 rounded-xl transition-colors ${active ? "bg-primary/15" : ""}`}>
                      <item.icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      {item.href === "/store/cart" && cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">{cartCount}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
        {/* Central do Cliente — ordens drawer (controlled, no SheetTrigger) */}
        {store?.id && (
          <CustomerOrdersSheet
            open={ordersOpen}
            onOpenChange={setOrdersOpen}
            storeId={store.id}
            token={customerToken}
            customerName={customerName}
            onLogin={handleCustomerLogin}
            onLogout={handleCustomerLogout}
          />
        )}
      </div>
    </StoreContext.Provider>
  );
}
