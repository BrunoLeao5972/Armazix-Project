CREATE UNIQUE INDEX "stores_cnpj_idx" ON "stores" USING btree ("cnpj");--> statement-breakpoint
CREATE UNIQUE INDEX "users_cpf_idx" ON "users" USING btree ("cpf");