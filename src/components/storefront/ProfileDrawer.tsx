import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  User, Package, Heart, MapPin, Tag, ChevronRight,
  Clock, Loader2, Lock, Phone, CheckCircle2, Search, LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { PhoneAuthModal } from "./PhoneAuthModal";

interface OrderData {
  id: string;
  number: number;
  status: string;
  total: string;
  createdAt: string;
  items: { productName: string; quantity: number }[];
}

interface AddressFields {
  cep: string; street: string; number: string;
  neighborhood: string; city: string; state: string;
  complement: string; obs: string;
}

const EMPTY_ADDR: AddressFields = {
  cep: "", street: "", number: "", neighborhood: "",
  city: "", state: "", complement: "", obs: "",
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pendente",   cls: "bg-amber-100 text-amber-700" },
  preparing:  { label: "Preparando", cls: "bg-blue-100 text-blue-700" },
  delivering: { label: "Em rota",    cls: "bg-purple-100 text-purple-700" },
  delivered:  { label: "Entregue",   cls: "bg-emerald-100 text-emerald-700" },
  completed:  { label: "Concluído",  cls: "bg-primary/15 text-primary" },
  cancelled:  { label: "Cancelado",  cls: "bg-red-100 text-red-700" },
};

const inputBase =
  "w-full h-11 rounded-xl border bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors";
const iNormal = `${inputBase} border-slate-200`;
const iFilled = `${inputBase} border-primary/40 bg-primary/5`;

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export interface ProfileDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  token: string | null;
  customerName: string;
  onLogin: (token: string, name: string) => void;
  onLogout: () => void;
  favorites: string[];
}

