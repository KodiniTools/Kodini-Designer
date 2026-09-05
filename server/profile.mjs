// Site-Profile: beschreibt, WELCHE Website der Designer bearbeitet – Repo,
// Content-Dateien, Upload-/Font-Ordner, Build-, Vorschau- und Deploy-Befehle.
// Der Designer-Code selbst bleibt seitenunabhängig; alles Seitenspezifische
// steht im Manifest profiles/<id>/profile.json.
//
// Auswahl:  PROFILES=<id1>,<id2>    (mehrere Profile, Umschalter in der Kopfzeile)
//     oder  PROFILE=<id>            (ein Profil; Ordnername unter profiles/, Default kodinitools-home)
//     oder  PROFILE_FILE=/pfad/profile.json
// Platzhalter in Pfaden: {repo} = Repo-Verzeichnis, {webroot} = Webroot.
// Umgebungsvariablen (REPO_DIR, WEBROOT, UPLOADS_DIR, GIT_BRANCH, GIT_REMOTE,
// STATE_DIR, PREVIEW_BASE, PREVIEW_DIR) überstimmen das Manifest – so bleibt eine
// bestehende .env gültig, und ein Parallelbetrieb neben dem alten Admin-Dienst
// (eigener Pfad/Port, eigene Vorschau- und Status-Ordner) braucht kein zweites Profil.

import { readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DESIGNER_ROOT = resolve(__dirname, '..');
export const PROFILES_DIR = resolve(DESIGNER_ROOT, 'profiles');
export const DEFAULT_PROFILE_ID = 'kodinitools-home';

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const KINDS = new Set(['astro-site', 'vite-spa', 'static']);

function fail(msg) {
  throw new Error(`Profil ungültig: ${msg}`);
}
function isObj(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function str(v, name, { optional = false } = {}) {
  if (v === undefined || v === null || (optional && v === '')) {
    if (optional) return '';
    fail(`${name} fehlt`);
  }
  if (typeof v !== 'string' || !v.trim()) fail(`${name} muss ein nicht-leerer String sein`);
  return v.trim();
}
function strList(v, name, { optional = false } = {}) {
  if (v === undefined) {
    if (optional) return [];
    fail(`${name} fehlt`);
  }
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string' && s.trim()))
    fail(`${name} muss eine Liste nicht-leerer Strings sein`);
  return v.map((s) => s.trim());
}
function cmd(v, name) {
  const list = strList(v, name);
  if (!list.length) fail(`${name} darf nicht leer sein`);
  return list;
}
function envMap(v, name) {
  if (v === undefined) return {};
  if (!isObj(v) || !Object.values(v).every((s) => typeof s === 'string'))
    fail(`${name} muss ein Objekt aus Strings sein`);
  return { ...v };
}
function minutes(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

/** Pfad des Manifests zu einer Profil-Kennung. */
export function profileFile(id) {
  if (!ID_RE.test(id)) fail(`Kennung „${id}“ (nur a-z, 0-9, -)`);
  return resolve(PROFILES_DIR, id, 'profile.json');
}

/**
 * Manifest validieren und normalisieren (ohne Umgebungs-Overrides, ohne
 * Platzhalter-Auflösung – das macht resolveProfile).
 */
export function validateProfile(raw, source = 'profile.json') {
  if (!isObj(raw)) fail(`${source}: kein Objekt`);
  const id = str(raw.id, 'id');
  if (!ID_RE.test(id)) fail(`id „${id}“ (nur a-z, 0-9, -)`);
  const kind = str(raw.kind, 'kind');
  if (!KINDS.has(kind)) fail(`kind „${kind}“ (erlaubt: ${[...KINDS].join(', ')})`);
  const languages = strList(raw.languages, 'languages');
  if (!languages.length) fail('languages darf nicht leer sein');
  if (!isObj(raw.repo)) fail('repo fehlt');
  if (!isObj(raw.content)) fail('content fehlt');
  if (!isObj(raw.content.files)) fail('content.files fehlt');
  const files = {};
  for (const [k, v] of Object.entries(raw.content.files)) files[k] = str(v, `content.files.${k}`);
  // Home-artige Profile brauchen media; Feld-Profile (fields) nur die Felddatei.
  if (!files.media && !isObj(raw.fields)) fail('content.files.media fehlt');
  const locales = {};
  if (raw.content.locales !== undefined) {
    if (!isObj(raw.content.locales)) fail('content.locales muss ein Objekt sein');
    for (const [k, v] of Object.entries(raw.content.locales))
      locales[k] = str(v, `content.locales.${k}`);
  }
  if (!isObj(raw.uploads)) fail('uploads fehlt');
  if (!isObj(raw.build)) fail('build fehlt');
  if (!isObj(raw.deploy)) fail('deploy fehlt');
  const preview = isObj(raw.preview) ? raw.preview : {};
  const previewEnv = isObj(preview.env) ? preview.env : {};
  return {
    id,
    name: str(raw.name, 'name'),
    kind,
    siteUrl: str(raw.siteUrl, 'siteUrl', { optional: true }),
    languages,
    repo: {
      dir: str(raw.repo.dir, 'repo.dir'),
      branch: str(raw.repo.branch, 'repo.branch', { optional: true }) || 'main',
      remote: str(raw.repo.remote, 'repo.remote', { optional: true }) || 'origin',
    },
    webroot: str(raw.webroot, 'webroot'),
    content: {
      dir: str(raw.content.dir, 'content.dir'),
      files,
      locales,
      commitPaths: strList(raw.content.commitPaths, 'content.commitPaths'),
    },
    uploads: {
      dir: str(raw.uploads.dir, 'uploads.dir'),
      repoDir: str(raw.uploads.repoDir, 'uploads.repoDir', { optional: true }),
      urlPrefix: str(raw.uploads.urlPrefix, 'uploads.urlPrefix', { optional: true }) || '/uploads',
      gitMaxBytes: Number.isFinite(Number(raw.uploads.gitMaxBytes))
        ? Number(raw.uploads.gitMaxBytes)
        : 25 * 1024 * 1024,
    },
    fonts: {
      dirs: strList(raw.fonts?.dirs, 'fonts.dirs', { optional: true }),
      urlPrefix: str(raw.fonts?.urlPrefix, 'fonts.urlPrefix', { optional: true }) || '/fonts',
    },
    fontawesome: {
      dirs: strList(raw.fontawesome?.dirs, 'fontawesome.dirs', { optional: true }),
    },
    build: {
      command: cmd(raw.build.command, 'build.command'),
      env: envMap(raw.build.env, 'build.env'),
      timeoutMinutes: minutes(raw.build.timeoutMinutes, 15),
    },
    preview: {
      base: str(preview.base, 'preview.base', { optional: true }) || '/admin/preview/',
      outDir: str(preview.outDir, 'preview.outDir', { optional: true }) || 'dist-preview',
      env: {
        base: str(previewEnv.base, 'preview.env.base', { optional: true }),
        outDir: str(previewEnv.outDir, 'preview.env.outDir', { optional: true }),
      },
    },
    deploy: {
      command: cmd(raw.deploy.command, 'deploy.command'),
      env: envMap(raw.deploy.env, 'deploy.env'),
      timeoutMinutes: minutes(raw.deploy.timeoutMinutes, 20),
    },
    codeUpdate: { enabled: raw.codeUpdate?.enabled !== false },
    // Ordner für den persistierten Vorgangs-Status (Vorschau/Veröffentlichung).
    stateDir: str(raw.stateDir, 'stateDir', { optional: true }) || '{repo}/.kodini-admin',
    tabs: strList(raw.tabs, 'tabs', { optional: true }),
    // Generischer Tab „Felder“ (manifestgesteuert) – für Seiten ohne Home-Vertrag.
    fields:
      raw.fields === undefined || raw.fields === null
        ? null
        : validateFields(raw.fields, files, languages),
  };
}

// --- Generische Felder (Tab „Felder“) ---
export const FIELD_TYPES = new Set([
  'text',
  'textarea',
  'color',
  'number',
  'select',
  'toggle',
  'font',
]);
// Design-Eigenschaften eines Text-Slots (Tab „Felder“): feste Menge, wie bei den
// Text-Slots der Home-Seite. Werden je Slot unter <stylePath>.<name> gespeichert.
export const SLOT_WEIGHTS = ['', '300', '400', '500', '600', '700', '800'];
export const SLOT_TRANSFORMS = ['', 'uppercase', 'lowercase', 'capitalize'];
export function slotStyleFields(slot) {
  const sp = slot.stylePath;
  const L = slot.label;
  return [
    { path: `${sp}.font`, type: 'font', label: `${L} – Schriftart`, placeholder: '', hint: '' },
    {
      path: `${sp}.size`,
      type: 'number',
      label: `${L} – Größe`,
      min: 0,
      max: 96,
      step: 1,
      unit: 'px',
      placeholder: '0',
      hint: '0 = Standard',
    },
    {
      path: `${sp}.weight`,
      type: 'select',
      label: `${L} – Gewicht`,
      options: SLOT_WEIGHTS.filter(Boolean),
      placeholder: '',
      hint: '',
    },
    {
      path: `${sp}.spacing`,
      type: 'number',
      label: `${L} – Buchstabenabstand`,
      min: -2,
      max: 10,
      step: 0.5,
      unit: 'px',
      placeholder: '0',
      hint: '',
    },
    {
      path: `${sp}.transform`,
      type: 'select',
      label: `${L} – Schreibweise`,
      options: SLOT_TRANSFORMS.filter(Boolean),
      placeholder: '',
      hint: '',
    },
    {
      path: `${sp}.colorLight`,
      type: 'color',
      label: `${L} – Farbe Hell`,
      placeholder: '',
      hint: '',
    },
    {
      path: `${sp}.colorDark`,
      type: 'color',
      label: `${L} – Farbe Dunkel`,
      placeholder: '',
      hint: '',
    },
  ];
}
/** Text-Felder eines Slots je Sprache (Pfad mit {lang}). */
export function slotTextFields(slot, langs) {
  return langs.map((lang) => ({
    path: slot.textPath.replaceAll('{lang}', lang),
    type: slot.type,
    label: `${slot.label} (${lang.toUpperCase()})`,
    placeholder: slot.placeholder[lang] || '',
    maxLength: slot.maxLength,
    hint: '',
    lang,
    slot: slot.key,
  }));
}
const PATH_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;
function validateFields(raw, files, languages) {
  if (!isObj(raw)) fail('fields muss ein Objekt sein');
  const file = str(raw.file, 'fields.file');
  if (!files[file]) fail(`fields.file „${file}“ ist nicht in content.files definiert`);
  const hasGroups = Array.isArray(raw.groups) && raw.groups.length > 0;
  const hasSlots = Array.isArray(raw.slots) && raw.slots.length > 0;
  if (!hasGroups && !hasSlots) fail('fields.groups oder fields.slots fehlt');
  const langs = raw.langs === undefined ? languages : strList(raw.langs, 'fields.langs');
  if (!langs.length) fail('fields.langs darf nicht leer sein');
  const seen = new Set();
  // Text-Slots: Text je Sprache + Design (siehe slotStyleFields).
  const slots = (hasSlots ? raw.slots : []).map((s, si) => {
    const where = `fields.slots[${si}]`;
    if (!isObj(s)) fail(`${where} muss ein Objekt sein`);
    const key = str(s.key, `${where}.key`);
    if (!PATH_RE.test(key)) fail(`${where}.key „${key}“ ungültig`);
    if (seen.has(`slot:${key}`)) fail(`${where}.key „${key}“ doppelt`);
    seen.add(`slot:${key}`);
    const type = str(s.type, `${where}.type`, { optional: true }) || 'text';
    if (type !== 'text' && type !== 'textarea') fail(`${where}.type muss text oder textarea sein`);
    const textPath = str(s.textPath, `${where}.textPath`);
    if (!textPath.includes('{lang}') || !PATH_RE.test(textPath.replaceAll('{lang}', 'x')))
      fail(`${where}.textPath muss {lang} enthalten und ein gültiger Pfad sein`);
    const stylePath = str(s.stylePath, `${where}.stylePath`);
    if (!PATH_RE.test(stylePath)) fail(`${where}.stylePath ungültig`);
    const placeholder = {};
    if (isObj(s.placeholder))
      for (const l of langs)
        placeholder[l] = str(s.placeholder[l], `${where}.placeholder.${l}`, { optional: true });
    else if (typeof s.placeholder === 'string')
      for (const l of langs) placeholder[l] = s.placeholder;
    else for (const l of langs) placeholder[l] = '';
    const m = Number(s.maxLength);
    const slot = {
      key,
      label: str(s.label, `${where}.label`),
      type,
      textPath,
      stylePath,
      placeholder,
      maxLength: Number.isFinite(m) && m > 0 ? Math.min(m, 20000) : type === 'text' ? 300 : 5000,
      // Standardgröße (px) des Slots in der App – für die Anzeige „0 = Standard (16 px)“.
      defaultSize: Number.isFinite(Number(s.defaultSize)) ? Number(s.defaultSize) : 0,
    };
    for (const f of [...slotTextFields(slot, langs), ...slotStyleFields(slot)]) {
      if (seen.has(f.path)) fail(`${where}: Pfad „${f.path}“ doppelt`);
      seen.add(f.path);
    }
    return slot;
  });
  // Vorschau: HTML-Vorlage (Datei im Profilordner) + Zuordnung CSS-Variable -> Feldpfad.
  let preview = null;
  if (raw.preview !== undefined && raw.preview !== null) {
    if (!isObj(raw.preview)) fail('fields.preview muss ein Objekt sein');
    const pfile = str(raw.preview.file, 'fields.preview.file');
    if (!/^[A-Za-z0-9_.-]+$/.test(pfile))
      fail('fields.preview.file: nur Dateiname im Profilordner');
    const vars = {};
    if (raw.preview.vars !== undefined) {
      if (!isObj(raw.preview.vars)) fail('fields.preview.vars muss ein Objekt sein');
      for (const [name, v] of Object.entries(raw.preview.vars)) {
        if (!/^--[a-zA-Z0-9-]+$/.test(name))
          fail(`fields.preview.vars: „${name}“ ist keine CSS-Variable`);
        if (typeof v === 'string') vars[name] = { path: v, light: '', dark: '' };
        else if (isObj(v) && (v.path || v.light || v.dark))
          vars[name] = {
            path: str(v.path, `fields.preview.vars.${name}.path`, { optional: true }),
            light: str(v.light, `fields.preview.vars.${name}.light`, { optional: true }),
            dark: str(v.dark, `fields.preview.vars.${name}.dark`, { optional: true }),
          };
        else fail(`fields.preview.vars.${name}: Pfad oder {light,dark} erwartet`);
      }
    }
    preview = { file: pfile, vars };
  }
  const groups = (hasGroups ? raw.groups : []).map((g, gi) => {
    if (!isObj(g)) fail(`fields.groups[${gi}] muss ein Objekt sein`);
    if (!Array.isArray(g.fields) || !g.fields.length) fail(`fields.groups[${gi}].fields fehlt`);
    const fields = g.fields.map((f, fi) => {
      const where = `fields.groups[${gi}].fields[${fi}]`;
      if (!isObj(f)) fail(`${where} muss ein Objekt sein`);
      const path = str(f.path, `${where}.path`);
      if (!PATH_RE.test(path)) fail(`${where}.path „${path}“ ungültig`);
      if (seen.has(path)) fail(`${where}.path „${path}“ doppelt`);
      seen.add(path);
      const type = str(f.type, `${where}.type`, { optional: true }) || 'text';
      if (!FIELD_TYPES.has(type))
        fail(`${where}.type „${type}“ (erlaubt: ${[...FIELD_TYPES].join(', ')})`);
      const out = {
        path,
        type,
        label: str(f.label, `${where}.label`),
        hint: str(f.hint, `${where}.hint`, { optional: true }),
        placeholder: str(f.placeholder, `${where}.placeholder`, { optional: true }),
      };
      if (type === 'number') {
        const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
        out.min = n(f.min, 0);
        out.max = n(f.max, 100);
        out.step = n(f.step, 1);
        out.unit = str(f.unit, `${where}.unit`, { optional: true });
        if (out.max <= out.min) fail(`${where}: max muss größer als min sein`);
      }
      if (type === 'select') {
        out.options = strList(f.options, `${where}.options`);
        if (!out.options.length) fail(`${where}.options darf nicht leer sein`);
      }
      if (type === 'text' || type === 'textarea') {
        const m = Number(f.maxLength);
        out.maxLength =
          Number.isFinite(m) && m > 0 ? Math.min(m, 20000) : type === 'text' ? 300 : 5000;
      }
      return out;
    });
    return { title: str(g.title, `fields.groups[${gi}].title`), fields };
  });
  return { file, langs, slots, groups, preview };
}

/** Alle Felder eines Manifests flach (Slots: Text je Sprache + Design; dann Gruppen). */
export function flatFields(fields) {
  if (!fields) return [];
  const slotFields = (fields.slots || []).flatMap((s) => [
    ...slotTextFields(s, fields.langs),
    ...slotStyleFields(s),
  ]);
  return [...slotFields, ...(fields.groups || []).flatMap((g) => g.fields)];
}

/** Manifest-Datei lesen + validieren. */
export function loadProfileFile(file) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`Profil ${file} nicht lesbar: ${e.message}`, { cause: e });
  }
  const p = validateProfile(raw, file);
  // Profilordner (für Dateien neben dem Manifest, z. B. die Vorschau-Vorlage).
  p.dir = dirname(resolve(file));
  return p;
}

