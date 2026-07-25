import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Check, Eye, Loader2, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isNetworkPath, sendViaAgent } from "./pedidos";
import type { PrinterRecord } from "./pedidos";

type PrintLayout = "production" | "caixa" | "delivery" | "ficha";

const LAYOUT_TABS: { id: PrintLayout; label: string; hint: string }[] = [
  { id: "production", label: "Cozinha",  hint: "Produção / Bar"   },
  { id: "caixa",      label: "Caixa",    hint: "Cupom não fiscal" },
  { id: "delivery",   label: "Delivery", hint: "Resumo motoboy"   },
  { id: "ficha",      label: "Ficha",    hint: "Entrega detalhada"},
];

export default function PrintOrderDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const [printers,    setPrinters]    = useState<PrinterRecord[]>([]);
  const [selected,    setSelected]    = useState<string>("");
  const [layout,      setLayout]      = useState<PrintLayout>("production");
  const [preview,     setPreview]     = useState<string>("");
  const [escposB64,   setEscposB64]   = useState<string>("");
  const [loading,     setLoading]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [sendError,   setSendError]   = useState<string | null>(null);

  // Load printers once when dialog opens
  useEffect(() => {
    if (!orderId) return;
    setSent(false); setSendError(null); setPreview(""); setEscposB64("");
    fetch("/api/printers/list")
      .then(r => r.json())
      .then((d: { printers?: PrinterRecord[] }) => {
        const list = d.printers ?? [];
        setPrinters(list);
        if (list.length > 0) setSelected(list[0].id);
      })
      .catch(() => {});
  }, [orderId]);

  // Fetch preview (and escposB64) whenever printer or layout changes
  useEffect(() => {
    if (!orderId || !selected) return;
    let cancelled = false;
    setLoading(true); setSent(false); setSendError(null);
    api.post("/api/printers/print-order", { printerId: selected, orderId, layout, send: false })
      .then(r => r.json())
      .then((d: { preview?: string; escposB64?: string }) => {
        if (!cancelled) {
          setPreview(d.preview ?? "");
          setEscposB64(d.escposB64 ?? "");
        }
      })
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
    const printer = printers.find(p => p.id === selected);
    if (!printer?.path) return;
    setSending(true); setSent(false); setSendError(null);
    try {
      if (isNetworkPath(printer.path)) {
        // IP/hostname → servidor faz TCP
        const res  = await api.post("/api/printers/print-order", { printerId: selected, orderId, layout, send: true });
        const data = await res.json() as { sent?: boolean; error?: string };
        if (data.sent) setSent(true);
        else setSendError(data.error ?? "Erro ao enviar para a impressora");
      } else {
        // Nome Windows → agente local
        const b64 = escposB64 || await (
          api.post("/api/printers/print-order", { printerId: selected, orderId, layout, send: false })
            .then(r => r.json())
            .then((d: { escposB64?: string }) => d.escposB64 ?? "")
        );
        await sendViaAgent(printer.path, b64);
        setSent(true);
      }
    } catch (err) {
      const msg     = err instanceof Error ? err.message : "Erro de conexão";
      const offline = msg.includes("fetch") || msg.includes("Failed") || msg.includes("abort");
      setSendError(offline ? "Agente não encontrado. Verifique se o Armazix Print Agent está ativo na bandeja." : msg);
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
              <a href="/admin/impressoras" className="text-primary hover:underline">Cadastrar impressora</a>
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
