// ─────────────────────────────────────────────────────────────────────────
// Fonte única de verdade dos planos do Armazix — preço, limite de produtos
// e duração do teste grátis. Landing page, cadastro, tela de Planos e o
// enforcement de backend (cobrança + limite de produtos) devem importar
// daqui — nunca duplicar esses números em outro arquivo. Foi exatamente a
// falta disso que causou preços divergentes entre 4 telas diferentes.
// ─────────────────────────────────────────────────────────────────────────

export type PlanId = "free" | "start" | "pro" | "full";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Valor mensal cobrado no cartão (R$). 0 para o plano free. */
  price: number;
  /** Valor cobrado via PIX (inclui pequena sobretaxa). 0 para o plano free. */
  pixPrice: number;
  /** Limite de produtos cadastrados. null = ilimitado. */
  maxProducts: number | null;
  /** Só o plano free tem — duração do teste grátis, em dias. */
  trialDays?: number;
  /** Descrição enviada pro Mercado Pago na cobrança (reason/description). */
  mpReason: string;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free:  { id: "free",  name: "Experimente", price: 0,      pixPrice: 0,      maxProducts: 15, trialDays: 10, mpReason: "Plano Experimente — Armazix" },
  start: { id: "start", name: "Start",       price: 79.90,  pixPrice: 84.90,  maxProducts: 25,                mpReason: "Plano Start — Armazix" },
  pro:   { id: "pro",   name: "Pro",         price: 149.90, pixPrice: 154.90, maxProducts: 70,                mpReason: "Plano Pro — Armazix" },
  full:  { id: "full",  name: "Full",        price: 249.90, pixPrice: 254.90, maxProducts: null,               mpReason: "Plano Full — Armazix" },
};

/** Duração do teste grátis, em dias — hoje 10. */
export const TRIAL_DAYS = PLANS.free.trialDays!;

/** Resolve um plano por id, com fallback seguro pro "free" se vier algo desconhecido/nulo. */
export function getPlan(planId: string | null | undefined): PlanDef {
  return (planId && planId in PLANS) ? PLANS[planId as PlanId] : PLANS.free;
}

/** Formata em R$ com vírgula, ex: 79.9 → "79,90". */
export function formatPlanPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
