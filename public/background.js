// Hintergrund-Tab (global, sprachübergreifend): Hintergrund der GESAMTEN
// Website – getrennt für Hell- und Dunkelmodus – mit Live-Vorschau. Je Modus:
// eigene Farbe, Deckkraft (Mischung mit der Standardfarbe des Modus) und
// optionaler Farbverlauf (Endfarbe, linear mit Richtung oder radial).
// Dazu je Modus ein reines CSS-Muster (Punktraster/Gitter: Farbe, Abstand,
// Stärke, Deckkraft) und ein Hintergrundbild aus der Mediathek (Abdunkelung,
// Weichzeichner, Deckkraft, fixiert beim Scrollen).
// Gespeichert wird global in media.site (bgColor*, bgOpacity*, bgGradient*,
// bgColor2*, bgGradientType*, bgAngle*, bgPattern*, bgImage*; Suffix Dark =
// Dunkelmodus); leer = Standardfarbe des jeweiligen Modus (wie bisher).

import { $, esc, toast } from './core.js';
import { slider, bindSliders } from './slider.js';
import { colorPicker, bindColorPickers } from './color.js';
import {
  state,
  getSiteBg,
  setSiteBg,
  getSiteFx,
  setSiteFx,
  SITE_FX,
  PAGE_BG_DEFAULT,
  siteBgLayerCss,
  siteBgImageLayer,
  SITE_GRADIENT_TYPES,
  SITE_PATTERNS,
  SITE_SECTION_KEYS,
  SECTION_LABELS,
  getSectionStyle,
  setSectionStyle,
  getSectionGap,
  setSectionGap,
  SECTION_GAP_MAX,
  getSiteSection,
  setSiteSection,
  defaultSectionSide,
  rgbaFromHex,
} from './model.js';
import { objUrl, openMediaPicker } from './media.js';

// --- Effekte (Aurora / Rauschen / Spotlight): Beschreibung + Vorschau-Werte ---
// Die Vorschau bildet background.css + index.astro nach (gleiche Verläufe,
// gleiche Skalierung der Intensität), damit sie dem Ergebnis auf der Seite entspricht.
const FX_DESC = {
  fxAurora:
    'Weiche Farbflecken in den Markenfarben (Blau/Gold) über dem Seitenhintergrund. Farben folgen automatisch dem Hell-/Dunkelmodus.',
  fxNoise:
    'Feine Körnung, die großen Flächen den sterilen Eindruck nimmt und Verläufe weicher macht.',
  fxSpotlight:
    'Sanfter Lichtkegel, der dem Mauszeiger folgt (nur Startseiten; auf Touch-Geräten unsichtbar).',
};
const AURORA_BG = {
  light:
    'radial-gradient(ellipse 75% 60% at 12% -5%, rgba(1, 79, 153, 0.24), transparent 55%),' +
    'radial-gradient(ellipse 55% 45% at 92% 8%, rgba(232, 169, 69, 0.26), transparent 55%),' +
    'radial-gradient(ellipse 65% 55% at 85% 105%, rgba(58, 123, 200, 0.22), transparent 55%)',
  dark:
    'radial-gradient(ellipse 75% 60% at 12% -5%, rgba(232, 169, 69, 0.26), transparent 55%),' +
    'radial-gradient(ellipse 55% 45% at 92% 8%, rgba(1, 79, 153, 0.44), transparent 55%),' +
    'radial-gradient(ellipse 65% 55% at 85% 105%, rgba(232, 169, 69, 0.14), transparent 55%)',
};
const FX_NOISE_MAX = 0.08;
const SPOT_BASE = { light: 'rgba(1, 79, 153, A)', dark: 'rgba(201, 152, 77, A)' };
const SPOT_ALPHA = { light: 0.4, dark: 0.3 };

// Beispiel-Textfarbe für die Vorschau, passend zum jeweiligen Modus (nur Vorschau).
const PREVIEW_FG = { light: '#003971', dark: '#e2e8f0' };
// Vorschlag für die Endfarbe, wenn der Verlauf eingeschaltet wird.
const GRADIENT_END_DEFAULT = { light: '#e3ecf6', dark: '#142640' };
const GRADIENT_TYPE_LABEL = {
  linear: 'Linear (Richtung wählbar)',
  radial: 'Radial (von oben Mitte)',
};
const PATTERN_LABEL = { none: 'Kein Muster', dots: 'Punktraster', grid: 'Feines Gitter' };

// Sektionen: Vorschlag für die Tönungsfarbe je Modus (Markenfarben) und Stil-Beschriftung.
const SECTION_TINT_DEFAULT = { light: '#014f99', dark: '#e8a945' };
const SECTION_STYLE_LABEL = {
  band: 'Volle Breite (Band bis zum Seitenrand)',
  card: 'Abgerundete Fläche innerhalb der Sektion',
};

