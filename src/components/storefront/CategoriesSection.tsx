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
  selectedAnalyticId: string | null;
  selectedChildId: string | null;
  onAnalyticChange: (id: string | null) => void;
  onChildChange: (id: string | null) => void;
  primaryColor: string;
}

function getIconForEmoji(emoji?: string | null): LucideIcon {
  if (!emoji) return Package;
  const e = emoji.trim();
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
  selectedAnalyticId,
  selectedChildId,
  onAnalyticChange,
  onChildChange,
  primaryColor,
}: CategoriesSectionProps) {
  // Nível 1: categorias raiz (sem pai)
  const analyticCategories = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Nível 2: filhos da categoria raiz selecionada
  const subcategories = selectedAnalyticId
    ? categories.filter((c) => c.parentId === selectedAnalyticId)
    : [];

  if (analyticCategories.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Nível 1 — analíticas com ícone circular */}
      <div className="overflow-x-auto -mx-0 px-4 pb-1">
        <div className="flex gap-3 whitespace-nowrap">
          {/* Botão "Todos" */}
          <button
            onClick={() => { onAnalyticChange(null); onChildChange(null); }}
            className="flex flex-col items-center gap-2 pb-2 transition-all"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                selectedAnalyticId === null ? "ring-2 ring-offset-2" : ""
              }`}
              style={{
                backgroundColor:
                  selectedAnalyticId === null ? primaryColor : "rgb(241, 245, 249)",
                color: selectedAnalyticId === null ? "white" : "rgb(100, 116, 139)",
                ...(selectedAnalyticId === null
                  ? ({ "--tw-ring-color": primaryColor } as React.CSSProperties)
                  : {}),
              }}
            >
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span
              className="text-xs font-semibold whitespace-nowrap"
              style={
                selectedAnalyticId === null
                  ? { color: primaryColor }
                  : { color: "rgb(71, 85, 105)" }
              }
            >
              Todos
            </span>
          </button>

          {/* Categorias analíticas */}
          {analyticCategories.map((category) => {
            const IconComponent = getIconForEmoji(category.emoji) ?? Layers;
            const isActive = selectedAnalyticId === category.id;

            return (
              <button
                key={category.id}
                onClick={() => { onAnalyticChange(category.id); onChildChange(null); }}
                className="flex flex-col items-center gap-2 pb-2 transition-all"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isActive ? "ring-2 ring-offset-2" : ""
                  }`}
                  style={{
                    backgroundColor: isActive ? primaryColor : "rgb(226, 232, 240)",
                    color: isActive ? "white" : "rgb(100, 116, 139)",
                    ...(isActive
                      ? ({ "--tw-ring-color": primaryColor } as React.CSSProperties)
                      : {}),
                  }}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <span
                  className="text-xs font-semibold text-center max-w-[56px] whitespace-normal leading-tight"
                  style={isActive ? { color: primaryColor } : { color: "rgb(71, 85, 105)" }}
                >
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nível 2 — categorias filhas como pílulas */}
      {subcategories.length > 0 && (
        <div className="overflow-x-auto px-4 pb-1">
          <div className="flex gap-2 whitespace-nowrap">
            <button
              onClick={() => onChildChange(null)}
              className="h-7 px-3 rounded-full text-xs font-semibold border transition-all"
              style={
                selectedChildId === null
                  ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" }
                  : { backgroundColor: "white", borderColor: "rgb(203, 213, 225)", color: "rgb(71, 85, 105)" }
              }
            >
              Todos
            </button>

            {subcategories.map((sub) => {
              const isActiveSub = selectedChildId === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => onChildChange(sub.id)}
                  className="h-7 px-3 rounded-full text-xs font-semibold border transition-all"
                  style={
                    isActiveSub
                      ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" }
                      : { backgroundColor: "white", borderColor: "rgb(203, 213, 225)", color: "rgb(71, 85, 105)" }
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
