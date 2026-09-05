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
  formaPagamento: string; status: string; historico: string;
}

export const DEFAULT_FILTROS: FiltrosDrawer = {
  dataDe: "", dataAte: "", clienteId: "", usuarioId: "", formaPagamento: "", status: "", historico: "",
};

// IDs do catálogo (relatorios.tsx) que já têm backend real — os outros 21
// continuam fora de escopo.
export const RELATORIOS_IMPLEMENTADOS = [
  "est-005", "cli-002", "prod-003", "vnd-001", "fin-001", "fin-005", "aud-002",
] as const;

// ─── Helpers de formatação ───────────────────────────────────────
const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmtData = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const fmtDataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── Normalizadores — resposta da API → formato genérico de tabela ─
function normalizarEstoqueBaixo(data: { produtos: { nome: string; sku: string | null; estoqueAtual: number; estoqueMinimo: number }[] }): ResultadoRelatorio {
  return {
    titulo: "Produtos com Estoque Baixo",
    kpis: [{ label: "Produtos abaixo do mínimo", value: String(data.produtos.length) }],
    colunas: [
      { key: "nome", label: "Produto" }, { key: "sku", label: "SKU" },
      { key: "estoqueAtual", label: "Estoque Atual", align: "right" },
      { key: "estoqueMinimo", label: "Estoque Mínimo", align: "right" },
    ],
    linhas: data.produtos.map(p => ({ nome: p.nome, sku: p.sku || "—", estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo })),
  };
}

function normalizarClientesTop(data: { clientes: { nome: string; pedidos: number; totalGasto: number; ticketMedio: number }[] }): ResultadoRelatorio {
  const totalGeral = data.clientes.reduce((s, c) => s + c.totalGasto, 0);
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
      margem: fmtBRL(p.margem), margemPct: `${p.margemPct.toFixed(1)}%`,
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
      { label: "Margem Bruta", value: `${data.margemBruta.toFixed(1)}%` },
      { label: "Margem Líquida", value: `${data.margemLiquida.toFixed(1)}%` },
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
    case "est-005":
      return normalizarEstoqueBaixo(await getJson("/api/reports/estoque-baixo"));
    case "cli-002":
      return normalizarClientesTop(await getJson(`/api/reports/clientes-top?${periodoQs}`));
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
    default:
      throw new Error("Este relatório ainda não está disponível.");
  }
}

// ─── Exportação — mesmas funções genéricas que existiam em
// relatorios-preview.tsx (jsPDF + autoTable, xlsx), agora reaproveitadas
// sobre o resultado de verdade em vez de dado mock. ───────────────────
function exportarPDF(resultado: ResultadoRelatorio) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("ARMAZIX - " + resultado.titulo, 14, 20);
  doc.setFontSize(10);
  doc.text("Emitido em: " + new Date().toLocaleString("pt-BR"), 14, 28);

  let startY = 34;
  if (resultado.kpis.length) {
    doc.setFontSize(9);
    const kpiLine = resultado.kpis.map(k => `${k.label}: ${k.value}`).join("   |   ");
    doc.text(kpiLine, 14, startY);
    startY += 8;
  }

  autoTable(doc, {
    head: [resultado.colunas.map(c => c.label.toUpperCase())],
    body: resultado.linhas.map(l => resultado.colunas.map(c => String(l[c.key] ?? ""))),
    startY,
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
  });

  for (const secao of resultado.secoesExtras ?? []) {
    const prevY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(11);
    doc.text(secao.titulo, 14, prevY + 10);
    autoTable(doc, {
      head: [secao.colunas.map(c => c.label.toUpperCase())],
      body: secao.linhas.map(l => secao.colunas.map(c => String(l[c.key] ?? ""))),
      startY: prevY + 14,
      theme: "striped",
      headStyles: { fillColor: [100, 116, 139], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
    });
  }

  const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount} — ARMAZIX`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`relatorio_${resultado.titulo.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`);
}

function exportarExcel(resultado: ResultadoRelatorio) {
  const wb = XLSX.utils.book_new();
  const rows = resultado.linhas.map(l => {
    const row: Record<string, string | number> = {};
    resultado.colunas.forEach(c => { row[c.label] = l[c.key]; });
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Dados");
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
        <p className="text-center text-sm text-muted-foreground py-8">Nenhum dado encontrado para o período/filtros selecionados.</p>
      )}
    </div>
  );
}

export function ResultadoRelatorioModal({
  reportId, filtros, onClose,
}: { reportId: string; filtros: FiltrosDrawer; onClose: () => void }) {
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
                <Button variant="outline" size="sm" onClick={() => exportarPDF(resultado)} className="text-red-600 border-red-200 hover:bg-red-50">
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
              <TabelaResultado colunas={resultado.colunas} linhas={resultado.linhas} />
              {resultado.secoesExtras?.map(secao => (
                <div key={secao.titulo} className="space-y-2 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold">{secao.titulo}</h3>
                  <TabelaResultado colunas={secao.colunas} linhas={secao.linhas} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
