import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Package, Heart, MapPin, Tag, ChevronRight, Clock, Star, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useStore } from "../store";

export const Route = createFileRoute("/store/account")({
  component: AccountPage,
  head: () => ({
    meta: [{ title: "Minha conta — Mercado do Zé" }],
  }),
});

interface OrderData { id: string; number: number; status: string; total: string; createdAt: string; items: { productName: string }[]; }

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700" },
  preparing: { label: "Preparando", color: "bg-blue-500/15 text-blue-700" },
  delivering: { label: "Em rota", color: "bg-purple-500/15 text-purple-700" },
  delivered: { label: "Entregue", color: "bg-emerald-500/15 text-emerald-700" },
  completed: { label: "Concluído", color: "bg-primary/15 text-primary" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-700" },
};

function AccountPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const { favorites } = useStore();

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetch(`/api/orders/list?storeId=${storeId}`)
        .then(r => r.json())
        .then(d => { if (d.orders) setOrders(d.orders); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else { setLoading(false); }
  }, []);

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="px-4 pt-4 pb-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="p-3 rounded-2xl bg-surface border border-border/40 text-center">
          <p className="text-lg font-bold">{orders.length}</p>
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

      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Pedidos recentes</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido ainda</p>
        ) : (
        <div className="space-y-2">
          {recentOrders.map(order => (
            <Link key={order.id} to="/store/order/$orderId" params={{ orderId: order.id }} className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border/40 hover:shadow-soft transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">#{order.number}</p>
                  <Badge className={`rounded-full text-[10px] border-0 ${statusConfig[order.status]?.color || "bg-secondary text-muted-foreground"}`}>{statusConfig[order.status]?.label || order.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("pt-BR")} · {order.items?.length || 0} itens</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">R$ {parseFloat(order.total || "0").toFixed(2).replace(".", ",")}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </div>
            </Link>
          ))}
        </div>
        )}
      </div>

      <div className="space-y-1">
        {[
          { icon: Heart, label: "Favoritos", desc: `${favorites.length} produtos salvos` },
          { icon: MapPin, label: "Endereços", desc: "Gerenciar endereços" },
          { icon: Tag, label: "Cupons", desc: "Cupons disponíveis" },
          { icon: Clock, label: "Histórico", desc: "Todos os pedidos" },
          { icon: User, label: "Dados pessoais", desc: "Nome, e-mail, telefone" },
        ].map(item => (
          <button key={item.label} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
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
