-- Rastreio de ciclo de vida financeiro da venda + fluxo de estorno.
--
-- Antes: dava pra saber orders.number e orders.status (kanban), mas não
-- "o que ocorreu com aquela venda" num só campo. Cancelar/estornar uma
-- venda já concretizada não desfazia nada no financeiro/estoque/caixa.
--
-- sale_status é independente do status de fulfillment:
--   aberta      → pedido criado, ainda não concretizado
--   finalizada  → concretizada (baixa de estoque + lançamento financeiro)
--   cancelada   → cancelada ANTES de concretizar (nada lançado)
--   estornada   → concretizada e depois revertida (financeiro estornado,
--                 estoque devolvido, caixa ajustado — ver src/lib/orders/estorno.ts)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_status varchar(12) NOT NULL DEFAULT 'aberta';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason_code varchar(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at timestamp;

CREATE INDEX IF NOT EXISTS orders_sale_status_idx ON orders (sale_status);

-- Backfill do histórico existente. Ordem importa: 'estornada' por último
-- sobrescreve 'finalizada'/'cancelada' quando também houve refund.
UPDATE orders SET sale_status = 'finalizada'
  WHERE concretized_at IS NOT NULL AND status <> 'cancelled' AND sale_status = 'aberta';

UPDATE orders SET sale_status = 'cancelada'
  WHERE status = 'cancelled' AND concretized_at IS NULL AND sale_status = 'aberta';

UPDATE orders SET sale_status = 'estornada'
  WHERE (payment_status = 'refunded' OR (status = 'cancelled' AND concretized_at IS NOT NULL))
    AND sale_status <> 'estornada';
