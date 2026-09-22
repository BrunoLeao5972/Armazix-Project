-- CNPJ/CPF do titular da loja: obrigatório (imposto na aplicação, não aqui —
-- lojas antigas de antes dessa regra continuam existindo até o lojista
-- preencher) e único por conta (uma loja por CNPJ/CPF). `stores.cnpj` já
-- tinha índice único (stores_cnpj_idx); `stores.cpf` (alternativa pra
-- MEI/pessoa física) nunca teve — sem isso duas lojas podiam usar o mesmo CPF.

CREATE UNIQUE INDEX IF NOT EXISTS stores_cpf_idx ON stores (cpf);
-- Postgres trata múltiplos NULL como distintos — não bloqueia lojas sem CPF ainda.

-- Backfill: lojista que se cadastrou como pessoa física já tem o CPF validado
-- e com unicidade garantida em users.cpf (checado no registro) — só nunca
-- tinha sido copiado pra stores.cpf. Sem isso, cada uma dessas lojas cairia
-- no alerta de "CNPJ/CPF pendente" por um dado que na prática já existe.
UPDATE stores s
SET cpf = u.cpf
FROM store_users su
JOIN users u ON u.id = su.user_id
WHERE su.store_id = s.id
  AND su.role = 'owner'
  AND s.cnpj IS NULL
  AND s.cpf IS NULL
  AND u.cpf IS NOT NULL;