/**
 * Platzhalter {repo}/{webroot} auflösen und relative Pfade auf das Repo
 * beziehen. Ergebnis: Profil mit ausschließlich absoluten Pfaden.
 *
 * env-Overrides gibt es in zwei Gruppen:
 *  - seitenbezogen (REPO_DIR, WEBROOT, UPLOADS_DIR, GIT_BRANCH, GIT_REMOTE):
 *    gelten nur, wenn siteEnv true ist – d. h. für das ERSTE (Standard-)Profil,
 *    damit die gemeinsame .env von kodini-admin weiter passt, ohne dass sie
 *    jedes weitere Profil auf dasselbe Repo umbiegt.
 *  - dienstbezogen (STATE_DIR, PREVIEW_DIR, PREVIEW_BASE): gelten für alle Profile.
 */
export function resolveProfile(p, env = process.env, { siteEnv = true } = {}) {
  const site = siteEnv ? env : {};
  const repoDir = resolve(site.REPO_DIR || p.repo.dir);
  const webroot = resolve(site.WEBROOT || p.webroot);
  const ph = (s) => s.replaceAll('{repo}', repoDir).replaceAll('{webroot}', webroot);
  const abs = (s, base = repoDir) => {
    const r = ph(s);
    return isAbsolute(r) ? r : resolve(base, r);
  };
  const contentDir = abs(p.content.dir);
  const files = {};
  for (const [k, v] of Object.entries(p.content.files)) files[k] = abs(v, contentDir);
  const locales = {};
  for (const [k, v] of Object.entries(p.content.locales)) locales[k] = abs(v);
  return {
    ...p,
    repo: {
      dir: repoDir,
      branch: site.GIT_BRANCH || p.repo.branch,
      remote: site.GIT_REMOTE || p.repo.remote,
    },
    webroot,
    content: { ...p.content, dir: contentDir, files, locales },
    uploads: {
      ...p.uploads,
      dir: resolve(site.UPLOADS_DIR || abs(p.uploads.dir)),
      repoDir: p.uploads.repoDir ? abs(p.uploads.repoDir) : '',
    },
    fonts: { ...p.fonts, dirs: p.fonts.dirs.map((d) => abs(d)) },
    fontawesome: { dirs: p.fontawesome.dirs.map((d) => abs(d)) },
    // Gemeinsame Umgebungs-Ordner (STATE_DIR/PREVIEW_DIR) bekommen je Profil ein
    // Unterverzeichnis, damit mehrere Profile in einem Dienst getrennt bleiben.
    preview: {
      ...p.preview,
      base: env.PREVIEW_BASE || p.preview.base,
      outDir: env.PREVIEW_DIR ? resolve(env.PREVIEW_DIR, p.id) : abs(p.preview.outDir),
    },
    stateDir: env.STATE_DIR ? resolve(env.STATE_DIR, p.id) : abs(p.stateDir),
  };
}

