-- Conferência de fechamento por forma de pagamento (valor do sistema x
-- valor contado pelo operador x diferença) — antes só existia um único
-- "saldo contado" comparado contra o dinheiro em espécie; agora cobre
-- dinheiro, PIX, cartão etc. individualmente, como no relatório de
-- fechamento de referência.

ALTER TABLE caixa_sessoes ADD COLUMN IF NOT EXISTS conferencia jsonb;
