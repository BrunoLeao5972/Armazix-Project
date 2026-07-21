ALTER TABLE "orders" ADD COLUMN "appmax_order_id" varchar(40);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "appmax_client_id" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "appmax_client_secret" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "appmax_access_token" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "appmax_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "appmax_connected_at" timestamp;--> statement-breakpoint
CREATE INDEX "orders_appmax_order_idx" ON "orders" USING btree ("appmax_order_id");