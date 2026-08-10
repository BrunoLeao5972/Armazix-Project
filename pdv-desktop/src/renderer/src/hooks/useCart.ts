import { useCallback, useMemo, useState } from "react";
import type { ProductDoc } from "../db/types";

export interface CartLine {
  productId: string;
  name: string;
  emoji: string | null;
  unitPrice: number;
  quantity: number;
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);

  const addProduct = useCallback((product: ProductDoc) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          emoji: product.emoji,
          unitPrice: parseFloat(product.price) || 0,
          quantity: 1,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => (l.productId === productId ? { ...l, quantity } : l));
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setDiscount(0);
  }, []);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines],
  );
  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  return { lines, addProduct, updateQuantity, removeLine, clear, discount, setDiscount, subtotal, total };
}

export type UseCartReturn = ReturnType<typeof useCart>;
