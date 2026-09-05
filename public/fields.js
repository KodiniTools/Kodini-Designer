// Tab „Felder“: manifestgesteuerter Editor für Websites ohne Home-Vertrag
// (z. B. Tool-Apps). Das Profil-Manifest liefert:
//   - slots:   Text-Slots (Text je Sprache + Design: Schrift, Größe, Gewicht,
//              Abstand, Schreibweise, Farbe Hell/Dunkel)
//   - groups:  einfache Felder (Titel/Meta, Farben der App …)
//   - preview: HTML-Vorlage der App (sticky Live-Vorschau) + Zuordnung
//              CSS-Variable -> Feldpfad (Farben der App)
// Werte kommen aus der im Profil genannten JSON-Datei; leer = Standard der App.

import { $, esc, toast, fmtBytes } from './core.js';
import { state } from './model.js';
import { slider, bindSliders } from './slider.js';
import { colorPicker, bindColorPickers } from './color.js';
import { fontOptionsHtml, ensureFontFace } from './fonts.js';
import { objUrl, openMediaPicker, stageFile } from './media.js';

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;
const WEIGHT_LABELS = {
  300: 'Leicht (300)',
  400: 'Normal (400)',
  500: 'Mittel (500)',
  600: 'Halbfett (600)',
  700: 'Fett (700)',
  800: 'Extrafett (800)',
};
const TRANSFORM_LABELS = {
  uppercase: 'GROSSBUCHSTABEN',
  lowercase: 'kleinbuchstaben',
  capitalize: 'Wortanfänge Groß',
};
const LANG_LABELS = { de: '🇩🇪 Deutsch', en: '🇬🇧 English' };

function toHex6(v) {
  if (HEX6.test(v)) return v.toLowerCase();
  if (HEX3.test(v)) return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
  return '';
}
const g = () => state.generic;
const val = (path) => g()?.values?.[path] ?? '';
const isSet = (v) => v !== '' && v !== false && v !== undefined && v !== null;
function setVal(path, v) {
  if (!g()) return;
  g().values[path] = v;
  refreshDefaultMarks($('#content'));
  updatePreview($('#content'));
}
// Vorschau-Zustand (überlebt ein Neu-Rendern des Tabs).
const ui = { theme: 'light', lang: '', active: '' };

// --- Slot-Hilfen ---
function slotTextPath(slot, lang) {
  return slot.textPath.replaceAll('{lang}', lang);
}
function slotStyle(slot) {
  const sp = slot.stylePath;
  const num = (v) => (v === '' ? 0 : Number(v) || 0);
  return {
    font: val(`${sp}.font`),
    size: num(val(`${sp}.size`)),
    weight: val(`${sp}.weight`),
    spacing: num(val(`${sp}.spacing`)),
    transform: val(`${sp}.transform`),
    colorLight: val(`${sp}.colorLight`),
    colorDark: val(`${sp}.colorDark`),
  };
}
// Inline-Style eines Slots für die Vorschau (nur gesetzte Werte).
function slotInlineStyle(slot, theme) {
  const st = slotStyle(slot);
  const p = [];
  if (st.font) p.push(`font-family:'${ensureFontFace(st.font)}', system-ui, sans-serif`);
  if (st.size > 0) p.push(`font-size:${st.size}px`);
  if (st.weight) p.push(`font-weight:${st.weight}`);
  if (st.spacing) p.push(`letter-spacing:${st.spacing}px`);
  if (st.transform) p.push(`text-transform:${st.transform}`);
  const col = theme === 'dark' ? st.colorDark : st.colorLight;
  if (col) p.push(`color:${col}`);
  return p.join(';');
}

// Bild-URL für die Vorschau (staged:<id> -> Objekt-URL des Browsers).
function imageUrl(v) {
  if (typeof v !== 'string' || !v) return '';
  return v.startsWith('staged:') ? objUrl(v.slice(7)) : v;
}

