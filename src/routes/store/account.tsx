import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User, Package, Heart, MapPin, Tag, ChevronRight,
  Clock, Loader2, Lock, Phone, CheckCircle2, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { useStore } from "../store";
import { PhoneAuthModal } from "@/components/storefront/PhoneAuthModal";

export const Route = createFileRoute("/store/account")({
  component: AccountPage,
});

interface OrderData {
  id: string;
  number: number;
  status: string;
  total: string;
  createdAt: string;
  items: { productName: string; quantity: number }[];
}

interface AddressFields {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  obs: string;
}

const EMPTY_ADDR: AddressFields = {
  cep: "", street: "", number: "", neighborhood: "",
  city: "", state: "", complement: "", obs: "",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendente",   color: "bg-amber-500/15 text-amber-700"   },
  preparing:  { label: "Preparando", color: "bg-blue-500/15 text-blue-700"     },
  delivering: { label: "Em rota",    color: "bg-purple-500/15 text-purple-700" },
  delivered:  { label: "Entregue",   color: "bg-emerald-500/15 text-emerald-700" },
  completed:  { label: "Concluído",  color: "bg-primary/15 text-primary"       },
  cancelled:  { label: "Cancelado",  color: "bg-red-500/15 text-red-700"       },
};

// ── Input helpers ──────────────────────────────────────────────────────────────
const inputBase =
  "w-full h-11 rounded-xl border bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors";
