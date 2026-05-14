import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "../store";

export const Route = createFileRoute("/store/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [{ title: "Categorias — Mercado do Zé" }],
  }),
});

interface StoreCategory { id: string; name: string; emoji: string | null; color: string | null; productsCount: number; }
interface StoreProduct { id: string; name: string; price: string; emoji: string | null; categoryId: string | null; active: boolean | null; }

function CategoriesPage() {
  const { addToCart, favorites, toggleFavorite } = useStore();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetch(`/api/categories/list?storeId=${storeId}`).then(r => r.json()).then(d => { if (d.categories) setCategories(d.categories); }).catch(() => {});
      fetch(`/api/products/list?storeId=${storeId}`).then(r => r.json()).then(d => { if (d.products) setProducts(d.products); }).catch(() => {});
    }
  }, []);

  const activeProducts = products.filter(p => p.active !== false);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Categorias</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Explore todos os produtos</p>
      </div>

      {categories.length === 0 && activeProducts.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma categoria ou produto cadastrado ainda.</p>
        </div>
      ) : (
        <>
          {categories.length > 0 && (
          <div className="px-4 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {categories.map(cat => (
              <Link key={cat.id} to="/store/categories" className="bg-surface rounded-2xl border border-border/40 p-4 flex flex-col items-center gap-2 hover:shadow-soft transition-shadow group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform" style={{ backgroundColor: cat.color || "#3b82f620" }}>
                  {cat.emoji || "📁"}
                </div>
                <span className="text-sm font-semibold">{cat.name}</span>
                <span className="text-[11px] text-muted-foreground">{cat.productsCount} produtos</span>
              </Link>
            ))}
          </div>
          )}

          {categories.slice(0, 4).map(cat => {
            const catProducts = activeProducts.filter(p => p.categoryId === cat.id);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat.id} className="mb-6">
                <div className="px-4 flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.emoji || "📁"}</span>
                    <h2 className="text-base font-bold">{cat.name}</h2>
                  </div>
                  <button className="text-xs font-semibold text-primary">Ver todos</button>
                </div>
                <div className="px-4 flex gap-3 overflow-x-auto no-scrollbar">
                  {catProducts.map(product => (
                    <Link key={product.id} to="/store/product/$productId" params={{ productId: product.id }} className="block shrink-0 w-[150px] group">
                      <div className="bg-surface rounded-2xl border border-border/40 overflow-hidden">
                        <div className="h-24 bg-secondary/30 flex items-center justify-center">
                          <span className="text-3xl">{product.emoji || "📦"}</span>
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold truncate">{product.name}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-sm font-bold">R$ {parseFloat(product.price).toFixed(2).replace(".", ",")}</span>
                            <button onClick={e => { e.preventDefault(); e.stopPropagation(); addToCart({ id: Number(product.id), name: product.name, price: parseFloat(product.price), image: product.emoji || "📦" }); }} className="w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm hover:scale-110 transition-transform">+</button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
