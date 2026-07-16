-- Permite configurar por loja se vendas com estoque zerado são aceitas.
-- Default TRUE = comportamento atual (pedidos sempre aceitos, estoque clampado em 0).
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT true;
