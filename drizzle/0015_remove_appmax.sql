-- Remoção da integração Appmax.
--
-- A integração foi retirada do produto. Além de não estar em uso, o fluxo de
-- conexão tinha uma falha crítica: o callback público
-- (GET /api/payments/appmax-callback) resolvia a loja de destino pelo
-- `external_key` da query string, sem autenticação e sem `state`. Qualquer um
-- podia instalar o app na própria conta Appmax, pegar o `hash` e gravar as
-- próprias credenciais sobre as de outra loja — passando a receber todos os
-- pagamentos da vitrine dela.
--
-- ⚠️ DESTRUTIVO: apaga as credenciais Appmax salvas. Isso é intencional —
-- eram segredos de gateway que a rota pública GET /api/store/get devolvia
-- junto com o resto da linha de `stores`. Se alguma loja chegou a conectar,
-- revogue as credenciais no painel da Appmax também.

ALTER TABLE "stores"
  DROP COLUMN IF EXISTS "appmax_client_id",
  DROP COLUMN IF EXISTS "appmax_client_secret",
  DROP COLUMN IF EXISTS "appmax_access_token",
  DROP COLUMN IF EXISTS "appmax_token_expires_at",
  DROP COLUMN IF EXISTS "appmax_connected_at",
  DROP COLUMN IF EXISTS "appmax_external_id";

DROP INDEX IF EXISTS "orders_appmax_order_idx";

ALTER TABLE "orders"
  DROP COLUMN IF EXISTS "appmax_order_id";

-- Desabilita a forma de pagamento "appmax" que tenha ficado salva no JSON de
-- configuração das lojas, para ela não continuar aparecendo no checkout.
UPDATE "stores"
SET "payment_methods_config" = (
  SELECT COALESCE(jsonb_agg(m), '[]'::jsonb)
  FROM jsonb_array_elements("payment_methods_config") AS m
  WHERE m->>'key' <> 'appmax'
)
WHERE "payment_methods_config" IS NOT NULL
  AND jsonb_typeof("payment_methods_config") = 'array';
