// Vorschau-Build: baut den AKTUELLEN Arbeitsstand (die per saveContent
// geschriebenen Entwürfe) eines Profils in ein separates Verzeichnis mit
// base '<präfix>/preview/' (Profil/PREVIEW_BASE). Es wird NICHTS committet,
// gepusht oder deployt. Der Dienst liefert das Verzeichnis unter /preview/ aus,
// sodass der Admin alle Änderungen vor dem Veröffentlichen im Browser sieht.
// Je Profil gibt es einen eigenen Job (Status, Log, Verzeichnis).

import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { runStreaming } from './util.mjs';
import { processEnvFor } from './profile.mjs';
import {
  updateCodeFromRemote,
  ensureDependencies,
  restartIfServerCodeChanged,
  persistState,
  restoreState,
} from './codeupdate.mjs';

/** Lokales Ausgabeverzeichnis der Vorschau eines Profils. */
export function previewDir(p) {
  return p.preview.outDir;
}

function initialState() {
  return {
    status: 'idle', // idle | running | success | error
    step: '',
    log: [],
    startedAt: null,
    finishedAt: null,
    error: null,
    codeUpdate: null, // { updated, from, to, files } – Ergebnis des Code-Updates
    restarting: false, // Dienst startet nach diesem Vorgang neu (neuer Server-Code)
    restarted: false, // Status stammt aus der Zeit vor einem Selbst-Neustart (wiederhergestellt)
  };
}

function createPreviewJob(p) {
  // Letzten Stand wiederherstellen (überlebt den Selbst-Neustart des Dienstes).
  let state = restoreState(p, 'preview', initialState());

  function run(cmd, args, opts = {}) {
    return new Promise((resolvePromise, reject) => {
      execFile(
        cmd,
        args,
        { cwd: p.repo.dir, maxBuffer: 10 * 1024 * 1024, ...opts },
        (err, stdout, stderr) => {
          const out = `${stdout || ''}${stderr || ''}`.trim();
          if (err) reject(Object.assign(err, { output: out }));
          else resolvePromise(out);
        },
      );
    });
  }

  function log(line) {
    state.log.push(`[${new Date().toISOString()}] ${line}`);
    if (state.log.length > 500) state.log.shift();
  }

  // Abschluss: Status sichern und – falls der Server-Code aktualisiert wurde –
  // den Dienst neu starten lassen (systemd), damit der neue Code aktiv wird.
  async function finish() {
    state.restarting = await restartIfServerCodeChanged(log);
    await persistState(p, 'preview', state);
  }

  async function doPreview() {
    // Build-Umgebung (siehe unten) wird auch für npm ci beim Code-Update gebraucht.
    const buildHome = resolve(dirname(p.repo.dir), '.build-home');
    await mkdir(buildHome, { recursive: true });
    // Build-Umgebung aus dem Profil: base + Ausgabeverzeichnis der Vorschau
    // (Variablennamen je Site-Typ, z. B. ASTRO_BASE/ASTRO_OUT_DIR) und feste Werte
    // (Telemetrie aus). HOME sicher beschreibbar (npm-/Build-Cache im Sandbox).
    const env = processEnvFor(p, { ...p.build.env, HOME: buildHome });
    if (p.preview.env.base) env[p.preview.env.base] = p.preview.base;
    if (p.preview.env.outDir) env[p.preview.env.outDir] = p.preview.outDir;

    // 1. Aktuellen Code von origin/<branch> holen (fast-forward; lokale Entwürfe
    //    bleiben unangetastet). So zeigt die Vorschau immer den neuesten Stand.
    state.step = 'code-update';
    state.codeUpdate = p.codeUpdate.enabled
      ? await updateCodeFromRemote(p, run, log, env)
      : { updated: false, from: '', to: '', files: [] };

    // 2. Abhängigkeiten (frischer Klon) und bauen.
    state.step = 'install';
    await ensureDependencies(p, run, log, env);
    state.step = 'build';
    log(`${p.build.command.join(' ')} (Vorschau) -> ${p.preview.outDir}`);
    const [buildCmd, ...buildArgs] = p.build.command;
    await runStreaming(buildCmd, buildArgs, {
      cwd: p.repo.dir,
      env,
      timeoutMs: p.build.timeoutMinutes * 60 * 1000,
      onLine: (line) => log(line),
    });

    state.status = 'success';
    state.step = 'done';
    state.finishedAt = Date.now();
    log('Vorschau-Build abgeschlossen.');
  }

  /** Startet den Vorschau-Build (idempotent: verweigert, wenn bereits läuft). */
  function start() {
    if (state.status === 'running') {
      return { ok: false, reason: 'Es läuft bereits ein Vorschau-Build.' };
    }
    state = { ...initialState(), status: 'running', step: 'start', startedAt: Date.now() };
    doPreview()
      .catch((err) => {
        state.status = 'error';
        state.error = err?.message || String(err);
        if (err?.output) log(err.output);
        state.finishedAt = Date.now();
      })
      .then(finish);
    return { ok: true };
  }

  return {
    get state() {
      return state;
    },
    start,
  };
}

// Ein Job je Profil (lazy angelegt; Status wird beim ersten Zugriff wiederhergestellt).
const jobs = new Map();
function job(p) {
  let j = jobs.get(p.id);
  if (!j) {
    j = createPreviewJob(p);
    jobs.set(p.id, j);
  }
  return j;
}

export function getPreviewState(p) {
  return job(p).state;
}

/** Startet den Vorschau-Build des Profils (idempotent). */
export function startPreview(p) {
  return job(p).start();
}
