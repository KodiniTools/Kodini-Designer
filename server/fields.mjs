// Generischer Tab „Felder“: liest und schreibt die im Profil-Manifest (fields)
// beschriebene JSON-Datei einer Website. Es werden nur die im Manifest
// definierten Pfade geschrieben (typgeprüft); andere Schlüssel der Datei bleiben
// erhalten. Leerer String = Standard der Website (Konvention der Content-Schicht).

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { flatFields } from './profile.mjs';

const FONT_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(woff2|woff|ttf|otf)$/i;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isObj(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
export function getPath(obj, path) {
  let cur = obj;
  for (const k of path.split('.')) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys.slice(0, -1)) {
    if (!isObj(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

/** Datei des Profils lesen ({} wenn fehlend/ungültig). */
export async function readFieldsFile(p) {
  const file = p.content.files[p.fields.file];
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    return isObj(data) ? data : {};
  } catch {
    return {};
  }
}

/** Werte aller Manifest-Felder aus der Datei ('' bzw. false, wenn nicht gesetzt). */
export async function loadFields(p) {
  const data = await readFieldsFile(p);
  const values = {};
  for (const f of flatFields(p.fields)) {
    const v = getPath(data, f.path);
    values[f.path] =
      f.type === 'toggle'
        ? v === true
        : typeof v === 'string' || typeof v === 'number'
          ? String(v)
          : '';
  }
  return values;
}

/**
 * Einen Wert gegen die Felddefinition prüfen. Rückgabe: normalisierter Wert
 * oder ein Error (Beschriftung + Grund) – '' ist überall erlaubt (= Standard).
 */
export function normalizeFieldValue(f, raw) {
  if (f.type === 'toggle') return raw === true || raw === 'true';
  if (raw === undefined || raw === null) return '';
  const s = String(raw);
  if (s.trim() === '') return '';
  switch (f.type) {
    case 'text':
      if (s.includes('\n') || s.length > f.maxLength)
        throw new Error(`${f.label}: zu lang oder mehrzeilig`);
      return s;
    case 'textarea':
      if (s.length > f.maxLength)
        throw new Error(`${f.label}: zu lang (max. ${f.maxLength} Zeichen)`);
      return s;
    case 'color':
      if (!HEX.test(s)) throw new Error(`${f.label}: keine gültige Hex-Farbe`);
      return s.toLowerCase();
    case 'number': {
      const n = Number(s);
      if (!Number.isFinite(n) || n < f.min || n > f.max)
        throw new Error(`${f.label}: Zahl zwischen ${f.min} und ${f.max}`);
      // Als Zahl speichern (Websites prüfen typeof number); leer bleibt ''.
      return n;
    }
    case 'select':
      if (!f.options.includes(s)) throw new Error(`${f.label}: unbekannte Auswahl`);
      return s;
    case 'font':
      if (!FONT_FILE.test(s)) throw new Error(`${f.label}: keine gültige Schriftdatei`);
      return s;
    default:
      throw new Error(`${f.label}: unbekannter Feldtyp`);
  }
}

/** Vorschau-Vorlage (HTML) des Profils oder '' (Datei liegt im Profilordner). */
export async function readPreviewTemplate(p) {
  if (!p.fields?.preview || !p.dir) return '';
  try {
    return await readFile(resolve(p.dir, p.fields.preview.file), 'utf8');
  } catch {
    return '';
  }
}

/** Alle Werte prüfen; unbekannte Pfade werden ignoriert. Wirft bei Fehlern. */
export function validateFieldValues(p, values) {
  if (!isObj(values)) throw new Error('Ungültige Werte');
  const out = {};
  for (const f of flatFields(p.fields)) {
    if (!(f.path in values)) continue;
    out[f.path] = normalizeFieldValue(f, values[f.path]);
  }
  return out;
}

/** Werte prüfen und in die Datei schreiben (übrige Schlüssel bleiben). */
export async function saveFields(p, values) {
  const clean = validateFieldValues(p, values);
  const data = await readFieldsFile(p);
  for (const [path, v] of Object.entries(clean)) setPath(data, path, v);
  await writeFile(p.content.files[p.fields.file], JSON.stringify(data, null, 2) + '\n', 'utf8');
  return loadFields(p);
}
