/**
 * ARMAZIX - COMPONENTE DE FILTROS DINÂMICOS POR RELATÓRIO
 * Renderização atômica condicional baseada na configuração do relatório ativo
 */

import { useState } from "react";
import { X, Calendar, ChevronDown, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportItem, FiltroVisivel } from "@/config/reportsConfig";

interface ReportFilterDrawerProps {
  report: ReportItem | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (filters: Record<string, unknown>) => void;
}

// Meses para o relatório de aniversariantes
const MESES = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

// Status de estoque
const STATUS_ESTOQUE = ["Crítico", "Baixo", "Atenção", "Normal"];

// Categorias mockadas
const CATEGORIAS_PRODUTO = [
  { value: "graos", label: "Grãos" },
  { value: "oleos", label: "Óleos" },
  { value: "massas", label: "Massas" },
  { value: "laticinios", label: "Laticínios" },
  { value: "bebidas", label: "Bebidas" },
];

// Usuários/Operadores mockados (para relatórios de auditoria)
const USUARIOS_OPERADORES = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "carlos", label: "Carlos (Vendedor)" },
  { value: "ana", label: "Ana (Vendedor)" },
  { value: "pedro", label: "Pedro (Operador)" },
  { value: "joao", label: "João (Caixa)" },
];

// Tipos de operação (para relatórios de auditoria/exclusões)
const TIPOS_OPERACAO = [
  { value: "exclusao_produto", label: "Exclusão de Produto" },
  { value: "exclusao_venda", label: "Exclusão de Venda" },
  { value: "exclusao_lancamento", label: "Exclusão de Lançamento" },
  { value: "alteracao_preco", label: "Alteração de Preço" },
  { value: "cancelamento_nfce", label: "Cancelamento NFC-e" },
  { value: "reabertura_caixa", label: "Reabertura de Caixa" },
  { value: "estorno_pagamento", label: "Estorno de Pagamento" },
];

// Status de entrega (para relatório de entregadores)
const STATUS_ENTREGA = [
  { value: "pendente", label: "Pendente" },
  { value: "em_rota", label: "Em Rota" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelada", label: "Cancelada" },
  { value: "devolvida", label: "Devolvida" },
];

// Naturezas (para relatório de Contas)
const NATUREZAS = [
  { value: "receitas", label: "Receitas", cor: "text-emerald-600" },
  { value: "despesas", label: "Despesas", cor: "text-rose-600" },
  { value: "transferencias", label: "Transferências", cor: "text-blue-600" },
];

// Posições (para relatório de Contas)
const POSICOES = [
  { value: "em_aberto", label: "Em Aberto" },
  { value: "efetivadas", label: "Efetivadas" },
];

// Contas Bancárias (para Conta Corrente)
const CONTAS_BANCARIAS_LISTA = [
  { value: "banco_nordeste", label: "Banco do Nordeste" },
  { value: "caixa", label: "Caixa Econômica" },
  { value: "cartoes", label: "Cartões" },
  { value: "cofre", label: "Cofre" },
];

// Situações de Cliente
const SITUACOES_CLIENTE = [
  { value: "todos", label: "Todos" },
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
];

// Tipos de Cliente
const TIPOS_CLIENTE = [
  { value: "pf", label: "Pessoa Física" },
  { value: "pj", label: "Pessoa Jurídica" },
  { value: "revendedor", label: "Revendedor" },
];

// Centros de Resultado
const CENTROS_RESULTADO = [
  { value: "vendas", label: "Vendas" },
  { value: "administrativo", label: "Administrativo" },
  { value: "operacional", label: "Operacional" },
  { value: "marketing", label: "Marketing" },
];

// Tipos de Produto
const TIPOS_PRODUTO = [
  { value: "produto", label: "Produto" },
  { value: "insumo", label: "Insumo" },
];

// Históricos
const HISTORICOS = [
  { value: "hist-001", label: "Vendas de Mercadorias" },
  { value: "hist-002", label: "Despesas Operacionais" },
  { value: "hist-003", label: "Receitas Financeiras" },
];

// Fornecedores mockados
const FORNECEDORES = [
  { value: "forn-001", label: "Distribuidora Silva" },
  { value: "forn-002", label: "Alimentos Brasil" },
  { value: "forn-003", label: "Cerealista Central" },
];

// Vendedores mockados
const VENDEDORES = [
  { value: "vend-001", label: "Carlos" },
  { value: "vend-002", label: "Ana" },
  { value: "vend-003", label: "Pedro" },
];

// Clientes mockados
const CLIENTES = [
  { value: "cli-001", label: "João da Silva" },
  { value: "cli-002", label: "Maria Oliveira" },
  { value: "cli-003", label: "Restaurante Bom Sabor" },
];

// Contas bancárias mockadas
const CONTAS_BANCARIAS = [
  { value: "conta-001", label: "Itaú - 1234" },
  { value: "conta-002", label: "Bradesco - 5678" },
  { value: "conta-003", label: "Caixa - 9012" },
];

// Status gerais
const STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "pendente", label: "Pendente" },
  { value: "concluido", label: "Concluído" },
];

