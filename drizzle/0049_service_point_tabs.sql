-- Painel de resumo da mesa/comanda no Mapa de Atendimentos (PDV). Antes
-- disso o carrinho do PDV era um único estado local do navegador, não
-- vinculado a mesa nenhuma no servidor — "Lançar Item [F3]" era decorativo
-- (só um setTimeout, nunca gravava nada). Essas duas tabelas persistem de
-- verdade a conta em aberto de cada mesa/comanda (service_point_sessions),
-- sobrevivendo a troca de mesa e a um refresh de página.

CREATE TABLE IF NOT EXISTS service_point_tab_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL REFERENCES service_point_sessions(id) ON DELETE CASCADE,
  product_id     uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name   varchar(200) NOT NULL,
  product_emoji  varchar(10),
  unit_price     numeric(10, 2) NOT NULL,
  quantity       integer NOT NULL,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_point_tab_items_session_idx ON service_point_tab_items (session_id);
CREATE INDEX IF NOT EXISTS service_point_tab_items_store_idx ON service_point_tab_items (store_id);

ALTER TABLE service_point_tab_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_service_point_tab_items ON service_point_tab_items;
CREATE POLICY tenant_service_point_tab_items ON service_point_tab_items
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- RLS sozinha não basta — sem o GRANT explícito, armazix_tenant não tem
-- permissão nenhuma de tabela pra tentar a query (achado dessa mesma sessão,
-- aplicado agora por padrão em toda tabela nova).
GRANT SELECT, INSERT, UPDATE, DELETE ON service_point_tab_items TO armazix_tenant;

-- "Adiantamento" — pagamento parcial numa conta ainda aberta. Abate do
-- valor cobrado quando a mesa for finalizada (finalizarVendaPdvHandler
-- soma essas linhas e desconta do restante, pra não contar o dinheiro
-- duas vezes: ele já incrementou os totais de caixa_sessoes no momento em
-- que foi registrado).
CREATE TABLE IF NOT EXISTS service_point_advances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  session_id        uuid NOT NULL REFERENCES service_point_sessions(id) ON DELETE CASCADE,
  caixa_sessao_id   uuid REFERENCES caixa_sessoes(id) ON DELETE SET NULL,
  valor             numeric(10, 2) NOT NULL,
  forma_pagamento   varchar(20) NOT NULL,
  criado_por        varchar(120),
  created_at        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_point_advances_session_idx ON service_point_advances (session_id);
CREATE INDEX IF NOT EXISTS service_point_advances_store_idx ON service_point_advances (store_id);

ALTER TABLE service_point_advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_service_point_advances ON service_point_advances;
CREATE POLICY tenant_service_point_advances ON service_point_advances
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON service_point_advances TO armazix_tenant;
