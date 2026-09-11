// ─────────────────────────────────────────────────────────────────────────
// Resultado de um relatório real (os 7 "destaque" da Central de Relatórios)
// — busca os dados no endpoint correspondente, normaliza pra um formato
// genérico de tabela (KPIs + colunas + linhas), e oferece exportação real
// em PDF/Excel/Impressão. As funções de exportação são as mesmas (com
// pequenos ajustes) que já existiam em relatorios-preview.tsx — só que
// agora operando sobre dado de verdade, não mock.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { X, Loader2, FileText, FileSpreadsheet, Printer, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ─── Tipos ───────────────────────────────────────────────────────
export interface Coluna { key: string; label: string; align?: "left" | "right" | "center" }
export interface Secao { titulo: string; colunas: Coluna[]; linhas: Record<string, string | number>[] }
export interface ResultadoRelatorio {
  titulo: string;
  kpis: { label: string; value: string }[];
  colunas: Coluna[];
  linhas: Record<string, string | number>[];
  secoesExtras?: Secao[];
  avisos?: string[];
}

export interface FiltrosDrawer {
  dataDe: string; dataAte: string;
  clienteId: string; usuarioId: string;
  /** Nome do usuário selecionado no filtro "Usuário Responsável" — alguns
   *  relatórios (aud-001, vnd-002/003/006) comparam contra um nome gravado
   *  como texto livre (caixa_sessoes.abertoPor/encerradoPor), não um id, já
   *  que orders/caixa_sessoes não referenciam storeUsers diretamente. */
  usuarioNome: string;
  formaPagamento: string; status: string; historico: string;
  produtoId: string; fornecedorId: string;
  /** est-005: id da categoria de produto */
  categoriaId: string;
  /** est-005 / cli-002: chave de ordenação (varia por relatório) */
  ordem: string;
  /** est-005: "nenhum" | "categoria" | "setor" */
  agrupamento: string;
  /** cli-002: "todos" | "pdv" | "online" */
  canal: string;
}

export const DEFAULT_FILTROS: FiltrosDrawer = {
  dataDe: "", dataAte: "", clienteId: "", usuarioId: "", usuarioNome: "", formaPagamento: "", status: "", historico: "",
  produtoId: "", fornecedorId: "",
  categoriaId: "", ordem: "", agrupamento: "", canal: "",
};

// IDs do catálogo (relatorios.tsx) que já têm backend real — os 3 que
// faltam (fis-001, fis-002, cli-005) ficam fora porque a informação que
// pedem não existe em nenhuma tabela hoje (nota fiscal e data de
// nascimento de cliente nunca foram coletadas pelo sistema).
export const RELATORIOS_IMPLEMENTADOS = [
  "est-005", "cli-002", "prod-003", "vnd-001", "fin-001", "fin-005", "aud-002",
  "est-001", "est-002", "est-003", "est-004", "est-006", "est-007",
  "cli-001", "cli-003", "cli-004",
  "prod-001", "prod-002", "prod-004", "prod-005", "prod-006",
  "vnd-002", "vnd-003", "vnd-004", "vnd-005", "vnd-006", "vnd-007",
  "fin-002", "fin-003", "fin-004", "fin-006",
  "aud-001",
] as const;

// ─── Helpers de formatação ───────────────────────────────────────
// Achado real: colunas NUMERIC/DECIMAL do Postgres voltam como STRING pelo
// driver (o cast `sql<number>\`...\`` do drizzle é só type assertion — não
// converte nada em runtime), mas as interfaces dos handlers abaixo
// declaram esses campos como `number`. fmtBRL(v) chamava v.toFixed(2)
// direto — TypeError ("v.toFixed is not a function") toda vez que um
// relatório tinha PELO MENOS UM registro com valor monetário, derrubando a
// renderização do modal inteiro (é por isso que os relatórios em destaque
// só "funcionavam" quando vinham vazios). toNum() converte com segurança
// em ambos os pontos de entrada (fmtBRL e fmtPct), então cobre tanto os
// campos já corrigidos nos handlers quanto qualquer um que escape disso.
export const toNum = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
export const fmtBRL = (v: number | string) => `R$ ${toNum(v).toFixed(2).replace(".", ",")}`;
export const fmtPct = (v: number | string, casas = 1) => `${toNum(v).toFixed(casas)}%`;
const fmtData = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const fmtDataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── Normalizadores — resposta da API → formato genérico de tabela ─
interface EstoqueBaixoItem { nome: string; sku: string | null; estoqueAtual: number; estoqueMinimo: number; categoria?: string }
function normalizarEstoqueBaixo(data: {
  produtos?: EstoqueBaixoItem[];
  grupos?: { grupo: string; produtos: EstoqueBaixoItem[] }[];
  total?: number;
}): ResultadoRelatorio {
  const colunas: Coluna[] = [
    { key: "nome", label: "Produto" }, { key: "sku", label: "SKU" },
    { key: "categoria", label: "Categoria" },
    { key: "estoqueAtual", label: "Estoque Atual", align: "right" },
    { key: "estoqueMinimo", label: "Estoque Mínimo", align: "right" },
  ];
  const linha = (p: EstoqueBaixoItem) => ({
    nome: p.nome, sku: p.sku || "—", categoria: p.categoria || "—",
    estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo,
  });
  const total = data.total ?? data.produtos?.length ?? 0;

  // Resposta agrupada (agrupar=categoria|setor) → uma seção por grupo.
  if (data.grupos) {
    return {
      titulo: "Produtos com Estoque Baixo",
      kpis: [{ label: "Produtos abaixo do mínimo", value: String(total) }],
      colunas, linhas: [],
      secoesExtras: data.grupos.map(g => ({
        titulo: `${g.grupo} (${g.produtos.length})`,
        colunas,
        linhas: g.produtos.map(linha),
      })),
    };
  }

  return {
    titulo: "Produtos com Estoque Baixo",
    kpis: [{ label: "Produtos abaixo do mínimo", value: String(total) }],
    colunas,
    linhas: (data.produtos ?? []).map(linha),
  };
}

