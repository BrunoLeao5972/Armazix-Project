-- Sessão de "mesa/comanda aberta" — independente de quando um pedido de
-- verdade é criado (o carrinho do PDV só vira pedido na finalização do
-- pagamento). É isso que dá ocupado/livre real ao mapa de atendimentos.
CREATE TABLE IF NOT EXISTS "service_point_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
	"service_point_id" uuid NOT NULL REFERENCES "service_points"("id") ON DELETE CASCADE,
	"caixa_sessao_id" uuid REFERENCES "caixa_sessoes"("id") ON DELETE SET NULL,
	"opened_at" timestamp NOT NULL DEFAULT now(),
	"closed_at" timestamp,
	"order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "service_point_sessions_store_idx" ON "service_point_sessions" ("store_id");
CREATE INDEX IF NOT EXISTS "service_point_sessions_point_idx" ON "service_point_sessions" ("service_point_id");

-- No máximo 1 sessão ABERTA por ponto de atendimento — mesmo padrão de
-- índice parcial já usado em service_points_active_name_idx (0038).
CREATE UNIQUE INDEX IF NOT EXISTS "service_point_sessions_open_idx"
	ON "service_point_sessions" ("service_point_id") WHERE "closed_at" IS NULL;
