// Reine Content-Bearbeitung pro Sprache: der „Texte"-Tab (formularbasierte
// Overrides) und der „Erweitert"-Tab (rohe Overrides als JSON).

import { $, esc, toast } from './core.js';
import { colorPicker, bindColorPickers, refreshColorPickers } from './color.js';
import {
  state,
  getPath,
  setPath,
  delPath,
  getTextStyle,
  getEffectiveTextStyle,
  BANNER_ANIM_TYPES,
  BANNER_ANIM_SPEEDS,
} from './model.js';
import { fontOptionsHtml, ensureFontFace } from './fonts.js';

// font-family-CSS für die Feld-Vorschau (lädt @font-face) oder ''.
function fontFF(file) {
  return file ? `font-family:'${ensureFontFace(file)}', var(--site-font, sans-serif);` : '';
}
// Deutsche Beschriftungen der Animationstypen und Tempo-Stufen (nur UI).
const ANIM_LABELS = {
  none: 'Keine',
  pulse: 'Puls',
  float: 'Schweben',
  shake: 'Wackeln',
  wobble: 'Kippen',
  glow: 'Glühen',
};
const ANIM_SPEED_LABELS = { slow: 'Langsam', normal: 'Normal', fast: 'Schnell' };
// Standardwerte der Text-Effekte (entsprechen dem „aus"-Zustand).
const TEXT_FX_DEFAULTS = {
  shadow: false,
  shadowColor: '#000000',
  shadowX: 0,
  shadowY: 2,
  shadowBlur: 6,
  strokeColor: '#000000',
  strokeWidth: 0,
  opacity: 100,
  anim: 'none',
  animIntensity: 5,
  animSpeed: 'normal',
};
const clampI = (v, min, max, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};
const clampH = (v, min, max, def) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n * 2) / 2)) : def;
};
// Effekt-Bedienfeld eines Slots (Schatten, Umriss, Deckkraft, Animation) als
// aufklappbarer Bereich. `dis` sperrt die Felder bei „Standard für alle Slots".
function fxControls(idx, st, dis) {
  const active =
    st.shadow ||
    (st.strokeWidth || 0) > 0 ||
    (st.opacity ?? 100) < 100 ||
    (st.anim && st.anim !== 'none');
  const animOpts = BANNER_ANIM_TYPES.map(
    (t) =>
      `<option value="${t}" ${t === (st.anim || 'none') ? 'selected' : ''}>${ANIM_LABELS[t] || t}</option>`,
  ).join('');
  const speedOpts = BANNER_ANIM_SPEEDS.map(
    (sp) =>
      `<option value="${sp}" ${sp === (st.animSpeed || 'normal') ? 'selected' : ''}>${ANIM_SPEED_LABELS[sp] || sp}</option>`,
  ).join('');
  return `
    <details ${active ? 'open' : ''} style="margin-top:.4rem">
      <summary style="cursor:pointer;color:${active ? 'var(--accent)' : 'var(--muted)'};font-size:.82rem;user-select:none">Effekte — Schatten, Umriss, Deckkraft, Animation${active ? ' •' : ''}</summary>
      <div class="row" style="align-items:flex-end;margin-top:.4rem">
        <div style="flex:0 0 auto">
          <label style="margin-top:0">Schatten</label>
          <label style="display:flex;align-items:center;gap:.4rem;color:var(--text);cursor:pointer;height:38px;margin:0">
            <input type="checkbox" data-txtfx="${idx}:shadow" ${st.shadow ? 'checked' : ''} ${dis} style="width:auto" /> anzeigen
          </label>
        </div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Schattenfarbe</label>
          ${colorPicker({ id: `txt:${idx}:shadowColor`, attrs: `data-txtfx="${idx}:shadowColor"`, value: st.shadowColor || '#000000', disabled: dis === 'disabled' })}</div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Versatz X (px)</label>
          <input type="number" data-txtfx="${idx}:shadowX" min="-50" max="50" step="1" value="${st.shadowX ?? 0}" ${dis} style="width:90px" /></div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Versatz Y (px)</label>
          <input type="number" data-txtfx="${idx}:shadowY" min="-50" max="50" step="1" value="${st.shadowY ?? 2}" ${dis} style="width:90px" /></div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Weichzeichnung (px)</label>
          <input type="number" data-txtfx="${idx}:shadowBlur" min="0" max="40" step="1" value="${st.shadowBlur ?? 6}" ${dis} style="width:110px" /></div>
      </div>
      <div class="row" style="align-items:flex-end;margin-top:.4rem">
        <div style="flex:0 0 auto"><label style="margin-top:0">Umriss-Farbe</label>
          ${colorPicker({ id: `txt:${idx}:strokeColor`, attrs: `data-txtfx="${idx}:strokeColor"`, value: st.strokeColor || '#000000', disabled: dis === 'disabled' })}</div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Umriss-Dicke (px, 0=aus)</label>
          <input type="number" data-txtfx="${idx}:strokeWidth" min="0" max="10" step="0.5" value="${st.strokeWidth ?? 0}" ${dis} style="width:120px" /></div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Deckkraft (%)</label>
          <input type="number" data-txtfx="${idx}:opacity" min="0" max="100" step="1" value="${st.opacity ?? 100}" ${dis} style="width:110px" /></div>
      </div>
      <div class="row" style="align-items:flex-end;margin-top:.4rem">
        <div style="flex:0 0 auto"><label style="margin-top:0">Animation</label>
          <select data-txtfx="${idx}:anim" ${dis} style="width:auto;height:38px">${animOpts}</select></div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Intensität (1–10)</label>
          <input type="number" data-txtfx="${idx}:animIntensity" min="1" max="10" step="1" value="${st.animIntensity ?? 5}" ${dis} style="width:110px" /></div>
        <div style="flex:0 0 auto"><label style="margin-top:0">Geschwindigkeit</label>
          <select data-txtfx="${idx}:animSpeed" ${dis} style="width:auto;height:38px">${speedOpts}</select></div>
        <div style="flex:0 0 auto"><label style="margin-top:0">&nbsp;</label>
          <button type="button" class="hd-reset" data-txtreset="${idx}:fx" ${dis} title="Effekte zurücksetzen" aria-label="Effekte zurücksetzen">↺ Effekte</button></div>
      </div>
    </details>`;
}

