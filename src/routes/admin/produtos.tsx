import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Plus, Search, Package,
  Hash, LayoutGrid, List, Check,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Pencil, FileDown, Percent, X,
} from "lucide-react";
import { type PromoConfig, getEffectivePrice } from "@/lib/promo-engine";
import { escapeHtml } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const ProductFormModal = lazy(() => import("./-modal-produto"));

export const Route = createFileRoute("/admin/produtos")({
  component: ProductsPage,
  head: () => ({
    meta: [{ title: "Produtos — ARMAZIX" }],
  }),
});

// ─── Types ───────────────────────────────────────────────────────
export type ProductImage = { id: string; url: string; isPrimary: boolean };

export type ProductType = "Produto" | "Insumo e Composição" | "Serviço e Taxa de entrega";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  costPrice: string | null;
  stock: number | null;
  lowStockThreshold: number | null;
  sku: string | null;
  barcode: string | null;
  pdvCode: string | null;
  unit: string | null;
  emoji: string | null;
  imageUrl: string | null;
  images: Array<{ url: string; isPrimary: boolean }> | null;
  badge: string | null;
  trackStock: boolean | null;
  active: boolean | null;
  allowObservation: boolean | null;
  categoryId: string | null;
  promoConfig: PromoConfig | null;
  productType: ProductType | null;
  isWeightScale: boolean | null;
  variationGroups: VariationGroup[] | null;
}

export interface Category {
  id: string;
  name: string;
  analytic: boolean;
  position: number;
  parentId: string | null;
}

export interface VariationOption {
  id: string;
  name: string;
  price: string;
  images: ProductImage[];
}

export interface VariationGroup {
  id: string;
  groupName: string;
  options: VariationOption[];
}

export type ProductStatus = "ativo" | "inativo" | "suspenso";

