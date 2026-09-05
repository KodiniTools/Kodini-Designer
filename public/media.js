// Medien: der „Medien"-Tab (Hero-Bereich + Sektions-Slots), der „Dateien"-Tab
// (Server-Dateien + Browser-Zwischenspeicher), das Auswahl-Popup sowie das Laden
// der Server-Dateiliste.

import { $, esc, api, toast, fmtBytes, mediaAll, mediaPut, mediaDel } from './core.js';
import {
  state,
  getMediaVal,
  setMediaVal,
  defMediaVal,
  MEDIA_LANGS,
  MEDIA_KEYS,
  allImageSlots,
  HERO_LAYOUTS,
  heroLayoutCells,
  updateMediaUrlEverywhere,
} from './model.js';

// Anzeige-Namen der Medien-Plätze (für „wird verwendet in").
const SLOT_LABELS = {
  audio: 'Audio-Sektion',
  image: 'Bild-Sektion',
  diverse: 'Diverse-Sektion',
  heroBanner: 'Hero-Banner',
  grid0: 'Kachel 1',
  grid1: 'Kachel 2',
  grid2: 'Kachel 3',
  grid3: 'Kachel 4',
  grid4: 'Kachel 5',
  grid5: 'Kachel 6',
};
// Alle Plätze (Sprache · Slot), die auf eine der übergebenen Referenzen zeigen.
function usageOf(...refs) {
  const set = refs.filter(Boolean);
  const out = [];
  if (!set.length) return out;
  for (const lang of MEDIA_LANGS) {
    for (const key of MEDIA_KEYS) {
      if (set.includes(getMediaVal(lang, key))) {
        out.push(`${lang.toUpperCase()} · ${SLOT_LABELS[key] || key}`);
      }
    }
  }
  for (const slot of allImageSlots()) {
    if (set.includes(slot.get())) out.push(slot.label);
  }
  return out;
}
// Datei-Endung als Format-Badge (z.B. „WEBP").
function fileExt(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toUpperCase() : '';
}
// „wird verwendet in"-Zeile für eine Medien-Kachel.
function usageHtml(list) {
  if (!list.length) return '<div class="st" style="color:var(--muted)">↪ nicht zugewiesen</div>';
  return `<div class="st" style="color:var(--accent)" title="Zugewiesene Plätze">↪ ${esc(
    list.join(', '),
  )}</div>`;
}

// Server-Uploads getrennt nach Sprache laden ({ de, en, shared }).
export async function loadServerFiles() {
  const r = await api('/uploads');
  const d = (r.ok && r.data) || {};
  state.serverFiles = {
    de: Array.isArray(d.de) ? d.de : [],
    en: Array.isArray(d.en) ? d.en : [],
    shared: Array.isArray(d.shared) ? d.shared : [],
  };
}

// ============ TAB: Videos & Medien ============
const VIDEO_SLOTS = [
  { key: 'audio', label: 'Audio-Tools Sektion' },
  { key: 'image', label: 'Bild-Tools Sektion' },
  { key: 'diverse', label: 'Diverse Tools Sektion' },
];
// Diese Slots akzeptieren Video ODER Bild – die Seite rendert je nach
// Dateiendung automatisch <video> oder <img>.

export function objUrl(id) {
  if (state.objectUrls.has(id)) return state.objectUrls.get(id);
  const item = state.stagedItems.find((x) => x.id === id);
  if (!item) return '';
  const u = URL.createObjectURL(item.blob);
  state.objectUrls.set(id, u);
  return u;
}

function slotPreview(val) {
  if (!val) return '';
  if (val.startsWith('staged:')) {
    const id = val.slice(7);
    const item = state.stagedItems.find((x) => x.id === id);
    if (!item) return '<span class="hint">Lokales Medium nicht gefunden</span>';
    const u = objUrl(id);
    const tag = /^video\//.test(item.type)
      ? `<video src="${u}" muted style="max-width:220px;border-radius:6px"></video>`
      : `<img src="${u}" style="max-width:220px;border-radius:6px" />`;
    return `${tag}<p class="st local">● lokal – wird beim Veröffentlichen hochgeladen (${esc(item.name)})</p>`;
  }
  const isVid = /\.(mp4|webm|mov|ogg)$/i.test(val);
  const tag = isVid
    ? `<video src="${esc(val)}" muted style="max-width:220px;border-radius:6px"></video>`
    : `<img src="${esc(val)}" style="max-width:220px;border-radius:6px" onerror="this.style.display='none'" />`;
  // data-slotstatus: nach dem Rendern prüfen wir, ob die /uploads-Datei
  // wirklich auf dem Server liegt (sonst zeigt der Slot fälschlich „ok").
  return `${tag}<p class="st pub" data-slotstatus="${esc(val)}">● ${esc(val)}</p>`;
}

