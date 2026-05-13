import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Clock, TrendingUp, X, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStore } from "../store";

export const Route = createFileRoute("/store/search")({
  component: SearchPage,
  head: () => ({
    meta: [{ title: "Buscar — Mercado do Zé" }],
  }),
});

const SUGGESTIONS = ["Arroz", "Feijão", "Café", "Leite", "Açaí", "Pão"];
const RECENT = ["Hambúrguer artesanal", "Café Pilão", "Arroz 5kg"];

const ALL_PRODUCTS = [
  { id: 1, name: "Arroz Tio João 5kg", price: 32.90, image: "🍚", rating: 4.8, category: "Mercado" },
  { id: 2, name: "Feijão Carioca 1kg", price: 8.90, image: "🫘", rating: 4.6, category: "Mercado" },
  { id: 3, name: "Café Pilão 500g", price: 18.90, image: "☕", rating: 4.9, category: "Mercado" },
  { id: 4, name: "Leite Integral 1L", price: 6.49, image: "🥛", rating: 4.5, category: "Bebidas" },
  { id: 5, name: "Pão Francês Kg", price: 12.90, image: "🥖", rating: 4.7, category: "Padaria" },
  { id: 6, name: "Hambúrguer Artesanal", price: 28.90, image: "🍔", rating: 4.9, category: "Lanches" },
  { id: 7, name: "Açaí 500ml", price: 22.90, image: "🫐", rating: 4.8, category: "Bebidas" },
  { id: 8, name: "Bife de Alcatra Kg", price: 59.90, image: "🥩", rating: 4.7, category: "Açougue" },
];

function SearchPage() {
  const [query, setQuery] = useState("");
  const { addToCart } = useStore();

  const results = query.length >= 2
    ? ALL_PRODUCTS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="animate-in fade-in duration-300">
      {/* Search Input */}
      <div className="px-4 pt-4 sticky top-14 z-10 bg-background pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos, marcas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-11 rounded-2xl bg-surface border-border/50 text-sm"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} resultado{results.length !== 1 ? "s" : ""}</p>
          {results.map((product) => (
            <Link key={product.id} to="/store/product/$productId" params={{ productId: String(product.id) }} className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border/40 hover:shadow-soft transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-secondary/30 flex items-center justify-center text-2xl shrink-0">
                {product.image}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{product.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-[11px]">{product.rating}</span>
                  <span className="text-[10px] text-muted-foreground">{product.category}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart({ id: product.id, name: product.name, price: product.price, image: product.image }); }}
                  className="mt-1 w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs hover:scale-110 transition-transform"
                >
                  +
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty State / Suggestions */}
      {results.length === 0 && (
        <div className="px-4 space-y-6">
          {/* Recent */}
          {RECENT.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Buscas recentes</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {RECENT.map((r) => (
                  <button key={r} onClick={() => setQuery(r)} className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Mais buscados</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setQuery(s)} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* All Products Grid */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Produtos populares</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ALL_PRODUCTS.slice(0, 6).map((product) => (
                <Link key={product.id} to="/store/product/$productId" params={{ productId: String(product.id) }} className="bg-surface rounded-2xl border border-border/40 overflow-hidden">
                  <div className="h-20 bg-secondary/30 flex items-center justify-center">
                    <span className="text-2xl">{product.image}</span>
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-medium truncate">{product.name}</p>
                    <p className="text-xs font-bold mt-0.5">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
