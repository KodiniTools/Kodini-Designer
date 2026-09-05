// Hero-Design-Tab (eine Sprache): Rahmen, Hintergrund und die Buttons
// (Feature-Chips) des Hero-Bereichs gestalten – getrennt für Hell- und
// Dunkelmodus – samt Live-Vorschau, plus die Button-Beschriftungen. Styling
// wird in media.<lang>.heroDesign (mit .light/.dark) gespeichert; die
// Beschriftungen laufen über die vorhandenen Overrides (hero.features.*).

import { $, esc, toast } from './core.js';
import {
  state,
  rgbaFromHex,
  defaultHeroDesign,
  heroSideLight,
  heroSideDark,
  getGlobalFont,
  setGlobalFont,
  getPath,
  setPath,
  delPath,
  MEDIA_LANGS,
} from './model.js';
import { ensureFontFace, fontOptionsHtml } from './fonts.js';
import { slider, bindSliders } from './slider.js';
import { colorPicker, bindColorPickers } from './color.js';

// Family-CSS für eine Schriftdatei (lädt @font-face für die Vorschau) oder ''.
// Einfache Anführungszeichen um den Family-Namen, damit der Wert gefahrlos in
// doppelt-gequotete HTML-style="…"-Attribute eingesetzt werden kann (sonst
// kollidieren die Anführungszeichen und font-family wird ungültig).
function fontFF(file) {
  return file ? `'${ensureFontFace(file)}', system-ui, sans-serif` : '';
}

// Aktuell im Editor bearbeiteter Modus (UI-Zustand, nicht gespeichert).
let editTheme = 'light';

// Feature-Schlüssel (Reihenfolge wie in den Locale-Dateien); Fallback, falls die
// Defaults (noch) nicht geladen sind.
const FEATURE_FALLBACK = [
  'free',
  'privacy',
  'browserBased',
  'serverBased',
  'multiLanguage',
  'noInstall',
];
function featureDefs(lang) {
  const f = state.defaults[lang]?.hero?.features;
  const keys = f && typeof f === 'object' ? Object.keys(f) : FEATURE_FALLBACK;
  return keys.map((k) => ({ key: k, def: (f && f[k]) || '' }));
}

function heroDesignOf(lang) {
  const hd = state.media[lang] && state.media[lang].heroDesign;
  if (!hd || !hd.light || !hd.dark) {
    state.media[lang].heroDesign = defaultHeroDesign();
    return state.media[lang].heroDesign;
  }
  return hd;
}
// Der aktuell bearbeitete Farb-Satz (Hell oder Dunkel).
function sideOf(lang) {
  return heroDesignOf(lang)[editTheme];
}
// Standard-Werte des aktuell bearbeiteten Modus (Hell/Dunkel).
function sideDefault() {
  return editTheme === 'dark' ? heroSideDark() : heroSideLight();
}

// Kleiner „Zurücksetzen"-Button (↺) für ein einzelnes Feld. `scope` bestimmt,
// worauf sich `key` bezieht: 'side' = Farb-/Zahlenwert des aktuellen Modus
// (bei Farbe+Transparenz beide Felder als "farbe:transparenz"), 'typo'/'font'
// = für beide Modi geltende Typografie/Schrift, 'enabled' = An-Schalter,
// 'feat' = Button-Beschriftung (Override).
function resetBtn(scope, key = '') {
  return `<button type="button" class="hd-reset" data-hdreset="${esc(scope)}"${
    key ? ` data-hdkey="${esc(key)}"` : ''
  } title="Auf Standard zurücksetzen" aria-label="Auf Standard zurücksetzen">↺</button>`;
}
// Umschließt ein Eingabe-Element mit seinem Zurücksetzen-Button (nebeneinander).
function withReset(inputHtml, scope, key = '') {
  return `<div style="display:flex;gap:.3rem;align-items:center">${inputHtml}${resetBtn(
    scope,
    key,
  )}</div>`;
}