// Prüft nach dem Rendern, ob referenzierte /uploads-Dateien serverseitig
// existieren. Fehlt eine, wird eine deutliche Warnung eingeblendet — so sieht
// der Admin sofort, dass der Slot zwar gesetzt, die Datei aber weg ist.
async function verifyPublishedSlots(pane) {
  const nodes = pane.querySelectorAll('[data-slotstatus]');
  for (const el of nodes) {
    const url = el.dataset.slotstatus;
    if (!/^\/uploads\//.test(url)) continue; // nur hochgeladene Medien prüfen
    let ok;
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      ok = r.ok;
    } catch {
      ok = false;
    }
    if (!ok && el.isConnected) {
      el.insertAdjacentHTML(
        'afterend',
        '<p class="st" style="color:#f87171;font-weight:600">⚠ Datei fehlt auf dem Server – bitte über „📁 Aus Zwischenspeicher wählen" neu zuweisen und veröffentlichen.</p>',
      );
    }
  }
}

// Verlinkung eines Hero-Mediums (Banner oder Rasterbild) lesen/schreiben.
function heroLinkVal(lang, key) {
  if (key === 'heroBanner') return state.media[lang].heroBannerLink || '';
  const g = /^grid([0-2])$/.exec(key);
  if (g) return (state.media[lang].heroGridLinks || [])[+g[1]] || '';
  return '';
}
function setHeroLink(lang, key, val) {
  if (key === 'heroBanner') {
    state.media[lang].heroBannerLink = val;
    return;
  }
  const g = /^grid([0-2])$/.exec(key);
  if (g) {
    if (!Array.isArray(state.media[lang].heroGridLinks))
      state.media[lang].heroGridLinks = ['', '', ''];
    state.media[lang].heroGridLinks[+g[1]] = val;
  }
}

// Ein einzelner Medien-Slot (Sprache + Schlüssel). data-Attribute kodieren
// "lang:key", damit die Bindings wissen, welche Sprache/welcher Slot gemeint ist.
// withLink=true blendet ein optionales Verlinkungsfeld ein (nur Banner/Raster).
function mediaSlotPanel(lang, key, { title, hint, placeholder, resetLabel, withLink }) {
  const val = getMediaVal(lang, key);
  const staged = val.startsWith('staged:');
  const id = `${lang}:${key}`;
  const linkField = withLink
    ? `
        <label style="margin-top:.6rem">🔗 Verlinkung (optional) — öffnet beim Klick auf das Medium</label>
        <input data-slotlink="${id}" value="${esc(heroLinkVal(lang, key))}" placeholder="https://… oder /faq/" />
        <p class="hint">Leer = nicht klickbar. Externe Links (http/https) öffnen in neuem Tab; interne Pfade (z.B. <code>/faq/</code>) im selben Tab.</p>`
    : '';
  return `
      <div class="panel">
        <h2>${title}</h2>
        <p class="hint">${hint}</p>
        ${slotPreview(val)}
        <label>Pfad/URL</label>
        <input data-slot="${id}" value="${esc(staged ? '' : val)}" placeholder="${esc(placeholder)}" ${staged ? 'disabled' : ''} />
        <div class="row" style="margin-top:.5rem">
          <button data-slotpick="${id}" style="flex:0 0 auto">📁 Aus Zwischenspeicher wählen</button>
          <button data-slotreset="${id}" style="flex:0 0 auto">${resetLabel}</button>
        </div>
        ${linkField}
      </div>`;
}

