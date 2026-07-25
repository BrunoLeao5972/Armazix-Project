import { createDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getPlan } from "@/lib/plans";

const { stores, products } = schema;

export interface ProductLimitCheck {
  allowed: boolean;
  current: number;
  limit: number | null;
  planId: string;
  planName: string;
}

/**
 * Verifica se a loja ainda pode cadastrar mais um produto, de acordo com o
 * limite do plano atual (src/lib/plans.ts). Chamado antes de qualquer
 * INSERT em products — nunca confia em nada vindo do frontend.
 */
export async function canCreateProduct(
  db: ReturnType<typeof createDb>,
  storeId: string,
): Promise<ProductLimitCheck> {
  const [store] = await db
    .select({ plan: stores.plan })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  const plan = getPlan(store?.plan);

  if (plan.maxProducts === null) {
    return { allowed: true, current: 0, limit: null, planId: plan.id, planName: plan.name };
  }

  const [{ total }] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(products)
    .where(eq(products.storeId, storeId));

  return {
    allowed: total < plan.maxProducts,
    current: total,
    limit: plan.maxProducts,
    planId: plan.id,
    planName: plan.name,
  };
}
