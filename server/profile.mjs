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
  if (v === undefined || v === null) {
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
  if (!files.media) fail('content.files.media fehlt');
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
  };
}

/** Manifest-Datei lesen + validieren. */
export function loadProfileFile(file) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`Profil ${file} nicht lesbar: ${e.message}`, { cause: e });
  }
  return validateProfile(raw, file);
}

/**
 * Platzhalter {repo}/{webroot} auflösen und relative Pfade auf das Repo
 * beziehen. env: Overrides (REPO_DIR, WEBROOT, UPLOADS_DIR, GIT_BRANCH, GIT_REMOTE).
 * Ergebnis: Profil mit ausschließlich absoluten Pfaden.
 */
export function resolveProfile(p, env = process.env) {
  const repoDir = resolve(env.REPO_DIR || p.repo.dir);
  const webroot = resolve(env.WEBROOT || p.webroot);
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
      branch: env.GIT_BRANCH || p.repo.branch,
      remote: env.GIT_REMOTE || p.repo.remote,
    },
    webroot,
    content: { ...p.content, dir: contentDir, files, locales },
    uploads: {
      ...p.uploads,
      dir: resolve(env.UPLOADS_DIR || abs(p.uploads.dir)),
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
    list = ids.map((id) => resolveProfile(loadProfileFile(profileFile(id)), env));
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
  };
}
