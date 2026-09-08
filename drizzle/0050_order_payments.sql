-- Pagamento dividido de verdade no pedido do Kanban (edição de pedido) —
-- cada forma de pagamento tem seu próprio valor (ex: R$30 PIX + R$20
-- dinheiro). Mesmo desenho de service_point_advances (Adiantamento do
-- PDV, migração 0049) — na concretização do pedido, um lançamento
-- financeiro é gerado por linha aqui, em vez de um único lançamento com
-- uma forma de pagamento só.

CREATE TABLE IF NOT EXISTS order_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  forma_pagamento  varchar(20) NOT NULL,
  valor            numeric(10, 2) NOT NULL,
  created_at       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_payments_order_idx ON order_payments (order_id);
CREATE INDEX IF NOT EXISTS order_payments_store_idx ON order_payments (store_id);

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_order_payments ON order_payments;
CREATE POLICY tenant_order_payments ON order_payments
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- RLS sozinha não basta — sem o GRANT explícito, armazix_tenant não tem
-- permissão nenhuma de tabela pra tentar a query.
GRANT SELECT, INSERT, UPDATE, DELETE ON order_payments TO armazix_tenant;