// Inline-Style der Vorschau-Box (zeigt die Werte des bearbeiteten Modus).
function previewBoxStyle(s) {
  const bg = rgbaFromHex(s.bgColor, s.bgOpacity);
  // Globale Basis-Schrift als Grundschrift der Vorschau (Titel/Chips/CTA ohne
  // eigene Schrift erben sie – wie auf der echten Seite).
  const gf = fontFF(getGlobalFont());
  const base = gf ? `font-family:${gf};` : '';
  return `${base}background:${bg};border:${s.borderWidth}px solid ${s.borderColor};border-radius:1rem;padding:1.1rem 1rem;text-align:center`;
}
function previewChipStyle(s, hd) {
  const bg = rgbaFromHex(s.chipBgColor, s.chipBgOpacity);
  const bd = rgbaFromHex(s.chipBorderColor, s.chipBorderOpacity);
  const size = hd.chipFontSize > 0 ? `${hd.chipFontSize}px` : '.78rem';
  return `background:${bg};color:${s.chipTextColor};border:1px solid ${bd};border-radius:.6rem;padding:.5rem .3rem;font-weight:600;font-size:${size};text-align:center;${buttonTypo(hd)}`;
}
function previewCtaStyle(s, hd) {
  const size = hd.ctaFontSize > 0 ? `${hd.ctaFontSize}px` : '.9rem';
  const bg = rgbaFromHex(s.ctaBgColor, s.ctaBgOpacity);
  const bd =
    s.ctaBorderOpacity > 0
      ? `border:1px solid ${rgbaFromHex(s.ctaBorderColor, s.ctaBorderOpacity)};`
      : '';
  return `display:inline-block;margin-top:.9rem;padding:.55rem 1.6rem;border-radius:50px;background:${bg};color:${s.ctaTextColor};${bd}font-weight:700;font-size:${size};cursor:pointer;${buttonTypo(hd)}`;
}
function previewTitleStyle(s, hd) {
  const size = hd.titleFontSize > 0 ? `${hd.titleFontSize}px` : '1.1rem';
  return `font-weight:800;font-size:${size};color:${s.titleTextColor};${titleTypo(hd)}`;
}
function previewSubtitleStyle(s, hd) {
  const size = hd.subtitleFontSize > 0 ? `${hd.subtitleFontSize}px` : '.8rem';
  return `margin-top:.3rem;font-weight:500;font-size:${size};opacity:.85;color:${s.titleTextColor};${titleTypo(hd)}`;
}
// Typografie-CSS (Schrift + Abstand + Kontur) für Überschriften bzw. Buttons.
function titleTypo(hd) {
  const ff = fontFF(hd.titleFont);
  let css = ff ? `font-family:${ff};` : '';
  if (hd.titleLetterSpacing) css += `letter-spacing:${hd.titleLetterSpacing}px;`;
  if (hd.titleStrokeWidth > 0)
    css += `-webkit-text-stroke:${hd.titleStrokeWidth}px ${hd.titleStrokeColor};`;
  return css;
}
function buttonTypo(hd) {
  const ff = fontFF(hd.buttonFont);
  let css = ff ? `font-family:${ff};` : '';
  if (hd.buttonLetterSpacing) css += `letter-spacing:${hd.buttonLetterSpacing}px;`;
  if (hd.buttonStrokeWidth > 0)
    css += `-webkit-text-stroke:${hd.buttonStrokeWidth}px ${hd.buttonStrokeColor};`;
  return css;
}
// CSS-Regeln für den echten Hover-Effekt der Vorschau (Chips + CTA-Button).
function hoverRuleCss(s) {
  return (
    `[data-hdprev] [data-hdchip]:hover{background:${s.chipHoverBgColor} !important;color:${s.chipHoverTextColor} !important;border-color:transparent !important}` +
    `[data-hdprev] [data-hdcta]:hover{background:${s.ctaHoverBgColor} !important;color:${s.ctaHoverTextColor} !important}`
  );
}
function heroPreviewNote(hd) {
  return hd.enabled
    ? '✅ Dieses Hero-Design wird auf der Seite angewandt (Hell und Dunkel getrennt).'
    : '⚠️ „Eigenes Hero-Design verwenden" ist aus – auf der Seite bleibt das Standard-Design. Die Vorschau zeigt dein eingestelltes Design.';
}

