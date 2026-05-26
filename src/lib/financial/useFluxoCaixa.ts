/**
 * useFluxoCaixa.ts
 * ─────────────────────────────────────────────────────────────────
 * Lógica de negócio unificada para a tela de Fluxo de Caixa do Armazix.
 * Substitui as abas separadas de "Contas a Pagar" e "Contas a Receber"
 * por um único LancamentoFinanceiro normalizado.
 *
 * Contém:
 *  1. Tipagem completa (LancamentoFinanceiro, enums, filtros)
 *  2. Mock data com dados realistas
 *  3. getLancamentos() — busca + filtragem avançada dinâmica
 *  4. agruparPor()     — agrupamento dinâmico por qualquer chave
 *  5. calcularTotais() — sumário automático de receitas/despesas/saldos
 *  6. useFluxoCaixa()  — React hook que expõe tudo ao componente
 */

import { useMemo, useState } from "react";

// ─── 1. ENUMS ─────────────────────────────────────────────────────

export type NaturezaLancamento = "RECEITA" | "DESPESA" | "TRANSFERENCIA";
export type StatusLancamento   = "EM_ABERTO" | "EFETIVADO";

/** Colunas de data disponíveis para o filtro de período */
export type TipoDataFiltro = "inclusao" | "emissao" | "vencimento" | "pagamento";

// ─── 2. MODELO DE DADOS ───────────────────────────────────────────

export interface LancamentoFinanceiro {
  /** Código único do lançamento */
  id_lancamento: string;

  /** Natureza: receita, despesa ou transferência entre contas */
  natureza: NaturezaLancamento;

  /** Status do ciclo de vida do lançamento */
  status: StatusLancamento;

  /** Conta contábil vinculada (ex: "1.1.01 - Caixa") */
  conta_contabil: string;

  /** Unidade/filial de negócio */
  unidade: string;

  /** Nome do cliente (receitas) ou fornecedor (despesas) */
  favorecido: string;

  /** Campos de histórico livre para descritivos adicionais */
  historico_1: string;
  historico_2: string;
  historico_3: string;

  /** Documentos de referência */
  num_nota_fiscal: string;
  num_documento:   string;
  num_cheque:      string;
  nsu:             string;

  /** Datas no formato ISO 8601 (YYYY-MM-DD) — null quando não aplicável */
  data_inclusao:   string;
  data_emissao:    string;
  data_vencimento: string;
  data_previsao:   string;
  data_pagamento:  string | null;

  /** Valores monetários */
  valor_nominal: number;
  acrescimo:     number;
  desconto:      number;
  /** valor_total = valor_nominal + acrescimo - desconto */
  valor_total:   number;

  /** Classificações operacionais */
  forma_pagamento: string;
  conta_corrente:  string;
  centro_custo:    string;
  memorando:       string;
}

// ─── 3. FILTROS ───────────────────────────────────────────────────

export interface PeriodoData {
  data_inicio:  string; // YYYY-MM-DD
  hora_inicio:  string; // HH:mm  (default "00:00")
  data_fim:     string; // YYYY-MM-DD
  hora_fim:     string; // HH:mm  (default "23:59")
}

export interface FiltrosFluxo {
  /** Filtra por uma ou mais naturezas. Vazio = todas. */
  natureza_filtro: NaturezaLancamento[];

  /** Filtra por um ou mais status. Vazio = todos. */
  status_filtro: StatusLancamento[];

  /** Qual campo de data será usado para o range */
  tipo_data_filtro: TipoDataFiltro;

  /** Range de datas + horas */
  periodo_data: PeriodoData | null;

  /** ID da forma de pagamento ou "TODAS" */
  forma_pagamento_id: string;

  /** ID da conta corrente ou "TODAS" */
  conta_corrente_id: string;

  /** Histórico 1 exato ou "TODOS" */
  historico_id: string;

  /** Unidade/filial ou "TODAS" */
  unidade_id: string;

