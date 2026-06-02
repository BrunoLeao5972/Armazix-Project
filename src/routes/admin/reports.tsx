import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Eye, FileSpreadsheet, Printer, Star, Search, Package, Users, DollarSign, TrendingUp, Shield, Clock, Lock, X, Download, BarChart3, ShoppingCart, Receipt, History, AlertCircle, TrendingDown, Calendar, Percent, CreditCard, Tag, Store, Landmark, User, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/reports")({ component: ReportsPage, head: () => ({ meta: [{ title: "Central de Relatórios — ARMAZIX" }] }) });

type ModuloReport = "estoque" | "clientes" | "produtos" | "vendas" | "financeiro" | "fiscal" | "auditoria";
type UsoReport = "operacional" | "gerencial" | "fiscal" | "auditoria";
type Permissao = "admin" | "gerente" | "financeiro" | "vendedor" | "operador";
type TipoFiltro = "periodo" | "vendedor" | "cliente" | "fornecedor" | "produto" | "formaPagamento" | "status" | "canal" | "conta" | "historico";

interface ReportConfig { id: string; nome: string; descricao: string; modulo: ModuloReport; uso: UsoReport; permissao: Permissao[]; icone: React.ElementType; destaque?: boolean; filtrosDisponiveis?: TipoFiltro[]; }

