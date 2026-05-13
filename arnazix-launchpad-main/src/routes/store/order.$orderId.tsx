import { createFileRoute } from "@tanstack/react-router";
import { Package, Clock, ChefHat, Truck, CheckCircle2, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/store/order/$orderId")({
  component: OrderTrackingPage,
  head: () => ({
    meta: [{ title: "Pedido — Mercado do Zé" }],
  }),
});

const STEPS = [
  { key: "received", label: "Pedido recebido", time: "14:30", icon: Package },
  { key: "preparing", label: "Preparando", time: "14:35", icon: ChefHat },
  { key: "delivery", label: "Saiu para entrega", time: "14:55", icon: Truck },
  { key: "delivered", label: "Entregue", time: "~15:10", icon: CheckCircle2 },
];

function OrderTrackingPage() {
  const currentStep = 2; // "delivery" step

  return (
    <div className="px-4 pt-4 pb-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Pedido #3250</h1>
          <p className="text-xs text-muted-foreground">Hoje, 14:30 · 3 itens</p>
        </div>
        <Badge className="rounded-full bg-purple-500/15 text-purple-700 border-0">Em rota</Badge>
      </div>

      {/* ETA Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-emerald-500/10 border border-primary/20 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold">Previsão de entrega</p>
            <p className="text-xl font-bold text-primary">15-20 min</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-5">
        <h3 className="text-sm font-bold mb-3">Acompanhamento</h3>
        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const done = i <= currentStep;
            const current = i === currentStep;
            return (
              <div key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    current ? "bg-primary/15 ring-2 ring-primary" : done ? "bg-primary/10" : "bg-secondary"
                  }`}>
                    <step.icon className={`w-4 h-4 ${done ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-0.5 h-8 ${done && i < currentStep ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
                <div className="pb-4">
                  <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery Person */}
      <div className="p-4 rounded-2xl bg-surface border border-border/40 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
            RS
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Roberto Silva</p>
            <p className="text-xs text-muted-foreground">Entregador</p>
          </div>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Phone className="w-4 h-4 text-primary" />
            </button>
            <button className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="mb-5">
        <h3 className="text-sm font-bold mb-3">Itens do pedido</h3>
        <div className="space-y-2">
          {[
            { name: "Hambúrguer Artesanal", qty: 2, price: 57.80, image: "🍔" },
            { name: "Batata frita", qty: 1, price: 12.90, image: "🍟" },
            { name: "Refrigerante 350ml", qty: 2, price: 13.80, image: "🥤" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
              <span className="text-lg">{item.image}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.qty}x</p>
              </div>
              <span className="text-sm font-bold">R$ {item.price.toFixed(2).replace(".", ",")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="p-4 rounded-2xl bg-surface border border-border/40">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Subtotal</span>
          <span>R$ 84,50</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Entrega</span>
          <span className="text-primary font-medium">Grátis</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-2 border-t border-border/50">
          <span>Total</span>
          <span>R$ 84,50</span>
        </div>
      </div>
    </div>
  );
}
