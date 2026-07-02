import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Truck, Clock, CheckCircle2, MapPin, Phone, Loader2,
  ChefHat, XCircle, RefreshCw, PackageCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/delivery")({
  component: DeliveryPage,
  head: () => ({
    meta: [{ title: "Delivery — ARMAZIX" }],
  }),
});

// Espelha exatamente os statuses do banco (orders.status)
const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}> = {
  pending:    { label: "Em Análise",   icon: Loader2,       color: "text-amber-600",      bgColor: "bg-amber-500/15" },
  received:   { label: "Recebido",     icon: Clock,         color: "text-blue-600",       bgColor: "bg-blue-500/15" },
  preparing:  { label: "Em Preparo",   icon: ChefHat,       color: "text-amber-600",      bgColor: "bg-amber-500/15" },
  ready:      { label: "Pronto",       icon: PackageCheck,  color: "text-emerald-600",    bgColor: "bg-emerald-500/15" },
  delivering: { label: "Em Rota",      icon: Truck,         color: "text-purple-600",     bgColor: "bg-purple-500/15" },
  delivered:  { label: "Entregue",     icon: CheckCircle2,  color: "text-primary",        bgColor: "bg-primary/15" },
  cancelled:  { label: "Cancelado",    icon: XCircle,       color: "text-destructive",    bgColor: "bg-destructive/15" },
};

const POLL_INTERVAL_MS = 15_000;

interface Delivery {
  id: string;
  orderId: string;
  number: number;
  customer: string;
  address: string;
  phone: string;
  status: string;
  total: string;
  time: string;
  updatedAt: string;
}

interface Stats {
  preparing: number;
  inRoute: number;
  delivered: number;
}

function DeliveryPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState<Stats>({ preparing: 0, inRoute: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const storeIdRef = useRef<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    const storeId = storeIdRef.current;
    if (!storeId) return;
    if (silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/delivery/orders?storeId=${storeId}`);
      const data = await res.json() as { deliveries?: Delivery[]; stats?: Stats; error?: string };
      if (!res.ok) {
        if (!silent) setError(data.error || "Erro ao carregar dados");
        return;
      }
      setDeliveries(data.deliveries || []);
      setStats(data.stats || { preparing: 0, inRoute: 0, delivered: 0 });
      setLastUpdate(new Date());
      setError("");
    } catch {
      if (!silent) setError("Erro de conexão");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) { setLoading(false); setError("Loja não encontrada"); return; }
    storeIdRef.current = storeId;
    void fetchData(false);

    const interval = setInterval(() => void fetchData(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void fetchData(false)}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const active = deliveries.filter(d => !["delivered", "cancelled"].includes(d.status));
  const done   = deliveries.filter(d => d.status === "delivered");
  const cancelled = deliveries.filter(d => d.status === "cancelled");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sincronizado em tempo real com a aba Pedidos
            {lastUpdate && (
              <span className="ml-2 text-xs">
                · atualizado às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 shrink-0"
          disabled={refreshing}
          onClick={() => void fetchData(true)}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.preparing}</div>
            <div className="text-xs text-muted-foreground">Preparando</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.inRoute}</div>
            <div className="text-xs text-muted-foreground">Em rota</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.delivered}</div>
            <div className="text-xs text-muted-foreground">Entregues hoje</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista ativa */}
      {active.length === 0 && done.length === 0 && cancelled.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma entrega no momento
        </div>
      ) : (
        <div className="space-y-6">
          {/* Em andamento */}
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Em andamento — {active.length}
              </h2>
              {active.map((d) => <DeliveryCard key={d.orderId} delivery={d} />)}
            </section>
          )}

          {/* Entregues */}
          {done.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Entregues — {done.length}
              </h2>
              {done.map((d) => <DeliveryCard key={d.orderId} delivery={d} />)}
            </section>
          )}

          {/* Cancelados */}
          {cancelled.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Cancelados — {cancelled.length}
              </h2>
              {cancelled.map((d) => <DeliveryCard key={d.orderId} delivery={d} />)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DeliveryCard({ delivery: d }: { delivery: Delivery }) {
  const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.received;
  const Icon = cfg.icon;

  return (
    <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${cfg.bgColor}`}>
              <Icon className={`w-5 h-5 ${cfg.color}`} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold">{d.id}</span>
                <Badge
                  variant="secondary"
                  className={`rounded-full text-[11px] border-0 ${cfg.bgColor} ${cfg.color}`}
                >
                  {cfg.label}
                </Badge>
              </div>
              <div className="text-sm font-medium mt-0.5 truncate">{d.customer}</div>
              {d.address && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{d.address}</span>
                </div>
              )}
              {d.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Phone className="w-3 h-3 shrink-0" />{d.phone}
                </div>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold">
              R$ {parseFloat(d.total).toFixed(2).replace(".", ",")}
            </div>
            {d.time && (
              <div className="text-xs font-semibold text-amber-600 mt-0.5">{d.time}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
