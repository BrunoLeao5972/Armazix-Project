import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Star, Minus, Plus, Heart, Share2, Truck, Clock, Shield,
  ChevronLeft, Loader2, CheckCircle2, Package,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store";
import { type StoreProduct, formatPrice } from "@/lib/store-context";
import { getEffectivePrice } from "@/lib/promo-engine";

export const Route = createFileRoute("/store/product/$productId")({
  component: ProductPage,
});

interface ProductAddition {
  id: string; name: string; price: string; active: boolean | null;
}

function ProductPage() {
  const { productId } = Route.useParams();
  const [product,    setProduct]    = useState<StoreProduct | null>(null);
  const [additions,  setAdditions]  = useState<ProductAddition[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [added,      setAdded]      = useState(false);
  const [activeImg,  setActiveImg]  = useState(0);
  const [qty,        setQty]        = useState(1);
  const [obs,        setObs]        = useState("");
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);

  const { store, addToCart, favorites, toggleFavorite } = useStore();

  useEffect(() => {
    if (!store?.id) return;
    fetch(`/api/products/list?storeId=${store.id}&scope=public`)
      .then(r => r.json())
      .then(d => {
        if (d.products) {
          const found = d.products.find((p: StoreProduct) => p.id === productId) ?? null;
          setProduct(found);
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
    setSelectedAdditions(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-2">
        <span className="text-5xl">🚫</span>
        <h2 className="text-lg font-bold mt-2">Produto indisponível</h2>
        <p className="text-sm text-muted-foreground">Este produto não está disponível no momento.</p>
        <Link to="/store" className="mt-4 inline-flex h-10 px-5 rounded-xl items-center justify-center bg-primary text-primary-foreground text-sm font-semibold">
          Voltar à loja
        </Link>
      </div>
    );
  }

  // ── Galeria de imagens ──────────────────────────────────────────
  const extraImgs = product.images ?? [];
  const allImages: string[] = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...extraImgs.filter(img => img !== product.imageUrl),
  ];
  const currentImg = allImages[activeImg] ?? null;

  // ── Preço (com suporte a promoConfig) ──────────────────────────
  const { effectivePrice, originalPrice, hasPromo } = getEffectivePrice(
    product.price, product.promoConfig, "store"
  );
  const compareAt     = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const displayPrice  = hasPromo ? effectivePrice : parseFloat(product.price);
  const displayOld    = hasPromo ? originalPrice : compareAt;
  const discountPct   = displayOld && displayOld > displayPrice
    ? Math.round(((displayOld - displayPrice) / displayOld) * 100) : 0;

  // ── Adicionais ─────────────────────────────────────────────────
  const activeAdditions  = additions.filter(a => a.active !== false);
  const additionsTotal   = activeAdditions
    .filter(a => selectedAdditions.includes(a.id))
    .reduce((s, a) => s + parseFloat(a.price), 0);
  const totalItem        = (displayPrice + additionsTotal) * qty;

  // ── Estado do estoque ──────────────────────────────────────────
  const isFavorite = favorites.includes(productId);
  const outOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const lowStock   = !outOfStock && product.stock !== null && product.stock !== undefined && product.stock <= 5;

  const handleAdd = () => {
    if (outOfStock) return;
    const chosenAdditions = activeAdditions
      .filter(a => selectedAdditions.includes(a.id))
      .map(a => ({ name: a.name, price: parseFloat(a.price) }));
    addToCart({
      id: product.id, name: product.name,
      price: displayPrice + additionsTotal,
      image: product.imageUrl || null,
      emoji: product.emoji || "📦",
      obs:   obs || undefined,
      additions: chosenAdditions.length > 0 ? chosenAdditions : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, text: product.description || product.name, url: window.location.href });
    }
  };

  // ── Barra de ações (reutilizada em mobile e desktop) ───────────
  const ActionBar = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center gap-3 ${compact ? "" : "pt-1"}`}>
      {/* Seletor de quantidade */}
      <div className="flex items-center rounded-xl border border-border/60 overflow-hidden shrink-0">
        <button
          onClick={() => setQty(Math.max(1, qty - 1))}
          className="w-10 h-11 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-10 h-11 flex items-center justify-center text-sm font-bold border-x border-border/60 select-none">
          {qty}
        </span>
        <button
          onClick={() => setQty(qty + 1)}
          className="w-10 h-11 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Botão adicionar */}
      <motion.button
        onClick={handleAdd}
        disabled={outOfStock}
        animate={added ? { scale: [1, 0.96, 1] } : {}}
        transition={{ duration: 0.15 }}
        className={`flex-1 h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
          outOfStock
            ? "bg-secondary text-muted-foreground cursor-not-allowed"
            : added
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
              : "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 shadow-md"
        }`}
      >
        <AnimatePresence mode="wait">
          {added ? (
            <motion.span key="added"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Adicionado!
            </motion.span>
          ) : (
            <motion.span key="add"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adicionar · R$ {formatPrice(totalItem)}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-300 pb-32 lg:pb-12">

      {/* ── Back — mobile ── */}
      <div className="px-4 pt-4 lg:hidden">
        <Link to="/store" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════
          GRID PRINCIPAL — 1 col mobile / 2 col desktop
      ══════════════════════════════════════════════════════ */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:max-w-5xl lg:mx-auto lg:px-8 lg:pt-8 lg:items-start">

        {/* ╔══════════════════════════════╗
            ║  COLUNA ESQUERDA — Galeria  ║
            ╚══════════════════════════════╝ */}
        <div className="space-y-3 px-4 mt-4 lg:px-0 lg:mt-0 lg:sticky lg:top-6">

          {/* Imagem principal */}
          <div className="relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100/80">
            {currentImg ? (
              <img
                key={currentImg}
                src={currentImg}
                alt={product.name}
                className="w-full h-full object-contain p-6 animate-in fade-in duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-8xl select-none">{product.emoji || "📦"}</span>
              </div>
            )}
            {/* Badge desconto */}
            {discountPct > 0 && (
              <span className="absolute top-3 left-3 text-[11px] font-bold px-2 py-1 rounded-lg bg-red-500 text-white shadow-sm">
                -{discountPct}%
              </span>
            )}
            {/* Badge produto */}
            {product.badge && (
              <span className="absolute top-3 right-3 text-[11px] font-bold px-2 py-1 rounded-lg bg-primary text-primary-foreground shadow-sm">
                {product.badge}
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {allImages.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => setActiveImg(i)}
                  aria-label={`Imagem ${i + 1}`}
                  className={`shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden border-2 transition-all duration-150 bg-slate-50 ${
                    activeImg === i
                      ? "border-primary shadow-sm shadow-primary/15 scale-[1.04]"
                      : "border-slate-100 hover:border-slate-300"
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${i + 1}`}
                    className="w-full h-full object-contain p-1.5"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ╔═══════════════════════════════════════╗
            ║  COLUNA DIREITA — Info e compra       ║
            ╚═══════════════════════════════════════╝ */}
        <div className="px-4 lg:px-0 mt-5 lg:mt-0 space-y-5">

          {/* Back — desktop */}
          <div className="hidden lg:block -mb-1">
            <Link to="/store" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" /> Voltar à loja
            </Link>
          </div>

          {/* Título + botões utilitários */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[1.6rem] font-bold leading-snug text-foreground">{product.name}</h1>
            <div className="flex gap-1.5 shrink-0 mt-1">
              <button
                onClick={() => toggleFavorite(productId)}
                aria-label="Favoritar"
                className="w-9 h-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                <Heart className={`w-4 h-4 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
              </button>
              <button
                onClick={handleShare}
                aria-label="Compartilhar"
                className="w-9 h-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Rating */}
          {product.rating && Number(product.rating) > 0 && (
            <div className="flex items-center gap-1.5 -mt-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(Number(product.rating)) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {product.rating} ({product.reviewCount || 0} avaliações)
              </span>
            </div>
          )}

          {/* Descrição */}
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          {/* ── Bloco de preço ── */}
          <div className="flex items-end gap-2.5">
            <span className="text-[2rem] font-black text-emerald-600 tabular-nums leading-none">
              R$ {formatPrice(displayPrice)}
            </span>
            {displayOld && displayOld > displayPrice && (
              <span className="text-base text-slate-400 line-through tabular-nums mb-0.5">
                R$ {formatPrice(displayOld)}
              </span>
            )}
          </div>

          {/* ── Badges de apoio ── */}
          <div className="flex flex-wrap gap-2">
            {store?.deliveryEnabled && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium">
                <Truck className="w-3 h-3" />
                {parseFloat(store.deliveryFee || "0") === 0
                  ? "Frete grátis"
                  : `Frete R$ ${formatPrice(store.deliveryFee || "0")}`}
              </span>
            )}
            {store?.deliveryEstimate && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-xs font-medium">
                <Clock className="w-3 h-3" /> {store.deliveryEstimate}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
              <Shield className="w-3 h-3" /> Compra segura
            </span>
          </div>

          {/* ── Alerta de estoque ── */}
          {outOfStock ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
              <Package className="w-4 h-4 shrink-0" />
              Produto indisponível no momento
            </div>
          ) : lowStock ? (
            <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm font-medium">
              ⚠️ Últimas {product.stock} unidades disponíveis
            </div>
          ) : null}

          {/* ── Adicionais ── */}
          {activeAdditions.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Adicionais</p>
              <div className="space-y-2">
                {activeAdditions.map(addition => {
                  const sel = selectedAdditions.includes(addition.id);
                  return (
                    <button
                      key={addition.id}
                      onClick={() => toggleAddition(addition.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors ${
                        sel
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${sel ? "border-primary bg-primary" : "border-border"}`}>
                          {sel && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm font-medium">{addition.name}</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 shrink-0">
                        +R$ {formatPrice(addition.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Observação ── */}
          {product.allowObservation !== false && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Observação{" "}
                <span className="font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Ex: Sem cebola, bem passado..."
                rows={2}
                className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-colors placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          {/* ── Barra de ações DESKTOP (inline, dentro da coluna) ── */}
          <div className="hidden lg:block">
            <ActionBar />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          BARRA DE AÇÕES MOBILE — sticky no rodapé
      ══════════════════════════════════════════════════════ */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/40 px-4 py-3 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <ActionBar compact />
      </div>
    </div>
  );
}
