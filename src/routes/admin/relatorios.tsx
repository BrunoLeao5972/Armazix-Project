import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Eye, FileSpreadsheet, Printer, Star, Search, Package, Users, DollarSign, TrendingUp, Shield, Clock, Lock, X, Download, BarChart3, ShoppingCart, Receipt, History, AlertCircle, TrendingDown, Calendar, Percent, CreditCard, Tag, Store, Landmark, User, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResultadoRelatorioModal, RELATORIOS_IMPLEMENTADOS, DEFAULT_FILTROS,
  type FiltrosDrawer,
} from "./-modal-resultado-relatorio";
import { REPORT_REQUIRED_ROLES, temPermissao, type Permissao, type StoreRole } from "@/lib/reports-permissions";

export const Route = createFileRoute("/admin/relatorios")({ component: ReportsPage, head: () => ({ meta: [{ title: "Central de Relatórios — ARMAZIX" }] }) });

type ModuloReport = "estoque" | "clientes" | "produtos" | "vendas" | "financeiro" | "fiscal" | "auditoria";
type UsoReport = "operacional" | "gerencial" | "fiscal" | "auditoria";
type TipoFiltro = "periodo" | "vendedor" | "cliente" | "fornecedor" | "produto" | "formaPagamento" | "status" | "canal" | "conta" | "historico";

interface ReportConfig { id: string; nome: string; descricao: string; modulo: ModuloReport; uso: UsoReport; permissao: readonly Permissao[]; icone: React.ElementType; destaque?: boolean; filtrosDisponiveis?: TipoFiltro[]; }