// Ein Farb-/Transparenz-Paar (Color-Picker + optional Range) als Formularzeile.
// Liest die Werte aus dem aktuell bearbeiteten Farb-Satz `s`.
function colorField(lang, field, label, withOpacity, opacityField, s) {
  const op = withOpacity
    ? `<div style="flex:1 1 220px">${sideRange(lang, s, opacityField, `${label} – Transparenz`, 0, 100, '%')}</div>`
    : '';
  const picker = colorPicker({
    id: `hd:${field}`,
    attrs: `data-hd="${field}" data-lang="${lang}"`,
    value: s[field],
    resetHtml: resetBtn('side', field),
  });
  return `
      <div style="flex:0 0 auto">
        <label>${label}</label>
        ${picker}
      </div>${op}`;
}
// Zahlenwert des aktuellen Modus als Regler (Slider + Zahlenfeld + „↺" auf den Werkswert).
function sideRange(lang, s, field, label, min, max, unit, step = 1) {
  return slider({
    id: `hd:${field}`,
    label,
    unit,
    min,
    max,
    step,
    value: s[field],
    attrs: `data-hd="${field}" data-lang="${lang}"`,
    resetAttrs: `data-hdreset="side" data-hdkey="${field}"`,
  });
}
// Typografie-Wert (gilt für beide Modi) als Regler.
function typoRange(hd, field, label, min, max, unit, step = 1) {
  return slider({
    id: `hd:${field}`,
    label,
    unit,
    min,
    max,
    step,
    value: hd[field],
    attrs: `data-hdtypo="${field}"`,
    resetAttrs: `data-hdreset="typo" data-hdkey="${field}"`,
  });
}

// Umschalter Hell/Dunkel für den bearbeiteten Modus.
function themeSwitch() {
  const btn = (key, label) =>
    `<button data-hdtheme="${key}" class="${editTheme === key ? 'primary' : ''}" style="flex:0 0 auto">${label}</button>`;
  return `
      <div class="row" style="gap:.4rem;margin:.9rem 0 .2rem;align-items:center">
        <span class="hint" style="margin:0">Modus bearbeiten:</span>
        ${btn('light', '☀️ Hell')}
        ${btn('dark', '🌙 Dunkel')}
      </div>
      <p class="hint" style="margin:.1rem 0 .4rem">Hell- und Dunkelmodus werden getrennt gespeichert. Wechsle oben, um den jeweils anderen Modus zu gestalten.</p>`;
}

// Klappbare Sektion (Details/Summary) – standardmäßig geöffnet.
function section(title, body, open = true) {
  return `<details ${open ? 'open' : ''} style="border-top:1px solid var(--border);margin-top:.5rem;padding-top:.4rem">
        <summary style="cursor:pointer;font-weight:600;font-size:.95rem">${title}</summary>
        <div style="padding-top:.5rem">${body}</div>
      </details>`;
}

// Effektiver Text (Override, sonst Standard der Sprache, sonst Fallback).
function effLabel(lang, path, fallback) {
  const o = getPath(state.overrides[lang], path);
  if (o != null && o !== '') return o;
  const d = getPath(state.defaults[lang], path);
  return d != null && d !== '' ? d : fallback;
}

// Kachel-Galerie zur Wahl der GLOBALEN Basis-Schrift (sprachübergreifend, gilt
// für die ganze Seite). Jede Kachel zeigt eine Musterschrift; die aktive Kachel
// ist hervorgehoben. Erste Kachel = „Standard (System)" (setzt zurück).
function globalFontTiles() {
  const active = getGlobalFont();
  const tile = (file, label, isActive) => {
    const ff = fontFF(file); // lädt @font-face für die Vorschau (oder '')
    const sampleStyle = ff ? `font-family:${ff}` : '';
    // Muster = der Schriftname selbst, in der jeweiligen Schrift gerendert.
    // Darunter derselbe Name klein in der UI-Schrift zur sicheren Lesbarkeit.
    return `<button type="button" class="hd-fonttile${isActive ? ' active' : ''}" data-hdglobalfont="${esc(
      file,
    )}" title="Als globale Standard-Schrift der ganzen Seite aktivieren" aria-pressed="${
      isActive ? 'true' : 'false'
    }">
        <span class="hd-fonttile-sample" style="${sampleStyle}">${esc(label)}</span>
        <span class="hd-fonttile-label">${esc(label)}</span>
        ${isActive ? '<span class="hd-fonttile-badge">✓ Aktiv</span>' : ''}
      </button>`;
  };
  const tiles = [tile('', 'Standard (System)', !active)];
  for (const f of state.fonts) tiles.push(tile(f.name, f.label || f.name, f.name === active));
  return `<div class="hd-fonttiles">${tiles.join('')}</div>`;
}

