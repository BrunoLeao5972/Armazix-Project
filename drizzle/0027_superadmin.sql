-- Flag de acesso ao Gerenciador Armazix (portal SuperAdmin, projeto separado
-- em D:\Projetos\GerenciadorArmazix). Default false — ninguém ganha acesso
-- por acidente; precisa ser promovido manualmente via UPDATE direto no banco.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_superadmin" boolean NOT NULL DEFAULT false;
