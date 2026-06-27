import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Search,
  Layers,
  Plus,
  ShoppingBag,
  Heart,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "../store";
import { type StoreProduct, type StoreCategory, formatPrice } from "@/lib/store-context";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

function StoreHome() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { store, configuracaoVitrine, addToCart, toggleFavorite, favorites } = useStore();

  useEffect(() => {
    if (!store?.id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/products/list?storeId=${store.id}`).then(r => r.json()),
      fetch(`/api/categories/list?storeId=${store.id}`).then(r => r.json()),
    ]).then(([pd, cd]) => {
      if (pd.products) setProducts(pd.products);
      if (cd.categories) setCategories(cd.categories);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [store?.id]);

  // Coleta o ID selecionado + todos os descendentes (recursivo, qualquer profundidade)
  const getDescendantIds = (catId: string): string[] => {
    const children = categories.filter(c => c.active !== false && c.parentId === catId);
    return [catId, ...children.flatMap(c => getDescendantIds(c.id))];
  };
  const activeCategoryIds = activeCategoryId ? new Set(getDescendantIds(activeCategoryId)) : null;

  const activeProducts = products
    .filter((p) => p.active !== false)
    .filter((p) => (activeCategoryIds ? activeCategoryIds.has(p.categoryId ?? "") : true));

  const handleAdd = useCallback((product: StoreProduct) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
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

      {/* Categories */}
      <section className="px-3 md:px-6 mt-5">
        <h2 className="text-base md:text-lg font-bold mb-3">Categorias</h2>

        <div className="md:hidden overflow-x-auto whitespace-nowrap no-scrollbar">
          <div className="inline-flex gap-3 pb-1">
            <button
              onClick={() => setActiveCategoryId(null)}
              className="inline-flex flex-col items-center gap-1.5"
            >
              <span className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${!activeCategoryId ? "text-white" : "bg-slate-100 text-slate-700"}`} style={!activeCategoryId ? { backgroundColor: configuracaoVitrine.corPrimaria } : undefined}>
                <Layers className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-medium text-slate-700">Todos</span>
            </button>

            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="inline-flex flex-col items-center gap-1.5">
                    <Skeleton className="w-14 h-14 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))
              : categories.filter((c) => c.active !== false).map((cat) => {
                  const active = activeCategoryId === cat.id;
                  return (
                    <button key={cat.id} onClick={() => setActiveCategoryId((prev) => (prev === cat.id ? null : cat.id))} className="inline-flex flex-col items-center gap-1.5">
                      <span
                        className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border ${active ? "text-white" : "bg-slate-100 text-slate-700 border-slate-200"}`}
                        style={active ? { backgroundColor: configuracaoVitrine.corPrimaria, borderColor: configuracaoVitrine.corPrimaria } : undefined}
                      >
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-xl">{cat.emoji || "📦"}</span>
                        )}
                      </span>
                      <span className="text-[11px] font-medium text-slate-700 max-w-16 truncate">{cat.name}</span>
                    </button>
                  );
                })}
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setActiveCategoryId(null)}
            className={`h-11 rounded-xl text-sm font-medium border transition-colors ${!activeCategoryId ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-700"}`}
            style={!activeCategoryId ? { backgroundColor: configuracaoVitrine.corPrimaria } : undefined}
          >
            Todos
          </button>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)
            : categories.filter((c) => c.active !== false).map((cat) => {
                const active = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId((prev) => (prev === cat.id ? null : cat.id))}
                    className={`h-11 rounded-xl text-sm font-medium border transition-colors ${active ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                    style={active ? { backgroundColor: configuracaoVitrine.corPrimaria } : undefined}
                  >
                    {cat.name}
                  </button>
                );
              })}
        </div>
      </section>

      {/* All Products */}
      <section id="mais-vendidos" className="mt-5">
        <div className="px-3 md:px-6 flex items-center justify-between">
          <h2 className="text-base md:text-lg font-bold">Todos os produtos</h2>
          <span className="text-xs md:text-sm text-slate-500">{activeProducts.length} itens</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-6 md:p-6">
            {Array.from({ length: 10 }).map((_, i) => (
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
        ) : activeProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-6 md:p-6">
            {activeProducts.map((product) => (
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
        ) : (
          <div className="px-4 py-16 text-center" id="sobre-nos">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <h2 className="text-lg font-bold">Nenhum produto encontrado</h2>
            <p className="text-sm text-muted-foreground mt-1">Tente trocar a categoria para ver mais itens.</p>
          </div>
        )}
      </section>

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
  const price = parseFloat(product.price);
  const oldPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
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
    <Link to="/store/product/$productId" params={{ productId: product.id }} className="block group">
      <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all group-hover:shadow-md">
        {/* Image */}
        <div className="relative m-2 aspect-square bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
            : <span className="text-4xl sm:text-5xl">{product.emoji || "📦"}</span>
          }

          {lowStock && (
            <Badge className="absolute top-2 left-2 rounded-full bg-amber-500/15 text-amber-700 border-0 text-[10px]">
              Últimas unidades
            </Badge>
          )}

          {discount > 0 && (
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

        {/* Info */}
        <div className="p-3">
          <p className="text-sm md:text-base font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{product.description || "Produto disponível"}</p>

          {product.rating && Number(product.rating) > 0 && (
            <div className="flex items-center gap-0.5 mt-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] text-slate-500">{product.rating} ({product.reviewCount || 0})</span>
            </div>
          )}

          <div className="flex items-end gap-2 mt-1.5">
            {showPrice ? (
              <>
                <span className="text-base md:text-lg font-bold" style={{ color: primaryColor }}>R$ {formatPrice(price)}</span>
                {oldPrice && <span className="text-xs text-slate-400 line-through">R$ {formatPrice(oldPrice)}</span>}
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-500">Sob consulta</span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
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
    </Link>
  );
}
