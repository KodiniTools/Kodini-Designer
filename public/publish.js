// Speichern (Entwurf), Veröffentlichen (Upload + Commit + Deploy) und die
// Browser-Vorschau (Build ohne Deploy). Enthält den Status-Tab, das Polling und
// die Verdrahtung der Kopf-Buttons (Speichern/Vorschau/Veröffentlichen).

import { $, esc, api, toast, mediaGet } from './core.js';
import {
  state,
  MEDIA_LANGS,
  MEDIA_KEYS,
  allImageSlots,
  getPath,
  setPath,
  LANG_SECTIONS,
  SUBTABS,
  getMediaVal,
  setMediaVal,
  defMediaVal,
  defaultMediaLocale,
  normTickerStyle,
} from './model.js';
import { loadServerFiles, renderFiles, renderMedia } from './media.js';
import { goto, renderMain } from './admin.js';

// ============ Veröffentlichen (Status + Aktion) ============
export function renderPublish() {
  const pane = $('#content');
  pane.innerHTML = `
    <div class="panel">
      <h2>Veröffentlichen</h2>
      <p class="hint">Speichert die Inhalte, lädt lokale Medien hoch, committet nach <code>main</code>
        und startet den Deploy auf den Server. Dauert typischerweise 1–2 Minuten.</p>
      <label>Notiz (optional)</label>
      <input id="pubMsg" placeholder="z.B. Neue Hero-Texte" />
      <div class="row" style="margin-top:.75rem;align-items:center;gap:.75rem">
        <button class="success" id="pubNow" style="flex:0 0 auto" ${state.publishing ? 'disabled' : ''}>🚀 Jetzt veröffentlichen</button>
        <span>Status: <span class="pill idle" id="pubPill2">bereit</span></span>
      </div>
      <p class="hint" style="margin-top:.5rem">Tipp: Dieselbe Aktion löst auch der grüne Button oben rechts aus. Diese Seite zeigt nur den Fortschritt.</p>
      <div class="status" id="pubLog">—</div>
    </div>`;
  $('#pubNow').addEventListener('click', runPublish);
}

// --- Speichern (Draft) ---
function resolveMediaForSave() {
  // Ersetzt staged:-Referenzen (pro Sprache) durch bereits veröffentlichte URLs
  // oder (falls noch nicht hochgeladen) durch den zuletzt geladenen/Default-Wert.
  const m = JSON.parse(JSON.stringify(state.media));
  for (const lang of MEDIA_LANGS) {
    const lm = m[lang];
    const loaded = state.loadedMedia[lang] || defaultMediaLocale();
    for (const key of ['audio', 'image', 'diverse']) {
      const v = lm.sectionVideos[key];
      if (typeof v === 'string' && v.startsWith('staged:')) {
        const item = state.stagedItems.find((x) => x.id === v.slice(7));
        lm.sectionVideos[key] =
          (item && item.publishedUrl) || loaded.sectionVideos[key] || defMediaVal(key);
      }
    }
    if (typeof lm.heroBanner === 'string' && lm.heroBanner.startsWith('staged:')) {
      const item = state.stagedItems.find((x) => x.id === lm.heroBanner.slice(7));
      lm.heroBanner = (item && item.publishedUrl) || loaded.heroBanner || '';
    }
    if (Array.isArray(lm.heroGrid)) {
      for (let i = 0; i < lm.heroGrid.length; i++) {
        const v = lm.heroGrid[i];
        if (typeof v === 'string' && v.startsWith('staged:')) {
          const item = state.stagedItems.find((x) => x.id === v.slice(7));
          lm.heroGrid[i] =
            (item && item.publishedUrl) || (loaded.heroGrid && loaded.heroGrid[i]) || '';
        }
      }
    }
  }
  // Globale Bilder (Seiten-Hintergrund, Sektionen): noch nicht hochgeladen ->
  // zuletzt gespeicherter Wert (oder leer), damit media.json nie eine
  // staged:-Referenz enthält.
  for (const slot of allImageSlots()) {
    const rootObj = m[slot.root];
    if (!rootObj || typeof rootObj !== 'object') continue;
    const v = getPath(rootObj, slot.path);
    if (typeof v === 'string' && v.startsWith('staged:')) {
      const item = state.stagedItems.find((x) => x.id === v.slice(7));
      const loaded = getPath(state.loadedMedia[slot.root] || {}, slot.path);
      setPath(
        rootObj,
        slot.path,
        (item && item.publishedUrl) || (typeof loaded === 'string' ? loaded : '') || '',
      );
    }
  }
  return m;
}

function buildPayload(media) {
  return {
    overrides: state.overrides,
    ticker: {
      de: cleanTicker(state.ticker.de),
      en: cleanTicker(state.ticker.en),
    },
    media: media || resolveMediaForSave(),
  };
}
function cleanTicker(t) {
  return {
    enabled: t.enabled === true,
    speed: t.speed,
    items: t.items
      .filter((i) => i.text && i.text.trim())
      .map((i, idx) => {
        const o = { id: String(i.id || idx + 1), text: i.text.trim() };
        if (i.link && i.link.trim()) o.link = i.link.trim();
        return o;
      }),
    // Design pro Sprache.
    style: normTickerStyle(t.style),
  };
}

