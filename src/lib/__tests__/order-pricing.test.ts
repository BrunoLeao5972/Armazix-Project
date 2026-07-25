/**
 * Regressão do C-2 — preço do pedido vinha do navegador.
 *
 * createOrderHandler gravava subtotal, discount e total exatamente como o
 * cliente mandou: um POST com total "0.01" criava pedido válido, baixava
 * estoque e notificava o lojista. O checkout do Mercado Pago recalculava só o
 * preço-base, ignorando adicionais, variação, promoção, frete e cupom.
 *
 * Agora os dois passam por priceOrder(), que decide tudo a partir do banco.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock do banco ──────────────────────────────────────────────
// Cada select() é roteado pela tabela consultada, então a ordem das chamadas
// dentro de priceOrder() não importa.

interface ProductRow {
  id: string; name: string; price: string;
  promoConfig: unknown; emoji: string | null; imageUrl: string | null;
  variationGroups: unknown; active: boolean;
}
interface AdditionRow { productId: string; name: string; price: string; active: boolean }
interface CouponRow {
  id: string; code: string; type: string; discount: string;
  minOrderValue: string | null; maxUses: number | null; usedCount: number | null;
  expiresAt: Date | null; active: boolean;
}
interface StoreRow {
  deliveryFee: string | null;
  deliveryRules: Array<{ bairro: string; taxa: number }> | null;
  freeShippingAbove: string | null;
}

let productRows: ProductRow[] = [];
let additionRows: AdditionRow[] = [];
let couponRows: CouponRow[] = [];
let storeRows: StoreRow[] = [];

function thenable(rows: unknown[]) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & { limit: (n: number) => Promise<unknown[]> };
  p.limit = () => Promise.resolve(rows);
  return p;
}

vi.mock("@/lib/db", () => {
  const mockDb = () => ({
    select: () => ({
      from: (table: { __name?: string }) => ({
        where: () => {
          switch (table?.__name) {
            case "products":          return thenable(productRows);
            case "product_additions": return thenable(additionRows);
            case "coupons":           return thenable(couponRows);
            case "stores":            return thenable(storeRows);
            default:                  return thenable([]);
          }
        },
      }),
    }),
  });
  return {
    createDb: mockDb,
    createTenantDb: () => Promise.resolve(mockDb()),
    schema: {
      products:         { __name: "products", id: "id", storeId: "storeId" },
      productAdditions: { __name: "product_additions", productId: "productId" },
      coupons:          { __name: "coupons", id: "id", storeId: "storeId", code: "code" },
      stores:           { __name: "stores", id: "id" },
    },
  };
});

import { priceOrder, isPricingFailure } from "@/lib/pricing/order-pricing";
import { createDb } from "@/lib/db";

// ─── Cenário ────────────────────────────────────────────────────

const LOJA = "store-1";

function produto(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "prod-1", name: "Pizza", price: "50.00",
    promoConfig: null, emoji: "🍕", imageUrl: null,
    variationGroups: null, active: true,
    ...over,
  };
}

const db = () => createDb("postgres://test");

async function price(input: Parameters<typeof priceOrder>[1]) {
  const r = await priceOrder(db(), input);
  return r;
}

beforeEach(() => {
  productRows  = [produto()];
  additionRows = [];
  couponRows   = [];
  storeRows    = [{ deliveryFee: "10.00", deliveryRules: null, freeShippingAbove: null }];
});

// ─── O ataque principal ─────────────────────────────────────────

describe("priceOrder — preço vem do banco", () => {
  it("C-2 #1 — ignora unitPrice e total forjados no corpo", async () => {
    const r = await price({
      storeId: LOJA, type: "pickup",
      // O cliente afirma que a pizza custa 1 centavo.
      items: [{ productId: "prod-1", quantity: 2, productName: "Pizza" }],
    });

    expect(isPricingFailure(r)).toBe(false);
    if (isPricingFailure(r)) return;
    expect(r.items[0].unitPrice).toBe("50.00");
    expect(r.items[0].total).toBe("100.00");
    expect(r.subtotal).toBe("100.00");
    expect(r.total).toBe("100.00");
  });

  it("C-2 #2 — usa o nome do produto do banco, não o do corpo", async () => {
    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1, productName: "Nome Falso" }],
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.items[0].productName).toBe("Pizza");
  });

  it("C-2 #3 — produto de outra loja não é precificado", async () => {
    // O select já é filtrado por storeId; produto de outra loja não volta.
    productRows = [];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-de-outra-loja", quantity: 1 }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("C-2 #4 — produto inativo não pode ser comprado", async () => {
    productRows = [produto({ active: false })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });
});

// ─── Quantidade (M-7) ───────────────────────────────────────────

describe("priceOrder — quantidade", () => {
  it("C-2 #5 — quantidade negativa é recusada", async () => {
    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: -5 }],
    });
    expect(isPricingFailure(r)).toBe(true);
  });

  it("C-2 #6 — quantidade fracionária é recusada", async () => {
    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1.5 }],
    });
    expect(isPricingFailure(r)).toBe(true);
  });

  it("C-2 #7 — item sem produto é recusado", async () => {
    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ quantity: 1, productName: "Item avulso a R$ 0,01" }],
    });
    expect(isPricingFailure(r)).toBe(true);
  });
});

// ─── Adicionais e variação ──────────────────────────────────────

describe("priceOrder — adicionais e variação", () => {
  it("C-2 #8 — adicional é cobrado pelo preço do banco", async () => {
    additionRows = [{ productId: "prod-1", name: "Borda recheada", price: "8.00", active: true }];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{
        productId: "prod-1", quantity: 1,
        // O cliente diz que a borda é de graça.
        additionsSnapshot: [{ name: "Borda recheada", price: "0.00" }],
      }],
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.items[0].additionsTotal).toBe("8.00");
    expect(r.items[0].unitPrice).toBe("58.00");
  });

  it("C-2 #9 — opção de variação é cobrada pelo preço do banco", async () => {
    productRows = [produto({
      variationGroups: [{ groupName: "Tamanho", options: [{ name: "Grande", price: "12.00" }] }],
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{
        productId: "prod-1", quantity: 1,
        additionsSnapshot: [{ name: "Tamanho: Grande", price: "0.00" }],
      }],
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.items[0].unitPrice).toBe("62.00");
  });

  it("C-2 #10 — adicional inventado é recusado", async () => {
    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{
        productId: "prod-1", quantity: 1,
        additionsSnapshot: [{ name: "Desconto secreto", price: "-49.00" }],
      }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("C-2 #11 — adicional desativado é recusado", async () => {
    additionRows = [{ productId: "prod-1", name: "Borda recheada", price: "8.00", active: false }];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{
        productId: "prod-1", quantity: 1,
        additionsSnapshot: [{ name: "Borda recheada", price: "8.00" }],
      }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });
});

// ─── Promoção ───────────────────────────────────────────────────

describe("priceOrder — promoção", () => {
  it("C-2 #12 — promoção ativa vale para a vitrine", async () => {
    productRows = [produto({
      promoConfig: {
        enabled: true, promoPrice: "35.00", daysOfWeek: [],
        timeStart: null, timeEnd: null, dateStart: null, dateEnd: null,
        applyToPdv: true, applyToStore: true,
      },
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      channel: "store",
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.items[0].unitPrice).toBe("35.00");
  });

  it("C-2 #13 — promoção restrita ao PDV não vale na vitrine", async () => {
    productRows = [produto({
      promoConfig: {
        enabled: true, promoPrice: "35.00", daysOfWeek: [],
        timeStart: null, timeEnd: null, dateStart: null, dateEnd: null,
        applyToPdv: true, applyToStore: false,
      },
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      channel: "store",
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.items[0].unitPrice).toBe("50.00");
  });
});

// ─── Frete ──────────────────────────────────────────────────────

describe("priceOrder — frete", () => {
  it("C-2 #14 — retirada não cobra frete", async () => {
    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.deliveryFee).toBe("0.00");
    expect(r.total).toBe("50.00");
  });

  it("C-2 #15 — delivery usa a taxa da loja, não a do corpo", async () => {
    const r = await price({
      storeId: LOJA, type: "delivery",
      items: [{ productId: "prod-1", quantity: 1 }],
      addressSnapshot: { neighborhood: "Centro" },
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.deliveryFee).toBe("10.00");
    expect(r.total).toBe("60.00");
  });

  it("C-2 #16 — regra por bairro sobrepõe a taxa padrão", async () => {
    storeRows = [{
      deliveryFee: "10.00",
      deliveryRules: [{ bairro: "Jardins", taxa: 25 }],
      freeShippingAbove: null,
    }];

    const r = await price({
      storeId: LOJA, type: "delivery",
      items: [{ productId: "prod-1", quantity: 1 }],
      addressSnapshot: { neighborhood: "  jardins " },  // normaliza espaço/caixa
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.deliveryFee).toBe("25.00");
  });

  it("C-2 #17 — frete grátis acima do limite", async () => {
    storeRows = [{ deliveryFee: "10.00", deliveryRules: null, freeShippingAbove: "80.00" }];

    const r = await price({
      storeId: LOJA, type: "delivery",
      items: [{ productId: "prod-1", quantity: 2 }],  // 100.00
      addressSnapshot: { neighborhood: "Centro" },
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.deliveryFee).toBe("0.00");
  });
});

// ─── Cupom (M-6) ────────────────────────────────────────────────

describe("priceOrder — cupom", () => {
  const cupomBase = (over: Partial<CouponRow> = {}): CouponRow => ({
    id: "cup-1", code: "SAVE10", type: "percent", discount: "10",
    minOrderValue: "0", maxUses: null, usedCount: 0,
    expiresAt: null, active: true,
    ...over,
  });

  it("C-2 #18 — desconto é calculado no servidor, não aceito do corpo", async () => {
    couponRows = [cupomBase()];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      couponCode: "SAVE10",
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.discount).toBe("5.00");   // 10% de 50
    expect(r.total).toBe("45.00");
    expect(r.couponId).toBe("cup-1");
  });

  it("C-2 #19 — cupom expirado é recusado", async () => {
    couponRows = [cupomBase({ expiresAt: new Date(Date.now() - 86_400_000) })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      couponCode: "SAVE10",
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("C-2 #20 — cupom esgotado é recusado", async () => {
    couponRows = [cupomBase({ maxUses: 5, usedCount: 5 })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      couponCode: "SAVE10",
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("C-2 #21 — pedido abaixo do mínimo é recusado", async () => {
    couponRows = [cupomBase({ minOrderValue: "200.00" })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      couponCode: "SAVE10",
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("C-2 #22 — desconto fixo maior que o pedido não gera total negativo", async () => {
    couponRows = [cupomBase({ type: "fixed", discount: "500.00" })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      couponCode: "SAVE10",
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.discount).toBe("50.00");
    expect(r.total).toBe("0.00");
  });

  it("C-2 #23 — cupom inexistente é recusado", async () => {
    couponRows = [];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1 }],
      couponCode: "NAOEXISTE",
    });

    expect(isPricingFailure(r)).toBe(true);
  });
});

// ─── Conta fechada ──────────────────────────────────────────────

describe("priceOrder — total consolidado", () => {
  it("C-2 #24 — subtotal + frete − desconto, tudo do banco", async () => {
    productRows  = [produto({ price: "30.00" })];
    additionRows = [{ productId: "prod-1", name: "Extra", price: "5.00", active: true }];
    couponRows   = [{
      id: "cup-1", code: "OFF10", type: "fixed", discount: "10.00",
      minOrderValue: "0", maxUses: null, usedCount: 0, expiresAt: null, active: true,
    }];
    storeRows = [{ deliveryFee: "12.00", deliveryRules: null, freeShippingAbove: null }];

    const r = await price({
      storeId: LOJA, type: "delivery",
      items: [{
        productId: "prod-1", quantity: 2,
        additionsSnapshot: [{ name: "Extra", price: "5.00" }],
      }],
      addressSnapshot: { neighborhood: "Centro" },
      couponCode: "OFF10",
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    // (30 + 5) × 2 = 70 ; + 12 frete ; − 10 cupom = 72
    expect(r.subtotal).toBe("70.00");
    expect(r.deliveryFee).toBe("12.00");
    expect(r.discount).toBe("10.00");
    expect(r.total).toBe("72.00");
  });
});
