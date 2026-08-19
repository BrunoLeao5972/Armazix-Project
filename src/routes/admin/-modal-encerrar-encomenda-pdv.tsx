import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, QrCode, Banknote, Smartphone, X, Package, Truck } from "lucide-react";
import { api } from "@/lib/api-client";
import { fmtBRL } from "./pdv";
import type { PdvPaymentMethod, Encomenda } from "./pdv";
import { imprimirComprovante, imprimirFichaEntrega, type PrintableOrder } from "@/lib/print/print-order";

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote, pix: QrCode, card: CreditCard, debit: CreditCard, mercadopago: Smartphone,
};
const PAY_LABEL: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Crédito", debit: "Débito", mercadopago: "Mercado Pago",
};

function toPrintable(enc: Encomenda, paymentMethod: string): PrintableOrder {
  const addr = enc.addressSnapshot;
  const address = addr
    ? [addr.street, addr.number].filter(Boolean).join(", ") + (addr.neighborhood ? ` — ${addr.neighborhood}` : "")
    : "";
  return {
    orderId: enc.id,
    number:  enc.number,
    customer: enc.customer?.name || "Cliente",
    items:   enc.items.map(i => `${i.quantity}x ${i.productName}`),
    total:   fmtBRL(enc.total),
    payment: paymentMethod,
    status:  enc.status,
    rawDate: enc.createdAt,
    address,
    type:    enc.type,
  };
}

// ─── Modal de Encerramento de Encomenda ────────────────────────────
// Fecha um pedido de delivery/retirada do site que chegou como reserva de
// estoque (ainda sem forma de pagamento real confirmada): informa a forma
// de pagamento e concretiza (baixa real de estoque + lançamento financeiro
// na sessão de caixa aberta), emitindo o comprovante de venda. "Expedir"
// faz o mesmo e além disso avança o pedido pro status "Saiu para entrega"
// (que já imprime a ficha de entrega automaticamente, se configurado).
export default function ModalEncerrarEncomenda({
  encomenda, sessaoId, paymentConfig, onClose, onEncerrado,
}: {
  encomenda: Encomenda; sessaoId: string; paymentConfig: PdvPaymentMethod[];
  onClose: () => void; onEncerrado: (orderId: string) => void;
}) {
  const jaConfirmado = encomenda.paymentStatus === "paid" && !!encomenda.paymentMethod;
  const [method, setMethod] = useState<string | null>(jaConfirmado ? encomenda.paymentMethod : null);
  const [loading, setLoading] = useState<"encerrar" | "expedir" | null>(null);
  const [erro, setErro]       = useState("");
  const [done, setDone]       = useState<"encerrar" | "expedir" | null>(null);

  const methods = paymentConfig.filter(m => m.key !== "mercadopago");

  const handleClose = async (expedir: boolean) => {
    if (!method) { setErro("Selecione a forma de pagamento"); return; }
    setErro(""); setLoading(expedir ? "expedir" : "encerrar");
    try {
      const res  = await api.post("/api/pdv/encerrar-encomenda", {
        sessaoId, orderId: encomenda.id, paymentMethod: method, expedir,
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) { setErro(data.error || "Erro ao encerrar"); setLoading(null); return; }

      const printable = toPrintable(encomenda, method);
      imprimirComprovante(printable);
      if (expedir) imprimirFichaEntrega(printable);

      setDone(expedir ? "expedir" : "encerrar");
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(null);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {done === "expedir" ? "Encomenda expedida!" : "Encomenda encerrada!"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Pedido #{encomenda.number}</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-3 tabular-nums">{fmtBRL(encomenda.total)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {done === "expedir" ? "Comprovante e ficha de entrega enviados pra impressão." : "Comprovante enviado pra impressão."}
          </p>
          <button onClick={() => onEncerrado(encomenda.id)}
            className="mt-6 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base transition-colors">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />Encerrar Encomenda
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pedido #{encomenda.number} — {encomenda.customer?.name || "Cliente"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-secondary rounded-xl border border-border p-4 space-y-1.5 text-sm">
            {encomenda.items.map(i => (
              <div key={i.id} className="flex justify-between text-xs text-muted-foreground">
                <span>{i.quantity}× {i.productName}</span>
                <span className="tabular-nums">{fmtBRL(i.total)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-bold text-foreground">Total</span>
              <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">{fmtBRL(encomenda.total)}</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Forma de Pagamento Real</p>
            {jaConfirmado ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Pago via {PAY_LABEL[encomenda.paymentMethod!] ?? encomenda.paymentMethod}
              </div>
            ) : methods.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma forma ativa.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {methods.map(m => {
                  const Icon = METHOD_ICONS[m.key] ?? CreditCard;
                  return (
                    <button key={m.key} onClick={() => setMethod(m.key)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold border transition-all ${
                        method === m.key
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100"
                          : "bg-card text-muted-foreground border-border hover:border-emerald-300 hover:bg-emerald-50"
                      }`}>
                      <Icon className="w-5 h-5" />{m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={() => handleClose(false)} disabled={!method || !!loading}
            className="flex-1 h-12 rounded-xl bg-card border border-border text-foreground font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-secondary disabled:opacity-40">
            {loading === "encerrar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />Encerrar</>}
          </button>
          {encomenda.type !== "pickup" && (
            <button onClick={() => handleClose(true)} disabled={!method || !!loading}
              className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-100">
              {loading === "expedir" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Truck className="w-4 h-4" />Expedir</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