// Bild-URL für die Vorschau auflösen (staged:<id> -> Objekt-URL des Browsers).
function previewUrl(val) {
  if (!val) return '';
  if (val.startsWith('staged:')) return objUrl(val.slice(7));
  return val;
}
// style-Attribut der Bild-Ebene in der Vorschau (leer = keine Ebene sichtbar).
function imageLayerStyle(mode) {
  const l = siteBgImageLayer(mode, previewUrl);
  if (!l) return 'display:none';
  const mask = l.fixed
    ? ''
    : 'mask-image:linear-gradient(#000 60%, transparent);-webkit-mask-image:linear-gradient(#000 60%, transparent);';
  return (
    // Einfache Anführungszeichen: der Wert landet in einem style="…"-Attribut.
    `background:url('${l.url.replace(/['"]/g, '')}') center / cover no-repeat;` +
    `filter:${l.filter};opacity:${l.opacity};${mask}`
  );
}

// Hintergrund-Ebene eines Modus (gemeinsam mit der Tool-Karten-Vorschau, model.js).
const layerCss = siteBgLayerCss;

function previewStyle(mode) {
  return `background:${layerCss(mode)};color:${PREVIEW_FG[mode]}`;
}

function noteFor(mode) {
  const s = getSiteBg(mode);
  if (!s.color)
    return `⚠️ Keine eigene Farbe – es gilt die Standardfarbe (${PAGE_BG_DEFAULT[mode]}).`;
  const parts = [];
  if (s.gradient && s.color2)
    parts.push(s.type === 'radial' ? 'radialer Verlauf' : `linearer Verlauf, ${s.angle}°`);
  if (s.opacity < 100)
    parts.push(`Deckkraft ${s.opacity} % über der Standardfarbe ${PAGE_BG_DEFAULT[mode]}`);
  return `✅ Eigener Hintergrund wird auf der Seite angewandt${parts.length ? ` (${parts.join('; ')})` : ''}.`;
}
// Hinweis unter Muster + Bild (unabhängig von der Farbwahl).
function extrasNote(mode) {
  const s = getSiteBg(mode);
  const parts = [];
  if (s.pattern !== 'none')
    parts.push(
      `${PATTERN_LABEL[s.pattern]} (${s.patternSpacing} px, ${s.patternOpacity} % Deckkraft)`,
    );
  if (s.image) {
    const bits = [s.imageFixed ? 'fixiert beim Scrollen' : 'scrollt mit, läuft nach unten aus'];
    if (s.imageDarken > 0) bits.push(`${s.imageDarken} % abgedunkelt`);
    if (s.imageBlur > 0) bits.push(`${s.imageBlur} px weich`);
    if (s.imageOpacity < 100) bits.push(`${s.imageOpacity} % Deckkraft`);
    parts.push(
      `Hintergrundbild${s.image.startsWith('staged:') ? ' (lokal, wird beim Veröffentlichen hochgeladen)' : ''}: ${bits.join(', ')}`,
    );
  }
  return parts.length ? `✅ ${parts.join(' · ')}.` : 'Kein Muster und kein Hintergrundbild.';
}

// Abschnitt „Muster" eines Modus (reines CSS: Punktraster oder Gitter).
function patternRow(mode) {
  const s = getSiteBg(mode);
  const on = s.pattern !== 'none';
  const opts = SITE_PATTERNS.map(
    (t) => `<option value="${t}" ${s.pattern === t ? 'selected' : ''}>${PATTERN_LABEL[t]}</option>`,
  ).join('');
  return `
    <div class="bg-sub" data-bgpattern="${mode}">
      <div class="bg-sub-title">Muster <span class="hint" style="margin:0;font-weight:400">– Punktraster oder feines Gitter (reines CSS, liegt über der Farbe)</span></div>
      <div class="row" style="align-items:flex-end">
        <div style="flex:0 0 auto">
          <label>Art</label>
          <select data-bgf="pattern" data-mode="${mode}" style="width:auto">${opts}</select>
        </div>
        <div style="flex:0 0 auto">
          <label>Farbe</label>
          ${colorPicker({ id: `bg:patternColor:${mode}`, attrs: `data-bgf="patternColor" data-mode="${mode}"`, value: s.patternColor, disabled: !on })}
        </div>
        <div style="flex:1 1 200px">${slider({ id: `bg:patternSpacing:${mode}`, label: 'Abstand', unit: 'px', min: 4, max: 200, value: s.patternSpacing, def: 24, attrs: `data-bgf="patternSpacing" data-mode="${mode}"`, disabled: !on })}</div>
        <div style="flex:1 1 180px">${slider({ id: `bg:patternThickness:${mode}`, label: 'Stärke', unit: 'px', min: 1, max: 6, value: s.patternThickness, def: 1, attrs: `data-bgf="patternThickness" data-mode="${mode}"`, disabled: !on })}</div>
        <div style="flex:1 1 200px">${slider({ id: `bg:patternOpacity:${mode}`, label: 'Deckkraft', unit: '%', min: 0, max: 100, value: s.patternOpacity, def: 12, attrs: `data-bgf="patternOpacity" data-mode="${mode}"`, disabled: !on })}</div>
      </div>
    </div>`;
}

