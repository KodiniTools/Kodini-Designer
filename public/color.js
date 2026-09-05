// Gemeinsamer Farbwähler für Admin-Tabs: natives Farbfeld + Hex-Feld + Aufklapp-
// Panel mit drei Reglern (Farbton / Sättigung / Helligkeit, je Slider + Zahlenfeld).
// Der native <input type="color"> bleibt das Datenfeld (mit den Attributen des
// Tabs, z. B. data-bgf/data-tcf/data-hd); Hex-Feld und Regler schreiben hinein und
// lösen sein input-Event aus, sodass die Feld-Handler der Tabs unverändert laufen.
import { esc } from './core.js';

// Offene Panels überleben ein Neu-Rendern des Tabs (Schlüssel = id).
const openPanels = new Set();
let outsideBound = false;

/** Hex (#rgb/#rrggbb) -> { h: 0–360, s: 0–100, l: 0–100 }; ungültig -> null. */
export function hexToHsl(hex) {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return null;
  let h6 = m[1];
  if (h6.length === 3)
    h6 = h6
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h6.slice(0, 2), 16) / 255;
  const g = parseInt(h6.slice(2, 4), 16) / 255;
  const b = parseInt(h6.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** { h, s, l } -> #rrggbb (Werte werden auf ihre Bereiche begrenzt). */
export function hslToHex({ h, s, l }) {
  const H = (((Number(h) || 0) % 360) + 360) % 360;
  const S = Math.max(0, Math.min(100, Number(s) || 0)) / 100;
  const L = Math.max(0, Math.min(100, Number(l) || 0)) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let r;
  let g;
  let b;
  if (H < 60) [r, g, b] = [c, x, 0];
  else if (H < 120) [r, g, b] = [x, c, 0];
  else if (H < 180) [r, g, b] = [0, c, x];
  else if (H < 240) [r, g, b] = [0, x, c];
  else if (H < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const CHANNELS = [
  { key: 'h', label: 'Farbton', unit: '°', max: 360 },
  { key: 's', label: 'Sättigung', unit: '%', max: 100 },
  { key: 'l', label: 'Helligkeit', unit: '%', max: 100 },
];
function trackStyle(key, hsl) {
  if (key === 'h') return 'background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';
  if (key === 's')
    return `background:linear-gradient(90deg,hsl(${hsl.h},0%,${hsl.l}%),hsl(${hsl.h},100%,${hsl.l}%))`;
  return `background:linear-gradient(90deg,#000,hsl(${hsl.h},${hsl.s}%,50%),#fff)`;
}

/**
 * Farbwähler rendern.
 * - id: eindeutiger Schlüssel (data-cp; Panel-Zustand, Tests)
 * - attrs: Attribute des nativen Farbfelds (Feld-Kennung des Tabs)
 * - value: aktueller Hex-Wert; resetHtml: optionaler „↺"-Knopf des Tabs
 */
export function colorPicker({ id, attrs, value, resetHtml = '', disabled = false }) {
  const dis = disabled ? 'disabled' : '';
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '#000000';
  const hsl = hexToHsl(hex) || { h: 0, s: 0, l: 0 };
  const open = openPanels.has(id) && !disabled;
  const rows = CHANNELS.map(
    (c) => `
      <div class="cp-row">
        <span class="cp-lbl">${c.label}</span>
        <input type="range" class="cp-range" data-cph="${c.key}" min="0" max="${c.max}" step="1" value="${hsl[c.key]}" style="${trackStyle(c.key, hsl)}" />
        <input type="number" class="slider-num" data-cpn="${c.key}" min="0" max="${c.max}" step="1" value="${hsl[c.key]}" aria-label="${c.label}" />
        <span class="slider-unit">${c.unit}</span>
      </div>`,
  ).join('');
  return `
    <div class="cp" data-cp="${esc(id)}">
      <div class="cp-head">
        <input type="color" class="cp-native" ${attrs} value="${esc(hex)}" ${dis} />
        <input type="text" class="cp-hex" data-cphex value="${esc(hex)}" maxlength="7" spellcheck="false" ${dis} aria-label="Farbe als Hex-Wert" />
        <button type="button" class="hd-reset cp-toggle ${open ? 'active' : ''}" data-cptoggle="${esc(id)}" title="Farbregler: Farbton, Sättigung, Helligkeit" aria-expanded="${open}" ${dis}>🎚</button>
        ${resetHtml}
      </div>
      <div class="cp-panel" ${open ? '' : 'hidden'}>${rows}</div>
    </div>`;
}

/** Hex-Feld und Regler aller Farbwähler in pane an die (programmatisch
 * geänderten) Werte der nativen Farbfelder angleichen. */
export function refreshColorPickers(pane) {
  pane.querySelectorAll('[data-cp]').forEach((box) => {
    if (typeof box._cpSync === 'function') box._cpSync();
  });
}

/** Verdrahtung aller Farbwähler in pane (nach den Feld-Handlern des Tabs aufrufen). */
export function bindColorPickers(pane) {
  pane.querySelectorAll('[data-cp]').forEach((box) => {
    const id = box.dataset.cp;
    const native = box.querySelector('.cp-native');
    const hexInp = box.querySelector('[data-cphex]');
    const toggle = box.querySelector('[data-cptoggle]');
    const panel = box.querySelector('.cp-panel');
    if (!native || !hexInp || !toggle || !panel) return;
    const ranges = {};
    const nums = {};
    for (const c of CHANNELS) {
      ranges[c.key] = panel.querySelector(`[data-cph="${c.key}"]`);
      nums[c.key] = panel.querySelector(`[data-cpn="${c.key}"]`);
    }
    let fromPanel = false;
    // Regler + Spuren + Hex-Feld an den aktuellen Farbwert anpassen.
    const sync = (skipNums = false) => {
      if (fromPanel) return; // Änderung kommt gerade aus dem Panel: HSL der Regler bleibt Quelle
      const hsl = hexToHsl(native.value);
      if (!hsl) return;
      for (const c of CHANNELS) {
        ranges[c.key].value = hsl[c.key];
        if (!skipNums) nums[c.key].value = hsl[c.key];
        ranges[c.key].setAttribute('style', trackStyle(c.key, hsl));
      }
      if (document.activeElement !== hexInp) hexInp.value = native.value;
    };
    const apply = (hex) => {
      native.value = hex;
      native.dispatchEvent(new Event('input', { bubbles: true }));
    };
    native.addEventListener('input', () => {
      if (!fromPanel) sync();
    });
    hexInp.addEventListener('input', () => {
      const v = hexInp.value.trim();
      const m = /^#?([0-9a-fA-F]{6})$/.exec(v);
      if (!m) return; // unvollständig: noch nichts übernehmen
      fromPanel = true;
      apply('#' + m[1].toLowerCase());
      fromPanel = false;
      sync();
    });
    hexInp.addEventListener('change', () => {
      hexInp.value = native.value; // ungültige Eingabe verwerfen
    });
    // Regler-Änderung: HSL der Regler ist die Quelle; NICHT aus dem Hex zurück-
    // rechnen, sonst gehen Farbton/Sättigung bei Weiß/Schwarz (Sättigung 0 bzw.
    // Helligkeit 0/100) verloren und lassen sich nicht nacheinander einstellen.
    const fromHsl = (src) => {
      if (src) {
        if (src.el.type === 'number')
          ranges[src.key].value = src.el.value; // Range begrenzt
        else nums[src.key].value = ranges[src.key].value;
      }
      const hsl = { h: ranges.h.value, s: ranges.s.value, l: ranges.l.value };
      fromPanel = true;
      apply(hslToHex(hsl));
      fromPanel = false;
      for (const c of CHANNELS) ranges[c.key].setAttribute('style', trackStyle(c.key, hsl));
      if (document.activeElement !== hexInp) hexInp.value = native.value;
    };
    for (const c of CHANNELS) {
      ranges[c.key].addEventListener('input', () => fromHsl({ key: c.key, el: ranges[c.key] }));
      nums[c.key].addEventListener('input', () => {
        if (nums[c.key].value === '') return;
        fromHsl({ key: c.key, el: nums[c.key] });
      });
      nums[c.key].addEventListener('change', () => {
        nums[c.key].value = ranges[c.key].value;
      });
    }
    box._cpSync = sync; // für refreshColorPickers (programmatische Wertänderungen)
    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      // Nur ein Panel offen halten.
      pane.querySelectorAll('.cp-panel').forEach((p) => {
        if (p !== panel) p.hidden = true;
      });
      pane.querySelectorAll('.cp-toggle').forEach((t) => {
        if (t !== toggle) t.classList.remove('active');
      });
      openPanels.clear();
      panel.hidden = !open;
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        openPanels.add(id);
        sync();
      }
    });
  });
  if (!outsideBound) {
    outsideBound = true;
    document.addEventListener('click', (e) => {
      if (e.target.closest('.cp')) return;
      document.querySelectorAll('.cp-panel:not([hidden])').forEach((p) => {
        p.hidden = true;
      });
      document.querySelectorAll('.cp-toggle.active').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-expanded', 'false');
      });
      openPanels.clear();
    });
  }
}