// ============================================
// CATALOGO EXPANSÍVEL DE RELATÓRIOS ARMAZIX
// ============================================
const CATALOGO_RELATORIOS: ReportConfig[] = [
  // 📦 ESTOQUE & MOVIMENTAÇÃO
  { id: "est-001", nome: "Entrada de Mercadorias", descricao: "Relatório completo de todas as entradas no estoque com notas fiscais", modulo: "estoque", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["est-001"], icone: Package, filtrosDisponiveis: ["periodo", "fornecedor", "produto"] },
  { id: "est-002", nome: "Saída de Produtos", descricao: "Histórico detalhado de todas as saídas de estoque", modulo: "estoque", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["est-002"], icone: TrendingDown, filtrosDisponiveis: ["periodo", "vendedor", "produto"] },
  { id: "est-003", nome: "Extrato e Inventário", descricao: "Posição atual do estoque com valorização", modulo: "estoque", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["est-003"], icone: FileText, filtrosDisponiveis: ["produto"] },
  { id: "est-004", nome: "Balanço de Estoque", descricao: "Comparativo teórico vs físico com ajustes", modulo: "estoque", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["est-004"], icone: BarChart3, filtrosDisponiveis: ["periodo"] },
  { id: "est-005", nome: "Produtos com Estoque Baixo", descricao: "Alerta de produtos abaixo do ponto de reposição", modulo: "estoque", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["est-005"], icone: AlertCircle, destaque: true },
  { id: "est-006", nome: "Produtos sem Movimentação", descricao: "Itens sem entrada ou saída no período analisado", modulo: "estoque", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["est-006"], icone: Clock, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "est-007", nome: "Histórico de Movimentações", descricao: "Rastreabilidade completa de todas as movimentações", modulo: "estoque", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["est-007"], icone: History, filtrosDisponiveis: ["periodo", "produto", "vendedor"] },

  // 👥 CLIENTES & COMPORTAMENTO
  { id: "cli-001", nome: "Clientes Cadastrados", descricao: "Base completa de clientes ativos e inativos", modulo: "clientes", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["cli-001"], icone: Users, filtrosDisponiveis: ["periodo", "status"] },
  { id: "cli-002", nome: "Clientes que Mais Compram", descricao: "Ranking de clientes por volume de compras", modulo: "clientes", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["cli-002"], icone: TrendingUp, destaque: true, filtrosDisponiveis: ["periodo"] },
  { id: "cli-003", nome: "Histórico de Compras por Cliente", descricao: "Detalhamento completo de compras individualizadas", modulo: "clientes", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["cli-003"], icone: Receipt, filtrosDisponiveis: ["periodo", "cliente"] },
  { id: "cli-004", nome: "Clientes Inativos", descricao: "Clientes sem compras no período analisado", modulo: "clientes", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["cli-004"], icone: User, filtrosDisponiveis: ["periodo"] },
  // cli-005 (Aniversariantes) fica fora do catálogo visível — customers não
  // tem campo de data de nascimento, e não existe formulário nenhum (loja
  // pública ou admin) que colete isso hoje. Adicionar seria feature nova
  // (migração de schema + UI de captura), não "fazer o relatório funcionar".

  // 🏷️ CADASTRO DE PRODUTOS
  { id: "prod-001", nome: "Lista de Produtos", descricao: "Catálogo completo com preços e estoques", modulo: "produtos", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["prod-001"], icone: Package, filtrosDisponiveis: ["produto", "status"] },
  { id: "prod-002", nome: "Produtos por Categoria", descricao: "Organização hierárquica por departamentos", modulo: "produtos", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["prod-002"], icone: Tag },
  { id: "prod-003", nome: "Produtos Mais Lucrativos", descricao: "Ranking por margem de contribuição real", modulo: "produtos", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["prod-003"], icone: DollarSign, destaque: true, filtrosDisponiveis: ["periodo"] },
  { id: "prod-004", nome: "Produtos com Baixa Margem", descricao: "Itens com margem abaixo do esperado", modulo: "produtos", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["prod-004"], icone: Percent, filtrosDisponiveis: ["produto"] },
  { id: "prod-005", nome: "Produtos sem Estoque", descricao: "Itens esgotados ou descontinuados", modulo: "produtos", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["prod-005"], icone: AlertCircle, filtrosDisponiveis: ["produto"] },
  { id: "prod-006", nome: "Produtos com Maior Giro", descricao: "Itens mais vendidos por velocidade de rotatividade", modulo: "produtos", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["prod-006"], icone: TrendingUp, filtrosDisponiveis: ["periodo", "produto"] },

  // 📊 VENDAS & PDV
  { id: "vnd-001", nome: "Vendas por Período", descricao: "Consolidado completo de vendas diárias, semanais ou mensais", modulo: "vendas", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["vnd-001"], icone: ShoppingCart, destaque: true, filtrosDisponiveis: ["periodo", "cliente", "formaPagamento", "status"] },
  { id: "vnd-002", nome: "Vendas por Produto", descricao: "Detalhamento de vendas por item com quantidades e valores", modulo: "vendas", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["vnd-002"], icone: Package, filtrosDisponiveis: ["periodo", "vendedor", "produto", "formaPagamento"] },
  { id: "vnd-003", nome: "Vendas por Cliente", descricao: "Análise de compras por cliente com ticket médio", modulo: "vendas", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["vnd-003"], icone: User, filtrosDisponiveis: ["periodo", "cliente", "vendedor"] },
  { id: "vnd-004", nome: "Vendas por Forma de Pagamento", descricao: "Distribuição de vendas por meio de pagamento", modulo: "vendas", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["vnd-004"], icone: CreditCard, filtrosDisponiveis: ["periodo", "formaPagamento"] },
  { id: "vnd-005", nome: "Produtos Mais Vendidos", descricao: "Ranking de produtos por quantidade vendida", modulo: "vendas", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["vnd-005"], icone: TrendingUp, filtrosDisponiveis: ["periodo", "produto"] },
  { id: "vnd-006", nome: "Ticket Médio", descricao: "Análise do valor médio por venda e cliente", modulo: "vendas", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["vnd-006"], icone: DollarSign, filtrosDisponiveis: ["periodo", "vendedor", "cliente"] },
  { id: "vnd-007", nome: "Cancelamentos e Devoluções", descricao: "Relatório de cancelamentos no PDV com motivos", modulo: "vendas", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["vnd-007"], icone: X, filtrosDisponiveis: ["periodo", "status"] },

  // 💰 FINANCEIRO INTEGRADO
  { id: "fin-001", nome: "Fluxo de Caixa", descricao: "Entradas e saídas com projeção de saldo", modulo: "financeiro", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["fin-001"], icone: DollarSign, destaque: true, filtrosDisponiveis: ["periodo", "historico"] },
  { id: "fin-002", nome: "Contas a Receber", descricao: "Títulos em aberto e recebidos por período", modulo: "financeiro", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["fin-002"], icone: TrendingUp, filtrosDisponiveis: ["periodo", "cliente", "status", "historico"] },
  { id: "fin-003", nome: "Contas a Pagar", descricao: "Obrigações financeiras e vencimentos", modulo: "financeiro", uso: "operacional", permissao: REPORT_REQUIRED_ROLES["fin-003"], icone: TrendingDown, filtrosDisponiveis: ["periodo", "status", "historico"] },
  { id: "fin-004", nome: "Inadimplência", descricao: "Clientes com pagamentos atrasados e valores", modulo: "financeiro", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["fin-004"], icone: AlertCircle, filtrosDisponiveis: ["periodo", "cliente"] },
  { id: "fin-005", nome: "Lucro Bruto e Líquido", descricao: "Demonstrativo de resultados com margens", modulo: "financeiro", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["fin-005"], icone: BarChart3, destaque: true, filtrosDisponiveis: ["periodo", "historico"] },
  { id: "fin-006", nome: "Receitas e Despesas por Histórico", descricao: "Consolidado por árvore hierárquica de históricos contábeis", modulo: "financeiro", uso: "gerencial", permissao: REPORT_REQUIRED_ROLES["fin-006"], icone: Landmark, filtrosDisponiveis: ["periodo", "historico"] },

  // 🔐 FISCAL & OPERACIONAL — fora do catálogo visível: não existe NENHUMA
  // tabela de nota fiscal/NFe/NFCe no schema hoje. Exigiria integração com
  // SEFAZ (emissão, autorização, XML/DANFE) — projeto à parte, não uma
  // query faltando. fis-001/fis-002 removidos daqui até essa integração existir.

  // 🔍 AUDITORIA & SEGURANÇA
  { id: "aud-001", nome: "Fechamento Diário de Caixa", descricao: "Resumo de fechamentos de caixa por operador", modulo: "auditoria", uso: "auditoria", permissao: REPORT_REQUIRED_ROLES["aud-001"], icone: Lock, filtrosDisponiveis: ["periodo", "vendedor"] },
  { id: "aud-002", nome: "Logs de Alterações Críticas", descricao: "Rastreamento de alterações em valores, exclusões e estornos", modulo: "auditoria", uso: "auditoria", permissao: REPORT_REQUIRED_ROLES["aud-002"], icone: Shield, destaque: true, filtrosDisponiveis: ["periodo", "vendedor", "status"] },
];

