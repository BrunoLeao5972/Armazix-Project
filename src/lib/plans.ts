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
  /** Pro e Full incluem o PDV sem custo adicional (ver PlansSection.tsx) —
   *  free/start só têm PDV se comprarem o add-on pago (PDV_PRICE), à parte. */
  pdvIncluded: boolean;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free:  { id: "free",  name: "Experimente", price: 0,      pixPrice: 0,      maxProducts: 15, trialDays: 10, mpReason: "Plano Experimente — Armazix", pdvIncluded: false },
  start: { id: "start", name: "Start",       price: 79.90,  pixPrice: 84.90,  maxProducts: 25,                mpReason: "Plano Start — Armazix",       pdvIncluded: false },
  pro:   { id: "pro",   name: "Pro",         price: 149.90, pixPrice: 154.90, maxProducts: 70,                mpReason: "Plano Pro — Armazix",         pdvIncluded: true  },
  full:  { id: "full",  name: "Full",        price: 249.90, pixPrice: 254.90, maxProducts: null,               mpReason: "Plano Full — Armazix",        pdvIncluded: true  },
};

/** Duração do teste grátis, em dias — hoje 10. */
export const TRIAL_DAYS = PLANS.free.trialDays!;

/** Resolve um plano por id, com fallback seguro pro "free" se vier algo desconhecido/nulo. */
export function getPlan(planId: string | null | undefined): PlanDef {
  return (planId && planId in PLANS) ? PLANS[planId as PlanId] : PLANS.free;
}

/**
 * Loja tem PDV liberado: ou comprou o add-on separado (pdvEnabled, planos
 * Free/Start), ou está num plano que já inclui PDV sem custo adicional
 * (Pro/Full), E a assinatura precisa estar ativa. Fonte única de verdade —
 * usada tanto pelo gate server-side (pdv-handler.ts) quanto pela checagem
 * client-side equivalente (pedidos.tsx), pra nunca divergir sobre se uma
 * loja "tem PDV" ou não.
 */
export function hasPdvAccess(store: {
  pdvEnabled?: boolean | null;
  plan?: string | null;
  planStatus?: string | null;
} | null | undefined): boolean {
  const pdvUnlocked = !!store?.pdvEnabled || getPlan(store?.plan).pdvIncluded;
  return pdvUnlocked && store?.planStatus === "active";
}

/**
 * Loja com o plano vencido/sem assinatura ativa — usada pra bloquear o
 * acesso ao admin inteiro (ver requireAuth em src/lib/middleware/auth.ts e
 * o wrapper em src/routes/admin.tsx), não só o PDV como hasPdvAccess().
 *
 * Não dá pra confiar só em planStatus === "expired": esse valor só é
 * setado de forma preguiçosa (autoExpirePixPlan(), dentro de
 * getSubscriptionStatusHandler, e só pra planos PIX) — uma assinatura em
 * cartão que a Mercado Pago parou de renovar sem mandar webhook fica com
 * planStatus "active" e planExpiresAt no passado indefinidamente. Por
 * isso a data manda: qualquer planExpiresAt no passado (ou nulo — o
 * estado de uma assinatura cancelada/pausada) bloqueia, mesmo que o
 * status ainda não tenha sido corrigido em nenhum lugar.
 */
export function isStorePlanBlocked(store: {
  planStatus?: string | null;
  planExpiresAt?: string | Date | null;
} | null | undefined): boolean {
  if (!store) return false;
  if (store.planStatus !== "active") return true;
  if (!store.planExpiresAt) return true;
  return new Date(store.planExpiresAt).getTime() < Date.now();
}

/** Formata em R$ com vírgula, ex: 79.9 → "79,90". */
export function formatPlanPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
