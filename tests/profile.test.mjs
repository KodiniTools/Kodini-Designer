// Tests für das Site-Profil (Laden, Validierung, Auflösung, Umgebungs-Overrides).
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  loadProfileFile,
  profileFile,
  resolveProfile,
  validateProfile,
  loadActiveProfile,
  publicProfileInfo,
  PROFILES_DIR,
} from '../server/profile.mjs';

const HOME = loadProfileFile(profileFile('kodinitools-home'));

test('kodinitools-home: Manifest lädt und ist vollständig', () => {
  assert.equal(HOME.id, 'kodinitools-home');
  assert.equal(HOME.kind, 'astro-site');
  assert.deepEqual(HOME.languages, ['de', 'en']);
  assert.equal(HOME.repo.dir, '/opt/kodini/repo');
  assert.equal(HOME.content.files.media, 'media.json');
  assert.deepEqual(HOME.build.command, ['npm', 'run', 'build']);
  assert.deepEqual(HOME.deploy.command, ['./deploy.sh']);
  assert.equal(HOME.preview.env.base, 'ASTRO_BASE');
  assert.equal(HOME.uploads.gitMaxBytes, 25 * 1024 * 1024);
  assert.ok(HOME.content.commitPaths.includes('src/content/media.json'));
});

test('Auflösung: Platzhalter und relative Pfade werden absolut (Server-Defaults)', () => {
  const p = resolveProfile(HOME, {});
  assert.equal(p.repo.dir, '/opt/kodini/repo');
  assert.equal(p.webroot, '/var/www/kodinitools.com');
  assert.equal(p.content.dir, '/opt/kodini/repo/src/content');
  assert.equal(p.content.files.media, '/opt/kodini/repo/src/content/media.json');
  assert.equal(p.content.files.overridesDe, '/opt/kodini/repo/src/content/overrides.de.json');
  assert.equal(p.content.locales.en, '/opt/kodini/repo/src/locales/en.json');
  assert.equal(p.uploads.dir, '/var/www/kodinitools.com/uploads');
  assert.equal(p.uploads.repoDir, '/opt/kodini/repo/public/uploads');
  assert.deepEqual(p.fonts.dirs, [
    '/var/www/kodinitools.com/fonts',
    '/opt/kodini/repo/public/fonts',
  ]);
  assert.equal(p.preview.outDir, '/opt/kodini/repo/dist-preview');
  assert.equal(p.preview.base, '/admin/preview/');
});

test('Umgebung überstimmt das Manifest (bestehende .env bleibt gültig)', () => {
  const p = resolveProfile(HOME, {
    REPO_DIR: '/tmp/site',
    WEBROOT: '/tmp/www',
    UPLOADS_DIR: '/tmp/up',
    GIT_BRANCH: 'dev',
    GIT_REMOTE: 'upstream',
  });
  assert.equal(p.repo.dir, '/tmp/site');
  assert.equal(p.repo.branch, 'dev');
  assert.equal(p.repo.remote, 'upstream');
  assert.equal(p.content.files.media, '/tmp/site/src/content/media.json');
  assert.equal(p.uploads.dir, '/tmp/up');
  assert.equal(p.uploads.repoDir, '/tmp/site/public/uploads');
  assert.deepEqual(p.fonts.dirs, ['/tmp/www/fonts', '/tmp/site/public/fonts']);
  assert.equal(p.preview.outDir, '/tmp/site/dist-preview');
});

test('loadActiveProfile: PROFILE / PROFILE_FILE / Default', () => {
  assert.equal(loadActiveProfile({}).id, 'kodinitools-home');
  assert.equal(loadActiveProfile({ PROFILE: 'kodinitools-home' }).id, 'kodinitools-home');
  const file = resolve(PROFILES_DIR, 'kodinitools-home/profile.json');
  assert.equal(loadActiveProfile({ PROFILE_FILE: file }).id, 'kodinitools-home');
  assert.throws(() => loadActiveProfile({ PROFILE: 'gibt-es-nicht' }), /nicht lesbar/);
  assert.throws(() => loadActiveProfile({ PROFILE: '../x' }), /Kennung/);
});

test('Validierung lehnt unvollständige oder falsche Manifeste ab', () => {
  const base = JSON.parse(JSON.stringify(HOME));
  assert.doesNotThrow(() => validateProfile(base));
  const without = (k) => {
    const c = JSON.parse(JSON.stringify(base));
    delete c[k];
    return c;
  };
  assert.throws(() => validateProfile(without('repo')), /repo fehlt/);
  assert.throws(() => validateProfile(without('build')), /build fehlt/);
  assert.throws(() => validateProfile({ ...base, id: 'Groß' }), /id/);
  assert.throws(() => validateProfile({ ...base, kind: 'wordpress' }), /kind/);
  assert.throws(() => validateProfile({ ...base, languages: [] }), /languages/);
  assert.throws(() => validateProfile({ ...base, build: { command: [] } }), /build.command/);
  assert.throws(
    () => validateProfile({ ...base, content: { ...base.content, files: { foo: 'x.json' } } }),
    /content.files.media/,
  );
  // Defaults
  const min = validateProfile({
    ...base,
    preview: undefined,
    fonts: undefined,
    uploads: { dir: '/u' },
  });
  assert.equal(min.preview.base, '/admin/preview/');
  assert.equal(min.uploads.urlPrefix, '/uploads');
  assert.equal(min.repo.branch, 'main');
});

test('publicProfileInfo enthält keine Server-Pfade', () => {
  const info = publicProfileInfo(resolveProfile(HOME, {}));
  assert.deepEqual(Object.keys(info).sort(), [
    'id',
    'kind',
    'languages',
    'name',
    'siteUrl',
    'tabs',
  ]);
  assert.ok(!JSON.stringify(info).includes('/opt/'));
});
