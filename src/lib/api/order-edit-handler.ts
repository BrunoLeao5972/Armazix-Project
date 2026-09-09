// ─────────────────────────────────────────────────────────────────────────
// Edição completa de um pedido do Kanban — itens (adicionar/remover/mudar
// quantidade), endereço de entrega (com taxa recalculada automaticamente)
// e pagamento dividido de verdade (uma ou mais formas, cada uma com seu
// próprio valor). Disponível em qualquer etapa do fluxo, inclusive pedido
// já CONCRETIZADO (baixa real de estoque + lançamento financeiro já
// feitos — pode acontecer antes de "Entregue", quando o PDV expede a
// encomenda em encerrarEncomendaHandler) — só trava mesmo em
// concluído/cancelado, onde mexer é estorno completo, fora de escopo.
//
// Reaproveita priceOrder() (src/lib/pricing/order-pricing.ts) — a mesma
// fonte única de precificação do checkout e do Mercado Pago — pra nunca
// confiar em preço vindo do body: o admin manda só productId+quantity (e,
// opcionalmente, um endereço novo), o servidor recalcula tudo do banco
// pra cima, taxa de entrega inclusa (estimateDelivery).
// ─────────────────────────────────────────────────────────────────────────

import { createDb, createDbTransactional } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { priceOrder, isPricingFailure, type IncomingItem } from "@/lib/pricing/order-pricing";
import {
  adjustReservation, adjustConcretizedStock, StockReservationError, type ReservationDelta,
} from "@/lib/inventory/stock-reservation";

const { orders, orderItems, orderPayments, stores, financeiroLancamentos } = schema;

const JSON_HDR = { "content-type": "application/json" };
const json     = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HDR });
const err      = (msg: string, status = 400) => json({ error: msg }, status);

const VALID_PAYMENT_METHODS = ["pix", "card", "debit", "cash"];

interface EditItemInput {
  productId: string;
  quantity: number;
  additionsSnapshot?: Array<{ name?: string; price?: string | number }> | null;
  notes?: string | null;
}
interface EditPaymentInput {
  formaPagamento: string;
  valor: string;
}
interface EditAddressInput {
  street?: string | null; number?: string | null; neighborhood?: string | null;
  city?: string | null; state?: string | null; zip?: string | null; complement?: string | null;
}

