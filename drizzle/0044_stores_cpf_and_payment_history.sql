-- CPF como alternativa ao CNPJ (MEI/pessoa física sem CNPJ).
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "cpf" varchar(14);

-- Ledger de cobranças do plano Armazix — histórico de verdade (stores.*
-- só guarda o pagamento mais recente, sobrescrito a cada webhook).
CREATE TABLE IF NOT EXISTS "subscription_payments" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"       uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "plan"           varchar(20) NOT NULL,
  "amount"         numeric(10, 2) NOT NULL,
  "payment_method" varchar(20) NOT NULL,
  "status"         varchar(20) NOT NULL,
  "mp_reference"   varchar(100),
  "occurred_at"    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_payments_store_idx" ON "subscription_payments" ("store_id");
