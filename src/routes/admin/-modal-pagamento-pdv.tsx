import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, QrCode, Banknote, Smartphone, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fmtBRL } from "./pdv";
import type { PdvPaymentMethod } from "./pdv";

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote, pix: QrCode, card: CreditCard, debit: CreditCard, mercadopago: Smartphone,
};

// ─── Modal de Pagamento ───────────────────────────────────────────
export default function ModalPagamento({
  total, subtotal, discountValue, discount,
  submitting, orderNumber, paymentConfig, mesaLabel,
  onClose, onFinalize, onNovaNota,
}: {
  total: number; subtotal: number; discountValue: number; discount: number;
  submitting: boolean; orderNumber: number | null;
  paymentConfig: PdvPaymentMethod[]; mesaLabel: string | null;
  onClose: () => void;
  onFinalize: (method: string, installments: number) => void;
  onNovaNota: () => void;
}) {
  const [method, setMethod]   = useState<string | null>(null);
  const [planId, setPlanId]   = useState<string | null>(null);
  const [troco, setTroco]     = useState("");
  const methods        = paymentConfig.filter(m => m.key !== "mercadopago");
  const selectedConfig = paymentConfig.find(m => m.key === method);
  const selectedPlan   = selectedConfig?.plans.find(p => p.id === planId) ?? null;
  const installments    = selectedPlan?.parcelas ?? 1;
  const precisaEscolherPlano = !!selectedConfig && selectedConfig.plans.length > 0 && !selectedPlan;
  const trocoCalc      = method === "cash" && troco
    ? Math.max(parseFloat(troco.replace(",", ".")) - total, 0) : null;

  if (orderNumber !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Venda concluída!</h3>
          {mesaLabel && <p className="text-xs text-muted-foreground mt-0.5">{mesaLabel}</p>}
          <p className="text-sm text-muted-foreground mt-1">Pedido #{orderNumber}</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-3 tabular-nums">{fmtBRL(total)}</p>
          {trocoCalc !== null && trocoCalc > 0 && (
            <p className="text-sm font-semibold text-amber-600 mt-1">Troco: {fmtBRL(trocoCalc)}</p>
          )}
          <button onClick={onNovaNota}
            className="mt-6 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base transition-colors">
            Nova Venda
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
              <CreditCard className="w-4 h-4 text-emerald-500" />Fechar Venda
            </h3>
            {mesaLabel && <p className="text-[11px] text-muted-foreground mt-0.5">{mesaLabel}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-secondary rounded-xl border border-border p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{fmtBRL(subtotal)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Desconto</span><span className="tabular-nums">−{fmtBRL(discountValue)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-bold text-foreground">Total</span>
              <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">{fmtBRL(total)}</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Forma de Pagamento</p>
            {methods.length === 0
              ? <p className="text-xs text-muted-foreground">Nenhuma forma ativa.</p>
              : (
                <div className="grid grid-cols-3 gap-2">
                  {methods.map(m => {
                    const Icon = METHOD_ICONS[m.key] ?? CreditCard;
                    return (
                      <button key={m.key}
                        onClick={() => { setMethod(m.key); setPlanId(null); setTroco(""); }}
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

          {method && selectedConfig && selectedConfig.plans.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Plano de Pagamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {selectedConfig.plans.map(plan => (
                  <button key={plan.id} onClick={() => setPlanId(plan.id)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                      planId === plan.id
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-card text-muted-foreground border-border hover:border-emerald-300"
                    }`}>
                    {plan.parcelas <= 1
                      ? `${plan.nome} — ${fmtBRL(total)}`
                      : `${plan.nome} — ${plan.parcelas}x ${fmtBRL(total / plan.parcelas)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {method === "cash" && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor Recebido (R$)</label>
              <Input value={troco} onChange={e => setTroco(e.target.value)} placeholder="0,00"
                className="mt-1 h-10 rounded-xl text-sm" autoFocus />
              {trocoCalc !== null && trocoCalc > 0  && <p className="text-sm font-bold text-amber-600 mt-1.5">Troco: {fmtBRL(trocoCalc)}</p>}
              {trocoCalc !== null && trocoCalc < 0  && <p className="text-xs text-red-500 mt-1">Valor insuficiente</p>}
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={() => method && onFinalize(method, installments)}
            disabled={!method || submitting || precisaEscolherPlano || (method === "cash" && !!troco && parseFloat(troco.replace(",", ".")) < total)}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-100">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" />CONFIRMAR PAGAMENTO [F2]</>}
          </button>
        </div>
      </div>
    </div>
  );
}