/**
 * Alle aktiven Profile laut Umgebung (validiert + aufgelöst), in Reihenfolge der
 * Angabe; das erste ist der Standard. PROFILE_FILE hat Vorrang (genau ein Profil),
 * sonst PROFILES (Kommaliste) bzw. PROFILE/Default.
 */
export function loadActiveProfiles(env = process.env) {
  let list;
  if (env.PROFILE_FILE) {
    list = [resolveProfile(loadProfileFile(resolve(env.PROFILE_FILE)), env)];
  } else {
    const ids = (env.PROFILES ? env.PROFILES.split(',') : [env.PROFILE || DEFAULT_PROFILE_ID])
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) fail('PROFILES ist leer');
    // Seitenbezogene env-Overrides nur für das erste (Standard-)Profil.
    list = ids.map((id, i) =>
      resolveProfile(loadProfileFile(profileFile(id)), env, { siteEnv: i === 0 }),
    );
  }
  const map = new Map();
  for (const p of list) {
    if (map.has(p.id)) fail(`Profil „${p.id}“ ist doppelt angegeben`);
    map.set(p.id, p);
  }
  return map;
}

/** Standard-Profil laut Umgebung (das erste aktive Profil). */
export function loadActiveProfile(env = process.env) {
  return loadActiveProfiles(env).values().next().value;
}

