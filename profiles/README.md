# Site-Profile

Ein Profil beschreibt, **welche Website** der Designer bearbeitet. Der Code des
Designers ist seitenunabhängig; alles Seitenspezifische steht im Manifest
`profiles/<id>/profile.json`. Auswahl über `PROFILES=<id1>,<id2>` (Umschalter in
der Kopfzeile, das erste ist Standard), `PROFILE=<id>` oder
`PROFILE_FILE=/pfad/profile.json`. Validierung: `server/profile.mjs`, Schema
für Editoren: `profile.schema.json`.

Platzhalter in Pfaden: `{repo}` = Repo-Verzeichnis, `{webroot}` = Webroot.
Relative Pfade beziehen sich auf das Repo. Die Umgebungsvariablen `REPO_DIR`,
`WEBROOT`, `UPLOADS_DIR`, `GIT_BRANCH`, `GIT_REMOTE` überstimmen das Manifest des
**ersten** Profils in `PROFILES` (so bleibt die gemeinsame `.env` von
`kodini-admin` gültig); weitere Profile nutzen ausschließlich ihr Manifest.
`STATE_DIR`, `PREVIEW_BASE`, `PREVIEW_DIR` gelten dienstweit für alle Profile
(je Profil ein Unterordner).

| Feld                                        | Bedeutung                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `name`, `kind`                        | Kennung (a-z, 0-9, -), Anzeigename, Site-Typ (`astro-site`, `vite-spa`, `static`)                                                                                                                                                                                                                                                                                                                                          |
| `siteUrl`, `languages`                      | Öffentliche URL (Info), bearbeitete Sprachen                                                                                                                                                                                                                                                                                                                                                                               |
| `repo.dir/branch/remote`                    | Website-Klon auf dem Server, Zielbranch für Veröffentlichungen                                                                                                                                                                                                                                                                                                                                                             |
| `webroot`                                   | nginx-Webroot (Ziel von `deploy.sh`; Basis für Uploads/Fonts)                                                                                                                                                                                                                                                                                                                                                              |
| `content.dir`, `content.files`              | Content-Ordner und die editierbaren JSON-Dateien (`media` ist Pflicht; heutige Tabs erwarten zusätzlich `overridesDe/En`, `tickerDe/En`)                                                                                                                                                                                                                                                                                   |
| `content.locales`                           | Standard-Texte je Sprache (nur lesend, Fallback für leere Overrides)                                                                                                                                                                                                                                                                                                                                                       |
| `content.commitPaths`                       | Was beim Veröffentlichen mit `git add` erfasst wird                                                                                                                                                                                                                                                                                                                                                                        |
| `uploads.dir/repoDir/urlPrefix/gitMaxBytes` | Upload-Ziel im Webroot, optionale Git-Kopie im Repo, öffentlicher URL-Präfix, Größengrenze für die Git-Kopie                                                                                                                                                                                                                                                                                                               |
| `fonts.dirs/urlPrefix`, `fontawesome.dirs`  | Wo Schriften/Icons gesucht werden (erster Treffer je Dateiname gewinnt)                                                                                                                                                                                                                                                                                                                                                    |
| `build.command/env/timeoutMinutes`          | Build für die Vorschau (im Repo ausgeführt)                                                                                                                                                                                                                                                                                                                                                                                |
| `preview.base/outDir/env`                   | Öffentlicher Pfad + Ausgabeordner der Vorschau; `env.base`/`env.outDir` = Namen der Umgebungsvariablen, über die der Build diese Werte bekommt                                                                                                                                                                                                                                                                             |
| `deploy.command/env/timeoutMinutes`         | Deploy nach dem Push (`./…` = relativ zum Repo); Build und Deploy bekommen `REPO_DIR`, `WEBROOT`, `UPLOADS_DIR`, `BRANCH` des Profils in die Umgebung                                                                                                                                                                                                                                                                      |
| `codeUpdate.enabled`                        | Vor der Vorschau `origin/<branch>` per fast-forward holen                                                                                                                                                                                                                                                                                                                                                                  |
| `stateDir`                                  | Ordner für den persistierten Vorgangs-Status (Default `{repo}/.kodini-admin`)                                                                                                                                                                                                                                                                                                                                              |
| `fields`                                    | Generischer Tab „Felder“ für Websites ohne Home-Vertrag: `file` (Schlüssel in `content.files`) + `groups[]` mit `fields[]` (`path`, `label`, `type` text/textarea/color/number/select/toggle, `placeholder` = Standardwert, `hint`, `maxLength`, `min`/`max`/`step`/`unit`, `options`). Leerer Wert = Standard der Website. Mit `fields` ist `content.files.media` optional; das Frontend zeigt dann nur den Tab „Felder“. |
| `tabs`                                      | Reihenfolge/Auswahl der Tabs (heute informativ; das Frontend rendert noch feste Tabs)                                                                                                                                                                                                                                                                                                                                      |