// Abschnitt „Hintergrundbild" eines Modus (aus der Mediathek oder URL).
function imageRow(mode) {
  const s = getSiteBg(mode);
  const on = s.image !== '';
  const dis = on ? '' : 'disabled';
  const url = previewUrl(s.image);
  const thumb = url
    ? `<img src="${esc(url)}" alt="" />`
    : '<span class="hint" style="margin:0">Kein Bild</span>';
  const staged = s.image.startsWith('staged:');
  return `
    <div class="bg-sub" data-bgimage="${mode}">
      <div class="bg-sub-title">Hintergrundbild <span class="hint" style="margin:0;font-weight:400">– aus der Mediathek, liegt unter Farbe/Muster und Effekten</span></div>
      <div class="row" style="align-items:flex-start">
        <div class="bg-thumb" data-bgthumb="${mode}">${thumb}</div>
        <div style="flex:1 1 220px">
          <div class="row" style="margin:0">
            <button type="button" data-bgpick="${mode}" style="flex:0 0 auto">📂 Aus Mediathek wählen</button>
            <button type="button" class="danger" data-bgimgclear="${mode}" ${dis} style="flex:0 0 auto">Entfernen</button>
          </div>
          <label style="margin-top:.5rem">Bild-URL <span class="hint" style="margin:0">(z.B. /uploads/… oder https://…)</span></label>
          <input type="text" data-bgf="image" data-mode="${mode}" value="${esc(staged ? '' : s.image)}" placeholder="${staged ? 'Lokales Medium (wird beim Veröffentlichen hochgeladen)' : '/uploads/…'}" />
        </div>
      </div>
      <div class="row" style="align-items:flex-end;margin-top:.2rem;${on ? '' : 'opacity:.45'}">
        <div style="flex:1 1 200px">${slider({ id: `bg:imageDarken:${mode}`, label: 'Abdunkelung', unit: '%', min: 0, max: 100, value: s.imageDarken, def: 0, attrs: `data-bgf="imageDarken" data-mode="${mode}"`, disabled: !on })}</div>
        <div style="flex:1 1 200px">${slider({ id: `bg:imageBlur:${mode}`, label: 'Weichzeichner', unit: 'px', min: 0, max: 40, value: s.imageBlur, def: 0, attrs: `data-bgf="imageBlur" data-mode="${mode}"`, disabled: !on })}</div>
        <div style="flex:1 1 200px">${slider({ id: `bg:imageOpacity:${mode}`, label: 'Deckkraft', unit: '%', min: 0, max: 100, value: s.imageOpacity, def: 100, attrs: `data-bgf="imageOpacity" data-mode="${mode}"`, disabled: !on })}</div>
        <label style="display:flex;align-items:center;gap:.4rem;color:var(--text);margin:0 0 .5rem;flex:0 0 auto">
          <input type="checkbox" data-bgf="imageFixed" data-mode="${mode}" ${s.imageFixed ? 'checked' : ''} ${dis} style="width:auto" /> Fixiert beim Scrollen
        </label>
      </div>
      <p class="hint" data-bgxnote="${mode}" style="margin-top:.4rem">${extrasNote(mode)}</p>
    </div>`;
}

function modeRow(mode, label) {
  const s = getSiteBg(mode);
  const on = s.color !== '';
  const dis = on ? '' : 'disabled';
  const anySet = on || s.pattern !== 'none' || s.image !== '';
  const colorVal = s.color || PAGE_BG_DEFAULT[mode];
  const typeOpts = SITE_GRADIENT_TYPES.map(
    (t) =>
      `<option value="${t}" ${s.type === t ? 'selected' : ''}>${GRADIENT_TYPE_LABEL[t]}</option>`,
  ).join('');
  const gradDis = on && s.gradient ? '' : 'disabled';
  return `
    <div style="border:1px solid var(--border);border-radius:8px;padding:.8rem;margin-top:.6rem" data-bgmode="${mode}">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:.4rem;color:var(--text);margin:0;flex:1 1 auto">
          <input type="checkbox" data-bgen="${mode}" ${on ? 'checked' : ''} style="width:auto" />
          Eigene Hintergrundfarbe für ${label} verwenden
        </label>
        <button type="button" class="hd-reset" data-bgreset="${mode}" title="Diesen Modus auf Standard zurücksetzen (Farbe, Muster, Bild)" ${anySet ? '' : 'disabled'}>↺ Standard</button>
      </div>
      <div class="row" style="margin-top:.6rem;align-items:flex-end">
        <div style="flex:0 0 auto">
          <label>${s.gradient ? 'Startfarbe' : 'Farbe'}</label>
          ${colorPicker({ id: `bg:color:${mode}`, attrs: `data-bgf="color" data-mode="${mode}"`, value: colorVal, disabled: !on })}
        </div>
        <div style="flex:1 1 260px">${slider({ id: `bg:opacity:${mode}`, label: 'Deckkraft', hint: `(mischt mit der Standardfarbe ${PAGE_BG_DEFAULT[mode]})`, unit: '%', min: 0, max: 100, value: s.opacity, def: 100, attrs: `data-bgf="opacity" data-mode="${mode}"`, disabled: !on })}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem">
        <label style="display:flex;align-items:center;gap:.4rem;color:var(--text);margin:0">
          <input type="checkbox" data-bgf="gradient" data-mode="${mode}" ${s.gradient ? 'checked' : ''} ${dis} style="width:auto" /> Farbverlauf
        </label>
      </div>
      <div class="row" style="align-items:flex-end;${on && s.gradient ? '' : 'opacity:.45'}">
        <div style="flex:0 0 auto">
          <label>Endfarbe</label>
          ${colorPicker({ id: `bg:color2:${mode}`, attrs: `data-bgf="color2" data-mode="${mode}"`, value: s.color2 || GRADIENT_END_DEFAULT[mode], disabled: !(on && s.gradient) })}
        </div>
        <div style="flex:0 0 auto">
          <label>Art</label>
          <select data-bgf="type" data-mode="${mode}" ${gradDis} style="width:auto">${typeOpts}</select>
        </div>
        <div style="flex:1 1 260px">${slider({ id: `bg:angle:${mode}`, label: 'Richtung', hint: '(0° = von unten nach oben, 180° = von oben nach unten)', unit: '°', min: 0, max: 360, value: s.angle, def: 180, attrs: `data-bgf="angle" data-mode="${mode}"`, disabled: !(on && s.gradient) || s.type === 'radial' })}</div>
      </div>
      <p class="hint" data-bgnote="${mode}" style="margin-top:.6rem">${noteFor(mode)}</p>
      ${patternRow(mode)}
      ${imageRow(mode)}
    </div>`;
}

