-- Canal de origem da venda: "pdv" (frente de caixa, finalizarVendaPdvHandler)
-- ou "online" (checkout da loja / Mercado Pago). Antes não havia como separar
-- os dois — o relatório "Clientes que Mais Compram" e a tela Vendas do
-- Financeiro precisam disso.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel varchar(10) NOT NULL DEFAULT 'online';
CREATE INDEX IF NOT EXISTS orders_channel_idx ON orders (channel);

-- Backfill: o PDV grava orders.notes = 'PDV' ou 'PDV — <mesa>'.
UPDATE orders SET channel = 'pdv' WHERE notes LIKE 'PDV%' AND channel <> 'pdv';
