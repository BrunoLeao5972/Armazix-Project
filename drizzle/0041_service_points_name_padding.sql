-- Uniformiza o nome dos pontos de atendimento já cadastrados pro formato
-- "Mesa 01"/"Cartão 01" (2 dígitos, sempre com espaço) — cobre tanto o
-- formato legado do backfill de "mesas" ("MESA1", sem espaço/zero) quanto
-- "Mesa 11" sem zero à esquerda gerado antes dessa mudança.
UPDATE "service_points"
SET "name_or_number" = 'Mesa ' || LPAD((regexp_match("name_or_number", '(\d+)$'))[1], 2, '0')
WHERE "type" = 'MESA' AND "name_or_number" ~ '\d+$';

UPDATE "service_points"
SET "name_or_number" = 'Cartão ' || LPAD((regexp_match("name_or_number", '(\d+)$'))[1], 2, '0')
WHERE "type" = 'CARTAO' AND "name_or_number" ~ '\d+$';
