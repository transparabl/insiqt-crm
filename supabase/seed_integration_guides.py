# Genererer SQL som fyller integration_guides. Innholdet bygger på Integrasjonsregisteret i Notion
# (verifisert 23.11.2026) og leverandørenes egne sider. Steg som ikke er dokumentert er merket slik.
import json

N = "https://app.notion.com/p/"
SB_SECRETS = "https://supabase.com/dashboard/project/njqrcrdhdpualulqdkoe/functions/secrets"

def S(t, who="", link="", lt=""):
    d = {"t": t}
    if who: d["who"] = who
    if link: d["link"] = link
    if lt: d["lt"] = lt
    return d

G = []
def g(slug, grp, name, sort, steps, **kw):
    G.append(dict(slug=slug, grp=grp, name=name, sort=sort, steps=steps, **kw))

# ---------------- Kontrollsenterets egne koblinger ----------------
g("kontroll-github", "kontroll", "GitHub – nettsideendringer", 1, secret_name="GITHUB_TOKEN",
  category="Kontrollsenteret", status="Ikke koblet", phase="Nå",
  purpose="Lar kontrollsenteret lage forhåndsvisning av nettsideendringer på en egen gren og publisere dem når du trykker Publiser.",
  access="Fine-grained token som bare gjelder repoet transparabl/insiqt-ai-website.",
  docs_url="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
  verified="Stegene følger GitHubs egen dokumentasjon.",
  steps={"insiqt": [
    S("Logg inn på github.com med kontoen som eier repoet transparabl/insiqt-ai-website.", "John", "https://github.com/login", "Logg inn"),
    S("Åpne siden for nytt fine-grained token (Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token).", "John", "https://github.com/settings/personal-access-tokens/new", "Nytt token"),
    S("Navn: «Insiqt kontrollsenter». Utløp: 90 dager. Sett en påminnelse i kalenderen dagen før.", "John"),
    S("Resource owner: transparabl. Repository access: «Only select repositories» → velg insiqt-ai-website.", "John"),
    S("Under Permissions → Repository permissions: velg «Contents» = Read and write. Det er alt som trengs. «Metadata» settes automatisk.", "John"),
    S("Trykk «Generate token» og kopier det. GitHub viser det bare én gang. Lagre en kopi i Proton Pass.", "John"),
    S("Lim tokenet inn i feltet under og trykk «Lagre og test».", "John"),
  ], "test": [
    S("Testen under viser grønt."),
    S("Lag en liten testendring på Nettside-fanen (f.eks. på Kontakt-siden) og se at den går til «Klar for gjennomsyn» med forhåndsvisning."),
    S("Avvis testendringen."),
  ]})

g("kontroll-claude", "kontroll", "Claude API – gjør nettsideendringene", 2, secret_name="ANTHROPIC_API_KEY",
  category="Kontrollsenteret", status="Ikke koblet", phase="Nå",
  purpose="Claude leser siden, gjør endringen du beskriver i koden og forklarer hva som ble endret. Kostnad per endring er liten, men du betaler per bruk.",
  access="API-nøkkel fra Claude Console på selskapets konto.",
  docs_url="https://docs.claude.com/en/api/getting-started",
  verified="Stegene følger Anthropics dokumentasjon.",
  steps={"insiqt": [
    S("Logg inn i Claude Console med selskapskontoen (helst john@insiqt.ai).", "John", "https://console.anthropic.com/", "Åpne Console"),
    S("Under Billing: legg inn betalingskort, kjøp kreditt og sett en månedlig utgiftsgrense du er komfortabel med.", "John"),
    S("Under API keys: trykk «Create key» og kall den «kontrollsenter».", "John"),
    S("Kopier nøkkelen (den starter med sk-ant-). Lagre en kopi i Proton Pass.", "John"),
    S("Lim nøkkelen inn i feltet under og trykk «Lagre og test».", "John"),
  ], "test": [
    S("Testen under viser grønt og at modellen er tilgjengelig."),
    S("En testendring på Nettside-fanen går fra «Claude jobber» til «Klar for gjennomsyn»."),
  ]})

