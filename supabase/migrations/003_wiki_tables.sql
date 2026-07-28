-- ============================================================
-- 003_wiki_tables.sql — Strukturerte tabell-sider i wikien
-- ============================================================

ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS page_type TEXT NOT NULL DEFAULT 'doc';
-- 'doc' | 'table'
ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS table_columns JSONB;
ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS table_rows JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Subscription Tracker (company)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"service","label":"Tjeneste","type":"text"},
  {"key":"cost","label":"Kostnad kr/mnd","type":"number"},
  {"key":"cycle","label":"Syklus","type":"select","options":["Månedlig","Årlig"]},
  {"key":"next_payment","label":"Neste betaling","type":"date"},
  {"key":"category","label":"Kategori","type":"text"}
]'::jsonb
WHERE id = '11000000-0000-0000-0000-000000000002';

-- Budget (finance_legal)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"category","label":"Kategori","type":"text"},
  {"key":"budgeted","label":"Budsjettert","type":"number"},
  {"key":"actual","label":"Faktisk","type":"number"},
  {"key":"variance","label":"Avvik","type":"number"}
]'::jsonb
WHERE id = '51000000-0000-0000-0000-000000000001';

-- Invoicing (finance_legal)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"customer","label":"Kunde","type":"text"},
  {"key":"amount","label":"Beløp","type":"number"},
  {"key":"due_date","label":"Forfallsdato","type":"date"},
  {"key":"status","label":"Status","type":"select","options":["Sendt","Betalt","Forfalt"]}
]'::jsonb
WHERE id = '51000000-0000-0000-0000-000000000002';

-- Expense Tracking (finance_legal)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"date","label":"Dato","type":"date"},
  {"key":"description","label":"Beskrivelse","type":"text"},
  {"key":"category","label":"Kategori","type":"text"},
  {"key":"amount","label":"Beløp","type":"number"}
]'::jsonb
WHERE id = '51000000-0000-0000-0000-000000000003';

-- Sales Targets (sales)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"month","label":"Måned","type":"text"},
  {"key":"target","label":"Mål kr","type":"number"},
  {"key":"actual","label":"Faktisk kr","type":"number"},
  {"key":"pct","label":"% oppnådd","type":"number"}
]'::jsonb
WHERE id = '31000000-0000-0000-0000-000000000001';

-- Forecasting (sales)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"month","label":"Måned","type":"text"},
  {"key":"expected_revenue","label":"Forventet omsetning","type":"number"},
  {"key":"probability","label":"Sannsynlighet %","type":"number"},
  {"key":"notes","label":"Notater","type":"text"}
]'::jsonb
WHERE id = '31000000-0000-0000-0000-000000000002';

-- Campaign Calendar (marketing)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"campaign","label":"Kampanje","type":"text"},
  {"key":"channel","label":"Kanal","type":"text"},
  {"key":"start_date","label":"Start","type":"date"},
  {"key":"end_date","label":"Slutt","type":"date"},
  {"key":"status","label":"Status","type":"select","options":["Planlagt","Aktiv","Fullført"]}
]'::jsonb
WHERE id = '41000000-0000-0000-0000-000000000001';

-- Bug Tracker (software)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"title","label":"Tittel","type":"text"},
  {"key":"severity","label":"Alvorlighet","type":"select","options":["Lav","Middels","Høy","Kritisk"]},
  {"key":"status","label":"Status","type":"select","options":["Åpen","Under arbeid","Løst"]},
  {"key":"reported_by","label":"Rapportert av","type":"text"},
  {"key":"date","label":"Dato","type":"date"}
]'::jsonb
WHERE id = '21000000-0000-0000-0000-000000000002';

-- Updates / New Features (software)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"date","label":"Dato","type":"date"},
  {"key":"change","label":"Endring","type":"text"},
  {"key":"type","label":"Type","type":"select","options":["Ny funksjon","Fiks","Forbedring"]}
]'::jsonb
WHERE id = '21000000-0000-0000-0000-000000000001';

-- Churn Tracking (client_success)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"customer","label":"Kunde","type":"text"},
  {"key":"cancel_date","label":"Oppsigelsesdato","type":"date"},
  {"key":"reason","label":"Årsak","type":"text"},
  {"key":"arr_lost","label":"ARR tapt","type":"number"}
]'::jsonb
WHERE id = '61000000-0000-0000-0000-000000000006';

-- NPS / Feedback (client_success)
UPDATE wiki_pages SET page_type = 'table', table_columns = '[
  {"key":"date","label":"Dato","type":"date"},
  {"key":"customer","label":"Kunde","type":"text"},
  {"key":"score","label":"Score","type":"number"},
  {"key":"comment","label":"Kommentar","type":"text"}
]'::jsonb
WHERE id = '61000000-0000-0000-0000-000000000007';
