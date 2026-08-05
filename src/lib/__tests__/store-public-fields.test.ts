/**
 * Regressão do A-1 — GET /api/store/get expunha campos sensíveis.
 *
 * O handler antigo removia só 5 campos (mpAccessToken, plan, planStatus,
 * planExpiresAt, mpSubscriptionId) e devolvia o resto da linha de `stores`
 * inteira — incluindo mpUserId, cnpj, ownerName, wppConfig (que carrega o
 * telefone do dono) e o restante do bloco de billing.
 *
 * Agora a projeção é uma allowlist: só o que a vitrine realmente usa entra na
 * resposta. `ownerName` é a única exceção, liberada apenas para quem prova
 * pelo cookie de sessão ser membro da MESMA loja — e nesse caso a resposta
 * deixa de ser cacheável publicamente.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const LOJA_ID = "store-vitima-111";

const STORE_ROW = {
  id: LOJA_ID,
  slug: "loja-da-vitima",
  name: "Loja da Vítima",
  description: "desc",
  logoUrl: null, bannerUrl: null, bannerMobileUrl: null, bannerIntervalMs: 5000,
  primaryColor: "#000", backgroundColor: null, textColor: null, accentColor: null, font: "Inter",
  cnpj: "11.222.333/0001-44",
  ownerName: "João da Vítima",
  phone: "11999990000",
  email: "contato@lojadavitima.com",
  address: { street: "Rua X", number: "1", neighborhood: "Centro", city: "SP", state: "SP", zip: "01000-000" },
  deliveryEnabled: true, pickupEnabled: true, deliveryFee: "10.00",
  minDeliveryOrder: "0", deliveryEstimate: "30-50 min",
  businessHours: [], showPrice: true,
  whatsappOrderEnabled: true, whatsappPhone: "11999990000",
  highlightLowStock: false, allowNegativeStock: true, layoutType: "grid",
  mpAccessToken: "SECRETO-nao-pode-vazar",
  mpPublicKey: "APP_USR-public-key-ok",
  mpUserId: "884455",
  paymentMethodsConfig: null, deliveryPaymentEnabled: true,
  deliveryRules: null, freeShippingAbove: null,
  paymentConfig: null,
  wppConfig: { notifyOwner: true, ownerPhone: "11988887777", ownerTemplate: "x", notifyCustomer: true },
  deliveryConfig: null,
  plan: "pro", planStatus: "active", planExpiresAt: new Date(),
  mpSubscriptionId: "sub-123", paymentMethod: "card_recurring", pdvEnabled: true,
  mpPaymentId: "pay-999", amountPaid: "199.90", paymentStatus: "approved",
  rating: "4.8", active: true,
  createdAt: new Date(), updatedAt: new Date(),
};

// requireAuth() cacheia o resultado verificado por STRING DO TOKEN (isolate
// session cache, 10s de TTL) — em produção isso é seguro porque cada usuário
// tem um token único. Aqui, um Map por token evita que dois cenários que
// reusassem o mesmo texto de token colidissem no cache entre um teste e outro.
const TOKENS: Record<string, { userId: string; email: string; role: string; storeId?: string }> = {};

vi.mock("@/lib/db", () => {
  const mockDb = () => ({
    query: {
      stores: {
        findFirst: () => Promise.resolve({ ...STORE_ROW, banners: [] }),
      },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          // requireAuth() consulta { sessionVersion, active } de users, e
          // getStoreHandler consulta { ownerName } de stores — o mock não
          // diferencia por coluna, então devolve um objeto com os dois
          // conjuntos de campos pra cobrir as duas consultas.
          limit: () => Promise.resolve([{ ownerName: STORE_ROW.ownerName, active: true }]),
        }),
      }),
    }),
  });
  return {
    createDb: mockDb,
    createUnscopedDb: () => Promise.resolve(mockDb()),
    schema: {
      stores: {
        id: "id", ownerName: "ownerName",
        $inferSelect: {} as typeof STORE_ROW,
      },
      // requireAuth() consulta users.sessionVersion pra revogar sessões
      // antigas — os tokens de teste não emitem essa claim, então o mock
      // também não a retorna (undefined === undefined, checagem não dispara).
      users: { id: "id", sessionVersion: "sessionVersion", active: "active" },
      storeUsers: { userId: "userId", storeId: "storeId" },
    },
  };
});

// Cache sempre em miss — força o loader a rodar em todo teste, então o que
// importa é só o retorno da função de projeção, não o comportamento do cache.
vi.mock("@/lib/cache/redis", () => ({
  getCached: async (_key: string, loader: () => Promise<unknown>) => loader(),
  deleteKey: vi.fn(),
  storeCacheKey: (id: string) => `store:${id}:config`,
}));

vi.mock("@/lib/auth", () => ({
  verifyJWT: async (token: string) => TOKENS[token] ?? null,
}));

vi.mock("@/lib/audit", () => ({
  logSecurityEvent: vi.fn(),
  AuditActions: { MISSING_TENANT_CONTEXT: "x", IDOR_ATTEMPT: "y" },
}));

import { getStoreHandler } from "@/lib/api/store-handler";

function reqSlug() {
  return new Request("https://armazix.com.br/api/store/get?slug=loja-da-vitima");
}

function reqId(cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request(`https://armazix.com.br/api/store/get?id=${LOJA_ID}`, { headers });
}

const CAMPOS_PROIBIDOS = [
  "mpAccessToken", "mpUserId", "cnpj", "wppConfig",
  "plan", "planStatus", "planExpiresAt", "mpSubscriptionId",
  "paymentMethod", "pdvEnabled", "mpPaymentId", "amountPaid", "paymentStatus",
  "allowNegativeStock", "createdAt", "updatedAt",
];

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test";
  process.env.JWT_SECRET = "segredo-de-teste";
});

describe("getStoreHandler — visitante anônimo (busca por slug)", () => {
  it("A-1 #1 — nenhum campo sensível aparece na resposta", async () => {
    const res = await getStoreHandler(reqSlug());
    const body = await res.json() as { store: Record<string, unknown> };

    for (const campo of CAMPOS_PROIBIDOS) {
      expect(body.store).not.toHaveProperty(campo);
    }
  });

  it("A-1 #2 — mpAccessToken (segredo do gateway) nunca vaza, nem em outro nome", async () => {
    const res = await getStoreHandler(reqSlug());
    const raw = await res.text();
    expect(raw).not.toContain("SECRETO-nao-pode-vazar");
  });

  it("A-1 #3 — telefone do dono (dentro de wppConfig) não vaza", async () => {
    const res = await getStoreHandler(reqSlug());
    const raw = await res.text();
    expect(raw).not.toContain("11988887777");
  });

  it("A-1 #4 — ownerName não aparece para visitante anônimo", async () => {
    const res = await getStoreHandler(reqSlug());
    const body = await res.json() as { store: Record<string, unknown> };
    expect(body.store).not.toHaveProperty("ownerName");
  });

  it("A-1 #5 — campos que a vitrine precisa continuam presentes", async () => {
    const res = await getStoreHandler(reqSlug());
    const body = await res.json() as { store: Record<string, unknown> };

    expect(body.store).toMatchObject({
      id: LOJA_ID,
      name: "Loja da Vítima",
      phone: "11999990000",
      email: "contato@lojadavitima.com",
      mpPublicKey: "APP_USR-public-key-ok", // pública, uso legítimo no checkout
    });
    expect(body.store.address).toBeDefined();
    expect(body.store.businessHours).toBeDefined();
  });

  it("A-1 #6 — resposta anônima é cacheável publicamente", async () => {
    const res = await getStoreHandler(reqSlug());
    expect(res.headers.get("Cache-Control")).toMatch(/^public,/);
  });

  it("A-1 #7 — busca por id sem cookie de sessão não libera ownerName", async () => {
    const res = await getStoreHandler(reqId());
    const body = await res.json() as { store: Record<string, unknown> };
    expect(body.store).not.toHaveProperty("ownerName");
    expect(res.headers.get("Cache-Control")).toMatch(/^public,/);
  });
});

describe("getStoreHandler — dono autenticado da própria loja", () => {
  it("A-1 #8 — ownerName é anexado quando o cookie prova ser desta loja", async () => {
    TOKENS["token-dono-vitima"] = { userId: "u1", email: "dono@x.com", role: "merchant", storeId: LOJA_ID };

    const res = await getStoreHandler(reqId("armazix_token=token-dono-vitima"));
    const body = await res.json() as { store: Record<string, unknown> };

    expect(body.store.ownerName).toBe("João da Vítima");
  });

  it("A-1 #9 — mesmo autenticado, os campos de gateway/billing continuam fora", async () => {
    TOKENS["token-dono-vitima-2"] = { userId: "u1", email: "dono@x.com", role: "merchant", storeId: LOJA_ID };

    const res = await getStoreHandler(reqId("armazix_token=token-dono-vitima-2"));
    const body = await res.json() as { store: Record<string, unknown> };

    for (const campo of CAMPOS_PROIBIDOS) {
      expect(body.store).not.toHaveProperty(campo);
    }
  });

  it("A-1 #10 — resposta com ownerName não pode ser cacheada publicamente", async () => {
    TOKENS["token-dono-vitima-3"] = { userId: "u1", email: "dono@x.com", role: "merchant", storeId: LOJA_ID };

    const res = await getStoreHandler(reqId("armazix_token=token-dono-vitima-3"));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("getStoreHandler — tentativa cross-tenant", () => {
  it("A-1 #11 — cookie de OUTRA loja não libera o ownerName desta", async () => {
    TOKENS["token-atacante"] = { userId: "u2", email: "outro@x.com", role: "merchant", storeId: "store-atacante-999" };

    const res = await getStoreHandler(reqId("armazix_token=token-atacante"));
    const body = await res.json() as { store: Record<string, unknown> };

    expect(body.store).not.toHaveProperty("ownerName");
  });

  it("A-1 #12 — cookie inválido é tratado como anônimo, não derruba a resposta", async () => {
    const res = await getStoreHandler(reqId("armazix_token=lixo-invalido-nunca-registrado"));
    expect(res.status).toBe(200);
    const body = await res.json() as { store: Record<string, unknown> };
    expect(body.store).not.toHaveProperty("ownerName");
  });
});