  /** Busca parcial no num_documento */
  busca_documento: string;

  /** Busca parcial no num_cheque */
  busca_cheque: string;

  /** Limita o número de registros retornados (default: 2_000_000) */
  limite_registros: number;
}

// ─── 4. RESULTADO ────────────────────────────────────────────────

export interface TotaisFluxo {
  total_receitas_em_aberto:    number;
  total_receitas_efetivadas:   number;
  total_despesas_em_aberto:    number;
  total_despesas_efetivadas:   number;
  /** Receitas EM_ABERTO − Despesas EM_ABERTO */
  saldo_previsto:              number;
  /** Receitas EFETIVADAS − Despesas EFETIVADAS */
  saldo_realizado:             number;
  total_acrescimos:            number;
  total_descontos:             number;
}

export interface ResultadoFluxo {
  registros:  LancamentoFinanceiro[];
  totais:     TotaisFluxo;
  total_bruto: number; // total de registros antes do limite
}

/** Estrutura de agrupamento: chave → lista de lançamentos */
export type GrupoFluxo = Record<string, LancamentoFinanceiro[]>;

// ─── 5. MOCK DATA ─────────────────────────────────────────────────

export const LANCAMENTOS_MOCK: LancamentoFinanceiro[] = [
  // RECEITAS
  {
    id_lancamento: "L-0001", natureza: "RECEITA",  status: "EM_ABERTO",
    conta_contabil: "1.1.01 - Caixa",       unidade: "Loja Principal",  favorecido: "Ana Oliveira",
    historico_1: "Venda #1042", historico_2: "Entrega balcao", historico_3: "",
    num_nota_fiscal: "NF-1042", num_documento: "DOC-001", num_cheque: "", nsu: "NSU-0001",
    data_inclusao: "2026-05-25", data_emissao: "2026-05-25", data_vencimento: "2026-05-30",
    data_previsao: "2026-05-30", data_pagamento: null,
    valor_nominal: 450.00, acrescimo: 0,  desconto: 0,    valor_total: 450.00,
    forma_pagamento: "PIX",           conta_corrente: "CC-001", centro_custo: "LOJA", memorando: "",
  },
  {
    id_lancamento: "L-0002", natureza: "RECEITA",  status: "EFETIVADO",
    conta_contabil: "1.1.01 - Caixa",       unidade: "Loja Principal",  favorecido: "Carlos Silva",
    historico_1: "Venda #1038", historico_2: "Cartao credito", historico_3: "",
    num_nota_fiscal: "NF-1038", num_documento: "DOC-002", num_cheque: "", nsu: "NSU-0002",
    data_inclusao: "2026-05-20", data_emissao: "2026-05-20", data_vencimento: "2026-05-20",
    data_previsao: "2026-05-20", data_pagamento: "2026-05-20",
    valor_nominal: 180.50, acrescimo: 0,   desconto: 10.00, valor_total: 170.50,
    forma_pagamento: "Cartao",            conta_corrente: "CC-001", centro_custo: "LOJA", memorando: "",
  },
  {
    id_lancamento: "L-0003", natureza: "RECEITA",  status: "EM_ABERTO",
    conta_contabil: "1.1.02 - Bancos",      unidade: "Loja Principal",  favorecido: "Pedro Costa",
    historico_1: "Venda #1031", historico_2: "Boleto vencido", historico_3: "",
    num_nota_fiscal: "NF-1031", num_documento: "DOC-003", num_cheque: "", nsu: "",
    data_inclusao: "2026-05-01", data_emissao: "2026-05-01", data_vencimento: "2026-05-10",
    data_previsao: "2026-05-10", data_pagamento: null,
    valor_nominal: 320.00, acrescimo: 16.00, desconto: 0,    valor_total: 336.00,
    forma_pagamento: "Boleto",            conta_corrente: "CC-002", centro_custo: "LOJA", memorando: "Vencido",
  },
  {
    id_lancamento: "L-0004", natureza: "RECEITA",  status: "EM_ABERTO",
    conta_contabil: "1.1.02 - Bancos",      unidade: "Filial Norte",    favorecido: "Fernanda Lima",
    historico_1: "Servico especial", historico_2: "Parcela 1/3", historico_3: "",
    num_nota_fiscal: "", num_documento: "SERV-001", num_cheque: "", nsu: "",
    data_inclusao: "2026-05-15", data_emissao: "2026-05-15", data_vencimento: "2026-06-15",
    data_previsao: "2026-06-15", data_pagamento: null,
    valor_nominal: 750.00, acrescimo: 0,   desconto: 0,    valor_total: 750.00,
    forma_pagamento: "Transferencia",     conta_corrente: "CC-002", centro_custo: "SERVICOS", memorando: "",
  },

  // DESPESAS
  {
    id_lancamento: "L-0005", natureza: "DESPESA",  status: "EM_ABERTO",
    conta_contabil: "2.1.01 - Fornecedores", unidade: "Loja Principal", favorecido: "Distribuidora ABC",
    historico_1: "Compra estoque mai/26", historico_2: "Parcela 1/3", historico_3: "",
    num_nota_fiscal: "NF-4521", num_documento: "NF-4521", num_cheque: "", nsu: "",
    data_inclusao: "2026-05-10", data_emissao: "2026-05-10", data_vencimento: "2026-05-31",
    data_previsao: "2026-05-31", data_pagamento: null,
    valor_nominal: 1200.00, acrescimo: 0, desconto: 50.00, valor_total: 1150.00,
    forma_pagamento: "Boleto",           conta_corrente: "CC-001", centro_custo: "ESTOQUE", memorando: "",
  },
  {
    id_lancamento: "L-0006", natureza: "DESPESA",  status: "EFETIVADO",
    conta_contabil: "2.1.01 - Fornecedores", unidade: "Loja Principal", favorecido: "Fornecedor XYZ",
    historico_1: "Reposicao produto A", historico_2: "", historico_3: "",
    num_nota_fiscal: "NF-3310", num_documento: "NF-3310", num_cheque: "", nsu: "",
    data_inclusao: "2026-05-14", data_emissao: "2026-05-14", data_vencimento: "2026-05-15",
    data_previsao: "2026-05-15", data_pagamento: "2026-05-15",
    valor_nominal: 560.00, acrescimo: 0, desconto: 0,   valor_total: 560.00,
    forma_pagamento: "PIX",              conta_corrente: "CC-001", centro_custo: "ESTOQUE", memorando: "",
  },
  {
    id_lancamento: "L-0007", natureza: "DESPESA",  status: "EM_ABERTO",
    conta_contabil: "2.1.02 - Alugueis",     unidade: "Loja Principal", favorecido: "Imobiliaria Central",
    historico_1: "Aluguel maio/2026", historico_2: "", historico_3: "",
    num_nota_fiscal: "", num_documento: "REC-05/26", num_cheque: "", nsu: "",
    data_inclusao: "2026-04-30", data_emissao: "2026-04-30", data_vencimento: "2026-05-05",
    data_previsao: "2026-05-05", data_pagamento: null,
    valor_nominal: 2500.00, acrescimo: 125.00, desconto: 0, valor_total: 2625.00,
    forma_pagamento: "Transferencia",    conta_corrente: "CC-002", centro_custo: "ADMIN", memorando: "VENCIDO",
  },
  {
    id_lancamento: "L-0008", natureza: "DESPESA",  status: "EM_ABERTO",
    conta_contabil: "2.1.03 - Utilidades",   unidade: "Filial Norte",   favorecido: "CPFL Energia",
    historico_1: "Energia eletrica jun/26", historico_2: "", historico_3: "",
    num_nota_fiscal: "FAT-2605", num_documento: "FAT-2605", num_cheque: "", nsu: "",
    data_inclusao: "2026-05-25", data_emissao: "2026-05-25", data_vencimento: "2026-06-10",
    data_previsao: "2026-06-10", data_pagamento: null,
    valor_nominal: 380.00, acrescimo: 0, desconto: 0, valor_total: 380.00,
    forma_pagamento: "Debito",           conta_corrente: "CC-002", centro_custo: "ADMIN", memorando: "",
  },

  // TRANSFERENCIA
  {
    id_lancamento: "L-0009", natureza: "TRANSFERENCIA", status: "EFETIVADO",
    conta_contabil: "1.1.02 - Bancos",      unidade: "Loja Principal",  favorecido: "Transferencia interna",
    historico_1: "Sangria caixa para banco", historico_2: "", historico_3: "",
    num_nota_fiscal: "", num_documento: "TRANSF-001", num_cheque: "", nsu: "",
    data_inclusao: "2026-05-22", data_emissao: "2026-05-22", data_vencimento: "2026-05-22",
    data_previsao: "2026-05-22", data_pagamento: "2026-05-22",
    valor_nominal: 1000.00, acrescimo: 0, desconto: 0, valor_total: 1000.00,
    forma_pagamento: "Transferencia",    conta_corrente: "CC-001", centro_custo: "ADMIN", memorando: "",
  },
];

