import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import { Tags, Plus, MoreHorizontal, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [{ title: "Categorias — ARMAZIX" }],
  }),
});

interface Category {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  productsCount: number;
}

function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) fetchCategories(storeId);
    else setLoading(false);
  }, []);

  const fetchCategories = async (storeId: string) => {
    try {
      const res = await fetch(`/api/categories/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch {} finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newName) return;
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setCreating(true);
    try {
      const res = await api.post("/api/categories/create", { storeId, name: newName, emoji: newEmoji || undefined, color: newColor });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(prev => [...prev, { ...data.category, productsCount: 0 }]);
        setNewName(""); setNewEmoji(""); setNewColor("#3b82f6");
        setDialogOpen(false);
      }
    } catch {} finally { setCreating(false); }
  };

  const handleDelete = async (categoryId: string) => {
    try {
      const res = await api.post("/api/categories/delete", { categoryId });
      if (res.ok) setCategories(prev => prev.filter(c => c.id !== categoryId));
    } catch {}
  };

  if (loading) {
    return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground mt-1">{categories.length} categorias</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              <Plus className="w-4 h-4" /> Nova categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Nova categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Ex: Grãos" value={newName} onChange={e => setNewName(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Emoji</Label>
                  <Input placeholder="🌾" value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating || !newName} className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar categoria"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma categoria cadastrada</div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {categories.map(cat => (
          <Card key={cat.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl text-white text-sm font-bold" style={{ backgroundColor: cat.color || "#3b82f6" }}>
                    {cat.emoji || <Tags className="w-5 h-5" />}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{cat.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.productsCount} produtos</div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem className="rounded-lg">Editar</DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg text-destructive" onClick={() => handleDelete(cat.id)}>Remover</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
}
