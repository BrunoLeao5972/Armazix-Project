-- Modelo v2 de configuração de pagamento (dois grupos: online + entrega)
-- Substitui paymentMethodsConfig (jsonb array) e deliveryPaymentEnabled (bool).
-- Colunas antigas são mantidas para retrocompatibilidade até migração completa.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS payment_config jsonb;
