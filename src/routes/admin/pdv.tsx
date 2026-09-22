import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Plus, Minus, Trash2, CreditCard,
  X, ShoppingCart, Percent, Loader2, ArrowDownCircle, ArrowUpCircle,
  Tag, CheckCircle2, Package, LayoutGrid, Clock, ReceiptText,
  ClipboardCheck, LayoutDashboard, Users, Wallet, ChevronRight,
  AlertCircle, LockKeyhole, Unlock, Settings, Grid3x3, HelpCircle, UserCircle, Store,
  ArrowLeft, ClipboardEdit, Ban, CircleDollarSign, Printer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { type PromoConfig, getEffectivePrice } from "@/lib/promo-engine";
import { MesaTableIcon } from "./-icon-mesa";
import type { ServicePoint } from "./-modal-pontos-atendimento";
import { useStoreRole } from "@/hooks/use-store-role";
import { temPermissao } from "@/lib/reports-permissions";
import { useOperadores, verificarOperador, CampoOperador, ModalConfirmarAcao } from "./-caixa-operador";

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
const ModalFechamentoAutomatico = lazy(() =>
  import("./-menu-funcoes-pdv").then(m => ({ default: m.ModalFechamentoAutomatico }))
);
const ModalEncerrarEncomenda = lazy(() => import("./-modal-encerrar-encomenda-pdv"));
const ModalPontosAtendimento = lazy(() =>
  import("./-modal-pontos-atendimento").then(m => ({ default: m.ModalPontosAtendimento }))
);
const ModalConferencia  = lazy(() => import("./-modal-conferencia-pdv"));
const ModalAdiantamento = lazy(() => import("./-modal-adiantamento-pdv"));

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
  emoji: string | null;
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
  id: string; codigo: string; saldoInicial: string; saldoFinal: string | null;
  totalDinheiro: string; totalPix: string; totalCartao: string;
  totalDebito: string; totalOutros: string; totalVendas: number;
  status: string; abertoPor: string | null; openedAt: string; closedAt: string | null;
  /** "web" (painel admin) ou "desktop" (app PDV Electron/Flutter). */
  origem?: "web" | "desktop";
  /** Conferência de fechamento por forma de pagamento — só presente em
   *  sessões encerradas manualmente com conferência preenchida. */
  conferencia?: Array<{ metodo: string; label: string; sistema: string; informado: string; diferenca: string }> | null;
}
export interface CaixaMovimento {
  id: string; tipo: string; valor: string; motivo: string | null;
  criadoPor: string | null; createdAt: string;
}
type ModalType =
  | "payment" | "abrir-caixa" | "fechar-caixa" | "movimentar" | "sessoes"
  | "funcoes" | "caixa-info" | "posicao" | "apontamento" | "encerrar-encomenda"
  | "pontos-atendimento" | "conferencia" | "adiantamento" | "fechamento-automatico" | null;
type PdvMode  = "catalog" | "map" | "delivery";

