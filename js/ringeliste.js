// Ringeliste: importer store CSV-lister, ring gjennom køen med et stort kort
// laget for telefonbruk, og konverter interesserte til leads i pipelinen.
import { supabase } from './supabase-client.js';
import { session } from './session.js';
import { showView } from './view.js';
import { escapeHtml, showToast, fmtDateTime, logActivity, refreshAll } from './app.js';
import { lenkeTilSalg } from './tilsalg.js';

const $ = (sel) => document.querySelector(sel);

const STATUS_LABELS = {
  ny: 'Ikke ringt',
  ingen_svar: 'Ingen svar',
  ring_senere: 'Ring senere',
  ikke_interessert: 'Ikke interessert',
  konvertert: 'Konvertert til lead',
};

// Statusene som fortsatt ligger i ringekøen
const KO_STATUSER = ['ny', 'ingen_svar', 'ring_senere'];
const SIDE_STORRELSE = 100;

const state = {
  ko: [],          // gjeldende ringekø (sortert)
  koIndex: 0,
  visteRader: 0,   // paginering i listevisningen
  parsed: null,    // siste parsede CSV som venter på import
};

// ─── CSV-parsing ───────────────────────────────────────────────
// Norske eksporter (Proff, Listeverktøy) bruker ofte semikolon; vi
// auto-detekterer skilletegn og håndterer anførselstegn.
function parseCsv(tekst) {
  tekst = tekst.replace(/^﻿/, '');
  const forsteLinje = (tekst.split(/\r?\n/, 1)[0] || '');
  const skille = (forsteLinje.match(/;/g) || []).length >
      (forsteLinje.match(/,/g) || []).length
    ? ';'
    : ',';

  const rader = [];
  let felt = '', rad = [], iAnforsel = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (iAnforsel) {
      if (c === '"') {
        if (tekst[i + 1] === '"') { felt += '"'; i++; } else iAnforsel = false;
      } else felt += c;
    } else if (c === '"') {
      iAnforsel = true;
    } else if (c === skille) {
      rad.push(felt); felt = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst[i + 1] === '\n') i++;
      rad.push(felt); felt = '';
      if (rad.some((f) => f.trim() !== '')) rader.push(rad);
      rad = [];
    } else felt += c;
  }
  rad.push(felt);
  if (rad.some((f) => f.trim() !== '')) rader.push(rad);
  return rader;
}

// Kolonnegjenkjenning: normaliserte kandidater per felt, i prioritert rekkefølge.
// Dekker både norske eksporter (Proff, Listeverktøy) og engelske Brønnøysund-
// uttrekk (Name/JuridicalName, OrganizationNumber, Municipality, Manager …).
const KOLONNER = {
  company_name: ['juridisk navn', 'juridicalname', 'markedsnavn', 'firmanavn', 'selskapsnavn', 'selskap', 'bedrift', 'company', 'navn', 'name'],
  org_no: ['organisasjonsnummer', 'organizationnumber', 'orgnr', 'org.nr', 'org nr', 'org_no', 'organisasjonsnr'],
  phone: ['telefonnummer', 'telefon', 'tlf', 'phone'],
  mobil: ['mobilnummer', 'mobilenumber', 'mobil', 'mobiltelefon'],
  email: ['epost', 'e-post', 'e-postadresse', 'email', 'mail'],
  website: ['url', 'nettside', 'hjemmeside', 'web', 'website'],
  contact_name: ['daglig leder', 'dagligleder', 'manager', 'kontaktperson', 'contactperson', 'leder', 'ceo'],
  place: ['kommune', 'municipality', 'poststed', 'sted', 'by'],
  address: ['besøksadresse', 'besoksadresse', 'visitationaddress', 'adresse', 'gateadresse', 'forretningsadresse'],
  selskapsform: ['selskapsform', 'companytype'],
  bransjekode: ['bransjekode', 'businesscode'],
  bransje: ['bransje', 'business'],
  postadresse: ['postadresse', 'postaddress'],
  styreleder: ['styreleder', 'chairman'],
  eier: ['eier', 'owner'],
  etablert: ['etableringsdato', 'etablert', 'establishmentdate'],
  ansatte: ['antall ansatte', 'ansatte', 'numberofemployees'],
  revisor: ['revisor', 'accountant'],
  regnskapsforer: ['regnskapsfører', 'regnskapsforer', 'bookkeeper'],
  lonnsomhet: ['lønnsomhet', 'lonnsomhet', 'profitability'],
  likviditet: ['likviditet', 'liquidity'],
  soliditet: ['soliditet', 'solidity'],
  mva: ['registrert i mva register', 'mva-registrert', 'registredinvatregister'],
  latitude: ['breddegrad', 'latitude', 'lat'],
  longitude: ['lengdegrad', 'longitude', 'lng', 'long'],
  accounting: ['accounting'],
};