// "Conta Bancária" continua mock — não existe tabela de conta bancária no
// schema, então nenhum relatório real consegue filtrar por isso (fin-006
// abandonou esse filtro por causa disso). "Fornecedor" e "Produto" agora
// buscam dado real (ver mostrarFornecedor/mostrarProduto no drawer abaixo).
const MOCK_CONTAS: { id: string; nome: string; tipo: string }[] = [];
// Valores reais aceitos pelo backend — não são só rótulos de exibição.
const PAYMENT_METHOD_OPTIONS = [{ key: "pix", label: "PIX" }, { key: "card", label: "Cartão" }, { key: "cash", label: "Dinheiro" }];
const ORDER_STATUS_OPTIONS = [{ key: "received", label: "Recebido" }, { key: "preparing", label: "Preparando" }, { key: "ready", label: "Pronto" }, { key: "delivering", label: "Em entrega" }, { key: "delivered", label: "Entregue" }, { key: "cancelled", label: "Cancelado" }];
const AUDIT_STATUS_OPTIONS = [{ key: "success", label: "Sucesso" }, { key: "failure", label: "Falha" }, { key: "denied", label: "Negado" }];
const ATIVO_INATIVO_OPTIONS = [{ key: "ativo", label: "Ativo" }, { key: "inativo", label: "Inativo" }];
const CANCELAMENTO_DEVOLUCAO_OPTIONS = [{ key: "cancelled", label: "Cancelado" }, { key: "refunded", label: "Devolvido" }];
const LANCAMENTO_STATUS_OPTIONS = [{ key: "liquidado", label: "Liquidado" }, { key: "pendente", label: "Pendente" }];
// "status" significa coisas diferentes por relatório — chave por id em vez
// de inferir pelo módulo (ex: dentro do mesmo módulo "vendas", vnd-001 é
// status de pedido e vnd-007 é cancelado/devolvido).
const STATUS_OPTIONS_POR_RELATORIO: Record<string, { key: string; label: string }[]> = {
  "aud-002": AUDIT_STATUS_OPTIONS,
  "cli-001": ATIVO_INATIVO_OPTIONS,
  "prod-001": ATIVO_INATIVO_OPTIONS,
  "vnd-001": ORDER_STATUS_OPTIONS,
  "vnd-007": CANCELAMENTO_DEVOLUCAO_OPTIONS,
  "fin-002": LANCAMENTO_STATUS_OPTIONS,
  "fin-003": LANCAMENTO_STATUS_OPTIONS,
};
const MODULOS_LABEL: Record<ModuloReport, { label: string; cor: string }> = { estoque: { label: "Estoque", cor: "text-emerald-600 bg-emerald-500/10" }, clientes: { label: "Clientes", cor: "text-blue-600 bg-blue-500/10" }, produtos: { label: "Produtos", cor: "text-violet-600 bg-violet-500/10" }, vendas: { label: "Vendas", cor: "text-amber-600 bg-amber-500/10" }, financeiro: { label: "Financeiro", cor: "text-rose-600 bg-rose-500/10" }, fiscal: { label: "Fiscal", cor: "text-muted-foreground bg-slate-500/10" }, auditoria: { label: "Auditoria", cor: "text-red-600 bg-red-500/10" } };

