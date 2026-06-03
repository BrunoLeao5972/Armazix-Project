/**
 * ============================================
 * ARMAZIX - CENTRAL DE CONFIGURAÇÃO DE RELATÓRIOS
 * Arquivo: reportsConfig.ts
 * Descrição: Fonte única de verdade para todos os relatórios do ERP
 * ============================================
 */

import type { LucideIcon } from "lucide-react";
import {
  Package, TrendingDown, FileText, BarChart3, AlertCircle, Clock, History,
  Users, TrendingUp, Receipt, User, Calendar, Tag, DollarSign, Percent,
  ShoppingCart, CreditCard, X, Landmark, Shield, Lock
} from "lucide-react";

// ============================================
// TIPOS E ENUMS
// ============================================

export type ModuloReport = "estoque" | "clientes" | "produtos" | "vendas" | "financeiro" | "fiscal" | "auditoria";
export type UsoReport = "operacional" | "gerencial" | "fiscal" | "auditoria";
export type NivelPermissao = "admin" | "gerente" | "financeiro" | "vendedor" | "operador" | "caixa" | "fiscal";
export type TipoFiltro = "periodo" | "vendedor" | "cliente" | "fornecedor" | "produto" | "formaPagamento" | "status" | "canal" | "conta" | "historico" | "categoria" | "motivoCancelamento";
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
  filtrosDisponiveis: TipoFiltro[];
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
// CATEGORIAS
// ============================================

export const REPORT_CATEGORIES: ReportCategory[] = [
  { id: "vendas", label: "Vendas & PDV", emoji: "📊", cor: "text-amber-600", icone: ShoppingCart, descricao: "Faturamento, ticket médio, produtos mais vendidos", ordem: 1 },
  { id: "financeiro", label: "Financeiro Integrado", emoji: "💰", cor: "text-rose-600", icone: DollarSign, descricao: "Fluxo de caixa, contas, inadimplência", ordem: 2 },
  { id: "estoque", label: "Estoque & Movimentação", emoji: "📦", cor: "text-emerald-600", icone: Package, descricao: "Entradas, saídas, balanço, rastreabilidade", ordem: 3 },
  { id: "produtos", label: "Cadastro de Produtos", emoji: "🏷️", cor: "text-violet-600", icone: Tag, descricao: "Lucratividade, giro, sem movimentação", ordem: 4 },
  { id: "clientes", label: "Clientes & Comportamento", emoji: "👥", cor: "text-blue-600", icone: Users, descricao: "Base, ranking, inativos, aniversariantes", ordem: 5 },
  { id: "fiscal", label: "Fiscal & Operacional", emoji: "🔐", cor: "text-slate-600", icone: FileText, descricao: "NF-e, NFC-e, operações por usuário", ordem: 6 },
  { id: "auditoria", label: "Auditoria & Segurança", emoji: "🔍", cor: "text-red-600", icone: Shield, descricao: "Logs críticos, fechamentos, rastreabilidade", ordem: 7 },
];

// ============================================
// CATÁLOGO COMPLETO - PARTE 1: ESTOQUE + CLIENTES
// ============================================

