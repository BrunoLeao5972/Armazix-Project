-- Tabela de perfis de acesso (RBAC) por loja
CREATE TABLE IF NOT EXISTS role_profiles (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name          varchar(60) NOT NULL,
  slug          varchar(40) NOT NULL,
  is_system     boolean     NOT NULL DEFAULT false,
  permissions   jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamp   NOT NULL DEFAULT now(),
  updated_at    timestamp   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS role_profiles_store_slug_idx ON role_profiles(store_id, slug);
CREATE        INDEX IF NOT EXISTS role_profiles_store_idx      ON role_profiles(store_id);
