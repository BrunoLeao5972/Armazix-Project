import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Plus, Search, MoreHorizontal, Edit, Trash2, Package,
  Loader2, X, ChevronDown, Tag, DollarSign,
  Box, Barcode, Hash, LayoutGrid, List, ImagePlus, Check,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Layers, Pencil, FileDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
  head: () => ({
    meta: [{ title: "Produtos — ARMAZIX" }],
  }),
});

// ─── Types ───────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  stock: number | null;
  lowStockThreshold: number | null;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  emoji: string | null;
  imageUrl: string | null;
  badge: string | null;
  active: boolean | null;
  categoryId: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface VariationOption {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  stock: string;
}

interface VariationGroup {
  id: string;
  groupName: string;
  options: VariationOption[];
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stock: string;
  lowStockThreshold: string;
  sku: string;
  barcode: string;
  unit: string;
  imageUrl: string;
  badge: string;
  categoryId: string;
  active: boolean;
  variationGroups: VariationGroup[];
}

const EMPTY_FORM: ProductForm = {
  name: "", description: "", price: "", compareAtPrice: "",
  costPrice: "", stock: "", lowStockThreshold: "5",
  sku: "", barcode: "", unit: "un", imageUrl: "",
  badge: "", categoryId: "", active: true, variationGroups: [],
};

const uid = () => Math.random().toString(36).slice(2);

const newOption = (): VariationOption => ({ id: uid(), name: "", price: "", imageUrl: "", stock: "" });

const newGroup = (): VariationGroup => ({ id: uid(), groupName: "", options: [newOption()] });

const UNITS = ["un", "kg", "g", "l", "ml", "cx", "pç", "par"];

// ─── Helpers ──────────────────────────────────────────────────────
const fmt = (v: string | null | undefined) =>
  v ? `R$ ${parseFloat(v).toFixed(2).replace(".", ",")}` : "—";

const parseCurrency = (v: string) =>
  v.replace(/[^0-9,]/g, "").replace(",", ".");

function calcMargin(price: string, cost: string) {
  const p = parseFloat(parseCurrency(price));
  const c = parseFloat(parseCurrency(cost));
  if (!p || !c || c >= p) return null;
  return (((p - c) / p) * 100).toFixed(1);
}

