# Site-Profile

Ein Profil beschreibt, **welche Website** der Designer bearbeitet. Der Code des
Designers ist seitenunabhängig; alles Seitenspezifische steht im Manifest
`profiles/<id>/profile.json`. Auswahl über `PROFILES=<id1>,<id2>` (Umschalter in
der Kopfzeile, das erste ist Standard), `PROFILE=<id>` oder
`PROFILE_FILE=/pfad/profile.json`. Validierung: `server/profile.mjs`, Schema
für Editoren: `profile.schema.json`.

Platzhalter in Pfaden: `{repo}` = Repo-Verzeichnis, `{webroot}` = Webroot.
Relative Pfade beziehen sich auf das Repo. Die Umgebungsvariablen `REPO_DIR`,
`WEBROOT`, `UPLOADS_DIR`, `GIT_BRANCH`, `GIT_REMOTE`, `STATE_DIR`, `PREVIEW_BASE`,
`PREVIEW_DIR` überstimmen das Manifest (so bleibt eine bestehende `.env` gültig,
und ein Parallelbetrieb neben `kodini-admin` braucht kein zweites Profil).

| Feld                                        | Bedeutung                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `name`, `kind`                        | Kennung (a-z, 0-9, -), Anzeigename, Site-Typ (`astro-site`, `vite-spa`, `static`)                                                              |
| `siteUrl`, `languages`                      | Öffentliche URL (Info), bearbeitete Sprachen                                                                                                   |
| `repo.dir/branch/remote`                    | Website-Klon auf dem Server, Zielbranch für Veröffentlichungen                                                                                 |
| `webroot`                                   | nginx-Webroot (Ziel von `deploy.sh`; Basis für Uploads/Fonts)                                                                                  |
| `content.dir`, `content.files`              | Content-Ordner und die editierbaren JSON-Dateien (`media` ist Pflicht; heutige Tabs erwarten zusätzlich `overridesDe/En`, `tickerDe/En`)       |
| `content.locales`                           | Standard-Texte je Sprache (nur lesend, Fallback für leere Overrides)                                                                           |
| `content.commitPaths`                       | Was beim Veröffentlichen mit `git add` erfasst wird                                                                                            |
| `uploads.dir/repoDir/urlPrefix/gitMaxBytes` | Upload-Ziel im Webroot, optionale Git-Kopie im Repo, öffentlicher URL-Präfix, Größengrenze für die Git-Kopie                                   |
| `fonts.dirs/urlPrefix`, `fontawesome.dirs`  | Wo Schriften/Icons gesucht werden (erster Treffer je Dateiname gewinnt)                                                                        |
| `build.command/env/timeoutMinutes`          | Build für die Vorschau (im Repo ausgeführt)                                                                                                    |
| `preview.base/outDir/env`                   | Öffentlicher Pfad + Ausgabeordner der Vorschau; `env.base`/`env.outDir` = Namen der Umgebungsvariablen, über die der Build diese Werte bekommt |
| `deploy.command/timeoutMinutes`             | Deploy nach dem Push (`./…` = relativ zum Repo)                                                                                                |
| `codeUpdate.enabled`                        | Vor der Vorschau `origin/<branch>` per fast-forward holen                                                                                      |
| `stateDir`                                  | Ordner für den persistierten Vorgangs-Status (Default `{repo}/.kodini-admin`)                                                                  |
| `tabs`                                      | Reihenfolge/Auswahl der Tabs (heute informativ; das Frontend rendert noch feste Tabs)                                                          |

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

**Stand heute:** Backend vollständig profilgesteuert. Das Frontend (Tabs,
Feldnamen wie `tools.audioCutter`, Sektionen Audio/Bild/Diverse, URL-Präfix
`/uploads`) ist noch auf Kodinitools-Home zugeschnitten; manifestgesteuerte
Tabs und eine iframe-Vorschau der echten Seite sind der nächste Schritt.