// Hero-Bereich einer Sprache: die Medien-Slots passend zum im Layout-Tab
// gewählten Modus/Layout. Anordnung, Form und Kachel-Design liegen im Layout-Tab.
function heroPanel(lang) {
  const mode = state.media[lang].heroMode === 'grid' ? 'grid' : 'banner';
  const info = `
      <div class="panel">
        <h2>Hero-Bereich (oben auf der Seite)</h2>
        <p class="hint">Anordnung, Form &amp; Kachel-Design stellst du im Tab <strong>Layout</strong> ein.
          Hier weist du den Plätzen die Bilder/Videos zu.</p>
      </div>`;
  if (mode === 'grid') {
    const layout = Object.prototype.hasOwnProperty.call(HERO_LAYOUTS, state.media[lang].heroLayout)
      ? state.media[lang].heroLayout
      : 'grid3';
    const cellsN = heroLayoutCells(layout);
    const isMosaic = layout === 'mosaic';
    const cells = Array.from({ length: cellsN }, (_, i) =>
      mediaSlotPanel(lang, 'grid' + i, {
        title: isMosaic && i === 0 ? 'Große Kachel (links)' : `Kachel ${i + 1}`,
        hint: 'Wird im Raster oben angezeigt. Leer = Feld bleibt frei.',
        placeholder: '/uploads/bild.jpg',
        resetLabel: '↺ Entfernen',
        withLink: true,
      }),
    ).join('');
    return info + cells;
  }
  return (
    info +
    mediaSlotPanel(lang, 'heroBanner', {
      title: 'Banner (ein Bild oder Video)',
      hint: 'Erscheint ganz oben im Hero-Bereich. Bild oder Video. Leer lassen = kein Banner. 📐 Empfohlen: breites Format, ca. 1800 × 480 px (Anzeige bis 900 × 240 px).',
      placeholder: '/uploads/mein-banner.jpg',
      resetLabel: '↺ Entfernen',
      withLink: true,
    })
  );
}

// Medien-Gruppe einer Sprache: Überschrift + Hero-Bereich + drei Sektions-Slots.
function renderLangMedia(lang) {
  const head = lang === 'de' ? '🇩🇪 Deutsche Startseite' : '🇬🇧 English homepage';
  const forWhich = lang === 'de' ? 'deutsche' : 'englische';
  const header = `
      <div class="panel" style="border-color:var(--accent);background:var(--panel-2)">
        <h2 style="margin:.1rem 0">${head}</h2>
        <p class="hint">Diese Medien gelten nur für die ${forWhich} Startseite.</p>
      </div>`;
  const slots = VIDEO_SLOTS.map((s) =>
    mediaSlotPanel(lang, s.key, {
      title: 'Medium: ' + s.label,
      hint: 'Video oder Bild – wird je nach Datei automatisch passend angezeigt.',
      placeholder: defMediaVal(s.key),
      resetLabel: '↺ Standard',
    }),
  ).join('');
  return header + heroPanel(lang) + slots;
}

const LOC_LABEL = { de: 'DE', en: 'EN', '': 'Gemeinsam' };

// Kacheln für Server-Dateien (Verschieben in andere Sprache + Löschen).
// loc = aktueller Ordner der Dateien ('de' | 'en' | '' = gemeinsam).
function fileTilesHtml(files, loc) {
  if (!files.length) return '<p class="hint">Keine Dateien.</p>';
  const targets = loc === 'de' ? ['en', ''] : loc === 'en' ? ['de', ''] : ['de', 'en'];
  return files
    .map((f) => {
      const isVid = /\.(mp4|webm|mov|ogg)$/i.test(f.name);
      const media = isVid
        ? `<video src="${esc(f.url)}" muted></video>`
        : `<img src="${esc(f.url)}" alt="" loading="lazy" />`;
      const moveBtns = targets
        .map(
          (t) =>
            `<button data-srvmove="${esc(f.path)}" data-tolang="${t}" style="flex:1;padding:.2rem;font-size:.68rem">→ ${LOC_LABEL[t]}</button>`,
        )
        .join('');
      const ext = fileExt(f.name);
      const usage = usageOf(f.url, '/uploads/' + f.path);
      return `<div class="media-tile">
        ${media}
        <div class="nm">${esc(f.name)}</div>
        <div class="st pub">✓ Server${ext ? ' · ' + ext : ''} · ${fmtBytes(f.bytes)}</div>
        ${usageHtml(usage)}
        <div class="row" style="gap:.25rem;margin-top:.35rem">${moveBtns}</div>
        <button class="danger" data-srvdel="${esc(f.path)}" data-srvurl="${esc(f.url)}" style="margin-top:.25rem;width:100%;padding:.2rem;font-size:.72rem">Löschen</button>
      </div>`;
    })
    .join('');
}

