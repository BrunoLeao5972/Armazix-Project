-- Coordenadas geocodificadas a partir do endereço de CADASTRO (stores.address),
-- independentes de stores.latitude/longitude (pino de entrega, arrastável
-- manualmente pelo lojista em Configurações → Entrega — usado só pelos
-- modelos de frete por distância). O Mapa de Clientes do GerenciadorArmazix
-- usa estas colunas em vez do pino de entrega.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address_latitude numeric(10, 7);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address_longitude numeric(10, 7);