g("kontroll-notion", "kontroll", "Notion – oppgaver og bugs", 3, secret_name="NOTION_TOKEN",
  category="Kontrollsenteret", status="Ikke koblet", phase="Nå",
  purpose="Viser Bug Tracker og Gjøremål i kontrollsenteret, og lar deg legge inn nye saker og endre status uten å åpne Notion.",
  access="Intern Notion-integrasjon i arbeidsområdet Insiqt.AI AS, delt med sidene «Company - Insiqt.ai» og «Software».",
  docs_url="https://developers.notion.com/docs/create-a-notion-integration",
  verified="Stegene følger Notions dokumentasjon.",
  steps={"insiqt": [
    S("Åpne Notions integrasjonsside og trykk «New integration».", "John", "https://www.notion.so/profile/integrations", "Åpne integrasjoner"),
    S("Navn: «Insiqt kontrollsenter». Workspace: Insiqt.AI AS. Type: Internal. Lagre.", "John"),
    S("Under Capabilities: kryss av for Read content, Update content og Insert content. Lagre.", "John"),
    S("Kopier «Internal Integration Secret». Lagre en kopi i Proton Pass.", "John"),
    S("Åpne siden «Company - Insiqt.ai» i Notion → ••• oppe til høyre → Connections → legg til «Insiqt kontrollsenter».", "John", N + "396088745714803ca495ec23507f9811", "Company - Insiqt.ai"),
    S("Gjør det samme på siden «Software» (der Bug Tracker ligger).", "John", N + "39608874571480769ec0c83afa14fb84", "Software"),
    S("Lim nøkkelen inn i feltet under og trykk «Lagre og test».", "John"),
  ], "test": [
    S("Testen under viser at den ser både Gjøremål og Bug Tracker."),
    S("Fanen «Oppgaver og bugs» viser sakene."),
    S("Lag en testoppgave og se at den dukker opp i Gjøremål. Arkiver den etterpå."),
  ]})

g("claude-koblinger", "kontroll", "Claude-koblinger (Kalender, Drive, Notion, Pocket)", 4,
  category="Claude", status="Delvis", phase="Nå",
  purpose="Lar Claude i claude.ai lese kalender, dokumenter, Notion og Pocket-opptak når du jobber i Insiqt-prosjektet.",
  access="Kobles til i claude.ai under Innstillinger → Connectors, med kontoen john@insiqt.ai.",
  verified="Google Drive er bekreftet koblet til john@insiqt.ai 23.11.2026.",
  steps={"insiqt": [
    S("Åpne claude.ai → Innstillinger → Connectors.", "John", "https://claude.ai/settings/connectors", "Åpne Connectors"),
    S("Google Calendar: koble fra contact@transparabl.com og koble til på nytt med john@insiqt.ai.", "John"),
    S("Google Drive: er allerede koblet til john@insiqt.ai. Ingenting å gjøre.", "John"),
    S("Notion og Pocket: sjekk at begge står som tilkoblet.", "John"),
    S("Etter kalenderbyttet: be Claude flytte planlagte oppgaver som skriver til den gamle kalenderen.", "John"),
  ], "test": [
    S("Spør Claude «hva har jeg i kalenderen i morgen?» og se at det er john@insiqt.ai-kalenderen."),
  ]})

g("google-i-appen", "kontroll", "Google Drive og Kalender i kontrollsenteret", 5,
  category="Kontrollsenteret", status="Ikke bygget", phase="Neste fase",
  purpose="Dokumentliste og møter direkte i kontrollsenteret, uten å gå via Claude.",
  access="Egen Google OAuth-klient for appen under john@insiqt.ai.",
  blocker="Ikke bygget ennå. Krever en OAuth-klient i Google Cloud først.",
  docs_url="https://developers.google.com/workspace/guides/create-credentials",
  steps={"insiqt": [
    S("Opprett et prosjekt «Insiqt kontrollsenter» i Google Cloud Console med john@insiqt.ai.", "John", "https://console.cloud.google.com/projectcreate", "Nytt prosjekt"),
    S("Slå på Google Drive API og Google Calendar API i prosjektet.", "John"),
    S("Sett opp OAuth consent screen. Velg «Internal» hvis insiqt.ai er et Google Workspace-domene.", "John"),
    S("Lag en OAuth-klient av typen «Web application». Del Client ID og Client secret med Claude via Proton Pass.", "John"),
    S("Claude bygger innlogging med Google og fanene Dokumenter og Møter.", "Claude"),
  ], "test": [
    S("Siste filer fra Drive vises i kontrollsenteret."),
    S("Ukens møter fra john@insiqt.ai-kalenderen vises."),
  ]})

