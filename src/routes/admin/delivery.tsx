import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Truck, Clock, CheckCircle2, MapPin, Phone, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/delivery")({
  component: DeliveryPage,
  head: () => ({
    meta: [{ title: "Delivery — ARMAZIX" }],
  }),
});

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  preparando: { label: "Preparando", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/15" },
  em_rota: { label: "Em rota", icon: Truck, color: "text-purple-600", bgColor: "bg-purple-500/15" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "text-primary", bgColor: "bg-primary/15" },
};

interface Delivery {
  id: string;
  customer: string;
  address: string;
  phone: string;
  status: string;
  driver: string;
  time: string;
}

function DeliveryPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState({ preparing: 0, inRoute: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) {
      setLoading(false);
      setError("Loja não encontrada");
      return;
    }
    fetchDeliveryData(storeId);
  }, []);

  const fetchDeliveryData = async (storeId: string) => {
    try {
      const res = await fetch(`/api/delivery/orders?storeId=${storeId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar dados");
        return;
      }
      setDeliveries(data.deliveries || []);
      setStats(data.stats || { preparing: 0, inRoute: 0, delivered: 0 });
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

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
        <div className="text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Delivery</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe entregas em tempo real</p>
      </div>

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

      {deliveries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma entrega no momento</div>
      ) : (
      <div className="space-y-3">
        {deliveries.map((d) => {
          const cfg = statusConfig[d.status] || statusConfig.preparando;
          const Icon = cfg.icon;
          return (
            <Card key={d.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`grid place-items-center w-10 h-10 rounded-xl ${cfg.bgColor}`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{d.id}</span>
                        <Badge variant="secondary" className={`rounded-full text-[11px] ${cfg.bgColor} ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium mt-0.5">{d.customer}</div>
                      {d.address && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" />{d.address}
                        </div>
                      )}
                      {d.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Phone className="w-3 h-3" />{d.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {d.driver && (
                      <div className="text-xs text-muted-foreground">Motorista: {d.driver}</div>
                    )}
                    {d.time && (
                      <div className="text-xs font-semibold text-amber-600 mt-0.5">~{d.time}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