const inputNormal   = `${inputBase} border-border`;
const inputFilled   = `${inputBase} border-primary/40 bg-primary/5`;
const inputDisabled = `${inputBase} border-border bg-secondary/50 text-muted-foreground cursor-default`;

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── AccountPage ────────────────────────────────────────────────────────────────
function AccountPage() {
  const { store, favorites, customerToken, customerName, loginCustomer } = useStore();

  // ── Auth modal ─────────────────────────────────────────────────────────────
  const [authOpen, setAuthOpen] = useState(false);

  // ── Onboarding state ───────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding]     = useState(false);
  const [onboardingName, setOnboardingName]     = useState("");
  const [addr, setAddr]                         = useState<AddressFields>(EMPTY_ADDR);
  const [cepLoading, setCepLoading]             = useState(false);
  const [cepFilled, setCepFilled]               = useState(false);
  const [cepError, setCepError]                 = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError]   = useState("");

  // ── Orders state ───────────────────────────────────────────────────────────
  const [orders, setOrders]           = useState<OrderData[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Detecta cliente sem nome preenchido (nome = número de telefone)
  const isNameUnset = !customerName || /^\d+$/.test(customerName.trim());

  useEffect(() => {
    if (!store?.id || !customerToken) return;
    const flag = localStorage.getItem(`customerNeedsOnboarding_${store.id}`);
    if (flag === "1" || isNameUnset) setShowOnboarding(true);
  }, [store?.id, customerToken, isNameUnset]);

  const fetchOrders = useCallback(async () => {
    if (!customerToken) return;
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/customer/orders", {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      if (res.ok) {
        const data = await res.json() as { orders: OrderData[] };
        setOrders(data.orders || []);
      }
    } catch {}
    finally { setOrdersLoading(false); }
  }, [customerToken]);

  useEffect(() => {
    if (customerToken && !showOnboarding) fetchOrders();
  }, [customerToken, showOnboarding, fetchOrders]);

  // ── CEP lookup (ViaCEP) ────────────────────────────────────────────────────
  const lookupCep = useCallback(async (digits: string) => {
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    setCepFilled(false);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as {
        logradouro?: string; bairro?: string; localidade?: string;
        uf?: string; erro?: boolean;
      };
      if (data.erro) { setCepError("CEP não encontrado. Preencha o endereço manualmente."); return; }
      setAddr(prev => ({
        ...prev,
        street:       data.logradouro || prev.street,
        neighborhood: data.bairro     || prev.neighborhood,
        city:         data.localidade || prev.city,
        state:        data.uf         || prev.state,
      }));
      setCepFilled(true);
    } catch {
      setCepError("Não foi possível buscar o CEP. Preencha manualmente.");
    } finally {
      setCepLoading(false);
    }
  }, []);

  const handleCepChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setAddr(prev => ({ ...prev, cep: masked }));
    setCepError("");
    setCepFilled(false);
    if (digits.length === 8) lookupCep(digits);
  };

  const setField = (key: keyof AddressFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setAddr(prev => ({ ...prev, [key]: e.target.value }));

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAuthSuccess = (token: string, name: string, isNew: boolean) => {
    loginCustomer(token, name);
    if (isNew || /^\d+$/.test(name.trim())) {
      setShowOnboarding(true);
      setOnboardingName("");
      setAddr(EMPTY_ADDR);
      try { localStorage.setItem(`customerNeedsOnboarding_${store?.id}`, "1"); } catch {}
    }
  };

  const submitOnboarding = async () => {
    const cepDigits = addr.cep.replace(/\D/g, "");
    if (!onboardingName.trim())  { setOnboardingError("Nome completo é obrigatório");  return; }
    if (cepDigits.length !== 8)  { setOnboardingError("CEP inválido (8 dígitos)");     return; }
    if (!addr.number.trim())     { setOnboardingError("Número do endereço é obrigatório"); return; }
    if (!addr.street.trim())     { setOnboardingError("Nome da rua é obrigatório");    return; }
    if (!addr.city.trim())       { setOnboardingError("Cidade é obrigatória");         return; }
    if (!addr.state.trim())      { setOnboardingError("Estado é obrigatório");         return; }

    setOnboardingLoading(true);
    setOnboardingError("");
    try {
      const res = await fetch("/api/customer/profile", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${customerToken}` },
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
        loginCustomer(customerToken!, data.customer.name);
        setShowOnboarding(false);
        try { localStorage.removeItem(`customerNeedsOnboarding_${store?.id}`); } catch {}
      } else {
        setOnboardingError(data.error || "Erro ao salvar dados");
      }
    } catch {
      setOnboardingError("Erro de conexão. Tente novamente.");
    } finally {
      setOnboardingLoading(false);
    }
  };

  // ── GATE: não logado ───────────────────────────────────────────────────────
  if (!customerToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-12rem)] px-6 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <Lock className="w-9 h-9 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Acesse seu Perfil</h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-[260px] leading-relaxed">
          Conecte-se para ver seus pedidos, favoritos e dados salvos.
        </p>
        <button
          onClick={() => setAuthOpen(true)}
          className="w-full max-w-xs h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-primary/20 transition-transform active:scale-[0.97]"
        >
          <Phone className="w-4 h-4" />
          Conectar com seu Telefone
        </button>
        <PhoneAuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          storeId={store?.id || ""}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // ── ONBOARDING: primeiro acesso ───────────────────────────────────────────
  if (showOnboarding) {
    const cepDigits = addr.cep.replace(/\D/g, "");
    const addressAutoFilled = cepFilled && !!addr.street;

    return (
      <div className="px-4 pt-5 pb-10 animate-in fade-in duration-300 max-w-md mx-auto">
        {/* Header */}
        <div className="mb-5">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <User className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Complete seu cadastro</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Preencha seus dados para facilitar seus pedidos futuros.
          </p>
        </div>

        <div className="space-y-5">

          {/* ── Dados pessoais ────────────────────────────────────── */}
          <div className="p-4 rounded-2xl border border-border/60 bg-surface space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Dados pessoais
            </p>
            <Field label="Nome completo" required>
              <input
                type="text"
                placeholder="Seu nome completo"
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
                className={inputNormal}
                autoFocus
              />
            </Field>
          </div>

          {/* ── Endereço ──────────────────────────────────────────── */}
          <div className="p-4 rounded-2xl border border-border/60 bg-surface space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Endereço de entrega
            </p>

            {/* CEP */}
            <Field label="CEP" required>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={addr.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  className={cepFilled ? inputFilled : inputNormal}
                  maxLength={9}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {cepLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {!cepLoading && cepFilled && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  {!cepLoading && !cepFilled && cepDigits.length < 8 && (
                    <Search className="w-4 h-4 text-muted-foreground/50" />
                  )}
                </div>
              </div>
              {cepError && <p className="text-xs text-destructive mt-1">{cepError}</p>}
              {cepFilled && (
                <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Endereço preenchido automaticamente
                </p>
              )}
            </Field>

            {/* Rua */}
            <Field label="Rua / Logradouro" required>
              <input
                type="text"
                placeholder="Nome da rua"
                value={addr.street}
                onChange={setField("street")}
                className={addressAutoFilled ? inputFilled : inputNormal}
                readOnly={false}
              />
            </Field>

            {/* Número + Complemento (lado a lado) */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número" required>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 123"
                  value={addr.number}
                  onChange={setField("number")}
                  className={inputNormal}
                />
              </Field>
              <Field label="Complemento">
                <input
                  type="text"
                  placeholder="Apto, Bloco..."
                  value={addr.complement}
                  onChange={setField("complement")}
                  className={inputNormal}
                />
              </Field>
            </div>

            {/* Bairro */}
            <Field label="Bairro">
              <input
                type="text"
                placeholder="Nome do bairro"
                value={addr.neighborhood}
                onChange={setField("neighborhood")}
                className={addressAutoFilled && addr.neighborhood ? inputFilled : inputNormal}
              />
            </Field>

            {/* Cidade + Estado (lado a lado) */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Cidade" required>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={addr.city}
                    onChange={setField("city")}
                    className={addressAutoFilled && addr.city ? inputFilled : inputNormal}
                  />
                </Field>
              </div>
              <Field label="Estado" required>
                <input
                  type="text"
                  placeholder="UF"
                  value={addr.state}
                  onChange={setField("state")}
                  maxLength={2}
                  className={`uppercase ${addressAutoFilled && addr.state ? inputFilled : inputNormal}`}
                />
              </Field>
            </div>

            {/* OBS */}
            <Field label="Observação de entrega">
              <textarea
                placeholder="Referência, ponto de encontro, instruções..."
                value={addr.obs}
                onChange={setField("obs")}
                rows={2}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors resize-none"
              />
            </Field>
          </div>

          {/* Erro geral */}
          {onboardingError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5">
              <p className="text-xs text-destructive font-medium">{onboardingError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={submitOnboarding}
            disabled={onboardingLoading}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity shadow-md shadow-primary/20 active:scale-[0.98]"
          >
            {onboardingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar e continuar
          </button>
        </div>
      </div>
    );
  }

  // ── PERFIL COMPLETO ───────────────────────────────────────────────────────
  const recentOrders = orders.slice(0, 5);
  const firstName    = customerName?.split(" ")[0] || "Você";

  return (
    <div className="px-4 pt-4 pb-4 animate-in fade-in duration-300">
      {/* Saudação */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl bg-primary/5 border border-primary/10">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">Olá, {firstName}!</p>
          <p className="text-xs text-muted-foreground">Bem-vindo de volta</p>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="p-3 rounded-2xl bg-surface border border-border/40 text-center">
          <p className="text-lg font-bold">{ordersLoading ? "…" : orders.length}</p>
          <p className="text-[10px] text-muted-foreground">Pedidos</p>
        </div>
        <div className="p-3 rounded-2xl bg-surface border border-border/40 text-center">
          <p className="text-lg font-bold">{favorites.length}</p>
          <p className="text-[10px] text-muted-foreground">Favoritos</p>
        </div>
        <div className="p-3 rounded-2xl bg-surface border border-border/40 text-center">
          <p className="text-lg font-bold">0</p>
          <p className="text-[10px] text-muted-foreground">Cupons</p>
        </div>
      </div>

      {/* Pedidos recentes */}
      <div className="mb-5">
        <h3 className="text-sm font-bold mb-3">Pedidos recentes</h3>
        {ordersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido ainda</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(order => (
              <Link
                key={order.id}
                to="/store/order/$orderId"
                params={{ orderId: order.id }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border/40 hover:shadow-soft transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">#{order.number}</p>
                    <Badge className={`rounded-full text-[10px] border-0 ${statusConfig[order.status]?.color || "bg-secondary text-muted-foreground"}`}>
                      {statusConfig[order.status]?.label || order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")} · {order.items?.length || 0} itens
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">
                    R$ {parseFloat(order.total || "0").toFixed(2).replace(".", ",")}
                  </p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="space-y-1">
        {[
          { icon: Heart,  label: "Favoritos",      desc: `${favorites.length} produtos salvos` },
          { icon: MapPin, label: "Endereços",       desc: "Gerenciar endereços" },
          { icon: Tag,    label: "Cupons",          desc: "Cupons disponíveis" },
          { icon: Clock,  label: "Histórico",       desc: "Todos os pedidos" },
          { icon: User,   label: "Dados pessoais",  desc: "Nome, e-mail, telefone" },
        ].map(item => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
          >
            <item.icon className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
