/**
 * Regressão do webhook de pedidos do Mercado Pago (achado A-3 / mesma classe do C-4).
 *
 * O handler antigo:
 *   - resolvia o pedido pelo `external_reference` que vinha NO CORPO;
 *   - consultava o pagamento no MP mas nunca conferia se ele apontava de volta
 *     para aquele pedido;
 *   - nunca comparava o valor pago com o total do pedido;
 *   - não tinha guarda de replay, e um evento "pending" atrasado rebaixava um
 *     pedido já pago.
 *
 * Agora o corpo é só um gatilho: quem decide é o recurso lido de volta na API
 * do MP com o token da própria loja.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────

/**
 * Valores usados em cada eq(coluna, valor). É como provamos POR QUAL id o
 * pedido foi procurado — a diferença entre confiar no corpo e confiar no MP
 * não aparece no resultado, só na consulta.
 */
let eqValues: unknown[] = [];

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, value: unknown) => {
      eqValues.push(value);
      return actual.eq(col as never, value as never);
    },
  };
});

interface OrderRow {
  id: string;
  storeId: string;
  total: string;
  paymentStatus: string | null;
  gatewayPaymentId: string | null;
}

interface StoreRow {
  id: string;
  mpUserId: string | null;
  mpAccessToken: string | null;
}

let storeRow: StoreRow | null = null;
let orderRow: OrderRow | null = null;
let orderUpdates: Array<Record<string, unknown>> = [];
let timelineInserts: Array<Record<string, unknown>> = [];

vi.mock("@/lib/db", () => {
  const mockDb = () => ({
    query: {
      stores: { findFirst: () => Promise.resolve(storeRow) },
      orders: { findFirst: () => Promise.resolve(orderRow) },
    },
    update: (table: { __name?: string }) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if (table?.__name === "orders") orderUpdates.push(values);
          const p = Promise.resolve([{ id: orderRow?.id ?? "o1" }]) as Promise<unknown[]> & {
            returning: () => Promise<unknown[]>;
          };
          p.returning = () => Promise.resolve([{ id: orderRow?.id ?? "o1" }]);
          return p;
        },
      }),
    }),
    insert: (table: { __name?: string }) => ({
      values: (values: Record<string, unknown>) => {
        if (table?.__name === "order_timeline") timelineInserts.push(values);
        return Promise.resolve();
      },
    }),
  });
  return {
    createDb: mockDb,
    createUnscopedDb: () => Promise.resolve(mockDb()),
    schema: {
      stores:        { __name: "stores", id: "id", mpUserId: "mpUserId" },
      orders:        { __name: "orders", id: "id", storeId: "storeId" },
      orderItems:    { __name: "order_items" },
      products:      { __name: "products" },
      orderTimeline: { __name: "order_timeline" },
    },
  };
});

// Token "descriptografado" — o conteúdo não importa, só que exista.
vi.mock("@/lib/crypto", () => ({
  encrypt: (v: string) => Promise.resolve(`enc:${v}`),
  decrypt: (v: string) => Promise.resolve(v.startsWith("enc:") ? v.slice(4) : v),
}));

vi.mock("@/lib/execution-context", () => ({ waitUntil: vi.fn() }));

import { mpWebhookHandler } from "@/lib/api/payment-handler";

// ─── Cenário ────────────────────────────────────────────────────

const LOJA_ID     = "store-legit-111";
const MP_USER_ID  = "884455";
const PEDIDO_ID   = "order-aaa";
const PAYMENT_ID  = "9988776655";

/** Resposta que o MP devolve em GET /v1/payments/:id */
let mpPayment: Record<string, unknown> = {};
let mpStatus = 200;

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("/v1/payments/")) {
      return new Response(JSON.stringify(mpPayment), { status: mpStatus });
    }
    return new Response("{}", { status: 404 });
  });
}

