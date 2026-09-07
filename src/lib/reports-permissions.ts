// ─────────────────────────────────────────────────────────────────────────
// Fonte única de verdade de quais papéis podem ver cada relatório real da
// Central de Relatórios — importado tanto pelo catálogo do frontend
// (src/routes/admin/relatorios.tsx) quanto pelos handlers do backend
// (src/lib/api/reports-handler.ts), pra catálogo e backend nunca desalinharem.
//
// Sem dependência de React de propósito, pra poder ser importado dos dois
// lados sem trazer nada do bundle do navegador pro Worker.
//
// Auditoria de segurança — achado F2 (gate de permissão dos Relatórios era
// decorativo: usePermissaoUsuario() sempre "admin" no frontend, e os
// handlers de reports-handler.ts nunca checavam papel nenhum). Ver
// docs/security-audit/relatorio-auditoria-seguranca.pdf.
// ─────────────────────────────────────────────────────────────────────────

// "financeiro" não é um papel atribuível de verdade hoje (ASSIGNABLE_ROLES em
// user-handler.ts só tem admin/gerente/vendedor/operador) — fica listado por
// completude/compatibilidade futura, mas nenhum usuário real tem esse papel
// ainda, então essa branch nunca é satisfeita na prática.
export type Permissao = "admin" | "gerente" | "financeiro" | "vendedor" | "operador";

/** Papel real de storeUsers.role — inclui "owner", que não aparece em nenhuma lista de permissao abaixo. */
export type StoreRole = Permissao | "owner";

/** ids dos 32 relatórios com handler real (RELATORIOS_IMPLEMENTADOS em relatorios.tsx). */
export const REPORT_REQUIRED_ROLES: Record<string, readonly Permissao[]> = {
  "est-005": ["admin", "gerente", "operador"],
  "cli-002": ["admin", "gerente"],
  "prod-003": ["admin", "gerente"],
  "vnd-001": ["admin", "gerente"],
  "fin-001": ["admin", "gerente", "financeiro"],
  "fin-005": ["admin", "gerente"],
  "aud-002": ["admin"],

  // 25 relatórios adicionados depois dos 7 originais (mesmos papéis que já
  // estavam hardcoded no `permissao:` de cada entrada em relatorios.tsx —
  // só centralizados aqui, mesmo padrão dos 7 acima).
  "est-001": ["admin", "gerente", "operador"],
  "est-002": ["admin", "gerente", "operador"],
  "est-003": ["admin", "gerente", "operador"],
  "est-004": ["admin", "gerente"],
  "est-006": ["admin", "gerente"],
  "est-007": ["admin", "gerente", "operador"],
  "cli-001": ["admin", "gerente", "vendedor"],
  "cli-003": ["admin", "gerente", "vendedor"],
  "cli-004": ["admin", "gerente"],
  "prod-001": ["admin", "gerente", "vendedor"],
  "prod-002": ["admin", "gerente", "vendedor"],
  "prod-004": ["admin", "gerente"],
  "prod-005": ["admin", "gerente", "operador"],
  "prod-006": ["admin", "gerente"],
  "vnd-002": ["admin", "gerente", "vendedor"],
  "vnd-003": ["admin", "gerente", "vendedor"],
  "vnd-004": ["admin", "gerente", "financeiro"],
  "vnd-005": ["admin", "gerente", "vendedor"],
  "vnd-006": ["admin", "gerente"],
  "vnd-007": ["admin", "gerente"],
  "fin-002": ["admin", "gerente", "financeiro"],
  "fin-003": ["admin", "gerente", "financeiro"],
  "fin-004": ["admin", "gerente", "financeiro"],
  "fin-006": ["admin", "gerente", "financeiro"],
  "aud-001": ["admin", "gerente"],
};

/**
 * true se `role` satisfaz algum dos papéis exigidos. "owner" é sempre
 * tratado como equivalente a "admin" — sem isso, o próprio dono da loja
 * ficaria bloqueado dos próprios relatórios (nenhum array de permissao
 * acima lista "owner" literalmente).
 */
export function temPermissao(role: StoreRole | null | undefined, required: readonly Permissao[]): boolean {
  if (!role) return false;
  const efetivo: Permissao = role === "owner" ? "admin" : role;
  return required.includes(efetivo);
}
