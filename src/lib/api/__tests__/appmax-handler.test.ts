// Testes do módulo Appmax — cobre o processamento de webhook (eventos
// essenciais: pago, estornado, chargeback, pedido não encontrado, evento
// desconhecido) e o fluxo de configuração (status/desconectar).
// O fluxo de conexão OAuth (appmax-connect/appmax-callback) e o checkout
// (chamadas reais à API da Appmax) não são cobertos aqui — os endpoints e
// campos exatos dependem de validação contra o sandbox (ver README.md).

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOrdersFindFirst = vi.fn();
const mockStoreUsersFindFirst = vi.fn();
const mockStoreFindFirst = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockInsertValues = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  createDb: () => ({
    query: {
      orders: { findFirst: mockOrdersFindFirst },
      storeUsers: { findFirst: mockStoreUsersFindFirst },
      stores: { findFirst: mockStoreFindFirst },
    },
    update: () => ({ set: () => ({ where: mockUpdateWhere }) }),
    insert: () => ({ values: mockInsertValues }),
  }),
  schema: {
    orders: { id: "id", appmaxOrderId: "appmaxOrderId", storeId: "storeId" },
    orderTimeline: {},
    auditLogs: {},
    stores: { id: "id" },
    storeUsers: { userId: "userId", storeId: "storeId" },
  },
}));

function makeAuth(userId: string, storeId: string) {
  return { userId, storeId };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "mock://db";
});

describe("APPMAX_EVENT_MAP — cobertura dos eventos pedidos", () => {
  it("mapeia todos os eventos essenciais da primeira fase", async () => {
    const { APPMAX_EVENT_MAP } = await import("@/lib/api/appmax-handler");

    const expectedEvents = [
      "order_approved", "order_paid", "order_authorized", "order_integrated",
      "order_refund", "order_chargeback_in_treatment",
      "order_pix_created", "order_paid_by_pix", "order_pix_expired",
      "order_billet_created", "order_billet_overdue",
      "payment_not_authorized", "payment_authorized_with_delay", "order_authorized_with_delay",
    ];

    for (const event of expectedEvents) {
      expect(APPMAX_EVENT_MAP, `evento ausente: ${event}`).toHaveProperty(event);
      expect(APPMAX_EVENT_MAP[event].paymentStatus).toMatch(/^(pending|paid|failed|refunded)$/);
      expect(APPMAX_EVENT_MAP[event].orderStatus).toMatch(/^(received|confirmed|cancelled)$/);
    }
  });

  it("pago e integrado resultam em paymentStatus=paid", async () => {
    const { APPMAX_EVENT_MAP } = await import("@/lib/api/appmax-handler");
    expect(APPMAX_EVENT_MAP.order_paid.paymentStatus).toBe("paid");
    expect(APPMAX_EVENT_MAP.order_paid_by_pix.paymentStatus).toBe("paid");
    expect(APPMAX_EVENT_MAP.order_integrated.paymentStatus).toBe("paid");
  });

  it("estorno resulta em paymentStatus=refunded e pedido cancelado", async () => {
    const { APPMAX_EVENT_MAP } = await import("@/lib/api/appmax-handler");
    expect(APPMAX_EVENT_MAP.order_refund).toEqual({
      paymentStatus: "refunded", orderStatus: "cancelled", note: expect.any(String),
    });
  });
});

describe("extractAppmaxOrderId", () => {
  it("extrai de data.order.id", async () => {
    const { extractAppmaxOrderId } = await import("@/lib/api/appmax-handler");
    expect(extractAppmaxOrderId({ event: "order_paid", data: { order: { id: 113 } } })).toBe("113");
  });

  it("extrai de data.id quando não há data.order", async () => {
    const { extractAppmaxOrderId } = await import("@/lib/api/appmax-handler");
    expect(extractAppmaxOrderId({ event: "order_paid", data: { id: "abc" } })).toBe("abc");
  });

  it("retorna null quando não há identificador", async () => {
    const { extractAppmaxOrderId } = await import("@/lib/api/appmax-handler");
    expect(extractAppmaxOrderId({ event: "order_paid", data: {} })).toBeNull();
    expect(extractAppmaxOrderId({ event: "order_paid" })).toBeNull();
  });
});

