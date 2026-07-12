import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── STORES (Lojas) ────────────────────────────────────────────
export const stores = pgTable("stores", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  bannerMobileUrl: text("banner_mobile_url"),
  bannerIntervalMs: integer("banner_interval_ms").default(5000),
  primaryColor: varchar("primary_color", { length: 7 }).default("#00C853"),
  backgroundColor: varchar("background_color", { length: 7 }),
  textColor: varchar("text_color", { length: 7 }),
  accentColor: varchar("accent_color", { length: 7 }),
  font: varchar("font", { length: 50 }).default("Inter"),
  cnpj: varchar("cnpj", { length: 18 }),
  ownerName: varchar("owner_name", { length: 120 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 120 }),
  address: jsonb("address").$type<{
    street: string; number: string; neighborhood: string; city: string; state: string; zip: string; complement?: string;
  }>(),
  deliveryEnabled: boolean("delivery_enabled").default(true),
  pickupEnabled: boolean("pickup_enabled").default(true),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  minDeliveryOrder: numeric("min_delivery_order", { precision: 10, scale: 2 }).default("0"),
  deliveryEstimate: varchar("delivery_estimate", { length: 30 }).default("30-50 min"),
  businessHours: jsonb("business_hours").$type<Array<{ day: string; open: string; close: string; closed: boolean }>>(),
  showPrice: boolean("show_price").default(true),
  whatsappOrderEnabled: boolean("whatsapp_order_enabled").default(false),
  whatsappPhone: varchar("whatsapp_phone", { length: 20 }),
  highlightLowStock: boolean("highlight_low_stock").default(false),
  mpAccessToken: text("mp_access_token"),
  mpPublicKey: text("mp_public_key"),
  paymentMethodsConfig: jsonb("payment_methods_config").$type<
    import("@/lib/store-context").PaymentMethodConfig[]
  >(),
  deliveryPaymentEnabled: boolean("delivery_payment_enabled").default(true),
  deliveryRules: jsonb("delivery_rules").$type<Array<{ bairro: string; taxa: number }>>(),
  freeShippingAbove: numeric("free_shipping_above", { precision: 10, scale: 2 }),
  /** Modelo v2 de configuração de pagamento — substitui paymentMethodsConfig + deliveryPaymentEnabled */
  paymentConfig: jsonb("payment_config").$type<import("@/lib/store-context").PaymentConfig>(),
  wppConfig: jsonb("wpp_config").$type<import("@/lib/whatsapp-sender").WppConfig>(),
  deliveryConfig: jsonb("delivery_config").$type<Record<string, unknown>>(),
  plan: varchar("plan", { length: 20 }).default("free"),
  planStatus: varchar("plan_status", { length: 20 }).default("active"),
  planExpiresAt: timestamp("plan_expires_at"),
  mpSubscriptionId: varchar("mp_subscription_id", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 20 }).default("card_recurring"),
  pdvEnabled: boolean("pdv_enabled").default(false),
  mpPaymentId: varchar("mp_payment_id", { length: 100 }),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }),
  paymentStatus: varchar("payment_status", { length: 20 }),
  rating: numeric("rating", { precision: 2, scale: 1 }).default("4.8"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("stores_slug_idx").on(t.slug),
  index("stores_active_idx").on(t.active),
]);

export const storesRelations = relations(stores, ({ many }) => ({
  categories: many(categories),
  products: many(products),
  orders: many(orders),
  coupons: many(coupons),
  banners: many(banners),
  storeUsers: many(storeUsers),
  roleProfiles: many(roleProfiles),
}));

// ─── BANNERS ────────────────────────────────────────────────────
export const banners = pgTable("banners", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url"),
  gradientFrom: varchar("gradient_from", { length: 7 }),
  gradientTo: varchar("gradient_to", { length: 7 }),
  emoji: varchar("emoji", { length: 10 }),
  linkUrl: text("link_url"),
  position: integer("position").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("banners_store_idx").on(t.storeId),
]);

export const bannersRelations = relations(banners, ({ one }) => ({
  store: one(stores, { fields: [banners.storeId], references: [stores.id] }),
}));

