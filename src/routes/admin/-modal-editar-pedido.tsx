import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";
import {
  Loader2, Pencil, Plus, Minus, Trash2, Search,
  Banknote, QrCode, CreditCard, AlertCircle, Truck, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RawOrder } from "./pedidos";

interface EditItem {
  key: string; productId: string; productName: string;
  quantity: number; unitPrice: string;
  additionsSnapshot?: { name: string; price: string }[] | null;
  notes?: string | null;
}
interface EditPayment { key: string; formaPagamento: string; valor: string }

interface ProductSearchResult { id: string; name: string; sku: string | null; price: string; emoji: string | null; active: boolean | null }

const METODOS = [
  { key: "cash",  label: "Dinheiro",          icon: Banknote },
  { key: "pix",   label: "PIX",               icon: QrCode },
  { key: "card",  label: "Cartão Crédito",    icon: CreditCard },
  { key: "debit", label: "Cartão Débito",     icon: CreditCard },
] as const;

const fmtBRL = (v: number | string) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return "R$ " + (isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ","));
};

let tempIdSeq = 0;
const newTempKey = () => `novo-${Date.now()}-${tempIdSeq++}`;

// ─── Modal: Editar Pedido ──────────────────────────────────────────
// Itens (quantidade, adicionar/remover) + pagamento dividido de verdade
// (uma ou mais formas, cada uma com seu valor). Só disponível pra pedidos
// ainda não concretizados (ver canEdit em pedidos.tsx). O preço de
// verdade é sempre recalculado no servidor (priceOrder) — os valores
// mostrados aqui são só pré-visualização.
export default function EditOrderDialog({
  order, onClose, onSaved,
}: {
  order: RawOrder;
  onClose: () => void;
  onSaved: (updated: RawOrder) => void;
}) {
  const [items, setItems] = useState<EditItem[]>(() => order.items.map(i => ({
    key: i.id, productId: i.productId ?? "", productName: i.productName,
    quantity: i.quantity, unitPrice: i.unitPrice,
    additionsSnapshot: i.additionsSnapshot, notes: i.notes,
  })));
  const [payments, setPayments] = useState<EditPayment[]>(() => (order.payments ?? []).map(p => ({
    key: p.id, formaPagamento: p.formaPagamento, valor: p.valor,
  })));
  const [paymentsDirty, setPaymentsDirty] = useState(false);

  // Taxa de entrega — editável manualmente (o cálculo automático por
  // distância/bairro nem sempre bate com o custo real; uma vez em rota,
  // o valor combinado com o entregador deve ficar estável, não recalcular
  // sozinho a cada edição de item). Só existe pra pedido de entrega.
  const isDelivery = order.type !== "pickup";
  const [deliveryFee, setDeliveryFee] = useState(() => (parseFloat(order.deliveryFee ?? "0") || 0).toFixed(2).replace(".", ","));
  const discountValue = parseFloat(order.discount ?? "0") || 0;
  const originalTotal = parseFloat(order.total) || 0;

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [showResults, setShowResults] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Busca de produto pra "Adicionar item" — mesmo endpoint já usado no
  // autocomplete de relatórios, agora também devolvendo price/emoji/active.
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/products/search?q=${encodeURIComponent(search.trim())}`)
        .then(r => r.json())
        .then((d: { products?: ProductSearchResult[] }) => setResults((d.products || []).filter(p => p.active !== false)))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addProduct = (p: ProductSearchResult) => {
    setItems(prev => {
      const existente = prev.find(i => i.productId === p.id && !i.additionsSnapshot?.length);
      if (existente) {
        return prev.map(i => i.key === existente.key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        key: newTempKey(), productId: p.id, productName: p.name,
        quantity: 1, unitPrice: p.price, additionsSnapshot: null, notes: null,
      }];
    });
    setSearch(""); setResults([]); setShowResults(false);
  };

  const updateQty = (key: string, delta: number) => {
    setItems(prev => prev
      .map(i => i.key === key ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0));
  };
  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));

  const addPayment = () => {
    setPaymentsDirty(true);
    setPayments(prev => [...prev, { key: newTempKey(), formaPagamento: "pix", valor: "" }]);
  };
  const updatePayment = (key: string, patch: Partial<EditPayment>) => {
    setPaymentsDirty(true);
    setPayments(prev => prev.map(p => p.key === key ? { ...p, ...patch } : p));
  };
  const removePayment = (key: string) => {
    setPaymentsDirty(true);
    setPayments(prev => prev.filter(p => p.key !== key));
  };

  const subtotalPreview  = items.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * i.quantity, 0);
  const deliveryFeeValue = isDelivery ? (parseFloat(deliveryFee.replace(",", ".")) || 0) : 0;
  const totalPreview     = Math.max(0, subtotalPreview + deliveryFeeValue - discountValue);
  const somaPagamentos   = payments.reduce((s, p) => s + (parseFloat(p.valor.replace(",", ".")) || 0), 0);
  // Diferença entre o total depois da edição e o total que o pedido já
  // tinha antes de abrir esse modal — destaca se vai precisar cobrar mais
  // do cliente ou se sobra troco (pedido ficou mais barato).
  const diferenca = totalPreview - originalTotal;

  const handleSalvar = async () => {
    if (items.length === 0) { setError("O pedido precisa ter ao menos um item."); return; }
    if (isDelivery && (parseFloat(deliveryFee.replace(",", ".")) || -1) < 0) {
      setError("Informe uma taxa de entrega válida."); return;
    }
    for (const p of payments) {
      if (!p.formaPagamento) { setError("Escolha a forma de pagamento em todas as linhas."); return; }
      if (!p.valor || (parseFloat(p.valor.replace(",", ".")) || 0) <= 0) { setError("Informe um valor válido em todas as formas de pagamento."); return; }
    }
    setSaving(true); setError("");
    try {
      const res = await api.post("/api/orders/update-items", {
        orderId: order.id,
        items: items.map(i => ({
          productId: i.productId, quantity: i.quantity,
          additionsSnapshot: i.additionsSnapshot, notes: i.notes,
        })),
        ...(isDelivery ? { deliveryFee: deliveryFee.replace(",", ".") } : {}),
        ...(paymentsDirty ? {
          payments: payments.map(p => ({ formaPagamento: p.formaPagamento, valor: p.valor.replace(",", ".") })),
        } : {}),
      });
      const data = await res.json() as { success?: boolean; order?: RawOrder; error?: string };
      if (res.ok && data.success && data.order) {
        onSaved(data.order);
      } else {
        setError(data.error || "Erro ao salvar o pedido");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-muted-foreground" />
            Editar Pedido #{order.number}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Itens */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Itens</p>
            <div className="space-y-1.5">
              {items.map(item => (
                <div key={item.key} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{fmtBRL(item.unitPrice)} / un</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => updateQty(item.key, -1)}
                      className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.key, 1)}
                      className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-sm font-bold tabular-nums w-20 text-right shrink-0">
                    {fmtBRL((parseFloat(item.unitPrice) || 0) * item.quantity)}
                  </span>
                  <button type="button" onClick={() => removeItem(item.key)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar item */}
            <div className="relative" ref={searchBoxRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Adicionar item — buscar produto..."
                  className="h-9 pl-8 text-sm rounded-xl"
                />
                {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
              {showResults && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-popover border border-border/60 rounded-xl shadow-lg">
                  {results.map(p => (
                    <button key={p.id} type="button" onClick={() => addProduct(p)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-secondary/60 transition-colors text-left">
                      <span className="truncate">{p.emoji ? `${p.emoji} ` : ""}{p.name}</span>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">{fmtBRL(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Taxa de entrega + totais */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal dos itens</span>
              <span className="font-semibold tabular-nums">{fmtBRL(subtotalPreview)}</span>
            </div>

            {isDelivery && (
              <div className="flex justify-between items-center gap-2 text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />Taxa de entrega
                </span>
                <Input
                  value={deliveryFee}
                  onChange={e => setDeliveryFee(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="h-8 w-24 text-sm rounded-lg text-right tabular-nums"
                />
              </div>
            )}

            {discountValue > 0 && (
              <div className="flex justify-between items-center text-sm text-amber-600">
                <span>Desconto (cupom)</span>
                <span className="font-semibold tabular-nums">−{fmtBRL(discountValue)}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1 border-t border-border/40">
              <span className="font-bold text-foreground">Total</span>
              <span className="text-lg font-extrabold tabular-nums">{fmtBRL(totalPreview)}</span>
            </div>

            {/* Diferença em relação ao total que o pedido já tinha — sempre
                destacada quando o valor muda, com ênfase maior se sobra
                troco (pedido ficou mais barato do que já estava). */}
            {Math.abs(diferenca) > 0.004 && (
              diferenca > 0 ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <ArrowUpCircle className="w-4 h-4 shrink-0" />
                  <span>+ {fmtBRL(diferenca)} a mais — cobrar a diferença do cliente</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-300 rounded-xl px-3 py-2">
                  <ArrowDownCircle className="w-4 h-4 shrink-0" />
                  <span>TROCO: {fmtBRL(Math.abs(diferenca))} a menos — devolver pro cliente</span>
                </div>
              )
            )}
          </div>

          {/* Pagamento dividido */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Forma de Pagamento</p>
              <button type="button" onClick={addPayment}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity">
                <Plus className="w-3 h-3" />Adicionar forma
              </button>
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma forma definida ainda — o pedido mantém a forma atual até você adicionar uma aqui.</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.key} className="flex items-center gap-2">
                    <select
                      value={p.formaPagamento}
                      onChange={e => updatePayment(p.key, { formaPagamento: e.target.value })}
                      className="h-9 rounded-xl border border-border bg-card text-sm px-2 flex-1"
                    >
                      {METODOS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <Input
                      value={p.valor}
                      onChange={e => updatePayment(p.key, { valor: e.target.value })}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="h-9 w-28 text-sm rounded-xl text-right tabular-nums"
                    />
                    <button type="button" onClick={() => removePayment(p.key)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-muted-foreground">Soma das formas (total: {fmtBRL(totalPreview)})</span>
                  <span className={`font-bold tabular-nums ${Math.abs(somaPagamentos - totalPreview) > 0.01 ? "text-amber-600" : "text-emerald-600"}`}>
                    {fmtBRL(somaPagamentos)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
        </div>

        <div className="p-5 pt-3 border-t border-border/50 shrink-0 flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSalvar} disabled={saving}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Alterações"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