// ============================================
// CATALOGO EXPANSÍVEL DE RELATÓRIOS ARMAZIX
// ============================================
const CATALOGO_RELATORIOS: ReportConfig[] = [
  // 📦 ESTOQUE & MOVIMENTAÇÃO
  { id: "est-001", nome: "Entrada de Mercadorias", descricao: "Relatório completo de todas as entradas no estoque com notas fiscais", modulo: "estoque", uso: "operacional", permissao: ["admin", "gerente", "operador"], icone: Package, filtrosDisponiveis: ["periodo", "fornecedor", "produto"] },
  { id: "est-002", nome: "Saída de Produtos", descricao: "Histórico detalhado de todas as saídas de estoque", modulo: "estoque", uso: "operacional", permissao: ["admin", "gerente", "operador"], icone: TrendingDown, filtrosDisponiveis: ["periodo", "vendedor", "produto", "status"] },
  { id: "est-003", nome: "Extrato e Inventário", descricao: "Posição atual do estoque com valorização", modulo: "estoque", uso: "operacional", permissao: ["admin", "gerente", "operador"], icone: FileText, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "est-004", nome: "Balanço de Estoque", descricao: "Comparativo teórico vs físico com ajustes", modulo: "estoque", uso: "gerencial", permissao: ["admin", "gerente"], icone: BarChart3, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "est-005", nome: "Produtos com Estoque Baixo", descricao: "Alerta de produtos abaixo do ponto de reposição", modulo: "estoque", uso: "operacional", permissao: ["admin", "gerente", "operador"], icone: AlertCircle, destaque: true },
  { id: "est-006", nome: "Produtos sem Movimentação", descricao: "Itens sem entrada ou saída no período analisado", modulo: "estoque", uso: "gerencial", permissao: ["admin", "gerente"], icone: Clock, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "est-007", nome: "Histórico de Movimentações", descricao: "Rastreabilidade completa de todas as movimentações", modulo: "estoque", uso: "operacional", permissao: ["admin", "gerente", "operador"], icone: History, filtrosDisponiveis: ["periodo", "produto", "vendedor"] },

  // 👥 CLIENTES & COMPORTAMENTO
  { id: "cli-001", nome: "Clientes Cadastrados", descricao: "Base completa de clientes ativos e inativos", modulo: "clientes", uso: "operacional", permissao: ["admin", "gerente", "vendedor"], icone: Users, filtrosDisponiveis: ["periodo", "status"] },
  { id: "cli-002", nome: "Clientes que Mais Compram", descricao: "Ranking de clientes por volume de compras", modulo: "clientes", uso: "gerencial", permissao: ["admin", "gerente"], icone: TrendingUp, destaque: true, filtrosDisponiveis: ["periodo"] },
  { id: "cli-003", nome: "Histórico de Compras por Cliente", descricao: "Detalhamento completo de compras individualizadas", modulo: "clientes", uso: "operacional", permissao: ["admin", "gerente", "vendedor"], icone: Receipt, filtrosDisponiveis: ["periodo", "cliente"] },
  { id: "cli-004", nome: "Clientes Inativos", descricao: "Clientes sem compras no período analisado", modulo: "clientes", uso: "gerencial", permissao: ["admin", "gerente"], icone: User, filtrosDisponiveis: ["periodo"] },
  { id: "cli-005", nome: "Aniversariantes do Período", descricao: "Lista de clientes fazendo aniversário para ações de marketing", modulo: "clientes", uso: "operacional", permissao: ["admin", "gerente", "vendedor"], icone: Calendar, filtrosDisponiveis: ["periodo"] },

  // 🏷️ CADASTRO DE PRODUTOS
  { id: "prod-001", nome: "Lista de Produtos", descricao: "Catálogo completo com preços e estoques", modulo: "produtos", uso: "operacional", permissao: ["admin", "gerente", "vendedor"], icone: Package, filtrosDisponiveis: ["produto", "status"] },
  { id: "prod-002", nome: "Produtos por Categoria", descricao: "Organização hierárquica por departamentos", modulo: "produtos", uso: "operacional", permissao: ["admin", "gerente", "vendedor"], icone: Tag, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "prod-003", nome: "Produtos Mais Lucrativos", descricao: "Ranking por margem de contribuição real", modulo: "produtos", uso: "gerencial", permissao: ["admin", "gerente"], icone: DollarSign, destaque: true, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "prod-004", nome: "Produtos com Baixa Margem", descricao: "Itens com margem abaixo do esperado", modulo: "produtos", uso: "gerencial", permissao: ["admin", "gerente"], icone: Percent, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "prod-005", nome: "Produtos sem Estoque", descricao: "Itens esgotados ou descontinuados", modulo: "produtos", uso: "operacional", permissao: ["admin", "gerente", "operador"], icone: AlertCircle, filtrosDisponiveis: ["produto"] },
  { id: "prod-006", nome: "Produtos com Maior Giro", descricao: "Itens mais vendidos por velocidade de rotatividade", modulo: "produtos", uso: "gerencial", permissao: ["admin", "gerente"], icone: TrendingUp, filtrosDisponiveis: ["periodo", "produto"] },

  // 📊 VENDAS & PDV
  { id: "vnd-001", nome: "Vendas por Período", descricao: "Consolidado completo de vendas diárias, semanais ou mensais", modulo: "vendas", uso: "gerencial", permissao: ["admin", "gerente"], icone: ShoppingCart, destaque: true, filtrosDisponiveis: ["periodo", "vendedor", "cliente", "formaPagamento", "canal", "status"] },
  { id: "vnd-002", nome: "Vendas por Produto", descricao: "Detalhamento de vendas por item com quantidades e valores", modulo: "vendas", uso: "operacional", permissao: ["admin", "gerente", "vendedor"], icone: Package, filtrosDisponiveis: ["periodo", "vendedor", "produto", "formaPagamento"] },
  { id: "vnd-003", nome: "Vendas por Cliente", descricao: "Análise de compras por cliente com ticket médio", modulo: "vendas", uso: "gerencial", permissao: ["admin", "gerente", "vendedor"], icone: User, filtrosDisponiveis: ["periodo", "cliente", "vendedor"] },
  { id: "vnd-004", nome: "Vendas por Forma de Pagamento", descricao: "Distribuição de vendas por meio de pagamento", modulo: "vendas", uso: "operacional", permissao: ["admin", "gerente", "financeiro"], icone: CreditCard, filtrosDisponiveis: ["periodo", "formaPagamento"] },
  { id: "vnd-005", nome: "Produtos Mais Vendidos", descricao: "Ranking de produtos por quantidade vendida", modulo: "vendas", uso: "gerencial", permissao: ["admin", "gerente", "vendedor"], icone: TrendingUp, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "vnd-006", nome: "Ticket Médio", descricao: "Análise do valor médio por venda e cliente", modulo: "vendas", uso: "gerencial", permissao: ["admin", "gerente"], icone: DollarSign, filtrosDisponiveis: ["periodo", "vendedor", "cliente"] },
  { id: "vnd-007", nome: "Cancelamentos e Devoluções", descricao: "Relatório de cancelamentos no PDV com motivos", modulo: "vendas", uso: "operacional", permissao: ["admin", "gerente"], icone: X, filtrosDisponiveis: ["periodo", "vendedor", "status"] },

  // 💰 FINANCEIRO INTEGRADO
  { id: "fin-001", nome: "Fluxo de Caixa", descricao: "Entradas e saídas com projeção de saldo", modulo: "financeiro", uso: "gerencial", permissao: ["admin", "gerente", "financeiro"], icone: DollarSign, destaque: true, filtrosDisponiveis: ["periodo", "conta", "historico"] },
  { id: "fin-002", nome: "Contas a Receber", descricao: "Títulos em aberto e recebidos por período", modulo: "financeiro", uso: "operacional", permissao: ["admin", "gerente", "financeiro"], icone: TrendingUp, filtrosDisponiveis: ["periodo", "cliente", "status", "historico"] },
  { id: "fin-003", nome: "Contas a Pagar", descricao: "Obrigações financeiras e vencimentos", modulo: "financeiro", uso: "operacional", permissao: ["admin", "gerente", "financeiro"], icone: TrendingDown, filtrosDisponiveis: ["periodo", "fornecedor", "status", "historico"] },
  { id: "fin-004", nome: "Inadimplência", descricao: "Clientes com pagamentos atrasados e valores", modulo: "financeiro", uso: "gerencial", permissao: ["admin", "gerente", "financeiro"], icone: AlertCircle, filtrosDisponiveis: ["periodo", "cliente", "status"] },
  { id: "fin-005", nome: "Lucro Bruto e Líquido", descricao: "Demonstrativo de resultados com margens", modulo: "financeiro", uso: "gerencial", permissao: ["admin", "gerente"], icone: BarChart3, destaque: true, filtrosDisponiveis: ["periodo", "historico"] },
  { id: "fin-006", nome: "Receitas e Despesas por Histórico", descricao: "Consolidado por árvore hierárquica de históricos contábeis", modulo: "financeiro", uso: "gerencial", permissao: ["admin", "gerente", "financeiro"], icone: Landmark, filtrosDisponiveis: ["periodo", "historico", "conta"] },

  // 🔐 FISCAL & OPERACIONAL
  { id: "fis-001", nome: "Notas Fiscais Emitidas", descricao: "NFe e NFCe com status de autorização", modulo: "fiscal", uso: "fiscal", permissao: ["admin", "gerente"], icone: Receipt, filtrosDisponiveis: ["periodo", "status", "cliente"] },
  { id: "fis-002", nome: "Operações por Usuário", descricao: "Atividades fiscais realizadas por cada operador", modulo: "fiscal", uso: "fiscal", permissao: ["admin", "gerente"], icone: Users, filtrosDisponiveis: ["periodo", "vendedor"] },

  // 🔍 AUDITORIA & SEGURANÇA
  { id: "aud-001", nome: "Fechamento Diário de Caixa", descricao: "Resumo de fechamentos de caixa por operador", modulo: "auditoria", uso: "auditoria", permissao: ["admin", "gerente"], icone: Lock, filtrosDisponiveis: ["periodo", "vendedor"] },
  { id: "aud-002", nome: "Logs de Alterações Críticas", descricao: "Rastreamento de alterações em valores, exclusões e estornos", modulo: "auditoria", uso: "auditoria", permissao: ["admin"], icone: Shield, destaque: true, filtrosDisponiveis: ["periodo", "vendedor", "status"] },
];

