-- Login mais recente de qualquer usuário da loja (owner ou staff) — usado
-- pelo CRM do Gerenciador Armazix pra saber se o lojista está de fato usando
-- o painel, não só se tem acesso liberado.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
