import type { ComponentType } from "react";
import {
  X, MapPin, Grid3x3, ClipboardCheck, Ban, ArrowRightLeft, Unlock,
  Bike, CircleDollarSign, Undo2, IdCard, BadgePercent, RotateCcw,
  Lock, List, ClipboardEdit, ArrowUpCircle, ArrowDownCircle, ClipboardList,
  LockKeyhole, Users, Tag, Star, Settings,
} from "lucide-react";
import { fmtBRL, fmtDate } from "./pdv";
import type { CaixaSessao, CaixaMovimento } from "./pdv";
import { MesaTableIcon } from "./-icon-mesa";

// ─── Definição das seções/funções (espelha o menu de referência) ──
interface FuncaoDef {
  label: string;
  icon: ComponentType<{ className?: string }>;
  shortcut: string;
  favorite?: boolean;
  onClick?: () => void;
}
interface SecaoDef { title: string; items: FuncaoDef[] }

function buildSecoes(actions: {
  caixaAberto: boolean;
  onCaixaAberto: () => void;
  onPosicao: () => void;
  onApontamento: () => void;
  onSuprimento: () => void;
  onSangria: () => void;
  onAnalise: () => void;
  onFechamento: () => void;
  onPontosAtendimento: () => void;
}): SecaoDef[] {
  const seSessao = (fn: () => void) => (actions.caixaAberto ? fn : undefined);
  return [
    {
      title: "Atendimento",
      items: [
        { label: "Informar",      icon: MapPin,          shortcut: "F2" },
        { label: "Mapa",          icon: Grid3x3,         shortcut: "F3" },
        { label: "Conferência",   icon: ClipboardCheck,  shortcut: "F11" },
        { label: "Exclusão",      icon: Ban,             shortcut: "Ctrl+Del" },
        { label: "Transferência", icon: ArrowRightLeft,  shortcut: "Ctrl+T" },
        { label: "Desbloqueio",   icon: Unlock,          shortcut: "Ctrl+F8" },
        { label: "Expedição",     icon: Bike,            shortcut: "Ctrl+E" },
        { label: "Adiantamento",  icon: CircleDollarSign,shortcut: "Ctrl+A" },
        { label: "Devolução",     icon: Undo2,           shortcut: "Ctrl+O" },
      ],
    },
    {
      title: "Venda",
      items: [
        { label: "Documento",  icon: IdCard,       shortcut: "Ctrl+F6" },
        { label: "Abatimento", icon: BadgePercent, shortcut: "Ctrl+D" },
        { label: "Estorno",    icon: RotateCcw,    shortcut: "Ctrl+F12" },
      ],
    },
    {
      title: "Caixa",
      items: [
        { label: "Caixa aberto", icon: Lock,           shortcut: "Alt+A", onClick: actions.onCaixaAberto },
        { label: "Posição",      icon: List,            shortcut: "Alt+P", onClick: seSessao(actions.onPosicao) },
        { label: "Apontamento",  icon: ClipboardEdit,   shortcut: "Alt+O", onClick: seSessao(actions.onApontamento) },
        { label: "Suprimento",   icon: ArrowUpCircle,   shortcut: "Alt+S", favorite: true, onClick: seSessao(actions.onSuprimento) },
        { label: "Sangria",      icon: ArrowDownCircle, shortcut: "Alt+R", favorite: true, onClick: seSessao(actions.onSangria) },
        { label: "Análise",      icon: ClipboardList,   shortcut: "Alt+L", onClick: actions.onAnalise },
        { label: "Fechamento",   icon: LockKeyhole,     shortcut: "Alt+F", onClick: seSessao(actions.onFechamento) },
      ],
    },
    {
      title: "Consultas",
      items: [
        { label: "Clientes", icon: Users, shortcut: "F4" },
        { label: "Preços",   icon: Tag,   shortcut: "F5" },
      ],
    },
    {
      title: "Configurações",
      items: [
        { label: "Pontos de Atendimento", icon: MesaTableIcon, shortcut: "", onClick: actions.onPontosAtendimento },
      ],
    },
  ];
}

