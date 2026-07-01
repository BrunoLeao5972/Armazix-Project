import React, { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api-client";
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone,
  X, ShoppingCart, Percent, Loader2, ArrowDownCircle, ArrowUpCircle,
  Tag, CheckCircle2, Package, QrCode, LayoutGrid, Clock,
  ChefHat, LayoutDashboard, Users, Wallet, ChevronRight,
  AlertCircle, LockKeyhole, Unlock, ReceiptText, Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { type PaymentMethodConfig, DEFAULT_PAYMENT_METHODS } from "@/lib/store-context";
import { type PromoConfig, getEffectivePrice } from "@/lib/promo-engine";

export const Route = createFileRoute("/admin/pdv")({
  component: PDVPage,
  head: () => ({ meta: [{ title: "PDV — ARMAZIX" }] }),
});

// ─── Tipos ───────────────────────────────────────────────────────
interface Product {
  id: string; name: string; price: string; categoryId: string | null;
  stock: number | null; emoji: string | null; imageUrl: string | null;
  barcode: string | null; sku: string | null; active: boolean | null;
  promoConfig: PromoConfig | null;
}
interface Category {
  id: string; name: string; parentId: string | null;
  position: number | null; active: boolean | null;
}
interface CartItem {
  productId: string; name: string; price: number; qty: number;
  emoji: string; imageUrl: string | null;
}
type MesaStatus = "livre" | "atendimento" | "aguardando";
interface Mesa { id: string; numero: number; label: string; capacidade?: number; }
interface CaixaSessao {
  id: string; saldoInicial: string; saldoFinal: string | null;
  totalDinheiro: string; totalPix: string; totalCartao: string;
  totalDebito: string; totalOutros: string; totalVendas: number;
  status: string; abertoPor: string | null; openedAt: string; closedAt: string | null;
}
interface CaixaMovimento {
  id: string; tipo: string; valor: string; motivo: string | null;
  criadoPor: string | null; createdAt: string;
}
type ModalType = "payment" | "abrir-caixa" | "fechar-caixa" | "movimentar" | "sessoes" | null;
type PdvMode  = "catalog" | "map";

// ─── helpers ─────────────────────────────────────────────────────
const fmtBRL = (v: number | string) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return "R$ " + (isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ","));
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote, pix: QrCode, card: CreditCard, debit: CreditCard, mercadopago: Smartphone,
};
const MESA_STATUSES: Record<MesaStatus, { dot: string; label: string; ring: string }> = {
  livre:       { dot: "bg-emerald-500", label: "Livre",          ring: "ring-emerald-200 bg-emerald-50  border-emerald-200" },
  atendimento: { dot: "bg-blue-500",    label: "Em Atendimento", ring: "ring-blue-200    bg-blue-50     border-blue-200"    },
  aguardando:  { dot: "bg-violet-500",  label: "Aguard. Pgto",   ring: "ring-violet-200  bg-violet-50   border-violet-200"  },
};