// --- Abgesetzte Sektionen (Audio / Bild / Diverse), je Sektion Hell + Dunkel ---
// Bild-Ebene einer Sektion für die Vorschau: { url, filter, opacity } oder null.
function sectionImageLayer(key, mode) {
  const c = getSiteSection(key, mode);
  const url = previewUrl(c.image);
  if (!url) return null;
  const f = [];
  if (c.imageBlur > 0) f.push(`blur(${c.imageBlur}px)`);
  if (c.imageDarken > 0) f.push(`brightness(${(1 - c.imageDarken / 100).toFixed(3)})`);
  return { url, filter: f.join(' ') || 'none', opacity: c.imageOpacity / 100 };
}
function sectionTint(key, mode) {
  const c = getSiteSection(key, mode);
  return c.color ? rgbaFromHex(c.color, c.opacity) : 'transparent';
}
function sectionImgStyle(key, mode) {
  const l = sectionImageLayer(key, mode);
  if (!l) return 'display:none';
  return `background:url('${l.url.replace(/['"]/g, '')}') center / cover no-repeat;filter:${l.filter};opacity:${l.opacity}`;
}
// Abstand der Vorschau-Streifen: Seitenwert im Maßstab 1:10 (mind. 1 px Trennlinie).
function previewGap() {
  return Math.max(1, Math.round(getSectionGap() / 10));
}
// Drei Streifen (Audio/Bild/Diverse) unter dem Beispielinhalt der Vorschau.
function sectionStrips(mode) {
  return `
    <div class="fx-prev-secs ${getSectionStyle()}" style="gap:${previewGap()}px">
      ${SITE_SECTION_KEYS.map(
        (k) => `
        <div class="fx-prev-sec" data-secprev="${k}" data-mode="${mode}">
          <div class="fx-prev-sec-img" style="${sectionImgStyle(k, mode)}"></div>
          <div class="fx-prev-sec-tint" style="background:${sectionTint(k, mode)}"></div>
          <span>${SECTION_LABELS[k]}</span>
        </div>`,
      ).join('')}
    </div>`;
}
function sectionNote() {
  const parts = [];
  for (const k of SITE_SECTION_KEYS) {
    const bits = [];
    for (const mode of ['light', 'dark']) {
      const c = getSiteSection(k, mode);
      const what = [c.color ? `Tönung ${c.opacity} %` : '', c.image ? 'Bild' : ''].filter(Boolean);
      if (what.length) bits.push(`${mode === 'dark' ? 'Dunkel' : 'Hell'}: ${what.join(' + ')}`);
    }
    if (bits.length) parts.push(`${SECTION_LABELS[k]} (${bits.join(', ')})`);
  }
  const gap = getSectionGap();
  return parts.length
    ? `✅ Abgesetzt: ${parts.join(' · ')}${gap > 0 ? ` · Abstand ${gap} px` : ''}.`
    : 'Keine Sektion abgesetzt – die Sektionen liegen wie bisher direkt auf dem Seitenhintergrund.';
}
// Eine Spalte (Hell oder Dunkel) einer Sektion: Tönung + Bild.
function sectionCol(key, mode) {
  const c = getSiteSection(key, mode);
  const on = c.color !== '';
  const a = `data-key="${key}" data-mode="${mode}"`;
  const url = previewUrl(c.image);
  const thumb = url
    ? `<img src="${esc(url)}" alt="" />`
    : '<span class="hint" style="margin:0">Kein Bild</span>';
  const imgDis = c.image ? '' : 'disabled';
  return `
    <div class="sec-col" data-seccol="${key}" data-mode="${mode}">
      <div class="sec-col-title">${mode === 'dark' ? 'Dunkel 🌙' : 'Hell ☀️'}</div>
      <label style="display:flex;align-items:center;gap:.4rem;color:var(--text);margin:0">
        <input type="checkbox" data-secen="${key}" data-mode="${mode}" ${on ? 'checked' : ''} style="width:auto" /> Tönung
      </label>
      <div class="row" style="align-items:flex-end;margin-top:.3rem">
        <div style="flex:0 0 auto">
          ${colorPicker({ id: `sec:${key}:${mode}:color`, attrs: `data-secf="color" ${a}`, value: c.color || SECTION_TINT_DEFAULT[mode], disabled: !on })}
        </div>
        <div style="flex:1 1 160px">${slider({ id: `sec:${key}:${mode}:opacity`, label: 'Deckkraft', unit: '%', min: 0, max: 100, value: c.opacity, def: 8, attrs: `data-secf="opacity" ${a}`, disabled: !on, labelStyle: 'margin-top:0' })}</div>
      </div>
      <div class="row" style="align-items:center;margin-top:.4rem">
        <div class="bg-thumb sm" data-secthumb="${key}" data-mode="${mode}">${thumb}</div>
        <div class="row" style="margin:0;flex:1 1 auto;gap:.3rem">
          <button type="button" data-secpick="${key}" data-mode="${mode}" style="flex:0 0 auto;padding:.3rem .5rem;font-size:.8rem">📂 Bild</button>
          <button type="button" class="danger" data-secimgclear="${key}" data-mode="${mode}" ${imgDis} style="flex:0 0 auto;padding:.3rem .5rem;font-size:.8rem" title="Bild entfernen">✕</button>
        </div>
      </div>
      <div class="row" style="align-items:flex-end;margin-top:.2rem;${c.image ? '' : 'display:none'}">
        <div style="flex:1 1 150px">${slider({ id: `sec:${key}:${mode}:imageDarken`, label: 'Dunkler', unit: '%', min: 0, max: 100, value: c.imageDarken, def: 0, attrs: `data-secf="imageDarken" ${a}`, disabled: !c.image, labelStyle: 'margin-top:0' })}</div>
        <div style="flex:1 1 150px">${slider({ id: `sec:${key}:${mode}:imageBlur`, label: 'Weich', unit: 'px', min: 0, max: 40, value: c.imageBlur, def: 0, attrs: `data-secf="imageBlur" ${a}`, disabled: !c.image, labelStyle: 'margin-top:0' })}</div>
        <div style="flex:1 1 150px">${slider({ id: `sec:${key}:${mode}:imageOpacity`, label: 'Deckkraft', unit: '%', min: 0, max: 100, value: c.imageOpacity, def: 100, attrs: `data-secf="imageOpacity" ${a}`, disabled: !c.image, labelStyle: 'margin-top:0' })}</div>
      </div>
    </div>`;
}
function sectionsPanel() {
  const style = getSectionStyle();
  const opts = Object.keys(SECTION_STYLE_LABEL)
    .map(
      (v) =>
        `<option value="${v}" ${style === v ? 'selected' : ''}>${SECTION_STYLE_LABEL[v]}</option>`,
    )
    .join('');
  return `
    <div class="panel">
      <h2>Abgesetzte Sektionen <span class="lang-badge">gilt für Hell + Dunkel</span></h2>
      <p class="hint" style="margin-top:0">
        <strong>Audio-, Bild- und Diverse-Tools</strong> abwechselnd mit leicht anderer <strong>Tönung</strong>
        oder einem <strong>Bild</strong> absetzen, damit die Startseite beim Scrollen Struktur bekommt.
        Je Sektion getrennt für Hell und Dunkel; ohne Tönung und Bild bleibt alles wie bisher.
        Wirkung unten in der Vorschau (drei Streifen).
      </p>
      <div class="row" style="align-items:flex-end">
        <div style="flex:1 1 220px">
          <label>Darstellung</label>
          <select data-secstyle>${opts}</select>
        </div>
        <div style="flex:1 1 260px">${slider({ id: 'gap', label: 'Abstand zwischen den Sektionen', hint: '(px Seitenhintergrund zwischen zwei Bändern)', unit: 'px', min: 0, max: SECTION_GAP_MAX, value: getSectionGap(), def: 0, attrs: 'data-secgap' })}</div>
        <div style="flex:0 0 auto;display:flex;gap:.4rem;flex-wrap:wrap">
          <button type="button" class="primary" data-secalt title="Audio- und Diverse-Tools dezent tönen, Bild-Tools frei lassen (Hell + Dunkel)">✨ Abwechselnd anwenden</button>
          <button type="button" data-secclear title="Alle Sektionen auf Standard (keine Tönung, kein Bild)">↺ Alle zurücksetzen</button>
        </div>
      </div>
      ${SITE_SECTION_KEYS.map(
        (k) => `
        <div class="sec-box">
          <div class="bg-sub-title">${SECTION_LABELS[k]}</div>
          <div class="sec-cols">${sectionCol(k, 'light')}${sectionCol(k, 'dark')}</div>
        </div>`,
      ).join('')}
      <p class="hint" data-secnote style="margin-top:.6rem">${sectionNote()}</p>
    </div>`;
}
// Vorschau-Streifen + Hinweis nach Regler-Änderung aktualisieren (ohne Neu-Rendern).
function refreshSections(pane) {
  for (const k of SITE_SECTION_KEYS) {
    for (const mode of ['light', 'dark']) {
      const strip = pane.querySelector(`[data-secprev="${k}"][data-mode="${mode}"]`);
      if (!strip) continue;
      strip.querySelector('.fx-prev-sec-img').setAttribute('style', sectionImgStyle(k, mode));
      strip.querySelector('.fx-prev-sec-tint').style.background = sectionTint(k, mode);
    }
  }
  pane.querySelectorAll('.fx-prev-secs').forEach((el) => {
    el.style.gap = `${previewGap()}px`;
  });
  const note = pane.querySelector('[data-secnote]');
  if (note) note.textContent = sectionNote();
}
function bindSections(pane) {
  pane.querySelectorAll('[data-secgap]').forEach((inp) => {
    inp.addEventListener('input', () => {
      setSectionGap(inp.value);
      refreshSections(pane);
    });
  });
  const sel = pane.querySelector('[data-secstyle]');
  if (sel)
    sel.addEventListener('change', () => {
      setSectionStyle(sel.value);
      renderBackground();
    });
  pane.querySelector('[data-secalt]')?.addEventListener('click', () => {
    for (const mode of ['light', 'dark']) {
      setSiteSection('audio', mode, { color: SECTION_TINT_DEFAULT[mode], opacity: 8 });
      setSiteSection('image', mode, { color: '' });
      setSiteSection('diverse', mode, { color: SECTION_TINT_DEFAULT[mode], opacity: 8 });
    }
    renderBackground();
    toast('Abwechselnde Tönung angewandt (Audio + Diverse)');
  });
  pane.querySelector('[data-secclear]')?.addEventListener('click', () => {
    for (const k of SITE_SECTION_KEYS)
      for (const mode of ['light', 'dark']) setSiteSection(k, mode, defaultSectionSide());
    renderBackground();
    toast('Alle Sektionen zurückgesetzt');
  });
  pane.querySelectorAll('[data-secen]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.secen;
      const mode = cb.dataset.mode;
      if (cb.checked) {
        const inp = pane.querySelector(
          `[data-secf="color"][data-key="${key}"][data-mode="${mode}"]`,
        );
        setSiteSection(key, mode, { color: (inp && inp.value) || SECTION_TINT_DEFAULT[mode] });
      } else setSiteSection(key, mode, { color: '' });
      renderBackground();
    });
  });
  pane.querySelectorAll('[data-secf]').forEach((inp) => {
    const { key, mode, secf: field } = inp.dataset;
    inp.addEventListener('input', () => {
      setSiteSection(key, mode, { [field]: inp.value });
      refreshSections(pane);
    });
  });
  pane.querySelectorAll('[data-secpick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.secpick;
      const mode = btn.dataset.mode;
      const srv = ['de', 'en', 'shared'].reduce(
        (n, l) => n + (state.serverFiles[l] || []).length,
        0,
      );
      if (!state.stagedItems.length && !srv) {
        toast('Keine Medien vorhanden — zuerst im Tab „Mediathek" eine Datei hinzufügen.');
        return;
      }
      openMediaPicker('de', 'section', {
        allLangs: true,
        imagesOnly: true,
        title: `Bild für ${SECTION_LABELS[key]} (${mode === 'dark' ? 'Dunkelmodus' : 'Hellmodus'}) wählen`,
        onPick: (url) => {
          setSiteSection(key, mode, { image: url });
          renderBackground();
        },
      });
    });
  });
  pane.querySelectorAll('[data-secimgclear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSiteSection(btn.dataset.secimgclear, btn.dataset.mode, { image: '' });
      renderBackground();
    });
  });
}

