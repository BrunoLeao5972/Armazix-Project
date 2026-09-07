// ARMAZIX - Camada de serviços (API)
// Nota: Configure VITE_API_URL no .env para apontar para o backend do Armazix

export type Option = { value: string; label: string };

const API_URL = (import.meta as any).env?.VITE_API_URL || "/api";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`,(init || {}) as RequestInit);
  if (!res.ok) {
    // Tenta ler mensagem de erro se existir
    let message = res.statusText;
    try {
      const data = await res.json();
      message = (data && (data.message || data.error)) || message;
    } catch {}
    throw new Error(message);
  }
  try {
    return (await res.json()) as T;
  } catch {
    // Sem corpo JSON
    return undefined as unknown as T;
  }
}

// Relatórios
export async function getReports() {
  return http<any[]>(`/relatorios`);
}

export async function toggleFavorite(reportId: string, favorite: boolean) {
  const method = favorite ? "POST" : "DELETE";
  return http<void>(`/relatorios/favoritos/${encodeURIComponent(reportId)}`, {
    method,
  });
}

// Buscas dinâmicas
export async function searchClientes(query: string) {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/clientes?search=${encodeURIComponent(query)}`
  );
  return (data || []).map((c) => ({ value: c.id, label: c.nome })) as Option[];
}

export async function searchFornecedores(query: string) {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/fornecedores?search=${encodeURIComponent(query)}`
  );
  return (data || []).map((f) => ({ value: f.id, label: f.nome })) as Option[];
}

export async function searchVendedores(query: string) {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/vendedores?search=${encodeURIComponent(query)}`
  );
  return (data || []).map((v) => ({ value: v.id, label: v.nome })) as Option[];
}

export async function getContasBancarias() {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/financeiro/contas-bancarias`
  );
  return (data || []).map((c) => ({ value: c.id, label: c.nome })) as Option[];
}

export async function getCategoriasProduto() {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/produtos/categorias`
  );
  return (data || []).map((c) => ({ value: c.id, label: c.nome })) as Option[];
}

export async function getHistoricos() {
  const data = await http<Array<{ id: string; codigo?: string; nome: string }>>(
    `/financeiro/historicos`
  );
  return (data || []).map((h) => ({
    value: h.id,
    label: h.codigo ? `${h.codigo} - ${h.nome}` : h.nome,
  })) as Option[];
}

export async function getFormasPagamento() {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/financeiro/formas-pagamento`
  );
  return (data || []).map((f) => ({ value: f.id, label: f.nome })) as Option[];
}

// Usuários/Operadores (movimentação/auditoria)
export async function searchUsuarios(query: string) {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/usuarios?search=${encodeURIComponent(query)}`
  );
  return (data || []).map((u) => ({ value: u.id, label: u.nome })) as Option[];
}

// Tipos de Operação (auditoria/movimentação)
export async function getTiposOperacao() {
  const data = await http<Array<{ id: string; nome: string }>>(
    `/auditoria/tipos-operacao`
  );
  return (data || []).map((t) => ({ value: t.id, label: t.nome })) as Option[];
}

// ===== Estoque / Movimentação =====
export async function getStockProducts(query?: string) {
  const qs = query ? `?search=${encodeURIComponent(query)}` : "";
  return http<any[]>(`/estoque/produtos${qs}`);
}

export async function getStockMovements() {
  return http<any[]>(`/estoque/movimentacoes`);
}

// ===== Financeiro =====
export async function getFinanceiroReceber() {
  return http<any[]>(`/financeiro/contas-receber`);
}

export async function getFinanceiroPagar() {
  return http<any[]>(`/financeiro/contas-pagar`);
}

function postJson<T>(path: string, body: unknown) {
  return http<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createContaPagar(dados: Record<string, unknown>) {
  return postJson<any>(`/financeiro/contas-pagar/create`, dados);
}
export async function updateContaPagar(dados: Record<string, unknown>) {
  return postJson<any>(`/financeiro/contas-pagar/update`, dados);
}
export async function efetivarContaPagar(ids: string[]) {
  return postJson<{ contas: any[]; efetivadas: number }>(`/financeiro/contas-pagar/efetivar`, { ids });
}
export async function cancelarContaPagar(ids: string[]) {
  return postJson<{ contas: any[]; canceladas: number }>(`/financeiro/contas-pagar/cancelar`, { ids });
}
export async function deleteContaPagar(id: string) {
  return postJson<{ success: boolean }>(`/financeiro/contas-pagar/delete`, { id });
}

export async function createContaReceber(dados: Record<string, unknown>) {
  return postJson<any>(`/financeiro/contas-receber/create`, dados);
}
export async function updateContaReceber(dados: Record<string, unknown>) {
  return postJson<any>(`/financeiro/contas-receber/update`, dados);
}
export async function efetivarContaReceber(ids: string[]) {
  return postJson<{ contas: any[]; efetivadas: number }>(`/financeiro/contas-receber/efetivar`, { ids });
}
export async function cancelarContaReceber(ids: string[]) {
  return postJson<{ contas: any[]; canceladas: number }>(`/financeiro/contas-receber/cancelar`, { ids });
}
export async function deleteContaReceber(id: string) {
  return postJson<{ success: boolean }>(`/financeiro/contas-receber/delete`, { id });
}

export async function getFinanceiroMovimentacoes() {
  return http<any[]>(`/financeiro/movimentacoes`);
}