// Aktuell im „Texte"-Tab bearbeiteter Farb-Modus (reiner UI-Zustand). Textgröße
// und Schriftart gelten für beide Modi; nur die Textfarbe ist getrennt nach
// Hell/Dunkel – analog zum Laufband/Hero-Design.
let txtEditTheme = 'light';
const txtColorField = () => (txtEditTheme === 'dark' ? 'colorDark' : 'colorLight');
const txtModeLabel = () => (txtEditTheme === 'dark' ? 'Dunkel' : 'Hell');

// ============ TAB: Texte ============
// Alle Slots sind mehrzeilig (Zeilenumbrüche werden auf der Seite übernommen)
// und haben eine einstellbare Textgröße + Textfarbe.
const TEXT_FIELDS = [
  { path: ['hero', 'title'], label: 'Hero – Titel' },
  { path: ['hero', 'subtitle'], label: 'Hero – Untertitel' },
  { path: ['hero', 'cta'], label: 'Hero – Button-Text' },
  { path: ['tools', 'sectionTitle'], label: 'Abschnitt – Audio-Tools (Titel)' },
  { path: ['imageTools', 'sectionTitle'], label: 'Abschnitt – Bild-Tools (Titel)' },
  { path: ['diverseTools', 'sectionTitle'], label: 'Abschnitt – Diverse Tools (Titel)' },
];
// Schlüssel für die Stil-Ablage (media.<lang>.textStyles).
const styleKey = (f) => f.path.join('.');