# ---------------- Produktintegrasjoner (fra Integrasjonsregisteret) ----------------
P = []
def p(slug, name, pid, **kw):
    P.append(dict(slug=slug, name=name, notion_url=N + pid, **kw))

p("tripletex", "Tripletex", "42108874571481a0810ceef06b48e3b5", category="Regnskap", status="Lovet på nettsiden", phase="Nå", priority=89,
  purpose="Inntekt og kostnad per konto for kunder som bruker Tripletex. Samme rolle som Duett.",
  access="To tokens: consumer token (Insiqt, etter godkjent søknad) + employee token (opprettes av kunden under Selskap → API-tilgang).",
  docs_url="https://developer.tripletex.no", verified="Tilgangsmodell verifisert 23.11.2026.",
  steps={"insiqt": [
    S("Opprett testkonto i Tripletex sitt testmiljø.", "Raman", "https://api-test.tripletex.tech", "Testmiljø"),
    S("Bygg henting av hovedbok og resultat per konto per måned mot testmiljøet.", "Raman"),
    S("Send søknad om produksjonstilgang (consumer token). Regn med 2–3 uker, og godkjenning er ikke garantert.", "John", "https://developer.tripletex.no", "Tripletex Developer"),
    S("Lagre consumer token sikkert i plattformen. Aldri i Notion, e-post eller chat.", "Raman"),
    S("Lag kundeveiledning og spill inn Loom. Lim lenken inn i feltet «Loom-veiledning».", "John"),
  ], "kunde": [
    S("Kunden oppretter en egen integrasjonsbruker i Tripletex, med så lite tilgang som mulig.", "Kunde"),
    S("Under Selskap → API-tilgang: kunden lager et employee token for Insiqt.", "Kunde"),
    S("Kunden deler tokenet med Insiqt via Proton Pass-lenke.", "Kunde"),
    S("Insiqt legger inn tokenet og bekrefter at kontoplanen er hentet.", "Raman"),
    S("Gå gjennom kontomapping med kunden: hvilke kontoer er drivstoff, lønn, bom og verksted.", "John"),
  ], "test": [
    S("Resultat per måned stemmer med Tripletex-rapport for én kunde."),
    S("Utløpt eller feil token vises tydelig for brukeren."),
  ]})

p("poweroffice", "PowerOffice Go", "421088745714819aa553d2c1713feb74", category="Regnskap", status="Lovet på nettsiden", phase="Nå", priority=85,
  purpose="Regnskapsdata for kunder på PowerOffice Go.",
  access="Application key (Insiqt) + Client key (kunden legger til utvidelsen i PowerOffice Go).",
  docs_url="https://developer.poweroffice.net", verified="Tilgangsmodell verifisert 23.11.2026.",
  steps={"insiqt": [
    S("Send e-post til go-api@poweroffice.no og be om testbruker og demoklient.", "John"),
    S("Registrer Insiqt-applikasjonen og få Application key.", "Raman"),
    S("Bygg mot demomiljøet.", "Raman"),
    S("Søk om offentlig publisering av utvidelsen.", "Raman"),
    S("Lag kundeveiledning og Loom.", "John"),
  ], "kunde": [
    S("Kunden legger til Insiqt-utvidelsen i PowerOffice Go.", "Kunde"),
    S("Kunden kopierer Client key og deler den via Proton Pass.", "Kunde"),
    S("Insiqt legger inn nøkkelen og bekrefter at data hentes.", "Raman"),
    S("Gå gjennom kontomapping med kunden.", "John"),
  ], "test": [S("Resultat stemmer med PowerOffice-rapport for én kunde.")]})

