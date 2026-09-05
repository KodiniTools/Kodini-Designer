// Datei-Uploads. Der Admin-Client sendet die Datei als Raw-Body mit dem
// Header X-Filename (kein Multipart-Parsing nötig). Ziel: uploadsDir auf dem
// Server (außerhalb Git). Rückgabe: öffentlicher Pfad /uploads/<datei>.

import {
  mkdir,
  writeFile,
  access,
  copyFile,
  readdir,
  stat,
  unlink,
  rename,
} from 'node:fs/promises';
import { resolve, extname, basename, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { config, profile } from './config.mjs';

// Uploads bis zu dieser Größe werden zusätzlich ins Repo (public/uploads)
// kopiert und per Git dauerhaft gesichert. Größere Dateien (Videos) bleiben nur
// im Webroot, um das Repo nicht aufzublähen.
export const UPLOADS_GIT_MAX_BYTES = profile.uploads.gitMaxBytes;
// Öffentlicher URL-Präfix der Uploads (Profil, ohne Schluss-Slash), z. B. /uploads.
const urlPrefix = () => profile.uploads.urlPrefix.replace(/\/$/, '');

const ALLOWED = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.avif',
  '.mp4',
  '.webm',
  '.mov',
  '.ogg',
  '.mp3',
  '.wav',
]);

/** Macht einen Dateinamen sicher (keine Pfade, nur erlaubte Zeichen). */
function safeName(name) {
  const base = basename(String(name || '')).replace(/[^a-zA-Z0-9._-]/g, '-');
  const ext = extname(base).toLowerCase();
  const stem = base.slice(0, base.length - ext.length).slice(0, 60) || 'datei';
  return { stem, ext };
}

async function uniquePath(dir, stem, ext) {
  // Kurzes Zufalls-Suffix gegen Kollisionen/Überschreiben.
  for (let i = 0; i < 5; i++) {
    const suffix = randomBytes(4).toString('hex');
    const fname = `${stem}-${suffix}${ext}`;
    const full = resolve(dir, fname);
    try {
      await access(full);
    } catch {
      return { full, fname };
    }
  }
  const fname = `${stem}-${Date.now()}${ext}`;
  return { full: resolve(dir, fname), fname };
}

/** Sprach-Unterordner: 'de'/'en' -> getrennte Galerie; sonst '' (gemeinsam). */
function langSub(lang) {
  return lang === 'de' || lang === 'en' ? lang : '';
}

/**
 * Speichert einen Upload — pro Sprache in einen eigenen Unterordner
 * (/uploads/de, /uploads/en), damit DE- und EN-Medien getrennt bleiben.
 * @param {Buffer} buf  Dateiinhalt
 * @param {string} filename  gewünschter Name (aus X-Filename)
 * @param {string} lang  'de' | 'en' | '' (gemeinsam)
 * @returns {{ url: string, filename: string, bytes: number, lang: string }}
 */
export async function saveUpload(buf, filename, lang) {
  const { stem, ext } = safeName(filename);
  if (!ALLOWED.has(ext)) {
    throw Object.assign(new Error(`Dateityp ${ext || '(keiner)'} nicht erlaubt`), {
      statusCode: 415,
    });
  }
  if (!buf || buf.length === 0) {
    throw Object.assign(new Error('Leere Datei'), { statusCode: 400 });
  }
  const sub = langSub(lang);
  const rel = sub ? `${sub}/` : '';
  const dir = resolve(config.uploadsDir, sub);
  await mkdir(dir, { recursive: true });
  const { full, fname } = await uniquePath(dir, stem, ext);
  await writeFile(full, buf);

  // Zusätzlich eine versionierbare Kopie im Repo ablegen (public/uploads/<sub>) —
  // nur bis zur Größengrenze. Beim Veröffentlichen wird sie mitcommittet; der
  // Build kopiert public/uploads nach dist/uploads und der Deploy spiegelt es
  // ins Webroot. Dadurch wird die Datei bei JEDEM Deploy wiederhergestellt.
  // Schlägt die Kopie fehl, gilt der Upload dennoch als erfolgreich.
  if (profile.uploads.repoDir && buf.length <= UPLOADS_GIT_MAX_BYTES) {
    try {
      const repoDir = resolve(profile.uploads.repoDir, sub);
      await mkdir(repoDir, { recursive: true });
      const repoTarget = resolve(repoDir, fname);
      if (repoTarget !== full) await copyFile(full, repoTarget);
    } catch (e) {
      console.warn('[kodini-designer] Upload-Kopie ins Repo fehlgeschlagen:', e.message);
    }
  }

  return { url: `${urlPrefix()}/${rel}${fname}`, filename: fname, bytes: buf.length, lang: sub };
}

