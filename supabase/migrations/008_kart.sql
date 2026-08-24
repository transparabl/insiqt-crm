-- ============================================================
-- 008_kart.sql — Adresse og koordinater for kartmodulen
-- Koordinater hentes fra Kartverkets adresseregister (Geonorge).
-- ============================================================

ALTER TABLE companies  ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE companies  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE companies  ADD COLUMN IF NOT EXISTS geokodet_at TIMESTAMPTZ;

ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS geokodet_at TIMESTAMPTZ;

-- Kartet henter kun rader som faktisk har koordinater
CREATE INDEX IF NOT EXISTS idx_companies_koord  ON companies(lat, lng)  WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ringeliste_koord ON ringeliste(lat, lng) WHERE lat IS NOT NULL;

COMMENT ON COLUMN companies.geokodet_at is 'Nar koordinatene sist ble slaatt opp mot Geonorge. NULL = ikke forsokt.';
