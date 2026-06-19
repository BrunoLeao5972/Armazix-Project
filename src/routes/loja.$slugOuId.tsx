import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { type ConfiguracaoVitrine, type StoreCategory, type StoreProduct, type StorePublicData, formatPrice } from "@/lib/store-context";
import { CheckCircle2, Loader2, MessageCircle, Search, Store, X } from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { CategoriesSection } from "@/components/storefront/CategoriesSection";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductDetailModal } from "@/components/storefront/ProductDetailModal";

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

  const [query, setQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderDone, setOrderDone] = useState(false);

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
          fetch(`/api/products/list?storeId=${encodeURIComponent(currentStoreId)}`),
          fetch(`/api/categories/list?storeId=${encodeURIComponent(currentStoreId)}`),
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

  // IDs filhos da categoria pai selecionada (para filtro de visibleProducts)
  const activeParentChildIds = useMemo(() => {
    if (!activeCategoryId) return [];
    return categories
      .filter((c) => c.parentId === activeCategoryId)
      .map((c) => c.id);
  }, [activeCategoryId, categories]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.active !== false)
      .filter((p) => {
        if (activeSubcategoryId) return p.categoryId === activeSubcategoryId;
        if (activeCategoryId) {
          return (
            p.categoryId === activeCategoryId ||
            activeParentChildIds.includes(p.categoryId ?? "")
          );
        }
        return true;
      })
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [activeCategoryId, activeSubcategoryId, activeParentChildIds, products, query]);

  // Seções do modo "Todos": uma seção por categoria raiz (analíticas primeiro)
  const categorySections = useMemo(() => {
    const activeProds = products.filter((p) => p.active !== false);
    const activeCats = categories.filter((c) => c.active !== false);
    const roots = activeCats.filter((c) => !c.parentId);
    // Analíticas primeiro, depois não-analíticas, respeitando position dentro de cada grupo
    roots.sort((a, b) => {
      const aA = a.analytic === true ? 0 : 1;
      const bA = b.analytic === true ? 0 : 1;
      if (aA !== bA) return aA - bA;
      return (a.position ?? 0) - (b.position ?? 0);
    });
    return roots
      .map((cat) => {
        const children = activeCats.filter((c) => c.parentId === cat.id);
        const childIds = children.map((c) => c.id);
        const catProducts = activeProds.filter(
          (p) => p.categoryId === cat.id || childIds.includes(p.categoryId ?? "")
        );
        return { category: cat, children, products: catProducts };
      })
      .filter((s) => s.products.length > 0);
  }, [categories, products]);

  const addToCart = (product: StoreProduct, obs?: string) => {
    const price = parseFloat(product.price);
    setCart((prev) => {
      // Com observação → sempre adiciona como item separado
      if (obs) {
        return [
          ...prev,
          { id: product.id, name: product.name, price, qty: 1, imageUrl: product.imageUrl, emoji: product.emoji, obs },
        ];
      }
      const existing = prev.find((i) => i.id === product.id && !i.obs);
      if (existing) return prev.map((i) => (i.id === product.id && !i.obs ? { ...i, qty: i.qty + 1 } : i));
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
      configuracaoVitrine.exibirPreco ? `Subtotal: R$ ${formatPrice(cartSubtotal)}` : "Valores: sob consulta",
    ];

    const text = lines.filter(Boolean).join("\n");
    const url = `https://wa.me/${configuracaoVitrine.telefoneWhatsapp}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
            productId: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price,
            notes: i.obs || undefined,
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
      <StorefrontHeader
        storeName={store?.name || "Loja"}
        storeInitials={
          store?.name
            ?.split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 3) || "LOJA"
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

      <main className="max-w-7xl mx-auto pb-20 sm:pb-10 space-y-6">
        <HeroCarousel
          bannerUrl={configuracaoVitrine.bannerUrl}
          bannerMobileUrl={configuracaoVitrine.bannerMobileUrl}
          storeName={store?.name}
        />

        <div className="px-4 space-y-4">
          {/* Search on Mobile */}
          <div className="sm:hidden relative">
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
            activeCategoryId={activeCategoryId}
            activeSubcategoryId={activeSubcategoryId}
            onCategoryChange={(id) => {
              setActiveCategoryId(id);
              setActiveSubcategoryId(null);
            }}
            onSubcategoryChange={setActiveSubcategoryId}
            primaryColor={configuracaoVitrine.corPrimaria}
          />
        </div>

        {dataError && (
          <div className="mx-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dataError}
          </div>
        )}

        {/* ── Esqueleto de carregamento (igual nos dois modos) ── */}
        {dataLoading ? (
          <div className="grid grid-cols-2 gap-3 px-3 md:grid-cols-4 lg:grid-cols-5 md:gap-4 md:px-4">
            {Array.from({ length: 10 }).map((_, i) => (
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

        ) : !activeCategoryId && !activeSubcategoryId && !query.trim() ? (
          /* ── Modo "Todos": seções por categoria raiz ── */
          categorySections.length === 0 ? (
            <div className="mx-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-12 text-center">
              <Store className="mx-auto w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-900">Nenhum produto cadastrado ainda</p>
              <p className="text-xs text-slate-500 mt-1">Os produtos aparecerão aqui quando forem adicionados.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {categorySections.map(({ category, children, products: catProds }) => (
                <section key={category.id} className="space-y-3">
                  {/* Cabeçalho clicável */}
                  <button
                    onClick={() => {
                      setActiveCategoryId(category.id);
                      setActiveSubcategoryId(null);
                    }}
                    className="w-full px-4 flex items-center justify-between group"
                  >
                    <h2 className="text-lg font-bold text-[var(--cor-texto)] flex items-center gap-2">
                      {category.emoji && (
                        <span className="text-xl">{category.emoji}</span>
                      )}
                      {category.name}
                    </h2>
                    <span
                      className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: configuracaoVitrine.corPrimaria }}
                    >
                      {category.analytic && children.length > 0
                        ? `${children.length} categorias →`
                        : `${catProds.length} itens →`}
                    </span>
                  </button>

                  {/* Chips de sub-categorias (apenas para categorias analíticas com filhos) */}
                  {category.analytic === true && children.length > 0 && (
                    <div className="px-4 flex flex-wrap gap-2">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => {
                            setActiveCategoryId(category.id);
                            setActiveSubcategoryId(child.id);
                          }}
                          className="h-7 px-3 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-colors"
                        >
                          {child.emoji && !/^[a-z]/i.test(child.emoji)
                            ? `${child.emoji} `
                            : ""}
                          {child.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 px-3 md:grid-cols-4 lg:grid-cols-5 md:gap-4 md:px-4">
                    {catProds.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        showPrice={configuracaoVitrine.exibirPreco}
                        highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
                        onAdd={() => addToCart(product)}
                        onOpenDetail={() => setSelectedProduct(product)}
                        primaryColor={configuracaoVitrine.corPrimaria}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )

        ) : (
          /* ── Modo categoria/subcategoria/busca: grid único ── */
          <section className="space-y-3">
            <div className="px-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--cor-texto)]">
                {activeSubcategoryId
                  ? (categories.find((c) => c.id === activeSubcategoryId)?.name ?? "Produtos")
                  : activeCategoryId
                    ? (categories.find((c) => c.id === activeCategoryId)?.name ?? "Produtos")
                    : `Resultados para "${query.trim()}"`}
              </h2>
              <span className="text-sm text-slate-500">{visibleProducts.length} itens</span>
            </div>

            {visibleProducts.length === 0 ? (
              <div className="mx-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-12 text-center">
                <Store className="mx-auto w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-900">Nenhum produto encontrado</p>
                <p className="text-xs text-slate-500 mt-1">Tente ajustar a busca ou categoria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-3 md:grid-cols-4 lg:grid-cols-5 md:gap-4 md:px-4">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    showPrice={configuracaoVitrine.exibirPreco}
                    highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
                    onAdd={() => addToCart(product)}
                    onOpenDetail={() => setSelectedProduct(product)}
                    primaryColor={configuracaoVitrine.corPrimaria}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {configuracaoVitrine.pedidoWhatsapp && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <button
              onClick={sendToWhatsApp}
              disabled={cart.length === 0 || !configuracaoVitrine.telefoneWhatsapp}
              className="w-full h-12 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Enviar pedido para WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Modal de detalhe do produto */}
      <ProductDetailModal
        product={selectedProduct}
        open={selectedProduct !== null}
        showPrice={configuracaoVitrine.exibirPreco}
        highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
        primaryColor={configuracaoVitrine.corPrimaria}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(product, obs) => {
          addToCart(product, obs);
          setSelectedProduct(null);
        }}
      />

      {/* Modal de checkout público */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
            {/* Header do modal */}
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
              /* Estado de sucesso */
              <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
                <p className="text-lg font-bold text-slate-900">Pedido realizado!</p>
                <p className="text-sm text-slate-500">Em breve entraremos em contato para confirmar.</p>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="mt-4 h-11 px-8 rounded-lg text-white font-semibold"
                  style={{ backgroundColor: configuracaoVitrine.corPrimaria }}
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
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Telefone *</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {store?.deliveryEnabled === true && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Endereço de entrega</label>
                      <input
                        type="text"
                        value={customerAddress}
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
                  className="w-full h-11 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: configuracaoVitrine.corPrimaria }}
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