/**
 * Umgebung für Build-/Deploy-Prozesse eines Profils: die Dienst-Umgebung, darüber
 * die Repo-/Webroot-Angaben DES PROFILS (überstimmen REPO_DIR/WEBROOT/UPLOADS_DIR/
 * BRANCH aus der gemeinsamen .env, die sonst für jedes Profil gelten würden), dann
 * die festen Werte aus dem Manifest (build.env bzw. deploy.env).
 */
export function processEnvFor(p, extra = {}, base = process.env) {
  return {
    ...base,
    REPO_DIR: p.repo.dir,
    WEBROOT: p.webroot,
    UPLOADS_DIR: p.uploads.dir,
    BRANCH: p.repo.branch,
    GIT_BRANCH: p.repo.branch,
    GIT_REMOTE: p.repo.remote,
    ...extra,
  };
}

/** Für das Frontend: öffentliche, unkritische Profil-Infos (keine Pfade). */
export function publicProfileInfo(p) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    siteUrl: p.siteUrl,
    languages: p.languages,
    tabs: p.tabs,
    previewBase: p.preview.base,
    // Home-Vertrag (Laufband/Texte/Medien/…) nur, wenn die Dateien dafür da sind.
    contentTabs: !!(p.content.files.media && p.content.files.overridesDe),
    fields: p.fields ? p.fields.groups : null,
    slots: p.fields ? p.fields.slots.map((s) => s.key) : null,
  };
}
