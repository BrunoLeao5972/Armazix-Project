// Banco local offline-first do PDV — RxDB sobre IndexedDB (via storage Dexie).
//
// Por que Dexie/IndexedDB e não SQLite nativo: IndexedDB já é persistido em
// disco pelo próprio Chromium (dentro da pasta userData do Electron), sem
// precisar de binário nativo — nada de node-gyp/electron-rebuild pra
// recompilar contra a ABI do Electron a cada versão. Isso é exatamente o
// "sem dependências externas no SO" pedido: só JavaScript, funciona no
// instalador .exe sem passo de compilação extra na máquina do cliente.
import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { productSchema } from "./schemas/products.schema";
import { categorySchema } from "./schemas/categories.schema";
import { orderSchema } from "./schemas/orders.schema";
import { userCacheSchema } from "./schemas/users-cache.schema";
import { syncQueueSchema } from "./schemas/sync-queue.schema";
import type { ProductDoc, CategoryDoc, OrderDoc, UserCacheDoc, SyncQueueDoc } from "./types";

export interface ArmazixCollections {
  products: RxCollection<ProductDoc>;
  categories: RxCollection<CategoryDoc>;
  orders: RxCollection<OrderDoc>;
  users_cache: RxCollection<UserCacheDoc>;
  sync_queue: RxCollection<SyncQueueDoc>;
}

export type ArmazixDatabase = RxDatabase<ArmazixCollections>;

let dbPromise: Promise<ArmazixDatabase> | null = null;

async function createDatabase(): Promise<ArmazixDatabase> {
  if (import.meta.env.DEV) {
    // Validação de schema em runtime + mensagens de erro legíveis — só em
    // dev, tem custo de performance e não deve ir pro build de produção.
    const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
    addRxPlugin(RxDBDevModePlugin);
  }

  const db = await createRxDatabase<ArmazixCollections>({
    name: "armazix_pdv",
    storage: getRxStorageDexie(),
    // Uma única janela do PDV por instalação — não há outra aba/processo
    // disputando o mesmo banco, então desliga a coordenação multi-tab (custo
    // zero de BroadcastChannel).
    multiInstance: false,
    eventReduce: true,
  });

  await db.addCollections({
    products:    { schema: productSchema },
    categories:  { schema: categorySchema },
    orders:      { schema: orderSchema },
    users_cache: { schema: userCacheSchema },
    sync_queue:  { schema: syncQueueSchema },
  });

  return db;
}

/** Singleton — a primeira chamada cria o banco, as seguintes reaproveitam a mesma instância. */
export function getDatabase(): Promise<ArmazixDatabase> {
  if (!dbPromise) dbPromise = createDatabase();
  return dbPromise;
}
