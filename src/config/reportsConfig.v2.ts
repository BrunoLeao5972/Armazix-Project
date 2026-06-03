/**
 * ============================================
 * ARMAZIX - CENTRAL DE CONFIGURAÇÃO DE RELATÓRIOS V2
 * Arquivo: reportsConfig.ts
 * Descrição: Mapeamento Rígido de Filtros por Relatório
 * Estrutura 2025 - Renderização Atômica
 * ============================================
 */

import type { LucideIcon } from "lucide-react";
import {
  Package, TrendingDown, FileText, BarChart3, AlertCircle, Clock, History,
  Users, TrendingUp, Receipt, User, Calendar, Tag, DollarSign, Percent,
  ShoppingCart, CreditCard, X, Landmark, Shield, Lock, Wallet, Banknote,
  Truck, ClipboardList, Archive, Trash2, AlertTriangle, FileSearch,
  Briefcase, Building2, ShoppingBag, Box, PackageCheck, PackageX,
  Calculator, PiggyBank, Coins, ArrowLeftRight, Wallet2
} from "lucide-react";

// ============================================
// TIPOS E ENUMS
// ============================================

export type ModuloReport = "gerencial" | "financeiro" | "suprimentos" | "comercial" | "seguranca";
export type UsoReport = "operacional" | "gerencial" | "fiscal" | "auditoria";
export type NivelPermissao = "admin" | "gerente" | "financeiro" | "vendedor" | "operador" | "caixa" | "fiscal";

// ============================================
// NOVOS TIPOS - CONFIGURAÇÃO DE FILTROS DINÂMICOS
// ============================================

/** Define se e como o relatório usa período de datas */
export type TipoPeriodo =
  | "nenhum"                              // Sem filtro de período (ex: Posição do Caixa, Cadastros)
  | "intervalo_movimentacao"              // Por intervalo de venda/movimentação
  | "data_entrada_nf"                     // Por data de entrada ou emissão da NF
  | "periodo_inatividade"                 // Produtos sem vender desde data X até Y
  | "mes_aniversario"                     // Apenas mês (dropdown Janeiro-Dezembro)
  | "periodo_completo"                    // Período tradicional com data/hora
  | "data_emissao_vencimento"             // Escolha entre data de emissão ou vencimento
  | "data_efetivacao";                    // Data de efetivação (para conta corrente)

/** Filtros visíveis disponíveis para cada relatório */
export type FiltroVisivel =
  // Filtros comerciais
  | "vendedor"
  | "cliente"
  | "fornecedor"
  | "conta_bancaria"
  | "categoria_produto"
  | "status_estoque"
  | "produto"
  | "forma_pagamento"
  | "canal"
  | "status"
  | "motivo_cancelamento"
  | "historico"
  | "periodo"
  | "mes"
  // Filtros específicos de clientes
  | "situacao_cliente"
  | "tipo_cliente"
  // Filtros específicos de contas/financeiro
  | "natureza"
  | "posicao"
  | "contas_bancarias_multi"
  | "centro_resultado"
  // Filtros específicos de produtos
  | "tipo_produto"
  | "toggle_estoque_baixo"
  // Filtros específicos de vendas
  | "remover_opcionais"
  | "somente_vendas"
  // Filtros de auditoria
  | "usuario_operador"
  | "tipo_operacao";

/** Configuração detalhada de filtros por relatório */
export interface ConfiguracaoFiltro {
  /** Tipo de período de datas (se aplicável) */
  tipoPeriodo: TipoPeriodo;
  /** Texto exibido no label do período */
  labelPeriodo?: string;
  /** Lista de filtros adicionais que aparecem no drawer */
  filtrosVisiveis: FiltroVisivel[];
  /** Configurações extras específicas */
  opcoes?: {
    /** Para status_estoque: valores disponíveis no select */
    statusEstoque?: string[];
    /** Para categoria_produto: permitir múltipla seleção */
    multiplaCategoria?: boolean;
    /** Range de estoque mínimo */
    rangeEstoqueMinimo?: boolean;
    /** Naturezas disponíveis (Receitas, Despesas, Transferências) */
    naturezas?: string[];
    /** Posições disponíveis (Em Aberto, Efetivadas) */
    posicoes?: string[];
    /** Tipos de cliente */
    tiposCliente?: string[];
    /** Situações de cliente */
    situacoesCliente?: string[];
    /** Tipos de produto (Produto, Insumo) */
    tiposProduto?: string[];
    /** Contas bancárias disponíveis */
    contasBancarias?: string[];
  };
}

