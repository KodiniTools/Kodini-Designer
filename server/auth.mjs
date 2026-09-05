// Authentifizierung: Passwort-Hash (scrypt) + zustandslose, signierte
// Session-Cookies (HMAC-SHA256). Ein Inhaber-Konto, keine externen Deps.

import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { config } from './config.mjs';

const SCRYPT_KEYLEN = 64;
const COOKIE_NAME = 'kodini_admin_session';

function scryptAsync(password, salt, keylen) {
  return new Promise((res, rej) => {
    scrypt(password, salt, keylen, (err, dk) => (err ? rej(err) : res(dk)));
  });
}

/**
 * Erzeugt einen Passwort-Hash im Format  scrypt$<saltHex>$<hashHex>.
 * Wird vom Hilfsskript hash-password.mjs genutzt.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const dk = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}

/** Prüft ein Passwort gegen den gespeicherten Hash (timing-safe). */
export async function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const dk = await scryptAsync(password, salt, expected.length);
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

// --- Session-Cookies (stateless, signiert) ---

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}
function sign(payloadB64) {
  return createHmac('sha256', config.sessionSecret).update(payloadB64).digest('base64url');
}

/** Erzeugt einen signierten Session-Token mit Ablaufzeit. */
export function createSessionToken() {
  const exp = Date.now() + config.sessionTtlHours * 3600 * 1000;
  const payload = b64url(JSON.stringify({ exp, v: 1 }));
  return `${payload}.${sign(payload)}`;
}

/** Validiert einen Session-Token; liefert true bei gültig & nicht abgelaufen. */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

/** Setzt-Cookie-Header-Wert für Login. */
export function sessionCookie(token) {
  const maxAge = config.sessionTtlHours * 3600;
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Path=${config.cookiePath}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (config.isProd) parts.push('Secure');
  return parts.join('; ');
}

/** Set-Cookie-Header-Wert zum Ausloggen. */
export function clearCookie() {
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=${config.cookiePath}`,
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (config.isProd) parts.push('Secure');
  return parts.join('; ');
}

/** Liest den Session-Token aus dem Cookie-Header. */
export function readSessionCookie(req) {
  const raw = req.headers.cookie || '';
  for (const pair of raw.split(';')) {
    const i = pair.indexOf('=');
    if (i === -1) continue;
    const name = pair.slice(0, i).trim();
    if (name === COOKIE_NAME) return pair.slice(i + 1).trim();
  }
  return '';
}

/** True, wenn der Request eine gültige Session besitzt. */
export function isAuthenticated(req) {
  return verifySessionToken(readSessionCookie(req));
}

// --- Login-Bruteforce-Schutz (in-memory pro IP) ---

const attempts = new Map(); // ip -> { count, first }

export function loginBlocked(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > config.loginWindowMs) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= config.loginMaxAttempts;
}

export function recordLoginFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > config.loginWindowMs) {
    attempts.set(ip, { count: 1, first: now });
  } else {
    rec.count += 1;
  }
}

export function recordLoginSuccess(ip) {
  attempts.delete(ip);
}
