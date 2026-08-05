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
import { geocodeAddress, type GeocodeAddress } from "@/lib/geocoding";
import { distanceMeters, pointInPolygon } from "@/lib/geo-distance";

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
  addressSnapshot?: {
    street?: string | null; number?: string | null; neighborhood?: string | null;
    city?: string | null; state?: string | null; zip?: string | null;
  } | null;
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

  // Preço de cada extra válido, por produto: nome → { preço, substitutivo, grupo }.
  // Cobre as duas origens que a vitrine junta em additionsSnapshot:
  // adicionais (product_additions, sempre somam) e opções de variação
  // (products.variationGroups, que somam ou substituem conforme o
  // priceType do grupo — "opcional" substitui o preço do produto
  // principal, "adicional" (padrão) soma, como sempre foi).
  interface ExtraInfo { price: number; substitutive: boolean; groupId?: string }
  const extrasPorProduto = new Map<string, Map<string, ExtraInfo>>();
  const extrasDe = (productId: string) => {
    let m = extrasPorProduto.get(productId);
    if (!m) { m = new Map(); extrasPorProduto.set(productId, m); }
    return m;
  };

  // Grupos que exigem uma opção selecionada, por produto — required=undefined
  // trata como obrigatório (grupos criados antes desse campo sempre foram).
  const gruposObrigatoriosPorProduto = new Map<string, Array<{ id: string; groupName: string }>>();

  for (const add of dbAdditions) {
    if (add.active === false) continue;
    extrasDe(add.productId).set(add.name, { price: parseFloat(add.price) || 0, substitutive: false });
  }

  for (const p of dbProducts) {
    const grupos = p.variationGroups as
      | Array<{
          id?: string;
          groupName?: string;
          priceType?: "adicional" | "opcional";
          required?: boolean;
          options?: Array<{ name?: string; price?: string; promoConfig?: import("@/lib/promo-engine").PromoConfig | null }>;
        }>
      | null;
    if (!Array.isArray(grupos)) continue;
    for (const g of grupos) {
      const substitutive = g.priceType === "opcional";
      const temOpcoes = (g.options?.length ?? 0) > 0;
      if (g.id && temOpcoes && g.required !== false) {
        const lista = gruposObrigatoriosPorProduto.get(p.id) ?? [];
        lista.push({ id: g.id, groupName: g.groupName ?? "" });
        gruposObrigatoriosPorProduto.set(p.id, lista);
      }
      for (const opt of g.options ?? []) {
        if (!opt?.name) continue;
        // A vitrine rotula a opção escolhida como "Grupo: Opção".
        const label = g.groupName ? `${g.groupName}: ${opt.name}` : opt.name;
        // O adicional da opção é um preço como outro qualquer pra fins de
        // promoção — mesma função usada pro preço-base do produto, só que
        // aplicada ao valor do adicional em vez do preço cheio.
        const { effectivePrice } = getEffectivePrice(opt.price || "0", opt.promoConfig, channel);
        extrasDe(p.id).set(label, { price: effectivePrice, substitutive, groupId: g.id });
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

    const catalogo = extrasPorProduto.get(produto.id) ?? new Map<string, ExtraInfo>();
    const extrasValidados: Array<{ name: string; price: string }> = [];
    let extrasAdicionais    = 0; // somam ao preço do produto principal
    let extrasSubstitutivos = 0; // substituem o preço do produto principal
    let temSubstitutivo     = false;
    const gruposEscolhidos  = new Set<string>();

    for (const extra of item.additionsSnapshot ?? []) {
      const nome = extra?.name;
      if (!nome) continue;
      const info = catalogo.get(nome);
      // Extra que não existe no catálogo do produto = payload adulterado.
      // Recusamos em vez de ignorar: cobrar diferente do que o cliente viu
      // na tela seria pior do que recusar o pedido.
      if (info === undefined) {
        return { error: `Opção indisponível para "${produto.name}": ${nome}`, status: 400 };
      }
      if (info.substitutive) {
        temSubstitutivo = true;
        extrasSubstitutivos += info.price;
      } else {
        extrasAdicionais += info.price;
      }
      if (info.groupId) gruposEscolhidos.add(info.groupId);
      extrasValidados.push({ name: nome, price: money(info.price) });
    }

    // Mesma regra que trava o botão "Adicionar" na vitrine, só que aqui não
    // dá pra contornar editando o payload à mão — grupo obrigatório sem
    // opção escolhida derruba o pedido inteiro.
    for (const grupo of gruposObrigatoriosPorProduto.get(produto.id) ?? []) {
      if (!gruposEscolhidos.has(grupo.id)) {
        return { error: `Selecione uma opção para "${grupo.groupName}" em "${produto.name}"`, status: 400 };
      }
    }

    // Grupo "opcional" substitui o preço do produto principal (não soma) —
    // se houver mais de um grupo opcional selecionado, os dois substituem
    // juntos (soma dos substitutos vira o novo preço-base). additionsTotal
    // no recibo mostra só os extras que de fato somam — o valor substituído
    // já está embutido no "preço do produto" implícito em unitPrice.
    const precoBase = temSubstitutivo ? extrasSubstitutivos : effectivePrice;

    const quantity  = item.quantity as number;
    const unitPrice = precoBase + extrasAdicionais;
    const total     = unitPrice * quantity;

    pricedItems.push({
      productId:         produto.id,
      productName:       produto.name,
      productEmoji:      produto.emoji ?? null,
      productImage:      produto.imageUrl ?? null,
      quantity,
      unitPrice:         money(unitPrice),
      additionsTotal:    money(extrasAdicionais),
      total:             money(total),
      additionsSnapshot: extrasValidados.length > 0 ? extrasValidados : null,
      notes:             item.notes ? String(item.notes).slice(0, 500) : null,
    });
  }

  const subtotal = pricedItems.reduce((s, i) => s + parseFloat(i.total), 0);

  // ── Frete ────────────────────────────────────────────────────────────────
  const estimativa = await estimateDelivery(db, {
    storeId:         input.storeId,
    type:            input.type,
    addressSnapshot: input.addressSnapshot,
    subtotal,
  });
  if ("error" in estimativa) return estimativa;
  const deliveryFee = parseFloat(estimativa.fee);

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
// Único lugar que decide o valor do frete, pros 6 modelos configuráveis em
// EntregaTab/DeliveryPricingConfig. "fixa" e "bairroFixo" também funcionam
// via os campos legados (deliveryFee/deliveryRules) quando deliveryConfig
// está vazio — loja que nunca abriu a aba Entrega continua funcionando como
// sempre funcionou.

export interface DeliveryEstimateInput {
  storeId: string;
  type?: string | null;
  addressSnapshot?: PriceOrderInput["addressSnapshot"];
  subtotal: number;
}

export interface DeliveryEstimate {
  fee: string;
  distanceKm?: number;
}

/**
 * Usado tanto por priceOrder (na hora de fechar o pedido) quanto pelo
 * endpoint público de estimativa (preview do frete no checkout, antes do
 * cliente confirmar) — mesmo cálculo, pra nunca cobrar diferente do que foi
 * mostrado na tela.
 */
export async function estimateDelivery(
  db: Db,
  input: DeliveryEstimateInput,
): Promise<DeliveryEstimate | PricingFailure> {
  const [loja] = await db
    .select({
      deliveryFee:       stores.deliveryFee,
      deliveryRules:     stores.deliveryRules,
      freeShippingAbove: stores.freeShippingAbove,
      deliveryConfig:    stores.deliveryConfig,
      latitude:          stores.latitude,
      longitude:         stores.longitude,
    })
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1);

  if (!loja) return { error: "Loja não encontrada", status: 404 };

  const isDelivery = (input.type ?? "delivery") === "delivery";
  const addr = input.addressSnapshot;
  const fullAddress: GeocodeAddress | null =
    addr?.street && addr?.city && addr?.state
      ? {
          street: addr.street, number: addr.number ?? "", neighborhood: addr.neighborhood ?? "",
          city: addr.city, state: addr.state, zip: addr.zip ?? "",
        }
      : null;

  const result = await calcDeliveryFee({
    isDelivery,
    neighborhood:      addr?.neighborhood ?? null,
    address:           fullAddress,
    subtotal:          input.subtotal,
    taxaPadrao:        parseFloat(loja.deliveryFee ?? "0") || 0,
    freeAbove:         loja.freeShippingAbove !== null ? parseFloat(loja.freeShippingAbove) : null,
    regras:            Array.isArray(loja.deliveryRules) ? loja.deliveryRules : [],
    deliveryConfig:    (loja.deliveryConfig as Record<string, unknown> | null) ?? null,
    storeLat:          loja.latitude !== null && loja.latitude !== undefined ? parseFloat(loja.latitude) : null,
    storeLng:          loja.longitude !== null && loja.longitude !== undefined ? parseFloat(loja.longitude) : null,
  });

  if (!result.available) {
    return {
      error: result.error ?? "Não é possível calcular o frete para este endereço",
      status: result.status ?? 400,
    };
  }

  return { fee: money(result.fee), distanceKm: result.distanceKm };
}

interface DeliveryModelConfigShape {
  fixa?:       { taxaCliente?: string };
  dinamica?:   { taxaBasica?: string; distanciaBase?: string; valorPorKmAdicional?: string };
  bairroDesenho?: {
    poligonos?: Array<Array<[number, number]>>;
    tipoCobranca?: "fixa" | "fixa_variavel";
    valorFixo?: string;
    valorPorKm?: string;
  };
  raio?: {
    raios?: Array<{ raioMetros?: number; tipoCobranca?: "fixa" | "fixa_variavel"; valorFixo?: string; valorPorKm?: string }>;
  };
  matriz?: Array<{ de?: number; ate?: number; valor?: string }>;
  bairroFixo?: { bairros?: Array<{ nome?: string; valor?: string; ativo?: boolean }> };
}

interface DeliveryCalcResult {
  fee: number;
  available: boolean;
  distanceKm?: number;
  error?: string;
  status?: number;
}

async function calcDeliveryFee(opts: {
  isDelivery: boolean;
  neighborhood: string | null;
  address: GeocodeAddress | null;
  subtotal: number;
  taxaPadrao: number;
  freeAbove: number | null;
  regras: Array<{ bairro: string; taxa: number }>;
  deliveryConfig: Record<string, unknown> | null;
  storeLat: number | null;
  storeLng: number | null;
}): Promise<DeliveryCalcResult> {
  if (!opts.isDelivery) return { fee: 0, available: true };

  if (opts.deliveryConfig?.entregaUber === true) {
    return { fee: 0, available: true };
  }

  // Frete grátis acima de X vale pra qualquer modelo — avaliado antes de
  // qualquer cálculo por distância pra não gastar uma geocodificação à toa.
  const gratis = opts.freeAbove !== null && opts.subtotal >= opts.freeAbove;
  if (gratis) return { fee: 0, available: true };

  const modelo = opts.deliveryConfig?.modeloCobranca as string | undefined;
  const modelConfig = opts.deliveryConfig?.modelConfig as DeliveryModelConfigShape | undefined;

  // ── Modelos geo-based: precisam do endereço geocodificado e da loja
  // localizada no mapa. Sem um dos dois, não tem como calcular — bloqueia
  // em vez de cobrar um valor arbitrário.
  if (modelo === "dinamica" || modelo === "raio" || modelo === "bairro" || modelo === "matriz") {
    if (opts.storeLat === null || opts.storeLng === null) {
      return { fee: 0, available: false, status: 503, error: "A loja ainda não configurou sua localização para calcular o frete. Fale com o estabelecimento." };
    }
    if (!opts.address) {
      return { fee: 0, available: false, status: 400, error: "Endereço de entrega obrigatório para calcular o frete" };
    }

    let customerPoint;
    try {
      customerPoint = await geocodeAddress(opts.address);
    } catch (err) {
      console.error("[calcDeliveryFee] geocoding falhou:", (err as Error).message);
      return { fee: 0, available: false, status: 503, error: "Não foi possível calcular o frete agora. Tente novamente em instantes." };
    }
    if (!customerPoint) {
      return { fee: 0, available: false, status: 400, error: "Não foi possível localizar este endereço. Confira e tente novamente." };
    }

    const storePoint = { lat: opts.storeLat, lng: opts.storeLng };
    const distM  = distanceMeters(storePoint, { lat: customerPoint.lat, lng: customerPoint.lng });
    const distKm = distM / 1000;

    if (modelo === "dinamica") {
      const cfg     = modelConfig?.dinamica;
      const base    = parseFloat(cfg?.taxaBasica ?? "0") || 0;
      const baseKm  = parseFloat(cfg?.distanciaBase ?? "0") || 0;
      const perKm   = parseFloat(cfg?.valorPorKmAdicional ?? "0") || 0;
      const fee     = Math.max(0, base + Math.max(0, distKm - baseKm) * perKm);
      return { fee, available: true, distanceKm: distKm };
    }

    if (modelo === "raio") {
      const raios: Array<{ raioMetros: number; tipoCobranca?: "fixa" | "fixa_variavel"; valorFixo?: string; valorPorKm?: string }> =
        (modelConfig?.raio?.raios ?? [])
          .filter((r): r is typeof r & { raioMetros: number } => typeof r.raioMetros === "number")
          .sort((a, b) => a.raioMetros - b.raioMetros);
      const alvo = raios.find(r => distM <= r.raioMetros);
      if (!alvo) {
        return { fee: 0, available: false, status: 400, error: "Este endereço está fora da área de entrega." };
      }
      const fixo  = parseFloat(alvo.valorFixo ?? "0") || 0;
      const porKm = alvo.tipoCobranca === "fixa_variavel" ? (parseFloat(alvo.valorPorKm ?? "0") || 0) : 0;
      return { fee: Math.max(0, fixo + porKm * distKm), available: true, distanceKm: distKm };
    }

    if (modelo === "bairro") {
      const poligonos = modelConfig?.bairroDesenho?.poligonos ?? [];
      const dentro = poligonos.some(poly => pointInPolygon({ lat: customerPoint.lat, lng: customerPoint.lng }, poly));
      if (!dentro) {
        return { fee: 0, available: false, status: 400, error: "Este endereço está fora da área de entrega." };
      }
      const cfg   = modelConfig?.bairroDesenho;
      const fixo  = parseFloat(cfg?.valorFixo ?? "0") || 0;
      const porKm = cfg?.tipoCobranca === "fixa_variavel" ? (parseFloat(cfg?.valorPorKm ?? "0") || 0) : 0;
      return { fee: Math.max(0, fixo + porKm * distKm), available: true, distanceKm: distKm };
    }

    // matriz — faixas de distância em metros
    const faixas: Array<{ de: number; ate: number; valor?: string }> = (modelConfig?.matriz ?? [])
      .filter((f): f is typeof f & { de: number; ate: number } => typeof f.de === "number" && typeof f.ate === "number");
    const faixa = faixas.find(f => distM >= f.de && distM < f.ate);
    if (!faixa) {
      return { fee: 0, available: false, status: 400, error: "Este endereço está fora da área de entrega." };
    }
    return { fee: Math.max(0, parseFloat(faixa.valor ?? "0") || 0), available: true, distanceKm: distKm };
  }

  // ── "fixa" / "bairroFixo" / sem modelo configurado: motor simples de
  // sempre, via os campos já sincronizados deliveryFee/deliveryRules.
  const chave = opts.neighborhood?.trim().toLowerCase() ?? "";
  const regra = chave
    ? opts.regras.find(r => r.bairro?.trim().toLowerCase() === chave)
    : undefined;
  const taxa = regra !== undefined ? Number(regra.taxa) : opts.taxaPadrao;
  return { fee: Number.isFinite(taxa) && taxa > 0 ? taxa : 0, available: true };
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
