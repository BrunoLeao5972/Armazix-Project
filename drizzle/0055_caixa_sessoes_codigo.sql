-- Código curto (5 caracteres, alfanumérico, sem 0/O/1/I/L) pra identificar
-- visualmente uma sessão de caixa sem precisar do uuid interno — único por
-- loja (31^5 ≈ 28,6 milhões de combinações, sem colisão prática dentro de
-- uma mesma loja). Gerado em abrirCaixaHandler (pdv-handler.ts).
--
-- Coluna criada nullable de propósito: sessões existentes são backfilladas
-- em JS (scratch-apply-0055.mjs, que respeita o alfabeto e a unicidade por
-- loja) antes de travar como NOT NULL — não dá pra gerar 5 caracteres
-- aleatórios únicos por linha só com SQL simples.

ALTER TABLE caixa_sessoes ADD COLUMN IF NOT EXISTS codigo varchar(5);
-- Backfill roda aqui (ver scratch-apply-0055.mjs).
ALTER TABLE caixa_sessoes ALTER COLUMN codigo SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS caixa_sessoes_store_codigo_idx ON caixa_sessoes (store_id, codigo);
