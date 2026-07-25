import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Filter, Clock, ChefHat, Truck, CheckCircle2, XCircle,
  Loader2, Package, ShoppingBag, QrCode, Banknote, CreditCard,
  MapPin, User, Printer, Check, X, Zap, Settings, RotateCcw, ChevronDown,
  ArrowRight, Bike,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const PrintOrderDialog = lazy(() => import("./-modal-imprimir-pedido"));

export const Route = createFileRoute("/admin/pedidos")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Pedidos — ARMAZIX" }] }),
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrderCustomer { id: string; name: string | null; phone?: string | null }
interface OrderItem { id: string; productName: string; quantity: number; unitPrice: string; total: string }
interface RawOrder {
  id: string; number: number; status: string; type: string;
  paymentMethod: string | null; total: string; date?: string;
  customer: OrderCustomer | null; items: OrderItem[];
  addressSnapshot: { street?: string; number?: string; neighborhood?: string } | null;
}
interface Order {
  orderId: string; number: number; customer: string;
  items: string[]; total: string; payment: string; status: string;
  rawDate: string; address: string; type: string;
}

// ── Kanban columns ────────────────────────────────────────────────────────────
interface ColumnConfig {
  id: string;
  label: string;
  statuses: string[];
  accent: string;
  bg: string;
  border: string;
  dot: string;
  headerBg: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "analise",
    label: "Em análise",
    statuses: ["pending", "received"],
    accent: "text-amber-600",
    bg: "bg-amber-500/8 dark:bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
    headerBg: "bg-amber-500/10",
  },
  {
    id: "preparando",
    label: "Preparando",
    statuses: ["preparing"],
    accent: "text-orange-600",
    bg: "bg-orange-500/8 dark:bg-orange-500/10",
    border: "border-orange-500/20",
    dot: "bg-orange-500",
    headerBg: "bg-orange-500/10",
  },
  {
    id: "entrega",
    label: "Entrega",
    statuses: ["ready", "delivering"],
    accent: "text-purple-600",
    bg: "bg-purple-500/8 dark:bg-purple-500/10",
    border: "border-purple-500/20",
    dot: "bg-purple-500",
    headerBg: "bg-purple-500/10",
  },
];

const COLUMN_DELIVERED: ColumnConfig = {
  id: "concluidos",
  label: "Concluídos",
  statuses: ["delivered"],
  accent: "text-green-600",
  bg: "bg-green-500/8 dark:bg-green-500/10",
  border: "border-green-500/20",
  dot: "bg-green-500",
  headerBg: "bg-green-500/10",
};

const COLUMN_CANCELLED: ColumnConfig = {
  id: "cancelados",
  label: "Cancelados",
  statuses: ["cancelled"],
  accent: "text-destructive",
  bg: "bg-destructive/5 dark:bg-destructive/8",
  border: "border-destructive/20",
  dot: "bg-destructive",
  headerBg: "bg-destructive/8",
};

// As 3 colunas do fluxo (análise/preparando/entrega) devem ocupar 100% da
// largura; só "encolhem" para dar espaço quando Concluídos e/ou Cancelados
// são ativados nos filtros e entram no grid.
const KANBAN_GRID_COLS: Record<number, string> = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
};

// ── Status display ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:    { label: "Aguardando", color: "text-amber-600" },
  received:   { label: "Novo",       color: "text-blue-600" },
  preparing:  { label: "Cozinha",    color: "text-orange-600" },
  ready:      { label: "Pronto",     color: "text-emerald-600" },
  delivering: { label: "Em entrega", color: "text-purple-600" },
  delivered:  { label: "Concluído",  color: "text-green-600" },
  cancelled:  { label: "Cancelado",  color: "text-destructive" },
};

// ── Payment icons/labels ───────────────────────────────────────────────────────
const PAY_ICON: Record<string, React.ElementType> = {
  pix: QrCode, cash: Banknote, card: CreditCard, debit: CreditCard,
};
const PAY_LABEL: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Crédito", debit: "Débito",
};

