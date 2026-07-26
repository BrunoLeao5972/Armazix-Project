import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import {
  AlertCircle, ArrowDownCircle, ArrowUpCircle, Filter, Loader2,
  LockKeyhole, ReceiptText, Unlock, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { fmtBRL, fmtDate } from "./pdv";
import type { CaixaSessao, CaixaMovimento } from "./pdv";

// ─── Modal Abertura de Caixa ─────────────────────────────────────
export function ModalAbrirCaixa({ onAberto }: { onAberto: (s: CaixaSessao) => void }) {
  const [saldo, setSaldo]   = useState("");
  const [resp, setResp]     = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro]     = useState("");

  const handleAbrir = async () => {
    setErro(""); setLoading(true);
    try {
      const res  = await api.post("/api/pdv/caixa/abrir", { saldoInicial: saldo || "0", abertoPor: resp || undefined });
      const data = await res.json() as { success?: boolean; sessao?: CaixaSessao; error?: string };
      if (!res.ok || !data.success) { setErro(data.error || "Erro ao abrir caixa"); return; }
      onAberto(data.sessao!);
    } catch { setErro("Erro de rede"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <Unlock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Abrir Caixa</h3>
            <p className="text-xs text-muted-foreground">Informe o saldo inicial (troco em espécie)</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo Inicial (R$)</label>
            <Input type="number" min="0" step="0.01" value={saldo}
              onChange={e => setSaldo(e.target.value)} placeholder="0,00" autoFocus
              className="mt-1 h-11 rounded-xl text-base font-semibold" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Responsável</label>
            <Input value={resp} onChange={e => setResp(e.target.value)}
              placeholder="Nome do operador" className="mt-1 h-10 rounded-xl text-sm" />
          </div>
          {erro && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{erro}</p>}
        </div>
        <button onClick={handleAbrir} disabled={loading}
          className="mt-5 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-100">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4" />Abrir Caixa</>}
        </button>
      </div>
    </div>
  );
}

// ─── Modal Fechamento de Caixa ────────────────────────────────────
export function ModalFecharCaixa({
  sessao, movimentos, onFechado, onClose,
}: { sessao: CaixaSessao; movimentos: CaixaMovimento[]; onFechado: () => void; onClose: () => void }) {
  const [saldoFinal, setSaldoFinal] = useState("");
  const [resp, setResp]             = useState("");
  const [obs, setObs]               = useState("");
  const [loading, setLoading]       = useState(false);

  const totalSangria    = movimentos.filter(m => m.tipo === "sangria")   .reduce((s, m) => s + parseFloat(m.valor), 0);
  const totalSuprimento = movimentos.filter(m => m.tipo === "suprimento").reduce((s, m) => s + parseFloat(m.valor), 0);
  const saldoEsperado   =
    parseFloat(sessao.saldoInicial)  +
    parseFloat(sessao.totalDinheiro) +
    totalSuprimento - totalSangria;

  const handleFechar = async () => {
    setLoading(true);
    try {
      await api.post("/api/pdv/caixa/fechar", {
        sessaoId: sessao.id,
        saldoFinal: saldoFinal || saldoEsperado.toFixed(2),
        encerradoPor: resp || undefined,
        observations: obs || undefined,
      });
      onFechado();
    } catch {}
    finally { setLoading(false); }
  };

  const LINHAS = [
    { label: "Saldo inicial",     val: parseFloat(sessao.saldoInicial),  cor: "text-foreground" },
    { label: "Dinheiro vendas",   val: parseFloat(sessao.totalDinheiro), cor: "text-emerald-600" },
    { label: "PIX",               val: parseFloat(sessao.totalPix),      cor: "text-emerald-600" },
    { label: "Cartão Crédito",    val: parseFloat(sessao.totalCartao),   cor: "text-emerald-600" },
    { label: "Cartão Débito",     val: parseFloat(sessao.totalDebito),   cor: "text-emerald-600" },
    { label: "Outros",            val: parseFloat(sessao.totalOutros),   cor: "text-emerald-600" },
    { label: "Sangrias",          val: -totalSangria,                    cor: "text-red-500" },
    { label: "Suprimentos",       val: totalSuprimento,                  cor: "text-blue-600" },
  ];
  const totalVendasValor =
    parseFloat(sessao.totalDinheiro) + parseFloat(sessao.totalPix) +
    parseFloat(sessao.totalCartao)   + parseFloat(sessao.totalDebito) +
    parseFloat(sessao.totalOutros);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <LockKeyhole className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">Fechar Caixa</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Resumo */}
          <div className="bg-secondary rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Resumo da Sessão</p>
              <p className="text-xs text-muted-foreground mt-0.5">Aberto em {fmtDate(sessao.openedAt)} · {sessao.totalVendas} vendas</p>
            </div>
            <div className="divide-y divide-border">
              {LINHAS.map(l => Math.abs(l.val) > 0.001 && (
                <div key={l.label} className="flex justify-between items-center px-4 py-2 text-xs">
                  <span className="text-muted-foreground">{l.label}</span>
                  <span className={`font-semibold tabular-nums ${l.cor}`}>{fmtBRL(l.val)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-secondary border-t border-border">
              <span className="text-xs font-bold text-foreground">Total de Vendas</span>
              <span className="text-sm font-black text-emerald-600 tabular-nums">{fmtBRL(totalVendasValor)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 border-t border-emerald-100">
              <span className="text-xs font-bold text-emerald-700">Saldo Esperado no Caixa</span>
              <span className="text-sm font-black text-emerald-700 tabular-nums">{fmtBRL(saldoEsperado)}</span>
            </div>
          </div>

          {/* Saldo conferência */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo Contado (R$)</label>
            <Input type="number" min="0" step="0.01" value={saldoFinal}
              onChange={e => setSaldoFinal(e.target.value)}
              placeholder={saldoEsperado.toFixed(2).replace(".", ",")}
              className="mt-1 h-11 rounded-xl text-base font-semibold" />
            {saldoFinal && Math.abs(parseFloat(saldoFinal) - saldoEsperado) > 0.01 && (
              <p className={`text-xs font-semibold mt-1 ${parseFloat(saldoFinal) > saldoEsperado ? "text-blue-600" : "text-red-500"}`}>
                Diferença: {fmtBRL(parseFloat(saldoFinal) - saldoEsperado)}
              </p>
            )}
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Encerrado por</label>
            <Input value={resp} onChange={e => setResp(e.target.value)}
              placeholder="Nome do operador" className="mt-1 h-10 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</label>
            <Input value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Opcional" className="mt-1 h-10 rounded-xl text-sm" />
          </div>
        </div>

        <div className="px-5 pb-5 shrink-0 flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-secondary hover:bg-secondary text-muted-foreground font-semibold text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={handleFechar} disabled={loading}
            className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LockKeyhole className="w-4 h-4" />Fechar Caixa</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Sangria / Suprimento ──────────────────────────────────
export function ModalMovimentar({
  sessaoId, tipo, operador, onFeito, onClose,
}: { sessaoId: string; tipo: "sangria" | "suprimento"; operador: string; onFeito: (m: CaixaMovimento) => void; onClose: () => void }) {
  const [valor, setValor]   = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro]     = useState("");

  const isSangria = tipo === "sangria";
  const cor       = isSangria ? "text-red-600" : "text-blue-600";
  const corBg     = isSangria ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200";
  const corBtn    = isSangria ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700";
  const label     = isSangria ? "Sangria de Caixa" : "Suprimento de Caixa";
  const Icon      = isSangria ? ArrowDownCircle : ArrowUpCircle;

  const handleConfirm = async () => {
    if (!valor || parseFloat(valor) <= 0) { setErro("Informe um valor válido"); return; }
    setErro(""); setLoading(true);
    try {
      const res  = await api.post("/api/pdv/caixa/movimentar", {
        sessaoId, tipo, valor, motivo: motivo || undefined, criadoPor: operador || undefined,
      });
      const data = await res.json() as { success?: boolean; movimento?: CaixaMovimento; error?: string };
      if (!res.ok || !data.success) { setErro(data.error || "Erro"); return; }
      onFeito(data.movimento!);
    } catch { setErro("Erro de rede"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${corBg}`}>
            <Icon className={`w-5 h-5 ${cor}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground">Registre a movimentação de dinheiro em espécie</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor (R$)</label>
            <Input type="number" min="0" step="0.01" value={valor}
              onChange={e => setValor(e.target.value)} placeholder="0,00" autoFocus
              className="mt-1 h-11 rounded-xl text-base font-semibold" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Motivo</label>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Troco, reposição, pagamento fornecedor..."
              className="mt-1 h-10 rounded-xl text-sm" />
          </div>
          {erro && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{erro}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-secondary hover:bg-secondary text-muted-foreground font-semibold text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className={`flex-1 h-11 rounded-xl ${corBtn} disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Histórico de Sessões ───────────────────────────────────
export function ModalSessoes({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const [sessoes, setSessoes]     = useState<CaixaSessao[]>([]);
  const [statusFil, setStatusFil] = useState("all");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [loading, setLoading]     = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ storeId });
      if (statusFil !== "all") params.set("status", statusFil);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);
      const res  = await fetch(`/api/pdv/caixa/sessoes?${params}`);
      const data = await res.json() as { sessoes?: CaixaSessao[] };
      if (res.ok) setSessoes(data.sessoes || []);
    } catch {}
    finally { setLoading(false); }
  }, [storeId, statusFil, dateFrom, dateTo]);

  useEffect(() => { buscar(); }, [buscar]);

  const totalVendasAll = sessoes.reduce((s, x) =>
    s + parseFloat(x.totalDinheiro) + parseFloat(x.totalPix) +
    parseFloat(x.totalCartao) + parseFloat(x.totalDebito) + parseFloat(x.totalOutros), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">Histórico de Sessões</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-border flex flex-wrap gap-2 shrink-0">
          <select value={statusFil} onChange={e => setStatusFil(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border text-xs font-medium text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-slate-300">
            <option value="all">Todos os status</option>
            <option value="aberta">Aberta</option>
            <option value="encerrada">Encerrada</option>
          </select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 rounded-lg text-xs w-36" />
          <span className="self-center text-xs text-muted-foreground">até</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 rounded-lg text-xs w-36" />
          <button onClick={buscar}
            className="h-9 px-4 rounded-lg bg-foreground text-background text-xs font-semibold flex items-center gap-1.5 hover:bg-foreground/90 transition-colors">
            <Filter className="w-3 h-3" />Filtrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessoes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma sessão encontrada</div>
          ) : sessoes.map(s => {
            const totalSessao = parseFloat(s.totalDinheiro) + parseFloat(s.totalPix) +
              parseFloat(s.totalCartao) + parseFloat(s.totalDebito) + parseFloat(s.totalOutros);
            const isAberta = s.status === "aberta";
            return (
              <div key={s.id} className="px-5 py-3.5 hover:bg-secondary transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isAberta ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      <span className="text-xs font-bold text-foreground">{fmtDate(s.openedAt)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isAberta ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-secondary text-muted-foreground border-border"
                      }`}>
                        {isAberta ? "ABERTA" : "ENCERRADA"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 ml-4">
                      {s.abertoPor && <>Operador: {s.abertoPor} · </>}
                      {s.totalVendas} venda{s.totalVendas !== 1 ? "s" : ""}
                      {s.closedAt && <> · Fechado {fmtDate(s.closedAt)}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600 tabular-nums">{fmtBRL(totalSessao)}</p>
                    <p className="text-[11px] text-muted-foreground">Inicial: {fmtBRL(parseFloat(s.saldoInicial))}</p>
                  </div>
                </div>
                {/* Breakdown */}
                <div className="mt-2 ml-4 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  {parseFloat(s.totalDinheiro) > 0   && <span>Dinheiro {fmtBRL(parseFloat(s.totalDinheiro))}</span>}
                  {parseFloat(s.totalPix)      > 0   && <span>PIX {fmtBRL(parseFloat(s.totalPix))}</span>}
                  {parseFloat(s.totalCartao)   > 0   && <span>Crédito {fmtBRL(parseFloat(s.totalCartao))}</span>}
                  {parseFloat(s.totalDebito)   > 0   && <span>Débito {fmtBRL(parseFloat(s.totalDebito))}</span>}
                  {parseFloat(s.totalOutros)   > 0   && <span>Outros {fmtBRL(parseFloat(s.totalOutros))}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {sessoes.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex justify-between items-center shrink-0 bg-secondary">
            <span className="text-xs text-muted-foreground">{sessoes.length} sessão(ões)</span>
            <span className="text-sm font-bold text-emerald-600 tabular-nums">Total: {fmtBRL(totalVendasAll)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
