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
  loadActiveProfiles,
  processEnvFor,
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

test('Parallelbetrieb: STATE_DIR / PREVIEW_BASE / PREVIEW_DIR überstimmen das Profil', () => {
  const def = resolveProfile(HOME, {});
  assert.equal(def.stateDir, '/opt/kodini/repo/.kodini-admin');
  const p = resolveProfile(HOME, {
    STATE_DIR: '/opt/kodini/designer-state',
    PREVIEW_BASE: '/designer/preview/',
    PREVIEW_DIR: '/opt/kodini/designer-preview',
  });
  // Gemeinsame Umgebungs-Ordner bekommen je Profil ein Unterverzeichnis.
  assert.equal(p.stateDir, '/opt/kodini/designer-state/kodinitools-home');
  assert.equal(p.preview.base, '/designer/preview/');
  assert.equal(p.preview.outDir, '/opt/kodini/designer-preview/kodinitools-home');
  assert.equal(publicProfileInfo(p).previewBase, '/designer/preview/');
});

test('Seiten-Overrides (REPO_DIR …) gelten nur für das erste Profil', () => {
  const map = loadActiveProfiles({
    PROFILES: 'kodinitools-home,video-cutter',
    REPO_DIR: '/opt/kodini/repo',
    WEBROOT: '/var/www/kodinitools.com',
    UPLOADS_DIR: '/var/www/kodinitools.com/uploads',
    STATE_DIR: '/opt/kodini/designer-state',
    PREVIEW_DIR: '/opt/kodini/designer-preview',
  });
  const home = map.get('kodinitools-home');
  const vc = map.get('video-cutter');
  assert.equal(home.repo.dir, '/opt/kodini/repo');
  assert.equal(vc.repo.dir, '/opt/kodini/sites/video-cutter');
  assert.equal(vc.webroot, '/var/www/kodinitools.com');
  // Dienstbezogene Ordner gelten für beide (je Profil ein Unterordner).
  assert.equal(home.stateDir, '/opt/kodini/designer-state/kodinitools-home');
  assert.equal(vc.stateDir, '/opt/kodini/designer-state/video-cutter');
  assert.equal(vc.preview.outDir, '/opt/kodini/designer-preview/video-cutter');
  // Umgekehrte Reihenfolge: dann bekommt video-cutter die Overrides.
  const rev = loadActiveProfiles({ PROFILES: 'video-cutter,kodinitools-home', REPO_DIR: '/x' });
  assert.equal(rev.get('video-cutter').repo.dir, '/x');
  assert.equal(rev.get('kodinitools-home').repo.dir, '/opt/kodini/repo');
});

test('FONTS_DIR ergänzt die Schriftordner aller Profile (ohne Duplikate)', () => {
  const map = loadActiveProfiles({
    PROFILES: 'kodinitools-home,video-cutter',
    FONTS_DIR: '/var/www/kodinitools.com/fonts, /srv/fonts',
  });
  const home = map.get('kodinitools-home');
  const vc = map.get('video-cutter');
  assert.deepEqual(home.fonts.dirs, [
    '/var/www/kodinitools.com/fonts',
    '/opt/kodini/repo/public/fonts',
    '/srv/fonts',
  ]);
  assert.ok(
    vc.fonts.dirs.includes('/srv/fonts') &&
      vc.fonts.dirs.includes('/var/www/kodinitools.com/fonts'),
  );
  assert.equal(new Set(vc.fonts.dirs).size, vc.fonts.dirs.length);
  assert.equal(loadActiveProfiles({}).get('kodinitools-home').fonts.dirs.length, 2);
});

test('loadActiveProfiles: PROFILES-Liste, Reihenfolge, Duplikate, Fehler', () => {
  const one = loadActiveProfiles({});
  assert.deepEqual([...one.keys()], ['kodinitools-home']);
  const list = loadActiveProfiles({ PROFILES: ' kodinitools-home , ' });
  assert.deepEqual([...list.keys()], ['kodinitools-home']);
  assert.throws(
    () => loadActiveProfiles({ PROFILES: 'kodinitools-home,kodinitools-home' }),
    /doppelt/,
  );
  assert.throws(() => loadActiveProfiles({ PROFILES: ' , ' }), /leer/);
  assert.throws(() => loadActiveProfiles({ PROFILES: 'kodinitools-home,fehlt' }), /nicht lesbar/);
  // PROFILE_FILE hat Vorrang vor PROFILES.
  const file = resolve(PROFILES_DIR, 'kodinitools-home/profile.json');
  assert.deepEqual(
    [...loadActiveProfiles({ PROFILE_FILE: file, PROFILES: 'x' }).keys()],
    ['kodinitools-home'],
  );
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

test('processEnvFor: Profil überstimmt die gemeinsame .env für Build/Deploy', () => {
  const p = resolveProfile(HOME, { REPO_DIR: '/tmp/site', WEBROOT: '/tmp/www' });
  const env = processEnvFor(
    p,
    { ASTRO_BASE: '/x/' },
    {
      WEBROOT: '/var/www/other',
      REPO_DIR: '/opt/other',
      PATH: '/usr/bin',
    },
  );
  assert.equal(env.WEBROOT, '/tmp/www');
  assert.equal(env.REPO_DIR, '/tmp/site');
  assert.equal(env.UPLOADS_DIR, '/tmp/www/uploads');
  assert.equal(env.BRANCH, 'main');
  // devDependencies trotz NODE_ENV=production des Dienstes (Build braucht sie)
  assert.equal(processEnvFor(p, {}, { NODE_ENV: 'production' }).npm_config_include, 'dev');
  assert.equal(env.ASTRO_BASE, '/x/');
  assert.equal(env.PATH, '/usr/bin');
  assert.deepEqual(HOME.deploy.env, {});
});

test('publicProfileInfo enthält keine Server-Pfade', () => {
  const info = publicProfileInfo(resolveProfile(HOME, {}));
  assert.deepEqual(Object.keys(info).sort(), [
    'contentTabs',
    'fields',
    'id',
    'kind',
    'languages',
    'name',
    'previewBase',
    'siteUrl',
    'slots',
    'tabs',
  ]);
  assert.equal(info.contentTabs, true);
  assert.equal(info.fields, null);
  assert.equal(info.slots, null);
  assert.ok(!JSON.stringify(info).includes('/opt/'));
});