function webhook(body: Record<string, unknown>, query = "?type=payment") {
  return new Request(`https://armazix.com.br/api/payments/mp-webhook${query}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL  = "postgres://test";
  process.env.ENCRYPTION_KEY = "chave-de-teste";

  storeRow = { id: LOJA_ID, mpUserId: MP_USER_ID, mpAccessToken: "enc:APP_USR-token" };
  orderRow = { id: PEDIDO_ID, storeId: LOJA_ID, total: "150.00", paymentStatus: "pending", gatewayPaymentId: null };

  mpStatus  = 200;
  mpPayment = {
    status: "approved",
    external_reference: PEDIDO_ID,
    transaction_amount: 150.0,
    currency_id: "BRL",
  };

  orderUpdates = [];
  timelineInserts = [];
  eqValues = [];
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => vi.unstubAllGlobals());

// ─── Caminho feliz ──────────────────────────────────────────────

describe("mpWebhookHandler — confirmação legítima", () => {
  it("A-3 #1 — marca como pago quando o MP confirma e o valor bate", async () => {
    const res = await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(res.status).toBe(200);
    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0]).toMatchObject({
      paymentStatus:    "paid",
      status:           "confirmed",
      gatewayPaymentId: PAYMENT_ID,
    });
    expect(timelineInserts).toHaveLength(1);
  });
});

// ─── O corpo não decide nada ────────────────────────────────────

describe("mpWebhookHandler — corpo é só gatilho", () => {
  it("A-3 #2 — status 'approved' no corpo não vale se o MP diz 'rejected'", async () => {
    mpPayment = { ...mpPayment, status: "rejected" };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, status: "approved", data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates[0]).toMatchObject({ paymentStatus: "failed", status: "cancelled" });
  });

  it("A-3 #3 — external_reference forjado no corpo é ignorado", async () => {
    // O atacante manda no corpo um pedido caro; o MP diz que o pagamento
    // pertence ao PEDIDO_ID. Só o do MP pode valer.
    await mpWebhookHandler(
      webhook({
        type: "payment", user_id: MP_USER_ID,
        external_reference: "order-caro-999",
        data: { id: PAYMENT_ID },
      }),
    );

    // A consulta foi feita pelo id vindo do MP, e o do corpo nunca apareceu.
    expect(eqValues).toContain(PEDIDO_ID);
    expect(eqValues).not.toContain("order-caro-999");
  });

  it("A-3 #4 — nada acontece sem user_id (loja não identificável)", async () => {
    await mpWebhookHandler(webhook({ type: "payment", data: { id: PAYMENT_ID } }));
    expect(orderUpdates).toHaveLength(0);
  });
});

// ─── Isolamento entre lojas ─────────────────────────────────────

describe("mpWebhookHandler — vínculo pedido↔loja", () => {
  it("A-3 #5 — bloqueia pagamento de uma loja liquidando pedido de outra", async () => {
    orderRow = {
      id: PEDIDO_ID, storeId: "store-de-outra-loja-222",
      total: "150.00", paymentStatus: "pending", gatewayPaymentId: null,
    };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates).toHaveLength(0);
  });
});

// ─── Valor ──────────────────────────────────────────────────────

describe("mpWebhookHandler — conferência de valor", () => {
  it("A-3 #6 — pagamento menor que o total não libera o pedido", async () => {
    mpPayment = { ...mpPayment, transaction_amount: 1.0 };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates).toHaveLength(0);
  });

  it("A-3 #7 — diferença de 1 centavo por arredondamento é tolerada", async () => {
    mpPayment = { ...mpPayment, transaction_amount: 149.995 };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates[0]).toMatchObject({ paymentStatus: "paid" });
  });

  it("A-3 #8 — moeda diferente de BRL não libera", async () => {
    mpPayment = { ...mpPayment, currency_id: "ARS" };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates).toHaveLength(0);
  });
});

// ─── Replay e ordem dos eventos ─────────────────────────────────

describe("mpWebhookHandler — idempotência", () => {
  it("A-3 #9 — reenvio do mesmo pagamento não reprocessa", async () => {
    orderRow = {
      id: PEDIDO_ID, storeId: LOJA_ID, total: "150.00",
      paymentStatus: "paid", gatewayPaymentId: PAYMENT_ID,
    };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates).toHaveLength(0);
    expect(timelineInserts).toHaveLength(0);
  });

  it("A-3 #10 — evento 'pending' atrasado não rebaixa pedido já pago", async () => {
    orderRow = {
      id: PEDIDO_ID, storeId: LOJA_ID, total: "150.00",
      paymentStatus: "paid", gatewayPaymentId: "pagamento-anterior",
    };
    mpPayment = { ...mpPayment, status: "pending" };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates).toHaveLength(0);
  });

  it("A-3 #11 — estorno é a única transição que sai de 'paid'", async () => {
    orderRow = {
      id: PEDIDO_ID, storeId: LOJA_ID, total: "150.00",
      paymentStatus: "paid", gatewayPaymentId: PAYMENT_ID,
    };
    mpPayment = { ...mpPayment, status: "refunded" };

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    expect(orderUpdates[0]).toMatchObject({ paymentStatus: "refunded", status: "cancelled" });
  });
});

// ─── Falhas do gateway ──────────────────────────────────────────

describe("mpWebhookHandler — resiliência", () => {
  it("A-3 #12 — não altera nada se a consulta ao MP falhar", async () => {
    mpStatus = 500;

    const res = await mpWebhookHandler(
      webhook({ type: "payment", user_id: MP_USER_ID, data: { id: PAYMENT_ID } }),
    );

    // 200 para o MP não ficar retentando, mas sem aplicar nada.
    expect(res.status).toBe(200);
    expect(orderUpdates).toHaveLength(0);
  });

  it("A-3 #13 — loja desconhecida não dispara consulta ao gateway", async () => {
    storeRow = null;

    await mpWebhookHandler(
      webhook({ type: "payment", user_id: "999999", data: { id: PAYMENT_ID } }),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(orderUpdates).toHaveLength(0);
  });
});
