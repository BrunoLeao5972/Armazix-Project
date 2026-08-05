-- Auditoria de segurança: revogação de sessão pós-troca de senha (users) e
-- limite de tentativas de OTP de cliente (customer_otps).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 0;

ALTER TABLE "customer_otps"
  ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
