// Gemeinsame Schrift-Helfer für den Adminbereich (Laufband & Hero-Design):
// Schriften laden, @font-face für die Vorschau einfügen und Auswahl-<option>s
// erzeugen. Die Fonts liegen unter /fonts auf der Domain (Serverordner
// /var/www/kodinitools.com/fonts bzw. public/fonts).

import { api, esc } from './core.js';
import { state } from './model.js';

// Verfügbare Schriftarten laden (für die Schriftauswahl).
export async function loadFonts() {
  const r = await api('/fonts');
  state.fonts = (r.ok && Array.isArray(r.data?.fonts) ? r.data.fonts : []).filter(
    (f) => f && f.name,
  );
}

// Dateiname -> CSS-sicherer Family-Name (identisch zu TickerBar.astro/index.astro).
export function fontFamilyId(file) {
  return (
    'kodini-font-' +
    String(file)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
  );
}

// @font-face für eine Schriftdatei einmalig in die Admin-Seite einfügen, damit
// die Vorschau die echte Schrift zeigt. Rückgabe: der Family-Name (oder '').
export function ensureFontFace(file) {
  if (!file) return '';
  const fam = fontFamilyId(file);
  const id = 'ff-' + fam;
  if (!document.getElementById(id)) {
    const ext = (file.split('.').pop() || '').toLowerCase();
    const fmt = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[ext] || '';
    const st = document.createElement('style');
    st.id = id;
    st.textContent = `@font-face{font-family:"${fam}";src:url("/fonts/${encodeURIComponent(
      file,
    )}")${fmt ? ` format("${fmt}")` : ''};font-display:swap;}`;
    document.head.appendChild(st);
  }
  return fam;
}

// Options für eine Schriftauswahl. Enthält immer "Standard" und die vom Server
// gemeldeten Schriften; eine ausgewählte, aber (noch) nicht gelistete Datei wird
// zusätzlich aufgenommen, damit sie ausgewählt bleibt.
// Jede Option wird in IHRER eigenen Schrift dargestellt (echtes Schriftmuster);
// dafür wird pro Eintrag das passende @font-face eingefügt.
export function fontOptionsHtml(current) {
  const list = state.fonts.slice();
  if (current && !list.some((f) => f.name === current)) {
    list.unshift({ name: current, label: current + ' (nicht gefunden)' });
  }
  const opts = [`<option value="" ${!current ? 'selected' : ''}>Standard (System)</option>`];
  for (const f of list) {
    // @font-face laden, damit die Option wirklich in dieser Schrift erscheint.
    const fam = ensureFontFace(f.name);
    const style = fam ? ` style="font-family:'${fam}', system-ui, sans-serif"` : '';
    opts.push(
      `<option value="${esc(f.name)}" ${f.name === current ? 'selected' : ''}${style}>${esc(
        f.label || f.name,
      )}</option>`,
    );
  }
  return opts.join('');
}

// CSS-sicherer Family-Wert für inline styles (mit System-Fallback) oder '' .
export function fontFamilyCss(file) {
  if (!file) return '';
  return `"${fontFamilyId(file)}", system-ui, sans-serif`;
}