// ─── 6. FILTROS DEFAULT ──────────────────────────────────────────

export const FILTROS_DEFAULT: FiltrosFluxo = {
  natureza_filtro:    [],
  status_filtro:      [],
  tipo_data_filtro:   "vencimento",
  periodo_data:       null,
  forma_pagamento_id: "TODAS",
  conta_corrente_id:  "TODAS",
  historico_id:       "TODOS",
  unidade_id:         "TODAS",
  busca_documento:    "",
  busca_cheque:       "",
  limite_registros:   2_000_000,
};

// ─── 7. HELPERS INTERNOS ─────────────────────────────────────────

/** Converte "DD/MM/YYYY HH:mm" ou "DD/MM/YYYY" ou "YYYY-MM-DD" → timestamp */
function toTimestamp(dateStr: string | null, time = "00:00"): number | null {
  if (!dateStr) return null;
  let normalized = dateStr.trim();

  // DD/MM/YYYY [HH:mm]
  if (/^\d{2}\/\d{2}\/\d{4}/.test(normalized)) {
    const [datePart, timePart = "00:00"] = normalized.split(" ");
    const [d, m, y] = datePart.split("/");
    normalized = `${y}-${m}-${d}T${timePart}:00`;
  } else {
    // YYYY-MM-DD
    normalized = `${normalized}T${time}:00`;
  }

  const ts = Date.parse(normalized);
  return isNaN(ts) ? null : ts;
}

