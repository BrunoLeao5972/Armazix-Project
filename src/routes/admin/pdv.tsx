import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone,
  X, ShoppingCart, Percent, Loader2, ArrowDownCircle, ArrowUpCircle,
  Tag, CheckCircle2, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/pdv")({
  component: PDVPage,
  head: () => ({
    meta: [{ title: "PDV — ARMAZIX" }],
  }),
});

// ─── tipos ───────────────────────────────────────
interface Product {
  id: string;
  name: string;
  price: string;
  stock: number | null;
  emoji: string | null;
}
interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  emoji: string;
}
type ModalType = "payment" | "sangria" | "suprimento" | null;

// ─── helpers ─────────────────────────────────────
const fmtBRL = (v: number) =>
  "R$ " + v.toFixed(2).replace(".", ",");

// ─── Modal de Sangria / Suprimento ───────────────
function ModalMovCaixa({
  tipo, onClose,
}: { tipo: "sangria" | "suprimento"; onClose: () => void }) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const Icon = tipo === "sangria" ? ArrowDownCircle : ArrowUpCircle;
  const cor  = tipo === "sangria" ? "text-rose-600" : "text-emerald-600";
  const bg   = tipo === "sangria" ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200";
  const label = tipo === "sangria" ? "Sangria de Caixa" : "Suprimento de Caixa";

  const handleConfirm = () => {
    if (!valor || parseFloat(valor) <= 0) return;
    console.log(`[PDV] ${tipo.toUpperCase()}`, { valor: parseFloat(valor), motivo });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bg}`}>
            <Icon className={`w-5 h-5 ${cor}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{label}</h3>
            <p className="text-xs text-slate-500">Registre o valor e o motivo da movimentação</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor (R$)</label>
            <Input type="number" min="0" step="0.01" value={valor}
              onChange={e => setValor(e.target.value)} placeholder="0,00"
              className="mt-1 h-10 rounded-xl text-sm" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motivo</label>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Troco, reposição..." className="mt-1 h-10 rounded-xl text-sm" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={!valor || parseFloat(valor) <= 0}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40 ${tipo === "sangria" ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Pagamento ───────────────────────────
