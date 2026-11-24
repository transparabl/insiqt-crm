-- Drift og økonomi i kontrollsenteret: frister, kostnader, tilganger, avvikslogg og kundebehov.
create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'annet' check (category in ('selskap','skatt','nokkel','avtale','fornyelse','annet')),
  due_date date,
  recurrence text not null default 'ingen' check (recurrence in ('ingen','manedlig','annenhver','arlig')),
  owner text, link text, notes text,
  done_at timestamptz, last_done_at timestamptz,
  updated_by text, updated_at timestamptz default now(), created_at timestamptz default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  service text not null, purpose text,
  amount numeric, currency text not null default 'NOK',
  period text not null default 'maned' check (period in ('maned','ar','forbruk','engang')),
  paid_by text, renews_on date, account text, notes text, active boolean not null default true, sort int default 100,
  updated_by text, updated_at timestamptz default now(), created_at timestamptz default now()
);
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  system text not null, url text, purpose text,
  registered_to text, admins text, payment text, renews_on date,
  two_admins boolean not null default false, in_password_manager boolean not null default false,
  last_reviewed date, notes text, sort int default 100,
  updated_by text, updated_at timestamptz default now(), created_at timestamptz default now()
);
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  discovered_at timestamptz not null default now(),
  title text not null, description text,
  role text not null default 'vurderes' check (role in ('behandlingsansvarlig','databehandler','vurderes')),
  data_types text, affected_count integer, customers text,
  risk text not null default 'vurderes' check (risk in ('lav','middels','hoy','vurderes')),
  notify_required text not null default 'vurderes' check (notify_required in ('ja','nei','vurderes')),
  notify_reason text,
  notified_at timestamptz, notified_ref text,
  customers_informed_at timestamptz, persons_informed_at timestamptz,
  measures text, status text not null default 'apen' check (status in ('apen','lukket')),
  reported_by text, updated_by text, updated_at timestamptz default now(), created_at timestamptz default now()
);
create table if not exists public.company_needs (
  id uuid primary key default gen_random_uuid(),
  company_name text not null, company_id uuid references public.companies(id) on delete set null,
  need text not null,
  category text not null default 'funksjon' check (category in ('integrasjon','modul','funksjon','rapport','annet')),
  priority text not null default 'bor' check (priority in ('ma','bor','kjekt')),
  coverage text not null default 'mangler' check (coverage in ('dekket','delvis','mangler')),
  source text, notes text,
  updated_by text, updated_at timestamptz default now(), created_at timestamptz default now()
);