// ─── Conta em aberto da mesa/comanda (painel de resumo do Mapa de
// Atendimentos) — persistida no servidor via service_point_tab_items /
// service_point_advances (ver src/lib/api/service-point-tab-handler.ts).
export interface TabItem {
  id: string; productId: string | null; productName: string;
  productEmoji: string | null; unitPrice: string; quantity: number;
}
export interface TabAdvance {
  id: string; valor: string; formaPagamento: string; createdAt: string;
}

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
  const operadores = useOperadores();
  const [saldo,   setSaldo]   = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [senha,   setSenha]   = useState("");
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState<string | null>(null);

  // 1) Responsável vem do cadastro de usuários e precisa provar a senha —
  // mesma regra do ModalAbrirCaixa (-modais-caixa-pdv.tsx). Só depois disso
  // o popup de confirmação aparece.
  const handleValidar = async () => {
    setErro("");
    if (!operadorId)   { setErro("Selecione o responsável"); return; }
    if (!senha.trim()) { setErro("Informe a senha"); return; }
    setLoading(true);
    const r = await verificarOperador(operadorId, senha);
    setLoading(false);
    if (!r.ok) { setErro(r.error); return; }
    setNomeConfirmado(r.name);
  };

  // 2) Só executa de verdade depois do "Confirmar" no popup — o backend
  // confere a senha de novo (abrirCaixaHandler), não confia só no passo 1.
  const handleAbrir = async () => {
    setLoading(true);
    try {
      const res  = await api.post("/api/pdv/caixa/abrir", { saldoInicial: saldo || "0", operadorId, senha, origem: "web" });
      const data = await res.json() as { success?: boolean; sessao?: CaixaSessao; error?: string };
      if (!res.ok || !data.success) { setErro(data.error || "Erro ao abrir caixa"); setNomeConfirmado(null); return; }
      onAberto(data.sessao!);
    } catch { setErro("Erro de rede. Verifique sua conexão."); setNomeConfirmado(null); }
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
          Informe o saldo inicial em espécie, selecione o responsável e confirme com a senha para liberar as vendas.
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
          <CampoOperador
            operadores={operadores} operadorId={operadorId} setOperadorId={setOperadorId}
            senha={senha} setSenha={setSenha}
          />

          {erro && (
            <p className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{erro}
            </p>
          )}

          <button
            onClick={handleValidar}
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

      {nomeConfirmado !== null && (
        <ModalConfirmarAcao
          titulo="Confirmar abertura de caixa"
          mensagem={`Você deseja abrir o caixa com as informações inseridas? Responsável: ${nomeConfirmado}.`}
          corBtn="bg-emerald-500 hover:bg-emerald-600"
          loading={loading}
          onCancelar={() => setNomeConfirmado(null)}
          onConfirmar={handleAbrir}
        />
      )}
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

// ─── Painel de Resumo da mesa/comanda selecionada no mapa ─────────
// Aparece ao lado do Mapa de Atendimentos quando uma mesa/comanda ocupada
// é selecionada — itens já lançados (persistidos em service_point_tab_items,
// sobrevive a troca de mesa e a um F5) + barra de ações (Adicionar/Editar/
// Excluir/Conferência/Adiantamento/Desbloqueio).
function PainelResumoPonto({
  ponto, items, advances, loading,
  subtotal, discountValue, total, totalAdiantado, faltaPagar,
  onAdicionar, onUpdateItem, onExcluir, onDesbloqueio, onConferencia, onAdiantamento,
  onFinalizarVenda, onClose,
}: {
  ponto: Ponto; items: TabItem[]; advances: TabAdvance[]; loading: boolean;
  subtotal: number; discountValue: number; total: number; totalAdiantado: number; faltaPagar: number;
  onAdicionar: () => void; onUpdateItem: (itemId: string, quantity: number) => void;
  onExcluir: () => void; onDesbloqueio: () => void; onConferencia: () => void; onAdiantamento: () => void;
  onFinalizarVenda: () => void; onClose?: () => void;
}) {
  // "Editar" alterna um modo inline na própria lista (+/- e remover por
  // linha) — sem modal novo, mesmo espírito do +/- que já existe no
  // carrinho normal do CartPanel.
  const [editMode, setEditMode] = useState(false);
  void advances; // total já vem calculado (totalAdiantado); mantido na prop pra uso futuro (histórico de adiantamentos)

  const ACOES = [
    { label: "Adicionar",    icon: Plus,           onClick: onAdicionar,                color: "emerald" as const },
    { label: "Editar",       icon: ClipboardEdit,  onClick: () => setEditMode(v => !v), color: editMode ? "emerald" as const : "muted" as const },
    { label: "Excluir",      icon: Ban,            onClick: onExcluir,                  color: "red" as const },
    { label: "Conferência",  icon: ClipboardCheck, onClick: onConferencia,              color: "muted" as const },
    { label: "Adiantamento", icon: CircleDollarSign, onClick: onAdiantamento,           color: "blue" as const },
    { label: "Desbloqueio",  icon: Unlock,         onClick: onDesbloqueio,              color: "muted" as const },
  ];
  const ACAO_COR: Record<string, string> = {
    emerald: "text-emerald-600 hover:bg-emerald-50",
    red:     "text-red-500 hover:bg-red-50",
    blue:    "text-blue-600 hover:bg-blue-50",
    muted:   "text-muted-foreground hover:bg-secondary hover:text-foreground",
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MesaTableIcon className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-foreground leading-none truncate">{ponto.nameOrNumber}</h2>
            {ponto.customerName && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ponto.customerName}</p>}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors lg:hidden shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Barra de ações */}
      <div className="grid grid-cols-6 gap-1 px-2 py-2 border-b border-border shrink-0 bg-secondary/40">
        {ACOES.map(a => (
          <button key={a.label} type="button" onClick={a.onClick} title={a.label}
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[9px] font-semibold transition-colors ${ACAO_COR[a.color]}`}>
            <a.icon className="w-4 h-4" />
            <span className="leading-none truncate max-w-full">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Itens já lançados na conta */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 opacity-20" />
            <p className="text-xs text-center font-semibold tracking-wide">
              CONTA VAZIA<br /><span className="text-muted-foreground font-normal tracking-normal">Toque em Adicionar</span>
            </p>
          </div>
        ) : items.map(item => (
          <div key={item.id} className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-sm shrink-0">
              {item.productEmoji || "🛒"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.productName}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">{item.quantity}× {fmtBRL(item.unitPrice)}</p>
            </div>
            {editMode ? (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onUpdateItem(item.id, item.quantity - 1)}
                  className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                <button onClick={() => onUpdateItem(item.id, item.quantity + 1)}
                  className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
                  <Plus className="w-3 h-3" />
                </button>
                <button onClick={() => onUpdateItem(item.id, 0)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold text-foreground tabular-nums shrink-0">
                {fmtBRL(parseFloat(item.unitPrice) * item.quantity)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer: totais + finalizar */}
      <div className="border-t border-border p-4 space-y-3 shrink-0">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{fmtBRL(subtotal)}</span></div>
          {discountValue > 0 && (
            <div className="flex justify-between text-amber-600 font-medium"><span>Desconto</span><span className="tabular-nums">−{fmtBRL(discountValue)}</span></div>
          )}
          {totalAdiantado > 0 && (
            <div className="flex justify-between text-blue-600 font-medium"><span>Adiantado</span><span className="tabular-nums">−{fmtBRL(totalAdiantado)}</span></div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="font-bold text-foreground">{totalAdiantado > 0 ? "Falta pagar" : "Total"}</span>
            <span className="text-xl font-extrabold text-emerald-600 tabular-nums">{fmtBRL(totalAdiantado > 0 ? faltaPagar : total)}</span>
          </div>
        </div>
        <button onClick={onFinalizarVenda} disabled={items.length === 0}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-secondary disabled:text-muted-foreground text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-100">
          <CreditCard className="w-4 h-4" />FINALIZAR VENDA (F2)
        </button>
      </div>
    </div>
  );
}

const ENCOMENDA_PAY_LABEL: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Crédito", debit: "Débito", mercadopago: "Mercado Pago",
};

// ─── Encomendas pendentes (delivery/retirada do site) ─────────────
function EncomendasList({
  encomendas, activeId, onSelect,
}: { encomendas: Encomenda[]; activeId?: string | null; onSelect: (e: Encomenda) => void }) {
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
          const isSelected = activeId === enc.id;
          return (
            <button key={enc.id} onClick={() => onSelect(enc)}
              className={`group relative flex flex-col gap-2 p-4 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.97] cursor-pointer bg-card ${
                isSelected ? "border-emerald-500 ring-4 ring-emerald-100 shadow-md" : "border-border hover:border-emerald-400 hover:shadow-md"
              }`}>
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

// ─── Painel de Resumo da encomenda selecionada (aba Delivery) ─────
// Mais simples que o da mesa/comanda: os itens já vêm prontos de um
// pedido de verdade (não precisa de tab persistida) — só Conferência (ver
// os itens) e Encerrar Encomenda (fluxo que já existia, só passa a abrir
// a partir daqui em vez de popar direto ao clicar no card). Adicionar/
// Editar/Adiantamento/Desbloqueio não se aplicam a um pedido que já veio
// pronto do site.
function PainelResumoEncomenda({
  encomenda, onEncerrar, onClose,
}: { encomenda: Encomenda; onEncerrar: () => void; onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-foreground leading-none truncate">
              #{encomenda.number} — {encomenda.customer?.name || "Cliente"}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {encomenda.type === "pickup" ? "Retirada" : "Entrega"}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors lg:hidden shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {encomenda.items.map(item => (
          <div key={item.id} className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
              {item.quantity}×
            </span>
            <p className="flex-1 min-w-0 text-xs font-semibold text-foreground truncate">{item.productName}</p>
            <span className="text-xs font-bold text-foreground tabular-nums shrink-0">{fmtBRL(item.total)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-4 space-y-3 shrink-0">
        <div className="flex justify-between items-center text-sm">
          <span className="font-bold text-foreground">Total</span>
          <span className="text-xl font-extrabold text-emerald-600 tabular-nums">{fmtBRL(encomenda.total)}</span>
        </div>
        <button onClick={onEncerrar}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-100">
          <ClipboardCheck className="w-4 h-4" />Encerrar Encomenda
        </button>
      </div>
    </div>
  );
}

// ─── Carrinho (drawer mobile / coluna desktop) ────────────────────
function CartPanel({
  cart, activePonto, discount, discountType, total, subtotal, discountValue, totalQty,
  sessao, lancandoPedido, lancadoOk,
  onUpdateQty, onRemove, onClear, onSetDiscount, onSetDiscountType,
  onOpenPayment, onLancarPedido, onOpenMovimentar, onFecharCaixa, onOpenFuncoes, onClose,
}: {
  cart: CartItem[]; activePonto: Ponto | null; discount: number; discountType: "pct" | "brl";
  total: number; subtotal: number; discountValue: number; totalQty: number;
  sessao: CaixaSessao | null; lancandoPedido: boolean; lancadoOk: boolean;
  onUpdateQty: (id: string, d: number) => void; onRemove: (id: string) => void; onClear: () => void;
  onSetDiscount: (v: number) => void; onSetDiscountType: (t: "pct" | "brl") => void;
  onOpenPayment: () => void; onLancarPedido: () => void; onOpenMovimentar: (t: "sangria" | "suprimento") => void;
  onFecharCaixa: () => void; onOpenFuncoes: () => void; onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Ações rápidas + Fechar Caixa em destaque */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 bg-secondary/40">
        <div className="flex items-center gap-1">
          <button type="button" title="Central de ajuda (em breve)" disabled
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/40 cursor-not-allowed">
            <HelpCircle className="w-4 h-4" />
          </button>
          <Link to="/admin/configuracoes" search={{ tab: "perfil" }} title="Perfil"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <UserCircle className="w-4 h-4" />
          </Link>
          <button type="button" onClick={onOpenFuncoes} title="Configurações (Menu de Funções)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        {sessao && (
          <button onClick={onFecharCaixa}
            className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
            <LockKeyhole className="w-3.5 h-3.5" />FECHAR CAIXA
          </button>
        )}
      </div>

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
            <p className="text-xs text-center font-semibold tracking-wide">CARRINHO VAZIA<br /><span className="text-muted-foreground font-normal tracking-normal">Toque nos produtos</span></p>
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
            <button onClick={onOpenPayment} disabled={(cart.length === 0 && totalQty === 0) || !sessao}
              className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-secondary disabled:text-muted-foreground text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-100">
              <CreditCard className="w-4 h-4" />FINALIZAR VENDA (F2)
            </button>
          </div>
        ) : (
          <button onClick={onOpenPayment} disabled={(cart.length === 0 && totalQty === 0) || !sessao}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-secondary disabled:text-muted-foreground text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-100">
            <CreditCard className="w-4 h-4" />FINALIZAR VENDA (F2)
          </button>
        )}

        {/* Caixa actions — "Fechar" saiu daqui: agora vive em destaque no topo do painel */}
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
  const storeRole = useStoreRole();
  // "Posição" mostra o saldo esperado por forma de pagamento — quem fecha o
  // caixa faz contagem cega, então precisa ficar fora do alcance de quem
  // opera o caixa (mesmo raciocínio da aba Posição do Caixa em
  // Configurações). Ver -menu-funcoes-pdv.tsx.
  const podeVerPosicao = temPermissao(storeRole, ["admin", "gerente"]);
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
  const [finalizedTotal, setFinalizedTotal] = useState<number | null>(null);
  const [lancando, setLancando]           = useState(false);
  const [lancadoOk, setLancadoOk]        = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PdvPaymentMethod[]>(DEFAULT_PDV_METHODS);
  const [storeId, setStoreId]             = useState("");
  const [storeName, setStoreName]         = useState("");
  const [denseGrid, setDenseGrid]         = useState(false); // false = compacto (mais colunas), true = confortável (cards maiores)
  const [encomendas, setEncomendas]       = useState<Encomenda[]>([]);
  const [selectedEncomenda, setSelectedEncomenda] = useState<Encomenda | null>(null);
  // ── Conta em aberto da mesa/comanda selecionada no mapa (painel de
  // resumo) — tabItems/tabAdvances vêm do servidor, diferente de `cart`
  // (que agora só é a área de rascunho dentro do overlay de "Adicionar").
  const [tabItems, setTabItems]           = useState<TabItem[]>([]);
  const [tabAdvances, setTabAdvances]     = useState<TabAdvance[]>([]);
  const [loadingTab, setLoadingTab]       = useState(false);
  const [catalogOverlay, setCatalogOverlay] = useState(false);
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

  // ── Conta da mesa selecionada — busca sempre que a sessão aberta muda
  // (trocar de mesa, ou reabrir a mesma depois de um F5). Sem isso o
  // painel de resumo não teria como mostrar o que já foi lançado antes. ──
  const fetchTab = useCallback((sessionId: string) => {
    setLoadingTab(true);
    fetch(`/api/service-points/tab?sessionId=${sessionId}`)
      .then(r => r.json())
      .then((d: { items?: TabItem[]; advances?: TabAdvance[] }) => {
        setTabItems(d.items || []); setTabAdvances(d.advances || []);
      })
      .catch(() => {})
      .finally(() => setLoadingTab(false));
  }, []);

  useEffect(() => {
    if (activePonto?.openSessionId) fetchTab(activePonto.openSessionId);
    else { setTabItems([]); setTabAdvances([]); }
  }, [activePonto?.openSessionId, fetchTab]);

  // Ressincroniza a mesa selecionada sempre que o mapa é recarregado — ex:
  // liberar a mesa atualmente selecionada pelo "X" do próprio card (em vez
  // de pelo painel de resumo) não limpava mais activePonto sozinho, já que
  // agora o resumo continua na tela em vez de trocar de modo. Sem isso o
  // painel ficava mostrando uma mesa já livre/com dado desatualizado.
  useEffect(() => {
    if (!activePonto) return;
    const fresh = points.find(p => p.id === activePonto.id);
    if (!fresh || fresh.openSessionId !== activePonto.openSessionId) {
      setActivePonto(fresh && fresh.openSessionId ? fresh : null);
    }
  }, [points]);

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
      fetch(`/api/store/user`).then(r => r.json()).catch(() => ({})),
    ]).then(([pd, cd, pmd, spd, cx, sud]) => {
      if (pd.products)  setProducts(pd.products);
      if (cd.categories) setCategories(cd.categories);
      if (pmd.methods?.length) setPaymentConfig(pmd.methods);
      if (spd.servicePoints) setPoints(spd.servicePoints);
      if (cx.sessao)    { setSessao(cx.sessao); setMovimentos(cx.movimentos || []); }
      if (sud.store?.name) setStoreName(sud.store.name);
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

  // "Em mesa": o mapa está aberto com uma mesa/comanda selecionada — os
  // totais e a venda passam a vir da conta persistida (tabItems), não do
  // carrinho local (que nesse contexto só é a área de rascunho dentro do
  // overlay de "Adicionar", até "Lançar Pedido" confirmar na conta).
  const emMesa = pdvMode === "map" && !!activePonto;

  const subtotal      = emMesa
    ? tabItems.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0)
    : cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountValue = discountType === "pct" ? subtotal * (discount / 100) : Math.min(discount, subtotal);
  const total         = subtotal - discountValue;
  const totalQty      = emMesa
    ? tabItems.reduce((s, i) => s + i.quantity, 0)
    : cart.reduce((s, i) => s + i.qty, 0);
  const totalAdiantado = tabAdvances.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
  const faltaPagar      = Math.max(0, total - totalAdiantado);

  // ── "Lançar Pedido [F3]" — confirma os itens do carrinho local (overlay
  // de "Adicionar") na conta da mesa, persistindo de verdade no servidor
  // (antes disso era decorativo: só um setTimeout, nunca gravava nada). ──
  const handleLancarPedido = useCallback(async () => {
    if (!cart.length || lancando || !activePonto) return;
    setLancando(true);
    try {
      const res  = await api.post("/api/service-points/tab/add-items", {
        servicePointId: activePonto.id,
        items: cart.map(i => ({
          productId: i.productId, productName: i.name,
          productEmoji: i.emoji || undefined, unitPrice: i.price.toFixed(2), quantity: i.qty,
        })),
      });
      const data = await res.json() as { success?: boolean; items?: TabItem[]; error?: string };
      if (res.ok && data.success) {
        setTabItems(data.items || []);
        setCart([]);
        setLancadoOk(true); setTimeout(() => setLancadoOk(false), 2200);
        setCatalogOverlay(false); // volta pro resumo da mesa
      } else {
        alert(data.error || "Erro ao lançar pedido");
      }
    } catch { alert("Erro de conexão"); }
    finally { setLancando(false); }
  }, [cart, lancando, activePonto]);

  // ── Ajusta/remove um item já lançado na conta da mesa ("Editar") ──
  const handleUpdateTabItem = useCallback(async (itemId: string, quantity: number) => {
    setTabItems(prev => quantity <= 0
      ? prev.filter(i => i.id !== itemId)
      : prev.map(i => i.id === itemId ? { ...i, quantity } : i));
    try {
      await api.post("/api/service-points/tab/update-item", { itemId, quantity });
    } catch {
      if (activePonto?.openSessionId) fetchTab(activePonto.openSessionId); // reverte com dado real
    }
  }, [activePonto, fetchTab]);

  // ── "Excluir" (cancela a conta) e "Desbloqueio" (mesma liberação,
  // exposta como ação de emergência — Armazix não tem lock concorrente
  // entre terminais hoje, então não há "trava" real pra destravar; ver
  // nota no plano) — ambos reaproveitam o mesmo endpoint que o "X" do
  // mapa já usa pra liberar mesa sem gerar venda. ──
  const handleLiberarMesa = useCallback(async (confirmMsg: string) => {
    if (!activePonto) return;
    if (!confirm(confirmMsg)) return;
    try {
      const res  = await api.post("/api/service-points/sessions/close", { servicePointId: activePonto.id });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setActivePonto(null); setTabItems([]); setTabAdvances([]); fetchPoints();
      } else {
        alert(data.error || "Erro ao liberar atendimento");
      }
    } catch { alert("Erro de conexão"); }
  }, [activePonto, fetchPoints]);

  // ── "Adiantamento" — pagamento parcial registrado antes de fechar a conta ──
  const handleRegistrarAdiantamento = useCallback(async (valor: string, formaPagamento: string) => {
    if (!activePonto) return { ok: false, error: "Nenhuma mesa selecionada" };
    try {
      const res  = await api.post("/api/service-points/tab/advance", {
        servicePointId: activePonto.id, valor, formaPagamento,
      });
      const data = await res.json() as { success?: boolean; advance?: TabAdvance; error?: string };
      if (res.ok && data.success && data.advance) {
        setTabAdvances(prev => [...prev, data.advance!]);
        return { ok: true };
      }
      return { ok: false, error: data.error || "Erro ao registrar adiantamento" };
    } catch { return { ok: false, error: "Erro de conexão" }; }
  }, [activePonto]);

  // ── Finalizar venda ──
  const handleFinalize = async (method: string, installments: number) => {
    if (submitting || !sessao) return;
    setSubmitting(true);
    try {
      const itemsPayload = emMesa
        ? tabItems.map(item => ({
            productId:    item.productId,
            productName:  item.productName,
            productEmoji: item.productEmoji || undefined,
            quantity:     item.quantity,
            unitPrice:    item.unitPrice,
            total:        (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
          }))
        : cart.map(item => ({
            productId:    item.productId,
            productName:  item.name,
            productEmoji: item.emoji,
            quantity:     item.qty,
            unitPrice:    item.price.toFixed(2),
            total:        (item.price * item.qty).toFixed(2),
          }));
      const res  = await api.post("/api/pdv/finalizar-venda", {
        sessaoId:       sessao.id,
        mesaLabel:      activePonto?.nameOrNumber,
        servicePointId: activePonto?.id,
        paymentMethod: method,
        installments:  installments > 1 ? installments : undefined,
        items:         itemsPayload,
        subtotal: subtotal.toFixed(2),
        discount: discountValue.toFixed(2),
        total:    total.toFixed(2),
      });
      const data = await res.json() as { success?: boolean; order?: { number: number }; error?: string };
      if (res.ok && data.success && data.order) {
        setOrderNumber(data.order.number);
        setFinalizedTotal(total);
        // Atualiza sessão local
        setSessao(prev => prev ? { ...prev, totalVendas: prev.totalVendas + 1 } : prev);
        // Libera o ponto de atendimento no mapa (a sessão dele já foi
        // fechada no servidor, dentro da mesma transação do pedido).
        if (activePonto) { fetchPoints(); setTabItems([]); setTabAdvances([]); }
      } else if (!res.ok) {
        alert(data.error || "Erro ao finalizar venda");
      }
    } catch {} finally { setSubmitting(false); }
  };

  const handleNovaNota = () => {
    setModal(null); setCart([]); setDiscount(0); setDiscountType("pct");
    setOrderNumber(null); setFinalizedTotal(null); setActivePonto(null); setShowCart(false); setCatalogOverlay(false);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ── Abertura de caixa ──
  const handleCaixaAberto = (s: CaixaSessao) => { setSessao(s); setModal(null); };

  // ── Fechamento de caixa ──
  const handleCaixaFechado = () => {
    setSessao(null); setMovimentos([]); setCart([]); setDiscount(0);
    setActivePonto(null); setModal(null); setCatalogOverlay(false);
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
      if (e.key === "F2")     {
        e.preventDefault();
        if ((cart.length > 0 || totalQty > 0) && sessao) {
          (async () => { if (activePonto && cart.length > 0) await handleLancarPedido(); setModal("payment"); })();
        }
      }
      if (e.key === "F3")     { e.preventDefault(); handleLancarPedido(); }
      if (e.key === "F4")     { e.preventDefault(); if (sessao) { setMovTipo("sangria"); setModal("movimentar"); } }
      if (e.key === "F5")     { e.preventDefault(); setPdvMode(m => m === "map" ? "catalog" : "map"); }
      if (e.key === "Escape") { e.preventDefault(); setModal(null); setShowCart(false); }
      // Menu de Funções (Caixa) — atalhos Alt+ do menu de referência
      if (e.altKey && e.key.toLowerCase() === "a") { e.preventDefault(); setModal(sessao ? "caixa-info" : "abrir-caixa"); }
      if (e.altKey && e.key.toLowerCase() === "p") { e.preventDefault(); if (sessao && podeVerPosicao) setModal("posicao"); }
      if (e.altKey && e.key.toLowerCase() === "o") { e.preventDefault(); if (sessao) setModal("apontamento"); }
      if (e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); if (sessao) { setMovTipo("suprimento"); setModal("movimentar"); } }
      if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); if (sessao) { setMovTipo("sangria"); setModal("movimentar"); } }
      if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); if (sessao) setModal("sessoes"); }
      if (e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); if (sessao) setModal("fechar-caixa"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, sessao, handleLancarPedido, totalQty, activePonto, podeVerPosicao]);

  const cartProps = {
    cart, activePonto, discount, discountType, total, subtotal, discountValue, totalQty,
    sessao, lancandoPedido: lancando, lancadoOk,
    onUpdateQty: updateQty, onRemove: removeFromCart, onClear: () => setCart([]),
    onSetDiscount: setDiscount, onSetDiscountType: setDiscountType,
    // Em mesa, se ainda houver itens só no rascunho local (overlay de
    // "Adicionar" aberto sem ter clicado "Lançar Pedido"), confirma eles na
    // conta antes de abrir o pagamento — evita perder o que foi adicionado
    // por esquecer o passo extra.
    onOpenPayment: async () => {
      if (!sessao) return;
      if (activePonto && cart.length > 0) await handleLancarPedido();
      setModal("payment");
    },
    onLancarPedido: handleLancarPedido,
    onOpenMovimentar: (t: "sangria" | "suprimento") => { if (!sessao) return; setMovTipo(t); setModal("movimentar"); },
    onFecharCaixa: () => sessao && setModal("fechar-caixa"),
    onOpenFuncoes: () => setModal("funcoes"),
  };

  // Overlay de catálogo (botão "Adicionar" do painel de resumo): mostra o
  // catálogo POR CIMA do mapa, com o CartPanel de sempre — mas os totais
  // ali são só do que está sendo rascunhado agora (cart), não da conta
  // inteira da mesa (subtotal/total acima já são "em mesa" o tempo todo,
  // pra não misturar os dois quando o overlay está aberto).
  const stagingSubtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const stagingTotalQty = cart.reduce((s, i) => s + i.qty, 0);
  const overlayCartProps = {
    ...cartProps,
    subtotal: stagingSubtotal, total: stagingSubtotal, discountValue: 0, totalQty: stagingTotalQty,
  };
  const showCatalog        = pdvMode === "catalog" || catalogOverlay;
  const showMesaResumo     = pdvMode === "map" && !!activePonto;
  const showEncomendaResumo = pdvMode === "delivery" && !!selectedEncomenda;

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
            {storeName && (
              <div className="hidden md:flex items-center gap-1.5 pr-2 mr-1 border-r border-border shrink-0">
                <Store className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wide truncate max-w-[160px]">{storeName}</span>
              </div>
            )}
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
                <button onClick={() => { setActivePonto(null); setCatalogOverlay(false); }} className="ml-0.5 opacity-50 hover:opacity-100">
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
              {/* Mobile cart/resumo toggle — mesma regra da coluna desktop */}
              {(!sessao || showCatalog || showMesaResumo || showEncomendaResumo) && (
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
          {pdvMode === "map" && !catalogOverlay ? (
            <MesaMap
              points={points}
              activePonto={activePonto}
              sessaoId={sessao?.id ?? null}
              // Fica no mapa — o resumo da mesa aparece do lado (coluna
              // direita) no desktop; no mobile, abre a mesma gaveta que o
              // carrinho já usava (não existe coluna lateral em telas
              // pequenas).
              onSelect={p => { setActivePonto(p); setShowCart(true); }}
              onPontosChanged={fetchPoints}
            />
          ) : pdvMode === "delivery" && !catalogOverlay ? (
            <EncomendasList encomendas={encomendas} activeId={selectedEncomenda?.id ?? null} onSelect={e => {
              if (!sessao) { setModal("abrir-caixa"); return; }
              // Seleciona e mostra o resumo do lado — "Encerrar Encomenda"
              // (dentro do painel) que abre o modal de confirmação de
              // pagamento, em vez de popar o modal direto ao clicar no card.
              setSelectedEncomenda(e); setShowCart(true);
            }} />
          ) : (
            <>
              {catalogOverlay && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
                  <button onClick={() => setCatalogOverlay(false)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />Voltar{activePonto ? ` — ${activePonto.nameOrNumber}` : ""}
                  </button>
                </div>
              )}
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
                          {cat.emoji
                            ? <span className="text-sm leading-none">{cat.emoji}</span>
                            : <Tag className={`w-3 h-3 ${isActive ? "text-white" : "text-muted-foreground"}`} />}
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
              <div className="px-3 pt-2.5 pb-2 shrink-0 bg-secondary flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar produto, código de barras ou SKU..." autoFocus
                    className="w-full h-11 bg-card border border-border focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm rounded-xl pl-10 pr-16 outline-none transition-all text-foreground placeholder:text-muted-foreground shadow-sm" />
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-secondary border border-border px-1.5 py-0.5 rounded font-mono">F1</kbd>
                </div>
                <div className="hidden sm:flex items-center gap-0.5 bg-card border border-border rounded-xl p-1 shrink-0">
                  <button onClick={() => setDenseGrid(false)} title="Cards compactos"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${!denseGrid ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    <Grid3x3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDenseGrid(true)} title="Cards grandes"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${denseGrid ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    <LayoutGrid className="w-4 h-4" />
                  </button>
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
                  <div className={`grid gap-2.5 ${denseGrid
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                    : "grid-cols-3 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"}`}>
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

                          {/* Info — nome no canto inferior-esquerdo, preço no inferior-direito */}
                          <div className="flex flex-col gap-1 p-2.5 flex-1">
                            {product.stock !== null && (
                              <p className="text-[10px] text-muted-foreground">Estq: {product.stock}</p>
                            )}
                            <div className="flex items-end justify-between gap-2 mt-auto pt-1">
                              <p className="text-[12px] font-semibold text-foreground truncate flex-1 min-w-0" title={product.name}>
                                {product.name}
                              </p>
                              {promoP.promoActive ? (
                                <div className="text-right shrink-0">
                                  <p className="text-[11px] font-bold text-emerald-600 tabular-nums leading-tight">{fmtBRL(promoP.effectivePrice)}</p>
                                  <p className="text-[9px] text-muted-foreground line-through tabular-nums leading-tight">{fmtBRL(promoP.originalPrice!)}</p>
                                </div>
                              ) : (
                                <p className={`text-[13px] font-bold tabular-nums shrink-0 ${isSuspended ? "text-muted-foreground" : "text-emerald-600"}`}>
                                  {fmtBRL(parseFloat(product.price))}
                                </p>
                              )}
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
            COLUNA DIREITA — Abertura de Caixa, Carrinho ou Resumo da Mesa
            (o carrinho/resumo só faz sentido no Catálogo e no Mapa com uma
            mesa selecionada — no Delivery some pra dar mais espaço pro
            conteúdo; abrir caixa continua sempre visível) ══ */}
        {(!sessao || showCatalog || showMesaResumo || showEncomendaResumo) && (
          <div className="hidden lg:flex w-[360px] shrink-0 border-l border-border flex-col h-full">
            {!sessao ? (
              <PainelAbrirCaixa onAberto={handleCaixaAberto} />
            ) : showCatalog ? (
              <CartPanel {...(catalogOverlay ? overlayCartProps : cartProps)} />
            ) : showMesaResumo ? (
              <PainelResumoPonto
                ponto={activePonto!} items={tabItems} advances={tabAdvances} loading={loadingTab}
                subtotal={subtotal} discountValue={discountValue} total={total}
                totalAdiantado={totalAdiantado} faltaPagar={faltaPagar}
                onAdicionar={() => setCatalogOverlay(true)}
                onUpdateItem={handleUpdateTabItem}
                onExcluir={() => handleLiberarMesa("Cancelar essa conta? Os itens serão descartados e a mesa será liberada, sem gerar venda.")}
                onDesbloqueio={() => handleLiberarMesa("Forçar liberação dessa mesa? Use isso só se ela ficou presa sem motivo aparente — os itens lançados serão perdidos.")}
                onConferencia={() => setModal("conferencia")}
                onAdiantamento={() => setModal("adiantamento")}
                onFinalizarVenda={cartProps.onOpenPayment}
              />
            ) : (
              <PainelResumoEncomenda
                encomenda={selectedEncomenda!}
                onEncerrar={() => setModal("encerrar-encomenda")}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Mobile cart/resumo drawer (mesma regra da coluna desktop) ── */}
      {showCart && (!sessao || showCatalog || showMesaResumo || showEncomendaResumo) && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative ml-auto w-full max-w-sm h-full bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {!sessao ? (
              <PainelAbrirCaixa onAberto={handleCaixaAberto} />
            ) : showCatalog ? (
              <CartPanel {...(catalogOverlay ? overlayCartProps : cartProps)} onClose={() => setShowCart(false)} />
            ) : showMesaResumo ? (
              <PainelResumoPonto
                ponto={activePonto!} items={tabItems} advances={tabAdvances} loading={loadingTab}
                subtotal={subtotal} discountValue={discountValue} total={total}
                totalAdiantado={totalAdiantado} faltaPagar={faltaPagar}
                onAdicionar={() => setCatalogOverlay(true)}
                onUpdateItem={handleUpdateTabItem}
                onExcluir={() => handleLiberarMesa("Cancelar essa conta? Os itens serão descartados e a mesa será liberada, sem gerar venda.")}
                onDesbloqueio={() => handleLiberarMesa("Forçar liberação dessa mesa? Use isso só se ela ficou presa sem motivo aparente — os itens lançados serão perdidos.")}
                onConferencia={() => setModal("conferencia")}
                onAdiantamento={() => setModal("adiantamento")}
                onFinalizarVenda={cartProps.onOpenPayment}
                onClose={() => setShowCart(false)}
              />
            ) : (
              <PainelResumoEncomenda
                encomenda={selectedEncomenda!}
                onEncerrar={() => setModal("encerrar-encomenda")}
                onClose={() => setShowCart(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Modais ── */}
      <Suspense fallback={null}>
        {modal === "abrir-caixa" && <ModalAbrirCaixa onAberto={handleCaixaAberto} onClose={() => setModal(null)} />}
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
            podeVerPosicao={podeVerPosicao}
            onPosicao={() => sessao && podeVerPosicao && setModal("posicao")}
            onApontamento={() => sessao && setModal("apontamento")}
            onSuprimento={() => { if (sessao) { setMovTipo("suprimento"); setModal("movimentar"); } }}
            onSangria={() => { if (sessao) { setMovTipo("sangria"); setModal("movimentar"); } }}
            onAnalise={() => setModal("sessoes")}
            onFechamento={() => sessao && setModal("fechar-caixa")}
            onPontosAtendimento={() => setModal("pontos-atendimento")}
            onFechamentoAutomatico={() => setModal("fechamento-automatico")}
          />
        )}
        {modal === "caixa-info" && sessao && (
          <ModalCaixaInfo sessao={sessao} onClose={() => setModal(null)} />
        )}
        {modal === "posicao" && sessao && podeVerPosicao && (
          <ModalPosicaoCaixa sessao={sessao} movimentos={movimentos} onClose={() => setModal(null)} />
        )}
        {modal === "apontamento" && (
          <ModalApontamento movimentos={movimentos} onClose={() => setModal(null)} />
        )}
        {modal === "encerrar-encomenda" && sessao && selectedEncomenda && (
          <ModalEncerrarEncomenda
            encomenda={selectedEncomenda} sessaoId={sessao.id} paymentConfig={paymentConfig}
            // Só fecha o modal — o resumo da encomenda no painel lateral
            // continua selecionado, pra poder tentar de novo sem precisar
            // clicar no card outra vez.
            onClose={() => setModal(null)}
            onEncerrado={handleEncomendaEncerrada}
          />
        )}
        {modal === "pontos-atendimento" && (
          // Fecha e já recarrega o mapa — pontos criados/editados na hora
          // (ex: uma "Mesa 12" nova) aparecem sem precisar sair do PDV.
          <ModalPontosAtendimento onClose={() => { setModal(null); fetchPoints(); }} />
        )}
        {modal === "fechamento-automatico" && storeId && (
          <ModalFechamentoAutomatico storeId={storeId} onClose={() => setModal(null)} />
        )}
        {modal === "conferencia" && activePonto?.openSessionId && (
          <ModalConferencia
            sessionId={activePonto.openSessionId} mesaLabel={activePonto.nameOrNumber}
            subtotal={subtotal} totalAdiantado={totalAdiantado} total={total}
            onClose={() => setModal(null)}
          />
        )}
        {modal === "adiantamento" && activePonto && (
          <ModalAdiantamento
            faltaPagar={faltaPagar}
            onClose={() => setModal(null)}
            onConfirm={handleRegistrarAdiantamento}
          />
        )}
        {modal === "payment" && (
          <ModalPagamento
            total={orderNumber !== null && finalizedTotal !== null ? finalizedTotal : total}
            subtotal={subtotal} discountValue={discountValue} discount={discount}
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
