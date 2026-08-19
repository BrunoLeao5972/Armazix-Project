-- Produto vendido sob encomenda — mostra um destaque avisando o cliente que
-- a produção/entrega leva um tempo, em vez de pronta-entrega.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_made_to_order" boolean DEFAULT false;