// ─── CATEGORIES ─────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  parentId: uuid("parent_id"),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 100 }),
  emoji: varchar("emoji", { length: 10 }),
  icon: varchar("icon", { length: 40 }),
  color: varchar("color", { length: 7 }),
  imageUrl: text("image_url"),
  position: integer("position").default(0),
  active: boolean("active").default(true),
  showInMenu: boolean("show_in_menu").default(true),
  featured: boolean("featured").default(false),
  analytic: boolean("analytic").default(false),
  metaTitle: varchar("meta_title", { length: 120 }),
  metaDescription: varchar("meta_description", { length: 320 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("categories_store_idx").on(t.storeId),
  index("categories_parent_idx").on(t.parentId),
]);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, { fields: [categories.storeId], references: [stores.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "subcategories" }),
  children: many(categories, { relationName: "subcategories" }),
  products: many(products),
}));

// ─── PRODUCTS ───────────────────────────────────────────────────
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  images: jsonb("images").$type<Array<{ url: string; isPrimary: boolean }>>().default([]).notNull(),
  promoConfig: jsonb("promo_config").$type<import("@/lib/promo-engine").PromoConfig | null>(),
  emoji: varchar("emoji", { length: 10 }),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
  sku: varchar("sku", { length: 50 }),
  barcode: varchar("barcode", { length: 30 }),
  stock: integer("stock").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  unit: varchar("unit", { length: 20 }).default("un"),
  badge: varchar("badge", { length: 30 }),
  productType: varchar("product_type", { length: 50 }).default("Produto").notNull(),
  isWeightScale: boolean("is_weight_scale").default(false).notNull(),
  trackStock: boolean("track_stock").default(false),
  featured: boolean("featured").default(false),
  active: boolean("active").default(true),
  rating: numeric("rating", { precision: 2, scale: 1 }).default("0"),
  reviewCount: integer("review_count").default(0),
  allowObservation: boolean("allow_observation").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("products_store_idx").on(t.storeId),
  index("products_category_idx").on(t.categoryId),
  index("products_featured_idx").on(t.featured),
  index("products_active_idx").on(t.active),
]);

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  additions: many(productAdditions),
  orderItems: many(orderItems),
  favorites: many(favorites),
  reviews: many(reviews),
}));

// ─── PRODUCT ADDITIONS (Adicionais) ─────────────────────────────
export const productAdditions = pgTable("product_additions", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").default(true),
  position: integer("position").default(0),
}, (t) => [
  index("product_additions_product_idx").on(t.productId),
]);

export const productAdditionsRelations = relations(productAdditions, ({ one }) => ({
  product: one(products, { fields: [productAdditions.productId], references: [products.id] }),
}));

// ─── COUPONS ────────────────────────────────────────────────────
export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 30 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // "percent" | "fixed"
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull(),
  minOrderValue: numeric("min_order_value", { precision: 10, scale: 2 }).default("0"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("coupons_store_idx").on(t.storeId),
  index("coupons_code_idx").on(t.code),
]);

export const couponsRelations = relations(coupons, ({ one }) => ({
  store: one(stores, { fields: [coupons.storeId], references: [stores.id] }),
}));

// ─── CUSTOMERS ──────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 120 }),
  phone: varchar("phone", { length: 20 }),
  cpf: varchar("cpf", { length: 14 }),
  avatarUrl: text("avatar_url"),
  active: boolean("active").default(true),
  isSupplier: boolean("is_supplier").default(false),
  isDeliverer: boolean("is_deliverer").default(false),
  status: varchar("status", { length: 20 }).default("ativo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("customers_store_idx").on(t.storeId),
  index("customers_email_idx").on(t.email),
]);

export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(stores, { fields: [customers.storeId], references: [stores.id] }),
  addresses: many(addresses),
  orders: many(orders),
  favorites: many(favorites),
  reviews: many(reviews),
}));

// ─── CUSTOMER OTPS (DB fallback when Redis unavailable) ─────────
export const customerOtps = pgTable("customer_otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("customer_otps_lookup_idx").on(t.storeId, t.phone),
]);

// ─── ADDRESSES ──────────────────────────────────────────────────
export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  label: varchar("label", { length: 30 }), // "Casa", "Trabalho", etc.
  street: varchar("street", { length: 200 }).notNull(),
  number: varchar("number", { length: 20 }).notNull(),
  complement: varchar("complement", { length: 80 }),
  neighborhood: varchar("neighborhood", { length: 80 }).notNull(),
  city: varchar("city", { length: 80 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zip: varchar("zip", { length: 9 }).notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("addresses_customer_idx").on(t.customerId),
]);