function normalizarClientesTop(data: { clientes: { nome: string; pedidos: number; totalGasto: number; ticketMedio: number }[] }): ResultadoRelatorio {
  // toNum: totalGasto pode vir como string (NUMERIC do Postgres) — soma com
  // "+" direto concatenava em vez de somar (0 + "30.00" + "25.00" = "030.0025.00").
  const totalGeral = data.clientes.reduce((s, c) => s + toNum(c.totalGasto), 0);
  return {
    titulo: "Clientes que Mais Compram",
    kpis: [
      { label: "Clientes no ranking", value: String(data.clientes.length) },
      { label: "Total gasto (geral)", value: fmtBRL(totalGeral) },
    ],
    colunas: [
      { key: "nome", label: "Cliente" }, { key: "pedidos", label: "Pedidos", align: "right" },
      { key: "totalGasto", label: "Total Gasto", align: "right" }, { key: "ticketMedio", label: "Ticket Médio", align: "right" },
    ],
    linhas: data.clientes.map(c => ({ nome: c.nome, pedidos: c.pedidos, totalGasto: fmtBRL(c.totalGasto), ticketMedio: fmtBRL(c.ticketMedio) })),
  };
}

function normalizarProdutosLucrativos(data: {
  comCusto: { nome: string; qtd: number; receita: number; custoTotal: number; margem: number; margemPct: number }[];
  semCusto: { nome: string; qtd: number; receita: number }[];
}): ResultadoRelatorio {
  return {
    titulo: "Produtos Mais Lucrativos",
    kpis: [
      { label: "Produtos com custo cadastrado", value: String(data.comCusto.length) },
      { label: "Vendidos sem custo cadastrado", value: String(data.semCusto.length) },
    ],
    colunas: [
      { key: "nome", label: "Produto" }, { key: "qtd", label: "Qtd Vendida", align: "right" },
      { key: "receita", label: "Receita", align: "right" }, { key: "custoTotal", label: "Custo", align: "right" },
      { key: "margem", label: "Margem R$", align: "right" }, { key: "margemPct", label: "Margem %", align: "right" },
    ],
    linhas: data.comCusto.map(p => ({
      nome: p.nome, qtd: p.qtd, receita: fmtBRL(p.receita), custoTotal: fmtBRL(p.custoTotal),
      margem: fmtBRL(p.margem), margemPct: fmtPct(p.margemPct),
    })),
    secoesExtras: data.semCusto.length ? [{
      titulo: "Vendidos sem custo cadastrado (fora do ranking de margem)",
      colunas: [{ key: "nome", label: "Produto" }, { key: "qtd", label: "Qtd", align: "right" }, { key: "receita", label: "Receita", align: "right" }],
      linhas: data.semCusto.map(p => ({ nome: p.nome, qtd: p.qtd, receita: fmtBRL(p.receita) })),
    }] : undefined,
    avisos: ["CMV calculado com o custo ATUAL do produto cadastrado — não existe um histórico do custo no momento da venda, então é uma aproximação, não o custo exato da época."],
  };
}

function normalizarVendasPeriodo(data: {
  kpis: { totalVendido: number; numPedidos: number; ticketMedio: number };
  serie: { data: string; vendas: number; pedidos: number }[];
  porFormaPagamento: { forma: string; count: number }[];
}): ResultadoRelatorio {
  return {
    titulo: "Vendas por Período",
    kpis: [
      { label: "Total Vendido", value: fmtBRL(data.kpis.totalVendido) },
      { label: "Pedidos", value: String(data.kpis.numPedidos) },
      { label: "Ticket Médio", value: fmtBRL(data.kpis.ticketMedio) },
    ],
    colunas: [
      { key: "data", label: "Data" }, { key: "pedidos", label: "Pedidos", align: "right" },
      { key: "vendas", label: "Vendas", align: "right" },
    ],
    linhas: data.serie.map(s => ({ data: fmtData(s.data), pedidos: s.pedidos, vendas: fmtBRL(s.vendas) })),
    secoesExtras: data.porFormaPagamento.length ? [{
      titulo: "Por forma de pagamento",
      colunas: [{ key: "forma", label: "Forma" }, { key: "count", label: "Pedidos", align: "right" }],
      linhas: data.porFormaPagamento.map(f => ({ forma: f.forma, count: f.count })),
    }] : undefined,
  };
}

function normalizarFluxoCaixa(data: {
  kpis: { totalEntradas: number; totalSaidas: number; saldo: number };
  serie: { data: string; entradas: number; saidas: number; saldoAcumulado: number }[];
  avisoSaidas: string | null;
}): ResultadoRelatorio {
  return {
    titulo: "Fluxo de Caixa",
    kpis: [
      { label: "Entradas", value: fmtBRL(data.kpis.totalEntradas) },
      { label: "Saídas", value: fmtBRL(data.kpis.totalSaidas) },
      { label: "Saldo", value: fmtBRL(data.kpis.saldo) },
    ],
    colunas: [
      { key: "data", label: "Data" }, { key: "entradas", label: "Entradas", align: "right" },
      { key: "saidas", label: "Saídas", align: "right" }, { key: "saldoAcumulado", label: "Saldo Acumulado", align: "right" },
    ],
    linhas: data.serie.map(s => ({ data: fmtData(s.data), entradas: fmtBRL(s.entradas), saidas: fmtBRL(s.saidas), saldoAcumulado: fmtBRL(s.saldoAcumulado) })),
    avisos: data.avisoSaidas ? [data.avisoSaidas] : undefined,
  };
}

function normalizarLucroBrutoLiquido(data: {
  receita: number; cmv: number; lucroBruto: number; despesas: number; lucroLiquido: number;
  margemBruta: number; margemLiquida: number; avisoCmv: string | null; avisoDespesas: string | null;
}): ResultadoRelatorio {
  return {
    titulo: "Lucro Bruto e Líquido",
    kpis: [
      { label: "Margem Bruta", value: fmtPct(data.margemBruta) },
      { label: "Margem Líquida", value: fmtPct(data.margemLiquida) },
    ],
    colunas: [{ key: "linha", label: "Demonstrativo" }, { key: "valor", label: "Valor", align: "right" }],
    linhas: [
      { linha: "Receita", valor: fmtBRL(data.receita) },
      { linha: "(−) CMV", valor: fmtBRL(data.cmv) },
      { linha: "= Lucro Bruto", valor: fmtBRL(data.lucroBruto) },
      { linha: "(−) Despesas", valor: fmtBRL(data.despesas) },
      { linha: "= Lucro Líquido", valor: fmtBRL(data.lucroLiquido) },
    ],
    avisos: [data.avisoCmv, data.avisoDespesas].filter((a): a is string => !!a),
  };
}

function normalizarLogsCriticos(data: {
  logs: { dataHora: string; usuario: string; acao: string; modulo: string | null; status: string }[];
}): ResultadoRelatorio {
  return {
    titulo: "Logs de Alterações Críticas",
    kpis: [{ label: "Ocorrências no período", value: String(data.logs.length) }],
    colunas: [
      { key: "dataHora", label: "Data/Hora" }, { key: "usuario", label: "Usuário" }, { key: "acao", label: "Ação" },
      { key: "modulo", label: "Módulo" }, { key: "status", label: "Status" },
    ],
    linhas: data.logs.map(l => ({ dataHora: fmtDataHora(l.dataHora), usuario: l.usuario, acao: l.acao, modulo: l.modulo || "—", status: l.status })),
  };
}

