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
  deliveryConfig?: Record<string, unknown> | null;
  latitude?: string | null;
  longitude?: string | null;
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
    createUnscopedDb: () => Promise.resolve(mockDb()),
    schema: {
      products:         { __name: "products", id: "id", storeId: "storeId" },
      productAdditions: { __name: "product_additions", productId: "productId" },
      coupons:          { __name: "coupons", id: "id", storeId: "storeId", code: "code" },
      stores:           { __name: "stores", id: "id" },
    },
  };
});

// ─── Mock de geocodificação — controlado por teste, nunca bate na API real ──
let geocodeResult: { lat: number; lng: number } | null | (() => never) = null;
vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn(async () => {
    if (typeof geocodeResult === "function") return geocodeResult();
    return geocodeResult;
  }),
}));

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
  geocodeResult = null;
});

const ENDERECO_CLIENTE = {
  street: "Rua das Flores", number: "100", neighborhood: "Centro",
  city: "Fortaleza", state: "CE", zip: "60000-000",
};

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

// ─── Grupo "opcional" (substitui) vs "adicional" (soma) + obrigatoriedade ─

describe("priceOrder — priceType do grupo e obrigatoriedade", () => {
  it("grupo opcional substitui o preço do produto, não soma", async () => {
    productRows = [produto({
      variationGroups: [{
        id: "g1", groupName: "Tamanho", priceType: "opcional", required: true,
        options: [{ name: "Grande", price: "40.00" }],
      }],
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{
        productId: "prod-1", quantity: 1,
        additionsSnapshot: [{ name: "Tamanho: Grande", price: "0.00" }],
      }],
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    // Preço do produto é 50.00 — se somasse, daria 90.00. Substituindo, é só o da opção.
    expect(r.items[0].unitPrice).toBe("40.00");
  });

  it("grupo opcional + adicional no mesmo pedido: substitui a base e soma o adicional por cima", async () => {
    productRows = [produto({
      variationGroups: [
        { id: "g1", groupName: "Tamanho", priceType: "opcional", required: true, options: [{ name: "Grande", price: "40.00" }] },
        { id: "g2", groupName: "Borda",   priceType: "adicional", required: false, options: [{ name: "Recheada", price: "8.00" }] },
      ],
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{
        productId: "prod-1", quantity: 1,
        additionsSnapshot: [
          { name: "Tamanho: Grande", price: "0.00" },
          { name: "Borda: Recheada", price: "0.00" },
        ],
      }],
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar");
    expect(r.items[0].unitPrice).toBe("48.00"); // 40 (substituto) + 8 (adicional)
  });

  it("grupo obrigatório sem opção selecionada é recusado", async () => {
    productRows = [produto({
      variationGroups: [{
        id: "g1", groupName: "Tamanho", priceType: "adicional", required: true,
        options: [{ name: "Grande", price: "12.00" }],
      }],
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1, additionsSnapshot: [] }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("grupo com required=false pode ficar sem seleção — cobra só o preço base", async () => {
    productRows = [produto({
      variationGroups: [{
        id: "g1", groupName: "Adicionais Extras", priceType: "adicional", required: false,
        options: [{ name: "Bacon", price: "3.50" }],
      }],
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1, additionsSnapshot: [] }],
    });

    if (isPricingFailure(r)) throw new Error("não deveria falhar — grupo não é obrigatório");
    expect(r.items[0].unitPrice).toBe("50.00");
  });

  it("grupo sem o campo required (compatibilidade) continua obrigatório", async () => {
    productRows = [produto({
      variationGroups: [{
        id: "g1", groupName: "Tamanho", priceType: "adicional",
        options: [{ name: "Grande", price: "12.00" }],
      }],
    })];

    const r = await price({
      storeId: LOJA, type: "pickup",
      items: [{ productId: "prod-1", quantity: 1, additionsSnapshot: [] }],
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

// ─── Frete por distância — 4 modelos geo-based ────────────────────

describe("priceOrder — frete geo-based (dinâmica, raio, bairro no mapa, matriz)", () => {
  const LOJA_PONTO = { lat: -3.7327, lng: -38.5267 }; // Fortaleza

  it("modelo dinâmica: cobra taxa base + km excedente", async () => {
    geocodeResult = { lat: -3.7500, lng: -38.5267 }; // ~1.9km ao sul da loja
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: {
        modeloCobranca: "dinamica",
        modelConfig: { dinamica: { taxaBasica: "5.00", distanciaBase: "1", valorPorKmAdicional: "2.00" } },
      },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    if (isPricingFailure(r)) throw new Error(`não deveria falhar: ${r.error}`);
    // ~1.92km de distância, base cobre 1km → (1.92-1) * 2.00 ≈ 1.85 + 5.00 base
    const fee = parseFloat(r.deliveryFee);
    expect(fee).toBeGreaterThan(5.00); // sempre cobra pelo menos a base
    expect(fee).toBeLessThan(10.00);   // mas não descontrola pra uma distância pequena
  });

  it("modelo raio: aplica a taxa do círculo correto", async () => {
    geocodeResult = { lat: -3.7500, lng: -38.5267 }; // dentro do primeiro raio (~1.9km)
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: {
        modeloCobranca: "raio",
        modelConfig: { raio: { raios: [
          { raioMetros: 3000, tipoCobranca: "fixa", valorFixo: "8.00" },
          { raioMetros: 8000, tipoCobranca: "fixa", valorFixo: "15.00" },
        ] } },
      },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    if (isPricingFailure(r)) throw new Error(`não deveria falhar: ${r.error}`);
    expect(r.deliveryFee).toBe("8.00"); // caiu no primeiro raio (3km), não no segundo
  });

  it("modelo raio: endereço fora de todos os raios é recusado", async () => {
    geocodeResult = { lat: -4.5000, lng: -39.5000 }; // bem longe da loja
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: {
        modeloCobranca: "raio",
        modelConfig: { raio: { raios: [{ raioMetros: 3000, tipoCobranca: "fixa", valorFixo: "8.00" }] } },
      },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("modelo matriz: aplica a faixa de distância correta", async () => {
    geocodeResult = { lat: -3.7500, lng: -38.5267 };
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: {
        modeloCobranca: "matriz",
        modelConfig: { matriz: [
          { de: 0, ate: 3000, valor: "6.00" },
          { de: 3000, ate: 8000, valor: "12.00" },
        ] },
      },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    if (isPricingFailure(r)) throw new Error(`não deveria falhar: ${r.error}`);
    expect(r.deliveryFee).toBe("6.00");
  });

  it("modelo bairro (polígono): dentro da área cobra o valor configurado", async () => {
    geocodeResult = { lat: -3.7327, lng: -38.5267 }; // exatamente no ponto da loja — dentro de qualquer polígono ao redor
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: {
        modeloCobranca: "bairro",
        modelConfig: { bairroDesenho: {
          poligonos: [[[-3.80, -38.60], [-3.80, -38.45], [-3.65, -38.45], [-3.65, -38.60]]],
          tipoCobranca: "fixa", valorFixo: "9.00", valorPorKm: "0",
        } },
      },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    if (isPricingFailure(r)) throw new Error(`não deveria falhar: ${r.error}`);
    expect(r.deliveryFee).toBe("9.00");
  });

  it("modelo bairro (polígono): fora de todos os polígonos é recusado", async () => {
    geocodeResult = { lat: 10, lng: 10 }; // longe de qualquer polígono desenhado
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: {
        modeloCobranca: "bairro",
        modelConfig: { bairroDesenho: {
          poligonos: [[[-3.80, -38.60], [-3.80, -38.45], [-3.65, -38.45], [-3.65, -38.60]]],
          tipoCobranca: "fixa", valorFixo: "9.00", valorPorKm: "0",
        } },
      },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("loja sem localização configurada recusa modelo geo-based", async () => {
    geocodeResult = { lat: -3.75, lng: -38.52 };
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: null, longitude: null,
      deliveryConfig: { modeloCobranca: "dinamica", modelConfig: { dinamica: { taxaBasica: "5.00" } } },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("endereço não encontrado na geocodificação recusa o pedido", async () => {
    geocodeResult = null; // Nominatim não achou nada
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: { modeloCobranca: "dinamica", modelConfig: { dinamica: { taxaBasica: "5.00" } } },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    expect(isPricingFailure(r)).toBe(true);
  });

  it("falha na consulta de geocodificação vira erro 503, não uma cobrança silenciosa", async () => {
    geocodeResult = () => { throw new Error("Nominatim indisponível"); };
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: null,
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: { modeloCobranca: "dinamica", modelConfig: { dinamica: { taxaBasica: "5.00" } } },
    }];

    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    if (!isPricingFailure(r)) throw new Error("deveria falhar");
    expect(r.status).toBe(503);
  });

  it("frete grátis acima de X vale pra modelo geo-based e não geocodifica à toa", async () => {
    storeRows = [{
      deliveryFee: "0", deliveryRules: null, freeShippingAbove: "50.00",
      latitude: String(LOJA_PONTO.lat), longitude: String(LOJA_PONTO.lng),
      deliveryConfig: { modeloCobranca: "dinamica", modelConfig: { dinamica: { taxaBasica: "5.00" } } },
    }];
    // produto de 50 (>= freeShippingAbove) — se tentasse geocodificar, o mock
    // lançaria (geocodeResult continua null desde o beforeEach) e o teste falharia.
    const r = await price({
      storeId: LOJA, type: "delivery", addressSnapshot: ENDERECO_CLIENTE,
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    if (isPricingFailure(r)) throw new Error(`não deveria falhar: ${r.error}`);
    expect(r.deliveryFee).toBe("0.00");
  });
});
