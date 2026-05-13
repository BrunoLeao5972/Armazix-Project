import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart, Minus, Plus, Trash2, Tag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "../store";

export const Route = createFileRoute("/store/cart")({
  component: CartPage,
  head: () => ({
    meta: [{ title: "Carrinho — Mercado do Zé" }],
  }),
});

function CartPage() {
  const { cart, updateQty, removeFromCart, cartTotal } = useStore();

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
          <ShoppingCart className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold">Seu carrinho está vazio</h2>
        <p className="text-sm text-muted-foreground mt-1">Adicione produtos para começar</p>
        <Link to="/store">
          <Button className="mt-4 h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
            Explorar produtos
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 animate-in fade-in duration-300">
      <h1 className="text-xl font-bold mb-4">Seu carrinho</h1>

      {/* Items */}
      <div className="space-y-3">
        {cart.map((item) => (
          <div key={item.id} className="flex gap-3 p-3 rounded-2xl bg-surface border border-border/40">
            <div className="w-16 h-16 rounded-xl bg-secondary/30 flex items-center justify-center text-2xl shrink-0">
              {item.image}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{item.name}</p>
              <p className="text-sm font-bold text-primary mt-0.5">
                R$ {(item.price * item.qty).toFixed(2).replace(".", ",")}
              </p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 bg-secondary rounded-lg px-1">
                  <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-7 h-7 flex items-center justify-center">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-7 h-7 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon */}
      <div className="mt-4 flex gap-2">
        <div className="flex-1 relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Cupom de desconto"
            className="w-full h-10 rounded-xl border border-border/50 bg-surface pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button variant="outline" className="h-10 rounded-xl px-4">Aplicar</Button>
      </div>

      {/* Summary */}
      <div className="mt-5 p-4 rounded-2xl bg-surface border border-border/40 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Entrega</span>
          <span className="font-medium text-primary flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" /> Grátis
          </span>
        </div>
        <div className="flex justify-between text-base font-bold pt-2 border-t border-border/50">
          <span>Total</span>
          <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
        </div>
      </div>

      {/* Checkout Button */}
      <Link to="/store/checkout" className="block mt-4">
        <Button className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform text-base">
          Finalizar pedido
        </Button>
      </Link>
    </div>
  );
}