const MOCK_USUARIOS = [{ id: "usr_001", nome: "Carlos Silva", cargo: "Vendedor" }, { id: "usr_002", nome: "Ana Oliveira", cargo: "Caixa" }, { id: "usr_003", nome: "Pedro Costa", cargo: "Estoque" }, { id: "usr_004", nome: "Maria Santos", cargo: "Gerente" }, { id: "usr_005", nome: "João Pereira", cargo: "Financeiro" }];
const MOCK_CLIENTES = [{ id: "cli_001", nome: "João da Silva", doc: "123.456.789-00" }, { id: "cli_002", nome: "Maria Oliveira", doc: "987.654.321-00" }, { id: "cli_003", nome: "Restaurante Bom Sabor", doc: "12.345.678/0001-90" }, { id: "cli_004", nome: "Supermercado Central", doc: "98.765.432/0001-10" }];
const MOCK_FORNECEDORES = [{ id: "for_001", nome: "Distribuidora Silva", cnpj: "12.345.678/0001-90" }, { id: "for_002", nome: "Atacadão Paulista", cnpj: "98.765.432/0001-10" }, { id: "for_003", nome: "Importadora Olive", cnpj: "11.222.333/0001-44" }];
const MOCK_PRODUTOS = [{ id: "prod_001", nome: "Arroz Integral 5kg", codigo: "P001" }, { id: "prod_002", nome: "Feijão Carioca 1kg", codigo: "P002" }, { id: "prod_003", nome: "Azeite Extra Virgem 500ml", codigo: "P003" }];
const MOCK_CONTAS = [{ id: "conta_001", nome: "Caixa Interno PDV", tipo: "Caixa" }, { id: "conta_002", nome: "Banco do Brasil", tipo: "Banco" }, { id: "conta_003", nome: "Bradesco", tipo: "Banco" }];
const MOCK_HISTORICOS = [{ id: "1.01", nome: "RECEITAS OPERACIONAIS", nivel: 1 }, { id: "1.01.01", nome: "Vendas à Vista", nivel: 2 }, { id: "2.01", nome: "DESPESAS OPERACIONAIS", nivel: 1 }, { id: "2.01.01", nome: "Custo das Mercadorias", nivel: 2 }];
const TIPOS_DATA = [{ id: "emissao", nome: "Data de Emissão" }, { id: "vencimento", nome: "Data de Vencimento" }, { id: "recebimento", nome: "Data de Recebimento/Pagamento" }, { id: "inclusao", nome: "Data de Inclusão no Sistema" }];
const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Pix", "Boleto", "Transferência"];
const CANAIS = ["PDV - Balcão", "Delivery", "E-commerce", "WhatsApp"];
const STATUS_OPTIONS: Record<string, string[]> = { vendas: ["Emitida", "Cancelada", "Pendente"], financeiro: ["Em Aberto", "Pago", "Atrasado", "Cancelado"], fiscal: ["Autorizada", "Cancelada", "Denegada"], estoque: ["Venda", "Avaria", "Uso Interno", "Devolução"] };
const MODULOS_LABEL: Record<ModuloReport, { label: string; cor: string }> = { estoque: { label: "Estoque", cor: "text-emerald-600 bg-emerald-500/10" }, clientes: { label: "Clientes", cor: "text-blue-600 bg-blue-500/10" }, produtos: { label: "Produtos", cor: "text-violet-600 bg-violet-500/10" }, vendas: { label: "Vendas", cor: "text-amber-600 bg-amber-500/10" }, financeiro: { label: "Financeiro", cor: "text-rose-600 bg-rose-500/10" }, fiscal: { label: "Fiscal", cor: "text-slate-600 bg-slate-500/10" }, auditoria: { label: "Auditoria", cor: "text-red-600 bg-red-500/10" } };

