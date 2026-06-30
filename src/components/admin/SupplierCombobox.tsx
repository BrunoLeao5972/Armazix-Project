import { useState, useRef, useEffect, useCallback } from "react";
import { Building2, ChevronDown, X, Loader2 } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  value: Supplier | null;
  onChange: (v: Supplier | null) => void;
  error?: boolean;
}

export default function SupplierCombobox({ value, onChange, error }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Supplier[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/customers/suppliers${qs}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { suppliers: Supplier[] };
        setResults(data.suppliers || []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 280);
  };

  const handleFocus = () => {
    setOpen(true);
    if (results.length === 0) search(query);
  };

  const handleSelect = (s: Supplier) => {
    onChange(s);
    setQuery(s.name);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
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

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  const borderClass = error && !value
    ? "border-destructive ring-1 ring-destructive"
    : "border-input";

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center h-10 rounded-xl border ${borderClass} bg-background px-3 gap-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-shadow`}>
        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          placeholder="Buscar fornecedor cadastrado..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />}
        {value && !loading && (
          <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!value && !loading && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-md overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              {loading ? "Buscando..." : query ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
              {results.map(s => (
                <button
                  key={s.id}
                  onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/60 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium truncate">{s.name}</span>
                  {s.phone && <span className="text-xs text-muted-foreground shrink-0">{s.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && !value && (
        <p className="text-xs text-destructive mt-1">Selecione um fornecedor cadastrado</p>
      )}
    </div>
  );
}
