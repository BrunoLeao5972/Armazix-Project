import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Printer, Settings2, Plus, Loader2, Check, X, RefreshCw,
  Trash2, Edit, ChevronDown, Search, Cpu, MoreHorizontal,
  Download, Send, Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildProductionTicket, buildCaixaCoupon, buildDeliveryTicket, buildFichaEntrega,
  linesToEscPos, type ThermalLine,
  SAMPLE_STORE, SAMPLE_ORDER,
} from "@/lib/thermal/layouts";

export const Route = createFileRoute("/admin/printers")({
  component: PrintersPage,
  head: () => ({ meta: [{ title: "Impressoras — ARMAZIX" }] }),
});

// ─── Types ────────────────────────────────────────────────────────
interface PrinterRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  driver: string;
  path: string | null;
  columns: number | null;
  active: boolean;
  createdAt: string;
}

interface PrinterForm {
  name: string;
  type: string;
  driver: string;
  path: string;
  columns: string;
}

const EMPTY: PrinterForm = { name: "", type: "Produção", driver: "Nenhum", path: "", columns: "48" };
const TIPOS   = ["Produção", "Caixa", "Delivery"] as const;
const DRIVERS = ["Nenhum", "Texto", "HTML", "Epson", "Daruma", "Elgin", "Tanca", "Goldentec"] as const;

const TYPE_COLORS: Record<string, string> = {
  Produção: "bg-blue-500/15 text-blue-700",
  Caixa:    "bg-emerald-500/15 text-emerald-700",
  Delivery: "bg-orange-500/15 text-orange-700",
};

type PrintLayout = "production" | "caixa" | "delivery" | "ficha";
const LAYOUT_TABS: { id: PrintLayout; label: string; hint: string }[] = [
  { id: "production", label: "Produção",         hint: "Cozinha / Bar" },
  { id: "caixa",      label: "Caixa",            hint: "Cupom não fiscal" },
  { id: "delivery",   label: "Delivery",         hint: "Resumo do pedido" },
  { id: "ficha",      label: "Ficha de Entrega", hint: "Motoboy / Expedição" },
];

function typeToDefaultLayout(type: string): PrintLayout {
  if (type === "Caixa")    return "caixa";
  if (type === "Delivery") return "delivery";
  return "production";
}

// ─── Agent helpers ───────────────────────────────────────────────
const AGENT_URL = "http://localhost:3989";

// True only for real network addresses (IP or hostname.with.dot).
// Windows printer names like "IMP-TERMICA" or "HP LaserJet Pro" return false.
function isNetworkPath(path: string): boolean {
  const t = path.trim();
  if (!t || t.startsWith("\\\\")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(t)) return true;   // IPv4
  if (/^[\w-]+(?:\.[\w-]+)+(?::\d+)?$/.test(t))       return true;   // hostname.dot
  return false;
}

// Converts a binary ESC/POS string to base64 (browser-safe, no Buffer needed).
function escposToBase64(binary: string): string {
  return btoa(Array.from(binary, c => String.fromCharCode(c.charCodeAt(0) & 0xff)).join(""));
}

