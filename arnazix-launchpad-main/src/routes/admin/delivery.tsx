import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Truck, Clock, CheckCircle2, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/delivery")({
  component: DeliveryPage,
  head: () => ({
    meta: [{ title: "Delivery — ARMAZIX" }],
  }),
});

const deliveries = [
  { id: "#D001", customer: "Maria Silva", address: "Rua das Flores, 123 — Centro", phone: "(11) 99999-1234", status: "em_rota", driver: "Carlos", time: "15 min" },
  { id: "#D002", customer: "João Santos", address: "Av. Brasil, 456 — Jardim", phone: "(11) 98888-5678", status: "preparando", driver: "", time: "25 min" },
  { id: "#D003", customer: "Ana Costa", address: "Rua São Paulo, 789 — Vila", phone: "(11) 97777-9012", status: "entregue", driver: "Carlos", time: "" },
  { id: "#D004", customer: "Pedro Lima", address: "Rua Amazonas, 321 — Centro", phone: "(11) 96666-3456", status: "preparando", driver: "", time: "30 min" },
  { id: "#D005", customer: "Lucia Ferreira", address: "Rua Pará, 654 — Norte", phone: "(11) 95555-7890", status: "entregue", driver: "Roberto", time: "" },
];

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  preparando: { label: "Preparando", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/15" },
  em_rota: { label: "Em rota", icon: Truck, color: "text-purple-600", bgColor: "bg-purple-500/15" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "text-primary", bgColor: "bg-primary/15" },
};

function DeliveryPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Delivery</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe entregas em tempo real</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">2</div>
            <div className="text-xs text-muted-foreground">Preparando</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">1</div>
            <div className="text-xs text-muted-foreground">Em rota</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">2</div>
            <div className="text-xs text-muted-foreground">Entregues hoje</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {deliveries.map((d, i) => {
          const cfg = statusConfig[d.status];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
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
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" />{d.address}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Phone className="w-3 h-3" />{d.phone}
                        </div>
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
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