## Generischer Tab „Felder“ (`fields`)

Für Websites ohne Home-Vertrag (Tool-Apps). Der Tab wird komplett aus dem
Manifest gerendert, die Werte liegen in der Datei `fields.file` (Schlüssel aus
`content.files`). Leerer Wert = Standard der Website.

| Feld                  | Bedeutung                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields.file`         | Schlüssel der JSON-Datei in `content.files`                                                                                                                                                                                                                                                                   |
| `fields.langs`        | Sprachen der Text-Slots (Default `languages`)                                                                                                                                                                                                                                                                 |
| `fields.slots[]`      | Text-Slots: `key`, `label`, `type` (`text`/`textarea`), `textPath` mit `{lang}`, `stylePath`, `placeholder` (String oder je Sprache), `maxLength`, `defaultSize` (px, nur Anzeige). Je Slot entstehen Text je Sprache und Design-Felder `<stylePath>.font/size/weight/spacing/transform/colorLight/colorDark` |
| `fields.groups[]`     | Einfache Felder: `title` + `fields[]` mit `path`, `label`, `type` (`text`, `textarea`, `color`, `number`, `select`, `toggle`, `font`), `placeholder`, `hint`, `min/max/step/unit`, `options`, `maxLength`                                                                                                     |
| `fields.preview.file` | HTML-Vorlage im Profilordner für die sticky Live-Vorschau; `[data-slot="<key>"]`-Elemente werden mit Text und Design gefüllt, `data-theme` (light/dark) wird auf den Wurzelknoten gesetzt. Selektoren mit eigener Klasse eingrenzen                                                                           |
| `fields.preview.vars` | CSS-Variable → Feldpfad (`"--x": "theme.x"` oder `{ "light": …, "dark": … }`); Standard = `placeholder` des Feldes                                                                                                                                                                                            |

Beispiel: `profiles/video-cutter/` (Manifest + `preview.html`). Die Website liest
die Datei beim Build (Video-Cutter: `src/content/site.ts`, Slot-Design über
`[data-slot]` und `@font-face` aus `/fonts/`).

## Profil `kodinitools-home`

Erstes Profil, entspricht exakt dem bisherigen Verhalten des in
`Kodinitools-Home/server/admin` eingebetteten Admin-Dienstes (Astro-Site,
`src/content/*.json`, `public/uploads`, `deploy.sh`, Vorschau via
`ASTRO_BASE`/`ASTRO_OUT_DIR`).

## Neues Profil anlegen (z. B. ein Tool-Repo)

1. Ordner `profiles/<id>/` mit `profile.json` (Vorlage: `kodinitools-home`).
2. Im Ziel-Repo: Content-Dateien, die der Build liest (mindestens `media`-Datei),
   ein Build-Befehl, der `preview.env.*` respektiert, und ein Deploy-Skript.
3. Server: Repo auschecken, Pfad in `ReadWritePaths` der systemd-Unit ergänzen,
   `PROFILE=<id>` setzen, Dienst neu starten.

## Profil `video-cutter` (Tool-App, Tab „Felder“)

Erstes Profil ohne Home-Vertrag: Video-Cutter (Vue/Vite) liest
`src/content/site.json` (Texte je Sprache, Titel/Meta, Farben). Das Manifest
beschreibt diese Datei unter `fields`; der Designer zeigt dafür nur den Tab
„Felder“. Vorschau über `VITE_BASE`/`VITE_OUT_DIR`, Deploy über
`bash deploy/deploy.sh` mit `SKIP_API=1`, `BASE_PATH`, `WEB_ROOT` (deploy.env).

## Anderes Tool anbinden (Muster Video-Cutter)

1. Im Tool-Repo eine JSON-Datei anlegen, die der Build liest (leer = Standard),
   und die Werte beim Start anwenden (Texte in die i18n-Messages mergen, Farben
   als CSS-Variablen setzen, Titel/Meta per Build-Plugin in die index.html).
2. Build muss Basis-Pfad und Ausgabeordner per Umgebungsvariable annehmen
   (Vorschau), das Deploy-Skript ohne sudo auskommen.
3. Profil mit `kind: vite-spa`, `content.files.<key>`, `commitPaths`, `fields`,
   `build`/`preview`/`deploy` anlegen und in `PROFILES` aufnehmen.

**Stand heute:** Backend profilgesteuert; Home-Vertrag (Laufband, Texte, Medien,
Layout, Hero, Hintergrund, Tool-Karten, Icons) für Astro-Seiten aus Kodinitools-Home
bzw. der Vorlage; generischer Tab „Felder“ für alle anderen Websites. Nächster
Schritt: Live-Vorschau der echten Seite im iframe statt Vorschau-Build.