// ─── Normalizadores dos 25 relatórios adicionados depois dos 7 originais ───

function normalizarEntradaMercadorias(data: {
  movimentos: { data: string; produto: string; fornecedor: string; qtd: number; custoUnit: number | null; nf: string | null; lote: string | null; validade: string | null }[];
  kpis: { totalMovimentos: number; totalQtd: number; valorTotal: number };
}): ResultadoRelatorio {
  return {
    titulo: "Entrada de Mercadorias",
    kpis: [
      { label: "Movimentos", value: String(data.kpis.totalMovimentos) },
      { label: "Qtd Total", value: String(data.kpis.totalQtd) },
      { label: "Valor Total", value: fmtBRL(data.kpis.valorTotal) },
    ],
    colunas: [
      { key: "data", label: "Data" }, { key: "produto", label: "Produto" }, { key: "fornecedor", label: "Fornecedor" },
      { key: "qtd", label: "Qtd", align: "right" }, { key: "custoUnit", label: "Custo Unit.", align: "right" }, { key: "nf", label: "NF" },
    ],
    linhas: data.movimentos.map(m => ({
      data: fmtDataHora(m.data), produto: m.produto, fornecedor: m.fornecedor, qtd: m.qtd,
      custoUnit: m.custoUnit != null ? fmtBRL(m.custoUnit) : "—", nf: m.nf || "—",
    })),
  };
}

function normalizarSaidaProdutos(data: {
  movimentos: { data: string; produto: string; tipo: string; qtd: number; responsavel: string; origem: string }[];
  kpis: { totalMovimentos: number; totalQtd: number };
}): ResultadoRelatorio {
  return {
    titulo: "Saída de Produtos",
    kpis: [{ label: "Movimentos", value: String(data.kpis.totalMovimentos) }, { label: "Qtd Total", value: String(data.kpis.totalQtd) }],
    colunas: [
      { key: "data", label: "Data" }, { key: "produto", label: "Produto" }, { key: "tipo", label: "Tipo" },
      { key: "qtd", label: "Qtd", align: "right" }, { key: "responsavel", label: "Responsável" }, { key: "origem", label: "Origem" },
    ],
    linhas: data.movimentos.map(m => ({ data: fmtDataHora(m.data), produto: m.produto, tipo: m.tipo, qtd: m.qtd, responsavel: m.responsavel, origem: m.origem })),
  };
}

function normalizarExtratoInventario(data: {
  produtos: { nome: string; sku: string | null; estoqueAtual: number; custoUnit: number | null; valorEstoque: number | null }[];
  kpis: { totalItens: number; valorTotalEstoque: number };
}): ResultadoRelatorio {
  return {
    titulo: "Extrato e Inventário",
    kpis: [{ label: "Itens", value: String(data.kpis.totalItens) }, { label: "Valor Total em Estoque", value: fmtBRL(data.kpis.valorTotalEstoque) }],
    colunas: [
      { key: "nome", label: "Produto" }, { key: "sku", label: "SKU" }, { key: "estoqueAtual", label: "Estoque", align: "right" },
      { key: "custoUnit", label: "Custo Unit.", align: "right" }, { key: "valorEstoque", label: "Valor em Estoque", align: "right" },
    ],
    linhas: data.produtos.map(p => ({
      nome: p.nome, sku: p.sku || "—", estoqueAtual: p.estoqueAtual,
      custoUnit: p.custoUnit != null ? fmtBRL(p.custoUnit) : "—", valorEstoque: p.valorEstoque != null ? fmtBRL(p.valorEstoque) : "—",
    })),
  };
}

function normalizarBalancoEstoque(data: {
  balancos: { codigo: string; dataContagem: string; dataEncerramento: string | null; totalItens: number; totalDivergencias: number; valorDivergencia: number }[];
  kpis: { totalBalancos: number };
}): ResultadoRelatorio {
  return {
    titulo: "Balanço de Estoque",
    kpis: [{ label: "Balanços Encerrados", value: String(data.kpis.totalBalancos) }],
    colunas: [
      { key: "codigo", label: "Código" }, { key: "dataContagem", label: "Contagem" }, { key: "dataEncerramento", label: "Encerramento" },
      { key: "totalItens", label: "Itens", align: "right" }, { key: "totalDivergencias", label: "Divergências", align: "right" },
      { key: "valorDivergencia", label: "Valor Divergência", align: "right" },
    ],
    linhas: data.balancos.map(b => ({
      codigo: b.codigo, dataContagem: fmtDataHora(b.dataContagem), dataEncerramento: b.dataEncerramento ? fmtDataHora(b.dataEncerramento) : "—",
      totalItens: b.totalItens, totalDivergencias: b.totalDivergencias, valorDivergencia: fmtBRL(b.valorDivergencia),
    })),
  };
}

function normalizarProdutosSemMovimentacao(data: { produtos: { nome: string; sku: string | null; estoqueAtual: number }[]; kpis: { totalSemMovimentacao: number } }): ResultadoRelatorio {
  return {
    titulo: "Produtos sem Movimentação",
    kpis: [{ label: "Produtos sem movimentação", value: String(data.kpis.totalSemMovimentacao) }],
    colunas: [{ key: "nome", label: "Produto" }, { key: "sku", label: "SKU" }, { key: "estoqueAtual", label: "Estoque Atual", align: "right" }],
    linhas: data.produtos.map(p => ({ nome: p.nome, sku: p.sku || "—", estoqueAtual: p.estoqueAtual })),
  };
}

function normalizarHistoricoMovimentacoes(data: {
  movimentos: { data: string; produto: string; tipo: string; qtd: number; balanceBefore: number; balanceAfter: number; responsavel: string }[];
  kpis: { totalMovimentos: number };
}): ResultadoRelatorio {
  return {
    titulo: "Histórico de Movimentações",
    kpis: [{ label: "Movimentos", value: String(data.kpis.totalMovimentos) }],
    colunas: [
      { key: "data", label: "Data" }, { key: "produto", label: "Produto" }, { key: "tipo", label: "Tipo" }, { key: "qtd", label: "Qtd", align: "right" },
      { key: "saldo", label: "Saldo Após", align: "right" }, { key: "responsavel", label: "Responsável" },
    ],
    linhas: data.movimentos.map(m => ({ data: fmtDataHora(m.data), produto: m.produto, tipo: m.tipo, qtd: m.qtd, saldo: m.balanceAfter, responsavel: m.responsavel })),
  };
}

