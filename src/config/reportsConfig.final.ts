/**
 * ============================================
 * ARMAZIX - CENTRAL DE CONFIGURAÇÃO DE RELATÓRIOS
 * VERSÃO FINAL - ESTRUTURA LIMPA E ENXUTA
 * Arquivo: reportsConfig.ts
 * ============================================
 */

import type { LucideIcon } from "lucide-react";
import {
  BarChart3, DollarSign, Package, ShoppingCart, Users,
  Shield, Truck, Receipt, ArrowLeftRight, TrendingUp,
  Calculator, Archive, Box, FileText, Wallet2, Landmark,
  Trash2, CreditCard
} from "lucide-react";

// ============================================
// TIPOS
// ============================================

export type ModuloReport = "gerencial" | "financeiro" | "clientes" | "suprimentos" | "comercial" | "operacoes";
export type UsoReport = "operacional" | "gerencial" | "auditoria";
export type NivelPermissao = "admin" | "gerente" | "financeiro" | "vendedor" | "operador" | "caixa";

export type TipoPeriodo =
  | "nenhum"
  | "periodo_completo"
  | "data_emissao_vencimento"
  | "data_efetivacao";

export type FiltroVisivel =
  | "vendedor"
  | "cliente"
  | "fornecedor"
  | "conta_bancaria"
  | "categoria_produto"
  | "produto"
  | "forma_pagamento"
  | "historico"
  | "status"
  | "natureza"
  | "posicao"
  | "contas_bancarias_multi"
  | "situacao_cliente"
  | "tipo_cliente"
  | "tipo_produto"
  | "toggle_estoque_baixo"
  | "usuario_operador"
  | "status_entrega";

export interface ConfiguracaoFiltro {
  tipoPeriodo: TipoPeriodo;
  labelPeriodo?: string;
  filtrosVisiveis: FiltroVisivel[];
  opcoes?: {
    naturezas?: string[];
    posicoes?: string[];
    contasBancarias?: string[];
    situacoesCliente?: string[];
    tiposCliente?: string[];
    tiposProduto?: string[];
    statusEstoque?: string[];
  };
}

export type FormatoExportacao = "pdf" | "excel" | "csv";
export type StatusReport = "ativo" | "beta" | "descontinuado";

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
  configuracaoFiltro: ConfiguracaoFiltro;
  formatosExportacao: FormatoExportacao[];
  usaHistoricoEstruturado?: boolean;
  ordem: number;
  versao: string;
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
// CATEGORIAS - LISTA FINAL LIMPA
// ============================================

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "gerencial",
    label: "Demonstrativos & Resultados",
    emoji: "📈",
    cor: "text-indigo-600",
    icone: BarChart3,
    descricao: "Demonstrativos gerenciais e posição do caixa",
    ordem: 1
  },
  {
    id: "financeiro",
    label: "Financeiro & Contas",
    emoji: "💰",
    cor: "text-emerald-600",
    icone: DollarSign,
    descricao: "Contas, receitas, cobranças e movimentação bancária",
    ordem: 2
  },
  {
    id: "clientes",
    label: "Clientes",
    emoji: "👥",
    cor: "text-blue-600",
    icone: Users,
    descricao: "Cadastro e relatórios de clientes",
    ordem: 3
  },
  {
    id: "suprimentos",
    label: "Compras & Estoque",
    emoji: "📦",
    cor: "text-amber-600",
    icone: Package,
    descricao: "Curva ABC de compras, CMV e inventário",
    ordem: 4
  },
  {
    id: "comercial",
    label: "Vendas & Produtos",
    emoji: "📊",
    cor: "text-rose-600",
    icone: ShoppingCart,
    descricao: "Curva ABC de vendas e cadastro de produtos",
    ordem: 5
  },
  {
    id: "operacoes",
    label: "Operações Especiais",
    emoji: "🔐",
    cor: "text-slate-600",
    icone: Shield,
    descricao: "Auditoria, exclusões e entregadores",
    ordem: 6
  }
];

// ============================================
// CATÁLOGO FINAL - 17 RELATÓRIOS
// ============================================

