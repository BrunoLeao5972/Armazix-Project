import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStore } from "../store";
import { type StoreProduct, formatPrice } from "@/lib/store-context";
import { ProductCard } from "./index";

export const Route = createFileRoute("/store/search")({
  component: SearchPage,
});

function SearchPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const { store, addToCart, favorites, toggleFavorite } = useStore();

  useEffect(() => {
    if (!store?.id) return;
    fetch(`/api/products/list?storeId=${store.id}&scope=public`)
      .then(r => r.json())
      .then(d => { if (d.products) setProducts(d.products); })
      .catch(() => {});
  }, [store?.id]);

  const activeProducts = products;
  const results = query.length >= 2
    ? activeProducts.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleAdd = useCallback((product: StoreProduct) => {
    addToCart({ id: product.id, name: product.name, price: parseFloat(product.price), image: product.imageUrl || null, emoji: product.emoji || "📦" });
  }, [addToCart]);

  return (
    <div className="animate-in fade-in duration-300">
      {/* Search Input */}
      <div className="px-4 pt-4 sticky top-14 z-10 bg-background pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={query}
            onChange={e => setQuery(e.target.value)}
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
      {query.length >= 2 ? (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">
            {results.length} resultado{results.length !== 1 ? "s" : ""} para "{query}"
          </p>
          {results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {results.map(product => (
                <ProductCard key={product.id} product={product} onAdd={handleAdd}
                  isFavorite={favorites.includes(product.id)} onToggleFavorite={toggleFavorite}
                  showPrice highlightLowStock primaryColor="" />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Search className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold">Nenhum resultado</p>
              <p className="text-xs text-muted-foreground mt-1">Tente outros termos</p>
            </div>
          )}
        </div>
      ) : (
        /* Popular products when no query */
        <div className="px-4 pb-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Produtos populares</h3>
          {activeProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {activeProducts.slice(0, 8).map(product => (
                <ProductCard key={product.id} product={product} onAdd={handleAdd}
                  isFavorite={favorites.includes(product.id)} onToggleFavorite={toggleFavorite}
                  showPrice highlightLowStock primaryColor="" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
          )}
        </div>
      )}
    </div>
  );
}
