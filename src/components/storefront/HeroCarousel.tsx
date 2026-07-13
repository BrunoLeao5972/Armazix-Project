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

  /**
   * Auto-advance timer.
   *
   * `current` está nas deps — isso reinicia o intervalo sempre que o slide
   * muda (manual OU automático). Garante que cada slide tenha exatamente
   * `slideIntervalMs` ms de exposição e elimina o "double-jump" quando o
   * usuário clica logo antes do timer disparar.
   *
   * Fluxo: timer dispara → setCurrent → render ��� cleanup → novo timer
   *        usuário clica → setCurrent → render → cleanup → novo timer (reset!)
   */
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(
      () => setCurrent((p) => (p + 1) % slides.length),
      slideIntervalMs,
    );
    return () => clearInterval(timer);
  }, [current, slides.length, slideIntervalMs]);

  if (!slides.length) return null;

  const prev = () => setCurrent((p) => (p - 1 + slides.length) % slides.length);
  const next = () => setCurrent((p) => (p + 1) % slides.length);
  const goTo = (idx: number) => setCurrent(idx);

  return (
    <section className="px-4 pt-4">
      {/* `group` habilita group-hover nas setas */}
      <div className="group relative w-full rounded-2xl overflow-hidden bg-slate-100 aspect-[16/5] md:aspect-[16/4]">

        {/* ── Slides ────────────────────────────────────────────── */}
        {slides.map((slide, idx) => (
          <img
            key={idx}
            src={slide.imageUrl!}
            alt={slide.title || storeName || "Banner"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
              idx === current ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />
        ))}

        {slides.length > 1 && (
          <>
            {/* ── Seta esquerda ─────────────────────────────────── */}
            {/*
              Mobile (< sm): sempre visível (touch não tem hover)
              Desktop (≥ sm): oculta, aparece no hover do container
            */}
            <button
              onClick={prev}
              aria-label="Banner anterior"
              className="
                absolute left-2 top-1/2 -translate-y-1/2 z-10
                flex items-center justify-center w-9 h-9 rounded-full
                bg-white/80 dark:bg-black/50 shadow-md
                hover:bg-white dark:hover:bg-black/70
                text-slate-700 dark:text-white
                transition-all duration-200
                opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                active:scale-95
              "
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* ── Seta direita ──────────────────────────────────── */}
            <button
              onClick={next}
              aria-label="Próximo banner"
              className="
                absolute right-2 top-1/2 -translate-y-1/2 z-10
                flex items-center justify-center w-9 h-9 rounded-full
                bg-white/80 dark:bg-black/50 shadow-md
                hover:bg-white dark:hover:bg-black/70
                text-slate-700 dark:text-white
                transition-all duration-200
                opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                active:scale-95
              "
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* ── Dots ──────────────────────────────────────────── */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  aria-label={`Banner ${idx + 1}`}
                  className={`rounded-full h-1.5 transition-all duration-300 ${
                    idx === current
                      ? "w-6 bg-white shadow"
                      : "w-1.5 bg-white/50 hover:bg-white/80"
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
