// Code-Aktualisierung des Server-Klons + Neustart-Erkennung des Admin-Dienstes.
//
// Hintergrund: Der Designer baut die Vorschau aus dem Arbeitsverzeichnis der
// Website (Profil: repo.dir, z. B. /opt/kodini/repo). Neuer Code landet dort bisher nur beim Deploy
// (deploy.sh → git reset --hard origin/main). Damit die Vorschau immer den
// aktuellen main-Stand zeigt (z. B. neue Admin-Tabs), holt sie den Code vorher
// per fast-forward. Ändert sich der Server-Code des Designers (server/*.mjs),
// läuft noch der alte Prozess – unter systemd (Restart=on-failure) beendet er
// sich nach Abschluss selbst und wird automatisch neu gestartet.

import { readdir, stat, writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Startzeit des Prozesses: Server-Dateien, die danach geändert wurden, sind
// noch nicht geladen (ES-Module werden nur beim Start eingelesen). Seit der
// Auslagerung in ein eigenes Repo ändert ein Website-Deploy diesen Code nicht
// mehr; die Prüfung greift nur noch nach einem Update des Designers selbst.
const STARTED_AT = Date.now();

/** Läuft der Dienst unter systemd (dann ist ein Selbst-Neustart möglich)? */
export function underSystemd() {
  return !!process.env.INVOCATION_ID && process.env.ADMIN_AUTO_RESTART !== '0';
}

/**
 * true, wenn eine server/*.mjs-Datei nach dem Prozessstart geändert
 * wurde – der laufende Prozess hat dann veralteten Code.
 */
export async function serverCodeChanged() {
  try {
    const names = await readdir(__dirname);
    for (const n of names) {
      if (!n.endsWith('.mjs')) continue;
      const s = await stat(resolve(__dirname, n));
      // Strikt „nach dem Start": keine Toleranz, sonst könnte eine kurz vor dem
      // Start geänderte Datei jede Vorschau in einen erneuten Neustart treiben.
      if (s.mtimeMs > STARTED_AT) return true;
    }
  } catch {
    /* Fehler beim Lesen -> kein Neustart erzwingen */
  }
  return false;
}

/**
 * Holt den aktuellen Stand von origin/<branch> per fast-forward in das
 * Arbeitsverzeichnis (ohne lokale Entwürfe anzufassen: bei Konflikt mit
 * ungespeicherten Dateien verweigert git den Merge, dann bleibt alles wie es
 * ist). Führt `npm ci` aus, wenn sich package.json/package-lock.json änderten.
 *
 * @param {object} p Site-Profil (Repo, Branch, Remote)
 * @param {(cmd:string,args:string[],opts?:object)=>Promise<string>} run
 * @param {(line:string)=>void} log
 * @param {object} env Umgebung für npm (HOME etc.)
 * @returns {Promise<{updated:boolean, from:string, to:string, files:string[], error?:string}>}
 */
export async function updateCodeFromRemote(p, run, log, env) {
  const branch = p.repo.branch;
  const remote = p.repo.remote;
  const short = (h) =>
    String(h || '')
      .trim()
      .slice(0, 7);
  let from = '';
  // Entwürfe (vom Designer geschriebene Content-Dateien) blockieren einen
  // Fast-Forward, wenn origin dieselbe Datei geändert hat. Sie werden vor dem
  // Merge gesichert, zurückgesetzt und danach wiederhergestellt – der Entwurf
  // gewinnt, weil er dem aktuellen Stand der Oberfläche entspricht.
  const drafts = new Map(); // relativer Pfad -> Inhalt
  const restoreDrafts = async () => {
    for (const [rel, content] of drafts) {
      await writeFile(resolve(p.repo.dir, rel), content, 'utf8');
    }
    if (drafts.size) log(`Entwürfe wiederhergestellt: ${[...drafts.keys()].join(', ')}`);
  };
  try {
    from = (await run('git', ['rev-parse', 'HEAD'])).trim();
    log(`git fetch ${remote} ${branch} (Code-Update für die Vorschau)`);
    await run('git', ['fetch', remote, branch]);
    const to = (await run('git', ['rev-parse', `${remote}/${branch}`])).trim();
    if (to === from) {
      log(`Code ist aktuell (${short(from)}).`);
      return { updated: false, from: short(from), to: short(to), files: [] };
    }
    const paths = p.content.commitPaths || [];
    if (paths.length) {
      // Porcelain-Zeilen: "XY pfad" (XY = Status-Spalten; Ausgabe kann getrimmt sein).
      const dirty = (await run('git', ['status', '--porcelain', '--', ...paths]))
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) =>
          l
            .replace(/^\S{1,2}\s+/, '')
            .replace(/^.* -> /, '')
            .trim(),
        )
        .filter(Boolean);
      for (const rel of dirty) {
        try {
          drafts.set(rel, await readFile(resolve(p.repo.dir, rel), 'utf8'));
        } catch {
          /* gelöscht -> nichts zu sichern */
        }
      }
      if (drafts.size) {
        log(`Entwürfe vor dem Code-Update gesichert: ${[...drafts.keys()].join(', ')}`);
        await run('git', ['checkout', '--', ...drafts.keys()]);
      }
    }
    try {
      await run('git', ['merge', '--ff-only', `${remote}/${branch}`]);
    } finally {
      await restoreDrafts();
    }
    const files = (await run('git', ['diff', '--name-only', from, to]))
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    log(`Code aktualisiert: ${short(from)} → ${short(to)} (${files.length} Datei(en)).`);
    if (files.some((f) => /^package(-lock)?\.json$/.test(f))) {
      log('Abhängigkeiten geändert → npm ci --include=dev');
      log(await run('npm', ['ci', '--include=dev'], { env }));
    }
    return { updated: true, from: short(from), to: short(to), files };
  } catch (err) {
    const msg = `${err?.message || err}${err?.output ? `\n${err.output}` : ''}`.trim();
    log(`Code-Update übersprungen (Vorschau baut den lokalen Stand): ${msg}`);
    return { updated: false, from: short(from), to: '', files: [], error: msg };
  }
}

