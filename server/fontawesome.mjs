// Auflistung der auf dem Server verfügbaren Icon-SVGs für den „Icons"-Tab.
// Gelesen wird aus dem Webroot (/var/www/kodinitools.com/public/fontawesome/… —
// die tatsächlich ausgelieferten Dateien) und zusätzlich aus public/fontawesome
// im Repo (git-gesichert, Fallback für die lokale Entwicklung).
//
// Sets:
//   solid/regular/brands -> Font-Awesome unter svgs/<set>, URL /fontawesome/svgs/<set>/<datei>
//   admin                -> eigener Ordner admin-svgs,       URL /fontawesome/admin-svgs/<datei>
// Rückgabe: nur Dateinamen je Set; Label und URL baut der Client (kleine Nutzlast).

import { readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

// Icon-Sets mit ihrem Ordner unterhalb von fontawesome/. `key` = Set-Schlüssel.
export const ICON_SETS = [
  { key: 'solid', dir: 'svgs/solid' },
  { key: 'regular', dir: 'svgs/regular' },
  { key: 'brands', dir: 'svgs/brands' },
  { key: 'admin', dir: 'admin-svgs' },
];

/** Nur einfache SVG-Dateinamen (kein Pfad/Traversal, keine versteckten Dateien). */
export function isValidIconFile(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name === basename(name) &&
    !name.startsWith('.') &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.svg$/i.test(name)
  );
}

async function readIconDir(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  return names.filter(isValidIconFile);
}

/**
 * Verfügbare Icons je Set (nach Dateiname vereinigt, alphabetisch sortiert).
 * Webroot hat Vorrang; public/fontawesome füllt in der Entwicklung auf.
 * Rückgabe: { solid: string[], regular: string[], brands: string[], admin: string[] }.
 */
export async function listFontAwesome(p) {
  // Mehrere mögliche Basis-Orte (je nach nginx-Root/Deploy): direkt im Webroot,
  // unter public/ oder im Repo (Dev). Fehlende Pfade werden ignoriert, gefunden
  // wird vereinigt – so ist die Auflistung unabhängig vom konkreten Layout.
  const bases = p.fontawesome.dirs;
  const out = {};
  for (const set of ICON_SETS) {
    const seen = new Set();
    for (const base of bases) {
      for (const name of await readIconDir(resolve(base, set.dir))) seen.add(name);
    }
    out[set.key] = [...seen].sort((a, b) => a.localeCompare(b));
  }
  return out;
}
