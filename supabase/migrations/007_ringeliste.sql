-- ============================================================
-- 007_ringeliste.sql — Ringeliste for kald prospektering
-- Store CSV-lister lever her til noen viser interesse; da
-- konverteres raden til et selskap i companies (kald → varm).
-- ============================================================

CREATE TABLE IF NOT EXISTS ringeliste (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT NOT NULL,
  org_no        TEXT,
  contact_name  TEXT,          -- typisk daglig leder
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  place         TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'ny' CHECK (status IN
    ('ny','ingen_svar','ring_senere','ikke_interessert','konvertert')),
  forsok        INTEGER NOT NULL DEFAULT 0,
  sist_ringt_at TIMESTAMPTZ,
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  batch         TEXT,          -- filnavn ved import
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ringeliste_status ON ringeliste(status);
CREATE INDEX IF NOT EXISTS idx_ringeliste_org    ON ringeliste(org_no);

CREATE OR REPLACE FUNCTION ringeliste_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ringeliste_updated_at ON ringeliste;
CREATE TRIGGER trg_ringeliste_updated_at
  BEFORE UPDATE ON ringeliste
  FOR EACH ROW EXECUTE FUNCTION ringeliste_set_updated_at();

ALTER TABLE ringeliste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON ringeliste
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE ringeliste is 'Kald ringeliste fra CSV-import. Interesserte konverteres til companies.';