export const addressesRelations = relations(addresses, ({ one }) => ({
  customer: one(customers, { fields: [addresses.customerId], references: [customers.id] }),
}));

// ─── ORDERS ─────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  number: integer("number").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("received"), // received | preparing | ready | delivering | delivered | cancelled
  type: varchar("type", { length: 10 }).notNull().default("delivery"), // delivery | pickup
  paymentMethod: varchar("payment_method", { length: 20 }), // pix | card | cash
  paymentStatus: varchar("payment_status", { length: 20 }).default("pending"), // pending | paid | refunded
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
  notes: text("notes"),
  addressSnapshot: jsonb("address_snapshot").$type<{
    street: string; number: string; neighborhood: string; city: string; state: string; zip: string; complement?: string;
  }>(),
  estimatedDelivery: timestamp("estimated_delivery"),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  installments:   integer("installments").default(1),
  cardFeeAmount:  numeric("card_fee_amount", { precision: 10, scale: 2 }),  // taxa da maquineta calculada
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("orders_store_idx").on(t.storeId),
  index("orders_customer_idx").on(t.customerId),
  index("orders_status_idx").on(t.status),
  index("orders_number_idx").on(t.number),
  index("orders_created_idx").on(t.createdAt),
]);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
  timeline: many(orderTimeline),
}));

// ─── ORDER ITEMS ────────────────────────────────────────────────
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 150 }).notNull(),
  productEmoji: varchar("product_emoji", { length: 10 }),
  productImage: text("product_image"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  additionsTotal: numeric("additions_total", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  additionsSnapshot: jsonb("additions_snapshot").$type<{ name: string; price: string }[]>(),
  notes: text("notes"),
}, (t) => [
  index("order_items_order_idx").on(t.orderId),
]);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

// ─── ORDER TIMELINE ─────────────────────────────────────────────
export const orderTimeline = pgTable("order_timeline", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("order_timeline_order_idx").on(t.orderId),
]);

export const orderTimelineRelations = relations(orderTimeline, ({ one }) => ({
  order: one(orders, { fields: [orderTimeline.orderId], references: [orders.id] }),
}));

// ─── FAVORITES ──────────────────────────────────────────────────
export const favorites = pgTable("favorites", {
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.customerId, t.productId] }),
  index("favorites_customer_idx").on(t.customerId),
]);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  customer: one(customers, { fields: [favorites.customerId], references: [customers.id] }),
  product: one(products, { fields: [favorites.productId], references: [products.id] }),
}));

// ─── REVIEWS ────────────────────────────────────────────────────
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  imageUrl: text("image_url"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("reviews_product_idx").on(t.productId),
  index("reviews_store_idx").on(t.storeId),
]);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  store: one(stores, { fields: [reviews.storeId], references: [stores.id] }),
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  customer: one(customers, { fields: [reviews.customerId], references: [customers.id] }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
}));

// ─── STORE USERS (merchant access) ──────────────────────────────
export const storeUsers = pgTable("store_users", {
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("owner"), // owner | admin | cashier
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.storeId, t.userId] }),
  index("store_users_user_idx").on(t.userId),
]);

export const storeUsersRelations = relations(storeUsers, ({ one }) => ({
  store: one(stores, { fields: [storeUsers.storeId], references: [stores.id] }),
  user: one(users, { fields: [storeUsers.userId], references: [users.id] }),
}));

// ─── USERS (auth) ───────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 120 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  avatarUrl: text("avatar_url"),
  phone: varchar("phone", { length: 20 }),
  cpf: varchar("cpf", { length: 14 }),
  role: varchar("role", { length: 20 }).notNull().default("merchant"), // merchant | customer | admin
  emailVerified: boolean("email_verified").default(false),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("users_email_idx").on(t.email),
  index("users_role_idx").on(t.role),
]);

export const usersRelations = relations(users, ({ many }) => ({
  storeUsers: many(storeUsers),
}));

// ─── SESSIONS ───────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  device: varchar("device", { length: 120 }),
  ip: varchar("ip", { length: 45 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("sessions_token_idx").on(t.token),
  index("sessions_user_idx").on(t.userId),
]);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ─── VERIFICATION CODES ─────────────────────────────────────────
export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // "email_verification" | "password_reset"
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("verification_codes_user_idx").on(t.userId),
  index("verification_codes_code_idx").on(t.code),
  index("verification_codes_type_idx").on(t.type),
]);

