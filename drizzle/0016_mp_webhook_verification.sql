-- Verificação real do webhook de pedidos do Mercado Pago.
--
-- Contexto: mpWebhookHandler resolvia o pedido pelo `external_reference` que
-- vinha NO CORPO da requisição e nunca conferia se o pagamento consultado no
-- MP apontava de volta para aquele pedido, nem se o valor batia. Também não
-- havia guarda de replay. O webhook de assinaturas já fazia tudo isso certo;
-- o de pedidos, não.
--
-- stores.mp_user_id  — o webhook do MP identifica o lojista por `user_id` e
--   não manda o external_reference. Sem esse mapeamento não dá para saber com
--   qual token consultar o pagamento (e varrer todas as lojas seria um vetor
--   de DoS). Preenchido ao salvar o token e, para lojas antigas, no primeiro
--   checkout seguinte.
--
-- orders.gateway_payment_id — id do pagamento que liquidou o pedido. É a
--   guarda de idempotência do webhook.

ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "mp_user_id" varchar(40);

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "gateway_payment_id" varchar(64);

CREATE INDEX IF NOT EXISTS "stores_mp_user_idx" ON "stores" ("mp_user_id");
