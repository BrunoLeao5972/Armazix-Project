-- A migração 0001_rls_tenant_isolation.sql nunca foi de fato aplicada em
-- produção (confirmado: relrowsecurity=false em todas as tabelas, 0 policies
-- em pg_policies — só a função app_current_store_id() existia). Esta migração
-- reaplica o ENABLE/CREATE POLICY de forma idempotente (DROP POLICY IF EXISTS
-- antes de cada CREATE, já que Postgres não tem "CREATE POLICY IF NOT EXISTS").

CREATE OR REPLACE FUNCTION app_current_store_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_store_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_store_select ON stores;
CREATE POLICY tenant_store_select ON stores
  FOR SELECT USING (id = app_current_store_id() OR app_current_store_id() IS NULL);
DROP POLICY IF EXISTS tenant_store_modify ON stores;
CREATE POLICY tenant_store_modify ON stores
  FOR ALL USING (id = app_current_store_id());

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_banners ON banners;
CREATE POLICY tenant_banners ON banners
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_categories ON categories;
CREATE POLICY tenant_categories ON categories
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_products ON products;
CREATE POLICY tenant_products ON products
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

ALTER TABLE product_additions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_product_additions ON product_additions;
CREATE POLICY tenant_product_additions ON product_additions
  FOR ALL USING (
    product_id IN (SELECT id FROM products WHERE store_id = app_current_store_id())
    OR app_current_store_id() IS NULL
  );

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_orders ON orders;
CREATE POLICY tenant_orders ON orders
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_order_items ON order_items;
CREATE POLICY tenant_order_items ON order_items
  FOR ALL USING (
    order_id IN (SELECT id FROM orders WHERE store_id = app_current_store_id())
    OR app_current_store_id() IS NULL
  );

ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_order_timeline ON order_timeline;
CREATE POLICY tenant_order_timeline ON order_timeline
  FOR ALL USING (
    order_id IN (SELECT id FROM orders WHERE store_id = app_current_store_id())
    OR app_current_store_id() IS NULL
  );

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_coupons ON coupons;
CREATE POLICY tenant_coupons ON coupons
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_customers ON customers;
CREATE POLICY tenant_customers ON customers
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_store_users ON store_users;
CREATE POLICY tenant_store_users ON store_users
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_audit_logs ON audit_logs;
CREATE POLICY tenant_audit_logs ON audit_logs
  FOR SELECT USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);
-- INSERT continua liberado só pra role administrativa (neondb_owner, com BYPASSRLS).
