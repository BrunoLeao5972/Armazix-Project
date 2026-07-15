-- ─── Saldos de estoque por produto × setor ────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_product_balances (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sector_id    UUID NOT NULL REFERENCES sectors(id)  ON DELETE CASCADE,
  quantity     NUMERIC(12, 3) NOT NULL DEFAULT 0,
  min_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS spb_product_sector_uidx ON stock_product_balances(product_id, sector_id);
CREATE INDEX IF NOT EXISTS spb_store_idx  ON stock_product_balances(store_id);
CREATE INDEX IF NOT EXISTS spb_sector_idx ON stock_product_balances(sector_id);

-- ─── Rastreio de setor nas movimentações ──────────────────────────────────────
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS sector_id            UUID REFERENCES sectors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_sector_id     UUID REFERENCES sectors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stock_movements_sector_idx ON stock_movements(sector_id);

-- ─── Rastreio de setor nos ajustes ────────────────────────────────────────────
ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stock_adjustments_sector_idx ON stock_adjustments(sector_id);
