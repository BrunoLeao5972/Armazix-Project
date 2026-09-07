-- "Contas a Pagar" nunca teve backend — a rota GET /api/financeiro/contas-pagar
-- não existia, e o botão "Nova Conta a Pagar" era um onClick vazio desde a
-- criação do arquivo. Tabela dedicada (não financeiro_lancamentos, que é um
-- livro-razão de lançamentos já liquidados, sem conceito de vencimento/
-- parcela/edição pré-liquidação).
CREATE TABLE IF NOT EXISTS financeiro_contas_pagar (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  fornecedor       varchar(120) NOT NULL,
  descricao        varchar(250) NOT NULL,
  documento        varchar(50),
  categoria        varchar(120),
  centro_custo     varchar(60),
  forma_pgto       varchar(50),
  conta_financeira varchar(60),
  valor            numeric(10, 2) NOT NULL,
  juros            numeric(10, 2) NOT NULL DEFAULT 0,
  desconto         numeric(10, 2) NOT NULL DEFAULT 0,
  valor_pago       numeric(10, 2) NOT NULL DEFAULT 0,
  emissao          varchar(10),
  vencimento       varchar(10) NOT NULL,
  pagamento        varchar(10),
  status           varchar(20) NOT NULL DEFAULT 'pendente',
  origem           varchar(30) NOT NULL DEFAULT 'Manual',
  responsavel      varchar(120),
  obs              text,
  parcelas         integer NOT NULL DEFAULT 1,
  parcela_atual    integer NOT NULL DEFAULT 1,
  lancamento_id    uuid REFERENCES financeiro_lancamentos(id) ON DELETE SET NULL,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fin_contas_pagar_store_idx ON financeiro_contas_pagar (store_id);
CREATE INDEX IF NOT EXISTS fin_contas_pagar_status_idx ON financeiro_contas_pagar (status);
CREATE INDEX IF NOT EXISTS fin_contas_pagar_vencimento_idx ON financeiro_contas_pagar (vencimento);

-- RLS completo (FOR ALL) — diferente do padrão só-SELECT de
-- financeiro_lancamentos: aqui a escrita é feita pela própria conexão
-- tenant-scoped (requireStoreAccess), não por um fluxo interno com
-- BYPASSRLS. Mesmo padrão de products/orders em 0030_rls_activate.sql.
ALTER TABLE financeiro_contas_pagar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_financeiro_contas_pagar ON financeiro_contas_pagar;
CREATE POLICY tenant_financeiro_contas_pagar ON financeiro_contas_pagar
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

-- RLS habilitada não é suficiente sozinha — sem o GRANT, a role
-- armazix_tenant nem teria permissão de tabela pra tentar a query (achado
-- descoberto ao aplicar esta migração: tabela nova não herda os grants de
-- financeiro_lancamentos automaticamente).
GRANT SELECT, INSERT, UPDATE, DELETE ON financeiro_contas_pagar TO armazix_tenant;
