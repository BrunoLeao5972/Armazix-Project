-- Código PDV: campo de busca rápida no caixa, único por loja
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "pdv_code" varchar(20);

-- Índice único parcial: store_id + pdv_code somente quando pdv_code não é NULL
-- (NULLs nunca conflitam em PostgreSQL, mas o WHERE torna a intenção explícita)
CREATE UNIQUE INDEX IF NOT EXISTS "store_pdv_code_idx"
  ON "products"("store_id", "pdv_code")
  WHERE "pdv_code" IS NOT NULL;