p("idha", "IDHA Online (Autodata) – fartsskriver", "42108874571481518c48f35b3102f926", category="Fartsskriver/kjøre-hviletid", status="Live (omstridt)", phase="Nå", priority=85,
  purpose="Kjøre- og hviletid og overtredelser fra fartsskriverdata. Kjerne for både lønnsomhet og compliance.",
  blocker="Motstridende opplysninger om den faktisk er live. Raman må bekrefte.",
  steps={"insiqt": [
    S("Bekreft at integrasjonen faktisk er live i produksjon.", "Raman"),
    S("Dokumenter hvordan kunden gir tilgang (API-nøkkel, brukerkonto eller annet).", "Raman"),
    S("Lag kundeveiledning og Loom når stegene er kjent.", "John"),
  ], "kunde": [
    S("Ikke dokumentert ennå. Raman fyller inn hvordan kunden gir Insiqt tilgang til IDHA Online.", "Raman"),
  ], "test": [S("Ukens kjøretid per sjåfør stemmer med IDHA-rapport.")]})

p("vegvesen", "Statens vegvesen – tekniske kjøretøyopplysninger", "42108874571481799b8bdbdd7b73b5c8", category="Offentlig register", status="Vurderes", phase="Nå", priority=84,
  purpose="Fyller ut tekniske data om bilen fra regnummer (mål, vekt, motor, registreringsdatoer), så kunden slipper å taste inn. Gir ikke kilometerstand.",
  access="API-nøkkel bestilt av Insiqt.AI AS. Krever enkelttjenesten «Kjøretøyoppslag».",
  docs_url="https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/api-er-for-tekniske-kjoretoyopplysninger/", verified="Tilgangsmodell verifisert 23.11.2026.",
  steps={"insiqt": [
    S("Sjekk at Insiqt.AI AS har enkelttjenesten «Kjøretøyoppslag». Følg Vegvesenets side for bestilling.", "John", "https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/api-er-for-tekniske-kjoretoyopplysninger/", "Vegvesen"),
    S("Bestill API-nøkkel for tekniske kjøretøyopplysninger.", "John"),
    S("Gi nøkkelen til Raman via Proton Pass.", "John"),
    S("Lag oppslag på regnummer når en bil registreres i plattformen.", "Raman"),
  ], "kunde": [S("Ingenting. Kunden taster bare regnummer.", "Kunde")],
  "test": [S("Oppslag på 5 kjente regnummer gir riktige data.")]})

p("duett", "Duett (regnskap)", "421088745714811e908ac3780685e3df", category="Regnskap", status="Live", phase="Nå", priority=81,
  purpose="Inntekter og kostnader per konto fra kundens Duett-regnskap. Grunnlaget for dekningsbidrag per bil.",
  blocker="Oppsettet er ikke dokumentert. I dag kan bare Raman koble opp en ny kunde.",
  steps={"insiqt": [
    S("Dokumenter autentiseringsmetode, hvem hos kunden som godkjenner, og hvor ofte data hentes.", "Raman"),
    S("Beskriv kontomapping per kunde, slik at John kan gjøre den.", "Raman"),
    S("Lag kundeveiledning og Loom.", "John"),
  ], "kunde": [
    S("Ikke dokumentert ennå. Raman fyller inn hvordan kunden gir tilgang til Duett.", "Raman"),
    S("Gå gjennom kontomapping med kunden.", "John"),
  ], "test": [S("Månedens resultat i plattformen avviker under 1 % fra Duett-rapporten.")]})