export const verificationCodesRelations = relations(verificationCodes, ({ one }) => ({
  user: one(users, { fields: [verificationCodes.userId], references: [users.id] }),
}));

// ─── AUDIT LOGS (Security & Compliance) ─────────────────────────
// IMUTABILIDADE: Esta tabela só aceita INSERT.
// Um trigger no banco (ver migrations/audit_immutability.sql) bloqueia
// qualquer UPDATE ou DELETE diretamente no banco de dados.
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  // Snapshot do nome no momento da ação — preservado mesmo se usuário for excluído
  nomeUsuario: varchar("nome_usuario", { length: 120 }),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
  action: varchar("action", { length: 80 }).notNull(),
  // Módulo de origem: FINANCEIRO_RECEBER, FINANCEIRO_PAGAR, VENDAS_PDV, etc.
  modulo: varchar("modulo", { length: 60 }),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 100 }),
  // Estado do registro ANTES da alteração (null em criações)
  dadosAnteriores: jsonb("dados_anteriores").$type<Record<string, unknown>>(),
  // Estado do registro DEPOIS da alteração (null em exclusões)
  dadosNovos: jsonb("dados_novos").$type<Record<string, unknown>>(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  status: varchar("status", { length: 20 }).default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("audit_logs_user_idx").on(t.userId),
  index("audit_logs_store_idx").on(t.storeId),
  index("audit_logs_action_idx").on(t.action),
  index("audit_logs_modulo_idx").on(t.modulo),
  index("audit_logs_created_at_idx").on(t.createdAt),
  index("audit_logs_resource_idx").on(t.resourceType, t.resourceId),
]);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  store: one(stores, { fields: [auditLogs.storeId], references: [stores.id] }),
}));

// ─── STOCK MOVEMENTS (Movimentações de Estoque) ──────────────────
// Tipos: VENDA | ENTRADA | SAIDA | AJUSTE | PERDA | AVARIA | RECONTAGEM
export const stockMovements = pgTable("stock_movements", {
  id:            uuid("id").defaultRandom().primaryKey(),
  storeId:       uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  productId:     uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName:   varchar("product_name", { length: 150 }).notNull(),
  type:          varchar("type", { length: 20 }).notNull(),
  quantity:      integer("quantity").notNull(),           // sempre positivo; direção pelo type
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter:  integer("balance_after").notNull(),
  origem:        varchar("origem", { length: 250 }).notNull(),
  orderId:       uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  supplierId:    uuid("supplier_id").references(() => customers.id, { onDelete: "set null" }),
  nf:            varchar("nf",          { length: 50 }),
  lot:           varchar("lot",         { length: 50 }),
  expiry:        varchar("expiry",      { length: 20 }),
  costPrice:     numeric("cost_price",  { precision: 10, scale: 2 }),
  payMethod:     varchar("pay_method",  { length: 50 }),
  dueDate:       varchar("due_date",    { length: 20 }),
  observations:  text("observations"),
  createdBy:     uuid("created_by"),
  createdByName: varchar("created_by_name", { length: 120 }),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("stock_movements_store_idx").on(t.storeId),
  index("stock_movements_product_idx").on(t.productId),
  index("stock_movements_type_idx").on(t.type),
  index("stock_movements_created_idx").on(t.createdAt),
]);

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  store:    one(stores,    { fields: [stockMovements.storeId],    references: [stores.id] }),
  product:  one(products,  { fields: [stockMovements.productId],  references: [products.id] }),
  order:    one(orders,    { fields: [stockMovements.orderId],    references: [orders.id] }),
  supplier: one(customers, { fields: [stockMovements.supplierId], references: [customers.id] }),
}));

// ─── STOCK BALANCES (Balanços de estoque) ────────────────────────
export interface BalancoItemJson {
  productId: string;
  productName: string;
  sku: string | null;
  systemStock: number;
  counted: number | null;
  diff: number | null;
  costPrice: number | null;
  unit: string;
}

export const stockBalances = pgTable("stock_balances", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  prodScope: varchar("prod_scope", { length: 10 }).default("todos").notNull(),
  preco: varchar("preco", { length: 50 }).default("Preço de custo").notNull(),
  dataContagem: timestamp("data_contagem").notNull(),
  dataEncerramento: timestamp("data_encerramento"),
  status: varchar("status", { length: 20 }).default("em_aberto").notNull(),
  items: jsonb("items").$type<BalancoItemJson[]>().notNull().default([]),
  createdBy: uuid("created_by"),
  createdByName: varchar("created_by_name", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("stock_balances_store_idx").on(t.storeId),
  index("stock_balances_status_idx").on(t.status),
]);

