// ─────────────────────────────────────────────────────────────────────────
// Reserva de estoque para pedidos de delivery/retirada do site.
//
// Modelo: na criação do pedido, o estoque fica RESERVADO (products.reserved
// sobe, products.stock não muda) — "disponível pra vender" = stock -
// reserved. A baixa real só acontece quando a venda é concretizada
// (encerramento pelo PDV, ou status "delivered" pra lojas sem PDV). Se o
// pedido for cancelado antes disso, a reserva é liberada sem nunca ter
// mexido no estoque físico.
//
// As três funções abaixo recebem sempre uma transação já aberta (`tx`) —
// nunca abrem conexão própria — pra funcionar dentro de qualquer um dos
// padrões de transação já usados no projeto (createTenantDbTransactional em
// crud-handler.ts, createDbTransactional em pdv-handler.ts).
// ─────────────────────────────────────────────────────────────────────────

import { and, eq, sql } from "drizzle-orm";
import { schema, createTenantDbTransactional } from "@/lib/db";

const { products, stockMovements } = schema;

type TenantDb = Awaited<ReturnType<typeof createTenantDbTransactional>>;
export type Tx = Parameters<Parameters<TenantDb["transaction"]>[0]>[0];

export interface ReservationItem {
  productId: string | null;
  productName: string;
  quantity: number;
}

export class StockReservationError extends Error {
  constructor(public readonly productName: string, public readonly available: number, public readonly requested: number) {
    super(`Estoque insuficiente para "${productName}": ${available} disponível(is), ${requested} solicitado(s)`);
    this.name = "StockReservationError";
  }
}

// ─── Reservar — na criação do pedido ──────────────────────────────
// Produtos sem trackStock são ignorados (estoque infinito, como já é hoje).
// Se a loja permite estoque negativo (allowNegativeStock, default true),
// reserva sem checar limite — mesmo comportamento permissivo de sempre. Se
// não permite, faz um UPDATE atômico condicional: falha (lança
// StockReservationError) se `stock - reserved` não cobrir a quantidade
// pedida. Chamado dentro da MESMA transação que insere o pedido — se
// lançar, o caller inteiro desfaz e o pedido não chega a ser criado.
export async function reserveStock(
  tx: Tx,
  storeId: string,
  items: ReservationItem[],
  allowNegativeStock: boolean,
): Promise<void> {
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;

    const [prod] = await tx
      .select({ stock: products.stock, reserved: products.reserved, trackStock: products.trackStock })
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
      .limit(1);
    if (!prod?.trackStock) continue;

    if (allowNegativeStock) {
      await tx.update(products)
        .set({ reserved: sql`${products.reserved} + ${item.quantity}`, updatedAt: new Date() })
        .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));
      continue;
    }

    const [updated] = await tx.update(products)
      .set({ reserved: sql`${products.reserved} + ${item.quantity}`, updatedAt: new Date() })
      .where(and(
        eq(products.id, item.productId),
        eq(products.storeId, storeId),
        sql`(${products.stock} - ${products.reserved}) >= ${item.quantity}`,
      ))
      .returning({ id: products.id });

    if (!updated) {
      throw new StockReservationError(item.productName, (prod.stock ?? 0) - (prod.reserved ?? 0), item.quantity);
    }
  }
}

// ─── Liberar — pedido cancelado antes de concretizar ──────────────
// Nunca mexe em `stock` (a dedução real nunca aconteceu) nem insere
// stockMovements (reserva não é um movimento físico). GREATEST(0, ...)
// protege contra `reserved` negativo em qualquer race/duplo-cancelamento.
export async function releaseReservation(
  tx: Tx,
  storeId: string,
  items: ReservationItem[],
): Promise<void> {
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    await tx.update(products)
      .set({ reserved: sql`GREATEST(0, ${products.reserved} - ${item.quantity})`, updatedAt: new Date() })
      .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));
  }
}

// ─── Concretizar — venda fechada de verdade ───────────────────────
// Converte a reserva em baixa real: desconta de `stock`, zera a fatia
// correspondente de `reserved`, e registra o movimento de estoque tipo
// "VENDA" — mesmo padrão já usado pela venda presencial do PDV.
export async function concretizeReservation(
  tx: Tx,
  storeId: string,
  items: ReservationItem[],
  orderId: string,
  orderNumber: number,
): Promise<void> {
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;

    const [prod] = await tx
      .select({ stock: products.stock, trackStock: products.trackStock })
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
      .limit(1);
    if (!prod?.trackStock) continue;

    const balanceBefore = prod.stock ?? 0;
    const balanceAfter  = balanceBefore - item.quantity; // permite saldo negativo (allowNegativeStock)

    await tx.update(products)
      .set({
        stock:     balanceAfter,
        reserved:  sql`GREATEST(0, ${products.reserved} - ${item.quantity})`,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)));

    await tx.insert(stockMovements).values({
      storeId,
      productId:   item.productId,
      productName: item.productName,
      type:        "VENDA",
      quantity:    item.quantity,
      balanceBefore,
      balanceAfter,
      origem: balanceAfter < 0
        ? `Venda s/ estoque — Pedido #${orderNumber}`
        : `Venda — Pedido #${orderNumber}`,
      orderId,
    });
  }
}
