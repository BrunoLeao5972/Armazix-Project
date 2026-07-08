-- CPF no cadastro de usuários (campo opcional, único globalmente quando preenchido)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf varchar(14);
CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_idx ON users(cpf) WHERE cpf IS NOT NULL;
