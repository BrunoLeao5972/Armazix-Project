import { useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const ORDERS = [
  {
    id: "#3208",
    customer: "Maria Silva",
    items: ["Arroz 5kg", "Feijão 1kg", "Óleo 900ml"],
    total: "R$ 41,60",
    payment: "PIX",
    status: "novo",
    time: "2 min atrás",
    address: "Rua das Flores, 123",
  },
  {
    id: "#3207",
    customer: "João Santos",
    items: ["Café 500g", "Açúcar 1kg", "Leite 1L"],
    total: "R$ 30,60",
    payment: "Cartão",
    status: "preparando",
    time: "15 min atrás",
    address: "Av. Brasil, 456",
  },
  {
    id: "#3206",
    customer: "Ana Costa",
    items: ["Macarrão 500g", "Molho de tomate"],
    total: "R$ 12,30",
    payment: "PIX",
    status: "saiu_entrega",
    time: "32 min atrás",
    address: "Rua São Paulo, 789",
  },
  {
    id: "#3205",
    customer: "Pedro Lima",
    items: ["Cesta básica completa"],
    total: "R$ 189,90",
    payment: "Dinheiro",
    status: "concluido",
    time: "1h atrás",
    address: "Rua Amazonas, 321",
  },
  {
    id: "#3204",
    customer: "Lucia Ferreira",
    items: ["Refrigerante 2L", "Biscoito 200g"],
    total: "R$ 12,40",
    payment: "PIX",
    status: "concluido",
    time: "2h atrás",
    address: "Rua Pará, 654",
  },
  {
    id: "#3203",
    customer: "Carlos Mendes",
    items: ["Sabão em pó 1kg"],
    total: "R$ 12,90",
    payment: "Cartão",
    status: "cancelado",
    time: "3h atrás",
    address: "Rua Bahia, 987",
  },
];

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  novo: { label: "Novo", icon: Clock, color: "text-blue-600", bgColor: "bg-blue-500/15" },
  preparando: { label: "Preparando", icon: ChefHat, color: "text-amber-600", bgColor: "bg-amber-500/15" },
  saiu_entrega: { label: "Saiu p/ entrega", icon: Truck, color: "text-purple-600", bgColor: "bg-purple-500/15" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-primary", bgColor: "bg-primary/15" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/15" },
};

const TABS = [
  { key: "todos", label: "Todos" },
  { key: "novo", label: "Novos" },
  { key: "preparando", label: "Preparando" },
  { key: "saiu_entrega", label: "Em entrega" },
  { key: "concluido", label: "Concluídos" },
  { key: "cancelado", label: "Cancelados" },
];

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("todos");

  const filtered = ORDERS.filter((o) => {
    const matchSearch =
      o.customer.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "todos" || o.status === activeTab;
    return matchSearch && matchTab;
  });

  return (
    <div
      className="space-y-6 animate-in fade-in duration-300"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe seus pedidos em tempo real
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedidos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          Filtrar
        </Button>
      </div>

      {/* Orders */}
      <div className="space-y-3">
        {filtered.map((order, i) => {
          const cfg = statusConfig[order.status];
          const StatusIcon = cfg.icon;
          return (
            <div
              key={order.id}
            >
              <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`grid place-items-center w-10 h-10 rounded-xl ${cfg.bgColor}`}>
                        <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{order.id}</span>
                          <Badge
                            variant="secondary"
                            className={`rounded-full text-[11px] ${cfg.bgColor} ${cfg.color}`}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium mt-0.5">{order.customer}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {order.items.join(", ")}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                          <span>{order.address}</span>
                          <span>•</span>
                          <span>{order.payment}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold">{order.total}</div>
                      <div className="text-xs text-muted-foreground">{order.time}</div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg mt-1">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem className="rounded-lg gap-2">
                            <Eye className="w-3.5 h-3.5" /> Ver detalhes
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
