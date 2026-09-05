// Tests für die Veröffentlichung: lokale Commits, deren Push in einem früheren
// Lauf scheiterte, müssen beim nächsten Lauf mit gepusht werden – sonst setzt
// deploy.sh das Repo hart auf den Remote-Stand zurück und die Änderungen sind weg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPublish, getPublishState } from '../server/publish.mjs';

function runner(cwd) {
  return (cmd, args, opts = {}) =>
    new Promise((res, rej) => {
      execFile(cmd, args, { cwd, ...opts }, (err, stdout, stderr) => {
        const out = `${stdout || ''}${stderr || ''}`.trim();
        if (err) rej(Object.assign(err, { output: out }));
        else res(out);
      });
    });
}
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
};
const git = (cwd, ...args) => runner(cwd)('git', args, { env: GIT_ENV });

async function setupRepos() {
  const base = await mkdtemp(join(tmpdir(), 'kd-pub-'));
  const origin = join(base, 'origin.git');
  const work = join(base, 'work');
  await mkdir(origin);
  await git(origin, 'init', '--bare', '-q', '-b', 'main');
  await git(base, 'clone', '-q', origin, work);
  await mkdir(join(work, 'src/content'), { recursive: true });
  await writeFile(join(work, 'src/content/site.json'), '{"a":1}\n');
  await git(work, 'add', '-A');
  await git(work, 'commit', '-q', '-m', 'init');
  await git(work, 'push', '-q', '-u', 'origin', 'main');
  return { base, work, origin };
}
let n = 0;
const profile = (base, work) => ({
  id: `pub-test-${++n}`,
  repo: { dir: work, branch: 'main', remote: 'origin' },
  webroot: join(base, 'www'),
  content: { dir: 'src/content', files: {}, locales: {}, commitPaths: ['src/content/site.json'] },
  uploads: { dir: join(base, 'www/uploads'), repoDir: '', urlPrefix: '/uploads', gitMaxBytes: 1 },
  build: { command: ['true'], env: {}, timeoutMinutes: 1 },
  preview: { base: '/preview/', outDir: 'dist', env: {} },
  deploy: { command: ['true'], env: {}, timeoutMinutes: 1 },
  codeUpdate: { enabled: false },
  stateDir: join(base, 'state'),
});
async function publishAndWait(p) {
  assert.equal(startPublish(p).ok, true);
  for (let i = 0; i < 200; i++) {
    const s = getPublishState(p);
    if (s.status !== 'running') return s;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Veröffentlichung hängt');
}

test('Veröffentlichen: nicht gepushter lokaler Commit wird nachgeschoben', async () => {
  const { base, work, origin } = await setupRepos();
  // Früherer Lauf: Commit gelang, Push scheiterte (z. B. Deploy-Key ohne Schreibrecht).
  await writeFile(join(work, 'src/content/site.json'), '{"a":2}\n');
  await git(work, 'commit', '-q', '-am', 'content: update via admin');
  const local = (await git(work, 'rev-parse', 'HEAD')).trim();
  assert.notEqual((await git(origin, 'rev-parse', 'main')).trim(), local);

  const s = await publishAndWait(profile(base, work));
  assert.equal(s.status, 'success', s.error || s.log.join('\n'));
  assert.equal((await git(origin, 'rev-parse', 'main')).trim(), local);
  assert.ok(s.log.some((l) => /noch nicht auf origin\/main/.test(l)));
  assert.ok(!s.log.some((l) => /Keine Content-Änderungen/.test(l)));
});

test('Veröffentlichen: ohne Änderungen und ohne lokale Commits nur Deploy', async () => {
  const { base, work, origin } = await setupRepos();
  const before = (await git(origin, 'rev-parse', 'main')).trim();
  const s = await publishAndWait(profile(base, work));
  assert.equal(s.status, 'success', s.error || s.log.join('\n'));
  assert.ok(s.log.some((l) => /Keine Content-Änderungen/.test(l)));
  assert.equal((await git(origin, 'rev-parse', 'main')).trim(), before);
});

test('Veröffentlichen: Entwurf wird committet, auf Remote aufgesetzt und gepusht', async () => {
  const { base, work, origin } = await setupRepos();
  // Remote eilt voraus (gemergter PR mit anderer Datei).
  const other = join(base, 'other');
  await git(base, 'clone', '-q', origin, other);
  await writeFile(join(other, 'code.txt'), 'v2\n');
  await git(other, 'add', '-A');
  await git(other, 'commit', '-q', '-m', 'upstream');
  await git(other, 'push', '-q', 'origin', 'main');
  await writeFile(join(work, 'src/content/site.json'), '{"a":3}\n');

  const s = await publishAndWait(profile(base, work));
  assert.equal(s.status, 'success', s.error || s.log.join('\n'));
  const head = (await git(origin, 'rev-parse', 'main')).trim();
  assert.equal((await git(work, 'rev-parse', 'HEAD')).trim(), head);
  assert.equal(await git(work, 'show', 'origin/main:src/content/site.json'), '{"a":3}');
  assert.equal(await git(work, 'show', 'origin/main:code.txt'), 'v2');
  assert.equal(s.commit, head.slice(0, 7));
});
