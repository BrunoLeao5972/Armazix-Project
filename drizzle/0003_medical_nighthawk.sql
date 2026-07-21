CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"key" varchar(40) NOT NULL,
	"label" varchar(120) NOT NULL,
	"sigla" varchar(8),
	"enabled" boolean DEFAULT true NOT NULL,
	"especie" varchar(20),
	"operacao" varchar(20),
	"max_installments" integer DEFAULT 1 NOT NULL,
	"pay_at_delivery" boolean DEFAULT true,
	"parcelamento_ativo" boolean DEFAULT false,
	"taxas_por_parcela" jsonb DEFAULT '[]'::jsonb,
	"repassar_taxa_cliente" boolean DEFAULT false,
	"pix_key_type" varchar(20),
	"pix_key" varchar(100),
	"pix_qr_code_url" text,
	"mp_public_key" text,
	"mp_access_token" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods_to_plans" (
	"payment_method_id" uuid NOT NULL,
	"payment_plan_id" uuid NOT NULL,
	CONSTRAINT "payment_methods_to_plans_payment_method_id_payment_plan_id_pk" PRIMARY KEY("payment_method_id","payment_plan_id")
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"codigo" integer NOT NULL,
	"nome" varchar(80) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"parcelas" integer DEFAULT 1 NOT NULL,
	"tipo" varchar(10) NOT NULL,
	"quantidade" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"category_id" uuid NOT NULL,
	"printer_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_product_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sector_id" uuid NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"min_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pdv_code" varchar(20);--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD COLUMN "sector_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "sector_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "source_sector_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "destination_sector_id" uuid;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "allow_negative_stock" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "layout_type" varchar(10) DEFAULT 'grid';--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods_to_plans" ADD CONSTRAINT "payment_methods_to_plans_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods_to_plans" ADD CONSTRAINT "payment_methods_to_plans_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_environments" ADD CONSTRAINT "print_environments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_environments" ADD CONSTRAINT "print_environments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_environments" ADD CONSTRAINT "print_environments_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_product_balances" ADD CONSTRAINT "stock_product_balances_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_product_balances" ADD CONSTRAINT "stock_product_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_product_balances" ADD CONSTRAINT "stock_product_balances_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_store_key_idx" ON "payment_methods" USING btree ("store_id","key");--> statement-breakpoint
CREATE INDEX "payment_methods_store_idx" ON "payment_methods" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "payment_methods_to_plans_method_idx" ON "payment_methods_to_plans" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX "payment_methods_to_plans_plan_idx" ON "payment_methods_to_plans" USING btree ("payment_plan_id");--> statement-breakpoint
CREATE INDEX "payment_plans_store_idx" ON "payment_plans" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_plans_store_codigo_idx" ON "payment_plans" USING btree ("store_id","codigo");--> statement-breakpoint
CREATE INDEX "print_env_store_idx" ON "print_environments" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "print_env_category_idx" ON "print_environments" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "print_env_printer_idx" ON "print_environments" USING btree ("printer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spb_product_sector_uidx" ON "stock_product_balances" USING btree ("product_id","sector_id");--> statement-breakpoint
CREATE INDEX "spb_store_idx" ON "stock_product_balances" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "spb_sector_idx" ON "stock_product_balances" USING btree ("sector_id");--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_source_sector_id_sectors_id_fk" FOREIGN KEY ("source_sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_destination_sector_id_sectors_id_fk" FOREIGN KEY ("destination_sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_pdv_code_idx" ON "products" USING btree ("store_id","pdv_code");--> statement-breakpoint
CREATE INDEX "stock_adjustments_sector_idx" ON "stock_adjustments" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "stock_movements_sector_idx" ON "stock_movements" USING btree ("sector_id");