import { useState, useRef, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Switch }    from "@/components/ui/switch";
import { Badge }     from "@/components/ui/badge";
import {
  Plus, Settings2, Trash2, Upload, X, Info, Loader2, ChevronRight,
  CreditCard, Banknote, QrCode, Smartphone, FileText, ReceiptText,
  CheckCircle2, AlertTriangle, SlidersHorizontal, KeyRound, Eye, EyeOff,
  Zap, Link2, Unlink,
} from "lucide-react";
import type {
  PaymentMethodConfig, EspeciePagamento, OperacaoCartao,
  TipoChavePix, TaxaParcela,
} from "@/lib/store-context";
import { Checkbox } from "@/components/ui/checkbox";

export interface PaymentPlanOption {
  id: string;
  nome: string;
  tipo: "avista" | "dia" | "mes";
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const ESPECIES: {
  value: EspeciePagamento; label: string;
  icon: React.ElementType; color: string; bg: string;
}[] = [
  { value: "dinheiro",    label: "Dinheiro",    icon: Banknote,   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  { value: "cartao",      label: "Cartão",       icon: CreditCard, color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/40"      },
  { value: "boleto",      label: "Boleto",       icon: FileText,   color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-950/40"  },
  { value: "pix",         label: "PIX",          icon: QrCode,     color: "text-cyan-600",    bg: "bg-cyan-50 dark:bg-cyan-950/40"      },
  { value: "mercadopago", label: "Mercado Pago", icon: Smartphone, color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/40"  },
  { value: "appmax",      label: "Appmax",       icon: Zap,        color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/40"  },
  { value: "outros",      label: "Outros",       icon: CreditCard, color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-800/60"   },
];

const OPERACOES: { value: OperacaoCartao; label: string }[] = [
  { value: "credito",          label: "Crédito"          },
  { value: "debito",           label: "Débito"           },
  { value: "carteira_digital", label: "Carteira Digital" },
];

const CHAVES_PIX: { value: TipoChavePix; label: string; placeholder: string }[] = [
  { value: "cpf",       label: "CPF",            placeholder: "000.000.000-00"              },
  { value: "cnpj",      label: "CNPJ",           placeholder: "00.000.000/0000-00"          },
  { value: "email",     label: "E-mail",          placeholder: "email@exemplo.com"           },
  { value: "celular",   label: "Celular",         placeholder: "(00) 00000-0000"             },
  { value: "aleatoria", label: "Chave Aleatória", placeholder: "xxxxxxxx-xxxx-xxxx-xxxxxxxx" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEspecieMeta(especie?: EspeciePagamento) {
  return ESPECIES.find(e => e.value === especie) ?? ESPECIES[ESPECIES.length - 1];
}

function normalizeMethod(m: PaymentMethodConfig): PaymentMethodConfig {
  if (m.especie) return m;
  const defaults: Partial<Record<string, Partial<PaymentMethodConfig>>> = {
    cash:        { especie: "dinheiro" },
    pix:         { especie: "pix" },
    card:        { especie: "cartao", operacao: "credito" },
    debit:       { especie: "cartao", operacao: "debito" },
    mercadopago: { especie: "mercadopago" },
  };
  return { ...m, ...(defaults[m.key] ?? { especie: "outros" }) };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Generates rows from 1 (à vista) through `max` — includes MDR/TEF for 1x
function buildTaxas(current: TaxaParcela[], max: number): TaxaParcela[] {
  const result: TaxaParcela[] = [];
  for (let p = 1; p <= max; p++) {
    result.push(current.find(t => t.parcela === p) ?? { parcela: p, taxa: 0 });
  }
  return result;
}

// ─── PIX masks ────────────────────────────────────────────────────────────────
function maskPixKey(raw: string, type: TipoChavePix): string {
  switch (type) {
    case "cpf": {
      const d = raw.replace(/\D/g, "").slice(0, 11);
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
      if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
      return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    }
    case "cnpj": {
      const d = raw.replace(/\D/g, "").slice(0, 14);
      if (d.length <= 2) return d;
      if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
      if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
      if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
      return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    }
    case "celular": {
      const d = raw.replace(/\D/g, "").slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : "";
      if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
      return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    }
    default:
      return raw;
  }
}

// ─── Component props ──────────────────────────────────────────────────────────
interface PaymentMethodEditorProps {
  methods:                  PaymentMethodConfig[];
  plans:                    PaymentPlanOption[];
  deliveryPaymentEnabled:   boolean;
  saving:                   boolean;
  success:                  boolean;
  onMethodsChange:          (m: PaymentMethodConfig[]) => void;
  onDeliveryPaymentChange:  (v: boolean) => void;
  onSave:                   () => void;
  // ── Appmax — conexão via instalação de app (não é um token colado manualmente) ──
  appmaxConnected:    boolean;
  appmaxConnectedAt:  string | null;
  appmaxConnecting:   boolean;
  onAppmaxConnect:    () => void;
  onAppmaxDisconnect: () => void;
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border/50">
      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────────────────────
export function PaymentMethodEditor({
  methods,
  plans,
  deliveryPaymentEnabled,
  saving,
  success,
  onMethodsChange,
  onDeliveryPaymentChange,
  onSave,
  appmaxConnected,
  appmaxConnectedAt,
  appmaxConnecting,
  onAppmaxConnect,
  onAppmaxDisconnect,
}: PaymentMethodEditorProps) {

  // ── Sheet state ────────────────────────────────────────────────────────────
  const [sheetOpen,   setSheetOpen]   = useState(false);
  const [editingIdx,  setEditingIdx]  = useState<number | null>(null);
  const [localMethod, setLocalMethod] = useState<PaymentMethodConfig | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // ── Taxas modal state ──────────────────────────────────────────────────────
  const [taxasOpen,       setTaxasOpen]       = useState(false);
  const [localTaxas,      setLocalTaxas]      = useState<TaxaParcela[]>([]);
  const [previewValueStr, setPreviewValueStr] = useState("1000");

  // ── Mercado Pago credentials state ─────────────────────────────────────────
  const [showMpToken, setShowMpToken] = useState(false);

  // ── Sheet helpers ──────────────────────────────────────────────────────────
  const openEdit = useCallback((idx: number) => {
    const m = normalizeMethod(methods[idx]);
    setLocalMethod({
      ...m,
      taxasPorParcela: m.taxasPorParcela?.length
        ? m.taxasPorParcela
        : buildTaxas([], m.maxInstallments > 1 ? m.maxInstallments : 12),
    });
    setEditingIdx(idx);
    setSheetOpen(true);
  }, [methods]);

  const openNew = () => {
    setLocalMethod({
      key: `custom_${Date.now()}`,
      label: "", sigla: "", enabled: true,
      especie: "outros", operacao: null,
      maxInstallments: 1, payAtDelivery: true,
      parcelamentoAtivo: false, taxasPorParcela: [], repassarTaxaCliente: false,
      allowedPlanIds: [],
    });
    setEditingIdx(null);
    setSheetOpen(true);
  };

  const togglePlan = (planId: string, checked: boolean) => {
    setLocalMethod(prev => {
      if (!prev) return prev;
      const current = prev.allowedPlanIds ?? [];
      const next = checked
        ? [...current, planId]
        : current.filter(id => id !== planId);
      return { ...prev, allowedPlanIds: next };
    });
  };

  const closeSheet = () => { setSheetOpen(false); setLocalMethod(null); };

  const saveSheet = () => {
    if (!localMethod) return;
    const updated = [...methods.map(normalizeMethod)];
    if (editingIdx !== null) updated[editingIdx] = localMethod;
    else updated.push(localMethod);
    onMethodsChange(updated);
    closeSheet();
  };

  const removeMethod = (idx: number) =>
    onMethodsChange(methods.filter((_, i) => i !== idx));

  const setLocal = (patch: Partial<PaymentMethodConfig>) =>
    setLocalMethod(prev => prev ? { ...prev, ...patch } : prev);

  const setMpConfig = (patch: Partial<{ publicKey: string; accessToken: string }>) =>
    setLocalMethod(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        config: {
          ...prev.config,
          mercadoPago: { publicKey: "", accessToken: "", ...prev.config?.mercadoPago, ...patch },
        },
      };
    });

  // ── QR Code upload ─────────────────────────────────────────────────────────
  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 3 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setLocal({ pixQrCodeUrl: reader.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Max installments change ────────────────────────────────────────────────
  const handleMaxInstallmentsChange = (v: number) => {
    const clamped = Math.min(Math.max(2, v), 18);
    setLocalMethod(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        maxInstallments: clamped,
        taxasPorParcela: buildTaxas(prev.taxasPorParcela ?? [], clamped),
      };
    });
  };

  // ── Taxas modal helpers ────────────────────────────────────────────────────
  const openTaxasModal = () => {
    if (!localMethod) return;
    const max = localMethod.maxInstallments || 12;
    setLocalTaxas(buildTaxas(localMethod.taxasPorParcela ?? [], max));
    setTaxasOpen(true);
  };

  const closeTaxasModal = () => setTaxasOpen(false);

  const saveTaxas = () => {
    setLocal({ taxasPorParcela: localTaxas });
    closeTaxasModal();
  };

  const updateLocalTaxa = (parcela: number, taxa: number) => {
    setLocalTaxas(prev =>
      prev.map(t => t.parcela === parcela ? { ...t, taxa } : t)
    );
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isCartaoCredito  = localMethod?.especie === "cartao" && localMethod?.operacao === "credito";
  const isPix            = localMethod?.especie === "pix";
  const isMercadoPago    = localMethod?.especie === "mercadopago";
  const isAppmax         = localMethod?.especie === "appmax";
  const showParcelas     = isCartaoCredito && localMethod?.parcelamentoAtivo;

  const configuredCount = localMethod?.taxasPorParcela?.filter(t => t.taxa > 0).length ?? 0;
  const previewBase     = parseFloat(previewValueStr) || 1000;

  // Info-box: pick the highest-parcela row with a non-zero tax as the example
  const exRow = [...(localMethod?.taxasPorParcela ?? [])]
    .filter(r => r.taxa > 0)
    .sort((a, b) => b.parcela - a.parcela)[0];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Method cards ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {methods.map((m, idx) => {
          const norm = normalizeMethod(m);
          const meta = getEspecieMeta(norm.especie);
          const Icon = meta.icon;
          return (
            <div
              key={m.key}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-border/50 bg-card hover:bg-accent/20 transition-colors"
            >
              <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${meta.color}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold truncate">{m.label}</span>
                  {m.sigla && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-semibold">
                      {m.sigla}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                  {norm.operacao && (
                    <>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {OPERACOES.find(o => o.value === norm.operacao)?.label}
                      </span>
                    </>
                  )}
                  {norm.parcelamentoAtivo && norm.maxInstallments > 1 && (
                    <>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                        até {norm.maxInstallments}×
                      </span>
                    </>
                  )}
                  {m.key === "mercadopago" && (
                    <span className="text-[10px] text-muted-foreground">Online — requer credenciais</span>
                  )}
                  {m.key === "appmax" && (
                    <>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> Em desenvolvimento
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(idx)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Configurar"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
                {m.key.startsWith("custom_") && (
                  <button
                    type="button"
                    onClick={() => removeMethod(idx)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <Switch
                  checked={m.enabled}
                  onCheckedChange={v =>
                    onMethodsChange(methods.map((x, i) => i === idx ? { ...x, enabled: v } : x))
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add method ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={openNew}
        className="w-full h-10 rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-1.5 transition-colors"
      >
        <Plus className="w-4 h-4" /> Adicionar forma de pagamento
      </button>

      {/* ── Global delivery toggle ───────────────────────────────────────── */}
      <div className="rounded-xl bg-muted/40 border border-border/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Habilitar pagamento na entrega</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando ativo, clientes podem pagar ao receber (Dinheiro, PIX, Cartão).
            </p>
          </div>
          <Switch checked={deliveryPaymentEnabled} onCheckedChange={onDeliveryPaymentChange} />
        </div>
      </div>

      {/* ── Save button ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {success && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Salvo!
          </div>
        )}
        <Button
          onClick={onSave}
          disabled={saving}
          className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar formas de pagamento"}
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SHEET — Editor de método
      ══════════════════════════════════════════════════════════════════ */}
      <Sheet open={sheetOpen} onOpenChange={v => { if (!v) closeSheet(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[520px] p-0 flex flex-col overflow-hidden"
        >
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
            <SheetTitle className="text-base font-bold">
              {editingIdx !== null ? "Configurar Forma de Pagamento" : "Nova Forma de Pagamento"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {localMethod && (
              <>
                {/* ── Seção 1: Identificação ─────────────────────────────── */}
                <div>
                  <SectionHeader icon={CreditCard} title="Identificação" />
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
                      <Input
                        value={localMethod.label}
                        onChange={e => setLocal({ label: e.target.value })}
                        placeholder="Ex: Cartão de Crédito Visa"
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Sigla</label>
                        <Input
                          value={localMethod.sigla ?? ""}
                          onChange={e => setLocal({ sigla: e.target.value.toUpperCase().slice(0, 8) })}
                          placeholder="VISA, MC, PIX..."
                          className="mt-1 h-10 rounded-xl uppercase"
                        />
                      </div>
                      <div className="flex flex-col justify-end pb-0.5">
                        <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-border/50 bg-muted/30">
                          <span className="text-sm">Ativo</span>
                          <Switch
                            checked={localMethod.enabled}
                            onCheckedChange={v => setLocal({ enabled: v })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Seção 2: Classificação ────────────────────────────── */}
                <div>
                  <SectionHeader icon={FileText} title="Classificação" />
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Espécie *</label>
                      <Select
                        value={localMethod.especie ?? "outros"}
                        onValueChange={v => {
                          const especie = v as EspeciePagamento;
                          setLocal({
                            especie,
                            operacao: especie === "cartao"
                              ? (localMethod.operacao ?? "credito")
                              : null,
                            parcelamentoAtivo: especie === "cartao"
                              ? localMethod.parcelamentoAtivo
                              : false,
                            pixKeyType: especie === "pix"
                              ? (localMethod.pixKeyType ?? "cpf")
                              : undefined,
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1 h-10 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESPECIES.map(e => {
                            const I = e.icon;
                            return (
                              <SelectItem key={e.value} value={e.value}>
                                <div className="flex items-center gap-2">
                                  <I className={`w-4 h-4 ${e.color}`} />
                                  {e.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {localMethod.especie === "cartao" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Operação</label>
                        <Select
                          value={localMethod.operacao ?? "credito"}
                          onValueChange={v => setLocal({ operacao: v as OperacaoCartao })}
                        >
                          <SelectTrigger className="mt-1 h-10 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERACOES.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {!isMercadoPago && !isAppmax && (
                      <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-border/50 bg-muted/30">
                        <span className="text-sm">Aceita pagamento na entrega</span>
                        <Switch
                          checked={localMethod.payAtDelivery !== false}
                          onCheckedChange={v => setLocal({ payAtDelivery: v })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Seção 2.5: Planos de Pagamento Permitidos ───────────
                    Formas intermediadas por gateway externo (Mercado Pago,
                    Appmax) não escolhem plano aqui — o parcelamento é
                    decidido no checkout do próprio gateway. O Armazix só
                    recebe de volta se foi pago e em quantas parcelas. */}
                {!isMercadoPago && !isAppmax && (
                  <div>
                    <SectionHeader icon={ReceiptText} title="Planos de Pagamento Permitidos" />
                    {plans.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum plano cadastrado ainda. Crie planos em Gerais → Planos de Pagamento.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {plans.map(plan => {
                          const checked = (localMethod.allowedPlanIds ?? []).includes(plan.id);
                          return (
                            <label
                              key={plan.id}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                            >
                              <Checkbox checked={checked} onCheckedChange={v => togglePlan(plan.id, v === true)} />
                              <span className="text-sm">{plan.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Seção 3: Credenciais Mercado Pago ─────────────────── */}
                {isMercadoPago && (
                  <div>
                    <SectionHeader icon={KeyRound} title="Credenciais Mercado Pago" />
                    <div className="space-y-3">

                      {/* Como funciona */}
                      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 space-y-2">
                        <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Como funciona</p>
                        <ul className="text-[11px] text-indigo-700 dark:text-indigo-400 space-y-1 list-disc list-inside">
                          <li>O cliente clica em "Mercado Pago" e é redirecionado para o checkout deles</li>
                          <li>Aceita PIX, cartão de crédito/débito e boleto automaticamente</li>
                          <li>O pedido é confirmado via webhook após o pagamento</li>
                        </ul>
                      </div>

                      {/* Passo a passo de credenciais */}
                      <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Como obter as credenciais</p>
                        <ol className="space-y-1.5 text-blue-700 dark:text-blue-400 text-[11px] list-none">
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[9px]">1</span>
                            Acesse <span className="font-mono mx-1 bg-blue-100 dark:bg-blue-900 px-1 rounded">mercadopago.com.br</span> e faça login
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[9px]">2</span>
                            Vá em <strong>Sua conta → Ferramentas de integração → Credenciais</strong>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[9px]">3</span>
                            Copie a <strong>Public Key</strong> e o <strong>Access Token</strong> de <strong>produção</strong>
                          </li>
                        </ol>
                      </div>

                      <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <p>Credenciais salvas criptografadas — nunca expostas ao cliente ou ao frontend.</p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Public Key</label>
                        <Input
                          value={localMethod.config?.mercadoPago?.publicKey ?? ""}
                          onChange={e => setMpConfig({ publicKey: e.target.value })}
                          placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="mt-1 h-10 rounded-xl font-mono text-xs"
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          Access Token
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-normal">
                            <KeyRound className="w-2.5 h-2.5" /> privado
                          </span>
                        </label>
                        <div className="relative mt-1">
                          <Input
                            type={showMpToken ? "text" : "password"}
                            value={localMethod.config?.mercadoPago?.accessToken ?? ""}
                            onChange={e => setMpConfig({ accessToken: e.target.value })}
                            placeholder="APP_USR-0000000000000000-000000-xxxx…"
                            className="h-10 rounded-xl font-mono text-xs pr-10"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowMpToken(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showMpToken
                              ? <EyeOff className="w-4 h-4" />
                              : <Eye className="w-4 h-4" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Seção 3.5: Conexão Appmax ─────────────────────────── */}
                {isAppmax && (
                  <div>
                    <SectionHeader icon={Zap} title="Conexão com a Appmax" />
                    <div className="space-y-3">
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Em desenvolvimento</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                            Essa integração ainda está em homologação com a Appmax e a conexão está
                            temporariamente indisponível. Em breve você poderá ativá-la por aqui.
                          </p>
                        </div>
                      </div>

                      {appmaxConnected ? (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                              <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Conectado</p>
                              {appmaxConnectedAt && (
                                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                                  desde {new Date(appmaxConnectedAt).toLocaleDateString("pt-BR")}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onAppmaxDisconnect}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Unlink className="w-3 h-3" /> Desconectar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          disabled
                          title="Em desenvolvimento — disponível em breve"
                          variant="outline"
                          className="w-full h-10 rounded-xl gap-2"
                        >
                          <Link2 className="w-4 h-4" /> Conectar com Appmax
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Seção 4: Parcelamento (só cartão crédito) ─────────── */}
                {isCartaoCredito && (
                  <div>
                    <SectionHeader icon={CreditCard} title="Configuração de Parcelamento" />
                    <div className="space-y-4">

                      {/* Toggle ativar parcelamento */}
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/50 bg-muted/30">
                        <p className="text-sm font-medium">Ativar parcelamento</p>
                        <Switch
                          checked={!!localMethod.parcelamentoAtivo}
                          onCheckedChange={v => {
                            const max = v
                              ? (localMethod.maxInstallments > 1 ? localMethod.maxInstallments : 12)
                              : 1;
                            setLocal({
                              parcelamentoAtivo: v,
                              maxInstallments:   max,
                              taxasPorParcela:   v
                                ? buildTaxas(localMethod.taxasPorParcela ?? [], max)
                                : [],
                            });
                          }}
                        />
                      </div>

                      {showParcelas && (
                        <>
                          {/* Número máximo de parcelas */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">
                              Número máximo de parcelas
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                type="number"
                                min={2}
                                max={18}
                                value={localMethod.maxInstallments}
                                onChange={e =>
                                  handleMaxInstallmentsChange(parseInt(e.target.value, 10))
                                }
                                className="w-28 h-10 rounded-xl"
                              />
                              <span className="text-sm text-muted-foreground">parcelas (máx. 18×)</span>
                            </div>
                          </div>

                          {/* ─── Botão "Configurar Taxas por Parcela" ──────── */}
                          <button
                            type="button"
                            onClick={openTaxasModal}
                            className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                  Configurar Taxas por Parcela
                                </p>
                                <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">
                                  {configuredCount > 0
                                    ? `${configuredCount} de ${localMethod.maxInstallments} parcelas com taxa`
                                    : "Nenhuma taxa configurada ainda"
                                  }
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                          </button>

                          {/* Toggle: repassar taxa */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-3 py-3 rounded-xl border border-border/50 bg-muted/30">
                              <div>
                                <p className="text-sm font-medium">Repassar taxa para o cliente</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Soma a taxa ao valor cobrado no checkout
                                </p>
                              </div>
                              <Switch
                                checked={!!localMethod.repassarTaxaCliente}
                                onCheckedChange={v => setLocal({ repassarTaxaCliente: v })}
                              />
                            </div>

                            {/* Info box dinâmico */}
                            {exRow && exRow.taxa > 0 && (() => {
                              const base    = 8500;
                              const fee     = base * exRow.taxa / 100;
                              const total   = base + fee;
                              const parcVal = exRow.parcela > 1 ? total / exRow.parcela : total;
                              return (
                                <div className={`rounded-xl p-3 border text-xs space-y-1.5 ${
                                  localMethod.repassarTaxaCliente
                                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                                    : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                                }`}>
                                  <p className="font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Exemplo — R$ 8.500,00 em {exRow.parcela === 1 ? "à vista" : `${exRow.parcela}×`} ({exRow.taxa}%)
                                  </p>
                                  {localMethod.repassarTaxaCliente ? (
                                    <>
                                      <p>🧑 Cliente paga: <strong>R$ {fmt(total)}</strong>
                                        {exRow.parcela > 1 && ` (${exRow.parcela}× R$ ${fmt(parcVal)})`}
                                      </p>
                                      <p>🏪 Loja recebe líquido: <strong>R$ {fmt(base)}</strong></p>
                                    </>
                                  ) : (
                                    <>
                                      <p>🧑 Cliente paga: <strong>R$ {fmt(base)}</strong>
                                        {exRow.parcela > 1 && ` (${exRow.parcela}× R$ ${fmt(base / exRow.parcela)})`}
                                      </p>
                                      <p>🏪 Taxa retida: <strong>−R$ {fmt(fee)}</strong> (líquido: R$ {fmt(base - fee)})</p>
                                    </>
                                  )}
                                  <p className="text-muted-foreground">
                                    Taxa registrada no pedido: R$ {fmt(fee)}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Seção 5: PIX ──────────────────────────────────────── */}
                {isPix && (
                  <div>
                    <SectionHeader icon={QrCode} title="Configuração PIX" />
                    <div className="space-y-4">

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Tipo da chave PIX</label>
                        <Select
                          value={localMethod.pixKeyType ?? "cpf"}
                          onValueChange={v =>
                            setLocal({ pixKeyType: v as TipoChavePix, pixKey: "" })
                          }
                        >
                          <SelectTrigger className="mt-1 h-10 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHAVES_PIX.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Chave PIX</label>
                        <Input
                          value={localMethod.pixKey ?? ""}
                          onChange={e => {
                            const keyType = localMethod.pixKeyType ?? "cpf";
                            setLocal({ pixKey: maskPixKey(e.target.value, keyType) });
                          }}
                          placeholder={
                            CHAVES_PIX.find(c => c.value === (localMethod.pixKeyType ?? "cpf"))?.placeholder
                          }
                          className="mt-1 h-10 rounded-xl"
                          inputMode={
                            ["cpf","cnpj","celular"].includes(localMethod.pixKeyType ?? "")
                              ? "numeric" : "text"
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          QR Code estático (opcional)
                        </label>
                        <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                          Exibido no checkout para pagamento imediato. Máx. 3 MB.
                        </p>
                        <input
                          ref={qrInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleQrUpload}
                        />
                        {localMethod.pixQrCodeUrl ? (
                          <div className="relative inline-block">
                            <div className="w-36 h-36 rounded-xl border border-border/50 bg-muted/30 overflow-hidden flex items-center justify-center">
                              <img
                                src={localMethod.pixQrCodeUrl}
                                alt="QR Code PIX"
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setLocal({ pixQrCodeUrl: undefined })}
                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-sm"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => qrInputRef.current?.click()}
                            className="w-36 h-36 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Upload className="w-6 h-6" />
                            <span className="text-xs text-center leading-tight">
                              Clique para<br />fazer upload
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sheet footer */}
          <div className="px-5 py-4 border-t border-border/50 flex items-center gap-2 shrink-0 bg-background">
            <Button
              onClick={saveSheet}
              disabled={!localMethod?.label.trim()}
              className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
            >
              Salvar
            </Button>
            <Button
              variant="outline"
              onClick={closeSheet}
              className="flex-1 h-10 rounded-xl"
            >
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Configuração de Taxas da Maquineta
      ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={taxasOpen} onOpenChange={v => { if (!v) closeTaxasModal(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">

          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Configuração de Taxas da Maquineta
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {localMethod?.label}
              {localMethod?.sigla ? ` (${localMethod.sigla})` : ""} —
              até {localMethod?.maxInstallments}× parcelas
            </p>
          </DialogHeader>

          {/* Preview row */}
          <div className="px-6 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-2 shrink-0">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Valor de referência:</span>
            <span className="text-xs text-muted-foreground font-medium">R$</span>
            <input
              type="number"
              value={previewValueStr}
              onChange={e => setPreviewValueStr(e.target.value)}
              className="w-24 h-7 rounded-lg border border-border/50 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
              min={1}
              step={100}
            />
            <span className="text-[10px] text-muted-foreground ml-auto">
              {localTaxas.filter(t => t.taxa > 0).length}/{localTaxas.length} taxas configuradas
            </span>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/80 border-b border-border/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                    Qtd. de Parcelas
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                    Taxa (%)
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                    Custo / Parcela
                  </th>
                </tr>
              </thead>
              <tbody>
                {localTaxas.map(({ parcela, taxa }, i) => {
                  const feeAmount   = previewBase * taxa / 100;
                  const totalComFee = previewBase + feeAmount;
                  const parcelaVal  = parcela > 1 ? totalComFee / parcela : totalComFee;
                  const isEven      = i % 2 === 0;
                  return (
                    <tr
                      key={parcela}
                      className={`border-b border-border/30 transition-colors hover:bg-primary/5 ${
                        isEven ? "bg-background" : "bg-muted/25"
                      }`}
                    >
                      {/* Parcela label */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-8 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            parcela === 1
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : taxa > 0
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                                : "bg-muted text-muted-foreground"
                          }`}>
                            {parcela}×
                          </span>
                          <span className="text-sm font-medium">
                            {parcela === 1 ? "À vista" : `${parcela} parcelas`}
                          </span>
                        </div>
                      </td>

                      {/* Taxa input */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={taxa === 0 ? "" : taxa}
                            onChange={e =>
                              updateLocalTaxa(parcela, parseFloat(e.target.value) || 0)
                            }
                            placeholder="0,00"
                            className="w-24 h-8 rounded-lg border border-border/50 bg-background px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
                            min={0}
                            max={100}
                            step={0.01}
                          />
                          <span className="text-xs text-muted-foreground font-medium">%</span>
                        </div>
                      </td>

                      {/* Preview */}
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {taxa > 0 ? (
                          <div className="text-xs">
                            <span className="font-semibold text-foreground">
                              +R$ {fmt(feeAmount)}
                            </span>
                            {parcela > 1 && (
                              <span className="block text-[10px] text-muted-foreground">
                                R$ {fmt(parcelaVal)}/parc.
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 shrink-0 bg-background">
            <p className="text-xs text-muted-foreground hidden sm:block">
              {localTaxas.filter(t => t.taxa > 0).length === 0
                ? "Sem taxas — clientes pagam valor integral"
                : `${localTaxas.filter(t => t.taxa > 0).length} faixa(s) com taxa`
              }
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={closeTaxasModal}
                className="flex-1 sm:flex-none h-9 rounded-xl px-4"
              >
                Cancelar
              </Button>
              <Button
                onClick={saveTaxas}
                className="flex-1 sm:flex-none h-9 rounded-xl px-5 bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                Salvar Taxas
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
