-- Localização física da loja — ponto de referência para os modelos de frete
-- por distância (dinâmica, raio, bairro no mapa, matriz).
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);