// ── Next action per status ────────────────────────────────────────────────────
const NEXT_ACTION: Record<string, { label: string; next: string; icon: React.ElementType }> = {
  pending:    { label: "Aceitar",           next: "received",   icon: CheckCircle2 },
  received:   { label: "Avançar",           next: "preparing",  icon: ArrowRight },
  preparing:  { label: "Pronto",            next: "ready",      icon: CheckCircle2 },
  ready:      { label: "Enviar",            next: "delivering", icon: Truck },
  delivering: { label: "Confirmar Entrega", next: "delivered",  icon: CheckCircle2 },
};

// ── Filter state ──────────────────────────────────────────────────────────────
interface FilterState {
  showDelivered: boolean;
  showCancelled: boolean;
  type: "all" | "delivery" | "pickup";
  payment: "all" | "pix" | "cash" | "card" | "debit";
  dateFrom: string;
  dateTo: string;
}
const DEFAULT_FILTERS: FilterState = {
  showDelivered: false, showCancelled: false,
  type: "all", payment: "all", dateFrom: "", dateTo: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function fmtTime(iso: string) {
  const d = parseDate(iso);
  if (!d) return "";
  try { return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function fmtDate(iso: string) {
  const d = parseDate(iso);
  if (!d) return "";
  try {
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoje";
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

// ── Print agent utilities (mirrors printers.tsx) ─────────────────────────────
const AGENT_URL = "http://localhost:3989";

export function isNetworkPath(path: string): boolean {
  const t = path.trim();
  if (!t || t.startsWith("\\\\")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(t)) return true;
  if (/^[\w-]+(?:\.[\w-]+)+(?::\d+)?$/.test(t)) return true;
  return false;
}

export async function sendViaAgent(printerName: string, escposB64: string): Promise<void> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res  = await fetch(`${AGENT_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printer_name: printerName, escpos_b64: escposB64 }),
      signal: ctrl.signal,
    });
    const data = await res.json() as { success?: boolean; error?: string };
    if (!data.success) throw new Error(data.error ?? "Impressora não respondeu");
  } finally {
    clearTimeout(timer);
  }
}

// ── Auto-print helpers ────────────────────────────────────────────────────────
function printViaIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
}

function buildPrintHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;line-height:1.5;width:40ch;padding:8px;background:#fff;color:#000}pre{white-space:pre-wrap}@media print{@page{margin:4mm;size:58mm auto}body{width:100%}}</style>
    </head><body><pre>${esc}</pre></body></html>`;
}

function buildBrowserText(order: Order, layout: "production" | "ficha"): string {
  const sep = "=".repeat(36);
  const lin = "-".repeat(36);
  if (layout === "production") {
    return [
      sep, `  COMANDA DE PRODUCAO  #${order.number}`, sep,
      `Cliente : ${order.customer}`,
      `Tipo    : ${order.type === "pickup" ? "Retirada no local" : "Delivery"}`,
      `Horario : ${fmtDate(order.rawDate)} ${fmtTime(order.rawDate)}`,
      lin, `ITENS:`, ...order.items.map(i => `  ${i}`), lin,
      `TOTAL: ${order.total}`, sep,
    ].join("\n");
  }
  return [
    sep, `  FICHA DE ENTREGA  #${order.number}`, sep,
    `Cliente   : ${order.customer}`,
    ...(order.address && order.type !== "pickup" ? [`Endereco  : ${order.address}`] : []),
    lin, `ITENS:`, ...order.items.map(i => `  ${i}`), lin,
    `TOTAL     : ${order.total}`,
    `Pagamento : ${PAY_LABEL[order.payment] ?? order.payment}`,
    sep,
  ].join("\n");
}

// `onFallback` avisa a UI sempre que a impressão automática não sai direto
// pela impressora configurada e cai para o preview do navegador — sem isso,
// uma impressora de rede offline (ou o agente local fechado) falhava
// completamente em silêncio, sem imprimir nada e sem qualquer aviso.
async function autoPrint(order: Order, layout: "production" | "ficha", onFallback?: (reason: string) => void): Promise<void> {
  try {
    const listData = await fetch("/api/printers/list").then(r => r.json()) as { printers?: PrinterRecord[] };
    const printer  = listData.printers?.[0];

    if (!printer) {
      onFallback?.("Nenhuma impressora cadastrada — abrindo impressão no navegador");
      printViaIframe(buildPrintHtml(buildBrowserText(order, layout)));
      return;
    }

    const res  = await api.post("/api/printers/print-order", {
      printerId: printer.id,
      orderId:   order.orderId,
      layout,
      send:      isNetworkPath(printer.path ?? ""),
    });
    const data = await res.json() as { sent?: boolean; escposB64?: string; error?: string };

    if (data.sent) return;

    if (!isNetworkPath(printer.path ?? "") && data.escposB64) {
      await sendViaAgent(printer.path!, data.escposB64);
      return;
    }

    // Impressora de rede configurada mas o envio TCP falhou (offline/IP
    // errado) — ou nenhuma via de envio disponível. Sem este fallback o
    // pedido não imprimia nada e não avisava ninguém.
    onFallback?.(data.error || "Não foi possível enviar para a impressora — abrindo impressão no navegador");
    printViaIframe(buildPrintHtml(buildBrowserText(order, layout)));
  } catch {
    onFallback?.("Agente de impressão não encontrado — abrindo impressão no navegador");
    printViaIframe(buildPrintHtml(buildBrowserText(order, layout)));
  }
}

function imprimirComandaProducao(order: Order, onFallback?: (reason: string) => void) {
  autoPrint(order, "production", onFallback).catch(() => {});
}
function imprimirFichaEntrega(order: Order, onFallback?: (reason: string) => void) {
  autoPrint(order, "ficha", onFallback).catch(() => {});
}

// ─── Toast (mesmo padrão usado nas demais páginas admin) ────────────────────
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

export interface PrinterRecord { id: string; name: string; code: string; type: string; path: string | null; columns: number | null; }

// ── OrderCard ─────────────────────────────────────────────────────────────────
const PAY_OPTIONS = [
  { value: "pix",   label: "PIX" },
  { value: "card",  label: "Cartão Crédito" },
  { value: "debit", label: "Cartão Débito" },
  { value: "cash",  label: "Dinheiro" },
] as const;

function OrderCard({
  order, onAdvance, onCancel, onPrint, onPrintFallback, isAdvancing, hasPdv,
}: {
  order: Order;
  onAdvance: (id: string, next: string, paymentMethod?: string) => void;
  onCancel: (id: string) => void;
  onPrint: (id: string) => void;
  onPrintFallback: (msg: string, type: "success" | "error") => void;
  isAdvancing: boolean;
  hasPdv: boolean;
}) {
  const [reprintOpen, setReprintOpen] = useState(false);
  const reprintRef = useRef<HTMLDivElement>(null);
  const [paymentOverride, setPaymentOverride] = useState(order.payment || "pix");

  useEffect(() => {
    if (!reprintOpen) return;
    const handler = (e: MouseEvent) => {
      if (reprintRef.current && !reprintRef.current.contains(e.target as Node)) {
        setReprintOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [reprintOpen]);

  const action = order.status === "ready" && order.type === "pickup"
    ? { label: "Retirado", next: "delivered", icon: CheckCircle2 }
    : order.status === "received" && order.type !== "pickup"
    ? { ...NEXT_ACTION.received, icon: Bike }
    : NEXT_ACTION[order.status];

  const isFinalAction = action?.next === "delivered";

  const sCfg = STATUS_CFG[order.status];
  const PayIcon = PAY_ICON[order.payment] ?? Banknote;
  const canCancel = !["delivered", "cancelled"].includes(order.status);

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all duration-150 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">#{order.number}</span>
          {sCfg && (
            <span className={`text-[10px] font-semibold ${sCfg.color}`}>{sCfg.label}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{fmtDate(order.rawDate)}</span>
          <span>{fmtTime(order.rawDate)}</span>
        </div>
      </div>

      {/* Customer */}
      <div className="flex items-center gap-1.5">
        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate leading-tight">{order.customer}</span>
      </div>

      {/* Items */}
      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
        {order.items.join(" • ")}
      </p>

      {/* Badges: type + payment */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="outline"
          className={`text-[10px] font-medium rounded-full px-2 py-0 h-5 gap-1 border ${
            order.type === "pickup"
              ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/8"
              : "border-blue-500/30 text-blue-600 bg-blue-500/8"
          }`}
        >
          {order.type === "pickup"
            ? <Package className="w-2.5 h-2.5" />
            : <Truck className="w-2.5 h-2.5" />
          }
          {order.type === "pickup" ? "Retirada" : "Entrega"}
        </Badge>
        {order.payment && (
          <Badge
            variant="outline"
            className="text-[10px] font-medium rounded-full px-2 py-0 h-5 gap-1 border-border/50 text-muted-foreground"
          >
            <PayIcon className="w-2.5 h-2.5" />
            {PAY_LABEL[order.payment] ?? order.payment}
          </Badge>
        )}
      </div>

      {/* Address (delivery only) */}
      {order.type === "delivery" && order.address && (
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-[11px] text-muted-foreground truncate leading-tight">{order.address}</span>
        </div>
      )}

      {/* Seletor de pagamento — somente para lojas sem PDV e pedidos não finalizados */}
      {!hasPdv && !["delivered", "cancelled"].includes(order.status) && (
        <div className="flex items-center gap-2 pt-1 border-t border-dashed border-border/40">
          <span className="text-[10px] font-medium text-muted-foreground shrink-0">Recebimento:</span>
          <div className="relative flex-1">
            <select
              value={paymentOverride}
              onChange={e => setPaymentOverride(e.target.value)}
              className="w-full h-6 rounded-lg border border-border/50 bg-secondary/20 text-[11px] font-medium pl-2 pr-6 appearance-none cursor-pointer focus:outline-none focus:border-primary/50 text-foreground"
            >
              {PAY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 pointer-events-none text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <span className="text-sm font-bold">{order.total}</span>
        <div className="flex items-center gap-1.5">
          {/* Reimprimir dropdown */}
          <div className="relative" ref={reprintRef}>
            <button
              onClick={() => setReprintOpen(v => !v)}
              title="Reimprimir"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/60"
            >
              <Printer className="w-3.5 h-3.5" />
              <RotateCcw className="w-2.5 h-2.5 opacity-60" />
            </button>
            {reprintOpen && (
              <div className="absolute bottom-full right-0 mb-1.5 z-50 min-w-[180px] bg-popover border border-border/60 rounded-xl shadow-lg overflow-hidden">
                <button
                  onClick={() => { imprimirComandaProducao(order, msg => onPrintFallback(msg, "error")); setReprintOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium hover:bg-secondary/60 transition-colors text-left"
                >
                  <ChefHat className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  Reimprimir Produção
                </button>
                <div className="h-px bg-border/40" />
                <button
                  onClick={() => { imprimirFichaEntrega(order, msg => onPrintFallback(msg, "error")); setReprintOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium hover:bg-secondary/60 transition-colors text-left"
                >
                  <Truck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  Reimprimir Expedição
                </button>
                <div className="h-px bg-border/40" />
                <button
                  onClick={() => { onPrint(order.orderId); setReprintOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-muted-foreground hover:bg-secondary/60 transition-colors text-left"
                >
                  <Settings className="w-3.5 h-3.5 shrink-0" />
                  Impressão avançada...
                </button>
              </div>
            )}
          </div>

          {canCancel && (
            <button
              onClick={() => onCancel(order.orderId)}
              disabled={isAdvancing}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/8 disabled:opacity-40"
            >
              <XCircle className="w-3 h-3" />
            </button>
          )}
          {action && (
            <button
              disabled={isAdvancing}
              onClick={() => onAdvance(
                order.orderId,
                action.next,
                (!hasPdv && isFinalAction) ? paymentOverride : undefined,
              )}
              className={[
                "flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50",
                !hasPdv && isFinalAction
                  ? "bg-emerald-600 text-white"
                  : "bg-primary text-primary-foreground",
              ].join(" ")}
            >
              {isAdvancing
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <action.icon className="w-3 h-3" />
              }
              {!hasPdv && isFinalAction ? "Concluir e Lançar" : action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────
function KanbanColumn({
  column, orders, onAdvance, onCancel, onPrint, onPrintFallback, advancing, autoAccepting, hasPdv,
}: {
  column: ColumnConfig;
  orders: Order[];
  onAdvance: (id: string, next: string, paymentMethod?: string) => void;
  onCancel: (id: string) => void;
  onPrint: (id: string) => void;
  onPrintFallback: (msg: string, type: "success" | "error") => void;
  advancing: string | null;
  autoAccepting: Set<string>;
  hasPdv: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border ${column.border} overflow-hidden`}>
      {/* Column header */}
      <div className={`flex items-center justify-between px-4 py-3 ${column.headerBg} border-b ${column.border}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${column.dot}`} />
          <span className={`text-sm font-semibold ${column.accent}`}>{column.label}</span>
        </div>
        <span className={`text-xs font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center ${
          orders.length > 0
            ? `${column.dot} text-white`
            : "bg-border/60 text-muted-foreground"
        }`}>
          {orders.length}
        </span>
      </div>

      {/* Cards scrollable area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[60vh] lg:max-h-[calc(100vh-220px)]">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center select-none">
            <ShoppingBag className="w-8 h-8 text-muted-foreground/25 mb-2" />
            <p className="text-xs text-muted-foreground/50">Nenhum pedido aqui</p>
          </div>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.orderId}
              order={order}
              onAdvance={onAdvance}
              onCancel={onCancel}
              onPrint={onPrint}
              onPrintFallback={onPrintFallback}
              isAdvancing={advancing === order.orderId || autoAccepting.has(order.orderId)}
              hasPdv={hasPdv}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [hasOpenedPrint, setHasOpenedPrint] = useState(false);
  const [hasPdv, setHasPdv] = useState(true);
  const storeIdRef = useRef<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Detecta se a loja tem PDV com base no plano
  useEffect(() => {
    api.get("/api/store/user")
      .then(r => r.json())
      .then((d: { store?: { plan?: string } }) => {
        const plan = d.store?.plan ?? "free";
        setHasPdv(plan === "full");
      })
      .catch(() => {});
  }, []);

  // ── Config de impressão ──────────────────────────────────────────────────────
  const [printCfgOpen, setPrintCfgOpen] = useState(false);
  const [printCfg, setPrintCfg] = useState(() => ({
    producao:  typeof window !== "undefined" ? localStorage.getItem("armazix:printProducao")  !== "false" : true,
    expedicao: typeof window !== "undefined" ? localStorage.getItem("armazix:printExpedicao") !== "false" : true,
  }));

  const togglePrintCfg = (key: "producao" | "expedicao") => {
    setPrintCfg(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`armazix:print${key === "producao" ? "Producao" : "Expedicao"}`, String(next[key]));
      return next;
    });
  };

  // Config de impressão lida sem stale closure dentro do polling silencioso.
  const printCfgRef = useRef(printCfg);
  useEffect(() => { printCfgRef.current = printCfg; }, [printCfg]);

  // ── Aceite automático ────────────────────────────────────────────────────────
  const [autoAccept, setAutoAccept] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("armazix:autoAccept") === "true"
  );
  const autoAcceptRef = useRef(autoAccept);
  useEffect(() => { autoAcceptRef.current = autoAccept; }, [autoAccept]);

  const seenOrderIds = useRef(new Set<string>());

  // Pedidos sendo aceitos automaticamente no momento — usado para desabilitar
  // o botão manual do card enquanto isso e evitar disparar o avanço/impressão
  // em duplicidade se o operador clicar "Preparar" no mesmo instante.
  const [autoAccepting, setAutoAccepting] = useState<Set<string>>(new Set());

  const toggleAutoAccept = () => {
    setAutoAccept(prev => {
      const next = !prev;
      localStorage.setItem("armazix:autoAccept", String(next));
      return next;
    });
  };

  // Avança silenciosamente pending/received → preparing e, se a "Impressão
  // automática" (Comanda de Produção) estiver ativa, dispara a impressão em
  // seguida — mesmo comportamento do aceite manual (handleAdvance), só que
  // sem exigir clique do operador. Falhas agora aparecem como toast — antes
  // eram engolidas em silêncio, dando a impressão de que o recurso não fazia nada.
  const advanceToPreparingQuiet = useCallback(async (order: Order) => {
    setAutoAccepting(prev => new Set(prev).add(order.orderId));
    try {
      const res = await api.post("/api/orders/update-status", { orderId: order.orderId, status: "preparing" });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.orderId === order.orderId ? { ...o, status: "preparing" } : o));
        showToast(`Pedido #${order.number} aceito automaticamente`, "success");
        if (printCfgRef.current.producao) imprimirComandaProducao(order, msg => showToast(msg, "error"));
      } else {
        showToast(`Aceite automático falhou no pedido #${order.number}`, "error");
      }
    } catch {
      showToast(`Erro de conexão no aceite automático do pedido #${order.number}`, "error");
    } finally {
      setAutoAccepting(prev => {
        const next = new Set(prev);
        next.delete(order.orderId);
        return next;
      });
    }
  }, [showToast]);

  // ── Normalização ─────────────────────────────────────────────────────────────
  const normalize = useCallback((o: RawOrder): Order => ({
    orderId: o.id,
    number: o.number,
    customer: o.customer?.name || "Cliente não identificado",
    items: (o.items || []).map(i => `${i.quantity}x ${i.productName}`),
    total: `R$ ${parseFloat(o.total).toFixed(2).replace(".", ",")}`,
    payment: o.paymentMethod || "",
    status: o.status,
    rawDate: o.date || "",
    address: o.addressSnapshot
      ? `${o.addressSnapshot.street || ""}, ${o.addressSnapshot.number || ""} — ${o.addressSnapshot.neighborhood || ""}`.replace(/^,\s*—\s*$/, "")
      : o.type === "pickup" ? "Retirada no local" : "",
    type: o.type,
  }), []);

  const fetchOrders = useCallback(async (storeId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/orders/list?storeId=${storeId}`);
      const data = await res.json() as { orders?: RawOrder[] };
      if (res.ok) {
        const mapped = (data.orders || []).map(normalize);

        // Aceite automático: avança novos pedidos pending/received para preparando
        if (silent && autoAcceptRef.current) {
          for (const order of mapped) {
            if (!seenOrderIds.current.has(order.orderId) && ["pending", "received"].includes(order.status)) {
              advanceToPreparingQuiet(order);
            }
          }
        }
        mapped.forEach(o => seenOrderIds.current.add(o.orderId));
        setOrders(mapped);
      }
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [normalize, advanceToPreparingQuiet]);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) { setLoading(false); return; }
    storeIdRef.current = storeId;
    fetchOrders(storeId);
    // Poll every 30 seconds for new orders
    const interval = setInterval(() => fetchOrders(storeId, true), 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleAdvance = async (orderId: string, nextStatus: string, paymentMethod?: string) => {
    const order = orders.find(o => o.orderId === orderId);
    setAdvancing(orderId);
    try {
      const payload: Record<string, string> = { orderId, status: nextStatus };
      if (paymentMethod) payload.paymentMethod = paymentMethod;
      const res = await api.post("/api/orders/update-status", payload);
      if (res.ok) {
        setOrders(prev => prev.map(o =>
          o.orderId === orderId
            ? { ...o, status: nextStatus, ...(paymentMethod && { payment: paymentMethod }) }
            : o
        ));
        if (order) {
          if (nextStatus === "preparing" && printCfg.producao) imprimirComandaProducao(order, msg => showToast(msg, "error"));
          if (nextStatus === "delivering" && printCfg.expedicao) imprimirFichaEntrega(order, msg => showToast(msg, "error"));
        }
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        showToast(data.error || "Não foi possível avançar o pedido", "error");
      }
    } catch {
      showToast("Erro de conexão ao avançar o pedido", "error");
    }
    finally { setAdvancing(null); }
  };

  const handleCancel = async (orderId: string) => {
    setAdvancing(orderId);
    try {
      const res = await api.post("/api/orders/update-status", { orderId, status: "cancelled" });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: "cancelled" } : o));
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        showToast(data.error || "Não foi possível cancelar o pedido", "error");
      }
    } catch {
      showToast("Erro de conexão ao cancelar o pedido", "error");
    }
    finally { setAdvancing(null); }
  };

  // ── Filter + search ──────────────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = o.customer.toLowerCase().includes(q);
      const matchNum = String(o.number).includes(q);
      if (!matchName && !matchNum) return false;
    }
    if (o.status === "delivered" && !filters.showDelivered) return false;
    if (o.status === "cancelled" && !filters.showCancelled) return false;
    if (filters.type !== "all" && o.type !== filters.type) return false;
    if (filters.payment !== "all" && o.payment !== filters.payment) return false;
    if (filters.dateFrom || filters.dateTo) {
      const d = new Date(o.rawDate);
      if (isNaN(d.getTime())) return true;
      if (filters.dateFrom && d < new Date(filters.dateFrom + "T00:00:00")) return false;
      if (filters.dateTo && d > new Date(filters.dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  // Distribute into columns, oldest first so new orders appear on top
  const colOrders = (statuses: string[]) =>
    filtered
      .filter(o => statuses.includes(o.status))
      .sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

  const visibleColumns = [
    ...COLUMNS,
    ...(filters.showDelivered ? [COLUMN_DELIVERED] : []),
    ...(filters.showCancelled ? [COLUMN_CANCELLED] : []),
  ];
  const kanbanGridCols = KANBAN_GRID_COLS[visibleColumns.length] ?? KANBAN_GRID_COLS[3];

  const activeFiltersCount = [
    filters.showDelivered, filters.showCancelled,
    filters.type !== "all", filters.payment !== "all",
    !!filters.dateFrom, !!filters.dateTo,
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Acompanhe em tempo real</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Aceite automático — toggle estilo iOS */}
          <div
            title={autoAccept ? "Aceite automático ativado" : "Aceite automático desativado"}
            className={[
              "flex items-center gap-2 h-10 pl-3 pr-2.5 rounded-xl border transition-all",
              autoAccept
                ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
                : "border-border/60 bg-secondary/30",
            ].join(" ")}
          >
            <Zap className={`w-3.5 h-3.5 ${autoAccept ? "text-emerald-600 fill-emerald-500" : "text-muted-foreground"}`} />
            <span className={`hidden sm:inline text-xs font-semibold ${autoAccept ? "text-emerald-700" : "text-muted-foreground"}`}>
              Aceite automático
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoAccept}
              aria-label="Aceite automático"
              onClick={toggleAutoAccept}
              className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                autoAccept ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                autoAccept ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Nome ou #número..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl w-52 sm:w-64"
            />
          </div>

          {/* Print config popover */}
          <Popover open={printCfgOpen} onOpenChange={setPrintCfgOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                title="Configurar Impressão"
                className={[
                  "h-10 rounded-xl gap-1.5 shrink-0 relative",
                  (printCfg.producao || printCfg.expedicao)
                    ? "border-primary/40 text-primary bg-primary/5"
                    : "",
                ].join(" ")}
              >
                <Printer className="w-3.5 h-3.5" />
                <Settings className="w-3 h-3 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-2xl shadow-lg p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Printer className="w-4 h-4 text-muted-foreground" />
                  Configurar Impressão
                </p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Comanda de Produção</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Imprime ao avançar para Preparando — inclusive pelo Aceite automático
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={printCfg.producao}
                    onClick={() => togglePrintCfg("producao")}
                    className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                      printCfg.producao ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      printCfg.producao ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Comanda de Expedição</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Imprime ao avançar para Em Entrega</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={printCfg.expedicao}
                    onClick={() => togglePrintCfg("expedicao")}
                    className={`w-11 h-6 rounded-full transition-colors duration-200 relative shrink-0 ${
                      printCfg.expedicao ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      printCfg.expedicao ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Filter popover */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-xl gap-1.5 relative shrink-0">
                <Filter className="w-3.5 h-3.5" />
                Filtrar
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-72 rounded-2xl shadow-lg p-0 overflow-hidden">
              {/* Popover header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <p className="text-sm font-semibold">Filtros avançados</p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar tudo
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Archived */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Arquivados</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="f-delivered"
                      checked={filters.showDelivered}
                      onCheckedChange={v => setFilters(f => ({ ...f, showDelivered: !!v }))}
                    />
                    <Label htmlFor="f-delivered" className="text-sm cursor-pointer">Mostrar Concluídos</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="f-cancelled"
                      checked={filters.showCancelled}
                      onCheckedChange={v => setFilters(f => ({ ...f, showCancelled: !!v }))}
                    />
                    <Label htmlFor="f-cancelled" className="text-sm cursor-pointer">Mostrar Cancelados</Label>
                  </div>
                </div>

                <Separator />

                {/* Date range */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Período</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">De</Label>
                      <Input
                        type="date"
                        className="h-8 rounded-lg text-xs"
                        value={filters.dateFrom}
                        onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Até</Label>
                      <Input
                        type="date"
                        className="h-8 rounded-lg text-xs"
                        value={filters.dateTo}
                        onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Type */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Tipo de pedido</p>
                  <div className="flex gap-1.5">
                    {(["all", "delivery", "pickup"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setFilters(f => ({ ...f, type: t }))}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                          filters.type === t
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {t === "all" ? "Todos" : t === "delivery" ? "Entrega" : "Retirada"}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Payment */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Pagamento</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["all", "pix", "cash", "card", "debit"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setFilters(f => ({ ...f, payment: p }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                          filters.payment === p
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {p === "all" ? "Todos" : PAY_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <Button
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={() => setFilterOpen(false)}
                >
                  Aplicar filtros
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Kanban ──────────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 ${kanbanGridCols} gap-4`}>
        {visibleColumns.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            orders={colOrders(col.statuses)}
            onAdvance={handleAdvance}
            onCancel={handleCancel}
            onPrint={id => { setPrintOrderId(id); setHasOpenedPrint(true); }}
            onPrintFallback={showToast}
            advancing={advancing}
            autoAccepting={autoAccepting}
            hasPdv={hasPdv}
          />
        ))}
      </div>

      {/* ── Print dialog ────────────────────────────────────────────────────── */}
      {hasOpenedPrint && (
        <Suspense fallback={null}>
          <PrintOrderDialog
            orderId={printOrderId}
            onClose={() => setPrintOrderId(null)}
          />
        </Suspense>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}

    </div>
  );
}
