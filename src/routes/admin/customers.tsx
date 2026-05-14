import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import { Search, Plus, MoreHorizontal, Mail, Phone, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
  head: () => ({
    meta: [{ title: "Clientes — ARMAZIX" }],
  }),
});

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: string;
  since: string;
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) fetchCustomers(storeId);
    else setLoading(false);
  }, []);

  const fetchCustomers = async (storeId: string) => {
    try {
      const res = await fetch(`/api/customers/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setCustomers(data.customers || []);
    } catch {} finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newName) return;
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setCreating(true);
    try {
      const res = await api.post("/api/customers/create", { storeId, name: newName, email: newEmail || undefined, phone: newPhone || undefined });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(prev => [...prev, { ...data.customer, ordersCount: 0, totalSpent: "R$ 0,00", since: new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) }]);
        setNewName(""); setNewEmail(""); setNewPhone("");
        setDialogOpen(false);
      }
    } catch {} finally { setCreating(false); }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{customers.length} clientes cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              <Plus className="w-4 h-4" /> Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Novo cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Ex: Maria Silva" value={newName} onChange={e => setNewName(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input placeholder="email@exemplo.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <Button onClick={handleCreate} disabled={creating || !newName} className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum cliente cadastrado</div>
      ) : (
      <div className="space-y-2">
        {filtered.map(customer => (
          <Card key={customer.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
                      {customer.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold">{customer.name}</div>
                    {customer.email && <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5"><span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span></div>}
                    {customer.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{customer.phone}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold">{customer.totalSpent}</div>
                    <div className="text-xs text-muted-foreground">{customer.ordersCount} pedidos</div>
                  </div>
                  <Badge variant="secondary" className="rounded-full text-[11px]">Desde {customer.since}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg"><MoreHorizontal className="w-4 h-4" /></Button>
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
        ))}
      </div>
      )}
    </div>
  );
}
