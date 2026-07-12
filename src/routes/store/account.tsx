import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User, Package, Heart, MapPin, Tag, ChevronRight,
  Clock, Loader2, Lock, Phone,
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

const statusConfig: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pendente",   color: "bg-amber-500/15 text-amber-700" },
  preparing: { label: "Preparando", color: "bg-blue-500/15 text-blue-700" },
  delivering:{ label: "Em rota",    color: "bg-purple-500/15 text-purple-700" },
  delivered: { label: "Entregue",   color: "bg-emerald-500/15 text-emerald-700" },
  completed: { label: "Concluído",  color: "bg-primary/15 text-primary" },
  cancelled: { label: "Cancelado",  color: "bg-red-500/15 text-red-700" },
};

function AccountPage() {
  const { store, favorites, customerToken, customerName, loginCustomer } = useStore();

  // ── Auth modal ─────────────────────────────────────────────────
  const [authOpen, setAuthOpen] = useState(false);

  // ── Onboarding ─────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingAddress, setOnboardingAddress] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");

  // ── Orders ─────────────────────────────────────────────────────
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Detecta cliente sem nome ainda preenchido (nome = número de telefone)
  const isNameUnset = !customerName || /^\d+$/.test(customerName.trim());

  // Verifica flag de onboarding pendente no localStorage
  useEffect(() => {
    if (!store?.id || !customerToken) return;
    const flag = localStorage.getItem(`customerNeedsOnboarding_${store.id}`);
    if (flag === "1" || isNameUnset) setShowOnboarding(true);
  }, [store?.id, customerToken, isNameUnset]);

  // Busca pedidos autenticados
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

  // ── Handlers ───────────────────────────────────────────────────
  const handleAuthSuccess = (token: string, name: string, isNew: boolean) => {
    loginCustomer(token, name);
    const needsOnboarding = isNew || /^\d+$/.test(name.trim());
    if (needsOnboarding) {
      setShowOnboarding(true);
      setOnboardingName("");
      try { localStorage.setItem(`customerNeedsOnboarding_${store?.id}`, "1"); } catch {}
    }
  };

  const submitOnboarding = async () => {
    if (!onboardingName.trim()) { setOnboardingError("Nome é obrigatório"); return; }
    if (!onboardingAddress.trim()) { setOnboardingError("Endereço é obrigatório"); return; }
    setOnboardingLoading(true);
    setOnboardingError("");
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ name: onboardingName.trim(), address: onboardingAddress.trim() }),
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

  // ── GATE: não logado ───────────────────────────────────────────
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
          className="w-full max-w-xs h-13 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-primary/20 transition-transform active:scale-[0.97]"
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

  // ── ONBOARDING: primeiro acesso ────────────────────────────────
  if (showOnboarding) {
    return (
      <div className="px-4 pt-6 pb-8 animate-in fade-in duration-300 max-w-sm mx-auto">
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <User className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Complete seu cadastro</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Precisamos de alguns dados para identificar você nos seus pedidos.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">
              Nome completo *
            </label>
            <input
              type="text"
              placeholder="Seu nome completo"
              value={onboardingName}
              onChange={(e) => setOnboardingName(e.target.value)}
              className="w-full h-12 rounded-xl border border-border bg-surface px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">
              Endereço de entrega *
            </label>
            <textarea
              placeholder="Rua, número, bairro, cidade..."
              value={onboardingAddress}
              onChange={(e) => setOnboardingAddress(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {onboardingError && (
            <p className="text-xs text-destructive">{onboardingError}</p>
          )}

          <button
            onClick={submitOnboarding}
            disabled={onboardingLoading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          >
            {onboardingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar e continuar
          </button>
        </div>
      </div>
    );
  }

  // ── PERFIL COMPLETO ─────────────────────────────────────────────
  const recentOrders = orders.slice(0, 5);
  const firstName = customerName?.split(" ")[0] || "Você";

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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Pedidos recentes</h3>
        </div>
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
          { icon: Heart, label: "Favoritos",      desc: `${favorites.length} produtos salvos` },
          { icon: MapPin, label: "Endereços",      desc: "Gerenciar endereços" },
          { icon: Tag,    label: "Cupons",         desc: "Cupons disponíveis" },
          { icon: Clock,  label: "Histórico",      desc: "Todos os pedidos" },
          { icon: User,   label: "Dados pessoais", desc: "Nome, e-mail, telefone" },
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
