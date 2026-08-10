import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";

export function OpenRegisterModal({
  online,
  operatorName,
  onOpen,
}: {
  online: boolean;
  operatorName: string;
  onOpen: (saldoInicial: string) => Promise<void>;
}) {
  const [saldo, setSaldo] = useState("0,00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onOpen(saldo.replace(",", "."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir o caixa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold">Abrir caixa</h2>
            <p className="text-xs text-ink/50">Turno de {operatorName}</p>
          </div>
        </div>

        {!online && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
            Sem conexão — é preciso abrir o caixa online pelo menos uma vez neste computador antes do primeiro turno offline.
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink/70 uppercase tracking-wide">Saldo inicial (R$)</label>
          <input
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            disabled={!online}
            className="w-full h-12 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface disabled:text-ink/40"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!online || loading}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm shadow-glow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Abrir caixa e começar a vender"}
        </button>
      </div>
    </div>
  );
}
