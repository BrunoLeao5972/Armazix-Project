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
  LucideIcon,
} from "lucide-react";
import { type StoreCategory } from "@/lib/store-context";

interface CategoriesSectionProps {
  categories: StoreCategory[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
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
                ...(activeCategoryId === null && { "--tw-ring-color": primaryColor } as React.CSSProperties),
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
              const IconComponent = getIconForEmoji(category.emoji);
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
                      ...(isActive && { "--tw-ring-color": primaryColor } as React.CSSProperties),
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