p("lonn", "Lønn (Duett Lønn først)", "421088745714814ea558d780101332df", category="Lønn", status="Vurderes", phase="Nå", priority=80,
  purpose="Avstemmer betalte timer mot registrert arbeidstid (som 209 mot 133:19 i Oslo Minibuss-rapporten).",
  blocker="Lønnssystem ikke valgt. Ukjent om Duett Lønn har API.",
  steps={"insiqt": [
    S("Kartlegg hvilke lønnssystemer pilotene bruker (O Myren, Oslo Minibuss, Bjørnars).", "John"),
    S("Avklar om Duett Lønn kan hentes via samme leverandør.", "Raman"),
    S("Velg første lønnssystem og før beslutningen i Beslutningsloggen.", "John"),
  ], "kunde": [S("Ikke kjent før lønnssystem er valgt.", "Kunde")],
  "test": [S("Betalte timer kan avstemmes mot registrert arbeidstid for én pilot.")]})

p("brreg", "Brønnøysundregistrene (Enhetsregisteret)", "42108874571481e7bf86d0decd012a38", category="Offentlig register", status="Vurderes", phase="Nå", priority=79,
  purpose="Fyller ut firmanavn, adresse og næringskode fra org.nr. Åpne data, gratis.",
  access="Åpent API uten nøkkel.",
  docs_url="https://data.brreg.no/",
  steps={"insiqt": [
    S("Ingen nøkkel eller avtale trengs. Data hentes fra det åpne API-et på org.nr.", "Raman"),
    S("Bruk samme oppslag ved kundeoppstart i plattformen.", "Raman"),
  ], "kunde": [S("Ingenting. Kunden oppgir bare org.nr.", "Kunde")],
  "test": [S("Oppslag på Insiqt.AI AS sitt org.nr gir riktig navn og adresse.")]})

p("e-signering", "E-signering av pilotavtale og DPA", "42108874571481d78670d837577972da", category="Dokumenter/signering", status="Vurderes", phase="Neste fase", priority=76,
  purpose="Ingen av pilotene har signert pilotavtale eller DPA. Enkel e-signering tetter et reelt juridisk hull.",
  blocker="Leverandør ikke valgt. BankID-støtte er et krav i Norge.",
  steps={"insiqt": [
    S("Velg leverandør med BankID-støtte og før valget i Beslutningsloggen.", "John"),
    S("Last opp pilotavtale og DPA som maler (merk dem som ikke juridisk gjennomgått til de er det).", "John"),
    S("Send første avtale til én pilot.", "John"),
  ], "kunde": [S("Kunden signerer med BankID fra lenken i e-posten.", "Kunde")],
  "test": [S("Signert dokument lagres og kan hentes igjen.")]})

p("scania", "Scania (rFMS / Scania Data Access)", "42108874571481ad8690c12f663380c6", category="OEM/kjøretøydata", status="Live", phase="Nå", priority=76,
  purpose="Kilometerstand, drivstofforbruk og posisjon fra kundens Scania-biler. Sammen med regnskap og timer gir det kostnad per kilometer.",
  access="Kunden oppretter applikasjon i Scania Developer Portal og deler Client ID + Secret key. Krever aktivt Scania Data Access-abonnement (per kjøretøy, via forhandler).",
  docs_url="https://www.scania.com/uk/en/home/services/connected-services/data-access.html",
  verified="Portalstegene kommer fra tredjepartsdokumentasjon. Raman må bekrefte at de stemmer med vår flyt.",
  steps={"insiqt": [
    S("Bekreft at portalstegene under stemmer med flyten vi faktisk bruker.", "Raman"),
    S("Spill inn Loom som viser kunden stegene skjerm for skjerm. Lim lenken inn i feltet «Loom-veiledning».", "John"),
  ], "kunde": [
    S("Sjekk at kunden har aktivt Scania Data Access-abonnement for bilene (avtales med Scania-forhandler).", "John"),
    S("Pilotavtale og DPA bør være signert før vi henter data.", "John"),
    S("Logg inn i Scania Developer Portal og velg «Scania Data Access User» under «Login As».", "Kunde"),
    S("Gå til «My Application» → «Create Application» og kall den «Insiqt».", "Kunde"),
    S("Kopier Client ID og Secret key.", "Kunde"),
    S("Del nøklene med Insiqt via Proton Pass-lenke. Aldri på e-post, WhatsApp eller i Notion.", "Kunde"),
    S("Legg inn nøklene i plattformen og bekreft at alle biler dukker opp.", "Raman"),
  ], "test": [
    S("Alle kundens Scania-biler vises med riktig regnummer."),
    S("Kilometerstand for siste døgn stemmer med kundens egen oversikt (stikkprøve på 2 biler)."),
    S("Drivstofforbruk vises per bil."),
    S("Data oppdateres uten manuelt inngrep i 7 dager."),
    S("Kunden klarer oppsettet alene med Loom-videoen."),
  ]})