// Bei „Standard für alle Slots": die (gesperrten) Felder der übrigen Slots live
// auf die Werte des Master-Slots nachziehen – ohne Neu-Rendern, damit der Fokus
// im gerade bearbeiteten Master-Feld erhalten bleibt.
function syncInheritedFields(pane, lang) {
  const m = state.media[lang];
  if (!m.textStyleUniform) return;
  const master = getTextStyle(lang, m.textStyleUniformKey || '');
  const ff = fontFF(master.font || '');
  TEXT_FIELDS.forEach((f, idx) => {
    if (styleKey(f) === m.textStyleUniformKey) return; // Vorlage selbst auslassen
    const size = pane.querySelector(`[data-txtsize="${idx}"]`);
    if (size) size.value = master.size || 0;
    const color = pane.querySelector(`[data-txtcolor="${idx}"]`);
    if (color) color.value = master[txtColorField()] || '#ffffff';
    const font = pane.querySelector(`[data-txtfont="${idx}"]`);
    if (font) {
      font.value = master.font || '';
      font.setAttribute('style', ff);
    }
    const ta = pane.querySelector(`[data-txt="${idx}"]`);
    if (ta) ta.setAttribute('style', `min-height:64px;font-size:.95rem;${ff}`);
  });
  refreshTxtPreviews(pane, lang);
}

