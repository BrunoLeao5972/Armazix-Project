CREATE TABLE IF NOT EXISTS print_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS print_env_store_idx    ON print_environments(store_id);
CREATE INDEX IF NOT EXISTS print_env_category_idx ON print_environments(category_id);
CREATE INDEX IF NOT EXISTS print_env_printer_idx  ON print_environments(printer_id);