do $$ declare t text; begin
  foreach t in array array['deadlines','subscriptions','accounts','incidents','company_needs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('drop policy if exists "%s insert" on public.%I', t, t);
    execute format('drop policy if exists "%s update" on public.%I', t, t);
    execute format('drop policy if exists "%s delete" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s insert" on public.%I for insert to authenticated with check (true)', t, t);
    execute format('create policy "%s update" on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('create policy "%s delete" on public.%I for delete to authenticated using (true)', t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Frister. Bare datoer som følger av lov eller som vi vet. Sjekk alltid Altinn.
insert into public.deadlines (title, category, due_date, recurrence, owner, link, notes) values
 ('Claude API-nøkkelen utløper', 'nokkel', '2026-12-24', 'ingen', 'John', 'https://console.anthropic.com/settings/keys', 'Lag ny nøkkel og lim inn under Integrasjoner. Kontrollsenterets nettsideendringer stopper når den utløper.'),
 ('GitHub-tokenet utløper', 'nokkel', '2027-02-22', 'ingen', 'John', 'https://github.com/settings/personal-access-tokens', 'Lag nytt token med Contents = Read and write og lim inn under Integrasjoner.'),
 ('Mva-melding', 'skatt', '2026-12-10', 'annenhver', 'John', 'https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/', 'Gjelder bare hvis selskapet er mva-registrert. Fristen er den 10. i andre måned etter terminen. Slett raden hvis dere ikke er registrert.'),
 ('A-melding', 'skatt', '2026-12-05', 'manedlig', 'John', 'https://www.skatteetaten.no/bedrift-og-organisasjon/arbeidsgiver/a-meldingen/', 'Gjelder bare måneder selskapet utbetaler lønn eller honorar. Fristen er den 5. hver måned.'),
 ('Aksjonærregisteroppgaven', 'skatt', '2027-01-31', 'arlig', 'John', 'https://www.skatteetaten.no/bedrift-og-organisasjon/rapportering-og-bransjer/aksjonarregisteroppgaven/', 'Sendes for alle AS hvert år.'),
 ('Skattemelding for AS', 'skatt', '2027-05-31', 'arlig', 'John', 'https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/skattemelding-for-aksjeselskaper/', NULL),
 ('Ordinær generalforsamling', 'selskap', '2027-06-30', 'arlig', 'Ove', NULL, 'Senest seks måneder etter regnskapsårets slutt. Godkjenner årsregnskapet.'),
 ('Årsregnskap til Regnskapsregisteret', 'selskap', '2027-07-31', 'arlig', 'John', 'https://www.brreg.no/bedrift/arsregnskap/', 'Senest en måned etter generalforsamlingen, og innen 31. juli.'),
 ('Fornyelse av domenet insiqt.ai', 'fornyelse', NULL, 'arlig', 'John', NULL, 'Fyll inn dato og registrar. Utløper domenet, slutter nettside og e-post å virke.');

-- Kostnader. Beløp står tomt til de er fylt inn – ingen gjetning.
insert into public.subscriptions (service, purpose, period, paid_by, account, notes, sort) values
 ('Microsoft Azure', 'Produksjon av Insiqt-plattformen (Norway East) og Azure SQL', 'forbruk', NULL, NULL, 'Fyll inn betaler og omtrentlig månedsbeløp.', 10),
 ('Google Workspace', 'E-post, Drive og kalender for insiqt.ai', 'maned', NULL, 'insiqt.ai', NULL, 20),
 ('Notion', 'Dokumentasjon, oppgaver og bugs', 'maned', NULL, 'Insiqt.AI AS', NULL, 30),
 ('Claude API', 'Nettsideendringer fra kontrollsenteret', 'forbruk', 'Transparabl Ltd (nærstående)', 'contact@transparabl.com', 'Faktureres Transparabl. Bør flyttes til Insiqt.AI AS eller viderefaktureres.', 40),
 ('Supabase', 'CRM- og kontrollsenterdatabasen', 'maned', NULL, 'insiqt-crm', NULL, 50),
 ('Vercel', 'Hosting av CRM, salgsverktøy og presentasjon', 'maned', NULL, 'transparabls-projects', NULL, 60),
 ('GitHub', 'Kode', 'maned', NULL, 'transparabl', NULL, 70),
 ('Cloudflare', 'Nettsiden insiqt.ai (Pages)', 'maned', NULL, NULL, NULL, 80),
 ('Apple Developer Program', 'Publisering av iOS-appen', 'ar', NULL, NULL, NULL, 90),
 ('Google Play Console', 'Publisering av Android-appen', 'engang', NULL, NULL, 'Engangsavgift ved registrering.', 95);

-- Tilganger. Bare det vi vet; resten står tomt.
insert into public.accounts (system, url, purpose, registered_to, payment, notes, sort) values
 ('Microsoft Azure', 'https://portal.azure.com', 'Produksjon av plattformen', NULL, NULL, 'Fyll inn hvem som eier abonnementet, og hvem i India-teamet som har produksjonstilgang (trengs til TIA).', 10),
 ('Apple Developer', 'https://developer.apple.com/account', 'iOS-appen', NULL, NULL, 'Account Holder bør være Insiqt.AI AS (krever D-U-N-S-nummer).', 20),
 ('Google Play Console', 'https://play.google.com/console', 'Android-appen', NULL, NULL, 'Kontoen bør være registrert som organisasjon på Insiqt.AI AS.', 30),
 ('Domeneregistrar for insiqt.ai', NULL, 'Domenet', NULL, NULL, 'Fyll inn hvor domenet er registrert og på hvem.', 40),
 ('Google Workspace', 'https://admin.google.com', 'E-post, Drive, kalender', 'Insiqt.AI AS (insiqt.ai)', NULL, NULL, 50),
 ('Notion', 'https://app.notion.com', 'Dokumentasjon', 'Arbeidsområdet Insiqt.AI AS', NULL, NULL, 60),
 ('GitHub', 'https://github.com/transparabl', 'Kode for nettside, plattform og CRM', 'Personlig bruker «transparabl» – ikke Insiqt.AI AS', NULL, 'Bør flyttes til en GitHub-organisasjon eid av Insiqt.AI AS. Avklar rettigheter med advokat.', 70),
 ('Vercel', 'https://vercel.com/transparabls-projects', 'CRM, salgsverktøy, presentasjon', 'Team «transparabls-projects»', NULL, NULL, 80),
 ('Supabase', 'https://supabase.com/dashboard/project/njqrcrdhdpualulqdkoe', 'CRM-databasen', NULL, NULL, 'Prosjektet insiqt-crm (eu-north-1). Fyll inn organisasjonseier.', 90),
 ('Cloudflare', 'https://dash.cloudflare.com', 'Nettsiden insiqt.ai', NULL, NULL, NULL, 100),
 ('Claude Console', 'https://console.anthropic.com', 'Claude API', 'contact@transparabl.com (Transparabl)', 'Transparabl Ltd', NULL, 110),
 ('Proton Pass', 'https://pass.proton.me', 'Passord og nøkler deles her', NULL, NULL, NULL, 120);
