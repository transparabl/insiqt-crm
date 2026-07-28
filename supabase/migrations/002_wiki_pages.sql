-- ============================================================
-- 002_wiki_pages.sql — Intern wiki (Notion-lignende nested sider)
-- ============================================================

CREATE TABLE IF NOT EXISTS wiki_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id         UUID REFERENCES wiki_pages(id) ON DELETE CASCADE,
  teamspace         TEXT NOT NULL,
  -- 'company' | 'software' | 'sales' | 'marketing' | 'finance_legal' | 'client_success'
  title             TEXT NOT NULL,
  icon              TEXT,
  content           TEXT NOT NULL DEFAULT '',
  is_teamspace_root BOOLEAN NOT NULL DEFAULT false,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_parent ON wiki_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_teamspace ON wiki_pages(teamspace);

-- Reuse the generic updated_at trigger function already defined for crm_leads.
DROP TRIGGER IF EXISTS trg_wiki_pages_updated_at ON wiki_pages;
CREATE TRIGGER trg_wiki_pages_updated_at
  BEFORE UPDATE ON wiki_pages
  FOR EACH ROW EXECUTE FUNCTION crm_leads_set_updated_at();

ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON wiki_pages
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Seed: teamspace roots ─────────────────────────────────────
INSERT INTO wiki_pages (id, parent_id, teamspace, title, icon, is_teamspace_root, position, content) VALUES
('10000000-0000-0000-0000-000000000000', NULL, 'company',         'Company',         '🏠', true, 1, ''),
('20000000-0000-0000-0000-000000000000', NULL, 'software',        'Software',        '💻', true, 2, ''),
('30000000-0000-0000-0000-000000000000', NULL, 'sales',           'Sales',           '💰', true, 3, ''),
('40000000-0000-0000-0000-000000000000', NULL, 'marketing',       'Marketing',       '📣', true, 4, ''),
('50000000-0000-0000-0000-000000000000', NULL, 'finance_legal',   'Finance & Legal', '🧾', true, 5, ''),
('60000000-0000-0000-0000-000000000000', NULL, 'client_success',  'Client Success',  '🤝', true, 6, '');

-- ─── Seed: Company children ─────────────────────────────────────
INSERT INTO wiki_pages (id, parent_id, teamspace, title, icon, position) VALUES
('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000000', 'company', 'Tasks',                     '📝', 1),
('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000000', 'company', 'Subscription Tracker',      '📋', 2),
('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000000', 'company', 'Board Meeting',             '💼', 3),
('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000000', 'company', 'Financial Reports',        '📊', 4),
('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000000', 'company', 'Problem, Proposal & Plan', '🎯', 5),
('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000000', 'company', 'Business Concept',         '🏢', 6),
('11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000000', 'company', 'Team',                     '👥', 7),
('11000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000000', 'company', 'People Directory',         '🪪', 8),
('11000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000000', 'company', 'Case Studies',             '📖', 9),
('11000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000000', 'company', 'Whitepapers',              '📰', 10),
('11000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000000', 'company', 'Docs',                     '📄', 11);

-- ─── Seed: Software children ─────────────────────────────────────
INSERT INTO wiki_pages (id, parent_id, teamspace, title, icon, position) VALUES
('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000000', 'software', 'Updates / New Features',        '🔔', 1),
('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000000', 'software', 'Bug Tracker',                   '🐛', 2),
('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000000', 'software', 'Codebase Documentation',        '🗂️', 3),
('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000000', 'software', 'API Documentation',             '🧩', 4),
('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000000', 'software', 'Backend Documentation',         '🖥️', 5),
('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000000', 'software', 'FrontEnd Documentation',        '🖥️', 6),
('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000000', 'software', 'Source Code Sections',          '📄', 7),
('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000000', 'software', 'Product and User Documentation','📦', 8);

-- ─── Seed: Sales children (proposed starter structure) ──────────
INSERT INTO wiki_pages (id, parent_id, teamspace, title, icon, position) VALUES
('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000000', 'sales', 'Sales Targets',        '🎯', 1),
('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000000', 'sales', 'Forecasting',          '📈', 2),
('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000000', 'sales', 'Outbound Playbook',    '📘', 3),
('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000000', 'sales', 'Demo Script',          '🎬', 4),
('31000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000000', 'sales', 'Objection Handling',   '🛡️', 5),
('31000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000000', 'sales', 'Pricing Sheet',        '💵', 6),
('31000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000000', 'sales', 'Contract Templates',   '📑', 7),
('31000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000000', 'sales', 'Competitor Overview',  '🔍', 8),
('31000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000000', 'sales', 'ICP & Segments',       '🧭', 9);

