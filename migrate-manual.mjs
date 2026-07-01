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
  {
    name: "0014_products_images_gallery",
    query: `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images" jsonb NOT NULL DEFAULT '[]'::jsonb`,
  },
  {
    name: "0015_products_promo_config",
    query: `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "promo_config" jsonb`,
  },
  {
    name: "0016_mesas",
    query: `CREATE TABLE IF NOT EXISTS "mesas" (
      "id"         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "store_id"   uuid REFERENCES "stores"("id") ON DELETE CASCADE NOT NULL,
      "numero"     integer NOT NULL,
      "label"      varchar(50) NOT NULL,
      "capacidade" integer DEFAULT 4,
      "active"     boolean NOT NULL DEFAULT true,
      "position"   integer DEFAULT 0
    )`,
  },
  {
    name: "0016b_mesas_idx",
    query: `CREATE INDEX IF NOT EXISTS "mesas_store_idx" ON "mesas"("store_id")`,
  },
  {
    name: "0017_caixa_sessoes",
    query: `CREATE TABLE IF NOT EXISTS "caixa_sessoes" (
      "id"             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "store_id"       uuid REFERENCES "stores"("id") ON DELETE CASCADE NOT NULL,
      "saldo_inicial"  numeric(10,2) NOT NULL DEFAULT 0,
      "saldo_final"    numeric(10,2),
      "total_dinheiro" numeric(10,2) NOT NULL DEFAULT 0,
      "total_pix"      numeric(10,2) NOT NULL DEFAULT 0,
      "total_cartao"   numeric(10,2) NOT NULL DEFAULT 0,
      "total_debito"   numeric(10,2) NOT NULL DEFAULT 0,
      "total_outros"   numeric(10,2) NOT NULL DEFAULT 0,
      "total_vendas"   integer NOT NULL DEFAULT 0,
      "status"         varchar(20) NOT NULL DEFAULT 'aberta',
      "aberto_por"     varchar(120),
      "encerrado_por"  varchar(120),
      "observations"   text,
      "opened_at"      timestamp NOT NULL DEFAULT now(),
      "closed_at"      timestamp
    )`,
  },
  { name: "0017b_caixa_sessoes_idx_store",  query: `CREATE INDEX IF NOT EXISTS "caixa_sessoes_store_idx"  ON "caixa_sessoes"("store_id")` },
  { name: "0017b_caixa_sessoes_idx_status", query: `CREATE INDEX IF NOT EXISTS "caixa_sessoes_status_idx" ON "caixa_sessoes"("status")` },
  { name: "0017b_caixa_sessoes_idx_opened", query: `CREATE INDEX IF NOT EXISTS "caixa_sessoes_opened_idx" ON "caixa_sessoes"("opened_at")` },
  {
    name: "0018_caixa_movimentos",
    query: `CREATE TABLE IF NOT EXISTS "caixa_movimentos" (
      "id"        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "sessao_id" uuid REFERENCES "caixa_sessoes"("id") ON DELETE CASCADE NOT NULL,
      "store_id"  uuid REFERENCES "stores"("id") ON DELETE CASCADE NOT NULL,
      "tipo"      varchar(20) NOT NULL,
      "valor"     numeric(10,2) NOT NULL,
      "motivo"    text,
      "criado_por" varchar(120),
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { name: "0018b_caixa_movimentos_idx_sessao", query: `CREATE INDEX IF NOT EXISTS "caixa_mov_sessao_idx" ON "caixa_movimentos"("sessao_id")` },
  { name: "0018b_caixa_movimentos_idx_store",  query: `CREATE INDEX IF NOT EXISTS "caixa_mov_store_idx"  ON "caixa_movimentos"("store_id")` },
  {
    name: "0019_financeiro_lancamentos",
    query: `CREATE TABLE IF NOT EXISTS "financeiro_lancamentos" (
      "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      "store_id"         uuid REFERENCES "stores"("id") ON DELETE CASCADE NOT NULL,
      "tipo"             varchar(10) NOT NULL,
      "categoria"        varchar(50) DEFAULT 'venda',
      "descricao"        varchar(250) NOT NULL,
      "valor"            numeric(10,2) NOT NULL,
      "metodo_pagamento" varchar(50),
      "status"           varchar(20) NOT NULL DEFAULT 'liquidado',
      "data_competencia" varchar(10) NOT NULL,
      "data_pagamento"   varchar(10),
      "order_id"         uuid REFERENCES "orders"("id") ON DELETE SET NULL,
      "sessao_id"        uuid REFERENCES "caixa_sessoes"("id") ON DELETE SET NULL,
      "created_at"       timestamp NOT NULL DEFAULT now()
    )`,
  },
  { name: "0019b_fin_lancamentos_idx_store",  query: `CREATE INDEX IF NOT EXISTS "fin_lancamentos_store_idx"  ON "financeiro_lancamentos"("store_id")` },
  { name: "0019b_fin_lancamentos_idx_status", query: `CREATE INDEX IF NOT EXISTS "fin_lancamentos_status_idx" ON "financeiro_lancamentos"("status")` },
  { name: "0019b_fin_lancamentos_idx_data",   query: `CREATE INDEX IF NOT EXISTS "fin_lancamentos_data_idx"   ON "financeiro_lancamentos"("data_competencia")` },
  { name: "0019b_fin_lancamentos_idx_sessao", query: `CREATE INDEX IF NOT EXISTS "fin_lancamentos_sessao_idx" ON "financeiro_lancamentos"("sessao_id")` },
  // Normaliza registros antigos: "aberto" → "em_aberto"
  { name: "0020_balanco_status_normalize", query: `UPDATE "stock_balances" SET "status" = 'em_aberto' WHERE "status" = 'aberto'` },
  // Regras de frete por bairro + limiar de frete grátis
  { name: "0021_delivery_rules_free_shipping", query: `ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "delivery_rules" jsonb, ADD COLUMN IF NOT EXISTS "free_shipping_above" numeric(10,2)` },
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
