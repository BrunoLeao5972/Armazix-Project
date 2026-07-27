import { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useCustomerFavoriteProducts } from "@/lib/customer-profile-hooks";
import { ProductCard } from "@/routes/store/index";
import { getEffectivePrice } from "@/lib/promo-engine";
import type { CartItem, ConfiguracaoVitrine, StoreProduct } from "@/lib/store-context";

export function FavoritesView({
  token, configuracaoVitrine, addToCart, toggleFavorite,
}: {
  token: string | null;
  configuracaoVitrine: ConfiguracaoVitrine;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  toggleFavorite: (id: string) => void;
}) {
  const { products: fetched, loading } = useCustomerFavoriteProducts(token);
  const [products, setProducts] = useState<StoreProduct[]>([]);

  useEffect(() => { setProducts(fetched); }, [fetched]);

  const handleAdd = (product: StoreProduct) => {
    const { effectivePrice } = getEffectivePrice(product.price, product.promoConfig, "store");
    addToCart({
      id: product.id, name: product.name, price: effectivePrice,
      image: product.imageUrl || null, emoji: product.emoji || "📦",
    });
  };

  const handleToggle = (id: string) => {
    toggleFavorite(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
        <Heart className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Nenhum favorito ainda</p>
        <p className="text-xs text-muted-foreground">Toque no coração de um produto para salvá-lo aqui</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-1">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onAdd={handleAdd}
          isFavorite
          onToggleFavorite={handleToggle}
          showPrice={configuracaoVitrine.exibirPreco}
          highlightLowStock={configuracaoVitrine.destacarEstoqueBaixo}
          primaryColor={configuracaoVitrine.corPrimaria}
        />
      ))}
    </div>
  );
}
