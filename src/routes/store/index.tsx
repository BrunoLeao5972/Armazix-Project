import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Clock,
  Truck,
  Star,
  Flame,
  Sparkles,
  Tag,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "../store";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
  head: () => ({
    meta: [{ title: "Mercado do Zé — ARMAZIX" }],
  }),
});

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  emoji: string | null;
  badge: string | null;
  stock: number | null;
  active: boolean | null;
}

interface StoreCategory {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

function StoreHome() {
  const [bannerIdx, setBannerIdx] = useState(0);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const { addToCart, toggleFavorite, favorites } = useStore();

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetchProducts(storeId);
      fetchCategories(storeId);
    }
  }, []);

  const fetchProducts = async (storeId: string) => {
    try {
      const res = await fetch(`/api/products/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
    } catch {}
  };

  const fetchCategories = async (storeId: string) => {
    try {
      const res = await fetch(`/api/categories/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch {}
  };

  const activeProducts = products.filter(p => p.active !== false);

  const promoProducts = activeProducts.filter(p => p.compareAtPrice && parseFloat(p.compareAtPrice) > parseFloat(p.price));
  const featuredProducts = activeProducts.filter(p => p.badge?.includes("Top"));

  return (
    <div className="space-y-6 pb-4 animate-in fade-in duration-300">
      {/* Info Bar */}
      <div className="px-4 flex gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">30-50 min</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary shrink-0">
          <Truck className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Frete grátis</span>
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Categorias</h2>
          <Link to="/store/categories" className="text-xs font-semibold text-primary flex items-center gap-0.5">
            Ver todas <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {categories.map(cat => (
            <Link key={cat.id} to="/store/categories" className="flex flex-col items-center gap-1.5 shrink-0 group">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-105 transition-transform" style={{ backgroundColor: cat.color || "#3b82f620" }}>
                {cat.emoji || "📁"}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
      )}

      {/* Promo Section */}
      {promoProducts.length > 0 && (
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold">Ofertas do dia</h2>
          <Badge className="rounded-full bg-orange-500/15 text-orange-600 text-[10px] border-0">ATÉ 30% OFF</Badge>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {promoProducts.map(product => (
            <StoreProductCard key={product.id} product={product} onAdd={addToCart} isFavorite={favorites.includes(Number(product.id))} onToggleFavorite={toggleFavorite} compact />
          ))}
        </div>
      </div>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Mais vendidos</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {featuredProducts.map(product => (
            <StoreProductCard key={product.id} product={product} onAdd={addToCart} isFavorite={favorites.includes(Number(product.id))} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      </div>
      )}

      {/* All Products */}
      {activeProducts.length > 0 ? (
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Todos os produtos</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {activeProducts.map(product => (
            <StoreProductCard key={product.id} product={product} onAdd={addToCart} isFavorite={favorites.includes(Number(product.id))} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      </div>
      ) : (
      <div className="px-4 py-16 text-center">
        <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <h2 className="text-lg font-bold">Nenhum produto ainda</h2>
        <p className="text-sm text-muted-foreground mt-1">Os produtos aparecerão aqui assim que forem cadastrados.</p>
      </div>
      )}
    </div>
  );
}

function StoreProductCard({
  product,
  onAdd,
  isFavorite,
  onToggleFavorite,
  compact = false,
}: {
  product: StoreProduct;
  onAdd: (item: { id: number; name: string; price: number; image: string }) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  compact?: boolean;
}) {
  const price = parseFloat(product.price);
  const oldPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const emoji = product.emoji || "📦";

  return (
    <Link to="/store/product/$productId" params={{ productId: product.id }} className="block group">
      <div className={`bg-surface rounded-2xl border border-border/40 overflow-hidden shadow-soft hover:shadow-ambient transition-all group-hover:scale-[1.01] ${compact ? "w-[160px] shrink-0" : ""}`}>
        <div className="relative h-32 sm:h-36 bg-secondary/30 flex items-center justify-center">
          <span className="text-4xl sm:text-5xl">{emoji}</span>
          {product.badge && <Badge className="absolute top-2 left-2 rounded-lg text-[10px] font-bold bg-primary text-primary-foreground border-0">{product.badge}</Badge>}
          {discount > 0 && <Badge className="absolute top-2 right-2 rounded-lg text-[10px] font-bold bg-red-500 text-white border-0">-{discount}%</Badge>}
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(Number(product.id)); }} className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-surface/80 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-surface">
            <span className={`text-sm ${isFavorite ? "text-red-500" : "text-muted-foreground"}`}>{isFavorite ? "❤️" : "🤍"}</span>
          </button>
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold truncate">{product.name}</p>
          {product.description && !compact && <p className="text-xs text-muted-foreground truncate mt-0.5">{product.description}</p>}
          <div className="flex items-end gap-2 mt-1.5">
            <span className="text-base font-bold text-foreground">R$ {price.toFixed(2).replace(".", ",")}</span>
            {oldPrice && <span className="text-xs text-muted-foreground line-through">R$ {oldPrice.toFixed(2).replace(".", ",")}</span>}
          </div>
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); onAdd({ id: Number(product.id), name: product.name, price, image: emoji }); }} className="w-full h-8 mt-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors">
            Adicionar
          </button>
        </div>
      </div>
    </Link>
  );
}
