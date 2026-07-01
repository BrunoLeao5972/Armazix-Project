CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"nome_usuario" varchar(120),
	"store_id" uuid,
	"action" varchar(80) NOT NULL,
	"modulo" varchar(60),
	"resource_type" varchar(50),
	"resource_id" varchar(100),
	"dados_anteriores" jsonb,
	"dados_novos" jsonb,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"status" varchar(20) DEFAULT 'success',
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caixa_movimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessao_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"motivo" text,
	"criado_por" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caixa_sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"saldo_inicial" numeric(10, 2) DEFAULT '0' NOT NULL,
	"saldo_final" numeric(10, 2),
	"total_dinheiro" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_pix" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_cartao" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_debito" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_outros" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_vendas" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'aberta' NOT NULL,
	"aberto_por" varchar(120),
	"encerrado_por" varchar(120),
	"observations" text,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "financeiro_lancamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"tipo" varchar(10) NOT NULL,
	"categoria" varchar(50) DEFAULT 'venda',
	"descricao" varchar(250) NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"metodo_pagamento" varchar(50),
	"status" varchar(20) DEFAULT 'liquidado' NOT NULL,
	"data_competencia" varchar(10) NOT NULL,
	"data_pagamento" varchar(10),
	"order_id" uuid,
	"sessao_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"label" varchar(50) NOT NULL,
	"capacidade" integer DEFAULT 4,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(150) NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"qty" integer NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"motivo" varchar(250),
	"observations" text,
	"movement_id" uuid,
	"created_by" uuid,
	"created_by_name" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"prod_scope" varchar(10) DEFAULT 'todos' NOT NULL,
	"preco" varchar(50) DEFAULT 'Preço de custo' NOT NULL,
	"data_contagem" timestamp NOT NULL,
	"data_encerramento" timestamp,
	"status" varchar(20) DEFAULT 'em_aberto' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_by_name" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(150) NOT NULL,
	"type" varchar(20) NOT NULL,
	"quantity" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"origem" varchar(250) NOT NULL,
	"order_id" uuid,
	"supplier_id" uuid,
	"nf" varchar(50),
	"lot" varchar(50),
	"expiry" varchar(20),
	"cost_price" numeric(10, 2),
	"pay_method" varchar(50),
	"due_date" varchar(20),
	"observations" text,
	"created_by" uuid,
	"created_by_name" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"type" varchar(20) NOT NULL,
	"used_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "show_in_menu" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "analytic" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "meta_title" varchar(120);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "meta_description" varchar(320);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_supplier" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "status" varchar(20) DEFAULT 'ativo';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "installments" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "card_fee_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_config" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "track_stock" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "allow_observation" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "banner_mobile_url" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "background_color" varchar(7);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "text_color" varchar(7);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "owner_name" varchar(120);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "business_hours" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "show_price" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "whatsapp_order_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "whatsapp_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "highlight_low_stock" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "mp_access_token" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "mp_public_key" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "payment_methods_config" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "delivery_payment_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "delivery_rules" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "free_shipping_above" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "wpp_config" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "plan" varchar(20) DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "plan_status" varchar(20) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "mp_subscription_id" varchar(100);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "payment_method" varchar(20) DEFAULT 'card_recurring';--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "pdv_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "mp_payment_id" varchar(100);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "amount_paid" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "payment_status" varchar(20);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caixa_movimentos" ADD CONSTRAINT "caixa_movimentos_sessao_id_caixa_sessoes_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."caixa_sessoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caixa_movimentos" ADD CONSTRAINT "caixa_movimentos_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caixa_sessoes" ADD CONSTRAINT "caixa_sessoes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_lancamentos_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_lancamentos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_lancamentos_sessao_id_caixa_sessoes_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."caixa_sessoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplier_id_customers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_store_idx" ON "audit_logs" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_modulo_idx" ON "audit_logs" USING btree ("modulo");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "caixa_mov_sessao_idx" ON "caixa_movimentos" USING btree ("sessao_id");--> statement-breakpoint
CREATE INDEX "caixa_mov_store_idx" ON "caixa_movimentos" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "caixa_sessoes_store_idx" ON "caixa_sessoes" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "caixa_sessoes_status_idx" ON "caixa_sessoes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "caixa_sessoes_opened_idx" ON "caixa_sessoes" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "fin_lancamentos_store_idx" ON "financeiro_lancamentos" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "fin_lancamentos_status_idx" ON "financeiro_lancamentos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fin_lancamentos_data_idx" ON "financeiro_lancamentos" USING btree ("data_competencia");--> statement-breakpoint
CREATE INDEX "fin_lancamentos_sessao_idx" ON "financeiro_lancamentos" USING btree ("sessao_id");--> statement-breakpoint
CREATE INDEX "mesas_store_idx" ON "mesas" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_store_idx" ON "stock_adjustments" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_product_idx" ON "stock_adjustments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_created_idx" ON "stock_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_balances_store_idx" ON "stock_balances" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "stock_balances_status_idx" ON "stock_balances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_movements_store_idx" ON "stock_movements" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_type_idx" ON "stock_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "stock_movements_created_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_codes_user_idx" ON "verification_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_codes_code_idx" ON "verification_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "verification_codes_type_idx" ON "verification_codes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "store_users" DROP COLUMN "id";