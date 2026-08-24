// Bygger dyplenken inn i salgsverktøyet: bedriftsinfo og siste tilgjengelige
// regnskapsår kodes inn i URL-fragmentet (#kunde=…), aldri i søkestrengen —
// fragmentet sendes aldri til noen server, og forlater derfor ikke nettleseren
// før salgsverktøyet selv leser det og fyller ut skjemaet.
//
// Brukes fra kundekort.js, ringeliste.js (ringekort) og kart.html (popup).

const SALGSVERKTOY_URL = 'https://insiqt-salg.vercel.app';

function orgFmt(o) {
  const d = String(o || '').replace(/\D/g, '');
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
}

function b64url(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Siste år med driftsinntekter eller driftsresultat i financials-JSON-en. */
function senesteFinans(financials) {
  if (!financials || typeof financials !== 'object') return {};
  const ar = Object.keys(financials).sort().reverse();
  if (!ar.length) return {};
  const f = financials[ar[0]] || {};
  if (f.driftsinntekter == null && f.driftsresultat == null) return {};
  return { ar: ar[0], omsetning: f.driftsinntekter ?? null, lonn: f.lonn ?? null };
}

/**
 * data: { navn, org_no, place, contact_name, contact_role, contact_email,
 *         ansatte, vehicle_count, financials }
 * Alle felt er valgfrie — salgsverktøyet fyller kun ut det som finnes.
 */
export function lenkeTilSalg(data) {
  const payload = {
    navn: data.navn || data.company_name || '',
    org: orgFmt(data.org_no),
    sted: data.place || '',
    kontaktNavn: data.contact_name || '',
    kontaktRolle: data.contact_role || (data.contact_name ? 'Daglig leder' : ''),
    kontaktEpost: data.contact_email || data.email || '',
    kjoretoy: data.vehicle_count ?? null,
    ...senesteFinans(data.financials),
  };
  return `${SALGSVERKTOY_URL}/#kunde=${b64url(payload)}`;
}
