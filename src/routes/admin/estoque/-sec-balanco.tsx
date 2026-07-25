import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, ChevronDown, Download, Loader2, Package, TrendingUp, XCircle,
  AlertTriangle, ArrowUpCircle, ArrowDownCircle, AlertCircle, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { SkeletonRows, SummaryCard, type DbMovement } from "./-estoque-shared";

const StockMovementChart = lazy(() => import("@/components/armazix/StockMovementChart"));

// ─── SEÇÃO: BALANÇO ───────────────────────────────────────────────
interface BalanceteProduct {
  id: string; name: string; sku: string; categoryId: string | null;
  stock: number; minStock: number; costPrice: number; price: number;
}
interface BalanceteCategory { id: string; name: string }

export function SecaoBalanco() {
  // ── Core data ─────────────────────────────────────────────────
  const [allProducts,  setAllProducts]  = useState<BalanceteProduct[]>([]);
  const [categories,   setCategories]   = useState<BalanceteCategory[]>([]);
  const [movements,    setMovements]    = useState<DbMovement[]>([]);
  const [loadingInit,  setLoadingInit]  = useState(true);
  const [loadingMovs,  setLoadingMovs]  = useState(false);

  // ── Product combobox ──────────────────────────────────────────
  const [productInput,    setProductInput]    = useState("");
  const [comboOpen,       setComboOpen]       = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BalanceteProduct | null>(null);
  const comboRef = useRef<HTMLDivElement>(null);

  // ── Category filter ───────────────────────────────────────────
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  // ── Period / date range ───────────────────────────────────────
  const [periodMode,  setPeriodMode]  = useState<"7"|"30"|"90"|"custom">("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");

  // ── Risco tooltip ─────────────────────────────────────────────
  const [riscoTooltip, setRiscoTooltip] = useState(false);
  const riscoRef = useRef<HTMLDivElement>(null);

  // ── Outside-click handlers ────────────────────────────────────
  useEffect(() => {
    if (!comboOpen) return;
    const h = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [comboOpen]);

  useEffect(() => {
    if (!riscoTooltip) return;
    const h = (e: MouseEvent) => {
      if (riscoRef.current && !riscoRef.current.contains(e.target as Node)) setRiscoTooltip(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [riscoTooltip]);

  // ── Initial load: products + categories ──────────────────────
  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    setLoadingInit(true);
    Promise.all([
      storeId
        ? fetch(`/api/products/list-admin?storeId=${storeId}`).then(r => r.json())
        : Promise.resolve({ products: [] }),
      storeId
        ? fetch(`/api/categories/list-admin?storeId=${storeId}`).then(r => r.json())
        : Promise.resolve({ categories: [] }),
    ])
      .then(([pd, cd]: [
        { products?: Array<{ id: string; name: string; sku?: string | null; stock?: number | null; lowStockThreshold?: number | null; costPrice?: string | null; price?: string | null; active?: boolean; categoryId?: string | null }> },
        { categories?: Array<{ id: string; name: string }> },
      ]) => {
        setAllProducts(
          (pd.products ?? [])
            .filter(p => p.active !== false)
            .map(p => ({
              id: p.id, name: p.name, sku: p.sku ?? "—",
              categoryId: p.categoryId ?? null,
              stock: p.stock ?? 0, minStock: p.lowStockThreshold ?? 5,
              costPrice: p.costPrice ? parseFloat(p.costPrice) : 0,
              price: p.price ? parseFloat(p.price) : 0,
            }))
        );
        setCategories(cd.categories ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingInit(false));
  }, []);

  // ── Fetch movements (reactive) ────────────────────────────────
  const fetchMovements = useCallback(async () => {
    setLoadingMovs(true);
    try {
      const params = new URLSearchParams({ limit: "2000" });
      if (selectedProduct) params.set("productId", selectedProduct.id);
      if (periodMode !== "custom") {
        params.set("startDate", new Date(Date.now() - parseInt(periodMode) * 86400000).toISOString().slice(0, 10));
      } else {
        if (customStart) params.set("startDate", customStart);
        if (customEnd)   params.set("endDate",   customEnd);
      }
      const res  = await api.get(`/api/stock/movements?${params}`);
      const data = await res.json();
      setMovements(data.movements ?? []);
    } catch {}
    finally { setLoadingMovs(false); }
  }, [selectedProduct, periodMode, customStart, customEnd]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  // ── Derived: active scope ─────────────────────────────────────
  const kpiProducts = useMemo(() => {
    if (selectedProduct)    return [selectedProduct];
    if (selectedCategoryId) return allProducts.filter(p => p.categoryId === selectedCategoryId);
    return allProducts;
  }, [allProducts, selectedProduct, selectedCategoryId]);

  const tableProducts = useMemo(() => {
    if (selectedProduct || selectedCategoryId) return kpiProducts;
    const q = productInput.toLowerCase().trim();
    if (!q) return kpiProducts;
    return kpiProducts.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [kpiProducts, selectedProduct, selectedCategoryId, productInput]);

  const kpiProductIds = useMemo(() => new Set(kpiProducts.map(p => p.id)), [kpiProducts]);

  const activeMovements = useMemo(() => {
    if (selectedProduct)    return movements;
    if (!selectedCategoryId) return movements;
    return movements.filter(m => m.productId && kpiProductIds.has(m.productId));
  }, [movements, selectedProduct, selectedCategoryId, kpiProductIds]);

  // ── Date range ────────────────────────────────────────────────
  const dateRangeInfo = useMemo(() => {
    if (periodMode === "custom") {
      const s = customStart ? new Date(customStart + "T00:00:00") : new Date(Date.now() - 30 * 86400000);
      const e = customEnd   ? new Date(customEnd   + "T23:59:59") : new Date();
      return { start: s, diffDays: Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000)) };
    }
    return { start: new Date(Date.now() - parseInt(periodMode) * 86400000), diffDays: parseInt(periodMode) };
  }, [periodMode, customStart, customEnd]);

  // ── KPIs ──────────────────────────────────────────────────────
  const totalValue   = kpiProducts.filter(p => p.stock > 0).reduce((s, p) => s + p.stock * (p.price > 0 ? p.price : p.costPrice), 0);
  const totalItems   = kpiProducts.filter(p => p.stock > 0).reduce((s, p) => s + p.stock, 0);
  const negativoKpi  = kpiProducts.filter(p => p.stock < 0).length;
  const semEstoque   = kpiProducts.filter(p => p.stock === 0).length;
  const baixo        = kpiProducts.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const entradas     = activeMovements.filter(m => m.type === "ENTRADA").reduce((s, m) => s + m.quantity, 0);
  const saidas       = activeMovements.filter(m => ["SAIDA", "VENDA"].includes(m.type)).reduce((s, m) => s + m.quantity, 0);
  const perdas       = activeMovements.filter(m => ["PERDA", "AVARIA"].includes(m.type)).reduce((s, m) => s + m.quantity, 0);
  const movimentados = new Set(activeMovements.map(m => m.productId).filter(Boolean)).size;

  // ── Chart ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const { start, diffDays } = dateRangeInfo;
    const step = Math.max(1, Math.ceil(diffDays / 30));
    const bars = Math.ceil(diffDays / step);
    return Array.from({ length: bars }, (_, i) => {
      const barStart = new Date(start.getTime() + i * step * 86400000);
      const barEnd   = new Date(start.getTime() + (i + 1) * step * 86400000);
      const label = step === 1 && diffDays <= 7
        ? barStart.toLocaleDateString("pt-BR", { weekday: "short" })
        : `${String(barStart.getDate()).padStart(2, "0")}/${String(barStart.getMonth() + 1).padStart(2, "0")}`;
      const dayMovs = activeMovements.filter(m => { const d = new Date(m.createdAt); return d >= barStart && d < barEnd; });
      return {
        name:    label,
        entrada: dayMovs.filter(m => m.type === "ENTRADA").reduce((s, m) => s + m.quantity, 0),
        saida:   dayMovs.filter(m => ["SAIDA", "VENDA", "PERDA", "AVARIA"].includes(m.type)).reduce((s, m) => s + m.quantity, 0),
      };
    });
  }, [activeMovements, dateRangeInfo]);

  const kpis = [
    { icon: TrendingUp,      label: "Valor total em estoque", value: `R$ ${totalValue.toFixed(2).replace(".", ",")}`, color: "text-emerald-600", bg: "bg-emerald-500/15" },
    { icon: Package,         label: "Total de itens",         value: totalItems,                                       color: "text-primary",     bg: "bg-primary/15" },
    negativoKpi > 0
      ? { icon: XCircle,     label: "Estoque negativo",        value: negativoKpi,                                      color: "text-red-600",     bg: "bg-red-600/15" }
      : { icon: XCircle,     label: "Produtos sem estoque",    value: semEstoque,                                       color: "text-destructive", bg: "bg-destructive/15" },
    { icon: AlertTriangle,   label: "Estoque baixo",          value: baixo,                                            color: "text-amber-600",   bg: "bg-amber-500/15" },
    { icon: ArrowUpCircle,   label: "Entradas no período",    value: entradas,                                         color: "text-emerald-600", bg: "bg-emerald-500/15" },
    { icon: ArrowDownCircle, label: "Saídas no período",      value: saidas,                                           color: "text-blue-600",    bg: "bg-blue-500/15" },
    { icon: AlertCircle,     label: "Perdas / Avarias",       value: perdas,                                           color: "text-destructive", bg: "bg-destructive/15" },
    { icon: Activity,        label: "Produtos movimentados",  value: movimentados,                                     color: "text-violet-600",  bg: "bg-violet-500/15" },
  ];

  // ── Product combobox suggestions ──────────────────────────────
  const productSuggestions = useMemo(() => {
    if (!productInput.trim()) return allProducts.slice(0, 8);
    const q = productInput.toLowerCase();
    return allProducts.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [allProducts, productInput]);

  const activeCategory = categories.find(c => c.id === selectedCategoryId);
  const isFiltered     = !!selectedProduct || !!selectedCategoryId;

  return (
    <div className="space-y-6">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-3 items-start">
        {/* Product Autocomplete */}
        <div ref={comboRef} className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
          <Input
            placeholder="Buscar produto..."
            value={selectedProduct ? selectedProduct.name : productInput}
            readOnly={!!selectedProduct}
            onChange={e => { setProductInput(e.target.value); setComboOpen(true); }}
            onFocus={() => setComboOpen(true)}
            className={`pl-9 h-9 rounded-xl text-sm pr-8 ${selectedProduct ? "bg-primary/5 text-primary font-medium cursor-default" : ""}`}
          />
          {(selectedProduct || productInput) && (
            <button
              onClick={() => { setSelectedProduct(null); setProductInput(""); setComboOpen(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {comboOpen && !selectedProduct && productSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
              {productSuggestions.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProduct(p); setSelectedCategoryId(""); setProductInput(""); setComboOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 flex items-center gap-2"
                >
                  <span className="font-medium truncate flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{p.sku}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={selectedCategoryId}
            onChange={e => { setSelectedCategoryId(e.target.value); if (e.target.value) { setSelectedProduct(null); setProductInput(""); } }}
            className="h-9 pl-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Period select */}
        <div className="relative">
          <select
            value={periodMode}
            onChange={e => setPeriodMode(e.target.value as "7"|"30"|"90"|"custom")}
            className="h-9 pl-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Período personalizado</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Custom date range */}
        {periodMode === "custom" && (
          <>
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-40 rounded-xl text-sm" />
            <Input type="date" value={customEnd}   onChange={e => setCustomEnd(e.target.value)}   className="h-9 w-40 rounded-xl text-sm" />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" disabled={loadingInit || loadingMovs}>
            <Download className="w-3.5 h-3.5" />Exportar
          </Button>
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {isFiltered && (
        <div className="flex flex-wrap gap-2 items-center">
          {selectedProduct && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              <Package className="w-3 h-3" />{selectedProduct.name}
              <button onClick={() => setSelectedProduct(null)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
            </span>
          )}
          {activeCategory && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600 border border-violet-500/20">
              {activeCategory.name}
              <button onClick={() => setSelectedCategoryId("")} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button
            onClick={() => { setSelectedProduct(null); setProductInput(""); setSelectedCategoryId(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* ── KPIs ── */}
      {loadingInit ? <SkeletonRows n={2} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(k => <SummaryCard key={k.label} {...k} />)}
        </div>
      )}

      {/* ── Chart ── */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Entradas × Saídas</CardTitle>
            {loadingMovs && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando gráfico...</div>}>
              <StockMovementChart data={loadingInit ? [] : chartData} />
            </Suspense>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Análise por produto</CardTitle>
            {!loadingInit && <span className="text-xs text-muted-foreground">{tableProducts.length} produto(s)</span>}
          </div>
        </CardHeader>
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/40">
              <tr>
                {["Produto", "SKU", "Estoque atual", "Valor unitário", "Valor total", "Giro"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  <div ref={riscoRef} className="relative inline-flex items-center gap-1">
                    Risco
                    <button
                      onClick={() => setRiscoTooltip(v => !v)}
                      className="shrink-0 w-5 h-5 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors inline-flex items-center justify-center text-[11px] font-bold"
                      aria-label="Explicação sobre Risco"
                    >
                      ?
                    </button>
                    {riscoTooltip && (
                      <div className="absolute z-50 top-full right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-xl shadow-xl p-4 text-left font-normal whitespace-normal">
                        <p className="text-xs font-bold text-foreground mb-2">O que é o Risco de estoque?</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          Indica a probabilidade de o produto ficar indisponível para venda com base no estoque atual comparado ao mínimo configurado.
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/15 text-destructive shrink-0">Ruptura</span>
                            <span className="text-[11px] text-muted-foreground leading-snug">Estoque zerado. Produto indisponível para venda agora.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 shrink-0">Atenção</span>
                            <span className="text-[11px] text-muted-foreground leading-snug">Estoque abaixo do mínimo cadastrado. Considere reabastecer em breve.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 shrink-0">Normal</span>
                            <span className="text-[11px] text-muted-foreground leading-snug">Estoque acima do mínimo. Sem necessidade de ação imediata.</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border/40">
                          O estoque mínimo é configurado em cada produto no módulo de Produtos.
                        </p>
                      </div>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loadingInit ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando...
                </td></tr>
              ) : tableProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  {allProducts.length === 0 ? "Nenhum produto cadastrado." : "Nenhum produto encontrado para esse filtro."}
                </td></tr>
              ) : tableProducts.map(p => {
                const valorUnit = p.price > 0 ? p.price : p.costPrice;
                const vt    = p.stock * valorUnit;
                const giro  = p.stock < 0 ? "Negativo" : p.stock > 50 ? "Alto" : p.stock > 15 ? "Médio" : "Baixo";
                const risco = p.stock < 0 ? "Negativo" : p.stock === 0 ? "Ruptura" : p.stock <= p.minStock ? "Atenção" : "Normal";
                return (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.sku}</td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${p.stock < 0 ? "text-red-600" : ""}`}>{p.stock}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {valorUnit > 0 ? `R$ ${valorUnit.toFixed(2).replace(".", ",")}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {valorUnit > 0 ? `R$ ${vt.toFixed(2).replace(".", ",")}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${giro === "Negativo" ? "bg-red-600/20 text-red-700" : giro === "Alto" ? "bg-emerald-500/15 text-emerald-600" : giro === "Médio" ? "bg-blue-500/15 text-blue-600" : "bg-secondary text-muted-foreground"}`}>{giro}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${risco === "Negativo" ? "bg-red-600/20 text-red-700 font-semibold" : risco === "Ruptura" ? "bg-destructive/15 text-destructive" : risco === "Atenção" ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}`}>{risco}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
