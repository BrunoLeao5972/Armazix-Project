import { createDb, createTenantDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and, notInArray } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import type { PaymentMethodConfig } from "@/lib/store-context";

const { paymentMethods, paymentMethodsToPlans, stores } = schema;
type Db = ReturnType<typeof createDb>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type MethodWithPlans = PaymentMethodConfig & { id: string; allowedPlanIds: string[] };

function toMethodConfig(row: typeof paymentMethods.$inferSelect, allowedPlanIds: string[]): MethodWithPlans {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    sigla: row.sigla ?? undefined,
    enabled: row.enabled,
    especie: (row.especie ?? undefined) as PaymentMethodConfig["especie"],
    operacao: row.operacao as PaymentMethodConfig["operacao"],
    maxInstallments: row.maxInstallments,
    payAtDelivery: row.payAtDelivery ?? undefined,
    parcelamentoAtivo: row.parcelamentoAtivo ?? undefined,
    taxasPorParcela: row.taxasPorParcela ?? [],
    repassarTaxaCliente: row.repassarTaxaCliente ?? undefined,
    pixKeyType: row.pixKeyType as PaymentMethodConfig["pixKeyType"],
    pixKey: row.pixKey ?? undefined,
    pixQrCodeUrl: row.pixQrCodeUrl ?? undefined,
    config: (row.mpPublicKey || row.mpAccessToken)
      ? { mercadoPago: { publicKey: row.mpPublicKey ?? "", accessToken: row.mpAccessToken ?? "" } }
      : undefined,
    allowedPlanIds,
  };
}

// Migra, uma única vez, a config legada (stores.payment_methods_config) pra
// tabela normalizada — só roda quando a tabela nova está genuinamente vazia
// pra essa loja, então nunca sobrescreve edições feitas depois da migração.
// Existe pra não repetir o incidente da brunoinfomais: lojas com config
// antiga real perdendo a visibilidade dela pra tela mostrar os padrões
// genéricos assim que a tabela normalizada passou a ser a fonte de verdade.
async function backfillFromLegacyConfig(db: Db, storeId: string): Promise<MethodWithPlans[]> {
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
    columns: { paymentMethodsConfig: true },
  });

  const legacy = store?.paymentMethodsConfig;
  if (!legacy?.length) return [];

  console.warn(`[payment-methods] Backfill de config legada para storeId=${storeId} (${legacy.length} métodos)`);

  const saved: MethodWithPlans[] = [];
  for (let i = 0; i < legacy.length; i++) {
    const m = legacy[i];
    const values = {
      label: m.label,
      sigla: m.sigla || null,
      enabled: m.enabled,
      especie: m.especie || null,
      operacao: m.operacao || null,
      maxInstallments: m.maxInstallments,
      payAtDelivery: m.payAtDelivery ?? true,
      parcelamentoAtivo: m.parcelamentoAtivo ?? false,
      taxasPorParcela: m.taxasPorParcela ?? [],
      repassarTaxaCliente: m.repassarTaxaCliente ?? false,
      pixKeyType: m.pixKeyType || null,
      pixKey: m.pixKey || null,
      pixQrCodeUrl: m.pixQrCodeUrl || null,
      mpPublicKey: m.config?.mercadoPago?.publicKey || null,
      mpAccessToken: m.config?.mercadoPago?.accessToken || null,
      position: i,
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(paymentMethods)
      .values({ storeId, key: m.key, ...values })
      .onConflictDoUpdate({ target: [paymentMethods.storeId, paymentMethods.key], set: values })
      .returning();
    saved.push(toMethodConfig(row, []));
  }
  return saved;
}

// ─── GET /api/payment-methods/list ────────────────────────────────
// Formas de pagamento cadastradas + planos permitidos, para o editor em Gerais.
export async function listPaymentMethodsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const rows = await db.query.paymentMethods.findMany({
      where: eq(paymentMethods.storeId, storeId),
      orderBy: (m, { asc }) => [asc(m.position), asc(m.createdAt)],
      with: { methodPlans: { columns: { paymentPlanId: true } } },
    });

    if (rows.length === 0) {
      const backfilled = await backfillFromLegacyConfig(db, storeId);
      if (backfilled.length > 0) return json({ methods: backfilled });
    }

    const methods = rows.map(row => toMethodConfig(row, row.methodPlans.map(mp => mp.paymentPlanId)));
    return json({ methods });
  } catch (error) {
    console.error("List payment methods error:", error);
    return json({ error: "Erro ao listar formas de pagamento" }, 500);
  }
}