/** Retorna o valor ISO do campo de data conforme tipo_data_filtro */
function getDataPorTipo(l: LancamentoFinanceiro, tipo: TipoDataFiltro): string | null {
  switch (tipo) {
    case "inclusao":    return l.data_inclusao;
    case "emissao":     return l.data_emissao;
    case "vencimento":  return l.data_vencimento;
    case "pagamento":   return l.data_pagamento;
  }
}

// ─── 8. getLancamentos ───────────────────────────────────────────

/**
 * Filtra a lista de lançamentos com base nos parâmetros fornecidos.
 * Todos os filtros são dinâmicos: se não informados (array vazio ou "TODAS"),
 * não restringem o resultado.
 *
 * @param source  Lista completa de lançamentos (ou fetch de API)
 * @param filtros Objeto de filtros — use FILTROS_DEFAULT como base
 */
export function getLancamentos(
  source: LancamentoFinanceiro[],
  filtros: Partial<FiltrosFluxo> = {},
): ResultadoFluxo {
  const f: FiltrosFluxo = { ...FILTROS_DEFAULT, ...filtros };

  // Pre-calcula timestamps do período uma única vez (perf)
  let tsInicio: number | null = null;
  let tsFim:    number | null = null;
  if (f.periodo_data) {
    tsInicio = toTimestamp(f.periodo_data.data_inicio, f.periodo_data.hora_inicio || "00:00");
    tsFim    = toTimestamp(f.periodo_data.data_fim,    f.periodo_data.hora_fim    || "23:59");
  }

  const filtered = source.filter(l => {
    // ── Natureza
    if (f.natureza_filtro.length > 0 && !f.natureza_filtro.includes(l.natureza)) return false;

    // ── Status
    if (f.status_filtro.length > 0 && !f.status_filtro.includes(l.status)) return false;

    // ── Período de datas
    if (tsInicio !== null || tsFim !== null) {
      const rawData = getDataPorTipo(l, f.tipo_data_filtro);
      const tsData  = toTimestamp(rawData);
      if (tsData === null) return false;
      if (tsInicio !== null && tsData < tsInicio) return false;
      if (tsFim    !== null && tsData > tsFim)    return false;
    }

    // ── Forma de pagamento
    if (f.forma_pagamento_id !== "TODAS" && l.forma_pagamento !== f.forma_pagamento_id) return false;

    // ── Conta corrente
    if (f.conta_corrente_id !== "TODAS" && l.conta_corrente !== f.conta_corrente_id) return false;

    // ── Histórico 1
    if (f.historico_id !== "TODOS" && l.historico_1 !== f.historico_id) return false;

    // ── Unidade
    if (f.unidade_id !== "TODAS" && l.unidade !== f.unidade_id) return false;

    // ── Busca em num_documento (parcial, case-insensitive)
    if (f.busca_documento) {
      const q = f.busca_documento.toLowerCase();
      if (!l.num_documento.toLowerCase().includes(q)) return false;
    }

    // ── Busca em num_cheque (parcial, case-insensitive)
    if (f.busca_cheque) {
      const q = f.busca_cheque.toLowerCase();
      if (!l.num_cheque.toLowerCase().includes(q)) return false;
    }

    return true;
  });

  const total_bruto = filtered.length;

  // Aplica limite
  const registros = filtered.slice(0, f.limite_registros);

  return {
    registros,
    totais: calcularTotais(registros),
    total_bruto,
  };
}

