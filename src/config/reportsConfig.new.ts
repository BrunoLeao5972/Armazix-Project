/**
 * ============================================
 * ARMAZIX - CENTRAL DE CONFIGURAÇÃO DE RELATÓRIOS
 * Arquivo: reportsConfig.ts
 * Descrição: Fonte única de verdade para todos os relatórios do ERP
 * Estrutura 2025 - 5 Macro-Categorias
 * ============================================
 */

import type { LucideIcon } from "lucide-react";
import {
  Package, TrendingDown, FileText, BarChart3, AlertCircle, Clock, History,
  Users, TrendingUp, Receipt, User, Calendar, Tag, DollarSign, Percent,
  ShoppingCart, CreditCard, X, Landmark, Shield, Lock, Wallet, Banknote,
  Truck, ClipboardList, Archive, Trash2, AlertTriangle, FileSearch,
  Briefcase, Building2, ShoppingBag, Box, PackageCheck, PackageX,
  TrendingUp as TrendingUpIcon, Calculator
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
  | "nenhum"                              // Sem filtro de período
  | "intervalo_movimentacao"              // Por intervalo de venda/movimentação
  | "data_entrada_nf"                     // Por data de entrada ou emissão da NF
  | "periodo_inatividade"                 // Produtos sem vender desde data X até Y
  | "mes_aniversario"                     // Apenas mês (dropdown Janeiro-Dezembro)
  | "periodo_completo";                   // Período tradicional com data/hora

/** Filtros visíveis disponíveis para cada relatório */
export type FiltroVisivel =
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
  | "usuario_operador"
  | "tipo_operacao"
  | "status_entrega";

/** Configuração detalhada de filtros por relatório */
export interface ConfiguracaoFiltro {
  /** Tipo de período de datas (se aplicável) */
  tipoPeriodo: TipoPeriodo;
  /** Texto exibido no label do período (ex: "Data de Entrada", "Período de Análise") */
  labelPeriodo?: string;
  /** Lista de filtros adicionais que aparecem no drawer */
  filtrosVisiveis: FiltroVisivel[];
  /** Configurações extras específicas */
  opcoes?: {
    /** Para status_estoque: valores disponíveis no select */
    statusEstoque?: string[];
    /** Para categoria_produto: permitir múltipla seleção */
    multiplaCategoria?: boolean;
    /** Range de estoque mínimo (para relatórios de estoque baixo) */
    rangeEstoqueMinimo?: boolean;
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
    label: "Contas, Cobranças & Lançamentos",
    emoji: "💰",
    cor: "text-emerald-600",
    icone: DollarSign,
    descricao: "Contas a pagar/receber, cobranças, conciliação e fluxo de caixa",
    ordem: 2
  },
  {
    id: "suprimentos",
    label: "Estoque, Compras & Produtos",
    emoji: "📦",
    cor: "text-amber-600",
    icone: Package,
    descricao: "Gestão de estoque, compras, produtos e suprimentos",
    ordem: 3
  },
  {
    id: "comercial",
    label: "Vendas, Pedidos & Operações",
    emoji: "📊",
    cor: "text-rose-600",
    icone: ShoppingCart,
    descricao: "Vendas, pedidos, entregas e operações comerciais",
    ordem: 4
  },
  {
    id: "seguranca",
    label: "Auditoria, Exclusões & Fiscal",
    emoji: "🔐",
    cor: "text-slate-600",
    icone: Shield,
    descricao: "Auditoria, logs de exclusões, fiscal e segurança",
    ordem: 5
  }
];

// ============================================
// CATÁLOGO OFICIAL - ESTRUTURA 2025
// ============================================

export const REPORTS_CATALOGO: ReportItem[] = [
  // ============================================
  // 1. GERENCIAL - Demonstrativos & Resultados (4)
  // ============================================
  {
    id: "ger-001",
    nome: "Demonstrativo Padrão",
    descricao: "Relatório consolidado do resultado do período com receitas, despesas e saldo",
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
    versao: "1.0"
  },
  {
    id: "ger-002",
    nome: "Demonstrativos Customizados",
    descricao: "Consultas estruturadas de desempenho personalizáveis por departamento",
    modulo: "gerencial",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente"],
    icone: FileText,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["historico", "vendedor"]
    },
    formatosExportacao: ["pdf", "excel"],
    usaHistoricoEstruturado: true,
    ordem: 2,
    versao: "1.0"
  },
  {
    id: "ger-003",
    nome: "Totais por Históricos",
    descricao: "Cruzamento financeiro direto com a árvore de históricos estruturados",
    modulo: "gerencial",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Landmark,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["historico", "conta_bancaria"]
    },
    formatosExportacao: ["pdf", "excel"],
    usaHistoricoEstruturado: true,
    ordem: 3,
    versao: "1.0"
  },
  {
    id: "ger-004",
    nome: "Posição do Caixa",
    descricao: "Resumo em tempo real do estado financeiro atual dos caixas",
    modulo: "gerencial",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "caixa", "financeiro"],
    icone: Wallet,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Data de Referência",
      filtrosVisiveis: ["vendedor"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 4,
    versao: "1.0"
  },

  // ============================================
  // 2. FINANCEIRO - Contas, Cobranças & Lançamentos (5)
  // ============================================
  {
    id: "fin-001",
    nome: "Contas",
    descricao: "Relatório geral de lançamentos e saldos por conta",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Building2,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["conta_bancaria", "historico", "status"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },
  {
    id: "fin-002",
    nome: "Conta Corrente",
    descricao: "Extrato e movimentações por conta bancária vinculada",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Banknote,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período do Extrato",
      filtrosVisiveis: ["conta_bancaria"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "1.0"
  },
  {
    id: "fin-003",
    nome: "Cobranças",
    descricao: "Relatório de recebíveis, boletos e inadimplência",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Receipt,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Vencimento",
      filtrosVisiveis: ["cliente", "status", "forma_pagamento"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 3,
    versao: "1.0"
  },
  {
    id: "fin-004",
    nome: "Lançamentos",
    descricao: "Histórico detalhado de entradas e despesas avulsas",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: ClipboardList,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Lançamento",
      filtrosVisiveis: ["historico", "conta_bancaria", "vendedor"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 4,
    versao: "1.0"
  },
  {
    id: "fin-005",
    nome: "Integração",
    descricao: "Relatório de conciliação de dados entre submódulos financeiros",
    modulo: "financeiro",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Calculator,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Conciliação",
      filtrosVisiveis: ["conta_bancaria", "historico"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 5,
    versao: "1.0"
  },

  // ============================================
  // 3. SUPRIMENTOS - Estoque, Compras & Produtos (3)
  // ============================================
  {
    id: "sup-001",
    nome: "Produtos",
    descricao: "Listagem geral, margens e status de estoque dos produtos",
    modulo: "suprimentos",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "operador"],
    icone: Box,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "nenhum",
      filtrosVisiveis: ["produto", "categoria_produto", "status_estoque"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },
  {
    id: "sup-002",
    nome: "Estoque",
    descricao: "Balanço, inventário e níveis de estoque mínimo",
    modulo: "suprimentos",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "operador"],
    icone: Archive,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["produto", "categoria_produto", "status_estoque"],
      opcoes: {
        rangeEstoqueMinimo: true,
        statusEstoque: ["Crítico", "Baixo", "Atenção", "Normal"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "1.0"
  },
  {
    id: "sup-003",
    nome: "Compras",
    descricao: "Histórico de ordens de compra e pedidos enviados para fornecedores",
    modulo: "suprimentos",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "operador"],
    icone: ShoppingBag,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Compra",
      filtrosVisiveis: ["fornecedor", "produto", "status"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 3,
    versao: "1.0"
  },

  // ============================================
  // 4. COMERCIAL - Vendas, Pedidos & Operações (4)
  // ============================================
  {
    id: "com-001",
    nome: "Vendas",
    descricao: "Faturamento por período, produto, vendedor e formas de pagamento",
    modulo: "comercial",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "vendedor"],
    icone: ShoppingCart,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Venda",
      filtrosVisiveis: ["vendedor", "cliente", "produto", "forma_pagamento", "canal"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },
  {
    id: "com-002",
    nome: "Pedidos",
    descricao: "Relatório de ordens de venda abertas, faturadas ou pendentes",
    modulo: "comercial",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "vendedor", "operador"],
    icone: ClipboardList,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período do Pedido",
      filtrosVisiveis: ["cliente", "vendedor", "status", "forma_pagamento"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "1.0"
  },
  {
    id: "com-003",
    nome: "Encomenda",
    descricao: "Relatório de produtos reservados ou sob encomenda futura",
    modulo: "comercial",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "vendedor", "operador"],
    icone: PackageCheck,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período da Encomenda",
      filtrosVisiveis: ["cliente", "produto", "status"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 3,
    versao: "1.0"
  },
  {
    id: "com-004",
    nome: "Entregadores",
    descricao: "Relatório de produtividade, taxas e entregas por motoboy (Módulo Delivery)",
    modulo: "comercial",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "vendedor"],
    icone: Truck,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Entrega",
      filtrosVisiveis: ["vendedor", "status_entrega", "cliente"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 4,
    versao: "1.0"
  },

  // ============================================
  // 5. SEGURANÇA - Auditoria, Exclusões & Fiscal (4)
  // ============================================
  {
    id: "seg-001",
    nome: "Exclusões",
    descricao: "Logs detalhados de quem deletou produtos, vendas ou lançamentos (Crucial para segurança)",
    modulo: "seguranca",
    uso: "auditoria",
    permissaoNecessaria: ["admin", "gerente"],
    icone: Trash2,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período da Exclusão",
      filtrosVisiveis: ["usuario_operador", "tipo_operacao"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },
  {
    id: "seg-002",
    nome: "Ocorrências",
    descricao: "Registro de erros, gargalos ou ações suspeitas dos usuários",
    modulo: "seguranca",
    uso: "auditoria",
    permissaoNecessaria: ["admin", "gerente"],
    icone: AlertTriangle,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período da Ocorrência",
      filtrosVisiveis: ["usuario_operador", "tipo_operacao", "status"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "1.0"
  },
  {
    id: "seg-003",
    nome: "Fiscal",
    descricao: "Notas fiscais emitidas (NF-e/NFC-e), cancelamentos e logs de envio",
    modulo: "seguranca",
    uso: "fiscal",
    permissaoNecessaria: ["admin", "gerente", "fiscal"],
    icone: FileSearch,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Emissão",
      filtrosVisiveis: ["status", "cliente", "vendedor"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 3,
    versao: "1.0"
  },
  {
    id: "seg-004",
    nome: "Clientes",
    descricao: "Relatório demográfico de clientes, histórico de compras e inativos",
    modulo: "seguranca",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "vendedor"],
    icone: Users,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Análise",
      filtrosVisiveis: ["cliente", "status", "mes"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 4,
    versao: "1.0"
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
