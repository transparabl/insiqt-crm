# Insiqt CRM

Kontrollsenteret for salgsprosessen før og etter salgsmøtet. Ren HTML/CSS/JS uten
byggesteg, Supabase som backend. Tett integrert med salgsverktøyet
([insiqt-salg](https://insiqt-salg.vercel.app)) via felles database — men de er to
separate flater.

**Live:** https://insiqt-crm.vercel.app
**Database:** Supabase `insiqt-crm` (njqrcrdhdpualulqdkoe, eu-north-1) — samme
prosjekt som salgsverktøyets tilbud og edge-funksjoner.

## Moduler

| Modul | Innhold |
|---|---|
| Dashboard | Månedstall, konvertering, per kilde, «Krever oppfølging» |
| Pipeline | Kanban: Lead → Kontaktet → Demo avtalt → Demo gjennomført → Tilbud sendt → Oppfølging |
| Salg | Vunne salg (WON) med MRR, klare for onboarding |
| Onboarding | Stegviser Ove oppdaterer: ny → kontaktet → møte avtalt → oppsett → opplæring → ferdig |
| Kunder | Aktive kunder + søk i alle selskaper |
| Ringeliste | CSV-/xlsx-import av prospektlister + ringemodus med stort kort (tel:/e-post/Proff/nettside) |
| Kart ↗ | Egen fullskjermside (`kart.html`, åpnes i ny fane): satellittkart med filterrail til høyre |
| Kundekort | Alt om én kunde: status, kontakt, deal, e-postaktivitet, tidslinje, knappene |

Venstremenyen har også lenke til salgsverktøyet, og salgsverktøyet har en
CRM-lenke i toppmenyen tilbake hit. Wikien (Teamspaces) ble koblet ut av menyen
08/2026 — `js/wiki.js`, `js/blocks.js` og dataene i `wiki_pages` ligger urørt,
så den kan kobles inn igjen ved behov.

## Slik henger det sammen

Én kunde = én rad i `companies`, med hele livssyklusen i `status`:

```
lead → kontaktet → demo_avtalt → demo_gjennomfort → tilbud_sendt
     → oppfolging → won → onboarding → aktiv_kunde     (+ lost)
```

**Automatisk inn i CRM-et (ingen manuell registrering):**
- Tilbud sendes i salgsverktøyet → selskapet opprettes/oppdateres, status
  `tilbud_sendt`, tilbudet kobles (`offers.company_id`), aktivitet logges
- Kunden åpner/aksepterer tilbudet → aktiviteter + status `oppfolging` med
  neste aktivitet «Marker som salg». **Aldri automatisk WON** — det er en knapp
- Demo bookes via Cal.com → varm lead med status `demo_avtalt` (`lead-inbox`)
- Resend-webhooks → levert/åpnet/klikket i `email_events`, vises på kundekortet

**Manuelle knapper:** «Marker som salg» (setter WON + MRR fra tilbudet) og
«Send til onboarding» (flytter kunden og e-poster Ove salgsinformasjonen via
edge-funksjonen `send-onboarding`).

Dyplenke: `/?kunde=<company_id>` åpner kundekortet direkte (brukes i Ove-mailen).

## Datamodell

- `companies` — én kunde, én ID (erstattet `crm_leads` i migrasjon 006)
- `ringeliste` — kald prospektliste fra CSV (migrasjon 007); «Interessert» konverterer
  raden til et selskap med varm lead, kilde cold_call. Duplikater på orgnr mot både
  ringelisten og companies hoppes over ved import
- `address` / `lat` / `lng` / `geokodet_at` på både `companies` og `ringeliste`
  (migrasjon 008) — grunnlaget for kartet
- `financials JSONB` + selskapsform, bransje, styreleder, eier, etablert, ansatte,
  revisor, regnskapsfører, lønnsomhet, likviditet, soliditet, mva (migrasjon 009,
  på begge tabeller). `financials` er strukturert `{"2025": {driftsinntekter,
  driftsresultat, lonn, varekostnad, ...}}` — samme form som `Company.fin` i
  salgsverktøyet. Fylles fra CSV-/xlsx-import i Ringeliste og kopieres over til
  `companies` når raden konverteres til lead

### Import: .csv og .xlsx, norske og engelske kolonnenavn

Ringeliste-importen (`js/ringeliste.js`) gjenkjenner kolonner uansett om filen er
`.csv` (lest selv) eller `.xlsx` (lest med SheetJS, lastet via CDN i `index.html`).
`.xlsx`-filer med flere ark velger automatisk et ark kalt «Data» hvis det finnes,
ellers arket med flest utfylte kolonner — aldri bare første ark, siden mange
eksporter har et tomt «Sammendrag»-ark først.

Kolonnegjenkjenningen dekker både norske eksporter (`Juridisk navn`,
`Organisasjonsnummer`, `Daglig leder` …) og engelske Brønnøysund-uttrekk
(`JuridicalName`, `OrganizationNumber`, `Manager`, `Municipality` …) om hverandre.

Regnskapstall kan komme i to former, begge normaliseres til **hele kroner**:
- årstall-suffiksede kolonner (`Sum Driftsinntekter 2025`) — allerede i hele kroner
- én samlet `Accounting`-kolonne med et array av årsobjekter
  (`[{AccountingYear:2025,SumRunningReceipts:...}]`) — oppgitt i **hele tusen
  kroner** per Regnskapsregisterets konvensjon, og ganges derfor med 1000 før
  lagring. Bekreftet ved å sammenligne samme selskap i begge filformater — uten
  denne skaleringen ville tall fra `Accounting`-kolonnen vist 1000× for lavt.

Har filen `Latitude`/`Longitude`-kolonner brukes koordinatene direkte og raden
merkes som geokodet — kartmodulens geokoding (`kart.html`) henter kun rader med
`lat IS NULL`, så disse radene slipper et unødvendig Geonorge-oppslag.

## Dyplenke til salgsverktøyet

`js/tilsalg.js` bygger lenken som brukes fra kundekort, ringekort og kartpopup.
Bedriftsinfo og siste tilgjengelige regnskapsår kodes som base64 i URL-**fragmentet**
(`insiqt-salg.vercel.app/#kunde=…`) — aldri i søkestrengen. Fragmenter sendes aldri
til noen server, så dataene forlater ikke nettleseren før salgsverktøyet selv leser
og fjerner det. Salgsverktøyets `middleware.js` bevarer fragmentet gjennom en
eventuell innloggingsredirect (nettleseren propagerer det automatisk til `/login`,
og innloggingssiden sender det videre til `/` ved suksess).

Skjemaer fylles ikke ut hvis feltet mangler i kilden — ingen tall fabrikkeres.

## Kart

`kart.html` er en egen fullskjermside som åpnes i ny fane fra menyen. MapLibre GL
med satellittbilder fra Esri og veilag oppå; ingen API-nøkkel kreves.

- **Filterrail til høyre.** De øverste er kategorier og kombineres med ELLER
  («vis meg disse typene»). De to nederste (⚠️ krever oppfølging, ☎️ har telefon)
  er avgrensninger som må oppfylles i tillegg, og er av som standard
- **Markører** klynges automatisk når de ligger tett; trykk for å zoome inn
- **Popup** gir Ring, Proff, Kundekort og Veibeskrivelse i Google Maps
- **Koordinater** hentes fra Kartverkets adresseregister (Geonorge — gratis, ingen
  nøkkel) med knappen «📍 Koordinater». Selskaper uten adresse faller tilbake på
  poststed/kommune. Kun rader med `lat` vises i kartet

For å få mange selskaper inn i kartet: importer en CSV/xlsx med adressekolonne
(`Besøksadresse`, `Adresse`, `Forretningsadresse` …) i Ringeliste, og kjør
«📍 Koordinater». Har filen ferdige `Latitude`/`Longitude`-kolonner brukes de
direkte — ingen Geonorge-oppslag nødvendig for de radene.
- `contacts` — kontaktpersoner per selskap
- `company_activities` — tidslinjen på kundekortet
- `email_events` — Resend-webhookhendelser
- `offers` / `offer_events` — eies av salgsverktøyet, kobles hit via `company_id`
- `wiki_pages` — den utkoblede wikien (data beholdt)

Edge-funksjonene (`send-offer`, `accept-offer`, `send-onboarding`,
`resend-webhook`, `lead-inbox`) ligger i salgsverktøy-repoet
(`Insiqt AI Operating/insiqt-salg/supabase/functions/`).

## Oppsett

1. Migrasjonene i `supabase/migrations/` er kjørt t.o.m. `006_companies.sql`
2. URL og publiserbar nøkkel står i `js/config.js`
3. Auth-brukere for John og Ove opprettes i Supabase-dashbordet
   (Authentication → Users). RLS gir alle innloggede full tilgang
4. `npx serve .` lokalt, eller åpne produksjons-URL-en

## Deploy (Vercel)

```bash
vercel deploy --prod
```

Rot i denne mappen, ingen build. Prosjekt `transparabls-projects/insiqt-crm`.

## Gjenstår å koble (gjøres i eksterne dashbord)

- **Resend-webhook:** Resend → Webhooks → legg til
  `https://njqrcrdhdpualulqdkoe.supabase.co/functions/v1/resend-webhook`
  for sent/delivered/opened/clicked/bounced, og sett signing-secreten som
  Supabase-secret `RESEND_WEBHOOK_SECRET`. Frem til da avviser funksjonen alt (401),
  og kundekortet viser bare hendelsene fra tilbudsstatusen
- **Cal.com-webhook:** Cal.com → Developer → Webhooks → legg til
  `https://njqrcrdhdpualulqdkoe.supabase.co/functions/v1/lead-inbox`
  på BOOKING_CREATED. Sett gjerne en secret og lagre den som Supabase-secret
  `CAL_WEBHOOK_SECRET` (valgfritt, men anbefalt)
