import { useState, createContext, useContext } from "react";
import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import {
  Home,
  LayoutGrid,
  Search,
  ShoppingCart,
  User,
  MapPin,
  ChevronDown,
  Heart,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type CartItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  qty: number;
  obs?: string;
};

type StoreContextType = {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "qty">) => void;
  removeFromCart: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  cartCount: number;
  cartTotal: number;
  favorites: number[];
  toggleFavorite: (id: number) => void;
};

export const StoreContext = createContext<StoreContextType>({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQty: () => {},
  cartCount: 0,
  cartTotal: 0,
  favorites: [],
  toggleFavorite: () => {},
});

export const useStore = () => useContext(StoreContext);

export const Route = createFileRoute("/store")({
  component: StoreLayout,
  head: () => ({
    meta: [{ title: "Mercado do Zé — ARMAZIX" }],
  }),
});

const BOTTOM_ITEMS = [
  { href: "/store", label: "Início", icon: Home },
  { href: "/store/categories", label: "Categorias", icon: LayoutGrid },
  { href: "/store/search", label: "Buscar", icon: Search },
  { href: "/store/cart", label: "Carrinho", icon: ShoppingCart },
  { href: "/store/account", label: "Perfil", icon: User },
];

function StoreLayout() {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);

  const addToCart = (item: Omit<CartItem, "qty">) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((c) => c.id !== id));
  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty } : c)));
  };
  const cartCount = cart.reduce((a, c) => a + c.qty, 0);
  const cartTotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const toggleFavorite = (id: number) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  return (
    <StoreContext.Provider value={{ cart, addToCart, removeFromCart, updateQty, cartCount, cartTotal, favorites, toggleFavorite }}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border/40">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            {/* Logo + Location */}
            <div className="flex items-center gap-2 min-w-0">
              <Link to="/store" className="flex items-center gap-2 shrink-0">
                <span className="grid place-items-center w-8 h-8 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow text-sm font-bold">
                  MZ
                </span>
              </Link>
              <button className="flex items-center gap-1 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold truncate">Rua das Flores, 120</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Link
                to="/store/search"
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Search className="w-4.5 h-4.5 text-muted-foreground" />
              </Link>
              <button className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors relative">
                <Bell className="w-4.5 h-4.5 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              </button>
              {/* Cart */}
              <Sheet>
                <SheetTrigger asChild>
                  <button className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors relative">
                    <ShoppingCart className="w-4.5 h-4.5 text-muted-foreground" />
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none px-1">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Seu carrinho
                      {cartCount > 0 && (
                        <Badge className="rounded-full bg-primary/15 text-primary text-xs">{cartCount} itens</Badge>
                      )}
                    </SheetTitle>
                  </SheetHeader>
                  {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                        <ShoppingCart className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Seu carrinho está vazio</p>
                      <p className="text-xs text-muted-foreground">Adicione produtos para começar</p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-[calc(100%-80px)]">
                      <div className="flex-1 overflow-y-auto py-4 space-y-3">
                        {cart.map((item) => (
                          <div key={item.id} className="flex gap-3 p-3 rounded-2xl bg-secondary/40">
                            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                              {item.image}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-sm font-bold text-primary mt-0.5">
                                R$ {item.price.toFixed(2).replace(".", ",")}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => updateQty(item.id, item.qty - 1)}
                                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-secondary transition-colors"
                                >
                                  −
                                </button>
                                <span className="text-sm font-semibold w-5 text-center">{item.qty}</span>
                                <button
                                  onClick={() => updateQty(item.id, item.qty + 1)}
                                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-secondary transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="self-start text-muted-foreground hover:text-destructive transition-colors p-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border/50 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Entrega</span>
                          <span className="font-medium text-primary">Grátis</span>
                        </div>
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-border/50">
                          <span>Total</span>
                          <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
                        </div>
                        <Link
                          to="/store/checkout"
                          className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow flex items-center justify-center mt-2 hover:scale-[1.01] active:scale-[0.99] transition-transform"
                        >
                          Finalizar pedido
                        </Link>
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation - Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-t border-border/40 lg:hidden safe-area-bottom">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
            {BOTTOM_ITEMS.map((item) => {
              const active = item.href === "/store" ? pathname === "/store" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex flex-col items-center gap-0.5 min-w-[48px] py-1"
                >
                  <div
                    className={`flex items-center justify-center w-10 h-7 rounded-xl transition-colors ${
                      active ? "bg-primary/15" : ""
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </StoreContext.Provider>
  );
}
