ALTER TABLE "stores" ADD COLUMN "appmax_external_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "stores_appmax_external_id_idx" ON "stores" USING btree ("appmax_external_id");