// Server-Dateien EINER Sprache (+ ggf. gemeinsame Altdateien).
function serverFilesPanel(lang) {
  const langLabel = lang === 'de' ? 'Deutsch' : 'English';
  const langFiles = state.serverFiles[lang] || [];
  const shared = state.serverFiles.shared || [];
  const sharedBlock = shared.length
    ? `
    <div class="panel">
      <h2>📂 Gemeinsame Dateien (ohne Sprache)</h2>
      <p class="hint">Ältere Uploads ohne Sprach-Zuordnung (direkt unter <code>/uploads/</code>).
        Mit „→ DE" / „→ EN" einer Sprache zuordnen (verschieben) oder direkt zuweisen.</p>
      <div class="media-grid">${fileTilesHtml(shared, '')}</div>
    </div>`
    : '';
  return `
    <div class="panel">
      <h2>📂 Dateien auf dem Server — ${langLabel}</h2>
      <p class="hint">Nur die für <strong>${langLabel}</strong> hochgeladenen Medien (unter <code>/uploads/${lang}/</code>) –
        so bleibt getrennt, was auf welche Seite kommt. Über „📁 Aus Zwischenspeicher wählen" bei einem Slot zuweisen.
        <strong>Löschen</strong> entfernt sofort; dauerhaft (auch aus Git) beim nächsten <strong>Veröffentlichen</strong>.</p>
      <div class="media-grid">${fileTilesHtml(langFiles, lang)}</div>
    </div>${sharedBlock}`;
}

// Medien EINER Sprache (Banner + Sektions-Slots) im Bereich #content.
export function renderMedia() {
  const lang = state.nav.section;
  const pane = $('#content');
  pane.innerHTML = renderLangMedia(lang);
  // Anordnung/Form (heromode/herolayout/gridratio/gridfit) liegen jetzt im Layout-Tab.
  pane.querySelectorAll('[data-slot]').forEach((el) =>
    el.addEventListener('input', () => {
      const [l, key] = el.dataset.slot.split(':');
      const v = el.value.trim();
      setMediaVal(l, key, v || defMediaVal(key));
    }),
  );
  pane.querySelectorAll('[data-slotreset]').forEach((el) =>
    el.addEventListener('click', () => {
      const [l, key] = el.dataset.slotreset.split(':');
      setMediaVal(l, key, defMediaVal(key));
      renderMedia();
    }),
  );
  pane.querySelectorAll('[data-slotpick]').forEach((el) =>
    el.addEventListener('click', () => {
      const [l, key] = el.dataset.slotpick.split(':');
      pickFromLibrary(l, key);
    }),
  );
  pane.querySelectorAll('[data-slotlink]').forEach((el) =>
    el.addEventListener('input', () => {
      const [l, key] = el.dataset.slotlink.split(':');
      setHeroLink(l, key, el.value.trim());
    }),
  );

  verifyPublishedSlots(pane);
}

