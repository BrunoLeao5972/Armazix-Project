import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Package, Heart, MapPin, Tag, ChevronRight, Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/store/account")({
  component: AccountPage,
  head: () => ({
    meta: [{ title: "Minha conta — Mercado do Zé" }],
  }),
});

const ORDERS: { id: string; status: string; total: string; date: string; items: number }[] = [];

const statusConfig: Record<string, { label: string; color: string }> = {
  preparando: { label: "Preparando", color: "bg-amber-500/15 text-amber-700" },
  em_rota: { label: "Em rota", color: "bg-purple-500/15 text-purple-700" },
  concluido: { label: "Concluído", color: "bg-primary/15 text-primary" },
};

function AccountPage() {
  return (
    <div className="px-4 pt-4 pb-4 animate-in fade-in duration-300">
      {/* Profile Card */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-border/40 mb-5">
        <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-glow">
          CM
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold">Carlos Mendes</h2>
          <p className="text-xs text-muted-foreground">carlos@email.com</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl text-xs">Editar</Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="p-3 rounded-2xl bg-surface border border-border/40 text-center">
          <p className="text-lg font-bold">12</p>
          <p className="text-[10px] text-muted-foreground">Pedidos</p>
        </div>
        <div className="p-3 rounded-2xl bg-surface border border-border/40 text-center">
          <p className="text-lg font-bold">5</p>
          <p className="text-[10px] text-muted-foreground">Favoritos</p>
        </div>
        <div className="p-3 rounded-2xl bg-surface border border-border/40 text-center">
          <p className="text-lg font-bold">3</p>
          <p className="text-[10px] text-muted-foreground">Cupons</p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Pedidos recentes</h3>
          <button className="text-xs font-semibold text-primary">Ver todos</button>
        </div>
        <div className="space-y-2">
          {ORDERS.map((order) => (
            <Link
              key={order.id}
              to="/store/order/$orderId"
              params={{ orderId: order.id }}
              className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border/40 hover:shadow-soft transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">#{order.id}</p>
                  <Badge className={`rounded-full text-[10px] border-0 ${statusConfig[order.status]?.color}`}>
                    {statusConfig[order.status]?.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{order.date} · {order.items} itens</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{order.total}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-1">
        {[
          { icon: Heart, label: "Favoritos", desc: "5 produtos salvos" },
          { icon: MapPin, label: "Endereços", desc: "2 endereços cadastrados" },
          { icon: Tag, label: "Cupons", desc: "3 cupons disponíveis" },
          { icon: Clock, label: "Histórico", desc: "Todos os pedidos" },
          { icon: User, label: "Dados pessoais", desc: "Nome, e-mail, telefone" },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
          >
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
