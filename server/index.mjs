// Kodini Designer — HTTP-Server (nur Node-Built-ins).
// Läuft lokal auf 127.0.0.1:PORT, hinter nginx unter einem Präfix (z. B. /admin
// oder /designer); nginx entfernt das Präfix, hier kommen also / und /api/... an.
// Welche Website bearbeitet wird, bestimmt das aktive Site-Profil (config.mjs).

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, profile, assertConfigured } from './config.mjs';
import { publicProfileInfo } from './profile.mjs';
import {
  verifyPassword,
  createSessionToken,
  sessionCookie,
  clearCookie,
  isAuthenticated,
  loginBlocked,
  recordLoginFailure,
  recordLoginSuccess,
} from './auth.mjs';
import { readJson, readBody, sendJson, sendText, clientIp, csrfOk } from './util.mjs';
import { loadContent, saveContent } from './content.mjs';
import { saveUpload, listUploads, deleteUpload, moveUpload } from './uploads.mjs';
import { listFonts } from './fonts.mjs';
import { listFontAwesome } from './fontawesome.mjs';
import { startPublish, getPublishState } from './publish.mjs';
import { startPreview, getPreviewState, PREVIEW_DIR } from './preview.mjs';
import { serverCodeChanged } from './codeupdate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function noindex(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

// --- Statische Auslieferung des Admin-Frontends (Phase 4) ---
async function serveStatic(req, res, urlPath) {
  // Pfad sicher innerhalb PUBLIC_DIR auflösen
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = resolve(PUBLIC_DIR, '.' + (rel === '/' ? '/index.html' : rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }
  try {
    let s = await stat(filePath);
    if (s.isDirectory()) filePath = resolve(filePath, 'index.html');
    const body = await readFile(filePath);
    noindex(res);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    // SPA-Fallback: unbekannte Pfade -> index.html (falls vorhanden)
    try {
      const body = await readFile(resolve(PUBLIC_DIR, 'index.html'));
      noindex(res);
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      sendText(res, 404, 'Admin-Frontend noch nicht gebaut (Phase 4).');
    }
  }
}

// --- Auslieferung der Vorschau (Profil: preview.outDir) unter <präfix>/preview/ ---
// Nur für angemeldete Admins. Die Vorschau-HTML referenziert eigene Assets
// unter /admin/preview/_astro/… (base), Medien/Bilder/Videos hingegen unter
// dem Live-Root (/uploads, /videos, /images) — die existieren dort bereits.
async function servePreview(req, res, urlPath) {
  if (!isAuthenticated(req)) {
    noindex(res);
    res.writeHead(401, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end('<p>Nicht angemeldet. Bitte zuerst im <a href="../">Designer</a> anmelden.</p>');
    return;
  }
  // '/preview' oder '/preview/...' -> relativer Pfad innerhalb dist-preview/
  const sub = urlPath.slice('/preview'.length) || '/';
  const rel = normalize(decodeURIComponent(sub)).replace(/^(\.\.[/\\])+/, '');
  let filePath = resolve(PREVIEW_DIR, '.' + (rel === '/' ? '/index.html' : rel));
  if (filePath !== PREVIEW_DIR && !filePath.startsWith(PREVIEW_DIR + '/')) {
    return sendText(res, 403, 'Forbidden');
  }
  try {
    let s = await stat(filePath);
    if (s.isDirectory()) filePath = resolve(filePath, 'index.html');
    const body = await readFile(filePath);
    noindex(res);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    noindex(res);
    res.writeHead(404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end('<p>In der Vorschau nicht gefunden. Wurde die Vorschau schon erstellt?</p>');
  }
}

// --- API ---
function requireAuth(req, res) {
  if (!isAuthenticated(req)) {
    sendJson(res, 401, { error: 'Nicht angemeldet' });
    return false;
  }
  return true;
}
function requireCsrf(req, res) {
  if (!csrfOk(req)) {
    sendJson(res, 403, { error: 'CSRF-Header fehlt' });
    return false;
  }
  return true;
}

async function handleApi(req, res, path) {
  const method = req.method;

  // Login
  if (path === '/api/login' && method === 'POST') {
    const ip = clientIp(req);
    if (loginBlocked(ip))
      return sendJson(res, 429, { error: 'Zu viele Versuche. Bitte später erneut.' });
    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Ungültiger Body' });
    }
    const ok = await verifyPassword(String(body.password || ''), config.passwordHash);
    if (!ok) {
      recordLoginFailure(ip);
      return sendJson(res, 401, { error: 'Falsches Passwort' });
    }
    recordLoginSuccess(ip);
    const token = createSessionToken();
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token) });
  }

  // Logout
  if (path === '/api/logout' && method === 'POST') {
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }

  // Session-Status (+ Hinweis, falls der laufende Prozess veralteten Server-Code hat)
  if (path === '/api/session' && method === 'GET') {
    const authenticated = isAuthenticated(req);
    return sendJson(res, 200, {
      authenticated,
      serverCodeChanged: authenticated ? await serverCodeChanged() : false,
      profile: publicProfileInfo(profile),
    });
  }

  // Ab hier: Auth erforderlich
  if (path === '/api/content' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const content = await loadContent();
    return sendJson(res, 200, content);
  }

  if (path === '/api/content' && method === 'PUT') {
    if (!requireAuth(req, res)) return;
    if (!requireCsrf(req, res)) return;
    let body;
    try {
      body = await readJson(req, 4 * 1024 * 1024);
    } catch {
      return sendJson(res, 400, { error: 'Ungültiger Body' });
    }
    try {
      const saved = await saveContent(body);
      return sendJson(res, 200, { ok: true, saved });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (path === '/api/upload' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (!requireCsrf(req, res)) return;
    const filename = req.headers['x-filename'];
    if (!filename) return sendJson(res, 400, { error: 'X-Filename-Header fehlt' });
    try {
      const buf = await readBody(req, config.maxUploadMb * 1024 * 1024);
      const result = await saveUpload(buf, filename, req.headers['x-lang']);
      return sendJson(res, 200, { ok: true, ...result });
    } catch (e) {
      return sendJson(res, e.statusCode || 500, { error: e.message });
    }
  }

  // Server-Uploads getrennt nach Sprache auflisten: { de, en, shared }
  if (path === '/api/uploads' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJson(res, 200, await listUploads());
  }

  // Verfügbare Schriftarten (aus dem Fonts-Ordner) für die Laufband-Schrift.
  if (path === '/api/fonts' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJson(res, 200, { fonts: await listFonts() });
  }

  // Verfügbare Font-Awesome-Icons (SVG, je Kategorie) für den „Icons"-Tab.
  if (path === '/api/fontawesome' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJson(res, 200, { icons: await listFontAwesome() });
  }

  // Eine Upload-Datei löschen (Webroot + Repo). Dauerhaft mit dem nächsten
  // Veröffentlichen (dort wird die Repo-Löschung committet).
  if (path === '/api/uploads/delete' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (!requireCsrf(req, res)) return;
    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Ungültiger Body' });
    }
    try {
      const result = await deleteUpload(String(body.path || body.name || ''));
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, e.statusCode || 500, { error: e.message });
    }
  }

  // Eine Upload-Datei in einen anderen Sprachordner verschieben
  if (path === '/api/uploads/move' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (!requireCsrf(req, res)) return;
    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Ungültiger Body' });
    }
    try {
      const result = await moveUpload(String(body.path || ''), String(body.lang || ''));
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, e.statusCode || 500, { error: e.message });
    }
  }

  if (path === '/api/publish' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (!requireCsrf(req, res)) return;
    if (getPreviewState().status === 'running') {
      return sendJson(res, 409, {
        error: 'Es läuft gerade ein Vorschau-Build. Bitte kurz warten.',
      });
    }
    let body = {};
    try {
      body = await readJson(req);
    } catch {
      /* optional */
    }
    const result = startPublish(typeof body.message === 'string' ? body.message.slice(0, 100) : '');
    if (!result.ok) return sendJson(res, 409, { error: result.reason });
    return sendJson(res, 202, { ok: true });
  }

  if (path === '/api/publish/status' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJson(res, 200, getPublishState());
  }

  // Vorschau-Build (baut Entwurf nach dist-preview/, ohne Deploy)
  if (path === '/api/preview' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (!requireCsrf(req, res)) return;
    if (getPublishState().status === 'running') {
      return sendJson(res, 409, {
        error: 'Es läuft gerade eine Veröffentlichung. Bitte kurz warten.',
      });
    }
    const result = startPreview();
    if (!result.ok) return sendJson(res, 409, { error: result.reason });
    return sendJson(res, 202, { ok: true });
  }

  if (path === '/api/preview/status' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJson(res, 200, getPreviewState());
  }

  return sendJson(res, 404, { error: 'Unbekannter Endpunkt' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      await handleApi(req, res, path);
    } else if (path === '/preview' || path.startsWith('/preview/')) {
      await servePreview(req, res, path);
    } else {
      await serveStatic(req, res, path);
    }
  } catch (err) {
    if (!res.headersSent)
      sendJson(res, err.statusCode || 500, { error: err.message || 'Serverfehler' });
    else res.end();
  }
});