// ---- Live-Vorschau je Slot -------------------------------------------------
// Zeigt den Text mit Schrift, Größe (für die Vorschau auf 12–40 px begrenzt),
// Farbe des aktuellen Modus und allen Effekten (Schatten/Umriss/Deckkraft/
// Animation). Nutzt dieselben kt-*-Animationsklassen wie die Banner-Vorschau.
const PREVIEW_ANIM_DUR = { slow: '2.6s', normal: '1.8s', fast: '1s' };
function previewRgba(hex, a) {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return `rgba(0,0,0,${a})`;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
// Animationsklasse (kt-<type>) oder '' bei 'none'.
function slotAnimClass(st) {
  return st.anim && st.anim !== 'none' ? 'kt-' + st.anim : '';
}
// Inline-Style der Slot-Vorschau (Farbe des aktuell bearbeiteten Modus + Effekte).
function slotPreviewStyle(st) {
  const dark = txtEditTheme === 'dark';
  const color = (dark ? st.colorDark : st.colorLight) || (dark ? '#f9f2d5' : '#013f7a');
  const size = st.size > 0 ? Math.max(12, Math.min(40, st.size)) : 22;
  const parts = [
    `font-size:${size}px`,
    'line-height:1.25',
    'font-weight:700',
    'display:inline-block',
    'max-width:100%',
    'white-space:pre-line',
    'word-break:break-word',
    `color:${color}`,
    `-webkit-text-fill-color:${color}`,
  ];
  if (st.font) parts.push(`font-family:'${ensureFontFace(st.font)}', var(--site-font, sans-serif)`);
  const op = st.opacity ?? 100;
  if (op < 100) parts.push(`opacity:${op / 100}`);
  const sw = st.strokeWidth ?? 0;
  if (sw > 0) parts.push(`-webkit-text-stroke:${sw}px ${st.strokeColor || '#000000'}`);
  if (st.shadow) {
    const sx = st.shadowX ?? 0;
    const sy = st.shadowY ?? 2;
    const sb = st.shadowBlur ?? 6;
    parts.push(
      `text-shadow:${sx}px ${sy}px ${sb}px ${previewRgba(st.shadowColor || '#000000', 0.6)}`,
    );
  }
  if (st.anim && st.anim !== 'none') {
    const it = Math.max(1, Math.min(10, st.animIntensity ?? 5));
    parts.push(`--anim-dur:${PREVIEW_ANIM_DUR[st.animSpeed] || '1.8s'}`);
    if (st.anim === 'pulse') parts.push(`--anim-scale:${(1 + it * 0.02).toFixed(3)}`);
    else if (st.anim === 'float' || st.anim === 'shake') parts.push(`--anim-shift:${it}px`);
    else if (st.anim === 'wobble') parts.push(`--anim-rot:${it}deg`);
    else if (st.anim === 'glow') parts.push(`--anim-glow:${it * 2}px`);
  }
  return parts.join(';');
}
// Vorschau-Text: aktueller Override, sonst Standardtext, sonst das Slot-Label.
function previewText(lang, f) {
  const cur = getPath(state.overrides[lang], f.path);
  const def = getPath(state.defaults[lang], f.path);
  const t = cur != null && String(cur).trim() !== '' ? String(cur) : def != null ? String(def) : '';
  return t || f.label;
}
// Hintergrund der Vorschau je Modus, damit die Farbe sichtbar ist.
const previewBg = () => (txtEditTheme === 'dark' ? '#0e1c32' : '#f5f6f8');
function updateTxtPreview(pane, lang, idx) {
  const el = pane.querySelector(`[data-txtprev="${idx}"]`);
  if (!el) return;
  const st = getEffectiveTextStyle(lang, styleKey(TEXT_FIELDS[idx]));
  el.textContent = previewText(lang, TEXT_FIELDS[idx]);
  el.setAttribute('style', slotPreviewStyle(st));
  el.classList.remove('kt-pulse', 'kt-float', 'kt-shake', 'kt-wobble', 'kt-glow');
  const c = slotAnimClass(st);
  if (c) el.classList.add(c);
}
function refreshTxtPreviews(pane, lang) {
  TEXT_FIELDS.forEach((_, idx) => updateTxtPreview(pane, lang, idx));
}

export function renderTexts() {
  const pane = $('#content');
  pane.innerHTML = textPanel(state.nav.section);
  const lang = state.nav.section;
  pane.querySelectorAll('[data-txt]').forEach((el) => {
    const idx = parseInt(el.dataset.txt, 10);
    const l = el.dataset.lang;
    const field = TEXT_FIELDS[idx];
    el.addEventListener('input', () => {
      const v = el.value;
      if (v.trim() === '') delPath(state.overrides[l], field.path);
      else setPath(state.overrides[l], field.path, v);
      updateTxtPreview(pane, lang, idx);
    });
  });

  // Textgröße (0 = Standard) und Textfarbe je Slot.
  pane.querySelectorAll('[data-txtsize]').forEach((el) => {
    const key = styleKey(TEXT_FIELDS[parseInt(el.dataset.txtsize, 10)]);
    el.addEventListener('input', () => {
      const n = parseInt(el.value, 10);
      getTextStyle(lang, key).size = Number.isFinite(n) ? Math.max(0, Math.min(120, n)) : 0;
      syncInheritedFields(pane, lang);
      refreshTxtPreviews(pane, lang);
    });
  });
  pane.querySelectorAll('[data-txtcolor]').forEach((el) => {
    const key = styleKey(TEXT_FIELDS[parseInt(el.dataset.txtcolor, 10)]);
    el.addEventListener('input', () => {
      getTextStyle(lang, key)[txtColorField()] = el.value;
      syncInheritedFields(pane, lang);
      refreshColorPickers(pane); // nachgezogene Farbfelder der übrigen Slots
      refreshTxtPreviews(pane, lang);
    });
  });

  // Effekt-Felder je Slot: Schatten, Umriss, Deckkraft, Animation (analog Banner).
  pane.querySelectorAll('[data-txtfx]').forEach((el) => {
    const [idxStr, field] = el.dataset.txtfx.split(':');
    const key = styleKey(TEXT_FIELDS[parseInt(idxStr, 10)]);
    const evt = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const s = getTextStyle(lang, key);
      if (field === 'shadow') s.shadow = el.checked;
      else if (
        field === 'shadowColor' ||
        field === 'strokeColor' ||
        field === 'anim' ||
        field === 'animSpeed'
      )
        s[field] = el.value;
      else if (field === 'shadowX') s.shadowX = clampI(el.value, -50, 50, 0);
      else if (field === 'shadowY') s.shadowY = clampI(el.value, -50, 50, 2);
      else if (field === 'shadowBlur') s.shadowBlur = clampI(el.value, 0, 40, 6);
      else if (field === 'strokeWidth') s.strokeWidth = clampH(el.value, 0, 10, 0);
      else if (field === 'opacity') s.opacity = clampI(el.value, 0, 100, 100);
      else if (field === 'animIntensity') s.animIntensity = clampI(el.value, 1, 10, 5);
      refreshTxtPreviews(pane, lang);
    });
  });

  // Farb-Modus umschalten (Hell/Dunkel) – Panel neu rendern zeigt die Farben
  // des gewählten Modus (Größe/Schrift bleiben gleich).
  pane.querySelectorAll('[data-txtmode]').forEach((el) => {
    el.addEventListener('click', () => {
      txtEditTheme = el.dataset.txtmode === 'dark' ? 'dark' : 'light';
      renderTexts();
    });
  });
  // Schriftart je Slot (Feld-Vorschau folgt der Auswahl).
  pane.querySelectorAll('[data-txtfont]').forEach((el) => {
    const idx = parseInt(el.dataset.txtfont, 10);
    const key = styleKey(TEXT_FIELDS[idx]);
    el.addEventListener('change', () => {
      getTextStyle(lang, key).font = el.value;
      const ff = fontFF(el.value);
      el.setAttribute('style', ff);
      const ta = pane.querySelector(`[data-txt="${idx}"]`);
      if (ta) ta.setAttribute('style', `min-height:64px;font-size:.95rem;${ff}`);
      syncInheritedFields(pane, lang);
      refreshTxtPreviews(pane, lang);
    });
  });

  // Alle Text-Stil-Einstellungen (Hell + Dunkel + Effekte + „Standard für alle
  // Slots") von Deutsch nach Englisch übernehmen. Die Texte bleiben je Sprache.
  pane.querySelectorAll('[data-txtcopy]').forEach((el) => {
    el.addEventListener('click', () => {
      if (
        !confirm(
          'Alle Text-Einstellungen für Englisch werden mit den deutschen überschrieben ' +
            '(Schriftart, Größe, Farbe Hell + Dunkel, Schatten, Umriss, Deckkraft, Animation, ' +
            '„Standard für alle Slots"). Die Texte selbst bleiben unverändert. Fortfahren?',
        )
      )
        return;
      const de = state.media.de;
      state.media.en.textStyles = JSON.parse(JSON.stringify(de.textStyles || {}));
      state.media.en.textStyleUniform = de.textStyleUniform === true;
      state.media.en.textStyleUniformKey = de.textStyleUniformKey || 'hero.title';
      renderTexts();
      toast('Text-Einstellungen von Deutsch nach Englisch übernommen (Hell + Dunkel + Effekte)');
    });
  });

  // „Standard für alle Slots": Stil dieses Slots gilt für alle anderen.
  pane.querySelectorAll('[data-txtmaster]').forEach((el) => {
    const idx = parseInt(el.dataset.txtmaster, 10);
    const f = TEXT_FIELDS[idx];
    el.addEventListener('change', () => {
      const m = state.media[lang];
      m.textStyleUniform = el.checked;
      if (el.checked) m.textStyleUniformKey = styleKey(f);
      renderTexts();
      toast(
        el.checked
          ? `„${f.label}" ist Master – alle anderen Slots übernehmen seinen Stil und sind gesperrt`
          : 'Jeder Slot nutzt wieder seinen eigenen Stil',
      );
    });
  });

  // ↺ Zurücksetzen: Größe, Farbe oder Text des Slots.
  pane.querySelectorAll('[data-txtreset]').forEach((el) => {
    const [idxStr, what] = el.dataset.txtreset.split(':');
    const idx = parseInt(idxStr, 10);
    const field = TEXT_FIELDS[idx];
    el.addEventListener('click', () => {
      if (what === 'text') delPath(state.overrides[lang], field.path);
      else if (what === 'size') getTextStyle(lang, styleKey(field)).size = 0;
      else if (what === 'color') getTextStyle(lang, styleKey(field))[txtColorField()] = '';
      else if (what === 'fx') Object.assign(getTextStyle(lang, styleKey(field)), TEXT_FX_DEFAULTS);
      else getTextStyle(lang, styleKey(field))[what] = ''; // font
      renderTexts();
      toast('Auf Standard zurückgesetzt');
    });
  });
  bindColorPickers(pane);
}

