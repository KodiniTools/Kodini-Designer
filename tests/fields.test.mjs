// Tests für den generischen Tab „Felder“ (Manifest-Validierung, Werte, Datei).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadProfileFile,
  profileFile,
  resolveProfile,
  validateProfile,
  publicProfileInfo,
  flatFields,
} from '../server/profile.mjs';
import {
  normalizeFieldValue,
  validateFieldValues,
  loadFields,
  saveFields,
  readPreviewTemplate,
  getPath,
  setPath,
} from '../server/fields.mjs';

const VC = loadProfileFile(profileFile('video-cutter'));

test('video-cutter: Manifest mit Feldern lädt, ohne media-Datei', () => {
  assert.equal(VC.kind, 'vite-spa');
  assert.equal(VC.fields.file, 'site');
  assert.equal(VC.fields.groups.length, 2);
  assert.equal(VC.fields.slots.length, 5);
  assert.deepEqual(VC.fields.langs, ['de', 'en']);
  assert.equal(VC.fields.preview.file, 'preview.html');
  assert.deepEqual(VC.fields.preview.vars['--vc-bg'], {
    path: '',
    light: 'theme.light.bg',
    dark: 'theme.dark.bg',
  });
  // 5 Slots × (2 Texte + 7 Design) + 10 Gruppenfelder
  assert.equal(flatFields(VC.fields).length, 5 * 9 + 10);
  const paths = flatFields(VC.fields).map((f) => f.path);
  assert.ok(paths.includes('texts.de.app.title') && paths.includes('styles.app.title.colorDark'));
  assert.equal(flatFields(VC.fields).find((f) => f.path === 'styles.app.title.font').type, 'font');
  assert.ok(VC.dir.endsWith('/profiles/video-cutter'));
  assert.equal(VC.content.files.media, undefined);
  assert.deepEqual(VC.deploy.env.SKIP_API, '1');
  const info = publicProfileInfo(resolveProfile(VC, {}));
  assert.equal(info.contentTabs, false);
  assert.equal(info.fields.length, 2);
  assert.deepEqual(info.slots, ['app.title', 'app.subtitle', 'drop.title', 'drop.hint', 'footer']);
  assert.equal(
    publicProfileInfo(resolveProfile(loadProfileFile(profileFile('kodinitools-home')), {}))
      .contentTabs,
    true,
  );
});

test('validateProfile: Feld-Manifest wird geprüft', () => {
  const base = JSON.parse(JSON.stringify(VC));
  const withFields = (fields) => validateProfile({ ...base, fields });
  assert.throws(() => withFields({ file: 'nope', groups: [] }), /nicht in content.files/);
  assert.throws(() => withFields({ file: 'site', groups: [] }), /groups oder fields.slots fehlt/);
  // Slots
  const slot = (extra) => ({
    key: 'a.b',
    label: 'A',
    textPath: 'texts.{lang}.a.b',
    stylePath: 'styles.a.b',
    ...extra,
  });
  assert.throws(
    () => withFields({ file: 'site', slots: [slot({ textPath: 'texts.a.b' })] }),
    /\{lang\}/,
  );
  assert.throws(
    () => withFields({ file: 'site', slots: [slot({ type: 'color' })] }),
    /text oder textarea/,
  );
  assert.throws(() => withFields({ file: 'site', slots: [slot({}), slot({})] }), /doppelt/);
  assert.throws(
    () => withFields({ file: 'site', slots: [slot({})], preview: { file: '../x.html' } }),
    /nur Dateiname/,
  );
  assert.throws(
    () =>
      withFields({
        file: 'site',
        slots: [slot({})],
        preview: { file: 'p.html', vars: { color: 'x' } },
      }),
    /keine CSS-Variable/,
  );
  const withSlot = withFields({
    file: 'site',
    slots: [slot({ placeholder: 'Hallo', defaultSize: 18 })],
    preview: { file: 'p.html', vars: { '--x': 'theme.x', '--y': { light: 'l', dark: 'd' } } },
  });
  assert.deepEqual(withSlot.fields.slots[0].placeholder, { de: 'Hallo', en: 'Hallo' });
  assert.equal(withSlot.fields.slots[0].defaultSize, 18);
  assert.equal(withSlot.fields.groups.length, 0);
  assert.deepEqual(withSlot.fields.preview.vars['--x'], { path: 'theme.x', light: '', dark: '' });
  assert.equal(flatFields(withSlot.fields).length, 9);
  assert.throws(
    () =>
      withFields({ file: 'site', groups: [{ title: 'x', fields: [{ path: 'a b', label: 'A' }] }] }),
    /path „a b“ ungültig/,
  );
  assert.throws(
    () =>
      withFields({
        file: 'site',
        groups: [
          {
            title: 'x',
            fields: [
              { path: 'a', label: 'A' },
              { path: 'a', label: 'B' },
            ],
          },
        ],
      }),
    /doppelt/,
  );
  assert.throws(
    () =>
      withFields({
        file: 'site',
        groups: [{ title: 'x', fields: [{ path: 'a', label: 'A', type: 'date' }] }],
      }),
    /type „date“/,
  );
  assert.throws(
    () =>
      withFields({
        file: 'site',
        groups: [{ title: 'x', fields: [{ path: 'a', label: 'A', type: 'select' }] }],
      }),
    /options/,
  );
  const ok = withFields({
    file: 'site',
    groups: [
      {
        title: 'x',
        fields: [
          { path: 'n', label: 'N', type: 'number', min: 1, max: 5 },
          { path: 't', label: 'T' },
        ],
      },
    ],
  });
  assert.equal(ok.fields.groups[0].fields[0].step, 1);
  assert.equal(ok.fields.groups[0].fields[1].type, 'text');
  assert.equal(ok.fields.groups[0].fields[1].maxLength, 300);
  // Ohne media-Datei und ohne fields -> Fehler
  const noFields = { ...base };
  delete noFields.fields;
  assert.throws(() => validateProfile(noFields), /content.files.media fehlt/);
});