export const stockBalancesRelations = relations(stockBalances, ({ one }) => ({
  store: one(stores, { fields: [stockBalances.storeId], references: [stores.id] }),
}));

// ─── STOCK ADJUSTMENTS (Histórico dedicado de ajustes manuais) ────────────────
export const stockAdjustments = pgTable("stock_adjustments", {
  id:            uuid("id").defaultRandom().primaryKey(),
  storeId:       uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  productId:     uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  productName:   varchar("product_name", { length: 150 }).notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter:  integer("balance_after").notNull(),
  qty:           integer("qty").notNull(),
  tipo:          varchar("tipo", { length: 30 }).notNull(),
  motivo:        varchar("motivo", { length: 250 }),
  observations:  text("observations"),
  movementId:    uuid("movement_id"),
  createdBy:     uuid("created_by"),
  createdByName: varchar("created_by_name", { length: 120 }),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("stock_adjustments_store_idx").on(t.storeId),
  index("stock_adjustments_product_idx").on(t.productId),
  index("stock_adjustments_created_idx").on(t.createdAt),
]);

export const stockAdjustmentsRelations = relations(stockAdjustments, ({ one }) => ({
  store:   one(stores,   { fields: [stockAdjustments.storeId],   references: [stores.id] }),
  product: one(products, { fields: [stockAdjustments.productId], references: [products.id] }),
}));

// ─── MESAS (Mapa de atendimento PDV) ────────────────────────────
export const mesas = pgTable("mesas", {
  id:         uuid("id").defaultRandom().primaryKey(),
  storeId:    uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  numero:     integer("numero").notNull(),
  label:      varchar("label", { length: 50 }).notNull(),
  capacidade: integer("capacidade").default(4),
  active:     boolean("active").default(true).notNull(),
  position:   integer("position").default(0),
}, (t) => [
  index("mesas_store_idx").on(t.storeId),
]);

export const mesasRelations = relations(mesas, ({ one }) => ({
  store: one(stores, { fields: [mesas.storeId], references: [stores.id] }),
}));

// ─── CAIXA SESSOES (Sessões de caixa PDV) ────────────────────────
export const caixaSessoes = pgTable("caixa_sessoes", {
  id:            uuid("id").defaultRandom().primaryKey(),
  storeId:       uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  saldoInicial:  numeric("saldo_inicial",  { precision: 10, scale: 2 }).notNull().default("0"),
  saldoFinal:    numeric("saldo_final",    { precision: 10, scale: 2 }),
  totalDinheiro: numeric("total_dinheiro", { precision: 10, scale: 2 }).notNull().default("0"),
  totalPix:      numeric("total_pix",      { precision: 10, scale: 2 }).notNull().default("0"),
  totalCartao:   numeric("total_cartao",   { precision: 10, scale: 2 }).notNull().default("0"),
  totalDebito:   numeric("total_debito",   { precision: 10, scale: 2 }).notNull().default("0"),
  totalOutros:   numeric("total_outros",   { precision: 10, scale: 2 }).notNull().default("0"),
  totalVendas:   integer("total_vendas").notNull().default(0),
  status:        varchar("status", { length: 20 }).notNull().default("aberta"), // aberta | encerrada
  abertoPor:     varchar("aberto_por",    { length: 120 }),
  encerradoPor:  varchar("encerrado_por", { length: 120 }),
  observations:  text("observations"),
  openedAt:      timestamp("opened_at").defaultNow().notNull(),
  closedAt:      timestamp("closed_at"),
}, (t) => [
  index("caixa_sessoes_store_idx").on(t.storeId),
  index("caixa_sessoes_status_idx").on(t.status),
  index("caixa_sessoes_opened_idx").on(t.openedAt),
]);

export const caixaSessoesRelations = relations(caixaSessoes, ({ one, many }) => ({
  store:      one(stores, { fields: [caixaSessoes.storeId], references: [stores.id] }),
  movimentos: many(caixaMovimentos),
}));