export const REPORTS_CATALOGO: ReportItem[] = [
  // ESTOQUE (7)
  { id: "est-001", nome: "Entrada de Mercadorias", descricao: "Relatório completo de entradas no estoque com notas fiscais", modulo: "estoque", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "operador"], icone: Package, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "fornecedor", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 1, versao: "1.0" },
  { id: "est-002", nome: "Saída de Produtos", descricao: "Histórico de saídas de estoque com motivos", modulo: "estoque", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "operador"], icone: TrendingDown, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor", "produto", "status"], formatosExportacao: ["pdf", "excel"], ordem: 2, versao: "1.0" },
  { id: "est-003", nome: "Extrato e Inventário", descricao: "Posição atual do estoque com valorização", modulo: "estoque", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "operador"], icone: FileText, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel", "csv"], ordem: 3, versao: "1.0" },
  { id: "est-004", nome: "Balanço de Estoque", descricao: "Comparativo teórico vs físico com ajustes", modulo: "estoque", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: BarChart3, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 4, versao: "1.0" },
  { id: "est-005", nome: "Produtos com Estoque Baixo", descricao: "Alerta de produtos abaixo do ponto de reposição", modulo: "estoque", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "operador"], icone: AlertCircle, destaque: true, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["produto"], formatosExportacao: ["pdf", "excel"], ordem: 5, versao: "1.0" },
  { id: "est-006", nome: "Produtos sem Movimentação", descricao: "Itens sem entrada ou saída no período", modulo: "estoque", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: Clock, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 6, versao: "1.0" },
  { id: "est-007", nome: "Histórico de Movimentações", descricao: "Rastreabilidade completa de movimentações", modulo: "estoque", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "operador"], icone: History, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto", "vendedor"], formatosExportacao: ["pdf", "excel"], ordem: 7, versao: "1.0" },

  // CLIENTES (5)
  { id: "cli-001", nome: "Clientes Cadastrados", descricao: "Base completa de clientes ativos e inativos", modulo: "clientes", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: Users, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "status"], formatosExportacao: ["pdf", "excel", "csv"], ordem: 1, versao: "1.0" },
  { id: "cli-002", nome: "Clientes que Mais Compram", descricao: "Ranking por volume de compras e ticket médio", modulo: "clientes", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: TrendingUp, destaque: true, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo"], formatosExportacao: ["pdf", "excel"], ordem: 2, versao: "1.0" },
  { id: "cli-003", nome: "Histórico de Compras", descricao: "Detalhamento de compras por cliente", modulo: "clientes", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: Receipt, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "cliente"], formatosExportacao: ["pdf", "excel"], ordem: 3, versao: "1.0" },
  { id: "cli-004", nome: "Clientes Inativos", descricao: "Clientes sem compras no período", modulo: "clientes", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: User, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo"], formatosExportacao: ["pdf", "excel"], ordem: 4, versao: "1.0" },
  { id: "cli-005", nome: "Aniversariantes", descricao: "Lista para ações de marketing", modulo: "clientes", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: Calendar, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo"], formatosExportacao: ["pdf", "excel"], ordem: 5, versao: "1.0" },

  // PRODUTOS (6)
  { id: "prod-001", nome: "Lista de Produtos", descricao: "Catálogo com preços e estoques", modulo: "produtos", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: Package, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["produto", "status"], formatosExportacao: ["pdf", "excel"], ordem: 1, versao: "1.0" },
  { id: "prod-002", nome: "Produtos por Categoria", descricao: "Organização hierárquica", modulo: "produtos", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: Tag, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 2, versao: "1.0" },
  { id: "prod-003", nome: "Produtos Mais Lucrativos", descricao: "Ranking por margem de contribuição", modulo: "produtos", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: DollarSign, destaque: true, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 3, versao: "1.0" },
  { id: "prod-004", nome: "Produtos com Baixa Margem", descricao: "Itens com margem abaixo do esperado", modulo: "produtos", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: Percent, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 4, versao: "1.0" },
  { id: "prod-005", nome: "Produtos sem Estoque", descricao: "Itens esgotados ou descontinuados", modulo: "produtos", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "operador"], icone: AlertCircle, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["produto"], formatosExportacao: ["pdf", "excel"], ordem: 5, versao: "1.0" },
  { id: "prod-006", nome: "Produtos com Maior Giro", descricao: "Ranking por velocidade de rotatividade", modulo: "produtos", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: TrendingUp, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 6, versao: "1.0" },

  // VENDAS (7)
  { id: "vnd-001", nome: "Vendas por Período", descricao: "Consolidado completo de vendas", modulo: "vendas", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: ShoppingCart, destaque: true, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor", "cliente", "formaPagamento", "canal", "status"], formatosExportacao: ["pdf", "excel"], ordem: 1, versao: "1.0" },
  { id: "vnd-002", nome: "Vendas por Produto", descricao: "Detalhamento por item", modulo: "vendas", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: Package, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor", "produto", "formaPagamento"], formatosExportacao: ["pdf", "excel"], ordem: 2, versao: "1.0" },
  { id: "vnd-003", nome: "Vendas por Cliente", descricao: "Análise com ticket médio", modulo: "vendas", uso: "gerencial", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: User, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "cliente", "vendedor"], formatosExportacao: ["pdf", "excel"], ordem: 3, versao: "1.0" },
  { id: "vnd-004", nome: "Vendas por Forma de Pagamento", descricao: "Distribuição por meio de pagamento", modulo: "vendas", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "financeiro"], icone: CreditCard, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "formaPagamento"], formatosExportacao: ["pdf", "excel"], ordem: 4, versao: "1.0" },
  { id: "vnd-005", nome: "Produtos Mais Vendidos", descricao: "Ranking por quantidade", modulo: "vendas", uso: "gerencial", permissaoNecessaria: ["admin", "gerente", "vendedor"], icone: TrendingUp, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "produto"], formatosExportacao: ["pdf", "excel"], ordem: 5, versao: "1.0" },
  { id: "vnd-006", nome: "Ticket Médio", descricao: "Valor médio por venda e cliente", modulo: "vendas", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: DollarSign, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor", "cliente"], formatosExportacao: ["pdf", "excel"], ordem: 6, versao: "1.0" },
  { id: "vnd-007", nome: "Cancelamentos e Devoluções", descricao: "Relatório com motivos", modulo: "vendas", uso: "operacional", permissaoNecessaria: ["admin", "gerente"], icone: X, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor", "motivoCancelamento"], formatosExportacao: ["pdf", "excel"], ordem: 7, versao: "1.0" },

  // FINANCEIRO (6)
  { id: "fin-001", nome: "Fluxo de Caixa", descricao: "Entradas e saídas com projeção", modulo: "financeiro", uso: "gerencial", permissaoNecessaria: ["admin", "gerente", "financeiro"], icone: DollarSign, destaque: true, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "conta", "historico"], formatosExportacao: ["pdf", "excel"], usaHistoricoEstruturado: true, ordem: 1, versao: "1.0" },
  { id: "fin-002", nome: "Contas a Receber", descricao: "Títulos em aberto e recebidos", modulo: "financeiro", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "financeiro"], icone: TrendingUp, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "cliente", "status", "historico"], formatosExportacao: ["pdf", "excel"], ordem: 2, versao: "1.0" },
  { id: "fin-003", nome: "Contas a Pagar", descricao: "Obrigações financeiras", modulo: "financeiro", uso: "operacional", permissaoNecessaria: ["admin", "gerente", "financeiro"], icone: TrendingDown, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "fornecedor", "status", "historico"], formatosExportacao: ["pdf", "excel"], ordem: 3, versao: "1.0" },
  { id: "fin-004", nome: "Inadimplência", descricao: "Clientes com pagamentos atrasados", modulo: "financeiro", uso: "gerencial", permissaoNecessaria: ["admin", "gerente", "financeiro"], icone: AlertCircle, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "cliente", "status"], formatosExportacao: ["pdf", "excel"], ordem: 4, versao: "1.0" },
  { id: "fin-005", nome: "Lucro Bruto e Líquido", descricao: "Demonstrativo de resultados", modulo: "financeiro", uso: "gerencial", permissaoNecessaria: ["admin", "gerente"], icone: BarChart3, destaque: true, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "historico"], formatosExportacao: ["pdf", "excel"], ordem: 5, versao: "1.0" },
  { id: "fin-006", nome: "Receitas e Despesas por Histórico", descricao: "Consolidado por árvore hierárquica", modulo: "financeiro", uso: "gerencial", permissaoNecessaria: ["admin", "gerente", "financeiro"], icone: Landmark, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "historico", "conta"], formatosExportacao: ["pdf", "excel"], usaHistoricoEstruturado: true, ordem: 6, versao: "1.0" },

  // FISCAL (2)
  { id: "fis-001", nome: "Notas Fiscais Emitidas", descricao: "NFe e NFCe com status", modulo: "fiscal", uso: "fiscal", permissaoNecessaria: ["admin", "gerente", "fiscal"], icone: FileText, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "status", "cliente"], formatosExportacao: ["pdf", "excel"], ordem: 1, versao: "1.0" },
  { id: "fis-002", nome: "Operações por Usuário", descricao: "Atividades fiscais por operador", modulo: "fiscal", uso: "fiscal", permissaoNecessaria: ["admin", "gerente", "fiscal"], icone: Users, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor"], formatosExportacao: ["pdf", "excel"], ordem: 2, versao: "1.0" },

  // AUDITORIA (2)
  { id: "aud-001", nome: "Fechamento Diário de Caixa", descricao: "Resumo por operador", modulo: "auditoria", uso: "auditoria", permissaoNecessaria: ["admin", "gerente"], icone: Lock, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor"], formatosExportacao: ["pdf", "excel"], ordem: 1, versao: "1.0" },
  { id: "aud-002", nome: "Logs de Alterações Críticas", descricao: "Rastreamento de alterações em valores", modulo: "auditoria", uso: "auditoria", permissaoNecessaria: ["admin"], icone: Shield, destaque: true, permiteFavorito: true, status: "ativo", filtrosDisponiveis: ["periodo", "vendedor", "status"], formatosExportacao: ["pdf", "excel"], ordem: 2, versao: "1.0" },
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
