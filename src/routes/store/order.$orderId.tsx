import { createFileRoute } from "@tanstack/react-router";
import { Package, Clock, ChefHat, Truck, CheckCircle2, MapPin, Phone, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/store/order/$orderId")({
  component: OrderTrackingPage,
  head: () => ({
    meta: [{ title: "Pedido — Mercado do Zé" }],
  }),
});

interface OrderItem { productName: string; productEmoji: string | null; quantity: number; unitPrice: string; total: string; }
interface OrderData { id: string; orderId?: string; number: number; status: string; type: string; paymentMethod: string | null; subtotal: string; deliveryFee: string; discount: string; total: string; createdAt: string; items: OrderItem[]; }

const STEPS = [
  { key: "pending", label: "Pedido recebido", icon: Package },
  { key: "preparing", label: "Preparando", icon: ChefHat },
  { key: "delivering", label: "Saiu para entrega", icon: Truck },
  { key: "delivered", label: "Entregue", icon: CheckCircle2 },
];

const statusStepMap: Record<string, number> = { pending: 0, preparing: 1, delivering: 2, delivered: 3, completed: 3, cancelled: -1 };
const statusLabelMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700" },
  preparing: { label: "Preparando", color: "bg-blue-500/15 text-blue-700" },
  delivering: { label: "Em rota", color: "bg-purple-500/15 text-purple-700" },
  delivered: { label: "Entregue", color: "bg-emerald-500/15 text-emerald-700" },
  completed: { label: "Concluído", color: "bg-primary/15 text-primary" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-700" },
};

function OrderTrackingPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetch(`/api/orders/list?storeId=${storeId}`)
        .then(r => r.json())
        .then(d => {
          if (d.orders) {
            const found = d.orders.find((o: OrderData) => o.id === orderId || o.orderId === orderId);
            setOrder(found || null);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [orderId]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  if (!order) return <div className="px-4 py-20 text-center"><p className="text-lg font-bold">Pedido não encontrado</p></div>;

  const currentStep = statusStepMap[order.status] ?? 0;
  const statusInfo = statusLabelMap[order.status] || { label: order.status, color: "bg-secondary text-muted-foreground" };
  const items = order.items || [];
  const subtotal = parseFloat(order.subtotal || "0");
  const deliveryFee = parseFloat(order.deliveryFee || "0");
  const discount = parseFloat(order.discount || "0");
  const total = parseFloat(order.total || "0");

  return (
    <div className="px-4 pt-4 pb-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Pedido #{order.number}</h1>
          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("pt-BR")} · {items.length} itens</p>
        </div>
        <Badge className={`rounded-full border-0 ${statusInfo.color}`}>{statusInfo.label}</Badge>
      </div>

      {order.type === "delivery" && currentStep >= 2 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-emerald-500/10 border border-primary/20 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center"><Truck className="w-6 h-6 text-primary" /></div>
            <div>
              <p className="text-sm font-bold">Previsão de entrega</p>
              <p className="text-xl font-bold text-primary">30-50 min</p>
            </div>
          </div>
        </div>
      )}

      {currentStep >= 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-bold mb-3">Acompanhamento</h3>
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const done = i <= currentStep;
              const current = i === currentStep;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${current ? "bg-primary/15 ring-2 ring-primary" : done ? "bg-primary/10" : "bg-secondary"}`}>
                      <step.icon className={`w-4 h-4 ${done ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    {i < STEPS.length - 1 && <div className={`w-0.5 h-8 ${done && i < currentStep ? "bg-primary" : "bg-border"}`} />}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-5">
        <h3 className="text-sm font-bold mb-3">Itens do pedido</h3>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
              <span className="text-lg">{item.productEmoji || "📦"}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.quantity}x</p>
              </div>
              <span className="text-sm font-bold">R$ {parseFloat(item.total).toFixed(2).replace(".", ",")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-surface border border-border/40">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Subtotal</span>
          <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
        </div>
        {deliveryFee > 0 ? (
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Entrega</span>
            <span>R$ {deliveryFee.toFixed(2).replace(".", ",")}</span>
          </div>
        ) : (
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Entrega</span>
            <span className="text-primary font-medium">Grátis</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm mb-1 text-amber-600">
            <span>Desconto</span>
            <span>−R$ {discount.toFixed(2).replace(".", ",")}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold pt-2 border-t border-border/50">
          <span>Total</span>
          <span>R$ {total.toFixed(2).replace(".", ",")}</span>
        </div>
      </div>
    </div>
  );
}
