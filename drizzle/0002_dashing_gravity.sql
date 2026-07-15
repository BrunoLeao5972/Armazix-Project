CREATE TABLE "customer_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" varchar(30) DEFAULT 'Produção' NOT NULL,
	"driver" varchar(30) DEFAULT 'Nenhum' NOT NULL,
	"path" varchar(255),
	"columns" integer DEFAULT 48,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sectors" (
	"product_id" uuid NOT NULL,
	"sector_id" uuid NOT NULL,
	CONSTRAINT "product_sectors_product_id_sector_id_pk" PRIMARY KEY("product_id","sector_id")
);
--> statement-breakpoint
CREATE TABLE "role_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"slug" varchar(40) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(20),
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "icon" varchar(40);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_deliverer" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_type" varchar(50) DEFAULT 'Produto' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_weight_scale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "variation_groups" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "banner_interval_ms" integer DEFAULT 5000;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "payment_config" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "delivery_config" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cpf" varchar(14);--> statement-breakpoint
ALTER TABLE "customer_otps" ADD CONSTRAINT "customer_otps_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sectors" ADD CONSTRAINT "product_sectors_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sectors" ADD CONSTRAINT "product_sectors_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profiles" ADD CONSTRAINT "role_profiles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_otps_lookup_idx" ON "customer_otps" USING btree ("store_id","phone");--> statement-breakpoint
CREATE INDEX "printers_store_idx" ON "printers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_sectors_product_idx" ON "product_sectors" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_sectors_sector_idx" ON "product_sectors" USING btree ("sector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_profiles_store_slug_idx" ON "role_profiles" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "role_profiles_store_idx" ON "role_profiles" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "sectors_store_idx" ON "sectors" USING btree ("store_id");