function normalizarClientesCadastrados(data: { clientes: { nome: string; telefone: string; status: string; cadastradoEm: string }[]; kpis: { total: number; ativos: number; inativos: number } }): ResultadoRelatorio {
  return {
    titulo: "Clientes Cadastrados",
    kpis: [{ label: "Total", value: String(data.kpis.total) }, { label: "Ativos", value: String(data.kpis.ativos) }, { label: "Inativos", value: String(data.kpis.inativos) }],
    colunas: [{ key: "nome", label: "Nome" }, { key: "telefone", label: "Telefone" }, { key: "status", label: "Status" }, { key: "cadastradoEm", label: "Cadastrado em" }],
    linhas: data.clientes.map(c => ({ nome: c.nome, telefone: c.telefone, status: c.status, cadastradoEm: fmtDataHora(c.cadastradoEm) })),
  };
}

function normalizarHistoricoComprasCliente(data: {
  cliente: { nome: string }; pedidos: { numero: number; data: string; status: string; total: string }[];
  kpis: { totalPedidos: number; totalGasto: number; ticketMedio: number };
}): ResultadoRelatorio {
  return {
    titulo: `Histórico de Compras — ${data.cliente.nome}`,
    kpis: [
      { label: "Pedidos", value: String(data.kpis.totalPedidos) }, { label: "Total Gasto", value: fmtBRL(data.kpis.totalGasto) },
      { label: "Ticket Médio", value: fmtBRL(data.kpis.ticketMedio) },
    ],
    colunas: [{ key: "numero", label: "Pedido #" }, { key: "data", label: "Data" }, { key: "status", label: "Status" }, { key: "total", label: "Total", align: "right" }],
    linhas: data.pedidos.map(p => ({ numero: p.numero, data: fmtDataHora(p.data), status: p.status, total: fmtBRL(parseFloat(p.total)) })),
  };
}

function normalizarClientesInativos(data: { clientes: { nome: string; telefone: string }[]; kpis: { totalInativos: number } }): ResultadoRelatorio {
  return {
    titulo: "Clientes Inativos",
    kpis: [{ label: "Clientes inativos no período", value: String(data.kpis.totalInativos) }],
    colunas: [{ key: "nome", label: "Nome" }, { key: "telefone", label: "Telefone" }],
    linhas: data.clientes.map(c => ({ nome: c.nome, telefone: c.telefone })),
  };
}

function normalizarListaProdutos(data: { produtos: { nome: string; sku: string | null; categoria: string; preco: number; estoqueAtual: number; status: string }[]; kpis: { total: number } }): ResultadoRelatorio {
  return {
    titulo: "Lista de Produtos",
    kpis: [{ label: "Total de Produtos", value: String(data.kpis.total) }],
    colunas: [
      { key: "nome", label: "Produto" }, { key: "sku", label: "SKU" }, { key: "categoria", label: "Categoria" },
      { key: "preco", label: "Preço", align: "right" }, { key: "estoqueAtual", label: "Estoque", align: "right" }, { key: "status", label: "Status" },
    ],
    linhas: data.produtos.map(p => ({ nome: p.nome, sku: p.sku || "—", categoria: p.categoria, preco: fmtBRL(p.preco), estoqueAtual: p.estoqueAtual, status: p.status })),
  };
}

function normalizarProdutosPorCategoria(data: { categorias: { categoria: string; totalProdutos: number; valorEstoque: number }[]; kpis: { totalCategorias: number } }): ResultadoRelatorio {
  return {
    titulo: "Produtos por Categoria",
    kpis: [{ label: "Categorias", value: String(data.kpis.totalCategorias) }],
    colunas: [{ key: "categoria", label: "Categoria" }, { key: "totalProdutos", label: "Produtos", align: "right" }, { key: "valorEstoque", label: "Valor em Estoque", align: "right" }],
    linhas: data.categorias.map(c => ({ categoria: c.categoria, totalProdutos: c.totalProdutos, valorEstoque: fmtBRL(c.valorEstoque) })),
  };
}

function normalizarProdutosBaixaMargem(data: { produtos: { nome: string; preco: number; custo: number; margemPct: number }[]; kpis: { totalProdutos: number; limiteMargemPct: number } }): ResultadoRelatorio {
  return {
    titulo: "Produtos com Baixa Margem",
    kpis: [{ label: `Abaixo de ${data.kpis.limiteMargemPct}% de margem`, value: String(data.kpis.totalProdutos) }],
    colunas: [{ key: "nome", label: "Produto" }, { key: "preco", label: "Preço", align: "right" }, { key: "custo", label: "Custo", align: "right" }, { key: "margemPct", label: "Margem %", align: "right" }],
    linhas: data.produtos.map(p => ({ nome: p.nome, preco: fmtBRL(p.preco), custo: fmtBRL(p.custo), margemPct: fmtPct(p.margemPct) })),
  };
}

function normalizarProdutosSemEstoque(data: { produtos: { nome: string; sku: string | null; estoqueAtual: number }[]; kpis: { total: number } }): ResultadoRelatorio {
  return {
    titulo: "Produtos sem Estoque",
    kpis: [{ label: "Produtos sem estoque", value: String(data.kpis.total) }],
    colunas: [{ key: "nome", label: "Produto" }, { key: "sku", label: "SKU" }, { key: "estoqueAtual", label: "Estoque", align: "right" }],
    linhas: data.produtos.map(p => ({ nome: p.nome, sku: p.sku || "—", estoqueAtual: p.estoqueAtual })),
  };
}

function normalizarProdutosMaiorGiro(data: { produtos: { nome: string; qtdVendida: number; estoqueAtual: number | null; giro: number | null }[]; kpis: { totalProdutos: number } }): ResultadoRelatorio {
  return {
    titulo: "Produtos com Maior Giro",
    kpis: [{ label: "Produtos no ranking", value: String(data.kpis.totalProdutos) }],
    colunas: [
      { key: "nome", label: "Produto" }, { key: "qtdVendida", label: "Qtd Vendida", align: "right" },
      { key: "estoqueAtual", label: "Estoque Atual", align: "right" }, { key: "giro", label: "Giro", align: "right" },
    ],
    linhas: data.produtos.map(p => ({ nome: p.nome, qtdVendida: p.qtdVendida, estoqueAtual: p.estoqueAtual ?? "—", giro: p.giro != null ? toNum(p.giro).toFixed(2) : "—" })),
  };
}

