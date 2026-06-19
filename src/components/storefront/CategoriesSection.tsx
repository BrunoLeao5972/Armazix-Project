import {
  Smartphone,
  Laptop,
  Headphones,
  Watch,
  Zap,
  Package,
  ShoppingBag,
  Shirt,
  Utensils,
  Dumbbell,
  Baby,
  Car,
  Flower2,
  Home,
  Layers,
  LucideIcon,
} from "lucide-react";
import { type StoreCategory } from "@/lib/store-context";

interface CategoriesSectionProps {
  categories: StoreCategory[];
  activeCategoryId: string | null;
  activeSubcategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  onSubcategoryChange: (subcategoryId: string | null) => void;
  primaryColor: string;
}

function getIconForEmoji(emoji?: string | null): LucideIcon {
  if (!emoji) return Package;
  const e = emoji.trim();
  // Emoji real → ícone
  if (e === "📱" || e === "🤳") return Smartphone;
  if (e === "💻" || e === "🖥️" || e === "🖥") return Laptop;
  if (e === "🎧" || e === "🎵" || e === "🔊" || e === "🎶") return Headphones;
  if (e === "⌚" || e === "🕐") return Watch;
  if (e === "⚡" || e === "🔌") return Zap;
  if (e === "🛍️" || e === "🛒") return ShoppingBag;
  if (e === "👕" || e === "👗" || e === "👔" || e === "🧥") return Shirt;
  if (e === "🍔" || e === "🍕" || e === "🍽️" || e === "🥗") return Utensils;
  if (e === "💪" || e === "🏋️" || e === "⚽") return Dumbbell;
  if (e === "👶" || e === "🍼" || e === "🧸") return Baby;
  if (e === "🚗" || e === "🏎️" || e === "🔧") return Car;
  if (e === "🌸" || e === "🌺" || e === "🌼") return Flower2;
  if (e === "🏠" || e === "🛋️" || e === "🪴") return Home;
  // Texto em inglês (fallback legado)
  const lower = e.toLowerCase();
  if (lower === "smartphone" || lower === "phone" || lower === "mobile") return Smartphone;
  if (lower === "laptop" || lower === "computer" || lower === "desktop") return Laptop;
  if (lower === "headphones" || lower === "audio" || lower === "music") return Headphones;
  if (lower === "watch" || lower === "wearable") return Watch;
  if (lower === "power" || lower === "zap" || lower === "electric") return Zap;
  if (lower === "clothes" || lower === "fashion" || lower === "shirt") return Shirt;
  if (lower === "food" || lower === "kitchen" || lower === "restaurant") return Utensils;
  if (lower === "sports" || lower === "gym" || lower === "fitness") return Dumbbell;
  if (lower === "baby" || lower === "kids" || lower === "children") return Baby;
  if (lower === "car" || lower === "auto" || lower === "vehicle") return Car;
  if (lower === "home" || lower === "furniture" || lower === "house") return Home;
  return Package;
}

export function CategoriesSection({
  categories,
  activeCategoryId,
  activeSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  primaryColor,
}: CategoriesSectionProps) {
  // Apenas categorias raiz (sem pai) aparecem no carrossel principal
  const rootCategories = categories.filter((c) => c.active !== false && !c.parentId);

  // Filhos da categoria pai selecionada
  const subcategories = activeCategoryId
    ? categories.filter((c) => c.active !== false && c.parentId === activeCategoryId)
    : [];

  if (rootCategories.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Nível 1 — categorias raiz com ícone circular */}
      <div className="px-4">
        <h2 className="text-base font-bold text-[var(--cor-texto)]">Categorias</h2>
      </div>

      <div className="overflow-x-auto -mx-0 px-4 pb-1">
        <div className="flex gap-3 whitespace-nowrap">
          {/* Botão "Todos" */}
          <button
            onClick={() => { onCategoryChange(null); onSubcategoryChange(null); }}
            className="flex flex-col items-center gap-2 pb-2 transition-all"
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                activeCategoryId === null ? "ring-2 ring-offset-2" : ""
              }`}
              style={{
                backgroundColor:
                  activeCategoryId === null ? primaryColor : "rgb(241, 245, 249)",
                color: activeCategoryId === null ? "white" : "rgb(100, 116, 139)",
                ...(activeCategoryId === null
                  ? ({ "--tw-ring-color": primaryColor } as React.CSSProperties)
                  : {}),
              }}
            >
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span
              className="text-xs font-semibold whitespace-nowrap"
              style={
                activeCategoryId === null
                  ? { color: primaryColor }
                  : { color: "rgb(71, 85, 105)" }
              }
            >
              Todos
            </span>
          </button>

          {/* Categorias raiz */}
          {rootCategories.map((category) => {
            const isAnalytic = category.analytic === true;
            const IconComponent = isAnalytic ? Layers : getIconForEmoji(category.emoji);
            const isActive = activeCategoryId === category.id;

            return (
              <button
                key={category.id}
                onClick={() => {
                  onCategoryChange(category.id);
                  onSubcategoryChange(null);
                }}
                className="flex flex-col items-center gap-2 pb-2 transition-all"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    isActive ? "ring-2 ring-offset-2" : ""
                  }`}
                  style={{
                    backgroundColor: isActive
                      ? primaryColor
                      : isAnalytic
                        ? "rgb(226, 232, 240)"
                        : "rgb(241, 245, 249)",
                    color: isActive ? "white" : "rgb(100, 116, 139)",
                    ...(isActive
                      ? ({ "--tw-ring-color": primaryColor } as React.CSSProperties)
                      : {}),
                  }}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                <span
                  className="text-xs font-semibold text-center max-w-[60px] whitespace-normal leading-tight"
                  style={
                    isActive
                      ? { color: primaryColor }
                      : { color: "rgb(71, 85, 105)" }
                  }
                >
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nível 2 — subcategorias como pílulas de texto */}
      {subcategories.length > 0 && (
        <div className="overflow-x-auto px-4 pb-1">
          <div className="flex gap-2 whitespace-nowrap">
            {/* Pílula "Todos em [pai]" */}
            <button
              onClick={() => onSubcategoryChange(null)}
              className="h-7 px-3 rounded-full text-xs font-semibold border transition-all"
              style={
                activeSubcategoryId === null
                  ? {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                      color: "white",
                    }
                  : {
                      backgroundColor: "white",
                      borderColor: "rgb(203, 213, 225)",
                      color: "rgb(71, 85, 105)",
                    }
              }
            >
              Todos
            </button>

            {subcategories.map((sub) => {
              const isActiveSub = activeSubcategoryId === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => onSubcategoryChange(sub.id)}
                  className="h-7 px-3 rounded-full text-xs font-semibold border transition-all"
                  style={
                    isActiveSub
                      ? {
                          backgroundColor: primaryColor,
                          borderColor: primaryColor,
                          color: "white",
                        }
                      : {
                          backgroundColor: "white",
                          borderColor: "rgb(203, 213, 225)",
                          color: "rgb(71, 85, 105)",
                        }
                  }
                >
                  {sub.emoji && !sub.emoji.match(/^[a-z]/i) ? `${sub.emoji} ` : ""}
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
