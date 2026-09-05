// Tests für das Code-Update vor der Vorschau: Entwürfe (Content-Dateien) dürfen
// einen Fast-Forward nicht blockieren und bleiben danach erhalten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateCodeFromRemote, ensureDependencies } from '../server/codeupdate.mjs';

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
async function git(cwd, ...args) {
  return runner(cwd)('git', args, { env: GIT_ENV });
}

async function setupRepos() {
  const base = await mkdtemp(join(tmpdir(), 'kd-git-'));
  const origin = join(base, 'origin.git');
  const work = join(base, 'work');
  const other = join(base, 'other');
  await mkdir(origin);
  await git(origin, 'init', '--bare', '-q', '-b', 'main');
  await git(base, 'clone', '-q', origin, work);
  await mkdir(join(work, 'src/content'), { recursive: true });
  await writeFile(join(work, 'src/content/site.json'), '{"a":1}\n');
  await writeFile(join(work, 'code.txt'), 'v1\n');
  await git(work, 'add', '-A');
  await git(work, 'commit', '-q', '-m', 'init');
  await git(work, 'push', '-q', '-u', 'origin', 'main');
  // Zweiter Klon: ändert Code UND die Content-Datei auf origin.
  await git(base, 'clone', '-q', origin, other);
  await writeFile(join(other, 'code.txt'), 'v2\n');
  await writeFile(join(other, 'src/content/site.json'), '{"a":1,"b":2}\n');
  await git(other, 'add', '-A');
  await git(other, 'commit', '-q', '-m', 'upstream');
  await git(other, 'push', '-q', 'origin', 'main');
  return { work };
}
const profile = (dir) => ({
  repo: { dir, branch: 'main', remote: 'origin' },
  content: { commitPaths: ['src/content/site.json'] },
});

test('Entwurf in Content-Datei blockiert den Fast-Forward nicht und bleibt erhalten', async () => {
  const { work } = await setupRepos();
  // Lokaler Entwurf (vom Designer gespeichert), der mit origin kollidiert.
  await writeFile(join(work, 'src/content/site.json'), '{"a":"entwurf"}\n');
  const logs = [];
  const r = await updateCodeFromRemote(profile(work), runner(work), (l) => logs.push(l), GIT_ENV);
  assert.equal(r.updated, true, logs.join('\n'));
  assert.equal(await readFile(join(work, 'code.txt'), 'utf8'), 'v2\n');
  assert.equal(await readFile(join(work, 'src/content/site.json'), 'utf8'), '{"a":"entwurf"}\n');
  assert.ok(logs.some((l) => /Entwürfe vor dem Code-Update gesichert/.test(l)));
  assert.ok(logs.some((l) => /Entwürfe wiederhergestellt/.test(l)));
});

test('Ohne Entwurf: normaler Fast-Forward, Content-Datei kommt von origin', async () => {
  const { work } = await setupRepos();
  const logs = [];
  const r = await updateCodeFromRemote(profile(work), runner(work), (l) => logs.push(l), GIT_ENV);
  assert.equal(r.updated, true);
  assert.equal(await readFile(join(work, 'src/content/site.json'), 'utf8'), '{"a":1,"b":2}\n');
  assert.ok(!logs.some((l) => /Entwürfe/.test(l)));
});

test('Fremde lokale Änderung außerhalb der Content-Dateien: Update wird übersprungen, Entwurf bleibt', async () => {
  const { work } = await setupRepos();
  await writeFile(join(work, 'code.txt'), 'lokal\n');
  await writeFile(join(work, 'src/content/site.json'), '{"a":"entwurf"}\n');
  const logs = [];
  const r = await updateCodeFromRemote(profile(work), runner(work), (l) => logs.push(l), GIT_ENV);
  assert.equal(r.updated, false);
  assert.ok(r.error);
  assert.equal(await readFile(join(work, 'src/content/site.json'), 'utf8'), '{"a":"entwurf"}\n');
  assert.equal(await readFile(join(work, 'code.txt'), 'utf8'), 'lokal\n');
});

test('ensureDependencies: nichts ohne package.json, npm ci bei fehlendem node_modules', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kd-deps-'));
  const calls = [];
  const fakeRun = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    return 'ok';
  };
  assert.equal(await ensureDependencies({ repo: { dir } }, fakeRun, () => {}, {}), false);
  await writeFile(join(dir, 'package.json'), '{}');
  assert.equal(await ensureDependencies({ repo: { dir } }, fakeRun, () => {}, {}), true);
  assert.deepEqual(calls, ['npm ci --include=dev']);
  await mkdir(join(dir, 'node_modules'), { recursive: true });
  await writeFile(join(dir, 'node_modules/.package-lock.json'), '{}');
  assert.equal(await ensureDependencies({ repo: { dir } }, fakeRun, () => {}, {}), false);
});
