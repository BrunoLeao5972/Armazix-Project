import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Filter, Clock, ChefHat, Truck, CheckCircle2, XCircle,
  Loader2, Package, ShoppingBag, QrCode, Banknote, CreditCard,
  MapPin, User, Printer, Send, Eye, Check,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/orders")({
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
const COLUMNS = [
  {
    id: "analise",
    label: "Em análise",
    statuses: ["pending", "received"] as string[],
    accent: "text-amber-600",
    bg: "bg-amber-500/8 dark:bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
    headerBg: "bg-amber-500/10",
  },
  {
    id: "preparando",
    label: "Preparando",
    statuses: ["preparing"] as string[],
    accent: "text-orange-600",
    bg: "bg-orange-500/8 dark:bg-orange-500/10",
    border: "border-orange-500/20",
    dot: "bg-orange-500",
    headerBg: "bg-orange-500/10",
  },
  {
    id: "entrega",
    label: "Entrega",
    statuses: ["ready", "delivering"] as string[],
    accent: "text-purple-600",
    bg: "bg-purple-500/8 dark:bg-purple-500/10",
    border: "border-purple-500/20",
    dot: "bg-purple-500",
    headerBg: "bg-purple-500/10",
  },
] as const;

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
  pending:    { label: "Aceitar",  next: "received",   icon: CheckCircle2 },
  received:   { label: "Preparar", next: "preparing",  icon: ChefHat },
  preparing:  { label: "Pronto",   next: "ready",      icon: CheckCircle2 },
  ready:      { label: "Enviar",   next: "delivering", icon: Truck },
  delivering: { label: "Entregue", next: "delivered",  icon: CheckCircle2 },
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
function fmtTime(iso: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function fmtDate(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoje";
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

// ── PrintOrderDialog ──────────────────────────────────────────────────────────
type PrintLayout = "production" | "caixa" | "delivery" | "ficha";
interface PrinterRecord { id: string; name: string; code: string; type: string; path: string | null; columns: number | null; }

const LAYOUT_TABS: { id: PrintLayout; label: string; hint: string }[] = [
  { id: "production", label: "Cozinha",  hint: "Produção / Bar"   },
  { id: "caixa",      label: "Caixa",    hint: "Cupom não fiscal" },
  { id: "delivery",   label: "Delivery", hint: "Resumo motoboy"   },
  { id: "ficha",      label: "Ficha",    hint: "Entrega detalhada"},
];

function PrintOrderDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const [printers,    setPrinters]    = useState<PrinterRecord[]>([]);
  const [selected,    setSelected]    = useState<string>("");
  const [layout,      setLayout]      = useState<PrintLayout>("production");
  const [preview,     setPreview]     = useState<string>("");
  const [loading,     setLoading]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [sendError,   setSendError]   = useState<string | null>(null);

  // Load printers once when dialog opens
  useEffect(() => {
    if (!orderId) return;
    setSent(false); setSendError(null); setPreview("");
    fetch("/api/printers/list")
      .then(r => r.json())
      .then((d: { printers?: PrinterRecord[] }) => {
        const list = d.printers ?? [];
        setPrinters(list);
        if (list.length > 0) setSelected(list[0].id);
      })
      .catch(() => {});
  }, [orderId]);

  // Fetch preview whenever printer or layout changes
  useEffect(() => {
    if (!orderId || !selected) return;
    let cancelled = false;
    setLoading(true); setSent(false); setSendError(null);
    api.post("/api/printers/print-order", { printerId: selected, orderId, layout, send: false })
      .then(r => r.json())
      .then((d: { preview?: string }) => { if (!cancelled) setPreview(d.preview ?? ""); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, selected, layout]);

  const handleBrowserPrint = () => {
    const printer = printers.find(p => p.id === selected);
    const cols    = printer?.columns ?? 48;
    const escaped = preview.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const html    = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Pedido #${orderId}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;font-size:11px;line-height:1.4;width:${cols}ch;padding:8px;background:#fff;color:#000}
        pre{white-space:pre}
        @media print{@page{margin:4mm;size:${cols<=34?"58mm":"80mm"} auto}body{width:100%}}
      </style></head><body><pre>${escaped}</pre></body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
  };

  const handleSendToDevice = async () => {
    if (!selected || !orderId) return;
    setSending(true); setSent(false); setSendError(null);
    try {
      const res  = await api.post("/api/printers/print-order", { printerId: selected, orderId, layout, send: true });
      const data = await res.json() as { sent?: boolean; error?: string };
      if (data.sent) setSent(true);
      else setSendError(data.error ?? "Erro ao enviar para a impressora");
    } catch {
      setSendError("Erro de conexão");
    } finally {
      setSending(false);
    }
  };

  const hasTcpPath = !!printers.find(p => p.id === selected)?.path;

  return (
    <Dialog open={!!orderId} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-xl p-0 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Printer className="w-4 h-4 text-muted-foreground" />
            Imprimir Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Printer selection */}
          {printers.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              Nenhuma impressora cadastrada.{" "}
              <a href="/admin/printers" className="text-primary hover:underline">Cadastrar impressora</a>
            </div>
          ) : (
            <div className="px-5 pt-4 pb-2 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Impressora</p>
              <div className="flex flex-wrap gap-2">
                {printers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                      selected === p.id
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border/60 hover:border-border bg-secondary/30 text-foreground"
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                    <span>{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.columns ?? 48}col</span>
                    {p.path && <span className="text-[10px] text-emerald-600 font-semibold">TCP</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Layout tabs */}
          <div className="flex gap-0.5 px-5 pt-3 border-b border-border/40 overflow-x-auto no-scrollbar shrink-0">
            {LAYOUT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setLayout(tab.id)}
                className={[
                  "flex flex-col items-start px-3 pb-2 pt-1.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px",
                  layout === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-60 font-normal">{tab.hint}</span>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : preview ? (
              <div className="bg-white dark:bg-zinc-900 border border-border/50 rounded-xl overflow-auto max-h-64">
                <pre className="font-mono text-[10px] leading-tight text-foreground p-3 whitespace-pre">
                  {preview}
                </pre>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/50 shrink-0 space-y-2">
          {sendError && (
            <p className="text-xs text-destructive text-center">⚠ {sendError}</p>
          )}
          {sent && (
            <p className="text-xs text-emerald-600 text-center flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Enviado com sucesso!
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Fechar
            </button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={handleBrowserPrint}
                disabled={!preview || loading}
                className="h-9 rounded-xl gap-1.5 text-xs"
              >
                <Eye className="w-3.5 h-3.5" /> Imprimir no navegador
              </Button>
              {hasTcpPath && (
                <Button
                  size="sm"
                  onClick={handleSendToDevice}
                  disabled={sending || !preview}
                  className="h-9 rounded-xl gap-1.5 text-xs bg-gradient-primary text-primary-foreground shadow-glow"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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

// ── OrderCard ─────────────────────────────────────────────────────────────────
function OrderCard({
  order, onAdvance, onCancel, onPrint, isAdvancing,
}: {
  order: Order;
  onAdvance: (id: string, next: string) => void;
  onCancel: (id: string) => void;
  onPrint: (id: string) => void;
  isAdvancing: boolean;
}) {
  const action = order.status === "ready" && order.type === "pickup"
    ? { label: "Retirado", next: "delivered", icon: CheckCircle2 }
    : NEXT_ACTION[order.status];

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

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <span className="text-sm font-bold">{order.total}</span>
        <div className="flex items-center gap-1.5">
          {/* Print icon — always visible */}
          <button
            onClick={() => onPrint(order.orderId)}
            title="Imprimir pedido"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/60"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
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
              onClick={() => onAdvance(order.orderId, action.next)}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isAdvancing
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <action.icon className="w-3 h-3" />
              }
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────
function KanbanColumn({
  column, orders, onAdvance, onCancel, onPrint, advancing,
}: {
  column: typeof COLUMNS[number];
  orders: Order[];
  onAdvance: (id: string, next: string) => void;
  onCancel: (id: string) => void;
  onPrint: (id: string) => void;
  advancing: string | null;
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
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2.5"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
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
              isAdvancing={advancing === order.orderId}
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
  const storeIdRef = useRef<string | null>(null);

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
      if (res.ok) setOrders((data.orders || []).map(normalize));
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [normalize]);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (!storeId) { setLoading(false); return; }
    storeIdRef.current = storeId;
    fetchOrders(storeId);
    // Poll every 30 seconds for new orders
    const interval = setInterval(() => fetchOrders(storeId, true), 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleAdvance = async (orderId: string, nextStatus: string) => {
    setAdvancing(orderId);
    try {
      const res = await api.post("/api/orders/update-status", { orderId, status: nextStatus });
      if (res.ok) setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: nextStatus } : o));
    } catch { /* ignore */ }
    finally { setAdvancing(null); }
  };

  const handleCancel = async (orderId: string) => {
    setAdvancing(orderId);
    try {
      const res = await api.post("/api/orders/update-status", { orderId, status: "cancelled" });
      if (res.ok) setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: "cancelled" } : o));
    } catch { /* ignore */ }
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            orders={colOrders(col.statuses)}
            onAdvance={handleAdvance}
            onCancel={handleCancel}
            onPrint={id => setPrintOrderId(id)}
            advancing={advancing}
          />
        ))}
      </div>

      {/* ── Print dialog ────────────────────────────────────────────────────── */}
      <PrintOrderDialog
        orderId={printOrderId}
        onClose={() => setPrintOrderId(null)}
      />

    </div>
  );
}