// ─── POST /api/payment-methods/save ───────────────────────────────
// Upsert por (storeId, key) — preserva o id das formas existentes (e portanto
// os vínculos na tabela pivô payment_methods_to_plans) e remove as excluídas.
export async function savePaymentMethodsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    methods: Array<PaymentMethodConfig & { allowedPlanIds?: string[] }>;
  };
  if (!Array.isArray(body.methods)) return json({ error: "methods obrigatório" }, 400);

  const dbUrl = process.env.DATABASE_URL!;
  const db = await createTenantDb(dbUrl, storeId);

  try {
    const incomingKeys = body.methods.map(m => m.key);

    if (incomingKeys.length > 0) {
      await db.delete(paymentMethods).where(
        and(eq(paymentMethods.storeId, storeId), notInArray(paymentMethods.key, incomingKeys))
      );
    } else {
      await db.delete(paymentMethods).where(eq(paymentMethods.storeId, storeId));
    }

    const saved: MethodWithPlans[] = [];

    for (let i = 0; i < body.methods.length; i++) {
      const m = body.methods[i];
      const values = {
        label: m.label,
        sigla: m.sigla || null,
        enabled: m.enabled,
        especie: m.especie || null,
        operacao: m.operacao || null,
        maxInstallments: m.maxInstallments,
        payAtDelivery: m.payAtDelivery ?? true,
        parcelamentoAtivo: m.parcelamentoAtivo ?? false,
        taxasPorParcela: m.taxasPorParcela ?? [],
        repassarTaxaCliente: m.repassarTaxaCliente ?? false,
        pixKeyType: m.pixKeyType || null,
        pixKey: m.pixKey || null,
        pixQrCodeUrl: m.pixQrCodeUrl || null,
        mpPublicKey: m.config?.mercadoPago?.publicKey || null,
        mpAccessToken: m.config?.mercadoPago?.accessToken || null,
        position: i,
        updatedAt: new Date(),
      };

      const [row] = await db
        .insert(paymentMethods)
        .values({ storeId, key: m.key, ...values })
        .onConflictDoUpdate({
          target: [paymentMethods.storeId, paymentMethods.key],
          set: values,
        })
        .returning();

      // Sincroniza os planos permitidos deste método (mesmo padrão de product-sectors).
      await db.delete(paymentMethodsToPlans).where(eq(paymentMethodsToPlans.paymentMethodId, row.id));
      const planIds = [...new Set((m.allowedPlanIds ?? []).filter(Boolean))];
      if (planIds.length > 0) {
        await db.insert(paymentMethodsToPlans).values(
          planIds.map(paymentPlanId => ({ paymentMethodId: row.id, paymentPlanId }))
        );
      }

      saved.push(toMethodConfig(row, planIds));
    }

    return json({ success: true, methods: saved });
  } catch (error) {
    console.error("Save payment methods error:", error);
    return json({ error: "Erro ao salvar formas de pagamento" }, 500);
  }
}

// ─── GET /api/payment-methods/for-pdv ─────────────────────────────
// Formas habilitadas + planos permitidos, para o caixa do PDV montar as
// opções de parcelamento dinamicamente conforme a forma escolhida.
export async function listPaymentMethodsForPdvHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    const access = await requireStoreAccess(auth);
    storeId = access.storeId;
  } catch (error) {
    return json({ error: (error as Error).message }, auth?.userId ? 403 : 401);
  }

  const dbUrl = process.env.DATABASE_URL!;
  const db = createDb(dbUrl);

  try {
    const rows = await db.query.paymentMethods.findMany({
      where: and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.enabled, true)),
      orderBy: (m, { asc }) => [asc(m.position)],
      with: { methodPlans: { with: { plan: true } } },
    });

    const methods = rows.map(row => ({
      id: row.id,
      key: row.key,
      label: row.label,
      sigla: row.sigla,
      especie: row.especie,
      maxInstallments: row.maxInstallments,
      plans: row.methodPlans
        .map(mp => mp.plan)
        .filter((p): p is NonNullable<typeof p> => !!p && p.ativo)
        .sort((a, b) => a.codigo - b.codigo)
        .map(p => ({
          id: p.id, codigo: p.codigo, nome: p.nome,
          tipo: p.tipo, parcelas: p.parcelas, quantidade: p.quantidade,
        })),
    }));

    return json({ methods });
  } catch (error) {
    console.error("List payment methods for PDV error:", error);
    return json({ error: "Erro ao listar formas de pagamento" }, 500);
  }
}
