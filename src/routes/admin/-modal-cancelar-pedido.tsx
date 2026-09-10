import { useState } from "react";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MOTIVOS_CANCELAMENTO, MOTIVOS_ESTORNO } from "@/lib/orders/motivos";

// Modal de cancelamento de pedido — sempre pede um motivo (lista padrão +
// observação livre). Quando a venda já foi finalizada, o cancelamento é na
// verdade um ESTORNO: avisa que vai desfazer o recebimento + devolver o
// estoque + lançar a saída no financeiro.

export interface CancelarPedidoAlvo {
  orderId: string;
  number: number;
  total: string;
  saleStatus?: string | null;
  itemCount?: number;
}

export function ModalCancelarPedido({
  alvo,
  loading,
  onClose,
  onConfirm,
}: {
  alvo: CancelarPedidoAlvo | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (motivoCode: string, motivoNote: string) => void;
}) {
  const [motivoCode, setMotivoCode] = useState("");
  const [motivoNote, setMotivoNote] = useState("");

  const isEstorno = alvo?.saleStatus === "finalizada";
  const motivos = isEstorno ? MOTIVOS_ESTORNO : MOTIVOS_CANCELAMENTO;
  const valorFmt = alvo ? `R$ ${(parseFloat(alvo.total) || 0).toFixed(2).replace(".", ",")}` : "";

  const fechar = () => {
    setMotivoCode("");
    setMotivoNote("");
    onClose();
  };

  return (
    <Dialog open={!!alvo} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <XCircle className="w-4 h-4 text-destructive" />
            {isEstorno ? `Estornar venda #${alvo?.number}` : `Cancelar pedido #${alvo?.number}`}
          </DialogTitle>
        </DialogHeader>

        {isEstorno && (
          <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/25 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
              Esta venda já foi finalizada. Confirmar vai <strong>estornar o recebimento
              de {valorFmt}</strong>, devolver {alvo?.itemCount ? `${alvo.itemCount} ` : "os "}
              iten{alvo?.itemCount === 1 ? "" : "s"} ao estoque e lançar a saída no financeiro.
            </p>
          </div>
        )}

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Motivo {isEstorno ? "do estorno" : "do cancelamento"}
            </p>
            <div className="grid grid-cols-1 gap-1">
              {motivos.map((m) => (
                <label
                  key={m.value}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    motivoCode === m.value
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border/60 hover:bg-secondary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="motivo-cancelamento"
                    className="accent-primary"
                    checked={motivoCode === m.value}
                    onChange={() => setMotivoCode(m.value)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Observação <span className="font-normal normal-case text-muted-foreground/60">(opcional)</span>
            </p>
            <Textarea
              value={motivoNote}
              onChange={(e) => setMotivoNote(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Detalhe o que aconteceu com essa venda…"
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={fechar} disabled={loading} className="rounded-xl">
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(motivoCode, motivoNote)}
            disabled={loading || !motivoCode}
            className="rounded-xl gap-1.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEstorno ? "Estornar venda" : "Cancelar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
