import { useEffect, useMemo, useState } from "react";
import {
  Receipt, CheckCircle2, XCircle, RotateCcw, Undo2, Loader2, Eye, TrendingDown, Wallet,
  ShoppingCart, Package, User, Circle, type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type DateTimeRange, DTR_DEFAULT, SearchBar, SelectFilter, DateTimeRangeFilter,
  EmptyState, KpiCard, fmt,
} from "./-fin-shared";
import { getFinanceiroVendas, getFinanceiroVendaDetalhe, estornarVenda } from "@/services/api";
import { useStoreRole } from "@/hooks/use-store-role";
import { temPermissao } from "@/lib/reports-permissions";
import { ModalCancelarPedido, type CancelarPedidoAlvo } from "@/routes/admin/-modal-cancelar-pedido";
import type { EventoHistorico } from "@/lib/orders/historico-venda";

// ── Tipos da API ────────────────────────────────────────────────────────────
interface VendaRow {
  id: string; numero: number; data: string; cliente: string;
  total: number; formaPagamento: string;
  saleStatus: "finalizada" | "cancelada" | "estornada";
  motivoLabel: string; valorLancado: number; valorEstornado: number;
}
interface VendaDetalhe {
  venda: VendaRow & {
    motivo: string; tipo: string; statusPedido: string; paymentStatus: string; channel: string;
    notes: string | null; subtotal: string; deliveryFee: string | null; discount: string | null;
    installments: number | null; cardFeeAmount: string | null; gatewayPaymentId: string | null;
    addressSnapshot: { street: string; number: string; neighborhood: string; city: string; state: string; zip: string; complement?: string } | null;
    estimatedDelivery: string | null; deliveredAt: string | null;
    clientePhone: string | null; cupom: string | null; valorLiquido: number;
  };
  itens: {
    nome: string; emoji: string | null; qtd: number; unit: number; adicionaisTotal: number;
    adicionais: { name: string; price: string }[] | null; obs: string | null; total: number;
  }[];
  lancamentos: {
    tipo: string; categoria: string; descricao: string; valor: number; status: string;
    metodoPagamento: string | null; data: string; sessaoCodigo: string | null;
  }[];
  pagamentos: { forma: string; valor: number; data: string }[];
  caixa: { id: string; codigo: string; abertoPor: string | null; encerradoPor: string | null; status: string; openedAt: string; closedAt: string | null }[];
  historico: EventoHistorico[];
}

const STATUS_OPCOES = [
  { value: "",           label: "Todos os status" },
  { value: "finalizada", label: "Finalizadas" },
  { value: "cancelada",  label: "Canceladas" },
  { value: "estornada",  label: "Estornadas" },
];

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Crédito", debit: "Débito", mercadopago: "Mercado Pago", misto: "Misto",
};