export function ProfileDrawer({
  open, onOpenChange, storeId, token, customerName, onLogin, onLogout, favorites,
}: ProfileDrawerProps) {
  const [authOpen, setAuthOpen]               = useState(false);
  const [showOnboarding, setShowOnboarding]   = useState(false);
  const [onboardingName, setOnboardingName]   = useState("");
  const [addr, setAddr]                       = useState<AddressFields>(EMPTY_ADDR);
  const [cepLoading, setCepLoading]           = useState(false);
  const [cepFilled, setCepFilled]             = useState(false);
  const [cepError, setCepError]               = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const [orders, setOrders]                   = useState<OrderData[]>([]);
  const [ordersLoading, setOrdersLoading]     = useState(false);

  const isNameUnset = !customerName || /^\d+$/.test(customerName.trim());

  useEffect(() => {
    if (!storeId || !token) { setShowOnboarding(false); return; }
    const flag = localStorage.getItem(`customerNeedsOnboarding_${storeId}`);
    if (flag === "1" || isNameUnset) setShowOnboarding(true);
  }, [storeId, token, isNameUnset]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/customer/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { orders: OrderData[] };
        setOrders(data.orders || []);
      }
    } catch {}
    finally { setOrdersLoading(false); }
  }, [token]);

  useEffect(() => {
    if (open && token && !showOnboarding) fetchOrders();
  }, [open, token, showOnboarding, fetchOrders]);

  // ── CEP lookup ────────────────────────────────────────────────────────────
  const lookupCep = useCallback(async (digits: string) => {
    if (digits.length !== 8) return;
    setCepLoading(true); setCepError(""); setCepFilled(false);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as {
        logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean;
      };
      if (data.erro) { setCepError("CEP não encontrado."); return; }
      setAddr(prev => ({
        ...prev,
        street:       data.logradouro || prev.street,
        neighborhood: data.bairro     || prev.neighborhood,
        city:         data.localidade || prev.city,
        state:        data.uf         || prev.state,
      }));
      setCepFilled(true);
    } catch { setCepError("Não foi possível buscar o CEP."); }
    finally  { setCepLoading(false); }
  }, []);

  const handleCepChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setAddr(prev => ({ ...prev, cep: masked }));
    setCepError(""); setCepFilled(false);
    if (digits.length === 8) lookupCep(digits);
  };

  const setField = (key: keyof AddressFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setAddr(prev => ({ ...prev, [key]: e.target.value }));

  const handleAuthSuccess = (newToken: string, name: string, isNew: boolean) => {
    onLogin(newToken, name);
    if (isNew || /^\d+$/.test(name.trim())) {
      setShowOnboarding(true);
      setOnboardingName(""); setAddr(EMPTY_ADDR);
      try { localStorage.setItem(`customerNeedsOnboarding_${storeId}`, "1"); } catch {}
    }
  };

  const submitOnboarding = async () => {
    const cepDigits = addr.cep.replace(/\D/g, "");
    if (!onboardingName.trim())  { setOnboardingError("Nome completo é obrigatório"); return; }
    if (cepDigits.length !== 8)  { setOnboardingError("CEP inválido (8 dígitos)");   return; }
    if (!addr.number.trim())     { setOnboardingError("Número é obrigatório");        return; }
    if (!addr.street.trim())     { setOnboardingError("Rua é obrigatória");           return; }
    if (!addr.city.trim())       { setOnboardingError("Cidade é obrigatória");        return; }
    if (!addr.state.trim())      { setOnboardingError("Estado é obrigatório");        return; }
    setOnboardingLoading(true); setOnboardingError("");
    try {
      const res = await fetch("/api/customer/profile", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: onboardingName.trim(),
          address: {
            cep:          cepDigits,
            street:       addr.street.trim(),
            number:       addr.number.trim(),
            neighborhood: addr.neighborhood.trim() || "-",
            city:         addr.city.trim(),
            state:        addr.state.trim().toUpperCase().slice(0, 2),
            complement:   addr.complement.trim() || undefined,
            obs:          addr.obs.trim()        || undefined,
          },
        }),
      });
      const data = await res.json() as { customer?: { name: string }; error?: string };
      if (res.ok && data.customer) {
        onLogin(token!, data.customer.name);
        setShowOnboarding(false);
        try { localStorage.removeItem(`customerNeedsOnboarding_${storeId}`); } catch {}
      } else {
        setOnboardingError(data.error || "Erro ao salvar dados");
      }
    } catch { setOnboardingError("Erro de conexão. Tente novamente."); }
    finally  { setOnboardingLoading(false); }
  };

  const firstName = customerName?.split(" ")[0] || "você";
  const initials  = customerName?.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">

          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-slate-100 shrink-0">
            <SheetTitle className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {token
                  ? <span className="text-xs font-bold text-primary">{initials}</span>
                  : <User className="w-4 h-4 text-primary" />
                }
              </div>
              {token ? `Olá, ${firstName}!` : "Meu Perfil"}
            </SheetTitle>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Gate: não logado ─────────────────────────────────────── */}
            {!token && (
              <div className="flex flex-col items-center justify-center min-h-[360px] px-8 text-center animate-in fade-in duration-300">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                  <Lock className="w-9 h-9 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">Acesse seu Perfil</h2>
                <p className="text-sm text-slate-500 mb-8 max-w-[260px] leading-relaxed">
                  Conecte-se para ver seus pedidos, favoritos e dados salvos.
                </p>
                <button
                  onClick={() => setAuthOpen(true)}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-primary/20 active:scale-[0.97] transition-transform"
                >
                  <Phone className="w-4 h-4" />
                  Conectar com seu Telefone
                </button>
              </div>
            )}

            {/* ── Onboarding ───────────────────────────────────────────── */}
            {token && showOnboarding && (
              <div className="px-6 py-5 space-y-5 animate-in fade-in duration-300">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold">Complete seu cadastro</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Preencha seus dados para facilitar seus pedidos futuros.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Dados pessoais</p>
                  <Field label="Nome completo" required>
                    <input type="text" placeholder="Seu nome completo" value={onboardingName}
                      onChange={(e) => setOnboardingName(e.target.value)} className={iNormal} autoFocus />
                  </Field>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Endereço de entrega</p>

                  <Field label="CEP" required>
                    <div className="relative">
                      <input type="text" inputMode="numeric" placeholder="00000-000" value={addr.cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        className={cepFilled ? iFilled : iNormal} maxLength={9} />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cepLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        {!cepLoading && cepFilled && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        {!cepLoading && !cepFilled && addr.cep.replace(/\D/g, "").length < 8 && (
                          <Search className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    </div>
                    {cepError && <p className="text-xs text-red-500 mt-1">{cepError}</p>}
                    {cepFilled && (
                      <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3 h-3" /> Endereço preenchido automaticamente
                      </p>
                    )}
                  </Field>

                  <Field label="Rua / Logradouro" required>
                    <input type="text" placeholder="Nome da rua" value={addr.street}
                      onChange={setField("street")}
                      className={cepFilled && addr.street ? iFilled : iNormal} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Número" required>
                      <input type="text" inputMode="numeric" placeholder="Ex: 123" value={addr.number}
                        onChange={setField("number")} className={iNormal} />
                    </Field>
                    <Field label="Complemento">
                      <input type="text" placeholder="Apto, Bloco..." value={addr.complement}
                        onChange={setField("complement")} className={iNormal} />
                    </Field>
                  </div>

                  <Field label="Bairro">
                    <input type="text" placeholder="Nome do bairro" value={addr.neighborhood}
                      onChange={setField("neighborhood")}
                      className={cepFilled && addr.neighborhood ? iFilled : iNormal} />
                  </Field>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Field label="Cidade" required>
                        <input type="text" placeholder="Cidade" value={addr.city}
                          onChange={setField("city")}
                          className={cepFilled && addr.city ? iFilled : iNormal} />
                      </Field>
                    </div>
                    <Field label="Estado" required>
                      <input type="text" placeholder="UF" value={addr.state}
                        onChange={setField("state")} maxLength={2}
                        className={`uppercase ${cepFilled && addr.state ? iFilled : iNormal}`} />
                    </Field>
                  </div>

                  <Field label="Observação de entrega">
                    <textarea placeholder="Referência, ponto de encontro..." value={addr.obs}
                      onChange={setField("obs")} rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors resize-none" />
                  </Field>
                </div>

                {onboardingError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
                    <p className="text-xs text-red-600 font-medium">{onboardingError}</p>
                  </div>
                )}

                <button onClick={submitOnboarding} disabled={onboardingLoading}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20 active:scale-[0.98] transition-all">
                  {onboardingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar e continuar
                </button>
              </div>
            )}

            {/* ── Perfil completo ───────────────────────────────────────── */}
            {token && !showOnboarding && (
              <div className="px-6 py-5 space-y-5 animate-in fade-in duration-300">

                {/* Saudação */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-base font-bold text-primary">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">Olá, {firstName}!</p>
                    <p className="text-sm text-slate-500">Bem-vindo de volta</p>
                  </div>
                </div>

                {/* Atalhos rápidos */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { n: ordersLoading ? "…" : String(orders.length), label: "Pedidos",   icon: Package },
                    { n: String(favorites.length),                     label: "Favoritos", icon: Heart },
                    { n: "0",                                           label: "Cupons",    icon: Tag },
                  ].map(({ n, label, icon: Icon }) => (
                    <div key={label}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-1">
                      <Icon className="w-4 h-4 text-primary mb-0.5" />
                      <p className="text-lg font-bold leading-none">{n}</p>
                      <p className="text-[10px] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Pedidos recentes */}
                <div>
                  <h3 className="text-sm font-bold mb-3">Pedidos recentes</h3>
                  {ordersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <Package className="w-8 h-8 text-slate-300" />
                      <p className="text-sm text-slate-400">Nenhum pedido ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.slice(0, 5).map(order => (
                        <Link key={order.id}
                          to="/store/order/$orderId"
                          params={{ orderId: order.id }}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold">#{order.number}</p>
                              <Badge className={`rounded-full text-[10px] border-0 px-2 py-0.5 ${STATUS_MAP[order.status]?.cls || "bg-slate-100 text-slate-600"}`}>
                                {STATUS_MAP[order.status]?.label || order.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400">
                              {new Date(order.createdAt).toLocaleDateString("pt-BR")} · {order.items?.length || 0} {order.items?.length === 1 ? "item" : "itens"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">
                              R$ {parseFloat(order.total || "0").toFixed(2).replace(".", ",")}
                            </p>
                            <ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-0.5" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Menu de navegação */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Minha conta</p>
                  <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {[
                      { icon: Heart,  label: "Favoritos",     desc: `${favorites.length} produtos salvos` },
                      { icon: MapPin, label: "Endereços",      desc: "Gerenciar endereços" },
                      { icon: Tag,    label: "Cupons",         desc: "Cupons disponíveis" },
                      { icon: Clock,  label: "Histórico",      desc: "Todos os pedidos" },
                      { icon: User,   label: "Dados pessoais", desc: "Nome, telefone e mais" },
                    ].map(item => (
                      <button key={item.label}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left">
                        <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                          <item.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-slate-400">{item.desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={() => { onLogout(); onOpenChange(false); }}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>

                {/* Spacer para não grudar no fundo */}
                <div className="h-2" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* PhoneAuthModal fora do Sheet para evitar conflito de z-index */}
      <PhoneAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        storeId={storeId}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
