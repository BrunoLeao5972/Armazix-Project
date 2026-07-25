// ─────────────────────────────────────────────────────────────────────────
// Precificação de pedido — fonte única de verdade.
//
// O checkout é público: qualquer pessoa pode montar o corpo da requisição à
// mão. Portanto NENHUM valor que chega do cliente entra no banco. O que o
// navegador manda serve só para dizer O QUE foi pedido (produto, quantidade,
// quais adicionais); QUANTO custa é decidido aqui, a partir do banco.
//
// Antes disso existiam três comportamentos diferentes: createOrderHandler
// gravava os valores do cliente sem conferir nada, e o checkout do Mercado
// Pago recalculava só o preço-base — ignorando adicionais, variação, promoção,
// frete e cupom. Agora os dois passam por aqui.
// ─────────────────────────────────────────────────────────────────────────

import { createDb, schema } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { getEffectivePrice } from "@/lib/promo-engine";

const { products, productAdditions, coupons, stores } = schema;

/** Teto defensivo: carrinho legítimo não passa perto disso. */
const MAX_ITENS_POR_PEDIDO = 100;
const MAX_QUANTIDADE_POR_ITEM = 999;

export interface IncomingItem {
  productId?: string | null;
  productName?: string;
  productEmoji?: string | null;
  productImage?: string | null;
  quantity?: number;
  /** Variações e adicionais escolhidos, no formato que a vitrine monta. */
  additionsSnapshot?: Array<{ name?: string; price?: string | number }> | null;
  notes?: string | null;
}

export interface PricedItem {
  productId: string;
  productName: string;
  productEmoji: string | null;
  productImage: string | null;
  quantity: number;
  unitPrice: string;
  additionsTotal: string;
  total: string;
  additionsSnapshot: Array<{ name: string; price: string }> | null;
  notes: string | null;
}

export interface PricedOrder {
  items: PricedItem[];
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  couponId: string | null;
}

export interface PricingFailure {
  error: string;
  status: number;
}

export function isPricingFailure(v: PricedOrder | PricingFailure): v is PricingFailure {
  return (v as PricingFailure).error !== undefined;
}

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

type Db = ReturnType<typeof createDb>;

export interface PriceOrderInput {
  storeId: string;
  /** "delivery" cobra frete; qualquer outro tipo (pickup, mesa) não cobra. */
  type?: string | null;
  items: IncomingItem[];
  addressSnapshot?: { neighborhood?: string | null } | null;
  couponCode?: string | null;
  couponId?: string | null;
  /** Promoções podem valer só na vitrine ou só no PDV. */
  channel?: "store" | "pdv";
}

