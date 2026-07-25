-- Convites de equipe — substitui o vínculo direto em store_users.
--
-- Contexto: o fluxo antigo (POST /api/store-users/create) vinculava
-- silenciosamente um usuário já existente à loja de quem chamava, sem aceite.
-- Como os handlers de equipe escrevem na tabela global `users` (senha, active,
-- nome, cpf), isso permitia que o dono da loja A assumisse a conta do dono da
-- loja B. Agora a entrada na equipe exige posse do e-mail.

CREATE TABLE IF NOT EXISTS "store_invites" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"    uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "email"       varchar(120) NOT NULL,
  "name"        varchar(120) NOT NULL,
  "role"        varchar(20)  NOT NULL,
  "token_hash"  varchar(64)  NOT NULL,
  "expires_at"  timestamp    NOT NULL,
  "accepted_at" timestamp,
  "revoked_at"  timestamp,
  "invited_by"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_invites_token_hash_idx" ON "store_invites" ("token_hash");
CREATE INDEX IF NOT EXISTS "store_invites_store_idx" ON "store_invites" ("store_id");
CREATE INDEX IF NOT EXISTS "store_invites_email_idx" ON "store_invites" ("email");