export interface ProductForm {
  name: string;
  description: string;
  price: string;
  costPrice: string;
  lowStockThreshold: string;
  sku: string;
  barcode: string;
  pdvCode: string;
  unit: string;
  images: ProductImage[];
  badge: string;
  categoryId: string;
  trackStock: boolean;
  status: ProductStatus;
  allowObservation: boolean;
  variationGroups: VariationGroup[];
  promoConfig: PromoConfig | null;
  productType: ProductType;
  isWeightScale: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────
export const fmt = (v: string | null | undefined) =>
  v ? `R$ ${parseFloat(v).toFixed(2).replace(".", ",")}` : "—";

function getStockStatus(p: Product) {
  if (!p.trackStock) return "ok"; // estoque não controlado = infinito
  const stock = p.stock ?? 0;
  const threshold = p.lowStockThreshold ?? 5;
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "ok";
}

const STOCK_STATUS = {
  ok:  { label: "Em estoque",    color: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2 },
  low: { label: "Estoque baixo", color: "bg-amber-500/15 text-amber-600",     Icon: AlertTriangle },
  out: { label: "Sem estoque",   color: "bg-destructive/15 text-destructive",  Icon: XCircle },
};

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${
      type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"
    }`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Stock Badge ─────────────────────────────────────────────────
function StockBadge({ product }: { product: Product }) {
  const s = getStockStatus(product);
  const { label, color, Icon } = STOCK_STATUS[s];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {s === "out" ? label : `${product.stock ?? 0} ${product.unit || "un"}`}
    </span>
  );
}

// ─── Status Dot ──────────────────────────────────────────────────
function StatusDot({ active }: { active: boolean | null }) {
  if (active === false) {
    return (
      <span title="Desativado"
        className="w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
        <X className="w-2.5 h-2.5 text-destructive" />
      </span>
    );
  }
  if (active === null) {
    return (
      <span title="Suspenso"
        className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
      </span>
    );
  }
  return (
    <span title="Ativo"
      className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
      <Check className="w-2.5 h-2.5 text-emerald-600" />
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasOpenedModal, setHasOpenedModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const { confirm: confirmDialog, dialog: confirmDialogNode } = useConfirmDialog();

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    async function load() {
      let storeId = localStorage.getItem("storeId");
      if (!storeId) {
        try {
          const res = await api.get("/api/store/user");
          if (res.ok) {
            const data = await res.json() as { store?: { id: string } };
            storeId = data.store?.id ?? null;
            if (storeId) localStorage.setItem("storeId", storeId);
          }
        } catch { /* não crítico */ }
      }
      if (!storeId) { setLoading(false); return; }
      try {
        const [pData, cData] = await Promise.all([
          fetch(`/api/products/list-admin?storeId=${storeId}`).then(r => r.json()),
          fetch(`/api/categories/list-admin?storeId=${storeId}`).then(r => r.json()),
        ]);
        setProducts((pData as { products?: Product[] }).products || []);
        setCategories((cData as { categories?: Category[] }).categories || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    load();
  }, []);

  const handleSaved = (product: Product, isNew: boolean) => {
    setProducts(prev =>
      isNew ? [...prev, product] : prev.map(p => p.id === product.id ? product : p)
    );
    showToast(isNew ? "Produto criado com sucesso!" : "Produto atualizado!", "success");
  };

  const handleDelete = async (productId: string) => {
    const ok = await confirmDialog(
      "Desativar produto?",
      "O produto será desativado e não aparecerá mais na loja. Os dados históricos (pedidos e estoque) são preservados.",
      "Desativar",
    );
    if (!ok) return;
    try {
      const res = await api.post("/api/products/delete", { productId });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId));
        showToast("Produto desativado", "success");
      }
    } catch { showToast("Erro ao desativar", "error"); }
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); setHasOpenedModal(true); };
  const openEdit = (p: Product) => { setEditing(p); setModalOpen(true); setHasOpenedModal(true); };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  const catName = (id: string | null) =>
    id ? (categories.find(c => c.id === id)?.name || "—") : "—";

  const exportPDF = () => {
    const rows = filtered.map(p => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.sku) || "—"}</td>
        <td>${escapeHtml(p.barcode) || "—"}</td>
        <td>${fmt(p.price)}</td>
        <td>—</td>
        <td>${p.stock ?? 0} ${escapeHtml(p.unit) || "un"}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Relatório de Produtos — ARMAZIX</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        p.sub { color: #666; font-size: 11px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; text-align: left; padding: 9px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 2px solid #e5e7eb; color: #555; }
        td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
        tr:hover td { background: #f9fafb; }
        .footer { margin-top: 28px; font-size: 10px; color: #aaa; text-align: right; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <h1>Relatório de Produtos</h1>
      <p class="sub">Gerado em ${new Date().toLocaleString("pt-BR")} &mdash; ${filtered.length} produto(s)</p>
      <table>
        <thead><tr><th>Nome do produto</th><th>SKU</th><th>Código de barras</th><th>Preço</th><th>Promocional</th><th>Estoque</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">ARMAZIX</div>
    </body></html>`;
    const w = window.open("", "_blank", "noopener");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-36 bg-secondary rounded-xl animate-pulse" />
            <div className="h-4 w-24 bg-secondary rounded-xl animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-secondary rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 bg-secondary rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9"
            onClick={async () => {
              setLoading(true);
              let s = localStorage.getItem("storeId");
              if (!s) {
                try {
                  const r = await api.get("/api/store/user");
                  if (r.ok) {
                    const d = await r.json() as { store?: { id: string } };
                    s = d.store?.id ?? null;
                    if (s) localStorage.setItem("storeId", s);
                  }
                } catch { /* ignore */ }
              }
              if (!s) { setLoading(false); return; }
              fetch(`/api/products/list-admin?storeId=${s}`).then(r => r.json()).then(d => setProducts((d as { products?: Product[] }).products || [])).finally(() => setLoading(false));
            }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={filtered.length === 0}
            className="rounded-xl gap-1.5 h-9">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button onClick={openCreate}
            className="h-9 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform gap-2">
            <Plus className="w-4 h-4" />
            Novo produto
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou SKU..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
        </div>
        <div className="flex items-center border border-border rounded-xl overflow-hidden">
          <button onClick={() => setView("grid")}
            className={`px-3 h-9 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}>
            <LayoutGrid className="w-3.5 h-3.5" /> Grid
          </button>
          <button onClick={() => setView("list")}
            className={`px-3 h-9 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}>
            <List className="w-3.5 h-3.5" /> Lista
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">
            {search ? "Nenhum resultado" : "Nenhum produto ainda"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {search ? `Não encontramos produtos para "${search}"` : "Comece criando seu primeiro produto"}
          </p>
          {!search && (
            <Button onClick={openCreate} className="mt-5 h-9 rounded-xl bg-gradient-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Criar primeiro produto
            </Button>
          )}
        </div>
      ) : view === "grid" ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(p => {
            const promo = getEffectivePrice(p.price, p.promoConfig, "store");
            return (
              <Card key={p.id} className={`rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all group overflow-hidden cursor-pointer ${p.active === false ? "opacity-70" : ""}`}
                onClick={() => openEdit(p)}>
                <div className="aspect-square bg-secondary/30 flex items-center justify-center relative overflow-hidden">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
                    : <span className="text-5xl">{p.emoji || "📦"}</span>}
                  {p.badge && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                      {p.badge}
                    </span>
                  )}
                  {promo.promoActive && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold shadow">
                      <Percent className="w-2.5 h-2.5" /> PROMO
                    </span>
                  )}
                  <div className="absolute top-2 right-2">
                    <StatusDot active={p.active} />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-sm font-semibold truncate leading-tight">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      {promo.promoActive ? (
                        <>
                          <span className="text-sm font-bold text-violet-700">{fmt(p.promoConfig!.promoPrice)}</span>
                          <span className="text-[11px] text-muted-foreground line-through ml-1.5">{fmt(p.price)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-bold">{fmt(p.price)}</span>
                      )}
                    </div>
                    <StockBadge product={p} />
                  </div>
                  {p.categoryId && (
                    <p className="text-[11px] text-muted-foreground truncate">{catName(p.categoryId)}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ── List View ── */
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="hidden sm:grid grid-cols-[20px_2fr_1fr_1fr_1fr_40px] gap-4 px-4 py-2.5 bg-secondary/30 border-b border-border/50">
            <span />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preço</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estoque</span>
            <span />
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map(p => {
              const promoL = getEffectivePrice(p.price, p.promoConfig, "store");
              return (
              <div key={p.id}
                className={`grid grid-cols-[20px_1fr_40px] sm:grid-cols-[20px_2fr_1fr_1fr_1fr_40px] gap-4 px-4 py-3 hover:bg-secondary/20 transition-colors items-center ${p.active === false ? "opacity-60" : ""}`}>
                {/* Status */}
                <StatusDot active={p.active} />
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
                      : <span className="text-lg">{p.emoji || "📦"}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.sku && <p className="text-[11px] text-muted-foreground">SKU: {p.sku}</p>}
                      {p.pdvCode && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold bg-primary/8 text-primary px-1.5 py-0.5 rounded-md border border-primary/20">
                          <Hash className="w-2.5 h-2.5" />{p.pdvCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Category */}
                <span className="hidden sm:block text-sm text-muted-foreground truncate">{catName(p.categoryId)}</span>
                {/* Price */}
                <div className="hidden sm:block">
                  {promoL.promoActive ? (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-violet-700">{fmt(p.promoConfig!.promoPrice)}</span>
                        <span className="text-[9px] font-bold bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5">PROMO</span>
                      </div>
                      <span className="text-xs text-muted-foreground line-through">{fmt(p.price)}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold">{fmt(p.price)}</span>
                  )}
                </div>
                {/* Stock */}
                <div className="hidden sm:flex">
                  <StockBadge product={p} />
                </div>
                {/* Edit */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Editar produto"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ); })}
          </div>
        </Card>
      )}

      {hasOpenedModal && (
        <Suspense fallback={null}>
          <ProductFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            categories={categories}
            onSaved={handleSaved}
            onDelete={handleDelete}
            editing={editing}
          />
        </Suspense>
      )}

      {confirmDialogNode}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
