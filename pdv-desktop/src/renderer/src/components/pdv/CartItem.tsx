import { Minus, Plus, X } from "lucide-react";
import { formatPrice } from "../../lib/currency";
import type { CartLine } from "../../hooks/useCart";

export function CartItem({
  line,
  onQuantityChange,
  onRemove,
}: {
  line: CartLine;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-black/5">
      <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0 text-lg">
        {line.emoji || "📦"}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{line.name}</p>
        <p className="text-xs text-ink/50">R$ {formatPrice(line.unitPrice)} / un</p>
      </div>

      <div className="flex items-center gap-1.5 bg-surface rounded-lg px-1 shrink-0">
        <button
          type="button"
          onClick={() => onQuantityChange(line.productId, line.quantity - 1)}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/5"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-sm font-semibold w-5 text-center">{line.quantity}</span>
        <button
          type="button"
          onClick={() => onQuantityChange(line.productId, line.quantity + 1)}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/5"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <p className="text-sm font-bold w-16 text-right shrink-0">
        R$ {formatPrice(line.unitPrice * line.quantity)}
      </p>

      <button
        type="button"
        onClick={() => onRemove(line.productId)}
        title="Cancelar item"
        className="text-ink/30 hover:text-red-500 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