function StatusVendaBadge({ s }: { s: VendaRow["saleStatus"] }) {
  const cfg = {
    finalizada: { cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", Icon: CheckCircle2, label: "Finalizada" },
    cancelada:  { cls: "bg-secondary text-muted-foreground", Icon: XCircle, label: "Cancelada" },
    estornada:  { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", Icon: RotateCcw, label: "Estornada" },
  }[s];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function fmtData(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

// ── Modal de detalhe — histórico completo da venda + todos os dados ─────────
const EVENTO_ESTILO: Record<EventoHistorico["tipo"], { Icon: LucideIcon; dot: string }> = {
  criada:     { Icon: ShoppingCart, dot: "bg-primary/15 text-primary" },
  status:     { Icon: Circle,       dot: "bg-secondary text-muted-foreground" },
  pagamento:  { Icon: Wallet,       dot: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  estoque:    { Icon: Package,      dot: "bg-secondary text-muted-foreground" },
  finalizada: { Icon: CheckCircle2, dot: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelada:  { Icon: XCircle,      dot: "bg-secondary text-muted-foreground" },
  estorno:    { Icon: RotateCcw,    dot: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

const CANAL_LABEL: Record<string, string> = { pdv: "PDV (frente de caixa)", online: "Loja online" };
const TIPO_LABEL: Record<string, string> = { delivery: "Entrega", pickup: "Retirada" };
const PAGAMENTO_STATUS: Record<string, string> = { pending: "Pendente", paid: "Pago", refunded: "Estornado" };

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{titulo}</p>
      {children}
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]">
      <span className="text-muted-foreground shrink-0">{rotulo}</span>
      <span className="text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

function ModalDetalheVenda({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [d, setD] = useState<VendaDetalhe | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    getFinanceiroVendaDetalhe(orderId)
      .then((r) => { if (vivo) setD(r as unknown as VendaDetalhe); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [orderId]);

  const v = d?.venda;
  const temFinanceiro = !!v && (v.valorLancado > 0 || v.valorEstornado > 0);
  const end = v?.addressSnapshot;
  const num = (s: string | null | undefined) => parseFloat(s ?? "0") || 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4" />
            Venda #{v?.numero ?? "…"}
          </DialogTitle>
        </DialogHeader>

        {erro && <p className="text-sm text-muted-foreground py-8 text-center">Não foi possível carregar o detalhe.</p>}
        {!d && !erro && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}

        {d && v && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusVendaBadge s={v.saleStatus} />
                <span className="text-xs text-muted-foreground">
                  {CANAL_LABEL[v.channel] ?? v.channel} · {TIPO_LABEL[v.tipo] ?? v.tipo}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{fmtData(v.data)}</span>
            </div>

            {/* Resumo financeiro */}
            <div className={`grid gap-2 ${temFinanceiro ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1"}`}>
              <div className="rounded-xl border border-border/50 p-3">
                <p className="text-[11px] text-muted-foreground">Total da venda</p>
                <p className="text-base font-bold tabular-nums">{fmt(v.total)}</p>
              </div>
              {temFinanceiro && (
                <>
                  <div className="rounded-xl border border-border/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Recebido</p>
                    <p className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(v.valorLancado)}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Estornado</p>
                    <p className={`text-base font-bold tabular-nums ${v.valorEstornado > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
                      {v.valorEstornado > 0 ? "− " : ""}{fmt(v.valorEstornado)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Líquido</p>
                    <p className="text-base font-bold tabular-nums">{fmt(v.valorLiquido)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Histórico: do início ao pagamento e a um possível estorno */}
            <Secao titulo="Histórico da venda">
              <ol>
                {d.historico.map((e, i) => {
                  const { Icon, dot } = EVENTO_ESTILO[e.tipo];
                  const ultimo = i === d.historico.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${dot}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        {!ultimo && <span className="w-px flex-1 bg-border my-1" />}
                      </div>
                      <div className={`min-w-0 flex-1 ${ultimo ? "" : "pb-4"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-[13px] font-semibold leading-snug ${e.tom === "alerta" ? "text-amber-700 dark:text-amber-400" : ""}`}>
                            {e.titulo}
                          </p>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{fmtData(e.data)}</span>
                        </div>
                        {e.detalhes.map((linha, j) => (
                          <p key={j} className="text-[12px] text-muted-foreground leading-snug mt-0.5">{linha}</p>
                        ))}
                        {e.ator && (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" />{e.ator}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Secao>

            {/* Todos os dados da venda */}
            <Secao titulo="Detalhes da venda">
              <div className="rounded-xl border border-border/50 px-3 divide-y divide-border/40">
                <Campo rotulo="Cliente">
                  {v.cliente}{v.clientePhone ? <span className="block text-xs text-muted-foreground">{v.clientePhone}</span> : null}
                </Campo>
                <Campo rotulo="Canal">{CANAL_LABEL[v.channel] ?? v.channel}</Campo>
                <Campo rotulo="Tipo">{TIPO_LABEL[v.tipo] ?? v.tipo}</Campo>
                {v.notes?.trim() && <Campo rotulo="Origem / observação">{v.notes.trim()}</Campo>}
                <Campo rotulo="Forma de pagamento">{FORMA_LABEL[v.formaPagamento] || v.formaPagamento || "—"}</Campo>
                <Campo rotulo="Situação do pagamento">{PAGAMENTO_STATUS[v.paymentStatus] ?? v.paymentStatus}</Campo>
                {(v.installments ?? 1) > 1 && <Campo rotulo="Parcelas">{v.installments}x</Campo>}
                {num(v.cardFeeAmount) > 0 && <Campo rotulo="Taxa da maquineta">{fmt(num(v.cardFeeAmount))}</Campo>}
                {v.cupom && <Campo rotulo="Cupom"><span className="font-mono">{v.cupom}</span></Campo>}
                {d.caixa.map((c) => (
                  <Campo key={c.id} rotulo="Sessão de caixa">
                    <span className="font-mono font-semibold">{c.codigo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.abertoPor ? `Aberta por ${c.abertoPor}` : "Sessão sem responsável registrado"}
                      {c.status === "encerrada" ? (c.encerradoPor ? ` · encerrada por ${c.encerradoPor}` : " · encerrada") : " · em andamento"}
                    </span>
                  </Campo>
                ))}
                {v.gatewayPaymentId && <Campo rotulo="ID no gateway"><span className="font-mono text-xs">{v.gatewayPaymentId}</span></Campo>}
                {end && (
                  <Campo rotulo="Endereço de entrega">
                    {end.street}, {end.number}{end.complement ? ` (${end.complement})` : ""}
                    <span className="block text-xs text-muted-foreground">{end.neighborhood} · {end.city}/{end.state} · CEP {end.zip}</span>
                  </Campo>
                )}
                {v.estimatedDelivery && <Campo rotulo="Previsão de entrega">{fmtData(v.estimatedDelivery)}</Campo>}
                {v.deliveredAt && <Campo rotulo="Entregue em">{fmtData(v.deliveredAt)}</Campo>}
                {v.motivoLabel && <Campo rotulo="Motivo (cancelamento/estorno)">{v.motivoLabel}</Campo>}
                <Campo rotulo="ID da venda"><span className="font-mono text-xs">{v.id}</span></Campo>
              </div>
            </Secao>

            {/* Itens + composição do total */}
            {d.itens.length > 0 && (
              <Secao titulo="Itens">
                <div className="rounded-xl border border-border/50 px-3 divide-y divide-border/40">
                  {d.itens.map((it, i) => (
                    <div key={i} className="py-2 text-[13px]">
                      <div className="flex justify-between gap-3">
                        <span>{it.emoji ? `${it.emoji} ` : ""}{it.qtd}× {it.nome}</span>
                        <span className="tabular-nums shrink-0">{fmt(it.total)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{fmt(it.unit)} cada</p>
                      {it.adicionais?.map((a, j) => (
                        <p key={j} className="text-xs text-muted-foreground">+ {a.name} ({fmt(parseFloat(a.price) || 0)})</p>
                      ))}
                      {it.obs && <p className="text-xs text-muted-foreground italic">Obs.: {it.obs}</p>}
                    </div>
                  ))}
                  <div className="py-2 space-y-1 text-[13px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmt(num(v.subtotal))}</span></div>
                    {num(v.deliveryFee) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa de entrega</span><span className="tabular-nums">{fmt(num(v.deliveryFee))}</span></div>}
                    {num(v.discount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="tabular-nums text-emerald-700 dark:text-emerald-400">− {fmt(num(v.discount))}</span></div>}
                    <div className="flex justify-between font-semibold pt-1 border-t border-border/40"><span>Total</span><span className="tabular-nums">{fmt(v.total)}</span></div>
                  </div>
                </div>
              </Secao>
            )}

            {d.pagamentos.length > 0 && (
              <Secao titulo="Pagamentos registrados">
                <div className="rounded-xl border border-border/50 px-3 divide-y divide-border/40">
                  {d.pagamentos.map((p, i) => (
                    <div key={i} className="flex justify-between gap-3 py-2 text-[13px]">
                      <span>{FORMA_LABEL[p.forma] || p.forma}<span className="text-xs text-muted-foreground"> · {fmtData(p.data)}</span></span>
                      <span className="tabular-nums">{fmt(p.valor)}</span>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {d.lancamentos.length > 0 && (
              <Secao titulo="Lançamentos financeiros">
                <div className="rounded-xl border border-border/50 px-3 divide-y divide-border/40">
                  {d.lancamentos.map((l, i) => {
                    const entradaOk = l.tipo === "entrada" && l.status === "liquidado";
                    return (
                      <div key={i} className="flex justify-between gap-3 py-2 text-[13px]">
                        <span className={l.tipo === "saida" || l.status === "estornado" ? "text-amber-700 dark:text-amber-400" : ""}>
                          {l.descricao}{l.status === "estornado" && " (estornado)"}
                          <span className="block text-xs text-muted-foreground">
                            {fmtData(l.data)}
                            {l.metodoPagamento ? ` · ${FORMA_LABEL[l.metodoPagamento] || l.metodoPagamento}` : ""}
                            {l.sessaoCodigo ? ` · sessão ${l.sessaoCodigo}` : ""}
                          </span>
                        </span>
                        <span className={`shrink-0 tabular-nums ${
                          entradaOk ? "text-emerald-700 dark:text-emerald-400"
                            : l.tipo === "entrada" ? "text-muted-foreground line-through"
                            : "text-amber-700 dark:text-amber-400"
                        }`}>
                          {l.tipo === "saida" ? "− " : ""}{fmt(l.valor)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Secao>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Seção principal ─────────────────────────────────────────────────────────
export function SecaoVendas() {
  const [dtr, setDtr] = useState<DateTimeRange>(DTR_DEFAULT);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [estornoAlvo, setEstornoAlvo] = useState<CancelarPedidoAlvo | null>(null);
  const [estornoLoading, setEstornoLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const podeEstornar = temPermissao(useStoreRole(), ["admin", "gerente"]);

  const carregar = () => {
    setLoading(true);
    getFinanceiroVendas({
      from: dtr.dataInicio || undefined,
      to: dtr.dataFim || undefined,
      status: status || undefined,
      q: search.trim() || undefined,
    })
      .then((r) => { setVendas((r.vendas ?? []) as VendaRow[]); setKpis(r.kpis ?? {}); })
      .catch(() => { setVendas([]); setKpis({}); })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [dtr.dataInicio, dtr.dataFim, status]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendas;
    return vendas.filter(v => String(v.numero).includes(q) || v.cliente.toLowerCase().includes(q));
  }, [vendas, search]);

  const dispararEstorno = (v: VendaRow) => {
    setEstornoAlvo({ orderId: v.id, number: v.numero, total: String(v.total), saleStatus: "finalizada" });
  };

  const confirmarEstorno = async (motivoCode: string, motivoNote: string) => {
    if (!estornoAlvo) return;
    setEstornoLoading(true);
    try {
      const r = await estornarVenda(estornoAlvo.orderId, motivoCode, motivoNote);
      const v = `R$ ${(r.valorEstornado ?? 0).toFixed(2).replace(".", ",")}`;
      setToast(`Venda #${estornoAlvo.number} estornada — ${v} devolvidos, ${r.itensDevolvidos ?? 0} item(ns) de volta ao estoque`);
      setEstornoAlvo(null);
      carregar();
    } catch (e) {
      setToast((e as Error).message || "Erro ao estornar a venda");
    } finally {
      setEstornoLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Vendas</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Histórico rastreável de cada venda — o que entrou, o que foi cancelado e o que foi estornado
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Receipt} label="Vendas no período" value={String(kpis.total ?? 0)}
          iconBg="bg-primary/10" iconColor="text-primary" />
        <KpiCard icon={CheckCircle2} label="Finalizadas" value={String(kpis.finalizadas ?? 0)}
          iconBg="bg-emerald-500/10" iconColor="text-emerald-600" />
        <KpiCard icon={Wallet} label="Receita líquida" value={fmt(kpis.receitaLiquida ?? 0)}
          iconBg="bg-emerald-500/10" iconColor="text-emerald-600" highlight />
        <KpiCard icon={TrendingDown} label="Total estornado" value={fmt(kpis.totalEstornado ?? 0)}
          sub={`${kpis.estornadas ?? 0} venda(s)`} iconBg="bg-amber-500/10" iconColor="text-amber-600" />
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <DateTimeRangeFilter value={dtr} onChange={setDtr} />
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nº ou cliente…" />
          <SelectFilter value={status} onChange={setStatus} options={STATUS_OPCOES} />
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtradas.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhuma venda no período"
            desc="Ajuste o período ou os filtros. Vendas concluídas alimentam esta lista automaticamente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground font-semibold">
                  <th className="px-4 py-2.5 text-left">Nº</th>
                  <th className="px-4 py-2.5 text-left">Data</th>
                  <th className="px-4 py-2.5 text-left">Cliente</th>
                  <th className="px-4 py-2.5 text-left">Forma</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtradas.map((v) => (
                  <tr key={v.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold">#{v.numero}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtData(v.data)}</td>
                    <td className="px-4 py-2.5 max-w-[180px] truncate">{v.cliente}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{FORMA_LABEL[v.formaPagamento] || v.formaPagamento || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {fmt(v.total)}
                      {v.valorEstornado > 0 && (
                        <span className="block text-[11px] text-amber-600">− {fmt(v.valorEstornado)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center"><StatusVendaBadge s={v.saleStatus} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetalheId(v.id)} title="Ver detalhe"
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {v.saleStatus === "finalizada" && podeEstornar && (
                          <button onClick={() => dispararEstorno(v)} title="Estornar venda"
                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 transition-colors">
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detalheId && <ModalDetalheVenda orderId={detalheId} onClose={() => setDetalheId(null)} />}

      <ModalCancelarPedido
        alvo={estornoAlvo}
        loading={estornoLoading}
        onClose={() => setEstornoAlvo(null)}
        onConfirm={confirmarEstorno}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl bg-foreground text-background text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  );
}
