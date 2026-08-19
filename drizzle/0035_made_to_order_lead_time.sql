-- Prazo de produção sob encomenda — número + unidade (dias/horas). Ambos
-- nulos = sem prazo informado, mostra a mensagem padrão genérica.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "made_to_order_lead_time" integer;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "made_to_order_lead_time_unit" varchar(10);