async function saveDraft() {
  const r = await api('/content', { method: 'PUT', body: buildPayload() });
  if (r.ok) {
    state.loadedMedia = JSON.parse(JSON.stringify(r.data.saved.media));
    markSaved(); // Snapshot aktualisieren -> „dirty" zurücksetzen
    warnIfServerDroppedFields(r.data.saved.media);
    return true;
  }
  toast('Speichern fehlgeschlagen: ' + (r.data?.error || r.status));
  return false;
}

// Läuft der Admin-Dienst noch mit altem Server-Code, kennt seine Validierung
// neue Felder (z. B. toolCards) nicht und verwirft sie beim Speichern – dann
// zeigt auch die Vorschau nichts davon. Erkennbar am Vergleich mit der Antwort.
let droppedWarned = false;
function warnIfServerDroppedFields(savedMedia) {
  const dropped = MEDIA_LANGS.some(
    (l) =>
      state.media[l] &&
      state.media[l].toolCards &&
      !(savedMedia && savedMedia[l] && savedMedia[l].toolCards),
  );
  const hint = $('#codeHint');
  if (!dropped) return;
  if (hint) {
    hint.classList.remove('hidden');
    hint.textContent =
      '⚠️ Der Admin-Dienst läuft mit altem Server-Code und verwirft neue Einstellungen (z. B. Tool-Karten) – bitte neu starten: sudo systemctl restart kodini-admin';
  }
  if (!droppedWarned) {
    droppedWarned = true;
    toast(
      'Server-Dienst veraltet: Tool-Karten-Design wurde beim Speichern verworfen – Neustart nötig',
    );
  }
}

$('#saveBtn').addEventListener('click', async () => {
  $('#saveBtn').disabled = true;
  if (await saveDraft()) toast('Als Entwurf gespeichert ✓');
  $('#saveBtn').disabled = false;
});

// --- Veröffentlichen ---
async function uploadStagedReferenced() {
  // Lädt jedes in einem Slot referenzierte staged Medium in den Ordner SEINER
  // Sprache (/uploads/<lang>/) hoch und ersetzt die staged:-Referenz durch die
  // endgültige URL. Ein Medium, das in DE und EN genutzt wird, kommt in beide
  // Ordner (getrennte Galerien). Pro (Sprache, Datei) wird nur einmal geladen.
  const cache = new Map(); // "lang:id" -> url
  for (const lang of MEDIA_LANGS) {
    for (const key of MEDIA_KEYS) {
      const v = getMediaVal(lang, key);
      if (typeof v !== 'string' || !v.startsWith('staged:')) continue;
      const id = v.slice(7);
      const cacheKey = lang + ':' + id;
      let url = cache.get(cacheKey);
      if (!url) {
        const item = await mediaGet(id);
        if (!item) continue;
        const r = await api('/upload', {
          method: 'POST',
          raw: item.blob,
          headers: {
            'X-Filename': item.name,
            'X-Lang': lang,
            'Content-Type': item.type || 'application/octet-stream',
          },
        });
        if (!r.ok) throw new Error(`Upload ${item.name}: ${r.data?.error || r.status}`);
        url = r.data.url;
        cache.set(cacheKey, url);
      }
      setMediaVal(lang, key, url);
    }
  }
  // Globale Bilder (Seiten-Hintergrund, Sektionen) -> gemeinsamer Ordner
  // (/uploads/, beide Sprachen).
  // Tool-Karten-Bilder in den Ordner ihrer Sprache.
  for (const slot of allImageSlots()) {
    const v = slot.get();
    if (!v.startsWith('staged:')) continue;
    const id = v.slice(7);
    const cacheKey = slot.xLang + ':' + id;
    let url = cache.get(cacheKey);
    if (!url) {
      const item = await mediaGet(id);
      if (!item) continue;
      const r = await api('/upload', {
        method: 'POST',
        raw: item.blob,
        headers: {
          'X-Filename': item.name,
          'X-Lang': slot.xLang,
          'Content-Type': item.type || 'application/octet-stream',
        },
      });
      if (!r.ok) throw new Error(`Upload ${item.name}: ${r.data?.error || r.status}`);
      url = r.data.url;
      cache.set(cacheKey, url);
    }
    slot.set(url);
  }
  await loadServerFiles();
}

