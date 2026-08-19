-- Override por produto do "Exibir preço" da loja — false transforma só esse
-- item em modo catálogo (botão de adicionar vira WhatsApp), mesmo com o
-- resto da loja exibindo preço normalmente.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "show_price" boolean DEFAULT true;