export async function priceOrder(
  db: Db,
  input: PriceOrderInput,
): Promise<PricedOrder | PricingFailure> {
  const channel = input.channel ?? "store";
  const itens = input.items ?? [];

  if (itens.length === 0) {
    return { error: "O pedido não tem itens", status: 400 };
  }
  if (itens.length > MAX_ITENS_POR_PEDIDO) {
    return { error: "Pedido com itens demais", status: 400 };
  }

  // ── Quantidades ──────────────────────────────────────────────────────────
  // Sem isso, quantidade negativa gera item de total negativo (derrubando o
  // total do pedido mesmo com preço lido do banco) e ainda soma no estoque.
  for (const item of itens) {
    const q = item.quantity;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QUANTIDADE_POR_ITEM) {
      return { error: "Quantidade inválida em um dos itens", status: 400 };
    }
    if (!item.productId) {
      return { error: "Todo item do pedido precisa referenciar um produto", status: 400 };
    }
  }

  const productIds = [...new Set(itens.map(i => i.productId as string))];

  // ── Produtos e adicionais, sempre no escopo da loja ──────────────────────
  const [dbProducts, dbAdditions] = await Promise.all([
    db
      .select({
        id:              products.id,
        name:            products.name,
        price:           products.price,
        promoConfig:     products.promoConfig,
        emoji:           products.emoji,
        imageUrl:        products.imageUrl,
        variationGroups: products.variationGroups,
        active:          products.active,
      })
      .from(products)
      .where(and(eq(products.storeId, input.storeId), inArray(products.id, productIds))),
    db
      .select({
        productId: productAdditions.productId,
        name:      productAdditions.name,
        price:     productAdditions.price,
        active:    productAdditions.active,
      })
      .from(productAdditions)
      .where(inArray(productAdditions.productId, productIds)),
  ]);

  const productById = new Map(dbProducts.map(p => [p.id, p]));

  // Preço de cada extra válido, por produto: nome → preço.
  // Cobre as duas origens que a vitrine junta em additionsSnapshot:
  // adicionais (product_additions) e opções de variação (products.variationGroups).
  const extrasPorProduto = new Map<string, Map<string, number>>();
  const extrasDe = (productId: string) => {
    let m = extrasPorProduto.get(productId);
    if (!m) { m = new Map(); extrasPorProduto.set(productId, m); }
    return m;
  };

  for (const add of dbAdditions) {
    if (add.active === false) continue;
    extrasDe(add.productId).set(add.name, parseFloat(add.price) || 0);
  }

  for (const p of dbProducts) {
    const grupos = p.variationGroups as
      | Array<{ groupName?: string; options?: Array<{ name?: string; price?: string }> }>
      | null;
    if (!Array.isArray(grupos)) continue;
    for (const g of grupos) {
      for (const opt of g.options ?? []) {
        if (!opt?.name) continue;
        // A vitrine rotula a opção escolhida como "Grupo: Opção".
        const label = g.groupName ? `${g.groupName}: ${opt.name}` : opt.name;
        extrasDe(p.id).set(label, parseFloat(opt.price || "0") || 0);
      }
    }
  }

  // ── Preço item a item ────────────────────────────────────────────────────
  const pricedItems: PricedItem[] = [];

  for (const item of itens) {
    const produto = productById.get(item.productId as string);
    if (!produto) {
      return { error: `Produto indisponível: ${item.productName ?? item.productId}`, status: 400 };
    }
    if (produto.active === false) {
      return { error: `Produto indisponível: ${produto.name}`, status: 400 };
    }

    const { effectivePrice } = getEffectivePrice(produto.price, produto.promoConfig, channel);

    const catalogo = extrasPorProduto.get(produto.id) ?? new Map<string, number>();
    const extrasValidados: Array<{ name: string; price: string }> = [];
    let extrasTotal = 0;

    for (const extra of item.additionsSnapshot ?? []) {
      const nome = extra?.name;
      if (!nome) continue;
      const preco = catalogo.get(nome);
      // Extra que não existe no catálogo do produto = payload adulterado.
      // Recusamos em vez de ignorar: cobrar diferente do que o cliente viu
      // na tela seria pior do que recusar o pedido.
      if (preco === undefined) {
        return { error: `Opção indisponível para "${produto.name}": ${nome}`, status: 400 };
      }
      extrasTotal += preco;
      extrasValidados.push({ name: nome, price: money(preco) });
    }

    const quantity  = item.quantity as number;
    const unitPrice = effectivePrice + extrasTotal;
    const total     = unitPrice * quantity;

    pricedItems.push({
      productId:         produto.id,
      productName:       produto.name,
      productEmoji:      produto.emoji ?? null,
      productImage:      produto.imageUrl ?? null,
      quantity,
      unitPrice:         money(unitPrice),
      additionsTotal:    money(extrasTotal),
      total:             money(total),
      additionsSnapshot: extrasValidados.length > 0 ? extrasValidados : null,
      notes:             item.notes ? String(item.notes).slice(0, 500) : null,
    });
  }

  const subtotal = pricedItems.reduce((s, i) => s + parseFloat(i.total), 0);

  // ── Frete ────────────────────────────────────────────────────────────────
  const [loja] = await db
    .select({
      deliveryFee:       stores.deliveryFee,
      deliveryRules:     stores.deliveryRules,
      freeShippingAbove: stores.freeShippingAbove,
    })
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1);

  if (!loja) return { error: "Loja não encontrada", status: 404 };

  const deliveryFee = calcDeliveryFee({
    isDelivery:   (input.type ?? "delivery") === "delivery",
    neighborhood: input.addressSnapshot?.neighborhood ?? null,
    subtotal,
    taxaPadrao:   parseFloat(loja.deliveryFee ?? "0") || 0,
    freeAbove:    loja.freeShippingAbove !== null ? parseFloat(loja.freeShippingAbove) : null,
    regras:       Array.isArray(loja.deliveryRules) ? loja.deliveryRules : [],
  });

  // ── Cupom ────────────────────────────────────────────────────────────────
  const cupom = await resolveCoupon(db, input.storeId, input.couponId, input.couponCode, subtotal);
  if (cupom && "error" in cupom) return cupom;

  const discount = cupom?.discount ?? 0;
  const couponId = cupom?.id ?? null;

  const total = Math.max(0, subtotal + deliveryFee - discount);

  return {
    items:       pricedItems,
    subtotal:    money(subtotal),
    deliveryFee: money(deliveryFee),
    discount:    money(discount),
    total:       money(total),
    couponId,
  };
}