let pollTimer;
// Einstieg (Kopf-Button, Status-Seite, Tastenkürzel): zeigt zuerst die
// Diff-Vorschau „Was ändert sich?" und startet erst nach Bestätigung.
function runPublish() {
  if (state.publishing) return;
  showPublishConfirm(computePublishDiff(), doPublish);
}
// Der eigentliche Veröffentlichen-Ablauf.
async function doPublish() {
  if (state.publishing) return;
  state.publishing = true;
  $('#publishBtn').disabled = true;
  const pn = $('#pubNow');
  if (pn) pn.disabled = true;
  setPill('running', 'lädt Medien…');
  try {
    await uploadStagedReferenced();
    const media = resolveMediaForSave();
    // Save mit finalen URLs
    const put = await api('/content', { method: 'PUT', body: buildPayload(media) });
    if (!put.ok) throw new Error(put.data?.error || 'Speichern fehlgeschlagen');
    state.loadedMedia = JSON.parse(JSON.stringify(media));
    markSaved();
    // Publish starten
    const msg = ($('#pubMsg')?.value || '').slice(0, 100);
    const pub = await api('/publish', { method: 'POST', body: { message: msg } });
    if (!pub.ok) throw new Error(pub.data?.error || 'Publish fehlgeschlagen');
    // In den Status-Bereich wechseln und pollen
    goto('publish');
    startPolling();
  } catch (e) {
    state.publishing = false;
    setPill('error', 'Fehler');
    const log = $('#pubLog');
    if (log) log.textContent = String(e.message || e);
    $('#publishBtn').disabled = false;
  }
}
$('#publishBtn').addEventListener('click', runPublish);

// --- Vorschau (Build ohne Deploy, öffnet die gerenderte Seite in neuem Tab) ---
let previewPollTimer;
$('#previewBtn').addEventListener('click', async () => {
  // Neuen Tab SOFORT (synchron zum Klick) öffnen, sonst blockt der Popup-Blocker
  // das spätere Navigieren nach dem asynchronen Build.
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(
      '<!doctype html><meta charset="utf-8"><title>Vorschau wird erstellt…</title>' +
        '<body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:2rem;line-height:1.6">' +
        '<p>🛠️ <strong>Vorschau wird gebaut …</strong></p>' +
        '<p>Das dauert typischerweise 15–40 Sekunden. Dieses Fenster lädt die ' +
        'Vorschau automatisch, sobald sie fertig ist.</p></body>',
    );
  }
  $('#previewBtn').disabled = true;
  $('#publishBtn').disabled = true;
  setPill('running', 'Vorschau…');
  try {
    await uploadStagedReferenced();
    const media = resolveMediaForSave();
    const put = await api('/content', { method: 'PUT', body: buildPayload(media) });
    if (!put.ok) throw new Error(put.data?.error || 'Speichern fehlgeschlagen');
    state.loadedMedia = JSON.parse(JSON.stringify(media));
    markSaved();
    const pv = await api('/preview', { method: 'POST' });
    if (!pv.ok) throw new Error(pv.data?.error || 'Vorschau-Build fehlgeschlagen');
    pollPreview(win);
  } catch (e) {
    setPill('error', 'Fehler');
    if (win)
      win.document.body.innerHTML =
        '<p style="font-family:system-ui;color:#fecaca;padding:2rem">Fehler: ' +
        esc(String(e.message || e)) +
        '</p>';
    toast('Vorschau: ' + (e.message || e));
    $('#previewBtn').disabled = false;
    $('#publishBtn').disabled = false;
  }
});

// Schritt-Beschriftung im Status-Pill (Code-Update + Build).
const PREVIEW_STEP_LABEL = { 'code-update': 'holt Code…', build: 'baut…' };
// --- Erreichbarkeits-Überwachung beim Polling ---
// nginx antwortet mit 502/503, solange der Dienst neu startet (oder tot ist);
// ein reiner Netzwerkfehler lässt fetch() scheitern. Beides wurde bisher still
// übergangen – die Anzeige blieb dann endlos bei „läuft…". Jetzt wird der
// Zustand sichtbar gemacht und nach 3 Minuten mit Diagnose-Hinweis abgebrochen.
let unreachableSince = 0;
const UNREACHABLE_GIVEUP_MS = 3 * 60 * 1000;
const UNREACHABLE_DIAG =
  'Der Admin-Dienst ist seit 3 Minuten nicht erreichbar. Auf dem Server prüfen:\n' +
  '  systemctl status kodini-designer --no-pager\n' +
  '  journalctl -u kodini-designer -n 80 --no-pager\n' +
  'Neu starten: sudo systemctl restart kodini-designer';
// Letzte Zeile des Status-Logs pflegen (eine „Warte"-Zeile statt vieler).
function appendLogLine(line) {
  const log = $('#pubLog');
  if (!log) return;
  const lines = (log.textContent || '—').split('\n');
  if (lines.length && /^[⏳❌]/.test(lines[lines.length - 1])) lines.pop();
  lines.push(line);
  log.textContent = lines.join('\n');
}
// true = weiter warten; false = aufgegeben (Fehler ist angezeigt).
function noteUnreachable(r, where) {
  const now = Date.now();
  if (!unreachableSince) unreachableSince = now;
  const secs = Math.round((now - unreachableSince) / 1000);
  const code = r ? `HTTP ${r.status}` : 'Netzwerkfehler';
  if (now - unreachableSince < UNREACHABLE_GIVEUP_MS) {
    setPill('running', `${where}: Dienst nicht erreichbar (${code}, ${secs}s) – warte…`);
    appendLogLine(
      `⏳ Admin-Dienst antwortet nicht (${code}, seit ${secs}s) – vermutlich Neustart nach Code-Update; warte auf Rückkehr…`,
    );
    return true;
  }
  setPill('error', 'Dienst nicht erreichbar');
  appendLogLine('❌ ' + UNREACHABLE_DIAG);
  toast('Admin-Dienst nicht erreichbar – siehe Status-Log');
  return false;
}

