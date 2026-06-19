import {
  Smartphone,
  Laptop,
  Headphones,
  Watch,
  Zap,
  Package,
  ShoppingBag,
  LucideIcon,
} from "lucide-react";
import { type StoreCategory } from "@/lib/store-context";

interface CategoriesSectionProps {
  categories: StoreCategory[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  primaryColor: string;
}

const iconMap: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  laptop: Laptop,
  headphones: Headphones,
  watch: Watch,
  power: Zap,
  package: Package,
};

export function CategoriesSection({
  categories,
  activeCategoryId,
  onCategoryChange,
  primaryColor,
}: CategoriesSectionProps) {
  if (categories.length === 0) return null;

  return (
    <section className="px-4 space-y-3">
      <h2 className="text-base font-bold text-slate-900">Categorias</h2>

      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="flex gap-3 whitespace-nowrap">
          {/* "Todos" button */}
          <button
            onClick={() => onCategoryChange(null)}
            className="flex flex-col items-center gap-2 pb-2 transition-all"
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                activeCategoryId === null
                  ? "ring-2 ring-offset-2"
                  : "bg-slate-100"
              }`}
              style={{
                backgroundColor:
                  activeCategoryId === null ? primaryColor : "rgb(241, 245, 249)",
                color: activeCategoryId === null ? "white" : "rgb(100, 116, 139)",
                ringColor: primaryColor,
              }}
            >
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                activeCategoryId === null
                  ? "text-slate-900"
                  : "text-slate-600"
              }`}
              style={activeCategoryId === null ? { color: primaryColor } : undefined}
            >
              Todos
            </span>
          </button>

          {/* Category buttons */}
          {categories
            .filter((c) => c.active !== false)
            .map((category) => {
              const IconComponent = iconMap[category.emoji?.toLowerCase() || "package"] || Package;
              const isActive = activeCategoryId === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.id)}
                  className="flex flex-col items-center gap-2 pb-2 transition-all"
                >
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? "ring-2 ring-offset-2"
                        : "bg-slate-100"
                    }`}
                    style={{
                      backgroundColor: isActive ? primaryColor : "rgb(241, 245, 249)",
                      color: isActive ? "white" : "rgb(100, 116, 139)",
                      ringColor: primaryColor,
                    }}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-xs font-semibold text-center max-w-[60px] ${
                      isActive ? "text-slate-900" : "text-slate-600"
                    }`}
                    style={isActive ? { color: primaryColor } : undefined}
                  >
                    {category.name}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </section>
  );
}
