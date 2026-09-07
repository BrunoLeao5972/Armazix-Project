-- Mesmo problema de financeiro_contas_pagar (0047): "Contas a Receber" tem
-- botão/modal já funcionando no front, mas GET /api/financeiro/contas-receber
-- não existia — lista sempre vazia, e Receber/Cancelar/Editar/Excluir só
-- mexiam em estado React local (some no F5).
CREATE TABLE IF NOT EXISTS financeiro_contas_receber (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cliente          varchar(120) NOT NULL,
  descricao        varchar(250) NOT NULL,
  documento        varchar(50),
  categoria        varchar(120),
  centro_custo     varchar(60),
  forma_pgto       varchar(50),
  conta_financeira varchar(60),
  valor            numeric(10, 2) NOT NULL,
  juros            numeric(10, 2) NOT NULL DEFAULT 0,
  desconto         numeric(10, 2) NOT NULL DEFAULT 0,
  valor_recebido   numeric(10, 2) NOT NULL DEFAULT 0,
  emissao          varchar(10),
  vencimento       varchar(10) NOT NULL,
  recebimento      varchar(10),
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

CREATE INDEX IF NOT EXISTS fin_contas_receber_store_idx ON financeiro_contas_receber (store_id);
CREATE INDEX IF NOT EXISTS fin_contas_receber_status_idx ON financeiro_contas_receber (status);
CREATE INDEX IF NOT EXISTS fin_contas_receber_vencimento_idx ON financeiro_contas_receber (vencimento);

ALTER TABLE financeiro_contas_receber ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_financeiro_contas_receber ON financeiro_contas_receber;
CREATE POLICY tenant_financeiro_contas_receber ON financeiro_contas_receber
  FOR ALL USING (store_id = app_current_store_id() OR app_current_store_id() IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON financeiro_contas_receber TO armazix_tenant;