// --- Start ---
const missing = assertConfigured();
if (missing.length) {
  console.error(`[kodini-designer] FEHLENDE Konfiguration: ${missing.join(', ')}`);
  console.error('[kodini-designer] Setze diese in /opt/kodini/.env (siehe deploy/.env.example).');
  process.exit(1);
}

server.listen(config.port, config.host, () => {
  console.log(
    `[kodini-designer] läuft auf http://${config.host}:${config.port} – Profil „${profile.name}“ (${profile.id}), Repo ${config.repoDir}`,
  );
  // Effektives Upload-Verzeichnis loggen — Uploads MÜSSEN dort landen, wo nginx
  // /uploads/ ausliefert (webroot/uploads). Liegt UPLOADS_DIR woanders, liefert
  // die Seite 404 für alle Nutzer, obwohl der Upload „erfolgreich" war.
  const expectedUploads = resolve(config.webroot, 'uploads');
  console.log(`[kodini-designer] uploadsDir: ${config.uploadsDir}`);
  if (resolve(config.uploadsDir) !== expectedUploads) {
    console.warn(
      `[kodini-designer] WARNUNG: uploadsDir (${config.uploadsDir}) != ${expectedUploads}. ` +
        `Von nginx unter /uploads/ ausgelieferte Dateien werden nicht gefunden (404). ` +
        `Setze UPLOADS_DIR=${expectedUploads} in /opt/kodini/.env und starte den Dienst neu.`,
    );
  }
});