// --- Vorschau ---
// CSS-Variablen der Vorschau aus den Feldwerten; „kind“ der Variable bestimmt
// die Übersetzung (color | image | number | raw), leer = Platzhalter des Felds.
function previewVars(theme) {
  const vars = g()?.preview?.vars || {};
  const defaults = {};
  for (const f of (g()?.groups || []).flatMap((x) => x.fields))
    defaults[f.path] = f.placeholder || '';
  const out = [];
  for (const [name, m] of Object.entries(vars)) {
    const path = m.path || (theme === 'dark' ? m.dark : m.light) || m.light || m.dark;
    if (!path) continue;
    const raw = val(path);
    const cur = raw === '' || raw === undefined || raw === null ? defaults[path] || '' : raw;
    let v = '';
    switch (m.kind || 'color') {
      case 'image': {
        const u = imageUrl(cur);
        v = u ? `url("${u.replace(/["\\]/g, '')}")` : 'none';
        break;
      }
      case 'number': {
        const n = Number(cur);
        if (Number.isFinite(n)) v = `${n}${m.unit || ''}`;
        break;
      }
      case 'raw':
        v = String(cur).replace(/[;{}]/g, '');
        break;
      default:
        v = toHex6(cur) || '';
    }
    if (v) out.push(`${name}:${v}`);
  }
  return out.join(';');
}
function previewHtml() {
  const pv = g()?.preview;
  if (!pv || !pv.html) return '';
  const langs = g().langs || ['de'];
  if (!ui.lang || !langs.includes(ui.lang)) ui.lang = langs[0];
  const langBtns = langs
    .map(
      (l) =>
        `<button type="button" data-fldprevlang="${esc(l)}" class="${l === ui.lang ? 'primary' : ''}" style="flex:0 0 auto">${esc(LANG_LABELS[l] || l.toUpperCase())}</button>`,
    )
    .join('');
  return `
    <div data-fldsticky style="position:sticky;top:.5rem;z-index:5;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:.6rem .9rem;margin:0 0 .9rem;box-shadow:0 8px 22px rgba(0,0,0,.4);max-height:46vh;overflow:auto">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin:.1rem 0 .5rem">
        <span class="hint" style="margin:0">👁 Live-Vorschau — Element anklicken zum Bearbeiten:</span>
        <span style="display:inline-flex;gap:.3rem;margin-left:auto">${langBtns}</span>
        <span style="display:inline-flex;gap:.3rem">
          <button type="button" data-fldprevtheme="light" class="${ui.theme === 'light' ? 'primary' : ''}" style="flex:0 0 auto">☀️ Hell</button>
          <button type="button" data-fldprevtheme="dark" class="${ui.theme === 'dark' ? 'primary' : ''}" style="flex:0 0 auto">🌙 Dunkel</button>
        </span>
      </div>
      <div data-fldprev>${pv.html}</div>
    </div>`;
}
// Vorschau live aktualisieren (Texte, Slot-Design, App-Farben, Modus).
function updatePreview(pane) {
  const box = pane?.querySelector('[data-fldprev]');
  if (!box) return;
  const root = box.querySelector('[data-theme]') || box.firstElementChild;
  if (root) {
    root.setAttribute('data-theme', ui.theme);
    root.setAttribute('style', previewVars(ui.theme));
  }
  for (const slot of g().slots || []) {
    const el = box.querySelector(`[data-slot="${CSS.escape(slot.key)}"]`);
    if (!el) continue;
    const text = val(slotTextPath(slot, ui.lang)) || slot.placeholder[ui.lang] || '';
    el.textContent = text;
    el.setAttribute('style', slotInlineStyle(slot, ui.theme));
    el.classList.toggle('kdp-active', ui.active === slot.key);
    el.title = `${slot.label} bearbeiten`;
  }
}
function selectSlot(pane, key) {
  ui.active = key;
  pane.querySelectorAll('[data-fldslot]').forEach((el) => {
    el.style.boxShadow = el.dataset.fldslot === key ? '0 0 0 2px var(--accent)' : '';
  });
  updatePreview(pane);
}