function textPanel(lang) {
  const fields = TEXT_FIELDS.map((f, idx) => {
    const cur = getPath(state.overrides[lang], f.path);
    const def = getPath(state.defaults[lang], f.path);
    const val = cur != null ? cur : '';
    const ph = def != null ? String(def) : '';
    const key = styleKey(f);
    const m = state.media[lang];
    const st = getEffectiveTextStyle(lang, key);
    const isMaster = m.textStyleUniform && (m.textStyleUniformKey || '') === key;
    const inherited = m.textStyleUniform && !isMaster;
    // Nicht-Master-Slots sind gesperrt, solange ein Master aktiv ist. Deaktiviert
    // man den Master, kehrt jeder Slot auf seine EIGENEN Einstellungen zurück
    // (nicht auf Standard) – die eigenen Werte werden nie überschrieben.
    const dis = inherited ? 'disabled' : '';
    const masterLabel = TEXT_FIELDS.find((x) => styleKey(x) === m.textStyleUniformKey);
    const note = inherited
      ? `<p class="hint" style="margin:.25rem 0 0;color:var(--accent)">🔒 Übernimmt Schriftart, Textgröße, Farbe und Effekte von „${esc(masterLabel ? masterLabel.label : m.textStyleUniformKey)}" und ist gesperrt.</p>`
      : isMaster
        ? `<p class="hint" style="margin:.25rem 0 0;color:var(--accent)">★ Master: Schriftart, Textgröße, Farbe und Effekte gelten für alle Slots (alle anderen sind gesperrt).</p>`
        : '';
    // Mehrzeilig: Enter erzeugt einen echten Zeilenumbruch auf der Seite.
    const input = `<textarea data-txt="${idx}" data-lang="${lang}" rows="2" placeholder="${esc(ph)}" style="min-height:64px;font-size:.95rem;${fontFF(st.font || '')}">${esc(val)}</textarea>`;
    return `
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-top:.75rem">
        <label style="margin:0">${f.label}</label>
        <label style="display:flex;align-items:center;gap:.35rem;margin:0;color:${isMaster ? 'var(--accent)' : 'var(--muted)'};font-size:.75rem;cursor:pointer">
          <input type="checkbox" data-txtmaster="${idx}" ${isMaster ? 'checked' : ''} style="width:auto" />
          Standard für alle Slots
        </label>
      </div>
      ${note}
      ${input}
      <div style="margin-top:.4rem;border:1px solid var(--border);border-radius:8px;padding:.5rem .7rem;background:${previewBg()};overflow:hidden">
        <span class="hint" style="margin:0 0 .3rem;display:block">👁 Vorschau (${txtModeLabel()}):</span>
        <div data-txtprev="${idx}" class="${slotAnimClass(st)}" style="${slotPreviewStyle(st)}">${esc(previewText(lang, f))}</div>
      </div>
      <div class="row" style="align-items:flex-end;margin-top:.35rem">
        <div style="flex:1 1 200px">
          <label style="margin-top:0">Schriftart</label>
          <div style="display:flex;gap:.3rem;align-items:center">
            <select data-txtfont="${idx}" ${dis} style="${fontFF(st.font || '')}">${fontOptionsHtml(st.font || '')}</select>
            <button type="button" class="hd-reset" data-txtreset="${idx}:font" ${dis} title="Schriftart zurücksetzen" aria-label="Schriftart zurücksetzen">↺</button>
          </div>
        </div>
        <div style="flex:0 0 auto">
          <label style="margin-top:0">Textgröße (px, 0=Standard)</label>
          <div style="display:flex;gap:.3rem;align-items:center">
            <input type="number" data-txtsize="${idx}" min="0" max="120" step="1" value="${st.size || 0}" ${dis} style="width:120px" />
            <button type="button" class="hd-reset" data-txtreset="${idx}:size" ${dis} title="Auf Standard zurücksetzen" aria-label="Größe zurücksetzen">↺</button>
          </div>
        </div>
        <div style="flex:0 0 auto">
          <label style="margin-top:0">Textfarbe (${txtModeLabel()})</label>
          ${colorPicker({
            id: `txt:${idx}:color`,
            attrs: `data-txtcolor="${idx}"`,
            value: st[txtColorField()] || '#ffffff',
            disabled: dis === 'disabled',
            resetHtml: `<button type="button" class="hd-reset" data-txtreset="${idx}:color" ${dis} title="Farbe (${txtModeLabel()}) auf Standard zurücksetzen" aria-label="Farbe zurücksetzen">↺</button>`,
          })}
        </div>
        <div style="flex:0 0 auto">
          <label style="margin-top:0">&nbsp;</label>
          <button type="button" class="hd-reset" data-txtreset="${idx}:text" title="Text auf Standard zurücksetzen" aria-label="Text zurücksetzen">↺ Text</button>
        </div>
      </div>
      ${fxControls(idx, st, dis)}
      <p class="hint">Leer lassen = Standardtext. Mehrere Zeilen mit Enter; Größe 0 = Standard.
        Effekte (Schatten/Umriss/Deckkraft/Animation) wirken auf der veröffentlichten Seite.</p>`;
  }).join('');
  const modeToggle = `
    <div style="margin:.25rem 0 .5rem;border-bottom:1px solid var(--border);padding-bottom:.6rem">
      <label style="margin-top:0">Farb-Modus</label>
      <div class="row" style="gap:.4rem">
        <button type="button" data-txtmode="light" class="${txtEditTheme === 'light' ? 'primary' : ''}" style="flex:0 0 auto">☀️ Hell</button>
        <button type="button" data-txtmode="dark" class="${txtEditTheme === 'dark' ? 'primary' : ''}" style="flex:0 0 auto">🌙 Dunkel</button>
      </div>
      <p class="hint" style="margin-top:.35rem">Du bearbeitest die <strong>Textfarben</strong> für <strong>${txtModeLabel()}</strong>. Textgröße und Schriftart gelten für <strong>beide</strong> Modi.</p>
    </div>`;
  // Alle Text-Stil-Einstellungen (Hell + Dunkel + Effekte) von Deutsch nach
  // Englisch übernehmen. Die Texte selbst bleiben je Sprache erhalten.
  const copyBox = `
    <div style="margin:.2rem 0 .7rem;padding:.5rem .6rem;border:1px dashed var(--border);border-radius:8px">
      <button data-txtcopy type="button" style="width:auto">${
        lang === 'de'
          ? '➡️ Diese Text-Einstellungen auf Englisch (EN) übernehmen'
          : '⬅️ Text-Einstellungen von Deutsch (DE) übernehmen'
      }</button>
      <p class="hint" style="margin:.35rem 0 0">Kopiert <strong>alle</strong> Text-Einstellungen aller Slots
        (Schriftart, Größe, Farbe <strong>Hell + Dunkel</strong>, Schatten, Umriss, Deckkraft, Animation
        sowie „Standard für alle Slots") von Deutsch nach Englisch. Die <em>Texte</em> selbst bleiben je Sprache erhalten.</p>
    </div>`;
  return `<div class="panel"><h2>Texte <span class="lang-badge">${lang.toUpperCase()}</span></h2>${modeToggle}${copyBox}${fields}</div>`;
}

