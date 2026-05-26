-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Imutabilidade da tabela audit_logs
-- Aplica as colunas novas + trigger que bloqueia UPDATE e DELETE.
--
-- Como executar:
--   psql $DATABASE_URL -f migrations/audit_immutability.sql
-- ═══════════════════════════════════════════════════════════════════

-- 1. Adicionar colunas novas (idempotente — ignora se já existirem)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS nome_usuario   VARCHAR(120),
  ADD COLUMN IF NOT EXISTS modulo         VARCHAR(60),
  ADD COLUMN IF NOT EXISTS dados_anteriores JSONB,
  ADD COLUMN IF NOT EXISTS dados_novos      JSONB;

-- 2. Índice no módulo para queries de filtragem por área de negócio
CREATE INDEX IF NOT EXISTS audit_logs_modulo_idx
  ON audit_logs (modulo);

-- ───────────────────────────────────────────────────────────────────
-- 3. Trigger de Imutabilidade — Regra de Ouro
--    Qualquer tentativa de UPDATE ou DELETE na tabela audit_logs
--    lança uma exceção e aborta a operação imediatamente.
--    Isso vale inclusive para conexões admin, exceto o superuser
--    do banco (pg_catalog). Para auditorias forenses, use pg_dump.
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_logs_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'VIOLAÇÃO DE IMUTABILIDADE: A tabela audit_logs é append-only. '
      'UPDATE não é permitido. Para corrigir um log, registre um novo '
      'evento com action=CORRECAO_LOG e referencie o id_log original em details.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'VIOLAÇÃO DE IMUTABILIDADE: A tabela audit_logs é append-only. '
      'DELETE não é permitido. Logs de auditoria são permanentes por '
      'design para garantir conformidade e trilha de auditoria interna.';
  END IF;

  -- INSERT passa sem interferência
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir (para reexecução segura)
DROP TRIGGER IF EXISTS trg_audit_logs_imutavel ON audit_logs;

-- Aplica nas operações BEFORE UPDATE e BEFORE DELETE, por linha
CREATE TRIGGER trg_audit_logs_imutavel
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_logs_imutavel();

-- ───────────────────────────────────────────────────────────────────
-- 4. Revogar privilégios de DELETE e UPDATE da role da aplicação
--    (substitua 'armazix_app' pelo nome real da role)
-- ───────────────────────────────────────────────────────────────────
-- REVOKE UPDATE, DELETE ON audit_logs FROM armazix_app;
-- GRANT SELECT, INSERT ON audit_logs TO armazix_app;

-- ───────────────────────────────────────────────────────────────────
-- 5. Verificação — deve retornar 0 triggers com BEFORE UPDATE/DELETE
--    desativados; o trigger recém criado deve aparecer como enabled.
-- ───────────────────────────────────────────────────────────────────
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'audit_logs'::regclass;
