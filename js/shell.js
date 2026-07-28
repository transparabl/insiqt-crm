import { supabase } from './supabase-client.js';
import { session } from './session.js';
import { showView } from './view.js';
import { initPipeline, refreshAll as refreshPipeline } from './app.js';
import { initWiki } from './wiki.js';

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
    initPipeline();
    initWiki();
  } else {
    refreshPipeline();
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

$('#navPipeline').addEventListener('click', () => showView('pipeline'));

initAuth();
