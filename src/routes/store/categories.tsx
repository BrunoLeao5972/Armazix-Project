import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "../store";
import { type StoreProduct, type StoreCategory, formatPrice } from "@/lib/store-context";
import { getEffectivePrice } from "@/lib/promo-engine";
import { ProductCard } from "./index";

export const Route = createFileRoute("/store/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const { store, addToCart, favorites, toggleFavorite } = useStore();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!store?.id) return;
    Promise.all([
      fetch(`/api/categories/list?storeId=${store.id}`).then(r => r.json()),
      fetch(`/api/products/list?storeId=${store.id}`).then(r => r.json()),
    ]).then(([cd, pd]) => {
      if (cd.categories) setCategories(cd.categories);
      if (pd.products) setProducts(pd.products);
    }).catch(() => {});
  }, [store?.id]);

  const activeProducts = products.filter(p => p.active !== false);
  const displayed = selected
    ? activeProducts.filter(p => p.categoryId === selected)
    : activeProducts;

  const handleAdd = useCallback((product: StoreProduct) => {
    const { effectivePrice } = getEffectivePrice(product.price, product.promoConfig, "store");
    addToCart({ id: product.id, name: product.name, price: effectivePrice, image: product.imageUrl || null, emoji: product.emoji || "📦" });
  }, [addToCart]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold">Categorias</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Explore por categoria</p>
      </div>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <div className="px-4 flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
          <button
            onClick={() => setSelected(null)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selected === null ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelected(selected === cat.id ? null : cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selected === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              <span>{cat.emoji || "�"}</span>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {displayed.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum produto nessa categoria.</p>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
          {displayed.map(product => (
            <ProductCard key={product.id} product={product} onAdd={handleAdd}
              isFavorite={favorites.includes(product.id)} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}
