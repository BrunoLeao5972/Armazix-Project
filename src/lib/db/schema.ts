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
  primaryColor: varchar("primary_color", { length: 7 }).default("#00C853"),
  accentColor: varchar("accent_color", { length: 7 }),
  font: varchar("font", { length: 50 }).default("Inter"),
  cnpj: varchar("cnpj", { length: 18 }),
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
  name: varchar("name", { length: 80 }).notNull(),
  emoji: varchar("emoji", { length: 10 }),
  color: varchar("color", { length: 7 }),
  imageUrl: text("image_url"),
  position: integer("position").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("categories_store_idx").on(t.storeId),
]);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, { fields: [categories.storeId], references: [stores.id] }),
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
  featured: boolean("featured").default(false),
  active: boolean("active").default(true),
  rating: numeric("rating", { precision: 2, scale: 1 }).default("0"),
  reviewCount: integer("review_count").default(0),
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
  id: uuid("id").defaultRandom().primaryKey(),
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