// ─── Frete ────────────────────────────────────────────────────────────────
// Espelha calcDeliveryFee da vitrine: regra por bairro sobrepõe a taxa padrão,
// e o frete grátis é avaliado contra o subtotal ANTES do desconto do cupom.
function calcDeliveryFee(opts: {
  isDelivery: boolean;
  neighborhood: string | null;
  subtotal: number;
  taxaPadrao: number;
  freeAbove: number | null;
  regras: Array<{ bairro: string; taxa: number }>;
}): number {
  if (!opts.isDelivery) return 0;
  if (opts.freeAbove !== null && opts.subtotal >= opts.freeAbove) return 0;

  const chave = opts.neighborhood?.trim().toLowerCase() ?? "";
  const regra = chave
    ? opts.regras.find(r => r.bairro?.trim().toLowerCase() === chave)
    : undefined;

  const taxa = regra !== undefined ? Number(regra.taxa) : opts.taxaPadrao;
  return Number.isFinite(taxa) && taxa > 0 ? taxa : 0;
}

// ─── Cupom ────────────────────────────────────────────────────────────────
interface ResolvedCoupon { id: string; discount: number }

/**
 * Revalida o cupom por inteiro na hora de gravar o pedido. A rota
 * /api/coupons/validate é só pré-visualização — antes, um cupom expirado ou
 * esgotado continuava valendo no pedido de verdade, e o valor do desconto
 * vinha do corpo da requisição.
 */
async function resolveCoupon(
  db: Db,
  storeId: string,
  couponId: string | null | undefined,
  couponCode: string | null | undefined,
  subtotal: number,
): Promise<ResolvedCoupon | PricingFailure | null> {
  if (!couponId && !couponCode) return null;

  const [cupom] = await db
    .select()
    .from(coupons)
    .where(and(
      eq(coupons.storeId, storeId),
      couponId
        ? eq(coupons.id, couponId)
        : eq(coupons.code, (couponCode ?? "").toUpperCase()),
    ))
    .limit(1);

  if (!cupom || cupom.active === false) {
    return { error: "Cupom inválido", status: 400 };
  }
  if (cupom.expiresAt && new Date(cupom.expiresAt) < new Date()) {
    return { error: "Cupom expirado", status: 400 };
  }
  if (cupom.maxUses !== null && (cupom.usedCount ?? 0) >= cupom.maxUses) {
    return { error: "Cupom esgotado", status: 400 };
  }

  const minimo = parseFloat(cupom.minOrderValue ?? "0") || 0;
  if (subtotal < minimo) {
    return { error: `Pedido mínimo de R$ ${money(minimo)} para este cupom`, status: 400 };
  }

  const valor = parseFloat(cupom.discount ?? "0") || 0;
  const bruto = cupom.type === "percent" ? (subtotal * valor) / 100 : valor;

  // Desconto nunca supera o subtotal — senão o total viraria negativo.
  return { id: cupom.id, discount: Math.min(bruto, subtotal) };
}
