-- "Cliente Padrão" / "Fornecedor Padrão" — todo lojista passa a ter, desde a
-- criação da loja, um registro coringa de cada tipo (ver seed em
-- register-handler.ts), usado como fallback quando um ponto de atendimento
-- (mesa/comanda) não tem cliente específico atrelado.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;

-- Reaproveita "Cliente Padrão"/"Fornecedor Padrão" já cadastrados manualmente
-- por algumas lojas antes dessa coluna existir — marca o mais antigo de cada
-- loja como o padrão oficial, em vez de criar um duplicado no backfill abaixo.
UPDATE "customers" c SET "is_default" = true
WHERE c."id" IN (
	SELECT DISTINCT ON ("store_id") "id"
	FROM "customers"
	WHERE "name" = 'Cliente Padrão' AND "is_supplier" = false
	ORDER BY "store_id", "created_at" ASC
);

UPDATE "customers" c SET "is_default" = true
WHERE c."id" IN (
	SELECT DISTINCT ON ("store_id") "id"
	FROM "customers"
	WHERE "name" = 'Fornecedor Padrão' AND "is_supplier" = true
	ORDER BY "store_id", "created_at" ASC
);

-- No máximo um cliente padrão e um fornecedor padrão por loja.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_default_customer_idx"
	ON "customers" ("store_id") WHERE "is_default" = true AND "is_supplier" = false;
CREATE UNIQUE INDEX IF NOT EXISTS "customers_default_supplier_idx"
	ON "customers" ("store_id") WHERE "is_default" = true AND "is_supplier" = true;

-- Cria o "Cliente Padrão" pras lojas que ainda não têm nenhum.
INSERT INTO "customers" ("store_id", "name", "is_supplier", "is_default", "status", "active")
SELECT s."id", 'Cliente Padrão', false, true, 'ativo', true
FROM "stores" s
WHERE NOT EXISTS (
	SELECT 1 FROM "customers" c WHERE c."store_id" = s."id" AND c."is_default" = true AND c."is_supplier" = false
);

-- Cria o "Fornecedor Padrão" pras lojas que ainda não têm nenhum.
INSERT INTO "customers" ("store_id", "name", "is_supplier", "is_default", "status", "active")
SELECT s."id", 'Fornecedor Padrão', true, true, 'ativo', true
FROM "stores" s
WHERE NOT EXISTS (
	SELECT 1 FROM "customers" c WHERE c."store_id" = s."id" AND c."is_default" = true AND c."is_supplier" = true
);
