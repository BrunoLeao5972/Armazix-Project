// ─────────────────────────────────────────────────────────────────────────
// Edição completa de um pedido do Kanban — itens (adicionar/remover/mudar
// quantidade) e pagamento dividido de verdade (uma ou mais formas, cada
// uma com seu próprio valor). Só vale ENQUANTO o pedido ainda não foi
// concretizado (concretizedAt null) — depois disso, mexer em estoque/
// financeiro já lançado é estorno, uma operação bem diferente, fora de
// escopo aqui.
//
// Reaproveita priceOrder() (src/lib/pricing/order-pricing.ts) — a mesma
// fonte única de precificação do checkout e do Mercado Pago — pra nunca
// confiar em preço vindo do body: o admin manda só productId+quantity, o
// servidor recalcula tudo do banco pra cima.
// ─────────────────────────────────────────────────────────────────────────

import { createDb, createTenantDbTransactional, setTenantContext } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireStoreAccess, type AuthContext } from "@/lib/auth/require-store-access";
import { priceOrder, isPricingFailure, type IncomingItem } from "@/lib/pricing/order-pricing";
import { adjustReservation, StockReservationError, type ReservationDelta } from "@/lib/inventory/stock-reservation";

const { orders, orderItems, orderPayments, stores } = schema;

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
  };
  if (!body.orderId || !body.items?.length) return err("orderId e items obrigatórios");

  for (const p of body.payments ?? []) {
    if (!VALID_PAYMENT_METHODS.includes(p.formaPagamento)) return err("Forma de pagamento inválida");
    if (!p.valor || parseFloat(p.valor.replace(",", ".")) <= 0) return err("Valor de pagamento inválido");
  }

  const dbUrl = process.env.DATABASE_URL!;
  // Conexão HTTP simples pras pré-checagens e o priceOrder() — mesmo
  // padrão de createOrderHandler (db separado da transação de escrita,
  // que usa a conexão tenant-scoped WebSocket, tipo diferente).
  const pdb = createDb(dbUrl);

  // Pré-checagens fora da transação: pedido existe, pertence à loja, e
  // ainda não foi concretizado — editar itens/estoque de uma venda já
  // fechada é estorno, feature diferente.
  const [existingOrder] = await pdb
    .select()
    .from(orders)
    .where(and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)))
    .limit(1);
  if (!existingOrder) return err("Pedido não encontrado", 404);
  if (existingOrder.concretizedAt !== null) {
    return err("Esse pedido já foi concluído/concretizado — não é possível editar os itens.", 409);
  }
  if (existingOrder.status === "cancelled") {
    return err("Esse pedido está cancelado — não é possível editar os itens.", 409);
  }

  const [storeConfig] = await pdb
    .select({ allowNegativeStock: stores.allowNegativeStock })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  const existingItems = await pdb
    .select({ productId: orderItems.productId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, body.orderId));

  // ── Reprecifica com priceOrder — mesmo endereço/cupom/tipo do pedido já
  // existente (não editáveis por aqui); nunca confia em preço do body. ──
  const incomingItems: IncomingItem[] = body.items.map(i => ({
    productId:         i.productId,
    quantity:          i.quantity,
    additionsSnapshot: i.additionsSnapshot ?? null,
    notes:             i.notes ?? null,
  }));

  const priced = await priceOrder(pdb, {
    storeId,
    type:            existingOrder.type,
    items:           incomingItems,
    addressSnapshot: existingOrder.addressSnapshot,
    couponId:        existingOrder.couponId,
    channel:         "store",
  });
  if (isPricingFailure(priced)) return err(priced.error, priced.status);

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

  const db = await createTenantDbTransactional(dbUrl, storeId);

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(setTenantContext(storeId));

      await adjustReservation(tx, storeId, deltas, storeConfig?.allowNegativeStock !== false);

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
          subtotal:    priced.subtotal,
          deliveryFee: priced.deliveryFee,
          discount:    priced.discount,
          total:       priced.total,
          updatedAt:   new Date(),
        })
        .where(eq(orders.id, body.orderId!));

      let paymentsInserted: (typeof orderPayments.$inferSelect)[] = [];
      if (body.payments) {
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

      return { paymentsInserted };
    });

    const updatedOrder = await db.query.orders.findFirst({
      where: and(eq(orders.id, body.orderId), eq(orders.storeId, storeId)),
      with: { items: true, payments: true },
    });

    return json({ success: true, order: updatedOrder, payments: result.paymentsInserted });
  } catch (error) {
    if (error instanceof StockReservationError) {
      return err(error.message, 409);
    }
    console.error("[updateOrderItems] erro:", error);
    return err("Erro ao atualizar itens do pedido", 500);
  }
}