// ─── 9. calcularTotais ───────────────────────────────────────────

/**
 * Calcula o sumário financeiro a partir de uma lista já filtrada.
 * Pode ser chamada independentemente para sub-grupos.
 */
export function calcularTotais(registros: LancamentoFinanceiro[]): TotaisFluxo {
  let total_receitas_em_aberto  = 0;
  let total_receitas_efetivadas = 0;
  let total_despesas_em_aberto  = 0;
  let total_despesas_efetivadas = 0;
  let total_acrescimos          = 0;
  let total_descontos           = 0;

  for (const l of registros) {
    total_acrescimos += l.acrescimo;
    total_descontos  += l.desconto;

    if (l.natureza === "RECEITA") {
      if (l.status === "EM_ABERTO") total_receitas_em_aberto  += l.valor_total;
      else                          total_receitas_efetivadas += l.valor_total;
    } else if (l.natureza === "DESPESA") {
      if (l.status === "EM_ABERTO") total_despesas_em_aberto  += l.valor_total;
      else                          total_despesas_efetivadas += l.valor_total;
    }
    // TRANSFERENCIA não entra no saldo (é neutro por natureza)
  }

  return {
    total_receitas_em_aberto,
    total_receitas_efetivadas,
    total_despesas_em_aberto,
    total_despesas_efetivadas,
    saldo_previsto:  total_receitas_em_aberto  - total_despesas_em_aberto,
    saldo_realizado: total_receitas_efetivadas - total_despesas_efetivadas,
    total_acrescimos,
    total_descontos,
  };
}

