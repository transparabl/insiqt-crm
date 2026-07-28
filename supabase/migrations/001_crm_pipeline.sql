-- ============================================================
-- 001_crm_pipeline.sql — Intern salgs-CRM (John & Ove)
-- ============================================================

-- ─── Leads/kunder i salgspipeline ─────────────────────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      TEXT NOT NULL,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  vehicle_count     INTEGER,
  status            TEXT NOT NULL DEFAULT 'ny',
  -- 'ny' | 'kontaktet' | 'demo_booket' | 'tilbud_sendt' | 'kunde' | 'tapt'
  source            TEXT,
  -- 'kald_kontakt' | 'linkedin' | 'demo_forespørsel' | 'referanse' | 'annet'
  next_followup_date DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_followup ON crm_leads(next_followup_date);

-- Auto-oppdater updated_at
CREATE OR REPLACE FUNCTION crm_leads_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at
  BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION crm_leads_set_updated_at();

-- ─── Aktivitetslogg ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  -- 'call' | 'email' | 'meeting' | 'demo' | 'note' | 'status_change'
  note          TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created ON crm_activities(created_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────
-- Kun 2 Supabase Auth-brukere finnes for dette prosjektet (John & Ove).
-- Enhver innlogget bruker har full tilgang.
ALTER TABLE crm_leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON crm_leads
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_full_access" ON crm_activities
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
