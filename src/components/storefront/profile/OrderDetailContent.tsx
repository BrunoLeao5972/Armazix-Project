import { Package, Clock, ChefHat, Truck, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CustomerOrderDetail } from "@/lib/customer-profile-hooks";

const STEP_ICONS = [Package, ChefHat, Truck, CheckCircle2];

function stepsFor(type: string) {
  return type === "pickup"
    ? [
        { key: "received", label: "Pedido recebido" },
        { key: "preparing", label: "Preparando" },
        { key: "ready", label: "Pronto para retirada" },
        { key: "delivered", label: "Retirado" },
      ]
    : [
        { key: "received", label: "Pedido recebido" },
        { key: "preparing", label: "Preparando" },
        { key: "delivering", label: "Saiu para entrega" },
        { key: "delivered", label: "Entregue" },
      ];
}

// Mapeia os 7 status reais do pedido (pending, received, preparing, ready,
// delivering, delivered, cancelled) para o índice do passo de 4 etapas exibido.
function stepIndexFor(status: string, type: string): number {
  if (status === "cancelled") return -1;
  if (status === "pending" || status === "received") return 0;
  if (status === "preparing") return 1;
  if (status === "ready") return type === "pickup" ? 2 : 1;
  if (status === "delivering") return 2;
  if (status === "delivered") return 3;
  return 0;
}

const statusLabelMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700" },
  received: { label: "Recebido", color: "bg-amber-500/15 text-amber-700" },
  preparing: { label: "Preparando", color: "bg-blue-500/15 text-blue-700" },
  ready: { label: "Pronto", color: "bg-blue-500/15 text-blue-700" },
  delivering: { label: "Em rota", color: "bg-purple-500/15 text-purple-700" },
  delivered: { label: "Entregue", color: "bg-emerald-500/15 text-emerald-700" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-700" },
};

export function OrderDetailContent({ order }: { order: CustomerOrderDetail }) {
  const STEPS = stepsFor(order.type);
  const currentStep = stepIndexFor(order.status, order.type);
  const statusInfo = statusLabelMap[order.status] || { label: order.status, color: "bg-secondary text-muted-foreground" };
  const items = order.items || [];
  const subtotal = parseFloat(order.subtotal || "0");
  const deliveryFee = parseFloat(order.deliveryFee || "0");
  const discount = parseFloat(order.discount || "0");
  const total = parseFloat(order.total || "0");

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Pedido #{order.number}</h1>
          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("pt-BR")} · {items.length} {items.length === 1 ? "item" : "itens"}</p>
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
              const Icon = STEP_ICONS[i] ?? Clock;
              const done = i <= currentStep;
              const current = i === currentStep;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${current ? "bg-primary/15 ring-2 ring-primary" : done ? "bg-primary/10" : "bg-secondary"}`}>
                      <Icon className={`w-4 h-4 ${done ? "text-primary" : "text-muted-foreground"}`} />
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
              <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                {item.productImage
                  ? <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                  : <span className="text-lg">{item.productEmoji || "📦"}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.quantity}x</p>
              </div>
              <span className="text-sm font-bold shrink-0">R$ {parseFloat(item.total).toFixed(2).replace(".", ",")}</span>
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
