import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Minus, Plus, Heart, Share2, Truck, Clock, Shield, ChevronLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useStore } from "../store";

export const Route = createFileRoute("/store/product/$productId")({
  component: ProductPage,
  head: () => ({
    meta: [{ title: "Produto — Mercado do Zé" }],
  }),
});

interface ProductData {
  id: string;
  name: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  emoji: string | null;
  badge: string | null;
  stock: number | null;
  active: boolean | null;
  categoryId: string | null;
}

function ProductPage() {
  const { productId } = Route.useParams();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToCart, favorites, toggleFavorite } = useStore();
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) {
      fetch(`/api/products/list?storeId=${storeId}`)
        .then(r => r.json())
        .then(d => {
          if (d.products) {
            const found = d.products.find((p: ProductData) => p.id === productId);
            setProduct(found || null);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <h2 className="text-lg font-bold">Produto não encontrado</h2>
        <Link to="/store" className="mt-4">
          <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">Voltar à loja</Button>
        </Link>
      </div>
    );
  }

  const price = parseFloat(product.price);
  const oldPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const emoji = product.emoji || "📦";
  const totalItem = price * qty;
  const isFavorite = favorites.includes(Number(productId));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="px-4 pt-3">
        <Link to="/store" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      <div className="mx-4 mt-3 h-56 sm:h-72 bg-secondary/20 rounded-3xl flex items-center justify-center relative">
        <span className="text-7xl sm:text-8xl">{emoji}</span>
        {product.badge && <Badge className="absolute top-3 left-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground border-0">{product.badge}</Badge>}
        {discount > 0 && <Badge className="absolute top-3 right-3 rounded-xl text-xs font-bold bg-red-500 text-white border-0">-{discount}%</Badge>}
      </div>

      <div className="px-4 mt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold mt-0.5">{product.name}</h1>
            {product.description && <p className="text-sm text-muted-foreground mt-1">{product.description}</p>}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => toggleFavorite(Number(productId))} className="w-9 h-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-secondary transition-colors">
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            </button>
            <button className="w-9 h-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-secondary transition-colors">
              <Share2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2 mt-3">
          <span className="text-2xl font-bold">R$ {price.toFixed(2).replace(".", ",")}</span>
          {oldPrice && <span className="text-sm text-muted-foreground line-through">R$ {oldPrice.toFixed(2).replace(".", ",")}</span>}
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"><Truck className="w-3 h-3" /> Frete grátis</div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-medium"><Clock className="w-3 h-3" /> 30-50 min</div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 text-xs font-medium"><Shield className="w-3 h-3" /> Garantia</div>
        </div>

        {product.stock !== null && product.stock !== undefined && (
          <div className="mt-4 text-sm text-muted-foreground">
            {product.stock > 0 ? `${product.stock} em estoque` : "Indisponível"}
          </div>
        )}

        <div className="mt-5">
          <h3 className="text-sm font-bold mb-2">Observação</h3>
          <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Sem cebola, ponto da carne..." className="w-full h-20 rounded-xl border border-border/50 bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      <div className="sticky bottom-16 lg:bottom-0 bg-surface/90 backdrop-blur-md border-t border-border/40 px-4 py-3 z-30">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 flex items-center justify-center text-sm font-medium hover:text-primary transition-colors"><Minus className="w-4 h-4" /></button>
            <span className="text-sm font-bold w-6 text-center">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="w-8 h-8 flex items-center justify-center text-sm font-medium hover:text-primary transition-colors"><Plus className="w-4 h-4" /></button>
          </div>
          <Button onClick={() => addToCart({ id: Number(productId), name: product.name, price, image: emoji })} className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform">
            Adicionar · R$ {totalItem.toFixed(2).replace(".", ",")}
          </Button>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
