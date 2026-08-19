-- Pontos de Atendimento — generaliza "mesas" pra cobrir também comandas/
-- cartões de consumo, com CRUD individual e status ativo/inativo por item.
CREATE TABLE IF NOT EXISTS "service_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
	"name_or_number" text NOT NULL,
	"type" varchar(10) NOT NULL,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "service_points_store_idx" ON "service_points" ("store_id");

-- Dois pontos ATIVOS não podem ter o mesmo nome na mesma loja — índice
-- parcial, então um nome fica livre de novo assim que o ponto antigo é
-- inativado (não é um UNIQUE global, senão nunca daria pra reaproveitar).
CREATE UNIQUE INDEX IF NOT EXISTS "service_points_active_name_idx"
	ON "service_points" ("store_id", "name_or_number")
	WHERE "is_active" = true;

-- Migra as mesas já cadastradas pro novo modelo, preservando continuidade
-- pra quem já configurou mesas antes dessa feature existir.
INSERT INTO "service_points" ("store_id", "name_or_number", "type", "is_active", "created_at")
SELECT "store_id", "label", 'MESA', COALESCE("active", true), now()
FROM "mesas"
ON CONFLICT DO NOTHING;
