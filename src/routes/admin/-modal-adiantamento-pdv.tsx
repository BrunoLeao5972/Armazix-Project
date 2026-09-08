import { useState } from "react";
import { X, Loader2, CircleDollarSign, Banknote, QrCode, CreditCard } from "lucide-react";
import { fmtBRL } from "./pdv";

const METODOS = [
  { key: "cash",  label: "Dinheiro",          icon: Banknote },
  { key: "pix",   label: "PIX",               icon: QrCode },
  { key: "card",  label: "Cartão de Crédito", icon: CreditCard },
  { key: "debit", label: "Cartão de Débito",  icon: CreditCard },
];

// ─── Modal: Adiantamento ───────────────────────────────────────────
// Pagamento parcial numa conta ainda aberta — abate do total quando a
// mesa/comanda for finalizada (ver registerAdvanceHandler em
// service-point-tab-handler.ts).
export default function ModalAdiantamento({
  faltaPagar, onClose, onConfirm,
}: {
  faltaPagar: number;
  onClose: () => void;
  onConfirm: (valor: string, formaPagamento: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [valor, setValor]         = useState("");
  const [metodo, setMetodo]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  const handleConfirmar = async () => {
    const num = parseFloat(valor.replace(",", "."));
    if (!num || num <= 0) { setError("Informe um valor válido."); return; }
    if (!metodo) { setError("Escolha a forma de pagamento."); return; }
    setSubmitting(true); setError("");
    const result = await onConfirm(num.toFixed(2), metodo);
    setSubmitting(false);
    if (result.ok) onClose(); else setError(result.error || "Erro ao registrar adiantamento");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4 text-blue-500" />Adiantamento
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Registra um pagamento parcial dessa conta agora — o valor abate do total quando a mesa for
            finalizada. Falta pagar hoje: <strong className="text-foreground">{fmtBRL(faltaPagar)}</strong>.
          </p>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor (R$)</label>
            <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
              placeholder="0,00" autoFocus
              className="mt-1 w-full h-11 rounded-xl border border-border bg-card text-base font-semibold text-center px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {METODOS.map(m => (
                <button key={m.key} onClick={() => setMetodo(m.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    metodo === m.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border text-muted-foreground hover:border-blue-300"
                  }`}>
                  <m.icon className="w-4 h-4" />{m.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <button onClick={handleConfirmar} disabled={submitting}
            className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Adiantamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
