import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";
import {
  Plus, X, ChevronDown, Tag, DollarSign, LayoutGrid,
  Box, Barcode, Hash, ImagePlus, Check,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  Layers, Percent, Star, Clock, Calendar,
  Building2, Package, Loader2, MoreVertical,
} from "lucide-react";
import { type PromoConfig, DEFAULT_PROMO_CONFIG, isPromoActive } from "@/lib/promo-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { fmt } from "./produtos";
import type {
  Product, Category, ProductImage, ProductForm, ProductStatus, ProductType,
  VariationGroup, VariationOption, VariationPriceType,
} from "./produtos";

interface Sector {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
}

const EMPTY_FORM: ProductForm = {
  name: "", description: "", price: "",
  costPrice: "", lowStockThreshold: "5",
  sku: "", barcode: "", pdvCode: "", unit: "un", images: [],
  badge: "", categoryId: "", trackStock: false, status: "ativo", allowObservation: false,
  variationGroups: [], promoConfig: null,
  productType: "Produto", isWeightScale: false,
};

const uid = () => Math.random().toString(36).slice(2);

const newOption = (): VariationOption => ({ id: uid(), name: "", price: "", images: [] });

const newGroup = (): VariationGroup => ({ id: uid(), groupName: "", priceType: "adicional", required: true, options: [newOption()] });

const UNITS = ["un", "kg", "g", "l", "ml", "cx", "pç", "par"];

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

// ─── Configuração de promoção (produto ou opção de variação) ───────
// Mesmos campos nos dois contextos: preço promocional, dias/horário/período
// de vigência e canais. `comparePrice` é o preço "cheio" contra o qual o
// desconto é calculado — preço do produto, ou adicional da variação.
function PromoConfigFields({
  config,
  onChange,
  comparePrice,
  priceLabel = "Preço promocional",
  toggleLabel = "Ativar promoção por recorrência",
  toggleHint = "Define um preço promocional com dias, horários e período específicos",
}: {
  config: PromoConfig;
  onChange: (updates: Partial<PromoConfig>) => void;
  comparePrice: number;
  priceLabel?: string;
  toggleLabel?: string;
  toggleHint?: string;
}) {
  const toggleDay = (day: number) => {
    const days = config.daysOfWeek ?? [];
    onChange({ daysOfWeek: days.includes(day) ? days.filter(d => d !== day) : [...days, day] });
  };

  return (
    <>
      {/* Toggle ativar */}
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-violet-500" />
            {toggleLabel}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{toggleHint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!config.enabled}
          onClick={() => onChange({ enabled: !config.enabled })}
          className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
            config.enabled ? "bg-violet-600" : "bg-muted-foreground/30"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            config.enabled ? "translate-x-5" : "translate-x-0"
          }`} />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Preço promocional */}
          <Field label={priceLabel}>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="0,00"
                value={config.promoPrice}
                onChange={e => onChange({ promoPrice: e.target.value })}
                className="h-10 rounded-xl pl-8 font-semibold"
              />
            </div>
            {(() => {
              const promo = parseFloat(parseCurrency(config.promoPrice ?? "")) || 0;
              const base  = comparePrice;
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
                return <p className="text-xs text-destructive mt-1">O preço promocional deve ser menor que o preço cheio.</p>;
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
                const on = (config.daysOfWeek ?? []).includes(v);
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
                <Input type="time" value={config.timeStart ?? ""}
                  onChange={e => onChange({ timeStart: e.target.value || null })}
                  className="h-10 rounded-xl" />
              </Field>
              <Field label="Término">
                <Input type="time" value={config.timeEnd ?? ""}
                  onChange={e => onChange({ timeEnd: e.target.value || null })}
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
                <Input type="date" value={config.dateStart ?? ""}
                  onChange={e => onChange({ dateStart: e.target.value || null })}
                  className="h-10 rounded-xl" />
              </Field>
              <Field label="Data de término">
                <Input type="date" value={config.dateEnd ?? ""}
                  onChange={e => onChange({ dateEnd: e.target.value || null })}
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
                  aria-checked={!!config[ch.key]}
                  onClick={() => onChange({ [ch.key]: !config[ch.key] })}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                    config[ch.key] ? "bg-violet-600" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    config[ch.key] ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            ))}
          </div>

          {/* Preview de status ao vivo */}
          {config.promoPrice && (() => {
            const storeActive = isPromoActive(config, "store");
            const pdvActive   = isPromoActive(config, "pdv");
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

function SectorPickerModal({
  open, onClose, allSectors, selected, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  allSectors: Sector[];
  selected: string[];
  onConfirm: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => { if (open) setDraft(selected); }, [open, selected]);

  const toggle = (id: string) =>
    setDraft(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const active = allSectors.filter(s => s.active);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Setores de estoque
          </DialogTitle>
        </DialogHeader>
        <div className="pt-1">
          {active.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum setor ativo.<br />
              <span className="text-xs">Cadastre setores em Cadastros → Setores.</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {active.map(sector => {
                const checked = draft.includes(sector.id);
                return (
                  <button
                    key={sector.id}
                    type="button"
                    onClick={() => toggle(sector.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: sector.color ?? "#64748b" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sector.name}</p>
                      {sector.description && (
                        <p className="text-xs text-muted-foreground truncate">{sector.description}</p>
                      )}
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      checked ? "bg-primary border-primary" : "border-muted-foreground/30"
                    }`}>
                      {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => { onConfirm(draft); onClose(); }}
              className="flex-1 rounded-xl"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Form Modal ───────────────────────────────────────────
