import React, { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Plus, Search, Package,
  Loader2, X, ChevronDown, Tag, DollarSign,
  Box, Barcode, Hash, LayoutGrid, List, ImagePlus, Check,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Layers, Pencil, FileDown, Percent, Star, Clock, Calendar,
} from "lucide-react";
import { type PromoConfig, DEFAULT_PROMO_CONFIG, isPromoActive, getEffectivePrice } from "@/lib/promo-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
  head: () => ({
    meta: [{ title: "Produtos — ARMAZIX" }],
  }),
});

// ─── Types ───────────────────────────────────────────────────────
type ProductImage = { id: string; url: string; isPrimary: boolean };

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  costPrice: string | null;
  stock: number | null;
  lowStockThreshold: number | null;
  sku: string | null;
  barcode: string | null;
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
}

interface Category {
  id: string;
  name: string;
  analytic: boolean;
  position: number;
  parentId: string | null;
}

interface VariationOption {
  id: string;
  name: string;
  price: string;
  images: ProductImage[];
}

interface VariationGroup {
  id: string;
  groupName: string;
  options: VariationOption[];
}

type ProductStatus = "ativo" | "inativo" | "suspenso";

interface ProductForm {
  name: string;
  description: string;
  price: string;
  costPrice: string;
  lowStockThreshold: string;
  sku: string;
  barcode: string;
  unit: string;
  images: ProductImage[];
  badge: string;
  categoryId: string;
  trackStock: boolean;
  status: ProductStatus;
  allowObservation: boolean;
  variationGroups: VariationGroup[];
  promoConfig: PromoConfig | null;
}

const EMPTY_FORM: ProductForm = {
  name: "", description: "", price: "",
  costPrice: "", lowStockThreshold: "5",
  sku: "", barcode: "", unit: "un", images: [],
  badge: "", categoryId: "", trackStock: false, status: "ativo", allowObservation: false,
  variationGroups: [], promoConfig: null,
};

const uid = () => Math.random().toString(36).slice(2);

const newOption = (): VariationOption => ({ id: uid(), name: "", price: "", images: [] });

const newGroup = (): VariationGroup => ({ id: uid(), groupName: "", options: [newOption()] });

const UNITS = ["un", "kg", "g", "l", "ml", "cx", "pç", "par"];

// ─── Helpers ──────────────────────────────────────────────────────
const fmt = (v: string | null | undefined) =>
  v ? `R$ ${parseFloat(v).toFixed(2).replace(".", ",")}` : "—";

const parseCurrency = (v: string): string => {
  const stripped = v.replace(/[^\d,.]/g, "");
  // BR format: has comma as decimal separator ("10,00" or "1.000,00")
  if (stripped.includes(",")) {
    return stripped.replace(/\./g, "").replace(",", ".") || "0";
  }
  // Already decimal ("10.00" from DB or typed with dot)
  return stripped || "0";
};

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