export const REPORTS_CATALOGO: ReportItem[] = [
  // ============================================
  // 📈 GERENCIAL (4)
  // ============================================
  {
    id: "ger-demonstrativo-padrao",
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
    versao: "1.0"
  },
  {
    id: "ger-demonstrativo-customizado",
    nome: "Demonstrativos Customizados",
    descricao: "Consultas estruturadas de desempenho personalizáveis",
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
    id: "ger-totais-historicos",
    nome: "Totais por Históricos",
    descricao: "Cruzamento financeiro com árvore de históricos estruturados",
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
    id: "ger-posicao-caixa",
    nome: "Posição do Caixa",
    descricao: "Estado atual do dia: faturamento, vendas e formas de pagamento",
    modulo: "gerencial",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "caixa", "financeiro"],
    icone: Wallet2,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "nenhum",
      filtrosVisiveis: ["forma_pagamento"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 4,
    versao: "1.0"
  },

  // ============================================
  // 💰 FINANCEIRO (4)
  // ============================================
  {
    id: "fin-contas",
    nome: "Contas",
    descricao: "Contas a receber/pagar. Natureza Receitas→Cliente, Despesas→Fornecedor",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: Receipt,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "data_emissao_vencimento",
      labelPeriodo: "Tipo de Data",
      filtrosVisiveis: ["natureza", "posicao", "cliente", "fornecedor"],
      opcoes: {
        naturezas: ["Receitas", "Despesas"],
        posicoes: ["Em Aberto", "Efetivadas"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },
  {
    id: "fin-conta-corrente",
    nome: "Conta Corrente",
    descricao: "Histórico de entradas/saídas por conta bancária selecionada",
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
    versao: "1.0"
  },
  {
    id: "fin-receitas",
    nome: "Receitas",
    descricao: "Informações de receitas do período com filtro por cliente e histórico",
    modulo: "financeiro",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: TrendingUp,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período",
      filtrosVisiveis: ["cliente", "historico"]
    },
    formatosExportacao: ["pdf", "excel"],
    usaHistoricoEstruturado: true,
    ordem: 3,
    versao: "1.0"
  },
  {
    id: "fin-cobrancas",
    nome: "Cobranças",
    descricao: "Relatório de recebíveis, boletos e inadimplência",
    modulo: "financeiro",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "financeiro"],
    icone: CreditCard,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Vencimento",
      filtrosVisiveis: ["cliente", "forma_pagamento"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 4,
    versao: "1.0"
  },

  // ============================================
  // 👥 CLIENTES (1)
  // ============================================
  {
    id: "cli-cadastro",
    nome: "Cadastro de Clientes",
    descricao: "Relatório de clientes filtrado por situação e tipo",
    modulo: "clientes",
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
        situacoesCliente: ["Ativos", "Inativos"],
        tiposCliente: ["Pessoa Física", "Pessoa Jurídica", "Revendedor"]
      }
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },

  // ============================================
  // 📦 SUPRIMENTOS (3)
  // ============================================
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
    versao: "1.0"
  },
  {
    id: "sup-cmv",
    nome: "CMV",
    descricao: "Custo da Mercadoria Vendida com base em compras e inventário",
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
    versao: "1.0"
  },
  {
    id: "sup-estoque",
    nome: "Estoque",
    descricao: "Inventário, balancete e extrato de movimentações",
    modulo: "suprimentos",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "operador"],
    icone: Archive,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Movimentação",
      filtrosVisiveis: ["produto", "categoria_produto"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 3,
    versao: "1.0"
  },

  // ============================================
  // 📊 COMERCIAL (2)
  // ============================================
  {
    id: "com-curva-abc-vendas",
    nome: "Curva ABC de Vendas",
    descricao: "Análise de vendas por vendedor, categoria e fornecedor",
    modulo: "comercial",
    uso: "gerencial",
    permissaoNecessaria: ["admin", "gerente", "vendedor"],
    icone: TrendingUp,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Venda",
      filtrosVisiveis: ["vendedor", "categoria_produto", "fornecedor"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },
  {
    id: "com-produtos-cadastro",
    nome: "Cadastro de Produtos",
    descricao: "Listagem de produtos com filtro de situação, categoria e estoque baixo",
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
    versao: "1.0"
  },

  // ============================================
  // 🔐 OPERAÇÕES ESPECIAIS (2)
  // ============================================
  {
    id: "ope-exclusoes",
    nome: "Exclusões",
    descricao: "Log de auditoria de registros apagados no sistema",
    modulo: "operacoes",
    uso: "auditoria",
    permissaoNecessaria: ["admin", "gerente"],
    icone: Trash2,
    destaque: true,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período da Exclusão",
      filtrosVisiveis: ["usuario_operador"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 1,
    versao: "1.0"
  },
  {
    id: "ope-entregadores",
    nome: "Entregadores",
    descricao: "Produtividade e taxas do módulo de delivery",
    modulo: "operacoes",
    uso: "operacional",
    permissaoNecessaria: ["admin", "gerente", "vendedor"],
    icone: Truck,
    permiteFavorito: true,
    status: "ativo",
    configuracaoFiltro: {
      tipoPeriodo: "periodo_completo",
      labelPeriodo: "Período de Entrega",
      filtrosVisiveis: ["vendedor", "status_entrega"]
    },
    formatosExportacao: ["pdf", "excel"],
    ordem: 2,
    versao: "1.0"
  }
];

// ============================================
// HELPERS
// ============================================

export const getReportsByModulo = (modulo: ModuloReport): ReportItem[] =>
  REPORTS_CATALOGO.filter((r) => r.modulo === modulo).sort((a, b) => a.ordem - b.ordem);

export const getReportsDestaque = (): ReportItem[] =>
  REPORTS_CATALOGO.filter((r) => r.destaque && r.status === "ativo");

export const getReportsByPermissao = (userRoles: NivelPermissao[]): ReportItem[] =>
  REPORTS_CATALOGO.filter(
    (r) => r.status === "ativo" && r.permissaoNecessaria.some((p) => userRoles.includes(p))
  ).sort((a, b) => a.ordem - b.ordem);

export const getReportById = (id: string): ReportItem | undefined =>
  REPORTS_CATALOGO.find((r) => r.id === id);

// ============================================
// EXPORTAÇÃO
// ============================================
export default {
  catalogo: REPORTS_CATALOGO,
  categorias: REPORT_CATEGORIES,
  helpers: {
    getReportsByModulo,
    getReportsDestaque,
    getReportsByPermissao,
    getReportById,
  },
};
