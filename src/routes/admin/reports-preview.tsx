/**
 * ARMAZIX - PREVIEW DE RELATÓRIOS COM DADOS FICTÍCIOS
 * Visualização funcional com exportação PDF, Excel e Impressão A4
 */

import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText, FileSpreadsheet, Printer, Download, ChevronLeft,
  Calendar, Filter, Eye, CheckCircle, AlertCircle, TrendingUp,
  TrendingDown, DollarSign, Package, ShoppingCart, Users
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/admin/reports-preview")({
  component: ReportsPreviewPage,
  head: () => ({
    meta: [{ title: "Preview de Relatórios — ARMAZIX" }],
  }),
});

// ============================================
// DADOS FICTÍCIOS
// ============================================

const MOCK_VENDAS: { id: string; data: string; cliente: string; produto: string; qtd: number; unit: number; total: number; vendedor: string; pagto: string; status: string }[] = [];

const MOCK_FLUXO_CAIXA: { data: string; historico: string; tipo: string; descricao: string; valor: number; saldo: number }[] = [];

const MOCK_ESTOQUE: { codigo: string; produto: string; categoria: string; estoque: number; minimo: number; status: string }[] = [];

// ============================================
// FUNÇÕES DE EXPORTAÇÃO
// ============================================

function exportarPDF(titulo: string, dados: any[], colunas: string[]) {
  const doc = new jsPDF();
  
  // Cabeçalho
  doc.setFontSize(16);
  doc.text("ARMAZIX - " + titulo, 14, 20);
  doc.setFontSize(10);
  doc.text("Data: " + new Date().toLocaleDateString("pt-BR"), 14, 30);
  doc.text("Emitido por: Sistema Armazix", 14, 36);
  
  // Tabela
  const headers = colunas.map(c => c.toUpperCase());
  const data = dados.map(obj => colunas.map(col => obj[col] || ""));
  
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 45,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
  });
  
  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount} - ARMAZIX © 2026`, 14, doc.internal.pageSize.height - 10);
  }
  
  doc.save(`relatorio_${titulo.toLowerCase().replace(/\s/g, "_")}_${Date.now()}.pdf`);
}

function exportarExcel(titulo: string, dados: any[]) {
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `relatorio_${titulo.toLowerCase().replace(/\s/g, "_")}_${Date.now()}.xlsx`);
}

function imprimirRelatorio() {
  window.print();
}

// ============================================
// COMPONENTES DE TABELA
// ============================================

function TabelaVendas() {
  const total = MOCK_VENDAS.reduce((acc, item) => acc + item.total, 0);
  
  return (
    <div className="overflow-x-auto print:text-xs">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-slate-100 border-b-2 border-slate-300">
          <tr>
            {["ID", "Data", "Cliente", "Produto", "Qtd", "Unitário", "Total", "Pagto", "Status"].map(h => (
              <th key={h} className="px-3 py-2 text-left font-bold text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {MOCK_VENDAS.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50 print:hover:bg-transparent">
              <td className="px-3 py-2 font-medium">{item.id}</td>
              <td className="px-3 py-2 text-slate-600">{item.data}</td>
              <td className="px-3 py-2">{item.cliente}</td>
              <td className="px-3 py-2 text-slate-600">{item.produto}</td>
              <td className="px-3 py-2 text-center">{item.qtd}</td>
              <td className="px-3 py-2 text-right">R$ {item.unit.toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-600">R$ {item.total.toFixed(2)}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-xs">{item.pagto}</Badge>
              </td>
              <td className="px-3 py-2">
                <Badge className={`text-xs ${item.status === "Concluída" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {item.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 border-t-2 border-slate-300">
          <tr>
            <td colSpan={6} className="px-3 py-3 text-right font-bold text-slate-700">TOTAL GERAL:</td>
            <td className="px-3 py-3 text-right font-bold text-emerald-600 text-lg">R$ {total.toFixed(2)}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TabelaFluxoCaixa() {
  const receitas = MOCK_FLUXO_CAIXA.filter(d => d.tipo === "RECEITA").reduce((acc, i) => acc + i.valor, 0);
  const despesas = MOCK_FLUXO_CAIXA.filter(d => d.tipo === "DESPESA").reduce((acc, i) => acc + Math.abs(i.valor), 0);
  const saldo = MOCK_FLUXO_CAIXA[MOCK_FLUXO_CAIXA.length - 1]?.saldo || 0;
  
  return (
    <div className="space-y-4">
      {/* Cards Resumo */}
      <div className="grid grid-cols-3 gap-4 print:grid-cols-3">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-emerald-700">Receitas</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">R$ {receitas.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-rose-50 border-rose-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-600" />
              <span className="text-sm text-rose-700">Despesas</span>
            </div>
            <p className="text-2xl font-bold text-rose-700">R$ {despesas.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className={`${saldo >= 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className={`w-5 h-5 ${saldo >= 0 ? "text-blue-600" : "text-amber-600"}`} />
              <span className={`text-sm ${saldo >= 0 ? "text-blue-700" : "text-amber-700"}`}>Saldo</span>
            </div>
            <p className={`text-2xl font-bold ${saldo >= 0 ? "text-blue-700" : "text-amber-700"}`}>R$ {saldo.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100 border-b-2 border-slate-300">
            <tr>
              {["Data", "Histórico", "Descrição", "Tipo", "Valor", "Saldo"].map(h => (
                <th key={h} className="px-3 py-2 text-left font-bold text-slate-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {MOCK_FLUXO_CAIXA.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">{item.data}</td>
                <td className="px-3 py-2 font-medium">{item.historico}</td>
                <td className="px-3 py-2 text-slate-600">{item.descricao}</td>
                <td className="px-3 py-2">
                  <Badge className={`text-xs ${item.tipo === "RECEITA" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {item.tipo}
                  </Badge>
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${item.tipo === "RECEITA" ? "text-emerald-600" : "text-rose-600"}`}>
                  R$ {Math.abs(item.valor).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-bold">R$ {item.saldo.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaEstoque() {
  const baixos = MOCK_ESTOQUE.filter(i => i.status === "BAIXO").length;
  
  return (
    <div className="space-y-4">
      {baixos > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <span className="text-amber-700 font-medium">Atenção: {baixos} produtos com estoque baixo!</span>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100 border-b-2 border-slate-300">
            <tr>
              {["Código", "Produto", "Categoria", "Estoque", "Mínimo", "Status"].map(h => (
                <th key={h} className="px-3 py-2 text-left font-bold text-slate-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {MOCK_ESTOQUE.map((item) => (
              <tr key={item.codigo} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{item.codigo}</td>
                <td className="px-3 py-2">{item.produto}</td>
                <td className="px-3 py-2 text-slate-600">{item.categoria}</td>
                <td className="px-3 py-2 text-center font-semibold">{item.estoque}</td>
                <td className="px-3 py-2 text-center text-slate-500">{item.minimo}</td>
                <td className="px-3 py-2">
                  <Badge className={`text-xs ${item.status === "OK" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {item.status === "OK" ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : <AlertCircle className="w-3 h-3 mr-1 inline" />}
                    {item.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// PÁGINA PRINCIPAL
// ============================================

function ReportsPreviewPage() {
  const [abaAtiva, setAbaAtiva] = useState("vendas");
  
  const dadosAtuais = useMemo(() => {
    switch(abaAtiva) {
      case "vendas": return { titulo: "Vendas por Período", dados: MOCK_VENDAS, colunas: ["id", "data", "cliente", "produto", "qtd", "unit", "total", "pagto", "status"] };
      case "financeiro": return { titulo: "Fluxo de Caixa", dados: MOCK_FLUXO_CAIXA, colunas: ["data", "historico", "descricao", "tipo", "valor", "saldo"] };
      case "estoque": return { titulo: "Controle de Estoque", dados: MOCK_ESTOQUE, colunas: ["codigo", "produto", "categoria", "estoque", "minimo", "status"] };
      default: return { titulo: "", dados: [], colunas: [] };
    }
  }, [abaAtiva]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* CSS para Impressão A4 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          .shadow-sm { box-shadow: none !important; }
          .border-slate-200 { border-color: #ddd !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 no-print">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-slate-600">
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Preview de Relatórios</h1>
              <p className="text-sm text-slate-500">Visualização com dados fictícios</p>
            </div>
          </div>
          
          {/* Botões de Exportação */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
              onClick={() => exportarPDF(dadosAtuais.titulo, dadosAtuais.dados, dadosAtuais.colunas)}
            >
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              onClick={() => exportarExcel(dadosAtuais.titulo, dadosAtuais.dados)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={imprimirRelatorio}
            >
              <Printer className="w-4 h-4 mr-2" /> Imprimir A4
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Abas */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-6 no-print">
          <TabsList className="bg-white border border-slate-200 p-1">
            <TabsTrigger value="vendas" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Vendas
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="estoque" className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Estoque
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="vendas">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Vendas por Período</h2>
                    <p className="text-sm text-slate-500">Período: 31/05/2026 a 02/06/2026</p>
                  </div>
                  <Badge variant="outline" className="text-xs">10 registros</Badge>
                </div>
                <TabelaVendas />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="financeiro">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Fluxo de Caixa</h2>
                    <p className="text-sm text-slate-500">Histórico estruturado por categorias</p>
                  </div>
                  <Badge variant="outline" className="text-xs">6 lançamentos</Badge>
                </div>
                <TabelaFluxoCaixa />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="estoque">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Controle de Estoque</h2>
                    <p className="text-sm text-slate-500">Posição atual com alertas de reposição</p>
                  </div>
                  <Badge variant="outline" className="text-xs">6 produtos</Badge>
                </div>
                <TabelaEstoque />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Versão para Impressão (sempre visível no print) */}
        <div className="print-only">
          <div className="text-center mb-6 border-b-2 border-slate-800 pb-4">
            <h1 className="text-2xl font-bold text-slate-900">ARMAZIX</h1>
            <h2 className="text-xl font-semibold text-slate-700 mt-2">{dadosAtuais.titulo}</h2>
            <p className="text-sm text-slate-500 mt-1">Emitido em: {new Date().toLocaleString("pt-BR")}</p>
          </div>
          {abaAtiva === "vendas" && <TabelaVendas />}
          {abaAtiva === "financeiro" && <TabelaFluxoCaixa />}
          {abaAtiva === "estoque" && <TabelaEstoque />}
          <div className="mt-8 text-center text-xs text-slate-500 border-t border-slate-300 pt-4">
            Sistema Armazix ERP © 2026 - Documento gerado para visualização
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsPreviewPage;
