// ─── Permission key types ─────────────────────────────────────────────────────

export type PermissionKey =
  | "cadastros.view"
  | "cadastros.create"
  | "cadastros.edit"
  | "financeiro.view"
  | "financeiro.config"
  | "relatorios.view"
  | "relatorios.export"
  | "caixa.abrir"
  | "caixa.fechar"
  | "estornos.realizar";

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  "cadastros.view", "cadastros.create", "cadastros.edit",
  "financeiro.view", "financeiro.config",
  "relatorios.view", "relatorios.export",
  "caixa.abrir", "caixa.fechar",
  "estornos.realizar",
];

// ─── Permission sections (UI metadata) ───────────────────────────────────────

export interface PermissionItem {
  key:         PermissionKey;
  label:       string;
  description: string;
  critical?:   boolean;
}

export interface PermissionSection {
  key:         string;
  label:       string;
  description: string;
  items:       PermissionItem[];
}

export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    key:         "cadastros",
    label:       "Cadastros",
    description: "Produtos, clientes, categorias e fornecedores",
    items: [
      { key: "cadastros.view",   label: "Visualizar",  description: "Ver listas de produtos, clientes e categorias" },
      { key: "cadastros.create", label: "Criar",        description: "Cadastrar novos produtos, clientes e categorias" },
      { key: "cadastros.edit",   label: "Editar",       description: "Alterar dados existentes nos cadastros" },
    ],
  },
  {
    key:         "financeiro",
    label:       "Financeiro",
    description: "Faturamento, fluxo de caixa e configurações de pagamento",
    items: [
      { key: "financeiro.view",   label: "Visualizar financeiro",  description: "Ver faturamento, fluxo de caixa e histórico" },
      { key: "financeiro.config", label: "Configurar taxas",       description: "Alterar configurações de maquineta e comissões", critical: true },
    ],
  },
  {
    key:         "relatorios",
    label:       "Relatórios",
    description: "Dashboards, métricas e exportação de dados",
    items: [
      { key: "relatorios.view",   label: "Acessar dashboards",  description: "Ver métricas, gráficos e indicadores de desempenho" },
      { key: "relatorios.export", label: "Exportar dados",      description: "Baixar relatórios em PDF ou planilha" },
    ],
  },
  {
    key:         "caixa",
    label:       "Caixa",
    description: "Abertura e fechamento de sessões de caixa",
    items: [
      { key: "caixa.abrir",  label: "Abrir caixa",  description: "Iniciar uma nova sessão de caixa" },
      { key: "caixa.fechar", label: "Fechar caixa", description: "Encerrar a sessão de caixa e gerar resumo" },
    ],
  },
  {
    key:         "estornos",
    label:       "Estornos",
    description: "Permissão crítica para reverter vendas e pagamentos",
    items: [
      { key: "estornos.realizar", label: "Realizar estorno", description: "Estornar ou cancelar vendas e cobranças efetuadas", critical: true },
    ],
  },
];

// ─── System roles & defaults ──────────────────────────────────────────────────

export const SYSTEM_ROLES = [
  { slug: "admin",    name: "Administrador" },
  { slug: "gerente",  name: "Gerente" },
  { slug: "vendedor", name: "Vendedor" },
  { slug: "operador", name: "Operador" },
] as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLES)[number]["slug"];

export const SYSTEM_ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  admin: {
    "cadastros.view": true,  "cadastros.create": true,  "cadastros.edit": true,
    "financeiro.view": true,  "financeiro.config": true,
    "relatorios.view": true,  "relatorios.export": true,
    "caixa.abrir": true,      "caixa.fechar": true,
    "estornos.realizar": true,
  },
  gerente: {
    "cadastros.view": true,  "cadastros.create": true,  "cadastros.edit": true,
    "financeiro.view": true,  "financeiro.config": false,
    "relatorios.view": true,  "relatorios.export": true,
    "caixa.abrir": true,      "caixa.fechar": true,
    "estornos.realizar": false,
  },
  vendedor: {
    "cadastros.view": true,  "cadastros.create": false, "cadastros.edit": false,
    "financeiro.view": false, "financeiro.config": false,
    "relatorios.view": false, "relatorios.export": false,
    "caixa.abrir": true,      "caixa.fechar": false,
    "estornos.realizar": false,
  },
  operador: {
    "cadastros.view": true,  "cadastros.create": false, "cadastros.edit": false,
    "financeiro.view": false, "financeiro.config": false,
    "relatorios.view": false, "relatorios.export": false,
    "caixa.abrir": false,     "caixa.fechar": false,
    "estornos.realizar": false,
  },
};

// ─── Runtime helper ───────────────────────────────────────────────────────────

export function hasPermission(
  permissions: Record<string, boolean> | null | undefined,
  key: PermissionKey
): boolean {
  if (!permissions) return false;
  return permissions[key] === true;
}
