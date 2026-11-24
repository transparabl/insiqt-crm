import { supabase } from './supabase-client.js';
import { session } from './session.js';
import { showView } from './view.js';
import { initPipeline, refreshAll } from './app.js';
import { initKundekort } from './kundekort.js';
import { initModuler } from './moduler.js';
import { initDashboard } from './dashboard.js';
import { initRingeliste } from './ringeliste.js';

const $ = (sel) => document.querySelector(sel);

let bootstrapped = false;

async function initAuth() {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (authSession) {
    session.email = authSession.user.email;
    enterApp();
  } else {
    showLogin();
  }

  supabase.auth.onAuthStateChange((_event, authSession) => {
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