// --- Felder ---
function resetBtn(path, disabled) {
  return `<button type="button" class="hd-reset" data-fldreset="${esc(path)}" ${disabled ? 'disabled' : ''} title="Auf Standard zurücksetzen (leer)" aria-label="Auf Standard zurücksetzen">↺</button>`;
}
function withReset(inner, path) {
  return `<div style="display:flex;gap:.3rem;align-items:flex-start">${inner}${resetBtn(path, false)}</div>`;
}
function defMark(path, set) {
  return `<span class="hint" data-flddef="${esc(path)}" style="margin:0 0 0 .4rem;font-size:.72rem">${set ? '' : '(Standard)'}</span>`;
}
function colorField(path, label, placeholder, suggest) {
  const v = val(path);
  const on = isSet(v);
  const shown = toHex6(v) || toHex6(placeholder || '') || suggest || '#000000';
  return `<div style="flex:0 0 auto"><label>${esc(label)}${defMark(path, on)}</label>
    <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:.35rem;margin:0;font-size:.8rem;color:var(--muted);cursor:pointer">
        <input type="checkbox" data-fldon="${esc(path)}" ${on ? 'checked' : ''} style="width:auto" /> eigene
      </label>
      ${colorPicker({ id: `fld:${path}`, attrs: `data-fld="${esc(path)}" data-fldtype="color"`, value: shown, disabled: !on, resetHtml: resetBtn(path, !on) })}
    </div></div>`;
}
function fieldHtml(f) {
  const v = val(f.path);
  const set = isSet(v);
  const hint = f.hint ? `<p class="hint" style="margin:.25rem 0 0">${esc(f.hint)}</p>` : '';
  const label = `<label>${esc(f.label)}${defMark(f.path, set)}</label>`;
  switch (f.type) {
    case 'textarea':
      return `<div style="flex:1 1 100%">${label}${withReset(`<textarea data-fld="${esc(f.path)}" rows="3" maxlength="${f.maxLength}" placeholder="${esc(f.placeholder || '')}" style="flex:1 1 auto;min-height:72px">${esc(v)}</textarea>`, f.path)}${hint}</div>`;
    case 'color':
      return colorField(f.path, f.label, f.placeholder, '');
    case 'number': {
      const n = v === '' ? Number(f.placeholder) : Number(v);
      return `<div style="flex:1 1 240px">${slider({ id: `fld:${f.path}`, label: f.label, hint: f.hint, unit: f.unit || '', min: f.min, max: f.max, step: f.step, value: Number.isFinite(n) ? n : f.min, attrs: `data-fld="${esc(f.path)}" data-fldtype="number"`, resetAttrs: `data-fldreset="${esc(f.path)}"` })}${defMark(f.path, set)}</div>`;
    }
    case 'select':
      return `<div style="flex:0 0 auto">${label}${withReset(`<select data-fld="${esc(f.path)}" style="width:auto;height:38px"><option value="">Standard${f.placeholder ? ` (${esc(f.placeholder)})` : ''}</option>${f.options.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`, f.path)}${hint}</div>`;
    case 'font':
      return `<div style="flex:1 1 220px">${label}${withReset(`<select data-fld="${esc(f.path)}" data-fldtype="font" style="${v ? `font-family:'${ensureFontFace(v)}', system-ui, sans-serif` : ''}">${fontOptionsHtml(v)}</select>`, f.path)}${hint}</div>`;
    case 'image':
      return imageField(f, v);
    case 'toggle':
      return `<div style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:.4rem;margin:0;cursor:pointer;height:38px"><input type="checkbox" data-fld="${esc(f.path)}" data-fldtype="toggle" ${v === true ? 'checked' : ''} style="width:auto" /> ${esc(f.label)}</label>${hint}</div>`;
    default:
      return `<div style="flex:1 1 320px">${label}${withReset(`<input type="text" data-fld="${esc(f.path)}" value="${esc(v)}" maxlength="${f.maxLength}" placeholder="${esc(f.placeholder || '')}" style="flex:1 1 auto" />`, f.path)}${hint}</div>`;
  }
}

// Bildfeld: Vorschaukachel, Mediathek/Datei/Zwischenablage, URL-Eingabe,
// „Entfernen“ (= Standard). Lokale Dateien werden als 'staged:<id>' gehalten und
// beim Speichern hochgeladen (publish.js: uploadStagedFields).
function imageField(f, v) {
  const staged = typeof v === 'string' && v.startsWith('staged:');
  const item = staged ? state.stagedItems.find((x) => x.id === v.slice(7)) : null;
  const url = imageUrl(v);
  const thumb = url
    ? `<img src="${esc(url)}" alt="" />`
    : '<span class="hint" style="margin:0;font-size:.72rem">kein Bild</span>';
  const status = staged
    ? `<p class="hint" style="margin:.25rem 0 0">Lokal: ${esc(item ? `${item.name}${item.blob ? ` · ${fmtBytes(item.blob.size)}` : ''}` : 'Medium nicht gefunden')} – wird beim Speichern hochgeladen</p>`
    : '';
  const hint = f.hint ? `<p class="hint" style="margin:.25rem 0 0">${esc(f.hint)}</p>` : '';
  return `<div style="flex:1 1 100%" data-fldimage="${esc(f.path)}">
    <label>${esc(f.label)}${defMark(f.path, isSet(v))}</label>
    <div class="row" style="align-items:flex-start;margin:0">
      <div class="bg-thumb" data-fldimgthumb="${esc(f.path)}">${thumb}</div>
      <div style="flex:1 1 260px">
        <div class="row" style="margin:0">
          <button type="button" data-fldimgpick="${esc(f.path)}" style="flex:0 0 auto">📂 Aus Mediathek wählen</button>
          <button type="button" data-fldimgfilebtn="${esc(f.path)}" style="flex:0 0 auto">⬆️ Datei wählen</button>
          <input type="file" accept="image/*" data-fldimgfile="${esc(f.path)}" style="display:none" />
          <button type="button" class="danger" data-fldreset="${esc(f.path)}" ${isSet(v) ? '' : 'disabled'} style="flex:0 0 auto">Entfernen</button>
        </div>
        <label style="margin-top:.5rem">Bild-URL <span class="hint" style="margin:0">(z.B. /uploads/… oder https://…; Bild aus der Zwischenablage hier einfügen)</span></label>
        <input type="text" data-fld="${esc(f.path)}" data-fldtype="image" value="${esc(staged ? '' : v)}" placeholder="${staged ? 'Lokales Medium (wird beim Speichern hochgeladen)' : '/uploads/…'}" />
        ${status}${hint}
      </div>
    </div>
  </div>`;
}

// Karte eines Text-Slots: Text je Sprache + Design (Schrift, Größe, Gewicht,
// Abstand, Schreibweise, Farbe Hell/Dunkel) mit „↺ Slot“ für alles.
function slotCard(slot) {
  const langs = g().langs || ['de'];
  const sp = slot.stylePath;
  const st = slotStyle(slot);
  const sizeDef = slot.defaultSize ? ` (Standard ${slot.defaultSize} px)` : '';
  const texts = langs
    .map((l) => {
      const path = slotTextPath(slot, l);
      const v = val(path);
      const ph = slot.placeholder[l] || '';
      const input =
        slot.type === 'textarea'
          ? `<textarea data-fld="${esc(path)}" data-fldslot-input="${esc(slot.key)}" rows="2" maxlength="${slot.maxLength}" placeholder="${esc(ph)}" style="flex:1 1 auto;min-height:56px">${esc(v)}</textarea>`
          : `<input type="text" data-fld="${esc(path)}" data-fldslot-input="${esc(slot.key)}" value="${esc(v)}" maxlength="${slot.maxLength}" placeholder="${esc(ph)}" style="flex:1 1 auto" />`;
      return `<div style="flex:1 1 280px"><label>${esc(LANG_LABELS[l] || l.toUpperCase())}${defMark(path, isSet(v))}</label>${withReset(input, path)}</div>`;
    })
    .join('');
  const weightSel = `<select data-fld="${esc(sp)}.weight" style="width:auto;height:38px"><option value="">Standard</option>${['300', '400', '500', '600', '700', '800'].map((w) => `<option value="${w}" ${w === st.weight ? 'selected' : ''}>${WEIGHT_LABELS[w]}</option>`).join('')}</select>`;
  const transSel = `<select data-fld="${esc(sp)}.transform" style="width:auto;height:38px"><option value="">Standard</option>${['uppercase', 'lowercase', 'capitalize'].map((t) => `<option value="${t}" ${t === st.transform ? 'selected' : ''}>${TRANSFORM_LABELS[t]}</option>`).join('')}</select>`;
  return `
    <div class="panel" data-fldslot="${esc(slot.key)}" style="scroll-margin-top:50vh${ui.active === slot.key ? ';box-shadow:0 0 0 2px var(--accent)' : ''}">
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <h2 style="margin:0">${esc(slot.label)}</h2>
        <span class="hint" style="margin:0">Schlüssel <code>${esc(slot.key)}</code></span>
        <button type="button" class="hd-reset" data-fldslotreset="${esc(slot.key)}" title="Text und Design dieses Slots auf Standard zurücksetzen" style="margin-left:auto">↺ Slot</button>
      </div>
      <div class="row" style="align-items:flex-start;margin-top:.5rem">${texts}</div>
      <h3 style="font-size:.85rem;margin:.9rem 0 .3rem;color:var(--muted)">🔠 Design (gilt für alle Sprachen)</h3>
      <div class="row" style="align-items:flex-end">
        <div style="flex:1 1 220px"><label>Schriftart${defMark(`${sp}.font`, !!st.font)}</label>${withReset(`<select data-fld="${esc(sp)}.font" data-fldtype="font" style="${st.font ? `font-family:'${ensureFontFace(st.font)}', system-ui, sans-serif` : ''}">${fontOptionsHtml(st.font)}</select>`, `${sp}.font`)}</div>
        <div style="flex:1 1 220px">${slider({ id: `fld:${sp}.size`, label: `Größe${sizeDef}`, unit: 'px', min: 0, max: 96, step: 1, value: st.size, attrs: `data-fld="${esc(sp)}.size" data-fldtype="number"`, resetAttrs: `data-fldreset="${esc(sp)}.size"` })}${defMark(`${sp}.size`, st.size > 0)}</div>
        <div style="flex:0 0 auto"><label>Gewicht${defMark(`${sp}.weight`, !!st.weight)}</label>${withReset(weightSel, `${sp}.weight`)}</div>
      </div>
      <div class="row" style="align-items:flex-end;margin-top:.4rem">
        <div style="flex:1 1 220px">${slider({ id: `fld:${sp}.spacing`, label: 'Buchstabenabstand', unit: 'px', min: -2, max: 10, step: 0.5, value: st.spacing, attrs: `data-fld="${esc(sp)}.spacing" data-fldtype="number"`, resetAttrs: `data-fldreset="${esc(sp)}.spacing"` })}${defMark(`${sp}.spacing`, st.spacing !== 0)}</div>
        <div style="flex:0 0 auto"><label>Schreibweise${defMark(`${sp}.transform`, !!st.transform)}</label>${withReset(transSel, `${sp}.transform`)}</div>
        ${colorField(`${sp}.colorLight`, 'Farbe Hell', '', '#1a1f26')}
        ${colorField(`${sp}.colorDark`, 'Farbe Dunkel', '', '#e6edf3')}
      </div>
    </div>`;
}

function refreshDefaultMarks(pane) {
  if (!pane) return;
  pane.querySelectorAll('[data-flddef]').forEach((el) => {
    const v = val(el.dataset.flddef);
    const num = el.dataset.flddef.endsWith('.size') || el.dataset.flddef.endsWith('.spacing');
    el.textContent = !isSet(v) || (num && Number(v) === 0) ? '(Standard)' : '';
  });
}

export function renderFields() {
  const pane = $('#content');
  const gen = g();
  if (!gen || (!Array.isArray(gen.groups) && !Array.isArray(gen.slots))) {
    pane.innerHTML = '<div class="panel"><p class="hint">Dieses Profil hat keine Felder.</p></div>';
    return;
  }
  const prof = state.profile || {};
  const slots = gen.slots || [];
  const groups = gen.groups || [];
  pane.innerHTML = `
    ${previewHtml()}
    <div class="panel">
      <h2>Felder <span class="lang-badge">${esc(prof.name || prof.id || '')}</span></h2>
      <p class="hint">Jeder Text-Slot hat Text je Sprache und eigenes Design. Leer bzw. „(Standard)“ = eingebauter Wert der Website.
        Speichern schreibt die Datei der Website; „Vorschau“ baut sie, „Veröffentlichen“ committet, pusht und deployt.</p>
    </div>
    ${slots.map(slotCard).join('')}
    ${groups
      .map(
        (grp) => `
      <div class="panel">
        <h2>${esc(grp.title)}</h2>
        <div class="row" style="align-items:flex-start;gap:1rem">${grp.fields.map(fieldHtml).join('')}</div>
      </div>`,
      )
      .join('')}`;

  // Eingaben -> Werte (+ Live-Vorschau)
  pane.querySelectorAll('[data-fld]').forEach((el) => {
    const path = el.dataset.fld;
    const type = el.dataset.fldtype || (el.tagName === 'SELECT' ? 'select' : 'text');
    const ev = el.tagName === 'SELECT' || type === 'image' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      if (type === 'image') {
        setVal(path, el.value.trim());
        renderFields();
      } else if (type === 'toggle') setVal(path, el.checked);
      else if (type === 'number') setVal(path, String(el.value));
      else if (type === 'color') setVal(path, el.value.toLowerCase());
      else if (type === 'font') {
        setVal(path, el.value);
        el.setAttribute(
          'style',
          el.value ? `font-family:'${ensureFontFace(el.value)}', system-ui, sans-serif` : '',
        );
      } else setVal(path, el.value);
    });
    const slotKey = el.dataset.fldslotInput || el.closest('[data-fldslot]')?.dataset.fldslot;
    if (slotKey) el.addEventListener('focus', () => selectSlot(pane, slotKey));
  });
  // Farben: An-Schalter „eigene“ (aus = Standard = '').
  pane.querySelectorAll('[data-fldon]').forEach((cb) => {
    const path = cb.dataset.fldon;
    cb.addEventListener('change', () => {
      if (cb.checked) {
        const nat = pane.querySelector(`[data-fld="${CSS.escape(path)}"]`);
        setVal(path, (nat && nat.value.toLowerCase()) || '#000000');
      } else setVal(path, '');
      renderFields();
    });
  });
  // Bildfelder: Mediathek, Datei-Dialog, Zwischenablage (Einfügen im URL-Feld).
  const setImage = (path, value, msg) => {
    setVal(path, value);
    renderFields();
    if (msg) toast(msg);
  };
  pane.querySelectorAll('[data-fldimgpick]').forEach((btn) => {
    const path = btn.dataset.fldimgpick;
    btn.addEventListener('click', () =>
      openMediaPicker('de', 'fld:' + path, {
        imagesOnly: true,
        allLangs: true,
        title: 'Bild wählen',
        onPick: (url) => setImage(path, url, 'Bild übernommen'),
      }),
    );
  });
  pane.querySelectorAll('[data-fldimgfilebtn]').forEach((btn) => {
    const path = btn.dataset.fldimgfilebtn;
    btn.addEventListener('click', () =>
      pane.querySelector(`[data-fldimgfile="${CSS.escape(path)}"]`)?.click(),
    );
  });
  pane.querySelectorAll('[data-fldimgfile]').forEach((inp) => {
    const path = inp.dataset.fldimgfile;
    inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) return toast('Bitte eine Bilddatei wählen');
      const id = await stageFile(file);
      setImage(path, 'staged:' + id, `${file.name} übernommen (lokal)`);
    });
  });
  pane.querySelectorAll('[data-fldimage] [data-fldtype="image"]').forEach((inp) => {
    const path = inp.closest('[data-fldimage]').dataset.fldimage;
    inp.addEventListener('paste', async (e) => {
      const f = Array.from(e.clipboardData?.files || []).find((x) => /^image\//.test(x.type));
      if (!f) return;
      e.preventDefault();
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const id = await stageFile(
        f,
        f.name && f.name !== 'image.png' ? f.name : `zwischenablage-${Date.now()}.${ext}`,
      );
      setImage(path, 'staged:' + id, 'Bild aus der Zwischenablage übernommen (lokal)');
    });
  });
  pane.querySelectorAll('[data-fldreset]').forEach((btn) => {
    const path = btn.dataset.fldreset;
    btn.addEventListener('click', () => {
      setVal(path, '');
      renderFields();
      toast('Auf Standard zurückgesetzt');
    });
  });
  pane.querySelectorAll('[data-fldslotreset]').forEach((btn) => {
    const key = btn.dataset.fldslotreset;
    btn.addEventListener('click', () => {
      const slot = slots.find((s) => s.key === key);
      if (!slot) return;
      for (const l of gen.langs || []) g().values[slotTextPath(slot, l)] = '';
      for (const k of ['font', 'size', 'weight', 'spacing', 'transform', 'colorLight', 'colorDark'])
        g().values[`${slot.stylePath}.${k}`] = '';
      renderFields();
      toast(`„${slot.label}“ zurückgesetzt`);
    });
  });
  // Vorschau: Modus/Sprache umschalten, Slot anklicken -> Karte markieren + scrollen.
  pane.querySelectorAll('[data-fldprevtheme]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.theme = b.dataset.fldprevtheme;
      pane
        .querySelectorAll('[data-fldprevtheme]')
        .forEach((x) => x.classList.toggle('primary', x === b));
      updatePreview(pane);
    }),
  );
  pane.querySelectorAll('[data-fldprevlang]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.lang = b.dataset.fldprevlang;
      pane
        .querySelectorAll('[data-fldprevlang]')
        .forEach((x) => x.classList.toggle('primary', x === b));
      updatePreview(pane);
    }),
  );
  pane.querySelectorAll('[data-fldprev] [data-slot]').forEach((el) =>
    el.addEventListener('click', () => {
      const key = el.dataset.slot;
      selectSlot(pane, key);
      const card = pane.querySelector(`[data-fldslot="${CSS.escape(key)}"]`);
      if (card) {
        const sticky = pane.querySelector('[data-fldsticky]');
        const top =
          card.getBoundingClientRect().top +
          window.scrollY -
          (sticky ? sticky.getBoundingClientRect().height : 0) -
          24;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    }),
  );
  bindSliders(pane);
  bindColorPickers(pane);
  updatePreview(pane);
}
