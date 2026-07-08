-- Configuração completa de entrega (modelo de cobrança, polígonos, raios, etc.)
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS delivery_config jsonb;
