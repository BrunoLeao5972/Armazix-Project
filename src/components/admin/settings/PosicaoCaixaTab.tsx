import { useState, useEffect } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";

// ── Tipos locais, espelhando o suficiente de CaixaSessao/CaixaMovimento
// (pdv.tsx) — cópia local de propósito, pra não puxar o bundle inteiro do
// PDV pra dentro de Configurações (mesmo padrão já usado em
// financeiro/-sec-sessions.tsx). ──
interface CaixaSessaoPosicao {
  codigo: string; saldoInicial: string;
  totalDinheiro: string; totalPix: string; totalCartao: string; totalDebito: string; totalOutros: string;
  abertoPor: string | null; openedAt: string;
}
interface CaixaMovimentoPosicao { tipo: string; valor: string }

const fmtBRL = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return "R$ " + (isNaN(n) ? "0,00" : n.toFixed(2).replace(".", ","));
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Posição do Caixa — o "Resumo da Sessão" que antes ficava dentro do
// modal de Fechamento (Sistema x contagem lado a lado), movido pra cá e
// restrito por permissão: quem fecha o caixa faz uma contagem cega (não vê
// o valor esperado), e só admin/gerente enxergam a posição aqui. ──
export function PosicaoCaixaTab() {
  const [sessao, setSessao]         = useState<CaixaSessaoPosicao | null>(null);
  const [movimentos, setMovimentos] = useState<CaixaMovimentoPosicao[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api.get("/api/pdv/caixa").then(async (res) => {
      const data = await res.json() as { sessao?: CaixaSessaoPosicao | null; movimentos?: CaixaMovimentoPosicao[] };
      setSessao(data.sessao ?? null);
      setMovimentos(data.movimentos ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!sessao) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-10 text-center max-w-lg">
        <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground">Nenhum caixa aberto no momento</p>
        <p className="text-xs text-muted-foreground mt-1">A posição aparece aqui assim que um caixa for aberto no PDV.</p>
      </div>
    );
  }

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
    <div className="space-y-4 max-w-lg">
      <div>
        <h2 className="text-base font-bold text-foreground">Posição do Caixa</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sessão {sessao.codigo} · Aberto por {sessao.abertoPor || "—"} em {fmtDate(sessao.openedAt)}
        </p>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {LINHAS.map(l => Math.abs(l.val) > 0.001 && (
            <div key={l.label} className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">{l.label}</span>
              <span className={`font-semibold tabular-nums ${l.cor}`}>{fmtBRL(l.val)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center px-4 py-3.5 bg-emerald-50 border-t border-emerald-100">
          <span className="text-sm font-bold text-emerald-700">Saldo Esperado no Caixa</span>
          <span className="text-base font-black text-emerald-700 tabular-nums">{fmtBRL(saldoAtual)}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Visível só para administradores e gerentes. Quem fecha o caixa faz uma contagem cega, sem ver esses valores.
      </p>
    </div>
  );
}
