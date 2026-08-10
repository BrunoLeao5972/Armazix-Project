import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CategoryDoc } from "../../db/types";

export const FAVORITES = "__favorites__";
export const ALL = "__all__";

export function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: CategoryDoc[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
      <TabButton active={activeId === FAVORITES} onClick={() => onSelect(FAVORITES)}>
        <Star className="w-3.5 h-3.5" /> Favoritos
      </TabButton>
      <TabButton active={activeId === ALL} onClick={() => onSelect(ALL)}>
        Todos
      </TabButton>
      {categories.map((c) => (
        <TabButton key={c.id} active={activeId === c.id} onClick={() => onSelect(c.id)}>
          {c.emoji ? <span>{c.emoji}</span> : null} {c.name}
        </TabButton>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-white border-primary shadow-glow"
          : "bg-white text-ink/70 border-black/10 hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}
