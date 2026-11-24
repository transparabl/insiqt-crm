import { supabase } from './supabase-client.js';
import { session } from './session.js';
import { showView } from './view.js';
import { initPipeline, refreshAll } from './app.js';
import { initKundekort } from './kundekort.js';
import { initModuler } from './moduler.js';
import { initDashboard } from './dashboard.js';
import { initRingeliste } from './ringeliste.js';

const $ = (sel) => document.querySelector(sel);

// Lenken fra «Glemt passord»-e-posten har type=recovery i adressen. Den leses før Supabase rydder adressen.
let recovering = /type=recovery/.test(location.hash);

let bootstrapped = false;

async function initAuth() {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (authSession && recovering) {
    showNewPassword(authSession.user.email);
  } else if (authSession) {
    session.email = authSession.user.email;
    enterApp();
  } else {
    showLogin();
  }

  supabase.auth.onAuthStateChange((event, authSession) => {
    if (event === 'PASSWORD_RECOVERY' || (recovering && authSession)) {
      recovering = true;
      showNewPassword(authSession?.user?.email || '');
      return;
    }
    if (authSession) {
      session.email = authSession.user.email;
      enterApp();
    } else {
      session.email = null;
      bootstrapped = false;
      showLogin();
    }
  });
}

function showNewPassword(email) {
  $('#loginScreen').style.display = 'flex';
  $('#app').classList.remove('active');
  $('#loginForm').style.display = 'none';
  $('#newPassForm').style.display = 'block';
  $('#newPassEmail').textContent = email;
  $('.login-card .sub').textContent = 'Nytt passord';
  setTimeout(() => $('#newPass1').focus(), 50);
}

function showLogin() {
  $('#loginScreen').style.display = 'flex';
  $('#app').classList.remove('active');
}

function enterApp() {
  $('#loginScreen').style.display = 'none';
  $('#app').classList.add('active');
  $('#userEmail').textContent = session.email;

  if (!bootstrapped) {
    bootstrapped = true;
    initDashboard();
    initModuler();
    initKundekort();
    initRingeliste();
    initPipeline(); // sist: den kjører første refreshAll, som varsler de andre

    // Dyplenke: ?kunde=<id> åpner kundekortet direkte (brukes i e-post til Ove)
    const kundeId = new URLSearchParams(location.search).get('kunde');
    if (kundeId) {
      setTimeout(() => window.dispatchEvent(
        new CustomEvent('open-kundekort', { detail: { companyId: kundeId } }),
      ), 600);
    }
  } else {
    refreshAll();
  }
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  const btn = $('#loginBtn');
  const errEl = $('#loginError');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Logger inn…';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Logg inn';

  if (error) {
    errEl.textContent = 'Feil e-post eller passord.';
    errEl.style.display = 'block';
  }
});

$('#forgotBtn').addEventListener('click', async () => {
  const email = $('#loginEmail').value.trim();
  const msg = $('#forgotMsg');
  const errEl = $('#loginError');
  errEl.style.display = 'none';
  if (!email) {
    errEl.textContent = 'Skriv inn e-postadressen din først, og trykk så «Glemt passord?».';
    errEl.style.display = 'block';
    $('#loginEmail').focus();
    return;
  }
  $('#forgotBtn').disabled = true;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/index.html` });
  $('#forgotBtn').disabled = false;
  if (error) {
    errEl.textContent = /rate|seconds/i.test(error.message) ? 'Det er sendt en lenke nylig. Vent litt og prøv igjen.' : 'Klarte ikke å sende lenken: ' + error.message;
    errEl.style.display = 'block';
    return;
  }
  msg.textContent = `Hvis ${email} har en bruker, kommer det en e-post med en lenke for å velge nytt passord. Sjekk også søppelposten. Lenken virker én gang.`;
  msg.style.display = 'block';
});

$('#newPassForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = $('#newPass1').value, p2 = $('#newPass2').value;
  const errEl = $('#newPassError');
  errEl.style.display = 'none';
  if (p1.length < 10) { errEl.textContent = 'Passordet må ha minst 10 tegn.'; errEl.style.display = 'block'; return; }
  if (p1 !== p2) { errEl.textContent = 'Passordene er ikke like.'; errEl.style.display = 'block'; return; }
  const btn = $('#newPassBtn');
  btn.disabled = true; btn.textContent = 'Lagrer…';
  const { data, error } = await supabase.auth.updateUser({ password: p1 });
  btn.disabled = false; btn.textContent = 'Lagre passord og logg inn';
  if (error) {
    errEl.textContent = /expired|invalid/i.test(error.message) ? 'Lenken er utløpt. Gå tilbake og trykk «Glemt passord?» på nytt.' : 'Klarte ikke å lagre passordet: ' + error.message;
    errEl.style.display = 'block';
    return;
  }
  recovering = false;
  history.replaceState(null, '', location.pathname);
  $('#newPassForm').style.display = 'none';
  $('#loginForm').style.display = 'block';
  $('#newPass1').value = ''; $('#newPass2').value = '';
  session.email = data.user.email;
  enterApp();
});

$('#logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    showView(btn.dataset.view);
    refreshAll();
    document.body.classList.remove('navopen');
    $('#menuBtn')?.setAttribute('aria-expanded', 'false');
  });
});

// Mobilmeny: sidemenyen glir inn fra venstre
$('#menuBtn')?.addEventListener('click', () => {
  const open = document.body.classList.toggle('navopen');
  $('#menuBtn').setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', (e) => {
  if (document.body.classList.contains('navopen') && !e.target.closest('#sidebar,#menuBtn')) document.body.classList.remove('navopen');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('navopen')) { document.body.classList.remove('navopen'); $('#menuBtn')?.focus(); }
});

initAuth();
