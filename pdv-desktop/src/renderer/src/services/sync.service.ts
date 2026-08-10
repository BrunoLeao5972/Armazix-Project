// Sincronização com a nuvem — duas responsabilidades:
//
//  1. syncCatalog(): puxa produtos/categorias da API pro banco local
//     (download). Chamado no login online e no botão de sincronização manual.
//  2. drainQueue(): pega toda venda pendente em sync_queue (status
//     "pending"/"failed") e reenvia em lote pra API (upload), marcando o
//     pedido local como synced:true. Chamado automaticamente quando a rede
//     volta (ver network.service.ts) e também manualmente.
//
// Cada venda entra primeiro no banco local (enqueueSale) — online ou
// offline, o fluxo de gravação é sempre o mesmo; a única diferença é
// QUANDO o drain consegue esvaziar a fila.
import { getDatabase } from "../db/database";
import type { OrderDoc, OrderItemLocal, ProductDoc, CategoryDoc } from "../db/types";
import { api, ApiRequestError } from "./api";
import { isOnline$ } from "./network.service";

// ─── Catálogo (download) ───────────────────────────────────────────

interface RemoteProduct {
  id: string; storeId: string; categoryId: string | null; name: string;
  description: string | null; imageUrl: string | null;
  images: Array<{ url: string; isPrimary: boolean }> | null;
  emoji: string | null; price: string; compareAtPrice: string | null; costPrice: string | null;
  sku: string | null; barcode: string | null; pdvCode: string | null;
  stock: number | null; lowStockThreshold: number | null; unit: string | null; badge: string | null;
  productType: string; isWeightScale: boolean; trackStock: boolean | null; featured: boolean | null;
  active: boolean | null;
  allowObservation: boolean | null; promoConfig: Record<string, unknown> | null;
  variationGroups: Array<Record<string, unknown>> | null; updatedAt: string;
}

interface RemoteCategory {
  id: string; storeId: string; parentId: string | null; name: string;
  emoji: string | null; icon: string | null; color: string | null; imageUrl: string | null;
  position: number | null; active: boolean | null;
}

function toProductDoc(p: RemoteProduct): ProductDoc {
  return {
    id: p.id, storeId: p.storeId, categoryId: p.categoryId, name: p.name,
    description: p.description, imageUrl: p.imageUrl, images: p.images ?? [],
    emoji: p.emoji, price: p.price, compareAtPrice: p.compareAtPrice, costPrice: p.costPrice,
    sku: p.sku, barcode: p.barcode, pdvCode: p.pdvCode,
    stock: p.stock ?? 0, lowStockThreshold: p.lowStockThreshold, unit: p.unit, badge: p.badge,
    productType: p.productType, isWeightScale: p.isWeightScale, trackStock: p.trackStock ?? false,
    featured: p.featured ?? false,
    active: p.active ?? true, allowObservation: p.allowObservation ?? false,
    promoConfig: p.promoConfig, variationGroups: p.variationGroups ?? [], updatedAt: p.updatedAt,
  };
}

function toCategoryDoc(c: RemoteCategory): CategoryDoc {
  return {
    id: c.id, storeId: c.storeId, parentId: c.parentId, name: c.name,
    emoji: c.emoji, icon: c.icon, color: c.color, imageUrl: c.imageUrl,
    position: c.position ?? 0, active: c.active ?? true,
  };
}

export interface CatalogSyncResult {
  products: number;
  categories: number;
  syncedAt: string;
}

export async function syncCatalog(): Promise<CatalogSyncResult> {
  const db = await getDatabase();
  const [productsRes, categoriesRes] = await Promise.all([
    api.get<{ products: RemoteProduct[] }>("/api/products/list-admin?scope=pdv"),
    api.get<{ categories: RemoteCategory[] }>("/api/categories/list-admin"),
  ]);

  await db.products.bulkUpsert(productsRes.products.map(toProductDoc));
  await db.categories.bulkUpsert(categoriesRes.categories.map(toCategoryDoc));

  return {
    products: productsRes.products.length,
    categories: categoriesRes.categories.length,
    syncedAt: new Date().toISOString(),
  };
}

