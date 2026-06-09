import { useState, createContext, useContext, useEffect, useRef } from "react";
import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import {
  Home,
  LayoutGrid,
  Search,
  ShoppingCart,
  User,
  Loader2,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type CartItem, type StorePublicData, resolveStoreSlug, formatPrice } from "@/lib/store-context";

type StoreContextType = {
  store: StorePublicData | null;
  storeLoading: boolean;
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "qty">) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  favorites: string[];
  toggleFavorite: (id: string) => void;
};

export const StoreContext = createContext<StoreContextType>({
  store: null,
  storeLoading: true,
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQty: () => {},
  clearCart: () => {},
  cartCount: 0,
  cartTotal: 0,
  favorites: [],
  toggleFavorite: () => {},
});

export const useStore = () => useContext(StoreContext);

export const Route = createFileRoute("/store")({
  component: StoreLayout,
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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [store, setStore] = useState<StorePublicData | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const colorStyleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("storeCart");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const sanitized = parsed
        .filter((i: any) => i && typeof i.id === "string" && typeof i.name === "string" && typeof i.qty === "number")
        .map((i: any) => ({
          id: i.id,
          name: i.name,
          price: typeof i.price === "number" ? i.price : 0,
          image: typeof i.image === "string" ? i.image : null,
          emoji: typeof i.emoji === "string" ? i.emoji : null,
          qty: i.qty,
          obs: typeof i.obs === "string" ? i.obs : undefined,
          additions: Array.isArray(i.additions) ? i.additions : undefined,
        })) as CartItem[];
      setCart(sanitized);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("storeCart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Load real store data from slug or subdomain
  useEffect(() => {
    async function loadStore() {
      const slug = resolveStoreSlug();
      if (!slug) { setStoreLoading(false); return; }

      try {
        const res = await fetch(`/api/store/get?slug=${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          setStore(data.store);
          // Store storeId for checkout API calls
          if (data.store?.id) localStorage.setItem("storeId", data.store.id);
          if (data.store?.slug) localStorage.setItem("storeSlug", data.store.slug);
        }
      } catch {}
      finally { setStoreLoading(false); }
    }
    loadStore();
  }, []);

  // Apply store primary color as CSS variable
  useEffect(() => {
    if (!store?.primaryColor) return;
    if (!colorStyleRef.current) {
      colorStyleRef.current = document.createElement("style");
      document.head.appendChild(colorStyleRef.current);
    }
    // Convert hex to HSL for Tailwind CSS variable compatibility
    const hex = store.primaryColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    colorStyleRef.current.textContent = `:root { --primary: ${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%; }`;
  }, [store?.primaryColor]);

  const addToCart = (item: Omit<CartItem, "qty">) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));
  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty } : c)));
  };
  const cartCount = cart.reduce((a, c) => a + c.qty, 0);
  const cartTotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const toggleFavorite = (id: string) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  const clearCart = () => {
    setCart([]);
    try {
      localStorage.removeItem("storeCart");
    } catch {}
  };

  const deliveryFee = store?.deliveryEnabled
    ? parseFloat(store.deliveryFee || "0")
    : 0;
  const cartTotalWithFee = cartTotal + deliveryFee;

  // Initials from store name
  const initials = store?.name
    ? store.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "...";

  return (
    <StoreContext.Provider value={{ store, storeLoading, cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, cartTotal, favorites, toggleFavorite }}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border/40">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            {/* Logo + Store Name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Link to="/store" className="flex items-center gap-2 shrink-0">
                {store?.logoUrl ? (
                  <img src={store.logoUrl} alt={store.name} className="w-9 h-9 rounded-xl object-cover shadow-sm" />
                ) : (
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-glow text-xs font-bold shrink-0">
                    {storeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : initials}
                  </span>
                )}
              </Link>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate leading-tight">
                  {storeLoading ? "Carregando..." : store?.name || "Loja"}
                </p>
                {store?.deliveryEstimate && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{store.deliveryEstimate} · {deliveryFee === 0 ? "Frete grátis" : `R$ ${formatPrice(deliveryFee)}`}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Link
                to="/store/search"
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Search className="w-4.5 h-4.5 text-muted-foreground" />
              </Link>

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
                <SheetContent className="w-full sm:max-w-md flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Seu carrinho
                      {cartCount > 0 && (
                        <Badge className="rounded-full bg-primary/15 text-primary text-xs">{cartCount} {cartCount === 1 ? "item" : "itens"}</Badge>
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
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <div className="flex-1 overflow-y-auto py-4 space-y-3">
                        {cart.map((item) => (
                          <div key={item.id} className="flex gap-3 p-3 rounded-2xl bg-secondary/40">
                            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-2xl">{item.emoji || "📦"}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              {item.additions && item.additions.length > 0 && (
                                <p className="text-[10px] text-muted-foreground truncate">{item.additions.map(a => a.name).join(", ")}</p>
                              )}
                              <p className="text-sm font-bold text-primary mt-0.5">
                                R$ {formatPrice(item.price)}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-secondary transition-colors">−</button>
                                <span className="text-sm font-semibold w-5 text-center">{item.qty}</span>
                                <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-secondary transition-colors">+</button>
                              </div>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="self-start text-muted-foreground hover:text-destructive transition-colors p-1 text-lg leading-none">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border/50 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">R$ {formatPrice(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Entrega</span>
                          {deliveryFee === 0
                            ? <span className="font-medium text-primary">Grátis</span>
                            : <span className="font-medium">R$ {formatPrice(deliveryFee)}</span>
                          }
                        </div>
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-border/50">
                          <span>Total</span>
                          <span>R$ {formatPrice(cartTotalWithFee)}</span>
                        </div>
                        <Link
                          to="/store/checkout"
                          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center mt-2 hover:opacity-90 active:scale-[0.99] transition-all shadow-lg"
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
            {storeLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando loja...</p>
              </div>
            ) : !store ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 px-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                  <Store className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-bold">Loja não encontrada</h2>
                <p className="text-sm text-muted-foreground">Verifique o endereço e tente novamente.</p>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>

        {/* Bottom Navigation - Mobile */}
        {store && (
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
                    <div className={`flex items-center justify-center w-10 h-7 rounded-xl transition-colors ${active ? "bg-primary/15" : ""}`}>
                      <item.icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      {item.href === "/store/cart" && cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">{cartCount}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </StoreContext.Provider>
  );
}
