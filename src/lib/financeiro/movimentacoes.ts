// ─────────────────────────────────────────────────────────────────────────
// Classificação das movimentações financeiras — módulo puro (sem DB).
//
// Uma "saída" pode ser coisas bem diferentes: o pagamento de uma conta a
// pagar, o estorno de uma venda (dinheiro devolvido ao cliente) ou uma
// despesa avulsa. Somar tudo num "Saídas do mês" escondia isso — o painel
// mostrava um número só e não dava pra saber quanto foi despesa e quanto foi
// devolução. O servidor classifica cada linha aqui e o dashboard agrupa.
// ─────────────────────────────────────────────────────────────────────────

export type OrigemMovimentacao =
  | "conta_paga" | "estorno" | "outra_saida"
  | "venda" | "conta_recebida" | "outra_entrada";

export const ORIGEM_LABEL: Record<OrigemMovimentacao, string> = {
  conta_paga: "Pagamento de conta",
  estorno: "Estorno de venda",
  outra_saida: "Outras saídas",
  venda: "Venda",
  conta_recebida: "Recebimento de conta",
  outra_entrada: "Outras entradas",
};

export function classificarMovimentacao(m: {
  tipo: string;
  categoria: string | null;
  orderId: string | null;
  /** O lançamento é o pagamento de uma conta a pagar (contas_pagar.lancamento_id). */
  contaPaga: boolean;
  /** O lançamento é o recebimento de uma conta a receber (contas_receber.lancamento_id). */
  contaRecebida: boolean;
}): OrigemMovimentacao {
  if (m.tipo === "saida") {
    // O vínculo com a conta vem primeiro: a categoria de uma conta a pagar é
    // texto livre e poderia coincidir com "estorno".
    if (m.contaPaga) return "conta_paga";
    if (m.categoria === "estorno") return "estorno";
    return "outra_saida";
  }
  if (m.orderId) return "venda";
  if (m.contaRecebida) return "conta_recebida";
  return "outra_entrada";
}

/** "19/09/2026 00:52" no horário de Brasília — formato que as telas do Financeiro já esperam (parseMovData). */
export function formatarDataHoraBR(d: Date | string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(d));
  const p = (t: string) => partes.find(x => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} ${p("hour")}:${p("minute")}`;
}

export interface ComposicaoSaidas {
  contasPagas: number;
  estornos: number;
  outras: number;
  total: number;
  qtdContasPagas: number;
  qtdEstornos: number;
  qtdOutras: number;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Agrupa as saídas por tipo. `origemTipo` ausente (API antiga) cai em
 * "outras" — o total continua batendo com a soma de todas as saídas.
 */
export function comporSaidas(
  movs: { tipo: string; valor: number; origemTipo?: string | null }[],
): ComposicaoSaidas {
  const r: ComposicaoSaidas = { contasPagas: 0, estornos: 0, outras: 0, total: 0, qtdContasPagas: 0, qtdEstornos: 0, qtdOutras: 0 };
  for (const m of movs) {
    if (m.tipo !== "saida") continue;
    const v = Number(m.valor) || 0;
    r.total += v;
    if (m.origemTipo === "conta_paga") { r.contasPagas += v; r.qtdContasPagas++; }
    else if (m.origemTipo === "estorno") { r.estornos += v; r.qtdEstornos++; }
    else { r.outras += v; r.qtdOutras++; }
  }
  return {
    ...r,
    contasPagas: centavos(r.contasPagas), estornos: centavos(r.estornos),
    outras: centavos(r.outras), total: centavos(r.total),
  };
}
