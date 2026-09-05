// Konfiguration des Designer-Dienstes. Seitenspezifisches (Repo, Content-
// Dateien, Ordner, Befehle) kommt aus dem aktiven Site-Profil (profile.mjs);
// Secrets und Netzwerk aus der Umgebung (systemd EnvironmentFile=/opt/kodini/.env).
// REPO_DIR/WEBROOT/UPLOADS_DIR/GIT_BRANCH/GIT_REMOTE überstimmen das Profil.

import { loadActiveProfile, DESIGNER_ROOT } from './profile.mjs';

function int(name, def) {
  const v = process.env[name];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : def;
}

/** Aktives Site-Profil (validiert, alle Pfade absolut). */
export const profile = loadActiveProfile();

export const config = {
  host: process.env.BIND_HOST || '127.0.0.1',
  port: int('PORT', 9020),
  designerRoot: DESIGNER_ROOT,

  // Auth
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionTtlHours: int('SESSION_TTL_HOURS', 8),
  totpSecret: process.env.ADMIN_TOTP_SECRET || '', // optional
  // Cookie-Pfad: in Produktion /admin (nginx), lokal ggf. / für Tests.
  cookiePath: process.env.COOKIE_PATH || '/admin',

  // Pfade (aus dem Profil, ggf. per Umgebung überstimmt)
  repoDir: profile.repo.dir,
  webroot: profile.webroot,
  uploadsDir: profile.uploads.dir,

  // Git
  gitBranch: profile.repo.branch,
  gitRemote: profile.repo.remote,
  gitAuthorName: process.env.GIT_AUTHOR_NAME || 'KodiniTools Admin',
  gitAuthorEmail: process.env.GIT_AUTHOR_EMAIL || 'admin@kodinitools.com',

  // Uploads
  maxUploadMb: int('MAX_UPLOAD_MB', 2048),

  // Login-Bruteforce-Schutz
  loginMaxAttempts: int('LOGIN_MAX_ATTEMPTS', 8),
  loginWindowMs: int('LOGIN_WINDOW_MS', 15 * 60 * 1000),

  isProd: process.env.NODE_ENV === 'production',
};

/**
 * Pfade zu den vom Designer editierbaren Content-Dateien (aus dem Profil).
 * Schlüssel wie bisher (overridesDe, tickerDe, media, localesDe, …), damit
 * content.mjs unverändert bleibt.
 */
export function contentPaths() {
  const f = profile.content.files;
  const l = profile.content.locales;
  return {
    overridesDe: f.overridesDe,
    overridesEn: f.overridesEn,
    tickerDe: f.tickerDe,
    tickerEn: f.tickerEn,
    media: f.media,
    localesDe: l.de || '',
    localesEn: l.en || '',
    base: profile.content.dir,
  };
}

/** Startet der Dienst? Prüft, ob Pflicht-Secrets gesetzt sind. */
export function assertConfigured() {
  const missing = [];
  if (!config.passwordHash) missing.push('ADMIN_PASSWORD_HASH');
  if (!config.sessionSecret) missing.push('SESSION_SECRET');
  return missing;
}
