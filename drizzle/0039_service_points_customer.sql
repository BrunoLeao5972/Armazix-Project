-- Cliente opcional atrelado a um ponto de atendimento (mesa/comanda) —
-- sempre um cliente já cadastrado, nunca texto livre.
ALTER TABLE "service_points"
  ADD COLUMN IF NOT EXISTS "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL;
