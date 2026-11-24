create table if not exists public.brand_assets (
  key text primary key, category text not null, name text not null, description text,
  status text not null default 'mangler' check (status in ('ferdig','utkast','avvik','mangler')),
  text text, link text, sort int default 100, updated_by text, updated_at timestamptz default now()
);
alter table public.brand_assets enable row level security;
drop policy if exists "brand read" on public.brand_assets; drop policy if exists "brand write" on public.brand_assets; drop policy if exists "brand insert" on public.brand_assets;
create policy "brand read" on public.brand_assets for select to authenticated using (true);
create policy "brand write" on public.brand_assets for update to authenticated using (true) with check (true);
create policy "brand insert" on public.brand_assets for insert to authenticated with check (true);
revoke all on public.brand_assets from anon; grant select, insert, update on public.brand_assets to authenticated;
insert into public.brand_assets (key,category,name,description,status,text,link,sort) values
('symbol','Logo','Symbol (app- og nettsideikon)','Den blå «i»-en på mørk bakgrunn. Brukes som favicon og app-ikon. Kilde: favicon.svg i nettsidekoden.','ferdig',null,'brand/insiqt-symbol.svg',0),
('ordmerke','Logo','Ordmerke «Insiqt.ai»','Skrevet i Inter 800 med -0,5 px bokstavavstand, «.ai» i aksentblått. Finnes i dag bare som tekst, ikke som logo-fil med kurver – så den ser feil ut der Inter ikke er installert.','utkast',null,null,10),
('logo-plattform','Logo','Logoen i plattformen','Plattformen bruker et annet symbol (prikker koblet sammen) og turkis «.ai», med slagordet «Where Data Becomes Insight». Nettsiden bruker den blå «i»-en. Velg ett symbol og bruk det overalt.','avvik',null,'https://ca-insiqt-web-prod.ashyisland-4121c7a0.norwayeast.azurecontainerapps.io/logg-inn',20),
('logo-pakke','Logo','Logopakke til andre','Ferdig zip med logo i SVG, PNG (transparent) og PDF, mørk og lys versjon, til partnere, presse og kunder som skal bruke logoen.','mangler',null,null,30),
('app-ikon','Logo','App-ikon 1024 × 1024','Kreves av App Store og Google Play. Uten avrundede hjørner – butikkene legger på det selv.','mangler',null,null,40),
('favicon-pakke','Logo','Favicon-pakke','favicon.ico (32 px), apple-touch-icon 180 px og PNG 512 px. I dag finnes bare SVG, som noen nettlesere og iPhone-snarveier ikke bruker.','mangler',null,null,50),
('farger','Farger og skrift','Fargepalett','Mørk navy, aksentblå #2563EB og turkis #06B6D4 – se fargene over.','ferdig',null,null,60),
('farge-avvik','Farger og skrift','Avvik i farger','Dokumentene (100-listen, Scania-dokumentet) bruker navy #283845 og teal #438496, plattformen bruker turkis, nettsiden blå. Bestem én palett og la alt følge den.','avvik',null,null,70),
('skrift','Farger og skrift','Typografi','Inter 300–900 for alt. Logoen 800, overskrifter 700, brødtekst 400.','ferdig',null,null,80),
('slagord','Tekst','Slagord','Det finnes tre: «Transportdata inn. Lønnsomhet ut.» (nettsiden), «Intelligence for Every Industry» (delingsbildet) og «Where Data Becomes Insight» (plattformen). Velg ett.','avvik','Transportdata inn. Lønnsomhet ut.',null,90),
('kort-beskrivelse','Tekst','Kort beskrivelse (ca. 30 ord)','Til e-postsignatur, LinkedIn, søknader og presse. Utkast – rett ordlyden før bruk.','utkast','Insiqt samler regnskap, lønn, timer og kjøretøydata for transportbedrifter og viser lønnsomheten per bil, per tur og per sjåfør – så du ser hvor pengene tjenes og hvor de lekker.',null,100),
('lang-beskrivelse','Tekst','Lang beskrivelse (ca. 100 ord)','Til «om oss», presse og tilbud.','mangler',null,null,110),
('pastander','Tekst','Godkjente påstander','Hva vi kan si offentlig. Live i dag: Duett og Scania. Nettsiden lover tolv integrasjoner og viser pilotene under «Brukt av» – det må stemme med virkeligheten.','utkast','Kan sies: Kobler seg på Duett og Scania i dag. Viser lønnsomhet per bil fra regnskapet. Data lagres i Microsoft Azure i Norge.
Kan ikke sies uten dekning: antall integrasjoner utover de som er live, kundenavn uten skriftlig samtykke, tall om besparelser uten kilde.',null,120),
('tone','Tekst','Tone og språk','Hvordan Insiqt skriver: kort, konkret, norsk bokmål, tall framfor adjektiver, fagord fra transport og regnskap på norsk.','mangler',null,null,130),
('juridisk-navn','Tekst','Juridisk navn og bunntekst','Brreg: INSIQT.AI AS, org.nr. 920 298 796. Plattformen skriver «Insiqt AS v1.0» i bunnteksten – det er feil selskapsnavn.','avvik','Insiqt.AI AS · org.nr. 920 298 796',null,140),
('og-bilde','Digitalt','Delingsbilde (1200 × 630)','Bildet som vises når insiqt.ai deles på LinkedIn, Slack og Messenger. I dag er det en SVG – de fleste tjenester viser ikke SVG, så lenken deles uten bilde. Bildet nevner også «Bygg & Anlegg», som ikke er et produkt.','avvik',null,'brand/og-image-nettside.svg',150),
('linkedin','Digitalt','LinkedIn-side: profilbilde og banner','Profilbilde 400 × 400 (symbolet) og banner 1584 × 396.','mangler',null,null,160),
('signatur','Digitalt','E-postsignatur','Felles signatur for john@ og ove@insiqt.ai: navn, rolle, telefon, Insiqt.AI AS, insiqt.ai. Ingen bilder som blokkeres i e-postklienter.','mangler',null,null,170),
('skjermbilder','Digitalt','Skjermbilder av plattformen','Til nettside, presentasjoner og tilbud – med testdata, aldri ekte kundetall. Du har en mappe med skjermbilder på Macen; last opp de som er godkjent.','mangler',null,null,180),
('demo-video','Digitalt','Demo-video','insiqt-demo.mp4 ligger på nettsiden.','ferdig',null,null,190),
('presentasjon','Salg','Presentasjonsmal','insiqt-presentasjon.vercel.app finnes.','utkast',null,'https://insiqt-presentasjon.vercel.app/',200),
('produktark','Salg','Produktark (én side, PDF)','Hva Insiqt gjør, for hvem, hva det koster kunden å komme i gang (inkl. Scania Data Access), og kontaktinfo. Til å legge igjen etter møter.','mangler',null,null,210),
('dokumentmal','Salg','Dokument- og brevmal','Google Docs-mal med logo, farger og bunntekst, til tilbud, avtaler og brev.','mangler',null,null,220),
('visittkort','Salg','Visittkort','For John og Ove. Nyttig siden mye av salget skjer ansikt til ansikt.','mangler',null,null,230),
('referanser','Salg','Referansekunder og logoer','Nettsiden viser O Myren, Oslo Minibuss, Norlogistikk og Bjørnars under «Brukt av». Ingen har signert samtykke til å bli brukt som referanse, og NOR Logistikk er nærstående part, ikke kunde.','avvik',null,'https://insiqt.ai/',240),
('varemerke','Juridisk','Varemerkeregistrering «Insiqt»','Søk hos Patentstyret om navnet er ledig, og registrer ordmerket (og logoen når den er ferdig) i klasse 9 og 42.','mangler',null,'https://www.patentstyret.no/',250),
('domener','Juridisk','Domener','insiqt.ai utløper 26.03.2028. Sjekk om insiqt.no og insiqt.com er sikret, så ingen andre tar dem.','utkast',null,null,260)
on conflict (key) do nothing;
update public.deadlines set notes='Selskapet er mva-registrert (fra 01.09.2025 ifølge Brønnøysund). Fristen er den 10. i andre måned etter terminen.' where title='Mva-melding';
insert into public.deadlines (title, category, due_date, recurrence, owner, link, notes) values ('Oppdater kontaktinfo i Enhetsregisteret','selskap',null,'ingen','John','https://www.brreg.no/endre-opplysninger/','Brønnøysund viser fortsatt e-post fra tidligere navn (Min Yoga Lofoten AS) og adresse c/o NOR Logistikk AS. Endres i Samordnet registermelding i Altinn.');
