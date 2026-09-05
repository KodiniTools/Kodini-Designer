// Kern-Hilfen des Adminbereichs: API-Aufrufe, IndexedDB-Zwischenspeicher und
// kleine DOM-Helfer. Keine Abhängigkeiten zu anderen Admin-Modulen.

// --- API-Basis relativ zum Auslieferungsort (funktioniert unter /admin/ und lokal /) ---
export const apiUrl = (p) => new URL('api' + p, document.baseURI).toString();

export async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { 'X-Kodini-Admin': '1', ...headers },
  };
  if (raw !== undefined) {
    opts.body = raw;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(apiUrl(path), opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* kann leer sein */
  }
  return { ok: res.ok, status: res.status, data };
}

// --- IndexedDB: lokaler Medien-Zwischenspeicher (Staging) ---
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('kodini-admin', 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('media'))
        r.result.createObjectStore('media', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function mediaAll() {
  const db = await openDb();
  return new Promise((res, rej) => {
    const rq = db.transaction('media').objectStore('media').getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => rej(rq.error);
  });
}
export async function mediaGet(id) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const rq = db.transaction('media').objectStore('media').get(id);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}
export async function mediaPut(item) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').put(item);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function mediaDel(id) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// --- DOM-Helfer ---
export const $ = (sel) => document.querySelector(sel);
export function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
