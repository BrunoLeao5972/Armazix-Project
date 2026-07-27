import { Link } from "@tanstack/react-router";
import { Package, Loader2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CustomerOrder } from "@/lib/customer-profile-hooks";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pendente",   cls: "bg-amber-100 text-amber-700" },
  received:   { label: "Recebido",   cls: "bg-amber-100 text-amber-700" },
  preparing:  { label: "Preparando", cls: "bg-blue-100 text-blue-700" },
  ready:      { label: "Pronto",     cls: "bg-blue-100 text-blue-700" },
  delivering: { label: "Em rota",    cls: "bg-purple-100 text-purple-700" },
  delivered:  { label: "Entregue",   cls: "bg-emerald-100 text-emerald-700" },
  completed:  { label: "Concluído",  cls: "bg-primary/15 text-primary" },
  cancelled:  { label: "Cancelado",  cls: "bg-red-100 text-red-700" },
};

export function OrdersHistoryView({
  orders, loading, onNavigate,
}: {
  orders: CustomerOrder[];
  loading: boolean;
  onNavigate?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
        <Package className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Nenhum pedido ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1">
      {orders.map(order => (
        <Link key={order.id}
          to="/store/order/$orderId"
          params={{ orderId: order.id }}
          onClick={onNavigate}
          className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border hover:border-primary/30 hover:shadow-sm transition-all">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold">#{order.number}</p>
              <Badge className={`rounded-full text-[10px] border-0 px-2 py-0.5 ${STATUS_MAP[order.status]?.cls || "bg-secondary text-muted-foreground"}`}>
                {STATUS_MAP[order.status]?.label || order.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString("pt-BR")} · {order.items?.length || 0} {order.items?.length === 1 ? "item" : "itens"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold">
              R$ {parseFloat(order.total || "0").toFixed(2).replace(".", ",")}
            </p>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 ml-auto mt-0.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