describe("processAppmaxWebhookEvent — eventos essenciais", () => {
  it("order_paid: atualiza o pedido para pago/confirmado e audita sucesso", async () => {
    mockOrdersFindFirst.mockResolvedValue({ id: "order-1", storeId: "store-1", appmaxOrderId: "113" });

    const { processAppmaxWebhookEvent } = await import("@/lib/api/appmax-handler");
    await processAppmaxWebhookEvent({ event: "order_paid", data: { order: { id: 113, status: "aprovado" } } });

    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    // dois inserts: order_timeline + audit_logs
    expect(mockInsertValues).toHaveBeenCalledTimes(2);
    const timelineCall = mockInsertValues.mock.calls[0][0];
    expect(timelineCall).toMatchObject({ orderId: "order-1", status: "confirmed" });
    const auditCall = mockInsertValues.mock.calls[1][0];
    expect(auditCall).toMatchObject({ storeId: "store-1", status: "success", modulo: "PAGAMENTO_APPMAX" });
  });

  it("order_refund: marca o pedido como estornado/cancelado", async () => {
    mockOrdersFindFirst.mockResolvedValue({ id: "order-2", storeId: "store-1", appmaxOrderId: "114" });

    const { processAppmaxWebhookEvent } = await import("@/lib/api/appmax-handler");
    await processAppmaxWebhookEvent({ event: "order_refund", data: { order: { id: 114 } } });

    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    const timelineCall = mockInsertValues.mock.calls[0][0];
    expect(timelineCall).toMatchObject({ orderId: "order-2", status: "cancelled" });
  });

  it("order_chargeback_in_treatment: mantém o pedido visível mas registra o chargeback", async () => {
    mockOrdersFindFirst.mockResolvedValue({ id: "order-3", storeId: "store-1", appmaxOrderId: "115" });

    const { processAppmaxWebhookEvent } = await import("@/lib/api/appmax-handler");
    await processAppmaxWebhookEvent({ event: "order_chargeback_in_treatment", data: { order: { id: 115 } } });

    const timelineCall = mockInsertValues.mock.calls[0][0];
    expect(timelineCall.note).toMatch(/chargeback/i);
    expect(timelineCall.status).toBe("received");
  });

  it("pedido não encontrado: audita erro e não atualiza nada", async () => {
    mockOrdersFindFirst.mockResolvedValue(undefined);

    const { processAppmaxWebhookEvent } = await import("@/lib/api/appmax-handler");
    await processAppmaxWebhookEvent({ event: "order_paid", data: { order: { id: 999 } } });

    expect(mockUpdateWhere).not.toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledTimes(1); // só o audit log de erro
    const auditCall = mockInsertValues.mock.calls[0][0];
    expect(auditCall).toMatchObject({ status: "error", resourceId: "999" });
  });

  it("evento desconhecido: audita erro sem quebrar e sem atualizar o pedido", async () => {
    mockOrdersFindFirst.mockResolvedValue({ id: "order-4", storeId: "store-1", appmaxOrderId: "116" });

    const { processAppmaxWebhookEvent } = await import("@/lib/api/appmax-handler");
    await processAppmaxWebhookEvent({ event: "some_future_event", data: { order: { id: 116 } } });

    expect(mockUpdateWhere).not.toHaveBeenCalled();
    const auditCall = mockInsertValues.mock.calls[0][0];
    expect(auditCall).toMatchObject({ status: "error", errorMessage: "Evento não mapeado" });
  });
});

describe("appmaxWebhookHandler — validação de segurança", () => {
  it("responde 500 quando WEBHOOK_API_KEY não está configurado", async () => {
    delete process.env.WEBHOOK_API_KEY;
    const { appmaxWebhookHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-webhook", {
      method: "POST", body: JSON.stringify({ event: "order_paid", data: {} }),
    });
    const res = await appmaxWebhookHandler(req);
    expect(res.status).toBe(500);
  });

  it("responde 401 sem a chave (nem query string nem header)", async () => {
    process.env.WEBHOOK_API_KEY = "segredo-123";
    const { appmaxWebhookHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-webhook", {
      method: "POST", body: JSON.stringify({ event: "order_paid", data: {} }),
    });
    const res = await appmaxWebhookHandler(req);
    expect(res.status).toBe(401);
  });

  it("aceita a chave via query string (?key=) — único jeito de proteger a URL fixa da Appmax", async () => {
    process.env.WEBHOOK_API_KEY = "segredo-123";
    mockOrdersFindFirst.mockResolvedValue({ id: "order-5", storeId: "store-1", appmaxOrderId: "117" });

    const { appmaxWebhookHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-webhook?key=segredo-123", {
      method: "POST", body: JSON.stringify({ event: "order_paid", data: { order: { id: 117 } } }),
    });
    const res = await appmaxWebhookHandler(req);
    expect(res.status).toBe(200);
  });
});

