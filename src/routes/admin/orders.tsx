import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  Filter,
  Clock,
  ChefHat,
  Truck,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersPage,
  head: () => ({
    meta: [{ title: "Pedidos — ARMAZIX" }],
  }),
});

interface Order {
  id: string;
  orderId: string;
  customer: string;
  items: string[];
  total: string;
  payment: string;
  status: string;
  time: string;
  address: string;
  type: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  received: { label: "Novo", icon: Clock, color: "text-blue-600", bgColor: "bg-blue-500/15" },
  preparing: { label: "Preparando", icon: ChefHat, color: "text-amber-600", bgColor: "bg-amber-500/15" },
  ready: { label: "Pronto", icon: CheckCircle2, color: "text-primary", bgColor: "bg-primary/15" },
  delivering: { label: "Saiu p/ entrega", icon: Truck, color: "text-purple-600", bgColor: "bg-purple-500/15" },
  delivered: { label: "Concluído", icon: CheckCircle2, color: "text-primary", bgColor: "bg-primary/15" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/15" },
};

const TABS = [
  { key: "todos", label: "Todos" },
  { key: "received", label: "Novos" },
  { key: "preparing", label: "Preparando" },
  { key: "delivering", label: "Em entrega" },
  { key: "delivered", label: "Concluídos" },
  { key: "cancelled", label: "Cancelados" },
];

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) fetchOrders(storeId);
    else setLoading(false);
  }, []);

  const fetchOrders = async (storeId: string) => {
    try {
      const res = await fetch(`/api/orders/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } catch {} finally { setLoading(false); }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      const res = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status } : o));
      }
    } catch {}
  };

  const filtered = orders.filter(o => {
    const matchSearch = o.customer.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "todos" || o.status === activeTab;
    return matchSearch && matchTab;
  });

  if (loading) {
    return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seus pedidos em tempo real</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.key ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar pedidos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5"><Filter className="w-3.5 h-3.5" /> Filtrar</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum pedido encontrado</div>
      ) : (
      <div className="space-y-3">
        {filtered.map(order => {
          const cfg = statusConfig[order.status] || statusConfig.received;
          const StatusIcon = cfg.icon;
          return (
            <Card key={order.orderId} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`grid place-items-center w-10 h-10 rounded-xl ${cfg.bgColor}`}>
                      <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{order.id}</span>
                        <Badge variant="secondary" className={`rounded-full text-[11px] ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</Badge>
                      </div>
                      <div className="text-sm font-medium mt-0.5">{order.customer}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{order.items.join(", ")}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        <span>{order.address}</span>
                        {order.payment && <><span>•</span><span>{order.payment}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold">{order.total}</div>
                    <div className="text-xs text-muted-foreground">{order.time}</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg mt-1"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="rounded-lg gap-2"><Eye className="w-3.5 h-3.5" /> Ver detalhes</DropdownMenuItem>
                        {order.status === "received" && <DropdownMenuItem className="rounded-lg gap-2" onClick={() => handleStatusChange(order.orderId, "preparing")}><ChefHat className="w-3.5 h-3.5" /> Preparar</DropdownMenuItem>}
                        {order.status === "preparing" && <DropdownMenuItem className="rounded-lg gap-2" onClick={() => handleStatusChange(order.orderId, "ready")}><CheckCircle2 className="w-3.5 h-3.5" /> Pronto</DropdownMenuItem>}
                        {order.status === "ready" && <DropdownMenuItem className="rounded-lg gap-2" onClick={() => handleStatusChange(order.orderId, "delivering")}><Truck className="w-3.5 h-3.5" /> Enviar</DropdownMenuItem>}
                        {order.status === "delivering" && <DropdownMenuItem className="rounded-lg gap-2" onClick={() => handleStatusChange(order.orderId, "delivered")}><CheckCircle2 className="w-3.5 h-3.5" /> Entregue</DropdownMenuItem>}
                        {!["delivered", "cancelled"].includes(order.status) && <DropdownMenuItem className="rounded-lg gap-2 text-destructive" onClick={() => handleStatusChange(order.orderId, "cancelled")}><XCircle className="w-3.5 h-3.5" /> Cancelar</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