function pollPreview(win) {
  clearInterval(previewPollTimer);
  unreachableSince = 0;
  previewPollTimer = setInterval(async () => {
    // Während eines Selbst-Neustarts des Dienstes schlägt die Anfrage kurz
    // fehl (502 oder Netzwerkfehler) – sichtbar warten, nach 3 min aufgeben.
    const r = await api('/preview/status').catch(() => null);
    if (!r || !r.ok) {
      if (noteUnreachable(r, 'Vorschau')) return;
      clearInterval(previewPollTimer);
      $('#previewBtn').disabled = false;
      $('#publishBtn').disabled = false;
      if (win)
        win.document.body.innerHTML =
          '<pre style="font-family:ui-monospace;color:#fecaca;padding:1rem;white-space:pre-wrap">' +
          esc(UNREACHABLE_DIAG) +
          '</pre>';
      return;
    }
    unreachableSince = 0;
    const s = r.data;
    setPill(
      s.status,
      s.status === 'running'
        ? 'Vorschau… (' + (PREVIEW_STEP_LABEL[s.step] || s.step || '') + ')'
        : s.status,
    );
    if (s.status !== 'success' && s.status !== 'error') return;
    clearInterval(previewPollTimer);
    $('#previewBtn').disabled = false;
    $('#publishBtn').disabled = false;
    if (s.status === 'success') {
      setPill('idle', 'bereit');
      showPreviewChooser(win, s);
      toast('Vorschau bereit ✓');
      handleCodeUpdate(s);
    } else {
      if (win)
        win.document.body.innerHTML =
          '<pre style="font-family:ui-monospace;color:#fecaca;padding:1rem;white-space:pre-wrap">' +
          esc((s.log || []).join('\n') || s.error || 'Build-Fehler') +
          '</pre>';
      toast('Vorschau fehlgeschlagen');
    }
  }, 2000);
}

// Nach einem Vorgang, der neuen Code geholt hat: Admin-Oberfläche neu laden,
// damit neue Frontend-Module (z. B. neue Tabs) aktiv werden. Startet der
// Dienst neu (neuer Server-Code), etwas länger warten, bis er wieder da ist.
function handleCodeUpdate(s) {
  if (s.restarting) {
    markReloaded(s);
    toast('Neuer Server-Code – Admin-Dienst startet neu, Seite lädt gleich neu…');
    setTimeout(() => location.reload(), 6000);
  } else if (s.restarted && !reloadedFor(s)) {
    // Status stammt aus der Zeit vor dem Selbst-Neustart: einmalig neu laden,
    // damit die neuen Frontend-Module aktiv sind (Guard gegen Reload-Schleife).
    markReloaded(s);
    toast('Admin-Dienst wurde neu gestartet – Seite lädt neu…');
    setTimeout(() => location.reload(), 1500);
  } else if (s.codeUpdate && s.codeUpdate.updated) {
    toast(`Code aktualisiert (${s.codeUpdate.from} → ${s.codeUpdate.to}) – Seite lädt neu…`);
    setTimeout(() => location.reload(), 2000);
  }
}
// Reload-Guard: pro abgeschlossenem Vorgang (finishedAt) nur einmal neu laden.
function reloadedFor(s) {
  try {
    return sessionStorage.getItem('kodini-admin-reloaded') === String(s.finishedAt);
  } catch {
    return true;
  }
}
function markReloaded(s) {
  try {
    sessionStorage.setItem('kodini-admin-reloaded', String(s.finishedAt));
  } catch {
    /* Speicher nicht verfügbar */
  }
}
// Hinweistext zum Code-Stand für das Vorschau-Fenster.
function codeUpdateNote(s) {
  const cu = s && s.codeUpdate;
  if (s && s.restarting)
    return '<p style="color:#fde68a;font-size:.85rem;margin-top:1rem">🔄 Neuer Server-Code geholt – der Admin-Dienst startet automatisch neu; der Adminbereich lädt sich gleich neu.</p>';
  if (cu && cu.updated)
    return `<p style="color:#6ee7b7;font-size:.85rem;margin-top:1rem">⬆️ Code aktualisiert (${esc(cu.from)} → ${esc(cu.to)}) – diese Vorschau zeigt den neuesten Stand.</p>`;
  if (cu && cu.error)
    return '<p style="color:#fde68a;font-size:.85rem;margin-top:1rem">⚠️ Code-Update übersprungen (Details im Vorschau-Log) – die Vorschau zeigt den lokalen Code-Stand.</p>';
  return '';
}