export default function ProductFormModal({
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
  const [promoEditorFor, setPromoEditorFor] = useState<{ gid: string; oid: string } | null>(null);
  const [errors, setErrors] = useState<{ categoryId?: string; price?: string; pdvCode?: string }>({});
  const [pdvCodeLoading, setPdvCodeLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [allSectors, setAllSectors] = useState<Sector[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [sectorPickerOpen, setSectorPickerOpen] = useState(false);

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
        pdvCode: editing.pdvCode || "",
        unit: editing.unit || "un",
        images: loadedImages,
        badge: editing.badge || "",
        categoryId: editing.categoryId || "",
        trackStock: editing.trackStock === true,
        status: editing.active === null ? "suspenso" : editing.active === false ? "inativo" : "ativo",
        allowObservation: editing.allowObservation === true,
        variationGroups: editing.variationGroups || [],
        promoConfig: editing.promoConfig || null,
        productType: (editing.productType as ProductType) || "Produto",
        isWeightScale: editing.isWeightScale === true,
      });
    } else {
      setForm(EMPTY_FORM);
      // Auto-preenche o próximo código disponível para novos produtos
      if (open) {
        setPdvCodeLoading(true);
        api.get("/api/products/next-pdv-code")
          .then(r => r.json() as Promise<{ nextPdvCode?: number }>)
          .then(d => { if (d.nextPdvCode) setForm(f => ({ ...f, pdvCode: String(d.nextPdvCode) })); })
          .catch(() => {})
          .finally(() => setPdvCodeLoading(false));
      }
    }
    setTab("basic");
    setShowNewCat(false);
    setNewCatName("");
    setSelectedSectorIds([]);

    // Load sectors list + product sector assignments when modal opens
    if (open) {
      const storeId = localStorage.getItem("storeId");
      if (storeId) {
        fetch(`/api/sectors/list?storeId=${storeId}`, { credentials: "include" })
          .then(r => r.json())
          .then((d: { sectors?: Sector[] }) => setAllSectors(d.sectors ?? []))
          .catch(() => {});
      }
      if (editing?.id) {
        fetch(`/api/product-sectors?productId=${editing.id}`, { credentials: "include" })
          .then(r => r.json())
          .then((d: { sectorIds?: string[] }) => setSelectedSectorIds(d.sectorIds ?? []))
          .catch(() => {});
      }
    }
  }, [editing, open]);

  const set = (k: keyof ProductForm, v: string | boolean | VariationGroup[] | ProductImage[]) =>
    setForm(f => ({ ...f, [k]: v }));

  const addGroup = () => set("variationGroups", [...form.variationGroups, newGroup()]);

  const removeGroup = (gid: string) =>
    set("variationGroups", form.variationGroups.filter(g => g.id !== gid));

  const setGroupName = (gid: string, name: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, groupName: name } : g) }));

  const setGroupPriceType = (gid: string, priceType: VariationPriceType) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, priceType } : g) }));

  const setGroupRequired = (gid: string, required: boolean) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, required } : g) }));

  const addOption = (gid: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: [...g.options, newOption()] } : g) }));

  const removeOption = (gid: string, oid: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: g.options.filter(o => o.id !== oid) } : g) }));

  const setOption = (gid: string, oid: string, k: "name" | "price", v: string) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, [k]: v } : o) } : g) }));

  const setOptionImages = (gid: string, oid: string, imgs: ProductImage[]) =>
    setForm(f => ({ ...f, variationGroups: f.variationGroups.map(g => g.id === gid ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, images: imgs } : o) } : g) }));

  const setOptionPromo = (gid: string, oid: string, updates: Partial<PromoConfig>) =>
    setForm(f => ({
      ...f,
      variationGroups: f.variationGroups.map(g => g.id !== gid ? g : {
        ...g,
        options: g.options.map(o => o.id !== oid ? o : {
          ...o,
          promoConfig: { ...(o.promoConfig ?? DEFAULT_PROMO_CONFIG), ...updates },
        }),
      }),
    }));

  const removeOptionPromo = (gid: string, oid: string) =>
    setForm(f => ({
      ...f,
      variationGroups: f.variationGroups.map(g => g.id !== gid ? g : {
        ...g,
        options: g.options.map(o => o.id !== oid ? o : { ...o, promoConfig: null }),
      }),
    }));

  const setPromo = (updates: Partial<PromoConfig>) =>
    setForm(f => ({ ...f, promoConfig: { ...(f.promoConfig ?? DEFAULT_PROMO_CONFIG), ...updates } }));

  const margin = calcMargin(form.price, form.costPrice);

  const handleSave = async () => {
    const newErrors: { categoryId?: string; price?: string; pdvCode?: string } = {};
    if (!form.categoryId) newErrors.categoryId = "Selecione uma categoria para o produto.";
    if (!form.price) newErrors.price = "Informe o preço do produto.";
    if (!form.pdvCode.trim()) newErrors.pdvCode = "O código PDV é obrigatório para vendas rápidas no caixa.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.categoryId || newErrors.pdvCode) setTab("basic");
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
        pdvCode: form.pdvCode || undefined,
        unit: form.unit,
        imageUrl: primaryImg?.url || undefined,
        images: imagesPayload,
        badge: form.badge || undefined,
        categoryId: form.categoryId || undefined,
        trackStock: form.trackStock,
        active: form.status === "suspenso" ? null : form.status === "inativo" ? false : true,
        allowObservation: form.allowObservation,
        promoConfig: form.promoConfig?.enabled ? form.promoConfig : null,
        productType: form.productType,
        isWeightScale: form.isWeightScale,
        variationGroups: form.variationGroups,
      };
      let res: Response;
      if (editing) {
        res = await api.post("/api/products/update", { productId: editing.id, ...payload });
      } else {
        res = await api.post("/api/products/create", payload);
      }
      const data = await res.json();
      if (res.ok && (data.success || data.product)) {
        const productId = data.product?.id ?? editing?.id;
        if (productId) {
          await api.post("/api/product-sectors/set", { productId, sectorIds: selectedSectorIds }).catch(() => {});
        }
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
    <>
      <SectorPickerModal
        open={sectorPickerOpen}
        onClose={() => setSectorPickerOpen(false)}
        allSectors={allSectors}
        selected={selectedSectorIds}
        onConfirm={setSelectedSectorIds}
      />
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <Field label="Nome do produto *">
                    <Input autoFocus placeholder="Ex: Arroz Integral 5kg"
                      value={form.name} onChange={e => set("name", e.target.value)}
                      className="h-10 rounded-xl" />
                  </Field>
                </div>
                <div className="md:col-span-1">
                  <Field label="Código PDV *">
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder={pdvCodeLoading ? "Calculando..." : "Ex: 102"}
                        value={form.pdvCode}
                        onChange={e => {
                          set("pdvCode", e.target.value.replace(/\D/g, "").slice(0, 20));
                          if (errors.pdvCode) setErrors(prev => ({ ...prev, pdvCode: undefined }));
                        }}
                        className={`h-10 rounded-xl pl-8 font-mono tracking-wider${errors.pdvCode ? " border-destructive focus-visible:ring-destructive" : ""}`}
                        inputMode="numeric"
                        disabled={pdvCodeLoading}
                      />
                      {pdvCodeLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    </div>
                    {errors.pdvCode
                      ? <p className="text-[10px] text-destructive mt-1">{errors.pdvCode}</p>
                      : <p className="text-[10px] text-muted-foreground mt-1">Único por loja · preenchido automaticamente</p>
                    }
                  </Field>
                </div>
              </div>

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

              <Field label="Tipo do produto">
                <div className="relative">
                  <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={form.productType}
                    onChange={e => set("productType", e.target.value as ProductType)}
                    className="w-full h-10 pl-8 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition"
                  >
                    <option value="Produto">Produto — item de venda padrão</option>
                    <option value="Insumo e Composição">Insumo e Composição — ingrediente / matéria-prima</option>
                    <option value="Serviço e Taxa de entrega">Serviço e Taxa de entrega — cobrança adicional</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
                {form.productType !== "Produto" && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {form.productType === "Insumo e Composição"
                      ? "Usado no controle de estoque de ingredientes e cozinha. Não aparece na vitrine pública."
                      : "Taxas e cobranças adicionais. Não desconta estoque ao vender."}
                  </p>
                )}
              </Field>

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

              <Field label="Preço de Custo (R$)" hint="Não exibido na vitrine">
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

              {/* Toggle balança */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
                <div>
                  <p className="text-sm font-medium">Vendido por peso (Balança)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ativa venda fracionada em kg — estoque e PDV aceitam decimais (ex: 1,250 kg)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isWeightScale}
                  onClick={() => {
                    const next = !form.isWeightScale;
                    setForm(f => ({ ...f, isWeightScale: next, unit: next ? "kg" : (f.unit === "kg" ? "un" : f.unit) }));
                  }}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                    form.isWeightScale ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.isWeightScale ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {form.isWeightScale && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  Unidade definida automaticamente para <strong>kg</strong>. O PDV exibirá campo de peso fracionado.
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-secondary/10 p-4 flex items-start gap-3">
                <Box className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Quantidade controlada por movimentações</p>
                  <p>O saldo atual do produto é atualizado exclusivamente pelo módulo de <strong>Estoque</strong> — via entradas, saídas, ajustes e balanços. Não é possível editar a quantidade diretamente aqui.</p>
                </div>
              </div>

              {/* Setores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Setores de estoque</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Áreas ou locais onde este produto é armazenado
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-8 gap-1.5 text-xs"
                    onClick={() => setSectorPickerOpen(true)}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Setores
                    {selectedSectorIds.length > 0 && (
                      <span className="ml-0.5 bg-primary text-primary-foreground rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                        {selectedSectorIds.length}
                      </span>
                    )}
                  </Button>
                </div>
                {selectedSectorIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSectorIds.map(id => {
                      const sector = allSectors.find(s => s.id === id);
                      if (!sector) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                          style={{
                            backgroundColor: sector.color ? `${sector.color}18` : undefined,
                            borderColor: sector.color ? `${sector.color}40` : undefined,
                            color: sector.color ?? undefined,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: sector.color ?? "#64748b" }}
                          />
                          {sector.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Tab: Promoções ── */}
          {tab === "promocoes" && (
            <PromoConfigFields
              config={form.promoConfig ?? DEFAULT_PROMO_CONFIG}
              onChange={setPromo}
              comparePrice={parseFloat(parseCurrency(form.price)) || 0}
            />
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
                      <div className="px-4 py-3 bg-secondary/30 border-b border-border/40 space-y-2.5">
                        <div className="flex items-center gap-3">
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
                        <div className="flex items-center gap-2 pl-6">
                          <span className="text-[11px] text-muted-foreground shrink-0">Tipo de preço:</span>
                          <div className="flex rounded-lg border border-border/60 overflow-hidden">
                            {([
                              { v: "adicional" as const, l: "Adicional", hint: "Soma o valor da opção ao preço do produto" },
                              { v: "opcional"  as const, l: "Opcional",  hint: "Substitui o preço do produto pelo valor da opção" },
                            ]).map(({ v, l, hint }) => {
                              const active = (group.priceType ?? "adicional") === v;
                              return (
                                <button key={v} type="button" title={hint}
                                  onClick={() => setGroupPriceType(group.id, v)}
                                  className={`px-2.5 h-6 text-[11px] font-semibold transition-colors ${
                                    active ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-secondary"
                                  }`}>
                                  {l}
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-[10px] text-muted-foreground/80">
                            {(group.priceType ?? "adicional") === "opcional"
                              ? "substitui o preço do produto"
                              : "soma ao preço do produto"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pl-6">
                          <button type="button" role="switch"
                            aria-checked={group.required ?? true}
                            onClick={() => setGroupRequired(group.id, !(group.required ?? true))}
                            className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${
                              (group.required ?? true) ? "bg-primary" : "bg-muted-foreground/30"
                            }`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                              (group.required ?? true) ? "translate-x-4" : "translate-x-0"
                            }`} />
                          </button>
                          <span className="text-[11px] text-muted-foreground">
                            {(group.required ?? true)
                              ? "Obrigatório — cliente precisa escolher uma opção"
                              : "Não obrigatório — cliente pode comprar sem escolher"}
                          </span>
                        </div>
                      </div>

                      {/* Opções do grupo */}
                      <div className="p-4 space-y-3">
                        {group.options.map((opt, oidx) => (
                          <div key={opt.id} className="rounded-xl border border-border/50 bg-background p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                                  {opt.name.trim() || `Opção ${oidx + 1}`}
                                </span>
                                {opt.promoConfig?.enabled && (
                                  <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-600 text-[9px] font-bold uppercase">
                                    <Percent className="w-2.5 h-2.5" /> Promoção
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button type="button"
                                      className="w-5 h-5 rounded hover:bg-secondary text-muted-foreground flex items-center justify-center transition-colors">
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem onClick={() => {
                                      if (!opt.promoConfig) setOptionPromo(group.id, opt.id, { enabled: true });
                                      setPromoEditorFor({ gid: group.id, oid: opt.id });
                                    }}>
                                      <Percent className="w-3.5 h-3.5 mr-1.5" />
                                      {opt.promoConfig ? "Editar promoção" : "Criar promoção"}
                                    </DropdownMenuItem>
                                    {opt.promoConfig && (
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => removeOptionPromo(group.id, opt.id)}
                                      >
                                        <X className="w-3.5 h-3.5 mr-1.5" />
                                        Remover promoção
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                {group.options.length > 1 && (
                                  <button type="button" onClick={() => removeOption(group.id, opt.id)}
                                    className="w-5 h-5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
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

    {/* Promoção de uma opção de variação específica */}
    {(() => {
      if (!promoEditorFor) return null;
      const group  = form.variationGroups.find(g => g.id === promoEditorFor.gid);
      const option = group?.options.find(o => o.id === promoEditorFor.oid);
      if (!group || !option) return null;
      return (
        <Dialog open onOpenChange={v => !v && setPromoEditorFor(null)}>
          <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden max-h-[85vh] flex flex-col">
            <DialogHeader className="px-6 pt-5 pb-0">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Percent className="w-4 h-4 text-violet-500" />
                Promoção — {group.groupName || "Variação"}: {option.name || "Opção"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <PromoConfigFields
                config={option.promoConfig ?? DEFAULT_PROMO_CONFIG}
                onChange={updates => setOptionPromo(group.id, option.id, updates)}
                comparePrice={parseFloat(parseCurrency(option.price || "0")) || 0}
                priceLabel="Preço promocional do adicional"
                toggleLabel="Ativar promoção nesta variação"
                toggleHint="Desconta o adicional desta opção — o preço-base do produto não é afetado"
              />
            </div>
            <div className="px-6 py-4 border-t border-border/50 bg-surface flex justify-end">
              <Button onClick={() => setPromoEditorFor(null)}
                className="h-9 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
                <Check className="w-3.5 h-3.5" /> Concluído
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    })()}
    </>
  );
}
