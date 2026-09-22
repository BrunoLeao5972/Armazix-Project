// ─────────────────────────────────────────────────────────────────────────
// Resumo financeiro de UMA venda a partir dos seus lançamentos — módulo puro
// (sem DB) pra lista de Vendas e detalhe usarem exatamente a mesma conta.
//
// O estorno (src/lib/orders/estorno.ts) deixa DOIS rastros do mesmo valor: a
// entrada original marcada `estornado` e uma saída compensatória
// (categoria "estorno"). Somar os dois como "estornado" contava o mesmo
// dinheiro em dobro (venda de R$ 25 estornada aparecia como −R$ 50), e como a
// entrada deixa de ser `liquidado` ela também sumia dos "lançados",
// derrubando a receita líquida pra negativo. Aqui cada valor é contado uma
// vez só.
// ─────────────────────────────────────────────────────────────────────────

export interface LancamentoResumo {
  tipo: string;
  categoria: string | null;
  status: string;
  valor: number | string;
}

export interface ResumoFinanceiroVenda {
  /** Quanto entrou de fato pela venda (entradas liquidadas + as já estornadas). */
  lancado: number;
  /** Quanto foi devolvido — contado uma vez, mesmo que haja entrada estornada e saída de estorno. */
  estornado: number;
  /** lancado − estornado (0 numa venda estornada por inteiro). */
  liquido: number;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

export function resumirFinanceiroVenda(lancamentos: LancamentoResumo[]): ResumoFinanceiroVenda {
  let entradas = 0;
  let entradasEstornadas = 0;
  let saidasEstorno = 0;

  for (const l of lancamentos) {
    const v = Number(l.valor) || 0;
    if (l.tipo === "entrada" && (l.status === "liquidado" || l.status === "estornado")) {
      entradas += v;
      if (l.status === "estornado") entradasEstornadas += v;
    }
    if (l.tipo === "saida" && l.categoria === "estorno") saidasEstorno += v;
  }

  // Fonte preferida do "estornado" é a saída compensatória; a entrada marcada
  // `estornado` só entra quando não há saída (nunca as duas juntas).
  const estornado = saidasEstorno > 0 ? saidasEstorno : entradasEstornadas;
  // Venda antiga sem lançamento de entrada, mas com estorno: o estorno é
  // sempre da venda inteira, então ela "valia" pelo menos o que foi estornado.
  const lancado = Math.max(entradas, estornado);

  return { lancado: centavos(lancado), estornado: centavos(estornado), liquido: centavos(lancado - estornado) };
}
