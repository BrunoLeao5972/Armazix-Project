import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Minus, Plus, Heart, Share2, Truck, Clock, Shield, ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store";
import { type StoreProduct, formatPrice } from "@/lib/store-context";

export const Route = createFileRoute("/store/product/$productId")({
  component: ProductPage,
});

interface ProductAddition {
  id: string;
  name: string;
  price: string;
  active: boolean | null;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

function ProductPage() {
  const { productId } = Route.useParams();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [additions, setAdditions] = useState<ProductAddition[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const { store, addToCart, favorites, toggleFavorite } = useStore();
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);

  useEffect(() => {
    if (!store?.id) return;
    fetch(`/api/products/list?storeId=${store.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.products) {
          const found = d.products.find((p: StoreProduct) => p.id === productId);
          setProduct(found || null);
          // Load additions if product has them
          if (found) {
            fetch(`/api/products/list?storeId=${store.id}&productId=${productId}&additions=true`)
              .then(r => r.json())
              .then(ad => { if (ad.additions) setAdditions(ad.additions); })
              .catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, store?.id]);

  const toggleAddition = (id: string) =>
    setSelectedAdditions(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);

  const activeAdditions = additions.filter(a => a.active !== false);
  const additionsTotal = activeAdditions
    .filter(a => selectedAdditions.includes(a.id))
    .reduce((s, a) => s + parseFloat(a.price), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <h2 className="text-lg font-bold">Produto não encontrado</h2>
        <Link to="/store" className="mt-4">
          <Button className="h-10 rounded-xl bg-primary text-primary-foreground font-semibold">Voltar à loja</Button>
        </Link>
      </div>
    );
  }

  const price = parseFloat(product.price);
  const oldPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const totalItem = (price + additionsTotal) * qty;
  const isFavorite = favorites.includes(productId);
  const outOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const lowStock = product.stock !== null && product.stock !== undefined && product.stock > 0 && product.stock <= (5);

  const handleAdd = () => {
    if (outOfStock) return;
    const chosenAdditions = activeAdditions
      .filter(a => selectedAdditions.includes(a.id))
      .map(a => ({ name: a.name, price: parseFloat(a.price) }));
    addToCart({
      id: product.id,
      name: product.name,
      price: price + additionsTotal,
      image: product.imageUrl || null,
      emoji: product.emoji || "📦",
      obs: obs || undefined,
      additions: chosenAdditions.length > 0 ? chosenAdditions : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  // Share via Web Share API
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, text: product.description || product.name, url: window.location.href });
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-32">
      {/* Back */}
      <div className="px-4 pt-3">
        <Link to="/store" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      {/* Product Image */}
      <div className="mx-4 mt-3 h-60 sm:h-72 bg-secondary/20 rounded-3xl flex items-center justify-center relative overflow-hidden">
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          : <span className="text-7xl sm:text-8xl">{product.emoji || "📦"}</span>
        }
        {product.badge && <Badge className="absolute top-3 left-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground border-0">{product.badge}</Badge>}
        {discount > 0 && <Badge className="absolute top-3 right-3 rounded-xl text-xs font-bold bg-red-500 text-white border-0">-{discount}%</Badge>}
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Title + Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{product.name}</h1>
            {product.description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{product.description}</p>}
            {product.rating && Number(product.rating) > 0 && (
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(Number(product.rating)) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                ))}
                <span className="text-xs text-muted-foreground ml-1">{product.rating} ({product.reviewCount || 0} avaliações)</span>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => toggleFavorite(productId)} className="w-9 h-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-secondary transition-colors">
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            </button>
            <button onClick={handleShare} className="w-9 h-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-secondary transition-colors">
              <Share2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold">R$ {formatPrice(price)}</span>
          {oldPrice && <span className="text-sm text-muted-foreground line-through">R$ {formatPrice(oldPrice)}</span>}
        </div>

        {/* Info Pills */}
        <div className="flex gap-2 flex-wrap">
          {store?.deliveryEnabled && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Truck className="w-3 h-3" />
              {parseFloat(store.deliveryFee || "0") === 0 ? "Frete grátis" : `R$ ${formatPrice(store.deliveryFee || "0")}`}
            </div>
          )}
          {store?.deliveryEstimate && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-medium">
              <Clock className="w-3 h-3" /> {store.deliveryEstimate}
            </div>
          )}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 text-xs font-medium">
            <Shield className="w-3 h-3" /> Compra segura
          </div>
        </div>

        {/* Stock */}
        {outOfStock ? (
          <div className="px-3 py-2 rounded-xl bg-red-500/10 text-red-600 text-sm font-medium">Produto indisponível</div>
        ) : lowStock ? (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 text-sm font-medium">⚠️ Últimas {product.stock} unidades</div>
        ) : null}

        {/* Additions */}
        {activeAdditions.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-2">Adicionais</h3>
            <div className="space-y-2">
              {activeAdditions.map(addition => {
                const selected = selectedAdditions.includes(addition.id);
                return (
                  <button
                    key={addition.id}
                    onClick={() => toggleAddition(addition.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      selected ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selected ? "border-primary bg-primary" : "border-border"}`}>
                        {selected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm font-medium">{addition.name}</span>
                    </div>
                    <span className="text-sm font-bold text-primary">+R$ {formatPrice(addition.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Observation */}
        <div>
          <h3 className="text-sm font-bold mb-2">Observação <span className="font-normal text-muted-foreground">(opcional)</span></h3>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Ex: Sem cebola, bem passado..."
            className="w-full h-20 rounded-xl border border-border/50 bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-3">Avaliações</h3>
            <div className="space-y-3">
              {reviews.slice(0, 3).map(review => (
                <div key={review.id} className="p-3 rounded-xl bg-secondary/30">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-1">{new Date(review.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {review.comment && <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Add Bar */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border/40 px-4 py-3 z-30">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-1 shrink-0">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 flex items-center justify-center hover:text-primary transition-colors">
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold w-6 text-center">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="w-8 h-8 flex items-center justify-center hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <motion.button
            onClick={handleAdd}
            disabled={outOfStock}
            animate={added ? { scale: [1, 0.95, 1] } : {}}
            className={`flex-1 h-11 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              outOfStock ? "bg-secondary text-muted-foreground cursor-not-allowed" :
              added ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            <AnimatePresence mode="wait">
              {added ? (
                <motion.span key="added" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Adicionado!
                </motion.span>
              ) : (
                <motion.span key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Adicionar · R$ {formatPrice(totalItem)}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