// Sends ESC/POS bytes directly to the local Armazix Print Agent.
async function sendViaAgent(printerName: string, escposB64: string): Promise<void> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${AGENT_URL}/print`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ printer_name: printerName, escpos_b64: escposB64 }),
      signal:  ctrl.signal,
    });
    const data = await res.json() as { success?: boolean; error?: string };
    if (!data.success) throw new Error(data.error ?? "Impressora não respondeu");
  } finally {
    clearTimeout(timer);
  }
}

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 ${type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"}`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 pr-8 text-sm rounded-xl border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ─── Thermal Paper Preview ────────────────────────────────────────
function ThermalPreview({ lines, cols }: { lines: ThermalLine[]; cols: number }) {
  // Simulate the thermal paper: fixed-width container, monospace font, paper style
  const charW = 7.2; // px per character at ~12px Courier
  const paperPx = cols * charW;

  return (
    <div className="flex justify-center">
      <div
        className="bg-[#fafaf8] dark:bg-[#1a1a1a] rounded-lg shadow-inner border border-border/60 overflow-hidden"
        style={{ width: Math.min(paperPx + 32, 480), fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Sprocket holes top */}
        <div className="flex justify-between px-2 py-1 bg-[#f0ede4] dark:bg-[#111] border-b border-dashed border-border/40">
          {Array.from({ length: Math.floor(cols / 6) }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-border/50" />
          ))}
        </div>

        <div className="px-3 py-3 space-y-0 overflow-x-auto">
          {lines.map((line, i) => {
            if (line.separator) {
              return (
                <div key={i} className="text-muted-foreground/50 leading-snug text-xs select-none whitespace-pre">
                  {line.separator.repeat(cols)}
                </div>
              );
            }
            const txt = line.center
              ? line.text.padStart(Math.floor((cols + line.text.length) / 2)).padEnd(cols)
              : line.text;

            return (
              <div
                key={i}
                className={[
                  "leading-snug whitespace-pre overflow-hidden",
                  line.bold    ? "font-bold" : "font-normal",
                  line.doubleH ? "text-base" : "text-[11px]",
                  "text-foreground/90",
                ].join(" ")}
                style={{ fontFamily: "inherit", letterSpacing: "0.01em" }}
              >
                {txt || " "}
              </div>
            );
          })}
        </div>

        {/* Sprocket holes bottom */}
        <div className="flex justify-between px-2 py-1 bg-[#f0ede4] dark:bg-[#111] border-t border-dashed border-border/40">
          {Array.from({ length: Math.floor(cols / 6) }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-border/50" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Print Preview Modal ──────────────────────────────────────────
function PrintPreviewModal({
  open, onClose, printer,
}: {
  open: boolean;
  onClose: () => void;
  printer: PrinterRecord | null;
}) {
  const [activeLayout, setActiveLayout] = useState<PrintLayout>("production");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const cols = printer?.columns ?? 48;

  useEffect(() => {
    if (open && printer) {
      setActiveLayout(typeToDefaultLayout(printer.type));
      setSent(false);
      setSendError(null);
    }
  }, [open, printer]);

  const buildLines = useCallback((): ThermalLine[] => {
    switch (activeLayout) {
      case "production": return buildProductionTicket(SAMPLE_STORE, SAMPLE_ORDER, cols);
      case "caixa":      return buildCaixaCoupon(SAMPLE_STORE, SAMPLE_ORDER, cols);
      case "delivery":   return buildDeliveryTicket(SAMPLE_STORE, SAMPLE_ORDER, cols);
      case "ficha":      return buildFichaEntrega(SAMPLE_STORE, SAMPLE_ORDER, cols);
    }
  }, [activeLayout, cols]);

  const lines = buildLines();

  const handleSendToDevice = async () => {
    if (!printer) return;
    setSending(true);
    setSent(false);
    setSendError(null);
    try {
      if (isNetworkPath(printer.path ?? "")) {
        // ── IP / hostname real → servidor faz TCP ───────────────
        const res  = await api.post("/api/printers/print-test", {
          printerId: printer.id,
          layout:    activeLayout,
          send:      true,
        });
        const data = await res.json() as { sent?: boolean; error?: string };
        if (data.sent) setSent(true);
        else setSendError(data.error ?? "Impressão falhou");
      } else {
        // ── Nome de impressora Windows → agente local ───────────
        const escpos = linesToEscPos(lines, cols);
        const b64    = escposToBase64(escpos);
        await sendViaAgent(printer.path!, b64);
        setSent(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de conexão";
      const offline = msg.includes("fetch") || msg.includes("Failed") || msg.includes("abort");
      setSendError(offline
        ? "Agente não encontrado. Verifique se o Armazix Print Agent está ativo na bandeja."
        : msg);
    } finally {
      setSending(false);
    }
  };

  if (!printer) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Printer className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                Teste de Impressão
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {printer.name} · {printer.code} · {cols} colunas
              </p>
            </div>
            <span className={`shrink-0 mt-0.5 inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide ${TYPE_COLORS[printer.type] ?? "bg-secondary text-muted-foreground"}`}>
              {printer.type}
            </span>
          </div>
        </DialogHeader>

        {/* Layout tabs */}
        <div className="flex gap-0.5 px-6 pt-3 pb-0 border-b border-border/40 overflow-x-auto no-scrollbar shrink-0">
          {LAYOUT_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveLayout(tab.id)}
              className={[
                "flex flex-col items-start px-3 pb-2.5 pt-1.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px",
                activeLayout === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] opacity-60 font-normal">{tab.hint}</span>
            </button>
          ))}
        </div>

        {/* Paper preview */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ThermalPreview lines={lines} cols={cols} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 shrink-0">
          {sendError && (
            <p className="text-xs text-destructive mb-2 text-center">{sendError}</p>
          )}
          {sent && (
            <p className="text-xs text-emerald-600 mb-2 text-center flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Enviado para a impressora com sucesso!
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Fechar
            </button>
            <div className="flex items-center gap-2">
              {printer.path && (
                <Button
                  size="sm"
                  onClick={handleSendToDevice}
                  disabled={sending}
                  className="h-9 rounded-xl gap-1.5 text-xs bg-gradient-primary text-primary-foreground shadow-glow"
                >
                  {sending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                  Enviar p/ Impressora
                </Button>
              )}
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// URL do instalador — coloque ArmazixPrinter-Setup.exe em public/downloads/
// ou configure VITE_AGENT_DOWNLOAD_URL no .env
const AGENT_DOWNLOAD_URL: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_AGENT_DOWNLOAD_URL
  ?? "/downloads/ArmazixPrinter-Setup.exe";

// ─── Agent Status Banner ──────────────────────────────────────────
function AgentBanner() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res   = await fetch("http://localhost:3989/health", { signal: ctrl.signal });
      clearTimeout(timer);
      setStatus(res.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-border/50 bg-secondary/20">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Cpu className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">Armazix Print Agent</p>
          {status === "checking" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[11px]">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Verificando...
            </span>
          )}
          {status === "online" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Ativo · porta 3989
            </span>
          )}
          {status === "offline" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Não detectado
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {status === "online"
            ? "Agente rodando — clique no ícone 🔍 no formulário de impressora para selecionar impressoras do PC."
            : "Instale o agente para imprimir direto nas impressoras do computador sem precisar do IP de rede."}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status !== "checking" && (
          <button onClick={check} title="Verificar status"
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        <a href={AGENT_DOWNLOAD_URL} download="ArmazixPrinter-Setup.exe"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/70 bg-background text-xs font-medium hover:bg-secondary/60 transition-colors whitespace-nowrap">
          <Download className="w-3.5 h-3.5" /> Baixar Agente
        </a>
      </div>
    </div>
  );
}

// ─── Agent Printers Dialog ────────────────────────────────────────
type AgentStatus = "idle" | "loading" | "ok" | "not-found" | "error";

function AgentPrintersDialog({
  open, onClose, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}) {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [printers, setPrinters] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchFromAgent = useCallback(async () => {
    setStatus("loading");
    setPrinters([]);
    setErrorMsg("");
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res   = await fetch(`${AGENT_URL}/printers`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { printers?: string[] };
      setPrinters(data.printers ?? []);
      setStatus("ok");
    } catch (err: unknown) {
      const isNetwork =
        err instanceof TypeError ||
        (err instanceof DOMException && err.name === "AbortError");
      if (isNetwork) {
        setStatus("not-found");
      } else {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      }
    }
  }, []);

  useEffect(() => {
    if (open) fetchFromAgent();
  }, [open, fetchFromAgent]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden">

        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                Impressoras do PC
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Detectadas pelo Armazix Print Agent
              </p>
            </div>
            {status === "loading" && (
              <span className="mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary text-muted-foreground text-[11px] font-medium shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" /> Conectando...
              </span>
            )}
            {status === "ok" && (
              <span className="mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 text-[11px] font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Agente ativo
              </span>
            )}
            {(status === "not-found" || status === "error") && (
              <span className="mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-[11px] font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" /> Offline
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 min-h-[200px] flex flex-col">

          {/* Carregando */}
          {status === "loading" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin opacity-30" />
              <p className="text-sm">Consultando impressoras instaladas...</p>
            </div>
          )}

          {/* Agente não encontrado */}
          {status === "not-found" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                <Printer className="w-7 h-7 text-muted-foreground opacity-40" />
              </div>
              <div>
                <p className="text-sm font-semibold">Agente não encontrado</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
                  O <strong>Armazix Print Agent</strong> não está rodando neste computador.
                  Abra a pasta do agente e execute o <strong>start.bat</strong>, depois clique em tentar novamente.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchFromAgent}
                className="h-8 rounded-xl gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
            </div>
          )}

          {/* Erro genérico */}
          {status === "error" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm font-semibold text-destructive">Erro ao conectar</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={fetchFromAgent}
                className="h-8 rounded-xl gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
            </div>
          )}

          {/* Agente ativo, sem impressoras */}
          {status === "ok" && printers.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-2">
              <p className="text-sm font-semibold">Nenhuma impressora instalada</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                O agente está ativo, mas nenhuma impressora foi encontrada no Windows.
                Verifique em <em>Painel de Controle → Dispositivos e Impressoras</em>.
              </p>
              <Button variant="outline" size="sm" onClick={fetchFromAgent}
                className="h-8 rounded-xl gap-1.5 text-xs mt-1">
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar lista
              </Button>
            </div>
          )}

          {/* Lista de impressoras */}
          {status === "ok" && printers.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {printers.length} impressora{printers.length !== 1 ? "s" : ""} encontrada{printers.length !== 1 ? "s" : ""} — clique para selecionar:
              </p>
              <ul className="space-y-1.5 max-h-64 overflow-y-auto -mr-1 pr-1">
                {printers.map(name => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => { onSelect(name); onClose(); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-secondary/60 hover:border-primary/40 transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <Printer className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-sm font-medium truncate flex-1">{name}</span>
                      <Check className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary ml-auto shrink-0 transition-colors" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end pt-0.5">
                <button type="button" onClick={fetchFromAgent}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Atualizar
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="px-6 py-3 border-t border-border/50 flex justify-end">
          <button type="button" onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Fechar
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ─── Printer Form Modal ───────────────────────────────────────────
function PrinterFormModal({
  open, onClose, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (p: PrinterRecord, isNew: boolean) => void;
  editing: PrinterRecord | null;
}) {
  const [form, setForm] = useState<PrinterForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof PrinterForm, string>>>({});
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const isNew = !editing;
  const set = (k: keyof PrinterForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { name: editing.name, type: editing.type, driver: editing.driver, path: editing.path ?? "", columns: String(editing.columns ?? 48) }
        : EMPTY);
      setSaveError(null);
      setErrors({});
      setTestFeedback(null);
    }
  }, [open, editing]);

  const handleTestPrint = async () => {
    if (!form.path.trim()) {
      setTestFeedback({ ok: false, msg: "Informe o Caminho / IP antes de testar." });
      return;
    }
    setTesting(true);
    setTestFeedback(null);
    try {
      if (isNetworkPath(form.path)) {
        // ── IP / hostname real → servidor faz TCP ────────────────
        const res  = await api.post("/api/printers/test-raw", {
          path:    form.path.trim(),
          columns: parseInt(form.columns, 10) || 48,
          type:    form.type,
        });
        const data = await res.json() as { preview?: string; sent?: boolean; error?: string };
        if (data.sent) {
          setTestFeedback({ ok: true, msg: "Página de teste enviada com sucesso!" });
        } else {
          setTestFeedback({ ok: false, msg: data.error ?? "Impressora não respondeu. Verifique o endereço." });
        }
      } else {
        // ── Nome de impressora Windows → agente local ────────────
        const cols   = parseInt(form.columns, 10) || 48;
        const layout = typeToDefaultLayout(form.type);
        const linesMap = {
          production: () => buildProductionTicket(SAMPLE_STORE, SAMPLE_ORDER, cols),
          caixa:      () => buildCaixaCoupon(SAMPLE_STORE, SAMPLE_ORDER, cols),
          delivery:   () => buildDeliveryTicket(SAMPLE_STORE, SAMPLE_ORDER, cols),
          ficha:      () => buildFichaEntrega(SAMPLE_STORE, SAMPLE_ORDER, cols),
        };
        const lines  = linesMap[layout]();
        const escpos = linesToEscPos(lines, cols);
        const b64    = escposToBase64(escpos);
        await sendViaAgent(form.path.trim(), b64);
        setTestFeedback({ ok: true, msg: "Página de teste enviada com sucesso!" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      const offline = msg.includes("fetch") || msg.includes("Failed") || msg.includes("abort");
      setTestFeedback({
        ok: false,
        msg: offline
          ? "Agente Armazix Print não encontrado. Verifique se está ativo na bandeja do sistema."
          : msg,
      });
    } finally {
      setTesting(false);
      setTimeout(() => setTestFeedback(null), 6000);
    }
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Nome é obrigatório";
    if (!form.type)        e.type = "Tipo é obrigatório";
    if (!form.path.trim()) e.path = "Caminho é obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { name: form.name, type: form.type, driver: form.driver, path: form.path, columns: parseInt(form.columns, 10) || 48, ...(editing ? { printerId: editing.id } : {}) };
      const res  = await api.post(editing ? "/api/printers/update" : "/api/printers/create", payload);
      const data = await res.json() as { success?: boolean; printer?: PrinterRecord; error?: string };
      if (res.ok && data.printer) { onSaved(data.printer, isNew); onClose(); }
      else setSaveError(data.error ?? "Erro ao salvar impressora");
    } catch { setSaveError("Erro de conexão. Tente novamente."); }
    finally   { setSaving(false); }
  };


  return (<>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-xl p-0 overflow-hidden max-h-[90vh] flex flex-col">

        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold">
                {isNew ? "Nova Impressora" : "Editar Impressora"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isNew ? "Preencha os dados para cadastrar" : `Editando ${editing?.code}`}
              </p>
            </div>
            <span className={`shrink-0 mt-0.5 inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide uppercase ${isNew ? "bg-blue-500/10 text-blue-700" : "bg-amber-500/10 text-amber-700"}`}>
              {isNew ? "Inclusão" : "Edição"}
            </span>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Bloco 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Printer className="w-4 h-4 text-muted-foreground" /> Informações Gerais
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código">
                <Input value={editing?.code ?? "Auto"} disabled
                  className="h-10 rounded-xl bg-secondary/50 text-muted-foreground cursor-not-allowed" />
              </Field>
              <Field label="Nome" required>
                <Input autoFocus={isNew} placeholder="Ex: Cozinha 1, Caixa Principal"
                  value={form.name} onChange={e => set("name", e.target.value)}
                  className={`h-10 rounded-xl ${errors.name ? "border-destructive ring-1 ring-destructive" : ""}`} />
                {errors.name && <p className="text-xs text-destructive mt-0.5">{errors.name}</p>}
              </Field>
            </div>
          </div>

          {/* Bloco 2 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="w-4 h-4 text-muted-foreground" /> Configurações
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo" required>
                <SelectField value={form.type} onChange={v => set("type", v)} options={TIPOS} />
                {errors.type && <p className="text-xs text-destructive mt-0.5">{errors.type}</p>}
              </Field>
              <Field label="Driver">
                <SelectField value={form.driver} onChange={v => set("driver", v)} options={DRIVERS} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Caminho" required>
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input placeholder='\\SERVIDOR\Impressora ou 192.168.1.10'
                      value={form.path} onChange={e => set("path", e.target.value)}
                      className={`h-10 rounded-xl flex-1 ${errors.path ? "border-destructive ring-1 ring-destructive" : ""}`} />
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setAgentDialogOpen(true)}
                      title="Ver impressoras instaladas neste PC"
                      className="h-10 px-3 rounded-xl shrink-0">
                      <Search className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {errors.path && <p className="text-xs text-destructive">{errors.path}</p>}
                </div>
              </Field>
              <Field label="Colunas">
                <Input type="number" min={20} max={200} placeholder="48"
                  value={form.columns} onChange={e => set("columns", e.target.value)}
                  className="h-10 rounded-xl" />
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  80mm = 48 col · 58mm = 32 col
                </p>
              </Field>
            </div>

            {/* ── Botão de teste rápido ─────────────────────────────── */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={testing}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-xl border border-border/70 bg-secondary/40 text-sm text-muted-foreground font-medium hover:bg-secondary/70 hover:border-border hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  : <Zap className="w-3.5 h-3.5 shrink-0" />
                }
                {testing ? "Enviando teste…" : "Imprimir página de teste"}
              </button>

              {testFeedback && (
                <p className={`text-xs flex items-center gap-1.5 ${testFeedback.ok ? "text-emerald-600" : "text-destructive"}`}>
                  {testFeedback.ok
                    ? <Check className="w-3.5 h-3.5 shrink-0" />
                    : <X className="w-3.5 h-3.5 shrink-0" />
                  }
                  {testFeedback.msg}
                </p>
              )}
            </div>

          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/50 space-y-2">
          {saveError && <p className="text-xs text-destructive text-center">{saveError}</p>}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="h-10 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isNew ? "Cadastrar" : "Salvar alterações"}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>

    <AgentPrintersDialog
      open={agentDialogOpen}
      onClose={() => setAgentDialogOpen(false)}
      onSelect={name => set("path", name)}
    />
  </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
function PrintersPage() {
  const [printersList, setPrintersList] = useState<PrinterRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [formOpen, setFormOpen]     = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing]       = useState<PrinterRecord | null>(null);
  const [previewing, setPreviewing] = useState<PrinterRecord | null>(null);
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPrinters = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/printers/list");
      const data = await res.json() as { printers?: PrinterRecord[] };
      if (res.ok) setPrintersList(data.printers ?? []);
    } catch { showToast("Erro ao carregar impressoras", "error"); }
    finally   { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  const handleSaved = (p: PrinterRecord, isNew: boolean) => {
    setPrintersList(prev => isNew ? [p, ...prev] : prev.map(r => r.id === p.id ? p : r));
    showToast(isNew ? "Impressora cadastrada!" : "Impressora atualizada!", "success");
  };

  const openCreate  = () => { setEditing(null); setFormOpen(true); };
  const openEdit    = (p: PrinterRecord) => { setEditing(p); setFormOpen(true); };
  const openPreview = (p: PrinterRecord) => { setPreviewing(p); setPreviewOpen(true); };

  const handleDelete = async (p: PrinterRecord) => {
    if (!confirm(`Excluir a impressora "${p.name}"?`)) return;
    setDeleting(p.id);
    try {
      const res = await api.post("/api/printers/delete", { printerId: p.id });
      if (res.ok) { setPrintersList(prev => prev.filter(r => r.id !== p.id)); showToast("Impressora excluída", "success"); }
      else showToast("Erro ao excluir", "error");
    } catch { showToast("Erro de conexão", "error"); }
    finally   { setDeleting(null); }
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-secondary rounded-xl animate-pulse" />
            <div className="h-4 w-24 bg-secondary rounded-xl animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-secondary rounded-xl animate-pulse" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-secondary rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Armazix Print Agent — status e download */}
      <AgentBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Printer className="w-6 h-6 text-muted-foreground" /> Impressoras
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {printersList.length} impressora{printersList.length !== 1 ? "s" : ""} cadastrada{printersList.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-9" onClick={fetchPrinters}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={openCreate}
            className="h-9 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow gap-2">
            <Plus className="w-4 h-4" /> Nova Impressora
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {printersList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Printer className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Nenhuma impressora cadastrada</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Cadastre impressoras térmicas para automação de pedidos na cozinha, caixa e delivery
          </p>
          <Button onClick={openCreate} className="mt-5 h-9 rounded-xl bg-gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Cadastrar primeira impressora
          </Button>
        </div>
      ) : (
        <div className="space-y-2">

          {/* Column labels — desktop */}
          <div className="hidden sm:grid grid-cols-[80px_1fr_100px_120px_1fr_80px_44px] gap-4 px-4 py-2">
            {["Código", "Nome", "Tipo", "Driver", "Caminho", "Colunas", ""].map((h, i) => (
              <span key={i} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</span>
            ))}
          </div>

          {printersList.map(p => (
            <Card key={p.id}
              className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-all cursor-pointer group"
              onClick={() => openEdit(p)}>
              <CardContent className="p-4">

                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[80px_1fr_100px_120px_1fr_80px_44px] gap-4 items-center">
                  <span className="text-xs font-mono font-semibold text-muted-foreground">{p.code}</span>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Printer className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-semibold truncate">{p.name}</span>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold w-fit ${TYPE_COLORS[p.type] ?? "bg-secondary text-muted-foreground"}`}>
                    {p.type}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{p.driver}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono truncate">{p.path ?? "—"}</span>
                  <span className="text-xs text-muted-foreground text-center">{p.columns ?? 48} col</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon"
                        className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openPreview(p); }} className="gap-2 rounded-lg">
                        <Zap className="w-3.5 h-3.5 text-amber-500" /> Testar Impressão
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(p); }} className="gap-2 rounded-lg">
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={e => { e.stopPropagation(); handleDelete(p); }}
                        disabled={deleting === p.id}
                        className="gap-2 rounded-lg text-destructive focus:text-destructive">
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile card */}
                <div className="sm:hidden flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Printer className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">{p.code}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${TYPE_COLORS[p.type] ?? "bg-secondary text-muted-foreground"}`}>
                          {p.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                        {p.path ?? "—"} · {p.columns ?? 48} col
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openPreview(p); }} className="gap-2 rounded-lg">
                        <Zap className="w-3.5 h-3.5 text-amber-500" /> Testar Impressão
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(p); }} className="gap-2 rounded-lg">
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete(p); }}
                        disabled={deleting === p.id}
                        className="gap-2 rounded-lg text-destructive focus:text-destructive">
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <PrinterFormModal
        open={formOpen} onClose={() => setFormOpen(false)}
        onSaved={handleSaved} editing={editing}
      />
      <PrintPreviewModal
        open={previewOpen} onClose={() => setPreviewOpen(false)}
        printer={previewing}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
