-- Sistema de reserva de estoque: pedidos de delivery/retirada do site passam
-- a reservar estoque na criação (sem deduzir de verdade). A baixa real só
-- acontece quando a venda é concretizada (PDV, aba Delivery, ou "Entregue"
-- no kanban pra lojas sem PDV). "Disponível pra vender" = stock - reserved.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reserved" integer NOT NULL DEFAULT 0;

-- Sinal de "essa venda já teve baixa de estoque real + lançamento financeiro
-- feitos" — separado de payment_status porque um pedido pago via Mercado
-- Pago já chega com payment_status='paid' sem nunca ter sido concretizado.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "concretized_at" timestamp;