// ─── Grade de botões de uma seção — extraído pra ser reaproveitado tanto
// no fluxo normal (empilhado) quanto lado a lado (Consultas/Configurações).
function SecaoGrid({ secao, cols }: { secao: SecaoDef; cols?: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">{secao.title}</h3>
      <div className={`grid gap-3 ${cols ?? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8"}`}>
        {secao.items.map(item => {
          const Icon = item.icon;
          const enabled = !!item.onClick;
          return (
            <button key={item.label} onClick={item.onClick} disabled={!enabled}
              className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center transition-all ${
                enabled
                  ? "border-border bg-card hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-50 cursor-pointer active:scale-[0.97]"
                  : "border-border/60 bg-card/60 opacity-60 cursor-default"
              }`}>
              {enabled ? (
                item.shortcut && (
                  <kbd className="absolute top-2 right-2 text-[9px] font-mono text-muted-foreground bg-secondary border border-border px-1 py-0.5 rounded">
                    {item.shortcut}
                  </kbd>
                )
              ) : (
                <span className="absolute top-2 right-2 text-[8px] font-semibold text-muted-foreground/70 bg-secondary/70 px-1.5 py-0.5 rounded-full">
                  em breve
                </span>
              )}
              {item.favorite && <Star className="absolute top-2 left-2 w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
              <Icon className={`w-6 h-6 ${enabled ? "text-foreground" : "text-muted-foreground"}`} />
              <span className="text-xs font-medium text-foreground leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tela cheia: Menu de Funções ──────────────────────────────────
export function MenuFuncoesPDV({
  caixaAberto, onClose, onCaixaAberto, onPosicao, onApontamento, onSuprimento, onSangria, onAnalise, onFechamento,
  onPontosAtendimento,
}: {
  caixaAberto: boolean;
  onClose: () => void;
  onCaixaAberto: () => void; onPosicao: () => void; onApontamento: () => void;
  onSuprimento: () => void; onSangria: () => void; onAnalise: () => void; onFechamento: () => void;
  onPontosAtendimento: () => void;
}) {
  const secoes = buildSecoes({
    caixaAberto, onCaixaAberto, onPosicao, onApontamento, onSuprimento, onSangria, onAnalise, onFechamento,
    onPontosAtendimento,
  });

  return (
    <div className="fixed inset-0 z-50 bg-secondary flex flex-col animate-in fade-in duration-150">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card shrink-0">
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-bold text-foreground flex-1">Menu de Funções</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-7">
        {secoes.filter(sec => sec.title !== "Consultas" && sec.title !== "Configurações").map(sec => (
          <SecaoGrid key={sec.title} secao={sec} />
        ))}

        {/* Consultas e Configurações lado a lado, bem separadas por um divisor —
            Configurações é um menu à parte, não mais um item dentro de Atendimento. */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1px_1fr] gap-5 md:gap-7">
          <SecaoGrid secao={secoes.find(s => s.title === "Consultas")!} />
          <div className="hidden md:block w-px bg-border" />
          <SecaoGrid secao={secoes.find(s => s.title === "Configurações")!} cols="grid-cols-3 sm:grid-cols-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Caixa Aberto (status/identidade da sessão) ────────────
export function ModalCaixaInfo({ sessao, onClose }: { sessao: CaixaSessao; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <Unlock className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Caixa Aberto</h3>
            <p className="text-xs text-muted-foreground">Sessão em andamento</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="bg-secondary border border-border rounded-xl divide-y divide-border">
          <div className="flex justify-between items-center px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">Aberto em</span>
            <span className="font-semibold text-foreground">{fmtDate(sessao.openedAt)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">Responsável</span>
            <span className="font-semibold text-foreground">{sessao.abertoPor || "—"}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">Saldo inicial</span>
            <span className="font-semibold text-foreground tabular-nums">{fmtBRL(sessao.saldoInicial)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">Vendas na sessão</span>
            <span className="font-semibold text-foreground tabular-nums">{sessao.totalVendas}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Posição de Caixa (totais da sessão atual) ─────────────
export function ModalPosicaoCaixa({ sessao, movimentos, onClose }: {
  sessao: CaixaSessao; movimentos: CaixaMovimento[]; onClose: () => void;
}) {
  const totalSangria    = movimentos.filter(m => m.tipo === "sangria")   .reduce((s, m) => s + parseFloat(m.valor), 0);
  const totalSuprimento = movimentos.filter(m => m.tipo === "suprimento").reduce((s, m) => s + parseFloat(m.valor), 0);
  const saldoAtual =
    parseFloat(sessao.saldoInicial) + parseFloat(sessao.totalDinheiro) + totalSuprimento - totalSangria;

  const LINHAS = [
    { label: "Saldo inicial",   val: parseFloat(sessao.saldoInicial),  cor: "text-foreground" },
    { label: "Dinheiro vendas", val: parseFloat(sessao.totalDinheiro), cor: "text-emerald-600" },
    { label: "PIX",             val: parseFloat(sessao.totalPix),      cor: "text-emerald-600" },
    { label: "Cartão Crédito",  val: parseFloat(sessao.totalCartao),   cor: "text-emerald-600" },
    { label: "Cartão Débito",   val: parseFloat(sessao.totalDebito),   cor: "text-emerald-600" },
    { label: "Outros",          val: parseFloat(sessao.totalOutros),   cor: "text-emerald-600" },
    { label: "Suprimentos",     val: totalSuprimento,                  cor: "text-blue-600" },
    { label: "Sangrias",        val: -totalSangria,                    cor: "text-red-500" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center">
            <List className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Posição de Caixa</h3>
            <p className="text-xs text-muted-foreground">Totais da sessão em andamento</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="bg-secondary border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {LINHAS.map(l => Math.abs(l.val) > 0.001 && (
              <div key={l.label} className="flex justify-between items-center px-4 py-2 text-xs">
                <span className="text-muted-foreground">{l.label}</span>
                <span className={`font-semibold tabular-nums ${l.cor}`}>{fmtBRL(l.val)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 border-t border-emerald-100">
            <span className="text-xs font-bold text-emerald-700">Saldo em Caixa Agora</span>
            <span className="text-sm font-black text-emerald-700 tabular-nums">{fmtBRL(saldoAtual)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Apontamento (histórico de sangrias/suprimentos) ───────
export function ModalApontamento({ movimentos, onClose }: { movimentos: CaixaMovimento[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardEdit className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">Apontamentos da Sessão</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {movimentos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma movimentação registrada</div>
          ) : movimentos.map(m => {
            const isSangria = m.tipo === "sangria";
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isSangria
                    ? <ArrowDownCircle className="w-4 h-4 text-red-500 shrink-0" />
                    : <ArrowUpCircle className="w-4 h-4 text-blue-600 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{isSangria ? "Sangria" : "Suprimento"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.motivo || "Sem motivo informado"} · {fmtDate(m.createdAt)}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${isSangria ? "text-red-500" : "text-blue-600"}`}>
                  {isSangria ? "−" : "+"}{fmtBRL(m.valor)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
