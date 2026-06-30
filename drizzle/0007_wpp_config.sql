-- Adiciona coluna de configuração de notificações WhatsApp nas lojas
ALTER TABLE "stores"
ADD COLUMN IF NOT EXISTS "wpp_config" jsonb;
