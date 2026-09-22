-- Encerramento automático diário do caixa do PDV. Todo dia, no horário
-- configurado (HH:mm, fuso de Brasília), o Cron Trigger encerra qualquer
-- caixa_sessoes ainda "aberta" da loja (src/lib/jobs/caixa-auto-close.ts).
-- Padrão: ligado, às 00:00, pra todas as lojas (inclusive as existentes).

ALTER TABLE stores ADD COLUMN IF NOT EXISTS caixa_auto_close_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS caixa_auto_close_time varchar(5) NOT NULL DEFAULT '00:00';