function getStockStatus(p: Product) {
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

// ─── Image Upload Zone ────────────────────────────────────────────
function ImageUploadZone({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => !value && inputRef.current?.click()}
      className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden
        ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30"}
        ${value ? "h-40 cursor-default" : "h-40 flex flex-col items-center justify-center gap-2"}`}
    >
      {value ? (
        <>
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(""); }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <ImagePlus className="w-8 h-8 text-muted-foreground" />
          <span className="text-xs text-muted-foreground text-center px-4">
            Arraste ou <span className="text-primary font-medium">clique para enviar</span>
          </span>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-soft">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <Separator className="opacity-50" />
      <CardContent className="p-5 space-y-4">{children}</CardContent>
    </Card>
  );
}

// ─── Product Form Modal ───────────────────────────────────────────
function ProductFormModal({
  open, onClose, categories, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSaved: (p: Product, isNew: boolean) => void;
  editing: Product | null;
}) {
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"basic" | "price" | "stock" | "variations">("basic");
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description || "",
        price: editing.price,
        compareAtPrice: editing.compareAtPrice || "",
        costPrice: editing.costPrice || "",
        stock: String(editing.stock ?? ""),
        lowStockThreshold: String(editing.lowStockThreshold ?? 5),
        sku: editing.sku || "",
        barcode: editing.barcode || "",
        unit: editing.unit || "un",
        imageUrl: editing.imageUrl || "",
        badge: editing.badge || "",
        categoryId: editing.categoryId || "",
        active: editing.active !== false,
        variationGroups: [],
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setTab("basic");
    setShowNewCat(false);
    setNewCatName("");
  }, [editing, open]);

  const set = (k: keyof ProductForm, v: string | boolean | VariationGroup[]) =>
    setForm(f => ({ ...f, [k]: v }));

  const addGroup = () => set("variationGroups", [...form.variationGroups, newGroup()]);

  const removeGroup = (gid: string) =>
    set("variationGroups", form.variationGroups.filter(g => g.id !== gid));

  const setGroupName = (gid: string, name: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, groupName: name } : g) }));

  const addOption = (gid: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: [...g.options, newOption()] } : g) }));

  const removeOption = (gid: string, oid: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: g.options.filter(o => o.id !== oid) } : g) }));

  const setOption = (gid: string, oid: string, k: keyof VariationOption, v: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, [k]: v } : o) } : g) }));

  const margin = calcMargin(form.price, form.costPrice);

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: parseCurrency(form.price),
        compareAtPrice: form.compareAtPrice ? parseCurrency(form.compareAtPrice) : undefined,
        costPrice: form.costPrice ? parseCurrency(form.costPrice) : undefined,
        stock: form.stock !== "" ? Number(form.stock) : 0,
        lowStockThreshold: form.lowStockThreshold !== "" ? Number(form.lowStockThreshold) : 5,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        unit: form.unit,
        imageUrl: form.imageUrl || undefined,
        badge: form.badge || undefined,
        categoryId: form.categoryId || undefined,
        active: form.active,
      };
      let res: Response;
      if (editing) {
        res = await api.post("/api/products/update", { productId: editing.id, ...payload });
      } else {
        res = await api.post("/api/products/create", payload);
      }
      const data = await res.json();
      if (res.ok && (data.success || data.product)) {
        onSaved(data.product, !editing);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: "basic",      label: "Informações", icon: Package },
    { id: "price",      label: "Preços",      icon: DollarSign },
    { id: "stock",      label: "Estoque",     icon: Box },
    { id: "variations", label: "Variações",   icon: Layers },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg font-bold">
            {editing ? "Editar produto" : "Novo produto"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editing ? "Atualize as informações do produto" : "Preencha os dados para cadastrar"}
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border/50 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-xl whitespace-nowrap transition-colors border-b-2 -mb-px
                ${tab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* ── Tab: Informações ── */}
          {tab === "basic" && (
            <>
              <Field label="Nome do produto *">
                <Input autoFocus placeholder="Ex: Arroz Integral 5kg"
                  value={form.name} onChange={e => set("name", e.target.value)}
                  className="h-10 rounded-xl" />
              </Field>

              <Field label="Descrição" hint={`${form.description.length}/500`}>
                <textarea
                  placeholder="Descreva o produto brevemente..."
                  value={form.description}
                  maxLength={500}
                  onChange={e => set("description", e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Categoria">
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <select
                          value={form.categoryId}
                          onChange={e => set("categoryId", e.target.value)}
                          className="w-full h-10 pl-8 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition"
                        >
                          <option value="">Sem categoria</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNewCat(v => !v)}
                        className="w-10 h-10 rounded-xl border border-dashed border-primary/50 text-primary hover:bg-primary/5 flex items-center justify-center transition-colors shrink-0"
                        title="Nova categoria"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {showNewCat && (
                      <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                        <Input
                          placeholder="Nome da categoria"
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === "Enter" && newCatName.trim()) {
                              setCreatingCat(true);
                              try {
                                const res = await api.post("/api/categories/create", { name: newCatName.trim() });
                                const data = await res.json();
                                if (res.ok && data.category) {
                                  categories.push(data.category);
                                  set("categoryId", data.category.id);
                                  setNewCatName("");
                                  setShowNewCat(false);
                                }
                              } finally { setCreatingCat(false); }
                            }
                          }}
                          className="h-9 rounded-xl text-sm flex-1"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={creatingCat || !newCatName.trim()}
                          onClick={async () => {
                            if (!newCatName.trim()) return;
                            setCreatingCat(true);
                            try {
                              const res = await api.post("/api/categories/create", { name: newCatName.trim() });
                              const data = await res.json();
                              if (res.ok && data.category) {
                                categories.push(data.category);
                                set("categoryId", data.category.id);
                                setNewCatName("");
                                setShowNewCat(false);
                              }
                            } finally { setCreatingCat(false); }
                          }}
                          className="h-9 rounded-xl bg-primary text-primary-foreground"
                        >
                          {creatingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Unidade">
                  <div className="relative">
                    <select
                      value={form.unit}
                      onChange={e => set("unit", e.target.value)}
                      className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="SKU">
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="ABC-001" value={form.sku}
                      onChange={e => set("sku", e.target.value)} className="h-10 rounded-xl pl-8" />
                  </div>
                </Field>
                <Field label="Código de barras">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="7891234567890" value={form.barcode}
                      onChange={e => set("barcode", e.target.value)} className="h-10 rounded-xl pl-8" />
                  </div>
                </Field>
              </div>

              <Field label="Imagem do produto">
                <ImageUploadZone value={form.imageUrl} onChange={v => set("imageUrl", v)} />
              </Field>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
                <div>
                  <p className="text-sm font-medium">Produto ativo</p>
                  <p className="text-xs text-muted-foreground">Visível na vitrine da loja</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => set("active", !form.active)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                    form.active ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.active ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </>
          )}

          {/* ── Tab: Preços ── */}
          {tab === "price" && (
            <>
              <Field label="Preço de venda *">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="0,00" value={form.price}
                    onChange={e => set("price", e.target.value)} className="h-10 rounded-xl pl-8 font-semibold" />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Preço promocional" hint="Preço riscado">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="0,00" value={form.compareAtPrice}
                      onChange={e => set("compareAtPrice", e.target.value)} className="h-10 rounded-xl pl-8" />
                  </div>
                </Field>
                <Field label="Preço de custo">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="0,00" value={form.costPrice}
                      onChange={e => set("costPrice", e.target.value)} className="h-10 rounded-xl pl-8" />
                  </div>
                </Field>
              </div>

              {margin !== null && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Margem de lucro estimada</p>
                    <p className="text-xs text-emerald-600/80 mt-0.5">
                      {margin}% — Lucro de {fmt(String(parseFloat(parseCurrency(form.price)) - parseFloat(parseCurrency(form.costPrice))))} por unidade
                    </p>
                  </div>
                  <span className="ml-auto text-xl font-bold text-emerald-600">{margin}%</span>
                </div>
              )}

              <Field label="Badge / Destaque" hint="Ex: Novo, Promoção, Top">
                <Input placeholder="Ex: Novidade" value={form.badge}
                  onChange={e => set("badge", e.target.value)} className="h-10 rounded-xl" />
              </Field>
            </>
          )}

          {/* ── Tab: Estoque ── */}
          {tab === "stock" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Quantidade em estoque">
                  <div className="relative">
                    <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input type="number" min="0" placeholder="0" value={form.stock}
                      onChange={e => set("stock", e.target.value)} className="h-10 rounded-xl pl-8" />
                  </div>
                </Field>
                <Field label="Estoque mínimo" hint="Alerta abaixo disso">
                  <div className="relative">
                    <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input type="number" min="0" placeholder="5" value={form.lowStockThreshold}
                      onChange={e => set("lowStockThreshold", e.target.value)} className="h-10 rounded-xl pl-8" />
                  </div>
                </Field>
              </div>

              {form.stock !== "" && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                  Number(form.stock) <= 0
                    ? "bg-destructive/10 border-destructive/20"
                    : Number(form.stock) <= Number(form.lowStockThreshold || 5)
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-emerald-500/10 border-emerald-500/20"
                }`}>
                  {Number(form.stock) <= 0 ? <XCircle className="w-5 h-5 text-destructive" />
                    : Number(form.stock) <= Number(form.lowStockThreshold || 5) ? <AlertTriangle className="w-5 h-5 text-amber-600" />
                    : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  <div>
                    <p className={`text-sm font-semibold ${
                      Number(form.stock) <= 0 ? "text-destructive"
                      : Number(form.stock) <= Number(form.lowStockThreshold || 5) ? "text-amber-700"
                      : "text-emerald-700"
                    }`}>
                      {Number(form.stock) <= 0 ? "Sem estoque"
                        : Number(form.stock) <= Number(form.lowStockThreshold || 5) ? "Estoque baixo"
                        : "Em estoque"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {form.stock} {form.unit || "un"} disponíveis
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Variações ── */}
          {tab === "variations" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Grupos de variação</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ex: "Cor" com opções Azul/Vermelho, "Tamanho" com P/M/G/GG</p>
                </div>
                <Button type="button" size="sm" onClick={addGroup}
                  className="h-8 rounded-xl gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 shadow-none">
                  <Plus className="w-3.5 h-3.5" /> Novo grupo
                </Button>
              </div>

              {form.variationGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 rounded-2xl border-2 border-dashed border-border gap-3 text-center">
                  <Layers className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum grupo criado</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Crie um grupo como "Cor" ou "Tamanho" e adicione as opções dentro dele</p>
                  <button type="button" onClick={addGroup}
                    className="text-xs font-semibold text-primary hover:underline">
                    + Criar primeiro grupo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {form.variationGroups.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-border/60 bg-secondary/10 overflow-hidden">

                      {/* Cabeçalho do grupo */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 border-b border-border/40">
                        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                        <Input
                          placeholder="Nome do grupo (ex: Cor, Tamanho, Sabor)"
                          value={group.groupName}
                          onChange={e => setGroupName(group.id, e.target.value)}
                          className="h-8 rounded-lg text-sm font-medium border-0 bg-transparent focus-visible:ring-1 px-2 flex-1"
                        />
                        <button type="button" onClick={() => removeGroup(group.id)}
                          className="w-6 h-6 rounded-lg hover:bg-destructive/15 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Opções do grupo */}
                      <div className="p-4 space-y-3">
                        {group.options.map((opt, oidx) => (
                          <div key={opt.id} className="rounded-xl border border-border/50 bg-background p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                {opt.name.trim() || `Opção ${oidx + 1}`}
                              </span>
                              {group.options.length > 1 && (
                                <button type="button" onClick={() => removeOption(group.id, opt.id)}
                                  className="w-5 h-5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Nome</Label>
                                <Input placeholder="Ex: Azul, P, 500ml"
                                  value={opt.name} onChange={e => setOption(group.id, opt.id, "name", e.target.value)}
                                  className="h-8 rounded-lg text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Preço adicional</Label>
                                <div className="relative">
                                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                  <Input placeholder="0,00"
                                    value={opt.price} onChange={e => setOption(group.id, opt.id, "price", e.target.value)}
                                    className="h-8 rounded-lg text-xs pl-6" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Estoque</Label>
                                <div className="relative">
                                  <Box className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                  <Input type="number" min="0" placeholder="0"
                                    value={opt.stock} onChange={e => setOption(group.id, opt.id, "stock", e.target.value)}
                                    className="h-8 rounded-lg text-xs pl-6" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Foto</Label>
                                <label className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                                  {opt.imageUrl
                                    ? <img src={opt.imageUrl} className="w-4 h-4 rounded object-cover" />
                                    : <ImagePlus className="w-3 h-3 text-muted-foreground" />}
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {opt.imageUrl ? "Alterar" : "Foto"}
                                  </span>
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={e => {
                                      const f = e.target.files?.[0]; if (!f) return;
                                      const r = new FileReader();
                                      r.onload = ev => setOption(group.id, opt.id, "imageUrl", ev.target?.result as string);
                                      r.readAsDataURL(f);
                                    }} />
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button type="button" onClick={() => addOption(group.id)}
                          className="w-full h-8 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> Adicionar opção em "{group.groupName || 'grupo'}"
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-surface flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.price}
            className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {editing ? "Salvar alterações" : "Criar produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const [editing, setEditing] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/products/list?storeId=${storeId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/categories/list?storeId=${storeId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([pData, cData]) => {
      setProducts(pData.products || []);
      setCategories(cData.categories || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaved = (product: Product, isNew: boolean) => {
    setProducts(prev =>
      isNew ? [...prev, product] : prev.map(p => p.id === product.id ? product : p)
    );
    showToast(isNew ? "Produto criado com sucesso!" : "Produto atualizado!", "success");
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Remover este produto?")) return;
    try {
      const res = await api.post("/api/products/delete", { productId });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId));
        showToast("Produto removido", "success");
      }
    } catch { showToast("Erro ao remover", "error"); }
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setModalOpen(true); };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  const catName = (id: string | null) =>
    id ? (categories.find(c => c.id === id)?.name || "—") : "—";

  const exportPDF = () => {
    const rows = filtered.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.sku || "—"}</td>
        <td>${p.barcode || "—"}</td>
        <td>${fmt(p.price)}</td>
        <td>${p.compareAtPrice ? fmt(p.compareAtPrice) : "—"}</td>
        <td>${p.stock ?? 0} ${p.unit || "un"}</td>
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
    const w = window.open("", "_blank");
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
            onClick={() => { setLoading(true); const s = localStorage.getItem("storeId"); if (s) fetch(`/api/products/list?storeId=${s}`).then(r => r.json()).then(d => setProducts(d.products || [])).finally(() => setLoading(false)); }}>
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
          {filtered.map(p => (
            <Card key={p.id} className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all group overflow-hidden cursor-pointer"
              onClick={() => openEdit(p)}>
              <div className="h-32 bg-secondary/30 flex items-center justify-center relative overflow-hidden">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <span className="text-5xl">{p.emoji || "📦"}</span>}
                {p.badge && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                    {p.badge}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-semibold truncate leading-tight">{p.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{fmt(p.price)}</span>
                  <StockBadge product={p} />
                </div>
                {p.categoryId && (
                  <p className="text-[11px] text-muted-foreground truncate">{catName(p.categoryId)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ── List View ── */
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-4 py-2.5 bg-secondary/30 border-b border-border/50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preço</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estoque</span>
            <span />
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map(p => (
              <div key={p.id}
                className="grid grid-cols-[1fr_80px] sm:grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-4 py-3 hover:bg-secondary/20 transition-colors items-center">
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      : <span className="text-lg">{p.emoji || "📦"}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    {p.sku && <p className="text-[11px] text-muted-foreground">SKU: {p.sku}</p>}
                  </div>
                </div>
                {/* Category */}
                <span className="hidden sm:block text-sm text-muted-foreground truncate">{catName(p.categoryId)}</span>
                {/* Price */}
                <div className="hidden sm:block">
                  <span className="text-sm font-bold">{fmt(p.price)}</span>
                  {p.compareAtPrice && (
                    <span className="text-xs text-muted-foreground line-through ml-1.5">{fmt(p.compareAtPrice)}</span>
                  )}
                </div>
                {/* Stock */}
                <div className="hidden sm:flex">
                  <StockBadge product={p} />
                </div>
                {/* Actions */}
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem className="rounded-lg gap-2" onClick={() => openEdit(p)}>
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg gap-2 text-destructive focus:text-destructive"
                        onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        onSaved={handleSaved}
        editing={editing}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
