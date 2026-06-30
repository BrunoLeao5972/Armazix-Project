// Script para aplicar migrações manuais no banco Neon via HTTP
// Uso: node --env-file=.env migrate-manual.mjs
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida. Verifique o .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const migrations = [
  {
    name: "0008_contacts_supplier",
    query: `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_supplier" boolean DEFAULT false`,
  },
  {
    name: "0009_customer_status",
    query: `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'ativo'`,
  },
  {
    name: "0010a_stock_balances_table",
    query: `CREATE TABLE IF NOT EXISTS "stock_balances" (
      "id"                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "store_id"          uuid REFERENCES "stores"("id") ON DELETE CASCADE NOT NULL,
      "codigo"            varchar(20) NOT NULL,
      "prod_scope"        varchar(10) DEFAULT 'todos' NOT NULL,
      "preco"             varchar(50) DEFAULT 'Preço de custo' NOT NULL,
      "data_contagem"     timestamp NOT NULL,
      "data_encerramento" timestamp,
      "status"            varchar(20) DEFAULT 'aberto' NOT NULL,
      "items"             jsonb DEFAULT '[]' NOT NULL,
      "created_by"        uuid,
      "created_by_name"   varchar(120),
      "created_at"        timestamp DEFAULT now() NOT NULL,
      "updated_at"        timestamp DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "0010b_stock_balances_idx_store",
    query: `CREATE INDEX IF NOT EXISTS "stock_balances_store_idx" ON "stock_balances"("store_id")`,
  },
  {
    name: "0010c_stock_balances_idx_status",
    query: `CREATE INDEX IF NOT EXISTS "stock_balances_status_idx" ON "stock_balances"("status")`,
  },
  {
    name: "0011a_stock_movements_table",
    query: `CREATE TABLE IF NOT EXISTS "stock_movements" (
      "id"              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "store_id"        uuid REFERENCES "stores"("id") ON DELETE CASCADE NOT NULL,
      "product_id"      uuid REFERENCES "products"("id") ON DELETE SET NULL,
      "product_name"    varchar(150) NOT NULL,
      "type"            varchar(20) NOT NULL,
      "quantity"        integer NOT NULL,
      "balance_before"  integer NOT NULL,
      "balance_after"   integer NOT NULL,
      "origem"          varchar(250) NOT NULL,
      "order_id"        uuid REFERENCES "orders"("id") ON DELETE SET NULL,
      "supplier_id"     uuid REFERENCES "customers"("id") ON DELETE SET NULL,
      "nf"              varchar(50),
      "lot"             varchar(50),
      "expiry"          varchar(20),
      "cost_price"      numeric(10,2),
      "pay_method"      varchar(50),
      "due_date"        varchar(20),
      "observations"    text,
      "created_by"      uuid,
      "created_by_name" varchar(120),
      "created_at"      timestamp DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "0011b_stock_movements_idx_store",
    query: `CREATE INDEX IF NOT EXISTS "stock_movements_store_idx"   ON "stock_movements"("store_id")`,
  },
  {
    name: "0011c_stock_movements_idx_product",
    query: `CREATE INDEX IF NOT EXISTS "stock_movements_product_idx" ON "stock_movements"("product_id")`,
  },
  {
    name: "0011d_stock_movements_idx_type",
    query: `CREATE INDEX IF NOT EXISTS "stock_movements_type_idx"    ON "stock_movements"("type")`,
  },
  {
    name: "0011e_stock_movements_idx_created",
    query: `CREATE INDEX IF NOT EXISTS "stock_movements_created_idx" ON "stock_movements"("created_at")`,
  },
  {
    name: "0012a_stock_adjustments_table",
    query: `CREATE TABLE IF NOT EXISTS "stock_adjustments" (
    "id"              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "store_id"        uuid REFERENCES "stores"("id") ON DELETE CASCADE NOT NULL,
    "product_id"      uuid REFERENCES "products"("id") ON DELETE SET NULL,
    "product_name"    varchar(150) NOT NULL,
    "balance_before"  integer NOT NULL,
    "balance_after"   integer NOT NULL,
    "qty"             integer NOT NULL,
    "tipo"            varchar(30) NOT NULL,
    "motivo"          varchar(250),
    "observations"    text,
    "movement_id"     uuid,
    "created_by"      uuid,
    "created_by_name" varchar(120),
    "created_at"      timestamp DEFAULT now() NOT NULL
  )`,
  },
  {
    name: "0012b_stock_adjustments_idx_store",
    query: `CREATE INDEX IF NOT EXISTS "stock_adjustments_store_idx" ON "stock_adjustments"("store_id")`,
  },
  {
    name: "0012c_stock_adjustments_idx_product",
    query: `CREATE INDEX IF NOT EXISTS "stock_adjustments_product_idx" ON "stock_adjustments"("product_id")`,
  },
  {
    name: "0012d_stock_adjustments_idx_created",
    query: `CREATE INDEX IF NOT EXISTS "stock_adjustments_created_idx" ON "stock_adjustments"("created_at")`,
  },
  {
    name: "0013_products_track_stock",
    query: `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "track_stock" boolean NOT NULL DEFAULT false`,
  },
];

for (const m of migrations) {
  try {
    await sql.query(m.query);
    console.log(`✓ ${m.name}`);
  } catch (e) {
    console.error(`✗ ${m.name}: ${e.message}`);
    process.exit(1);
  }
}

console.log("✅ Todas as migrações aplicadas.");
