import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Save,
  Smartphone,
  Unlink,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import {
  DEFAULT_WPP_CONFIG,
  type WppConfig,
} from "@/lib/whatsapp-sender";

// ── Ícone WhatsApp inline ─────────────────────────────────────────────────────
function WppIcon({ size = 20, color = "#25D366" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type WppState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "qr"; qrCode: string }
  | { status: "connected"; phone?: string; profileName?: string }
  | { status: "settings"; phone?: string; profileName?: string }
  | { status: "not_configured" }
  | { status: "error"; message: string };

interface StatusResponse {
  connected: boolean;
  configured?: boolean;
  qrCode?: string;
  phone?: string;
  profileName?: string;
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  received: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto p/ retirada",
  delivering: "Saiu p/ entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const POLL_INTERVAL = 3000;

// ── Settings form ─────────────────────────────────────────────────────────────
function SettingsView({
  phone,
  profileName,
  onBack,
}: {
  phone?: string;
  profileName?: string;
  onBack: () => void;
}) {
  const [config, setConfig] = useState<WppConfig>(DEFAULT_WPP_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/whatsapp/config").then(async (r) => {
      if (r.ok) {
        const d = await r.json() as { config: WppConfig };
        setConfig({ ...DEFAULT_WPP_CONFIG, ...d.config, customerTemplates: { ...DEFAULT_WPP_CONFIG.customerTemplates, ...d.config?.customerTemplates } });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleStatus = (s: string) => {
    setConfig((c) => ({
      ...c,
      notifyStatuses: c.notifyStatuses.includes(s)
        ? c.notifyStatuses.filter((x) => x !== s)
        : [...c.notifyStatuses, s],
    }));
  };

  const setTemplate = (key: string, value: string) => {
    if (key === "owner") {
      setConfig((c) => ({ ...c, ownerTemplate: value }));
    } else {
      setConfig((c) => ({
        ...c,
        customerTemplates: { ...c.customerTemplates, [key]: value },
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/api/whatsapp/config", { config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const templateItems: Array<{ key: string; label: string }> = [
    { key: "owner", label: "Lojista — novo pedido" },
    { key: "received", label: "Cliente — confirmado" },
    { key: "preparing", label: "Cliente — preparando" },
    { key: "ready", label: "Cliente — pronto p/ retirada" },
    { key: "delivering", label: "Cliente — saiu p/ entrega" },
    { key: "delivered", label: "Cliente — entregue" },
    { key: "cancelled", label: "Cliente — cancelado" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1 border-b border-border/40">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <p className="text-sm font-semibold">Configurar notificações</p>
          {(profileName || phone) && (
            <p className="text-xs text-muted-foreground">
              {[profileName, phone ? `+${phone}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Notificar lojista */}
      <section className="space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Lojista</p>
        <div className="flex items-center justify-between">
          <Label htmlFor="notify-owner" className="text-sm cursor-pointer">
            Avisar ao receber novo pedido
          </Label>
          <Switch
            id="notify-owner"
            checked={config.notifyOwner}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, notifyOwner: v }))}
          />
        </div>
        {config.notifyOwner && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Número do WhatsApp</Label>
            <Input
              placeholder="55 (11) 99999-9999"
              value={config.ownerPhone}
              onChange={(e) => setConfig((c) => ({ ...c, ownerPhone: e.target.value }))}
              className="h-9 rounded-xl text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Use o mesmo número conectado ou outro de sua preferência.</p>
          </div>
        )}
      </section>

      {/* Notificar cliente */}
      <section className="space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cliente</p>
        <div className="flex items-center justify-between">
          <Label htmlFor="notify-customer" className="text-sm cursor-pointer">
            Avisar cliente nas atualizações
          </Label>
          <Switch
            id="notify-customer"
            checked={config.notifyCustomer}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, notifyCustomer: v }))}
          />
        </div>
        {config.notifyCustomer && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Notificar quando o pedido for:</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const active = config.notifyStatuses.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleStatus(key)}
                    className="h-7 px-3 rounded-full text-xs font-medium border transition-colors"
                    style={active
                      ? { backgroundColor: "#25D36618", borderColor: "#25D36640", color: "#128C7E" }
                      : { backgroundColor: "transparent", borderColor: "rgb(226 232 240)", color: "rgb(100 116 139)" }}
                  >
                    {active ? "✓ " : ""}{label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Templates */}
      <section className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Templates de mensagem</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Use <code className="bg-muted px-1 rounded text-[10px]">{"{{nome}}"}</code>{" "}
          <code className="bg-muted px-1 rounded text-[10px]">{"{{numero}}"}</code>{" "}
          <code className="bg-muted px-1 rounded text-[10px]">{"{{total}}"}</code>{" "}
          <code className="bg-muted px-1 rounded text-[10px]">{"{{loja}}"}</code>{" "}
          <code className="bg-muted px-1 rounded text-[10px]">{"{{itens}}"}</code>
        </p>

        {templateItems.map(({ key, label }) => {
          const isOpen = expanded === key;
          const value = key === "owner"
            ? config.ownerTemplate
            : config.customerTemplates[key as keyof WppConfig["customerTemplates"]];

          return (
            <div key={key} className="border border-border/60 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : key)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-medium">{label}</span>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="px-3.5 pb-3 border-t border-border/40 pt-2.5">
                  <Textarea
                    value={value}
                    onChange={(e) => setTemplate(key, e.target.value)}
                    rows={5}
                    className="text-xs rounded-xl resize-none font-mono"
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Salvar */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl h-10"
        style={{ backgroundColor: "#25D366" }}
      >
        {saving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : saved ? (
          <CheckCircle2 className="w-4 h-4 mr-2" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        {saved ? "Salvo!" : "Salvar configurações"}
      </Button>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
}

export function WhatsAppModal({ open, onClose }: WhatsAppModalProps) {
  const [state, setState] = useState<WppState>({ status: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollStatus = async () => {
    try {
      const res = await api.get("/api/whatsapp/status");
      if (!res.ok) return;
      const data = (await res.json()) as StatusResponse;
      if (data.connected) {
        stopPolling();
        setState({ status: "connected", phone: data.phone, profileName: data.profileName });
      } else if (data.qrCode) {
        setState({ status: "qr", qrCode: data.qrCode });
      }
    } catch { /* keep polling */ }
  };

  const initConnect = async () => {
    stopPolling();
    setState({ status: "loading" });
    try {
      const res = await api.post("/api/whatsapp/connect", {});
      const data = (await res.json()) as StatusResponse & { configured?: boolean };

      if (!res.ok || data.configured === false) {
        setState(data.configured === false ? { status: "not_configured" } : { status: "error", message: data.error ?? "Erro ao gerar QRCode" });
        return;
      }
      if (data.connected) { setState({ status: "connected", phone: data.phone, profileName: data.profileName }); return; }
      if (data.qrCode) {
        setState({ status: "qr", qrCode: data.qrCode });
        pollRef.current = setInterval(pollStatus, POLL_INTERVAL);
        return;
      }
      setState({ status: "error", message: data.error ?? "Resposta inesperada" });
    } catch {
      setState({ status: "error", message: "Erro de conexão com o servidor" });
    }
  };

  const handleDisconnect = async () => {
    try { await api.post("/api/whatsapp/disconnect", {}); } catch { /* ignore */ }
    stopPolling();
    onClose();
    setTimeout(() => setState({ status: "idle" }), 300);
  };

  useEffect(() => {
    if (open) { initConnect(); } else { stopPolling(); setTimeout(() => setState({ status: "idle" }), 300); }
    return stopPolling;
  }, [open]);

  const qrSrc = state.status === "qr"
    ? state.qrCode.startsWith("data:")
      ? state.qrCode
      : `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(state.qrCode)}&size=256x256&margin=6`
    : null;

  const connectedPhone = state.status === "connected" || state.status === "settings" ? (state as { phone?: string }).phone : undefined;
  const connectedProfile = state.status === "connected" || state.status === "settings" ? (state as { profileName?: string }).profileName : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">

        {/* Cabeçalho */}
        {state.status !== "settings" && (
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#25D36618" }}>
                <WppIcon size={22} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold leading-tight">Integração WhatsApp</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Conecte seu número para notificações automáticas</p>
              </div>
            </div>
          </DialogHeader>
        )}

        {/* Corpo com scroll */}
        <div className="px-6 py-6 overflow-y-auto flex-1 min-h-0">

          {/* ── Settings view ── */}
          {state.status === "settings" && (
            <SettingsView
              phone={connectedPhone}
              profileName={connectedProfile}
              onBack={() => setState({ status: "connected", phone: connectedPhone, profileName: connectedProfile })}
            />
          )}

          {/* ── Loading ── */}
          {state.status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-slate-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Gerando QRCode, aguarde...</p>
                <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
              </div>
            </div>
          )}

          {/* ── QR Code ── */}
          {state.status === "qr" && qrSrc && (
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex flex-col items-center gap-3 shrink-0 mx-auto sm:mx-0">
                <div className="relative p-2.5 rounded-2xl border-2 border-dashed border-border/60 bg-white shadow-sm">
                  <img src={qrSrc} alt="QR Code WhatsApp" className="w-[210px] h-[210px] rounded-lg block" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </span>
                  </span>
                </div>
                <button onClick={initConnect} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className="w-3 h-3" />Atualizar código
                </button>
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Como conectar</p>
                <ol className="space-y-3">
                  {["Abra o WhatsApp no seu celular", "Toque em Aparelhos conectados", 'Toque em "Conectar um aparelho"', "Aponte a câmera para o QRCode"].map((text, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-px" style={{ backgroundColor: "#25D36618", color: "#128C7E" }}>{i + 1}</span>
                      <span className="text-xs text-foreground/80 leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0 animate-pulse" />
                  <span className="text-[11px] text-emerald-700 font-medium">Aguardando leitura do QRCode...</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Conectado ── */}
          {state.status === "connected" && (
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ backgroundColor: "#25D36618" }}>
                  <WppIcon size={42} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-background flex items-center justify-center shadow">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-semibold">WhatsApp Conectado!</h3>
                {(connectedProfile || connectedPhone) && (
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="text-sm">{[connectedProfile, connectedPhone ? `+${connectedPhone}` : null].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
              </div>

              {/* Botão de configurar notificações */}
              <button
                onClick={() => setState({ status: "settings", phone: connectedPhone, profileName: connectedProfile })}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-border/60 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#25D36618" }}>
                    <WppIcon size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Configurar notificações</p>
                    <p className="text-xs text-muted-foreground">Templates, status e destinatários</p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 -rotate-90 transition-colors" />
              </button>

              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 text-sm text-destructive/60 hover:text-destructive transition-colors px-4 py-2 rounded-xl hover:bg-destructive/5"
              >
                <Unlink className="w-3.5 h-3.5" />
                Desconectar aparelho
              </button>
            </div>
          )}

          {/* ── Não configurado ── */}
          {state.status === "not_configured" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
                <WppIcon size={28} color="#D97706" />
              </div>
              <div>
                <p className="text-sm font-medium">Integração não configurada</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[300px] leading-relaxed">
                  Configure <code className="bg-muted px-1 rounded text-[11px]">EVOLUTION_API_URL</code> e{" "}
                  <code className="bg-muted px-1 rounded text-[11px]">EVOLUTION_API_KEY</code> no servidor.
                </p>
              </div>
            </div>
          )}

          {/* ── Erro ── */}
          {state.status === "error" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-2xl bg-destructive/8 flex items-center justify-center">
                <WifiOff className="w-7 h-7 text-destructive/60" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Falha na conexão</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">{state.message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={initConnect} className="rounded-xl">
                <RefreshCw className="w-3.5 h-3.5 mr-2" />Tentar novamente
              </Button>
            </div>
          )}
        </div>

        {/* Rodapé */}
        {state.status !== "connected" && state.status !== "settings" && (
          <div className="px-6 py-4 border-t border-border/50 flex justify-end bg-muted/20 shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-muted-foreground text-xs">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