// Nach erfolgreichem Vorschau-Build: Auswahl beider Sprachen anbieten
// (die DE- und die EN-Startseite haben getrennte Medien/Inhalte).
function showPreviewChooser(win, s) {
  const base = '/admin/preview/';
  if (!win) {
    // Popup wurde blockiert -> beide Seiten direkt öffnen.
    window.open(base, '_blank');
    window.open(base + 'en/', '_blank');
    return;
  }
  const btn =
    'display:inline-block;padding:.85rem 1.5rem;margin:.35rem;border-radius:10px;' +
    'background:#38bdf8;color:#062a3a;font-weight:700;text-decoration:none';
  win.document.open();
  win.document.write(
    '<!doctype html><meta charset="utf-8"><title>Vorschau</title>' +
      '<body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:3rem 1rem;text-align:center;line-height:1.6">' +
      '<h2>Vorschau bereit ✓</h2>' +
      '<p>Welche Startseite möchtest du prüfen?</p>' +
      `<p><a href="${base}" style="${btn}">🇩🇪 Deutsche Startseite</a>` +
      `<a href="${base}en/" style="${btn}">🇬🇧 English homepage</a></p>` +
      '<p style="color:#94a3b8;font-size:.85rem;margin-top:1.5rem">' +
      'Dies ist dein aktueller Entwurf – noch nicht veröffentlicht.</p>' +
      codeUpdateNote(s) +
      '</body>',
  );
  win.document.close();
}

function setPill(cls, text) {
  for (const id of ['#pubPill', '#pubPill2']) {
    const el = $(id);
    if (el) {
      el.className = 'pill ' + cls;
      el.textContent = text;
    }
  }
}

function startPolling() {
  clearInterval(pollTimer);
  unreachableSince = 0;
  pollTimer = setInterval(refreshPublishStatus, 1500);
  refreshPublishStatus();
}

export async function refreshPublishStatus() {
  // Während eines Selbst-Neustarts des Dienstes kurz nicht erreichbar (502 /
  // Netzwerkfehler): während einer laufenden Veröffentlichung sichtbar warten,
  // nach 3 min mit Diagnose-Hinweis abbrechen. Außerhalb (nur Status-Anzeige)
  // still ignorieren.
  const r = await api('/publish/status').catch(() => null);
  if (!r || !r.ok) {
    if (!state.publishing) return;
    if (noteUnreachable(r, 'Deploy')) return;
    clearInterval(pollTimer);
    state.publishing = false;
    $('#publishBtn').disabled = false;
    const pn = $('#pubNow');
    if (pn) pn.disabled = false;
    return;
  }
  unreachableSince = 0;
  const s = r.data;
  setPill(s.status, statusLabel(s));
  const log = $('#pubLog');
  if (log) log.textContent = (s.log || []).join('\n') || '—';
  if (s.status === 'success' || s.status === 'error') {
    clearInterval(pollTimer);
    state.publishing = false;
    $('#publishBtn').disabled = false;
    const pn = $('#pubNow');
    if (pn) pn.disabled = false;
    if (s.status === 'success') {
      toast('Veröffentlicht ✓');
      handleCodeUpdate(s);
      // Diff-Basis auf den soeben veröffentlichten Stand setzen.
      publishBaseline = JSON.parse(editSnapshot());
      // Server-Dateiliste aktualisieren (neue Uploads sind jetzt live).
      loadServerFiles().then(() => {
        if (!LANG_SECTIONS.includes(state.nav.section)) return;
        if (state.nav.sub === 'files') renderFiles();
        else if (state.nav.sub === 'media') renderMedia();
      });
    }
  }
}
function statusLabel(s) {
  if (s.status === 'running') return 'läuft… (' + (s.step || '') + ')';
  if (s.status === 'success') return 'veröffentlicht';
  if (s.status === 'error') return 'Fehler';
  return 'bereit';
}

// ============ Änderungs-Schutz + Autosave + Tastaturkürzel ============
// Ein einziger JSON-Snapshot des bearbeitbaren Zustands (overrides + ticker +
// media) erkennt JEDE Änderung in ALLEN Bereichen – ohne die einzelnen
// Handler anzufassen.
let lastSavedSnapshot = null; // Stand beim letzten erfolgreichen Speichern
let prevSnapshot = null; // Stand beim letzten Poll (Änderungs-Erkennung)
let lastEditAt = 0; // Zeit der zuletzt erkannten Änderung (für Debounce)
let dirtySince = 0; // Zeit, seit der ununterbrochen ungespeichert
let autosaveInFlight = false;
let saveTimer = null;

// --- Verlauf (Undo/Redo) ---
let historyBase = null; // aktueller „Kopf" des Verlaufs (= sichtbarer Stand)
const undoStack = []; // frühere Stände (Snapshots)
const redoStack = []; // rückgängig gemachte Stände (Snapshots)
const HISTORY_MAX = 100;

// --- Veröffentlichen-Vergleich ---
// Referenz-Stand für die Diff-Vorschau: der zuletzt geladene bzw. zuletzt
// veröffentlichte Inhalt (overrides + ticker + media als geparster Snapshot).
let publishBaseline = null;