// ─── CAIXA MOVIMENTOS (Sangria / Suprimento) ────────────────────
export const caixaMovimentos = pgTable("caixa_movimentos", {
  id:        uuid("id").defaultRandom().primaryKey(),
  sessaoId:  uuid("sessao_id").references(() => caixaSessoes.id, { onDelete: "cascade" }).notNull(),
  storeId:   uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  tipo:      varchar("tipo", { length: 20 }).notNull(), // sangria | suprimento
  valor:     numeric("valor", { precision: 10, scale: 2 }).notNull(),
  motivo:    text("motivo"),
  criadoPor: varchar("criado_por", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("caixa_mov_sessao_idx").on(t.sessaoId),
  index("caixa_mov_store_idx").on(t.storeId),
]);

export const caixaMovimentosRelations = relations(caixaMovimentos, ({ one }) => ({
  sessao: one(caixaSessoes, { fields: [caixaMovimentos.sessaoId], references: [caixaSessoes.id] }),
  store:  one(stores,       { fields: [caixaMovimentos.storeId],  references: [stores.id] }),
}));

// ─── FINANCEIRO LANCAMENTOS ──────────────────────────────────────
export const financeiroLancamentos = pgTable("financeiro_lancamentos", {
  id:               uuid("id").defaultRandom().primaryKey(),
  storeId:          uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  tipo:             varchar("tipo", { length: 10 }).notNull(), // entrada | saida
  categoria:        varchar("categoria", { length: 50 }).default("venda"),
  descricao:        varchar("descricao", { length: 250 }).notNull(),
  valor:            numeric("valor", { precision: 10, scale: 2 }).notNull(),
  metodoPagamento:  varchar("metodo_pagamento", { length: 50 }),
  status:           varchar("status", { length: 20 }).notNull().default("liquidado"), // liquidado | pendente | cancelado
  dataCompetencia:  varchar("data_competencia", { length: 10 }).notNull(), // YYYY-MM-DD
  dataPagamento:    varchar("data_pagamento",   { length: 10 }),
  orderId:          uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  sessaoId:         uuid("sessao_id").references(() => caixaSessoes.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("fin_lancamentos_store_idx").on(t.storeId),
  index("fin_lancamentos_status_idx").on(t.status),
  index("fin_lancamentos_data_idx").on(t.dataCompetencia),
  index("fin_lancamentos_sessao_idx").on(t.sessaoId),
]);

export const financeiroLancamentosRelations = relations(financeiroLancamentos, ({ one }) => ({
  store:  one(stores,       { fields: [financeiroLancamentos.storeId],  references: [stores.id] }),
  order:  one(orders,       { fields: [financeiroLancamentos.orderId],  references: [orders.id] }),
  sessao: one(caixaSessoes, { fields: [financeiroLancamentos.sessaoId], references: [caixaSessoes.id] }),
}));

// ─── PRINTERS (Impressoras) ─────────────────────────────────────
export const printers = pgTable("printers", {
  id:        uuid("id").defaultRandom().primaryKey(),
  storeId:   uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  code:      varchar("code", { length: 20 }).notNull(),
  name:      varchar("name", { length: 120 }).notNull(),
  type:      varchar("type", { length: 30 }).notNull().default("Produção"),
  driver:    varchar("driver", { length: 30 }).notNull().default("Nenhum"),
  path:      varchar("path", { length: 255 }),
  columns:   integer("columns").default(48),
  active:    boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("printers_store_idx").on(t.storeId),
]);

export const printersRelations = relations(printers, ({ one }) => ({
  store: one(stores, { fields: [printers.storeId], references: [stores.id] }),
}));

// ─── ROLE PROFILES (Perfis de Acesso RBAC) ──────────────────────
export const roleProfiles = pgTable("role_profiles", {
  id:          uuid("id").defaultRandom().primaryKey(),
  storeId:     uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  name:        varchar("name", { length: 60 }).notNull(),
  slug:        varchar("slug", { length: 40 }).notNull(),
  isSystem:    boolean("is_system").notNull().default(false),
  permissions: jsonb("permissions").$type<Record<string, boolean>>().notNull().default({}),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("role_profiles_store_slug_idx").on(t.storeId, t.slug),
  index("role_profiles_store_idx").on(t.storeId),
]);

export const roleProfilesRelations = relations(roleProfiles, ({ one }) => ({
  store: one(stores, { fields: [roleProfiles.storeId], references: [stores.id] }),
}));
