import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Plus, Minus, Trash2, CreditCard,
  X, ShoppingCart, Percent, Loader2, ArrowDownCircle, ArrowUpCircle,
  Tag, CheckCircle2, Package, LayoutGrid, Clock, ReceiptText,
  ClipboardCheck, LayoutDashboard, Users, Wallet, ChevronRight,
  AlertCircle, LockKeyhole, Unlock, Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { type PromoConfig, getEffectivePrice } from "@/lib/promo-engine";
import { MesaTableIcon } from "./-icon-mesa";
import type { ServicePoint } from "./-modal-pontos-atendimento";

const ModalPagamento = lazy(() => import("./-modal-pagamento-pdv"));
const ModalAbrirCaixa = lazy(() =>
  import("./-modais-caixa-pdv").then(m => ({ default: m.ModalAbrirCaixa }))
);
const ModalFecharCaixa = lazy(() =>
  import("./-modais-caixa-pdv").then(m => ({ default: m.ModalFecharCaixa }))
);
const ModalMovimentar = lazy(() =>
  import("./-modais-caixa-pdv").then(m => ({ default: m.ModalMovimentar }))
);
const ModalSessoes = lazy(() =>
  import("./-modais-caixa-pdv").then(m => ({ default: m.ModalSessoes }))
);
const MenuFuncoesPDV = lazy(() =>
  import("./-menu-funcoes-pdv").then(m => ({ default: m.MenuFuncoesPDV }))
);
const ModalCaixaInfo = lazy(() =>
  import("./-menu-funcoes-pdv").then(m => ({ default: m.ModalCaixaInfo }))
);
const ModalPosicaoCaixa = lazy(() =>
  import("./-menu-funcoes-pdv").then(m => ({ default: m.ModalPosicaoCaixa }))
);
const ModalApontamento = lazy(() =>
  import("./-menu-funcoes-pdv").then(m => ({ default: m.ModalApontamento }))
);
const ModalEncerrarEncomenda = lazy(() => import("./-modal-encerrar-encomenda-pdv"));
const ModalPontosAtendimento = lazy(() =>
  import("./-modal-pontos-atendimento").then(m => ({ default: m.ModalPontosAtendimento }))
);

export const Route = createFileRoute("/admin/pdv")({
  component: PDVPage,
  head: () => ({ meta: [{ title: "PDV — ARMAZIX" }] }),
});

// ─── Tipos ───────────────────────────────────────────────────────
interface Product {
  id: string; name: string; price: string; categoryId: string | null;
  stock: number | null; emoji: string | null; imageUrl: string | null;
  barcode: string | null; sku: string | null; active: boolean | null;
  promoConfig: PromoConfig | null; isMadeToOrder: boolean | null;
}
interface Category {
  id: string; name: string; parentId: string | null;
  position: number | null; active: boolean | null;
}
interface CartItem {
  productId: string; name: string; price: number; qty: number;
  emoji: string; imageUrl: string | null;
}
// Ponto de atendimento (mesa/comanda) enriquecido com a sessão aberta (se
// houver) — vem de GET /api/service-points/list. null nos dois campos =
// livre; preenchido = ocupado.
type Ponto = ServicePoint & { openSessionId: string | null; openedAt: string | null };
interface SessaoEncerrada {
  id: string; nameOrNumber: string; type: "MESA" | "CARTAO";
  openedAt: string; closedAt: string;
  orderId: string | null; orderNumber: number | null; orderTotal: string | null; paymentMethod: string | null;
}
export interface CaixaSessao {
  id: string; saldoInicial: string; saldoFinal: string | null;
  totalDinheiro: string; totalPix: string; totalCartao: string;
  totalDebito: string; totalOutros: string; totalVendas: number;
  status: string; abertoPor: string | null; openedAt: string; closedAt: string | null;
  /** "web" (painel admin) ou "desktop" (app PDV Electron/Flutter). */
  origem?: "web" | "desktop";
}
export interface CaixaMovimento {
  id: string; tipo: string; valor: string; motivo: string | null;
  criadoPor: string | null; createdAt: string;
}
type ModalType =
  | "payment" | "abrir-caixa" | "fechar-caixa" | "movimentar" | "sessoes"
  | "funcoes" | "caixa-info" | "posicao" | "apontamento" | "encerrar-encomenda"
  | "pontos-atendimento" | null;
type PdvMode  = "catalog" | "map" | "delivery";

// ─── Encomendas pendentes (pedidos de delivery/retirada do site ainda não
// concretizados — reserva de estoque, sem forma de pagamento real
// confirmada) ────────────────────────────────────────────────────────────
export interface EncomendaItem {
  id: string; productId: string | null; productName: string;
  quantity: number; unitPrice: string; total: string;
}
export interface Encomenda {
  id: string; number: number; type: string; status: string;
  total: string; paymentMethod: string | null; paymentStatus: string | null;
  concretizedAt: string | null; createdAt: string;
  customer: { id: string; name: string | null; phone?: string | null } | null;
  items: EncomendaItem[];
  addressSnapshot: {
    street?: string; number?: string; neighborhood?: string; city?: string; state?: string;
  } | null;
}

// ─── Formas de pagamento + planos (vínculo N:N) ───────────────────
interface PdvPaymentPlan {
  id: string; codigo: number; nome: string;
  tipo: "avista" | "dia" | "mes"; parcelas: number; quantidade: number;
}
export interface PdvPaymentMethod {
  id: string; key: string; label: string;
  sigla?: string | null; especie?: string | null;
  maxInstallments: number; plans: PdvPaymentPlan[];
}
const DEFAULT_PDV_METHODS: PdvPaymentMethod[] = [
  { id: "cash", key: "cash", label: "Dinheiro",          maxInstallments: 1,  plans: [] },
  { id: "pix",  key: "pix",  label: "PIX",               maxInstallments: 1,  plans: [] },
  { id: "card", key: "card", label: "Cartão de Crédito", maxInstallments: 12, plans: [] },
  { id: "debit",key: "debit",label: "Cartão de Débito",  maxInstallments: 1,  plans: [] },
];