// Bereich „Dateien" EINER Sprache: Server-Dateien + Browser-Zwischenspeicher.
export function renderFiles() {
  const lang = state.nav.section;
  const langLabel = lang === 'de' ? 'Deutsch' : 'English';
  const pane = $('#content');
  const tiles = state.stagedItems.length
    ? state.stagedItems.map(mediaTile).join('')
    : '<p class="hint">Noch nichts im Zwischenspeicher. Dateien unten hineinziehen oder auswählen.</p>';

  pane.innerHTML = `
    ${serverFilesPanel(lang)}
    <div class="panel">
      <h2>Medien-Zwischenspeicher (Browser)</h2>
      <p class="hint">Neue Dateien hier ablegen und dann bei einem <strong>${langLabel}</strong>-Slot zuweisen.
        Beim <strong>Veröffentlichen</strong> landen sie automatisch im ${langLabel}-Ordner
        (<code>/uploads/${lang}/</code>). Der Zwischenspeicher ist gemeinsam – die Sprache
        ergibt sich aus dem Slot, dem du die Datei zuweist.</p>
      <div class="dropzone" id="dropzone">
        Dateien hierher ziehen oder
        <label style="display:inline;color:var(--accent);cursor:pointer;text-decoration:underline">
          auswählen<input type="file" id="fileInput" accept="image/*,video/*" multiple style="display:none" />
        </label>
      </div>
      <div class="media-grid">${tiles}</div>
    </div>`;

  pane.querySelectorAll('[data-srvdel]').forEach((el) =>
    el.addEventListener('click', async () => {
      const path = el.dataset.srvdel;
      const used = usageOf(el.dataset.srvurl, '/uploads/' + path);
      const msg = used.length
        ? `⚠ Diese Datei wird noch verwendet in:\n• ${used.join('\n• ')}\n\n` +
          `Trotzdem löschen? Die betroffenen Plätze zeigen dann kein Medium mehr.`
        : `Datei „${path}" vom Server löschen?`;
      if (!confirm(msg)) return;
      const r = await api('/uploads/delete', { method: 'POST', body: { path } });
      if (!r.ok) {
        toast('Löschen fehlgeschlagen: ' + (r.data?.error || r.status));
        return;
      }
      await loadServerFiles();
      renderFiles();
      toast('Gelöscht – dauerhaft beim nächsten Veröffentlichen');
    }),
  );
  pane.querySelectorAll('[data-srvmove]').forEach((el) =>
    el.addEventListener('click', async () => {
      const path = el.dataset.srvmove;
      const lang = el.dataset.tolang; // '' | 'de' | 'en'
      const r = await api('/uploads/move', { method: 'POST', body: { path, lang } });
      if (!r.ok) {
        toast('Verschieben fehlgeschlagen: ' + (r.data?.error || r.status));
        return;
      }
      // Verweise in den Slots mitziehen (alte URL -> neue URL).
      updateMediaUrlEverywhere('/uploads/' + path, r.data.url);
      await loadServerFiles();
      renderFiles();
      toast(`Verschoben nach „${LOC_LABEL[lang]}" – zum Übernehmen veröffentlichen`);
    }),
  );
  pane.querySelectorAll('[data-mediadel]').forEach((el) =>
    el.addEventListener('click', async () => {
      if (
        parseInt(el.dataset.used, 10) > 0 &&
        !confirm(
          '⚠ Dieses Medium ist einem Platz zugewiesen. Wirklich aus dem Zwischenspeicher ' +
            'entfernen? Der zugewiesene Platz verliert dann sein Medium.',
        )
      )
        return;
      await mediaDel(el.dataset.mediadel);
      state.stagedItems = await mediaAll();
      renderFiles();
    }),
  );

  const dz = $('#dropzone');
  const fi = $('#fileInput');
  fi.addEventListener('change', () => addFiles(fi.files));
  ['dragover', 'dragenter'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add('drag');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove('drag');
    }),
  );
  dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
}

function mediaTile(item) {
  const u = objUrl(item.id);
  const tag = /^video\//.test(item.type)
    ? `<video src="${u}" muted></video>`
    : `<img src="${u}" />`;
  const status = item.publishedUrl
    ? `<div class="st pub">✓ veröffentlicht</div>`
    : `<div class="st local">● nur lokal</div>`;
  const ext = fileExt(item.name);
  const size = item.blob ? fmtBytes(item.blob.size) : '';
  const meta = [ext, size].filter(Boolean).join(' · ');
  const usage = usageOf('staged:' + item.id, item.publishedUrl);
  return `<div class="media-tile">
    ${tag}
    <div class="nm">${esc(item.name)}</div>
    ${meta ? `<div class="st" style="color:var(--muted)">${esc(meta)}</div>` : ''}
    ${status}
    ${usageHtml(usage)}
    <button class="danger" data-mediadel="${item.id}" data-used="${usage.length}" style="margin-top:.35rem;width:100%;padding:.2rem;font-size:.72rem">Entfernen</button>
  </div>`;
}

// Legt EINE Datei (File/Blob) im Browser-Zwischenspeicher (IndexedDB) ab und
// liefert die neue Kennung – Slot-Wert dann 'staged:<id>'. Wird auch von anderen
// Tabs genutzt (z. B. Layout: Bild aus der Zwischenablage in eine Kachel).
// Aktualisiert state.stagedItems, rendert aber KEINE Ansicht neu.
export async function stageFile(file, name) {
  const item = {
    id: 'm' + Date.now() + Math.random().toString(36).slice(2, 7),
    name: name || file.name || 'datei',
    type: file.type || 'application/octet-stream',
    blob: file,
    createdAt: Date.now(),
    publishedUrl: null,
  };
  await mediaPut(item);
  state.stagedItems = await mediaAll();
  return item.id;
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const f of files) {
    const maxBytes = 2048 * 1024 * 1024;
    if (f.size > maxBytes) {
      toast(`${f.name} zu groß`);
      continue;
    }
    await stageFile(f);
  }
  state.stagedItems = await mediaAll();
  renderFiles();
  if (files.length) toast(`${files.length} Datei(en) im Zwischenspeicher`);
}

