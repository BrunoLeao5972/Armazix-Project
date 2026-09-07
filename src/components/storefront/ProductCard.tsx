import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { type StoreProduct, formatPrice, buildProductInquiryWhatsAppUrl } from "@/lib/store-context";

interface ProductCardProps {
  product: StoreProduct;
  showPrice: boolean;
  highlightLowStock: boolean;
  onAdd: () => void;
  onOpenDetail: () => void;
  primaryColor: string;
  layoutType?: 'grid' | 'list';
  whatsappPhone?: string | null;
}

export function ProductCard({
  product,
  showPrice,
  highlightLowStock,
  onAdd,
  onOpenDetail,
  primaryColor,
  layoutType = 'grid',
  whatsappPhone,
}: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const whatsappUrl = !showPrice ? buildProductInquiryWhatsAppUrl(whatsappPhone || "", product.name) : null;

  const hasPromo =
    !!product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price);

  // trackStock=false significa estoque infinito — nunca esgota. Mesma
  // fórmula da tela de detalhe (store/product.$productId.tsx).
  const isTracked  = product.trackStock === true;
  const outOfStock = isTracked && product.stock !== null && product.stock !== undefined && product.stock <= 0;

  const lowStock =
    !outOfStock &&
    highlightLowStock &&
    product.trackStock === true &&
    typeof product.stock === "number" &&
    typeof product.lowStockThreshold === "number" &&
    product.stock <= product.lowStockThreshold;

  const discountPercent = hasPromo
    ? Math.round(
        ((parseFloat(product.compareAtPrice || "0") - parseFloat(product.price)) /
          parseFloat(product.compareAtPrice || "1")) *
          100
      )
    : 0;

  if (layoutType === 'list') {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={onOpenDetail}
      >
        {/* Image */}
        <div className="relative w-24 h-24 shrink-0 bg-slate-50 overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className={`w-full h-full object-contain ${outOfStock ? "grayscale opacity-60" : ""}`}
              onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-4xl ${outOfStock ? "grayscale opacity-60" : ""}`}>
              {product.emoji || "📦"}
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="px-2 py-0.5 rounded border-2 border-slate-600/80 text-slate-600/90 text-[9px] font-extrabold uppercase tracking-wide -rotate-12 bg-white/70">
                Esgotado
              </div>
            </div>
          )}
          {!outOfStock && lowStock && (
            <div className="absolute top-1 left-1">
              <div className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-semibold">
                Últimas
              </div>
            </div>
          )}
          {!outOfStock && hasPromo && (
            <div className="absolute bottom-1 left-1">
              <div className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold">
                -{discountPercent}%
              </div>
            </div>
          )}
          {product.isMadeToOrder && (
            <div className="absolute bottom-1 right-1">
              <div className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                Encomenda
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-3 pr-1">
          <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 leading-snug">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
              {product.description}
            </p>
          )}
          {showPrice ? (
            <div className="flex items-baseline gap-1.5 mt-1">
              {hasPromo && (
                <span className="text-[11px] text-slate-400 line-through">
                  R$ {formatPrice(product.compareAtPrice || "0")}
                </span>
              )}
              <span className="text-base font-bold" style={{ color: primaryColor }}>
                R$ {formatPrice(product.price)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-1">Sob consulta</p>
          )}
        </div>

        {/* Add button — vira link do WhatsApp quando o preço está oculto */}
        <div className="flex flex-col items-center justify-end self-stretch pb-3 pr-3">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
              aria-label="Perguntar no WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); if (!outOfStock) onAdd(); }}
              disabled={outOfStock}
              className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center transition-all text-lg ${
                outOfStock
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "text-white hover:opacity-90 active:scale-95"
              }`}
              style={outOfStock ? undefined : { backgroundColor: primaryColor }}
            >
              +
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onOpenDetail}
    >
      {/* Image Section — caixa quadrada via padding-top (não aspect-ratio):
          o Safari/iOS tem um bug conhecido de recalcular aspect-ratio como
          o tamanho intrínseco da imagem durante o scroll (o toolbar dinâmico
          reflow o layout), fazendo a foto "estourar" pro tamanho natural por
          um instante. padding-top é resolvido pelo box model clássico, sem
          essa recomputação. */}
      <div className="relative w-full" style={{ paddingTop: "100%" }}>
        <div className="absolute inset-0 bg-slate-50 overflow-hidden group">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className={`w-full h-full object-contain ${outOfStock ? "grayscale opacity-60" : ""}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-5xl ${outOfStock ? "grayscale opacity-60" : ""}`}>
              {product.emoji || "📦"}
            </div>
          )}

          {/* Carimbo de esgotado — centralizado, estilo carimbo de borracha */}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-4 py-1.5 rounded-md border-[3px] border-slate-700/80 text-slate-700/90 text-sm font-extrabold uppercase tracking-wider -rotate-12 bg-white/70 backdrop-blur-[1px] shadow-sm">
                Esgotado
              </div>
            </div>
          )}

          {/* Low Stock Badge - Top Left */}
          {!outOfStock && lowStock && (
            <div className="absolute top-3 left-3">
              <div className="px-2.5 py-1 rounded-full bg-red-500 text-white text-[11px] font-semibold">
                Últimas unidades
              </div>
            </div>
          )}

          {/* Discount Badge - Bottom Left */}
          {!outOfStock && hasPromo && (
            <div className="absolute bottom-3 left-3">
              <div className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
                -{discountPercent}%
              </div>
            </div>
          )}

          {/* Made-to-order Badge - Bottom Right */}
          {product.isMadeToOrder && (
            <div className="absolute bottom-3 right-3">
              <div className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-semibold">
                Sob Encomenda
              </div>
            </div>
          )}

          {/* Wishlist Button - Top Right */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white transition-colors"
          >
            <Heart
              className="w-5 h-5 transition-colors"
              style={{
                color: isFavorite ? primaryColor : "rgb(203, 213, 225)",
                fill: isFavorite ? primaryColor : "none",
              }}
            />
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-2">
        {/* Rating */}
        {product.rating && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-yellow-400">★</span>
            <span className="font-semibold text-slate-700">
              {parseFloat(product.rating).toFixed(1)} ({product.reviewCount || 0})
            </span>
          </div>
        )}

        {/* Product Name */}
        <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 min-h-9">
          {product.name}
        </h3>

        {/* Product Spec/Description */}
        {product.description && (
          <p className="text-xs text-slate-500 line-clamp-1">
            {product.description}
          </p>
        )}

        {/* Pricing */}
        {showPrice ? (
          <div className="space-y-1 pt-1">
            {hasPromo && (
              <p className="text-xs text-slate-400 line-through">
                R$ {formatPrice(product.compareAtPrice || "0")}
              </p>
            )}
            <p
              className="text-lg font-bold"
              style={{ color: primaryColor }}
            >
              R$ {formatPrice(product.price)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 pt-1">Sob consulta</p>
        )}

        {/* Add to Cart Button — vira link do WhatsApp quando o preço está oculto */}
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="w-full h-11 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all mt-3 bg-emerald-500 text-white hover:opacity-90 active:scale-[0.98]"
          >
            <MessageCircle className="w-4 h-4" />
            Perguntar no WhatsApp
          </a>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); if (!outOfStock) onAdd(); }}
            disabled={outOfStock}
            className={`w-full h-11 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all mt-3 ${
              outOfStock
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "text-white hover:opacity-90 active:scale-[0.98]"
            }`}
            style={outOfStock ? undefined : { backgroundColor: primaryColor }}
          >
            {outOfStock ? "Esgotado" : (
              <>
                <span className="text-lg">+</span>
                Adicionar
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