function normalizarVendasPorProduto(data: { produtos: { nome: string; qtd: number; receita: number }[]; kpis: { totalProdutos: number; receitaTotal: number } }): ResultadoRelatorio {
  return {
    titulo: "Vendas por Produto",
    kpis: [{ label: "Produtos", value: String(data.kpis.totalProdutos) }, { label: "Receita Total", value: fmtBRL(data.kpis.receitaTotal) }],
    colunas: [{ key: "nome", label: "Produto" }, { key: "qtd", label: "Qtd", align: "right" }, { key: "receita", label: "Receita", align: "right" }],
    linhas: data.produtos.map(p => ({ nome: p.nome, qtd: p.qtd, receita: fmtBRL(p.receita) })),
  };
}

function normalizarVendasPorCliente(data: { clientes: { nome: string; pedidos: number; totalGasto: number; ticketMedio: number }[]; kpis: { totalClientes: number } }): ResultadoRelatorio {
  return {
    titulo: "Vendas por Cliente",
    kpis: [{ label: "Clientes", value: String(data.kpis.totalClientes) }],
    colunas: [
      { key: "nome", label: "Cliente" }, { key: "pedidos", label: "Pedidos", align: "right" },
      { key: "totalGasto", label: "Total Gasto", align: "right" }, { key: "ticketMedio", label: "Ticket Médio", align: "right" },
    ],
    linhas: data.clientes.map(c => ({ nome: c.nome, pedidos: c.pedidos, totalGasto: fmtBRL(c.totalGasto), ticketMedio: fmtBRL(c.ticketMedio) })),
  };
}

function normalizarVendasPorFormaPagamento(data: { formas: { forma: string; pedidos: number; total: number }[]; kpis: { totalGeral: number } }): ResultadoRelatorio {
  return {
    titulo: "Vendas por Forma de Pagamento",
    kpis: [{ label: "Total Geral", value: fmtBRL(data.kpis.totalGeral) }],
    colunas: [{ key: "forma", label: "Forma" }, { key: "pedidos", label: "Pedidos", align: "right" }, { key: "total", label: "Total", align: "right" }],
    linhas: data.formas.map(f => ({ forma: f.forma, pedidos: f.pedidos, total: fmtBRL(f.total) })),
  };
}

function normalizarProdutosMaisVendidos(data: { produtos: { nome: string; qtd: number; receita: number }[]; kpis: { totalProdutos: number } }): ResultadoRelatorio {
  return {
    titulo: "Produtos Mais Vendidos",
    kpis: [{ label: "Produtos no ranking", value: String(data.kpis.totalProdutos) }],
    colunas: [{ key: "nome", label: "Produto" }, { key: "qtd", label: "Qtd Vendida", align: "right" }, { key: "receita", label: "Receita", align: "right" }],
    linhas: data.produtos.map(p => ({ nome: p.nome, qtd: p.qtd, receita: fmtBRL(p.receita) })),
  };
}

function normalizarTicketMedio(data: { kpis: { numPedidos: number; totalVendido: number; ticketMedio: number }; porVendedor: { vendedor: string; pedidos: number; ticketMedio: number }[] }): ResultadoRelatorio {
  return {
    titulo: "Ticket Médio",
    kpis: [
      { label: "Ticket Médio Geral", value: fmtBRL(data.kpis.ticketMedio) }, { label: "Pedidos", value: String(data.kpis.numPedidos) },
      { label: "Total Vendido", value: fmtBRL(data.kpis.totalVendido) },
    ],
    colunas: [{ key: "vendedor", label: "Vendedor" }, { key: "pedidos", label: "Pedidos", align: "right" }, { key: "ticketMedio", label: "Ticket Médio", align: "right" }],
    linhas: data.porVendedor.map(v => ({ vendedor: v.vendedor, pedidos: v.pedidos, ticketMedio: fmtBRL(v.ticketMedio) })),
  };
}

function normalizarCancelamentosDevolucoes(data: {
  pedidos: { numero: number; data: string; status: string; paymentStatus: string; total: string; motivo: string | null }[];
  kpis: { totalOcorrencias: number; cancelados: number; devolvidos: number; valorTotal: number };
}): ResultadoRelatorio {
  return {
    titulo: "Cancelamentos e Devoluções",
    kpis: [
      { label: "Ocorrências", value: String(data.kpis.totalOcorrencias) }, { label: "Cancelados", value: String(data.kpis.cancelados) },
      { label: "Devolvidos", value: String(data.kpis.devolvidos) }, { label: "Valor Total", value: fmtBRL(data.kpis.valorTotal) },
    ],
    colunas: [
      { key: "numero", label: "Pedido #" }, { key: "data", label: "Data" }, { key: "status", label: "Status" },
      { key: "total", label: "Total", align: "right" }, { key: "motivo", label: "Motivo" },
    ],
    linhas: data.pedidos.map(p => ({
      numero: p.numero, data: fmtDataHora(p.data),
      status: p.status === "cancelled" ? "Cancelado" : p.paymentStatus === "refunded" ? "Devolvido" : p.status,
      total: fmtBRL(parseFloat(p.total)), motivo: p.motivo || "—",
    })),
  };
}

function normalizarContasReceber(data: {
  lancamentos: { descricao: string; valor: string; status: string; dataCompetencia: string; cliente: string }[];
  kpis: { totalLiquidado: number; totalPendente: number; totalGeral: number };
}): ResultadoRelatorio {
  return {
    titulo: "Contas a Receber",
    kpis: [
      { label: "Liquidado", value: fmtBRL(data.kpis.totalLiquidado) }, { label: "Pendente", value: fmtBRL(data.kpis.totalPendente) },
      { label: "Total", value: fmtBRL(data.kpis.totalGeral) },
    ],
    colunas: [
      { key: "descricao", label: "Descrição" }, { key: "cliente", label: "Cliente" }, { key: "valor", label: "Valor", align: "right" },
      { key: "status", label: "Status" }, { key: "dataCompetencia", label: "Data" },
    ],
    linhas: data.lancamentos.map(l => ({ descricao: l.descricao, cliente: l.cliente, valor: fmtBRL(parseFloat(l.valor)), status: l.status, dataCompetencia: fmtData(l.dataCompetencia) })),
  };
}

