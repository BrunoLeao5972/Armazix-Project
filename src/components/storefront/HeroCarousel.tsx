import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BannerSlide {
  imageUrl: string | null;
  title?: string | null;
}

interface HeroCarouselProps {
  banners: BannerSlide[];
  storeName?: string;
  slideIntervalMs?: number;
}

export function HeroCarousel({ banners, storeName, slideIntervalMs = 5000 }: HeroCarouselProps) {
  const slides = banners.filter((b) => !!b.imageUrl);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setCurrent((p) => (p + 1) % slides.length), slideIntervalMs);
    return () => clearInterval(timer);
  }, [slides.length, slideIntervalMs]);

  if (!slides.length) return null;

  const prev = () => setCurrent((p) => (p - 1 + slides.length) % slides.length);
  const next = () => setCurrent((p) => (p + 1) % slides.length);

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
          <>
            {/* Seta esquerda */}
            <button
              onClick={prev}
              aria-label="Banner anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Seta direita */}
            <button
              onClick={next}
              aria-label="Próximo banner"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots */}
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
          </>
        )}
      </div>
    </section>
  );
}
