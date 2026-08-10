import { formatPrice } from "../../lib/currency";
import type { ProductDoc } from "../../db/types";

export function ProductCard({
  product,
  onAdd,
}: {
  product: ProductDoc;
  onAdd: (p: ProductDoc) => void;
}) {
  const outOfStock = product.trackStock && product.stock <= 0;

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={outOfStock}
      className="group relative flex flex-col items-start text-left rounded-2xl border border-black/10 bg-white p-3 hover:border-primary/50 hover:shadow-soft transition-all disabled:opacity-40 disabled:hover:border-black/10"
    >
      <div className="w-full aspect-square rounded-xl bg-surface flex items-center justify-center overflow-hidden mb-2.5">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl">{product.emoji || "📦"}</span>
        )}
      </div>
      <p className="text-sm font-semibold text-ink line-clamp-2 leading-snug">{product.name}</p>
      <p className="text-sm font-bold text-primary mt-1.5">R$ {formatPrice(product.price)}</p>

      {outOfStock && (
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-ink/80 text-white px-2 py-0.5 rounded-full">
          Esgotado
        </span>
      )}
    </button>
  );
}
