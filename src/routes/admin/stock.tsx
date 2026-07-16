import { lazy, Suspense, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, Package, TrendingUp, TrendingDown,
  MoreHorizontal, Loader2, Search, Filter, Download, Plus, RefreshCw,
  ClipboardList, ArrowLeftRight, ArrowRight, FileText, BarChart3, Settings2, History,
  CheckCircle2, XCircle, Clock, ChevronDown, X, Check, Eye, Pencil,
  Warehouse, Truck, ShoppingBag, Trash2, AlertCircle, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const StockMovementChart = lazy(() => import("@/components/armazix/StockMovementChart"));
import { api } from "@/lib/api-client";
import SupplierCombobox from "@/components/admin/SupplierCombobox";
import ProductCombobox from "@/components/admin/ProductCombobox";

export const Route = createFileRoute("/admin/stock")({
  component: StockPage,
  head: () => ({
    meta: [{ title: "Estoque — ARMAZIX" }],
  }),
});

// ─── Types ────────────────────────────────────────────────────────
interface StockProduct {
  id: string; name: string; sku: string; category: string;
  stock: number; minStock: number; location: string;
  lastMovement: string; costPrice: number; price: number;
}

interface Movement {
  id: string; date: string; product: string; type: string;
  qty: number; balanceBefore: number; balanceAfter: number;
  user: string; note: string;
}

interface EntryItem { productId: string; productName: string; qty: string; cost: string; lot: string; expiry: string; }
interface ExitItem  { productId: string; productName: string; qty: string; }
interface TransferItem { product: string; qty: string; }

interface DbMovement {
  id: string;
  productId: string | null;
  productName: string;
  type: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  origem: string;
  createdByName: string | null;
  createdAt: string;
}

interface DbAdjustment {
  id: string;
  productId: string | null;
  productName: string;
  balanceBefore: number;
  balanceAfter: number;
  qty: number;
  tipo: string;
  motivo: string | null;
  observations: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface Sector { id: string; name: string; color: string | null; active: boolean }

/** Hook compartilhado: carrega lista de setores ativos da loja. */
function useSectors() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  useEffect(() => {
    api.get("/api/sectors/list")
      .then(r => r.json())
      .then((d: { sectors?: Sector[] }) => setSectors((d.sectors ?? []).filter(s => s.active)))
      .catch(() => {});
  }, []);
  return sectors;
}

/** Select estilizado para escolha de setor. */
function SectorSelect({
  sectors, value, onChange, required, error, placeholder,
}: {
  sectors: Sector[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full h-10 px-3 pr-8 text-sm rounded-xl border appearance-none focus:outline-none focus:ring-2 focus:ring-ring bg-background ${
          error ? "border-destructive ring-1 ring-destructive" : "border-input"
        }`}
      >
        <option value="">{placeholder ?? "Selecione o setor..."}</option>
        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      {required && !value && error && (
        <p className="text-[11px] text-destructive mt-1">Setor obrigatório</p>
      )}
    </div>
  );
}

const PAYMENT_METHODS = ["Dinheiro", "Boleto", "Pix", "Cartão de crédito", "Cartão de débito", "Transferência", "Cheque"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const dbTypeToKey = (type: string): string => {
  const map: Record<string, string> = {
    ENTRADA: "entrada", SAIDA: "saida", VENDA: "saida",
    AJUSTE: "ajuste", RECONTAGEM: "ajuste",
    PERDA: "perda", AVARIA: "perda",
    TRANSFERENCIA: "transferencia",
  };
  return map[type.toUpperCase()] ?? "ajuste";
};
// ─── Helpers ──────────────────────────────────────────────────────
const MOV_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  entrada:      { label: "Entrada",      color: "text-emerald-600", bg: "bg-emerald-500/15", icon: ArrowUpCircle },
  saida:        { label: "Saída",        color: "text-blue-600",    bg: "bg-blue-500/15",    icon: ArrowDownCircle },
  ajuste:       { label: "Ajuste",       color: "text-violet-600",  bg: "bg-violet-500/15",  icon: Settings2 },
  inventario:   { label: "Inventário",   color: "text-primary",     bg: "bg-primary/15",     icon: ClipboardList },
  transferencia:{ label: "Transferência",color: "text-amber-600",   bg: "bg-amber-500/15",   icon: ArrowLeftRight },
  perda:        { label: "Perda",        color: "text-destructive", bg: "bg-destructive/15", icon: AlertTriangle },
};

function StockStatusBadge({ stock, min }: { stock: number; min: number }) {
  if (stock < 0)          return <Badge className="rounded-full text-[11px] bg-red-600/20 text-red-700 border border-red-300/60 font-semibold">Estoque negativo</Badge>;
  if (stock === 0)        return <Badge className="rounded-full text-[11px] bg-destructive/15 text-destructive border-0">Sem estoque</Badge>;
  if (stock <= min * 0.5) return <Badge className="rounded-full text-[11px] bg-red-500/15 text-red-600 border-0">Crítico</Badge>;
  if (stock <= min)       return <Badge className="rounded-full text-[11px] bg-amber-500/15 text-amber-600 border-0">Baixo</Badge>;
  return                         <Badge className="rounded-full text-[11px] bg-emerald-500/15 text-emerald-600 border-0">Em estoque</Badge>;
}

function MovTypeBadge({ type }: { type: string }) {
  const cfg = MOV_TYPE_CONFIG[type] ?? { label: type, color: "text-muted-foreground", bg: "bg-secondary", icon: Activity };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-soft">
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</p>
    </div>
  );
}

function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-secondary/60 animate-pulse" />
      ))}
    </div>
  );
}

// Dados agora vêm da API; estados iniciam vazios

// ─── SEÇÃO: ESTOQUE ───────────────────────────────────────────────
export function SecaoEstoque() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<string>("");
  const sectors = useSectors();

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
          product: { id: string; name: string; sku?: string | null; costPrice?: string | null; price?: string | null; lowStockThreshold?: number | null; active?: boolean };
        }> }) => {
          if (!mounted) return;
          setProducts(
            (d.balances ?? [])
              .filter(b => b.product?.active !== false)
              .map(b => ({
                id:           b.product.id,
                name:         b.product.name,
                sku:          b.product.sku ?? "—",
                category:     "—",
                stock:        Math.round(Number(b.quantity)),
                minStock:     Number(b.minQuantity) || (b.product.lowStockThreshold ?? 5),
                location:     sectors.find(s => s.id === selectedSectorId)?.name ?? "—",
                lastMovement: "—",
                costPrice:    b.product.costPrice ? parseFloat(b.product.costPrice) : 0,
                price:        b.product.price     ? parseFloat(b.product.price)     : 0,
              }))
          );
        })
        .catch(() => { if (mounted) setProducts([]); })
        .finally(() => { if (mounted) setLoading(false); });
    } else {
      // Visão global: usa products.stock
      const storeId = localStorage.getItem("storeId");
      if (!storeId) { setLoading(false); return; }
      fetch(`/api/products/list?storeId=${storeId}`)
        .then(r => r.json())
        .then((d: { products?: Array<{ id: string; name: string; sku?: string | null; stock?: number | null; lowStockThreshold?: number | null; costPrice?: string | null; price?: string | null; active?: boolean }> }) => {
          if (!mounted) return;
          setProducts((d.products ?? []).filter(p => p.active !== false).map(p => ({
            id:           p.id,
            name:         p.name,
            sku:          p.sku ?? "—",
            category:     "—",
            stock:        p.stock ?? 0,
            minStock:     p.lowStockThreshold ?? 5,
            location:     "—",
            lastMovement: "—",
            costPrice:    p.costPrice ? parseFloat(p.costPrice) : 0,
            price:        p.price    ? parseFloat(p.price)     : 0,
          })));
        })
        .catch(() => { if (mounted) setProducts([]); })
        .finally(() => { if (mounted) setLoading(false); });
    }
    return () => { mounted = false; };
  }, [selectedSectorId, sectors]);

  const handleExportEstoqueCSV = () => {
    const filtered_ref = products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    );
    const rows = [
      ["Produto", "SKU", "Categoria", "Estoque", "M\u00edn.", "Localiza\u00e7\u00e3o", "\u00daltima mov."],
      ...filtered_ref.map(p => [p.name, p.sku, p.category, p.stock, p.minStock, p.location, p.lastMovement]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "estoque.csv"; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleExportEstoquePDF = () => {
    const filtered_pdf = products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    );
    const totalVal = filtered_pdf.reduce((s, p) => s + p.stock * p.costPrice, 0);
    const semEst = filtered_pdf.filter(p => p.stock === 0).length;
    const baixoEst = filtered_pdf.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const emEst = filtered_pdf.filter(p => p.stock > p.minStock).length;
    const tableRows = filtered_pdf.map((p, i) => {
      const st = p.stock === 0 ? ["Sem estoque","#fef2f2","#dc2626"] : p.stock <= p.minStock ? ["Estoque baixo","#fffbeb","#d97706"] : ["Em estoque","#f0fdf4","#16a34a"];
      return `<tr style="background:${i%2===0?"#fff":"#f9fafb"}"><td>${p.name}</td><td style="font-family:monospace;font-size:11px;color:#6b7280">${p.sku}</td><td>${p.category}</td><td style="text-align:center;font-weight:700">${p.stock}</td><td style="text-align:center;color:#6b7280">${p.minStock}</td><td style="color:#6b7280">${p.location}</td><td style="color:#6b7280">${p.lastMovement}</td><td><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${st[1]};color:${st[2]}">${st[0]}</span></td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relat\u00f3rio de Estoque \u2014 ARMAZIX</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;color:#111827;-webkit-print-color-adjust:exact}
  .page{max-width:960px;margin:0 auto;padding:32px 28px}
  .header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px;background:linear-gradient(135deg,#00C853,#00e676);border-radius:16px;margin-bottom:24px;color:#fff}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px}.logo span{opacity:.7;font-weight:400}
  .header-meta{text-align:right;font-size:12px;opacity:.85;line-height:1.6}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .kpi{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px}
  .kpi-val{font-size:22px;font-weight:700;color:#111827;margin-bottom:2px}
  .kpi-label{font-size:11px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:.4px}
  .kpi.green .kpi-val{color:#00C853} .kpi.red .kpi-val{color:#dc2626} .kpi.amber .kpi-val{color:#d97706}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px}
  .card-header{padding:14px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}
  .card-title{font-size:13px;font-weight:700;color:#111827}
  .card-count{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f9fafb;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e5e7eb}
  td{padding:10px 14px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
  .footer{text-align:center;font-size:11px;color:#9ca3af;padding-top:8px}
  .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">ARMAZIX <span></span></div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">Relat\u00f3rio de Estoque</div>
    </div>
    <div class="header-meta">
      <div>Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
      <div>${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
      <div style="margin-top:4px;font-weight:600">${filtered_pdf.length} produto(s)</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi green"><div class="kpi-val">${emEst}</div><div class="kpi-label">Em estoque</div></div>
    <div class="kpi amber"><div class="kpi-val">${baixoEst}</div><div class="kpi-label">Estoque baixo</div></div>
    <div class="kpi red"><div class="kpi-val">${semEst}</div><div class="kpi-label">Sem estoque</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#00C853">R$ ${totalVal.toFixed(2).replace(".",",")}</div><div class="kpi-label">Valor em estoque</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Produtos</span><span class="card-count">${filtered_pdf.length} itens</span></div>
    <table>
      <thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th style="text-align:center">Estoque</th><th style="text-align:center">M\u00ednimo</th><th>Localiza\u00e7\u00e3o</th><th>\u00daltima mov.</th><th>Status</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div class="footer">ARMAZIX &mdash; Relat\u00f3rio gerado automaticamente &mdash; ${new Date().toLocaleString("pt-BR")}</div>
</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `estoque-${new Date().toISOString().slice(0,10)}.html`; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue  = products.filter(p => p.stock > 0).reduce((s, p) => s + p.stock * p.costPrice, 0);
  const negativo    = products.filter(p => p.stock < 0).length;
  const semEstoque  = products.filter(p => p.stock === 0).length;
  const baixo       = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;

  return (
    <div className="space-y-5">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Package}       label="Total de produtos"       value={products.length}                        color="text-primary"       bg="bg-primary/15" />
        {negativo > 0
          ? <SummaryCard icon={XCircle}   label="Estoque negativo"        value={negativo}                               color="text-red-600"       bg="bg-red-600/15" />
          : <SummaryCard icon={XCircle}   label="Sem estoque"             value={semEstoque}                             color="text-destructive"   bg="bg-destructive/15" />
        }
        <SummaryCard icon={AlertTriangle} label="Estoque baixo"           value={baixo}                                 color="text-amber-600"     bg="bg-amber-500/15" />
        <SummaryCard icon={TrendingUp}    label="Valor total em estoque"  value={`R$ ${totalValue.toFixed(2).replace(".", ",")}`} color="text-emerald-600" bg="bg-emerald-500/15" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar produto, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
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
          <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5"><Filter className="w-3.5 h-3.5" />Filtrar</Button>
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

      {/* Table */}
      {loading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto encontrado" desc="Ajuste o filtro ou cadastre produtos no módulo de Produtos." />
      ) : (
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  {["Produto", "SKU", "Categoria", "Estoque", "Mín.", "Localização", "Última mov.", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${p.stock < 0 ? "text-red-600" : ""}`}>{p.stock}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.minStock}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.location}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.lastMovement}</td>
                    <td className="px-4 py-3"><StockStatusBadge stock={p.stock} min={p.minStock} /></td>
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

// ─── SEÇÃO: ENTRADA ───────────────────────────────────────────────
// Formas de pagamento com baixa automática no financeiro
const BAIXA_AUTOMATICA = ["Dinheiro", "Pix"];

export function SecaoEntrada() {
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alertaBaixa, setAlertaBaixa] = useState<string | null>(null);
  const [items, setItems] = useState<EntryItem[]>([{ productId: "", productName: "", qty: "", cost: "", lot: "", expiry: "" }]);
  const [supplierRecord, setSupplierRecord] = useState<{ id: string; name: string; phone: string | null } | null>(null);
  const [sectorId, setSectorId] = useState("");
  const [nf, setNf] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [obs, setObs] = useState("");
  const [payMethod, setPayMethod] = useState("Boleto");
  const [installments, setInstallments] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [sendToFinancial, setSendToFinancial] = useState(true);
  const [saved, setSaved] = useState(false);
  const sectors = useSectors();

  const addItem = () => setItems(v => [...v, { productId: "", productName: "", qty: "", cost: "", lot: "", expiry: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof EntryItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const setItemProduct = (i: number, p: { id: string; name: string; sku: string | null; stock: number } | null) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: p?.id ?? "", productName: p?.name ?? "" } : it));

  const total = items.reduce((s, it) => s + (parseFloat(it.qty || "0") * parseFloat(it.cost || "0")), 0);
  const parcelValue = installments && parseInt(installments) > 0 ? total / parseInt(installments) : total;

  const resetForm = () => {
    setItems([{ productId: "", productName: "", qty: "", cost: "", lot: "", expiry: "" }]);
    setSupplierRecord(null);
    setSectorId("");
    setNf("");
    setDate(new Date().toISOString().split("T")[0]);
    setObs("");
    setPayMethod("Boleto");
    setInstallments("1");
    setDueDate("");
    setSendToFinancial(true);
    setEditandoId(null);
  };

  const [entradaErrors, setEntradaErrors] = useState<{ supplier?: boolean; sector?: boolean; products?: boolean }>({});
  const [entradaSaving, setEntradaSaving] = useState(false);
  const [entradaApiError, setEntradaApiError] = useState<string | null>(null);

  const handleSave = async () => {
    const errs: { supplier?: boolean; sector?: boolean; products?: boolean } = {};
    if (!supplierRecord)                          errs.supplier = true;
    if (!sectorId && sectors.length > 0)          errs.sector   = true;
    if (items.some(it => !it.productId))          errs.products = true;
    if (Object.keys(errs).length > 0) { setEntradaErrors(errs); return; }
    setEntradaErrors({});
    setEntradaApiError(null);
    setEntradaSaving(true);

    try {
      const payload = {
        sectorId:     sectorId || undefined,
        supplierId:   supplierRecord!.id,
        supplierName: supplierRecord!.name,
        nf:           nf || undefined,
        date,
        obs:          obs || undefined,
        payMethod:    payMethod || undefined,
        installments: parseInt(installments) || 1,
        dueDate:      dueDate || undefined,
        items: items
          .filter(it => it.productId && parseFloat(it.qty) > 0)
          .map(it => ({
            productId:   it.productId,
            productName: it.productName,
            qty:         parseFloat(it.qty),
            cost:        it.cost ? parseFloat(it.cost) : undefined,
            lot:         it.lot  || undefined,
            expiry:      it.expiry || undefined,
          })),
      };

      const res  = await api.post("/api/stock/entry", payload);
      const data = await res.json() as { success?: boolean; error?: string };

      if (res.ok && data.success) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setShowForm(false);
          resetForm();
        }, 2000);
      } else {
        setEntradaApiError(data.error ?? "Erro ao registrar entrada. Tente novamente.");
      }
    } catch {
      setEntradaApiError("Erro de conexão. Verifique sua internet.");
    } finally {
      setEntradaSaving(false);
    }
  };

  const handleEditar = (entrada: Movement) => {
    // Verifica se a forma de pagamento tem baixa automática
    const formaPagtoMock = "Dinheiro"; // Na prática viria do registro real
    const temBaixaAutomatica = BAIXA_AUTOMATICA.includes(formaPagtoMock);

    if (temBaixaAutomatica) {
      setAlertaBaixa(`Esta entrada foi paga em ${formaPagtoMock} e já foi baixada no financeiro. Para editar, primeiro desfaça a baixa no módulo Financeiro > Contas a Pagar.`);
      return;
    }

    // Carrega dados para edição
    setEditandoId(entrada.id);
    setSupplierRecord(null);
    setObs(entrada.note || "");
    setDate(entrada.date.split(" ")[0].split("/").reverse().join("-"));
    setItems([{ productId: "", productName: entrada.product, qty: String(entrada.qty), cost: "", lot: "", expiry: "" }]);
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    resetForm();
  };

  // Lista de últimas entradas
  const [movements, setMovements] = useState<Movement[]>([]);
  useEffect(() => {
    let mounted = true;
    api.get("/api/stock/movements?limit=50")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => {
        if (!mounted) return;
        setMovements(
          (d.movements ?? [])
            .filter(m => m.type === "ENTRADA")
            .slice(0, 6)
            .map(m => ({
              id:            m.id,
              date:          fmtDate(m.createdAt),
              product:       m.productName,
              type:          "entrada",
              qty:           m.quantity,
              balanceBefore: m.balanceBefore,
              balanceAfter:  m.balanceAfter,
              user:          m.createdByName ?? "—",
              note:          m.origem,
            }))
        );
      })
      .catch(() => { if (mounted) setMovements([]); });
    return () => { mounted = false; };
  }, []);

  const ultimasEntradas = movements;

  if (!showForm) {
    return (
      <div className="space-y-5 w-full">
        {/* Alerta de baixa automática */}
        {alertaBaixa && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 max-w-4xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-800 leading-relaxed">{alertaBaixa}</p>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={() => setAlertaBaixa(null)} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Entendido</button>
                <a href="/admin/financial" className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1">
                  Ir para a conta <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Últimas entradas</h3>
          <Button onClick={() => setShowForm(true)} className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ultimasEntradas.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState icon={ArrowUpCircle} title="Nenhuma entrada" desc="Clique em 'Adicionar' para registrar uma nova entrada." />
            </div>
          ) : (
            ultimasEntradas.map(m => (
              <Card key={m.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <ArrowUpCircle className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.product}</span>
                        <span className="text-xs bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full shrink-0">Entrada</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>• {m.user}</span>
                        {m.note && <span className="truncate">• {m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="font-bold text-sm text-emerald-600">+{m.qty} un</span>
                      <button onClick={() => handleEditar(m)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-6xl">
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Dados da entrada</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Fornecedor</Label>
            <SupplierCombobox value={supplierRecord} onChange={setSupplierRecord} error={entradaErrors.supplier} /></div>
          {sectors.length > 0 && (
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${entradaErrors.sector ? "text-destructive" : "text-muted-foreground"}`}>Setor de destino *</Label>
              <SectorSelect sectors={sectors} value={sectorId} onChange={setSectorId} required error={entradaErrors.sector} />
            </div>
          )}
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Nº da Nota Fiscal</Label>
            <Input placeholder="Ex: 00123" value={nf} onChange={e => setNf(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Data de entrada</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observações</Label>
            <Input placeholder="Anotações adicionais" value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos</CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={addItem}><Plus className="w-3.5 h-3.5" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_90px_90px_110px_36px] gap-2 items-start">
              <ProductCombobox
                value={it.productId ? { id: it.productId, name: it.productName, sku: null, stock: 0 } : null}
                onChange={p => setItemProduct(i, p)}
                error={entradaErrors.products && !it.productId}
              />
              <Input placeholder="Qtd" type="number" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Custo" type="number" value={it.cost} onChange={e => setItem(i, "cost", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input placeholder="Lote" value={it.lot} onChange={e => setItem(i, "lot", e.target.value)} className="h-9 rounded-xl text-sm" />
              <Input type="date" value={it.expiry} onChange={e => setItem(i, "expiry", e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <span className="text-sm text-muted-foreground">Subtotal dos itens</span>
            <span className="font-bold text-lg">R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pagamento */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Pagamento / Contas a pagar</CardTitle>
            <span className="text-xs bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full font-medium">Financeiro</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Forma de pagamento</Label>
              <div className="relative">
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Parcelas</Label>
              <div className="relative">
                <select value={installments} onChange={e => setInstallments(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                  {["1","2","3","4","5","6","7","8","9","10","11","12"].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Data de vencimento</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-10 rounded-xl" />
            </div>
          </div>

          {/* Resumo financeiro */}
          <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total da nota</span>
              <span className="font-semibold">R$ {total.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Parcelas</span>
              <span className="font-semibold">{installments}x de R$ {parcelValue.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Forma</span>
              <span className="font-semibold">{payMethod}</span>
            </div>
            {dueDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vencimento 1ª parcela</span>
                <span className="font-semibold">{new Date(dueDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </div>

          {/* Toggle financeiro */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setSendToFinancial(v => !v)}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${sendToFinancial ? "bg-primary" : "bg-secondary border border-border"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${sendToFinancial ? "translate-x-4.5" : ""}`} />
            </div>
            <span className="text-sm">Lançar no financeiro (contas a pagar)</span>
          </label>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl gap-2" onClick={handleCancelar}><ArrowLeftRight className="w-4 h-4 rotate-180" />Voltar</Button>
          <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleSave} disabled={entradaSaving}>
            {entradaSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
              : saved
                ? <><Check className="w-4 h-4" />{editandoId ? "Atualizado!" : "Confirmado!"}</>
                : <><CheckCircle2 className="w-4 h-4" />{editandoId ? "Salvar alterações" : "Confirmar entrada"}</>}
          </Button>
        </div>
        {entradaApiError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{entradaApiError}</p>
        )}
      </div>
    </div>
  );
}

// ─── SEÇÃO: SAÍDA ─────────────────────────────────────────────────
const EXIT_TYPES = ["Venda", "Perda", "Uso interno", "Troca", "Avaria"];

export function SecaoSaida() {
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alertaBaixa, setAlertaBaixa] = useState<string | null>(null);
  const [items, setItems] = useState<ExitItem[]>([{ productId: "", productName: "", qty: "" }]);
  const [tipo, setTipo] = useState("Venda");
  const [sectorId, setSectorId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saidaErrors, setSaidaErrors] = useState<{ sector?: boolean; products?: boolean }>({});
  const sectors = useSectors();

  const addItem = () => setItems(v => [...v, { productId: "", productName: "", qty: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: keyof ExitItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const setItemProduct = (i: number, p: { id: string; name: string; sku: string | null; stock: number } | null) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: p?.id ?? "", productName: p?.name ?? "" } : it));

  const resetForm = () => {
    setItems([{ productId: "", productName: "", qty: "" }]);
    setTipo("Venda");
    setSectorId("");
    setResponsavel("");
    setObs("");
    setEditandoId(null);
  };

  const EXIT_TYPE_MAP: Record<string, string> = {
    Venda: "SAIDA", Perda: "PERDA", "Uso interno": "SAIDA", Troca: "SAIDA", Avaria: "AVARIA",
  };

  const handleSave = async () => {
    const validItems = items.filter(it => it.productId && parseFloat(it.qty) > 0);
    const errs: { sector?: boolean; products?: boolean } = {};
    if (validItems.length === 0)          errs.products = true;
    if (!sectorId && sectors.length > 0)  errs.sector   = true;
    if (Object.keys(errs).length > 0) { setSaidaErrors(errs); return; }
    setSaidaErrors({});
    setApiError(null);
    setSaving(true);
    try {
      const res = await api.post("/api/stock/exit", {
        sectorId:    sectorId || undefined,
        tipo:        EXIT_TYPE_MAP[tipo] ?? "SAIDA",
        responsavel: responsavel || undefined,
        obs:         obs || undefined,
        items:       validItems.map(it => ({
          productId:   it.productId,
          productName: it.productName,
          qty:         parseFloat(it.qty),
        })),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setSaved(true);
        setTimeout(() => { setSaved(false); setShowForm(false); resetForm(); }, 2000);
      } else {
        setApiError(data.error ?? "Erro ao registrar saída. Tente novamente.");
      }
    } catch {
      setApiError("Erro de conexão. Verifique sua internet.");
    } finally {
      setSaving(false);
    }
  };

  // Movimentações sem contrapartida financeira: imutáveis após criação.
  // Apenas saídas de venda/uso/troca (type "saida") podem ter edição.
  const isFinancialExit = (m: Movement) => m.type === "saida";

  const handleEditar = (saida: Movement) => {
    // Guard: ajustes de inventário (perda/avaria/ajuste) não têm registro financeiro
    // associado e são imutáveis para garantir a trilha de auditoria.
    if (!isFinancialExit(saida)) return;

    // Verifica se a forma de pagamento tem baixa automática (vendas em dinheiro/pix)
    const formaPagtoMock = "Dinheiro"; // Na prática viria do registro real
    const temBaixaAutomatica = BAIXA_AUTOMATICA.includes(formaPagtoMock);

    if (temBaixaAutomatica) {
      setAlertaBaixa(`Esta saída foi recebida em ${formaPagtoMock} e já foi baixada no financeiro (Contas a Receber). Para editar, primeiro desfaça a baixa no módulo Financeiro.`);
      return;
    }

    // Carrega dados para edição
    setEditandoId(saida.id);
    setObs(saida.note || "");
    setItems([{ productId: "", productName: saida.product, qty: String(saida.qty) }]);
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    resetForm();
  };

  // Lista de últimas saídas
  const [saidaMovs, setSaidaMovs] = useState<Movement[]>([]);
  useEffect(() => {
    let mounted = true;
    api.get("/api/stock/movements?limit=50")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => {
        if (!mounted) return;
        setSaidaMovs(
          (d.movements ?? [])
            .filter(m => ["SAIDA", "VENDA", "PERDA", "AVARIA"].includes(m.type))
            .slice(0, 6)
            .map(m => ({
              id:            m.id,
              date:          fmtDate(m.createdAt),
              product:       m.productName,
              type:          dbTypeToKey(m.type),
              qty:           m.quantity,
              balanceBefore: m.balanceBefore,
              balanceAfter:  m.balanceAfter,
              user:          m.createdByName ?? "—",
              note:          m.origem,
            }))
        );
      })
      .catch(() => { if (mounted) setSaidaMovs([]); });
    return () => { mounted = false; };
  }, []);
  const ultimasSaidas = saidaMovs;

  if (!showForm) {
    return (
      <div className="space-y-5 w-full">
        {/* Alerta de baixa automática */}
        {alertaBaixa && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 max-w-4xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-800 leading-relaxed">{alertaBaixa}</p>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={() => setAlertaBaixa(null)} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Entendido</button>
                <a href="/admin/financial" className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1">
                  Ir para a conta <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Últimas saídas</h3>
          <Button onClick={() => setShowForm(true)} className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ultimasSaidas.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState icon={ArrowDownCircle} title="Nenhuma saída" desc="Clique em 'Adicionar' para registrar uma nova saída." />
            </div>
          ) : (
            ultimasSaidas.map(m => (
              <Card key={m.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.type === "perda" ? "bg-destructive/15" : "bg-blue-500/15"}`}>
                      {m.type === "perda"
                        ? <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
                        : <ArrowDownCircle className="w-4.5 h-4.5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.product}</span>
                        {m.type === "perda"
                          ? <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full shrink-0">Perda / Avaria</span>
                          : <span className="text-xs bg-blue-500/15 text-blue-600 px-2 py-0.5 rounded-full shrink-0">Saída</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>• {m.user}</span>
                        {m.note && <span className="truncate">• {m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="font-bold text-sm text-rose-600">-{m.qty} un</span>
                      {/* Apenas saídas com vínculo financeiro (venda/uso/troca) são editáveis */}
                      {isFinancialExit(m) && (
                        <button onClick={() => handleEditar(m)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-6xl">
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Dados da saída</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de saída</Label>
            <div className="relative">
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
                {EXIT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          {sectors.length > 0 && (
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${saidaErrors.sector ? "text-destructive" : "text-muted-foreground"}`}>Setor de origem *</Label>
              <SectorSelect sectors={sectors} value={sectorId} onChange={setSectorId} required error={saidaErrors.sector} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Responsável</Label>
            <Input placeholder="Responsável" value={responsavel} onChange={e => setResponsavel(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
            <Input placeholder="Motivo, pedido relacionado..." value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos</CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={addItem}><Plus className="w-3.5 h-3.5" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_36px] gap-2 items-center">
              <ProductCombobox
                value={it.productId ? { id: it.productId, name: it.productName, sku: null, stock: 0 } : null}
                onChange={p => setItemProduct(i, p)}
                error={saidaErrors.products && !it.productId}
              />
              <Input placeholder="Qtd" type="number" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl gap-2" onClick={handleCancelar}><ArrowLeftRight className="w-4 h-4 rotate-180" />Voltar</Button>
          <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
              : saved
                ? <><Check className="w-4 h-4" />{editandoId ? "Atualizado!" : "Registrado!"}</>
                : <><ArrowDownCircle className="w-4 h-4" />{editandoId ? "Salvar alterações" : "Confirmar saída"}</>}
          </Button>
        </div>
        {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{apiError}</p>}
      </div>
    </div>
  );
}

// ─── SEÇÃO: TRANSFERÊNCIAS ────────────────────────────────────────
interface TransferProductItem { productId: string; productName: string; qty: string }

export function SecaoTransferencias() {
  const sectors = useSectors();
  const [sourceSectorId,      setSourceSectorId]      = useState("");
  const [destinationSectorId, setDestinationSectorId] = useState("");
  const [obs,    setObs]    = useState("");
  const [items,  setItems]  = useState<TransferProductItem[]>([{ productId: "", productName: "", qty: "" }]);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors]    = useState<{ source?: boolean; destination?: boolean; products?: boolean }>({});

  const addItem    = () => setItems(v => [...v, { productId: "", productName: "", qty: "" }]);
  const removeItem = (i: number) => setItems(v => v.filter((_, idx) => idx !== i));
  const setItemProduct = (i: number, p: { id: string; name: string; sku: string | null; stock: number } | null) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: p?.id ?? "", productName: p?.name ?? "" } : it));
  const setItemQty = (i: number, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: v } : it));

  const resetForm = () => {
    setSourceSectorId(""); setDestinationSectorId(""); setObs("");
    setItems([{ productId: "", productName: "", qty: "" }]);
    setErrors({});
  };

  const handleTransfer = async () => {
    const validItems = items.filter(it => it.productId && parseFloat(it.qty) > 0);
    const errs: typeof errors = {};
    if (!sourceSectorId)                             errs.source      = true;
    if (!destinationSectorId)                        errs.destination = true;
    if (validItems.length === 0)                     errs.products    = true;
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (sourceSectorId === destinationSectorId) {
      setApiError("Setor de origem e destino devem ser diferentes");
      return;
    }
    setErrors({});
    setApiError(null);
    setSaving(true);

    try {
      const res  = await api.post("/api/stock/transfer", {
        sourceSectorId,
        destinationSectorId,
        obs: obs || undefined,
        items: validItems.map(it => ({
          productId:   it.productId,
          productName: it.productName,
          qty:         parseFloat(it.qty),
        })),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setSaved(true);
        setTimeout(() => { setSaved(false); resetForm(); }, 2200);
      } else {
        setApiError(data.error ?? "Erro ao registrar transferência.");
      }
    } catch {
      setApiError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  if (sectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhum setor cadastrado"
          desc="Cadastre ao menos dois setores em Configurações → Setores para habilitar transferências."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-3xl">
      <p className="text-sm text-muted-foreground">Mova itens de um setor para outro. A quantidade sai do setor de origem e entra no setor de destino.</p>

      {/* Setores */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Setores</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <div className="space-y-1.5">
            <Label className={`text-xs font-semibold uppercase ${errors.source ? "text-destructive" : "text-muted-foreground"}`}>Setor de origem *</Label>
            <SectorSelect sectors={sectors} value={sourceSectorId} onChange={setSourceSectorId} required error={errors.source} placeholder="Selecione origem..." />
          </div>
          <div className="hidden sm:flex items-center justify-center mt-5">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={`text-xs font-semibold uppercase ${errors.destination ? "text-destructive" : "text-muted-foreground"}`}>Setor de destino *</Label>
            <SectorSelect sectors={sectors} value={destinationSectorId} onChange={setDestinationSectorId} required error={errors.destination} placeholder="Selecione destino..." />
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos a transferir</CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={addItem}><Plus className="w-3.5 h-3.5" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_36px] gap-2 items-center">
              <ProductCombobox
                value={it.productId ? { id: it.productId, name: it.productName, sku: null, stock: 0 } : null}
                onChange={p => setItemProduct(i, p)}
                error={errors.products && !it.productId}
              />
              <Input placeholder="Qtd" type="number" min="0.001" step="any" value={it.qty} onChange={e => setItemQty(i, e.target.value)} className="h-9 rounded-xl text-sm" />
              <button onClick={() => removeItem(i)} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="pt-2">
            <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
              <Input placeholder="Motivo da transferência..." value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleTransfer} disabled={saving}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
            : saved
              ? <><Check className="w-4 h-4" />Transferido!</>
              : <><ArrowLeftRight className="w-4 h-4" />Confirmar transferência</>}
        </Button>
        {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{apiError}</p>}
      </div>
    </div>
  );
}

// ─── SEÇÃO: EXTRATO ───────────────────────────────────────────────
export function SecaoExtrato() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [movements, setMovements] = useState<Movement[]>([]);
  useEffect(() => {
    let mounted = true;
    api.get("/api/stock/movements?limit=500")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => {
        if (!mounted) return;
        setMovements(
          (d.movements ?? []).map(m => ({
            id:            m.id,
            date:          fmtDate(m.createdAt),
            product:       m.productName,
            type:          dbTypeToKey(m.type),
            qty:           m.quantity,
            balanceBefore: m.balanceBefore,
            balanceAfter:  m.balanceAfter,
            user:          m.createdByName ?? "—",
            note:          m.origem,
          }))
        );
      })
      .catch(() => { if (mounted) setMovements([]); });
    return () => { mounted = false; };
  }, []);

  const filtered = movements.filter(m => {
    const matchSearch = m.product.toLowerCase().includes(search.toLowerCase()) || m.note.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "todos" || m.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar produto" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["todos", "entrada", "saida", "ajuste", "transferencia", "perda"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filterType === t ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {t === "todos" ? "Todos" : MOV_TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
          <Button variant="outline" size="sm" className="rounded-xl h-8 gap-1.5"><Download className="w-3.5 h-3.5" />Exportar</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma movimentação" desc="Sem resultados para os filtros selecionados." />
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const cfg = MOV_TYPE_CONFIG[m.type] ?? { label: m.type, color: "text-foreground", bg: "bg-secondary", icon: Activity };
            const Icon = cfg.icon;
            const positive = m.qty > 0;
            return (
              <Card key={m.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{m.product}</span>
                        <MovTypeBadge type={m.type} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{m.date}</span>
                        <span>Por {m.user}</span>
                        {m.note && <span className="truncate">{m.note}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold text-base ${positive ? "text-emerald-600" : "text-destructive"}`}>
                        {positive ? "+" : ""}{m.qty} un
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.balanceBefore} → {m.balanceAfter}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SEÇÃO: BALANÇO ───────────────────────────────────────────────
interface BalancoItemJson {
  productId: string;
  productName: string;
  sku: string | null;
  systemStock: number;
  counted: number | null;
  diff: number | null;
  costPrice: number | null;
  unit: string;
}

interface BalancoRecord {
  id: string;
  codigo: string;
  prodScope: string;
  preco: string;
  dataContagem: string;
  dataEncerramento: string | null;
  status: "aberto" | "em_aberto" | "encerrado";
  items: BalancoItemJson[];
  createdByName: string | null;
  createdAt: string;
}

interface BalanceProduct {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  costPrice: number | null;
  unit: string;
}

function gerarCodigo() {
  const n = Math.floor(100000000 + Math.random() * 900000000);
  return `${String(n).slice(0,3)}.${String(n).slice(3,6)}.${String(n).slice(6,9)}`;
}

export function SecaoInventario() {
  // ── Produtos reais da API ──
  const [realProducts, setRealProducts] = useState<BalanceProduct[]>([]);
  const [loadingProds, setLoadingProds] = useState(false);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setLoadingProds(true);
    fetch(`/api/products/list?storeId=${storeId}`)
      .then(r => r.json())
      .then((d: { products?: Array<{ id: string; name: string; sku?: string | null; stock?: number | null; costPrice?: string | null; unit?: string | null; active?: boolean }> }) => {
        const active = (d.products ?? []).filter(p => p.active !== false);
        setRealProducts(active.map(p => ({
          id:        p.id,
          name:      p.name,
          sku:       p.sku   ?? null,
          stock:     p.stock ?? 0,
          costPrice: p.costPrice ? parseFloat(p.costPrice) : null,
          unit:      p.unit  ?? "un",
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingProds(false));
  }, []);

  // ── Balanços persistidos ──
  const [balancos, setBalancos] = useState<BalancoRecord[]>([]);
  const [loadingBalancos, setLoadingBalancos] = useState(false);

  const fetchBalancos = () => {
    setLoadingBalancos(true);
    api.get("/api/balances/list")
      .then(r => r.json())
      .then((d: { balances?: BalancoRecord[] }) => setBalancos(d.balances ?? []))
      .catch(() => {})
      .finally(() => setLoadingBalancos(false));
  };

  useEffect(fetchBalancos, []);

  // ── form state ──
  const [view, setView] = useState<"lista" | "novo">("lista");
  const [prodScope, setProdScope] = useState<"todos" | "alguns">("todos");
  const [preco, setPreco] = useState("Preço de custo");
  const [dataContagem, setDataContagem] = useState(new Date().toISOString().split("T")[0]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [addSearch, setAddSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // ── etapas: edição, conferência, encerramento e reabertura ──
  const [editingBalance, setEditingBalance] = useState<BalancoRecord | null>(null);
  const [conferido, setConferido] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [encerrarError, setEncerrarError] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [reabrirError, setReabrirError] = useState<string | null>(null);

  const setCount = (id: string, v: string) => setCounts(prev => ({ ...prev, [id]: v }));

  const visibleProducts = prodScope === "todos"
    ? realProducts
    : realProducts.filter(p => selectedIds.includes(p.id));

  const filteredAdd = realProducts.filter(p =>
    !selectedIds.includes(p.id) &&
    (p.name.toLowerCase().includes(addSearch.toLowerCase()) ||
     (p.sku ?? "").toLowerCase().includes(addSearch.toLowerCase()))
  );

  const divergencias = visibleProducts.filter(p => {
    if (prodScope === "todos") {
      const c = parseInt(counts[p.id] || "");
      return isNaN(c) || c !== p.stock;
    }
    const c = parseInt(counts[p.id] || "");
    return !isNaN(c) && c !== p.stock;
  });

  const resetForm = () => {
    setProdScope("todos"); setPreco("Preço de custo");
    setDataContagem(new Date().toISOString().split("T")[0]);
    setCounts({}); setSelectedIds([]);
    setSaveError(null); setSavedOk(false);
    setEditingBalance(null); setConferido(false);
    setEncerrarError(null); setReabrirError(null);
  };

  // Carrega um balanço salvo no formulário para continuar a contagem
  const handleEditar = (b: BalancoRecord) => {
    setEditingBalance(b);
    setProdScope(b.prodScope as "todos" | "alguns");
    setDataContagem(
      b.dataContagem
        ? new Date(b.dataContagem).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    );
    const savedCounts: Record<string, string> = {};
    const savedIds: string[] = [];
    for (const item of b.items ?? []) {
      if (item.counted !== null) savedCounts[item.productId] = String(item.counted);
      savedIds.push(item.productId);
    }
    setCounts(savedCounts);
    setSelectedIds(b.prodScope === "alguns" ? savedIds : []);
    setConferido(false);
    setSaveError(null);
    setEncerrarError(null);
    setSavedOk(false);
    setView("novo");
  };

  // Constrói o array de itens a partir do estado atual do formulário
  const buildItems = () =>
    visibleProducts.map(p => {
      const rawCounted = counts[p.id];
      const efectivo = prodScope === "todos" ? (rawCounted ?? "0") : (rawCounted ?? "");
      const counted = efectivo !== "" ? parseInt(efectivo) : null;
      const diff = counted !== null ? counted - p.stock : null;
      return {
        productId: p.id, productName: p.name, sku: p.sku,
        systemStock: p.stock, counted, diff,
        costPrice: p.costPrice, unit: p.unit,
      };
    });

  // Salva progresso sem alterar estoque (status sempre em_aberto)
  const handleSalvar = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const items = buildItems();
      let res: Response;
      if (editingBalance) {
        res = await api.post("/api/balances/update", {
          balanceId:    editingBalance.id,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
      } else {
        res = await api.post("/api/balances/create", {
          codigo:       gerarCodigo(),
          prodScope, preco,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
      }
      const data = await res.json() as { success?: boolean; balance?: BalancoRecord; error?: string };
      if (res.ok && data.balance) {
        if (editingBalance) {
          setBalancos(prev => prev.map(b => b.id === data.balance!.id ? data.balance! : b));
        } else {
          setBalancos(prev => [data.balance!, ...prev]);
        }
        setEditingBalance(data.balance!);
        setConferido(false); // requer nova conferência após salvar novos dados
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
      } else {
        setSaveError(data.error ?? "Erro ao salvar balanço. Tente novamente.");
      }
    } catch {
      setSaveError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // Encerra o balanço: salva estado atual + consolida estoque (ACID)
  const handleEncerrarDefinitivo = async () => {
    if (!conferido || encerrando) return;
    setEncerrarError(null);
    setEncerrando(true);
    try {
      const items = buildItems();

      // 1. Garantir que o estado mais recente está salvo no DB
      let balanceId: string;
      if (editingBalance) {
        const upRes = await api.post("/api/balances/update", {
          balanceId: editingBalance.id,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
        const upData = await upRes.json() as { success?: boolean; error?: string };
        if (!upRes.ok) { setEncerrarError(upData.error ?? "Erro ao salvar antes de encerrar"); return; }
        balanceId = editingBalance.id;
      } else {
        const crRes = await api.post("/api/balances/create", {
          codigo: gerarCodigo(),
          prodScope, preco,
          dataContagem: dataContagem + "T00:00:00.000Z",
          items,
        });
        const crData = await crRes.json() as { success?: boolean; balance?: BalancoRecord; error?: string };
        if (!crRes.ok || !crData.balance) { setEncerrarError(crData.error ?? "Erro ao criar balanço"); return; }
        balanceId = crData.balance.id;
        setBalancos(prev => [crData.balance!, ...prev]);
      }

      // 2. Encerrar via rota dedicada (consolida estoque em transação ACID)
      const res  = await api.post("/api/balances/encerrar", { balanceId });
      const data = await res.json() as {
        success?: boolean; balance?: BalancoRecord; correcoesGeradas?: number; error?: string;
      };
      if (res.ok && data.balance) {
        setBalancos(prev => prev.map(b => b.id === balanceId ? data.balance! : b));
        resetForm();
        setView("lista");
      } else {
        setEncerrarError(data.error ?? "Erro ao encerrar balanço");
      }
    } catch {
      setEncerrarError("Erro de conexão.");
    } finally {
      setEncerrando(false);
    }
  };

  // Reabre um balanço encerrado: reverte estoque e volta a em_aberto
  const handleReabrir = async () => {
    if (!editingBalance || reabrindo) return;
    const qtdDiverg = (editingBalance.items ?? []).filter(i => i.diff !== null && i.diff !== 0).length;
    const msg = qtdDiverg > 0
      ? `Reabrir vai reverter ${qtdDiverg} correção(ões) de estoque feita(s) no encerramento.\n\nOs produtos voltarão ao saldo anterior ao balanço.\n\nDeseja continuar?`
      : "Reabrir o balanço e voltar ao status Em aberto?";
    if (!confirm(msg)) return;
    setReabrirError(null);
    setReabrindo(true);
    try {
      const res  = await api.post("/api/balances/reabrir", { balanceId: editingBalance.id });
      const data = await res.json() as { success?: boolean; balance?: BalancoRecord; reversoesGeradas?: number; error?: string };
      if (res.ok && data.balance) {
        setBalancos(prev => prev.map(b => b.id === data.balance!.id ? data.balance! : b));
        setEditingBalance(data.balance!);
        setConferido(false);
        setSavedOk(false);
      } else {
        setReabrirError(data.error ?? "Erro ao reabrir balanço");
      }
    } catch {
      setReabrirError("Erro de conexão.");
    } finally {
      setReabrindo(false);
    }
  };

  const handleDelete = async (balanceId: string) => {
    if (!confirm("Excluir este balanço permanentemente?")) return;
    setDeletingId(balanceId);
    try {
      const res  = await api.post("/api/balances/delete", { balanceId });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setBalancos(prev => prev.filter(b => b.id !== balanceId));
      } else {
        alert(data.error ?? "Erro ao excluir balanço.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setDeletingId(null);
    }
  };


  const handleDownloadPDF = () => {
    const divergCount = visibleProducts.filter(p => { const ef = prodScope === "todos" ? (counts[p.id] ?? "0") : (counts[p.id] ?? ""); const c = parseInt(ef); return !isNaN(c) && c !== p.stock; }).length;
    const okCount = visibleProducts.filter(p => { const ef = prodScope === "todos" ? (counts[p.id] ?? "0") : (counts[p.id] ?? ""); const c = parseInt(ef); return !isNaN(c) && c === p.stock; }).length;
    const naoContado = visibleProducts.filter(p => { const ef = prodScope === "todos" ? (counts[p.id] ?? "0") : (counts[p.id] ?? ""); return ef === ""; }).length;
    const tableRows = visibleProducts.map((p, i) => {
      const raw = counts[p.id];
      const ef = prodScope === "todos" ? (raw ?? "0") : (raw ?? "");
      const counted = parseInt(ef);
      const diff = isNaN(counted) ? null : counted - p.stock;
      const diffStr = diff === null ? "—" : diff > 0 ? `<span style="color:#16a34a;font-weight:700">+${diff}</span>` : diff < 0 ? `<span style="color:#dc2626;font-weight:700">${diff}</span>` : `<span style="color:#6b7280">0</span>`;
      const stBg = diff === null ? "#f9fafb" : diff === 0 ? "#f0fdf4" : "#fefce8";
      const stColor = diff === null ? "#9ca3af" : diff === 0 ? "#16a34a" : "#d97706";
      const stLabel = diff === null ? "Não contado" : diff === 0 ? "OK" : "Divergente";
      return `<tr style="background:${i%2===0?"#fff":"#f9fafb"}"><td>${p.name}</td><td style="font-family:monospace;font-size:11px;color:#6b7280">${p.sku}</td><td style="text-align:center;font-weight:700">${p.stock}</td><td style="text-align:center;font-weight:700">${isNaN(counted) ? "—" : counted}</td><td style="text-align:center">${diffStr}</td><td style="text-align:center"><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${stBg};color:${stColor}">${stLabel}</span></td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Balanço de Estoque — ARMAZIX</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;color:#111827;-webkit-print-color-adjust:exact}
  .page{max-width:960px;margin:0 auto;padding:32px 28px}
  .header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px;background:linear-gradient(135deg,#00C853,#00e676);border-radius:16px;margin-bottom:24px;color:#fff}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px}.logo span{opacity:.7;font-weight:400}
  .header-meta{text-align:right;font-size:12px;opacity:.85;line-height:1.6}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .kpi{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px}
  .kpi-val{font-size:22px;font-weight:700;color:#111827;margin-bottom:2px}
  .kpi-label{font-size:11px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:.4px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px}
  .card-header{padding:14px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}
  .card-title{font-size:13px;font-weight:700;color:#111827}
  .card-meta{font-size:12px;color:#6b7280}
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
      <div class="logo">ARMAZIX <span></span></div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">Relatório de Balanço de Estoque</div>
    </div>
    <div class="header-meta">
      <div>Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
      <div>${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
      <div style="margin-top:4px;font-weight:600">Produtos: ${prodScope === "todos" ? "Todos" : "Selecionados"}</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${visibleProducts.length}</div><div class="kpi-label">Total de produtos</div></div>
    <div class="kpi" style="border-color:#bbf7d0"><div class="kpi-val" style="color:#16a34a">${okCount}</div><div class="kpi-label">Sem divergência</div></div>
    <div class="kpi" style="border-color:#fde68a"><div class="kpi-val" style="color:#d97706">${divergCount}</div><div class="kpi-label">Divergentes</div></div>
    <div class="kpi" style="border-color:#e5e7eb"><div class="kpi-val" style="color:#9ca3af">${naoContado}</div><div class="kpi-label">Não contados</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Lista de contagem</span><span class="card-meta">${visibleProducts.length} produto(s)</span></div>
    <table>
      <thead><tr><th>Produto</th><th>SKU</th><th style="text-align:center">Sistema</th><th style="text-align:center">Contado</th><th style="text-align:center">Diferença</th><th style="text-align:center">Status</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div class="footer">ARMAZIX &mdash; Balanço gerado automaticamente &mdash; ${new Date().toLocaleString("pt-BR")}</div>
</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `balanco-${new Date().toISOString().slice(0,10)}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    const rows = [
      ["Produto", "SKU", "Estoque sistema", "Contado", "Diferença"],
      ...visibleProducts.map(p => {
        const c = counts[p.id] ?? (prodScope === "todos" ? "0" : "");
        const diff = c !== "" ? parseInt(c) - p.stock : "—";
        return [p.name, p.sku, p.stock, c || (prodScope === "todos" ? "0" : ""), diff];
      }),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "balanco.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const [exportRowOpen, setExportRowOpen] = useState<string | null>(null);

  // ── Lista de balanços ──
  if (view === "lista") {
    const fmtDate = (iso: string | null) => iso
      ? new Date(iso).toLocaleDateString("pt-BR")
      : "—";

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Histórico de balanços realizados.</p>
          <Button className="rounded-xl gap-2 h-9 bg-gradient-primary text-primary-foreground"
            onClick={() => { resetForm(); setView("novo"); }}>
            <Plus className="w-4 h-4" />Novo Balanço
          </Button>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border/40">
                <tr>
                  {["Código", "Itens", "Produtos", "Data contagem", "Encerramento", "Criado por", "Status", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loadingBalancos ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando...
                  </td></tr>
                ) : balancos.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">Nenhum balanço registrado.</td></tr>
                ) : balancos.map(b => (
                  <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{b.codigo}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.items?.length ?? 0}</td>
                    <td className="px-4 py-3 text-xs capitalize">{b.prodScope === "todos" ? "Todos" : "Selecionados"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(b.dataContagem)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(b.dataEncerramento)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.createdByName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {b.status === "encerrado" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />Encerrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />Em aberto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {/* Editar — disponível para todos os balanços */}
                        <button onClick={() => handleEditar(b)}
                          className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 font-medium">
                          <Pencil className="w-3 h-3" />Editar
                        </button>
                        <div className="relative">
                          <button onClick={() => setExportRowOpen(v => v === b.id ? null : b.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1">
                            <Download className="w-3 h-3" />Exportar<ChevronDown className="w-2.5 h-2.5" />
                          </button>
                          {exportRowOpen === b.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-border/50 rounded-xl shadow-lg overflow-hidden min-w-[150px]">
                              <button onClick={() => { handleDownload(); setExportRowOpen(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 flex items-center gap-2">
                                <Download className="w-3 h-3" />Excel (.csv)
                              </button>
                              <button onClick={() => { handleDownloadPDF(); setExportRowOpen(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 flex items-center gap-2">
                                <FileText className="w-3 h-3" />PDF (download)
                              </button>
                            </div>
                          )}
                        </div>
                        {b.status !== "encerrado" && (
                          <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id}
                            className="text-xs px-2 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1 disabled:opacity-50">
                            {deletingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // ── Formulário Novo Balanço ──
  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">
            {editingBalance ? `Balanço — ${editingBalance.codigo}` : "Novo Balanço"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {!editingBalance && "Preencha a contagem, salve o progresso e encerre quando concluído"}
            {editingBalance?.status !== "encerrado" && editingBalance && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Em aberto — continue a contagem e encerre quando finalizar
              </span>
            )}
            {editingBalance?.status === "encerrado" && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Encerrado em {editingBalance.dataEncerramento ? new Date(editingBalance.dataEncerramento).toLocaleDateString("pt-BR") : "—"}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => { resetForm(); setView("lista"); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <X className="w-4 h-4" />Voltar
        </button>
      </div>

      {/* Banner: balanço encerrado */}
      {editingBalance?.status === "encerrado" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Este balanço está encerrado
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              As correções de estoque já foram aplicadas. Ao reabrir, <strong>{(editingBalance.items ?? []).filter(i => i.diff !== null && i.diff !== 0).length} ajuste(s) de estoque</strong> serão revertidos e o balanço voltará para <em>Em aberto</em> para que você possa continuar editando.
            </p>
            {reabrirError && (
              <p className="text-xs text-red-600 font-medium">{reabrirError}</p>
            )}
          </div>
          <button
            onClick={handleReabrir}
            disabled={reabrindo}
            className="shrink-0 h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            {reabrindo
              ? <><Loader2 className="w-4 h-4 animate-spin" />Reabrindo...</>
              : <><RefreshCw className="w-4 h-4" />Reabrir Balanço</>
            }
          </button>
        </div>
      )}

      {/* Configurações */}
      <Card className={`rounded-2xl border-border/50 shadow-soft ${editingBalance?.status === "encerrado" ? "opacity-60 pointer-events-none select-none" : ""}`}>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Configurações do balanço</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Produtos contados */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Produtos contados</Label>
            <div className="flex gap-2">
              <button onClick={() => { setProdScope("todos"); setSelectedIds([]); }}
                className={`flex-1 h-9 text-sm rounded-xl border font-medium transition-colors ${prodScope === "todos" ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}>
                Todos
              </button>
              <button onClick={() => setProdScope("alguns")}
                className={`flex-1 h-9 text-sm rounded-xl border font-medium transition-colors ${prodScope === "alguns" ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}>
                Alguns
              </button>
            </div>
            {prodScope === "todos" && (
              <p className="text-[11px] text-muted-foreground leading-snug">Produtos não informados na contagem terão estoque zerado.</p>
            )}
            {prodScope === "alguns" && (
              <p className="text-[11px] text-muted-foreground leading-snug">Apenas os produtos informados serão contabilizados.</p>
            )}
          </div>

          {/* Datas */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Data da contagem</Label>
              <Input type="date" value={dataContagem} onChange={e => setDataContagem(e.target.value)} className="h-9 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Encerramento</Label>
              <Input type="text" value={editingBalance?.dataEncerramento ? new Date(editingBalance.dataEncerramento).toLocaleDateString("pt-BR") : "Será preenchido ao encerrar"} disabled className="h-9 rounded-xl text-sm disabled:opacity-50 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adicionar produto (modo "alguns") */}
      {prodScope === "alguns" && (
        <Card className="rounded-2xl border-border/50 shadow-soft">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Adicionar produtos à contagem</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar produto por nome ou SKU..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
            </div>
            {addSearch.length > 0 && filteredAdd.length > 0 && (
              <div className="border border-border/40 rounded-xl overflow-hidden divide-y divide-border/30 max-h-40 overflow-y-auto">
                {filteredAdd.slice(0, 8).map(p => (
                  <button key={p.id} onClick={() => { setSelectedIds(v => [...v, p.id]); setAddSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedIds.map(id => {
                  const p = realProducts.find(x => x.id === id);
                  return p ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                      {p.name}
                      <button onClick={() => setSelectedIds(v => v.filter(x => x !== id))} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela de contagem */}
      <Card className={`rounded-2xl border-border/50 shadow-soft overflow-hidden ${editingBalance?.status === "encerrado" ? "opacity-60 pointer-events-none select-none" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Lista de contagem</CardTitle>
            {divergencias.length > 0 && (
              <Badge className="rounded-full bg-amber-500/15 text-amber-600 border-0 gap-1 text-[11px]">
                <AlertCircle className="w-3 h-3" />{divergencias.length} divergência(s)
              </Badge>
            )}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/40">
              <tr>
                {["Produto", "SKU", "Preço", "Un.", "Estoque sistema", "Contado", "Diferença"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loadingProds && prodScope === "todos" ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando produtos...
                </td></tr>
              ) : visibleProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {prodScope === "alguns" ? "Busque e adicione produtos acima." : "Nenhum produto ativo encontrado."}
                </td></tr>
              ) : visibleProducts.map(p => {
                const rawCounted = counts[p.id];
                const efectivo = prodScope === "todos" ? (rawCounted ?? "0") : (rawCounted ?? "");
                const counted = parseInt(efectivo);
                const diff = isNaN(counted) ? null : counted - p.stock;
                return (
                  <tr key={p.id} className={`transition-colors ${diff !== null && diff !== 0 ? "bg-amber-500/5" : "hover:bg-secondary/30"}`}>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {p.costPrice != null ? `R$ ${p.costPrice.toFixed(2).replace(".", ",")}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.unit}</td>
                    <td className="px-4 py-2.5 font-bold">{p.stock}</td>
                    <td className="px-4 py-2.5">
                      <Input type="number" placeholder={prodScope === "todos" ? "0" : "Contar..."} value={rawCounted ?? ""}
                        onChange={e => setCount(p.id, e.target.value)} className="h-8 w-24 rounded-lg text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      {diff === null ? <span className="text-muted-foreground text-xs">—</span> : (
                        <span className={`font-bold text-sm ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {visibleProducts.length > 0 && (
              <tfoot className="border-t border-border/40 bg-secondary/30">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    {visibleProducts.length} produto(s)
                  </td>
                  <td className="px-4 py-2.5 font-bold text-sm">
                    {visibleProducts.reduce((s, p) => s + p.stock, 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Etapas de ação — ocultas quando encerrado (reabertura é pelo banner acima) */}
      {editingBalance?.status === "encerrado" && (
        <div className="flex justify-end">
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm"
            onClick={() => { resetForm(); setView("lista"); }}>
            Voltar para lista
          </Button>
        </div>
      )}
      {editingBalance?.status !== "encerrado" && (
      <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etapas do balanço</p>
        <div className="flex flex-wrap gap-2">

          {/* ETAPA 1 — Salvar Progresso */}
          <Button
            variant="outline"
            className={`rounded-xl gap-1.5 h-9 text-sm ${savedOk ? "border-emerald-500 text-emerald-600" : ""}`}
            onClick={handleSalvar}
            disabled={saving}
            title="Salva o progresso sem alterar o estoque. Pode ser continuado depois."
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
              : savedOk
                ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" />Progresso salvo!</>
                : <><Check className="w-4 h-4" />1. Salvar Progresso</>
            }
          </Button>

          {/* ETAPA 2 — Conferir Itens */}
          <Button
            variant="outline"
            className={`rounded-xl gap-1.5 h-9 text-sm ${conferido ? "border-blue-500 text-blue-600" : ""}`}
            onClick={() => setConferido(true)}
            disabled={conferido}
            title="Processa as diferenças na tabela para auditoria visual. Não altera o estoque."
          >
            {conferido
              ? <><CheckCircle2 className="w-4 h-4 text-blue-500" />Itens conferidos</>
              : <><Eye className="w-4 h-4" />2. Conferir Itens</>
            }
          </Button>

          {/* ETAPA 3 — Encerrar Balanço */}
          <Button
            variant="outline"
            className={`rounded-xl gap-1.5 h-9 text-sm transition-colors ${
              conferido
                ? "border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                : "opacity-50 cursor-not-allowed"
            }`}
            onClick={handleEncerrarDefinitivo}
            disabled={!conferido || encerrando}
            title={!conferido ? "Execute a conferência antes de encerrar" : "Consolida o estoque e encerra o balanço (irreversível)"}
          >
            {encerrando
              ? <><Loader2 className="w-4 h-4 animate-spin" />Encerrando...</>
              : <><XCircle className="w-4 h-4" />3. Encerrar Balanço</>
            }
          </Button>

          {/* Ferramentas de exportação */}
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={() => window.print()}>
            <FileText className="w-4 h-4" />Imprimir
          </Button>
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />Excel
          </Button>
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" />PDF
          </Button>

          <div className="flex-1" />
          <Button variant="outline" className="rounded-xl gap-1.5 h-9 text-sm" onClick={() => { resetForm(); setView("lista"); }}>
            Cancelar
          </Button>
        </div>

        {/* Indicadores de progresso */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span className={`flex items-center gap-1 ${editingBalance ? "text-emerald-600 font-medium" : ""}`}>
            <span className={`w-2 h-2 rounded-full ${editingBalance ? "bg-emerald-500" : "bg-border"}`} />
            {editingBalance ? `Salvo — ${editingBalance.codigo}` : "Não salvo ainda"}
          </span>
          <span className={`flex items-center gap-1 ${conferido ? "text-blue-600 font-medium" : ""}`}>
            <span className={`w-2 h-2 rounded-full ${conferido ? "bg-blue-500" : "bg-border"}`} />
            {conferido ? `${divergencias.length} divergência(s) revisadas` : "Aguardando conferência"}
          </span>
        </div>

        {saveError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{saveError}</p>
        )}
        {encerrarError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{encerrarError}</p>
        )}
      </div>
      )}
    </div>
  );
}

// ─── SEÇÃO: AJUSTES ───────────────────────────────────────────────
const ADJUST_TYPES = ["Correção", "Perda", "Avaria"] as const;
type AjusteTipo = typeof ADJUST_TYPES[number];

export function SecaoAjustes() {
  const sectors = useSectors();
  const [productRecord, setProductRecord] = useState<{ id: string; name: string; sku: string | null; stock: number } | null>(null);
  const [sectorId, setSectorId]           = useState("");
  const [sectorBalance, setSectorBalance] = useState<number | null>(null);
  const [qty, setQty]     = useState("");
  const [tipo, setTipo]   = useState<AjusteTipo>("Correção");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs]     = useState("");
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [ajusteErrors, setAjusteErrors] = useState<{ product?: boolean; sector?: boolean; qty?: boolean }>({});
  const [adjustments, setAdjustments] = useState<DbAdjustment[]>([]);
  const [loadingAdj, setLoadingAdj]   = useState(false);

  // Busca saldo do setor quando produto + setor estão selecionados
  useEffect(() => {
    if (!productRecord?.id || !sectorId) { setSectorBalance(null); return; }
    api.get(`/api/stock/balances-by-sector?sectorId=${sectorId}&productId=${productRecord.id}`)
      .then(r => r.json())
      .then((d: { balances?: Array<{ quantity: string }> }) => {
        const bal = d.balances?.[0];
        setSectorBalance(bal ? Math.round(Number(bal.quantity)) : 0);
      })
      .catch(() => setSectorBalance(null));
  }, [productRecord?.id, sectorId]);

  // Saldo de referência para o preview: setor (se houver) ou global
  const referenceStock = sectorBalance !== null ? sectorBalance : (productRecord?.stock ?? 0);

  // Semântica muda conforme o tipo
  const isCorrecao = tipo === "Correção";
  const qtyLabel   = isCorrecao ? "Quantidade Real (Física)" : "Quantidade a Subtrair";
  const qtyPlaceholder = isCorrecao
    ? `Saldo real no setor (atual: ${referenceStock})`
    : "Ex: 3";

  // Limpa qty ao trocar de tipo para evitar confusão semântica
  const handleTipoChange = (t: AjusteTipo) => { setTipo(t); setQty(""); setAjusteErrors({}); };
  const handleProductChange = (p: typeof productRecord) => { setProductRecord(p); setSectorBalance(null); setQty(""); };

  // Bloqueia entrada de sinal negativo e notação científica
  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/-/g, "");
    setQty(val);
  };
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
  };

  const fetchAdjustments = useCallback(() => {
    setLoadingAdj(true);
    api.get("/api/stock/adjustments?limit=100")
      .then(r => r.json())
      .then((d: { adjustments?: DbAdjustment[] }) => setAdjustments(d.adjustments ?? []))
      .catch(() => {})
      .finally(() => setLoadingAdj(false));
  }, []);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);

  const handleAjuste = async () => {
    const errs: { product?: boolean; sector?: boolean; qty?: boolean } = {};
    if (!productRecord)                  errs.product = true;
    if (!sectorId && sectors.length > 0) errs.sector  = true;
    const qtyNum = parseInt(qty, 10);
    if (isCorrecao) {
      if (qty === "" || isNaN(qtyNum) || qtyNum < 0) errs.qty = true;
    } else {
      if (!qty || isNaN(qtyNum) || qtyNum <= 0) errs.qty = true;
    }
    if (Object.keys(errs).length > 0) { setAjusteErrors(errs); return; }
    setAjusteErrors({});
    setApiError(null);
    setSaving(true);

    try {
      const res  = await api.post("/api/stock/adjustment", {
        sectorId:     sectorId || undefined,
        productId:    productRecord!.id,
        productName:  productRecord!.name,
        qty:          qtyNum,
        tipo,
        motivo:       motivo || undefined,
        observations: obs    || undefined,
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (res.ok && data.success) {
        setSaved(true);
        setProductRecord(null); setSectorId(""); setSectorBalance(null);
        setQty(""); setMotivo(""); setObs(""); setTipo("Correção");
        setTimeout(() => setSaved(false), 2500);
        fetchAdjustments();
      } else {
        setApiError(data.error ?? "Erro ao registrar ajuste. Tente novamente.");
      }
    } catch {
      setApiError("Erro de conexão. Verifique sua internet.");
    } finally {
      setSaving(false);
    }
  };

  const qtyNum = parseInt(qty, 10);
  const previewDelta = !isNaN(qtyNum) && qty !== "" && productRecord
    ? isCorrecao
      ? qtyNum - referenceStock
      : -qtyNum
    : null;

  return (
    <div className="space-y-5 max-w-2xl">
      <p className="text-sm text-muted-foreground">Realize ajustes pontuais no estoque. Cada ajuste é registrado automaticamente no extrato.</p>
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base">Novo ajuste</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Produto</Label>
            <ProductCombobox value={productRecord} onChange={handleProductChange} error={ajusteErrors.product} /></div>
          {sectors.length > 0 && (
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${ajusteErrors.sector ? "text-destructive" : "text-muted-foreground"}`}>Setor *</Label>
              <SectorSelect sectors={sectors} value={sectorId} onChange={v => { setSectorId(v); setQty(""); }} required error={ajusteErrors.sector} />
              {sectorBalance !== null && (
                <p className="text-[11px] text-muted-foreground">Saldo neste setor: <span className="font-semibold text-foreground">{sectorBalance}</span> un</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de ajuste</Label>
              <div className="relative">
                <select
                  value={tipo}
                  onChange={e => handleTipoChange(e.target.value as AjusteTipo)}
                  className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ADJUST_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
              {/* Hint contextual abaixo do tipo */}
              <p className="text-[11px] text-muted-foreground leading-snug pt-0.5">
                {isCorrecao
                  ? "Informa o saldo físico real. O sistema calcula a diferença."
                  : "O valor digitado será subtraído do estoque atual."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase ${ajusteErrors.qty ? "text-destructive" : "text-muted-foreground"}`}>
                {qtyLabel}
              </Label>
              <div className="relative">
                {!isCorrecao && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-destructive pointer-events-none select-none">−</span>
                )}
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={qtyPlaceholder}
                  value={qty}
                  onChange={handleQtyChange}
                  onKeyDown={handleQtyKeyDown}
                  className={`h-10 rounded-xl ${!isCorrecao ? "pl-6" : ""} ${ajusteErrors.qty ? "border-destructive" : ""}`}
                />
              </div>
              {/* Preview do resultado */}
              {previewDelta !== null && (
                <p className={`text-[11px] font-medium leading-snug pt-0.5 ${previewDelta > 0 ? "text-emerald-600" : previewDelta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {isCorrecao
                    ? previewDelta > 0
                      ? `↑ Acréscimo de ${previewDelta} un (${referenceStock} → ${qtyNum})`
                      : previewDelta < 0
                        ? `↓ Redução de ${Math.abs(previewDelta)} un (${referenceStock} → ${qtyNum})`
                        : "Saldo igual ao atual, nenhuma alteração."
                    : `↓ Subtração de ${qtyNum} un (${referenceStock} → ${Math.max(0, referenceStock - qtyNum)})`
                  }
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Motivo</Label>
            <Input placeholder="Descreva o motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
            <Input placeholder="Detalhes adicionais" value={obs} onChange={e => setObs(e.target.value)} className="h-10 rounded-xl" /></div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <Button className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground" onClick={handleAjuste} disabled={saving}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
            : saved
              ? <><Check className="w-4 h-4" />Ajuste registrado!</>
              : <><Settings2 className="w-4 h-4" />Registrar ajuste</>}
        </Button>
        {apiError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{apiError}</p>
        )}
      </div>

      {/* Histórico de ajustes */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Histórico de ajustes</h3>
          <button onClick={fetchAdjustments} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />Atualizar
          </button>
        </div>
        {loadingAdj ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />Carregando...
          </div>
        ) : adjustments.length === 0 ? (
          <EmptyState icon={Settings2} title="Nenhum ajuste" desc="Os ajustes manuais registrados aparecerão aqui." />
        ) : (
          <div className="relative pl-6 space-y-0 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
            {adjustments.map(a => {
              const isPositive = a.qty > 0;
              return (
                <div key={a.id} className="relative pb-4">
                  <div className={`absolute -left-[19px] w-4 h-4 rounded-full ${isPositive ? "bg-emerald-500/15" : "bg-destructive/15"} border-2 border-background flex items-center justify-center`}>
                    <Settings2 className={`w-2 h-2 ${isPositive ? "text-emerald-600" : "text-destructive"}`} />
                  </div>
                  <div className="pl-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.productName}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-600">{a.tipo}</span>
                      <span className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
                        {isPositive ? "+" : ""}{a.qty} un
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(a.createdAt)}</span>
                      {a.createdByName && <span>Por {a.createdByName}</span>}
                      {a.motivo && <span>{a.motivo}</span>}
                      <span>Saldo: {a.balanceBefore} → {a.balanceAfter}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SEÇÃO: HISTÓRICO ─────────────────────────────────────────────
export function SecaoHistorico() {
  const [search, setSearch] = useState("");
  const [movements, setMovements] = useState<DbMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMovements = () => {
    setLoading(true);
    api.get("/api/stock/movements?limit=200")
      .then(r => r.json())
      .then((d: { movements?: DbMovement[] }) => setMovements(d.movements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchMovements, []);

  const filtered = movements.filter(m =>
    m.productName.toLowerCase().includes(search.toLowerCase()) ||
    (m.createdByName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    m.origem.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por produto ou usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5"><Download className="w-3.5 h-3.5" />Exportar log</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />Carregando movimentações...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title="Sem registros" desc="Nenhuma movimentação de estoque registrada ainda." />
      ) : (
        <div className="relative pl-6 space-y-0 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
          {filtered.map(m => {
            // DB usa uppercase (ENTRADA, VENDA, AJUSTE); config usa lowercase
            const typeKey = m.type.toLowerCase();
            const cfg = MOV_TYPE_CONFIG[typeKey] ?? MOV_TYPE_CONFIG[
              typeKey === "venda" ? "saida" : typeKey === "perda" || typeKey === "avaria" ? "perda" : "ajuste"
            ] ?? { label: m.type, color: "text-foreground", bg: "bg-secondary", icon: Activity };
            const Icon    = cfg.icon;
            // Entradas aumentam estoque; vendas/saídas/perdas reduzem
            const isPositive = ["entrada", "ENTRADA"].includes(m.type) || m.balanceAfter > m.balanceBefore;
            const displayQty = isPositive ? `+${m.quantity}` : `-${m.quantity}`;
            const fmtDate = new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

            return (
              <div key={m.id} className="relative pb-5">
                <div className={`absolute -left-[19px] w-4 h-4 rounded-full ${cfg.bg} border-2 border-background flex items-center justify-center`}>
                  <Icon className={`w-2 h-2 ${cfg.color}`} />
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{m.productName}</span>
                    <MovTypeBadge type={typeKey} />
                    <span className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
                      {displayQty} un
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate}</span>
                    {m.createdByName && <span>Por {m.createdByName}</span>}
                    <span className="text-muted-foreground/70">{m.origem}</span>
                    <span>Saldo: {m.balanceBefore} → {m.balanceAfter}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
        ? fetch(`/api/products/list?storeId=${storeId}`).then(r => r.json())
        : Promise.resolve({ products: [] }),
      storeId
        ? fetch(`/api/categories/list?storeId=${storeId}`).then(r => r.json())
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
  const totalValue   = kpiProducts.filter(p => p.stock > 0).reduce((s, p) => s + p.stock * p.costPrice, 0);
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
      <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Análise por produto</CardTitle>
            {!loadingInit && <span className="text-xs text-muted-foreground">{tableProducts.length} produto(s)</span>}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
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
                      className="w-4 h-4 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors flex items-center justify-center text-[10px] font-bold leading-none"
                      aria-label="Explicação sobre Risco"
                    >
                      ?
                    </button>
                    {riscoTooltip && (
                      <div className="absolute z-30 top-full left-0 mt-2 w-72 bg-popover border border-border rounded-xl shadow-xl p-4 text-left font-normal">
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
                const vt    = p.stock * p.costPrice;
                const giro  = p.stock < 0 ? "Negativo" : p.stock > 50 ? "Alto" : p.stock > 15 ? "Médio" : "Baixo";
                const risco = p.stock < 0 ? "Negativo" : p.stock === 0 ? "Ruptura" : p.stock <= p.minStock ? "Atenção" : "Normal";
                return (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.sku}</td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${p.stock < 0 ? "text-red-600" : ""}`}>{p.stock}</td>
                    <td className="px-4 py-3 text-muted-foreground">R$ {p.costPrice.toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 font-semibold">R$ {vt.toFixed(2).replace(".", ",")}</td>
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

// ─── LAYOUT ────────────────────────────────────────────────────────
function StockPage() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Central de controle de estoque e movimentações</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3.5 h-3.5" />Atualizar
        </Button>
      </div>
      <Outlet />
    </div>
  );
}
