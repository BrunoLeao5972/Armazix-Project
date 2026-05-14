import { useState, useEffect } from "react";
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

interface StoreProduct { id: string; name: string; price: string; emoji: string | null; active: boolean | null; }

function SearchPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const { addToCart } = useStore();

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetch(`/api/products/list?storeId=${storeId}`).then(r => r.json()).then(d => { if (d.products) setProducts(d.products); }).catch(() => {});
    }
  }, []);

  const activeProducts = products.filter(p => p.active !== false);
  const results = query.length >= 2 ? activeProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="px-4 pt-4 sticky top-14 z-10 bg-background pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produtos, marcas..." value={query} onChange={e => setQuery(e.target.value)} className="pl-9 h-11 rounded-2xl bg-surface border-border/50 text-sm" autoFocus />
          {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
        </div>
      </div>

      {results.length > 0 && (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} resultado{results.length !== 1 ? "s" : ""}</p>
          {results.map(product => (
            <Link key={product.id} to="/store/product/$productId" params={{ productId: product.id }} className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border/40 hover:shadow-soft transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-secondary/30 flex items-center justify-center text-2xl shrink-0">{product.emoji || "📦"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{product.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">R$ {parseFloat(product.price).toFixed(2).replace(".", ",")}</p>
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); addToCart({ id: Number(product.id), name: product.name, price: parseFloat(product.price), image: product.emoji || "📦" }); }} className="mt-1 w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs hover:scale-110 transition-transform">+</button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {results.length === 0 && (
        <div className="px-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Produtos populares</h3>
            {activeProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
            ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {activeProducts.slice(0, 6).map(product => (
                <Link key={product.id} to="/store/product/$productId" params={{ productId: product.id }} className="bg-surface rounded-2xl border border-border/40 overflow-hidden">
                  <div className="h-20 bg-secondary/30 flex items-center justify-center"><span className="text-2xl">{product.emoji || "📦"}</span></div>
                  <div className="p-2">
                    <p className="text-[11px] font-medium truncate">{product.name}</p>
                    <p className="text-xs font-bold mt-0.5">R$ {parseFloat(product.price).toFixed(2).replace(".", ",")}</p>
                  </div>
                </Link>
              ))}
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