describe("getAppmaxStatusHandler / disconnectAppmaxHandler — fluxo de configuração", () => {
  it("getAppmaxStatusHandler retorna 401 sem auth", async () => {
    const { getAppmaxStatusHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-status");
    const res = await getAppmaxStatusHandler(req, undefined);
    expect(res.status).toBe(401);
  });

  it("getAppmaxStatusHandler retorna connected=true quando há client_id salvo", async () => {
    mockStoreUsersFindFirst.mockResolvedValue({ userId: "u1", storeId: "s1", role: "owner" });
    mockStoreFindFirst.mockResolvedValue({ appmaxClientId: "enc(...)", appmaxConnectedAt: new Date("2026-01-01") });

    const { getAppmaxStatusHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-status");
    const res = await getAppmaxStatusHandler(req, makeAuth("u1", "s1"));
    const body = await res.json() as { connected: boolean };
    expect(res.status).toBe(200);
    expect(body.connected).toBe(true);
  });

  it("disconnectAppmaxHandler exige owner/admin (403 para role insuficiente)", async () => {
    mockStoreUsersFindFirst.mockResolvedValue({ userId: "u1", storeId: "s1", role: "cashier" });

    const { disconnectAppmaxHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-disconnect", { method: "POST" });
    const res = await disconnectAppmaxHandler(req, makeAuth("u1", "s1"));
    expect(res.status).toBe(403);
  });

  it("disconnectAppmaxHandler limpa as credenciais para owner", async () => {
    mockStoreUsersFindFirst.mockResolvedValue({ userId: "u1", storeId: "s1", role: "owner" });

    const { disconnectAppmaxHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-disconnect", { method: "POST" });
    const res = await disconnectAppmaxHandler(req, makeAuth("u1", "s1"));
    expect(res.status).toBe(200);
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });
});

describe("appmaxHealthHandler — URL de validação (Configuração de URLs)", () => {
  it("sem identificador de instalação: responde ok genérico (ping de uptime)", async () => {
    const { appmaxHealthHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-health");
    const res = await appmaxHealthHandler(req);
    const body = await res.json() as { status: string; external_id?: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.external_id).toBeUndefined();
  });

  it("com external_key de uma loja já conectada: devolve o external_id salvo", async () => {
    mockStoreFindFirst.mockResolvedValue({ appmaxExternalId: "11111111-1111-1111-1111-111111111111" });

    const { appmaxHealthHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-health?external_key=store-1");
    const res = await appmaxHealthHandler(req);
    const body = await res.json() as { status: string; external_id: string };
    expect(res.status).toBe(200);
    expect(body.external_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(mockUpdateWhere).not.toHaveBeenCalled(); // já existia — não regenera
  });

  it("com external_key de uma loja sem external_id ainda: gera e salva um novo", async () => {
    mockStoreFindFirst.mockResolvedValue({ appmaxExternalId: null });

    const { appmaxHealthHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-health?external_key=store-1");
    const res = await appmaxHealthHandler(req);
    const body = await res.json() as { status: string; external_id: string };
    expect(res.status).toBe(200);
    expect(body.external_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("aceita o identificador via header x-external-key também", async () => {
    mockStoreFindFirst.mockResolvedValue({ appmaxExternalId: "22222222-2222-2222-2222-222222222222" });

    const { appmaxHealthHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-health", {
      headers: { "x-external-key": "store-1" },
    });
    const res = await appmaxHealthHandler(req);
    const body = await res.json() as { external_id: string };
    expect(res.status).toBe(200);
    expect(body.external_id).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("loja não encontrada: responde 404 sem quebrar", async () => {
    mockStoreFindFirst.mockResolvedValue(undefined);

    const { appmaxHealthHandler } = await import("@/lib/api/appmax-handler");
    const req = new Request("https://app.test/api/payments/appmax-health?external_key=inexistente");
    const res = await appmaxHealthHandler(req);
    expect(res.status).toBe(404);
  });
});
