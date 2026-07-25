import { useState } from "react";
import {
  BarChart2, ChevronDown, Eye, FolderOpen, Globe, Loader2, Menu, Search, Star,
} from "lucide-react";
import { CategoryIcon, CATEGORY_ICONS } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Category, CategoryFormState } from "./categorias";

function toSlug(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CategoryForm({
  form, setForm, categories, editingId, saving, onSubmit, onClose, validationError,
}: {
  form: CategoryFormState;
  setForm: (f: CategoryFormState) => void;
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
