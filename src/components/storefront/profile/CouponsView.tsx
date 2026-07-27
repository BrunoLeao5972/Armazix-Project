import { useState } from "react";
import { Tag, Loader2, Copy, Check } from "lucide-react";
import { useCustomerCoupons } from "@/lib/customer-profile-hooks";

function formatDiscount(type: string, discount: string): string {
  return type === "percent"
    ? `${parseFloat(discount)}% OFF`
    : `R$ ${parseFloat(discount).toFixed(2).replace(".", ",")} OFF`;
}

export function CouponsView({ token }: { token: string | null }) {
  const { coupons, loading } = useCustomerCoupons(token);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1800);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
        <Tag className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Nenhum cupom disponível</p>
        <p className="text-xs text-muted-foreground">Quando a loja disponibilizar cupons, eles aparecem aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 px-1">
      {coupons.map(c => {
        const minOrder = parseFloat(c.minOrderValue || "0");
        return (
          <div key={c.id} className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">{formatDiscount(c.type, c.discount)}</p>
              {minOrder > 0 && (
                <p className="text-xs text-muted-foreground">
                  Pedidos acima de R$ {minOrder.toFixed(2).replace(".", ",")}
                </p>
              )}
              {c.expiresAt && (
                <p className="text-[11px] text-muted-foreground/80">
                  Válido até {new Date(c.expiresAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <button
              onClick={() => copyCode(c.id, c.code)}
              className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl border border-primary/30 bg-background text-xs font-bold text-primary tracking-wide hover:bg-primary/10 transition-colors"
            >
              {copiedId === c.id
                ? <><Check className="w-3.5 h-3.5" /> Copiado</>
                : <><Copy className="w-3.5 h-3.5" /> {c.code}</>
              }
            </button>
          </div>
        );
      })}
    </div>
  );
}