function normalizarContasPagar(data: { lancamentos: { descricao: string; valor: string; status: string; dataCompetencia: string }[]; kpis: { totalPagar: number }; aviso: string | null }): ResultadoRelatorio {
  return {
    titulo: "Contas a Pagar",
    kpis: [{ label: "Total a Pagar", value: fmtBRL(data.kpis.totalPagar) }],
    colunas: [{ key: "descricao", label: "Descrição" }, { key: "valor", label: "Valor", align: "right" }, { key: "status", label: "Status" }, { key: "dataCompetencia", label: "Data" }],
    linhas: data.lancamentos.map(l => ({ descricao: l.descricao, valor: fmtBRL(parseFloat(l.valor)), status: l.status, dataCompetencia: fmtData(l.dataCompetencia) })),
    avisos: data.aviso ? [data.aviso] : undefined,
  };
}

function normalizarInadimplencia(data: { lancamentos: { descricao: string; valor: string; dataCompetencia: string; cliente: string }[]; kpis: { totalAtraso: number; qtd: number }; aviso: string | null }): ResultadoRelatorio {
  return {
    titulo: "Inadimplência",
    kpis: [{ label: "Em Atraso", value: fmtBRL(data.kpis.totalAtraso) }, { label: "Títulos", value: String(data.kpis.qtd) }],
    colunas: [{ key: "descricao", label: "Descrição" }, { key: "cliente", label: "Cliente" }, { key: "valor", label: "Valor", align: "right" }, { key: "dataCompetencia", label: "Vencimento" }],
    linhas: data.lancamentos.map(l => ({ descricao: l.descricao, cliente: l.cliente, valor: fmtBRL(parseFloat(l.valor)), dataCompetencia: fmtData(l.dataCompetencia) })),
    avisos: data.aviso ? [data.aviso] : undefined,
  };
}

function normalizarReceitasDespesasHistorico(data: { categorias: { categoria: string; tipo: string; total: number }[]; kpis: { totalEntradas: number; totalSaidas: number; saldo: number } }): ResultadoRelatorio {
  return {
    titulo: "Receitas e Despesas por Histórico",
    kpis: [
      { label: "Entradas", value: fmtBRL(data.kpis.totalEntradas) }, { label: "Saídas", value: fmtBRL(data.kpis.totalSaidas) },
      { label: "Saldo", value: fmtBRL(data.kpis.saldo) },
    ],
    colunas: [{ key: "categoria", label: "Categoria" }, { key: "tipo", label: "Tipo" }, { key: "total", label: "Total", align: "right" }],
    linhas: data.categorias.map(c => ({ categoria: c.categoria, tipo: c.tipo === "entrada" ? "Entrada" : "Saída", total: fmtBRL(c.total) })),
  };
}

function normalizarFechamentoCaixa(data: {
  sessoes: { abertoPor: string; encerradoPor: string; openedAt: string; closedAt: string; totalDinheiro: number; totalPix: number; totalCartao: number; totalDebito: number; totalOutros: number; totalVendas: number; saldoInicial: number; saldoFinal: number | null }[];
  kpis: { totalSessoes: number; totalVendas: number; totalGeral: number };
}): ResultadoRelatorio {
  return {
    titulo: "Fechamento Diário de Caixa",
    kpis: [
      { label: "Sessões Encerradas", value: String(data.kpis.totalSessoes) }, { label: "Total de Vendas", value: String(data.kpis.totalVendas) },
      { label: "Total Movimentado", value: fmtBRL(data.kpis.totalGeral) },
    ],
    colunas: [
      { key: "abertoPor", label: "Aberto por" }, { key: "encerradoPor", label: "Encerrado por" }, { key: "closedAt", label: "Fechamento" },
      { key: "totalDinheiro", label: "Dinheiro", align: "right" }, { key: "totalPix", label: "PIX", align: "right" },
      { key: "totalCartao", label: "Cartão", align: "right" }, { key: "saldoFinal", label: "Saldo Final", align: "right" },
    ],
    linhas: data.sessoes.map(s => ({
      abertoPor: s.abertoPor, encerradoPor: s.encerradoPor, closedAt: fmtDataHora(s.closedAt),
      totalDinheiro: fmtBRL(s.totalDinheiro), totalPix: fmtBRL(s.totalPix), totalCartao: fmtBRL(s.totalCartao),
      saldoFinal: s.saldoFinal != null ? fmtBRL(s.saldoFinal) : "—",
    })),
  };
}

