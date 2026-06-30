import { useState, useRef, useEffect } from "react";
import { Package, X, ChevronDown } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
}

interface Props {
  value: Product | null;
  onChange: (v: Product | null) => void;
  error?: boolean;
}

export default function ProductCombobox({ value, onChange, error }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<Product[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    fetch(`/api/products/list?storeId=${storeId}`)
      .then(r => r.json())
      .then(d => {
        const prods: Product[] = (d.products || []).filter((p: any) => p.active !== false);
        setAll(prods);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  const filtered = query.length > 0
    ? all.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.sku || "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : all.slice(0, 12);

  const handleInput = (v: string) => {
    setQuery(v);
    onChange(null);
    setOpen(true);
  };

  const handleSelect = (p: Product) => {
    onChange(p);
    setQuery(p.name);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
    setOpen(true);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!value) setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  const borderClass = error && !value
    ? "border-destructive ring-1 ring-destructive"
    : "border-input";

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center h-9 rounded-xl border ${borderClass} bg-background px-2.5 gap-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-shadow`}>
        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar produto..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {value && (
          <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
        {!value && <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-md overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              {all.length === 0 ? "Carregando produtos..." : "Nenhum produto encontrado"}
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto divide-y divide-border/40">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium truncate">{p.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.sku && <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>}
                    <span className="text-xs text-muted-foreground">{p.stock} un</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && !value && (
        <p className="text-xs text-destructive mt-1">Selecione um produto cadastrado</p>
      )}
    </div>
  );
}
