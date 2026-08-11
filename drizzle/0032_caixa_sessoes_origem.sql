-- Canal que abriu o turno de caixa (web/desktop) — diferencia a mensagem de
-- "já tem caixa aberto" quando o operador tenta abrir de outro canal.
ALTER TABLE "caixa_sessoes" ADD COLUMN IF NOT EXISTS "origem" varchar(20) NOT NULL DEFAULT 'web';