// Formas de pagamento
const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

// Canais de venda
const CANAIS = [
  { value: "pdv", label: "PDV" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "telefone", label: "Telefone" },
  { value: "whatsapp", label: "WhatsApp" },
];

// Motivos de cancelamento
const MOTIVOS_CANCELAMENTO = [
  { value: "cliente", label: "Desistência do Cliente" },
  { value: "estoque", label: "Sem Estoque" },
  { value: "preco", label: "Preço Incompatível" },
  { value: "erro", label: "Erro de Cadastro" },
];

export function ReportFilterDrawer({ report, isOpen, onClose, onGenerate }: ReportFilterDrawerProps) {
  const [filters, setFilters] = useState<Record<string, unknown>>({});

  if (!report) return null;

  const config = report.configuracaoFiltro;
  const filtrosVisiveis = config.filtrosVisiveis;

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerate = () => {
    onGenerate(filters);
    onClose();
  };

  // Renderização condicional do bloco de período
  const renderPeriodo = () => {
    if (config.tipoPeriodo === "nenhum") return null;

    const label = config.labelPeriodo || "Período";

    // Mês de aniversário - dropdown de meses
    if (config.tipoPeriodo === "mes_aniversario") {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">{label}</Label>
          <Select
            value={(filters.mes as string) || ""}
            onValueChange={(value) => handleFilterChange("mes", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((mes) => (
                <SelectItem key={mes.value} value={mes.value}>
                  {mes.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Período completo com data e hora
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <Label className="text-sm font-medium text-slate-700">{label}</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Data De</Label>
            <Input
              type="date"
              value={(filters.dataDe as string) || ""}
              onChange={(e) => handleFilterChange("dataDe", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Hora De</Label>
            <Input
              type="time"
              value={(filters.horaDe as string) || "00:00"}
              onChange={(e) => handleFilterChange("horaDe", e.target.value)}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Data Até</Label>
            <Input
              type="date"
              value={(filters.dataAte as string) || ""}
              onChange={(e) => handleFilterChange("dataAte", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Hora Até</Label>
            <Input
              type="time"
              value={(filters.horaAte as string) || "23:59"}
              onChange={(e) => handleFilterChange("horaAte", e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  };

  // Input Vendedor
  const renderVendedor = () => (
    filtrosVisiveis.includes("vendedor" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Vendedor</Label>
        <Select
          value={(filters.vendedor as string) || ""}
          onValueChange={(value) => handleFilterChange("vendedor", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os vendedores" />
          </SelectTrigger>
          <SelectContent>
            {VENDEDORES.map((v) => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Cliente
  const renderCliente = () => (
    filtrosVisiveis.includes("cliente" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Cliente</Label>
        <Select
          value={(filters.cliente as string) || ""}
          onValueChange={(value) => handleFilterChange("cliente", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            {CLIENTES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Fornecedor
  const renderFornecedor = () => (
    filtrosVisiveis.includes("fornecedor" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Fornecedor</Label>
        <Select
          value={(filters.fornecedor as string) || ""}
          onValueChange={(value) => handleFilterChange("fornecedor", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os fornecedores" />
          </SelectTrigger>
          <SelectContent>
            {FORNECEDORES.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Conta Bancária
  const renderContaBancaria = () => (
    filtrosVisiveis.includes("conta_bancaria" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Conta Bancária</Label>
        <Select
          value={(filters.conta_bancaria as string) || ""}
          onValueChange={(value) => handleFilterChange("conta_bancaria", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            {CONTAS_BANCARIAS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Categoria Produto
  const renderCategoriaProduto = () => (
    filtrosVisiveis.includes("categoria_produto" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Categoria</Label>
        <Select
          value={(filters.categoria_produto as string) || ""}
          onValueChange={(value) => handleFilterChange("categoria_produto", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS_PRODUTO.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Status Estoque
  const renderStatusEstoque = () => (
    filtrosVisiveis.includes("status_estoque" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Status do Estoque</Label>
        <Select
          value={(filters.status_estoque as string) || ""}
          onValueChange={(value) => handleFilterChange("status_estoque", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ESTOQUE.map((s) => (
              <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config.opcoes?.rangeEstoqueMinimo && (
          <div className="mt-2 space-y-2">
            <Label className="text-xs text-slate-500">Estoque Mínimo</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="De"
                className="w-20"
                value={(filters.estoqueMinDe as string) || ""}
                onChange={(e) => handleFilterChange("estoqueMinDe", e.target.value)}
              />
              <span className="text-slate-400">-</span>
              <Input
                type="number"
                placeholder="Até"
                className="w-20"
                value={(filters.estoqueMinAte as string) || ""}
                onChange={(e) => handleFilterChange("estoqueMinAte", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    )
  );

  // Input Produto
  const renderProduto = () => (
    filtrosVisiveis.includes("produto" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Produto</Label>
        <Input
          placeholder="Buscar produto..."
          value={(filters.produto as string) || ""}
          onChange={(e) => handleFilterChange("produto", e.target.value)}
        />
      </div>
    )
  );

  // Input Forma de Pagamento
  const renderFormaPagamento = () => (
    filtrosVisiveis.includes("forma_pagamento" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Forma de Pagamento</Label>
        <Select
          value={(filters.forma_pagamento as string) || ""}
          onValueChange={(value) => handleFilterChange("forma_pagamento", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as formas" />
          </SelectTrigger>
          <SelectContent>
            {FORMAS_PAGAMENTO.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Canal
  const renderCanal = () => (
    filtrosVisiveis.includes("canal" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Canal de Venda</Label>
        <Select
          value={(filters.canal as string) || ""}
          onValueChange={(value) => handleFilterChange("canal", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            {CANAIS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Status
  const renderStatus = () => (
    filtrosVisiveis.includes("status" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Status</Label>
        <Select
          value={(filters.status as string) || ""}
          onValueChange={(value) => handleFilterChange("status", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Motivo Cancelamento
  const renderMotivoCancelamento = () => (
    filtrosVisiveis.includes("motivo_cancelamento" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Motivo de Cancelamento</Label>
        <Select
          value={(filters.motivo_cancelamento as string) || ""}
          onValueChange={(value) => handleFilterChange("motivo_cancelamento", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os motivos" />
          </SelectTrigger>
          <SelectContent>
            {MOTIVOS_CANCELAMENTO.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Histórico
  const renderHistorico = () => (
    filtrosVisiveis.includes("historico" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Histórico</Label>
        <Select
          value={(filters.historico as string) || ""}
          onValueChange={(value) => handleFilterChange("historico", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o histórico" />
          </SelectTrigger>
          <SelectContent>
            {HISTORICOS.map((h) => (
              <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Mês (específico para aniversariantes)
  const renderMes = () => (
    filtrosVisiveis.includes("mes" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Mês</Label>
        <Select
          value={(filters.mes as string) || ""}
          onValueChange={(value) => handleFilterChange("mes", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Usuário/Operador (para relatórios de auditoria)
  const renderUsuarioOperador = () => (
    filtrosVisiveis.includes("usuario_operador" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Usuário/Operador</Label>
        <Select
          value={(filters.usuario_operador as string) || ""}
          onValueChange={(value) => handleFilterChange("usuario_operador", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os usuários" />
          </SelectTrigger>
          <SelectContent>
            {USUARIOS_OPERADORES.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Tipo de Operação (para relatórios de auditoria/exclusões)
  const renderTipoOperacao = () => (
    filtrosVisiveis.includes("tipo_operacao" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Tipo de Operação</Label>
        <Select
          value={(filters.tipo_operacao as string) || ""}
          onValueChange={(value) => handleFilterChange("tipo_operacao", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_OPERACAO.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Status de Entrega (para relatório de entregadores)
  const renderStatusEntrega = () => (
    filtrosVisiveis.includes("status_entrega" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Status da Entrega</Label>
        <Select
          value={(filters.status_entrega as string) || ""}
          onValueChange={(value) => handleFilterChange("status_entrega", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ENTREGA.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Natureza (checkboxes para Contas)
  const renderNatureza = () => (
    filtrosVisiveis.includes("natureza" as FiltroVisivel) && (
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">Natureza</Label>
        <div className="flex flex-wrap gap-3">
          {NATUREZAS.map((n) => (
            <label key={n.value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(filters.naturezas as string[] || []).includes(n.value)}
                onChange={(e) => {
                  const current = (filters.naturezas as string[] || []);
                  const updated = e.target.checked
                    ? [...current, n.value]
                    : current.filter(v => v !== n.value);
                  handleFilterChange("naturezas", updated);
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={`text-sm ${n.cor}`}>{n.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  );

  // Input Posição (checkboxes para Contas)
  const renderPosicao = () => (
    filtrosVisiveis.includes("posicao" as FiltroVisivel) && (
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">Posição</Label>
        <div className="flex flex-wrap gap-3">
          {POSICOES.map((p) => (
            <label key={p.value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(filters.posicoes as string[] || []).includes(p.value)}
                onChange={(e) => {
                  const current = (filters.posicoes as string[] || []);
                  const updated = e.target.checked
                    ? [...current, p.value]
                    : current.filter(v => v !== p.value);
                  handleFilterChange("posicoes", updated);
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{p.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  );

  // Input Contas Bancárias Múltiplas (checkboxes)
  const renderContasBancariasMulti = () => (
    filtrosVisiveis.includes("contas_bancarias_multi" as FiltroVisivel) && (
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">Contas Bancárias</Label>
        <div className="space-y-2">
          {CONTAS_BANCARIAS_LISTA.map((c) => (
            <label key={c.value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(filters.contas_bancarias as string[] || []).includes(c.value)}
                onChange={(e) => {
                  const current = (filters.contas_bancarias as string[] || []);
                  const updated = e.target.checked
                    ? [...current, c.value]
                    : current.filter(v => v !== c.value);
                  handleFilterChange("contas_bancarias", updated);
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{c.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  );

  // Input Situação do Cliente
  const renderSituacaoCliente = () => (
    filtrosVisiveis.includes("situacao_cliente" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Situação</Label>
        <Select
          value={(filters.situacao_cliente as string) || ""}
          onValueChange={(value) => handleFilterChange("situacao_cliente", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a situação" />
          </SelectTrigger>
          <SelectContent>
            {SITUACOES_CLIENTE.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Tipo de Cliente
  const renderTipoCliente = () => (
    filtrosVisiveis.includes("tipo_cliente" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Tipo de Cliente</Label>
        <Select
          value={(filters.tipo_cliente as string) || ""}
          onValueChange={(value) => handleFilterChange("tipo_cliente", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_CLIENTE.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Centro de Resultado
  const renderCentroResultado = () => (
    filtrosVisiveis.includes("centro_resultado" as FiltroVisivel) && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Centro de Resultado</Label>
        <Select
          value={(filters.centro_resultado as string) || ""}
          onValueChange={(value) => handleFilterChange("centro_resultado", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o centro" />
          </SelectTrigger>
          <SelectContent>
            {CENTROS_RESULTADO.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // Input Tipo de Produto
  const renderTipoProduto = () => (
    filtrosVisiveis.includes("tipo_produto" as FiltroVisivel) && (
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">Tipo de Produto</Label>
        <div className="flex flex-wrap gap-3">
          {TIPOS_PRODUTO.map((t) => (
            <label key={t.value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(filters.tipos_produto as string[] || []).includes(t.value)}
                onChange={(e) => {
                  const current = (filters.tipos_produto as string[] || []);
                  const updated = e.target.checked
                    ? [...current, t.value]
                    : current.filter(v => v !== t.value);
                  handleFilterChange("tipos_produto", updated);
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{t.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  );

  // Toggle Estoque Baixo (Switch)
  const renderToggleEstoqueBaixo = () => (
    filtrosVisiveis.includes("toggle_estoque_baixo" as FiltroVisivel) && (
      <div className="flex items-center justify-between py-3 px-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <Label className="text-sm font-medium text-amber-800 cursor-pointer">
            Apenas Estoque Baixo?
          </Label>
        </div>
        <button
          onClick={() => handleFilterChange("apenas_estoque_baixo", !(filters.apenas_estoque_baixo as boolean))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            (filters.apenas_estoque_baixo as boolean) ? 'bg-amber-500' : 'bg-slate-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              (filters.apenas_estoque_baixo as boolean) ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    )
  );

  // Checkbox Somente Vendas
  const renderSomenteVendas = () => (
    filtrosVisiveis.includes("somente_vendas" as FiltroVisivel) && (
      <label className="flex items-center space-x-2 cursor-pointer py-2">
        <input
          type="checkbox"
          checked={(filters.somente_vendas as boolean) || false}
          onChange={(e) => handleFilterChange("somente_vendas", e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-700">Somente Vendas</span>
      </label>
    )
  );

  // Checkbox Remover Opcionais
  const renderRemoverOpcionais = () => (
    filtrosVisiveis.includes("remover_opcionais" as FiltroVisivel) && (
      <label className="flex items-center space-x-2 cursor-pointer py-2">
        <input
          type="checkbox"
          checked={(filters.remover_opcionais as boolean) || false}
          onChange={(e) => handleFilterChange("remover_opcionais", e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-700">Remover Opcionais/Adicionais</span>
      </label>
    )
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-lg font-semibold text-slate-900">
            Filtros: {report?.nome}
          </SheetTitle>
          <p className="text-sm text-slate-500">Configure os parâmetros do relatório</p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Badge do tipo de período */}
          {config.tipoPeriodo !== "nenhum" && (
            <Badge variant="secondary" className="text-xs">
              {config.labelPeriodo || "Período configurado"}
            </Badge>
          )}

          {/* Bloco de Período - Renderização Condicional */}
          {renderPeriodo()}

          {/* Filtros Atômicos - Renderização Condicional por Tipo */}
          <div className="space-y-4">
            {renderVendedor()}
            {renderCliente()}
            {renderFornecedor()}
            {renderContaBancaria()}
            {renderCategoriaProduto()}
            {renderStatusEstoque()}
            {renderProduto()}
            {renderFormaPagamento()}
            {renderCanal()}
            {renderStatus()}
            {renderMotivoCancelamento()}
            {renderHistorico()}
            {renderMes()}
            {renderUsuarioOperador()}
            {renderTipoOperacao()}
            {renderStatusEntrega()}
            {/* Novos filtros específicos V2 */}
            {renderNatureza()}
            {renderPosicao()}
            {renderContasBancariasMulti()}
            {renderSituacaoCliente()}
            {renderTipoCliente()}
            {renderCentroResultado()}
            {renderTipoProduto()}
            {renderToggleEstoqueBaixo()}
            {renderSomenteVendas()}
            {renderRemoverOpcionais()}
          </div>

          {/* Botões de Ação */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <Button 
              onClick={handleGenerate}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Gerar Relatório
            </Button>
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ReportFilterDrawer;
