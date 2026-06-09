ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS banner_mobile_url         TEXT,
  ADD COLUMN IF NOT EXISTS background_color          VARCHAR(7),
  ADD COLUMN IF NOT EXISTS text_color                VARCHAR(7),
  ADD COLUMN IF NOT EXISTS show_price                BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_order_enabled    BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_phone            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS highlight_low_stock       BOOLEAN       DEFAULT FALSE;