function ModalPagamento({
  total, subtotal, discountValue, discount,
  submitting, orderNumber, onClose, onFinalize, onNovaNota,
}: {
  total: number; subtotal: number; discountValue: number; discount: number;
  submitting: boolean; orderNumber: number | null;
  onClose: () => void;
  onFinalize: (method: string) => void;
  onNovaNota: () => void;
}) {
  const [method, setMethod] = useState<string | null>(null);
  const [troco, setTroco] = useState("");

  const methods = [
    { key: "pix",   label: "PIX",       icon: Smartphone },
    { key: "card",  label: "Cartão",    icon: CreditCard },
    { key: "cash",  label: "Dinheiro",  icon: Banknote   },
  ];

  const trocoCalc = method === "cash" && troco
    ? Math.max(parseFloat(troco.replace(",", ".")) - total, 0)
    : null;

  if (orderNumber !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Venda concluída!</h3>
          <p className="text-sm text-slate-500 mt-1">Pedido #{orderNumber}</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-3">{fmtBRL(total)}</p>
          {trocoCalc !== null && trocoCalc > 0 && (
            <p className="text-sm font-semibold text-amber-600 mt-1">Troco: {fmtBRL(trocoCalc)}</p>
          )}
          <button onClick={onNovaNota}
            className="mt-6 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base transition-colors shadow-lg shadow-emerald-100">
            Nova Venda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-500" />Fechar Venda
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumo */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span><span>{fmtBRL(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Desconto ({discount}%)</span><span>−{fmtBRL(discountValue)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-1">
              <span className="font-bold text-slate-700">Total</span>
              <span className="text-2xl font-extrabold text-emerald-600">{fmtBRL(total)}</span>
            </div>
          </div>

          {/* Formas de pagamento */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-3 gap-2">
              {methods.map(m => (
                <button key={m.key} onClick={() => setMethod(m.key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold border transition-all ${
                    method === m.key
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100"
                      : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                  }`}>
                  <m.icon className="w-5 h-5" />{m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campo troco se dinheiro */}
          {method === "cash" && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Valor Recebido (R$)</label>
              <Input value={troco} onChange={e => setTroco(e.target.value)}
                placeholder="0,00" className="mt-1 h-10 rounded-xl text-sm" autoFocus />
              {trocoCalc !== null && trocoCalc > 0 && (
                <p className="text-sm font-bold text-amber-600 mt-1.5">Troco: {fmtBRL(trocoCalc)}</p>
              )}
              {trocoCalc !== null && trocoCalc < 0 && (
                <p className="text-xs text-rose-500 mt-1">Valor insuficiente</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={() => method && onFinalize(method)}
            disabled={!method || submitting || (method === "cash" && !!troco && parseFloat(troco.replace(",", ".")) < total)}
            className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-100">
            {submitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><CreditCard className="w-5 h-5" />PAGAMENTO [F2]</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PDVPage ──────────────────────────────────────
function PDVPage() {
  const [products, setProducts]         = useState<Product[]>([]);
  const [search, setSearch]             = useState("");
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [discount, setDiscount]         = useState(0);
  const [discountType, setDiscountType] = useState<"pct" | "brl">("pct");
  const [modal, setModal]               = useState<ModalType>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [orderNumber, setOrderNumber]   = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storeId = localStorage.getItem("storeId");
    if (storeId) fetchProducts(storeId);
  }, []);

  const fetchProducts = async (storeId: string) => {
    try {
      const res = await fetch(`/api/products/list?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
    } catch {}
  };

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F2") { e.preventDefault(); if (cart.length > 0) setModal("payment"); }
      if (e.key === "F3") { e.preventDefault(); if (cart.length > 0) setCart(prev => prev.slice(0, -1)); }
      if (e.key === "F4") { e.preventDefault(); setModal("sangria"); }
      if (e.key === "Escape") { e.preventDefault(); setModal(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = useCallback((product: Product) => {
    const price = parseFloat(product.price);
    const emoji = product.emoji || "📦";
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, price, qty: 1, emoji }];
    });
  }, []);

  const updateQty = (productId: string, delta: number) =>
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));

  const removeFromCart = (productId: string) =>
    setCart(prev => prev.filter(i => i.productId !== productId));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountValue = discountType === "pct"
    ? subtotal * (discount / 100)
    : Math.min(discount, subtotal);
  const total = subtotal - discountValue;
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  const handleFinalize = async (method: string) => {
    if (submitting) return;
    const storeId = localStorage.getItem("storeId");
    if (!storeId) return;
    setSubmitting(true);
    try {
      const items = cart.map(item => ({
        productId: item.productId,
        productName: item.name,
        productEmoji: item.emoji,
        quantity: item.qty,
        unitPrice: item.price.toFixed(2),
        total: (item.price * item.qty).toFixed(2),
      }));
      const res = await api.post("/api/orders/create", {
        storeId, type: "pickup", paymentMethod: method, items,
        subtotal: subtotal.toFixed(2), deliveryFee: "0",
        discount: discountValue.toFixed(2), total: total.toFixed(2),
      });
      const data = await res.json();
      if (res.ok && data.success) setOrderNumber(data.order.number);
    } catch {} finally { setSubmitting(false); }
  };

  const handleNovaNota = () => {
    setModal(null); setCart([]); setDiscount(0);
    setDiscountType("pct"); setOrderNumber(null);
    searchRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50">

      {/* ── GRID PRINCIPAL ─────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── COLUNA ESQUERDA: CATÁLOGO ─── */}
        <div className="flex flex-col flex-1 min-w-0 p-4 gap-4">

          {/* Barra de busca */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto ou código de barras..."
              autoFocus
              className="w-full h-14 bg-white border border-slate-200 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-base rounded-xl pl-12 pr-20 outline-none shadow-sm transition-all text-slate-700 placeholder:text-slate-400"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">F1</span>
          </div>

          {/* Grade de produtos */}
          <div className="flex-1 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                <Package className="w-10 h-10 opacity-30" />
                <p className="text-sm">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(product => (
                  <button key={product.id} onClick={() => addToCart(product)}
                    className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between text-left active:scale-[0.97] group">
                    {/* Imagem / emoji */}
                    <div className="w-full h-28 flex items-center justify-center bg-slate-50 rounded-lg mb-2 overflow-hidden">
                      <span className="text-5xl group-hover:scale-110 transition-transform duration-150">{product.emoji || "📦"}</span>
                    </div>
                    {/* Nome */}
                    <p className="text-slate-700 font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </p>
                    {/* Estoque */}
                    <p className="text-[11px] text-slate-400 mt-1">
                      {product.stock !== null ? `Estoque: ${product.stock} un` : "Sem controle de estoque"}
                    </p>
                    {/* Preço + botão */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-emerald-600 font-bold text-lg">
                        {fmtBRL(parseFloat(product.price))}
                      </span>
                      <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Barra de atalhos */}
          <div className="flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-200 pt-2.5 flex-wrap">
            {[
              { key: "F1", label: "Buscar" },
              { key: "F2", label: "Fechar Venda" },
              { key: "F3", label: "Cancelar Último" },
              { key: "F4", label: "Sangria/Suprimento" },
              { key: "ESC", label: "Sair" },
            ].map(s => (
              <span key={s.key} className="flex items-center gap-1.5">
                <kbd className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{s.key}</kbd>
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── COLUNA DIREITA: CARRINHO ─── */}
        <div className="w-[380px] shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col h-full">

          {/* Header carrinho */}
          <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-500" />Carrinho
            </h2>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {totalQty} {totalQty === 1 ? "item" : "itens"}
            </span>
          </div>

          {/* Lista de itens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
                <ShoppingCart className="w-10 h-10 opacity-20" />
                <p className="text-sm text-center">Carrinho vazio<br /><span className="text-xs">Toque nos produtos para adicionar</span></p>
              </div>
            ) : cart.map(item => (
              <div key={item.productId}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-100 hover:border-slate-200 transition-colors">
                {/* Emoji miniatura */}
                <span className="text-xl shrink-0 w-10 h-10 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100">
                  {item.emoji}
                </span>
                {/* Nome + qty */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-400">{item.qty}x · {fmtBRL(item.price)}</p>
                </div>
                {/* Total item */}
                <span className="text-xs font-bold text-slate-700 shrink-0 w-16 text-right tabular-nums">
                  {fmtBRL(item.price * item.qty)}
                </span>
                {/* Controles */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => updateQty(item.productId, -1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-slate-700">{item.qty}</span>
                  <button onClick={() => updateQty(item.productId, 1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeFromCart(item.productId)}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors text-slate-300 ml-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Rodapé: totais + desconto + botão */}
          <div className="px-4 py-4 border-t border-slate-200 space-y-3">
            {/* Desconto */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl overflow-hidden border border-slate-200 shrink-0">
                <button onClick={() => setDiscountType("pct")}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${discountType === "pct" ? "bg-slate-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                  %
                </button>
                <button onClick={() => setDiscountType("brl")}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${discountType === "brl" ? "bg-slate-700 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                  R$
                </button>
              </div>
              <div className="relative flex-1">
                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input type="number" min={0} max={discountType === "pct" ? 100 : undefined}
                  value={discount || ""} onChange={e => setDiscount(Number(e.target.value))}
                  placeholder={discountType === "pct" ? "Desconto %" : "Desconto R$"}
                  className="pl-8 h-9 rounded-xl text-sm" />
              </div>
              {discount > 0 && (
                <button onClick={() => setDiscount(0)} className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Bloco de total */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Total de Itens</span>
                <span className="font-medium text-slate-700">{totalQty}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-xs text-amber-600 font-medium">
                  <span>Desconto</span>
                  <span>−{fmtBRL(discountValue)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm font-medium text-slate-700">TOTAL</span>
                <span className="text-4xl font-extrabold text-emerald-600 tabular-nums leading-none">
                  {fmtBRL(total)}
                </span>
              </div>
            </div>

            {/* Sangria + botão principal */}
            <div className="flex gap-2">
              <button onClick={() => setModal("sangria")}
                className="h-12 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-xs font-medium text-slate-500"
                title="Sangria / Suprimento [F4]">
                <Tag className="w-3.5 h-3.5" />F4
              </button>
              <button onClick={() => cart.length > 0 && setModal("payment")}
                disabled={cart.length === 0}
                className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-100">
                <CreditCard className="w-5 h-5" />PAGAMENTO [F2]
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAIS ─────────────────────────────────── */}
      {(modal === "sangria" || modal === "suprimento") && (
        <ModalMovCaixa tipo={modal} onClose={() => setModal(null)} />
      )}

      {modal === "payment" && (
        <ModalPagamento
          total={total} subtotal={subtotal}
          discountValue={discountValue} discount={discount}
          submitting={submitting} orderNumber={orderNumber}
          onClose={() => { if (!submitting && orderNumber === null) setModal(null); }}
          onFinalize={handleFinalize}
          onNovaNota={handleNovaNota}
        />
      )}
    </div>
  );
}