// ─── Busca + normaliza o resultado de um relatório real ────────────
export async function fetchReportData(reportId: string, filtros: FiltrosDrawer): Promise<ResultadoRelatorio> {
  const qs = new URLSearchParams();
  if (filtros.dataDe) qs.set("dataInicio", filtros.dataDe);
  if (filtros.dataAte) qs.set("dataFim", filtros.dataAte);
  const periodoQs = qs.toString();

  const getJson = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Erro ao buscar relatório");
    }
    return res.json();
  };

  switch (reportId) {
    case "est-005": {
      const qs2 = new URLSearchParams();
      if (filtros.categoriaId) qs2.set("categoria", filtros.categoriaId);
      if (filtros.ordem) qs2.set("ordem", filtros.ordem);
      if (filtros.agrupamento) qs2.set("agrupar", filtros.agrupamento);
      return normalizarEstoqueBaixo(await getJson(`/api/reports/estoque-baixo?${qs2.toString()}`));
    }
    case "cli-002": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.ordem) qs2.set("ordem", filtros.ordem);
      if (filtros.canal && filtros.canal !== "todos") qs2.set("canal", filtros.canal);
      return normalizarClientesTop(await getJson(`/api/reports/clientes-top?${qs2.toString()}`));
    }
    case "prod-003":
      return normalizarProdutosLucrativos(await getJson(`/api/reports/produtos-lucrativos?${periodoQs}`));
    case "vnd-001": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.clienteId) qs2.set("clienteId", filtros.clienteId);
      if (filtros.formaPagamento) qs2.set("formaPagamento", filtros.formaPagamento);
      if (filtros.status) qs2.set("status", filtros.status);
      return normalizarVendasPeriodo(await getJson(`/api/reports/vendas-periodo?${qs2.toString()}`));
    }
    case "fin-001": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.historico) qs2.set("categoria", filtros.historico);
      return normalizarFluxoCaixa(await getJson(`/api/reports/fluxo-caixa?${qs2.toString()}`));
    }
    case "fin-005": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.historico) qs2.set("categoria", filtros.historico);
      return normalizarLucroBrutoLiquido(await getJson(`/api/reports/lucro-bruto-liquido?${qs2.toString()}`));
    }
    case "aud-002": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.usuarioId) qs2.set("userId", filtros.usuarioId);
      if (filtros.status) qs2.set("status", filtros.status);
      return normalizarLogsCriticos(await getJson(`/api/reports/logs-criticos?${qs2.toString()}`));
    }

    // ── 25 relatórios adicionados depois dos 7 originais ──────────────
    case "est-001": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.fornecedorId) qs2.set("fornecedorId", filtros.fornecedorId);
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      return normalizarEntradaMercadorias(await getJson(`/api/reports/entrada-mercadorias?${qs2.toString()}`));
    }
    case "est-002": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      if (filtros.usuarioId) qs2.set("responsavelId", filtros.usuarioId);
      return normalizarSaidaProdutos(await getJson(`/api/reports/saida-produtos?${qs2.toString()}`));
    }
    case "est-003": {
      const qs2 = new URLSearchParams();
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      return normalizarExtratoInventario(await getJson(`/api/reports/extrato-inventario?${qs2.toString()}`));
    }
    case "est-004":
      return normalizarBalancoEstoque(await getJson(`/api/reports/balanco-estoque?${periodoQs}`));
    case "est-006": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      return normalizarProdutosSemMovimentacao(await getJson(`/api/reports/produtos-sem-movimentacao?${qs2.toString()}`));
    }
    case "est-007": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      if (filtros.usuarioId) qs2.set("responsavelId", filtros.usuarioId);
      return normalizarHistoricoMovimentacoes(await getJson(`/api/reports/historico-movimentacoes?${qs2.toString()}`));
    }
    case "cli-001": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.status) qs2.set("status", filtros.status);
      return normalizarClientesCadastrados(await getJson(`/api/reports/clientes-cadastrados?${qs2.toString()}`));
    }
    case "cli-003": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.clienteId) qs2.set("clienteId", filtros.clienteId);
      return normalizarHistoricoComprasCliente(await getJson(`/api/reports/historico-compras-cliente?${qs2.toString()}`));
    }
    case "cli-004":
      return normalizarClientesInativos(await getJson(`/api/reports/clientes-inativos?${periodoQs}`));
    case "prod-001": {
      const qs2 = new URLSearchParams();
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      if (filtros.status) qs2.set("status", filtros.status);
      return normalizarListaProdutos(await getJson(`/api/reports/lista-produtos?${qs2.toString()}`));
    }
    case "prod-002":
      return normalizarProdutosPorCategoria(await getJson("/api/reports/produtos-por-categoria"));
    case "prod-004": {
      const qs2 = new URLSearchParams();
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      return normalizarProdutosBaixaMargem(await getJson(`/api/reports/produtos-baixa-margem?${qs2.toString()}`));
    }
    case "prod-005": {
      const qs2 = new URLSearchParams();
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      return normalizarProdutosSemEstoque(await getJson(`/api/reports/produtos-sem-estoque?${qs2.toString()}`));
    }
    case "prod-006": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      return normalizarProdutosMaiorGiro(await getJson(`/api/reports/produtos-maior-giro?${qs2.toString()}`));
    }
    case "vnd-002": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      if (filtros.formaPagamento) qs2.set("formaPagamento", filtros.formaPagamento);
      if (filtros.usuarioNome) qs2.set("vendedor", filtros.usuarioNome);
      return normalizarVendasPorProduto(await getJson(`/api/reports/vendas-por-produto?${qs2.toString()}`));
    }
    case "vnd-003": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.clienteId) qs2.set("clienteId", filtros.clienteId);
      if (filtros.usuarioNome) qs2.set("vendedor", filtros.usuarioNome);
      return normalizarVendasPorCliente(await getJson(`/api/reports/vendas-por-cliente?${qs2.toString()}`));
    }
    case "vnd-004": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.formaPagamento) qs2.set("formaPagamento", filtros.formaPagamento);
      return normalizarVendasPorFormaPagamento(await getJson(`/api/reports/vendas-por-forma-pagamento?${qs2.toString()}`));
    }
    case "vnd-005": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.produtoId) qs2.set("produtoId", filtros.produtoId);
      return normalizarProdutosMaisVendidos(await getJson(`/api/reports/produtos-mais-vendidos?${qs2.toString()}`));
    }
    case "vnd-006": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.clienteId) qs2.set("clienteId", filtros.clienteId);
      if (filtros.usuarioNome) qs2.set("vendedor", filtros.usuarioNome);
      return normalizarTicketMedio(await getJson(`/api/reports/ticket-medio?${qs2.toString()}`));
    }
    case "vnd-007": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.status) qs2.set("status", filtros.status);
      return normalizarCancelamentosDevolucoes(await getJson(`/api/reports/cancelamentos-devolucoes?${qs2.toString()}`));
    }
    case "fin-002": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.clienteId) qs2.set("clienteId", filtros.clienteId);
      if (filtros.status) qs2.set("status", filtros.status);
      if (filtros.historico) qs2.set("categoria", filtros.historico);
      return normalizarContasReceber(await getJson(`/api/reports/contas-receber?${qs2.toString()}`));
    }
    case "fin-003": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.historico) qs2.set("categoria", filtros.historico);
      return normalizarContasPagar(await getJson(`/api/reports/contas-pagar?${qs2.toString()}`));
    }
    case "fin-004": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.clienteId) qs2.set("clienteId", filtros.clienteId);
      return normalizarInadimplencia(await getJson(`/api/reports/inadimplencia?${qs2.toString()}`));
    }
    case "fin-006": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.historico) qs2.set("categoria", filtros.historico);
      return normalizarReceitasDespesasHistorico(await getJson(`/api/reports/receitas-despesas-historico?${qs2.toString()}`));
    }
    case "aud-001": {
      const qs2 = new URLSearchParams(periodoQs);
      if (filtros.usuarioNome) qs2.set("responsavel", filtros.usuarioNome);
      return normalizarFechamentoCaixa(await getJson(`/api/reports/fechamento-caixa?${qs2.toString()}`));
    }

    default:
      throw new Error("Este relatório ainda não está disponível.");
  }
}

