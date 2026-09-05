// KodiniTools Adminbereich — Einstiegsmodul (Vanilla JS, kein Build-Schritt).
// Bindet Login, die zweistufige Navigation und den Startvorgang zusammen; die
// einzelnen Bereiche liegen in eigenen Modulen (core/model/ticker/content/
// media/publish) und werden hier verdrahtet.

import { $, api, esc, toast, mediaAll } from './core.js';
import { state, normTicker, normalizeMedia, SUBTABS, LANG_SECTIONS } from './model.js';
import { renderTicker } from './ticker.js';
import { loadFonts } from './fonts.js';
import { renderTexts, renderAdvanced } from './content.js';
import { renderHeroDesign } from './design.js';
import { renderBackground } from './background.js';
import { renderToolCards } from './toolcards.js';
import { renderLayout } from './layout.js';
import { renderMedia, renderFiles, loadServerFiles } from './media.js';
import { renderIcons } from './icons.js';
import { renderFields } from './fields.js';
import { renderPublish, refreshPublishStatus, initSaveTracking } from './publish.js';

// --- Login ---
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginErr').textContent = '';
  const r = await api('/login', { method: 'POST', body: { password: $('#pw').value } });
  if (r.ok) {
    $('#pw').value = '';
    await boot();
  } else {
    $('#loginErr').textContent = r.data?.error || 'Anmeldung fehlgeschlagen';
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  location.reload();
});

// --- Navigation (zwei Ebenen) ---
function renderNav() {
  const { section, sub } = state.nav;
  document
    .querySelectorAll('#topnav button')
    .forEach((b) => b.classList.toggle('active', b.dataset.sec === section));
  const subnav = $('#subnav');
  if (LANG_SECTIONS.includes(section)) {
    subnav.classList.remove('hidden');
    subnav.innerHTML = SUBTABS.map(
      (t) =>
        `<button data-sub="${t.key}" class="${t.key === sub ? 'active' : ''}">${t.label}</button>`,
    ).join('');
  } else {
    subnav.classList.add('hidden');
    subnav.innerHTML = '';
  }
}

// Rendert den aktuellen Bereich in #content (Sprache = state.nav.section).
export function renderMain() {
  const { section, sub } = state.nav;
  if (LANG_SECTIONS.includes(section)) {
    if (sub === 'ticker') renderTicker();
    else if (sub === 'texts') renderTexts();
    else if (sub === 'media') renderMedia();
    else if (sub === 'layout') renderLayout();
    else if (sub === 'design') renderHeroDesign();
    else if (sub === 'background') renderBackground();
    else if (sub === 'cards') renderToolCards();
    else if (sub === 'files') renderFiles();
    else if (sub === 'icons') renderIcons();
    else if (sub === 'advanced') renderAdvanced();
  } else if (section === 'fields') {
    renderFields();
  } else if (section === 'publish') {
    renderPublish();
    refreshPublishStatus();
  }
}

export function goto(section, sub) {
  state.nav.section = section;
  if (sub) state.nav.sub = sub;
  renderNav();
  renderMain();
}

$('#topnav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-sec]');
  if (btn) goto(btn.dataset.sec);
});
$('#subnav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-sub]');
  if (btn) goto(state.nav.section, btn.dataset.sub);
});

// --- Laden & Anzeigen ---
async function boot() {
  const sess = await api('/session');
  if (!sess.data?.authenticated) {
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    return;
  }
  // Profil ohne Home-Vertrag (nur Felder): generischer Modus – keine Sprach-Tabs,
  // Werte aus /api/fields statt /api/content.
  const prof0 = sess.data?.profile || null;
  state.profile = prof0;
  const generic = !!(prof0 && prof0.fields && !prof0.contentTabs);
  const r = generic ? await api('/fields') : await api('/content');
  if (!r.ok) {
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    return;
  }
  // Aktives Site-Profil in der Kopfzeile anzeigen (welche Website bearbeitet
  // wird). Bei mehreren Profilen: Umschalter statt Badge – der Wechsel setzt das
  // Profil-Cookie und lädt die Oberfläche neu (ungespeicherte Änderungen werden
  // vorher vom beforeunload-Schutz abgefragt).
  const prof = sess.data?.profile;
  const list = Array.isArray(sess.data?.profiles) ? sess.data.profiles : [];
  const badge = $('#profileBadge');
  const sel = $('#profileSelect');
  if (prof) {
    document.title = `Kodini Designer · ${prof.name || prof.id}`;
    if (badge) {
      badge.textContent = prof.name || prof.id || '';
      badge.title = `Site-Profil „${prof.id}“ (${prof.kind})${prof.siteUrl ? ' – ' + prof.siteUrl : ''}`;
      badge.classList.toggle('hidden', list.length > 1);
    }
    if (sel) {
      sel.innerHTML = list
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${p.id === prof.id ? 'selected' : ''}>${esc(p.name || p.id)}</option>`,
        )
        .join('');
      sel.classList.toggle('hidden', list.length <= 1);
      sel.onchange = async () => {
        const id = sel.value;
        if (id === prof.id) return;
        const r = await api('/profile', { method: 'POST', body: { id } });
        if (!r.ok) {
          toast(r.data?.error || 'Profilwechsel fehlgeschlagen');
          sel.value = prof.id;
          return;
        }
        location.reload();
      };
    }
  }
  // Läuft der Dienst mit veraltetem Server-Code (nach einem Code-Update)?
  // Vorschau/Veröffentlichen starten ihn unter systemd automatisch neu.
  const codeHint = $('#codeHint');
  if (codeHint) {
    codeHint.classList.toggle('hidden', !sess.data?.serverCodeChanged);
    codeHint.textContent = sess.data?.serverCodeChanged
      ? '⚠️ Neuer Server-Code – Neustart nötig (Vorschau/Veröffentlichen erledigt das)'
      : '';
  }
  document
    .querySelectorAll('#topnav [data-sec="de"], #topnav [data-sec="en"]')
    .forEach((b) => b.classList.toggle('hidden', generic));
  document.querySelector('#topnav [data-sec="fields"]')?.classList.toggle('hidden', !generic);
  if (generic) {
    state.generic = {
      groups: r.data.groups || [],
      slots: r.data.slots || [],
      langs: r.data.langs || [],
      preview: r.data.preview || null,
      values: r.data.values || {},
    };
    state.nav = { section: 'fields', sub: '' };
    state.stagedItems = await mediaAll(); // Bildfelder: Zwischenspeicher + Mediathek
    await loadServerFiles();
    await loadFonts(); // Schriftwahl der Slots (Fonts-Ordner des Profils)
  } else {
    state.generic = null;
    state.overrides = { de: r.data.overrides?.de || {}, en: r.data.overrides?.en || {} };
    state.ticker = {
      de: normTicker(r.data.ticker?.de),
      en: normTicker(r.data.ticker?.en),
    };
    state.media = normalizeMedia(r.data.media);
    state.loadedMedia = JSON.parse(JSON.stringify(state.media));
    state.defaults = { de: r.data.defaults?.de || {}, en: r.data.defaults?.en || {} };
    state.stagedItems = await mediaAll();
    await loadServerFiles();
    await loadFonts();
  }

  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  renderNav();
  renderMain();
  // Änderungs-Schutz + Autosave starten (Basis-Snapshot = frisch geladener Stand).
  initSaveTracking();
}

// --- Start ---
boot();