p("volvo", "Volvo (Connect API, rFMS)", "421088745714811eb95bc2b9b56c9313", category="OEM/kjøretøydata", status="Lovet på nettsiden", phase="Neste fase", priority=75,
  purpose="Kilometer og drivstoff fra Volvo-lastebiler og -busser, på samme rFMS-format som Scania.",
  access="Kunden har Volvo Connect-konto og API-abonnement (per kjøretøy) via forhandler. Bare 14 dagers historikk.",
  docs_url="https://volvobuses.com/en/fleet-management-services/data-access/connect-api.html", verified="Tilgangsmodell verifisert 23.11.2026.",
  steps={"insiqt": [
    S("Finn én pilotkunde med Volvo-biler.", "John"),
    S("Gjenbruk rFMS-laget fra Scania og hent data minst ukentlig (bare 14 dagers historikk).", "Raman"),
    S("Dokumenter kundestegene og lag Loom.", "John"),
  ], "kunde": [
    S("Kunden bestiller Volvo Connect API-abonnement for bilene hos forhandler.", "Kunde"),
    S("Ikke dokumentert ennå: hvordan kunden gir Insiqt nøkler i Volvo Connect. Fylles inn ved første pilot.", "Raman"),
  ], "test": [S("Samme testplan som Scania.")]})

p("abax", "ABAX", "42108874571481fe8739e1e4cfb73ed3", category="Telematikk/flåte", status="Lovet på nettsiden", phase="Neste fase", priority=72,
  purpose="Kjøretøy, turer og utstyr fra ABAX. Dekker blandede flåter og varebiler uten OEM-abonnement.",
  access="ABAX Open API på vegne av ABAX-kunde (partnervilkår ikke bekreftet).",
  steps={"insiqt": [
    S("Kontakt ABAX om partnertilgang og vilkår.", "John"),
    S("Dokumenter tilgangsmodellen her når den er bekreftet.", "Raman"),
  ], "kunde": [S("Ikke kjent før partnervilkårene er avklart.", "Kunde")], "test": []})

p("daimler", "Mercedes-Benz / Daimler Truck (rFMS)", "42108874571481d9a838cc7f80e8678c", category="OEM/kjøretøydata", status="Vurderes", phase="Neste fase", priority=71,
  purpose="Kjøretøydata fra Mercedes-Benz-lastebiler. Kan gjenbruke rFMS-laget fra Scania.",
  access="Eget utviklerportal hos Daimler Truck med client credentials.",
  steps={"insiqt": [S("Vent til Volvo er på plass, og gjenbruk samme rFMS-lag.", "Raman")],
         "kunde": [S("Ikke dokumentert ennå.", "Kunde")], "test": [S("Samme testplan som Scania.")]})

p("stripe", "Stripe (fakturering)", "4210887457148138a986f924e31e79b7", category="Intern drift", status="Planlagt", phase="Neste fase", priority=71,
  purpose="Valgt fakturaløsning. Trengs først når første kunde betaler.",
  steps={"insiqt": [
    S("Settes opp når første kunde signerer betalt avtale.", "John"),
    S("Prisliste må være bestemt før abonnementer kan lages i Stripe.", "John"),
  ], "kunde": [S("Kunden får faktura eller betalingslenke på e-post.", "Kunde")], "test": []})

p("crisp", "Kundestøtte (Crisp → Bug Tracker)", "42108874571481b897a6cc6d38dff08f", category="Kundestøtte", status="Vurderes", phase="Når plattformen vokser", priority=71,
  purpose="Crisp er allerede i bruk. Kobling mot Bug Tracker gir én flyt fra kundehenvendelse til sak.",
  steps={"insiqt": [S("Vent til flere enn 10 aktive kunder.", "John")], "kunde": [], "test": []})

