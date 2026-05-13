import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  ShoppingCart,
  User,
  Percent,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/admin/pdv")({
  component: PDVPage,
  head: () => ({
    meta: [{ title: "PDV — ARMAZIX" }],
  }),
});

const PRODUCTS = [
  { id: 1, name: "Arroz 5kg", price: 24.9, emoji: "🌾" },
  { id: 2, name: "Feijão 1kg", price: 8.9, emoji: "🫘" },
  { id: 3, name: "Açúcar 1kg", price: 5.5, emoji: "🍬" },
  { id: 4, name: "Óleo 900ml", price: 7.8, emoji: "🫒" },
  { id: 5, name: "Leite 1L", price: 6.2, emoji: "🥛" },
  { id: 6, name: "Café 500g", price: 18.9, emoji: "☕" },
  { id: 7, name: "Macarrão 500g", price: 4.5, emoji: "🍝" },
  { id: 8, name: "Sabão 1kg", price: 12.9, emoji: "🧹" },
  { id: 9, name: "Refrigerante 2L", price: 8.5, emoji: "🥤" },
  { id: 10, name: "Biscoito 200g", price: 3.9, emoji: "🍪" },
  { id: 11, name: "Farinha 1kg", price: 4.2, emoji: "🌾" },
  { id: 12, name: "Sal 1kg", price: 3.0, emoji: "🧂" },
];

interface CartItem {
  productId: number;
  name: string;
  price: number;
  qty: number;
  emoji: string;
}

function PDVPage() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const filtered = PRODUCTS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: (typeof PRODUCTS)[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, qty: 1, emoji: product.emoji }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discountValue = subtotal * (discount / 100);
  const total = subtotal - discountValue;

  const paymentMethods = [
    { key: "pix", label: "PIX", icon: Smartphone },
    { key: "cartao", label: "Cartão", icon: CreditCard },
    { key: "dinheiro", label: "Dinheiro", icon: Banknote },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="h-[calc(100vh-7rem)] flex flex-col lg:flex-row gap-4"
    >
      {/* Products Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto ou código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 rounded-xl"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-2xl">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface border border-border/50 hover:border-primary/40 hover:shadow-soft transition-all active:scale-[0.97]"
              >
                <span className="text-2xl">{product.emoji}</span>
                <span className="text-xs font-medium text-center leading-tight">{product.name}</span>
                <span className="text-sm font-bold text-primary">R$ {product.price.toFixed(2).replace(".", ",")}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Panel */}
      <Card className="w-full lg:w-[380px] flex flex-col rounded-2xl border-border/50 shadow-soft">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Carrinho
            </h2>
            <Badge variant="secondary" className="rounded-full">
              {cart.reduce((s, i) => s + i.qty, 0)} itens
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Carrinho vazio</p>
              <p className="text-xs mt-1">Toque nos produtos para adicionar</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 py-2">
                <span className="text-xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    R$ {item.price.toFixed(2).replace(".", ",")} × {item.qty}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.productId, -1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.productId, 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="border-t border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Desconto %"
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="h-8 rounded-lg text-sm"
                min={0}
                max={100}
              />
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Desconto ({discount}%)</span>
                  <span>−R$ {discountValue.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-gradient-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="flex gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    paymentMethod === m.key
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </button>
              ))}
            </div>

            <Button
              onClick={() => setShowCheckout(true)}
              disabled={!paymentMethod}
              className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform text-base"
            >
              Finalizar venda
            </Button>
          </div>
        )}
      </Card>

      {/* Checkout Success Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface rounded-2xl p-8 max-w-sm w-full text-center shadow-soft"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-gradient-primary text-primary-foreground shadow-glow mb-4"
            >
              <Check className="w-8 h-8" />
            </motion.div>
            <h3 className="text-xl font-bold">Venda concluída!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Total: R$ {total.toFixed(2).replace(".", ",")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pagamento: {paymentMethods.find((m) => m.key === paymentMethod)?.label}
            </p>
            <Button
              onClick={() => {
                setShowCheckout(false);
                setCart([]);
                setDiscount(0);
                setPaymentMethod(null);
              }}
              className="mt-6 h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
            >
              Nova venda
            </Button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
