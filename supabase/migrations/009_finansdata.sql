-- ============================================================
-- 009_finansdata.sql — Regnskaps- og selskapsdata fra Brønnøysund-uttrekk
-- Samme kildekolonner som brukes til salgsverktøyets prospektliste.
-- financials er strukturert likt Company.fin i sales-app: {"2025": {...}}.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS selskapsform TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bransjekode TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bransje TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postadresse TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS styreleder TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS eier TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS etablert TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ansatte INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS revisor TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS regnskapsforer TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lonnsomhet NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS likviditet NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS soliditet NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mva TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS financials JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS selskapsform TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS bransjekode TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS bransje TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS postadresse TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS styreleder TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS eier TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS etablert TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS ansatte INTEGER;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS revisor TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS regnskapsforer TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS lonnsomhet NUMERIC;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS likviditet NUMERIC;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS soliditet NUMERIC;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS mva TEXT;
ALTER TABLE ringeliste ADD COLUMN IF NOT EXISTS financials JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN companies.financials  is 'Regnskapstall per aar fra CSV-import: {"2025": {driftsinntekter, driftsresultat, lonn, varekostnad, ...}}. Samme struktur som Company.fin i salgsverktoyet.';
COMMENT ON COLUMN ringeliste.financials is 'Regnskapstall per aar fra CSV-import, samme struktur som companies.financials. Kopieres over ved konvertering til lead.';
COMMENT ON COLUMN companies.ansatte is 'Antall ansatte fra Brønnøysund. Ikke det samme som vehicle_count (kjøretøy).';