-- ─── Seed: Marketing children (proposed starter structure) ──────
INSERT INTO wiki_pages (id, parent_id, teamspace, title, icon, position) VALUES
('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000000', 'marketing', 'Campaign Calendar',  '🗓️', 1),
('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000000', 'marketing', 'Active Campaigns',   '📢', 2),
('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000000', 'marketing', 'Brand Guidelines',   '🎨', 3),
('41000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000000', 'marketing', 'Logo & Assets',      '🖼️', 4),
('41000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000000', 'marketing', 'Website Copy',       '✍️', 5),
('41000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000000', 'marketing', 'Blog Ideas',         '💡', 6),
('41000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000000', 'marketing', 'Case Studies',       '📖', 7),
('41000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000000', 'marketing', 'Social Media',       '📱', 8),
('41000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000000', 'marketing', 'Email Marketing',    '📧', 9),
('41000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000000', 'marketing', 'SEO',                '🔎', 10);

-- ─── Seed: Finance & Legal children (proposed starter structure) ─
INSERT INTO wiki_pages (id, parent_id, teamspace, title, icon, position) VALUES
('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'Budget',                     '💰', 1),
('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'Invoicing',                  '🧾', 2),
('51000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'Expense Tracking',           '💳', 3),
('51000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'Contracts & Agreements',     '📜', 4),
('51000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'Company Registration Docs',  '🏛️', 5),
('51000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'GDPR / Personvern',          '🔒', 6),
('51000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'Insurance',                  '🛡️', 7),
('51000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000000', 'finance_legal', 'Board Resolutions',          '⚖️', 8);

-- ─── Seed: Client Success children (proposed starter structure) ─
INSERT INTO wiki_pages (id, parent_id, teamspace, title, icon, position) VALUES
('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000000', 'client_success', 'Onboarding Checklist',      '✅', 1),
('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000000', 'client_success', 'Welcome Email Templates',   '💌', 2),
('61000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000000', 'client_success', 'Support FAQ',               '❓', 3),
('61000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000000', 'client_success', 'Common Issues',             '🧯', 4),
('61000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000000', 'client_success', 'Renewal Process',           '🔁', 5),
('61000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000000', 'client_success', 'Churn Tracking',            '📉', 6),
('61000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000000', 'client_success', 'NPS / Feedback',            '⭐', 7);

-- ─── Root page content: headed sections linking to children ─────
-- Internal links use the scheme [Title](page:<uuid>) — intercepted
-- client-side to navigate within the wiki instead of a real page load.

UPDATE wiki_pages SET content = '## Active
- 📝 [Tasks](page:11000000-0000-0000-0000-000000000001)
- 📋 [Subscription Tracker](page:11000000-0000-0000-0000-000000000002)

## Shareholder Communications
- 💼 [Board Meeting](page:11000000-0000-0000-0000-000000000003)
- 📊 [Financial Reports](page:11000000-0000-0000-0000-000000000004)

## Company Overview
- 🎯 [Problem, Proposal & Plan](page:11000000-0000-0000-0000-000000000005)
- 🏢 [Business Concept](page:11000000-0000-0000-0000-000000000006)
- 👥 [Team](page:11000000-0000-0000-0000-000000000007)
- 🪪 [People Directory](page:11000000-0000-0000-0000-000000000008)

## Resources
- 📖 [Case Studies](page:11000000-0000-0000-0000-000000000009)
- 📰 [Whitepapers](page:11000000-0000-0000-0000-00000000000a)
- 📄 [Docs](page:11000000-0000-0000-0000-00000000000b)'
WHERE id = '10000000-0000-0000-0000-000000000000';

UPDATE wiki_pages SET content = '## Development & Updates
- 🔔 [Updates / New Features](page:21000000-0000-0000-0000-000000000001)
- 🐛 [Bug Tracker](page:21000000-0000-0000-0000-000000000002)

## Code & API
- 🗂️ [Codebase Documentation](page:21000000-0000-0000-0000-000000000003)
- 🧩 [API Documentation](page:21000000-0000-0000-0000-000000000004)
- 🖥️ [Backend Documentation](page:21000000-0000-0000-0000-000000000005)
- 🖥️ [FrontEnd Documentation](page:21000000-0000-0000-0000-000000000006)

## Source
- 📄 [Source Code Sections](page:21000000-0000-0000-0000-000000000007)

## User Guide
- 📦 [Product and User Documentation](page:21000000-0000-0000-0000-000000000008)'
WHERE id = '20000000-0000-0000-0000-000000000000';

UPDATE wiki_pages SET content = '## Pipeline & Targets
- 🎯 [Sales Targets](page:31000000-0000-0000-0000-000000000001)
- 📈 [Forecasting](page:31000000-0000-0000-0000-000000000002)

## Playbooks
- 📘 [Outbound Playbook](page:31000000-0000-0000-0000-000000000003)
- 🎬 [Demo Script](page:31000000-0000-0000-0000-000000000004)
- 🛡️ [Objection Handling](page:31000000-0000-0000-0000-000000000005)

## Contracts & Pricing
- 💵 [Pricing Sheet](page:31000000-0000-0000-0000-000000000006)
- 📑 [Contract Templates](page:31000000-0000-0000-0000-000000000007)

## Customer Intel
- 🔍 [Competitor Overview](page:31000000-0000-0000-0000-000000000008)
- 🧭 [ICP & Segments](page:31000000-0000-0000-0000-000000000009)'
WHERE id = '30000000-0000-0000-0000-000000000000';

UPDATE wiki_pages SET content = '## Campaigns
- 🗓️ [Campaign Calendar](page:41000000-0000-0000-0000-000000000001)
- 📢 [Active Campaigns](page:41000000-0000-0000-0000-000000000002)

## Brand
- 🎨 [Brand Guidelines](page:41000000-0000-0000-0000-000000000003)
- 🖼️ [Logo & Assets](page:41000000-0000-0000-0000-000000000004)

## Content
- ✍️ [Website Copy](page:41000000-0000-0000-0000-000000000005)
- 💡 [Blog Ideas](page:41000000-0000-0000-0000-000000000006)
- 📖 [Case Studies](page:41000000-0000-0000-0000-000000000007)

## Channels
- 📱 [Social Media](page:41000000-0000-0000-0000-000000000008)
- 📧 [Email Marketing](page:41000000-0000-0000-0000-000000000009)
- 🔎 [SEO](page:41000000-0000-0000-0000-00000000000a)'
WHERE id = '40000000-0000-0000-0000-000000000000';

UPDATE wiki_pages SET content = '## Finance
- 💰 [Budget](page:51000000-0000-0000-0000-000000000001)
- 🧾 [Invoicing](page:51000000-0000-0000-0000-000000000002)
- 💳 [Expense Tracking](page:51000000-0000-0000-0000-000000000003)

## Legal
- 📜 [Contracts & Agreements](page:51000000-0000-0000-0000-000000000004)
- 🏛️ [Company Registration Docs](page:51000000-0000-0000-0000-000000000005)
- 🔒 [GDPR / Personvern](page:51000000-0000-0000-0000-000000000006)

## Compliance
- 🛡️ [Insurance](page:51000000-0000-0000-0000-000000000007)
- ⚖️ [Board Resolutions](page:51000000-0000-0000-0000-000000000008)'
WHERE id = '50000000-0000-0000-0000-000000000000';

UPDATE wiki_pages SET content = '## Onboarding
- ✅ [Onboarding Checklist](page:61000000-0000-0000-0000-000000000001)
- 💌 [Welcome Email Templates](page:61000000-0000-0000-0000-000000000002)

## Support
- ❓ [Support FAQ](page:61000000-0000-0000-0000-000000000003)
- 🧯 [Common Issues](page:61000000-0000-0000-0000-000000000004)

## Retention
- 🔁 [Renewal Process](page:61000000-0000-0000-0000-000000000005)
- 📉 [Churn Tracking](page:61000000-0000-0000-0000-000000000006)
- ⭐ [NPS / Feedback](page:61000000-0000-0000-0000-000000000007)'
WHERE id = '60000000-0000-0000-0000-000000000000';
