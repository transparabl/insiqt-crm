-- ============================================================
-- 006_companies.sql — Én kunde, én ID, hele livssyklusen
-- Erstatter crm_leads/crm_activities (tomme, aldri brukt).
-- Rører IKKE offers-data, offer_events, wiki_pages.
-- ============================================================

-- ─── Companies: kunden gjennom hele løpet ─────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  org_no          TEXT UNIQUE,
  place           TEXT,
  industry        TEXT,
  vehicle_count   INTEGER,
  lead_temp       TEXT CHECK (lead_temp IN ('varm','kald')),
  lead_source     TEXT,
  -- 'website_demo' | 'manual' | 'field_visit' | 'cold_call' | 'referral'
  -- | 'salgsverktoy' | 'other'
  status          TEXT NOT NULL DEFAULT 'lead' CHECK (status IN
    ('lead','kontaktet','demo_avtalt','demo_gjennomfort','tilbud_sendt',
     'oppfolging','won','onboarding','aktiv_kunde','lost')),
  assigned_to     TEXT,
  next_activity   TEXT,
  next_activity_at TIMESTAMPTZ,
  onboarding_status TEXT CHECK (onboarding_status IN
    ('ny','kontaktet','mote_avtalt','oppsett','opplaering','ferdig')),
  onboarding_owner TEXT,
  mrr             NUMERIC,
  won_at          TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_status  ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_org_no  ON companies(org_no);
CREATE INDEX IF NOT EXISTS idx_companies_next    ON companies(next_activity_at);

CREATE OR REPLACE FUNCTION companies_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_set_updated_at();

-- ─── Contacts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT,
  role        TEXT,
  email       TEXT,
  phone       TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts(email);

-- ─── Aktiviteter: tidslinjen på kundekortet ───────────────────
CREATE TABLE IF NOT EXISTS company_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_id    UUID REFERENCES offers(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  -- 'lead_opprettet' | 'kontaktet' | 'demo_booket' | 'demo_gjennomfort'
  -- | 'tilbud_sendt' | 'tilbud_apnet' | 'akseptert' | 'avslatt'
  -- | 'markert_som_salg' | 'sendt_til_onboarding' | 'onboarding_status'
  -- | 'status_change' | 'call' | 'email' | 'meeting' | 'note'
  note        TEXT,
  actor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_activities_company
  ON company_activities(company_id, created_at DESC);

-- ─── E-posthendelser fra Resend-webhooks ──────────────────────
CREATE TABLE IF NOT EXISTS email_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        UUID REFERENCES offers(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  resend_email_id TEXT,
  event           TEXT NOT NULL,
  -- 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_offer  ON email_events(offer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_resend ON email_events(resend_email_id);

-- ─── Koble tilbud til kunden ──────────────────────────────────
ALTER TABLE offers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS resend_email_id TEXT;

CREATE INDEX IF NOT EXISTS idx_offers_company ON offers(company_id);

-- ─── RLS: samme mønster som resten av CRM-et ──────────────────
ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON companies
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_full_access" ON contacts
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_full_access" ON company_activities
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- email_events skrives kun av webhooks (service-rolle); CRM leser
CREATE POLICY "authenticated_read" ON email_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Rydd bort forgjengeren (begge tabellene er tomme) ────────
DROP TABLE IF EXISTS crm_activities;
DROP TABLE IF EXISTS crm_leads;

COMMENT ON TABLE companies is 'En kunde, en ID: lead til aktiv kunde. Kilden til pipeline, salg og onboarding.';
COMMENT ON TABLE company_activities is 'Tidslinjen paa kundekortet. Skrives av CRM og av edge-funksjonene.';
COMMENT ON TABLE email_events is 'Resend-webhookhendelser koblet til tilbud via resend_email_id.';