export type FormatoExportacao = "pdf" | "excel" | "csv" | "json" | "print";
export type StatusReport = "ativo" | "beta" | "descontinuado" | "em_breve";

// ============================================
// INTERFACES
// ============================================

export interface ReportItem {
  id: string;
  nome: string;
  descricao: string;
  modulo: ModuloReport;
  uso: UsoReport;
  permissaoNecessaria: NivelPermissao[];
  icone: LucideIcon;
  destaque?: boolean;
  permiteFavorito: boolean;
  status: StatusReport;
  /** @deprecated Use configuracaoFiltro em vez de filtrosDisponiveis */
  filtrosDisponiveis?: string[];
  /** Nova configuração dinâmica de filtros */
  configuracaoFiltro: ConfiguracaoFiltro;
  formatosExportacao: FormatoExportacao[];
  endpointGeracao?: string;
  usaHistoricoEstruturado?: boolean;
  tags?: string[];
  ordem: number;
  versao: string;
  atualizadoEm?: string;
}

export interface ReportCategory {
  id: ModuloReport;
  label: string;
  emoji: string;
  cor: string;
  icone: LucideIcon;
  descricao: string;
  ordem: number;
}

// ============================================
// CATEGORIAS - ESTRUTURA 2025
// ============================================

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "gerencial",
    label: "Demonstrativos & Resultados",
    emoji: "📈",
    cor: "text-indigo-600",
    icone: BarChart3,
    descricao: "Relatórios gerenciais, demonstrativos e resultados financeiros",
    ordem: 1
  },
  {
    id: "financeiro",
    label: "Contas, Cobranças & Caixa",
    emoji: "💰",
    cor: "text-emerald-600",
    icone: DollarSign,
    descricao: "Contas a pagar/receber, cobranças, caixa e movimentação bancária",
    ordem: 2
  },
  {
    id: "suprimentos",
    label: "Compras & Estoque",
    emoji: "📦",
    cor: "text-amber-600",
    icone: Package,
    descricao: "Gestão de estoque, compras, CMV e curva ABC",
    ordem: 3
  },
  {
    id: "comercial",
    label: "Vendas & Produtos",
    emoji: "📊",
    cor: "text-rose-600",
    icone: ShoppingCart,
    descricao: "Vendas, curva ABC de vendas e cadastro de produtos",
    ordem: 4
  },
  {
    id: "seguranca",
    label: "Clientes & Auditoria",
    emoji: "👥",
    cor: "text-blue-600",
    icone: Users,
    descricao: "Cadastro de clientes, fiscal e segurança",
    ordem: 5
  }
];

// ============================================
// CATÁLOGO OFICIAL - MAPEAMENTO RÍGIDO V2
// ============================================

