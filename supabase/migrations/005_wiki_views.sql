-- ============================================================
-- 005_wiki_views.sql — Flere visninger (tabell + tavle) for database-sider
-- ============================================================

ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS table_views JSONB NOT NULL
  DEFAULT '[{"id":"table","name":"Tabell","type":"table"}]'::jsonb;

-- Bug Tracker: legg til tavlevisning gruppert på Status
UPDATE wiki_pages SET table_views = '[
  {"id":"table","name":"Tabell","type":"table"},
  {"id":"board","name":"Tavle","type":"board","group_by":"status"}
]'::jsonb
WHERE id = '21000000-0000-0000-0000-000000000002';

-- Campaign Calendar: legg til tavlevisning gruppert på Status
UPDATE wiki_pages SET table_views = '[
  {"id":"table","name":"Tabell","type":"table"},
  {"id":"board","name":"Tavle","type":"board","group_by":"status"}
]'::jsonb
WHERE id = '41000000-0000-0000-0000-000000000001';

-- Invoicing: legg til tavlevisning gruppert på Status
UPDATE wiki_pages SET table_views = '[
  {"id":"table","name":"Tabell","type":"table"},
  {"id":"board","name":"Tavle","type":"board","group_by":"status"}
]'::jsonb
WHERE id = '51000000-0000-0000-0000-000000000002';