function pickFromLibrary(lang, key) {
  const srv = (state.serverFiles[lang] || []).length + (state.serverFiles.shared || []).length;
  if (!state.stagedItems.length && !srv) {
    toast('Keine Medien vorhanden — zuerst eine Datei hinzufügen.');
    return;
  }
  openMediaPicker(lang, key);
}

// Anklickbares Auswahlfenster: zeigt die Server-Dateien DIESER Sprache (+
// gemeinsame) UND den Browser-Zwischenspeicher. Kachel klicken -> zuweisen.
// opts (optional, für andere Tabs wie den Seiten-Hintergrund):
//   onPick(url)  statt Slot-Zuweisung aufrufen (url = Server-URL oder 'staged:<id>')
//   allLangs     Dateien aller Sprachen anzeigen (global genutztes Medium)
//   imagesOnly   nur Bilder anbieten (keine Videos)
//   title        Fenstertitel
export function openMediaPicker(lang, key, opts = {}) {
  document.getElementById('mediaPicker')?.remove();
  const isVideoName = (name) => /\.(mp4|webm|mov|ogg)$/i.test(name);
  const items = opts.imagesOnly
    ? state.stagedItems.filter((i) => !/^video\//.test(i.type) && !isVideoName(i.name))
    : state.stagedItems;

  const langs = opts.allLangs ? ['de', 'en', 'shared'] : [lang, 'shared'];
  let serverList = langs.flatMap((l) => state.serverFiles[l] || []);
  if (opts.imagesOnly) serverList = serverList.filter((f) => !isVideoName(f.name));
  const serverTiles = serverList
    .map((f) => {
      const media = /\.(mp4|webm|mov|ogg)$/i.test(f.name)
        ? `<video src="${esc(f.url)}" muted></video>`
        : `<img src="${esc(f.url)}" alt="" />`;
      return `<button type="button" class="picker-tile" data-picksrv="${esc(f.url)}">
        ${media}<div class="nm">${esc(f.name)}</div><div class="st pub">✓ auf Server</div>
      </button>`;
    })
    .join('');

  const stagedTiles = items
    .map((item) => {
      const u = objUrl(item.id);
      const media = /^video\//.test(item.type)
        ? `<video src="${u}" muted></video>`
        : `<img src="${u}" alt="" />`;
      const st = item.publishedUrl
        ? '<div class="st pub">✓ veröffentlicht</div>'
        : '<div class="st local">● nur lokal</div>';
      return `<button type="button" class="picker-tile" data-pick="${item.id}">
        ${media}<div class="nm">${esc(item.name)}</div>${st}
      </button>`;
    })
    .join('');

  const section = (title, tiles, empty) =>
    `<h4 style="margin:.75rem 0 .35rem">${title}</h4>` +
    (tiles ? `<div class="media-grid">${tiles}</div>` : `<p class="hint">${empty}</p>`);

  const overlay = document.createElement('div');
  overlay.className = 'picker-overlay';
  overlay.id = 'mediaPicker';
  overlay.innerHTML = `
    <div class="picker-modal" role="dialog" aria-modal="true">
      <h3>${esc(opts.title || 'Medium auswählen')}</h3>
      <p class="hint" style="margin-bottom:.25rem">Auf eine Datei klicken, um sie diesem Platz zuzuweisen.</p>
      ${section('📂 Auf dem Server', serverTiles, 'Noch nichts auf dem Server.')}
      ${section('🖥️ Zwischenspeicher (Browser)', stagedTiles, 'Zwischenspeicher leer.')}
      <div class="row" style="margin-top:1rem;justify-content:flex-end">
        <button type="button" data-pickcancel style="flex:0 0 auto">Abbrechen</button>
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
    if (e.target === overlay) close(); // Klick auf den abgedunkelten Hintergrund
  });
  overlay.querySelector('[data-pickcancel]').addEventListener('click', close);
  const assign = (url) => {
    if (opts.onPick) opts.onPick(url);
    else {
      setMediaVal(lang, key, url);
      renderMedia();
    }
  };
  overlay.querySelectorAll('[data-pick]').forEach((el) =>
    el.addEventListener('click', () => {
      const item = items.find((x) => x.id === el.dataset.pick);
      if (item) assign(item.publishedUrl || 'staged:' + item.id);
      close();
    }),
  );
  overlay.querySelectorAll('[data-picksrv]').forEach((el) =>
    el.addEventListener('click', () => {
      assign(el.dataset.picksrv); // direkt die Server-URL zuweisen
      close();
    }),
  );
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}
