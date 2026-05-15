-- ============================================================================
-- MIGRATION 0002: PIX payment fields
-- Adds support for PIX manual monthly payments alongside card recurring.
-- ============================================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS payment_method   VARCHAR(20)     DEFAULT 'card_recurring',
  ADD COLUMN IF NOT EXISTS pdv_enabled      BOOLEAN         DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mp_payment_id    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payment_status   VARCHAR(20);
