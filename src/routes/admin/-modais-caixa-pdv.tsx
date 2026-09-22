import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import {
  AlertCircle, ArrowDownCircle, ArrowUpCircle, Filter, Loader2,
  LockKeyhole, Monitor, ReceiptText, Unlock, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { fmtBRL, fmtDate } from "./pdv";
import type { CaixaSessao, CaixaMovimento } from "./pdv";
import { useOperadores, verificarOperador, CampoOperador, ModalConfirmarAcao } from "./-caixa-operador";

// ─── Modal Abertura de Caixa ─────────────────────────────────────
export function ModalAbrirCaixa({ onAberto, onClose }: { onAberto: (s: CaixaSessao) => void; onClose: () => void }) {
  const operadores = useOperadores();
  const [saldo, setSaldo]       = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [senha, setSenha]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState<string | null>(null);

  // 1) Confere usuário + senha. Só then é que o popup de confirmação aparece.
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
  // confere a senha de novo aqui dentro (abrirCaixaHandler), não confia só
  // na pré-checagem do passo 1.
  const handleAbrir = async () => {
    setLoading(true);
    try {
      const res  = await api.post("/api/pdv/caixa/abrir", { saldoInicial: saldo || "0", operadorId, senha, origem: "web" });
      const data = await res.json() as { success?: boolean; sessao?: CaixaSessao; error?: string };
      if (!res.ok || !data.success) { setErro(data.error || "Erro ao abrir caixa"); setNomeConfirmado(null); return; }
      onAberto(data.sessao!);
    } catch { setErro("Erro de rede"); setNomeConfirmado(null); }
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
          <CampoOperador operadores={operadores} operadorId={operadorId} setOperadorId={setOperadorId} senha={senha} setSenha={setSenha} />
          {erro && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{erro}</p>}
        </div>
        <button onClick={handleValidar} disabled={loading}
          className="mt-5 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-100">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4" />Abrir Caixa</>}
        </button>
        <button onClick={onClose} disabled={loading}
          className="mt-2 w-full h-11 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
          <X className="w-4 h-4" />Cancelar
        </button>
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

// ─── Modal Fechamento de Caixa ────────────────────────────────────
export function ModalFecharCaixa({
  sessao, movimentos, onFechado, onClose,
}: { sessao: CaixaSessao; movimentos: CaixaMovimento[]; onFechado: () => void; onClose: () => void }) {
  const operadores = useOperadores();
  const [informados, setInformados] = useState<Record<string, string>>({});
  const [operadorId, setOperadorId] = useState("");
  const [senha, setSenha]           = useState("");
  const [obs, setObs]               = useState("");
  const [loading, setLoading]       = useState(false);
  const [erro, setErro]             = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState<string | null>(null);

  const totalSangria    = movimentos.filter(m => m.tipo === "sangria")   .reduce((s, m) => s + parseFloat(m.valor), 0);
  const totalSuprimento = movimentos.filter(m => m.tipo === "suprimento").reduce((s, m) => s + parseFloat(m.valor), 0);
  const saldoEsperado   =
    parseFloat(sessao.saldoInicial)  +
    parseFloat(sessao.totalDinheiro) +
    totalSuprimento - totalSangria;

  // Conferência por forma de pagamento — valor do sistema x valor contado
  // pelo operador, lado a lado (antes só existia um único "saldo contado",
  // comparado só contra o dinheiro). "Dinheiro" sempre aparece (é o que
  // precisa de contagem física mesmo quando zerado); as demais só entram
  // quando tiveram movimento na sessão.
  const METODOS = [
    { key: "dinheiro",      label: "Dinheiro",        sistema: saldoEsperado },
    { key: "pix",           label: "PIX",              sistema: parseFloat(sessao.totalPix) },
    { key: "cartaoCredito", label: "Cartão Crédito",   sistema: parseFloat(sessao.totalCartao) },
    { key: "cartaoDebito",  label: "Cartão Débito",    sistema: parseFloat(sessao.totalDebito) },
    { key: "outros",        label: "Outros",           sistema: parseFloat(sessao.totalOutros) },
  ].filter(m => m.key === "dinheiro" || Math.abs(m.sistema) > 0.001);

  // Campo em branco = contado como R$ 0,00 (não "bate sozinho" com o
  // esperado, como seria se o fallback fosse pro valor do sistema — aquilo
  // sim mascararia uma quebra de caixa). Deixar em branco vira uma
  // diferença de verdade, visível depois em Posição do Caixa, então não
  // precisa travar o fechamento exigindo que preencha todas as formas.
  const linhasConferencia = METODOS.map(m => {
    const bruto     = informados[m.key];
    const informado = bruto ? parseFloat(bruto.replace(",", ".")) || 0 : 0;
    return { ...m, informadoStr: bruto ?? "", informado, diferenca: informado - m.sistema };
  });

  // 1) Confere usuário + senha. Só então o popup de confirmação aparece.
  const handleValidar = async () => {
    setErro("");
    if (!operadorId)    { setErro("Selecione o responsável"); return; }
    if (!senha.trim())  { setErro("Informe a senha"); return; }
    setLoading(true);
    const r = await verificarOperador(operadorId, senha);
    setLoading(false);
    if (!r.ok) { setErro(r.error); return; }
    setNomeConfirmado(r.name);
  };

  // 2) Só executa de verdade depois do "Confirmar" no popup — o backend
  // confere a senha de novo aqui dentro (fecharCaixaHandler), não confia só
  // na pré-checagem do passo 1.
  const handleFechar = async () => {
    setLoading(true);
    try {
      const dinheiro = linhasConferencia.find(l => l.key === "dinheiro")!;
      await api.post("/api/pdv/caixa/fechar", {
        sessaoId: sessao.id,
        saldoFinal: dinheiro.informado.toFixed(2),
        operadorId, senha,
        observations: obs || undefined,
        conferencia: linhasConferencia.map(l => ({
          metodo: l.key, label: l.label,
          sistema: l.sistema.toFixed(2), informado: l.informado.toFixed(2), diferenca: l.diferenca.toFixed(2),
        })),
      });
      onFechado();
    } catch {
      setNomeConfirmado(null);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <LockKeyhole className="w-4 h-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Fechar Caixa</h3>
              <p className="text-[11px] text-muted-foreground font-mono tracking-wider">Sessão {sessao.codigo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Ficha da sessão — identificação, no lugar do "Computador" de um
              PDV tradicional (a gente não tem terminal físico nomeado, o
              código da sessão já cumpre esse papel). */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary rounded-xl border border-border px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sessão</p>
              <p className="text-xs font-bold text-foreground font-mono tracking-wider mt-0.5">{sessao.codigo}</p>
            </div>
            <div className="bg-secondary rounded-xl border border-border px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Canal</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{sessao.origem === "desktop" ? "App Desktop" : "Painel Web"}</p>
            </div>
            <div className="bg-secondary rounded-xl border border-border px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aberto por</p>
              <p className="text-xs font-bold text-foreground mt-0.5 truncate">{sessao.abertoPor || "—"}</p>
            </div>
            <div className="bg-secondary rounded-xl border border-border px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aberto em</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{fmtDate(sessao.openedAt)}</p>
            </div>
          </div>

          {/* Conferência — contagem cega: o operador informa o que contou,
              sem ver o valor esperado pelo sistema nem a diferença (isso é
              proposital, pra não virar um "copia o número da tela" e mascarar
              uma quebra de caixa). A comparação some daqui e só fica visível
              depois, pra quem tiver permissão, em Configurações → Posição do
              Caixa e no histórico de sessões. */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Conferência (contagem cega)</label>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Informe o que você contou em cada forma de pagamento.</p>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {linhasConferencia.map(l => (
                <div key={l.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs text-foreground font-medium">{l.label}</span>
                  <input type="number" step="0.01" value={l.informadoStr}
                    onChange={e => setInformados(prev => ({ ...prev, [l.key]: e.target.value }))}
                    placeholder="0,00"
                    className="h-9 w-28 rounded-lg border border-border px-2 text-sm text-right tabular-nums font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                </div>
              ))}
            </div>
          </div>
          <CampoOperador operadores={operadores} operadorId={operadorId} setOperadorId={setOperadorId} senha={senha} setSenha={setSenha} />
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</label>
            <Input value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Opcional" className="mt-1 h-10 rounded-xl text-sm" />
          </div>
          {erro && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{erro}</p>}
        </div>

        <div className="px-5 pb-5 shrink-0 flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-secondary hover:bg-secondary text-muted-foreground font-semibold text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={handleValidar} disabled={loading}
            className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LockKeyhole className="w-4 h-4" />Fechar Caixa</>}
          </button>
        </div>
      </div>
      {nomeConfirmado !== null && (
        <ModalConfirmarAcao
          titulo="Confirmar fechamento de caixa"
          mensagem={`Você deseja encerrar o caixa com as informações inseridas? Responsável: ${nomeConfirmado}.`}
          corBtn="bg-red-500 hover:bg-red-600"
          loading={loading}
          onCancelar={() => setNomeConfirmado(null)}
          onConfirmar={handleFechar}
        />
      )}
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
                      <span className="text-[10px] font-mono font-bold text-muted-foreground tracking-wider">{s.codigo}</span>
                      <span className="text-xs font-bold text-foreground">{fmtDate(s.openedAt)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isAberta ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-secondary text-muted-foreground border-border"
                      }`}>
                        {isAberta ? "ABERTA" : "ENCERRADA"}
                      </span>
                      {s.origem === "desktop" && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          <Monitor className="w-2.5 h-2.5" /> APP DESKTOP
                        </span>
                      )}
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
