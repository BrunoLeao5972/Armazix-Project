import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Clock,
  Truck,
  Flame,
  Sparkles,
  Tag,
  Package,
  Star,
  Heart,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "../store";
import { type StoreProduct, type StoreCategory, formatPrice } from "@/lib/store-context";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

function StoreHome() {
  const [bannerIdx, setBannerIdx] = useState(0);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { store, addToCart, toggleFavorite, favorites } = useStore();

  useEffect(() => {
    if (!store?.id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/products/list?storeId=${store.id}`).then(r => r.json()),
      fetch(`/api/categories/list?storeId=${store.id}`).then(r => r.json()),
    ]).then(([pd, cd]) => {
      if (pd.products) setProducts(pd.products);
      if (cd.categories) setCategories(cd.categories);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [store?.id]);

  // Banner auto-rotate
  const banners = store?.banners || [];
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  const activeProducts = products.filter(p => p.active !== false);
  const promoProducts = activeProducts.filter(p => p.compareAtPrice && parseFloat(p.compareAtPrice) > parseFloat(p.price));
  const featuredProducts = activeProducts.filter(p => p.featured);

  const handleAdd = useCallback((product: StoreProduct) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      image: product.imageUrl || null,
      emoji: product.emoji || "📦",
    });
  }, [addToCart]);

  return (
    <div className="space-y-6 pb-4 animate-in fade-in duration-300">

      {/* Banner Slider */}
      {banners.length > 0 && (
        <div className="relative mx-4 mt-3 h-44 sm:h-52 rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={bannerIdx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              {banners[bannerIdx].imageUrl ? (
                <img src={banners[bannerIdx].imageUrl!} alt={banners[bannerIdx].title} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-start justify-end p-5"
                  style={{ background: `linear-gradient(135deg, ${banners[bannerIdx].gradientFrom || "#00C853"}, ${banners[bannerIdx].gradientTo || "#00897B"})` }}
                >
                  {banners[bannerIdx].emoji && <span className="text-4xl mb-2">{banners[bannerIdx].emoji}</span>}
                  <h3 className="text-white text-xl font-bold leading-tight">{banners[bannerIdx].title}</h3>
                  {banners[bannerIdx].subtitle && <p className="text-white/80 text-sm mt-1">{banners[bannerIdx].subtitle}</p>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {/* Dots */}
          {banners.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setBannerIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === bannerIdx ? "bg-white w-4" : "bg-white/50"}`} />
              ))}
            </div>
          )}
          {banners.length > 1 && (
            <>
              <button onClick={() => setBannerIdx(i => (i - 1 + banners.length) % banners.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center hover:bg-black/40 transition-colors">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button onClick={() => setBannerIdx(i => (i + 1) % banners.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center hover:bg-black/40 transition-colors">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Info Bar */}
      <div className="px-4 flex gap-2 overflow-x-auto no-scrollbar">
        {store?.deliveryEnabled && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{store.deliveryEstimate || "30-50 min"}</span>
          </div>
        )}
        {store?.deliveryEnabled && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary shrink-0">
            <Truck className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">
              {parseFloat(store.deliveryFee || "0") === 0 ? "Frete grátis" : `R$ ${formatPrice(store.deliveryFee || "0")}`}
            </span>
          </div>
        )}
        {store?.rating && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="text-xs font-semibold">{store.rating}</span>
          </div>
        )}
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
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden"
                  style={{ backgroundColor: cat.color ? `${cat.color}20` : "#3b82f620" }}>
                  {cat.imageUrl
                    ? <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                    : <span className="text-2xl">{cat.emoji || "📁"}</span>
                  }
                </div>
                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center max-w-[64px] truncate">{cat.name}</span>
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
              <ProductCard key={product.id} product={product} onAdd={handleAdd}
                isFavorite={favorites.includes(product.id)} onToggleFavorite={toggleFavorite} compact />
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
              <ProductCard key={product.id} product={product} onAdd={handleAdd}
                isFavorite={favorites.includes(product.id)} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        </div>
      )}

      {/* All Products */}
      {loading ? (
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-secondary/40 h-56 animate-pulse" />
          ))}
        </div>
      ) : activeProducts.length > 0 ? (
        <div className="px-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Todos os produtos</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {activeProducts.map(product => (
              <ProductCard key={product.id} product={product} onAdd={handleAdd}
                isFavorite={favorites.includes(product.id)} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 py-16 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <h2 className="text-lg font-bold">Nenhum produto ainda</h2>
          <p className="text-sm text-muted-foreground mt-1">Os produtos aparecerão aqui em breve.</p>
        </div>
      )}
    </div>
  );
}

export function ProductCard({
  product,
  onAdd,
  isFavorite,
  onToggleFavorite,
  compact = false,
}: {
  product: StoreProduct;
  onAdd: (p: StoreProduct) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  compact?: boolean;
}) {
  const [added, setAdded] = useState(false);
  const price = parseFloat(product.price);
  const oldPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  return (
    <Link to="/store/product/$productId" params={{ productId: product.id }} className="block group">
      <div className={`bg-surface rounded-2xl border border-border/40 overflow-hidden shadow-soft hover:shadow-ambient transition-all group-hover:scale-[1.01] ${compact ? "w-[160px] shrink-0" : ""}`}>
        {/* Image */}
        <div className="relative h-32 sm:h-36 bg-secondary/30 flex items-center justify-center overflow-hidden">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <span className="text-4xl sm:text-5xl">{product.emoji || "📦"}</span>
          }
          {product.badge && <Badge className="absolute top-2 left-2 rounded-lg text-[10px] font-bold bg-primary text-primary-foreground border-0">{product.badge}</Badge>}
          {discount > 0 && <Badge className="absolute top-2 right-2 rounded-lg text-[10px] font-bold bg-red-500 text-white border-0">-{discount}%</Badge>}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(product.id); }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-surface/80 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-surface"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          </button>
        </div>
        {/* Info */}
        <div className="p-3">
          <p className="text-sm font-semibold truncate">{product.name}</p>
          {product.description && !compact && <p className="text-xs text-muted-foreground truncate mt-0.5">{product.description}</p>}
          {product.rating && Number(product.rating) > 0 && !compact && (
            <div className="flex items-center gap-0.5 mt-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] text-muted-foreground">{product.rating} ({product.reviewCount || 0})</span>
            </div>
          )}
          <div className="flex items-end gap-2 mt-1.5">
            <span className="text-base font-bold text-foreground">R$ {formatPrice(price)}</span>
            {oldPrice && <span className="text-xs text-muted-foreground line-through">R$ {formatPrice(oldPrice)}</span>}
          </div>
          <motion.button
            onClick={handleAdd}
            animate={added ? { scale: [1, 0.92, 1] } : {}}
            className={`w-full h-8 mt-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
              added ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            {added ? "✓ Adicionado" : <><Plus className="w-3 h-3" />Adicionar</>}
          </motion.button>
        </div>
      </div>
    </Link>
  );
}