test('normalizeFieldValue: Typen, Grenzen, leer = Standard', () => {
  const f = (type, extra = {}) => ({
    path: 'x',
    label: 'X',
    type,
    maxLength: 5,
    min: 0,
    max: 10,
    options: ['a', 'b'],
    ...extra,
  });
  assert.equal(normalizeFieldValue(f('text'), ' '), '');
  assert.equal(normalizeFieldValue(f('text'), 'abc'), 'abc');
  assert.throws(() => normalizeFieldValue(f('text'), 'abcdef'), /zu lang/);
  assert.throws(() => normalizeFieldValue(f('text'), 'a\nb'), /mehrzeilig/);
  assert.equal(normalizeFieldValue(f('textarea'), 'a\nb'), 'a\nb');
  assert.equal(normalizeFieldValue(f('color'), '#ABCDEF'), '#abcdef');
  assert.equal(normalizeFieldValue(f('color'), '#abc'), '#abc');
  assert.throws(() => normalizeFieldValue(f('color'), 'rot'), /Hex/);
  assert.equal(normalizeFieldValue(f('number'), '7'), 7);
  assert.equal(normalizeFieldValue(f('number'), '1.5'), 1.5);
  assert.equal(normalizeFieldValue(f('font'), 'Supreme-Bold.woff2'), 'Supreme-Bold.woff2');
  assert.throws(() => normalizeFieldValue(f('font'), '../x.woff2'), /Schriftdatei/);
  assert.throws(() => normalizeFieldValue(f('number'), '11'), /zwischen/);
  assert.equal(normalizeFieldValue(f('select'), 'a'), 'a');
  assert.throws(() => normalizeFieldValue(f('select'), 'c'), /unbekannte Auswahl/);
  assert.equal(normalizeFieldValue(f('toggle'), 'true'), true);
  assert.equal(normalizeFieldValue(f('toggle'), ''), false);
});

test('getPath/setPath', () => {
  const o = { a: { b: 1 } };
  assert.equal(getPath(o, 'a.b'), 1);
  assert.equal(getPath(o, 'a.c.d'), undefined);
  setPath(o, 'a.c.d', 'x');
  assert.equal(o.a.c.d, 'x');
});

test('saveFields/loadFields: nur Manifest-Pfade, übrige Schlüssel bleiben', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kd-fields-'));
  const file = join(dir, 'site.json');
  await writeFile(
    file,
    JSON.stringify({ meta: { title: 'alt', extra: 'bleibt' }, other: { keep: true } }),
    'utf8',
  );
  const p = resolveProfile(VC, { REPO_DIR: dir });
  p.content.files.site = file;
  const before = await loadFields(p);
  assert.equal(before['meta.title'], 'alt');
  assert.equal(before['theme.accent'], '');
  const after = await saveFields(p, {
    'meta.title': 'Neu',
    'theme.accent': '#FF0000',
    'texts.de.app.title': 'Titel',
    'styles.app.title.size': '24',
    'styles.app.title.font': 'Supreme-Bold.woff2',
    'nicht.im.manifest': 'x',
  });
  assert.equal(after['meta.title'], 'Neu');
  assert.equal(after['theme.accent'], '#ff0000');
  assert.equal(after['styles.app.title.size'], '24');
  const data = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(data.meta.extra, 'bleibt');
  assert.equal(data.other.keep, true);
  assert.equal(data.texts.de.app.title, 'Titel');
  assert.strictEqual(data.styles.app.title.size, 24); // als Zahl gespeichert
  assert.equal(data.styles.app.title.font, 'Supreme-Bold.woff2');
  assert.equal(getPath(data, 'nicht.im.manifest'), undefined);
  await assert.rejects(() => saveFields(p, { 'theme.accent': 'rot' }), /Hex/);
  assert.throws(() => validateFieldValues(p, 'x'), /Ungültige Werte/);
});

test('readPreviewTemplate liefert die Vorlage aus dem Profilordner', async () => {
  const html = await readPreviewTemplate(resolveProfile(VC, {}));
  assert.ok(html.includes('data-slot="app.title"') && html.includes('.kdp'));
  const none = { ...resolveProfile(VC, {}), fields: { ...VC.fields, preview: null } };
  assert.equal(await readPreviewTemplate(none), '');
});
