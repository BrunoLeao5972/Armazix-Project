import { useEffect, useState } from "react";
import {
  Palette, Check, Loader2, LayoutGrid, List, Package, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { ImageUploadCrop } from "@/components/armazix/ImageUploadCrop";
import type { StoreData } from "./types";

interface PersonalizacaoTabProps {
  store: StoreData | null;
  setStore: (store: StoreData) => void;
  logoUrl: string; setLogoUrl: (v: string) => void;
  bannerImages: string[]; setBannerImages: (v: string[] | ((prev: string[]) => string[])) => void;
  bannerIntervalMs: number; setBannerIntervalMs: (v: number) => void;
  primaryColor: string; setPrimaryColor: (v: string) => void;
  backgroundColor: string; setBackgroundColor: (v: string) => void;
  textColor: string; setTextColor: (v: string) => void;
  layoutType: 'grid' | 'list'; setLayoutType: (v: 'grid' | 'list') => void;
  showPrice: boolean; setShowPrice: (v: boolean) => void;
  whatsappOrderEnabled: boolean; setWhatsappOrderEnabled: (v: boolean) => void;
  whatsappPhone: string; setWhatsappPhone: (v: string) => void;
  highlightLowStock: boolean; setHighlightLowStock: (v: boolean) => void;
}

export function PersonalizacaoTab({
  store, setStore, logoUrl, setLogoUrl, bannerImages, setBannerImages, bannerIntervalMs, setBannerIntervalMs,
  primaryColor, setPrimaryColor, backgroundColor, setBackgroundColor, textColor, setTextColor,
  layoutType, setLayoutType, showPrice, setShowPrice, whatsappOrderEnabled, setWhatsappOrderEnabled,
  whatsappPhone, setWhatsappPhone, highlightLowStock, setHighlightLowStock,
}: PersonalizacaoTabProps) {
  const [vitrineSaving, setVitrineSaving] = useState(false);
  const [vitrineSuccess, setVitrineSuccess] = useState(false);
  const [vitrineError, setVitrineError] = useState("");

  // Re-fetcha apenas os banners do DB para confirmar persistência sem resetar os outros estados do formulário
  const reloadBanners = async (storeId: string) => {
    try {
      const res = await fetch(`/api/store/get?id=${storeId}`);
      if (!res.ok) return;
      const data = await res.json() as { store?: { banners?: Array<{ imageUrl: string | null; position: number | null }> } };
      const loaded = (data.store?.banners ?? [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(b => b.imageUrl || "")
        .filter(Boolean);
      setBannerImages(loaded);
    } catch {}
  };

  const handleSaveVitrine = async () => {
    if (!store) return;
    setVitrineSaving(true);
    setVitrineSuccess(false);
    setVitrineError("");
    try {
      if (whatsappOrderEnabled && !whatsappPhone.trim()) {
        setVitrineError("Informe o WhatsApp para ativar o pedido via WhatsApp");
        return;
      }

      // Salva configurações da loja + banners em paralelo
      const [storeRes, bannerRes] = await Promise.all([
        api.post("/api/store/update", {
          storeId: store.id,
          logoUrl: logoUrl || null,
          primaryColor,
          backgroundColor,
          textColor,
          showPrice,
          whatsappOrderEnabled,
          whatsappPhone: whatsappOrderEnabled ? whatsappPhone : null,
          highlightLowStock,
          layoutType,
          bannerIntervalMs,
        }),
        api.post("/api/banners/save", {
          imageUrls: bannerImages.filter(Boolean),
        }),
      ]);

      if (!storeRes.ok) {
        const d = await storeRes.json() as { error?: string };
        setVitrineError(d.error || "Erro ao salvar personalização");
        return;
      }

      if (!bannerRes.ok) {
        const d = await bannerRes.json() as { error?: string };
        setVitrineError(d.error || "Erro ao salvar banners");
      }

      setVitrineSuccess(true);
      setTimeout(() => setVitrineSuccess(false), 3000);

      // Re-fetcha os banners do DB para confirmar que persistiram
      await reloadBanners(store.id);

      const storeData = await storeRes.json() as { store?: StoreData };
      if (storeData.store) setStore(storeData.store);
    } catch {
      setVitrineError("Erro de conexão");
    } finally {
      setVitrineSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/50 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Personalizar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="text-sm font-semibold">Identidade básica</div>

          <ImageUploadCrop
            label="Logo"
            value={logoUrl}
            onChange={setLogoUrl}
            recommendedText="Tamanho recomendado: 250x250px (Proporção 1:1) - PNG transparente"
            aspect={1}
            targetWidth={250}
            targetHeight={250}
            maxBytes={2 * 1024 * 1024}
            outputFormat="image/png"
          />

          {/* Multi-banner — até 5 banners, salvos como WebP */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Banners da loja</div>
              <span className="text-xs text-muted-foreground">{bannerImages.length}/5 banners</span>
            </div>

            <div className="space-y-4">
              {bannerImages.map((img, idx) => (
                <div key={idx} className="relative">
                  <div className="text-xs text-muted-foreground mb-1">Banner {idx + 1}</div>
                  <ImageUploadCrop
                    label=""
                    value={img}
                    onChange={(val) => {
                      const updated = [...bannerImages];
                      updated[idx] = val;
                      setBannerImages(updated);
                    }}
                    recommendedText="Proporção 16:5 — converte para WebP"
                    aspect={16 / 5}
                    targetWidth={1600}
                    targetHeight={500}
                    maxBytes={4 * 1024 * 1024}
                    outputFormat="image/webp"
                  />
                  {img && (
                    <button
                      type="button"
                      onClick={() => setBannerImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0 right-0 text-xs text-destructive hover:underline"
                    >
                      Remover banner
                    </button>
                  )}
                </div>
              ))}
            </div>

            {bannerImages.length < 5 && (
              <button
                type="button"
                onClick={() => setBannerImages((prev) => [...prev, ""])}
                className="text-sm font-medium text-primary hover:underline"
              >
                + Adicionar banner
              </button>
            )}

            {bannerImages.filter(Boolean).length > 1 && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground whitespace-nowrap">
                  Trocar a cada
                </label>
                <select
                  value={bannerIntervalMs}
                  onChange={(e) => setBannerIntervalMs(Number(e.target.value))}
                  className="text-sm rounded-md border border-input bg-background px-2 py-1"
                >
                  <option value={3000}>3 segundos</option>
                  <option value={5000}>5 segundos</option>
                  <option value={7000}>7 segundos</option>
                  <option value={10000}>10 segundos</option>
                  <option value={15000}>15 segundos</option>
                </select>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Banners são salvos junto com "Salvar personalização".
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-semibold">Cores do tema</div>

          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <ColorField label="Cor primária" value={primaryColor} onChange={setPrimaryColor} />
              <ColorField label="Cor de fundo" value={backgroundColor} onChange={setBackgroundColor} />
              <ColorField label="Cor dos textos" value={textColor} onChange={setTextColor} />
            </div>

            <div className="md:pt-2">
              <StorefrontMiniPreview
                primaryColor={primaryColor}
                backgroundColor={backgroundColor}
                textColor={textColor}
                layoutType={layoutType}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-semibold">Opções de layout</div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Layout dos produtos</div>
            <div className="text-xs text-muted-foreground">Escolha como os produtos aparecem na vitrine pública</div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setLayoutType('grid')}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${layoutType === 'grid' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <LayoutGrid className={`w-6 h-6 ${layoutType === 'grid' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-semibold ${layoutType === 'grid' ? 'text-primary' : 'text-muted-foreground'}`}>Grade</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutType('list')}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${layoutType === 'list' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <List className={`w-6 h-6 ${layoutType === 'list' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-semibold ${layoutType === 'list' ? 'text-primary' : 'text-muted-foreground'}`}>Lista</span>
              </button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Exibir preço nos produtos?</div>
              <div className="text-xs text-muted-foreground">Desative para usar apenas como vitrine/catálogo</div>
            </div>
            <Switch checked={showPrice} onCheckedChange={setShowPrice} />
          </div>

          <Separator />

          <div className="flex items-center gap-3 p-4 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5">
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Notificações via WhatsApp</div>
              <div className="text-xs text-emerald-700/70 dark:text-emerald-500/70">Configure conexão, templates e notificações pelo botão WhatsApp na barra lateral</div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Botão "Enviar pedido via WhatsApp"</div>
              <div className="text-xs text-muted-foreground">Exibe um botão na vitrine para o cliente enviar o pedido pelo WhatsApp</div>
            </div>
            <Switch checked={whatsappOrderEnabled} onCheckedChange={setWhatsappOrderEnabled} />
          </div>

          {whatsappOrderEnabled && (
            <div className="space-y-2">
              <Label>Número de WhatsApp do pedido</Label>
              <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="Ex: 5581999999999" className="h-11 rounded-xl font-mono" />
              <p className="text-xs text-muted-foreground">DDI + DDD + número, só dígitos (ex: 5581999999999)</p>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Destacar estoque baixo / últimas unidades?</div>
              <div className="text-xs text-muted-foreground">Mostra um aviso discreto no card do produto</div>
            </div>
            <Switch checked={highlightLowStock} onCheckedChange={setHighlightLowStock} />
          </div>
        </div>

        {vitrineError && <p className="text-sm text-destructive">{vitrineError}</p>}
        {vitrineSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="w-4 h-4" />
            Personalização salva com sucesso!
          </div>
        )}

        <Button
          onClick={handleSaveVitrine}
          disabled={vitrineSaving}
          className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
        >
          {vitrineSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar personalização"}
        </Button>
      </CardContent>
    </Card>
  );
}

function normalizeHex(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v) return "";
  const raw = v.startsWith("#") ? v.slice(1) : v;
  const cleaned = raw.replace(/[^0-9A-F]/g, "").slice(0, 6);
  return `#${cleaned}`;
}

function expandHex3(value: string): string {
  const raw = value.replace("#", "");
  if (raw.length !== 3) return value;
  const [a, b, c] = raw.split("");
  return `#${a}${a}${b}${b}${c}${c}`;
}

function isHex6(value: string): boolean {
  return /^#[0-9A-F]{6}$/.test(value.toUpperCase());
}

function ColorField(props: { label: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(props.value.toUpperCase());

  useEffect(() => {
    setText(props.value.toUpperCase());
  }, [props.value]);

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="flex items-center gap-3">
        <label className="relative shrink-0">
          <span
            className="block w-11 h-11 rounded-full border border-border/60 shadow-sm"
            style={{ backgroundColor: props.value }}
          />
          <input
            type="color"
            value={props.value}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              props.onChange(v);
              setText(v);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>

        <Input
          value={text}
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            setText(next);
            const normalized = normalizeHex(next);
            if (isHex6(normalized)) {
              props.onChange(normalized);
              setText(normalized);
            }
          }}
          onBlur={() => {
            const normalized = normalizeHex(text);
            const expanded = isHex6(expandHex3(normalized)) ? expandHex3(normalized) : normalized;
            if (isHex6(expanded)) props.onChange(expanded);
            setText(isHex6(expanded) ? expanded : props.value.toUpperCase());
          }}
          placeholder="#0B1F3A"
          className="h-11 rounded-xl font-mono uppercase"
        />
      </div>
    </div>
  );
}

function StorefrontMiniPreview(props: { primaryColor: string; backgroundColor: string; textColor: string; layoutType: 'grid' | 'list' }) {
  const borderColor = `color-mix(in oklab, ${props.textColor} 18%, transparent)`;
  const surfaceColor = `color-mix(in oklab, ${props.backgroundColor} 90%, white)`;
  const surface2Color = `color-mix(in oklab, ${props.backgroundColor} 82%, white)`;
  const mutedTextColor = `color-mix(in oklab, ${props.textColor} 65%, transparent)`;

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold">Mini-preview</div>
        <Badge className="rounded-full bg-primary/15 text-primary border-0 text-[10px]">Tempo real</Badge>
      </div>

      <div className="mx-auto w-full max-w-[340px]">
        <div className="rounded-[2.5rem] border border-border/60 bg-muted/30 p-3 shadow-soft">
          <div
            className="rounded-[2rem] overflow-hidden"
            style={{ backgroundColor: props.backgroundColor, color: props.textColor }}
          >
            <div
              className="px-3 pt-3 pb-2"
              style={{
                backgroundColor: surfaceColor,
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-8 h-8 rounded-2xl border"
                    style={{ backgroundColor: props.primaryColor, borderColor: borderColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">Sua Loja</div>
                    <div className="text-[10px] truncate" style={{ color: mutedTextColor }}>
                      Catálogo online
                    </div>
                  </div>
                </div>
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center border"
                  style={{ backgroundColor: surface2Color, borderColor: borderColor }}
                >
                  <Package className="w-4 h-4" style={{ color: mutedTextColor }} />
                </div>
              </div>

              <div
                className="mt-3 h-9 rounded-2xl flex items-center gap-2 px-3 border"
                style={{ backgroundColor: props.backgroundColor, borderColor: borderColor }}
              >
                <Search className="w-4 h-4" style={{ color: mutedTextColor }} />
                <span className="text-xs" style={{ color: mutedTextColor }}>
                  Buscar produtos...
                </span>
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div
                className="h-16 rounded-2xl border"
                style={{
                  backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${props.primaryColor} 35%, transparent), transparent)`,
                  backgroundColor: surface2Color,
                  borderColor: borderColor,
                }}
              />

              {props.layoutType === 'list' ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-2xl border overflow-hidden"
                      style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                      <div className="w-14 h-14 shrink-0" style={{ backgroundColor: surface2Color }} />
                      <div className="flex-1 min-w-0 py-1 pr-2">
                        <div className="text-[10px] font-medium truncate">Produto {i + 1}</div>
                        <div className="text-[10px] font-bold mt-0.5" style={{ color: props.primaryColor }}>R$ 19,90</div>
                      </div>
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mr-2"
                        style={{ backgroundColor: props.primaryColor, color: "#fff" }}
                      >
                        +
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border overflow-hidden"
                      style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                      <div className="aspect-square" style={{ backgroundColor: surface2Color }} />
                      <div className="p-2 space-y-1">
                        <div className="text-[11px] font-medium leading-snug">Produto</div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-bold" style={{ color: props.primaryColor }}>
                            R$ 19,90
                          </div>
                          <div
                            className="w-7 h-7 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: props.primaryColor, color: "#fff" }}
                          >
                            +
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="h-10 rounded-2xl flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: props.primaryColor, color: "#fff" }}
              >
                Enviar pedido
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
