import { createFileRoute } from "@tanstack/react-router";
import { Tags, Plus, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [{ title: "Categorias — ARMAZIX" }],
  }),
});

const CATEGORIES: { id: number; name: string; products: number; color: string }[] = [];

function CategoriesPage() {
  return (
    <div
      className="space-y-6 animate-in fade-in duration-300"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground mt-1">{CATEGORIES.length} categorias</p>
        </div>
        <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
          <Plus className="w-4 h-4" />
          Nova categoria
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATEGORIES.map((cat, i) => (
          <div
            key={cat.id}
          >
            <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid place-items-center w-10 h-10 rounded-xl text-white text-sm font-bold"
                      style={{ backgroundColor: cat.color }}
                    >
                      <Tags className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">{cat.products} produtos</div>
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
                      <DropdownMenuItem className="rounded-lg text-destructive">Remover</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
