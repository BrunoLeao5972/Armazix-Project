import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Minus, Plus, Heart, Share2, Truck, Clock, Shield, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useStore } from "../store";

export const Route = createFileRoute("/store/product/$productId")({
  component: ProductPage,
  head: () => ({
    meta: [{ title: "Produto — Mercado do Zé" }],
  }),
});

const PRODUCT: Record<string, {
  name: string; desc: string; price: number; oldPrice: number | null; image: string; rating: number; reviews: number; badge: string | null; category: string; stock: number; details: string[]; additions: { name: string; price: number }[];
}> = {
  "1": { name: "Arroz Tio João 5kg", desc: "Tipo 1 premium, grãos selecionados com qualidade garantida", price: 32.90, oldPrice: 39.90, image: "🍚", rating: 4.8, reviews: 234, badge: "Mais vendido", category: "Mercado", stock: 50, details: ["Tipo 1 premium", "Grãos selecionados", "5kg rendimento extra", "Qualidade Tio João"], additions: [{ name: "Feijão Carioca 1kg", price: 8.90 }, { name: "Azeite 500ml", price: 24.90 }] },
  "2": { name: "Feijão Carioca 1kg", desc: "Seleção especial de grãos", price: 8.90, oldPrice: null, image: "🫘", rating: 4.6, reviews: 128, badge: null, category: "Mercado", stock: 35, details: ["Grãos selecionados", "Cozimento rápido", "1kg"], additions: [] },
  "3": { name: "Café Pilão 500g", desc: "Extra forte moído, sabor intenso", price: 18.90, oldPrice: 22.90, image: "☕", rating: 4.9, reviews: 412, badge: "Oferta", category: "Mercado", stock: 28, details: ["Extra forte", "Moído na hora", "500g", "Torra média-escura"], additions: [{ name: "Açúcar 1kg", price: 4.90 }] },
  "4": { name: "Hambúrguer Artesanal", desc: "180g angus premium com queijo", price: 28.90, oldPrice: 34.90, image: "🍔", rating: 4.9, reviews: 320, badge: "🔥 Top", category: "Lanches", stock: 15, details: ["180g angus premium", "Queijo cheddar", "Pão brioche artesanal", "Molho especial da casa"], additions: [{ name: "Batata frita", price: 12.90 }, { name: "Refrigerante 350ml", price: 6.90 }] },
  "5": { name: "Pão Francês Kg", desc: "Fresquinho todo dia", price: 12.90, oldPrice: null, image: "🥖", rating: 4.7, reviews: 156, badge: "Fresquinho", category: "Padaria", stock: 20, details: ["Fresco todo dia", "Casca crocante", "Miolo macio"], additions: [] },
  "6": { name: "Açaí 500ml", desc: "Puro sem mistura, direto do Pará", price: 22.90, oldPrice: null, image: "🫐", rating: 4.8, reviews: 198, badge: null, category: "Bebidas", stock: 25, details: ["Puro sem mistura", "500ml", "Direto do Pará", "Sem conservantes"], additions: [{ name: "Granola", price: 3.90 }, { name: "Banana", price: 2.50 }] },
};

const REVIEWS = [
  { name: "Maria S.", rating: 5, text: "Excelente qualidade! Entrega rápida e produto muito bom.", date: "2 dias atrás" },
  { name: "João P.", rating: 4, text: "Muito bom, recomendo. Chegou antes do prazo.", date: "1 semana atrás" },
  { name: "Ana L.", rating: 5, text: "Melhor da categoria! Compro sempre aqui.", date: "2 semanas atrás" },
];

