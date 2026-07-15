CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20),
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sectors_store_idx ON sectors(store_id);

CREATE TABLE IF NOT EXISTS product_sectors (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, sector_id)
);
CREATE INDEX IF NOT EXISTS product_sectors_product_idx ON product_sectors(product_id);
CREATE INDEX IF NOT EXISTS product_sectors_sector_idx ON product_sectors(sector_id);