export const REPORTS_CATALOGO: ReportItem[] = [
  // ============================================
  // 1. FINANCEIRO - Contas, Cobranças & Caixa
  // ============================================

  // 1.1 Contas (Contas - Clientes/Fornecedores)
  {
    id: "fin-contas",
    nome: "Contas",
    descricao: "Relatório de contas a receber/pagar com filtros por natureza e posição",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Receipt,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "data_emissao_vencimento",
      labelPeriodo: "Período por",
      filtrosVisiveis: ["natureza", "posicao"],
      opcoes: {
        naturezas: ["Receitas", "Despesas", "Transferências"],
        posicoes: ["Em Aberto", "Efetivadas"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "2.0"
  },

  // 1.2 Conta Corrente / Bancos
  {
    id: "fin-conta-corrente",
    nome: "Conta Corrente",
    descricao: "Extrato e movimentações por conta bancária com histórico de entradas/saídas",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: ArrowLeftRight,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "data_efetivacao",
      labelPeriodo: "Data de Efetivação",
      filtrosVisiveis: ["contas_bancarias_multi"],
      opcoes: {
        contasBancarias: ["Banco do Nordeste", "Caixa Econômica", "Cartões", "Cofre"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "2.0"
  },

  // 1.3 Receitas do Período
  {
    id: "fin-receitas",
    nome: "Receitas do Período",
    descricao: "Receitas filtradas por cliente e histórico contábil/centro de resultado",
    modulo: "financeiro",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: TrendingUp,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Data de Emissão",
      filtrosVisiveis: ["cliente", "historico", "centro_resultado"]
    },
    formatosExportacao: ["pdf", "excel"],
    usaHistoricoEstruturado: true,
    ordem: 3,
    versao: "2.0"
  },

  // 1.4 Posição do Caixa
  {
    id: "fin-posicao-caixa",
    nome: "Posição do Caixa",
    descricao: "Estado atual do caixa com faturamento do dia, vendas e quebra por formas de pagamento",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "caixa", "financeiro"],
    icone: Wallet2,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "nenhum",
      filtrosVisiveis: ["forma_pagamento"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 4,
    versao: "2.0"
  },

  // ============================================
  // 2. SUPRIMENTOS - Compras & Estoque
  // ============================================

  // 2.1 Curva ABC de Compras
  {
    id: "sup-curva-abc-compras",
    nome: "Curva ABC de Compras",
    descricao: "Análise de compras por fornecedor, categoria e tipo de produto",
    modulo: "suprimentos",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "operador"],
    icone: BarChart3,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período das Compras",
      filtrosVisiveis: ["fornecedor", "categoria_produto", "produto", "tipo_produto"],
      opcoes: {
        tiposProduto: ["Produto", "Insumo"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "2.0"
  },

  // 2.2 CMV (Custo da Mercadoria Vendida)
  {
    id: "sup-cmv",
    nome: "CMV - Custo da Mercadoria Vendida",
    descricao: "Cálculo de margem real e CMV com histórico de entradas e inventário",
    modulo: "suprimentos",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente"],
    icone: Calculator,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["categoria_produto"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "2.0"
  },

  // 2.3 Inventário, Balancete e Extrato de Estoque
  {
    id: "sup-inventario",
    nome: "Inventário e Balancete",
    descricao: "Movimentação de estoque com filtros por produto, categoria e período",
    modulo: "suprimentos",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "operador"],
    icone: Archive,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "intervalo_movimentacao",
      labelPeriodo: "Período de Movimentação",
      filtrosVisiveis: ["produto", "categoria_produto", "status_estoque"],
      opcoes: {
        statusEstoque: ["Crítico", "Baixo", "Normal", "Excesso"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 3,
    versao: "2.0"
  },

  // ============================================
  // 3. COMERCIAL - Vendas & Produtos
  // ============================================

  // 3.1 Curva ABC de Vendas
  {
    id: "com-curva-abc-vendas",
    nome: "Curva ABC de Vendas",
    descricao: "Análise de vendas por vendedor, categoria, fornecedor e marca",
    modulo: "comercial",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "vendedor"],
    icone: TrendingUp,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Data de Emissão da Venda",
      filtrosVisiveis: ["vendedor", "categoria_produto", "fornecedor", "somente_vendas", "remover_opcionais"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "2.0"
  },

  // 3.2 Cadastro de Produtos
  {
    id: "com-produtos-cadastro",
    nome: "Cadastro de Produtos",
    descricao: "Listagem de produtos com filtro de situação, categoria e toggle de estoque baixo",
    modulo: "comercial",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "vendedor", "operador"],
    icone: Box,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "nenhum",
      filtrosVisiveis: ["status", "categoria_produto", "toggle_estoque_baixo"],
      opcoes: {
        statusEstoque: ["Ativo", "Inativo"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "2.0"
  },

  // ============================================
  // 4. SEGURANÇA - Clientes & Auditoria
  // ============================================

  // 4.1 Cadastro de Clientes
  {
    id: "seg-clientes-cadastro",
    nome: "Cadastro de Clientes",
    descricao: "Relatório de clientes filtrado por situação e tipo",
    modulo: "seguranca",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "vendedor"],
    icone: Users,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "nenhum",
      filtrosVisiveis: ["situacao_cliente", "tipo_cliente"],
      opcoes: {
        situacoesCliente: ["Todos", "Ativos", "Inativos"],
        tiposCliente: ["Pessoa Física", "Pessoa Jurídica", "Revendedor"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "2.0"
  },

  // 4.2 Exclusões (Auditoria)
  {
    id: "seg-exclusoes",
    nome: "Exclusões",
    descricao: "Logs de quem deletou produtos, vendas ou lançamentos",
    modulo: "seguranca",
    uso: "auditoria",
    permissaoNecessaria: ["admin", "gerente"],
    icone: Trash2,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período da Exclusão",
      filtrosVisiveis: ["usuario_operador", "tipo_operacao"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "2.0"
  },

  // 4.3 Fiscal
  {
    id: "seg-fiscal",
    nome: "Fiscal",
    descricao: "Notas fiscais emitidas (NF-e/NFC-e), cancelamentos e logs",
    modulo: "seguranca",
    uso: "fiscal",
    permissaoNecessaria: ["admin", "gerente", "fiscal"],
    icone: FileSearch,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Emissão",
      filtrosVisiveis: ["status", "cliente"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 3,
    versao: "2.0"
  },

  // ============================================
  // 5. GERENCIAL - Demonstrativos & Resultados
  // ============================================

  // 5.1 Demonstrativo Padrão
  {
    id: "ger-demonstrativo",
    nome: "Demonstrativo Padrão",
    descricao: "Relatório consolidado do resultado do período",
    modulo: "gerencial",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente"],
    icone: BarChart3,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["historico"]
    },
    formatosExportacao: ["pdf", "excel"],
    usaHistoricoEstruturado: true,
    ordem: 1,
    versao: "2.0"
  },

  // 5.2 Totais por Históricos
  {
    id: "ger-totais-historicos",
    nome: "Totais por Históricos",
    descricao: "Cruzamento financeiro com árvore de históricos estruturados",
    modulo: "gerencial",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Landmark,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["historico", "conta_bancaria"]
    },
    formatosExportacao: ["pdf", "excel"],
    usaHistoricoEstruturado: true,
    ordem: 2,
    versao: "2.0"
  }
];

// ============================================
// HELPERS E UTILITÁRIOS
// ============================================

/** Filtra relatórios por módulo */
export const getReportsByModulo = (modulo: ModuloReport): ReportItem[] =>
  REPORTS_CATALOGO.filter((r) => r.modulo === modulo).sort((a, b) => a.ordem - b.ordem);

/** Filtra relatórios em destaque */
export const getReportsDestaque = (): ReportItem[] =>
  REPORTS_CATALOGO.filter((r) => r.destaque && r.status === "ativo");

/** Filtra relatórios por permissão do usuário */
export const getReportsByPermissao = (userRoles: NivelPermissao[]): ReportItem[] =>
  REPORTS_CATALOGO.filter(
    (r) => r.status === "ativo" && r.permissaoNecessaria.some((p) => userRoles.includes(p))
  ).sort((a, b) => a.ordem - b.ordem);

/** Busca relatórios por texto */
export const searchReports = (query: string): ReportItem[] => {
  const q = query.toLowerCase();
  return REPORTS_CATALOGO.filter(
    (r) =>
      r.status === "ativo" &&
      (r.nome.toLowerCase().includes(q) ||
        r.descricao.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q)))
  );
};

/** Busca um relatório por ID */
export const getReportById = (id: string): ReportItem | undefined =>
  REPORTS_CATALOGO.find((r) => r.id === id);

/** Retorna relatórios que usam histórico estruturado */
export const getReportsComHistorico = (): ReportItem[] =>
  REPORTS_CATALOGO.filter((r) => r.usaHistoricoEstruturado && r.status === "ativo");

// ============================================
// EXPORTAÇÃO DEFAULT
// ============================================
export default {
  catalogo: REPORTS_CATALOGO,
  categorias: REPORT_CATEGORIES,
  helpers: {
    getReportsByModulo,
    getReportsDestaque,
    getReportsByPermissao,
    searchReports,
    getReportById,
    getReportsComHistorico,
  },
};
