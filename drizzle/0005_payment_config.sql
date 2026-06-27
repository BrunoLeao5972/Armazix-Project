-- Configuração de formas de pagamento por loja (quais aceitar + max parcelas)
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "payment_methods_config" jsonb;

-- Chave pública do Mercado Pago (não sensível — usada no frontend do checkout)
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "mp_public_key" text;

-- Número de parcelas escolhido pelo cliente no pedido (1 = à vista)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "installments" integer DEFAULT 1;
