ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variation_groups" jsonb NOT NULL DEFAULT '[]';
