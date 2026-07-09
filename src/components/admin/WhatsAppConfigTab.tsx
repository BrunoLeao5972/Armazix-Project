import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePhoneInput, defaultCountries, parseCountry } from "react-international-phone";
import { api } from "@/lib/api-client";
import {
  DEFAULT_WPP_CONFIG,
  DEFAULT_OWNER_TEMPLATE,
  DEFAULT_CUSTOMER_TEMPLATES,
  type WppConfig,
} from "@/lib/whatsapp-sender";
import {
  QrCode, Bell, MessageSquare, RotateCcw, RefreshCw,
  ChevronDown, Check, X, Loader2, AlertCircle, Wifi, WifiOff, Unplug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

type WppStatusData = {
  connected: boolean;
  configured: boolean;
  phone?: string;
  profileName?: string;
  qrCode?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CUSTOMER_STATUS_ITEMS: { key: keyof WppConfig["customerTemplates"]; label: string; emoji: string }[] = [
  { key: "received",   label: "Pedido recebido",         emoji: "✅" },
  { key: "preparing",  label: "Em preparo",               emoji: "👨‍🍳" },
  { key: "ready",      label: "Pronto para retirada",     emoji: "📦" },
  { key: "delivering", label: "Saiu para entrega",        emoji: "🚀" },
  { key: "delivered",  label: "Entregue",                 emoji: "🤝" },
  { key: "cancelled",  label: "Cancelado",                emoji: "😔" },
];

const OWNER_VARIABLES = [
  { key: "numero",    label: "Nº pedido"   },
  { key: "data",      label: "Data/hora"   },
  { key: "nome",      label: "Cliente"     },
  { key: "itens",     label: "Itens"       },
  { key: "subtotal",  label: "Subtotal"    },
  { key: "frete",     label: "Frete"       },
  { key: "pagamento", label: "Pagamento"   },
  { key: "total",     label: "Total"       },
  { key: "entrega",   label: "Entrega"     },
];

const CUSTOMER_VARIABLES = [
  { key: "nome",      label: "Nome"        },
  { key: "numero",    label: "Nº pedido"   },
  { key: "total",     label: "Total"       },
  { key: "pagamento", label: "Pagamento"   },
  { key: "itens",     label: "Itens"       },
  { key: "endereco",  label: "End. loja"   },
  { key: "loja",      label: "Nome da loja"},
];

// Preview substitution helper
function previewTemplate(template: string): string {
  return template
    .replace(/\{\{nome\}\}/g, "Maria Silva")
    .replace(/\{\{numero\}\}/g, "1234")
    .replace(/\{\{data\}\}/g, "08/07/2026 às 19:42")
    .replace(/\{\{total\}\}/g, "89,90")
    .replace(/\{\{subtotal\}\}/g, "79,90")
    .replace(/\{\{frete\}\}/g, "R$ 10,00")
    .replace(/\{\{pagamento\}\}/g, "PIX")
    .replace(/\{\{entrega\}\}/g, "Delivery\n📍 Rua das Flores, 123 — Centro — Recife/PE — CEP: 50000-000")
    .replace(/\{\{itens\}\}/g, "• Produto A ×2\n• Produto B ×1")
    .replace(/\{\{pagamento\}\}/g, "PIX")
    .replace(/\{\{endereco\}\}/g, "Rua Exemplo, 123 – Centro\nFortaleza/CE – CEP 60000-000")
    .replace(/\{\{loja\}\}/g, "Minha Loja");
}

// ─── Phone Input with Country Selector ───────────────────────────────────────

function getFlagEmoji(iso2: string): string {
  return iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function PhoneInputField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Stored as raw digits (e.g. "558599149141"), PhoneInput expects E.164 ("+558599149141")
  const e164 = value ? (value.startsWith("+") ? value : `+${value}`) : "";

  const { phone, inputValue, handlePhoneValueChange, inputRef, country, setCountry } = usePhoneInput({
    defaultCountry: "br",
    value: e164,
    countries: defaultCountries,
    forceDialCode: true,
    preferredCountries: ["br", "us", "pt", "ar", "mx"],
    onChange: (data) => {
      // data.phone é E.164 (+558599149141) — guarda só os dígitos
      onChange(data.phone.replace(/\D/g, ""));
    },
  });

  const parsed = parseCountry(
    defaultCountries.find(c => parseCountry(c).iso2 === country.iso2) ?? defaultCountries[0]
  );

  return (
    <div className="flex h-11 rounded-xl border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring focus-within:border-transparent transition-colors">
      {/* Country selector — invisible native <select> overlaid on styled display */}
      <div className="relative flex items-center gap-1.5 px-3 border-r border-border/50 bg-muted/30 select-none shrink-0 min-w-[88px]">
        <span className="text-base leading-none">{getFlagEmoji(country.iso2)}</span>
        <span className="text-[13px] font-mono text-foreground/75 tabular-nums">+{parsed.dialCode}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
        <select
          value={country.iso2}
          onChange={e => setCountry(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
          aria-label="Selecionar país"
        >
          {defaultCountries.map(c => {
            const { iso2, name, dialCode } = parseCountry(c);
            return (
              <option key={iso2} value={iso2}>
                {getFlagEmoji(iso2)} {name} (+{dialCode})
              </option>
            );
          })}
        </select>
      </div>

      {/* Number input — usa inputValue (formatado) não phone (E.164 bruto) */}
      <input
        ref={inputRef}
        type="tel"
        value={inputValue}
        onChange={handlePhoneValueChange}
        placeholder="(85) 9 9914-9141"
        className="flex-1 px-3 text-sm font-mono bg-transparent outline-none placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

// ─── QR Code Modal ────────────────────────────────────────────────────────────

function QrModal({
  qrCode,
  loading,
  onRefresh,
  onClose,
}: {
  qrCode: string | null;
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const imgSrc = qrCode
    ? qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Conectar via QR Code</h2>
              <p className="text-xs text-muted-foreground">Escaneie com o WhatsApp do celular</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* QR image area */}
          <div className="flex justify-center">
            {loading || !imgSrc ? (
              <div className="w-52 h-52 rounded-2xl border border-border/60 bg-muted flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Gerando QR Code…</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={imgSrc}
                  alt="WhatsApp QR Code"
                  className="w-52 h-52 rounded-2xl border border-border/60"
                />
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 p-3.5 space-y-1">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">Como escanear:</p>
            <ol className="text-xs text-emerald-800 dark:text-emerald-400 opacity-90 list-decimal list-inside space-y-0.5">
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em ⋮ Dispositivos vinculados</li>
              <li>Toque em "Vincular um dispositivo"</li>
              <li>Aponte a câmera para este QR Code</li>
            </ol>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Aguardando leitura… Após escanear, esta janela fechará automaticamente.
            </p>
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-10 rounded-xl text-sm gap-1.5"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar QR
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Connection Card ─────────────────────────────────────────────────────────

function ConnectionCard({
  status,
  loading,
  disconnecting,
  onConnect,
  onDisconnect,
  onRefresh,
}: {
  status: WppStatusData | null;
  loading: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            <div className="h-3 w-44 rounded bg-muted animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const connected = status?.connected ?? false;
  const configured = status?.configured ?? true;

  return (
    <Card className={`rounded-2xl border shadow-soft transition-colors ${connected ? "border-[#25D366]/30 bg-[#25D366]/5" : "border-border/50"}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${connected ? "bg-[#25D366]/15 text-[#25D366]" : "bg-muted text-muted-foreground"}`}>
              {connected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">
                  {connected ? "WhatsApp conectado" : "WhatsApp desconectado"}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${connected ? "bg-[#25D366]/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#25D366]" : "bg-muted-foreground/50"}`} />
                  {connected ? "Online" : "Offline"}
                </span>
              </div>
              {connected && status?.phone && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">+{status.phone}</p>
              )}
              {connected && status?.profileName && (
                <p className="text-xs text-muted-foreground">{status.profileName}</p>
              )}
              {!connected && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conecte para enviar notificações automáticas
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={onRefresh}
              title="Atualizar status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>

            {connected ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={onDisconnect}
                disabled={disconnecting}
              >
                {disconnecting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Unplug className="w-3.5 h-3.5" />}
                Desconectar
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 rounded-xl gap-1.5 text-xs bg-[#25D366] hover:bg-[#20bc59] text-white shadow-sm"
                onClick={onConnect}
              >
                <QrCode className="w-3.5 h-3.5" />
                Conectar via QR Code
              </Button>
            )}
          </div>
        </div>

        {!configured && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Evolution API não configurada. Defina <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">EVOLUTION_API_URL</code> e <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">EVOLUTION_API_KEY</code> no servidor.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Template Accordion ───────────────────────────────────────────────────────

function TemplateAccordion({
  emoji,
  label,
  description,
  variables,
  value,
  disabled,
  isOpen,
  onToggle,
  onChange,
  onRestore,
  taRef,
}: {
  emoji: string;
  label: string;
  description: string;
  variables: { key: string; label: string }[];
  value: string;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  onRestore: () => void;
  taRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const combinedRef = (el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    taRef(el);
  };

  const insertVariable = (varKey: string) => {
    const ta = localRef.current;
    const variable = `{{${varKey}}}`;
    if (ta) {
      const start = ta.selectionStart ?? ta.value.length;
      const end   = ta.selectionEnd   ?? ta.value.length;
      const next  = ta.value.slice(0, start) + variable + ta.value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + variable.length;
        ta.focus();
      });
    } else {
      onChange(value + variable);
    }
  };

  return (
    <div className={`rounded-xl border transition-all duration-150 ${isOpen ? "border-primary/40 shadow-sm" : "border-border/50 hover:border-border"}`}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-base leading-none shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {disabled && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                Desativado
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Content — animate via max-height trick */}
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-[800px]" : "max-h-0"}`}>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">{description}</p>

          {/* Variable badges */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Clique para inserir no cursor:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {variables.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary hover:bg-primary/10 border border-border/60 hover:border-primary/40 hover:text-primary transition-all cursor-pointer select-none"
                >
                  <span className="font-mono text-[10px] opacity-60">{"{{"}</span>
                  {v.label}
                  <span className="font-mono text-[10px] opacity-60">{"}}"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <button
                type="button"
                onClick={onRestore}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar padrão
              </button>
            </div>
            <textarea
              ref={combinedRef}
              value={value}
              onChange={e => onChange(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 text-sm font-mono rounded-xl border border-border/70 bg-background resize-y leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 placeholder:text-muted-foreground/50"
              placeholder="Digite o template da mensagem…"
            />
          </div>

          {/* WhatsApp bubble preview */}
          {value.trim() && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Preview:</p>
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-[#d9fdd3] dark:bg-emerald-900/40 rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm">
                  <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {previewTemplate(value)}
                  </p>
                  <p className="text-[10px] text-slate-500 text-right mt-1">12:00 ✓✓</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WhatsAppConfigTab() {
  // Connection
  const [wppStatus, setWppStatus]         = useState<WppStatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [qrModalOpen, setQrModalOpen]     = useState(false);
  const [qrCode, setQrCode]               = useState<string | null>(null);
  const [qrLoading, setQrLoading]         = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Config
  const [config, setConfig]           = useState<WppConfig>({ ...DEFAULT_WPP_CONFIG });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState("");

  // Accordion
  const [openKey, setOpenKey] = useState<string | null>("owner");

  // Textarea refs map (used for getRef callback passed to TemplateAccordion)
  const taRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const getRef = (key: string) => (el: HTMLTextAreaElement | null) => { taRefs.current[key] = el; };

  useEffect(() => {
    loadStatus();
    loadConfig();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await api.get("/api/whatsapp/status");
      if (res.ok) {
        const data = await res.json() as WppStatusData;
        setWppStatus(data);
      }
    } catch { /* noop */ } finally { setStatusLoading(false); }
  };

  const loadConfig = async () => {
    try {
      const res = await api.get("/api/whatsapp/config");
      if (res.ok) {
        const data = await res.json() as { config: WppConfig };
        if (data.config) {
          setConfig({
            ...DEFAULT_WPP_CONFIG,
            ...data.config,
            customerTemplates: {
              ...DEFAULT_CUSTOMER_TEMPLATES,
              ...data.config.customerTemplates,
            },
          });
        }
      }
    } catch { /* noop */ } finally { setConfigLoaded(true); }
  };

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get("/api/whatsapp/status");
        if (!res.ok) return;
        const data = await res.json() as WppStatusData;
        if (data.connected) {
          stopPolling();
          setWppStatus(data);
          setQrModalOpen(false);
          // Auto-fill owner phone if empty
          if (data.phone) {
            setConfig(prev => prev.ownerPhone ? prev : { ...prev, ownerPhone: data.phone! });
          }
        } else if (data.qrCode) {
          setQrCode(data.qrCode);
        }
      } catch { /* noop */ }
    }, 3000);
  };

  const handleConnect = async () => {
    setQrLoading(true);
    setQrCode(null);
    setQrModalOpen(true);
    try {
      const res = await api.post("/api/whatsapp/connect", {});
      if (!res.ok) { setQrLoading(false); return; }
      const data = await res.json() as { connected?: boolean; qrCode?: string };
      if (data.connected) {
        setQrModalOpen(false);
        await loadStatus();
        return;
      }
      if (data.qrCode) {
        setQrCode(data.qrCode);
        startPolling();
      }
    } catch { /* noop */ } finally { setQrLoading(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar o WhatsApp?\nAs notificações automáticas serão pausadas.")) return;
    setDisconnecting(true);
    try {
      await api.post("/api/whatsapp/disconnect", {});
      setWppStatus({ connected: false, configured: true });
    } catch { /* noop */ } finally { setDisconnecting(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const res = await api.post("/api/whatsapp/config", { config });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const d = await res.json() as { error?: string };
        setSaveError(d.error || "Erro ao salvar");
      }
    } catch { setSaveError("Erro de conexão"); } finally { setSaving(false); }
  };

  const getTemplate = (key: string): string => {
    if (key === "owner") return config.ownerTemplate;
    return config.customerTemplates[key as keyof WppConfig["customerTemplates"]] ?? "";
  };

  const updateTemplate = (key: string, value: string) => {
    if (key === "owner") {
      setConfig(prev => ({ ...prev, ownerTemplate: value }));
    } else {
      setConfig(prev => ({
        ...prev,
        customerTemplates: { ...prev.customerTemplates, [key]: value },
      }));
    }
  };

  const restoreDefault = (key: string) => {
    if (key === "owner") {
      setConfig(prev => ({ ...prev, ownerTemplate: DEFAULT_OWNER_TEMPLATE }));
    } else {
      const k = key as keyof typeof DEFAULT_CUSTOMER_TEMPLATES;
      setConfig(prev => ({
        ...prev,
        customerTemplates: { ...prev.customerTemplates, [k]: DEFAULT_CUSTOMER_TEMPLATES[k] },
      }));
    }
  };

  const isStatusEnabled = (s: string) => config.notifyStatuses.includes(s);
  const toggleStatus = (s: string) =>
    setConfig(prev => ({
      ...prev,
      notifyStatuses: prev.notifyStatuses.includes(s)
        ? prev.notifyStatuses.filter(x => x !== s)
        : [...prev.notifyStatuses, s],
    }));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* 1 · Connection */}
      <ConnectionCard
        status={wppStatus}
        loading={statusLoading}
        disconnecting={disconnecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onRefresh={loadStatus}
      />

      {/* 2 · Notification Settings */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Configurações de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Owner */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Notificar lojista em novos pedidos</div>
                <div className="text-xs text-muted-foreground">Receba uma mensagem a cada novo pedido</div>
              </div>
              <Switch
                checked={config.notifyOwner}
                onCheckedChange={v => setConfig(prev => ({ ...prev, notifyOwner: v }))}
              />
            </div>

            {config.notifyOwner && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <Label className="text-xs text-muted-foreground">Número do WhatsApp (lojista)</Label>
                <PhoneInputField
                  value={config.ownerPhone}
                  onChange={phone => setConfig(prev => ({ ...prev, ownerPhone: phone }))}
                />
                <p className="text-xs text-muted-foreground">
                  Selecione o país e digite o número com DDD. O formato será ajustado automaticamente.
                </p>
                {wppStatus?.connected && wppStatus.phone && wppStatus.phone !== config.ownerPhone && (
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, ownerPhone: wppStatus.phone! }))}
                    className="text-xs text-primary hover:underline"
                  >
                    Usar número conectado (+{wppStatus.phone})
                  </button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Customer */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Notificar cliente automaticamente</div>
                <div className="text-xs text-muted-foreground">Envia mensagens ao cliente a cada mudança de status</div>
              </div>
              <Switch
                checked={config.notifyCustomer}
                onCheckedChange={v => setConfig(prev => ({ ...prev, notifyCustomer: v }))}
              />
            </div>

            {config.notifyCustomer && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Notificar nos status:
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CUSTOMER_STATUS_ITEMS.map(({ key, label, emoji }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/60 cursor-pointer hover:bg-secondary/30 transition-colors select-none"
                    >
                      <Checkbox
                        checked={isStatusEnabled(key)}
                        onCheckedChange={() => toggleStatus(key)}
                        className="shrink-0"
                      />
                      <span className="text-sm">{emoji} {label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3 · Templates */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Templates de Mensagem
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personalize as mensagens. Clique nos badges de variáveis para inseri-las na posição do cursor.
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">

          {/* Owner template */}
          <TemplateAccordion
            emoji="🏪"
            label="Lojista — novo pedido"
            description="Enviado para o número do lojista a cada novo pedido. Disponível apenas quando 'Notificar lojista' está ativo."
            variables={OWNER_VARIABLES}
            value={getTemplate("owner")}
            disabled={!config.notifyOwner}
            isOpen={openKey === "owner"}
            onToggle={() => setOpenKey(openKey === "owner" ? null : "owner")}
            onChange={v => updateTemplate("owner", v)}
            onRestore={() => restoreDefault("owner")}
            taRef={getRef("owner")}
          />

          {/* Customer templates */}
          {CUSTOMER_STATUS_ITEMS.map(({ key, label, emoji }) => (
            <TemplateAccordion
              key={key}
              emoji={emoji}
              label={`Cliente — ${label}`}
              description={`Enviado para o cliente quando o pedido muda para "${label}".`}
              variables={CUSTOMER_VARIABLES}
              value={getTemplate(key)}
              disabled={!config.notifyCustomer || !isStatusEnabled(key)}
              isOpen={openKey === key}
              onToggle={() => setOpenKey(openKey === key ? null : key)}
              onChange={v => updateTemplate(key, v)}
              onRestore={() => restoreDefault(key)}
              taRef={getRef(key)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={saving || !configLoaded}
          className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar configurações"}
        </Button>
        {saveSuccess && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600 animate-in fade-in duration-200">
            <Check className="w-4 h-4" />
            Configurações salvas!
          </div>
        )}
        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}
      </div>

      {/* QR Modal */}
      {qrModalOpen && createPortal(
        <QrModal
          qrCode={qrCode}
          loading={qrLoading}
          onRefresh={async () => {
            setQrLoading(true);
            try {
              const res = await api.get("/api/whatsapp/status");
              if (res.ok) {
                const d = await res.json() as WppStatusData;
                if (d.qrCode) setQrCode(d.qrCode);
              }
            } catch { /* noop */ } finally { setQrLoading(false); }
          }}
          onClose={() => {
            setQrModalOpen(false);
            stopPolling();
          }}
        />,
        document.body
      )}
    </div>
  );
}