// ─── Vendas (upload) ────────────────────────────────────────────────

export interface NewSaleInput {
  storeId: string;
  sessaoId: string;
  mesaLabel?: string | null;
  paymentMethod: string;
  installments?: number | null;
  items: OrderItemLocal[];
  subtotal: string;
  discount?: string | null;
  total: string;
}

export async function enqueueSale(input: NewSaleInput): Promise<OrderDoc> {
  const db = await getDatabase();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const orderDoc: OrderDoc = {
    id,
    storeId: input.storeId,
    sessaoId: input.sessaoId,
    mesaLabel: input.mesaLabel ?? null,
    paymentMethod: input.paymentMethod,
    installments: input.installments ?? null,
    items: input.items,
    subtotal: input.subtotal,
    discount: input.discount ?? null,
    total: input.total,
    createdAt,
    synced: false,
    serverOrderId: null,
    serverNumber: null,
    syncError: null,
    syncAttempts: 0,
  };
  await db.orders.insert(orderDoc);

  await db.sync_queue.insert({
    id: crypto.randomUUID(),
    type: "finalizar_venda",
    refId: id,
    payload: {
      sessaoId: input.sessaoId,
      mesaLabel: input.mesaLabel ?? undefined,
      paymentMethod: input.paymentMethod,
      installments: input.installments ?? undefined,
      items: input.items,
      subtotal: input.subtotal,
      discount: input.discount ?? undefined,
      total: input.total,
    },
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt,
    updatedAt: createdAt,
  });

  // Já tenta drenar na hora se estiver online — não espera o próximo tick
  // do monitor de rede pra dar a sensação de "vendeu, já sincronizou".
  void drainQueue();

  return orderDoc;
}

interface FinalizarVendaResponse {
  success: true;
  order: { id: string; number: number };
}

let draining = false;

/** Reenvia toda venda pendente, uma a uma — um erro numa não trava as outras. */
export async function drainQueue(): Promise<{ synced: number; failed: number }> {
  if (draining || !isOnline$.value) return { synced: 0, failed: 0 };
  draining = true;
  let synced = 0;
  let failed = 0;

  try {
    const db = await getDatabase();
    const pending = await db.sync_queue
      .find({ selector: { status: { $in: ["pending", "failed"] } } })
      .exec();
    pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const entry of pending) {
      await entry.patch({ status: "syncing" });
      try {
        if (entry.type === "finalizar_venda") {
          const res = await api.post<FinalizarVendaResponse>("/api/pdv/finalizar-venda", entry.payload);
          const order = await db.orders.findOne(entry.refId).exec();
          if (order) {
            await order.patch({
              synced: true,
              serverOrderId: res.order.id,
              serverNumber: res.order.number,
              syncError: null,
            });
          }
          await entry.remove();
          synced++;
        }
      } catch (err) {
        const message = err instanceof ApiRequestError ? err.message : "Falha ao sincronizar";
        const order = await db.orders.findOne(entry.refId).exec();
        if (order) {
          await order.patch({ syncError: message, syncAttempts: order.syncAttempts + 1 });
        }
        await entry.patch({
          status: "failed",
          attempts: entry.attempts + 1,
          lastError: message,
          updatedAt: new Date().toISOString(),
        });
        failed++;
      }
    }
  } finally {
    draining = false;
  }

  return { synced, failed };
}

/** Drena automaticamente sempre que a conexão volta. */
export function watchConnectionAndDrain(): () => void {
  const sub = isOnline$.subscribe((online) => {
    if (online) void drainQueue();
  });
  return () => sub.unsubscribe();
}

export async function countPendingSales(): Promise<number> {
  const db = await getDatabase();
  return db.orders.count({ selector: { synced: false } }).exec();
}
