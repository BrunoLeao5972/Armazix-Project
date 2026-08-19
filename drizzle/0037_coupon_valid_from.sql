-- Início da validade do cupom — fica "agendado" (não utilizável) até essa
-- data/hora chegar. Null = já vale desde a criação, como já era antes.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "valid_from" timestamp;