/**
 * Stellt sicher, dass die Abhängigkeiten der Website installiert sind (frischer
 * Klon ohne node_modules -> `npm ci --include=dev`), damit der Vorschau-Build
 * (z. B. vue-tsc/vite/astro) läuft. Ohne package.json passiert nichts.
 */
export async function ensureDependencies(p, run, log, env) {
  const exists = (rel) =>
    access(resolve(p.repo.dir, rel)).then(
      () => true,
      () => false,
    );
  if (!(await exists('package.json'))) return false;
  if (await exists('node_modules/.package-lock.json')) return false;
  log('node_modules fehlt → npm ci --include=dev');
  log(await run('npm', ['ci', '--include=dev'], { env, timeout: 15 * 60 * 1000 }));
  return true;
}

/**
 * Beendet den Prozess nach kurzer Verzögerung, wenn Server-Code geändert wurde
 * und systemd ihn neu starten kann. Gibt true zurück, wenn ein Neustart
 * eingeplant wurde (der Aufrufer sollte seinen Status vorher persistieren).
 */
export async function restartIfServerCodeChanged(log) {
  if (!(await serverCodeChanged())) return false;
  if (!underSystemd()) {
    log(
      'Hinweis: Server-Code (server/*.mjs) wurde aktualisiert – Designer-Dienst neu starten: sudo systemctl restart kodini-designer',
    );
    return false;
  }
  log('Server-Code wurde aktualisiert – Admin-Dienst startet in 2 s neu (systemd).');
  setTimeout(() => process.exit(1), 2000).unref();
  return true;
}

// --- Persistenz von Vorgangs-Status (Vorschau/Veröffentlichung) über einen
// Neustart hinweg, damit das Frontend beim Polling das Ergebnis noch sieht.
// Ordner je Profil: p.stateDir. ---

/** Status-Objekt unter `name` speichern (best effort, nicht blockierend). */
export async function persistState(p, name, state) {
  try {
    await mkdir(p.stateDir, { recursive: true });
    await writeFile(resolve(p.stateDir, `${name}.json`), JSON.stringify(state), 'utf8');
  } catch {
    /* Persistenz ist optional */
  }
}

/**
 * Gespeicherten Status laden (synchron beim Modulstart). Ein beim Neustart
 * noch „laufender" Vorgang wird als Fehler markiert, damit kein Polling hängt.
 */
export function restoreState(p, name, fallback) {
  try {
    const s = JSON.parse(readFileSync(resolve(p.stateDir, `${name}.json`), 'utf8'));
    if (!s || typeof s !== 'object') return fallback;
    if (s.status === 'running') {
      s.status = 'error';
      s.error = 'Vorgang durch Neustart des Admin-Dienstes abgebrochen – bitte erneut starten.';
      s.finishedAt = Date.now();
    }
    // Merker fürs Frontend: dieser Stand stammt aus der Zeit vor dem Neustart
    // (Frontend lädt sich dann einmalig neu, um neue Module zu laden).
    s.restarted = s.restarting === true;
    s.restarting = false;
    return { ...fallback, ...s };
  } catch {
    return fallback;
  }
}