// Busca o papel real do usuário logado nesta loja (storeUsers.role) — antes
// disso era um stub que sempre devolvia "admin", então o filtro de UI nunca
// escondia nada (auditoria de segurança, achado F2). null enquanto carrega
// OU se a request falhar: trata como sem permissão, nunca como "admin" por
// default.
function useStoreRole(): StoreRole | null {
  const [storeRole, setStoreRole] = useState<StoreRole | null>(null);
  useEffect(() => {
    let cancelado = false;
    fetch("/api/store/user").then(r => r.json())
      .then((d: { storeRole?: StoreRole }) => { if (!cancelado) setStoreRole(d.storeRole ?? null); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);
  return storeRole;
}

function hojeISO(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

function ReportFilterDrawer({
  report, isOpen, onClose, onGerar,
}: {
  report: ReportConfig | null; isOpen: boolean; onClose: () => void;
  onGerar: (filtros: FiltrosDrawer) => void;
}) {
  const [dataDe, setDataDe] = useState(hojeISO(-30));
  const [dataAte, setDataAte] = useState(hojeISO());
  const [usuarioId, setUsuarioId] = useState("");
  const [cliente, setCliente] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [produto, setProduto] = useState("");
  const [conta, setConta] = useState("");
  const [historico, setHistorico] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [status, setStatus] = useState("");
  const [buscaUser, setBuscaUser] = useState("");
  const [buscaCli, setBuscaCli] = useState("");
  const [buscaForn, setBuscaForn] = useState("");
  const [buscaProd, setBuscaProd] = useState("");

  // Dados reais dos combos — buscados sob demanda, só quando o bloco
  // correspondente é realmente exibido pra esse relatório.
  const [usuarios, setUsuarios] = useState<{ userId: string; name: string }[]>([]);
  const [clientesEncontrados, setClientesEncontrados] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [fornecedoresEncontrados, setFornecedoresEncontrados] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [produtosEncontrados, setProdutosEncontrados] = useState<{ id: string; name: string; sku: string | null }[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);

  const mostrarUsuario = report?.filtrosDisponiveis?.includes("vendedor") ?? false;
  const mostrarCliente = report?.filtrosDisponiveis?.includes("cliente") ?? false;
  const mostrarFornecedor = report?.filtrosDisponiveis?.includes("fornecedor") ?? false;
  const mostrarProduto = report?.filtrosDisponiveis?.includes("produto") ?? false;
  const mostrarConta = report?.filtrosDisponiveis?.includes("conta") ?? false;
  const mostrarFormaPagamento = report?.filtrosDisponiveis?.includes("formaPagamento") ?? false;
  const mostrarHistorico = report?.filtrosDisponiveis?.includes("historico") ?? false;
  const mostrarStatus = report?.filtrosDisponiveis?.includes("status") ?? false;
  // "status" significa coisas diferentes conforme o relatório — não dá pra
  // inferir só pelo módulo (ex: "produtos" e "clientes" usam ativo/inativo,
  // "vendas" às vezes é pedido e às vezes é cancelado/devolvido).
  const statusOptions = STATUS_OPTIONS_POR_RELATORIO[report?.id ?? ""] ?? ORDER_STATUS_OPTIONS;

  useEffect(() => {
    if (!isOpen || !mostrarUsuario) return;
    fetch("/api/store-users/list").then(r => r.json())
      .then((d: { users?: { userId: string; name: string }[] }) => setUsuarios(d.users ?? []))
      .catch(() => {});
  }, [isOpen, mostrarUsuario]);

  useEffect(() => {
    if (!isOpen || !mostrarHistorico) return;
    fetch("/api/reports/categorias-financeiro").then(r => r.json())
      .then((d: { categorias?: string[] }) => setCategorias(d.categorias ?? []))
      .catch(() => {});
  }, [isOpen, mostrarHistorico]);

  useEffect(() => {
    if (!mostrarCliente || !buscaCli.trim()) { setClientesEncontrados([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(buscaCli.trim())}`).then(r => r.json())
        .then((d: { customers?: { id: string; name: string; phone: string | null }[] }) => setClientesEncontrados(d.customers ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscaCli, mostrarCliente]);

  useEffect(() => {
    if (!isOpen || !mostrarFornecedor) return;
    fetch(`/api/customers/suppliers?q=${encodeURIComponent(buscaForn.trim())}`).then(r => r.json())
      .then((d: { suppliers?: { id: string; name: string; phone: string | null }[] }) => setFornecedoresEncontrados(d.suppliers ?? []))
      .catch(() => {});
  }, [isOpen, mostrarFornecedor, buscaForn]);

  useEffect(() => {
    if (!mostrarProduto || !buscaProd.trim()) { setProdutosEncontrados([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/products/search?q=${encodeURIComponent(buscaProd.trim())}`).then(r => r.json())
        .then((d: { products?: { id: string; name: string; sku: string | null }[] }) => setProdutosEncontrados(d.products ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscaProd, mostrarProduto]);

  if (!isOpen || !report) return null;

  const usuariosFiltrados = usuarios.filter(u => u.name.toLowerCase().includes(buscaUser.toLowerCase()));
  const clienteSelecionado = clientesEncontrados.find(c => c.id === cliente);
  const usuarioSelecionado = usuarios.find(u => u.userId === usuarioId);
  const fornecedorSelecionado = fornecedoresEncontrados.find(f => f.id === fornecedor);
  const produtoSelecionado = produtosEncontrados.find(p => p.id === produto);

  const limpar = () => {
    setDataDe(hojeISO(-30)); setDataAte(hojeISO());
    setUsuarioId(""); setCliente(""); setFornecedor(""); setProduto(""); setConta("");
    setHistorico(""); setFormaPagamento(""); setStatus("");
    setBuscaUser(""); setBuscaCli(""); setBuscaForn(""); setBuscaProd("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-end" onClick={onClose}>
      <div className="h-full w-full max-w-xl bg-card shadow-2xl flex flex-col rounded-l-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div><h2 className="text-lg font-semibold">Filtros</h2><p className="text-xs text-muted-foreground">{report.nome}</p></div>
          <div className="flex items-center gap-2"><button onClick={limpar} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-secondary">Limpar Filtros</button><button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button></div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4 p-4 bg-secondary rounded-2xl border">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Calendar className="w-4 h-4" /> Período de Análise</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">De</label><input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-card text-sm" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Até</label><input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-card text-sm" /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mostrarUsuario && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Usuário Responsável</label>
                <div className="relative"><input type="text" placeholder="Buscar usuário..." value={buscaUser} onChange={e => setBuscaUser(e.target.value)} className="w-full h-10 px-3 pl-9 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" /><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /></div>
                {buscaUser && <div className="max-h-32 overflow-y-auto border rounded-lg bg-card">{usuariosFiltrados.map(u => <div key={u.userId} onClick={() => { setUsuarioId(u.userId); setBuscaUser(""); }} className="p-2 hover:bg-secondary cursor-pointer text-sm">{u.name}</div>)}</div>}
                {usuarioSelecionado && <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg"><span className="text-sm font-medium">{usuarioSelecionado.name}</span><button onClick={() => setUsuarioId("")} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></div>}
              </div>
            )}
            {mostrarCliente && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Cliente</label>
                <div className="relative"><input type="text" placeholder="Buscar por nome ou telefone..." value={buscaCli} onChange={e => setBuscaCli(e.target.value)} className="w-full h-10 px-3 pl-9 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" /><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /></div>
                {buscaCli && clientesEncontrados.length > 0 && <div className="max-h-32 overflow-y-auto border rounded-lg bg-card">{clientesEncontrados.map(c => <div key={c.id} onClick={() => { setCliente(c.id); setBuscaCli(""); }} className="p-2 hover:bg-secondary cursor-pointer text-sm"><p className="font-medium">{c.name}</p>{c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}</div>)}</div>}
                {clienteSelecionado && <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg"><span className="text-sm font-medium">{clienteSelecionado.name}</span><button onClick={() => setCliente("")} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></div>}
              </div>
            )}
            {mostrarFornecedor && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Fornecedor</label>
                <div className="relative"><input type="text" placeholder="Buscar fornecedor..." value={buscaForn} onChange={e => setBuscaForn(e.target.value)} className="w-full h-10 px-3 pl-9 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" /><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /></div>
                {buscaForn && <div className="max-h-32 overflow-y-auto border rounded-lg bg-card">{fornecedoresEncontrados.map(f => <div key={f.id} onClick={() => { setFornecedor(f.id); setBuscaForn(""); }} className="p-2 hover:bg-secondary cursor-pointer text-sm"><p className="font-medium">{f.name}</p>{f.phone && <p className="text-xs text-muted-foreground">{f.phone}</p>}</div>)}</div>}
                {fornecedorSelecionado && <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg"><span className="text-sm font-medium">{fornecedorSelecionado.name}</span><button onClick={() => setFornecedor("")} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></div>}
              </div>
            )}
            {mostrarProduto && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" /> Produto</label>
                <div className="relative"><input type="text" placeholder="Buscar por nome ou SKU..." value={buscaProd} onChange={e => setBuscaProd(e.target.value)} className="w-full h-10 px-3 pl-9 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" /><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /></div>
                {buscaProd && produtosEncontrados.length > 0 && <div className="max-h-32 overflow-y-auto border rounded-lg bg-card">{produtosEncontrados.map(p => <div key={p.id} onClick={() => { setProduto(p.id); setBuscaProd(""); }} className="p-2 hover:bg-secondary cursor-pointer text-sm"><p className="font-medium">{p.name}</p>{p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}</div>)}</div>}
                {produtoSelecionado && <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg"><span className="text-sm font-medium">{produtoSelecionado.name}</span><button onClick={() => setProduto("")} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></div>}
              </div>
            )}
            {mostrarConta && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Landmark className="w-3 h-3" /> Conta Bancária</label>
                <select value={conta} onChange={e => setConta(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm">
                  <option value="">Selecione uma conta</option>
                  {MOCK_CONTAS.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
                </select>
              </div>
            )}
            {mostrarFormaPagamento && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Forma de Pagamento</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setFormaPagamento("")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${formaPagamento === "" ? "bg-primary/10 text-primary border border-primary/30" : "bg-secondary text-muted-foreground border border-border hover:bg-secondary/80"}`}>Todas</button>
                  {PAYMENT_METHOD_OPTIONS.map(f => <button key={f.key} onClick={() => setFormaPagamento(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${formaPagamento === f.key ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-secondary text-muted-foreground border border-border hover:bg-secondary/80"}`}>{f.label}</button>)}
                </div>
              </div>
            )}
            {mostrarStatus && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm">
                  <option value="">Todos</option>
                  {statusOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            )}
            {mostrarHistorico && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Categoria</label>
                <select value={historico} onChange={e => setHistorico(e.target.value)} className="w-full h-10 px-3 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm">
                  <option value="">Todas</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t bg-card">
          <Button
            onClick={() => onGerar({
              dataDe, dataAte, clienteId: cliente, usuarioId, usuarioNome: usuarioSelecionado?.name || "",
              formaPagamento, status, historico, produtoId: produto, fornecedorId: fornecedor,
            })}
            className="w-full h-12 rounded-2xl text-base font-semibold bg-gradient-primary text-primary-foreground"
          >
            <Search className="w-4 h-4 mr-2" /> Gerar Relatório
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report, isFavorito, onToggleFavorito, onVisualizar, isLocked }: { report: ReportConfig; isFavorito: boolean; onToggleFavorito: () => void; onVisualizar: () => void; isLocked?: boolean; }) {
  const Icon = report.icone;
  const moduloStyle = MODULOS_LABEL[report.modulo];
  if (isLocked) {
    return (<div className="group relative p-4 rounded-2xl border border-border/50 bg-secondary/30 opacity-60"><div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-xl ${moduloStyle.cor} flex items-center justify-center shrink-0`}><Lock className="w-4 h-4" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h4 className="font-semibold text-sm text-muted-foreground truncate">{report.nome}</h4><Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md shrink-0">{moduloStyle.label}</Badge></div><p className="text-xs text-muted-foreground mt-1 line-clamp-2">Acesso restrito</p></div></div></div>);
  }
  return (<div className="group relative p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-soft transition-all"><div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-xl ${moduloStyle.cor} flex items-center justify-center shrink-0`}><Icon className="w-4 h-4" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h4 className="font-semibold text-sm text-foreground truncate">{report.nome}</h4>{report.destaque && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}</div><p className="text-xs text-muted-foreground mt-1 line-clamp-2">{report.descricao}</p><div className="flex items-center gap-1.5 mt-2"><Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md">{moduloStyle.label}</Badge><Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">{report.uso}</Badge></div></div><button onClick={onToggleFavorito} className={`p-1.5 rounded-lg transition-colors ${isFavorito ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}><Star className={`w-4 h-4 ${isFavorito ? "fill-amber-400" : ""}`} /></button></div><div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={onVisualizar} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary"><Eye className="w-3.5 h-3.5" /> Ver</button><button onClick={() => alert(`Exportando ${report.nome} em PDF...`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"><FileText className="w-3.5 h-3.5" /> PDF</button><button onClick={() => alert(`Exportando ${report.nome} em Excel...`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</button><button onClick={() => alert(`Imprimindo ${report.nome}...`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary"><Printer className="w-3.5 h-3.5" /> Print</button></div></div>);
}

// Mock de emissões nas últimas 24h (simulado - virá do backend)
const EMISSOES_24H = 12;

function ReportsPage() {
  const storeRole = useStoreRole();
  const [busca, setBusca] = useState("");
  const [filtroModulo, setFiltroModulo] = useState<ModuloReport | "todos">("todos");
  const [filtroUso, setFiltroUso] = useState<UsoReport | "todos">("todos");
  const [favoritos, setFavoritos] = useState<string[]>(() => { if (typeof window !== "undefined") { const saved = localStorage.getItem("armazix-reports-favoritos"); return saved ? JSON.parse(saved) : []; } return []; });
  const [reportSelecionado, setReportSelecionado] = useState<ReportConfig | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ultimoRelatorio, setUltimoRelatorio] = useState<ReportConfig | null>(null);
  const [resultadoAberto, setResultadoAberto] = useState<{ reportId: string; filtros: FiltrosDrawer } | null>(null);
  const [avisoNaoImplementado, setAvisoNaoImplementado] = useState<ReportConfig | null>(null);

  useEffect(() => { if (typeof window !== "undefined") { localStorage.setItem("armazix-reports-favoritos", JSON.stringify(favoritos)); } }, [favoritos]);

  const toggleFavorito = (id: string) => { setFavoritos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const abrirDrawer = (report: ReportConfig) => {
    setReportSelecionado(report);
    setUltimoRelatorio(report);
    setDrawerOpen(true);
  };

  // Ponto de entrada do "Ver" em cada card — decide entre abrir o drawer de
  // filtros, pular direto pro resultado (relatório sem filtro, ex: estoque
  // baixo), ou avisar que aquele relatório ainda não foi implementado (os
  // outros 21 do catálogo, fora de escopo por enquanto).
  const handleVisualizar = (report: ReportConfig) => {
    setUltimoRelatorio(report);
    if (!(RELATORIOS_IMPLEMENTADOS as readonly string[]).includes(report.id)) {
      setAvisoNaoImplementado(report);
      return;
    }
    if (!report.filtrosDisponiveis || report.filtrosDisponiveis.length === 0) {
      setResultadoAberto({ reportId: report.id, filtros: DEFAULT_FILTROS });
      return;
    }
    abrirDrawer(report);
  };

  const handleGerar = (filtros: FiltrosDrawer) => {
    if (!reportSelecionado) return;
    setDrawerOpen(false);
    setResultadoAberto({ reportId: reportSelecionado.id, filtros });
  };

  const scrollToFavoritos = () => {
    const element = document.getElementById("secao-favoritos");
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToUltimo = () => {
    if (ultimoRelatorio) handleVisualizar(ultimoRelatorio);
  };

  // Filtrar relatórios disponíveis para o usuário
  const relatoriosPermitidos = useMemo(() =>
    CATALOGO_RELATORIOS.filter(r => temPermissao(storeRole, r.permissao)),
    [storeRole]
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
    CATALOGO_RELATORIOS.filter(r => favoritos.includes(r.id) && temPermissao(storeRole, r.permissao)),
    [favoritos, storeRole]
  );

  const destaques = useMemo(() =>
    CATALOGO_RELATORIOS.filter(r => r.destaque && temPermissao(storeRole, r.permissao)),
    [storeRole]
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
    { id: "fiscal", label: "🔐 Fiscal & Operacional", icone: Receipt, cor: "text-muted-foreground" },
    { id: "auditoria", label: "🔍 Auditoria & Segurança", icone: Shield, cor: "text-red-600" },
  ];

  return (
    <div className="min-h-screen bg-secondary p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Central de Relatórios</h1>
            <p className="text-sm text-muted-foreground mt-1">Análises e dados estratégicos do seu negócio</p>
          </div>
        </div>

        {/* Drawer de Filtros */}
        <ReportFilterDrawer report={reportSelecionado} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onGerar={handleGerar} />

        {/* Resultado do relatório (os 7 com backend real) */}
        {resultadoAberto && (
          <ResultadoRelatorioModal
            reportId={resultadoAberto.reportId}
            filtros={resultadoAberto.filtros}
            onClose={() => setResultadoAberto(null)}
          />
        )}

        {/* Aviso pros outros 21 relatórios do catálogo, ainda fora de escopo */}
        {avisoNaoImplementado && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAvisoNaoImplementado(null)}>
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{avisoNaoImplementado.nome}</h3>
              <p className="text-sm text-muted-foreground mb-4">Este relatório ainda não está disponível — só os relatórios em destaque (⭐) já geram dado real.</p>
              <Button onClick={() => setAvisoNaoImplementado(null)} className="w-full rounded-xl">Entendi</Button>
            </div>
          </div>
        )}

        {/* KPI Cards - Indicadores Rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total de relatórios disponíveis */}
          <Card className="rounded-2xl border-border/50 bg-card hover:shadow-md transition-shadow">
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
          <Card className="rounded-2xl border-border/50 bg-card hover:shadow-md transition-shadow cursor-pointer" onClick={scrollToUltimo}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><History className="w-5 h-5 text-blue-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{ultimoRelatorio ? ultimoRelatorio.nome : "Nenhum ainda"}</p>
                  <p className="text-xs text-muted-foreground">{ultimoRelatorio ? "Clique para reabrir" : "Último Relatório Gerado"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Atalho para favoritos */}
          <Card className="rounded-2xl border-border/50 bg-card hover:shadow-md transition-shadow cursor-pointer" onClick={scrollToFavoritos}>
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
          <Card className="rounded-2xl border-border/50 bg-card hover:shadow-md transition-shadow">
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
                <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value as ModuloReport | "todos")} className="h-10 px-3 rounded-xl border bg-card text-sm focus:ring-2 focus:ring-primary/20">
                  <option value="todos">📁 Todos os Módulos</option>
                  <option value="estoque">📦 Estoque</option>
                  <option value="clientes">👥 Clientes</option>
                  <option value="produtos">🏷️ Produtos</option>
                  <option value="vendas">📊 Vendas</option>
                  <option value="financeiro">💰 Financeiro</option>
                  <option value="fiscal">🔐 Fiscal</option>
                  <option value="auditoria">🔍 Auditoria</option>
                </select>
                <select value={filtroUso} onChange={e => setFiltroUso(e.target.value as UsoReport | "todos")} className="h-10 px-3 rounded-xl border bg-card text-sm focus:ring-2 focus:ring-primary/20">
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
                <ReportCard key={report.id} report={report} isFavorito={favoritos.includes(report.id)} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => handleVisualizar(report)} />
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
                <ReportCard key={report.id} report={report} isFavorito={true} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => handleVisualizar(report)} />
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
                  <h2 className="text-lg font-semibold text-foreground">{label}</h2>
                  <Badge variant="secondary" className="rounded-lg ml-2">{relatoriosModulo.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {relatoriosModulo.map(report => (
                    <ReportCard key={report.id} report={report} isFavorito={favoritos.includes(report.id)} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => handleVisualizar(report)} />
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
                <ReportCard key={report.id} report={report} isFavorito={favoritos.includes(report.id)} onToggleFavorito={() => toggleFavorito(report.id)} onVisualizar={() => handleVisualizar(report)} />
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