// ─── 10. agruparPor ──────────────────────────────────────────────

/**
 * Agrupa uma lista de lançamentos por qualquer chave do objeto,
 * retornando um Record<string, LancamentoFinanceiro[]>.
 *
 * Exemplo de uso:
 *   agruparPor(registros, "unidade")
 *   agruparPor(registros, "forma_pagamento")
 *   agruparPor(registros, "favorecido")
 *
 * O front-end pode iterar Object.entries() para renderizar colapsáveis.
 * Cada grupo inclui seu próprio sub-total via calcularTotais().
 */
export function agruparPor(
  registros: LancamentoFinanceiro[],
  chave: keyof LancamentoFinanceiro,
): GrupoFluxo {
  const grupos: GrupoFluxo = {};

  for (const l of registros) {
    const valor = String(l[chave] ?? "(sem valor)");
    if (!grupos[valor]) grupos[valor] = [];
    grupos[valor].push(l);
  }

  // Ordena os grupos alfabeticamente para exibição consistente
  return Object.fromEntries(
    Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b, "pt-BR")),
  );
}

/** Versão com totais por grupo — útil para cabeçalhos de accordion */
export interface GrupoComTotais {
  chave: string;
  registros: LancamentoFinanceiro[];
  totais: TotaisFluxo;
}

export function agruparComTotais(
  registros: LancamentoFinanceiro[],
  chave: keyof LancamentoFinanceiro,
): GrupoComTotais[] {
  const grupos = agruparPor(registros, chave);
  return Object.entries(grupos).map(([k, regs]) => ({
    chave: k,
    registros: regs,
    totais: calcularTotais(regs),
  }));
}

// ─── 11. REACT HOOK ──────────────────────────────────────────────

/**
 * useFluxoCaixa
 * ─────────────────────────────────────────────────────────────────
 * Hook React que encapsula todo o estado e as funções de fluxo de caixa.
 *
 * Uso no componente:
 *   const { filtros, setFiltro, resultado, grupos } = useFluxoCaixa(lancamentos);
 */
export function useFluxoCaixa(source: LancamentoFinanceiro[] = LANCAMENTOS_MOCK) {
  const [filtros, setFiltros] = useState<FiltrosFluxo>(FILTROS_DEFAULT);
  const [chaveAgrupamento, setChaveAgrupamento] = useState<keyof LancamentoFinanceiro | null>(null);

  /** Atualiza um único campo dos filtros (partial update) */
  const setFiltro = <K extends keyof FiltrosFluxo>(chave: K, valor: FiltrosFluxo[K]) => {
    setFiltros(prev => ({ ...prev, [chave]: valor }));
  };

  /** Reseta todos os filtros para o padrão */
  const resetFiltros = () => setFiltros(FILTROS_DEFAULT);

  /** Resultado memoizado — só recalcula quando source ou filtros mudam */
  const resultado = useMemo(() => getLancamentos(source, filtros), [source, filtros]);

  /** Grupos memoizados — só recalcula quando resultado ou chave mudam */
  const grupos = useMemo<GrupoComTotais[]>(() => {
    if (!chaveAgrupamento) return [];
    return agruparComTotais(resultado.registros, chaveAgrupamento);
  }, [resultado.registros, chaveAgrupamento]);

  /** Lista de valores únicos de uma chave (para popular dropdowns de filtro) */
  const opcoesUnicas = (chave: keyof LancamentoFinanceiro): string[] => {
    const set = new Set(source.map(l => String(l[chave] ?? "")));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  return {
    // Estado
    filtros,
    chaveAgrupamento,

    // Mutações
    setFiltro,
    setFiltros,
    resetFiltros,
    setChaveAgrupamento,

    // Dados processados
    resultado,       // { registros, totais, total_bruto }
    grupos,          // GrupoComTotais[] quando chaveAgrupamento está definida

    // Utilitários
    opcoesUnicas,
  };
}
