// Tab „Felder“: generischer, manifestgesteuerter Editor für Websites ohne
// Home-Vertrag (z. B. Tool-Apps). Das Profil-Manifest (fields.groups) liefert
// Gruppen und Felder (Pfad, Beschriftung, Typ); die Werte kommen aus der im
// Profil genannten JSON-Datei. Leerer Wert = Standard der Website.

import { $, esc, toast } from './core.js';
import { state } from './model.js';
import { slider, bindSliders } from './slider.js';
import { colorPicker, bindColorPickers } from './color.js';

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;
function toHex6(v) {
  if (HEX6.test(v)) return v.toLowerCase();
  if (HEX3.test(v)) return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
  return '';
}
const val = (path) => state.generic?.values?.[path] ?? '';
function setVal(path, v) {
  if (!state.generic) return;
  state.generic.values[path] = v;
  refreshDefaultMarks($('#content'));
}

function resetBtn(path, disabled) {
  return `<button type="button" class="hd-reset" data-fldreset="${esc(path)}" ${disabled ? 'disabled' : ''} title="Auf Standard zurücksetzen (leer)" aria-label="Auf Standard zurücksetzen">↺</button>`;
}
function withReset(inner, path) {
  return `<div style="display:flex;gap:.3rem;align-items:flex-start">${inner}${resetBtn(path, false)}</div>`;
}

// Ein Feld als HTML. Der Standard (placeholder) wird als Platzhalter bzw. als
// Vorgabewert gezeigt; „eigener Wert“ ist erst nach Eingabe/Aktivierung gesetzt.
function fieldHtml(f) {
  const v = val(f.path);
  const set = v !== '' && v !== false;
  const hint = f.hint ? `<p class="hint" style="margin:.25rem 0 0">${esc(f.hint)}</p>` : '';
  const mark = `<span class="hint" data-flddef="${esc(f.path)}" style="margin:0 0 0 .4rem;font-size:.72rem">${set ? '' : '(Standard)'}</span>`;
  const label = `<label>${esc(f.label)}${mark}</label>`;
  switch (f.type) {
    case 'textarea':
      return `<div style="flex:1 1 100%">${label}${withReset(`<textarea data-fld="${esc(f.path)}" rows="3" maxlength="${f.maxLength}" placeholder="${esc(f.placeholder || '')}" style="flex:1 1 auto;min-height:72px">${esc(v)}</textarea>`, f.path)}${hint}</div>`;
    case 'color': {
      const on = set;
      const shown = toHex6(v) || toHex6(f.placeholder || '') || '#000000';
      return `<div style="flex:0 0 auto">${label}
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:.35rem;margin:0;font-size:.8rem;color:var(--muted);cursor:pointer">
            <input type="checkbox" data-fldon="${esc(f.path)}" ${on ? 'checked' : ''} style="width:auto" /> eigene Farbe
          </label>
          ${colorPicker({ id: `fld:${f.path}`, attrs: `data-fld="${esc(f.path)}" data-fldtype="color"`, value: shown, disabled: !on, resetHtml: resetBtn(f.path, !on) })}
        </div>${hint}</div>`;
    }
    case 'number': {
      const n = v === '' ? Number(f.placeholder) : Number(v);
      return `<div style="flex:1 1 240px">${slider({ id: `fld:${f.path}`, label: f.label, hint: f.hint, unit: f.unit || '', min: f.min, max: f.max, step: f.step, value: Number.isFinite(n) ? n : f.min, attrs: `data-fld="${esc(f.path)}" data-fldtype="number"`, resetAttrs: `data-fldreset="${esc(f.path)}"` })}${mark}</div>`;
    }
    case 'select':
      return `<div style="flex:0 0 auto">${label}${withReset(`<select data-fld="${esc(f.path)}" style="width:auto;height:38px"><option value="">Standard${f.placeholder ? ` (${esc(f.placeholder)})` : ''}</option>${f.options.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`, f.path)}${hint}</div>`;
    case 'toggle':
      return `<div style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:.4rem;margin:0;cursor:pointer;height:38px"><input type="checkbox" data-fld="${esc(f.path)}" data-fldtype="toggle" ${v === true ? 'checked' : ''} style="width:auto" /> ${esc(f.label)}</label>${hint}</div>`;
    default:
      return `<div style="flex:1 1 320px">${label}${withReset(`<input type="text" data-fld="${esc(f.path)}" value="${esc(v)}" maxlength="${f.maxLength}" placeholder="${esc(f.placeholder || '')}" style="flex:1 1 auto" />`, f.path)}${hint}</div>`;
  }
}

function refreshDefaultMarks(pane) {
  if (!pane) return;
  pane.querySelectorAll('[data-flddef]').forEach((el) => {
    const v = val(el.dataset.flddef);
    el.textContent = v === '' || v === false ? '(Standard)' : '';
  });
}

export function renderFields() {
  const pane = $('#content');
  const g = state.generic;
  if (!g || !Array.isArray(g.groups)) {
    pane.innerHTML = '<div class="panel"><p class="hint">Dieses Profil hat keine Felder.</p></div>';
    return;
  }
  const prof = state.profile || {};
  pane.innerHTML = `
    <div class="panel">
      <h2>Felder <span class="lang-badge">${esc(prof.name || prof.id || '')}</span></h2>
      <p class="hint">Texte und Farben dieser Website. Leer bzw. „(Standard)“ = eingebauter Wert der Website.
        Speichern schreibt die Datei der Website; „Vorschau“ baut sie, „Veröffentlichen“ committet, pusht und deployt.</p>
    </div>
    ${g.groups
      .map(
        (grp) => `
      <div class="panel">
        <h2>${esc(grp.title)}</h2>
        <div class="row" style="align-items:flex-start;gap:1rem">${grp.fields.map(fieldHtml).join('')}</div>
      </div>`,
      )
      .join('')}`;

  pane.querySelectorAll('[data-fld]').forEach((el) => {
    const path = el.dataset.fld;
    const type = el.dataset.fldtype || (el.tagName === 'SELECT' ? 'select' : 'text');
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      if (type === 'toggle') setVal(path, el.checked);
      else if (type === 'number') setVal(path, String(el.value));
      else if (type === 'color') setVal(path, el.value.toLowerCase());
      else setVal(path, el.value);
    });
  });
  // Farben: An-Schalter „eigene Farbe“ (aus = Standard = '').
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
  pane.querySelectorAll('[data-fldreset]').forEach((btn) => {
    const path = btn.dataset.fldreset;
    btn.addEventListener('click', () => {
      setVal(path, '');
      renderFields();
      toast('Auf Standard zurückgesetzt');
    });
  });
  bindSliders(pane);
  bindColorPickers(pane);
}
