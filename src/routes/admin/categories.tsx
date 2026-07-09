import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Tags, Plus, Search, MoreHorizontal, Loader2, ChevronDown,
  Eye, EyeOff, Pencil, Trash2, Star, Menu, X, Globe, CheckCircle2,
  FolderOpen, Package, ArrowUpDown, Filter, BarChart2,
} from "lucide-react";
import { CategoryIcon, CATEGORY_ICONS } from "@/lib/category-icons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesPage,
  head: () => ({ meta: [{ title: "Categorias — ARMAZIX" }] }),
});

interface Category {
  id: string;
  name: string;
  slug: string | null;
  emoji: string | null;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  active: boolean;
  showInMenu: boolean;
  featured: boolean;
  analytic: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  productsCount: number;
}

const EMPTY_FORM = {
  name: "", slug: "", imageUrl: "",
  parentId: "", position: 0, active: true, showInMenu: true, featured: false, analytic: false,
  icon: "Package",
};

function toSlug(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 max-w-sm ${type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"}`}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
      <span>{msg}</span>
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function CategoryStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
      {active ? "Ativa" : "Oculta"}
    </span>
  );
}

function CategoryForm({
  form, setForm, categories, editingId, saving, onSubmit, onClose, validationError,
}: {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  categories: Category[];
  editingId: string | null;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
  validationError?: string | null;
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

  const domainPreview = "armazix.com.br";

  const filteredIcons = iconSearch.trim()
    ? CATEGORY_ICONS.filter(
        i => i.label.toLowerCase().includes(iconSearch.toLowerCase()) ||
             i.name.toLowerCase().includes(iconSearch.toLowerCase())
      )
    : CATEGORY_ICONS;

  const handleNameChange = (v: string) => {
    setForm({ ...form, name: v, slug: toSlug(v) });
  };

  // Só categorias raiz (sem parentId) podem ser pai — e excluir a própria sendo editada
  const rootCategories = categories.filter(c => !c.parentId && c.id !== editingId);

  // Se analítica, limpar parentId automaticamente
  const handleAnalyticToggle = (v: boolean) => {
    setForm({ ...form, analytic: v, parentId: v ? "" : form.parentId });
  };

  return (
    <div className="space-y-0">
      <Tabs defaultValue="info">
        <TabsList className="w-full rounded-xl mb-4 bg-muted/60">
          <TabsTrigger value="info" className="flex-1 rounded-lg text-xs">Informações</TabsTrigger>
          <TabsTrigger value="config" className="flex-1 rounded-lg text-xs">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-0">
          {/* Toggle Analítica — destaque no topo */}
          <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
            form.analytic ? "border-primary/40 bg-primary/5" : "border-border/60"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                form.analytic ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Analítico</p>
              </div>
            </div>
            <Switch checked={form.analytic} onCheckedChange={handleAnalyticToggle} />
          </div>

          {validationError && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{validationError}</p>
          )}

          {/* Nome */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome *</Label>
            <Input
              placeholder="Ex: Bebidas, Lanches, Promoções"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              className="h-11 rounded-xl border-border/70 focus:border-primary/50"
              autoFocus
            />
          </div>

          {/* Ícone */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ícone</Label>
            <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 w-full h-11 px-3 rounded-xl border border-border/70 hover:border-primary/50 transition-colors bg-background text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <CategoryIcon name={form.icon} className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-foreground flex-1">
                    {CATEGORY_ICONS.find(i => i.name === form.icon)?.label ?? form.icon ?? "Package"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 rounded-2xl overflow-clip" align="start">
                {/* Barra de busca — fixa no topo */}
                <div className="px-3 pt-3 pb-2 border-b border-border/50">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar ícone..."
                      value={iconSearch}
                      onChange={e => setIconSearch(e.target.value)}
                      className="pl-8 h-8 rounded-lg text-sm border-border/70"
                      autoComplete="off"
                    />
                  </div>
                </div>
                {/* Grid com scroll — overflow-clip no pai garante que wheel events chegam aqui */}
                <div className="p-2 max-h-64 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
                  <div className="grid grid-cols-4 gap-1">
                    {filteredIcons.map(({ name, label }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, icon: name });
                          setIconPickerOpen(false);
                          setIconSearch("");
                        }}
                        className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl transition-colors ${
                          form.icon === name
                            ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                        title={label}
                      >
                        <CategoryIcon name={name} className="w-5 h-5 shrink-0" />
                        <span className="text-[10px] leading-tight text-center w-full truncate px-0.5">{label}</span>
                      </button>
                    ))}
                    {filteredIcons.length === 0 && (
                      <p className="col-span-4 text-center text-xs text-muted-foreground py-6">Nenhum ícone encontrado</p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Slug — somente leitura */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Slug (gerado automaticamente)</Label>
            <div className="relative">
              <Input
                value={form.slug}
                readOnly
                className="h-11 rounded-xl border-border/70 pr-10 font-mono text-sm bg-muted/40 text-muted-foreground cursor-default select-all"
              />
              <Globe className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40" />
            </div>
            {form.slug && (
              <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg font-mono">
                {domainPreview}/categorias/<span className="text-primary font-semibold">{form.slug}</span>
              </p>
            )}
          </div>

          {/* Categoria pai — desabilitada quando analítica */}
          <div className="space-y-2">
            <Label className={`text-xs font-semibold uppercase tracking-wide ${
              form.analytic ? "text-muted-foreground/40" : "text-muted-foreground"
            }`}>Categoria pai {form.analytic && <span className="normal-case font-normal">(desabilitado para analíticas)</span>}</Label>
            <Select
              value={form.parentId || "none"}
              onValueChange={v => setForm({ ...form, parentId: v === "none" ? "" : v })}
              disabled={form.analytic}
            >
              <SelectTrigger className={`h-11 rounded-xl border-border/70 ${
                form.analytic ? "opacity-40 cursor-not-allowed" : ""
              }`}>
                <SelectValue placeholder="Nenhuma (categoria raiz)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none" className="rounded-lg">
                  <span className="flex items-center gap-2 text-muted-foreground"><FolderOpen className="w-3.5 h-3.5" /> Nenhuma (raiz)</span>
                </SelectItem>
                {rootCategories.map(c => (
                  <SelectItem key={c.id} value={c.id} className="rounded-lg">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      {c.name}
                      {c.analytic && <span className="text-xs text-primary/60 ml-1">(analítica)</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ordem */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ordem</Label>
            <Input
              type="number"
              min={1}
              placeholder="Ex: 1, 2, 3…"
              value={form.position || ""}
              onChange={e => setForm({ ...form, position: Number(e.target.value) })}
              className="h-11 rounded-xl border-border/70 w-32"
            />
            <p className="text-xs text-muted-foreground">
              {form.parentId
                ? `Posição dentro de "${rootCategories.find(c => c.id === form.parentId)?.name ?? ""}"` 
                : "Posição entre as categorias raiz"
              }
            </p>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4 mt-0">
          <div className="space-y-3">
            {[
              { key: "active" as const, label: "Categoria ativa", desc: "Visível na loja pública", icon: Eye },
              { key: "showInMenu" as const, label: "Mostrar no menu", desc: "Aparece na navegação da loja", icon: Menu },
              { key: "featured" as const, label: "Destacar na home", desc: "Aparece na página inicial da loja", icon: Star },
            ].map(({ key, label, desc, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-border transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form[key] ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={form[key]}
                  onCheckedChange={v => setForm({ ...form, [key]: v })}
                />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tabs are controlled via CSS hack — real tab switch */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11 rounded-xl" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={onSubmit}
          disabled={saving || !form.name.trim() || !form.position}
          className="flex-1 h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Salvar alterações" : "Criar categoria"}
        </Button>
      </div>
    </div>
  );
}

function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "hidden">("all");
  const [sortBy, setSortBy] = useState<"position" | "name" | "products">("position");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { confirm: confirmDialog, dialog: confirmDialogNode } = useConfirmDialog();

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) fetchCategories(storeId);
    else setLoading(false);
  }, []);

  const fetchCategories = async (storeId: string) => {
    try {
      const res = await fetch(`/api/categories/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch { /* noop */ } finally { setLoading(false); }
  };

  const refreshCategories = async () => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    try {
      const res = await fetch(`/api/categories/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch { /* noop */ }
  };

  const openCreate = async () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setValidationError(null);
    await refreshCategories();
    setDialogOpen(true);
  };

  const openEdit = async (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name, slug: cat.slug || "", imageUrl: cat.imageUrl || "",
      parentId: cat.parentId || "", position: cat.position,
      active: cat.active, showInMenu: cat.showInMenu, featured: cat.featured,
      analytic: cat.analytic ?? false,
      icon: cat.icon || "Package",
    });
    setValidationError(null);
    await refreshCategories();
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    // Validações locais
    const others = categories.filter(c => c.id !== editingId);

    const nameDup = others.find(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (nameDup) {
      setValidationError(`Já existe uma categoria com o nome "${nameDup.name}".`);
      return;
    }

    if (form.analytic && form.parentId) {
      setValidationError("Categoria analítica não pode ter categoria pai.");
      return;
    }

    const posDup = others.find(c =>
      c.position === form.position &&
      (c.parentId || null) === (form.parentId || null)
    );
    if (posDup) {
      setValidationError(`A numeração ${form.position} já está em uso por "${posDup.name}".`);
      return;
    }

    setValidationError(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name, slug: form.slug || undefined,
        imageUrl: form.imageUrl || undefined,
        parentId: form.parentId || undefined, position: form.position,
        active: form.active, showInMenu: form.showInMenu, featured: form.featured,
        analytic: form.analytic,
        icon: form.icon || "Package",
      };
      let res: Response;
      if (editingId) {
        res = await api.post("/api/categories/update", { categoryId: editingId, ...payload });
      } else {
        res = await api.post("/api/categories/create", payload);
      }
      const data = await res.json();
      if (res.ok && (data.success || data.category)) {
        if (editingId) {
          setCategories(prev => prev.map(c => c.id === editingId ? { ...c, ...data.category } : c));
          showToast("Categoria atualizada!", "success");
        } else {
          setCategories(prev => [...prev, { ...data.category, productsCount: 0 }]);
          showToast("Categoria criada com sucesso!", "success");
        }
        setDialogOpen(false);
      } else {
        showToast(data.error || "Erro ao salvar categoria", "error");
      }
    } catch { showToast("Erro ao salvar categoria", "error"); }
    finally { setSaving(false); }
  };

  const handleToggleStatus = async (cat: Category) => {
    setTogglingId(cat.id);
    try {
      const res = await api.post("/api/categories/update", { categoryId: cat.id, active: !cat.active });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, active: !cat.active } : c));
        showToast(!cat.active ? "Categoria ativada" : "Categoria ocultada", "success");
      }
    } catch { /* noop */ }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (categoryId: string) => {
    const ok = await confirmDialog(
      "Remover categoria?",
      "Produtos vinculados ficarão sem categoria. Esta ação não pode ser desfeita.",
      "Remover",
    );
    if (!ok) return;
    setDeletingId(categoryId);
    try {
      const res = await api.post("/api/categories/delete", { categoryId });
      if (res.ok) {
        setCategories(prev =>
          prev
            .filter(c => c.id !== categoryId)
            .map(c => c.parentId === categoryId ? { ...c, parentId: null } : c)
        );
        showToast("Categoria removida", "success");
      }
    } catch { /* noop */ }
    finally { setDeletingId(null); }
  };

  const parentName = (parentId: string | null) => categories.find(c => c.id === parentId)?.name;

  // Constrói lista hierárquica com numeração 1 / 1.1 / 1.2 / 2 / 2.1 …
  type HierarchyItem = Category & { label: string; depth: number };

  const buildHierarchy = (): HierarchyItem[] => {
    const q = search.toLowerCase();
    const matchesFilter = (c: Category) => {
      if (filterStatus === "active" && !c.active) return false;
      if (filterStatus === "hidden" && c.active) return false;
      return true;
    };
    const matchesSearch = (c: Category) =>
      !q || c.name.toLowerCase().includes(q) || (c.slug || "").includes(q);

    const sortFn = (a: Category, b: Category) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "products") return b.productsCount - a.productsCount;
      return a.position - b.position;
    };

    const roots = categories
      .filter(c => !c.parentId)
      .sort(sortFn);

    const result: HierarchyItem[] = [];

    roots.forEach((root, ri) => {
      const rootNum = String(ri + 1);
      const children = categories
        .filter(c => c.parentId === root.id)
        .sort(sortFn);

      // inclui raiz se passa no filtro OU se tem algum filho que passa
      const childrenPassing = children.filter(c => matchesFilter(c) && matchesSearch(c));
      const rootPasses = matchesFilter(root) && matchesSearch(root);

      if (!rootPasses && childrenPassing.length === 0) return;

      if (rootPasses || childrenPassing.length > 0) {
        result.push({ ...root, label: rootNum, depth: 0 });
      }

      children.forEach((child, ci) => {
        if (!matchesFilter(child) || !matchesSearch(child)) return;
        result.push({ ...child, label: `${rootNum}.${ci + 1}`, depth: 1 });
      });
    });

    return result;
  };

  const hierarchyList = buildHierarchy();

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">Carregando categorias...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {categories.length} categoria{categories.length !== 1 ? "s" : ""} · {categories.filter(c => c.active).length} ativas
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Nova categoria
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-border/70"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2 border-border/70 text-sm">
                <Filter className="w-3.5 h-3.5" />
                {filterStatus === "all" ? "Todas" : filterStatus === "active" ? "Ativas" : "Ocultas"}
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl w-40">
              {[["all", "Todas"], ["active", "Ativas"], ["hidden", "Ocultas"]].map(([v, l]) => (
                <DropdownMenuItem key={v} className="rounded-lg" onClick={() => setFilterStatus(v as typeof filterStatus)}>
                  {filterStatus === v && <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-primary" />}
                  {l}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2 border-border/70 text-sm">
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortBy === "position" ? "Ordem" : sortBy === "name" ? "Nome" : "Produtos"}
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl w-40">
              {[["position", "Ordem"], ["name", "Nome A-Z"], ["products", "Mais produtos"]].map(([v, l]) => (
                <DropdownMenuItem key={v} className="rounded-lg" onClick={() => setSortBy(v as typeof sortBy)}>
                  {sortBy === v && <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-primary" />}
                  {l}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Empty state */}
      {hierarchyList.length === 0 && (
        <Card className="rounded-2xl border-dashed border-2 border-border/50">
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Tags className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">
                {search ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Tente outro termo de busca" : "Organize seus produtos criando categorias"}
              </p>
            </div>
            {!search && (
              <Button onClick={openCreate} className="h-10 rounded-xl bg-gradient-primary text-primary-foreground gap-2">
                <Plus className="w-4 h-4" /> Criar primeira categoria
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {hierarchyList.length > 0 && (
        <Card className="rounded-2xl border-border/50 shadow-soft overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-border/50 bg-muted/20">
            <div className="grid grid-cols-[3rem_1fr_auto_auto_auto_auto] gap-4 items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span className="text-center">#</span>
              <span>Categoria</span>
              <span className="hidden sm:block w-20 text-center">Produtos</span>
              <span className="w-20 text-center">Status</span>
              <span className="hidden lg:block w-20 text-center">Destaque</span>
              <span className="w-8" />
            </div>
          </CardHeader>
          <div className="divide-y divide-border/40">
            {hierarchyList.map(cat => (
              <div
                key={cat.id}
                className={`grid grid-cols-[3rem_1fr_auto_auto_auto_auto] gap-4 items-center px-6 py-3.5 hover:bg-muted/30 transition-colors group ${cat.depth === 1 ? "bg-muted/10" : ""}`}
              >
                {/* Número hierárquico */}
                <div className="flex justify-center">
                  <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                    cat.depth === 0
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground bg-muted"
                  }`}>
                    {cat.label}
                  </span>
                </div>

                {/* Name + slug com recuo para filhas */}
                <div className={`min-w-0 flex items-center gap-2 ${cat.depth === 1 ? "pl-4 border-l-2 border-border/50" : ""}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${cat.depth === 0 ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                        {cat.name}
                      </span>
                      {cat.featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                      {cat.showInMenu && <Menu className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    </div>
                    {cat.slug && (
                      <span className="text-xs text-muted-foreground/60 font-mono">/categorias/{cat.slug}</span>
                    )}
                  </div>
                </div>

                {/* Products count */}
                <div className="hidden sm:flex w-20 justify-center">
                  <span className={`flex items-center gap-1 text-xs font-medium ${cat.productsCount > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                    <Package className="w-3.5 h-3.5" /> {cat.productsCount}
                  </span>
                </div>

                {/* Status */}
                <div className="w-20 flex justify-center">
                  <button
                    onClick={() => handleToggleStatus(cat)}
                    disabled={togglingId === cat.id}
                    title={cat.active ? "Ocultar categoria" : "Ativar categoria"}
                    className="transition-opacity hover:opacity-80"
                  >
                    {togglingId === cat.id
                      ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      : <CategoryStatusBadge active={cat.active} />}
                  </button>
                </div>

                {/* Destaque */}
                <div className="hidden lg:flex w-20 justify-center">
                  {cat.featured ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                      <Star className="w-3 h-3 fill-amber-500" /> Sim
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl w-44">
                    <DropdownMenuItem className="rounded-lg gap-2" onClick={() => openEdit(cat)}>
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg gap-2" onClick={() => handleToggleStatus(cat)}>
                      {cat.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {cat.active ? "Ocultar" : "Ativar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="rounded-lg gap-2 text-destructive focus:text-destructive"
                      disabled={deletingId === cat.id}
                      onClick={() => handleDelete(cat.id)}
                    >
                      {deletingId === cat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!saving) setDialogOpen(v); }}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold">
              {editingId ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm
            form={form}
            setForm={setForm}
            categories={categories}
            editingId={editingId}
            saving={saving}
            onSubmit={handleSubmit}
            onClose={() => setDialogOpen(false)}
            validationError={validationError}
          />
        </DialogContent>
      </Dialog>

      {confirmDialogNode}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
