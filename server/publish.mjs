// Veröffentlichen: Content-Dateien nach 'main' committen + pushen und
// anschließend das Deploy-Skript des Profils ausführen. Je Profil ein eigener Job. Läuft asynchron; der Status wird im
// Speicher gehalten und per Polling abgefragt.

import { execFile } from 'node:child_process';
import { readFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { config, contentPaths } from './config.mjs';
import { processEnvFor } from './profile.mjs';
import { restartIfServerCodeChanged, persistState, restoreState } from './codeupdate.mjs';
import { runStreaming } from './util.mjs';

function initialState() {
  return {
    status: 'idle', // idle | running | success | error
    step: '',
    log: [],
    startedAt: null,
    finishedAt: null,
    commit: null,
    error: null,
    restarting: false, // Dienst startet nach diesem Vorgang neu (neuer Server-Code)
    restarted: false, // Status stammt aus der Zeit vor einem Selbst-Neustart (wiederhergestellt)
  };
}
// Ein Veröffentlichungs-Job je Profil: eigener Status, Log und Repo.
function createPublishJob(p) {
  // Letzten Stand wiederherstellen (überlebt den Selbst-Neustart des Dienstes).
  let state = restoreState(p, 'publish', initialState());

  /**
   * Nachsicherung: In media.json referenzierte /uploads-Dateien, die nur im
   * Webroot liegen (z.B. vor Einführung der Git-Sicherung hochgeladen), ins
   * Repo (public/uploads) kopieren, damit sie beim Commit mit gesichert werden.
   */
  async function backfillReferencedUploads() {
    let media;
    try {
      media = JSON.parse(await readFile(contentPaths(p).media, 'utf8'));
    } catch {
      return;
    }
    const urls = new Set();
    const collect = (m) => {
      if (!m || typeof m !== 'object') return;
      if (typeof m.heroBanner === 'string') urls.add(m.heroBanner);
      if (Array.isArray(m.heroGrid))
        for (const v of m.heroGrid) if (typeof v === 'string') urls.add(v);
      if (m.sectionVideos && typeof m.sectionVideos === 'object') {
        for (const v of Object.values(m.sectionVideos)) if (typeof v === 'string') urls.add(v);
      }
    };
    collect(media.de);
    collect(media.en);
    collect(media); // alte, sprachunabhängige Struktur
    const repoUploads = p.uploads.repoDir;
    if (!repoUploads) return;
    for (const url of urls) {
      const prefix = p.uploads.urlPrefix.replace(/\/$/, '') + '/';
      if (!url.startsWith(prefix)) continue;
      const rel = url.slice(prefix.length);
      // erlaubte relative Pfade: "datei" oder "de/datei" / "en/datei"
      if (!/^((de|en)\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(rel)) continue;
      const dst = resolve(repoUploads, rel);
      try {
        await stat(dst);
        continue; // schon im Repo
      } catch {
        /* fehlt -> kopieren */
      }
      try {
        const src = resolve(p.uploads.dir, rel);
        const s = await stat(src);
        if (s.isFile() && s.size <= p.uploads.gitMaxBytes) {
          await mkdir(dirname(dst), { recursive: true });
          await copyFile(src, dst);
          log(`Upload nachgesichert: ${rel}`);
        }
      } catch {
        /* Quelle fehlt -> nichts zu tun */
      }
    }
  }

  function run(cmd, args, opts = {}) {
    return new Promise((resolvePromise, reject) => {
      execFile(
        cmd,
        args,
        { cwd: p.repo.dir, maxBuffer: 10 * 1024 * 1024, ...opts },
        (err, stdout, stderr) => {
          const out = `${stdout || ''}${stderr || ''}`.trim();
          if (err) {
            reject(Object.assign(err, { output: out }));
          } else {
            resolvePromise(out);
          }
        },
      );
    });
  }

  function log(line) {
    state.log.push(`[${new Date().toISOString()}] ${line}`);
    if (state.log.length > 500) state.log.shift();
  }

  /**
   * Startet die Veröffentlichung (idempotent: verweigert, wenn bereits läuft).
   * @param {string} message Commit-Nachricht (optional)
   */
  function start(message) {
    if (state.status === 'running') {
      return { ok: false, reason: 'Es läuft bereits eine Veröffentlichung.' };
    }
    state = { ...initialState(), status: 'running', step: 'start', startedAt: Date.now() };
    // Nicht awaiten — im Hintergrund laufen lassen.
    doPublish(message)
      .catch((err) => {
        state.status = 'error';
        state.error = err?.message || String(err);
        if (err?.output) log(err.output);
        state.finishedAt = Date.now();
      })
      .then(finish);
    return { ok: true };
  }

  // Abschluss: Status sichern; hat deploy.sh neuen Server-Code geholt
  // (git reset auf origin/main), startet der Dienst unter systemd neu.
  async function finish() {
    state.restarting = await restartIfServerCodeChanged(log);
    await persistState(p, 'publish', state);
  }

  async function doPublish(message) {
    const branch = p.repo.branch;
    const remote = p.repo.remote;
    const commitMsg = `content: update via admin${message ? ` – ${message}` : ''}`;

    // 1. Content-Dateien + hochgeladene Medien (public/uploads) stagen.
    state.step = 'git-add';
    await backfillReferencedUploads();
    log(
      `git add ${p.content.commitPaths.join(' ')}${p.uploads.repoDir ? ` + ${p.uploads.repoDir}` : ''}`,
    );
    await run('git', ['add', '--', ...p.content.commitPaths]);
    // -A erfasst neue UND gelöschte Upload-Dateien, damit im Admin gelöschte
    // Medien nicht beim nächsten Deploy aus Git zurückkehren. public/uploads
    // enthält nur Dateien bis zur Größengrenze (siehe saveUpload), daher fügt -A
    // keine großen Dateien hinzu.
    if (p.uploads.repoDir) await run('git', ['add', '-A', '--', p.uploads.repoDir]);

    // 2. Gibt es überhaupt Änderungen?
    const staged = await run('git', ['diff', '--cached', '--name-only']);
    if (!staged) {
      state.step = 'nochange';
      log(
        'Keine Content-Änderungen zu committen — überspringe Commit/Push, führe trotzdem Deploy aus.',
      );
    } else {
      // Commit-Identität explizit setzen, damit kein globales git user.name/email
      // auf dem Server nötig ist (Dienst läuft als www-data ohne git-Identität).
      // Wird auch beim Rebase gebraucht (setzt die Commits neu).
      const ident = [
        '-c',
        `user.name=${config.gitAuthorName}`,
        '-c',
        `user.email=${config.gitAuthorEmail}`,
      ];

      state.step = 'commit';
      log(`git commit: ${commitMsg}`);
      await run('git', [...ident, 'commit', '-m', commitMsg]);
      state.commit = (await run('git', ['rev-parse', '--short', 'HEAD'])).trim();

      // Remote-Stand holen und den Content-Commit darauf aufsetzen. Nötig, weil
      // main z.B. durch gemergte Pull-Requests vorausgeeilt sein kann; sonst wird
      // der Push als non-fast-forward abgelehnt ("Updates were rejected … fetch first").
      state.step = 'sync';
      log(`git fetch ${remote} ${branch}`);
      await run('git', ['fetch', remote, branch]);
      log(`git rebase ${remote}/${branch}`);
      try {
        await run('git', [...ident, 'rebase', `${remote}/${branch}`]);
      } catch (e) {
        // Rebase-Zustand sauber verlassen, damit der nächste Versuch nicht hängt.
        await run('git', ['rebase', '--abort']).catch(() => {});
        throw new Error(
          `Rebase auf ${remote}/${branch} fehlgeschlagen (vermutlich ein Konflikt in den ` +
            `Content-Dateien). Bitte einmalig auf dem Server auflösen. ${e.output || e.message || ''}`,
          { cause: e },
        );
      }
      state.commit = (await run('git', ['rev-parse', '--short', 'HEAD'])).trim();

      state.step = 'push';
      log(`git push ${remote} ${branch}`);
      await run('git', ['push', remote, `HEAD:${branch}`]);
    }

    // 3. Deploy ausführen.
    // Ausgabe von deploy.sh live ins Log (git reset / npm ci / build / rsync
    // dauern zusammen 1–5 min); nach 20 min Abbruch statt endlosem „läuft…".
    state.step = 'deploy';
    const [deployCmd, ...deployArgs] = p.deploy.command;
    log(`${p.deploy.command.join(' ')} (Ausgabe live)`);
    const deployScript = deployCmd.startsWith('./') ? resolve(p.repo.dir, deployCmd) : deployCmd;
    // Umgebung des Profils (WEBROOT/REPO_DIR/BRANCH …), nicht die gemeinsame .env.
    await runStreaming(deployScript, deployArgs, {
      cwd: p.repo.dir,
      env: processEnvFor(p, p.deploy.env),
      timeoutMs: p.deploy.timeoutMinutes * 60 * 1000,
      onLine: (line) => log(line),
    });

    state.status = 'success';
    state.step = 'done';
    state.finishedAt = Date.now();
    log('Veröffentlichung abgeschlossen.');
  }

  return {
    get state() {
      return state;
    },
    start,
  };
}

const jobs = new Map();
function job(p) {
  let j = jobs.get(p.id);
  if (!j) {
    j = createPublishJob(p);
    jobs.set(p.id, j);
  }
  return j;
}

export function getPublishState(p) {
  return job(p).state;
}

/**
 * Startet die Veröffentlichung des Profils (idempotent: verweigert, wenn bereits läuft).
 * @param {object} p Site-Profil
 * @param {string} message Commit-Nachricht (optional)
 */
export function startPublish(p, message) {
  return job(p).start(message);
}
