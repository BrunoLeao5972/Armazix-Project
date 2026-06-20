import { ChevronRight, X } from "lucide-react";
import { type StoreCategory } from "@/lib/store-context";

interface StorefrontSidebarProps {
  categories: StoreCategory[];
  selectedAnalyticId: string | null;
  priceMin: string;
  priceMax: string;
  showPriceFilter: boolean;
  primaryColor: string;
  onAnalyticChange: (id: string | null) => void;
  onPriceMinChange: (v: string) => void;
  onPriceMaxChange: (v: string) => void;
  onClearFilters: () => void;
}

export function StorefrontSidebar({
  categories,
  selectedAnalyticId,
  priceMin,
  priceMax,
  showPriceFilter,
  primaryColor,
  onAnalyticChange,
  onPriceMinChange,
  onPriceMaxChange,
  onClearFilters,
}: StorefrontSidebarProps) {
  const analytics = categories
    .filter((c) => c.active !== false && c.analytic === true)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const hasFilters = !!(selectedAnalyticId || priceMin || priceMax);

  return (
    <div className="space-y-6">
      {/* ── Departamentos ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Departamentos
          </span>
          {hasFilters && (
            <button
              onClick={onClearFilters}
              className="text-[11px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-0.5"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>

        <ul className="space-y-px">
          <li>
            <button
              onClick={() => onAnalyticChange(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                !selectedAnalyticId ? "text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
              style={!selectedAnalyticId ? { backgroundColor: primaryColor } : {}}
            >
              Todos os produtos
            </button>
          </li>

          {analytics.map((cat) => {
            const isActive = selectedAnalyticId === cat.id;
            return (
              <li key={cat.id}>
                <button
                  onClick={() => onAnalyticChange(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive ? "text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                  style={isActive ? { backgroundColor: primaryColor } : {}}
                >
                  {cat.emoji && !/^[a-z]/i.test(cat.emoji) && (
                    <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                  )}
                  <span className="flex-1 truncate">{cat.name}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 ${isActive ? "opacity-70" : "opacity-30"}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Faixa de Preço ── */}
      {showPriceFilter && (
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
            Faixa de Preço
          </span>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-1.5">Mínimo</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={priceMin}
                  onChange={(e) => onPriceMinChange(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 pl-7 pr-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                />
              </div>
            </div>
            <span className="text-slate-300 text-lg pb-1.5">–</span>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-1.5">Máximo</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="∞"
                  value={priceMax}
                  onChange={(e) => onPriceMaxChange(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 pl-7 pr-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
