import {
  UtensilsCrossed,
  ShoppingCart,
  Sparkles,
  Beef,
  Wine,
  Smartphone,
  Shirt,
  Flower2,
} from "lucide-react";

const categories = [
  { Icon: UtensilsCrossed, label: "Restaurantes" },
  { Icon: ShoppingCart, label: "Mercados" },
  { Icon: Sparkles, label: "Cosméticos" },
  { Icon: Beef, label: "Açougues" },
  { Icon: Wine, label: "Bebidas" },
  { Icon: Smartphone, label: "Tech" },
  { Icon: Shirt, label: "Moda" },
  { Icon: Flower2, label: "Floricultura" },
];

export function Categories() {
  return (
    <section id="categorias" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Feita para qualquer tipo de negócio
            </h2>
            <p className="text-muted-foreground mt-2">
              Organize seu catálogo e comece a vender em segundos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {categories.map((c) => (
            <div key={c.label}>
                <button className="group flex flex-col items-center gap-3 w-28">
                  <span className="grid place-items-center w-20 h-20 rounded-3xl bg-surface border border-border shadow-soft transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow group-hover:border-primary/30">
                    <c.Icon className="w-7 h-7 text-primary" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">
                    {c.label}
                  </span>
                </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