function ProductPage() {
  const { productId } = Route.useParams();
  const product = PRODUCT[productId] || PRODUCT["1"];
  const { addToCart, favorites, toggleFavorite } = useStore();
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");
  const [selectedAdditions, setSelectedAdditions] = useState<number[]>([]);

  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const additionsTotal = selectedAdditions.reduce((a, i) => a + product.additions[i]?.price || 0, 0);
  const totalItem = (product.price + additionsTotal) * qty;

  const isFavorite = favorites.includes(Number(productId));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Back button */}
      <div className="px-4 pt-3">
        <Link to="/store" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>
      </div>

      {/* Product Image */}
      <div className="mx-4 mt-3 h-56 sm:h-72 bg-secondary/20 rounded-3xl flex items-center justify-center relative">
        <span className="text-7xl sm:text-8xl">{product.image}</span>
        {product.badge && (
          <Badge className="absolute top-3 left-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground border-0">
            {product.badge}
          </Badge>
        )}
        {discount > 0 && (
          <Badge className="absolute top-3 right-3 rounded-xl text-xs font-bold bg-red-500 text-white border-0">
            -{discount}%
          </Badge>
        )}
      </div>

      {/* Product Info */}
      <div className="px-4 mt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{product.category}</p>
            <h1 className="text-xl font-bold mt-0.5">{product.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{product.desc}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => toggleFavorite(Number(productId))}
              className="w-9 h-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            </button>
            <button className="w-9 h-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-secondary transition-colors">
              <Share2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`w-4 h-4 ${s <= Math.round(product.rating) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
            ))}
          </div>
          <span className="text-sm font-semibold">{product.rating}</span>
          <span className="text-xs text-muted-foreground">({product.reviews} avaliações)</span>
        </div>

        {/* Price */}
        <div className="flex items-end gap-2 mt-3">
          <span className="text-2xl font-bold">R$ {product.price.toFixed(2).replace(".", ",")}</span>
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground line-through">R$ {product.oldPrice.toFixed(2).replace(".", ",")}</span>
          )}
        </div>

        {/* Info badges */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Truck className="w-3 h-3" /> Frete grátis
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-medium">
            <Clock className="w-3 h-3" /> 30-50 min
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 text-xs font-medium">
            <Shield className="w-3 h-3" /> Garantia
          </div>
        </div>

        {/* Details */}
        <div className="mt-5">
          <h3 className="text-sm font-bold mb-2">Detalhes</h3>
          <ul className="space-y-1.5">
            {product.details.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>

        {/* Additions */}
        {product.additions.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-bold mb-2">Adicionais</h3>
            <div className="space-y-2">
              {product.additions.map((add, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAdditions((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i])}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    selectedAdditions.includes(i) ? "border-primary bg-primary/5" : "border-border/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                      selectedAdditions.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border"
                    }`}>
                      {selectedAdditions.includes(i) ? "✓" : ""}
                    </div>
                    <span className="text-sm font-medium">{add.name}</span>
                  </div>
                  <span className="text-sm font-semibold">+ R$ {add.price.toFixed(2).replace(".", ",")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Observation */}
        <div className="mt-5">
          <h3 className="text-sm font-bold mb-2">Observação</h3>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex: Sem cebola, ponto da carne..."
            className="w-full h-20 rounded-xl border border-border/50 bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Reviews */}
        <div className="mt-5">
          <h3 className="text-sm font-bold mb-3">Avaliações</h3>
          <div className="space-y-3">
            {REVIEWS.map((review, i) => (
              <div key={i} className="p-3 rounded-xl bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                      {review.name[0]}
                    </div>
                    <span className="text-sm font-medium">{review.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{review.date}</span>
                </div>
                <div className="flex gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Add to Cart Bar */}
      <div className="sticky bottom-16 lg:bottom-0 bg-surface/90 backdrop-blur-md border-t border-border/40 px-4 py-3 z-30">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 flex items-center justify-center text-sm font-medium hover:text-primary transition-colors">
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold w-6 text-center">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="w-8 h-8 flex items-center justify-center text-sm font-medium hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <Button
            onClick={() => addToCart({ id: Number(productId), name: product.name, price: product.price + additionsTotal, image: product.image })}
            className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform"
          >
            Adicionar · R$ {totalItem.toFixed(2).replace(".", ",")}
          </Button>
        </div>
      </div>

      {/* Spacer for bottom bar */}
      <div className="h-4" />
    </div>
  );
}