const KOLONNE_NAVN = {
  company_name: 'selskap', org_no: 'orgnr', phone: 'telefon', email: 'e-post',
  website: 'nettside', contact_name: 'daglig leder', place: 'sted', address: 'adresse',
  selskapsform: 'selskapsform', bransjekode: 'bransjekode', bransje: 'bransje',
  postadresse: 'postadresse', styreleder: 'styreleder', eier: 'eier',
  etablert: 'etableringsdato', ansatte: 'antall ansatte', revisor: 'revisor',
  regnskapsforer: 'regnskapsfører', lonnsomhet: 'lønnsomhet', likviditet: 'likviditet',
  soliditet: 'soliditet', mva: 'mva-registrering', latitude: 'breddegrad',
  longitude: 'lengdegrad', accounting: 'regnskap (Accounting-felt)',
};

// Regnskapskolonner har årstall på slutten av headeren: «Sum Driftsinntekter 2025».
// Samme feltvalg som salgsverktøyets prospektuttrekk (extract.py) — kjernetallene
// som faktisk brukes i kalkulatoren, ikke hele Brønnøysund-uttrekket.
const FINANS_FELT = {
  'sum driftsinntekter': 'driftsinntekter',
  'sum salgsinntekter': 'salgsinntekter',
  'driftsresultat': 'driftsresultat',
  'varekostnad': 'varekostnad',
  'lønnsutgifter': 'lonn',
  'andre driftskostnader': 'andreDriftskostnader',
  'sum driftskostnader': 'sumDriftskostnader',
  'årsresultat': 'arsresultat',
  'sum varige driftsmidler': 'varigeDriftsmidler',
  'sum omløpsmidler': 'omlopsmidler',
  'sum eiendeler': 'eiendeler',
  'sum egenkapital': 'egenkapital',
  'sum gjeld': 'gjeld',
};

function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/ /g, '').replace(/ /g, '').replace(/%/g, '').replace(',', '.');
  if (s === '' || s === '-') return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function kartleggKolonner(headerRad) {
  const normale = headerRad.map((h) => String(h).trim().toLowerCase());
  const kart = {};
  for (const [felt, kandidater] of Object.entries(KOLONNER)) {
    for (const kandidat of kandidater) {
      const i = normale.indexOf(kandidat);
      if (i !== -1) { kart[felt] = i; break; }
    }
  }
  return kart;
}

// { "2025": { driftsinntekter: kolonneindeks, ... }, "2024": {...} }
function kartleggFinansKolonner(headerRad) {
  const kart = {};
  headerRad.forEach((h, i) => {
    const m = String(h || '').trim().match(/^(.*?)\s+(20\d{2})$/);
    if (!m) return;
    const felt = FINANS_FELT[m[1].trim().toLowerCase()];
    if (!felt) return;
    (kart[m[2]] ??= {})[felt] = i;
  });
  return kart;
}

function byggFinans(rad, finansKart) {
  const ut = {};
  for (const [ar, kolonner] of Object.entries(finansKart)) {
    const entry = {};
    for (const [felt, i] of Object.entries(kolonner)) entry[felt] = num(rad[i]);
    if (entry.driftsinntekter == null && entry.driftsresultat == null) continue;
    const { driftsinntekter: di, driftsresultat: dr, lonn: lo } = entry;
    entry.margin = di && dr != null ? Math.round((dr / di) * 1000) / 10 : null;
    entry.lonnsandel = di && lo != null ? Math.round((lo / di) * 1000) / 10 : null;
    ut[ar] = entry;
  }
  return ut;
}

