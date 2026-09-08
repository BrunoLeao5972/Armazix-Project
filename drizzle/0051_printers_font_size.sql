-- "Normal" | "Grande" — letra maior nos cupons dessa impressora.
ALTER TABLE "printers" ADD COLUMN IF NOT EXISTS "font_size" varchar(10) NOT NULL DEFAULT 'Normal';
ALTER TABLE "printers" ALTER COLUMN "font_size" SET DEFAULT 'Normal';
UPDATE "printers" SET "font_size" = 'Normal' WHERE lower("font_size") = 'normal' AND "font_size" != 'Normal';
