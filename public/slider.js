// Gemeinsamer Regler-Baustein für Admin-Tabs (Hintergrund, Tool-Karten):
// Slider + Zahlenfeld (Spinner) + „↺"-Knopf.
import { esc } from './core.js';

/**
 * Regler rendern.
 * - attrs: Attribute des Range-Inputs (Feld-/Modus-Kennung, auf die die
 *   bestehenden input-Handler des Tabs hören).
 * - id: Schlüssel für data-num (Zahlenfeld) und data-reset (Tests, Sync).
 * - def: fester Standardwert -> „↺" setzt ihn über den Slider (bindSliders).
 * - resetAttrs: alternativ eigene Attribute für den „↺"-Knopf (z. B.
 *   data-tcreset="…"), wenn der Tab das Zurücksetzen selbst behandelt
 *   (kontextabhängiger Standard); dann bindet bindSliders den Knopf nicht.
 */
export function slider({
  id,
  label,
  hint = '',
  unit,
  min,
  max,
  step = 1,
  value,
  def,
  resetAttrs = '',
  attrs,
  disabled = false,
  labelStyle = '',
}) {
  const dis = disabled ? 'disabled' : '';
  const reset = resetAttrs
    ? `<button type="button" class="hd-reset slider-reset" ${resetAttrs} title="Auf Standard zurücksetzen" ${dis}>↺</button>`
    : `<button type="button" class="hd-reset slider-reset" data-reset="${id}" data-def="${def}" title="Auf Standard (${def} ${unit}) zurücksetzen" ${dis}>↺</button>`;
  return `
    <div class="slider" data-slider="${id}">
      <label${labelStyle ? ` style="${labelStyle}"` : ''}>${label}${hint ? ` <span class="hint" style="margin:0">${hint}</span>` : ''}</label>
      <div class="slider-row">
        <input type="range" ${attrs} min="${min}" max="${max}" step="${step}" value="${value}" ${dis} />
        <input type="number" class="slider-num" data-num="${id}" min="${min}" max="${max}" step="${step}" value="${value}" ${dis} aria-label="${esc(label)} (Zahl)" />
        <span class="slider-unit">${unit}</span>
        ${reset}
      </div>
    </div>`;
}

/** Zahlenfelder aller Regler in pane an programmatisch geänderte Slider-Werte angleichen. */
export function refreshSliders(pane) {
  pane.querySelectorAll('[data-slider]').forEach((box) => {
    if (typeof box._slSync === 'function') box._slSync();
  });
}

/**
 * Verdrahtung aller Regler in pane: Zahlenfeld und „↺" (mit data-def) schreiben
 * in den Slider und lösen dessen input-Event aus, sodass die Feld-Handler
 * (Modell + Vorschau) wie beim Ziehen laufen. Beim Tippen wird das Zahlenfeld
 * nicht überschrieben (Fokus/Cursor bleiben erhalten); beim Verlassen wird es
 * auf den gültigen Bereich gesetzt (der Slider begrenzt selbst auf min/max).
 * Nach den Feld-Handlern des Tabs aufrufen.
 */
export function bindSliders(pane) {
  pane.querySelectorAll('[data-slider]').forEach((box) => {
    const range = box.querySelector('input[type="range"]');
    const num = box.querySelector('[data-num]');
    const reset = box.querySelector('[data-reset]');
    if (!range || !num) return;
    box._slSync = () => {
      num.value = range.value;
    };
    let typing = false;
    const push = (v) => {
      range.value = v;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    };
    range.addEventListener('input', () => {
      if (!typing) num.value = range.value;
    });
    num.addEventListener('input', () => {
      if (num.value === '') return;
      typing = true;
      push(num.value);
      typing = false;
    });
    num.addEventListener('change', () => {
      num.value = range.value;
    });
    if (reset)
      reset.addEventListener('click', () => {
        push(reset.dataset.def);
        num.value = range.value;
      });
  });
}
