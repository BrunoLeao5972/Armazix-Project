import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, MoreHorizontal, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
  head: () => ({
    meta: [{ title: "Clientes — ARMAZIX" }],
  }),
});

const CUSTOMERS = [
  { id: 1, name: "Maria Silva", email: "maria@email.com", phone: "(11) 99999-1234", orders: 12, total: "R$ 1.890", since: "Jan 2025" },
  { id: 2, name: "João Santos", email: "joao@email.com", phone: "(11) 98888-5678", orders: 8, total: "R$ 1.240", since: "Fev 2025" },
  { id: 3, name: "Ana Costa", email: "ana@email.com", phone: "(11) 97777-9012", orders: 5, total: "R$ 680", since: "Mar 2025" },
  { id: 4, name: "Pedro Lima", email: "pedro@email.com", phone: "(11) 96666-3456", orders: 15, total: "R$ 2.450", since: "Dez 2024" },
  { id: 5, name: "Lucia Ferreira", email: "lucia@email.com", phone: "(11) 95555-7890", orders: 3, total: "R$ 320", since: "Abr 2025" },
  { id: 6, name: "Carlos Mendes", email: "carlos@email.com", phone: "(11) 94444-1234", orders: 7, total: "R$ 980", since: "Mar 2025" },
];

function CustomersPage() {
  const [search, setSearch] = useState("");

  const filtered = CUSTOMERS.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="space-y-6 animate-in fade-in duration-300"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{CUSTOMERS.length} clientes cadastrados</p>
        </div>
        <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
          <Plus className="w-4 h-4" />
          Novo cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((customer, i) => (
          <div
            key={customer.id}
          >
            <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
                        {customer.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold">{customer.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />{customer.phone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-bold">{customer.total}</div>
                      <div className="text-xs text-muted-foreground">{customer.orders} pedidos</div>
                    </div>
                    <Badge variant="secondary" className="rounded-full text-[11px]">
                      Desde {customer.since}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="rounded-lg">Ver perfil</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg">Editar</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg text-destructive">Remover</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
