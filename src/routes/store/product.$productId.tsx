import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Star, Minus, Plus, Heart, Share2, Truck, Clock, Shield,
  ChevronLeft, Loader2, CheckCircle2, Package, MapPin, Search,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store";
import { type StoreProduct, formatPrice } from "@/lib/store-context";
import { getEffectivePrice, type PromoConfig } from "@/lib/promo-engine";

export const Route = createFileRoute("/store/product/$productId")({
  component: ProductPage,
});

interface ProductAddition {
  id: string; name: string; price: string; active: boolean | null;
}

type VarImage  = { url: string; isPrimary: boolean };
type VarOption = { id: string; name: string; price: string; images?: VarImage[]; promoConfig?: PromoConfig | null };
/** "adicional" (padrão) soma ao preço do produto; "opcional" substitui o preço do produto pelo da opção escolhida. */
type VGroup    = { id: string; groupName: string; priceType?: "adicional" | "opcional"; required?: boolean; options: VarOption[] };

/** Preço efetivo do adicional da variação — mesma promoção do produto, aplicada ao valor do adicional. */
const variationOptionPrice = (opt: VarOption): number =>
  getEffectivePrice(opt.price || "0", opt.promoConfig, "store").effectivePrice;

const isValidImg = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

function ProductPage() {
  const { productId } = Route.useParams();
  const [product,    setProduct]    = useState<StoreProduct | null>(null);
  const [additions,  setAdditions]  = useState<ProductAddition[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [added,      setAdded]      = useState(false);
  const [activeImg,  setActiveImg]  = useState(0);
  const [qty,        setQty]        = useState(1);
  const [obs,        setObs]        = useState("");
  const [selectedAdditions,  setSelectedAdditions]  = useState<string[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});

  const [cep,        setCep]        = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepResult,  setCepResult]  = useState<{ fee: number | null; bairro: string; free: boolean } | null>(null);
  const [cepError,   setCepError]   = useState("");
  const cepInputRef = useRef<HTMLInputElement>(null);

  const { store, addToCart, favorites, toggleFavorite } = useStore();

  useEffect(() => {
    if (!store?.id) return;
    fetch(`/api/products/list?storeId=${store.id}&scope=public&productId=${productId}`)
      .then(r => r.json())
      .then(d => {
        if (d.products) {
          const found = d.products.find((p: StoreProduct) => p.id === productId) ?? null;
          setProduct(found);
          if (found) {
            fetch(`/api/products/list?storeId=${store.id}&productId=${productId}&additions=true`)
              .then(r => r.json())
              .then(ad => { if (ad.additions) setAdditions(ad.additions); })
              .catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, store?.id]);

  // Quando uma variação com imagens é selecionada, salta para a primeira posição
  // da galeria onde as imagens dessa variação ficam (índice 0).
  useEffect(() => {
    if (!product) return;
    const groups = (product.variationGroups ?? []) as VGroup[];
    for (const g of groups) {
      const opt = g.options.find(o => o.id === selectedVariations[g.id]);
      if (opt?.images?.some(img => isValidImg(img.url))) {
        setActiveImg(0);
        return;
      }
    }
  }, [selectedVariations, product]);

  const toggleAddition = (id: string) =>
    setSelectedAdditions(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );

  const calcularFrete = async () => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) { setCepError("CEP inválido. Digite 8 dígitos."); return; }
    setCepLoading(true); setCepError(""); setCepResult(null);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { setCepError("CEP não encontrado. Verifique e tente novamente."); return; }

      const bairroViaCep = (data.bairro || "").toLowerCase().trim();
      const baseFee      = parseFloat(store?.deliveryFee || "0");
      const freeAbove    = store?.freeShippingAbove ? parseFloat(store.freeShippingAbove) : null;
      const rules        = store?.deliveryRules ?? [];

      const matched = rules.find(r => r.bairro.toLowerCase().trim() === bairroViaCep);
      const fee     = matched ? matched.taxa : baseFee;
      const free    = freeAbove !== null ? false : fee === 0;

      setCepResult({ fee, bairro: data.bairro || data.localidade, free });
    } catch {
      setCepError("Erro ao consultar o CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-2">
        <span className="text-5xl">🚫</span>
        <h2 className="text-lg font-bold mt-2">Produto indisponível</h2>
        <p className="text-sm text-muted-foreground">Este produto não está disponível no momento.</p>
        <Link to="/store" className="mt-4 inline-flex h-10 px-5 rounded-xl items-center justify-center bg-primary text-primary-foreground text-sm font-semibold">
          Voltar à loja
        </Link>
      </div>
    );
  }

  // ── Variações ─────────────────────────────────────────────────────────────
  const variationGroups = (product.variationGroups ?? []) as VGroup[];

  // ── Galeria de imagens ────────────────────────────────────────────────────
  // Imagens base do produto (filtragem estrita: sem nulos, strings vazias ou inválidas)
  const baseImages: string[] = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...(product.images ?? []),
  ].filter(isValidImg);

  // Imagens da(s) opção(ões) atualmente selecionadas, em ordem (primária primeiro)
  const selectedOptionImages: string[] = variationGroups.flatMap(g => {
    const opt = g.options.find(o => o.id === selectedVariations[g.id]);
    if (!opt?.images?.length) return [];
    const sorted = [...opt.images].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    return sorted.map(img => img.url).filter(isValidImg);
  });

  // Galeria final: imagens de variação na frente (para que idx 0 = imagem da cor/opção selecionada),
  // seguidas pelas imagens base, sem duplicatas.
  const seen = new Set<string>();
  const allImages: string[] = [...selectedOptionImages, ...baseImages].filter(url => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  const safeIdx    = Math.max(0, Math.min(activeImg, Math.max(0, allImages.length - 1)));
  const currentImg = allImages[safeIdx] ?? null;

  // ── Preço (com suporte a promoConfig) ────────────────────────────────────
  const { effectivePrice, originalPrice, promoActive } = getEffectivePrice(
    product.price, product.promoConfig, "store"
  );
  const compareAt    = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const displayPrice = promoActive ? effectivePrice : parseFloat(product.price);
  const displayOld   = promoActive ? originalPrice : compareAt;
  const discountPct  = displayOld && displayOld > displayPrice
    ? Math.round(((displayOld - displayPrice) / displayOld) * 100) : 0;

  // ── Adicionais ────────────────────────────────────────────────────────────
  const activeAdditions = additions.filter(a => a.active !== false);
  const additionsTotal  = activeAdditions
    .filter(a => selectedAdditions.includes(a.id))
    .reduce((s, a) => s + parseFloat(a.price), 0);

  // ── Variações: grupo "opcional" substitui o preço do produto, "adicional"
  // (padrão) soma. Se houver mais de um grupo opcional selecionado, os dois
  // substitutos somam entre si e formam o novo preço-base juntos.
  const selectedOptionOf = (g: VGroup) => g.options.find(o => o.id === selectedVariations[g.id]);
  const substitutiveGroups = variationGroups.filter(g => (g.priceType ?? "adicional") === "opcional");
  const hasSubstitutiveSelection = substitutiveGroups.some(g => !!selectedVariations[g.id]);
  const substitutiveTotal = substitutiveGroups.reduce((sum, g) => {
    const opt = selectedOptionOf(g);
    return sum + (opt ? variationOptionPrice(opt) : 0);
  }, 0);
  const variationsAdditionalTotal = variationGroups
    .filter(g => (g.priceType ?? "adicional") !== "opcional")
    .reduce((sum, g) => {
      const opt = selectedOptionOf(g);
      return sum + (opt ? variationOptionPrice(opt) : 0);
    }, 0);

  // required=undefined trata como obrigatório (compatibilidade com grupos
  // criados antes desse campo existir — sempre foram obrigatórios).
  const allGroupsSelected = variationGroups.every(
    g => g.options.length === 0 || (g.required ?? true) === false || !!selectedVariations[g.id]
  );

  // Preço-base exibido: substituído pela variação "opcional" quando aplicável.
  const baseUnitPrice = hasSubstitutiveSelection ? substitutiveTotal : displayPrice;
  const totalItem = (baseUnitPrice + additionsTotal + variationsAdditionalTotal) * qty;

  // ── Estado do estoque ─────────────────────────────────────────────────────
  const isFavorite = favorites.includes(productId);
  // trackStock=false significa estoque infinito — nunca bloquear a venda
  const isTracked  = product.trackStock === true;
  const outOfStock = isTracked && product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const lowStock   = isTracked && !outOfStock && product.stock !== null && product.stock !== undefined
    && typeof product.lowStockThreshold === "number" && product.stock <= product.lowStockThreshold;

  const handleAdd = () => {
    if (outOfStock || !allGroupsSelected) return;
    const chosenVariations = variationGroups.flatMap(g => {
      const opt = g.options.find(o => o.id === selectedVariations[g.id]);
      return opt ? [{ name: `${g.groupName}: ${opt.name}`, price: variationOptionPrice(opt) }] : [];
    });
    const chosenAdditions = activeAdditions
      .filter(a => selectedAdditions.includes(a.id))
      .map(a => ({ name: a.name, price: parseFloat(a.price) }));
    const allExtras = [...chosenVariations, ...chosenAdditions];
    addToCart({
      id:        product.id,
      name:      product.name,
      price:     baseUnitPrice + additionsTotal + variationsAdditionalTotal,
      image:     product.imageUrl || null,
      emoji:     product.emoji || "📦",
      obs:       obs || undefined,
      additions: allExtras.length > 0 ? allExtras : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, text: product.description || product.name, url: window.location.href });
    }
  };

  // ── Barra de ações ────────────────────────────────────────────────────────
  const ActionBar = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center gap-3 ${compact ? "" : "pt-1"}`}>
      <div className="flex items-center rounded-xl border border-border/60 overflow-hidden shrink-0">
        <button
          onClick={() => setQty(Math.max(1, qty - 1))}
          className="w-10 h-11 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-10 h-11 flex items-center justify-center text-sm font-bold border-x border-border/60 select-none">
          {qty}
        </span>
        <button
          onClick={() => setQty(qty + 1)}
          className="w-10 h-11 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <motion.button
        onClick={handleAdd}
        disabled={outOfStock || !allGroupsSelected}
        animate={added ? { scale: [1, 0.96, 1] } : {}}
        transition={{ duration: 0.15 }}
        className={`flex-1 h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
          outOfStock || !allGroupsSelected
            ? "bg-secondary text-muted-foreground cursor-not-allowed"
            : added
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
              : "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 shadow-md"
        }`}
      >
        <AnimatePresence mode="wait">
          {added ? (
            <motion.span key="added"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Adicionado!
            </motion.span>
          ) : (
            <motion.span key="add"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adicionar · R$ {formatPrice(totalItem)}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-300 pb-32 lg:pb-12">

      {/* Back — mobile */}
      <div className="px-4 pt-4 lg:hidden">
        <Link to="/store" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      {/* Grid principal */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:max-w-5xl lg:mx-auto lg:px-8 lg:pt-8 lg:items-start">

        {/* ── Coluna esquerda: Galeria ── */}
        <div className="space-y-3 px-4 mt-4 lg:px-0 lg:mt-0 lg:sticky lg:top-6">

          {/* Imagem principal */}
          <div className="relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100/80">
            {currentImg ? (
              <img
                key={currentImg}
                src={currentImg}
                alt={product.name}
                className="w-full h-full object-contain p-6 animate-in fade-in duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-8xl select-none">{product.emoji || "📦"}</span>
              </div>
            )}
            {discountPct > 0 && (
              <span className="absolute top-3 left-3 text-[11px] font-bold px-2 py-1 rounded-lg bg-red-500 text-white shadow-sm">
                -{discountPct}%
              </span>
            )}
            {product.badge && (
              <span className="absolute top-3 right-3 text-[11px] font-bold px-2 py-1 rounded-lg bg-primary text-primary-foreground shadow-sm">
                {product.badge}
              </span>
            )}
          </div>

          {/* Thumbnails — só renderiza se há mais de 1 imagem válida */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {allImages.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => setActiveImg(i)}
                  aria-label={`Imagem ${i + 1}`}
                  className={`shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden border-2 transition-all duration-150 bg-slate-50 ${
                    safeIdx === i
                      ? "border-primary shadow-sm shadow-primary/15 scale-[1.04]"
                      : "border-slate-100 hover:border-slate-300"
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${i + 1}`}
                    className="w-full h-full object-contain p-1.5"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Coluna direita: Info e compra ── */}
        <div className="px-4 lg:px-0 mt-5 lg:mt-0 space-y-5">

          {/* Back — desktop */}
          <div className="hidden lg:block -mb-1">
            <Link to="/store" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" /> Voltar à loja
            </Link>
          </div>

          {/* Título + botões utilitários */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[1.6rem] font-bold leading-snug text-foreground">{product.name}</h1>
            <div className="flex gap-1.5 shrink-0 mt-1">
              <button
                onClick={() => toggleFavorite(productId)}
                aria-label="Favoritar"
                className="w-9 h-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                <Heart className={`w-4 h-4 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
              </button>
              <button
                onClick={handleShare}
                aria-label="Compartilhar"
                className="w-9 h-9 rounded-xl border border-border/60 flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Rating */}
          {product.rating && Number(product.rating) > 0 && (
            <div className="flex items-center gap-1.5 -mt-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(Number(product.rating)) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {product.rating} ({product.reviewCount || 0} avaliações)
              </span>
            </div>
          )}

          {/* Descrição */}
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          {/* Preço — substituído pela variação "opcional" quando selecionada */}
          <div className="flex items-end gap-2.5">
            <span className="text-[2rem] font-black text-emerald-600 tabular-nums leading-none">
              R$ {formatPrice(baseUnitPrice)}
            </span>
            {!hasSubstitutiveSelection && displayOld && displayOld > displayPrice && (
              <span className="text-base text-slate-400 line-through tabular-nums mb-0.5">
                R$ {formatPrice(displayOld)}
              </span>
            )}
          </div>

          {/* Badges de apoio */}
          <div className="flex flex-wrap gap-2">
            {store?.deliveryEstimate && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-xs font-medium">
                <Clock className="w-3 h-3" /> {store.deliveryEstimate}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
              <Shield className="w-3 h-3" /> Compra segura
            </span>
          </div>

          {/* Calculadora de frete */}
          {store?.deliveryEnabled && (
            <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Calcular frete</p>
                  <p className="text-xs text-muted-foreground">
                    Taxa base: {parseFloat(store.deliveryFee || "0") === 0
                      ? "Frete grátis"
                      : `R$ ${formatPrice(store.deliveryFee || "0")}`}
                    {store.freeShippingAbove && ` · Grátis acima de R$ ${formatPrice(store.freeShippingAbove)}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    ref={cepInputRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={cep}
                    maxLength={9}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
                      setCepResult(null); setCepError("");
                    }}
                    onKeyDown={e => e.key === "Enter" && calcularFrete()}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={calcularFrete}
                  disabled={cepLoading}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60 shrink-0"
                >
                  {cepLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Search className="w-3.5 h-3.5" />}
                  Calcular
                </button>
              </div>
              {cepError && (
                <p className="text-xs text-red-500 flex items-center gap-1">⚠ {cepError}</p>
              )}
              {cepResult && (
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                  cepResult.free || cepResult.fee === 0
                    ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                    : "bg-background border border-border/60 text-foreground"
                }`}>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {cepResult.bairro}
                  </span>
                  <span className="font-bold tabular-nums">
                    {cepResult.fee === 0
                      ? "Frete grátis"
                      : `R$ ${formatPrice(cepResult.fee ?? 0)}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Alerta de estoque */}
          {outOfStock ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
              <Package className="w-4 h-4 shrink-0" />
              Produto indisponível no momento
            </div>
          ) : lowStock ? (
            <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm font-medium">
              ⚠️ Últimas {product.stock} unidades disponíveis
            </div>
          ) : null}

          {/* ── Variações ── */}
          {variationGroups.length > 0 && (
            <div className="space-y-4">
              {variationGroups.map(group => {
                // Verifica se alguma opção deste grupo tem imagem válida
                const groupHasImages = group.options.some(
                  o => o.images?.some(img => isValidImg(img.url))
                );
                // Grupo "opcional" substitui o preço do produto — o rótulo mostra
                // o preço cheio da opção, não um "+" de adicional.
                const isSubstitutiveGroup = (group.priceType ?? "adicional") === "opcional";
                const isRequiredGroup = (group.required ?? true) !== false;
                return (
                  <div key={group.id}>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {group.groupName}{" "}
                      {isRequiredGroup ? (
                        <span className="text-destructive">*</span>
                      ) : (
                        <span className="text-muted-foreground/70 normal-case font-normal tracking-normal">(opcional)</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {!isRequiredGroup && (
                        <button
                          type="button"
                          onClick={() => setSelectedVariations(prev => {
                            const next = { ...prev };
                            delete next[group.id];
                            return next;
                          })}
                          className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                            !selectedVariations[group.id]
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border/60 text-muted-foreground hover:border-border"
                          }`}
                        >
                          Sem opcional
                        </button>
                      )}
                      {group.options.map(option => {
                        const sel = selectedVariations[group.id] === option.id;
                        const { effectivePrice: optPrice, promoActive: optPromoActive } =
                          getEffectivePrice(option.price || "0", option.promoConfig, "store");

                        // Determina thumbnail: primeira imagem válida (primária preferida)
                        const validImgs = (option.images ?? []).filter(img => isValidImg(img.url));
                        const thumb     = (validImgs.find(i => i.isPrimary) ?? validImgs[0])?.url;
                        const hasThumb  = groupHasImages && isValidImg(thumb);

                        return hasThumb ? (
                          // Swatch com imagem (ex: variação de cor)
                          <button
                            key={option.id}
                            onClick={() => setSelectedVariations(prev => ({ ...prev, [group.id]: option.id }))}
                            title={option.name}
                            className={`relative w-[72px] h-[72px] rounded-xl overflow-hidden border-2 transition-all duration-150 ${
                              sel
                                ? "border-primary scale-[1.06] shadow-sm shadow-primary/20"
                                : "border-border/60 hover:border-border"
                            }`}
                          >
                            <img
                              src={thumb}
                              alt={option.name}
                              className="w-full h-full object-cover"
                            />
                            <div className={`absolute bottom-0 inset-x-0 text-[9px] font-bold text-center py-0.5 px-1 truncate leading-tight ${
                              sel
                                ? "bg-primary text-primary-foreground"
                                : "bg-black/50 text-white"
                            }`}>
                              {option.name}
                            </div>
                            {(optPrice > 0 || optPromoActive) && (
                              <div className={`absolute top-0.5 right-0.5 text-white text-[8px] font-bold px-1 rounded leading-tight ${
                                optPromoActive ? "bg-violet-600" : "bg-emerald-500"
                              }`}>
                                {isSubstitutiveGroup ? "" : "+"}{formatPrice(optPrice)}
                              </div>
                            )}
                          </button>
                        ) : (
                          // Pill de texto (ex: variação de tamanho)
                          <button
                            key={option.id}
                            onClick={() => setSelectedVariations(prev => ({ ...prev, [group.id]: option.id }))}
                            className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                              sel
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border/60 text-foreground hover:border-border"
                            }`}
                          >
                            {option.name}
                            {optPromoActive ? (
                              <span className="ml-1 text-[11px] font-semibold">
                                <span className="line-through text-muted-foreground mr-1">
                                  {isSubstitutiveGroup ? "" : "+"}R$ {formatPrice(parseFloat(option.price || "0"))}
                                </span>
                                <span className="text-violet-600">{isSubstitutiveGroup ? "" : "+"}R$ {formatPrice(optPrice)}</span>
                              </span>
                            ) : optPrice > 0 && (
                              <span className="ml-1 text-[11px] font-semibold text-emerald-600">
                                {isSubstitutiveGroup ? "" : "+"}R$ {formatPrice(optPrice)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!allGroupsSelected && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  ⚠ Selecione uma opção para cada variação antes de adicionar ao carrinho
                </p>
              )}
            </div>
          )}

          {/* Adicionais */}
          {activeAdditions.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Adicionais</p>
              <div className="space-y-2">
                {activeAdditions.map(addition => {
                  const sel = selectedAdditions.includes(addition.id);
                  return (
                    <button
                      key={addition.id}
                      onClick={() => toggleAddition(addition.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors ${
                        sel
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${sel ? "border-primary bg-primary" : "border-border"}`}>
                          {sel && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm font-medium">{addition.name}</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 shrink-0">
                        +R$ {formatPrice(addition.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observação */}
          {product.allowObservation === true && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Observação{" "}
                <span className="font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Ex: Sem cebola, bem passado..."
                rows={2}
                className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-colors placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          {/* Barra de ações — desktop (inline) */}
          <div className="hidden lg:block">
            <ActionBar />
          </div>
        </div>
      </div>

      {/* Barra de ações — mobile (sticky no rodapé) */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/40 px-4 py-3 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <ActionBar compact />
      </div>
    </div>
  );
}
