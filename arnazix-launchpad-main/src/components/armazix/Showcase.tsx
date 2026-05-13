import fashion from "@/assets/store-fashion.jpg";
import food from "@/assets/store-food.jpg";
import market from "@/assets/store-market.jpg";

const stores = [
  { img: fashion, title: "Moda Clean", tag: "Minimalista" },
  { img: food, title: "Gastronomia Dark", tag: "Premium" },
  { img: market, title: "Mercado Prático", tag: "Dia a dia" },
];

export function Showcase() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-sm font-semibold text-primary">Vitrines</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Como sua loja vai ficar.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Templates pensados para parecerem aplicativos nativos, direto no navegador.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stores.map((s) => (
            <article
              key={s.title}
              className="group rounded-4xl bg-surface border border-border shadow-soft overflow-hidden hover:shadow-ambient hover:-translate-y-1 transition-all duration-500"
            >
              <div className="aspect-[3/4] overflow-hidden bg-secondary">
                <img
                  src={s.img}
                  alt={s.title}
                  loading="lazy"
                  width={640}
                  height={960}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.tag}</p>
                </div>
                <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-accent-foreground">
                  Template
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