function usePermissaoUsuario(): Permissao { return "admin"; }
function temPermissao(p: Permissao, req: Permissao[]): boolean { return req.includes(p); }
function ReportFilterDrawer({ report, isOpen, onClose }: { report: ReportConfig | null; isOpen: boolean; onClose: () => void }) {
  if (!isOpen || !report) return null;
  const [tipoData, setTipoData] = useState("emissao");
  const [dataDe, setDataDe] = useState("2026-06-01");
  const [horaDe, setHoraDe] = useState("00:00");
  const [dataAte, setDataAte] = useState("2026-06-02");
  const [horaAte, setHoraAte] = useState("23:59");
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [cliente, setCliente] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [conta, setConta] = useState("");
  const [historico, setHistorico] = useState("");
  const [formasPag, setFormasPag] = useState<string[]>([]);
  const [buscaUser, setBuscaUser] = useState("");
  const [buscaCli, setBuscaCli] = useState("");
  const [buscaForn, setBuscaForn] = useState("");

  const usersFiltered = MOCK_USUARIOS.filter(u => u.nome.toLowerCase().includes(buscaUser.toLowerCase()));
  const cliFiltered = MOCK_CLIENTES.filter(c => c.nome.toLowerCase().includes(buscaCli.toLowerCase()) || c.doc.includes(buscaCli));
  const fornFiltered = MOCK_FORNECEDORES.filter(f => f.nome.toLowerCase().includes(buscaForn.toLowerCase()));

  // Lógica condicional baseada no módulo do relatório
  const mostrarVendedor = report.modulo === "vendas" || report.modulo === "auditoria" || report.modulo === "estoque";
  const mostrarFornecedor = report.modulo === "financeiro" || report.modulo === "estoque";
  const mostrarFormaPagamento = report.modulo === "vendas";
  const mostrarHistorico = report.modulo === "financeiro";

  // Função para montar o payload da API
  const payload = () => ({
    idRelatorio: report.id,
    tipoData,
    dataInicio: `${dataDe}T${horaDe}:00Z`,
    dataFim: `${dataAte}T${horaAte}:59Z`,
    filtrosEspecificos: {
      idVendedor: vendedores.length ? vendedores : null,
      idCliente: cliente || null,
      idFornecedor: fornecedor || null,
      idConta: conta || null,
      idHistorico: historico || null,
      formaPagto: formasPag.length ? formasPag : null,
    },
  });

  const gerarRelatorio = () => {
    console.log("Payload para API:", payload());
    // Aqui você chamaria a API real
    // api.post('/relatorios/gerar', payload());
  };

  const limpar = () => {
    setTipoData("emissao");
    setDataDe("2026-06-01");
    setDataAte("2026-06-02");
    setHoraDe("00:00");
    setHoraAte("23:59");
    setVendedores([]);
    setCliente("");
    setFornecedor("");
    setConta("");
    setHistorico("");
    setFormasPag([]);
    setBuscaUser("");
    setBuscaCli("");
    setBuscaForn("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-end" onClick={onClose}>
      <div className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col rounded-l-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div><h2 className="text-lg font-semibold">Filtros Avançados</h2><p className="text-xs text-muted-foreground">{report.nome}</p></div>
          <div className="flex items-center gap-2"><button onClick={limpar} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-secondary">Limpar Filtros</button><button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button></div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Calendar className="w-4 h-4" /> Período de Análise</div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Filtrar por</label>
              <select value={tipoData} onChange={e => setTipoData(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-white text-sm focus:ring-2 focus:ring-primary/20">
                <option value="emissao">Data de Emissão</option>
                <option value="vencimento">Data de Vencimento</option>
                <option value="recebimento">Data de Recebimento/Pagamento</option>
                <option value="inclusao">Data de Inclusão no Sistema</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">De</label><div className="flex gap-2"><input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} className="flex-1 h-10 px-3 rounded-xl border bg-white text-sm" /><div className="relative w-24"><Clock className="w-3.5 h-3.5 absolute left-3 top-3.5 text-muted-foreground" /><input type="time" value={horaDe} onChange={e => setHoraDe(e.target.value)} className="w-full h-10 pl-9 pr-2 rounded-xl border bg-white text-sm" /></div></div></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Até</label><div className="flex gap-2"><input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} className="flex-1 h-10 px-3 rounded-xl border bg-white text-sm" /><div className="relative w-24"><Clock className="w-3.5 h-3.5 absolute left-3 top-3.5 text-muted-foreground" /><input type="time" value={horaAte} onChange={e => setHoraAte(e.target.value)} className="w-full h-10 pl-9 pr-2 rounded-xl border bg-white text-sm" /></div></div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mostrarVendedor && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Vendedor/Operador</label>
                <div className="relative"><input type="text" placeholder="Buscar usuário..." value={buscaUser} onChange={e => setBuscaUser(e.target.value)} className="w-full h-10 px-3 pl-9 rounded-xl border bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" /><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /></div>
                {buscaUser && <div className="max-h-32 overflow-y-auto border rounded-lg bg-white">{usersFiltered.map(u => <div key={u.id} onClick={() => { if (!vendedores.includes(u.id)) setVendedores([...vendedores, u.id]); setBuscaUser(""); }} className="p-2 hover:bg-secondary cursor-pointer text-sm flex justify-between"><span>{u.nome}</span><span className="text-xs text-muted-foreground">{u.cargo}</span></div>)}</div>}
                {vendedores.length > 0 && <div className="flex flex-wrap gap-1">{vendedores.map(id => { const u = MOCK_USUARIOS.find(x => x.id === id); return u ? <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs">{u.nome}<button onClick={() => setVendedores(vendedores.filter(x => x !== id))} className="hover:text-red-500"><X className="w-3 h-3" /></button></span> : null; })}</div>}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Cliente</label>
              <div className="relative"><input type="text" placeholder="Buscar por nome ou CPF/CNPJ..." value={buscaCli} onChange={e => setBuscaCli(e.target.value)} className="w-full h-10 px-3 pl-9 rounded-xl border bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" /><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /></div>
              {buscaCli && <div className="max-h-32 overflow-y-auto border rounded-lg bg-white">{cliFiltered.map(c => <div key={c.id} onClick={() => { setCliente(c.id); setBuscaCli(""); }} className="p-2 hover:bg-secondary cursor-pointer text-sm"><p className="font-medium">{c.nome}</p><p className="text-xs text-muted-foreground">{c.doc}</p></div>)}</div>}
              {cliente && <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg"><span className="text-sm font-medium">{MOCK_CLIENTES.find(c => c.id === cliente)?.nome}</span><button onClick={() => setCliente("")} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></div>}
            </div>
            {mostrarFornecedor && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Fornecedor/Favorecido</label>
                <div className="relative"><input type="text" placeholder="Buscar fornecedor..." value={buscaForn} onChange={e => setBuscaForn(e.target.value)} className="w-full h-10 px-3 pl-9 rounded-xl border bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" /><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /></div>
                {buscaForn && <div className="max-h-32 overflow-y-auto border rounded-lg bg-white">{fornFiltered.map(f => <div key={f.id} onClick={() => { setFornecedor(f.id); setBuscaForn(""); }} className="p-2 hover:bg-secondary cursor-pointer text-sm"><p className="font-medium">{f.nome}</p><p className="text-xs text-muted-foreground">{f.cnpj}</p></div>)}</div>}
                {fornecedor && <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg"><span className="text-sm font-medium">{MOCK_FORNECEDORES.find(f => f.id === fornecedor)?.nome}</span><button onClick={() => setFornecedor("")} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></div>}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Landmark className="w-3 h-3" /> Conta Bancária</label>
              <select value={conta} onChange={e => setConta(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm">
                <option value="">Selecione uma conta</option>
                {MOCK_CONTAS.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
              </select>
            </div>
            {mostrarFormaPagamento && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Forma de Pagamento</label>
                <div className="flex flex-wrap gap-2">{FORMAS_PAGAMENTO.map(f => <button key={f} onClick={() => formasPag.includes(f) ? setFormasPag(formasPag.filter(x => x !== f)) : setFormasPag([...formasPag, f])} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${formasPag.includes(f) ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-secondary text-muted-foreground border border-border hover:bg-secondary/80'}`}>{f}</button>)}</div>
              </div>
            )}
            {mostrarHistorico && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Histórico Estruturado</label>
                <select value={historico} onChange={e => setHistorico(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm">
                  <option value="">Selecione um histórico</option>
                  {MOCK_HISTORICOS.map(h => <option key={h.id} value={h.id}>{h.id} | {h.nome.toUpperCase()}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t bg-white"><Button onClick={gerarRelatorio} className="w-full h-12 rounded-2xl text-base font-semibold bg-gradient-primary text-primary-foreground"><Search className="w-4 h-4 mr-2" /> Gerar Relatório</Button></div>
      </div>
    </div>
  );
}

function ReportCard({ report, isFavorito, onToggleFavorito, onVisualizar, isLocked }: { report: ReportConfig; isFavorito: boolean; onToggleFavorito: () => void; onVisualizar: () => void; isLocked?: boolean; }) {
  const Icon = report.icone;
  const moduloStyle = MODULOS_LABEL[report.modulo];
  if (isLocked) {
    return (<div className="group relative p-4 rounded-2xl border border-border/50 bg-secondary/30 opacity-60"><div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-xl ${moduloStyle.cor} flex items-center justify-center shrink-0`}><Lock className="w-4 h-4" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h4 className="font-semibold text-sm text-slate-600 truncate">{report.nome}</h4><Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md shrink-0">{moduloStyle.label}</Badge></div><p className="text-xs text-muted-foreground mt-1 line-clamp-2">Acesso restrito</p></div></div></div>);
  }
  return (<div className="group relative p-4 rounded-2xl border border-border/50 bg-white hover:border-primary/30 hover:shadow-soft transition-all"><div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-xl ${moduloStyle.cor} flex items-center justify-center shrink-0`}><Icon className="w-4 h-4" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h4 className="font-semibold text-sm text-slate-700 truncate">{report.nome}</h4>{report.destaque && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}</div><p className="text-xs text-muted-foreground mt-1 line-clamp-2">{report.descricao}</p><div className="flex items-center gap-1.5 mt-2"><Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md">{moduloStyle.label}</Badge><Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">{report.uso}</Badge></div></div><button onClick={onToggleFavorito} className={`p-1.5 rounded-lg transition-colors ${isFavorito ? "text-amber-400" : "text-slate-300 hover:text-amber-400"}`}><Star className={`w-4 h-4 ${isFavorito ? "fill-amber-400" : ""}`} /></button></div><div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={onVisualizar} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"><Eye className="w-3.5 h-3.5" /> Ver</button><button onClick={() => alert(`Exportando ${report.nome} em PDF...`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"><FileText className="w-3.5 h-3.5" /> PDF</button><button onClick={() => alert(`Exportando ${report.nome} em Excel...`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</button><button onClick={() => alert(`Imprimindo ${report.nome}...`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"><Printer className="w-3.5 h-3.5" /> Print</button></div></div>);
}

// Mock de emissões nas últimas 24h (simulado - virá do backend)
const EMISSOES_24H = 12;

function ReportsPage() {
  const permissaoUsuario = usePermissaoUsuario();
  const [busca, setBusca] = useState("");
  const [filtroModulo, setFiltroModulo] = useState<ModuloReport | "todos">("todos");
  const [filtroUso, setFiltroUso] = useState<UsoReport | "todos">("todos");
  const [favoritos, setFavoritos] = useState<string[]>(() => { if (typeof window !== "undefined") { const saved = localStorage.getItem("armazix-reports-favoritos"); return saved ? JSON.parse(saved) : []; } return []; });
  const [reportSelecionado, setReportSelecionado] = useState<ReportConfig | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ultimoRelatorio, setUltimoRelatorio] = useState<ReportConfig | null>(null);

  useEffect(() => { if (typeof window !== "undefined") { localStorage.setItem("armazix-reports-favoritos", JSON.stringify(favoritos)); } }, [favoritos]);

  const toggleFavorito = (id: string) => { setFavoritos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const abrirDrawer = (report: ReportConfig) => {
    setReportSelecionado(report);
    setUltimoRelatorio(report);
    setDrawerOpen(true);
  };

  const scrollToFavoritos = () => {
    const element = document.getElementById("secao-favoritos");
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToUltimo = () => {
    if (ultimoRelatorio) abrirDrawer(ultimoRelatorio);
  };

  // Filtrar relatórios disponíveis para o usuário
  const relatoriosPermitidos = useMemo(() =>
    CATALOGO_RELATORIOS.filter(r => temPermissao(permissaoUsuario, r.permissao)),
    [permissaoUsuario]
  );

  const relatoriosFiltrados = useMemo(() => {
    return relatoriosPermitidos.filter(r => {
      if (busca && !r.nome.toLowerCase().includes(busca.toLowerCase()) && !r.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroModulo !== "todos" && r.modulo !== filtroModulo) return false;
      if (filtroUso !== "todos" && r.uso !== filtroUso) return false;
      return true;
    });
  }, [busca, filtroModulo, filtroUso, relatoriosPermitidos]);

  const favoritosList = useMemo(() =>
    CATALOGO_RELATORIOS.filter(r => favoritos.includes(r.id) && temPermissao(permissaoUsuario, r.permissao)),
    [favoritos, permissaoUsuario]
  );

  const destaques = useMemo(() =>
    CATALOGO_RELATORIOS.filter(r => r.destaque && temPermissao(permissaoUsuario, r.permissao)).slice(0, 3),
    [permissaoUsuario]
  );

  // Agrupar relatórios por módulo
  const relatoriosPorModulo = useMemo(() => {
    const grupos: Record<ModuloReport, ReportConfig[]> = {
      estoque: [], clientes: [], produtos: [], vendas: [], financeiro: [], fiscal: [], auditoria: []
    };
    relatoriosFiltrados.forEach(r => { if (grupos[r.modulo]) grupos[r.modulo].push(r); });
    return grupos;
  }, [relatoriosFiltrados]);

  const modulosOrdenados: { id: ModuloReport; label: string; icone: React.ElementType; cor: string }[] = [
    { id: "vendas", label: "📊 Vendas & PDV", icone: ShoppingCart, cor: "text-amber-600" },
    { id: "financeiro", label: "💰 Financeiro Integrado", icone: DollarSign, cor: "text-rose-600" },
    { id: "estoque", label: "📦 Estoque & Movimentação", icone: Package, cor: "text-emerald-600" },
    { id: "produtos", label: "🏷️ Cadastro de Produtos", icone: Tag, cor: "text-violet-600" },
    { id: "clientes", label: "👥 Clientes & Comportamento", icone: Users, cor: "text-blue-600" },
    { id: "fiscal", label: "🔐 Fiscal & Operacional", icone: Receipt, cor: "text-slate-600" },
    { id: "auditoria", label: "🔍 Auditoria & Segurança", icone: Shield, cor: "text-red-600" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Central de Relatórios</h1>
            <p className="text-sm text-muted-foreground mt-1">Análises e dados estratégicos do seu negócio</p>
          </div>
        </div>

        {/* Drawer de Filtros */}
        <ReportFilterDrawer report={reportSelecionado} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

        {/* KPI Cards - Indicadores Rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total de relatórios disponíveis */}
          <Card className="rounded-2xl border-border/50 bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><FileText className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{relatoriosPermitidos.length}</p>
                  <p className="text-xs text-muted-foreground">Relatórios Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Último relatório gerado */}
          <Card className="rounded-2xl border-border/50 bg-white hover:shadow-md transition-shadow cursor-pointer" onClick={scrollToUltimo}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><History className="w-5 h-5 text-blue-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{ultimoRelatorio ? ultimoRelatorio.nome : "Nenhum ainda"}</p>
                  <p className="text-xs text-muted-foreground">{ultimoRelatorio ? "Clique para reabrir" : "Último Relatório Gerado"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Atalho para favoritos */}
          <Card className="rounded-2xl border-border/50 bg-white hover:shadow-md transition-shadow cursor-pointer" onClick={scrollToFavoritos}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Star className="w-5 h-5 text-amber-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{favoritosList.length}</p>
                  <p className="text-xs text-muted-foreground">⭐ Relatórios Favoritos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Emissões nas últimas 24h */}
          <Card className="rounded-2xl border-border/50 bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-violet-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{EMISSOES_24H}</p>
                  <p className="text-xs text-muted-foreground">Emissões (24h)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Controle Superior */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input placeholder="Buscar relatórios por nome, descrição ou palavras-chave..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-10 rounded-xl" />
              </div>
              <div className="flex gap-2">
                <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value as ModuloReport | "todos")} className="h-10 px-3 rounded-xl border bg-white text-sm focus:ring-2 focus:ring-primary/20">
                  <option value="todos">📁 Todos os Módulos</option>
                  <option value="estoque">📦 Estoque</option>
                  <option value="clientes">👥 Clientes</option>
                  <option value="produtos">🏷️ Produtos</option>
                  <option value="vendas">📊 Vendas</option>
                  <option value="financeiro">💰 Financeiro</option>
                  <option value="fiscal">🔐 Fiscal</option>
                  <option value="auditoria">🔍 Auditoria</option>
                </select>
                <select value={filtroUso} onChange={e => setFiltroUso(e.target.value as UsoReport | "todos")} className="h-10 px-3 rounded-xl border bg-white text-sm focus:ring-2 focus:ring-primary/20">
                  <option value="todos">🎯 Todos os Tipos</option>
                  <option value="operacional">⚙️ Operacional</option>
                  <option value="gerencial">📈 Gerencial</option>
                  <option value="fiscal">📋 Fiscal</option>
                  <option value="auditoria">🛡️ Auditoria</option>
                </select>
                {favoritosList.length > 0 && (
                  <Button variant="outline" onClick={scrollToFavoritos} className="h-10 px-3 rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50">
                    <Star className="w-4 h-4 mr-1 fill-amber-400" /> {favoritosList.length}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Destaques */}
        {destaques.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h2 className="text-lg font-semibold">Relatórios em Destaque</h2>
              <Badge variant="secondary" className="rounded-lg ml-2">Recomendados</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {destaques.map(report => (
                <ReportCard key={report.id} report={report} isFavorito={favoritos.includes(report.id)} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => abrirDrawer(report)} />
              ))}
            </div>
          </div>
        )}

        {/* Seção de Favoritos */}
        {favoritosList.length > 0 && (
          <div id="secao-favoritos" className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <h2 className="text-lg font-semibold">⭐ Relatórios Mais Utilizados</h2>
              <Badge variant="secondary" className="rounded-lg ml-2 bg-amber-100 text-amber-700">{favoritosList.length} favoritos</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoritosList.map(report => (
                <ReportCard key={report.id} report={report} isFavorito={true} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => abrirDrawer(report)} />
              ))}
            </div>
          </div>
        )}

        {/* Categorias de Relatórios por Módulo */}
        {filtroModulo === "todos" ? (
          // Mostrar seções por módulo quando não há filtro específico
          modulosOrdenados.map(({ id, label, icone: ModIcon, cor }) => {
            const relatoriosModulo = relatoriosPorModulo[id];
            if (relatoriosModulo.length === 0) return null;
            return (
              <div key={id} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <ModIcon className={`w-5 h-5 ${cor}`} />
                  <h2 className="text-lg font-semibold text-slate-800">{label}</h2>
                  <Badge variant="secondary" className="rounded-lg ml-2">{relatoriosModulo.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {relatoriosModulo.map(report => (
                    <ReportCard key={report.id} report={report} isFavorito={favoritos.includes(report.id)} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => abrirDrawer(report)} />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Mostrar grid simples quando há filtro específico
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Relatórios Encontrados</h2>
              <Badge variant="secondary" className="rounded-lg">{relatoriosFiltrados.length} resultados</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {relatoriosFiltrados.map(report => (
                <ReportCard key={report.id} report={report} isFavorito={favoritos.includes(report.id)} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => abrirDrawer(report)} />
              ))}
            </div>
          </div>
        )}

        {/* Mensagem se não houver resultados */}
        {relatoriosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum relatório encontrado para os filtros selecionados.</p>
            <Button variant="outline" onClick={() => { setBusca(""); setFiltroModulo("todos"); setFiltroUso("todos"); }} className="mt-4 rounded-xl">Limpar Filtros</Button>
          </div>
        )}
      </div>
    </div>
  );
}


