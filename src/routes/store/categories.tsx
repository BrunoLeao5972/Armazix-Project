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

const CATEGORIES: { id: number; name: string; emoji: string; color: string; count: number }[] = [];
const PRODUCTS: { id: number; name: string; price: number; image: string; rating: number; reviews: number; category: string }[] = [];

function CategoriesPage() {
  const { addToCart, favorites, toggleFavorite } = useStore();

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Categorias</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Explore todos os produtos</p>
      </div>

      {CATEGORIES.length === 0 && PRODUCTS.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma categoria ou produto cadastrado ainda.</p>
        </div>
      ) : (
        <>
          {/* Category Grid */}
          {CATEGORIES.length > 0 && (
          <div className="px-4 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                to="/store/categories"
                className="bg-surface rounded-2xl border border-border/40 p-4 flex flex-col items-center gap-2 hover:shadow-soft transition-shadow group"
              >
                <div className={`w-14 h-14 rounded-2xl ${cat.color} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                  {cat.emoji}
                </div>
                <span className="text-sm font-semibold">{cat.name}</span>
                <span className="text-[11px] text-muted-foreground">{cat.count} produtos</span>
              </Link>
            ))}
          </div>
          )}

          {/* Products by Category */}
          {CATEGORIES.slice(0, 4).map((cat) => {
            const catProducts = PRODUCTS.filter((p) => p.category === cat.name);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat.id} className="mb-6">
                <div className="px-4 flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.emoji}</span>
                    <h2 className="text-base font-bold">{cat.name}</h2>
                  </div>
                  <button className="text-xs font-semibold text-primary">Ver todos</button>
                </div>
                <div className="px-4 flex gap-3 overflow-x-auto no-scrollbar">
                  {catProducts.map((product) => (
                    <Link key={product.id} to="/store/product/$productId" params={{ productId: String(product.id) }} className="block shrink-0 w-[150px] group">
                      <div className="bg-surface rounded-2xl border border-border/40 overflow-hidden">
                        <div className="h-24 bg-secondary/30 flex items-center justify-center">
                          <span className="text-3xl">{product.image}</span>
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold truncate">{product.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            <span className="text-[10px]">{product.rating}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-sm font-bold">R$ {product.price.toFixed(2).replace(".", ",")}</span>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart({ id: product.id, name: product.name, price: product.price, image: product.image }); }}
                              className="w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm hover:scale-110 transition-transform"
                            >
                              +
                            </button>
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
