# Insiqt CRM

Intern salgs-CRM for John og Ove (Insiqt.AI AS). Fristående prosjekt — ren HTML/CSS/JS, ingen build-steg, Supabase som backend. Ikke koblet til `insiqt-ai-website`-repoet.

## Oppsett

1. Supabase-prosjekt **insiqt-crm** er allerede opprettet (eu-north-1), og migrasjonen i `supabase/migrations/001_crm_pipeline.sql` er kjørt.
2. URL og anon-nøkkel er fylt inn i `js/config.js`.
3. **Opprett to Auth-brukere** for John og Ove i Supabase-dashbordet (Authentication → Users → Add user), med e-post + selvvalgt passord. Ikke flere brukere skal opprettes — RLS gir alle innloggede full tilgang.
4. Åpne `index.html` (kan serveres statisk, f.eks. `npx serve .`) og logg inn.

## Deploy (Cloudflare Pages)

- Nytt Cloudflare Pages-prosjekt, koblet til dette repoet
- Build output directory: `/` (rot)
- Ingen build-kommando nødvendig (statiske filer)
- Legg til ønsket custom domain (f.eks. `crm.insiqt.ai`)

## Datamodell

- `crm_leads` — én rad per firma/lead i pipelinen
- `crm_activities` — aktivitetslogg knyttet til en lead (samtaler, e-poster, statusendringer osv.)

## Funksjonalitet

- Kanban-pipeline med dra-og-slipp mellom 6 stadier: Ny lead → Kontaktet → Demo booket → Tilbud sendt → Kunde → Tapt
- Lead-kort med firma, kontaktperson, antall kjøretøy, kilde, neste oppfølgingsdato
- Aktivitetslogg med tidsstempel per lead, auto-logging ved statusendring
- Dashboard: antall per steg, demoer booket denne måneden, antall kunder
- Hurtiglenker til cal.com-booking og e-post
