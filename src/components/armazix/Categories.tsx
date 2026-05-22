import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  UtensilsCrossed,
  ShoppingCart,
  Sparkles,
  Beef,
  Wine,
  Smartphone,
  Shirt,
  Flower2,
  Coffee,
  Pizza,
  Cake,
  Scissors,
  Dog,
  Dumbbell,
  BookOpen,
  Wrench,
  Baby,
  Bike,
  Leaf,
  IceCream,
} from "lucide-react";

const categories = [
  { Icon: UtensilsCrossed, label: "Restaurantes" },
  { Icon: Pizza,           label: "Pizzarias" },
  { Icon: Coffee,          label: "Cafeterias" },
  { Icon: IceCream,        label: "Sorveterias" },
  { Icon: Cake,            label: "Confeitarias" },
  { Icon: Beef,            label: "Açougues" },
  { Icon: Wine,            label: "Bebidas" },
  { Icon: ShoppingCart,    label: "Mercados" },
  { Icon: Leaf,            label: "Hortifruti" },
  { Icon: Sparkles,        label: "Cosméticos" },
  { Icon: Scissors,        label: "Barbearias" },
  { Icon: Shirt,           label: "Moda" },
  { Icon: Baby,            label: "Infantil" },
  { Icon: Smartphone,      label: "Tech" },
  { Icon: Wrench,          label: "Serviços" },
  { Icon: Dumbbell,        label: "Fitness" },
  { Icon: Dog,             label: "Pet Shop" },
  { Icon: BookOpen,        label: "Papelaria" },
  { Icon: Flower2,         label: "Floricultura" },
  { Icon: Bike,            label: "Delivery" },
];

const ITEM_WIDTH = 112;
const SCROLL_AMOUNT = ITEM_WIDTH * 3;

export function Categories() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    trackRef.current?.scrollBy({ left: dir === "right" ? SCROLL_AMOUNT : -SCROLL_AMOUNT, behavior: "smooth" });
  };

  return (
    <section id="categorias" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Feita para qualquer tipo de negócio
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Organize seu catálogo e comece a vender em segundos.
          </p>
        </div>

        <div className="relative pt-2">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-background to-transparent" />

          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-9 h-9 rounded-full bg-surface border border-border shadow-soft hover:shadow-glow hover:border-primary/30 transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-foreground/70" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-9 h-9 rounded-full bg-surface border border-border shadow-soft hover:shadow-glow hover:border-primary/30 transition-all"
          >
            <ChevronRight className="w-4 h-4 text-foreground/70" />
          </button>

          <div
            ref={trackRef}
            className="overflow-x-auto px-10 py-3"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div className="flex gap-4 w-max">
              {categories.map((c) => (
                <button
                  key={c.label}
                  className="group flex flex-col items-center gap-2.5 w-24 sm:w-28 flex-shrink-0"
                >
                  <span className="grid place-items-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-surface border border-border shadow-soft transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow group-hover:border-primary/30">
                    <c.Icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary" strokeWidth={1.75} />
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-foreground/80 group-hover:text-foreground text-center leading-tight">
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}`}</style>
    </section>
  );
}