function backgroundPanel() {
  return `
    ${stickyPreview()}
    <div class="panel">
      <h2>Seiten-Hintergrund</h2>
      <p class="hint" style="margin-top:0">
        Legt den <strong>Hintergrund der gesamten Website</strong> fest (beide Sprachen).
        Getrennt einstellbar für <strong>Hell-</strong> und <strong>Dunkelmodus</strong>: Farbe,
        <strong>Deckkraft</strong> (Mischung mit der Standardfarbe), optional ein <strong>Farbverlauf</strong>,
        ein <strong>Muster</strong> (Punktraster/Gitter) und ein <strong>Hintergrundbild</strong> aus der Mediathek;
        darunter die zuschaltbaren <strong>Effekte</strong>. Die Vorschau bleibt beim Scrollen oben sichtbar.
      </p>
      ${modeRow('light', 'den Hellmodus')}
      ${modeRow('dark', 'den Dunkelmodus')}
    </div>
    ${sectionsPanel()}
    ${effectsPanel()}`;
}

// Sticky-Live-Vorschau (Hell + Dunkel nebeneinander): Seitenfarbe/Verlauf/
// Deckkraft als Grund, darüber die Effekt-Ebenen (Aurora, Rauschen, Spotlight
// folgt der Maus) und Beispiel-Inhalt (Überschrift, Text, Karte) wie auf der Seite.
// Liegt direkt in #content (nicht im Panel), damit sie über den ganzen Tab klebt.
function stickyPreview() {
  const anyFx = SITE_FX.some((fx) => getSiteFx(fx.key).on);
  return `
    <div class="tc-sticky">
      <p class="hint" style="margin:.1rem 0 .4rem">Live-Vorschau Hell + Dunkel <em>(inkl. Effekte${
        anyFx ? '; Maus über die Vorschau bewegen zeigt das Spotlight' : ' – derzeit alle aus'
      })</em>:</p>
      <div class="fx-prevs">${fxPreview('light')}${fxPreview('dark')}</div>
    </div>`;
}

