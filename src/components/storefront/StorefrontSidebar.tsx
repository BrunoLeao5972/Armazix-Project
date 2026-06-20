import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { type StoreCategory } from "@/lib/store-context";

interface StorefrontSidebarProps {
  categories: StoreCategory[];
  activeCategoryId: string | null;
  activeSubcategoryId: string | null;
  priceMin: string;
  priceMax: string;
  showPriceFilter: boolean;
  primaryColor: string;
  onCategoryChange: (id: string | null) => void;
  onSubcategoryChange: (id: string | null) => void;
  onPriceMinChange: (v: string) => void;
  onPriceMaxChange: (v: string) => void;
  onClearFilters: () => void;
}

export function StorefrontSidebar({
  categories,
  activeCategoryId,
  activeSubcategoryId,
  priceMin,
  priceMax,
  showPriceFilter,
  primaryColor,
  onCategoryChange,
  onSubcategoryChange,
  onPriceMinChange,
  onPriceMaxChange,
  onClearFilters,
}: StorefrontSidebarProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => (activeCategoryId ? new Set([activeCategoryId]) : new Set())
  );

  useEffect(() => {
    if (activeCategoryId) {
      setOpenSections((prev) => {
        if (prev.has(activeCategoryId)) return prev;
        return new Set([...prev, activeCategoryId]);
      });
    }
  }, [activeCategoryId]);

  const rootCategories = categories.filter((c) => c.active !== false && !c.parentId);
  const hasActiveFilters = !!(activeCategoryId || activeSubcategoryId || priceMin || priceMax);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Categorias ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Categorias
          </span>
          {hasActiveFilters && (
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
          {/* "Todos os produtos" */}
          <li>
            <button
              onClick={() => { onCategoryChange(null); onSubcategoryChange(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                !activeCategoryId ? "text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
              style={!activeCategoryId ? { backgroundColor: primaryColor } : {}}
            >
              Todos os produtos
            </button>
          </li>

          {rootCategories.map((cat) => {
            const children = categories.filter(
              (c) => c.active !== false && c.parentId === cat.id
            );
            const hasChildren = children.length > 0;
            const isActive = activeCategoryId === cat.id;
            const isOpen = openSections.has(cat.id);

            return (
              <li key={cat.id}>
                {/* Category row */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      onCategoryChange(cat.id);
                      onSubcategoryChange(null);
                      if (hasChildren) {
                        setOpenSections((prev) => new Set([...prev, cat.id]));
                      }
                    }}
                    className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      isActive && !activeSubcategoryId
                        ? "text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    style={
                      isActive && !activeSubcategoryId
                        ? { backgroundColor: primaryColor }
                        : {}
                    }
                  >
                    {cat.emoji && !/^[a-z]/i.test(cat.emoji) && (
                      <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                    )}
                    <span className="flex-1 truncate">{cat.name}</span>
                  </button>

                  {hasChildren && (
                    <button
                      onClick={() => toggleSection(cat.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Children accordion */}
                {hasChildren && isOpen && (
                  <ul className="ml-3 mt-0.5 pl-3 border-l-2 border-slate-100 space-y-px">
                    {children.map((child) => {
                      const isChildActive = activeSubcategoryId === child.id;
                      return (
                        <li key={child.id}>
                          <button
                            onClick={() => {
                              onCategoryChange(cat.id);
                              onSubcategoryChange(child.id);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              isChildActive
                                ? "text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                            }`}
                            style={isChildActive ? { backgroundColor: primaryColor } : {}}
                          >
                            {child.emoji && !/^[a-z]/i.test(child.emoji)
                              ? `${child.emoji} `
                              : ""}
                            {child.name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
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
