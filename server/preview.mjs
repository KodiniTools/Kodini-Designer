// Vorschau-Build: baut den AKTUELLEN Arbeitsstand (die per saveContent
// geschriebenen Entwürfe) in ein separates Verzeichnis dist-preview/ mit
// base '/admin/preview/'. Es wird NICHTS committet, gepusht oder deployt.
// Der Admin-Dienst liefert dist-preview/ unter /admin/preview/ aus, sodass
// der Admin alle Änderungen vor dem Veröffentlichen im Browser sieht.

import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { config, profile } from './config.mjs';
import { runStreaming } from './util.mjs';
import {
  updateCodeFromRemote,
  restartIfServerCodeChanged,
  persistState,
  restoreState,
} from './codeupdate.mjs';

// Öffentlicher Pfad der Vorschau (hinter nginx) und lokales Ausgabeverzeichnis.
export const PREVIEW_BASE = profile.preview.base;
export const PREVIEW_DIR = profile.preview.outDir;

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
// Letzten Stand wiederherstellen (überlebt den Selbst-Neustart des Dienstes).
let state = restoreState('preview', initialState());

export function getPreviewState() {
  return state;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      cmd,
      args,
      { cwd: config.repoDir, maxBuffer: 10 * 1024 * 1024, ...opts },
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

/** Startet den Vorschau-Build (idempotent: verweigert, wenn bereits läuft). */
export function startPreview() {
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
    .then(finishPreview);
  return { ok: true };
}

// Abschluss: Status sichern und – falls der Server-Code aktualisiert wurde –
// den Dienst neu starten lassen (systemd), damit der neue Code aktiv wird.
async function finishPreview() {
  state.restarting = await restartIfServerCodeChanged(log);
  await persistState('preview', state);
}

async function doPreview() {
  // Build-Umgebung (siehe unten) wird auch für npm ci beim Code-Update gebraucht.
  const buildHome = resolve(dirname(config.repoDir), '.build-home');
  await mkdir(buildHome, { recursive: true });
  // Build-Umgebung aus dem Profil: base + Ausgabeverzeichnis der Vorschau
  // (Variablennamen je Site-Typ, z. B. ASTRO_BASE/ASTRO_OUT_DIR) und feste Werte
  // (Telemetrie aus). HOME sicher beschreibbar (npm-/Build-Cache im Sandbox).
  const env = { ...process.env, ...profile.build.env, HOME: buildHome };
  if (profile.preview.env.base) env[profile.preview.env.base] = PREVIEW_BASE;
  if (profile.preview.env.outDir) env[profile.preview.env.outDir] = PREVIEW_DIR;

  // 1. Aktuellen Code von origin/main holen (fast-forward; lokale Entwürfe
  //    bleiben unangetastet). So zeigt die Vorschau immer den neuesten Stand.
  state.step = 'code-update';
  state.codeUpdate = profile.codeUpdate.enabled
    ? await updateCodeFromRemote(run, log, env)
    : { updated: false, from: '', to: '', files: [] };

  // 2. Bauen.
  state.step = 'build';
  log(`${profile.build.command.join(' ')} (Vorschau) -> ${PREVIEW_DIR}`);

  // Build-Umgebung exakt wie im Deploy (deploy.sh) robust: Telemetrie aus und
  // ein sicher beschreibbares HOME (npm-/Astro-Cache) — das vom Dienst geerbte
  // HOME (z.B. /var/www) ist im systemd-Sandbox nicht beschreibbar. Zusätzlich
  // base + Ausgabeverzeichnis der Vorschau (env siehe oben).
  const [buildCmd, ...buildArgs] = profile.build.command;
  await runStreaming(buildCmd, buildArgs, {
    cwd: config.repoDir,
    env,
    timeoutMs: profile.build.timeoutMinutes * 60 * 1000,
    onLine: (line) => log(line),
  });

  state.status = 'success';
  state.step = 'done';
  state.finishedAt = Date.now();
  log('Vorschau-Build abgeschlossen.');
}