// ─── POST /api/orders/update-items ────────────────────────────────
export async function updateOrderItemsHandler(request: Request, auth?: AuthContext): Promise<Response> {
  let storeId: string;
  try {
    ({ storeId } = await requireStoreAccess(auth));
  } catch (error) {
    return err((error as Error).message, auth?.userId ? 403 : 401);
  }

  const body = await request.json() as {
    orderId?: string;
    items?: EditItemInput[];
    payments?: EditPaymentInput[];
    /** Correção manual da taxa de entrega — sobrepõe o valor que priceOrder()
     *  calcularia (distância/bairro/etc). Pedido de retirada ignora isso
     *  (frete sempre 0). Undefined = mantém o cálculo automático de sempre —
     *  que passa a valer de novo (recalculado do zero) quando o endereço
     *  muda nessa mesma edição. */
    deliveryFee?: string;
    /** Endereço novo — quando vier, substitui o do pedido ANTES de repreçar,
     *  então a taxa de entrega recalcula pro endereço novo automaticamente
     *  (a menos que deliveryFee também tenha vindo, aí a correção manual
     *  sempre vence). */
    addressSnapshot?: EditAddressInput | null;
  };
  if (!body.orderId || !body.items?.length) return err("orderId e items obrigatórios");

  for (const p of body.payments ?? []) {
    if (!VALID_PAYMENT_METHODS.includes(p.formaPagamento)) return err("Forma de pagamento inválida");
    if (!p.valor || parseFloat(p.valor.replace(",", ".")) <= 0) return err("Valor de pagamento inválido");
  }
  if (body.deliveryFee !== undefined) {
    const v = parseFloat(body.deliveryFee.replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return err("Taxa de entrega inválida");
  }

  // orders.addressSnapshot exige rua/número/bairro/cidade/UF/CEP como
  // string obrigatória (schema) — o body chega com tudo opcional, então
  // valida e normaliza antes de usar tanto no priceOrder() quanto no save.
  let novoEndereco: {
    street: string; number: string; neighborhood: string;
    city: string; state: string; zip: string; complement?: string;
  } | undefined;
  if (body.addressSnapshot !== undefined) {
    const a = body.addressSnapshot;
    if (!a?.street?.trim() || !a?.number?.trim() || !a?.city?.trim() || !a?.state?.trim()) {
      return err("Endereço incompleto — rua, número, cidade e UF são obrigatórios");
    }
    novoEndereco = {
      street: a.street.trim(), number: a.number.trim(),
      neighborhood: a.neighborhood?.trim() || "-",
      city: a.city.trim(), state: a.state.trim().toUpperCase().slice(0, 2),
      zip: a.zip?.trim() || "00000-000",
      ...(a.complement?.trim() && { complement: a.complement.trim() }),
    };
  }

  const dbUrl = process.env.DATABASE_URL!;
  // Conexão HTTP simples pras pré-checagens e o priceOrder() — mesmo
  // padrão de createOrderHandler (db separado da transação de escrita,
  // que usa a conexão tenant-scoped WebSocket, tipo diferente).
  const pdb = createDb(dbUrl);

  // Pré-checagens fora da transação: pedido existe, pertence à loja, e
  // ainda está em algum status ativo — só trava mesmo em concluído/
  // cancelado (mexer ali é estorno completo, feature diferente).
  const [existingOrder] = await pdb
    .select()
    .from(orders)
    .where(and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)))
    .limit(1);
  if (!existingOrder) return err("Pedido não encontrado", 404);
  if (existingOrder.status === "delivered") {
    return err("Esse pedido já foi concluído — não é possível editar os itens.", 409);
  }
  if (existingOrder.status === "cancelled") {
    return err("Esse pedido está cancelado — não é possível editar os itens.", 409);
  }
  // Concretizado (baixa real de estoque + financeiro já feitos) mas ainda
  // não "Entregue" — acontece quando o PDV expede a encomenda. Editar
  // continua liberado, só muda o jeito de ajustar estoque/financeiro
  // abaixo (estoque real + lançamento de ajuste, em vez de reserva).
  const isConcretized = existingOrder.concretizedAt !== null;

  const [storeConfig] = await pdb
    .select({ allowNegativeStock: stores.allowNegativeStock })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  const existingItems = await pdb
    .select({ productId: orderItems.productId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, body.orderId));

  // ── Reprecifica com priceOrder — endereço/cupom/tipo do pedido já
  // existente, a menos que um endereço novo tenha vindo (aí é ele que
  // decide a taxa de entrega). Nunca confia em preço do body. ──
  const incomingItems: IncomingItem[] = body.items.map(i => ({
    productId:         i.productId,
    quantity:          i.quantity,
    additionsSnapshot: i.additionsSnapshot ?? null,
    notes:             i.notes ?? null,
  }));

  const enderecoParaPrecificar = novoEndereco ?? existingOrder.addressSnapshot;

  const priced = await priceOrder(pdb, {
    storeId,
    type:            existingOrder.type,
    items:           incomingItems,
    addressSnapshot: enderecoParaPrecificar,
    couponId:        existingOrder.couponId,
    channel:         "store",
  });
  if (isPricingFailure(priced)) return err(priced.error, priced.status);

  // ── Correção manual da taxa de entrega (achado real: o cálculo automático
  // por distância/bairro nem sempre bate com o custo de verdade — o
  // operador precisa poder corrigir na hora de editar o pedido). Pedido de
  // retirada nunca cobra frete, mesmo se um valor vier no body. Sem
  // correção manual, vale o cálculo automático de cima — que já reflete o
  // endereço novo quando ele veio nessa mesma edição.
  const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
  const deliveryFeeFinal = body.deliveryFee !== undefined && existingOrder.type !== "pickup"
    ? money(parseFloat(body.deliveryFee.replace(",", ".")))
    : priced.deliveryFee;
  const totalFinal = body.deliveryFee !== undefined && existingOrder.type !== "pickup"
    ? money(Math.max(0, parseFloat(priced.subtotal) + parseFloat(deliveryFeeFinal) - parseFloat(priced.discount)))
    : priced.total;

  // ── Diferença de valor em relação ao total que o pedido já tinha — só
  // importa pra pedido já concretizado, onde vira um lançamento financeiro
  // novo (cobrança extra ou troco/devolução). Pra pedido ainda não
  // concretizado, nada foi lançado ainda, então não há o que ajustar.
  const totalAntigo = parseFloat(existingOrder.total) || 0;
  const diferencaValor = parseFloat(totalFinal) - totalAntigo;

  // ── Delta de reserva de estoque por produto (soma quantidades repetidas
  // do mesmo produto em cada lado antes de comparar). ──
  const oldQtyByProduct = new Map<string, number>();
  for (const i of existingItems) {
    if (!i.productId) continue;
    oldQtyByProduct.set(i.productId, (oldQtyByProduct.get(i.productId) ?? 0) + i.quantity);
  }
  const newQtyByProduct = new Map<string, { qty: number; name: string }>();
  for (const i of priced.items) {
    const cur = newQtyByProduct.get(i.productId);
    newQtyByProduct.set(i.productId, { qty: (cur?.qty ?? 0) + i.quantity, name: i.productName });
  }
  const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);
  const deltas: ReservationDelta[] = [...allProductIds].map(productId => {
    const oldQty = oldQtyByProduct.get(productId) ?? 0;
    const novo   = newQtyByProduct.get(productId);
    return { productId, productName: novo?.name ?? "Produto", deltaQty: (novo?.qty ?? 0) - oldQty };
  });

  // Admin/BYPASSRLS — não a conexão tenant-scoped. Achado real dessa sessão
  // (ver updateOrderStatusHandler/encerrarEncomendaHandler): financeiro_lancamentos
  // só tem policy de SELECT pra armazix_tenant, e esse fluxo pode precisar
  // gravar um lançamento de ajuste quando o pedido já está concretizado.
  // Isolamento continua garantido pelos filtros eq(storeId,...) manuais já
  // presentes em toda query, mesmo padrão de finalizarVendaPdvHandler.
  const db = createDbTransactional(dbUrl);

  try {
    const result = await db.transaction(async (tx) => {
      if (isConcretized) {
        // Pedido já teve baixa REAL de estoque — ajusta o saldo de verdade,
        // não a reserva (não há reserva ativa pra concretizar de novo).
        await adjustConcretizedStock(tx, storeId, deltas, body.orderId!, existingOrder.number);
      } else {
        await adjustReservation(tx, storeId, deltas, storeConfig?.allowNegativeStock !== false);
      }

      await tx.delete(orderItems).where(eq(orderItems.orderId, body.orderId!));
      await tx.insert(orderItems).values(priced.items.map(item => ({
        orderId:           body.orderId!,
        productId:         item.productId,
        productName:       item.productName,
        productEmoji:      item.productEmoji,
        productImage:      item.productImage,
        quantity:          item.quantity,
        unitPrice:         item.unitPrice,
        additionsTotal:    item.additionsTotal,
        total:             item.total,
        additionsSnapshot: item.additionsSnapshot,
        notes:             item.notes,
      })));

      await tx.update(orders)
        .set({
          subtotal:        priced.subtotal,
          deliveryFee:     deliveryFeeFinal,
          discount:        priced.discount,
          total:           totalFinal,
          ...(novoEndereco && { addressSnapshot: novoEndereco }),
          updatedAt:       new Date(),
        })
        .where(eq(orders.id, body.orderId!));

      let paymentsInserted: (typeof orderPayments.$inferSelect)[] = [];
      let ajusteLancamento: (typeof financeiroLancamentos.$inferSelect) | null = null;

      if (isConcretized) {
        // Pedido já concretizado: "payments" aqui não substitui o
        // pagamento inteiro (esse já aconteceu de verdade) — só escolhe a
        // forma pra rotular o AJUSTE (a diferença), se houver.
        if (Math.abs(diferencaValor) > 0.01) {
          const formaAjuste = body.payments?.[0]?.formaPagamento || existingOrder.paymentMethod || "outros";
          const cobrancaExtra = diferencaValor > 0;
          const todayStr = new Date().toISOString().slice(0, 10);
          [ajusteLancamento] = await tx.insert(financeiroLancamentos).values({
            storeId,
            tipo:            cobrancaExtra ? "entrada" : "saida",
            categoria:       "ajuste_pedido",
            descricao:       cobrancaExtra
              ? `Ajuste (cobrança extra) — Pedido #${existingOrder.number}`
              : `Ajuste (troco/devolução) — Pedido #${existingOrder.number}`,
            valor:           money(Math.abs(diferencaValor)),
            metodoPagamento: formaAjuste,
            status:          "liquidado",
            dataCompetencia: todayStr,
            dataPagamento:   todayStr,
            orderId:         body.orderId!,
          }).returning();
        }
      } else if (body.payments) {
        await tx.delete(orderPayments).where(eq(orderPayments.orderId, body.orderId!));
        if (body.payments.length > 0) {
          paymentsInserted = await tx.insert(orderPayments).values(body.payments.map(p => ({
            storeId, orderId: body.orderId!,
            formaPagamento: p.formaPagamento,
            valor: parseFloat(p.valor.replace(",", ".")).toFixed(2),
          }))).returning();
        }

        // orders.paymentMethod continua espelhando uma forma só, pros
        // lugares que ainda leem esse campo (badge do card, relatórios) —
        // 1 forma → essa forma; 2+ → "misto"; 0 → mantém como estava.
        const novoMetodo = paymentsInserted.length === 1
          ? paymentsInserted[0].formaPagamento
          : paymentsInserted.length > 1
          ? "misto"
          : existingOrder.paymentMethod;
        await tx.update(orders).set({ paymentMethod: novoMetodo }).where(eq(orders.id, body.orderId!));
      }

      return { paymentsInserted, ajusteLancamento };
    });

    const updatedOrder = await db.query.orders.findFirst({
      where: and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)),
      // customer: sem isso, o card no Kanban perdia o nome do cliente
      // depois de qualquer edição (normalize() em pedidos.tsx cai pro
      // fallback "Cliente não identificado" quando customer vem undefined).
      // productImage fora do items: guarda o PNG do produto inteiro em
      // base64 (até ~600KB por item) e não é usado em lugar nenhum do
      // Kanban/modal de edição.
      with: { items: { columns: { productImage: false } }, payments: true, customer: true },
    });

    return json({
      success: true, order: updatedOrder,
      payments: result.paymentsInserted, ajusteLancamento: result.ajusteLancamento,
    });
  } catch (error) {
    if (error instanceof StockReservationError) {
      return err(error.message, 409);
    }
    console.error("[updateOrderItems] erro:", error);
    return err("Erro ao atualizar itens do pedido", 500);
  }
}
