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

const CATEGORIES = [
  { id: 1, name: "Lanches", emoji: "🍔", color: "bg-amber-500/15", count: 24 },
  { id: 2, name: "Bebidas", emoji: "🥤", color: "bg-blue-500/15", count: 18 },
  { id: 3, name: "Mercado", emoji: "🛒", color: "bg-primary/15", count: 56 },
  { id: 4, name: "Açougue", emoji: "🥩", color: "bg-red-500/15", count: 12 },
  { id: 5, name: "Padaria", emoji: "🍞", color: "bg-amber-400/15", count: 15 },
  { id: 6, name: "Hortifruti", emoji: "🥬", color: "bg-green-500/15", count: 32 },
  { id: 7, name: "Cosméticos", emoji: "💄", color: "bg-pink-500/15", count: 20 },
  { id: 8, name: "Eletrônicos", emoji: "📱", color: "bg-violet-500/15", count: 8 },
];

const PRODUCTS = [
  { id: 1, name: "Arroz Tio João 5kg", price: 32.90, image: "🍚", rating: 4.8, reviews: 234, category: "Mercado" },
  { id: 2, name: "Feijão Carioca 1kg", price: 8.90, image: "🫘", rating: 4.6, reviews: 128, category: "Mercado" },
  { id: 3, name: "Café Pilão 500g", price: 18.90, image: "☕", rating: 4.9, reviews: 412, category: "Mercado" },
  { id: 4, name: "Hambúrguer Artesanal", price: 28.90, image: "🍔", rating: 4.9, reviews: 320, category: "Lanches" },
  { id: 5, name: "Pão Francês Kg", price: 12.90, image: "🥖", rating: 4.7, reviews: 156, category: "Padaria" },
  { id: 6, name: "Açaí 500ml", price: 22.90, image: "🫐", rating: 4.8, reviews: 198, category: "Bebidas" },
];

function CategoriesPage() {
  const { addToCart, favorites, toggleFavorite } = useStore();

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Categorias</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Explore todos os produtos</p>
      </div>

      {/* Category Grid */}
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
    </div>
  );
}