function editSnapshot() {
  return JSON.stringify({
    overrides: state.overrides,
    ticker: state.ticker,
    media: state.media,
  });
}
function isDirty() {
  return lastSavedSnapshot !== null && editSnapshot() !== lastSavedSnapshot;
}
// Nach jedem erfolgreichen Speichern/Veröffentlichen: Snapshot als „sauber" setzen.
function markSaved() {
  lastSavedSnapshot = editSnapshot();
  prevSnapshot = lastSavedSnapshot;
  dirtySince = 0;
  updateSaveIndicator('saved');
}
function pad2(n) {
  return String(n).padStart(2, '0');
}
function updateSaveIndicator(kind) {
  const btn = $('#saveBtn');
  const st = $('#saveState');
  if (btn) btn.classList.toggle('dirty', kind === 'dirty');
  if (!st) return;
  if (kind === 'saving') {
    st.textContent = 'Speichere…';
    st.className = 'save-state';
  } else if (kind === 'saved') {
    const d = new Date();
    st.textContent = `Entwurf gespeichert ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    st.className = 'save-state ok';
  } else if (kind === 'dirty') {
    st.textContent = '● Ungespeicherte Änderungen';
    st.className = 'save-state warn';
  } else {
    st.textContent = '';
    st.className = 'save-state';
  }
}

async function autosave() {
  autosaveInFlight = true;
  updateSaveIndicator('saving');
  const ok = await saveDraft(); // markSaved() passiert bei Erfolg intern
  autosaveInFlight = false;
  if (!ok) updateSaveIndicator('dirty'); // weiter dirty; nächster Versuch später
}

// Läuft im Sekundentakt: erkennt Änderungen, aktualisiert die Anzeige und löst
// den debounced Autosave aus (3 s Ruhe nach der letzten Änderung, spätestens
// aber 60 s nach der ersten ungespeicherten Änderung).
function tick() {
  if (lastSavedSnapshot === null) return;
  const now = Date.now();
  const snap = editSnapshot();
  if (snap !== prevSnapshot) {
    lastEditAt = now;
    prevSnapshot = snap;
  }
  // Verlaufs-Eintrag, sobald eine Änderung ~0,8 s geruht hat (Bursts werden zu
  // EINEM Undo-Schritt zusammengefasst – ideal für Farb-Regler/Felder).
  if (snap !== historyBase && now - lastEditAt >= 800) commitHistory(snap);
  refreshUndoUi(snap);
  const dirty = snap !== lastSavedSnapshot;
  if (!dirty) {
    dirtySince = 0;
    return;
  }
  if (!dirtySince) dirtySince = now;
  // „busy" = ein anderer Speicher-/Publish-/Vorschau-Vorgang läuft bereits
  // (Vorschau-Build erkennbar am deaktivierten Vorschau-Button).
  const previewBtn = $('#previewBtn');
  const busy = autosaveInFlight || state.publishing || (previewBtn && previewBtn.disabled);
  if (!busy) updateSaveIndicator('dirty');
  const idle = now - lastEditAt >= 3000;
  const maxWait = now - dirtySince >= 60000;
  if ((idle || maxWait) && !busy) autosave();
}

// Wird nach dem Laden (boot) aufgerufen: Basis-Snapshot setzen + Loop starten.
export function initSaveTracking() {
  lastSavedSnapshot = editSnapshot();
  prevSnapshot = lastSavedSnapshot;
  dirtySince = 0;
  updateSaveIndicator('clean');
  // Verlauf (Undo/Redo) auf den frisch geladenen Stand zurücksetzen.
  historyBase = lastSavedSnapshot;
  undoStack.length = 0;
  redoStack.length = 0;
  refreshUndoUi();
  // Diff-Basis = frisch geladener Stand.
  publishBaseline = JSON.parse(lastSavedSnapshot);
  clearInterval(saveTimer);
  saveTimer = setInterval(tick, 1000);
}

// Browser-Warnung beim Verlassen, solange ungespeicherte Änderungen bestehen.
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// --- Tastaturkürzel ---
function appVisible() {
  const a = $('#appView');
  return a && !a.classList.contains('hidden');
}
function isTypingTarget(el) {
  return (
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  );
}
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const key = (e.key || '').toLowerCase();
  // Strg/Cmd+S = Speichern (auch beim Tippen in einem Feld).
  if (mod && !e.shiftKey && key === 's') {
    e.preventDefault();
    if (appVisible() && !$('#saveBtn').disabled) $('#saveBtn').click();
    return;
  }
  // Strg/Cmd+Shift+P = Veröffentlichen.
  if (mod && e.shiftKey && key === 'p') {
    e.preventDefault();
    if (appVisible()) runPublish();
    return;
  }
  // Strg/Cmd+Shift+V = Vorschau.
  if (mod && e.shiftKey && key === 'v') {
    e.preventDefault();
    if (appVisible() && !$('#previewBtn').disabled) $('#previewBtn').click();
    return;
  }
  // Strg/Cmd+Z = Rückgängig, Strg/Cmd+Y bzw. +Shift+Z = Wiederherstellen.
  // In echten Text-Eingaben bleibt die native Undo-Funktion des Browsers aktiv.
  if (mod && !e.shiftKey && key === 'z') {
    if (isTextEntry(document.activeElement)) return;
    e.preventDefault();
    if (appVisible()) undo();
    return;
  }
  if (mod && (key === 'y' || (e.shiftKey && key === 'z'))) {
    if (isTextEntry(document.activeElement)) return;
    e.preventDefault();
    if (appVisible()) redo();
    return;
  }
  // Esc = fokussiertes Feld verlassen (offene Dialoge schließen sich selbst).
  if (e.key === 'Escape') {
    if (document.querySelector('.picker-overlay')) return;
    if (isTypingTarget(document.activeElement)) document.activeElement.blur();
    return;
  }
  // 1–6 = Unterbereich wechseln (nur außerhalb von Eingabefeldern, ohne Modifier).
  if (!mod && !e.altKey && !e.shiftKey && /^[1-6]$/.test(e.key)) {
    if (isTypingTarget(document.activeElement)) return;
    if (!appVisible() || !LANG_SECTIONS.includes(state.nav.section)) return;
    const t = SUBTABS[parseInt(e.key, 10) - 1];
    if (t) {
      e.preventDefault();
      goto(state.nav.section, t.key);
    }
  }
});

// Text-Eingabe? Dort soll die native Browser-Undo-Funktion Vorrang haben.
function isTextEntry(el) {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    return ['text', 'search', 'url', 'email', 'tel', 'password', 'number'].includes(t);
  }
  return false;
}

// Setzt den aktuellen Bearbeitungsstand aus einem Snapshot wieder her und
// rendert die aktive Ansicht neu.
function applySnapshot(json) {
  const s = JSON.parse(json);
  state.overrides = s.overrides;
  state.ticker = s.ticker;
  state.media = s.media;
  prevSnapshot = json; // gilt nicht als neue Änderung
  lastEditAt = Date.now();
  renderMain();
}

// Schwebende Änderung als Verlaufsschritt festhalten (Bursts zusammengefasst).
function commitHistory(snap) {
  snap = snap || editSnapshot();
  if (snap === historyBase) return;
  undoStack.push(historyBase);
  if (undoStack.length > HISTORY_MAX) undoStack.shift();
  historyBase = snap;
  redoStack.length = 0; // neue Bearbeitung verwirft den Redo-Zweig
  refreshUndoUi(snap);
}

function undo() {
  commitHistory(); // noch nicht erfasste Änderung zuerst sichern
  if (!undoStack.length) {
    toast('Nichts zum Rückgängigmachen');
    return;
  }
  redoStack.push(historyBase);
  historyBase = undoStack.pop();
  applySnapshot(historyBase);
  refreshUndoUi(historyBase);
  toast('Rückgängig gemacht ↶');
}

function redo() {
  if (!redoStack.length) {
    toast('Nichts zum Wiederherstellen');
    return;
  }
  undoStack.push(historyBase);
  historyBase = redoStack.pop();
  applySnapshot(historyBase);
  refreshUndoUi(historyBase);
  toast('Wiederhergestellt ↷');
}

// Aktiviert/deaktiviert die ↶/↷-Buttons je nach Verfügbarkeit. Neben den
// Kopf-Buttons werden auch bereichsinterne Kopien ([data-undoproxy] /
// [data-redoproxy]) mitgeführt, damit sie überall den gleichen Zustand zeigen.
function refreshUndoUi(snap) {
  const cur = snap || editSnapshot();
  const canUndo = !(undoStack.length === 0 && cur === historyBase);
  const canRedo = redoStack.length > 0;
  const u = $('#undoBtn');
  const r = $('#redoBtn');
  if (u) u.disabled = !canUndo;
  if (r) r.disabled = !canRedo;
  document.querySelectorAll('[data-undoproxy]').forEach((el) => (el.disabled = !canUndo));
  document.querySelectorAll('[data-redoproxy]').forEach((el) => (el.disabled = !canRedo));
}

// Bereichsinterne ↶/↷-Buttons (z.B. im Layout-Tab) lösen denselben Verlauf aus.
// Delegiert, damit auch neu gerenderte Buttons ohne Neu-Verdrahtung wirken.
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-undoproxy]')) {
    e.preventDefault();
    undo();
  } else if (e.target.closest('[data-redoproxy]')) {
    e.preventDefault();
    redo();
  }
});

const undoBtn = $('#undoBtn');
const redoBtn = $('#redoBtn');
if (undoBtn) undoBtn.addEventListener('click', undo);
if (redoBtn) redoBtn.addEventListener('click', redo);

// ============ Diff-Vorschau vor dem Veröffentlichen ============
// Objekt rekursiv zu Punkt-Pfaden „abflachen" (Primitive/leere Container).
function flatten(obj, prefix, out) {
  out = out || {};
  if (obj === null || typeof obj !== 'object') {
    out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) out[prefix] = '[]';
    else obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) out[prefix] = '{}';
  else for (const k of keys) flatten(obj[k], prefix ? `${prefix}.${k}` : k, out);
  return out;
}
// Zwei Objekte vergleichen -> Liste geänderter Pfade { key, from, to }.
function diffFlat(a, b) {
  const fa = flatten(a, '');
  const fb = flatten(b, '');
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  const out = [];
  for (const k of keys) {
    if (fa[k] !== fb[k]) out.push({ key: k, from: fa[k], to: fb[k] });
  }
  return out.sort((x, y) => x.key.localeCompare(y.key));
}
function shortVal(v) {
  if (v === undefined) return '—';
  let s = typeof v === 'string' ? v : JSON.stringify(v);
  if (typeof v === 'string' && v.startsWith('staged:')) return '(neues Medium)';
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 42 ? s.slice(0, 42) + '…' : s;
}
function fmtChange(c) {
  if (c.from === undefined) return `＋ ${c.key} = „${shortVal(c.to)}"`;
  if (c.to === undefined) return `－ ${c.key} entfernt`;
  return `${c.key}: „${shortVal(c.from)}" → „${shortVal(c.to)}"`;
}
// Änderungen gegenüber der Diff-Basis, gruppiert nach Bereich.
function computePublishDiff() {
  const groups = [];
  if (!publishBaseline) return { total: 0, groups };
  const cur = JSON.parse(editSnapshot());
  const add = (title, changes) => {
    if (changes.length) groups.push({ title, items: changes.map(fmtChange) });
  };
  for (const lang of MEDIA_LANGS) {
    add(
      `Texte ${lang.toUpperCase()}`,
      diffFlat(publishBaseline.overrides?.[lang] || {}, cur.overrides?.[lang] || {}),
    );
  }
  for (const lang of MEDIA_LANGS) {
    add(
      `Laufband ${lang.toUpperCase()}`,
      diffFlat(publishBaseline.ticker?.[lang] || {}, cur.ticker?.[lang] || {}),
    );
  }
  add(
    'Globale Einstellungen',
    diffFlat({ site: publishBaseline.media?.site }, { site: cur.media?.site }),
  );
  for (const lang of MEDIA_LANGS) {
    add(
      `Medien & Design ${lang.toUpperCase()}`,
      diffFlat(publishBaseline.media?.[lang] || {}, cur.media?.[lang] || {}),
    );
  }
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return { total, groups };
}

// Bestätigungs-Dialog mit der Änderungsübersicht. Bei „Veröffentlichen" wird
// onConfirm() aufgerufen. Wiederverwendet die Picker-Overlay-Optik.
const MAX_ITEMS_PER_GROUP = 20;
function showPublishConfirm(diff, onConfirm) {
  document.getElementById('publishConfirm')?.remove();
  const body = diff.total
    ? diff.groups
        .map((g) => {
          const shown = g.items.slice(0, MAX_ITEMS_PER_GROUP);
          const extra = g.items.length - shown.length;
          const li = shown.map((t) => `<li>${esc(t)}</li>`).join('');
          const more = extra > 0 ? `<li class="hint">… und ${extra} weitere</li>` : '';
          return `<h4 style="margin:.7rem 0 .2rem">${esc(g.title)} <span class="lang-badge">${g.items.length}</span></h4>
            <ul style="margin:.2rem 0;padding-left:1.2rem;line-height:1.5">${li}${more}</ul>`;
        })
        .join('')
    : `<p class="hint" style="margin:.6rem 0">Keine Änderungen gegenüber dem zuletzt geladenen/veröffentlichten Stand gefunden. Ein Deploy ist derzeit nicht nötig.</p>`;

  const overlay = document.createElement('div');
  overlay.className = 'picker-overlay';
  overlay.id = 'publishConfirm';
  overlay.innerHTML = `
    <div class="picker-modal" role="dialog" aria-modal="true">
      <h3>🚀 Veröffentlichen — Was ändert sich?</h3>
      <p class="hint" style="margin-bottom:.25rem">${
        diff.total
          ? `${diff.total} Änderung(en) werden nach <code>main</code> committet und deployt.`
          : 'Übersicht der Änderungen seit dem letzten Stand.'
      }</p>
      <div style="max-height:52vh;overflow:auto;border-top:1px solid var(--border);margin-top:.4rem;padding-top:.2rem">${body}</div>
      <div class="row" style="margin-top:1rem;justify-content:flex-end;gap:.5rem">
        <button type="button" data-pubcancel style="flex:0 0 auto">Abbrechen</button>
        <button type="button" class="success" data-pubgo style="flex:0 0 auto">${
          diff.total ? '🚀 Veröffentlichen' : 'Trotzdem veröffentlichen'
        }</button>
      </div>
    </div>`;

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-pubcancel]').addEventListener('click', close);
  overlay.querySelector('[data-pubgo]').addEventListener('click', () => {
    close();
    onConfirm();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  overlay.querySelector('[data-pubgo]').focus();
}
