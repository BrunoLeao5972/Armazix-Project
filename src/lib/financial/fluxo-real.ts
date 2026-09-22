// ─────────────────────────────────────────────────────────────────────────
// Fluxo de Caixa com dados reais — módulo puro (sem DB, sem React).
//
// A tela de Fluxo de Caixa lia uma lista fixa embutida no código
// (LANCAMENTOS_MOCK: "Ana Oliveira", "Venda #1042"…) que aparecia igual pra
// TODAS as lojas. Aqui os dados vêm do que a loja realmente tem:
//   - contas a pagar    → DESPESA
//   - contas a receber  → RECEITA
//   - movimentações que NÃO nasceram de uma conta (vendas, estornos, outras
//     entradas/saídas) → RECEITA/DESPESA já efetivadas. As movimentações que
//     são o pagamento/recebimento de uma conta ficam de fora: a própria conta
//     já entra acima, senão o mesmo dinheiro apareceria duas vezes.
// ─────────────────────────────────────────────────────────────────────────

import type { LancamentoFinanceiro } from "./useFluxoCaixa";

interface ContaBase {
  id: string; desc: string; documento: string; categoria: string;
  centroCusto: string; contaFinanceira: string;
  valor: number; juros: number; desconto: number;
  formaPgto: string; emissao: string; vencimento: string;
  status: string; obs: string;
}
export interface ContaPagarApi extends ContaBase { fornecedor: string; pagamento: string | null }
export interface ContaReceberApi extends ContaBase { cliente: string; recebimento: string | null }
export interface MovimentacaoApi {
  id: string; tipo: string; categoria: string; desc: string; valor: number;
  /** "dd/mm/aaaa hh:mm" (ver formatarDataHoraBR). */
  data: string;
  origem?: string; origemTipo?: string; status?: string; formaPgto?: string; responsavel?: string;
}

const SEM_UNIDADE = "—";
const arred = (n: number) => Math.round(n * 100) / 100;

function deConta(
  prefixo: "pagar" | "receber", natureza: "DESPESA" | "RECEITA",
  c: ContaBase, favorecido: string, dataEfetivacao: string | null,
): LancamentoFinanceiro | null {
  if (c.status === "cancelado") return null; // conta cancelada não entra no fluxo
  const efetivada = c.status === "pago";
  return {
    id_lancamento: `${prefixo}:${c.id}`,
    natureza,
    status: efetivada ? "EFETIVADO" : "EM_ABERTO",
    conta_contabil: c.categoria, unidade: SEM_UNIDADE, favorecido: favorecido || "—",
    historico_1: c.desc, historico_2: c.categoria, historico_3: c.obs,
    num_nota_fiscal: "", num_documento: c.documento, num_cheque: "", nsu: "",
    data_inclusao: c.emissao, data_emissao: c.emissao, data_vencimento: c.vencimento,
    data_previsao: c.vencimento, data_pagamento: efetivada ? dataEfetivacao : null,
    valor_nominal: c.valor, acrescimo: c.juros, desconto: c.desconto,
    valor_total: arred(c.valor + c.juros - c.desconto),
    forma_pagamento: c.formaPgto, conta_corrente: c.contaFinanceira,
    centro_custo: c.centroCusto, memorando: c.obs,
  };
}

function deMovimentacao(m: MovimentacaoApi): LancamentoFinanceiro | null {
  // Vieram de uma conta — a conta já está na lista (evita contar em dobro).
  if (m.origemTipo === "conta_paga" || m.origemTipo === "conta_recebida") return null;
  if (m.tipo !== "entrada" && m.tipo !== "saida") return null;
  if (m.status === "cancelado") return null;

  const dia = m.data.split(" ")[0];
  const pendente = m.status === "pendente";
  return {
    id_lancamento: `mov:${m.id}`,
    natureza: m.tipo === "entrada" ? "RECEITA" : "DESPESA",
    status: pendente ? "EM_ABERTO" : "EFETIVADO",
    conta_contabil: m.categoria, unidade: SEM_UNIDADE, favorecido: m.responsavel || "—",
    historico_1: m.desc, historico_2: m.origem ?? "", historico_3: "",
    num_nota_fiscal: "", num_documento: "", num_cheque: "", nsu: "",
    data_inclusao: dia, data_emissao: dia, data_vencimento: dia, data_previsao: dia,
    data_pagamento: pendente ? null : dia,
    valor_nominal: m.valor, acrescimo: 0, desconto: 0, valor_total: m.valor,
    forma_pagamento: m.formaPgto ?? "", conta_corrente: "", centro_custo: "", memorando: "",
  };
}

export function montarLancamentosReais(fontes: {
  pagar: ContaPagarApi[]; receber: ContaReceberApi[]; movimentacoes: MovimentacaoApi[];
}): LancamentoFinanceiro[] {
  const lista: (LancamentoFinanceiro | null)[] = [
    ...fontes.pagar.map(c => deConta("pagar", "DESPESA", c, c.fornecedor, c.pagamento)),
    ...fontes.receber.map(c => deConta("receber", "RECEITA", c, c.cliente, c.recebimento)),
    ...fontes.movimentacoes.map(deMovimentacao),
  ];
  return lista.filter((l): l is LancamentoFinanceiro => l !== null);
}