// --- Effekte: je Effekt Schalter + Intensität, darunter Live-Vorschau Hell/Dunkel ---
function fxRow(fx) {
  const s = getSiteFx(fx.key);
  return `
    <div style="border:1px solid var(--border);border-radius:8px;padding:.7rem .8rem;margin-top:.6rem">
      <label style="display:flex;align-items:center;gap:.4rem;color:var(--text);margin:0;font-weight:600">
        <input type="checkbox" data-fxon="${fx.key}" ${s.on ? 'checked' : ''} style="width:auto" /> ${esc(fx.label)}
      </label>
      <p class="hint" style="margin:.2rem 0 .4rem">${FX_DESC[fx.key] || ''}</p>
      ${slider({ id: `fx:${fx.key}`, label: 'Intensität', unit: '%', min: 0, max: 100, value: s.intensity, def: 50, attrs: `data-fxint="${fx.key}"`, disabled: !s.on, labelStyle: 'margin-top:0' })}
    </div>`;
}
function fxPreview(mode) {
  const a = getSiteFx('fxAurora');
  const n = getSiteFx('fxNoise');
  const sp = getSiteFx('fxSpotlight');
  return `
    <div class="fx-prev" data-fxprev="${mode}" data-bgprev="${mode}" style="${previewStyle(mode)}" title="${sp.on ? 'Maus bewegen: Spotlight folgt dem Zeiger' : ''}">
      <div class="fx-prev-layer" data-fxlayer="image" style="${imageLayerStyle(mode)}"></div>
      <div class="fx-prev-layer" data-fxlayer="aurora" style="background:${AURORA_BG[mode]};opacity:${a.on ? a.intensity / 100 : 0}"></div>
      <div class="fx-prev-layer" data-fxlayer="noise" style="opacity:${n.on ? (n.intensity / 100) * FX_NOISE_MAX : 0}"></div>
      <div class="fx-prev-layer" data-fxlayer="spot"></div>
      <div class="fx-prev-content">
        <span class="fx-prev-label">${mode === 'dark' ? 'Dunkel 🌙' : 'Hell ☀️'}</span>
        <div class="fx-prev-title">Kostenlose Online-Tools</div>
        <div class="fx-prev-text">Überschrift, Text und Karten liegen auf diesem Hintergrund.</div>
        <div class="fx-prev-card ${mode}">
          <span class="fx-prev-badge">Beispiel</span>
          <div class="fx-prev-card-title">Tool-Karte</div>
        </div>
        ${sectionStrips(mode)}
      </div>
    </div>`;
}
function effectsPanel() {
  return `
    <div class="panel">
      <h2>Effekte <span class="lang-badge">gilt für Hell + Dunkel</span></h2>
      <p class="hint" style="margin-top:0">Zuschaltbare Hintergrund-Effekte für die ganze Website. Jeder Effekt einzeln ein-/ausschaltbar mit eigener Intensität; die Farben passen sich dem Modus an. Alles aus = wie bisher. Wirkung oben in der Sticky-Vorschau.</p>
      ${SITE_FX.map(fxRow).join('')}
    </div>`;
}
// Vorschau-Ebenen nach Regler-Änderung aktualisieren (ohne Neu-Rendern).
function refreshFx(pane) {
  const a = getSiteFx('fxAurora');
  const n = getSiteFx('fxNoise');
  for (const mode of ['light', 'dark']) {
    const box = pane.querySelector(`[data-fxprev="${mode}"]`);
    if (!box) continue;
    box.querySelector('[data-fxlayer="aurora"]').style.opacity = a.on ? a.intensity / 100 : 0;
    box.querySelector('[data-fxlayer="noise"]').style.opacity = n.on
      ? (n.intensity / 100) * FX_NOISE_MAX
      : 0;
    const sp = box.querySelector('[data-fxlayer="spot"]');
    if (sp && !getSiteFx('fxSpotlight').on) sp.style.background = '';
  }
}
function bindEffects(pane) {
  pane.querySelectorAll('[data-fxon]').forEach((cb) => {
    cb.addEventListener('change', () => {
      setSiteFx(cb.dataset.fxon, { on: cb.checked });
      renderBackground();
    });
  });
  pane.querySelectorAll('[data-fxint]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const key = inp.dataset.fxint;
      setSiteFx(key, { intensity: inp.value });
      refreshFx(pane);
    });
  });
  // Spotlight in der Vorschau: folgt der Maus innerhalb der Box.
  pane.querySelectorAll('[data-fxprev]').forEach((box) => {
    const mode = box.dataset.fxprev;
    const spot = box.querySelector('[data-fxlayer="spot"]');
    box.addEventListener('mousemove', (e) => {
      const s = getSiteFx('fxSpotlight');
      if (!s.on || !spot) return;
      const r = box.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      const alpha = (SPOT_ALPHA[mode] * (s.intensity / 100)).toFixed(3);
      spot.style.background = `radial-gradient(420px circle at ${x}% ${y}%, ${SPOT_BASE[mode].replace('A', alpha)}, transparent 45%)`;
    });
    box.addEventListener('mouseleave', () => {
      if (spot) spot.style.background = '';
    });
  });
}