/** Prüft, dass ein Name ein einfacher Dateiname ist (kein Pfad/Traversal). */
function isPlainName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name === basename(name) &&
    !name.startsWith('.') &&
    !name.includes('/') &&
    !name.includes('\\')
  );
}

/** Dateien EINES Unterordners auflisten (sub='' = Wurzel = gemeinsam). */
async function listDir(sub) {
  const rel = sub ? `${sub}/` : '';
  let names;
  try {
    names = await readdir(resolve(config.uploadsDir, sub));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!isPlainName(name)) continue; // .gitkeep, Unterordner & Verstecktes überspringen
    let s;
    try {
      s = await stat(resolve(config.uploadsDir, sub, name));
    } catch {
      continue;
    }
    if (!s.isFile()) continue;
    out.push({
      name,
      path: `${rel}${name}`,
      url: `${urlPrefix()}/${rel}${name}`,
      bytes: s.size,
      mtime: s.mtimeMs,
    });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

/**
 * Listet die Server-Uploads getrennt nach Sprache:
 * { de: [...], en: [...], shared: [...] } (shared = alte, ungetrennte Dateien
 * direkt in /uploads).
 */
export async function listUploads() {
  const [de, en, shared] = await Promise.all([listDir('de'), listDir('en'), listDir('')]);
  return { de, en, shared };
}

/** Erlaubt "de/datei", "en/datei" oder "datei" (kein Traversal). */
function isValidUploadPath(p) {
  return typeof p === 'string' && /^((de|en)\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(p);
}

/**
 * Löscht eine Upload-Datei (relativer Pfad, z.B. "de/bild.jpg") aus dem Webroot
 * UND aus public/uploads (Repo). Die Repo-Löschung wird beim nächsten
 * Veröffentlichen mit committet (git add -A public/uploads), sodass die Datei
 * nicht beim nächsten Deploy zurückkehrt.
 */
export async function deleteUpload(relPath) {
  if (!isValidUploadPath(relPath)) {
    throw Object.assign(new Error('Ungültiger Pfad'), { statusCode: 400 });
  }
  const targets = [
    resolve(config.uploadsDir, relPath),
    profile.uploads.repoDir ? resolve(profile.uploads.repoDir, relPath) : '',
  ];
  const removed = [];
  for (const t of targets) {
    try {
      await unlink(t);
      removed.push(t);
    } catch {
      /* nicht vorhanden -> ignorieren */
    }
  }
  if (removed.length === 0) {
    throw Object.assign(new Error('Datei nicht gefunden'), { statusCode: 404 });
  }
  return { ok: true, path: relPath, removed: removed.length };
}

/**
 * Verschiebt eine Upload-Datei in einen anderen Sprachordner (bzw. in den
 * gemeinsamen Ordner). Benennt sie im Webroot UND in public/uploads um.
 * @param {string} fromPath  relativer Pfad, z.B. "banner.jpg" oder "de/x.jpg"
 * @param {string} toLang    'de' | 'en' | '' (gemeinsam)
 */
export async function moveUpload(fromPath, toLang) {
  if (!isValidUploadPath(fromPath)) {
    throw Object.assign(new Error('Ungültiger Quellpfad'), { statusCode: 400 });
  }
  const sub = langSub(toLang);
  const base = basename(fromPath);
  const toPath = sub ? `${sub}/${base}` : base;
  if (toPath === fromPath) {
    throw Object.assign(new Error('Datei liegt bereits dort'), { statusCode: 400 });
  }
  const srcWeb = resolve(config.uploadsDir, fromPath);
  const dstWeb = resolve(config.uploadsDir, toPath);
  // Quelle muss existieren, Ziel darf nicht existieren.
  try {
    await stat(srcWeb);
  } catch {
    throw Object.assign(new Error('Quelldatei nicht gefunden'), { statusCode: 404 });
  }
  try {
    await stat(dstWeb);
    throw Object.assign(new Error('Zielname existiert bereits'), { statusCode: 409 });
  } catch (e) {
    if (e.statusCode === 409) throw e; // Ziel existiert -> abbrechen
    /* sonst: Ziel frei -> weiter */
  }
  await mkdir(dirname(dstWeb), { recursive: true });
  await rename(srcWeb, dstWeb);
  // Repo-Kopie ebenfalls verschieben (falls vorhanden).
  try {
    const srcRepo = profile.uploads.repoDir ? resolve(profile.uploads.repoDir, fromPath) : '';
    const dstRepo = profile.uploads.repoDir ? resolve(profile.uploads.repoDir, toPath) : '';
    await mkdir(dirname(dstRepo), { recursive: true });
    await rename(srcRepo, dstRepo);
  } catch {
    /* Repo-Kopie fehlt -> egal */
  }
  return { ok: true, from: fromPath, to: toPath, url: `${urlPrefix()}/${toPath}` };
}
