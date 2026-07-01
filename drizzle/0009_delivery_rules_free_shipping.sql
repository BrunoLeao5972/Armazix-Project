-- Regras de entrega por bairro e limiar de frete grátis
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS delivery_rules  jsonb,
  ADD COLUMN IF NOT EXISTS free_shipping_above numeric(10,2);
