/**
 * ARMAZIX - COMPONENTE DE FILTROS DINÂMICOS POR RELATÓRIO
 * Renderização atômica condicional baseada na configuração do relatório ativo
 */

import { useState } from "react";
import { X, Calendar, ChevronDown } from "lucide-react";
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

// Históricos financeiros mockados
const HISTORICOS = [
  { value: "1.01.01", label: "1.01.01 - Vendas à Vista" },
  { value: "1.01.02", label: "1.01.02 - Vendas a Prazo" },
  { value: "2.01.01", label: "2.01.01 - Custo das Mercadorias" },
  { value: "2.01.02", label: "2.01.02 - Despesas Administrativas" },
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