// Enkelte Brønnøysund-uttrekk gir regnskapstall som én «Accounting»-kolonne med
// et JS-objekt-aktig array i stedet for årstall-suffiksede kolonner, f.eks.
// [{Type:normal,AccountingYear:2025,SumRunningReceipts:1323218,OperatingResult:89113,...}]
// — ugyldig JSON (uquotede nøkler/strenger), så vi må quote dem selv før parsing.
function parseAccountingBlob(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  try {
    s = s.replace(/(\{|,)\s*([A-Za-z][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
    s = s.replace(/:([A-Za-z][A-Za-z0-9_]*)(\s*[,}])/g, ':"$1"$2');
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Accounting-feltet følger Regnskapsregisterets vanlige konvensjon og oppgir
// beløp i hele tusen kroner (bekreftet ved å sammenligne samme selskap mot
// Data-arket i .xlsx-malen, som har identiske tall × 1000) — ganges opp her
// slik at financials alltid er i hele kroner, likt byggFinans()-stien.
const TUSEN = 1000;
function byggFinansFraAccounting(raw) {
  const arr = parseAccountingBlob(raw);
  if (!arr) return {};
  const ut = {};
  for (const entry of arr) {
    const ar = String(entry?.AccountingYear ?? '').trim();
    const diRaw = num(entry?.SumRunningReceipts);
    const drRaw = num(entry?.OperatingResult);
    if (!ar || (diRaw == null && drRaw == null)) continue;
    const loRaw = num(entry?.WageCost);
    const di = diRaw != null ? diRaw * TUSEN : null;
    const dr = drRaw != null ? drRaw * TUSEN : null;
    const lo = loRaw != null ? loRaw * TUSEN : null;
    const skaler = (v) => { const n = num(v); return n != null ? n * TUSEN : null; };
    ut[ar] = {
      driftsinntekter: di,
      salgsinntekter: skaler(entry?.SumSalesRevenues),
      driftsresultat: dr,
      varekostnad: skaler(entry?.GoodsExpense),
      lonn: lo,
      andreDriftskostnader: skaler(entry?.OtherRunningExpense),
      sumDriftskostnader: skaler(entry?.RunningExpense),
      avskrivninger: skaler(entry?.DepreciationAndAmortization),
      margin: di && dr != null ? Math.round((dr / di) * 1000) / 10 : null,
      lonnsandel: di && lo != null ? Math.round((lo / di) * 1000) / 10 : null,
    };
  }
  return ut;
}

function radTilProspekt(rad, kart, finansKart) {
  const hent = (felt) => kart[felt] != null ? String(rad[kart[felt]] ?? '').trim() : '';
  const orgno = hent('org_no').replace(/\D/g, '');
  const telefon = hent('phone') || hent('mobil');
  const ansatteRaw = num(hent('ansatte'));
  // Koordinater kan komme direkte i filen (Latitude/Longitude) — da slipper
  // raden geokoding-runden i kartmodulen, som kun henter rader med lat = null.
  const lat = num(hent('latitude'));
  const lng = num(hent('longitude'));
  return {
    company_name: hent('company_name'),
    org_no: orgno || null,
    contact_name: hent('contact_name') || null,
    phone: telefon.replace(/\s/g, '') || null,
    email: hent('email') || null,
    website: hent('website') || null,
    place: hent('place') || null,
    address: hent('address') || null,
    selskapsform: hent('selskapsform') || null,
    bransjekode: hent('bransjekode') || null,
    bransje: hent('bransje') || null,
    postadresse: hent('postadresse') || null,
    styreleder: hent('styreleder') || null,
    eier: hent('eier') || null,
    etablert: hent('etablert') || null,
    // -2/-1 er regnearkets kode for «ukjent», ikke et faktisk ansattetall
    ansatte: ansatteRaw != null && ansatteRaw >= 0 ? Math.round(ansatteRaw) : null,
    revisor: hent('revisor') || null,
    regnskapsforer: hent('regnskapsforer') || null,
    lonnsomhet: num(hent('lonnsomhet')),
    likviditet: num(hent('likviditet')),
    soliditet: num(hent('soliditet')),
    mva: hent('mva') || null,
    financials: { ...byggFinans(rad, finansKart), ...byggFinansFraAccounting(hent('accounting')) },
    lat, lng,
    geokodet_at: lat != null && lng != null ? new Date().toISOString() : null,
  };
}

// ─── Import ────────────────────────────────────────────────────
// .xlsx leses med SheetJS (lastet globalt via <script> i index.html) og gjøres
// om til samme rad-av-rader-form som parseCsv() gir, slik at resten av
// import-løypa er identisk uansett filformat.
// Eksporter har ofte flere ark — et «Sammendrag»-ark først, og selve tabellen
// i et eget «Data»-ark. Velg et ark eksplisitt kalt «Data» hvis det finnes,
// ellers arket med flest utfylte kolonner i headerraden (aldri anta ark 0).
function velgArk(bok) {
  const dataArk = bok.SheetNames.find((n) => /^data$/i.test(n.trim()));
  if (dataArk) return dataArk;
  let best = bok.SheetNames[0], bestScore = -1;
  for (const navn of bok.SheetNames) {
    const [header] = XLSX.utils.sheet_to_json(bok.Sheets[navn], { header: 1, raw: true, defval: '' });
    const kolonner = (header || []).filter((c) => String(c).trim() !== '').length;
    if (kolonner > bestScore) { bestScore = kolonner; best = navn; }
  }
  return best;
}

async function lesRader(fil) {
  const erXlsx = /\.xlsx$/i.test(fil.name) ||
    fil.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (erXlsx) {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX-biblioteket lastet ikke — sjekk nettforbindelsen og prøv igjen');
    }
    const bok = XLSX.read(await fil.arrayBuffer(), { type: 'array', cellDates: true });
    const ark = bok.Sheets[velgArk(bok)];
    return XLSX.utils.sheet_to_json(ark, { header: 1, raw: true, defval: '' })
      .map((rad) => rad.map((f) => {
        if (f == null) return '';
        // Ekte dato-celler (f.eks. EstablishmentDate) blir JS Date-objekter når
        // cellDates er på — resten (tall, tekst) beholdes som de er.
        if (f instanceof Date) return f.toISOString().slice(0, 10);
        return String(f);
      }));
  }
  return parseCsv(await fil.text());
}

async function lesFil(fil) {
  const rader = await lesRader(fil);
  if (rader.length < 2) { showToast('Fant ingen datarader i filen', true); return; }

  const kart = kartleggKolonner(rader[0]);
  const finansKart = kartleggFinansKolonner(rader[0]);
  if (kart.company_name == null) {
    showToast('Fant ingen kolonne for selskapsnavn', true);
    $('#csvPreview').innerHTML = `<div class="muted">Kolonnene i filen: ${
      rader[0].map((h) => escapeHtml(h)).join(' · ')
    }</div>`;
    return;
  }

  const prospekter = rader.slice(1)
    .map((r) => radTilProspekt(r, kart, finansKart))
    .filter((p) => p.company_name);

  state.parsed = { prospekter, batch: fil.name };

  const funnet = Object.keys(kart)
    .filter((k) => k !== 'mobil')
    .map((k) => KOLONNE_NAVN[k] || k)
    .join(' ✓, ') + ' ✓';
  const utenAdresse = !kart.address
    ? '<br>Fant ingen adressekolonne — disse havner ikke i kartet før du legger inn adresse.'
    : '';
  const medKoord = prospekter.filter((p) => p.lat != null && p.lng != null).length;
  const koordTekst = kart.latitude != null && kart.longitude != null
    ? `<br>${medKoord} av ${prospekter.length} rader har koordinater i filen — disse geokodes ikke på nytt i kartmodulen.`
    : '';
  const arMedTall = new Set();
  prospekter.forEach((p) => Object.keys(p.financials || {}).forEach((a) => arMedTall.add(a)));
  const finansTekst = arMedTall.size
    ? `<br>Regnskapstall funnet for ${arMedTall.size} år (${[...arMedTall].sort().join(', ')}).`
    : '<br>Fant ingen regnskapskolonner (forventer f.eks. «Sum Driftsinntekter 2025»).';

  $('#csvPreview').innerHTML = `
    <div class="ok-boks">
      <b>${prospekter.length} selskaper klare for import</b> fra ${escapeHtml(fil.name)}.<br>
      Gjenkjente kolonner: ${funnet}.${utenAdresse}${koordTekst}${finansTekst}
    </div>
    <button class="btn" id="csvImporter" style="margin-top:10px">Importer ${prospekter.length} selskaper</button>
  `;
  $('#csvImporter').addEventListener('click', importer);
}

async function importer() {
  const { prospekter, batch } = state.parsed || {};
  if (!prospekter?.length) return;
  const btn = $('#csvImporter');
  btn.disabled = true;

  // Duplikater: orgnr som allerede finnes i ringelisten eller som selskap
  const eksisterende = new Set();
  for (const tabell of ['ringeliste', 'companies']) {
    let fra = 0;
    for (;;) {
      const { data } = await supabase.from(tabell).select('org_no')
        .not('org_no', 'is', null).range(fra, fra + 999);
      (data || []).forEach((r) => eksisterende.add(r.org_no));
      if (!data || data.length < 1000) break;
      fra += 1000;
    }
  }

  const sett = new Set();
  const nye = prospekter.filter((p) => {
    if (p.org_no) {
      if (eksisterende.has(p.org_no) || sett.has(p.org_no)) return false;
      sett.add(p.org_no);
    }
    return true;
  }).map((p) => ({ ...p, batch }));

  let importert = 0;
  for (let i = 0; i < nye.length; i += 500) {
    btn.textContent = `Importerer… ${importert}/${nye.length}`;
    const { error } = await supabase.from('ringeliste').insert(nye.slice(i, i + 500));
    if (error) { showToast('Import feilet: ' + error.message, true); break; }
    importert += Math.min(500, nye.length - i);
  }

  const hoppet = prospekter.length - nye.length;
  showToast(`${importert} importert${hoppet ? `, ${hoppet} duplikater hoppet over` : ''}`);
  state.parsed = null;
  $('#csvPreview').innerHTML = '';
  $('#csvFil').value = '';
  await oppdater();
}

// ─── Liste og statistikk ───────────────────────────────────────
async function oppdater() {
  const { data: statuser } = await supabase.from('ringeliste').select('status');
  const antall = {};
  (statuser || []).forEach((r) => { antall[r.status] = (antall[r.status] || 0) + 1; });
  const iKo = KO_STATUSER.reduce((s, k) => s + (antall[k] || 0), 0);

  $('#ringeStats').innerHTML = `
    <span class="pill action">${iKo} i køen</span>
    ${Object.entries(STATUS_LABELS).map(([k, l]) =>
      `<span class="pill">${l}: ${antall[k] || 0}</span>`).join('')}
  `;
  state.visteRader = 0;
  await visListe(false);
}

async function visListe(leggTil) {
  const sok = ($('#ringeSok').value || '').trim();
  const filter = $('#ringeFilter').value;

  let q = supabase.from('ringeliste').select('*')
    .order('created_at', { ascending: true })
    .range(leggTil ? state.visteRader : 0,
      (leggTil ? state.visteRader : 0) + SIDE_STORRELSE - 1);

  if (filter === 'ko') q = q.in('status', KO_STATUSER);
  else if (filter !== 'alle') q = q.eq('status', filter);
  if (sok) q = q.or(`company_name.ilike.%${sok}%,org_no.ilike.%${sok}%,place.ilike.%${sok}%`);

  const { data, error } = await q;
  if (error) { showToast('Kunne ikke hente listen: ' + error.message, true); return; }

  const html = (data || []).map((r) => `
    <div class="list-card" data-id="${r.id}">
      <div class="list-main">
        <div class="list-title">${escapeHtml(r.company_name)}</div>
        <div class="list-sub">
          ${escapeHtml(r.contact_name || '')}${r.contact_name ? ' · ' : ''}
          ${escapeHtml(r.phone || 'mangler telefon')}
          ${r.place ? ' · ' + escapeHtml(r.place) : ''}
          ${r.forsok ? ` · ${r.forsok} forsøk` : ''}
        </div>
      </div>
      <div class="list-side"><span class="pill ${r.status === 'konvertert' ? 'status-won' : ''}">${STATUS_LABELS[r.status]}</span></div>
    </div>
  `).join('');

  const el = $('#ringeListe');
  if (leggTil) el.insertAdjacentHTML('beforeend', html);
  else el.innerHTML = html || '<div class="empty-col">Ingen selskaper. Importer en .csv-fil over.</div>';

  state.visteRader = (leggTil ? state.visteRader : 0) + (data || []).length;
  $('#ringeMer').innerHTML = (data || []).length === SIDE_STORRELSE
    ? '<button class="btn ghost" id="ringeMerBtn">Vis flere</button>'
    : '';
  $('#ringeMerBtn')?.addEventListener('click', () => visListe(true));

  el.querySelectorAll('.list-card').forEach((kort) => {
    kort.addEventListener('click', async () => {
      const { data: rad } = await supabase.from('ringeliste').select('*')
        .eq('id', kort.dataset.id).single();
      if (rad) { state.ko = [rad]; state.koIndex = 0; visKort(); }
    });
  });
}

// ─── Ringemodus: stort kort, laget for å ringe fra mobilen ─────
async function startRingerunde() {
  const { data, error } = await supabase.from('ringeliste').select('*')
    .in('status', KO_STATUSER)
    .order('sist_ringt_at', { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) { showToast('Kunne ikke hente køen: ' + error.message, true); return; }
  if (!data?.length) { showToast('Køen er tom — importer en liste først', true); return; }
  state.ko = data;
  state.koIndex = 0;
  visKort();
}

function proffUrl(r) {
  return 'https://www.proff.no/bransjes%C3%B8k?q=' +
    encodeURIComponent(r.org_no || r.company_name);
}

function nettUrl(r) {
  if (!r.website) return null;
  return /^https?:\/\//.test(r.website) ? r.website : 'https://' + r.website;
}

function visKort() {
  const r = state.ko[state.koIndex];
  if (!r) { showView('ringeliste'); oppdater(); return; }
  showView('ringekort');

  const nett = nettUrl(r);
  $('#ringekort').innerHTML = `
    <div class="kort-head">
      <button class="btn ghost" id="rkTilbake">← Til listen</button>
      <span class="muted">${state.koIndex + 1} av ${state.ko.length} i runden</span>
    </div>

    <h1 class="rk-navn">${escapeHtml(r.company_name)}</h1>
    <div class="rk-sub">
      ${r.contact_name ? `👤 ${escapeHtml(r.contact_name)}` : ''}
      ${r.place ? ` · ${escapeHtml(r.place)}` : ''}
      ${r.forsok ? ` · ringt ${r.forsok} gang${r.forsok > 1 ? 'er' : ''} før` : ''}
    </div>

    <div class="call-grid">
      ${r.phone
        ? `<a class="call-btn primary" href="tel:${escapeHtml(r.phone)}">📞<span>Ring</span><small>${escapeHtml(r.phone)}</small></a>`
        : '<div class="call-btn disabled">📞<span>Mangler telefon</span></div>'}
      <a class="call-btn" href="${proffUrl(r)}" target="_blank" rel="noopener">📊<span>Proff.no</span><small>${escapeHtml(r.org_no || 'søk på navn')}</small></a>
      ${r.email
        ? `<a class="call-btn" href="mailto:${escapeHtml(r.email)}">✉️<span>E-post</span><small>${escapeHtml(r.email)}</small></a>`
        : '<div class="call-btn disabled">✉️<span>Mangler e-post</span></div>'}
      ${nett
        ? `<a class="call-btn" href="${escapeHtml(nett)}" target="_blank" rel="noopener">🌐<span>Nettside</span><small>${escapeHtml(r.website)}</small></a>`
        : '<div class="call-btn disabled">🌐<span>Mangler nettside</span></div>'}
    </div>

    <div class="panel" style="margin-top:14px">
      <table class="kv">
        <tr><td>Selskap</td><td>${escapeHtml(r.company_name)}</td></tr>
        <tr><td>Organisasjonsnummer</td><td>${escapeHtml(r.org_no || '–')}</td></tr>
        <tr><td>Daglig leder</td><td>${escapeHtml(r.contact_name || '–')}</td></tr>
        <tr><td>Telefon</td><td>${escapeHtml(r.phone || '–')}</td></tr>
        <tr><td>E-post</td><td>${escapeHtml(r.email || '–')}</td></tr>
        <tr><td>Nettside</td><td>${escapeHtml(r.website || '–')}</td></tr>
        ${r.sist_ringt_at ? `<tr><td>Sist ringt</td><td>${fmtDateTime(r.sist_ringt_at)}</td></tr>` : ''}
      </table>
      <textarea id="rkNotat" rows="2" placeholder="Notat fra samtalen…"
        style="width:100%;margin-top:10px;font:inherit;padding:10px 12px;border:1px solid var(--border);border-radius:10px">${escapeHtml(r.note || '')}</textarea>
    </div>

    <div class="utfall-grid">
      <button class="btn ghost" id="rkIngenSvar">📵 Ingen svar</button>
      <button class="btn ghost" id="rkRingSenere">⏰ Ring senere</button>
      <button class="btn danger" id="rkIkkeInteressert">✗ Ikke interessert</button>
      <button class="btn" id="rkInteressert">🔥 Interessert → lead</button>
    </div>
    <a class="btn ghost block" style="margin-top:8px;text-align:center" href="${lenkeTilSalg(r)}" target="_blank" rel="noopener">🎯 Åpne i Insiqt Salg — sender med det vi har</a>
    <button class="btn ghost block" id="rkHopp" style="margin-top:8px">Hopp over →</button>
  `;

  $('#rkTilbake').addEventListener('click', () => { showView('ringeliste'); oppdater(); });
  $('#rkHopp').addEventListener('click', () => { state.koIndex++; visKort(); });
  $('#rkIngenSvar').addEventListener('click', () => registrer(r, 'ingen_svar', true));
  $('#rkRingSenere').addEventListener('click', () => registrer(r, 'ring_senere', true));
  $('#rkIkkeInteressert').addEventListener('click', () => registrer(r, 'ikke_interessert', true));
  $('#rkInteressert').addEventListener('click', () => konverter(r));
}

async function registrer(r, status, ringt) {
  const { error } = await supabase.from('ringeliste').update({
    status,
    note: $('#rkNotat').value.trim() || null,
    forsok: r.forsok + (ringt ? 1 : 0),
    sist_ringt_at: ringt ? new Date().toISOString() : r.sist_ringt_at,
  }).eq('id', r.id);
  if (error) { showToast('Kunne ikke lagre: ' + error.message, true); return; }
  state.koIndex++;
  visKort();
}

// Interessert: opprett selskapet i pipelinen og åpne kundekortet
async function konverter(r) {
  const notat = $('#rkNotat').value.trim() || null;

  const { data: firma, error } = await supabase.from('companies').insert({
    name: r.company_name,
    org_no: r.org_no,
    place: r.place,
    address: r.address,
    // Koordinatene følger med hvis raden allerede er geokodet — sparer et nytt oppslag
    lat: r.lat, lng: r.lng, geokodet_at: r.geokodet_at,
    selskapsform: r.selskapsform, bransjekode: r.bransjekode, bransje: r.bransje,
    postadresse: r.postadresse, styreleder: r.styreleder, eier: r.eier, etablert: r.etablert,
    ansatte: r.ansatte, revisor: r.revisor, regnskapsforer: r.regnskapsforer,
    lonnsomhet: r.lonnsomhet, likviditet: r.likviditet, soliditet: r.soliditet, mva: r.mva,
    financials: r.financials || {},
    lead_temp: 'varm',
    lead_source: 'cold_call',
    status: 'kontaktet',
    assigned_to: session.email,
    next_activity: 'Følg opp interessert selskap fra ringelisten',
    next_activity_at: new Date().toISOString(),
    notes: notat,
  }).select('id').single();
  if (error) { showToast('Kunne ikke opprette lead: ' + error.message, true); return; }

  if (r.contact_name || r.phone || r.email) {
    await supabase.from('contacts').insert({
      company_id: firma.id,
      name: r.contact_name,
      role: r.contact_name ? 'Daglig leder' : null,
      phone: r.phone,
      email: r.email,
      is_primary: true,
    });
  }

  await logActivity(firma.id, 'lead_opprettet',
    `Interessert på ringerunde (fra ${r.batch || 'ringelisten'})${notat ? '. Notat: ' + notat : ''}`);

  await supabase.from('ringeliste').update({
    status: 'konvertert',
    company_id: firma.id,
    note: notat,
    forsok: r.forsok + 1,
    sist_ringt_at: new Date().toISOString(),
  }).eq('id', r.id);

  showToast('Lead opprettet 🔥');
  await refreshAll();
  state.koIndex++;
  window.dispatchEvent(new CustomEvent('open-kundekort', { detail: { companyId: firma.id } }));
}

// ─── Wiring ────────────────────────────────────────────────────
export function initRingeliste() {
  $('#csvFil').addEventListener('change', (e) => {
    const fil = e.target.files?.[0];
    if (fil) lesFil(fil).catch((err) => showToast('Kunne ikke lese filen: ' + err, true));
  });
  $('#ringeSok').addEventListener('input', () => visListe(false));
  $('#ringeFilter').addEventListener('change', () => visListe(false));
  $('#startRinging').addEventListener('click', startRingerunde);
  $('#navRingeliste').addEventListener('click', oppdater);
  oppdater();
}