p("circlek", "Circle K drivstoffkort (Transactions API)", "42108874571481f78914f9c42558ecf8", category="Drivstoff", status="Lovet på nettsiden", phase="Neste fase", priority=70,
  purpose="Fyllinger med beløp, liter og kort per bil. Kan avstemmes mot forbruk fra OEM.",
  access="Tilgang søkes via Circle K Developer Portal. Kundens samtykke trengs.",
  docs_url="https://www.developer.circlek.com/transactions-api-use-cases", verified="Tilgangsmodell verifisert 23.11.2026.",
  steps={"insiqt": [
    S("Søk tilgang i Circle K Developer Portal.", "John", "https://www.developer.circlek.com/transactions-api-use-cases", "Circle K Developer"),
    S("Avklar hvordan kundens samtykke gis og dokumenter det her.", "John"),
  ], "kunde": [S("Kunden gir samtykke til at Insiqt henter transaksjoner (fremgangsmåte avklares).", "Kunde")],
  "test": [S("Månedens drivstoffkostnad per bil stemmer med Circle K-fakturaen.")]})

p("fartsskriver-andre", "Andre fartsskriverkilder (TachoWeb, Optac m.fl.)", "42108874571481cb8861c0034485ffd6", category="Fartsskriver/kjøre-hviletid", status="Vurderes", phase="Neste fase", priority=68,
  purpose="Kunder som ikke bruker IDHA trenger en annen kilde for timer.",
  steps={"insiqt": [S("Registrer fartsskriverløsning per lead i CRM-et før vi velger.", "John")], "kunde": [], "test": []})

p("24so", "24SevenOffice", "42108874571481b4a55ae104cac968f5", category="Regnskap", status="Lovet på nettsiden", phase="Når plattformen vokser", priority=64,
  purpose="Regnskapsdata for kunder på 24SevenOffice. Lavere andel i målgruppen.",
  steps={"insiqt": [S("Ikke bygg før en betalende kunde ber om det.", "John")], "kunde": [], "test": []})

p("webfleet", "Webfleet (WEBFLEET.connect + TachoShare)", "421088745714813ebb16d056235c74a8", category="Telematikk/flåte", status="Lovet på nettsiden", phase="Når plattformen vokser", priority=63,
  purpose="Flåtedata, og TachoShare gir fartsskriverfiler – mulig alternativ fartsskriverkilde.",
  access="Kunden ber om API-nøkkel via Webfleet Customer Community og lager egen API-bruker.",
  docs_url="https://www.webfleet.com/en_gb/webfleet/partners/integration/developer-resources/", verified="Tilgangsmodell verifisert 23.11.2026.",
  steps={"insiqt": [S("Bygg når en kunde med Webfleet ber om det.", "Raman")],
         "kunde": [
           S("Kunden ber om API-nøkkel via Webfleet Customer Community.", "Kunde"),
           S("Kunden lager en egen API-bruker i Webfleet for Insiqt.", "Kunde"),
           S("Kunden deler nøkkel og brukernavn via Proton Pass.", "Kunde"),
         ], "test": []})

p("drivstoff-andre", "Andre drivstoffkort (Uno-X, YX, Shell m.fl.)", "42108874571481afa07aeb826cc81b49", category="Drivstoff", status="Vurderes", phase="Når plattformen vokser", priority=63,
  purpose="Drivstoffkostnad for kunder som ikke bruker Circle K. Ikke undersøkt. Mulig fallback: import av fakturafil.",
  steps={"insiqt": [S("Registrer drivstoffleverandør per lead i CRM-et før vi velger.", "John")], "kunde": [], "test": []})

p("rfms-andre", "MAN, DAF, Iveco (rFMS-pakke)", "421088745714816c82f7fb423a37331b", category="OEM/kjøretøydata", status="Vurderes", phase="Når plattformen vokser", priority=62,
  purpose="Full merkedekning. Hver for seg er andelen liten; et telematikk-API kan dekke blandede flåter billigere.",
  steps={"insiqt": [S("Vurder når blandede flåter blir vanlige blant kundene.", "John")], "kunde": [], "test": []})

