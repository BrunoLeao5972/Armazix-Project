import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type ConfiguracaoVitrine, type StoreCategory, type StoreProduct, type StorePublicData, formatPrice } from "@/lib/store-context";
import { Loader2, MessageCircle, Plus, Search, ShoppingBag, Store, X } from "lucide-react";

export const Route = createFileRoute("/loja/$slugOuId")({
  component: PublicStorefrontPage,
  head: () => ({
    meta: [{ title: "Loja — ARMAZIX" }],
  }),
});

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  imageUrl?: string | null;
  emoji?: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function PublicStorefrontPage() {
  const { slugOuId } = Route.useParams();

  const [store, setStore] = useState<StorePublicData | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  useEffect(() => {
    async function loadStore() {
      setStoreLoading(true);
      setStoreError(null);
      try {
        const qs = isUuid(slugOuId)
          ? `id=${encodeURIComponent(slugOuId)}`
          : `slug=${encodeURIComponent(slugOuId)}`;
        const res = await fetch(`/api/store/get?${qs}`);
        const data = (await res.json()) as { store?: StorePublicData; error?: string };
        if (!res.ok || !data.store) {
          setStoreError(data.error || "Loja não encontrada");
          setStore(null);
          return;
        }
        setStore(data.store);
        try {
          if (data.store?.id) localStorage.setItem("storeId", data.store.id);
          if (data.store?.slug) localStorage.setItem("storeSlug", data.store.slug);
        } catch {}
      } catch {
        setStoreError("Erro de conexão");
        setStore(null);
      } finally {
        setStoreLoading(false);
      }
    }
    loadStore();
  }, [slugOuId]);

  useEffect(() => {
    if (!store?.id) return;
    async function loadData() {
      setDataLoading(true);
      setDataError(null);
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch(`/api/products/list?storeId=${encodeURIComponent(store.id)}`),
          fetch(`/api/categories/list?storeId=${encodeURIComponent(store.id)}`),
        ]);
        const productsData = (await productsRes.json()) as { products?: StoreProduct[]; error?: string };
        const categoriesData = (await categoriesRes.json()) as { categories?: StoreCategory[]; error?: string };

        if (!productsRes.ok) throw new Error(productsData.error || "Erro ao carregar produtos");
        if (!categoriesRes.ok) throw new Error(categoriesData.error || "Erro ao carregar categorias");

        setProducts(Array.isArray(productsData.products) ? productsData.products : []);
        setCategories(Array.isArray(categoriesData.categories) ? categoriesData.categories : []);
      } catch (e) {
        setDataError(e instanceof Error ? e.message : "Erro ao carregar dados");
        setProducts([]);
        setCategories([]);
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, [store?.id]);

  const configuracaoVitrine = useMemo<ConfiguracaoVitrine>(() => {
    return {
      lojaId: store?.id || "",
      logoUrl: store?.logoUrl || "",
      bannerUrl: store?.bannerUrl || "",
      bannerMobileUrl: store?.bannerMobileUrl || "",
      corPrimaria: store?.primaryColor || "#00C853",
      corFundo: store?.backgroundColor || "#ffffff",
      corTextos: store?.textColor || "#0f172a",
      exibirPreco: store?.showPrice !== false,
      pedidoWhatsapp: store?.whatsappOrderEnabled === true,
      telefoneWhatsapp: (store?.whatsappPhone || store?.phone || "").replace(/\D/g, "") || undefined,
      destacarEstoqueBaixo: store?.highlightLowStock === true,
    };
  }, [
    store?.backgroundColor,
    store?.bannerMobileUrl,
    store?.bannerUrl,
    store?.highlightLowStock,
    store?.id,
    store?.logoUrl,
    store?.phone,
    store?.primaryColor,
    store?.showPrice,
    store?.textColor,
    store?.whatsappOrderEnabled,
    store?.whatsappPhone,
  ]);

  const themeStyle = useMemo(
    () =>
      ({
        "--cor-primaria": configuracaoVitrine.corPrimaria,
        "--cor-fundo": configuracaoVitrine.corFundo,
        "--cor-texto": configuracaoVitrine.corTextos,
      }) as React.CSSProperties,
    [configuracaoVitrine.corFundo, configuracaoVitrine.corPrimaria, configuracaoVitrine.corTextos]
  );

  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.active !== false)
      .filter((p) => (activeCategoryId ? p.categoryId === activeCategoryId : true))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [activeCategoryId, products, query]);

  const addToCart = (product: StoreProduct) => {
    const price = parseFloat(product.price);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price,
          qty: 1,
          imageUrl: product.imageUrl,
          emoji: product.emoji,
        },
      ];
    });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));
  const setQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  const sendToWhatsApp = () => {
    if (!configuracaoVitrine.pedidoWhatsapp || !configuracaoVitrine.telefoneWhatsapp) return;
    if (cart.length === 0) return;

    const lines = [
      `Pedido da vitrine: ${store?.name || "Loja"}`,
      "",
      customerName.trim() ? `Nome: ${customerName.trim()}` : null,
      customerAddress.trim() ? `Endereço: ${customerAddress.trim()}` : null,
      customerName.trim() || customerAddress.trim() ? "" : null,
      ...cart.map((i) => {
        const base = `${i.qty}x ${i.name}`;
        if (configuracaoVitrine.exibirPreco) return `${base} — R$ ${formatPrice(i.price)}`;
        return base;
      }),
      "",
      configuracaoVitrine.exibirPreco ? `Subtotal: R$ ${formatPrice(cartSubtotal)}` : "Valores: sob consulta",
    ];

    const text = lines.filter(Boolean).join("\n");
    const url = `https://wa.me/${configuracaoVitrine.telefoneWhatsapp}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const goToCheckout = () => {
    if (!store?.id) return;
    try {
      localStorage.setItem("storeCart", JSON.stringify(cart.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        image: i.imageUrl || null,
        emoji: i.emoji || null,
        qty: i.qty,
      }))));
      localStorage.setItem("storeId", store.id);
      localStorage.setItem("storeSlug", store.slug);
    } catch {}
    window.location.href = "/store/checkout";
  };

  if (storeLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--cor-primaria)]" />
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
            <Store className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">{storeError}</p>
          <p className="text-xs text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={themeStyle}
      className="min-h-screen bg-[var(--cor-fundo)] text-[var(--cor-texto)]"
    >
      <header className="sticky top-0 z-40 bg-[var(--cor-fundo)]/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {configuracaoVitrine.logoUrl ? (
              <img
                src={configuracaoVitrine.logoUrl}
                alt={store?.name || "Loja"}
                className="w-9 h-9 rounded-xl object-cover bg-slate-100"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <Store className="w-4.5 h-4.5 text-slate-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{store?.name || "Loja"}</p>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <button className="relative w-10 h-10 rounded-2xl bg-slate-50/50 border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-slate-600" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[var(--cor-primaria)] text-white text-[10px] font-bold grid place-items-center px-1">
                    {cartCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" style={{ color: "var(--cor-primaria)" }} />
                  Sacola
                  {cartCount > 0 && (
                    <Badge className="rounded-full bg-slate-900/5 text-slate-700 border-0">
                      {cartCount}
                    </Badge>
                  )}
                </SheetTitle>
              </SheetHeader>

              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-medium">Sua sacola está vazia</p>
                  <p className="text-xs text-muted-foreground">Adicione produtos para montar seu pedido</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-2xl bg-secondary/40 border border-border/50">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{item.emoji || "📦"}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {configuracaoVitrine.exibirPreco ? (
                          <p className="text-sm font-bold mt-0.5 text-[var(--cor-primaria)]">
                            R$ {formatPrice(item.price)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Sob consulta</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => setQty(item.id, item.qty - 1)}
                            className="w-8 h-8 rounded-xl border border-border/60 bg-background hover:bg-secondary transition-colors"
                          >
                            −
                          </button>
                          <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                          <button
                            onClick={() => setQty(item.id, item.qty + 1)}
                            className="w-8 h-8 rounded-xl border border-border/60 bg-background hover:bg-secondary transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-9 h-9 rounded-xl hover:bg-secondary/70 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="border-t border-border/50 pt-4 space-y-3">
                  {configuracaoVitrine.exibirPreco && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">R$ {formatPrice(cartSubtotal)}</span>
                    </div>
                  )}

                  {configuracaoVitrine.pedidoWhatsapp ? (
                    <div className="space-y-2">
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Seu nome"
                        className="h-11 rounded-xl"
                      />
                      <Input
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Seu endereço (opcional)"
                        className="h-11 rounded-xl"
                      />
                      <button
                        onClick={sendToWhatsApp}
                        disabled={cart.length === 0 || !configuracaoVitrine.telefoneWhatsapp}
                        className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar pedido para o WhatsApp
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={goToCheckout}
                      className="w-full h-12 rounded-2xl bg-[var(--cor-primaria)] text-white font-semibold transition-all active:scale-[0.99]"
                    >
                      Finalizar pedido
                    </button>
                  )}
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="max-w-5xl mx-auto pb-28 sm:pb-10 space-y-6">
        <section className="px-4 pt-4">
          {(configuracaoVitrine.bannerMobileUrl || configuracaoVitrine.bannerUrl) && (
            <div className="w-full rounded-xl md:rounded-2xl overflow-hidden">
              <picture>
                {configuracaoVitrine.bannerMobileUrl && (
                  <source media="(max-width: 767px)" srcSet={configuracaoVitrine.bannerMobileUrl} />
                )}
                <img
                  src={configuracaoVitrine.bannerUrl || configuracaoVitrine.bannerMobileUrl}
                  alt={store?.name || "Banner"}
                  className="w-full object-cover rounded-xl md:rounded-2xl aspect-[4/3] md:aspect-[64/15]"
                />
              </picture>
            </div>
          )}
        </section>

        <section className="px-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="h-12 rounded-2xl pl-9 bg-white/60 border-slate-200"
            />
          </div>

          {categories.length > 0 && (
            <div className="overflow-x-auto whitespace-nowrap no-scrollbar -mx-4 px-4">
              <div className="inline-flex gap-2 pb-1">
                <button
                  onClick={() => setActiveCategoryId(null)}
                  className={`h-10 px-4 rounded-full border text-sm font-semibold transition-colors ${
                    !activeCategoryId
                      ? "border-[var(--cor-primaria)] bg-[color-mix(in_oklab,var(--cor-primaria)_12%,transparent)]"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                  style={!activeCategoryId ? { color: "var(--cor-primaria)" } : undefined}
                >
                  Todos
                </button>
                {categories
                  .filter((c) => c.active !== false)
                  .map((cat) => {
                    const active = activeCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategoryId((prev) => (prev === cat.id ? null : cat.id))}
                        className={`h-10 px-4 rounded-full border text-sm font-semibold transition-colors ${
                          active
                            ? "border-[var(--cor-primaria)] bg-[color-mix(in_oklab,var(--cor-primaria)_12%,transparent)]"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                        }`}
                        style={active ? { color: "var(--cor-primaria)" } : undefined}
                      >
                        {cat.emoji ? `${cat.emoji} ` : ""}{cat.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </section>

        {dataError && (
          <div className="mx-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dataError}
          </div>
        )}

        <section className="space-y-3">
          <div className="px-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Produtos</h2>
            {dataLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
          </div>

          {dataLoading ? (
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4 lg:grid-cols-5 md:gap-6 md:p-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/50 bg-white/40 overflow-hidden">
                  <Skeleton className="aspect-square" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-9 w-10 rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="mx-4 rounded-2xl border border-border/50 bg-white/40 px-4 py-10 text-center">
              <p className="text-sm font-medium">Nenhum produto encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Tente ajustar a busca ou categoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4 lg:grid-cols-5 md:gap-6 md:p-6">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showPrice={configuracaoVitrine.exibirPreco}
                  highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
                  onAdd={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {configuracaoVitrine.pedidoWhatsapp && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <button
              onClick={sendToWhatsApp}
              disabled={cart.length === 0 || !configuracaoVitrine.telefoneWhatsapp}
              className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar pedido para o WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard(props: {
  product: StoreProduct;
  showPrice: boolean;
  highlightLowStock: boolean;
  onAdd: () => void;
}) {
  const { product, showPrice, highlightLowStock, onAdd } = props;

  const hasPromo =
    !!product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price);

  const lowStock =
    highlightLowStock &&
    typeof product.stock === "number" &&
    typeof product.lowStockThreshold === "number" &&
    product.stock <= product.lowStockThreshold;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 overflow-hidden">
      <div className="relative p-2">
        <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">{product.emoji || "📦"}</div>
          )}
        </div>

        {lowStock && (
          <Badge className="absolute top-3 left-3 rounded-full bg-amber-500/15 text-amber-700 border-0 text-[10px]">
            Últimas Unidades
          </Badge>
        )}
        {hasPromo && (
          <Badge className="absolute top-3 right-3 rounded-full bg-slate-900/5 text-slate-700 border-0 text-[10px]">
            Promo
          </Badge>
        )}
      </div>

      <div className="px-3 pb-3">
        <p className="text-sm font-medium line-clamp-2 mt-1 min-h-[2.5rem]">{product.name}</p>

        {showPrice ? (
          <p className="text-base font-bold text-[var(--cor-primaria)] mt-1.5">
            R$ {formatPrice(product.price)}
          </p>
        ) : (
          <p className="text-xs text-slate-500 mt-2">Sob Consulta</p>
        )}

        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={onAdd}
            className="w-10 h-10 rounded-full bg-[var(--cor-primaria)] text-white flex items-center justify-center active:scale-[0.98] transition-transform"
            aria-label="Adicionar"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