// ─── Image Gallery (multi-upload, primary selection) ──────────────
function ImageGallery({ images, onChange }: { images: ProductImage[]; onChange: (imgs: ProductImage[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const readFile = (file: File) => new Promise<string>(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target?.result as string);
    r.readAsDataURL(file);
  });

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const urls = await Promise.all(arr.map(readFile));
    const newImgs: ProductImage[] = urls.map(url => ({
      id: uid(), url, isPrimary: images.length === 0 && urls.indexOf(url) === 0,
    }));
    onChange([...images, ...newImgs]);
  };

  const setPrimary = (id: string) =>
    onChange(images.map(img => ({ ...img, isPrimary: img.id === id })));

  const remove = (id: string) => {
    const next = images.filter(img => img.id !== id);
    if (next.length > 0 && !next.some(img => img.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
  };

  if (images.length === 0) {
    return (
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`aspect-square w-full max-w-[200px] mx-auto rounded-2xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-2
          ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30"}`}
      >
        <ImagePlus className="w-8 h-8 text-muted-foreground" />
        <span className="text-xs text-muted-foreground text-center px-4">
          Arraste ou <span className="text-primary font-medium">clique para enviar</span>
        </span>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {images.map(img => (
          <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-secondary/20 group">
            <div className="absolute inset-0 bg-secondary/20" />
            <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-contain p-1.5" />
            {img.isPrimary && (
              <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none shadow">
                Capa
              </span>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
              {!img.isPrimary && (
                <button type="button" onClick={() => setPrimary(img.id)}
                  title="Definir como capa"
                  className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white shadow transition-transform hover:scale-110">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                </button>
              )}
              <button type="button" onClick={() => remove(img.id)}
                title="Remover"
                className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white shadow transition-transform hover:scale-110">
                <X className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          </div>
        ))}
        {/* Add more */}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors flex flex-col items-center justify-center gap-1">
          <ImagePlus className="w-5 h-5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Adicionar</span>
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {images.length} foto{images.length !== 1 ? "s" : ""} · Passe o mouse para definir a capa ou remover
      </p>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

// ─── Mini Image Gallery (para variações) ─────────────────────────
function MiniImageGallery({ images, onChange }: { images: ProductImage[]; onChange: (imgs: ProductImage[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList) => {
    const arr = Array.from(files);
    const urls = await Promise.all(arr.map(f => new Promise<string>(resolve => {
      const r = new FileReader(); r.onload = e => resolve(e.target?.result as string); r.readAsDataURL(f);
    })));
    const newImgs: ProductImage[] = urls.map((url, i) => ({
      id: uid(), url, isPrimary: images.length === 0 && i === 0,
    }));
    onChange([...images, ...newImgs]);
  };

  const setPrimary = (id: string) =>
    onChange(images.map(img => ({ ...img, isPrimary: img.id === id })));

  const remove = (id: string) => {
    const next = images.filter(img => img.id !== id);
    if (next.length > 0 && !next.some(img => img.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">Fotos</Label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {images.map(img => (
          <div key={img.id}
            className={`relative w-9 h-9 rounded-lg overflow-hidden border-2 group shrink-0 ${img.isPrimary ? "border-primary" : "border-border"}`}>
            <div className="absolute inset-0 bg-secondary/20" />
            <img src={img.url} className="absolute inset-0 w-full h-full object-contain p-0.5" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
              {!img.isPrimary && (
                <button type="button" onClick={() => setPrimary(img.id)}
                  className="w-4 h-4 flex items-center justify-center">
                  <Star className="w-2.5 h-2.5 text-amber-300" />
                </button>
              )}
              <button type="button" onClick={() => remove(img.id)}
                className="w-4 h-4 flex items-center justify-center">
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-9 h-9 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 flex items-center justify-center transition-colors shrink-0">
          <ImagePlus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
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
  open, onClose, categories, onSaved, editing, onDelete,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSaved: (p: Product, isNew: boolean) => void;
  editing: Product | null;
  onDelete?: (id: string) => void;
}) {
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"basic" | "price" | "stock" | "variations" | "promocoes">("basic");
  const [errors, setErrors] = useState<{ categoryId?: string; price?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    if (editing) {
      // Build images array: prefer DB gallery, fall back to legacy imageUrl
      const loadedImages: ProductImage[] = (() => {
        if (Array.isArray(editing.images) && editing.images.length > 0) {
          return editing.images.map(img => ({ id: uid(), url: img.url, isPrimary: img.isPrimary }));
        }
        if (editing.imageUrl) return [{ id: uid(), url: editing.imageUrl, isPrimary: true }];
        return [];
      })();
      setForm({
        name: editing.name,
        description: editing.description || "",
        price: editing.price,
        costPrice: editing.costPrice || "",
        lowStockThreshold: String(editing.lowStockThreshold ?? 5),
        sku: editing.sku || "",
        barcode: editing.barcode || "",
        unit: editing.unit || "un",
        images: loadedImages,
        badge: editing.badge || "",
        categoryId: editing.categoryId || "",
        trackStock: editing.trackStock === true,
        status: editing.active === null ? "suspenso" : editing.active === false ? "inativo" : "ativo",
        allowObservation: editing.allowObservation === true,
        variationGroups: [],
        promoConfig: editing.promoConfig || null,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setTab("basic");
    setShowNewCat(false);
    setNewCatName("");
  }, [editing, open]);

  const set = (k: keyof ProductForm, v: string | boolean | VariationGroup[] | ProductImage[]) =>
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

  const setOption = (gid: string, oid: string, k: "name" | "price", v: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, [k]: v } : o) } : g) }));

  const setOptionImages = (gid: string, oid: string, imgs: ProductImage[]) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, images: imgs } : o) } : g) }));

  const setPromo = (updates: Partial<PromoConfig>) =>
    setForm(f => ({ ...f, promoConfig: { ...(f.promoConfig ?? DEFAULT_PROMO_CONFIG), ...updates } }));

  const toggleDay = (day: number) => {
    const days = form.promoConfig?.daysOfWeek ?? [];
    setPromo({ daysOfWeek: days.includes(day) ? days.filter(d => d !== day) : [...days, day] });
  };

  const margin = calcMargin(form.price, form.costPrice);

  const handleSave = async () => {
    const newErrors: { categoryId?: string; price?: string } = {};
    if (!form.categoryId) newErrors.categoryId = "Selecione uma categoria para o produto.";
    if (!form.price) newErrors.price = "Informe o preço do produto.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.categoryId) setTab("basic");
      else if (newErrors.price) setTab("price");
      return;
    }
    setErrors({});
    setSaveError(null);
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const imagesPayload = form.images.map(({ url, isPrimary }) => ({ url, isPrimary }));
      const primaryImg = form.images.find(img => img.isPrimary) ?? form.images[0];
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: parseCurrency(form.price),
        costPrice: form.costPrice ? parseCurrency(form.costPrice) : undefined,
        lowStockThreshold: form.lowStockThreshold !== "" ? Number(form.lowStockThreshold) : 5,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        unit: form.unit,
        imageUrl: primaryImg?.url || undefined,
        images: imagesPayload,
        badge: form.badge || undefined,
        categoryId: form.categoryId || undefined,
        trackStock: form.trackStock,
        active: form.status === "suspenso" ? null : form.status === "inativo" ? false : true,
        allowObservation: form.allowObservation,
        promoConfig: form.promoConfig?.enabled ? form.promoConfig : null,
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
      } else {
        setSaveError(data?.error || "Erro ao salvar produto. Tente novamente.");
      }
    } catch (err) {
      setSaveError("Erro de conexão. Verifique sua rede e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: "basic",      label: "Informações", icon: Package },
    { id: "price",      label: "Preços",      icon: DollarSign },
    { id: "stock",      label: "Estoque",     icon: Box },
    { id: "variations", label: "Variações",   icon: Layers },
    { id: "promocoes",  label: "Promoções",   icon: Percent },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg font-bold">
            {editing ? "Editar produto" : "Novo produto"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editing
              ? <span>Atualize as informações do produto &mdash; <span className="font-mono text-[11px] select-all">{editing.id}</span></span>
              : "Preencha os dados para cadastrar"}
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
                <Field label="Categoria *">
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <select
                          value={form.categoryId}
                          onChange={e => { set("categoryId", e.target.value); setErrors(v => ({ ...v, categoryId: undefined })); }}
                          className={`w-full h-10 pl-8 pr-8 text-sm rounded-xl border bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition ${errors.categoryId ? "border-destructive ring-1 ring-destructive" : "border-input"}`}
                        >
                          <option value="">Sem categoria</option>
                          {(() => {
                            const roots = [...categories]
                              .filter(c => !c.parentId)
                              .sort((a, b) => a.position - b.position);
                            const items: React.ReactNode[] = [];
                            roots.forEach(root => {
                              items.push(
                                <option
                                  key={root.id}
                                  value={root.id}
                                  disabled={root.analytic}
                                  style={root.analytic ? { fontWeight: "bold", color: "#888" } : {}}
                                >
                                  {root.analytic ? `── ${root.name}` : root.name}
                                </option>
                              );
                              const children = [...categories]
                                .filter(c => c.parentId === root.id)
                                .sort((a, b) => a.position - b.position);
                              children.forEach(child => {
                                items.push(
                                  <option key={child.id} value={child.id}>
                                    {`  ${child.name}`}
                                  </option>
                                );
                              });
                            });
                            return items;
                          })()}
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
                    {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
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

              <Field label="Fotos do produto">
                <ImageGallery images={form.images} onChange={imgs => set("images", imgs)} />
              </Field>

              {/* Status Segmented Control */}
              <div className="p-3.5 rounded-xl border border-border bg-secondary/20 space-y-3">
                <p className="text-sm font-medium">Status do produto</p>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-secondary/50">
                  {(
                    [
                      { value: "ativo"    as const, label: "Ativo",    Icon: CheckCircle2,
                        on: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 shadow-sm" },
                      { value: "suspenso" as const, label: "Suspenso", Icon: AlertTriangle,
                        on: "bg-amber-500/15 text-amber-700 border border-amber-500/25 shadow-sm" },
                      { value: "inativo"  as const, label: "Inativo",  Icon: XCircle,
                        on: "bg-destructive/15 text-destructive border border-destructive/25 shadow-sm" },
                    ] satisfies { value: ProductStatus; label: string; Icon: React.ElementType; on: string }[]
                  ).map(({ value, label, Icon, on }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("status", value)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-150
                        ${form.status === value ? on : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {form.status === "ativo"    ? "Visível e disponível na vitrine da loja." :
                   form.status === "suspenso" ? "Pausado temporariamente — oculto da vitrine." :
                                                "Desativado — não aparece para clientes."}
                </p>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
                <div>
                  <p className="text-sm font-medium">Permitir observação</p>
                  <p className="text-xs text-muted-foreground">Cliente pode adicionar nota ao item (ex: sem cebola)</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.allowObservation}
                  onClick={() => set("allowObservation", !form.allowObservation)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                    form.allowObservation ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.allowObservation ? "translate-x-5" : "translate-x-0"
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

              <Field label="Preço de custo">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="0,00" value={form.costPrice}
                    onChange={e => set("costPrice", e.target.value)} className="h-10 rounded-xl pl-8" />
                </div>
              </Field>

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
              {/* Controlar estoque toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
                <div>
                  <p className="text-sm font-medium">Controlar Estoque</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quando ativo, o saldo é gerenciado pelo módulo de estoque via movimentações
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.trackStock}
                  onClick={() => set("trackStock", !form.trackStock)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                    form.trackStock ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.trackStock ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {form.trackStock && (
                <Field label="Estoque mínimo" hint="Alerta de reposição abaixo deste valor">
                  <div className="relative">
                    <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input type="number" min="0" placeholder="5" value={form.lowStockThreshold}
                      onChange={e => set("lowStockThreshold", e.target.value)} className="h-10 rounded-xl pl-8" />
                  </div>
                </Field>
              )}

              <div className="rounded-xl border border-border/50 bg-secondary/10 p-4 flex items-start gap-3">
                <Box className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Quantidade controlada por movimentações</p>
                  <p>O saldo atual do produto é atualizado exclusivamente pelo módulo de <strong>Estoque</strong> — via entradas, saídas, ajustes e balanços. Não é possível editar a quantidade diretamente aqui.</p>
                </div>
              </div>
            </>
          )}

          {/* ── Tab: Promoções ── */}
          {tab === "promocoes" && (
            <>
              {/* Toggle ativar */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-violet-500" />
                    Ativar promoção por recorrência
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define um preço promocional com dias, horários e período específicos
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!form.promoConfig?.enabled}
                  onClick={() => setPromo({ enabled: !form.promoConfig?.enabled })}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                    form.promoConfig?.enabled ? "bg-violet-600" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.promoConfig?.enabled ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {form.promoConfig?.enabled && (
                <>
                  {/* Preço promocional */}
                  <Field label="Preço promocional">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="0,00"
                        value={form.promoConfig.promoPrice}
                        onChange={e => setPromo({ promoPrice: e.target.value })}
                        className="h-10 rounded-xl pl-8 font-semibold"
                      />
                    </div>
                    {(() => {
                      const promo = parseFloat(parseCurrency(form.promoConfig?.promoPrice ?? "")) || 0;
                      const base  = parseFloat(parseCurrency(form.price)) || 0;
                      if (promo > 0 && base > 0 && promo < base) {
                        const disc = Math.round(((base - promo) / base) * 100);
                        const save = (base - promo).toFixed(2).replace(".", ",");
                        return (
                          <p className="text-xs text-violet-700 mt-1 font-medium">
                            {disc}% de desconto — economia de R$ {save} por unidade
                          </p>
                        );
                      }
                      if (promo >= base && promo > 0 && base > 0) {
                        return <p className="text-xs text-destructive mt-1">O preço promocional deve ser menor que o preço de venda.</p>;
                      }
                    })()}
                  </Field>

                  {/* Dias da semana */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dias da semana</Label>
                    <p className="text-xs text-muted-foreground -mt-1">Sem seleção = válido todos os dias</p>
                    <div className="flex gap-1.5">
                      {[
                        { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" },
                        { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
                      ].map(({ v, l }) => {
                        const on = (form.promoConfig?.daysOfWeek ?? []).includes(v);
                        return (
                          <button key={v} type="button" onClick={() => toggleDay(v)}
                            className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${
                              on ? "bg-violet-600 text-white shadow-sm" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                            }`}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horário */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Horário (Happy Hour)
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">Sem preenchimento = válido o dia todo</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Início">
                        <Input type="time" value={form.promoConfig.timeStart ?? ""}
                          onChange={e => setPromo({ timeStart: e.target.value || null })}
                          className="h-10 rounded-xl" />
                      </Field>
                      <Field label="Término">
                        <Input type="time" value={form.promoConfig.timeEnd ?? ""}
                          onChange={e => setPromo({ timeEnd: e.target.value || null })}
                          className="h-10 rounded-xl" />
                      </Field>
                    </div>
                  </div>

                  {/* Período de vigência */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Período de vigência
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">Sem preenchimento = sem data de expiração</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Data de início">
                        <Input type="date" value={form.promoConfig.dateStart ?? ""}
                          onChange={e => setPromo({ dateStart: e.target.value || null })}
                          className="h-10 rounded-xl" />
                      </Field>
                      <Field label="Data de término">
                        <Input type="date" value={form.promoConfig.dateEnd ?? ""}
                          onChange={e => setPromo({ dateEnd: e.target.value || null })}
                          className="h-10 rounded-xl" />
                      </Field>
                    </div>
                  </div>

                  {/* Canais */}
                  <div className="p-3.5 rounded-xl border border-border bg-secondary/20 space-y-3">
                    <p className="text-sm font-medium">Canais de aplicação</p>
                    {([
                      { key: "applyToStore" as const, label: "Loja Pública (Vitrine Online)", desc: "Aplica desconto no catálogo online" },
                      { key: "applyToPdv"   as const, label: "PDV (Frente de Caixa)",        desc: "Aplica desconto nas vendas presenciais" },
                    ]).map(ch => (
                      <div key={ch.key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{ch.label}</p>
                          <p className="text-xs text-muted-foreground">{ch.desc}</p>
                        </div>
                        <button type="button" role="switch"
                          aria-checked={!!form.promoConfig?.[ch.key]}
                          onClick={() => setPromo({ [ch.key]: !form.promoConfig?.[ch.key] })}
                          className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                            form.promoConfig?.[ch.key] ? "bg-violet-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                            form.promoConfig?.[ch.key] ? "translate-x-5" : "translate-x-0"
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Preview de status ao vivo */}
                  {form.promoConfig.promoPrice && (() => {
                    const storeActive = isPromoActive(form.promoConfig, "store");
                    const pdvActive   = isPromoActive(form.promoConfig, "pdv");
                    const anyActive   = storeActive || pdvActive;
                    return (
                      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                        anyActive
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                          : "bg-secondary/50 text-muted-foreground border-border"
                      }`}>
                        {anyActive
                          ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-semibold">
                            {anyActive ? "Promoção ativa agora" : "Fora do período de promoção"}
                          </p>
                          <p className="text-xs mt-0.5 font-normal opacity-80">
                            Simulação com base na data/hora atual e configurações acima
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </>
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
                            <div className="grid grid-cols-3 gap-2">
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
                              <MiniImageGallery
                                images={opt.images}
                                onChange={imgs => setOptionImages(group.id, opt.id, imgs)}
                              />
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
        <div className="px-6 py-4 border-t border-border/50 bg-surface space-y-3">
          {saveError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.price}
              className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? "Salvar alterações" : "Criar produto"}
            </Button>
          </div>
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
  const { confirm: confirmDialog, dialog: confirmDialogNode } = useConfirmDialog();

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
        <td>—</td>
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
                    {p.sku && <p className="text-[11px] text-muted-foreground">SKU: {p.sku}</p>}
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

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        onSaved={handleSaved}
        onDelete={handleDelete}
        editing={editing}
      />

      {confirmDialogNode}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
