import { useEffect, useState } from "react";

interface BannerSlide {
  imageUrl: string | null;
  title?: string | null;
}

interface HeroCarouselProps {
  banners: BannerSlide[];
  storeName?: string;
}

export function HeroCarousel({ banners, storeName }: HeroCarouselProps) {
  const slides = banners.filter((b) => !!b.imageUrl);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setCurrent((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <section className="px-4 pt-4">
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-100 aspect-[16/5] md:aspect-[16/4]">
        {slides.map((slide, idx) => (
          <img
            key={idx}
            src={slide.imageUrl!}
            alt={slide.title || storeName || "Banner"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              idx === current ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />
        ))}

        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                aria-label={`Banner ${idx + 1}`}
                className={`rounded-full h-1.5 transition-all ${
                  idx === current ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