function heroDesignPanel(lang) {
  const hd = heroDesignOf(lang);
  const s = sideOf(lang);
  const modusLabel = editTheme === 'light' ? 'Hell ☀️' : 'Dunkel 🌙';
  // Vorschau in der bearbeiteten Sprache (Titel, erste drei Chips, CTA).
  const previewTitle = effLabel(
    lang,
    ['hero', 'title'],
    lang === 'de' ? 'Kostenlose Online-Tools' : 'Free Online Tools',
  );
  const previewCta = effLabel(
    lang,
    ['hero', 'cta'],
    lang === 'de' ? 'Jetzt starten' : 'Get started',
  );
  const previewSubtitle = String(
    effLabel(
      lang,
      ['hero', 'subtitle'],
      lang === 'de' ? 'Sichere Bearbeitung im Browser' : 'Secure editing in the browser',
    ),
  ).split('\n')[0];
  const chips = featureDefs(lang)
    .slice(0, 3)
    .map(({ key, def }) => {
      const o = getPath(state.overrides[lang], ['hero', 'features', key]);
      const label = o != null && o !== '' ? o : def || key;
      return `<div data-hdchip style="${previewChipStyle(s, hd)}">${esc(label)}</div>`;
    })
    .join('');
  // Bausteine der klappbaren Sektionen.
  const typoBody = `
      <div class="row">
        <div style="flex:1 1 220px">
          <label>Überschriften-Schrift (Titel/Untertitel)</label>
          ${withReset(
            `<select data-hdfont="titleFont" data-lang="${lang}">${fontOptionsHtml(hd.titleFont)}</select>`,
            'font',
            'titleFont',
          )}
        </div>
        <div style="flex:1 1 220px">
          <label>Button-Schrift (Chips + „Jetzt starten")</label>
          ${withReset(
            `<select data-hdfont="buttonFont" data-lang="${lang}">${fontOptionsHtml(hd.buttonFont)}</select>`,
            'font',
            'buttonFont',
          )}
        </div>
      </div>
      <p class="hint" style="margin-bottom:.5rem">Aus dem Ordner <code>/fonts</code> auf dem Server. Wirkt auf beide Modi. Auch ohne „Eigenes Hero-Design" nutzbar.</p>

      <p class="hint" style="margin:.6rem 0 .1rem;font-weight:600;color:var(--text)">🌐 Globale Standard-Schrift der ganzen Seite <span class="lang-badge">gilt für DE + EN</span></p>
      <p class="hint" style="margin:.1rem 0 .4rem">Eine Kachel aktivieren, um diese Schrift als Basis-Schrift der <strong>gesamten Website</strong> zu setzen (Navigation, Tool-Karten, Texte, Footer …). Wirkt sofort überall; einzelne Hero-Schriften oben überschreiben sie im Hero. „Standard (System)" setzt auf die Werksschrift zurück.</p>
      ${globalFontTiles()}

      <p class="hint" style="margin:.2rem 0">✏️ Überschriften – Buchstabenabstand &amp; Kontur (Rahmen):</p>
      <div class="row" style="align-items:flex-end">
        <div style="flex:1 1 200px">${typoRange(hd, 'titleLetterSpacing', 'Abstand', -5, 20, 'px', 0.5)}</div>
        <div style="flex:0 0 auto">
          <label>Kontur-Farbe</label>
          ${colorPicker({ id: 'hd:titleStrokeColor', attrs: 'data-hdtypo="titleStrokeColor"', value: hd.titleStrokeColor, resetHtml: resetBtn('typo', 'titleStrokeColor') })}
        </div>
        <div style="flex:1 1 200px">${typoRange(hd, 'titleStrokeWidth', 'Kontur-Breite', 0, 5, 'px', 0.5)}</div>
      </div>
      <p class="hint" style="margin:.5rem 0 .2rem">✏️ Buttons – Buchstabenabstand &amp; Kontur (Rahmen):</p>
      <div class="row" style="align-items:flex-end">
        <div style="flex:1 1 200px">${typoRange(hd, 'buttonLetterSpacing', 'Abstand', -5, 20, 'px', 0.5)}</div>
        <div style="flex:0 0 auto">
          <label>Kontur-Farbe</label>
          ${colorPicker({ id: 'hd:buttonStrokeColor', attrs: 'data-hdtypo="buttonStrokeColor"', value: hd.buttonStrokeColor, resetHtml: resetBtn('typo', 'buttonStrokeColor') })}
        </div>
        <div style="flex:1 1 200px">${typoRange(hd, 'buttonStrokeWidth', 'Kontur-Breite', 0, 5, 'px', 0.5)}</div>
      </div>
      <p class="hint">Kontur-Breite 0 = keine Kontur. Buchstabenabstand 0 = normal.</p>
      <p class="hint" style="margin:.5rem 0 .2rem">🔠 Schriftgröße in px – leer = Standard (die Zahl im Feld ist die Standardgröße). Größere Zahl = größerer Text.</p>
      <div class="row" style="align-items:flex-end">
        <div style="flex:0 0 auto">
          <label>Titel</label>
          ${withReset(
            `<input type="number" data-hdtypo="titleFontSize" min="8" max="96" step="1" placeholder="Standard ≈ 40" value="${hd.titleFontSize || ''}" style="width:120px" />`,
            'typo',
            'titleFontSize',
          )}
        </div>
        <div style="flex:0 0 auto">
          <label>Untertitel</label>
          ${withReset(
            `<input type="number" data-hdtypo="subtitleFontSize" min="8" max="96" step="1" placeholder="≈ 18" value="${hd.subtitleFontSize || ''}" style="width:100px" />`,
            'typo',
            'subtitleFontSize',
          )}
        </div>
        <div style="flex:0 0 auto">
          <label>Chips</label>
          ${withReset(
            `<input type="number" data-hdtypo="chipFontSize" min="8" max="96" step="1" placeholder="≈ 15" value="${hd.chipFontSize || ''}" style="width:100px" />`,
            'typo',
            'chipFontSize',
          )}
        </div>
        <div style="flex:0 0 auto">
          <label>CTA-Button</label>
          ${withReset(
            `<input type="number" data-hdtypo="ctaFontSize" min="8" max="96" step="1" placeholder="≈ 17" value="${hd.ctaFontSize || ''}" style="width:100px" />`,
            'typo',
            'ctaFontSize',
          )}
        </div>
      </div>`;

  const headingBody = `
      <div class="row" style="align-items:flex-end">
        ${colorField(lang, 'titleTextColor', 'Textfarbe (Titel &amp; Untertitel)', false, null, s)}
      </div>
      <p class="hint">Farbe der Überschriften. Getrennt für Hell/Dunkel.</p>`;

  const frameBody = `
      <div class="row" style="align-items:flex-end">
        ${colorField(lang, 'borderColor', 'Rahmenfarbe', false, null, s)}
        <div style="flex:1 1 200px">${sideRange(lang, s, 'borderWidth', 'Rahmenbreite', 0, 8, 'px')}</div>
        ${colorField(lang, 'bgColor', 'Hintergrund', true, 'bgOpacity', s)}
      </div>`;

  const chipsBody = `
      <div class="row" style="align-items:flex-end">
        ${colorField(lang, 'chipBgColor', 'Hintergrund', true, 'chipBgOpacity', s)}
        ${colorField(lang, 'chipTextColor', 'Textfarbe', false, null, s)}
        ${colorField(lang, 'chipBorderColor', 'Rahmenfarbe', true, 'chipBorderOpacity', s)}
      </div>
      <p class="hint" style="margin-top:.6rem">Hover (beim Überfahren) – zwei Farben:</p>
      <div class="row" style="align-items:flex-end">
        ${colorField(lang, 'chipHoverBgColor', 'Hover-Hintergrund', false, null, s)}
        ${colorField(lang, 'chipHoverTextColor', 'Hover-Textfarbe', false, null, s)}
      </div>`;

  const ctaBody = `
      <div class="row" style="align-items:flex-end">
        ${colorField(lang, 'ctaBgColor', 'Hintergrund', true, 'ctaBgOpacity', s)}
        ${colorField(lang, 'ctaTextColor', 'Textfarbe', false, null, s)}
        ${colorField(lang, 'ctaBorderColor', 'Rahmenfarbe', true, 'ctaBorderOpacity', s)}
      </div>
      <p class="hint" style="margin:.2rem 0 0">Rahmen-Transparenz 0 % = kein Rahmen.</p>
      <p class="hint" style="margin-top:.6rem">Hover (beim Überfahren) – zwei Farben:</p>
      <div class="row" style="align-items:flex-end">
        ${colorField(lang, 'ctaHoverBgColor', 'Hover-Hintergrund', false, null, s)}
        ${colorField(lang, 'ctaHoverTextColor', 'Hover-Textfarbe', false, null, s)}
      </div>`;

  const badge = `<span class="lang-badge">${modusLabel}</span>`;
  return `
    <div class="panel">
      <h2>Hero-Design <span class="lang-badge">${lang.toUpperCase()}</span></h2>
      <p class="hint">Gestaltet den Hero-Bereich oben auf der ${lang === 'de' ? 'deutschen' : 'englischen'} Startseite –
        getrennt für Hell- und Dunkelmodus. Ausgeschaltet = Standard-Design. Sektionen zum Fokussieren zuklappen; die Vorschau bleibt oben sichtbar.</p>
      <div style="display:flex;align-items:center;gap:.5rem;margin-top:.4rem">
        <label style="display:flex;align-items:center;gap:.4rem;color:var(--text);margin:0">
          <input type="checkbox" data-hd="enabled" data-lang="${lang}" ${hd.enabled ? 'checked' : ''} style="width:auto" /> Eigenes Hero-Design verwenden
        </label>
        ${resetBtn('enabled')}
      </div>

      <!-- Komplettes Hero-Design (Hell + Dunkel) von Deutsch nach Englisch übernehmen -->
      <div style="margin:.6rem 0 .2rem;padding:.5rem .6rem;border:1px dashed var(--border);border-radius:8px">
        <button data-hdcopy type="button" style="width:auto">${
          lang === 'de'
            ? '➡️ Dieses Hero-Design auf Englisch (EN) übernehmen'
            : '⬅️ Hero-Design von Deutsch (DE) übernehmen'
        }</button>
        <p class="hint" style="margin:.35rem 0 0">Kopiert <strong>alle</strong> Hero-Design-Einstellungen (Hell + Dunkel: Schriften, Typografie, Farben, Transparenzen) von Deutsch nach Englisch. Die Button-<em>Beschriftungen</em> bleiben je Sprache erhalten.</p>
      </div>

      <!-- Vorschau bleibt beim Scrollen oben sichtbar -->
      <div style="position:sticky;top:.5rem;z-index:5;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:.55rem .7rem;margin:.6rem 0 .8rem;box-shadow:0 6px 18px rgba(0,0,0,.35)">
        ${themeSwitch()}
        <p class="hint" style="margin:.1rem 0 .3rem">Vorschau (${modusLabel}) <em>(zum Testen über die Buttons fahren)</em>:</p>
        <style data-hdhoverstyle>${hoverRuleCss(s)}</style>
        <div data-hdprev style="${previewBoxStyle(s)}">
          <div style="${previewTitleStyle(s, hd)}" data-hdtitle>${esc(previewTitle)}</div>
          <div style="${previewSubtitleStyle(s, hd)}" data-hdsub>${esc(previewSubtitle)}</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-top:.9rem">${chips}</div>
          <div data-hdcta style="${previewCtaStyle(s, hd)}">${esc(previewCta)}</div>
        </div>
        <p class="hint" data-hdnote style="margin-top:.35rem">${heroPreviewNote(hd)}</p>
      </div>

      ${section('🔤 Schriften &amp; Typografie <span class="hint" style="font-weight:400">(für beide Modi)</span>', typoBody)}
      ${section(`🅰️ Überschriften-Farbe ${badge}`, headingBody)}
      ${section(`🖼️ Rahmen &amp; Hintergrund ${badge}`, frameBody)}
      ${section(`🔘 Buttons (Feature-Chips) ${badge}`, chipsBody)}
      ${section(`🚀 CTA-Button („Jetzt starten") ${badge}`, ctaBody)}
    </div>

    ${featureLabelsPanel(lang)}`;
}

// Beschriftungen der Buttons (Feature-Chips) – über die Overrides bearbeitbar.
function featureLabelsPanel(lang) {
  const rows = featureDefs(lang)
    .map(({ key, def }) => {
      const cur = getPath(state.overrides[lang], ['hero', 'features', key]);
      const val = cur != null ? cur : '';
      return `<label>Button „${esc(def || key)}"</label>
        ${withReset(
          `<input data-feat="${esc(key)}" data-lang="${lang}" placeholder="${esc(def)}" value="${esc(val)}" />`,
          'feat',
          key,
        )}`;
    })
    .join('');
  return `
    <div class="panel">
      <details open>
        <summary style="cursor:pointer;font-weight:600">Button-Beschriftungen <span class="lang-badge">${lang.toUpperCase()}</span></summary>
        <p class="hint">Text der Feature-Buttons (gilt für beide Modi). Leer lassen = Standardtext.</p>
        ${rows}
      </details>
    </div>`;
}

// Aktualisiert Vorschau-Box, Chips, Titel, CTA (inkl. Schriften) und Hinweis.
function refreshPreview(pane, lang) {
  const hd = heroDesignOf(lang);
  const s = sideOf(lang);
  const box = pane.querySelector('[data-hdprev]');
  if (box) box.setAttribute('style', previewBoxStyle(s));
  const title = pane.querySelector('[data-hdtitle]');
  if (title) title.setAttribute('style', previewTitleStyle(s, hd));
  const sub = pane.querySelector('[data-hdsub]');
  if (sub) sub.setAttribute('style', previewSubtitleStyle(s, hd));
  pane
    .querySelectorAll('[data-hdchip]')
    .forEach((c) => c.setAttribute('style', previewChipStyle(s, hd)));
  const cta = pane.querySelector('[data-hdcta]');
  if (cta) cta.setAttribute('style', previewCtaStyle(s, hd));
  const hs = pane.querySelector('[data-hdhoverstyle]');
  if (hs) hs.textContent = hoverRuleCss(s);
  const note = pane.querySelector('[data-hdnote]');
  if (note) note.textContent = heroPreviewNote(hd);
}

export function renderHeroDesign() {
  const lang = state.nav.section;
  const pane = $('#content');
  pane.innerHTML = heroDesignPanel(lang);

  // Modus-Umschalter (Hell/Dunkel) -> neu rendern für den anderen Farb-Satz.
  pane.querySelectorAll('[data-hdtheme]').forEach((el) => {
    el.addEventListener('click', () => {
      editTheme = el.dataset.hdtheme === 'dark' ? 'dark' : 'light';
      renderHeroDesign();
    });
  });

  // Komplettes Hero-Design (Hell + Dunkel, alle Einstellungen) von Deutsch nach
  // Englisch übernehmen. Die Button-Beschriftungen (Overrides) bleiben je Sprache.
  pane.querySelectorAll('[data-hdcopy]').forEach((el) => {
    el.addEventListener('click', () => {
      if (
        !confirm(
          'Alle Hero-Design-Einstellungen für Englisch werden mit den deutschen überschrieben (Hell + Dunkel). Fortfahren?',
        )
      )
        return;
      state.media.en.heroDesign = JSON.parse(JSON.stringify(heroDesignOf('de')));
      renderHeroDesign();
      toast('Hero-Design von Deutsch nach Englisch übernommen (Hell + Dunkel)');
    });
  });

  // Design-Felder (Farben/Zahlen/Transparenz + An-Schalter).
  pane.querySelectorAll('[data-hd]').forEach((el) => {
    const field = el.dataset.hd;
    const evt = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const hd = heroDesignOf(lang);
      if (field === 'enabled') {
        hd.enabled = el.checked;
      } else {
        const s = sideOf(lang);
        if (field === 'borderWidth')
          s.borderWidth = Math.max(0, Math.min(8, parseInt(el.value, 10) || 0));
        else if (/Opacity$/.test(field))
          s[field] = Math.max(0, Math.min(100, parseInt(el.value, 10) || 0));
        else s[field] = el.value; // Farben
      }
      refreshPreview(pane, lang);
    });
  });

  // Schriftauswahl (Überschriften / Buttons) – gilt für beide Modi.
  pane.querySelectorAll('[data-hdfont]').forEach((el) => {
    el.addEventListener('change', () => {
      heroDesignOf(lang)[el.dataset.hdfont] = el.value;
      refreshPreview(pane, lang);
    });
  });

  // Typografie (Buchstabenabstand + Kontur) – gilt für beide Modi.
  pane.querySelectorAll('[data-hdtypo]').forEach((el) => {
    el.addEventListener('input', () => {
      const hd = heroDesignOf(lang);
      const f = el.dataset.hdtypo;
      if (/LetterSpacing$/.test(f))
        hd[f] = Math.max(-5, Math.min(20, Math.round((parseFloat(el.value) || 0) * 2) / 2));
      else if (/StrokeWidth$/.test(f))
        hd[f] = Math.max(0, Math.min(5, Math.round((parseFloat(el.value) || 0) * 2) / 2));
      else if (/FontSize$/.test(f)) {
        const n = parseInt(el.value, 10);
        hd[f] = Number.isFinite(n) && n > 0 ? Math.max(8, Math.min(96, n)) : 0;
      } else hd[f] = el.value; // Kontur-Farbe
      refreshPreview(pane, lang);
    });
  });

  // Globale Basis-Schrift per Kachel wählen (sprachübergreifend). Aktiviert die
  // Schrift für die ganze Seite; leere Kachel = Standard (System).
  pane.querySelectorAll('[data-hdglobalfont]').forEach((el) => {
    el.addEventListener('click', () => {
      const name = el.dataset.hdglobalfont || '';
      setGlobalFont(name);
      // Ausgewählte Schrift auch in die Hero-Schrift-Dropdowns übernehmen (DE+EN),
      // damit die Auswahl konsistent sichtbar ist und keine Verwirrung entsteht.
      // '' (Standard) setzt beide Dropdowns wieder auf „Standard (System)".
      for (const l of MEDIA_LANGS) {
        const hd = heroDesignOf(l);
        hd.titleFont = name;
        hd.buttonFont = name;
      }
      renderHeroDesign();
      toast(name ? 'Globale Schrift aktiviert' : 'Globale Schrift auf Standard zurückgesetzt');
    });
  });

  // Zurücksetzen-Buttons (↺): setzen genau ein Feld auf den Standard zurück
  // und rendern das Panel neu (Eingabefelder + Vorschau aktualisieren sich).
  pane.querySelectorAll('[data-hdreset]').forEach((el) => {
    el.addEventListener('click', () => {
      const scope = el.dataset.hdreset;
      const key = el.dataset.hdkey || '';
      if (scope === 'enabled') {
        heroDesignOf(lang).enabled = defaultHeroDesign().enabled;
      } else if (scope === 'side') {
        const s = sideOf(lang);
        const def = sideDefault();
        // "farbe:transparenz" -> beide Werte zurücksetzen.
        key.split(':').forEach((f) => {
          if (f in def) s[f] = def[f];
        });
      } else if (scope === 'typo' || scope === 'font') {
        const def = defaultHeroDesign();
        if (key in def) heroDesignOf(lang)[key] = def[key];
      } else if (scope === 'feat') {
        delPath(state.overrides[lang], ['hero', 'features', key]);
      }
      renderHeroDesign();
      toast('Auf Standard zurückgesetzt');
    });
  });

  // Button-Beschriftungen (schreiben in die Overrides, wie im Texte-Tab).
  pane.querySelectorAll('[data-feat]').forEach((el) => {
    const key = el.dataset.feat;
    el.addEventListener('input', () => {
      const v = el.value;
      if (v.trim() === '') delPath(state.overrides[lang], ['hero', 'features', key]);
      else setPath(state.overrides[lang], ['hero', 'features', key], v);
    });
  });

  // Schriftarten-Galerie beim Öffnen zur aktuell aktiven Schrift scrollen, damit
  // die gewählte Standardschrift sofort sichtbar ist (nur innerhalb der Galerie,
  // ohne die ganze Seite zu scrollen).
  const gallery = pane.querySelector('.hd-fonttiles');
  const activeTile = gallery && gallery.querySelector('.hd-fonttile.active');
  if (gallery && activeTile) {
    const gr = gallery.getBoundingClientRect();
    const tr = activeTile.getBoundingClientRect();
    const centered = tr.top - gr.top - (gallery.clientHeight - activeTile.clientHeight) / 2;
    gallery.scrollTop = Math.max(0, gallery.scrollTop + centered);
  }
  bindSliders(pane); // nach den Feld-Handlern: Zahlenfeld löst deren input-Event aus
  bindColorPickers(pane);
}
