import { useEffect, useState } from "react";

interface HeroCarouselProps {
  bannerUrl?: string;
  bannerMobileUrl?: string;
  storeName?: string;
}

export function HeroCarousel({ bannerUrl, bannerMobileUrl, storeName }: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { url: bannerMobileUrl || bannerUrl, label: "Banner 1" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!bannerUrl && !bannerMobileUrl) return null;

  return (
    <section className="px-4 pt-4">
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-100 aspect-video md:aspect-[16/6]">
        <picture>
          {bannerMobileUrl && (
            <source media="(max-width: 767px)" srcSet={bannerMobileUrl} />
          )}
          <img
            src={bannerUrl || bannerMobileUrl}
            alt={storeName || "Banner"}
            className="w-full h-full object-cover"
          />
        </picture>

        {/* Carousel Indicators (Bottom Right) */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all ${
                  idx === currentSlide
                    ? "w-6 h-1 bg-white"
                    : "w-2 h-1 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