// ─── helpers ─────────────────────────────────────────────────────
export const fmtBRL = (v: number | string) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return "R$ " + (isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ","));
};
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Só 2 estados de verdade hoje (ocupado = tem sessão aberta) — o antigo
// terceiro estado "aguardando pagamento" não tinha nenhuma fonte de dado
// real (getStatus era hardcoded "livre" antes dessa mudança).
const STATUS_STYLE = {
  livre:   { dot: "bg-emerald-500", label: "Livre",   badge: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200 bg-emerald-50 border-emerald-200" },
  ocupada: { dot: "bg-blue-500",    label: "Ocupada", badge: "bg-blue-100 text-blue-700",       ring: "ring-blue-200 bg-blue-50 border-blue-200" },
} as const;

const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// "Mesa 2" antes de "Mesa 10" — mesmo comparador natural já usado no modal
// de cadastro (-modal-pontos-atendimento.tsx), pra manter 1,2,3,4... em vez
// de ordem alfabética pura (que colocaria "Mesa 10" antes de "Mesa 2").
const naturalSort = (a: Ponto, b: Ponto) =>
  a.nameOrNumber.localeCompare(b.nameOrNumber, "pt-BR", { numeric: true });

// ─── Painel de Abertura de Caixa (coluna direita, sem modal) ────────
function PainelAbrirCaixa({ onAberto }: { onAberto: (s: CaixaSessao) => void }) {
  const [saldo,   setSaldo]   = useState("");
  const [resp,    setResp]    = useState("");
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState("");

  const handleAbrir = async () => {
    setErro(""); setLoading(true);
    try {
      const res  = await api.post("/api/pdv/caixa/abrir", { saldoInicial: saldo || "0", abertoPor: resp || undefined });
      const data = await res.json() as { success?: boolean; sessao?: CaixaSessao; error?: string };
      if (!res.ok || !data.success) { setErro(data.error || "Erro ao abrir caixa"); return; }
      onAberto(data.sessao!);
    } catch { setErro("Erro de rede. Verifique sua conexão."); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Cabeçalho da coluna — mantém visual consistente com o CartPanel */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <LockKeyhole className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-xs font-bold text-muted-foreground">Caixa Fechado</h2>
      </div>

      {/* Conteúdo centralizado */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        {/* Ícone */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-5 shadow-sm">
          <Unlock className="w-8 h-8 text-emerald-500" />
        </div>

        {/* Título + subtítulo */}
        <h3 className="text-base font-bold text-foreground text-center">Abrir Caixa</h3>
        <p className="text-xs text-muted-foreground text-center mt-1 leading-relaxed max-w-[220px]">
          Informe o saldo inicial em espécie e o nome do operador para liberar as vendas.
        </p>

        {/* Formulário */}
        <div className="w-full mt-6 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Saldo Inicial (R$)
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={saldo}
              onChange={e => setSaldo(e.target.value.replace(/-/g, ""))}
              onKeyDown={e => (e.key === "-" || e.key === "e") && e.preventDefault()}
              placeholder="0,00"
              autoFocus
              className="mt-1 h-11 rounded-xl text-base font-semibold text-center"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Responsável
            </label>
            <Input
              value={resp}
              onChange={e => setResp(e.target.value)}
              placeholder="Nome do operador"
              className="mt-1 h-10 rounded-xl text-sm"
            />
          </div>

          {erro && (
            <p className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{erro}
            </p>
          )}

          <button
            onClick={handleAbrir}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-100 mt-1"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Unlock className="w-4 h-4" />Abrir Caixa</>}
          </button>
        </div>

        {/* Dica visual de que o catálogo está acessível */}
        <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
          Você pode navegar pelo catálogo e mesas enquanto prepara a abertura.
        </p>
      </div>
    </div>
  );
}

// ─── Mapa de Atendimentos (Mesas/Comandas) ────────────────────────
function MesaMap({
  points, activePonto, sessaoId, onSelect, onPontosChanged,
}: {
  points: Ponto[]; activePonto: Ponto | null; sessaoId: string | null;
  onSelect: (p: Ponto) => void; onPontosChanged: () => void;
}) {
  const [tab, setTab] = useState<"all" | "ocupados" | "livres" | "encerrados">("all");
  const [closedSessions, setClosedSessions] = useState<SessaoEncerrada[]>([]);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "encerrados" || !sessaoId) return;
    setLoadingClosed(true);
    fetch(`/api/service-points/sessions/closed?sessaoId=${sessaoId}`)
      .then(r => r.json())
      .then((d: { sessions?: SessaoEncerrada[] }) => setClosedSessions(d.sessions || []))
      .catch(() => {})
      .finally(() => setLoadingClosed(false));
  }, [tab, sessaoId]);

  const ocupados = points.filter(p => p.openSessionId !== null);
  const livres   = points.filter(p => p.openSessionId === null);
  const filtered = tab === "ocupados" ? ocupados : tab === "livres" ? livres : points;
  const mesas    = filtered.filter(p => p.type === "MESA").sort(naturalSort);
  const comandas = filtered.filter(p => p.type === "CARTAO").sort(naturalSort);

  const TABS: { id: "all" | "ocupados" | "livres" | "encerrados"; label: string; count: number | null }[] = [
    { id: "all",        label: "Todos",      count: points.length },
    { id: "ocupados",   label: "Ocupados",   count: ocupados.length },
    { id: "livres",     label: "Livres",     count: livres.length },
    { id: "encerrados", label: "Encerrados", count: null },
  ];

  // Livre → abre a sessão e já entra na mesa. Ocupada → só retoma (nunca
  // abre uma segunda sessão pro mesmo ponto).
  const handleCardClick = async (p: Ponto) => {
    if (busyId) return;
    if (p.openSessionId) { onSelect(p); return; }
    setBusyId(p.id);
    try {
      const res  = await api.post("/api/service-points/sessions/open", { servicePointId: p.id });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) { onPontosChanged(); onSelect(p); }
      else alert(data.error || "Erro ao abrir atendimento");
    } catch { alert("Erro de conexão"); }
    finally { setBusyId(null); }
  };

  // "Liberar mesa" — cliente foi embora sem pedir, sem passar pelo pagamento.
  const handleLiberar = async (p: Ponto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busyId) return;
    setBusyId(p.id);
    try {
      const res  = await api.post("/api/service-points/sessions/close", { servicePointId: p.id });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) onPontosChanged();
      else alert(data.error || "Erro ao liberar");
    } catch { alert("Erro de conexão"); }
    finally { setBusyId(null); }
  };

  if (points.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Nenhum ponto de atendimento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre mesas ou comandas no Menu de Funções → Configurações</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
              tab === t.id ? "bg-emerald-500 text-white shadow-sm" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
            {t.count !== null && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 ${tab === t.id ? "bg-white/25" : "bg-card"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "encerrados" ? (
        !sessaoId ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">Abra o caixa pra ver o histórico de atendimentos encerrados.</p>
          </div>
        ) : loadingClosed ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : closedSessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum atendimento encerrado nessa sessão de caixa ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {closedSessions.map(s => {
              const Icon = s.type === "MESA" ? MesaTableIcon : CreditCard;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.nameOrNumber}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtHora(s.openedAt)} — {fmtHora(s.closedAt)}</p>
                  </div>
                  <span className="text-xs font-bold text-foreground tabular-nums shrink-0">
                    {s.orderTotal ? fmtBRL(s.orderTotal) : "Sem venda"}
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === "ocupados" ? "Nenhum ponto ocupado agora." : "Nenhum ponto livre agora."}
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {/* Mesas e Comandas/Cartões ficam em seções separadas, cada uma
              ordenada 1,2,3,4... (ordem natural, não alfabética pura) —
              são fluxos de atendimento distintos mesmo dentro da mesma aba. */}
          {(
            [
              { label: "Mesas",             items: mesas    },
              { label: "Comandas/Cartões",  items: comandas },
            ] as const
          ).map(group => group.items.length === 0 ? null : (
            <div key={group.label}>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">
                {group.label}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
                {group.items.map(p => {
                  const occupied    = p.openSessionId !== null;
                  const cfg         = occupied ? STATUS_STYLE.ocupada : STATUS_STYLE.livre;
                  const Icon        = p.type === "MESA" ? MesaTableIcon : CreditCard;
                  const isSelected  = activePonto?.id === p.id;
                  return (
                    <button key={p.id} onClick={() => handleCardClick(p)} disabled={busyId === p.id}
                      className={`relative flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 text-center transition-all duration-150 active:scale-[0.97] cursor-pointer disabled:opacity-60 ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100 shadow-md"
                          : `${cfg.ring} hover:shadow-md`
                      }`}>
                      <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${cfg.dot}`} />
                      {occupied && (
                        <span onClick={e => handleLiberar(p, e)} title="Liberar mesa"
                          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:bg-white hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </span>
                      )}
                      <Icon className="w-6 h-6 text-foreground mt-1" />
                      <span className="text-xs font-bold text-foreground leading-tight">{p.nameOrNumber}</span>
                      {p.customerName && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-full">{p.customerName}</span>
                      )}
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ENCOMENDA_PAY_LABEL: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Crédito", debit: "Débito", mercadopago: "Mercado Pago",
};

// ─── Encomendas pendentes (delivery/retirada do site) ─────────────
function EncomendasList({
  encomendas, onSelect,
}: { encomendas: Encomenda[]; onSelect: (e: Encomenda) => void }) {
  if (encomendas.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Package className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Nenhuma encomenda pendente</p>
          <p className="text-sm text-muted-foreground mt-1">Pedidos de delivery/retirada do site aparecem aqui até serem encerrados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {encomendas.map(enc => {
          const itemsSummary = enc.items.map(i => `${i.quantity}× ${i.productName}`).join(", ");
          const knownPayment = enc.paymentStatus === "paid" && enc.paymentMethod;
          return (
            <button key={enc.id} onClick={() => onSelect(enc)}
              className="group relative flex flex-col gap-2 p-4 rounded-2xl border-2 border-border text-left transition-all duration-150 active:scale-[0.97] cursor-pointer hover:border-emerald-400 hover:shadow-md bg-card">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  <Package className="w-3 h-3" />Pendente
                </span>
                <span className="text-xs font-black text-foreground tabular-nums">#{enc.number}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground truncate">{enc.customer?.name || "Cliente"}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">{itemsSummary}</p>
              </div>
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  enc.type === "pickup"
                    ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/8"
                    : "border-blue-500/30 text-blue-600 bg-blue-500/8"
                }`}>
                  {enc.type === "pickup" ? "Retirada" : "Entrega"}
                </span>
                <span className="text-sm font-black text-emerald-600 tabular-nums">{fmtBRL(enc.total)}</span>
              </div>
              {knownPayment && (
                <span className="text-[10px] text-muted-foreground">
                  Pago via {ENCOMENDA_PAY_LABEL[enc.paymentMethod!] ?? enc.paymentMethod}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Carrinho (drawer mobile / coluna desktop) ────────────────────
function CartPanel({
  cart, activePonto, discount, discountType, total, subtotal, discountValue, totalQty,
  sessao, lancandoPedido, lancadoOk,
  onUpdateQty, onRemove, onClear, onSetDiscount, onSetDiscountType,
  onOpenPayment, onLancarPedido, onOpenMovimentar, onFecharCaixa, onClose,
}: {
  cart: CartItem[]; activePonto: Ponto | null; discount: number; discountType: "pct" | "brl";
  total: number; subtotal: number; discountValue: number; totalQty: number;
  sessao: CaixaSessao | null; lancandoPedido: boolean; lancadoOk: boolean;
  onUpdateQty: (id: string, d: number) => void; onRemove: (id: string) => void; onClear: () => void;
  onSetDiscount: (v: number) => void; onSetDiscountType: (t: "pct" | "brl") => void;
  onOpenPayment: () => void; onLancarPedido: () => void; onOpenMovimentar: (t: "sangria" | "suprimento") => void;
  onFecharCaixa: () => void; onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-500" />
          <div>
            <h2 className="text-xs font-bold text-foreground leading-none">
              {activePonto ? activePonto.nameOrNumber : "Carrinho"}
            </h2>
            {activePonto && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Atendimento aberto</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalQty > 0 && (
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              {totalQty} {totalQty === 1 ? "item" : "itens"}
            </span>
          )}
          {cart.length > 0 && (
            <button onClick={onClear} title="Limpar"
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors lg:hidden">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 opacity-20" />
            <p className="text-xs text-center">Carrinho vazio<br /><span className="text-muted-foreground">Toque nos produtos</span></p>
          </div>
        ) : cart.map(item => (
          <div key={item.productId}
            className="flex items-center gap-2.5 bg-secondary border border-border rounded-xl px-3 py-2.5 hover:border-border transition-colors">
            {/* Thumb */}
            <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 overflow-hidden">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-0.5" />
                : item.emoji
                  ? <span className="text-base">{item.emoji}</span>
                  : <Package className="w-4 h-4 text-muted-foreground" />
              }
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">{item.qty}× {fmtBRL(item.price)}</p>
            </div>
            {/* Total */}
            <span className="text-xs font-bold text-foreground tabular-nums shrink-0 w-16 text-right">
              {fmtBRL(item.price * item.qty)}
            </span>
            {/* Controls */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => onUpdateQty(item.productId, -1)}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-muted-foreground transition-colors">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-[11px] font-bold text-foreground">{item.qty}</span>
              <button onClick={() => onUpdateQty(item.productId, 1)}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-muted-foreground transition-colors">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={() => onRemove(item.productId)}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border space-y-3 shrink-0">
        {/* Desconto */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
            {(["pct", "brl"] as const).map(t => (
              <button key={t} onClick={() => onSetDiscountType(t)}
                className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${discountType === t ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}>
                {t === "pct" ? "%" : "R$"}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input type="number" min={0} max={discountType === "pct" ? 100 : undefined}
              value={discount || ""} onChange={e => onSetDiscount(Number(e.target.value))}
              placeholder={discountType === "pct" ? "Desconto %" : "Desconto R$"}
              className="pl-7 h-8 rounded-lg text-xs" />
          </div>
          {discount > 0 && (
            <button onClick={() => onSetDiscount(0)} className="shrink-0 p-1 rounded-md hover:bg-secondary transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Totais */}
        <div className="bg-secondary border border-border rounded-2xl px-4 py-3 space-y-1.5">
          {subtotal !== total && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span><span className="tabular-nums">{fmtBRL(subtotal)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-xs text-amber-600 font-medium">
              <span>Desconto</span><span className="tabular-nums">−{fmtBRL(discountValue)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
            <span className={`text-3xl font-black tabular-nums leading-none ${cart.length === 0 ? "text-muted-foreground" : "text-emerald-600"}`}>
              {fmtBRL(total)}
            </span>
          </div>
        </div>

        {/* Ações — "Lançar Item" só existe com um atendimento aberto (mesa/
            comanda): é a confirmação de que os itens do carrinho foram
            registrados naquele atendimento, antes do pagamento. Genérico
            pra qualquer tipo de negócio, não só cozinha/restaurante. */}
        {activePonto ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onLancarPedido} disabled={cart.length === 0 || lancandoPedido}
              className={`h-12 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                lancadoOk
                  ? "bg-sky-50 text-sky-600 border-sky-300"
                  : "bg-card border-border text-muted-foreground hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700"
              }`}>
              {lancandoPedido ? <Loader2 className="w-4 h-4 animate-spin" />
                : lancadoOk ? <><CheckCircle2 className="w-4 h-4 text-sky-500" />Lançado!</>
                : <><ClipboardCheck className="w-4 h-4" />Lançar Item [F3]</>}
            </button>
            <button onClick={onOpenPayment} disabled={cart.length === 0 || !sessao}
              className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-secondary disabled:text-muted-foreground text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-100">
              <CreditCard className="w-4 h-4" />Pagamento [F2]
            </button>
          </div>
        ) : (
          <button onClick={onOpenPayment} disabled={cart.length === 0 || !sessao}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-secondary disabled:text-muted-foreground text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-100">
            <CreditCard className="w-4 h-4" />Pagamento [F2]
          </button>
        )}

        {/* Caixa actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => onOpenMovimentar("sangria")}
            className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200">
            <ArrowDownCircle className="w-3.5 h-3.5" />Sangria
          </button>
          <span className="text-muted-foreground select-none">|</span>
          <button onClick={() => onOpenMovimentar("suprimento")}
            className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200">
            <ArrowUpCircle className="w-3.5 h-3.5" />Suprimento
          </button>
          <span className="text-muted-foreground select-none">|</span>
          <button onClick={onFecharCaixa}
            className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors border border-transparent hover:border-border">
            <LockKeyhole className="w-3.5 h-3.5" />Fechar
          </button>
        </div>

        {/* Caixa info */}
        {sessao && (
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">
              Caixa aberto {fmtDate(sessao.openedAt)} · {sessao.abertoPor || "—"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PDVPage ──────────────────────────────────────────────────────
function PDVPage() {
  const [products, setProducts]           = useState<Product[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [points, setPoints]               = useState<Ponto[]>([]);
  const [sessao, setSessao]               = useState<CaixaSessao | null>(null);
  const [movimentos, setMovimentos]       = useState<CaixaMovimento[]>([]);
  const [activeCategoryId, setActiveCategoryId]       = useState<string | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [discount, setDiscount]           = useState(0);
  const [discountType, setDiscountType]   = useState<"pct" | "brl">("pct");
  const [modal, setModal]                 = useState<ModalType>(null);
  const [pdvMode, setPdvMode]             = useState<PdvMode>("catalog");
  const [activePonto, setActivePonto]     = useState<Ponto | null>(null);
  const [movTipo, setMovTipo]             = useState<"sangria" | "suprimento">("sangria");
  const [showCart, setShowCart]           = useState(false); // mobile cart drawer
  const [submitting, setSubmitting]       = useState(false);
  const [orderNumber, setOrderNumber]     = useState<number | null>(null);
  const [lancando, setLancando]           = useState(false);
  const [lancadoOk, setLancadoOk]        = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PdvPaymentMethod[]>(DEFAULT_PDV_METHODS);
  const [storeId, setStoreId]             = useState("");
  const [encomendas, setEncomendas]       = useState<Encomenda[]>([]);
  const [selectedEncomenda, setSelectedEncomenda] = useState<Encomenda | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Encomendas pendentes (delivery/retirada do site ainda não
  // concretizadas) — buscadas junto com o resto e recarregadas a cada 30s
  // pra novos pedidos aparecerem sem precisar recarregar a página. ──
  const fetchEncomendas = useCallback((sid: string) => {
    fetch(`/api/orders/list?storeId=${sid}`)
      .then(r => r.json())
      .then((d: { orders?: Encomenda[] }) => {
        setEncomendas((d.orders || []).filter(o => o.concretizedAt === null && o.status !== "cancelled"));
      })
      .catch(() => {});
  }, []);

  // ── Pontos de atendimento (mesas/comandas) — usada tanto no fetch
  // inicial quanto pra atualizar o mapa depois de abrir/liberar/vender. ──
  const fetchPoints = useCallback(() => {
    fetch(`/api/service-points/list`)
      .then(r => r.json())
      .then((d: { servicePoints?: Ponto[] }) => setPoints(d.servicePoints || []))
      .catch(() => {});
  }, []);

  // ── Fetch inicial ──
  useEffect(() => {
    const sid = localStorage.getItem("storeId") || "";
    setStoreId(sid);
    if (!sid) return;
    Promise.all([
      fetch(`/api/products/list-admin?storeId=${sid}&scope=pdv`).then(r => r.json()),
      fetch(`/api/categories/list-admin?storeId=${sid}`).then(r => r.json()),
      fetch(`/api/payment-methods/for-pdv`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/service-points/list`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/pdv/caixa`).then(r => r.json()).catch(() => ({})),
    ]).then(([pd, cd, pmd, spd, cx]) => {
      if (pd.products)  setProducts(pd.products);
      if (cd.categories) setCategories(cd.categories);
      if (pmd.methods?.length) setPaymentConfig(pmd.methods);
      if (spd.servicePoints) setPoints(spd.servicePoints);
      if (cx.sessao)    { setSessao(cx.sessao); setMovimentos(cx.movimentos || []); }
      if (sid) fetchEncomendas(sid);
    }).catch(() => {});
  }, [fetchEncomendas]);

  // ── Encomendas pendentes — recarrega a cada 30s pra novos pedidos do
  // site aparecerem sem precisar sair e voltar na aba. ──
  useEffect(() => {
    if (!storeId) return;
    const interval = setInterval(() => fetchEncomendas(storeId), 30_000);
    return () => clearInterval(interval);
  }, [storeId, fetchEncomendas]);

  // ── Categorias ──
  const rootCats = categories
    .filter(c => c.active !== false && !c.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const subCats = activeCategoryId
    ? categories.filter(c => c.active !== false && c.parentId === activeCategoryId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];

  const getDescIds = (catId: string): string[] => {
    const ch = categories.filter(c => c.active !== false && c.parentId === catId);
    return [catId, ...ch.flatMap(c => getDescIds(c.id))];
  };
  const filterCatId  = activeSubCategoryId ?? activeCategoryId;
  const activeCatIds = filterCatId ? new Set(getDescIds(filterCatId)) : null;

  // ── Filtro de produtos ──
  const q = search.trim().toLowerCase();
  const filtered = products.filter(p => {
    if (activeCatIds && !activeCatIds.has(p.categoryId ?? "")) return false;
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.barcode && p.barcode.toLowerCase() === q) return true;
    if (p.sku && p.sku.toLowerCase() === q) return true;
    return false;
  });

  // ── Cart ──
  const addToCart = useCallback((product: Product) => {
    if (product.active === null) {
      alert(`"${product.name}" está suspenso e não pode ser vendido.`);
      return;
    }
    const { effectivePrice } = getEffectivePrice(product.price, product.promoConfig, "pdv");
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, price: effectivePrice, qty: 1, emoji: product.emoji || "", imageUrl: product.imageUrl || null }];
    });
  }, []);

  const updateQty    = (id: string, d: number) =>
    setCart(prev => prev.map(i => i.productId === id ? { ...i, qty: i.qty + d } : i).filter(i => i.qty > 0));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.productId !== id));

  const subtotal      = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountValue = discountType === "pct" ? subtotal * (discount / 100) : Math.min(discount, subtotal);
  const total         = subtotal - discountValue;
  const totalQty      = cart.reduce((s, i) => s + i.qty, 0);

  // ── Confirma o lançamento dos itens no atendimento aberto (mesa/comanda) ──
  const handleLancarPedido = useCallback(() => {
    if (!cart.length || lancando || !activePonto) return;
    setLancando(true);
    setTimeout(() => { setLancando(false); setLancadoOk(true); setTimeout(() => setLancadoOk(false), 2200); }, 700);
  }, [cart, lancando, activePonto]);

  // ── Finalizar venda ──
  const handleFinalize = async (method: string, installments: number) => {
    if (submitting || !sessao) return;
    setSubmitting(true);
    try {
      const res  = await api.post("/api/pdv/finalizar-venda", {
        sessaoId:       sessao.id,
        mesaLabel:      activePonto?.nameOrNumber,
        servicePointId: activePonto?.id,
        paymentMethod: method,
        installments:  installments > 1 ? installments : undefined,
        items:         cart.map(item => ({
          productId:    item.productId,
          productName:  item.name,
          productEmoji: item.emoji,
          quantity:     item.qty,
          unitPrice:    item.price.toFixed(2),
          total:        (item.price * item.qty).toFixed(2),
        })),
        subtotal: subtotal.toFixed(2),
        discount: discountValue.toFixed(2),
        total:    total.toFixed(2),
      });
      const data = await res.json() as { success?: boolean; order?: { number: number }; error?: string };
      if (res.ok && data.success && data.order) {
        setOrderNumber(data.order.number);
        // Atualiza sessão local
        setSessao(prev => prev ? { ...prev, totalVendas: prev.totalVendas + 1 } : prev);
        // Libera o ponto de atendimento no mapa (a sessão dele já foi
        // fechada no servidor, dentro da mesma transação do pedido).
        if (activePonto) fetchPoints();
      }
    } catch {} finally { setSubmitting(false); }
  };

  const handleNovaNota = () => {
    setModal(null); setCart([]); setDiscount(0); setDiscountType("pct");
    setOrderNumber(null); setActivePonto(null); setShowCart(false);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ── Abertura de caixa ──
  const handleCaixaAberto = (s: CaixaSessao) => { setSessao(s); setModal(null); };

  // ── Fechamento de caixa ──
  const handleCaixaFechado = () => {
    setSessao(null); setMovimentos([]); setCart([]); setDiscount(0);
    setActivePonto(null); setModal(null);
  };

  // ── Movimentação ──
  const handleMovimento = (m: CaixaMovimento) => { setMovimentos(prev => [m, ...prev]); setModal(null); };

  // ── Encerramento de encomenda (aba Delivery) ──
  const handleEncomendaEncerrada = (orderId: string) => {
    setEncomendas(prev => prev.filter(e => e.id !== orderId));
    setSelectedEncomenda(null);
    setModal(null);
  };

  // ── Atalhos de teclado ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1")     { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F2")     { e.preventDefault(); if (cart.length > 0 && sessao) setModal("payment"); }
      if (e.key === "F3")     { e.preventDefault(); handleLancarPedido(); }
      if (e.key === "F4")     { e.preventDefault(); if (sessao) { setMovTipo("sangria"); setModal("movimentar"); } }
      if (e.key === "F5")     { e.preventDefault(); setPdvMode(m => m === "map" ? "catalog" : "map"); }
      if (e.key === "Escape") { e.preventDefault(); setModal(null); setShowCart(false); }
      // Menu de Funções (Caixa) — atalhos Alt+ do menu de referência
      if (e.altKey && e.key.toLowerCase() === "a") { e.preventDefault(); setModal(sessao ? "caixa-info" : "abrir-caixa"); }
      if (e.altKey && e.key.toLowerCase() === "p") { e.preventDefault(); if (sessao) setModal("posicao"); }
      if (e.altKey && e.key.toLowerCase() === "o") { e.preventDefault(); if (sessao) setModal("apontamento"); }
      if (e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); if (sessao) { setMovTipo("suprimento"); setModal("movimentar"); } }
      if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); if (sessao) { setMovTipo("sangria"); setModal("movimentar"); } }
      if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); if (sessao) setModal("sessoes"); }
      if (e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); if (sessao) setModal("fechar-caixa"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, sessao, handleLancarPedido]);

  const cartProps = {
    cart, activePonto, discount, discountType, total, subtotal, discountValue, totalQty,
    sessao, lancandoPedido: lancando, lancadoOk,
    onUpdateQty: updateQty, onRemove: removeFromCart, onClear: () => setCart([]),
    onSetDiscount: setDiscount, onSetDiscountType: setDiscountType,
    onOpenPayment: () => cart.length > 0 && sessao && setModal("payment"),
    onLancarPedido: handleLancarPedido,
    onOpenMovimentar: (t: "sangria" | "suprimento") => { if (!sessao) return; setMovTipo(t); setModal("movimentar"); },
    onFecharCaixa: () => sessao && setModal("fechar-caixa"),
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100%+2rem)] sm:h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)] overflow-hidden bg-secondary -m-4 sm:-m-6 lg:-m-8">
      <div className="flex flex-1 min-h-0">

        {/* ═══════════════════════════════════════════
            COLUNA ESQUERDA — Catálogo / Mapa
        ════════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ── Topbar: modo + mesa ── */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
              <button onClick={() => setPdvMode("catalog")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${pdvMode === "catalog" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <LayoutGrid className="w-3.5 h-3.5" />Catálogo
              </button>
              <button onClick={() => setPdvMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${pdvMode === "map" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <LayoutDashboard className="w-3.5 h-3.5" />Atendimentos
                <kbd className="text-[9px] font-mono bg-secondary px-1 rounded">F5</kbd>
              </button>
              <button onClick={() => setPdvMode("delivery")}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${pdvMode === "delivery" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Package className="w-3.5 h-3.5" />Delivery
                {encomendas.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {encomendas.length > 9 ? "9+" : encomendas.length}
                  </span>
                )}
              </button>
            </div>

            {activePonto && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activePonto.nameOrNumber}
                <button onClick={() => setActivePonto(null)} className="ml-0.5 opacity-50 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Sessão info + Sessões + Menu de Funções */}
            <div className="ml-auto flex items-center gap-2">
              {sessao && (
                <button onClick={() => setModal("sessoes")}
                  className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors">
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>Sessões</span>
                </button>
              )}
              <button onClick={() => setModal("funcoes")} title="Menu de Funções"
                className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <Settings className="w-4 h-4" />
              </button>
              {/* Mobile cart toggle — só no Catálogo, mesma regra do carrinho */}
              {(!sessao || pdvMode === "catalog") && (
              <button onClick={() => setShowCart(true)}
                className="relative lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-100">
                <ShoppingCart className="w-4 h-4" />
                {totalQty > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {totalQty > 9 ? "9+" : totalQty}
                  </span>
                )}
              </button>
              )}
            </div>
          </div>

          {/* ── Conteúdo: Catálogo, Mapa ou Delivery ── */}
          {pdvMode === "map" ? (
            <MesaMap
              points={points}
              activePonto={activePonto}
              sessaoId={sessao?.id ?? null}
              onSelect={p => { setActivePonto(p); setPdvMode("catalog"); }}
              onPontosChanged={fetchPoints}
            />
          ) : pdvMode === "delivery" ? (
            <EncomendasList encomendas={encomendas} onSelect={e => {
              if (!sessao) { setModal("abrir-caixa"); return; }
              setSelectedEncomenda(e); setModal("encerrar-encomenda");
            }} />
          ) : (
            <>
              {/* Categorias */}
              {rootCats.length > 0 && (
                <div className="shrink-0 bg-card border-b border-border">
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                    <button onClick={() => { setActiveCategoryId(null); setActiveSubCategoryId(null); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0 transition-all ${
                        !activeCategoryId
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-border"
                      }`}>
                      <LayoutGrid className={`w-3 h-3 ${!activeCategoryId ? "text-white" : "text-muted-foreground"}`} />
                      Todos
                    </button>
                    {rootCats.map(cat => {
                      const isActive = activeCategoryId === cat.id;
                      return (
                        <button key={cat.id}
                          onClick={() => { setActiveCategoryId(isActive ? null : cat.id); setActiveSubCategoryId(null); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0 transition-all ${
                            isActive
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                              : "bg-card text-muted-foreground border-border hover:border-border"
                          }`}>
                          <Tag className={`w-3 h-3 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                  {subCats.length > 0 && (
                    <div className="border-t border-border">
                      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
                        {subCats.map(sub => {
                          const isActive = activeSubCategoryId === sub.id;
                          return (
                            <button key={sub.id}
                              onClick={() => setActiveSubCategoryId(isActive ? null : sub.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border shrink-0 transition-all ${
                                isActive
                                  ? "bg-foreground text-background border-foreground"
                                  : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                              }`}>
                              <ChevronRight className={`w-2.5 h-2.5 ${isActive ? "text-background" : "text-muted-foreground"}`} />
                              {sub.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Busca */}
              <div className="px-3 pt-2.5 pb-2 shrink-0 bg-secondary">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar produto, código de barras ou SKU..." autoFocus
                    className="w-full h-11 bg-card border border-border focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm rounded-xl pl-10 pr-16 outline-none transition-all text-foreground placeholder:text-muted-foreground shadow-sm" />
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-secondary border border-border px-1.5 py-0.5 rounded font-mono">F1</kbd>
                </div>
              </div>

              {/* Grid de produtos */}
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <Package className="w-10 h-10 opacity-30" />
                    <p className="text-sm">{q ? "Nenhum produto encontrado" : "Nenhum produto disponível"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
                    {filtered.map(product => {
                      const isSuspended = product.active === null;
                      const promoP      = getEffectivePrice(product.price, product.promoConfig, "pdv");
                      return (
                        <button key={product.id} onClick={() => addToCart(product)} disabled={isSuspended}
                          className={`group relative flex flex-col rounded-xl overflow-hidden text-left transition-all duration-150 border bg-card ${
                            isSuspended
                              ? "border-amber-200 opacity-50 cursor-not-allowed"
                              : "border-border hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-50 cursor-pointer active:scale-[0.97]"
                          }`}>
                          {/* Imagem */}
                          <div className="relative w-full aspect-square bg-secondary overflow-hidden">
                            {product.imageUrl
                              ? <img src={product.imageUrl} alt={product.name}
                                  className={`w-full h-full object-contain p-1.5 transition-transform duration-200 ${!isSuspended ? "group-hover:scale-105" : ""}`} />
                              : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {product.emoji
                                    ? <span className={`text-3xl leading-none transition-transform duration-200 ${!isSuspended ? "group-hover:scale-110" : ""}`}>{product.emoji}</span>
                                    : <Package className="w-7 h-7 text-muted-foreground" />}
                                </div>
                              )
                            }
                            {isSuspended && (
                              <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-1.5 py-0.5 leading-none">
                                SUSPENSO
                              </span>
                            )}
                            {promoP.promoActive && (
                              <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-300 rounded-full px-1.5 py-0.5 leading-none">
                                PROMO
                              </span>
                            )}
                            {product.isMadeToOrder && (
                              <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                                ENCOMENDA
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex flex-col gap-1 p-2.5 flex-1">
                            <p className="text-[12px] font-semibold text-foreground leading-tight line-clamp-2 min-h-[2rem]">
                              {product.name}
                            </p>
                            {product.stock !== null && (
                              <p className="text-[10px] text-muted-foreground">Estq: {product.stock}</p>
                            )}
                            <div className="flex items-end justify-between mt-auto pt-1">
                              <div>
                                {promoP.promoActive ? (
                                  <>
                                    <p className="text-[11px] font-bold text-emerald-600 tabular-nums leading-tight">{fmtBRL(promoP.effectivePrice)}</p>
                                    <p className="text-[10px] text-muted-foreground line-through tabular-nums leading-tight">{fmtBRL(promoP.originalPrice!)}</p>
                                  </>
                                ) : (
                                  <p className={`text-[13px] font-bold tabular-nums ${isSuspended ? "text-muted-foreground" : "text-emerald-600"}`}>
                                    {fmtBRL(parseFloat(product.price))}
                                  </p>
                                )}
                              </div>
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                                isSuspended
                                  ? "border border-border text-muted-foreground"
                                  : "border border-border text-muted-foreground group-hover:bg-emerald-500 group-hover:border-emerald-500 group-hover:text-white"
                              }`}>
                                <Plus className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Barra de atalhos ── */}
          <div className="shrink-0 hidden sm:flex items-center gap-3 px-4 py-2 border-t border-border bg-card flex-wrap">
            {[
              { key: "F1", label: "Buscar" },
              { key: "F2", label: "Pagamento" },
              { key: "F3", label: "Lançar Item" },
              { key: "F4", label: "Sangria" },
              { key: "F5", label: "Atendimentos" },
              { key: "ESC", label: "Fechar" },
            ].map(s => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <kbd className="bg-secondary border border-border rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{s.key}</kbd>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            COLUNA DIREITA — Abertura de Caixa ou Carrinho
            (o carrinho só faz sentido no Catálogo — some no Mapa de
            Atendimentos e no Delivery pra não confundir o operador e dar
            mais espaço pro conteúdo; abrir caixa continua sempre visível) ══ */}
        {(!sessao || pdvMode === "catalog") && (
          <div className="hidden lg:flex w-[360px] shrink-0 border-l border-border flex-col h-full">
            {sessao
              ? <CartPanel {...cartProps} />
              : <PainelAbrirCaixa onAberto={handleCaixaAberto} />}
          </div>
        )}
      </div>

      {/* ── Mobile cart drawer (mesma regra da coluna desktop) ── */}
      {showCart && (!sessao || pdvMode === "catalog") && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative ml-auto w-full max-w-sm h-full bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {sessao
              ? <CartPanel {...cartProps} onClose={() => setShowCart(false)} />
              : <PainelAbrirCaixa onAberto={handleCaixaAberto} />}
          </div>
        </div>
      )}

      {/* ── Modais ── */}
      <Suspense fallback={null}>
        {modal === "abrir-caixa" && <ModalAbrirCaixa onAberto={handleCaixaAberto} />}
        {modal === "fechar-caixa" && sessao && (
          <ModalFecharCaixa sessao={sessao} movimentos={movimentos}
            onFechado={handleCaixaFechado} onClose={() => setModal(null)} />
        )}
        {modal === "movimentar" && sessao && (
          <ModalMovimentar sessaoId={sessao.id} tipo={movTipo}
            operador={sessao.abertoPor || ""}
            onFeito={handleMovimento} onClose={() => setModal(null)} />
        )}
        {modal === "sessoes" && storeId && (
          <ModalSessoes storeId={storeId} onClose={() => setModal(null)} />
        )}
        {modal === "funcoes" && (
          <MenuFuncoesPDV
            caixaAberto={!!sessao}
            onClose={() => setModal(null)}
            onCaixaAberto={() => setModal(sessao ? "caixa-info" : "abrir-caixa")}
            onPosicao={() => sessao && setModal("posicao")}
            onApontamento={() => sessao && setModal("apontamento")}
            onSuprimento={() => { if (sessao) { setMovTipo("suprimento"); setModal("movimentar"); } }}
            onSangria={() => { if (sessao) { setMovTipo("sangria"); setModal("movimentar"); } }}
            onAnalise={() => setModal("sessoes")}
            onFechamento={() => sessao && setModal("fechar-caixa")}
            onPontosAtendimento={() => setModal("pontos-atendimento")}
          />
        )}
        {modal === "caixa-info" && sessao && (
          <ModalCaixaInfo sessao={sessao} onClose={() => setModal(null)} />
        )}
        {modal === "posicao" && sessao && (
          <ModalPosicaoCaixa sessao={sessao} movimentos={movimentos} onClose={() => setModal(null)} />
        )}
        {modal === "apontamento" && (
          <ModalApontamento movimentos={movimentos} onClose={() => setModal(null)} />
        )}
        {modal === "encerrar-encomenda" && sessao && selectedEncomenda && (
          <ModalEncerrarEncomenda
            encomenda={selectedEncomenda} sessaoId={sessao.id} paymentConfig={paymentConfig}
            onClose={() => { setModal(null); setSelectedEncomenda(null); }}
            onEncerrado={handleEncomendaEncerrada}
          />
        )}
        {modal === "pontos-atendimento" && (
          // Fecha e já recarrega o mapa — pontos criados/editados na hora
          // (ex: uma "Mesa 12" nova) aparecem sem precisar sair do PDV.
          <ModalPontosAtendimento onClose={() => { setModal(null); fetchPoints(); }} />
        )}
        {modal === "payment" && (
          <ModalPagamento
            total={total} subtotal={subtotal} discountValue={discountValue} discount={discount}
            submitting={submitting} orderNumber={orderNumber} paymentConfig={paymentConfig}
            mesaLabel={activePonto?.nameOrNumber ?? null}
            onClose={() => { setModal(null); if (orderNumber !== null) handleNovaNota(); }}
            onFinalize={handleFinalize} onNovaNota={handleNovaNota}
          />
        )}
      </Suspense>

    </div>
  );
}
