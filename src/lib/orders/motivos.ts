// Motivos padrão de cancelamento / estorno de venda.
// Módulo puro (sem dependência de DB nem de React) — importado tanto pelo
// motor de estorno no Worker (src/lib/orders/estorno.ts) quanto pelos
// componentes do painel (modal de cancelamento, filtros de relatório).

export interface MotivoOption { value: string; label: string }

export const MOTIVOS_CANCELAMENTO: MotivoOption[] = [
  { value: "cliente",   label: "Desistência do cliente" },
  { value: "estoque",   label: "Sem estoque" },
  { value: "preco",     label: "Preço incompatível" },
  { value: "endereco",  label: "Endereço fora da área de entrega" },
  { value: "duplicado", label: "Pedido duplicado" },
  { value: "erro",      label: "Erro de cadastro / lançamento" },
  { value: "outro",     label: "Outro motivo" },
];

export const MOTIVOS_ESTORNO: MotivoOption[] = [
  { value: "defeito",   label: "Produto com defeito / troca" },
  { value: "devolucao", label: "Devolução do cliente" },
  { value: "cobranca",  label: "Cobrança indevida" },
  { value: "valor",     label: "Erro no valor cobrado" },
  { value: "duplicado", label: "Venda duplicada" },
  { value: "gateway",   label: "Estorno pelo meio de pagamento" },
  { value: "erro",      label: "Erro de lançamento" },
  { value: "outro",     label: "Outro motivo" },
];

const LABELS = new Map<string, string>(
  [...MOTIVOS_CANCELAMENTO, ...MOTIVOS_ESTORNO].map((m) => [m.value, m.label]),
);

/** Texto legível do motivo: "Erro no valor cobrado — troco errado". */
export function motivoLabel(code?: string | null, note?: string | null): string {
  const base = code ? (LABELS.get(code) ?? code) : null;
  const obs = note?.trim() || null;
  if (base && obs) return `${base} — ${obs}`;
  return base || obs || "Sem motivo informado";
}
