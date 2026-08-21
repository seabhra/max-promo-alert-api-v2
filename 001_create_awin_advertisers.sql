-- Tabela de cadastro dos anunciantes/programas Awin (fonte: export do painel Awin)
-- Não guarda produtos/promoções individuais — isso continua na tabela `promocoes`.

CREATE TABLE IF NOT EXISTS awin_advertisers (
  advertiser_id       TEXT PRIMARY KEY,
  programme_name      TEXT NOT NULL,
  conversion_rate     NUMERIC,
  approval_rate       NUMERIC,
  epc                 NUMERIC,
  launch_date         DATE,
  payment_status      TEXT,          -- green | amber | red
  payment_risk_level  TEXT,
  awin_index          NUMERIC,
  feed_enabled        BOOLEAN NOT NULL DEFAULT false,
  product_reporting   BOOLEAN NOT NULL DEFAULT false,
  commission_min      NUMERIC,
  commission_max      NUMERIC,
  cookie_length_days  INTEGER,
  parent_sectors      TEXT,
  sub_sectors         TEXT,
  primary_sector      TEXT,
  average_payment_time INTEGER,
  primary_region      TEXT,
  description_short   TEXT,
  logo_url            TEXT,
  display_url         TEXT,
  -- controle de scraping
  last_scraped_at     TIMESTAMPTZ,
  active              BOOLEAN NOT NULL DEFAULT true,
  imported_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_awin_advertisers_feed_enabled
  ON awin_advertisers (feed_enabled) WHERE feed_enabled = true;

CREATE INDEX IF NOT EXISTS idx_awin_advertisers_region
  ON awin_advertisers (primary_region);

-- Garante que a tabela de promoções sabe distinguir a origem do registro
ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'pix';
  -- valores esperados: 'awin' | 'pix' | 'csv_manual'

ALTER TABLE promocoes
  ADD COLUMN IF NOT EXISTS awin_advertiser_id TEXT REFERENCES awin_advertisers(advertiser_id);
