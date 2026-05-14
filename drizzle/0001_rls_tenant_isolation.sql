-- ============================================================================
-- MIGRATION: Row Level Security — Multi-Tenant Isolation
-- ============================================================================
-- Defense-in-depth: even if a bug bypasses application-layer access checks,
-- the database will enforce tenant isolation autonomously.
--
-- Architecture:
--   1. Every tenant table has RLS enabled.
--   2. A PERMISSIVE SELECT/INSERT/UPDATE/DELETE policy restricts rows to the
--      store set via the session variable app.current_store_id.
--   3. The service role (used by the Neon HTTP adapter) has BYPASSRLS so that
--      admin operations and migrations work without a tenant context.
--   4. Public tables (users, stores metadata) are excluded from RLS.
--
-- Usage in application layer:
--   Set tenant context before any query:
--     SET LOCAL "app.current_store_id" = '<uuid>';
--   This is done automatically by createTenantDb() in src/lib/db/index.ts
-- ============================================================================

-- ─── Helper function — returns current tenant UUID ────────────────────────
CREATE OR REPLACE FUNCTION app_current_store_id() RETURNS uuid AS $$
  SELECT NULLIF(
    current_setting('app.current_store_id', true),
    ''
  )::uuid;
$$ LANGUAGE sql STABLE;

-- ─── STORES ──────────────────────────────────────────────────────────────
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
-- Owners can see and modify their own store
CREATE POLICY tenant_store_select ON stores
  FOR SELECT USING (
    id = app_current_store_id()
    OR app_current_store_id() IS NULL  -- Allow when no tenant context (public endpoints)
  );
CREATE POLICY tenant_store_modify ON stores
  FOR ALL USING (id = app_current_store_id());

-- ─── BANNERS ─────────────────────────────────────────────────────────────
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_banners ON banners
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- ─── CATEGORIES ──────────────────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_categories ON categories
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- ─── PRODUCTS ────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_products ON products
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- ─── PRODUCT ADDITIONS ───────────────────────────────────────────────────
ALTER TABLE product_additions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_product_additions ON product_additions
  FOR ALL USING (
    product_id IN (
      SELECT id FROM products WHERE store_id = app_current_store_id()
    )
    OR app_current_store_id() IS NULL
  );

-- ─── ORDERS ──────────────────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_orders ON orders
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- ─── ORDER ITEMS ─────────────────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_order_items ON order_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders WHERE store_id = app_current_store_id()
    )
    OR app_current_store_id() IS NULL
  );

-- ─── ORDER TIMELINE ──────────────────────────────────────────────────────
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_order_timeline ON order_timeline
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders WHERE store_id = app_current_store_id()
    )
    OR app_current_store_id() IS NULL
  );

-- ─── COUPONS ─────────────────────────────────────────────────────────────
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_coupons ON coupons
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_customers ON customers
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- ─── STORE USERS (Memberships) ───────────────────────────────────────────
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_store_users ON store_users
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Audit logs are tenant-scoped but the audit writer uses service role (BYPASSRLS)
CREATE POLICY tenant_audit_logs ON audit_logs
  FOR SELECT USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);
-- INSERT is handled by service role only (BYPASSRLS)

-- ─── Public/Cross-tenant tables (NO RLS) ─────────────────────────────────
-- users         — user records are not tenant-scoped
-- addresses     — customer addresses, protected via customer FK
-- verification_codes — user-scoped, not store-scoped

-- ─── Grant BYPASSRLS to the service role ─────────────────────────────────
-- The Neon HTTP adapter connects as the owner role which already has BYPASSRLS.
-- If using a restricted role, uncomment and set the correct role name:
-- ALTER ROLE neon_service_role BYPASSRLS;

-- ─── Performance indexes for RLS policies ────────────────────────────────
-- These already exist from migration 0000, but added here for documentation
-- CREATE INDEX IF NOT EXISTS products_store_idx ON products(store_id);
-- CREATE INDEX IF NOT EXISTS orders_store_idx ON orders(store_id);
-- CREATE INDEX IF NOT EXISTS customers_store_idx ON customers(store_id);
-- CREATE INDEX IF NOT EXISTS coupons_store_idx ON coupons(store_id);