p("transparabl", "Transparabl (bærekraftsrapportering)", "42108874571481469190dd7a19cce470", category="Intern drift", status="Lovet på nettsiden", phase="Lengre sikt", priority=55,
  purpose="Bærekraftsrapportering. Nærstående selskap.",
  blocker="Nærstående part – krever formell avtale om datadeling før noe bygges.",
  steps={"insiqt": [S("Avklar formell avtale mellom selskapene før noe bygges.", "John")], "kunde": [], "test": []})

p("bom", "Bompasseringer (AutoPASS via brikkeutsteder)", "4210887457148187aa7dc2b31bb6e334", category="Bom/veiavgift", status="Lovet på nettsiden", phase="Når plattformen vokser", priority=53,
  purpose="Bomkostnad per bil.",
  blocker="Ingen kjent offentlig API. Data ligger hos den enkelte AutoPASS-utsteder.",
  steps={"insiqt": [
    S("Endre nettsideteksten til «import av bompasseringer».", "John"),
    S("Kartlegg hvilke brikkeutstedere kundene bruker.", "John"),
  ], "kunde": [S("Realistisk vei i dag: kunden laster ned passeringer fra utstederens Min side og laster opp filen.", "Kunde")], "test": []})

p("verksted", "Verksted og vedlikehold", "42108874571481bd965be165d81347c8", category="Vedlikehold/verksted", status="Vurderes", phase="Lengre sikt", priority=52,
  purpose="Verkstedkostnad. Regnskapsdata fanger allerede kostnaden per konto.",
  steps={"insiqt": [S("Ingen nå.", "—")], "kunde": [], "test": []})

p("whatsapp", "WhatsApp-gruppe (teamvarsler)", "421088745714812285abf51515206f36", category="Kommunikasjon", status="Vurderes", phase="Neste fase",
  purpose="Intern drift. I dag åpner dashboardet WhatsApp med ferdig tekst, og du velger gruppen selv.",
  access="Meta Business-konto + WhatsApp Cloud API + Official Business Account.",
  blocker="Mangler Official Business Account, eget nummer og en backend. Eksisterende grupper kan ikke brukes (maks 8 deltakere, gruppen må lages via API-et).",
  docs_url="https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/",
  steps={"insiqt": [S("Bruk del-knappen i dashboardet. Vurder Cloud API bare hvis manuell deling blir en flaskehals.", "John")], "kunde": [], "test": []})

p("loom", "Loom (veiledningsvideoer)", "42108874571481e088dafdb468cf04d2", category="Intern drift", status="Planlagt", phase="Nå",
  purpose="Veiledningsvideoer for kundeoppsett. Loom regnes som koblet for en integrasjon først når lenken står på den integrasjonen.",
  steps={"insiqt": [
    S("Spill inn første veiledning: Scania-oppsett for kunde.", "John"),
    S("Lim lenken inn i «Loom-veiledning» på Scania-guiden.", "John"),
  ], "kunde": [], "test": []})

for i, x in enumerate(P):
    x.setdefault("sort", 100 + i)
    G.append(dict(grp="produkt", **x))

def q(v):
    if v is None: return "null"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

cols = ["slug","grp","name","category","phase","status","priority","purpose","access","blocker","docs_url","notion_url","secret_name","verified","steps","sort"]
rows = []
for x in G:
    vals = [q(x.get(c)) if c != "steps" else q(json.dumps(x["steps"], ensure_ascii=False)) + "::jsonb" for c in cols]
    rows.append("(" + ",".join(vals) + ")")
sql = "insert into public.integration_guides (" + ",".join(cols) + ") values\n" + ",\n".join(rows) + \
  "\non conflict (slug) do update set " + ",".join(f"{c}=excluded.{c}" for c in cols if c != "slug") + ", updated_at=now();"
open("/tmp/seed_guides.sql", "w").write(sql)
print(len(G), "guider,", len(sql), "tegn")
