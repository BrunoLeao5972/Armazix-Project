// Formatos dos documentos locais — espelham os campos que a API Cloud do
// Armazix já devolve (ver src/lib/db/schema.ts e src/lib/api/*-handler.ts
// no app principal), mais os campos de controle que só existem localmente
// (synced, syncAttempts etc.).

export interface ProductImage {
  url: string;
  isPrimary: boolean;
}

export interface ProductDoc {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  images: ProductImage[];
  emoji: string | null;
  /** Sempre string decimal ("12.90"), nunca float — mesma convenção do backend. */
  price: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  sku: string | null;
  barcode: string | null;
  pdvCode: string | null;
  stock: number;
  lowStockThreshold: number | null;
  unit: string | null;
  badge: string | null;
  productType: string;
  isWeightScale: boolean;
  trackStock: boolean;
  /** Usado pela aba "Favoritos" no PDV. */
  featured: boolean;
  active: boolean;
  allowObservation: boolean;
  promoConfig: Record<string, unknown> | null;
  variationGroups: Array<Record<string, unknown>>;
  updatedAt: string;
}

export interface CategoryDoc {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  emoji: string | null;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  position: number;
  active: boolean;
}

export interface OrderItemLocal {
  productId: string | null;
  productName: string;
  productEmoji?: string | null;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface OrderDoc {
  /** uuid gerado no cliente — a venda existe com esse id mesmo antes de sincronizar. */
  id: string;
  storeId: string;
  sessaoId: string;
  mesaLabel: string | null;
  paymentMethod: string;
  installments: number | null;
  items: OrderItemLocal[];
  subtotal: string;
  discount: string | null;
  total: string;
  /** Hora real da venda — não muda quando a sincronização acontece depois. */
  createdAt: string;
  synced: boolean;
  serverOrderId: string | null;
  serverNumber: number | null;
  syncError: string | null;
  syncAttempts: number;
}

export interface UserCacheDoc {
  /** = user.id vindo da API — chave estável entre logins online/offline. */
  id: string;
  email: string;
  name: string;
  role: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  /** Hash LOCAL (PBKDF2, ver lib/crypto.ts) — nunca o hash bcrypt do servidor,
   *  que o cliente nunca chega a ver. */
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  lastOnlineLoginAt: string;
}

export type SyncOperationType = "finalizar_venda";

export interface SyncQueueDoc {
  id: string;
  type: SyncOperationType;
  /** Aponta pro documento de origem (ex.: orders.id) — usado pra marcar o
   *  resultado de volta no documento certo depois de sincronizar. */
  refId: string;
  /** Corpo já pronto no formato que o endpoint espera — monta uma vez, no
   *  momento da venda, e só é reenviado como está. */
  payload: Record<string, unknown>;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}
