import { useEffect, useMemo, useState } from "react";
import {
  Package, XCircle, AlertTriangle, TrendingUp, Search, Filter, Download,
  FileText, ChevronDown, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { useSectors, SummaryCard, EmptyState, SkeletonRows } from "./-estoque-shared";

interface StockProduct {
  id: string; name: string; sku: string; category: string; categoryId: string;
  stock: number; minStock: number; price: number; pdvCode: string;
  lastMovement: string; costPrice: number; trackStock: boolean;
}

const BADGE_BASE = "rounded-full text-[11px] min-w-[8rem] justify-center";
function StockStatusBadge({ stock, min, trackStock }: { stock: number; min: number; trackStock: boolean }) {
  if (!trackStock)        return <Badge className={`${BADGE_BASE} bg-violet-500/15 text-violet-600 border-0`}>Estoque Pausado</Badge>;
  if (stock < 0)          return <Badge className={`${BADGE_BASE} bg-red-600/20 text-red-700 border border-red-300/60 font-semibold`}>Estoque negativo</Badge>;
  if (stock === 0)        return <Badge className={`${BADGE_BASE} bg-destructive/15 text-destructive border-0`}>Sem estoque</Badge>;
  if (stock <= min * 0.5) return <Badge className={`${BADGE_BASE} bg-red-500/15 text-red-600 border-0`}>Crítico</Badge>;
  if (stock <= min)       return <Badge className={`${BADGE_BASE} bg-amber-500/15 text-amber-600 border-0`}>Baixo</Badge>;
  return                         <Badge className={`${BADGE_BASE} bg-emerald-500/15 text-emerald-600 border-0`}>Em estoque</Badge>;
}

// ─── SEÇÃO: ESTOQUE ───────────────────────────────────────────────
export function SecaoEstoque() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSemEstoque, setFilterSemEstoque] = useState(false);
  const [filterAbaixoMin, setFilterAbaixoMin] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [sortBy, setSortBy] = useState<"" | "name_asc" | "pdv_asc">("");
  const [storeCategories, setStoreCategories] = useState<{ id: string; name: string }[]>([]);
  const sectors = useSectors();

  // Carrega categorias para o filtro
  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    fetch(`/api/categories/list-admin?storeId=${storeId}`)
      .then(r => r.json())
      .then((d: { categories?: { id: string; name: string }[] }) => setStoreCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  // Carrega inventário: global (products.stock) ou por setor (stockProductBalances)
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    if (selectedSectorId) {
      // Visão por setor: usa stockProductBalances
      api.get(`/api/stock/balances-by-sector?sectorId=${selectedSectorId}`)
        .then(r => r.json())
        .then((d: { balances?: Array<{
          quantity: string; minQuantity: string;
          product: { id: string; name: string; sku?: string | null; costPrice?: string | null; price?: string | null; lowStockThreshold?: number | null; active?: boolean; trackStock?: boolean | null; pdvCode?: string | null; categoryId?: string | null };
        }> }) => {
          if (!mounted) return;
          setProducts(
            (d.balances ?? [])
              .filter(b => b.product?.active !== false)
              .map(b => ({
                id:           b.product.id,
                name:         b.product.name,
                sku:          b.product.sku ?? "—",
                categoryId:   b.product.categoryId ?? "",
                category:     "—",
                stock:        Math.round(Number(b.quantity)),
                minStock:     Number(b.minQuantity) || (b.product.lowStockThreshold ?? 5),
                costPrice:    b.product.costPrice ? parseFloat(b.product.costPrice) : 0,
                price:        b.product.price     ? parseFloat(b.product.price)     : 0,
                pdvCode:      b.product.pdvCode   ?? "—",
                lastMovement: "—",
                trackStock:   b.product.trackStock ?? true,
              }))
          );
        })
        .catch(() => { if (mounted) setProducts([]); })
        .finally(() => { if (mounted) setLoading(false); });
    } else {
      // Visão global: usa products.stock
      const storeId = localStorage.getItem("storeId");
      if (!storeId) { setLoading(false); return; }
      api.get(`/api/products/list-admin?storeId=${storeId}`)
        .then(r => r.json())
        .then((d: { products?: Array<{ id: string; name: string; sku?: string | null; stock?: number | null; lowStockThreshold?: number | null; costPrice?: string | null; price?: string | null; active?: boolean; trackStock?: boolean | null; categoryId?: string | null; pdvCode?: string | null }> }) => {
          if (!mounted) return;
          setProducts((d.products ?? []).filter(p => p.active !== false).map(p => ({
            id:           p.id,
            name:         p.name,
            sku:          p.sku ?? "—",
            categoryId:   p.categoryId ?? "",
            category:     "—",
            stock:        p.stock ?? 0,
            minStock:     p.lowStockThreshold ?? 5,
            costPrice:    p.costPrice ? parseFloat(p.costPrice) : 0,
            price:        p.price    ? parseFloat(p.price)     : 0,
            pdvCode:      p.pdvCode  ?? "—",
            lastMovement: "—",
            trackStock:   p.trackStock ?? false,
          })));
        })
        .catch(() => { if (mounted) setProducts([]); })
        .finally(() => { if (mounted) setLoading(false); });
    }
    return () => { mounted = false; };
  }, [selectedSectorId, sectors]);

  // Resolve nomes de categoria via mapa
  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    storeCategories.forEach(c => m.set(c.id, c.name));
    return m;
  }, [storeCategories]);

  const displayProducts = useMemo(
    () => products.map(p => ({ ...p, category: categoryMap.get(p.categoryId) ?? "—" })),
    [products, categoryMap]
  );

  const handleExportEstoqueCSV = () => {
    const rows = [
      ["Cód. PDV", "Produto", "Categoria", "Estoque", "Mín.", "Preço de custo", "Preço de venda", "Status"],
      ...filtered.map(p => [
        p.pdvCode, p.name, p.category,
        p.trackStock ? p.stock : "—",
        p.trackStock ? p.minStock : "—",
        p.costPrice > 0 ? `R$ ${p.costPrice.toFixed(2).replace(".", ",")}` : "—",
        p.price > 0    ? `R$ ${p.price.toFixed(2).replace(".", ",")}` : "—",
        !p.trackStock ? "Estoque Pausado" : p.stock < 0 ? "Estoque negativo" : p.stock === 0 ? "Sem estoque" : p.stock <= p.minStock ? "Baixo" : "Em estoque",
      ]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "estoque.csv"; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleExportEstoquePDF = () => {
    const totalVal  = filtered.filter(p => p.trackStock && p.stock > 0).reduce((s, p) => s + p.stock * p.costPrice, 0);
    const semEst    = filtered.filter(p => p.trackStock && p.stock === 0).length;
    const baixoEst  = filtered.filter(p => p.trackStock && p.stock > 0 && p.stock <= p.minStock).length;
    const emEst     = filtered.filter(p => p.trackStock && p.stock > p.minStock).length;
    const pausadoEst = filtered.filter(p => !p.trackStock).length;
    const tableRows = filtered.map((p, i) => {
      const st = !p.trackStock
        ? ["Estoque Pausado","#f5f3ff","#7c3aed"]
        : p.stock < 0 ? ["Estoque negativo","#fef2f2","#dc2626"]
        : p.stock === 0 ? ["Sem estoque","#fef2f2","#dc2626"]
        : p.stock <= p.minStock ? ["Estoque baixo","#fffbeb","#d97706"]
        : ["Em estoque","#f0fdf4","#16a34a"];
      const estoqueCell = p.trackStock ? `<td style="text-align:center;font-weight:700${p.stock < 0 ? ";color:#dc2626" : ""}">${p.stock}</td>` : `<td style="text-align:center;color:#9ca3af">—</td>`;
      const minCell = p.trackStock ? `<td style="text-align:center;color:#6b7280">${p.minStock}</td>` : `<td style="text-align:center;color:#9ca3af">—</td>`;
      const custoCell  = p.costPrice > 0 ? `R$ ${p.costPrice.toFixed(2).replace(".",",")}` : "—";
      const vendaCell  = p.price > 0    ? `R$ ${p.price.toFixed(2).replace(".",",")}` : "—";
      return `<tr style="background:${i%2===0?"#fff":"#f9fafb"}"><td style="font-family:monospace;font-size:11px;color:#6b7280">${p.pdvCode}</td><td>${p.name}</td><td>${p.category}</td>${estoqueCell}${minCell}<td style="text-align:right;color:#6b7280">${custoCell}</td><td style="text-align:right;font-weight:600">${vendaCell}</td><td><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${st[1]};color:${st[2]}">${st[0]}</span></td></tr>`;
    }).join("");
    const kpiCols = pausadoEst > 0 ? 5 : 4;
    const pausadoKpi = pausadoEst > 0 ? `<div class="kpi violet"><div class="kpi-val">${pausadoEst}</div><div class="kpi-label">Pausados</div></div>` : "";
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Estoque — ARMAZIX</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;color:#111827;-webkit-print-color-adjust:exact}
  .page{max-width:1000px;margin:0 auto;padding:32px 28px}
  .header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px;background:linear-gradient(135deg,#00C853,#00e676);border-radius:16px;margin-bottom:24px;color:#fff}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px}
  .header-meta{text-align:right;font-size:12px;opacity:.85;line-height:1.6}
  .kpis{display:grid;grid-template-columns:repeat(${kpiCols},1fr);gap:12px;margin-bottom:24px}
  .kpi{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px}
  .kpi-val{font-size:22px;font-weight:700;color:#111827;margin-bottom:2px}
  .kpi-label{font-size:11px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:.4px}
  .kpi.green .kpi-val{color:#00C853} .kpi.red .kpi-val{color:#dc2626} .kpi.amber .kpi-val{color:#d97706} .kpi.violet .kpi-val{color:#7c3aed}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px}
  .card-header{padding:14px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}
  .card-title{font-size:13px;font-weight:700;color:#111827}
  .card-count{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f9fafb;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e5e7eb}
  td{padding:10px 14px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
  .footer{text-align:center;font-size:11px;color:#9ca3af;padding-top:8px}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">ARMAZIX</div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">Relatório de Estoque</div>
    </div>
    <div class="header-meta">
      <div>Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
      <div>${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
      <div style="margin-top:4px;font-weight:600">${filtered.length} produto(s)</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi green"><div class="kpi-val">${emEst}</div><div class="kpi-label">Em estoque</div></div>
    <div class="kpi amber"><div class="kpi-val">${baixoEst}</div><div class="kpi-label">Estoque baixo</div></div>
    <div class="kpi red"><div class="kpi-val">${semEst}</div><div class="kpi-label">Sem estoque</div></div>
    ${pausadoKpi}
    <div class="kpi"><div class="kpi-val" style="color:#00C853">R$ ${totalVal.toFixed(2).replace(".",",")}</div><div class="kpi-label">Valor em estoque</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Produtos</span><span class="card-count">${filtered.length} itens</span></div>
    <table>
      <thead><tr><th>Cód. PDV</th><th>Produto</th><th>Categoria</th><th style="text-align:center">Estoque</th><th style="text-align:center">Mínimo</th><th style="text-align:right">Preço de custo</th><th style="text-align:right">Preço de venda</th><th>Status</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div class="footer">ARMAZIX — Relatório gerado automaticamente — ${new Date().toLocaleString("pt-BR")}</div>
</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `estoque-${new Date().toISOString().slice(0,10)}.html`; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };
  const filtered = useMemo(() => {
    let list = displayProducts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku !== "—" && p.sku.toLowerCase().includes(q)) ||
        (p.pdvCode !== "—" && p.pdvCode.toLowerCase().includes(q)) ||
        (p.category !== "—" && p.category.toLowerCase().includes(q))
      );
    }
    if (filterSemEstoque) list = list.filter(p => p.trackStock && p.stock === 0);
    if (filterAbaixoMin)  list = list.filter(p => p.trackStock && p.stock > 0 && p.stock <= p.minStock);
    if (filterCategoryId) list = list.filter(p => p.categoryId === filterCategoryId);
    if (sortBy === "name_asc") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sortBy === "pdv_asc")  list = [...list].sort((a, b) => a.pdvCode.localeCompare(b.pdvCode, "pt-BR"));
    return list;
  }, [displayProducts, search, filterSemEstoque, filterAbaixoMin, filterCategoryId, sortBy]);

  const totalValue = displayProducts.filter(p => p.trackStock && p.stock > 0).reduce((s, p) => s + p.stock * p.costPrice, 0);
  const negativo   = displayProducts.filter(p => p.trackStock && p.stock < 0).length;
  const semEstoque = displayProducts.filter(p => p.trackStock && p.stock === 0).length;
  const baixo      = displayProducts.filter(p => p.trackStock && p.stock > 0 && p.stock <= p.minStock).length;
  const pausado    = displayProducts.filter(p => !p.trackStock).length;
  const activeFilters = [filterSemEstoque, filterAbaixoMin, !!filterCategoryId, !!sortBy].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Package}       label="Total de produtos"       value={displayProducts.length}                 color="text-primary"       bg="bg-primary/15" />
        {negativo > 0
          ? <SummaryCard icon={XCircle}   label="Estoque negativo"        value={negativo}                               color="text-red-600"       bg="bg-red-600/15" />
          : <SummaryCard icon={XCircle}   label="Sem estoque"             value={semEstoque}                             color="text-destructive"   bg="bg-destructive/15" />
        }
        <SummaryCard icon={AlertTriangle} label="Estoque baixo"           value={baixo}                                  color="text-amber-600"     bg="bg-amber-500/15" />
        <SummaryCard icon={TrendingUp}    label="Valor total em estoque"  value={`R$ ${totalValue.toFixed(2).replace(".", ",")}`} color="text-emerald-600" bg="bg-emerald-500/15" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar produto, SKU, Cód. PDV..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
          </div>
          {sectors.length > 0 && (
            <div className="relative w-full sm:w-52">
              <select
                value={selectedSectorId}
                onChange={e => setSelectedSectorId(e.target.value)}
                className="w-full h-9 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos os setores</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant={activeFilters > 0 ? "default" : "outline"}
            size="sm"
            className="rounded-xl h-9 gap-1.5"
            onClick={() => setFilterOpen(v => !v)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtrar
            {activeFilters > 0 && (
              <span className="ml-0.5 text-[10px] bg-background/25 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold">{activeFilters}</span>
            )}
          </Button>
          <div className="relative">
            <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" onClick={() => setExportOpen(v => !v)}>
              <Download className="w-3.5 h-3.5" />Exportar<ChevronDown className="w-3 h-3" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-border/50 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
                <button onClick={handleExportEstoqueCSV} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 flex items-center gap-2"><Download className="w-3.5 h-3.5" />Excel (.csv)</button>
                <button onClick={handleExportEstoquePDF} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 flex items-center gap-2"><FileText className="w-3.5 h-3.5" />PDF (imprimir)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Painel de filtros */}
      {filterOpen && (
        <div className="p-4 bg-secondary/40 rounded-2xl border border-border/50 space-y-4">
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterSemEstoque}
                onChange={e => setFilterSemEstoque(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              Sem estoque
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterAbaixoMin}
                onChange={e => setFilterAbaixoMin(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              Abaixo do estoque mínimo
            </label>
            {pausado > 0 && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-violet-600">
                <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                {pausado} produto{pausado !== 1 ? "s" : ""} com estoque pausado
              </label>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {storeCategories.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria</Label>
                <div className="relative">
                  <select
                    value={filterCategoryId}
                    onChange={e => setFilterCategoryId(e.target.value)}
                    className="w-full h-9 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Todas as categorias</option>
                    {storeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Ordenar por</Label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as "" | "name_asc" | "pdv_asc")}
                  className="w-full h-9 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Padrão</option>
                  <option value="name_asc">Nome (A–Z)</option>
                  <option value="pdv_asc">Código PDV</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterSemEstoque(false); setFilterAbaixoMin(false); setFilterCategoryId(""); setSortBy(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto encontrado" desc="Ajuste os filtros ou cadastre produtos no módulo de Produtos." />
      ) : (
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Cód. PDV</th>
                  {["Produto", "Categoria", "Estoque", "Mín.", "Preço de custo", "Preço de venda"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground text-center">{p.pdvCode}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${p.stock < 0 ? "text-red-600" : ""}`}>
                      {p.trackStock ? p.stock : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.trackStock ? p.minStock : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {p.costPrice > 0 ? `R$ ${p.costPrice.toFixed(2).replace(".", ",")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {p.price > 0 ? `R$ ${p.price.toFixed(2).replace(".", ",")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center"><StockStatusBadge stock={p.stock} min={p.minStock} trackStock={p.trackStock} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