// ─── Exportação — mesmas funções genéricas que existiam em
// relatorios-preview.tsx (jsPDF + autoTable, xlsx), agora reaproveitadas
// sobre o resultado de verdade em vez de dado mock. ───────────────────
function exportarPDF(resultado: ResultadoRelatorio, storeName: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const centerX = pageWidth / 2;

  // Cabeçalho: nome do estabelecimento (não "ARMAZIX" — esse é o nome da
  // loja do cliente, não da plataforma) centralizado, com o nome do
  // relatório logo abaixo — a marca do sistema só aparece no rodapé.
  let y = 18;
  if (storeName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(storeName, centerX, y, { align: "center" });
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80);
    doc.text(resultado.titulo, centerX, y, { align: "center" });
    y += 7;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(resultado.titulo, centerX, y, { align: "center" });
    y += 8;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text("Emitido em: " + new Date().toLocaleString("pt-BR"), centerX, y, { align: "center" });
  doc.setTextColor(0);
  y += 6;

  let startY = y;
  if (resultado.kpis.length) {
    doc.setFontSize(9);
    const kpiLine = resultado.kpis.map(k => `${k.label}: ${k.value}`).join("   |   ");
    doc.text(kpiLine, 14, startY);
    startY += 8;
  }

  // Pula a tabela principal quando ela está vazia e há seções (relatório
  // agrupado) — senão sai um cabeçalho de tabela solto sem linhas.
  const temMainTable = resultado.linhas.length > 0 || !resultado.secoesExtras?.length;
  if (temMainTable) {
    autoTable(doc, {
      head: [resultado.colunas.map(c => c.label.toUpperCase())],
      body: resultado.linhas.map(l => resultado.colunas.map(c => String(l[c.key] ?? ""))),
      startY,
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
    });
  }

  let cursorY = temMainTable
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    : startY;
  for (const secao of resultado.secoesExtras ?? []) {
    doc.setFontSize(11);
    doc.text(secao.titulo, 14, cursorY + 10);
    autoTable(doc, {
      head: [secao.colunas.map(c => c.label.toUpperCase())],
      body: secao.linhas.map(l => secao.colunas.map(c => String(l[c.key] ?? ""))),
      startY: cursorY + 14,
      theme: "striped",
      headStyles: { fillColor: [100, 116, 139], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  // Rodapé: paginação à esquerda (como já era), marca do sistema à direita —
  // a única menção a "ARMAZIX" no PDF fica aqui, nunca no cabeçalho.
  const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  const footerY = doc.internal.pageSize.height - 10;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Página ${i} de ${pageCount}`, 14, footerY);
    doc.text("armazix.com.br", pageWidth - 14, footerY, { align: "right" });
  }
  doc.setTextColor(0);

  doc.save(`relatorio_${resultado.titulo.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`);
}

function exportarExcel(resultado: ResultadoRelatorio) {
  const wb = XLSX.utils.book_new();
  // Aba "Dados" só quando a tabela principal tem linhas (ou não há seções) —
  // relatório agrupado abre direto nas abas de cada grupo.
  if (resultado.linhas.length > 0 || !resultado.secoesExtras?.length) {
    const rows = resultado.linhas.map(l => {
      const row: Record<string, string | number> = {};
      resultado.colunas.forEach(c => { row[c.label] = l[c.key]; });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Dados");
  }
  for (const secao of resultado.secoesExtras ?? []) {
    const secaoRows = secao.linhas.map(l => {
      const row: Record<string, string | number> = {};
      secao.colunas.forEach(c => { row[c.label] = l[c.key]; });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(secaoRows), secao.titulo.slice(0, 31));
  }
  XLSX.writeFile(wb, `relatorio_${resultado.titulo.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.xlsx`);
}

// ─── Modal de resultado ──────────────────────────────────────────
function TabelaResultado({ colunas, linhas }: { colunas: Coluna[]; linhas: Record<string, string | number>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-secondary border-b-2 border-border">
          <tr>
            {colunas.map(c => (
              <th key={c.key} className={`px-3 py-2 font-bold text-foreground ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((linha, i) => (
            <tr key={i} className="hover:bg-secondary/50">
              {colunas.map(c => (
                <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""}`}>
                  {linha[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {linhas.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Sem movimentação no período selecionado.</p>
      )}
    </div>
  );
}

// Ícone + mensagem central pra quando o relatório inteiro (tabela principal
// e qualquer seção extra) vem vazio — pedido explícito do usuário: antes,
// um relatório sem dados no período só mostrava KPIs zerados (R$ 0,00 em
// tudo) e uma linha pequena no rodapé da tabela, dando a impressão de que
// o relatório tinha quebrado em vez de simplesmente não ter movimentação.
function SemMovimentacao() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-foreground">Sem movimentação no período selecionado</p>
      <p className="text-xs text-muted-foreground mt-1">Tente ampliar o período ou revisar os filtros aplicados.</p>
    </div>
  );
}

// true quando a tabela principal E todas as seções extras vêm vazias —
// nesse caso o modal mostra só a mensagem central em vez de KPIs zerados.
function semTodoDado(resultado: ResultadoRelatorio): boolean {
  return resultado.linhas.length === 0 && !(resultado.secoesExtras?.some(s => s.linhas.length > 0));
}

export function ResultadoRelatorioModal({
  reportId, filtros, storeName, onClose,
}: { reportId: string; filtros: FiltrosDrawer; storeName?: string; onClose: () => void }) {
  const [resultado, setResultado] = useState<ResultadoRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setErro("");
    fetchReportData(reportId, filtros)
      .then(r => { if (!cancelado) setResultado(r); })
      .catch(e => { if (!cancelado) setErro((e as Error).message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [reportId, filtros]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b no-print">
          <h2 className="text-lg font-semibold">{resultado?.titulo ?? "Gerando relatório…"}</h2>
          <div className="flex items-center gap-2">
            {resultado && (
              <>
                <Button variant="outline" size="sm" onClick={() => exportarPDF(resultado, storeName || "")} className="text-red-600 border-red-200 hover:bg-red-50">
                  <FileText className="w-4 h-4 mr-1.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportarExcel(resultado)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1.5" /> Imprimir
                </Button>
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {erro && !loading && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{erro}
            </div>
          )}
          {resultado && !loading && (
            semTodoDado(resultado) ? (
              <SemMovimentacao />
            ) : (
              <>
                {resultado.kpis.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {resultado.kpis.map(k => (
                      <div key={k.label} className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                        <p className="text-xs text-muted-foreground">{k.label}</p>
                        <p className="text-lg font-bold tabular-nums">{k.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {resultado.avisos?.map((aviso, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{aviso}
                  </div>
                ))}
                {/* Só mostra a tabela principal quando ela tem linhas, OU quando
                    não há seções extras (aí a própria tabela exibe o "sem
                    movimentação"). Sem isso, um relatório agrupado mostrava uma
                    tabela principal vazia por cima das seções. */}
                {(resultado.linhas.length > 0 || !resultado.secoesExtras?.length) && (
                  <TabelaResultado colunas={resultado.colunas} linhas={resultado.linhas} />
                )}
                {resultado.secoesExtras?.map(secao => (
                  <div key={secao.titulo} className="space-y-2 pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold">{secao.titulo}</h3>
                    <TabelaResultado colunas={secao.colunas} linhas={secao.linhas} />
                  </div>
                ))}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
