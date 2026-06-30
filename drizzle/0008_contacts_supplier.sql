-- Unifica Clientes e Fornecedores: adiciona flag is_supplier na tabela customers
ALTER TABLE "customers"
ADD COLUMN IF NOT EXISTS "is_supplier" boolean DEFAULT false;