export function renderBackground() {
  const pane = $('#content');
  pane.innerHTML = backgroundPanel();
  bindBackground(pane);
  bindSections(pane);
  bindEffects(pane);
  bindSliders(pane); // nach den Feld-Handlern: Zahlenfeld/„↺" lösen deren input-Event aus
  bindColorPickers(pane);
}

function refreshMode(pane, mode) {
  const prev = pane.querySelector(`[data-bgprev="${mode}"]`);
  if (prev) prev.setAttribute('style', previewStyle(mode)); // nur Grund; Ebenen sind Kinder
  const img = pane.querySelector(`[data-fxprev="${mode}"] [data-fxlayer="image"]`);
  if (img) img.setAttribute('style', imageLayerStyle(mode));
  const note = pane.querySelector(`[data-bgnote="${mode}"]`);
  if (note) note.textContent = noteFor(mode);
  const xnote = pane.querySelector(`[data-bgxnote="${mode}"]`);
  if (xnote) xnote.textContent = extrasNote(mode);
}

function bindBackground(pane) {
  pane.querySelectorAll('[data-bgen]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const mode = cb.dataset.bgen;
      if (cb.checked) {
        // Einschalten: aktuelle Farbwahl (oder Modus-Standard) übernehmen.
        const color = pane.querySelector(`[data-bgf="color"][data-mode="${mode}"]`);
        setSiteBg(mode, { color: (color && color.value) || PAGE_BG_DEFAULT[mode] });
      } else {
        // Ausschalten: keine eigene Farbe -> Standard des Modus (Verlauf/Deckkraft bleiben gespeichert).
        setSiteBg(mode, { color: '' });
      }
      renderBackground(); // Felder aktivieren/deaktivieren
    });
  });
  pane.querySelectorAll('[data-bgf]').forEach((inp) => {
    const mode = inp.dataset.mode;
    const field = inp.dataset.bgf;
    const evt =
      inp.type === 'checkbox' || inp.type === 'text' || inp.tagName === 'SELECT'
        ? 'change'
        : 'input';
    inp.addEventListener(evt, () => {
      if (field === 'gradient') {
        const patch = { gradient: inp.checked };
        // Beim Einschalten ohne Endfarbe: passenden Vorschlag setzen.
        if (inp.checked && !getSiteBg(mode).color2) patch.color2 = GRADIENT_END_DEFAULT[mode];
        setSiteBg(mode, patch);
        renderBackground();
        return;
      }
      if (field === 'type' || field === 'pattern' || field === 'image') {
        setSiteBg(mode, { [field]: inp.value });
        if (field === 'image' && inp.value.trim() && !getSiteBg(mode).image)
          toast('Ungültige Bild-URL – erlaubt sind /pfad oder https://…');
        renderBackground(); // Felder aktivieren/deaktivieren (Richtung nur bei linear usw.)
        return;
      }
      setSiteBg(mode, { [field]: inp.type === 'checkbox' ? inp.checked : inp.value });
      refreshMode(pane, mode);
    });
  });
  pane.querySelectorAll('[data-bgpick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.bgpick;
      const srv = ['de', 'en', 'shared'].reduce(
        (n, l) => n + (state.serverFiles[l] || []).length,
        0,
      );
      if (!state.stagedItems.length && !srv) {
        toast('Keine Medien vorhanden — zuerst im Tab „Mediathek" eine Datei hinzufügen.');
        return;
      }
      openMediaPicker('de', 'bgImage', {
        allLangs: true,
        imagesOnly: true,
        title: `Hintergrundbild (${mode === 'dark' ? 'Dunkelmodus' : 'Hellmodus'}) wählen`,
        onPick: (url) => {
          setSiteBg(mode, { image: url });
          renderBackground();
        },
      });
    });
  });
  pane.querySelectorAll('[data-bgimgclear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSiteBg(btn.dataset.bgimgclear, { image: '' });
      renderBackground();
    });
  });
  pane.querySelectorAll('[data-bgreset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.bgreset;
      setSiteBg(mode, {
        color: '',
        opacity: 100,
        gradient: false,
        color2: '',
        type: 'linear',
        angle: 180,
        pattern: 'none',
        patternColor: '',
        patternSpacing: 24,
        patternThickness: 1,
        patternOpacity: 12,
        image: '',
        imageDarken: 0,
        imageBlur: 0,
        imageOpacity: 100,
        imageFixed: true,
      });
      renderBackground();
      toast(`${mode === 'dark' ? 'Dunkelmodus' : 'Hellmodus'} auf Standard zurückgesetzt`);
    });
  });
}
