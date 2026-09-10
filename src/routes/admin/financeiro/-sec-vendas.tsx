import { useEffect, useMemo, useState } from "react";
import {
  Receipt, CheckCircle2, XCircle, RotateCcw, Undo2, Loader2, Eye, TrendingDown, Wallet,
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

// ── Tipos da API ────────────────────────────────────────────────────────────
interface VendaRow {
  id: string; numero: number; data: string; cliente: string;
  total: number; formaPagamento: string;
  saleStatus: "finalizada" | "cancelada" | "estornada";
  motivoLabel: string; valorLancado: number; valorEstornado: number;
}
interface VendaDetalhe {
  venda: VendaRow & { motivo: string; tipo: string; statusPedido: string; paymentStatus: string;
    subtotal: string; deliveryFee: string; discount: string; refundedAt: string | null; };
  itens: { nome: string; qtd: number; unit: number; total: number }[];
  timeline: { status: string; note: string | null; data: string }[];
  lancamentos: { tipo: string; categoria: string; descricao: string; valor: number; status: string; metodoPagamento: string | null; data: string }[];
}

const STATUS_OPCOES = [
  { value: "",           label: "Todos os status" },
  { value: "finalizada", label: "Finalizadas" },
  { value: "cancelada",  label: "Canceladas" },
  { value: "estornada",  label: "Estornadas" },
];

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card: "Crédito", debit: "Débito", mercadopago: "Mercado Pago",
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

// ── Modal de detalhe (linha do tempo + itens + lançamentos) ─────────────────
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

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4" />
            Venda #{d?.venda.numero ?? "…"}
          </DialogTitle>
        </DialogHeader>

        {erro && <p className="text-sm text-muted-foreground py-8 text-center">Não foi possível carregar o detalhe.</p>}
        {!d && !erro && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}

        {d && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <StatusVendaBadge s={d.venda.saleStatus} />
              <span className="text-xs text-muted-foreground">{fmtData(d.venda.data)}</span>
            </div>

            <div className="rounded-xl border border-border/50 p-3 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{d.venda.cliente}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Forma</span><span>{FORMA_LABEL[d.venda.formaPagamento] || d.venda.formaPagamento || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold">{fmt(d.venda.total)}</span></div>
              {d.venda.saleStatus === "estornada" && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>Estornado</span><span className="font-semibold">− {fmt(d.venda.valorEstornado)}</span>
                </div>
              )}
              {d.venda.motivoLabel && (
                <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Motivo</span><span className="text-right">{d.venda.motivoLabel}</span></div>
              )}
            </div>

            {d.itens.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Itens</p>
                <div className="space-y-1">
                  {d.itens.map((it, i) => (
                    <div key={i} className="flex justify-between text-[13px]">
                      <span>{it.qtd}× {it.nome}</span>
                      <span className="text-muted-foreground">{fmt(it.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Linha do tempo</p>
              <div className="space-y-2">
                {d.timeline.map((t, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug">{t.note || t.status}</p>
                      <p className="text-[11px] text-muted-foreground">{fmtData(t.data)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {d.lancamentos.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Financeiro</p>
                <div className="space-y-1">
                  {d.lancamentos.map((l, i) => (
                    <div key={i} className="flex justify-between text-[13px]">
                      <span className={l.tipo === "saida" || l.status === "estornado" ? "text-amber-700 dark:text-amber-400" : ""}>
                        {l.descricao}
                        {l.status === "estornado" && " (estornado)"}
                      </span>
                      <span className={`shrink-0 ml-3 ${l.tipo === "entrada" && l.status === "liquidado" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {l.tipo === "entrada" && l.status === "liquidado" ? "" : "− "}{fmt(l.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