// ============ Erweitert (rohe Overrides, eine Sprache) ============
export function renderAdvanced() {
  const l = state.nav.section;
  const pane = $('#content');
  pane.innerHTML = `
    <div class="panel">
      <h2>Erweitert — Overrides als JSON <span class="lang-badge">${l.toUpperCase()}</span></h2>
      <p class="hint">Für Felder, die es oben nicht als Formular gibt. Struktur wie in den Locale-Dateien,
        nur die zu ändernden Schlüssel. Ungültiges JSON wird beim Übernehmen abgelehnt.</p>
      <textarea data-adv="${l}" style="min-height:220px">${esc(JSON.stringify(state.overrides[l], null, 2))}</textarea>
      <div class="err" id="advErr"></div>
      <button id="advApply" style="margin-top:.5rem">Übernehmen</button>
    </div>`;
  $('#advApply').addEventListener('click', () => {
    $('#advErr').textContent = '';
    try {
      const txt = pane.querySelector(`[data-adv="${l}"]`).value.trim();
      const obj = txt ? JSON.parse(txt) : {};
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj))
        throw new Error(`${l}: kein Objekt`);
      state.overrides[l] = obj;
      toast('Overrides übernommen (noch nicht gespeichert)');
    } catch (e) {
      $('#advErr').textContent = 'Fehler: ' + e.message;
    }
  });
}
