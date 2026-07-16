-- Tipo de layout da vitrine pública: 'grid' (padrão) ou 'list'.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS layout_type VARCHAR(10) NOT NULL DEFAULT 'grid';
