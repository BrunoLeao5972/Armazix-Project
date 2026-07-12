import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ConfiguracaoVitrine,
  type StoreProduct,
  type StorePublicData,
  formatPrice,
} from "@/lib/store-context";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { CategoriesSection } from "@/components/storefront/CategoriesSection";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductDetailModal } from "@/components/storefront/ProductDetailModal";
import { StorefrontSidebar } from "@/components/storefront/StorefrontSidebar";
import { type StoreCategory } from "@/lib/store-context";

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
  obs?: string;
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

  // ── Filtros ──────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [selectedAnalyticId, setSelectedAnalyticId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  // Accordion state for the mobile drawer
  const [drawerOpenSections, setDrawerOpenSections] = useState<Set<string>>(new Set());

  // ── Carrinho ─────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderDone, setOrderDone] = useState(false);

  // ── Carregar loja ────────────────────────────────────────────────
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
    const currentStoreId = store.id;
    async function loadData() {
      setDataLoading(true);
      setDataError(null);
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch(`/api/products/list?storeId=${encodeURIComponent(currentStoreId)}&scope=public`),
          fetch(`/api/categories/list?storeId=${encodeURIComponent(currentStoreId)}&scope=public`),
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

  // ── Vitrine config ───────────────────────────────────────────────
  const configuracaoVitrine = useMemo<ConfiguracaoVitrine>(
    () => ({
      lojaId: store?.id || "",
      logoUrl: store?.logoUrl || "",
      bannerUrl: store?.bannerUrl || "",
      corPrimaria: store?.primaryColor || "#00C853",
      corFundo: store?.backgroundColor || "#ffffff",
      corTextos: store?.textColor || "#0f172a",
      exibirPreco: store?.showPrice !== false,
      pedidoWhatsapp: store?.whatsappOrderEnabled === true,
      telefoneWhatsapp:
        (store?.whatsappPhone || store?.phone || "").replace(/\D/g, "") || undefined,
      destacarEstoqueBaixo: store?.highlightLowStock === true,
    }),
    [
      store?.backgroundColor, store?.bannerUrl, store?.banners,
      store?.highlightLowStock, store?.id, store?.logoUrl, store?.phone,
      store?.primaryColor, store?.showPrice, store?.textColor,
      store?.whatsappOrderEnabled, store?.whatsappPhone,
    ]
  );

  const themeStyle = useMemo(
    () =>
      ({
        "--cor-primaria": configuracaoVitrine.corPrimaria,
        "--cor-fundo": configuracaoVitrine.corFundo,
        "--cor-texto": configuracaoVitrine.corTextos,
      }) as React.CSSProperties,
    [configuracaoVitrine.corFundo, configuracaoVitrine.corPrimaria, configuracaoVitrine.corTextos]
  );

  const primaryColor = configuracaoVitrine.corPrimaria;

  // ── Carrinho derived ─────────────────────────────────────────────
  const cartCount = cart.reduce((acc, i) => acc + i.qty, 0);
  const cartSubtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);

  // ── Categorias derived ───────────────────────────────────────────
  const analyticCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.parentId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [categories]
  );

  const analyticChildren = useMemo(
    () =>
      selectedAnalyticId
        ? categories
            .filter((c) => c.active !== false && c.parentId === selectedAnalyticId)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [],
    [selectedAnalyticId, categories]
  );

  const selectedAnalyticName = selectedAnalyticId
    ? categories.find((c) => c.id === selectedAnalyticId)?.name
    : null;
  const selectedChildName = selectedChildId
    ? categories.find((c) => c.id === selectedChildId)?.name
    : null;

  // ── Display modes ────────────────────────────────────────────────
  // State 1: Todos (no category, no search) → seções por analítica
  const inTodosMode = !selectedAnalyticId && !selectedChildId && !query.trim();
  // State 2: qualquer filtro ativo → grade única (pai + filhos + sub-pills)

  // ── useMemos de produtos ─────────────────────────────────────────

  // Estado 1: uma seção por analítica, max 8 produtos
  const todosSections = useMemo(() => {
    const minP = priceMin ? parseFloat(priceMin) : null;
    const maxP = priceMax ? parseFloat(priceMax) : null;
    return analyticCategories
      .map((analytic) => {
        const children = categories.filter(
          (c) => c.active !== false && c.parentId === analytic.id
        );
        const childIds = children.map((c) => c.id);
        const sectionProds = products
          .filter(
            (p) => p.categoryId === analytic.id || childIds.includes(p.categoryId ?? "")
          )
          .filter((p) => {
            const price = parseFloat(p.price);
            if (minP !== null && price < minP) return false;
            if (maxP !== null && price > maxP) return false;
            return true;
          });
        return { analytic, children, products: sectionProds };
      })
      .filter((s) => s.products.length > 0);
  }, [analyticCategories, categories, products, priceMin, priceMax]);

  // Estado 2+3: grade única — pai + filhos (visibleProducts já inclui ambos)
  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minP = priceMin ? parseFloat(priceMin) : null;
    const maxP = priceMax ? parseFloat(priceMax) : null;
    return products
      .filter((p) => {
        if (selectedChildId) return p.categoryId === selectedChildId;
        if (selectedAnalyticId) {
          const childIds = categories
            .filter((c) => c.active !== false && c.parentId === selectedAnalyticId)
            .map((c) => c.id);
          return p.categoryId === selectedAnalyticId || childIds.includes(p.categoryId ?? "");
        }
        return true;
      })
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .filter((p) => {
        const price = parseFloat(p.price);
        if (minP !== null && price < minP) return false;
        if (maxP !== null && price > maxP) return false;
        return true;
      });
  }, [selectedAnalyticId, selectedChildId, categories, products, query, priceMin, priceMax]);

  const hasActiveFilters = !!(selectedAnalyticId || selectedChildId || priceMin || priceMax || query.trim());

  // ── Ações ────────────────────────────────────────────────────────
  const clearFilters = () => {
    setSelectedAnalyticId(null);
    setSelectedChildId(null);
    setPriceMin("");
    setPriceMax("");
    setQuery("");
    setFilterDrawerOpen(false);
  };

  const selectAnalytic = (id: string | null) => {
    setSelectedAnalyticId(id);
    setSelectedChildId(null);
  };

  const selectChild = (childId: string | null) => {
    setSelectedChildId(childId);
  };

  const openFilterDrawer = () => {
    setDrawerOpenSections(selectedAnalyticId ? new Set([selectedAnalyticId]) : new Set());
    setFilterDrawerOpen(true);
  };

  const toggleDrawerSection = (id: string) => {
    setDrawerOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Cart ─────────────────────────────────────────────────────────
  const addToCart = (product: StoreProduct, obs?: string) => {
    const price = parseFloat(product.price);
    setCart((prev) => {
      if (obs) {
        return [...prev, { id: product.id, name: product.name, price, qty: 1, imageUrl: product.imageUrl, emoji: product.emoji, obs }];
      }
      const existing = prev.find((i) => i.id === product.id && !i.obs);
      if (existing)
        return prev.map((i) => i.id === product.id && !i.obs ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price, qty: 1, imageUrl: product.imageUrl, emoji: product.emoji }];
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
      ...cart.flatMap((i) => {
        const base = `${i.qty}x ${i.name}`;
        const priceStr = configuracaoVitrine.exibirPreco ? ` — R$ ${formatPrice(i.price)}` : "";
        const obsStr = i.obs ? `   ↳ ${i.obs}` : null;
        return obsStr ? [`${base}${priceStr}`, obsStr] : [`${base}${priceStr}`];
      }),
      "",
      configuracaoVitrine.exibirPreco
        ? `Subtotal: R$ ${formatPrice(cartSubtotal)}`
        : "Valores: sob consulta",
    ];
    const text = lines.filter(Boolean).join("\n");
    window.open(
      `https://wa.me/${configuracaoVitrine.telefoneWhatsapp}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const goToCheckout = () => {
    if (cart.length === 0) return;
    setOrderDone(false);
    setOrderError(null);
    setShowCheckout(true);
  };

  const submitOrder = async () => {
    if (!store?.id || cart.length === 0) return;
    setOrderLoading(true);
    setOrderError(null);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim() || undefined,
          items: cart.map((i) => ({
            productId: i.id, name: i.name, qty: i.qty, price: i.price, notes: i.obs || undefined,
          })),
          subtotal: cartSubtotal,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao finalizar pedido");
      setOrderDone(true);
      setCart([]);
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : "Erro ao finalizar pedido");
    } finally {
      setOrderLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const renderCard = (product: StoreProduct) => (
    <ProductCard
      key={product.id}
      product={product}
      showPrice={configuracaoVitrine.exibirPreco}
      highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
      onAdd={() => addToCart(product)}
      onOpenDetail={() => setSelectedProduct(product)}
      primaryColor={primaryColor}
    />
  );

  const emptyState = (text: string, sub?: string) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-16 text-center">
      <Store className="mx-auto w-10 h-10 text-slate-300 mb-3" />
      <p className="text-sm font-semibold text-slate-700">{text}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );

  const skeletonGrid = (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
          <Skeleton className="aspect-square" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full mt-3 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );

  // ── Loading / Error ──────────────────────────────────────────────
  if (storeLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Store className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-semibold">{storeError}</p>
          <p className="text-xs text-slate-500">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────
  return (
    <div
      style={themeStyle}
      className="min-h-screen bg-[var(--cor-fundo)] text-[var(--cor-texto)]"
    >
      <StorefrontHeader
        storeName={store?.name || "Loja"}
        storeInitials={
          store?.name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "LOJA"
        }
        onSearch={setQuery}
        cartCount={cartCount}
        cartItems={cart}
        config={configuracaoVitrine}
        onRemoveFromCart={removeFromCart}
        onQtyChange={setQty}
        cartSubtotal={cartSubtotal}
        onSendToWhatsApp={sendToWhatsApp}
        onGoToCheckout={goToCheckout}
      />

      <main className="max-w-7xl mx-auto pb-24 lg:pb-10">
        {/* Banner */}
        <HeroCarousel
          banners={
            store?.banners?.length
              ? store.banners
              : configuracaoVitrine.bannerUrl
                ? [{ imageUrl: configuracaoVitrine.bannerUrl }]
                : []
          }
          storeName={store?.name}
          slideIntervalMs={store?.bannerIntervalMs ?? 5000}
        />

        {/* Layout flex: sidebar + conteúdo */}
        <div className="flex items-start gap-6 px-4 mt-6">

          {/* ── Desktop Sidebar ──────────────────────────────────── */}
          <aside className="hidden lg:block sticky top-4 w-56 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <StorefrontSidebar
              categories={categories}
              selectedAnalyticId={selectedAnalyticId}
              priceMin={priceMin}
              priceMax={priceMax}
              showPriceFilter={configuracaoVitrine.exibirPreco}
              primaryColor={primaryColor}
              onAnalyticChange={selectAnalytic}
              onPriceMinChange={setPriceMin}
              onPriceMaxChange={setPriceMax}
              onClearFilters={clearFilters}
            />
          </aside>

          {/* ── Conteúdo principal ──────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* ── Mobile: busca + carrossel analíticas ── */}
            <div className="lg:hidden space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-11 rounded-full bg-slate-100 px-4 pr-10 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <CategoriesSection
                categories={categories}
                selectedAnalyticId={selectedAnalyticId}
                selectedChildId={selectedChildId}
                onAnalyticChange={selectAnalytic}
                onChildChange={selectChild}
                primaryColor={primaryColor}
              />
            </div>

            {/* ── Barra de controles mobile ── */}
            <div className="lg:hidden flex items-center gap-2 flex-wrap">
              <button
                onClick={openFilterDrawer}
                className="flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors"
                style={
                  hasActiveFilters
                    ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" }
                    : { backgroundColor: "white", borderColor: "rgb(226, 232, 240)", color: "rgb(71, 85, 105)" }
                }
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filtrar
              </button>

              {/* Chips de filtros ativos */}
              {selectedAnalyticName && !selectedChildId && (
                <span className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                  {selectedAnalyticName}
                  <button onClick={() => selectAnalytic(null)}>
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                </span>
              )}
              {selectedChildName && (
                <span className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                  {selectedChildName}
                  <button onClick={() => setSelectedChildId(null)}>
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                </span>
              )}
              {(priceMin || priceMax) && (
                <span className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                  R$ {priceMin || "0"} – {priceMax || "∞"}
                  <button onClick={() => { setPriceMin(""); setPriceMax(""); }}>
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                </span>
              )}
            </div>

            {/* ── Breadcrumb (quando filtro ativo) ── */}
            {!inTodosMode && (
              <div className="flex items-center justify-between">
                <nav className="flex items-center gap-1 text-sm text-slate-500 flex-wrap">
                  <button
                    onClick={clearFilters}
                    className="hover:text-[var(--cor-texto)] transition-colors font-medium"
                  >
                    Todos
                  </button>
                  {selectedAnalyticName && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        onClick={() => setSelectedChildId(null)}
                        className={`hover:text-[var(--cor-texto)] transition-colors font-medium ${
                          !selectedChildId ? "text-[var(--cor-texto)]" : ""
                        }`}
                      >
                        {selectedAnalyticName}
                      </button>
                    </>
                  )}
                  {selectedChildName && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[var(--cor-texto)] font-semibold">{selectedChildName}</span>
                    </>
                  )}
                  {query.trim() && !selectedAnalyticId && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[var(--cor-texto)] font-semibold">"{query.trim()}"</span>
                    </>
                  )}
                </nav>
                {!inTodosMode && (
                  <span className="text-xs text-slate-400 shrink-0 ml-2">
                    {visibleProducts.length} produto{visibleProducts.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            {/* ── Erro de dados ── */}
            {dataError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {dataError}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                ESTADOS DE EXIBIÇÃO
            ══════════════════════════════════════════════════════ */}
            {dataLoading ? (
              skeletonGrid

            ) : inTodosMode ? (
              /* ── Estado 1: Todos — uma seção por analítica ── */
              todosSections.length === 0
                ? emptyState("Nenhum produto cadastrado ainda", "Os produtos aparecerão aqui quando forem adicionados.")
                : (
                  <div className="space-y-10">
                    {todosSections.map(({ analytic, products: sectionProds }) => (
                      <section key={analytic.id}>
                        {/* Header da seção */}
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-base font-bold text-[var(--cor-texto)] flex items-center gap-2">
                            {analytic.emoji && (
                              <span className="text-xl leading-none">{analytic.emoji}</span>
                            )}
                            {analytic.name}
                            <span className="text-slate-400 text-sm font-normal">
                              ({sectionProds.length})
                            </span>
                          </h2>
                          <button
                            onClick={() => selectAnalytic(analytic.id)}
                            className="text-xs font-semibold flex items-center gap-0.5 hover:underline shrink-0"
                            style={{ color: primaryColor }}
                          >
                            Ver todos
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Grid (máx 8 produtos) */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                          {sectionProds.slice(0, 8).map(renderCard)}
                        </div>
                      </section>
                    ))}
                  </div>
                )

            ) : (
              /* ── Estado 2+3: grade única — pai + todas as subcategorias ── */
              <div className="space-y-4">
                {/* Sub-pills de filtragem por subcategoria (desktop e mobile) */}
                {selectedAnalyticId && analyticChildren.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => selectChild(null)}
                      className="h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors"
                      style={
                        !selectedChildId
                          ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" }
                          : { backgroundColor: "white", borderColor: "rgb(203, 213, 225)", color: "rgb(71, 85, 105)" }
                      }
                    >
                      Todos
                    </button>
                    {analyticChildren.map((child) => {
                      const isActive = selectedChildId === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => selectChild(child.id)}
                          className="h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors"
                          style={
                            isActive
                              ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" }
                              : { backgroundColor: "white", borderColor: "rgb(203, 213, 225)", color: "rgb(71, 85, 105)" }
                          }
                        >
                          {child.emoji && !/^[a-z]/i.test(child.emoji) ? `${child.emoji} ` : ""}
                          {child.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {visibleProducts.length === 0
                  ? emptyState("Nenhum produto encontrado", "Tente ajustar a busca ou os filtros.")
                  : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                      {visibleProducts.map(renderCard)}
                    </div>
                  )
                }
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════════
          Mobile Filter Drawer (accordion de analíticas + preço)
      ══════════════════════════════════════════════════════════════ */}
      {filterDrawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setFilterDrawerOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <h2 className="text-base font-bold text-slate-800">Filtros</h2>
              </div>
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Departamentos com accordion */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Departamentos
                  </span>
                  {(selectedAnalyticId || selectedChildId) && (
                    <button
                      onClick={() => { selectAnalytic(null); }}
                      className="text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Limpar
                    </button>
                  )}
                </div>

                <ul className="space-y-px">
                  {/* Todos */}
                  <li>
                    <button
                      onClick={() => { selectAnalytic(null); setFilterDrawerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        !selectedAnalyticId ? "text-white" : "text-slate-700 hover:bg-slate-100"
                      }`}
                      style={!selectedAnalyticId ? { backgroundColor: primaryColor } : {}}
                    >
                      Todos os produtos
                    </button>
                  </li>

                  {analyticCategories.map((cat) => {
                    const isActive = selectedAnalyticId === cat.id;
                    const isOpen = drawerOpenSections.has(cat.id);
                    const children = categories.filter(
                      (c) => c.active !== false && c.parentId === cat.id
                    );
                    const hasChildren = children.length > 0;

                    return (
                      <li key={cat.id}>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => {
                              selectAnalytic(cat.id);
                              if (hasChildren)
                                setDrawerOpenSections((prev) => new Set([...prev, cat.id]));
                              if (!hasChildren) setFilterDrawerOpen(false);
                            }}
                            className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                              isActive && !selectedChildId
                                ? "text-white"
                                : "text-slate-700 hover:bg-slate-100"
                            }`}
                            style={isActive && !selectedChildId ? { backgroundColor: primaryColor } : {}}
                          >
                            {cat.emoji && !/^[a-z]/i.test(cat.emoji) && (
                              <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                            )}
                            <span className="flex-1 truncate">{cat.name}</span>
                          </button>

                          {hasChildren && (
                            <button
                              onClick={() => toggleDrawerSection(cat.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 transition-colors shrink-0"
                            >
                              {isOpen
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                        </div>

                        {/* Filhos no accordion */}
                        {hasChildren && isOpen && (
                          <ul className="ml-3 mt-0.5 pl-3 border-l-2 border-slate-100 space-y-px">
                            {children.map((child) => {
                              const isChildActive = selectedChildId === child.id && isActive;
                              return (
                                <li key={child.id}>
                                  <button
                                    onClick={() => {
                                      setSelectedAnalyticId(cat.id);
                                      setSelectedChildId(child.id);
                                      setFilterDrawerOpen(false);
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                      isChildActive
                                        ? "text-white"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                    }`}
                                    style={isChildActive ? { backgroundColor: primaryColor } : {}}
                                  >
                                    {child.emoji && !/^[a-z]/i.test(child.emoji) ? `${child.emoji} ` : ""}
                                    {child.name}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Faixa de Preço */}
              {configuracaoVitrine.exibirPreco && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
                    Faixa de Preço
                  </span>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 block mb-1.5">Mínimo</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">R$</span>
                        <input
                          type="number" min="0" placeholder="0" value={priceMin}
                          onChange={(e) => setPriceMin(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 pl-7 pr-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <span className="text-slate-300 text-lg pb-1.5">–</span>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 block mb-1.5">Máximo</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">R$</span>
                        <input
                          type="number" min="0" placeholder="∞" value={priceMax}
                          onChange={(e) => setPriceMax(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 pl-7 pr-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Ver produtos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WhatsApp bar ─────────────────────────────────────────────── */}
      {configuracaoVitrine.pedidoWhatsapp && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <button
              onClick={sendToWhatsApp}
              disabled={cart.length === 0 || !configuracaoVitrine.telefoneWhatsapp}
              className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Enviar pedido para WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de detalhe do produto ────────────────────────────── */}
      <ProductDetailModal
        product={selectedProduct}
        open={selectedProduct !== null}
        showPrice={configuracaoVitrine.exibirPreco}
        highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
        primaryColor={primaryColor}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(product, obs) => { addToCart(product, obs); setSelectedProduct(null); }}
      />

      {/* ── Modal de checkout ─────────────────────────────────────── */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Finalizar Pedido</h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {orderDone ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
                <p className="text-lg font-bold text-slate-900">Pedido realizado!</p>
                <p className="text-sm text-slate-500">Em breve entraremos em contato para confirmar.</p>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="mt-4 h-11 px-8 rounded-xl text-white font-semibold"
                  style={{ backgroundColor: primaryColor }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Resumo do pedido */}
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-slate-700">{item.qty}× {item.name}</span>
                      {configuracaoVitrine.exibirPreco && (
                        <span className="font-semibold text-slate-900">
                          R$ {formatPrice(item.price * item.qty)}
                        </span>
                      )}
                    </div>
                  ))}
                  {configuracaoVitrine.exibirPreco && (
                    <div className="flex items-center justify-between px-4 py-2.5 font-bold text-sm">
                      <span>Total</span>
                      <span>R$ {formatPrice(cartSubtotal)}</span>
                    </div>
                  )}
                </div>

                {/* Formulário */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Nome *</label>
                    <input
                      type="text" value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Telefone *</label>
                    <input
                      type="tel" value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {store?.deliveryEnabled === true && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Endereço de entrega</label>
                      <input
                        type="text" value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Rua, número, bairro..."
                        className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </div>
                  )}
                </div>

                {orderError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {orderError}
                  </div>
                )}

                <button
                  onClick={submitOrder}
                  disabled={orderLoading || !customerName.trim() || !customerPhone.trim()}
                  className="w-full h-11 rounded-xl text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {orderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Pedido"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
