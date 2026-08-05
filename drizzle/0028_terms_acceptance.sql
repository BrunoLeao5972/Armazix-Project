-- Prova de aceite dos Termos de Uso no cadastro (data + versão aceita)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp,
  ADD COLUMN IF NOT EXISTS "terms_version" varchar(10);
