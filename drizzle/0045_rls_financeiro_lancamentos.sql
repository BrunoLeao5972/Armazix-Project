-- Auditoria de segurança — achado F4: reports-handler.ts vai passar a usar
-- createTenantDbTransactional (RLS real) pros relatórios financeiros
-- (Fluxo de Caixa, Lucro Bruto e Líquido, categorias-financeiro), mas
-- financeiro_lancamentos nunca teve RLS habilitada em nenhuma migração
-- anterior — sem isso, migrar só a conexão não adicionaria proteção
-- nenhuma pra essa tabela (o isolamento continuaria sendo só o filtro
-- manual eq(storeId, ...), que já existe e já foi verificado correto).
--
-- Só SELECT (mesmo padrão de audit_logs em 0030_rls_activate.sql): a
-- escrita em financeiro_lancamentos sempre acontece via createDb/
-- createDbTransactional (role admin, BYPASSRLS) nos fluxos de PDV/pedido —
-- a conexão tenant-scoped só lê, nunca grava nessa tabela.
ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_financeiro_lancamentos ON financeiro_lancamentos;
CREATE POLICY tenant_financeiro_lancamentos ON financeiro_lancamentos
  FOR SELECT USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);
