import { useState } from "react";
import { Heart } from "lucide-react";
import { type StoreProduct, formatPrice } from "@/lib/store-context";

interface ProductCardProps {
  product: StoreProduct;
  showPrice: boolean;
  highlightLowStock: boolean;
  onAdd: () => void;
  onOpenDetail: () => void;
  primaryColor: string;
  layoutType?: 'grid' | 'list';
}

export function ProductCard({
  product,
  showPrice,
  highlightLowStock,
  onAdd,
  onOpenDetail,
  primaryColor,
  layoutType = 'grid',
}: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const hasPromo =
    !!product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price);

  const lowStock =
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
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {product.emoji || "📦"}
            </div>
          )}
          {lowStock && (
            <div className="absolute top-1 left-1">
              <div className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-semibold">
                Últimas
              </div>
            </div>
          )}
          {hasPromo && (
            <div className="absolute bottom-1 left-1">
              <div className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold">
                -{discountPercent}%
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

        {/* Add button */}
        <div className="flex flex-col items-center justify-end self-stretch pb-3 pr-3">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="w-9 h-9 rounded-xl font-bold text-white flex items-center justify-center transition-all hover:opacity-90 active:scale-95 text-lg"
            style={{ backgroundColor: primaryColor }}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onOpenDetail}
    >
      {/* Image Section */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden group">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {product.emoji || "📦"}
          </div>
        )}

        {/* Low Stock Badge - Top Left */}
        {lowStock && (
          <div className="absolute top-3 left-3">
            <div className="px-2.5 py-1 rounded-full bg-red-500 text-white text-[11px] font-semibold">
              Últimas unidades
            </div>
          </div>
        )}

        {/* Discount Badge - Bottom Left */}
        {hasPromo && (
          <div className="absolute bottom-3 left-3">
            <div className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
              -{discountPercent}%
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

        {/* Add to Cart Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="w-full h-11 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] mt-3"
          style={{ backgroundColor: primaryColor }}
        >
          <span className="text-lg">+</span>
          Adicionar
        </button>
      </div>
    </div>
  );
}
