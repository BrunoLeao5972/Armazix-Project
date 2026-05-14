import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
  head: () => ({
    meta: [{ title: "Produtos — ARMAZIX" }],
  }),
});

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  stock: number | null;
  lowStockThreshold: number | null;
  emoji: string | null;
  imageUrl: string | null;
  active: boolean | null;
  categoryId: string | null;
}

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-primary/15 text-primary" },
  low: { label: "Estoque baixo", color: "bg-amber-500/15 text-amber-600" },
  out: { label: "Sem estoque", color: "bg-destructive/15 text-destructive" },
};

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) fetchProducts(storeId);
    else setLoading(false);
  }, []);

  const fetchProducts = async (storeId: string) => {
    try {
      const res = await fetch(`/api/products/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
    } catch {} finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newName || !newPrice) return;
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setCreating(true);
    try {
      const res = await api.post("/api/products/create", { storeId, name: newName, price: newPrice, stock: Number(newStock) || 0, emoji: newEmoji || undefined });
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(prev => [...prev, data.product]);
        setNewName(""); setNewPrice(""); setNewStock(""); setNewEmoji("");
        setDialogOpen(false);
      }
    } catch {} finally { setCreating(false); }
  };

  const handleDelete = async (productId: string) => {
    try {
      const res = await api.post("/api/products/delete", { productId });
      if (res.ok) setProducts(prev => prev.filter(p => p.id !== productId));
    } catch {}
  };

  const getProductStatus = (p: Product) => {
    const stock = p.stock ?? 0;
    const threshold = p.lowStockThreshold ?? 5;
    if (stock <= 0) return "out";
    if (stock <= threshold) return "low";
    return "active";
  };

  const formatPrice = (price: string) => `R$ ${parseFloat(price).toFixed(2).replace(".", ",")}`;

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">{products.length} produtos cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform gap-2">
              <Plus className="w-4 h-4" />
              Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Novo produto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome do produto</Label>
                <Input placeholder="Ex: Arroz 5kg" value={newName} onChange={e => setNewName(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Preço</Label>
                  <Input placeholder="R$ 0,00" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Estoque</Label>
                  <Input placeholder="0" type="number" value={newStock} onChange={e => setNewStock(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Emoji (opcional)</Label>
                <Input placeholder="🍚" value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <Button onClick={handleCreate} disabled={creating || !newName || !newPrice} className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar produto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produtos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Filtrar
        </Button>
        <div className="flex border rounded-xl overflow-hidden">
          <button onClick={() => setView("grid")} className={`px-3 py-2 text-xs font-medium transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>Grid</button>
          <button onClick={() => setView("list")} className={`px-3 py-2 text-xs font-medium transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>Lista</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum produto cadastrado</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(product => {
            const status = getProductStatus(product);
            return (
              <Card key={product.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow group overflow-hidden">
                <div className="h-28 bg-secondary/30 flex items-center justify-center text-4xl">
                  {product.emoji || "📦"}
                </div>
                <CardContent className="p-3">
                  <h3 className="text-sm font-semibold truncate">{product.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold">{formatPrice(product.price)}</span>
                    <Badge variant="secondary" className={`rounded-full text-[10px] ${statusMap[status]?.color}`}>
                      {product.stock ?? 0} un
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {filtered.map(product => {
                const status = getProductStatus(product);
                return (
                  <div key={product.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{product.emoji || "📦"}</span>
                      <div>
                        <div className="text-sm font-semibold">{product.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold">{formatPrice(product.price)}</span>
                      <Badge variant="secondary" className={`rounded-full text-[11px] ${statusMap[status]?.color}`}>
                        {statusMap[status]?.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem className="rounded-lg gap-2"><Eye className="w-3.5 h-3.5" /> Ver detalhes</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg gap-2"><Edit className="w-3.5 h-3.5" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg gap-2 text-destructive" onClick={() => handleDelete(product.id)}><Trash2 className="w-3.5 h-3.5" /> Remover</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
