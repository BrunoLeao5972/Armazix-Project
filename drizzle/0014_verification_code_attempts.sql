-- Limite de tentativas por código de verificação.
--
-- Contexto: validateVerificationCode() buscava o código apenas por (code, type),
-- sem escopo de usuário. Qualquer código de 6 dígitos válido na plataforma
-- inteira servia para redefinir a senha de quem quer que fosse o dono dele.
-- A busca passou a ser por (userId, type); esta coluna adiciona o limite de
-- tentativas por usuário, que não depende de rate limit por IP.

ALTER TABLE "verification_codes"
  ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;
