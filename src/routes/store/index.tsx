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

const BANNERS = [
  { id: 1, title: "Frete grátis", subtitle: "Em pedidos acima de R$ 50", color: "from-primary/90 to-emerald-600", emoji: "🚚" },
  { id: 2, title: "20% OFF", subtitle: "Primeira compra com o cupom NOVO20", color: "from-violet-600 to-purple-700", emoji: "🎉" },
  { id: 3, title: "Entrega rápida", subtitle: "Receba em até 40 minutos", color: "from-amber-500 to-orange-600", emoji: "⚡" },
];

const CATEGORIES = [
  { id: 1, name: "Lanches", emoji: "🍔", color: "bg-amber-500/15" },
  { id: 2, name: "Bebidas", emoji: "🥤", color: "bg-blue-500/15" },
  { id: 3, name: "Mercado", emoji: "🛒", color: "bg-primary/15" },
  { id: 4, name: "Açougue", emoji: "🥩", color: "bg-red-500/15" },
  { id: 5, name: "Padaria", emoji: "🍞", color: "bg-amber-400/15" },
  { id: 6, name: "Hortifruti", emoji: "🥬", color: "bg-green-500/15" },
  { id: 7, name: "Cosméticos", emoji: "💄", color: "bg-pink-500/15" },
  { id: 8, name: "Eletrônicos", emoji: "📱", color: "bg-violet-500/15" },
];

const PRODUCTS = [
  { id: 1, name: "Arroz Tio João 5kg", desc: "Tipo 1 premium", price: 32.90, oldPrice: 39.90, image: "🍚", rating: 4.8, reviews: 234, badge: "Mais vendido", category: "Mercado", stock: 50 },
  { id: 2, name: "Feijão Carioca 1kg", desc: "Seleção especial", price: 8.90, oldPrice: null, image: "🫘", rating: 4.6, reviews: 128, badge: null, category: "Mercado", stock: 35 },
  { id: 3, name: "Café Pilão 500g", desc: "Extra forte moído", price: 18.90, oldPrice: 22.90, image: "☕", rating: 4.9, reviews: 412, badge: "Oferta", category: "Mercado", stock: 28 },
  { id: 4, name: "Leite Integral 1L", desc: "Integral UHT", price: 6.49, oldPrice: null, image: "🥛", rating: 4.5, reviews: 89, badge: null, category: "Bebidas", stock: 60 },
  { id: 5, name: "Pão Francês Kg", desc: "Fresquinho todo dia", price: 12.90, oldPrice: null, image: "🥖", rating: 4.7, reviews: 156, badge: "Fresquinho", category: "Padaria", stock: 20 },
  { id: 6, name: "Hambúrguer Artesanal", desc: "180g angus premium", price: 28.90, oldPrice: 34.90, image: "🍔", rating: 4.9, reviews: 320, badge: "🔥 Top", category: "Lanches", stock: 15 },
  { id: 7, name: "Açaí 500ml", desc: "Puro sem mistura", price: 22.90, oldPrice: null, image: "🫐", rating: 4.8, reviews: 198, badge: null, category: "Bebidas", stock: 25 },
  { id: 8, name: "Bife de Alcatra Kg", desc: "Corte premium", price: 59.90, oldPrice: 69.90, image: "🥩", rating: 4.7, reviews: 87, badge: "Oferta", category: "Açougue", stock: 12 },
];

function StoreHome() {
  const [bannerIdx, setBannerIdx] = useState(0);
  const { addToCart, toggleFavorite, favorites } = useStore();

  useEffect(() => {
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % BANNERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 pb-4 animate-in fade-in duration-300">
      {/* Banner Slider */}
      <div className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-3xl h-40 sm:h-48">
          <AnimatePresence mode="wait">
            <motion.div
              key={bannerIdx}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`absolute inset-0 bg-gradient-to-r ${BANNERS[bannerIdx].color} flex items-center px-6 sm:px-10`}
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white">{BANNERS[bannerIdx].title}</h2>
                <p className="text-sm text-white/80 mt-1">{BANNERS[bannerIdx].subtitle}</p>
                <Button size="sm" className="mt-3 h-8 rounded-xl bg-white/20 backdrop-blur-sm text-white border-0 hover:bg-white/30">
                  Ver ofertas <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
              <span className="text-5xl sm:text-6xl shrink-0">{BANNERS[bannerIdx].emoji}</span>
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {BANNERS.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        </div>
      </div>

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
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-700 shrink-0">
          <Star className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">4.8 ★</span>
        </div>
      </div>

      {/* Categories */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Categorias</h2>
          <Link to="/store/categories" className="text-xs font-semibold text-primary flex items-center gap-0.5">
            Ver todas <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              to="/store/categories"
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div className={`w-16 h-16 rounded-2xl ${cat.color} flex items-center justify-center text-2xl group-hover:scale-105 transition-transform`}>
                {cat.emoji}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Promo Section */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold">Ofertas do dia</h2>
          <Badge className="rounded-full bg-orange-500/15 text-orange-600 text-[10px] border-0">ATÉ 30% OFF</Badge>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {PRODUCTS.filter((p) => p.oldPrice).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addToCart}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={toggleFavorite}
              compact
            />
          ))}
        </div>
      </div>

      {/* Featured Products */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Mais vendidos</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PRODUCTS.filter((p) => p.badge?.includes("Top") || p.reviews > 200).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addToCart}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </div>

      {/* All Products */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Todos os produtos</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PRODUCTS.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addToCart}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
  isFavorite,
  onToggleFavorite,
  compact = false,
}: {
  product: (typeof PRODUCTS)[0];
  onAdd: (item: { id: number; name: string; price: number; image: string }) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  compact?: boolean;
}) {
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  return (
    <Link to="/store/product/$productId" params={{ productId: String(product.id) }} className="block group">
      <div className={`bg-surface rounded-2xl border border-border/40 overflow-hidden shadow-soft hover:shadow-ambient transition-all group-hover:scale-[1.01] ${compact ? "w-[160px] shrink-0" : ""}`}>
        {/* Image */}
        <div className="relative h-32 sm:h-36 bg-secondary/30 flex items-center justify-center">
          <span className="text-4xl sm:text-5xl">{product.image}</span>
          {product.badge && (
            <Badge className="absolute top-2 left-2 rounded-lg text-[10px] font-bold bg-primary text-primary-foreground border-0">
              {product.badge}
            </Badge>
          )}
          {discount > 0 && (
            <Badge className="absolute top-2 right-2 rounded-lg text-[10px] font-bold bg-red-500 text-white border-0">
              -{discount}%
            </Badge>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(product.id); }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-surface/80 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-surface"
          >
            <span className={`text-sm ${isFavorite ? "text-red-500" : "text-muted-foreground"}`}>
              {isFavorite ? "❤️" : "🤍"}
            </span>
          </button>
        </div>
        {/* Info */}
        <div className="p-3">
          <p className="text-sm font-semibold truncate">{product.name}</p>
          {!compact && <p className="text-xs text-muted-foreground truncate mt-0.5">{product.desc}</p>}
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-medium">{product.rating}</span>
            <span className="text-[10px] text-muted-foreground">({product.reviews})</span>
          </div>
          <div className="flex items-end gap-2 mt-1.5">
            <span className="text-base font-bold text-foreground">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                R$ {product.oldPrice.toFixed(2).replace(".", ",")}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd({ id: product.id, name: product.name, price: product.price, image: product.image }); }}
            className="w-full h-8 mt-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </Link>
  );
}
