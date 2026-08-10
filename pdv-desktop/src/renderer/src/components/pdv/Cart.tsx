import { useState } from "react";
import { Percent, ShoppingBag, Loader2 } from "lucide-react";
import { formatPrice } from "../../lib/currency";
import type { CartLine } from "../../hooks/useCart";
import { CartItem } from "./CartItem";
import { cn } from "../../lib/cn";

const PAYMENT_METHODS = [
  { key: "cash", label: "Dinheiro" },
  { key: "pix", label: "PIX" },
  { key: "card", label: "Crédito" },
  { key: "debit", label: "Débito" },
];

export function Cart({
  lines,
  subtotal,
  discount,
  total,
  onQuantityChange,
  onRemove,
  onSetDiscount,
  onFinalize,
  finalizing,
}: {
  lines: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onSetDiscount: (v: number) => void;
  onFinalize: (paymentMethod: string) => void;
  finalizing: boolean;
}) {
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("0,00");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const applyDiscount = () => {
    const value = parseFloat(discountInput.replace(",", ".")) || 0;
    onSetDiscount(value);
    setShowDiscount(false);
  };

  return (
    <aside className="w-full max-w-sm shrink-0 h-full flex flex-col bg-white border-l border-black/5">
      <div className="px-5 py-4 border-b border-black/5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink/60">Comanda</h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5">
        {lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-ink/30">
            <ShoppingBag className="w-9 h-9" />
            <p className="text-sm">Toque em um produto para adicionar</p>
          </div>
        ) : (
          lines.map((l) => (
            <CartItem key={l.productId} line={l} onQuantityChange={onQuantityChange} onRemove={onRemove} />
          ))
        )}
      </div>

      <div className="px-5 py-4 border-t border-black/5 space-y-3">
        {showDiscount && (
          <div className="flex items-center gap-2">
            <input
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              className="flex-1 h-10 rounded-lg border border-black/10 px-3 text-sm outline-none focus:border-primary"
              placeholder="0,00"
            />
            <button
              type="button"
              onClick={applyDiscount}
              className="h-10 px-3 rounded-lg bg-ink text-white text-sm font-medium"
            >
              Aplicar
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowDiscount((s) => !s)}
          className="w-full h-9 rounded-lg border border-black/10 text-xs font-medium text-ink/70 flex items-center justify-center gap-1.5 hover:bg-black/5"
        >
          <Percent className="w-3.5 h-3.5" /> Aplicar desconto
        </button>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-ink/60">
            <span>Subtotal</span>
            <span>R$ {formatPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Desconto</span>
              <span>− R$ {formatPrice(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-1.5 border-t border-black/5">
            <span>Total</span>
            <span>R$ {formatPrice(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.key}
              type="button"
              onClick={() => setPaymentMethod(pm.key)}
              className={cn(
                "h-9 rounded-lg text-[11px] font-semibold border transition-colors",
                paymentMethod === pm.key
                  ? "bg-primary text-white border-primary"
                  : "border-black/10 text-ink/70 hover:border-primary/40",
              )}
            >
              {pm.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={lines.length === 0 || !paymentMethod || finalizing}
          onClick={() => paymentMethod && onFinalize(paymentMethod)}
          className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm shadow-glow disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {finalizing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            `Finalizar Venda — R$ ${formatPrice(total)}`
          )}
        </button>
      </div>
    </aside>
  );
}
