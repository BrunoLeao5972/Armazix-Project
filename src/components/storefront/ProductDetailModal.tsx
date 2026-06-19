import { useState } from "react";
import { X, ShoppingBag, Star } from "lucide-react";
import { type StoreProduct, formatPrice } from "@/lib/store-context";

interface ProductDetailModalProps {
  product: StoreProduct | null;
  open: boolean;
  showPrice: boolean;
  highlightLowStock: boolean;
  primaryColor: string;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, obs: string) => void;
}

export function ProductDetailModal({
  product,
  open,
  showPrice,
  highlightLowStock,
  primaryColor,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [obs, setObs] = useState("");

  if (!open || !product) return null;

  const hasPromo =
    !!product.compareAtPrice &&
    parseFloat(product.compareAtPrice) > parseFloat(product.price);

  const discountPercent = hasPromo
    ? Math.round(
        ((parseFloat(product.compareAtPrice || "0") - parseFloat(product.price)) /
          parseFloat(product.compareAtPrice || "1")) *
          100
      )
    : 0;

  const lowStock =
    highlightLowStock &&
    typeof product.stock === "number" &&
    typeof product.lowStockThreshold === "number" &&
    product.stock <= product.lowStockThreshold;

  const handleAdd = () => {
    onAddToCart(product, obs.trim());
    setObs("");
    onClose();
  };

  const handleClose = () => {
    setObs("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl max-h-[95dvh] flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Área da imagem ── */}
        <div className="relative shrink-0 bg-slate-50 aspect-square w-full sm:w-72 sm:rounded-l-2xl overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">
              {product.emoji || "📦"}
            </div>
          )}

          {/* Badges sobre a imagem */}
          {lowStock && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-red-500 text-white text-[11px] font-semibold">
              Últimas unidades
            </div>
          )}
          {hasPromo && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
              -{discountPercent}%
            </div>
          )}
        </div>

        {/* ── Conteúdo ── */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header do modal */}
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex-1 min-w-0 space-y-1">
              {product.rating && parseFloat(product.rating) > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-slate-700">
                    {parseFloat(product.rating).toFixed(1)}
                  </span>
                  {product.reviewCount ? (
                    <span>({product.reviewCount} avaliações)</span>
                  ) : null}
                </div>
              )}
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {product.name}
              </h2>
              {product.badge && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  {product.badge}
                </span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Descrição */}
          {product.description && (
            <p className="px-5 pb-3 text-sm text-slate-600 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Preço */}
          {showPrice ? (
            <div className="px-5 pb-3 space-y-0.5">
              {hasPromo && (
                <p className="text-xs text-slate-400 line-through">
                  R$ {formatPrice(product.compareAtPrice)}
                </p>
              )}
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                R$ {formatPrice(product.price)}
              </p>
            </div>
          ) : (
            <p className="px-5 pb-3 text-sm text-slate-500">Sob consulta</p>
          )}

          {/* Campo de observação condicional */}
          {product.allowObservation === true && (
            <div className="px-5 pb-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Observações sobre o seu produto
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value.slice(0, 200))}
                placeholder="Ex: embrulhar para presente, tirar cebola..."
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <p className="text-right text-[11px] text-slate-400">
                {obs.length}/200
              </p>
            </div>
          )}

          {/* Botão adicionar */}
          <div className="px-5 pb-5 pt-2 mt-auto">
            <button
              onClick={handleAdd}
              className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingBag className="w-5 h-5" />
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
