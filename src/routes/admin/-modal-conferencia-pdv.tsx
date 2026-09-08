import { useEffect, useState } from "react";
import { X, Loader2, Printer, ClipboardCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { isNetworkPath, dispatchPrint, describeAgentError } from "@/lib/print/print-order";
import type { PrinterRecord, PrintApiResponse } from "@/lib/print/print-order";
import { fmtBRL } from "./pdv";

// ─── Modal: Conferência ────────────────────────────────────────────
// Pré-conta de uma mesa/comanda AINDA ABERTA — nunca fecha a conta, só
// mostra e (opcionalmente) imprime pro cliente conferir. Diferente do
// cupom de venda de verdade (que só existe depois de "Finalizar Venda").
export default function ModalConferencia({
  sessionId, mesaLabel, subtotal, totalAdiantado, total, onClose,
}: {
  sessionId: string; mesaLabel: string;
  subtotal: number; totalAdiantado: number; total: number;
  onClose: () => void;
}) {
  const [printers, setPrinters]   = useState<PrinterRecord[]>([]);
  const [printerId, setPrinterId] = useState("");
  const [preview, setPreview]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [printing, setPrinting]   = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    fetch("/api/printers/list").then(r => r.json())
      .then((d: { printers?: PrinterRecord[] }) => {
        const ativas    = (d.printers || []).filter(p => p.active !== false);
        const preferida = ativas.find(p => p.type === "Caixa") || ativas[0];
        setPrinters(ativas);
        if (preferida) setPrinterId(preferida.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!printerId) return;
    setLoading(true); setError("");
    api.post("/api/printers/print-conferencia", { printerId, sessionId, send: false })
      .then(r => r.json())
      .then((d: { preview?: string; error?: string }) => {
        if (d.preview) setPreview(d.preview); else setError(d.error || "Erro ao gerar pré-visualização");
      })
      .catch(() => setError("Erro de conexão"))
      .finally(() => setLoading(false));
  }, [printerId, sessionId]);

  // Rede → o servidor faz o TCP (send:true). Fila Windows → o servidor só
  // gera os bytes/linhas e o agente local imprime (mesmo fluxo do modal de
  // imprimir pedido). Driver HTML → impressão do navegador.
  const handleImprimir = async () => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) return;
    setPrinting(true); setError("");
    try {
      const needsTcp = isNetworkPath(printer.path ?? "");
      const res  = await api.post("/api/printers/print-conferencia", { printerId, sessionId, send: needsTcp });
      const data = await res.json() as PrintApiResponse;
      await dispatchPrint(printer, data);
      onClose();
    } catch (err) { setError(describeAgentError(err)); }
    finally { setPrinting(false); }
  };

  const faltaPagar = Math.max(0, total - totalAdiantado);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-500" />Conferência
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{mesaLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="bg-secondary rounded-xl border border-border p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{fmtBRL(subtotal)}</span></div>
            {totalAdiantado > 0 && (
              <div className="flex justify-between text-blue-600 font-medium">
                <span>Já pago (adiantamento)</span><span className="tabular-nums">−{fmtBRL(totalAdiantado)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-bold text-foreground">Falta pagar</span>
              <span className="text-xl font-extrabold text-emerald-600 tabular-nums">{fmtBRL(faltaPagar)}</span>
            </div>
          </div>

          {printers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma impressora cadastrada — cadastre uma em Menu de Funções → Configurações → Impressoras
              pra imprimir a conferência. Você ainda pode conferir os valores acima com o cliente.
            </p>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Impressora</label>
                <select value={printerId} onChange={e => setPrinterId(e.target.value)}
                  className="mt-1 w-full h-10 rounded-xl border border-border bg-card text-sm px-3">
                  {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="bg-secondary rounded-xl border border-border p-3 overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-24"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : (
                  <pre className="text-[10px] font-mono text-foreground whitespace-pre">{preview}</pre>
                )}
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="p-5 pt-0 shrink-0">
          <button onClick={handleImprimir} disabled={!printerId || printing}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Printer className="w-4 h-4" />Imprimir</>}
          </button>
        </div>
      </div>
    </div>
  );
}