// ─── Modal Abertura de Caixa ─────────────────────────────────────
function ModalAbrirCaixa({ onAberto }: { onAberto: (s: CaixaSessao) => void }) {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <Unlock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Abrir Caixa</h3>
            <p className="text-xs text-slate-500">Informe o saldo inicial (troco em espécie)</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saldo Inicial (R$)</label>
            <Input type="number" min="0" step="0.01" value={saldo}
              onChange={e => setSaldo(e.target.value)} placeholder="0,00" autoFocus
              className="mt-1 h-11 rounded-xl text-base font-semibold" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Responsável</label>
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
    <div className="flex flex-col h-full bg-white">
      {/* Cabeçalho da coluna — mantém visual consistente com o CartPanel */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
        <LockKeyhole className="w-4 h-4 text-slate-400" />
        <h2 className="text-xs font-bold text-slate-500">Caixa Fechado</h2>
      </div>

      {/* Conteúdo centralizado */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        {/* Ícone */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-5 shadow-sm">
          <Unlock className="w-8 h-8 text-emerald-500" />
        </div>

        {/* Título + subtítulo */}
        <h3 className="text-base font-bold text-slate-800 text-center">Abrir Caixa</h3>
        <p className="text-xs text-slate-400 text-center mt-1 leading-relaxed max-w-[220px]">
          Informe o saldo inicial em espécie e o nome do operador para liberar as vendas.
        </p>

        {/* Formulário */}
        <div className="w-full mt-6 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
        <p className="text-[11px] text-slate-300 text-center mt-6 leading-relaxed">
          Você pode navegar pelo catálogo e mesas enquanto prepara a abertura.
        </p>
      </div>
    </div>
  );
}

// ─── Modal Fechamento de Caixa ────────────────────────────────────
function ModalFecharCaixa({
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
    { label: "Saldo inicial",     val: parseFloat(sessao.saldoInicial),  cor: "text-slate-700" },
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <LockKeyhole className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Fechar Caixa</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Resumo */}
          <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resumo da Sessão</p>
              <p className="text-xs text-slate-400 mt-0.5">Aberto em {fmtDate(sessao.openedAt)} · {sessao.totalVendas} vendas</p>
            </div>
            <div className="divide-y divide-slate-100">
              {LINHAS.map(l => Math.abs(l.val) > 0.001 && (
                <div key={l.label} className="flex justify-between items-center px-4 py-2 text-xs">
                  <span className="text-slate-500">{l.label}</span>
                  <span className={`font-semibold tabular-nums ${l.cor}`}>{fmtBRL(l.val)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-slate-100 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-700">Total de Vendas</span>
              <span className="text-sm font-black text-emerald-600 tabular-nums">{fmtBRL(totalVendasValor)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 border-t border-emerald-100">
              <span className="text-xs font-bold text-emerald-700">Saldo Esperado no Caixa</span>
              <span className="text-sm font-black text-emerald-700 tabular-nums">{fmtBRL(saldoEsperado)}</span>
            </div>
          </div>

          {/* Saldo conferência */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saldo Contado (R$)</label>
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
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Encerrado por</label>
            <Input value={resp} onChange={e => setResp(e.target.value)}
              placeholder="Nome do operador" className="mt-1 h-10 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Observações</label>
            <Input value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Opcional" className="mt-1 h-10 rounded-xl text-sm" />
          </div>
        </div>

        <div className="px-5 pb-5 shrink-0 flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm transition-colors">
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
function ModalMovimentar({
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${corBg}`}>
            <Icon className={`w-5 h-5 ${cor}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{label}</h3>
            <p className="text-xs text-slate-500">Registre a movimentação de dinheiro em espécie</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valor (R$)</label>
            <Input type="number" min="0" step="0.01" value={valor}
              onChange={e => setValor(e.target.value)} placeholder="0,00" autoFocus
              className="mt-1 h-11 rounded-xl text-base font-semibold" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Motivo</label>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Troco, reposição, pagamento fornecedor..."
              className="mt-1 h-10 rounded-xl text-sm" />
          </div>
          {erro && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{erro}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm transition-colors">
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
function ModalSessoes({ storeId, onClose }: { storeId: string; onClose: () => void }) {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Histórico de Sessões</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 shrink-0">
          <select value={statusFil} onChange={e => setStatusFil(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300">
            <option value="all">Todos os status</option>
            <option value="aberta">Aberta</option>
            <option value="encerrada">Encerrada</option>
          </select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 rounded-lg text-xs w-36" />
          <span className="self-center text-xs text-slate-400">até</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 rounded-lg text-xs w-36" />
          <button onClick={buscar}
            className="h-9 px-4 rounded-lg bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700 transition-colors">
            <Filter className="w-3 h-3" />Filtrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : sessoes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">Nenhuma sessão encontrada</div>
          ) : sessoes.map(s => {
            const totalSessao = parseFloat(s.totalDinheiro) + parseFloat(s.totalPix) +
              parseFloat(s.totalCartao) + parseFloat(s.totalDebito) + parseFloat(s.totalOutros);
            const isAberta = s.status === "aberta";
            return (
              <div key={s.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isAberta ? "bg-emerald-500" : "bg-slate-400"}`} />
                      <span className="text-xs font-bold text-slate-700">{fmtDate(s.openedAt)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isAberta ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        {isAberta ? "ABERTA" : "ENCERRADA"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 ml-4">
                      {s.abertoPor && <>Operador: {s.abertoPor} · </>}
                      {s.totalVendas} venda{s.totalVendas !== 1 ? "s" : ""}
                      {s.closedAt && <> · Fechado {fmtDate(s.closedAt)}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600 tabular-nums">{fmtBRL(totalSessao)}</p>
                    <p className="text-[11px] text-slate-400">Inicial: {fmtBRL(parseFloat(s.saldoInicial))}</p>
                  </div>
                </div>
                {/* Breakdown */}
                <div className="mt-2 ml-4 flex flex-wrap gap-3 text-[10px] text-slate-500">
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
          <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
            <span className="text-xs text-slate-500">{sessoes.length} sessão(ões)</span>
            <span className="text-sm font-bold text-emerald-600 tabular-nums">Total: {fmtBRL(totalVendasAll)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal de Pagamento ───────────────────────────────────────────
function ModalPagamento({
  total, subtotal, discountValue, discount,
  submitting, orderNumber, paymentConfig, mesaLabel,
  onClose, onFinalize, onNovaNota,
}: {
  total: number; subtotal: number; discountValue: number; discount: number;
  submitting: boolean; orderNumber: number | null;
  paymentConfig: PaymentMethodConfig[]; mesaLabel: string | null;
  onClose: () => void;
  onFinalize: (method: string, installments: number) => void;
  onNovaNota: () => void;
}) {
  const [method, setMethod]         = useState<string | null>(null);
  const [installments, setInstallments] = useState(1);
  const [troco, setTroco]           = useState("");
  const methods        = paymentConfig.filter(m => m.enabled && m.key !== "mercadopago");
  const selectedConfig = paymentConfig.find(m => m.key === method);
  const trocoCalc      = method === "cash" && troco
    ? Math.max(parseFloat(troco.replace(",", ".")) - total, 0) : null;

  if (orderNumber !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Venda concluída!</h3>
          {mesaLabel && <p className="text-xs text-slate-500 mt-0.5">{mesaLabel}</p>}
          <p className="text-sm text-slate-500 mt-1">Pedido #{orderNumber}</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-3 tabular-nums">{fmtBRL(total)}</p>
          {trocoCalc !== null && trocoCalc > 0 && (
            <p className="text-sm font-semibold text-amber-600 mt-1">Troco: {fmtBRL(trocoCalc)}</p>
          )}
          <button onClick={onNovaNota}
            className="mt-6 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base transition-colors">
            Nova Venda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />Fechar Venda
            </h3>
            {mesaLabel && <p className="text-[11px] text-slate-400 mt-0.5">{mesaLabel}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">{fmtBRL(subtotal)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Desconto</span><span className="tabular-nums">−{fmtBRL(discountValue)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-700">Total</span>
              <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">{fmtBRL(total)}</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Forma de Pagamento</p>
            {methods.length === 0
              ? <p className="text-xs text-slate-400">Nenhuma forma ativa.</p>
              : (
                <div className="grid grid-cols-3 gap-2">
                  {methods.map(m => {
                    const Icon = METHOD_ICONS[m.key] ?? CreditCard;
                    return (
                      <button key={m.key}
                        onClick={() => { setMethod(m.key); setInstallments(1); setTroco(""); }}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold border transition-all ${
                          method === m.key
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100"
                            : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                        }`}>
                        <Icon className="w-5 h-5" />{m.label}
                      </button>
                    );
                  })}
                </div>
              )}
          </div>

          {method && selectedConfig && selectedConfig.maxInstallments > 1 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Parcelamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: selectedConfig.maxInstallments }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setInstallments(n)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                      installments === n
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                    }`}>
                    {n === 1 ? `À vista — ${fmtBRL(total)}` : `${n}x — ${fmtBRL(total / n)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {method === "cash" && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Valor Recebido (R$)</label>
              <Input value={troco} onChange={e => setTroco(e.target.value)} placeholder="0,00"
                className="mt-1 h-10 rounded-xl text-sm" autoFocus />
              {trocoCalc !== null && trocoCalc > 0  && <p className="text-sm font-bold text-amber-600 mt-1.5">Troco: {fmtBRL(trocoCalc)}</p>}
              {trocoCalc !== null && trocoCalc < 0  && <p className="text-xs text-red-500 mt-1">Valor insuficiente</p>}
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={() => method && onFinalize(method, installments)}
            disabled={!method || submitting || (method === "cash" && !!troco && parseFloat(troco.replace(",", ".")) < total)}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-100">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" />CONFIRMAR PAGAMENTO [F2]</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mapa de Mesas ────────────────────────────────────────────────
function MesaMap({
  mesas: mesasList, activeMesa, onSelect,
}: { mesas: Mesa[]; activeMesa: Mesa | null; onSelect: (m: Mesa) => void }) {
  // Status das mesas vem do back-end futuramente; por ora assume "livre"
  const getStatus = (_m: Mesa): MesaStatus => "livre";

  if (mesasList.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Users className="w-8 h-8 text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-600">Nenhuma mesa configurada</p>
          <p className="text-sm text-slate-400 mt-1">Configure as mesas em Configurações → PDV</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
        {mesasList.map(mesa => {
          const st      = getStatus(mesa);
          const cfg     = MESA_STATUSES[st];
          const isActive = activeMesa?.id === mesa.id;
          return (
            <button key={mesa.id} onClick={() => onSelect(mesa)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                isActive
                  ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100 shadow-md"
                  : `${cfg.ring} hover:shadow-md`
              }`}>
              <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-3xl font-black text-slate-700 tabular-nums leading-none">
                {String(mesa.numero).padStart(2, "0")}
              </span>
              <span className="text-[11px] font-medium text-slate-500 leading-tight">{mesa.label}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                st === "livre" ? "bg-emerald-100 text-emerald-700"
                : st === "atendimento" ? "bg-blue-100 text-blue-700"
                : "bg-violet-100 text-violet-700"
              }`}>{cfg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Carrinho (drawer mobile / coluna desktop) ────────────────────
function CartPanel({
  cart, activeMesa, discount, discountType, total, subtotal, discountValue, totalQty,
  sessao, lancandoPedido, lancadoOk,
  onUpdateQty, onRemove, onClear, onSetDiscount, onSetDiscountType,
  onOpenPayment, onLancarPedido, onOpenMovimentar, onFecharCaixa, onClose,
}: {
  cart: CartItem[]; activeMesa: Mesa | null; discount: number; discountType: "pct" | "brl";
  total: number; subtotal: number; discountValue: number; totalQty: number;
  sessao: CaixaSessao | null; lancandoPedido: boolean; lancadoOk: boolean;
  onUpdateQty: (id: string, d: number) => void; onRemove: (id: string) => void; onClear: () => void;
  onSetDiscount: (v: number) => void; onSetDiscountType: (t: "pct" | "brl") => void;
  onOpenPayment: () => void; onLancarPedido: () => void; onOpenMovimentar: (t: "sangria" | "suprimento") => void;
  onFecharCaixa: () => void; onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-500" />
          <div>
            <h2 className="text-xs font-bold text-slate-800 leading-none">
              {activeMesa ? activeMesa.label : "Carrinho"}
            </h2>
            {activeMesa && (
              <p className="text-[10px] text-slate-400 mt-0.5">Atendimento aberto</p>
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
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors lg:hidden">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
            <ShoppingCart className="w-10 h-10 opacity-20" />
            <p className="text-xs text-center">Carrinho vazio<br /><span className="text-slate-300">Toque nos produtos</span></p>
          </div>
        ) : cart.map(item => (
          <div key={item.productId}
            className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 hover:border-slate-200 transition-colors">
            {/* Thumb */}
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-0.5" />
                : item.emoji
                  ? <span className="text-base">{item.emoji}</span>
                  : <Package className="w-4 h-4 text-slate-400" />
              }
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-700 truncate">{item.name}</p>
              <p className="text-[10px] text-slate-400 tabular-nums">{item.qty}× {fmtBRL(item.price)}</p>
            </div>
            {/* Total */}
            <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0 w-16 text-right">
              {fmtBRL(item.price * item.qty)}
            </span>
            {/* Controls */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => onUpdateQty(item.productId, -1)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-[11px] font-bold text-slate-700">{item.qty}</span>
              <button onClick={() => onUpdateQty(item.productId, 1)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={() => onRemove(item.productId)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-100 space-y-3 shrink-0">
        {/* Desconto */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0">
            {(["pct", "brl"] as const).map(t => (
              <button key={t} onClick={() => onSetDiscountType(t)}
                className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${discountType === t ? "bg-slate-700 text-white" : "bg-white text-slate-500 hover:text-slate-700"}`}>
                {t === "pct" ? "%" : "R$"}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input type="number" min={0} max={discountType === "pct" ? 100 : undefined}
              value={discount || ""} onChange={e => onSetDiscount(Number(e.target.value))}
              placeholder={discountType === "pct" ? "Desconto %" : "Desconto R$"}
              className="pl-7 h-8 rounded-lg text-xs" />
          </div>
          {discount > 0 && (
            <button onClick={() => onSetDiscount(0)} className="shrink-0 p-1 rounded-md hover:bg-slate-100 transition-colors">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Totais */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 space-y-1.5">
          {subtotal !== total && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span><span className="tabular-nums">{fmtBRL(subtotal)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-xs text-amber-600 font-medium">
              <span>Desconto</span><span className="tabular-nums">−{fmtBRL(discountValue)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
            <span className={`text-3xl font-black tabular-nums leading-none ${cart.length === 0 ? "text-slate-300" : "text-emerald-600"}`}>
              {fmtBRL(total)}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onLancarPedido} disabled={cart.length === 0 || lancandoPedido}
            className={`h-12 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              lancadoOk
                ? "bg-sky-50 text-sky-600 border-sky-300"
                : "bg-white border-slate-200 text-slate-600 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700"
            }`}>
            {lancandoPedido ? <Loader2 className="w-4 h-4 animate-spin" />
              : lancadoOk ? <><CheckCircle2 className="w-4 h-4 text-sky-500" />Enviado!</>
              : <><ChefHat className="w-4 h-4" />Cozinha [F3]</>}
          </button>
          <button onClick={onOpenPayment} disabled={cart.length === 0 || !sessao}
            className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-100">
            <CreditCard className="w-4 h-4" />Pagamento [F2]
          </button>
        </div>

        {/* Caixa actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => onOpenMovimentar("sangria")}
            className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200">
            <ArrowDownCircle className="w-3.5 h-3.5" />Sangria
          </button>
          <span className="text-slate-200 select-none">|</span>
          <button onClick={() => onOpenMovimentar("suprimento")}
            className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200">
            <ArrowUpCircle className="w-3.5 h-3.5" />Suprimento
          </button>
          <span className="text-slate-200 select-none">|</span>
          <button onClick={onFecharCaixa}
            className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200">
            <LockKeyhole className="w-3.5 h-3.5" />Fechar
          </button>
        </div>

        {/* Caixa info */}
        {sessao && (
          <div className="text-center">
            <p className="text-[10px] text-slate-400">
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
  const [mesasList, setMesasList]         = useState<Mesa[]>([]);
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
  const [activeMesa, setActiveMesa]       = useState<Mesa | null>(null);
  const [movTipo, setMovTipo]             = useState<"sangria" | "suprimento">("sangria");
  const [showCart, setShowCart]           = useState(false); // mobile cart drawer
  const [submitting, setSubmitting]       = useState(false);
  const [orderNumber, setOrderNumber]     = useState<number | null>(null);
  const [lancando, setLancando]           = useState(false);
  const [lancadoOk, setLancadoOk]        = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS);
  const [storeId, setStoreId]             = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Fetch inicial ──
  useEffect(() => {
    const sid = localStorage.getItem("storeId") || "";
    setStoreId(sid);
    if (!sid) return;
    Promise.all([
      fetch(`/api/products/list?storeId=${sid}&scope=pdv`).then(r => r.json()),
      fetch(`/api/categories/list?storeId=${sid}`).then(r => r.json()),
      fetch(`/api/store/get?id=${sid}`).then(r => r.json()),
      fetch(`/api/pdv/mesas?storeId=${sid}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/pdv/caixa`).then(r => r.json()).catch(() => ({})),
    ]).then(([pd, cd, sd, md, cx]) => {
      if (pd.products)  setProducts(pd.products);
      if (cd.categories) setCategories(cd.categories);
      if (sd.store?.paymentMethodsConfig?.length) setPaymentConfig(sd.store.paymentMethodsConfig);
      if (md.mesas)     setMesasList(md.mesas);
      if (cx.sessao)    { setSessao(cx.sessao); setMovimentos(cx.movimentos || []); }
    }).catch(() => {});
  }, []);

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

  // ── Lançar para cozinha ──
  const handleLancarPedido = useCallback(() => {
    if (!cart.length || lancando) return;
    setLancando(true);
    setTimeout(() => { setLancando(false); setLancadoOk(true); setTimeout(() => setLancadoOk(false), 2200); }, 700);
  }, [cart, lancando]);

  // ── Finalizar venda ──
  const handleFinalize = async (method: string, installments: number) => {
    if (submitting || !sessao) return;
    setSubmitting(true);
    try {
      const res  = await api.post("/api/pdv/finalizar-venda", {
        sessaoId:      sessao.id,
        mesaLabel:     activeMesa?.label,
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
      }
    } catch {} finally { setSubmitting(false); }
  };

  const handleNovaNota = () => {
    setModal(null); setCart([]); setDiscount(0); setDiscountType("pct");
    setOrderNumber(null); setActiveMesa(null); setShowCart(false);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ── Abertura de caixa ──
  const handleCaixaAberto = (s: CaixaSessao) => { setSessao(s); setModal(null); };

  // ── Fechamento de caixa ──
  const handleCaixaFechado = () => {
    setSessao(null); setMovimentos([]); setCart([]); setDiscount(0);
    setActiveMesa(null); setModal(null);
  };

  // ── Movimentação ──
  const handleMovimento = (m: CaixaMovimento) => { setMovimentos(prev => [m, ...prev]); setModal(null); };

  // ── Atalhos de teclado ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1")     { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F2")     { e.preventDefault(); if (cart.length > 0 && sessao) setModal("payment"); }
      if (e.key === "F3")     { e.preventDefault(); handleLancarPedido(); }
      if (e.key === "F4")     { e.preventDefault(); if (sessao) { setMovTipo("sangria"); setModal("movimentar"); } }
      if (e.key === "F5")     { e.preventDefault(); setPdvMode(m => m === "map" ? "catalog" : "map"); }
      if (e.key === "Escape") { e.preventDefault(); setModal(null); setShowCart(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, sessao, handleLancarPedido]);

  const cartProps = {
    cart, activeMesa, discount, discountType, total, subtotal, discountValue, totalQty,
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
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50">
      <div className="flex flex-1 min-h-0">

        {/* ═══════════════════════════════════════════
            COLUNA ESQUERDA — Catálogo / Mapa
        ════════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ── Topbar: modo + mesa ── */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button onClick={() => setPdvMode("catalog")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${pdvMode === "catalog" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <LayoutGrid className="w-3.5 h-3.5" />Catálogo
              </button>
              <button onClick={() => setPdvMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${pdvMode === "map" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <LayoutDashboard className="w-3.5 h-3.5" />Mesas
                <kbd className="text-[9px] font-mono bg-slate-200 px-1 rounded">F5</kbd>
              </button>
            </div>

            {activeMesa ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activeMesa.label}
                <button onClick={() => setActiveMesa(null)} className="ml-0.5 opacity-50 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => setPdvMode("map")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-all">
                <Users className="w-3.5 h-3.5" />Mesa
              </button>
            )}

            {/* Sessão info + Sessões button */}
            <div className="ml-auto flex items-center gap-2">
              {sessao && (
                <button onClick={() => setModal("sessoes")}
                  className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>Sessões</span>
                </button>
              )}
              {/* Mobile cart toggle */}
              <button onClick={() => setShowCart(true)}
                className="relative lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-100">
                <ShoppingCart className="w-4 h-4" />
                {totalQty > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {totalQty > 9 ? "9+" : totalQty}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ── Conteúdo: Catálogo ou Mapa ── */}
          {pdvMode === "map" ? (
            <MesaMap mesas={mesasList} activeMesa={activeMesa} onSelect={m => { setActiveMesa(m); setPdvMode("catalog"); }} />
          ) : (
            <>
              {/* Categorias */}
              {rootCats.length > 0 && (
                <div className="shrink-0 bg-white border-b border-slate-200">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <button onClick={() => { setActiveCategoryId(null); setActiveSubCategoryId(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0 transition-all ${
                          !activeCategoryId
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}>
                        <LayoutGrid className={`w-3 h-3 ${!activeCategoryId ? "text-white" : "text-slate-400"}`} />
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
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            }`}>
                            <Tag className={`w-3 h-3 ${isActive ? "text-white" : "text-slate-400"}`} />
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {subCats.length > 0 && (
                    <div className="overflow-x-auto no-scrollbar border-t border-slate-100">
                      <div className="flex items-center gap-1.5 px-3 py-1.5">
                        {subCats.map(sub => {
                          const isActive = activeSubCategoryId === sub.id;
                          return (
                            <button key={sub.id}
                              onClick={() => setActiveSubCategoryId(isActive ? null : sub.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border shrink-0 transition-all ${
                                isActive
                                  ? "bg-slate-700 text-white border-slate-700"
                                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                              }`}>
                              <ChevronRight className={`w-2.5 h-2.5 ${isActive ? "text-white" : "text-slate-400"}`} />
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
              <div className="px-3 pt-2.5 pb-2 shrink-0 bg-slate-50">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar produto, código de barras ou SKU..." autoFocus
                    className="w-full h-11 bg-white border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm rounded-xl pl-10 pr-16 outline-none transition-all text-slate-700 placeholder:text-slate-400 shadow-sm" />
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">F1</kbd>
                </div>
              </div>

              {/* Grid de produtos */}
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
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
                          className={`group relative flex flex-col rounded-xl overflow-hidden text-left transition-all duration-150 border bg-white ${
                            isSuspended
                              ? "border-amber-200 opacity-50 cursor-not-allowed"
                              : "border-slate-200 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-50 cursor-pointer active:scale-[0.97]"
                          }`}>
                          {/* Imagem */}
                          <div className="relative w-full aspect-square bg-slate-50 overflow-hidden">
                            {product.imageUrl
                              ? <img src={product.imageUrl} alt={product.name}
                                  className={`w-full h-full object-contain p-1.5 transition-transform duration-200 ${!isSuspended ? "group-hover:scale-105" : ""}`} />
                              : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {product.emoji
                                    ? <span className={`text-3xl leading-none transition-transform duration-200 ${!isSuspended ? "group-hover:scale-110" : ""}`}>{product.emoji}</span>
                                    : <Package className="w-7 h-7 text-slate-300" />}
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
                          </div>

                          {/* Info */}
                          <div className="flex flex-col gap-1 p-2.5 flex-1">
                            <p className="text-[12px] font-semibold text-slate-700 leading-tight line-clamp-2 min-h-[2rem]">
                              {product.name}
                            </p>
                            {product.stock !== null && (
                              <p className="text-[10px] text-slate-400">Estq: {product.stock}</p>
                            )}
                            <div className="flex items-end justify-between mt-auto pt-1">
                              <div>
                                {promoP.promoActive ? (
                                  <>
                                    <p className="text-[11px] font-bold text-emerald-600 tabular-nums leading-tight">{fmtBRL(promoP.effectivePrice)}</p>
                                    <p className="text-[10px] text-slate-400 line-through tabular-nums leading-tight">{fmtBRL(promoP.originalPrice!)}</p>
                                  </>
                                ) : (
                                  <p className={`text-[13px] font-bold tabular-nums ${isSuspended ? "text-slate-400" : "text-emerald-600"}`}>
                                    {fmtBRL(parseFloat(product.price))}
                                  </p>
                                )}
                              </div>
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                                isSuspended
                                  ? "border border-slate-200 text-slate-300"
                                  : "border border-slate-200 text-slate-400 group-hover:bg-emerald-500 group-hover:border-emerald-500 group-hover:text-white"
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
          <div className="shrink-0 hidden sm:flex items-center gap-3 px-4 py-2 border-t border-slate-200 bg-white flex-wrap">
            {[
              { key: "F1", label: "Buscar" },
              { key: "F2", label: "Pagamento" },
              { key: "F3", label: "Cozinha" },
              { key: "F4", label: "Sangria" },
              { key: "F5", label: "Mesas" },
              { key: "ESC", label: "Fechar" },
            ].map(s => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <kbd className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{s.key}</kbd>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            COLUNA DIREITA — Abertura de Caixa ou Carrinho
        ════════════════════════════════════════════ */}
        <div className="hidden lg:flex w-[360px] shrink-0 border-l border-slate-200 flex-col h-full">
          {sessao
            ? <CartPanel {...cartProps} />
            : <PainelAbrirCaixa onAberto={handleCaixaAberto} />}
        </div>
      </div>

      {/* ── Mobile cart drawer ── */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative ml-auto w-full max-w-sm h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {sessao
              ? <CartPanel {...cartProps} onClose={() => setShowCart(false)} />
              : <PainelAbrirCaixa onAberto={handleCaixaAberto} />}
          </div>
        </div>
      )}

      {/* ── Modais ── */}
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
      {modal === "payment" && (
        <ModalPagamento
          total={total} subtotal={subtotal} discountValue={discountValue} discount={discount}
          submitting={submitting} orderNumber={orderNumber} paymentConfig={paymentConfig}
          mesaLabel={activeMesa?.label ?? null}
          onClose={() => { setModal(null); if (orderNumber !== null) handleNovaNota(); }}
          onFinalize={handleFinalize} onNovaNota={handleNovaNota}
        />
      )}
    </div>
  );
}
