import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Search,
  Layers,
  Plus,
  ShoppingBag,
  Heart,
  Star,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "../store";
import { type StoreProduct, type StoreCategory, formatPrice } from "@/lib/store-context";
import { getEffectivePrice } from "@/lib/promo-engine";
import { CategoryIcon } from "@/lib/category-icons";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

const PAGE_LIMIT = 20;
const SECTION_LIMIT = 10; // max products shown per category in "Todos" mode

// Pura — calcula IDs de categoria + todos os descendentes para filtro server-side
function getDescendantIds(catId: string, cats: StoreCategory[]): string[] {
  const children = cats.filter(c => c.active !== false && c.parentId === catId);
  return [catId, ...children.flatMap(c => getDescendantIds(c.id, cats))];
}

function StoreHome() {
  const [products, setProducts]             = useState<StoreProduct[]>([]);
  const [total, setTotal]                   = useState(0);
  const [hasMore, setHasMore]               = useState(false);
  const [offset, setOffset]                 = useState(0);
  const [categories, setCategories]         = useState<StoreCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId]     = useState<string | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [loadingMore, setLoadingMore]       = useState(false);
  const { store, configuracaoVitrine, addToCart, toggleFavorite, favorites } = useStore();

  // Ref mantém o filtro ativo para uso no handleLoadMore sem re-criar o callback
  const activeFilterRef = useRef<string[] | null>(null);

  const fetchProducts = useCallback(async (
    storeId: string,
    filterIds: string[] | null,
    startOffset: number,
    append: boolean,
  ) => {
    // "Todos" mode: fetch all products at once for client-side grouping
    const limit = filterIds === null ? 500 : PAGE_LIMIT;
    const params = new URLSearchParams({
      storeId,
      scope:  "public",
      limit:  String(limit),
      offset: String(startOffset),
    });
    if (filterIds?.length) params.set("categoryIds", filterIds.join(","));

    append ? setLoadingMore(true) : setLoading(true);

    try {
      const data = await fetch(`/api/products/list?${params}`).then(r => r.json()) as {
        products?: StoreProduct[];
        total?: number;
        hasMore?: boolean;
      };
      if (data.products) {
        setProducts(prev => append ? [...prev, ...data.products!] : data.products!);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOffset(startOffset + data.products.length);
      }
    } catch {
      // falha silenciosa — estado permanece o anterior
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []); // estável — sem deps externas

  // ── Categorias: carregamento único, projeção mínima (sem N+1) ────
  useEffect(() => {
    if (!store?.id) return;
    fetch(`/api/categories/list?storeId=${store.id}&scope=public`)
      .then(r => r.json())
      .then((cd: { categories?: StoreCategory[] }) => {
        if (cd.categories) setCategories(cd.categories);
      })
      .catch(() => {});
  }, [store?.id]);

  // ── Produtos: re-fetch quando loja ou categoria ativa muda ───────
  // `categories` e `fetchProducts` omitidos das deps intencionalmente:
  //   - fetchProducts é estável (useCallback sem deps)
  //   - categories está carregado antes do usuário conseguir clicar em categoria
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!store?.id) return;
    const filterById = activeSubCategoryId ?? activeCategoryId;
    const filterIds  = filterById ? getDescendantIds(filterById, categories) : null;
    activeFilterRef.current = filterIds;
    fetchProducts(store.id, filterIds, 0, false);
  }, [store?.id, activeCategoryId, activeSubCategoryId]);

  const handleLoadMore = () => {
    if (!store?.id || loadingMore || !hasMore) return;
    fetchProducts(store.id, activeFilterRef.current, offset, true);
  };

  const handleCategorySelect = (catId: string | null) => {
    setActiveCategoryId(catId);
    setActiveSubCategoryId(null);
  };

  // Nível 1: apenas categorias raiz (sem parentId)
  const rootCategories = categories
    .filter(c => c.active !== false && !c.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Nível 2: filhas da categoria pai ativa
  const subCategories = activeCategoryId
    ? categories
        .filter(c => c.active !== false && c.parentId === activeCategoryId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];

  // Resolve a root-category ID for any product (traces parentId chain up)
  const getRootCategoryId = useCallback((catId: string | null): string | null => {
    if (!catId) return null;
    let current = categories.find(c => c.id === catId);
    while (current?.parentId) {
      current = categories.find(c => c.id === current!.parentId);
    }
    return current?.id ?? null;
  }, [categories]);

  // Grouped sections for "Todos" mode — memoized to avoid re-grouping on each render
  const categorySections = useMemo(() => {
    if (activeCategoryId !== null) return null;
    if (loading) return null;

    const productsByRootCat = new Map<string, StoreProduct[]>();
    for (const p of products) {
      const rootId = getRootCategoryId(p.categoryId);
      if (!rootId) continue; // skip uncategorised for now
      if (!productsByRootCat.has(rootId)) productsByRootCat.set(rootId, []);
      productsByRootCat.get(rootId)!.push(p);
    }

    return rootCategories
      .filter(cat => (productsByRootCat.get(cat.id)?.length ?? 0) > 0)
      .map(cat => ({ category: cat, products: productsByRootCat.get(cat.id)! }));
  }, [activeCategoryId, loading, products, rootCategories, getRootCategoryId]);

  const handleAdd = useCallback((product: StoreProduct) => {
    const { effectivePrice } = getEffectivePrice(product.price, product.promoConfig, "store");
    addToCart({
      id:    product.id,
      name:  product.name,
      price: effectivePrice,
      image: product.imageUrl || null,
      emoji: product.emoji || "📦",
    });
  }, [addToCart]);

  return (
    <div className="pb-6 animate-in fade-in duration-300">
      {/* Hero Banner */}
      {(store?.banners?.length || store?.bannerUrl) && (
        <section className="px-3 md:px-6 pt-3 md:pt-5">
          <div className="w-full rounded-2xl overflow-hidden bg-slate-100 aspect-[16/5]">
            <img
              src={store?.banners?.[0]?.imageUrl || store?.bannerUrl || ""}
              alt={store?.name || "Banner da loja"}
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      )}

      {/* Categories — dois níveis dinâmicos */}
      <section className="px-3 md:px-6 mt-5 space-y-3">
        <h2 className="text-base md:text-lg font-bold">Categorias</h2>

        {/* ── Nível 1: categorias raiz ─────────────────────────────── */}

        {/* Mobile: círculos horizontais */}
        <div className="md:hidden overflow-x-auto whitespace-nowrap no-scrollbar">
          <div className="inline-flex gap-3 pb-1">
            <button
              onClick={() => handleCategorySelect(null)}
              className="inline-flex flex-col items-center gap-1.5"
            >
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm transition-colors"
                style={!activeCategoryId ? { backgroundColor: configuracaoVitrine.corPrimaria, color: "white" } : { backgroundColor: "rgb(241 245 249)", color: "rgb(51 65 85)" }}
              >
                <Layers className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-medium text-slate-700">Todos</span>
            </button>

            {categories.length === 0 && loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="inline-flex flex-col items-center gap-1.5">
                    <Skeleton className="w-14 h-14 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))
              : rootCategories.map((cat) => {
                  const isActive = activeCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(isActive ? null : cat.id)}
                      className="inline-flex flex-col items-center gap-1.5"
                    >
                      <span
                        className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border transition-colors"
                        style={isActive
                          ? { backgroundColor: configuracaoVitrine.corPrimaria, borderColor: configuracaoVitrine.corPrimaria, color: "white" }
                          : { backgroundColor: "rgb(241 245 249)", borderColor: "rgb(226 232 240)", color: "rgb(51 65 85)" }}
                      >
                        {cat.imageUrl
                          ? <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-contain" />
                          : cat.icon
                            ? <CategoryIcon name={cat.icon} className="w-6 h-6" />
                            : <span className="text-xl">{cat.emoji || "📦"}</span>}
                      </span>
                      <span className="text-[11px] font-medium text-slate-700 max-w-[60px] text-center whitespace-normal leading-tight">{cat.name}</span>
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Desktop: pílulas em linha */}
        <div className="hidden md:flex flex-wrap gap-2">
          <button
            onClick={() => handleCategorySelect(null)}
            className="h-10 px-4 rounded-xl text-sm font-medium border transition-colors"
            style={!activeCategoryId
              ? { backgroundColor: configuracaoVitrine.corPrimaria, borderColor: "transparent", color: "white" }
              : { backgroundColor: "white", borderColor: "rgb(226 232 240)", color: "rgb(51 65 85)" }}
          >
            Todos
          </button>
          {categories.length === 0 && loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-24 rounded-xl" />)
            : rootCategories.map((cat) => {
                const isActive = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(isActive ? null : cat.id)}
                    className="h-10 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-slate-50 inline-flex items-center gap-2"
                    style={isActive
                      ? { backgroundColor: configuracaoVitrine.corPrimaria, borderColor: "transparent", color: "white" }
                      : { backgroundColor: "white", borderColor: "rgb(226 232 240)", color: "rgb(51 65 85)" }}
                  >
                    {cat.icon
                      ? <CategoryIcon name={cat.icon} className="w-4 h-4 shrink-0" />
                      : cat.emoji && !/^[a-z]/i.test(cat.emoji) && <span>{cat.emoji}</span>}
                    {cat.name}
                  </button>
                );
              })}
        </div>

        {/* ── Nível 2: subcategorias ────────────────────────────────── */}
        {subCategories.length > 0 && (
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-2 whitespace-nowrap">
              {subCategories.map((sub) => {
                const isActiveSub = activeSubCategoryId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubCategoryId(isActiveSub ? null : sub.id)}
                    className="h-8 px-3 rounded-full text-xs font-medium border transition-colors"
                    style={isActiveSub
                      ? { backgroundColor: configuracaoVitrine.corPrimaria, borderColor: "transparent", color: "white" }
                      : { backgroundColor: "rgb(248 250 252)", borderColor: "rgb(226 232 240)", color: "rgb(71 85 105)" }}
                  >
                    {sub.emoji && !/^[a-z]/i.test(sub.emoji) ? `${sub.emoji} ` : ""}{sub.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Loading skeleton ─────────────────────────────────────── */}
      {loading && (
        <section className="mt-5 space-y-8">
          {[0, 1].map(s => (
            <div key={s}>
              <div className="px-3 md:px-6 flex items-center justify-between mb-3">
                <Skeleton className="h-6 w-36 rounded-xl" />
                <Skeleton className="h-4 w-20 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3 px-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-6 md:px-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <Skeleton className="aspect-square" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── "Todos" mode: grouped sections per category ──────────── */}
      {!loading && categorySections && (
        categorySections.length === 0 ? (
          <div className="px-4 py-16 text-center mt-5" id="sobre-nos">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <h2 className="text-lg font-bold">Nenhum produto encontrado</h2>
            <p className="text-sm text-muted-foreground mt-1">Esta loja ainda não possui produtos cadastrados.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-7 pb-4">
            {categorySections.map(({ category, products: catProds }) => (
              <section key={category.id}>
                {/* Section header */}
                <div className="px-3 md:px-6 flex items-center justify-between mb-4">
                  <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                    {category.icon
                      ? <CategoryIcon name={category.icon} className="w-5 h-5 shrink-0 text-slate-600" />
                      : category.emoji && !/^[a-z]/i.test(category.emoji) && (
                          <span className="text-xl leading-none">{category.emoji}</span>
                        )}
                    {category.name}
                  </h2>
                  {catProds.length > SECTION_LIMIT && (
                    <button
                      onClick={() => handleCategorySelect(category.id)}
                      className="flex items-center gap-0.5 text-xs font-semibold transition-opacity hover:opacity-70"
                      style={{ color: configuracaoVitrine.corPrimaria }}
                    >
                      Ver todos ({catProds.length})
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Mobile: horizontal scroll row */}
                <div className="md:hidden overflow-x-auto no-scrollbar">
                  <div className="flex gap-3 px-3 pb-1">
                    {catProds.slice(0, SECTION_LIMIT).map(p => (
                      <div key={p.id} className="w-44 shrink-0 flex">
                        <ProductCard
                          product={p}
                          onAdd={handleAdd}
                          isFavorite={favorites.includes(p.id)}
                          onToggleFavorite={toggleFavorite}
                          showPrice={configuracaoVitrine.exibirPreco}
                          highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
                          primaryColor={configuracaoVitrine.corPrimaria}
                        />
                      </div>
                    ))}
                    {catProds.length > SECTION_LIMIT && (
                      <div className="w-36 shrink-0 flex items-center justify-center">
                        <button
                          onClick={() => handleCategorySelect(category.id)}
                          className="flex flex-col items-center gap-2 text-xs font-semibold"
                          style={{ color: configuracaoVitrine.corPrimaria }}
                        >
                          <span
                            className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                            style={{ borderColor: configuracaoVitrine.corPrimaria }}
                          >
                            <ChevronRight className="w-5 h-5" />
                          </span>
                          Ver todos
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop: responsive grid */}
                <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 px-6">
                  {catProds.slice(0, SECTION_LIMIT).map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAdd={handleAdd}
                      isFavorite={favorites.includes(p.id)}
                      onToggleFavorite={toggleFavorite}
                      showPrice={configuracaoVitrine.exibirPreco}
                      highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
                      primaryColor={configuracaoVitrine.corPrimaria}
                    />
                  ))}
                </div>

                {/* Divider between sections */}
                <div className="mt-7 mx-3 md:mx-6 h-px bg-slate-100" />
              </section>
            ))}
          </div>
        )
      )}

      {/* ── Filtered mode: single category grid + pagination ─────── */}
      {!loading && !categorySections && (
        <section id="mais-vendidos" className="mt-5">
          <div className="px-3 md:px-6 flex items-center justify-between mb-4">
            <h2 className="text-base md:text-lg font-bold">
              {rootCategories.find(c => c.id === (activeSubCategoryId ?? activeCategoryId))?.name
                ?? "Produtos"}
            </h2>
            {total > 0 && (
              <span className="text-xs md:text-sm text-slate-500">{total} itens</span>
            )}
          </div>

          {products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 px-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-6 md:px-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={handleAdd}
                    isFavorite={favorites.includes(product.id)}
                    onToggleFavorite={toggleFavorite}
                    showPrice={configuracaoVitrine.exibirPreco}
                    highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
                    primaryColor={configuracaoVitrine.corPrimaria}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center px-4 pt-6 pb-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="h-11 px-8 rounded-xl text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {loadingMore ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Carregando...</>
                    ) : (
                      `Carregar mais (${total - products.length} restantes)`
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-16 text-center" id="sobre-nos">
              <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h2 className="text-lg font-bold">Nenhum produto encontrado</h2>
              <p className="text-sm text-muted-foreground mt-1">Tente trocar a categoria para ver mais itens.</p>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

export function ProductCard({
  product,
  onAdd,
  isFavorite,
  onToggleFavorite,
  showPrice,
  highlightLowStock,
  primaryColor,
}: {
  product: StoreProduct;
  onAdd: (p: StoreProduct) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  showPrice: boolean;
  highlightLowStock: boolean;
  primaryColor: string;
}) {
  const [added, setAdded] = useState(false);
  const promoResult = getEffectivePrice(product.price, product.promoConfig, "store");
  const price = promoResult.effectivePrice;
  const oldPrice = promoResult.promoActive
    ? promoResult.originalPrice
    : product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const discount = !promoResult.promoActive && oldPrice && oldPrice > price
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;
  const lowStock =
    highlightLowStock &&
    typeof product.stock === "number" &&
    typeof product.lowStockThreshold === "number" &&
    product.stock <= product.lowStockThreshold;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  return (
    <Link to="/store/product/$productId" params={{ productId: product.id }} className="block group h-full">
      <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all group-hover:shadow-md h-full flex flex-col">
        {/* Image */}
        <div className="relative m-2 aspect-square bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
            : <span className="text-4xl sm:text-5xl">{product.emoji || "📦"}</span>
          }

          {lowStock && (
            <Badge className="absolute top-2 left-2 rounded-full bg-amber-500/15 text-amber-700 border-0 text-[10px]">
              Últimas unidades
            </Badge>
          )}

          {promoResult.promoActive && (
            <Badge className="absolute bottom-2 left-2 rounded-full bg-violet-600 text-white border-0 text-[10px]">
              PROMO
            </Badge>
          )}
          {!promoResult.promoActive && discount > 0 && (
            <Badge className="absolute bottom-2 left-2 rounded-full bg-rose-600 text-white border-0 text-[10px]">
              -{discount}%
            </Badge>
          )}

          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(product.id); }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 flex items-center justify-center"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite ? "fill-rose-500 text-rose-500" : "text-slate-600"}`} />
          </button>
        </div>

        {/* Info — flex col so price/button are always pinned to bottom */}
        <div className="p-3 flex flex-col flex-1">
          {/* Top content */}
          <div>
            <p className="text-sm font-medium line-clamp-2 leading-snug min-h-[2.5rem]">{product.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{product.description || "Produto disponível"}</p>
            {/* Rating — fixed height slot so it never shifts the price row */}
            <div className="h-4 mt-1 flex items-center">
              {product.rating && Number(product.rating) > 0 && (
                <>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-[11px] text-slate-500 ml-0.5">{product.rating} ({product.reviewCount || 0})</span>
                </>
              )}
            </div>
          </div>

          {/* Bottom content — pushed to card bottom via mt-auto */}
          <div className="mt-auto pt-2">
            <div className="flex items-baseline gap-1.5">
              {showPrice ? (
                <>
                  <span
                    className="text-sm font-bold whitespace-nowrap"
                    style={{ color: promoResult.promoActive ? "#7c3aed" : primaryColor }}
                  >
                    R$ {formatPrice(price)}
                  </span>
                  {oldPrice !== null && (
                    <span className="text-xs text-slate-400 line-through whitespace-nowrap">
                      R$ {formatPrice(oldPrice)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-500">Sob consulta</span>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Ver opções</span>
              <button
                onClick={handleAdd}
                className="md:hidden w-8 h-8 rounded-full text-white flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
                aria-label="Adicionar"
              >
                <Plus className="w-4 h-4" />
              </button>
              <motion.button
                onClick={handleAdd}
                animate={added ? { scale: [1, 0.92, 1] } : {}}
                className="hidden md:flex h-9 px-4 rounded-xl text-xs font-semibold items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Adicionar à Sacola
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
