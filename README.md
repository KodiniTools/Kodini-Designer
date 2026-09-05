# Kodini Designer

Eigenständiger Website-Designer/Adminbereich für die Kodini-Websites: Texte,
Laufband, Medien, Hero-Layout, Hero-Design, Seiten-Hintergrund, Tool-Karten,
Icons – mit Live-Vorschau, Entwurf/Vorschau/Veröffentlichen (Git-Commit, Build,
Deploy). Node-Dienst **ohne Laufzeit-Abhängigkeiten** (nur Node-Built-ins),
Frontend in Vanilla-JS (ES-Module).

Der Designer ist aus `Kodinitools-Home/server/admin` herausgelöst. Welche
Website er bearbeitet, bestimmt ein **Site-Profil** (`profiles/<id>/profile.json`).
Erstes Profil: `kodinitools-home`. Weitere Websites (z. B. die Tool-Repos)
werden später als eigene Profile angebunden – siehe [`profiles/README.md`](profiles/README.md).

## Aufbau

| Pfad                                         | Zweck                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/index.mjs`                           | HTTP-Server, Routing, statische Auslieferung des Frontends und der Vorschau                                                                                                                                                                                                                              |
| `server/profile.mjs`                         | Site-Profile laden, validieren, Pfade auflösen (`PROFILE`, `PROFILE_FILE`, Umgebungs-Overrides)                                                                                                                                                                                                          |
| `server/config.mjs`                          | Netzwerk/Auth aus der Umgebung + Pfade/Git aus dem aktiven Profil; `contentPaths()`                                                                                                                                                                                                                      |
| `server/auth.mjs`                            | Passwort (scrypt), Session-Cookies (HMAC), Login-Bruteforce-Schutz                                                                                                                                                                                                                                       |
| `server/content.mjs`                         | Lesen/Schreiben + Validierung der Content-Dateien (Overrides, Laufband, Medien/Design)                                                                                                                                                                                                                   |
| `server/uploads.mjs`                         | Uploads in den Webroot (+ optionale Git-Kopie im Repo), Liste, Löschen, Verschieben                                                                                                                                                                                                                      |
| `server/preview.mjs`                         | Vorschau-Build in ein separates Verzeichnis (Befehl/Umgebung aus dem Profil)                                                                                                                                                                                                                             |
| `server/publish.mjs`                         | Commit → Push → Deploy (Pfade und Befehl aus dem Profil), Status-Polling mit Live-Log                                                                                                                                                                                                                    |
| `server/codeupdate.mjs`                      | Website-Code vor der Vorschau per fast-forward holen; Selbst-Neustart unter systemd                                                                                                                                                                                                                      |
| `server/fonts.mjs`, `server/fontawesome.mjs` | Schriften/Icons aus den Profil-Ordnern auflisten                                                                                                                                                                                                                                                         |
| `server/hash-password.mjs`                   | scrypt-Hash für `ADMIN_PASSWORD_HASH` erzeugen                                                                                                                                                                                                                                                           |
| `public/`                                    | Frontend: `admin.js` (Navigation), `model.js` (Zustand/Normalisierung), Tabs (`content.js`, `ticker.js`, `media.js`, `layout.js`, `design.js`, `background.js`, `toolcards.js`, `icons.js`), Bausteine `slider.js`, `color.js`, `fonts.js`, `publish.js` (Speichern/Vorschau/Veröffentlichen, Undo/Redo) |
| `profiles/`                                  | Site-Profile + Schema + Doku                                                                                                                                                                                                                                                                             |
| `deploy/`                                    | systemd-Unit, nginx-Blöcke, `.env`-Vorlage, Server-Anleitung                                                                                                                                                                                                                                             |
| `tests/`                                     | Unit-Tests (`node --test`)                                                                                                                                                                                                                                                                               |

## Lokal starten

```bash
npm install                      # nur Dev-Tools (eslint, prettier)
export PROFILE=kodinitools-home
export REPO_DIR=/pfad/zum/Kodinitools-Home   # Website-Checkout
export WEBROOT=$REPO_DIR/public              # lokal: Fonts/Icons aus dem Repo
export UPLOADS_DIR=$REPO_DIR/public/uploads
export ADMIN_PASSWORD_HASH="$(node server/hash-password.mjs 'test1234')"
export SESSION_SECRET="$(openssl rand -hex 32)"
export COOKIE_PATH=/                          # ohne nginx-Präfix
npm start                                     # http://127.0.0.1:9020
```

Vorschau und Veröffentlichen führen die Befehle aus dem Profil im Website-Repo
aus (`npm run build`, `./deploy.sh`) – lokal also nur mit Bedacht nutzen.

## Prüfen

```bash
npm test          # Profil-Tests
npm run lint
npm run format:check
```

## Betrieb

Siehe [`deploy/README.md`](deploy/README.md): Der Designer läuft unter
`/opt/kodini/designer` als Dienst `kodini-designer` und ersetzt den bisherigen
`kodini-admin` aus dem Website-Repo (gleicher Port, gleiche nginx-Blöcke,
gleiche `.env` plus `PROFILE=kodinitools-home`).

## Konfiguration

Pflicht: `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`. Profil: `PROFILE` (Default
`kodinitools-home`) oder `PROFILE_FILE`. Optional (überstimmen das Profil):
`REPO_DIR`, `WEBROOT`, `UPLOADS_DIR`, `GIT_BRANCH`, `GIT_REMOTE`. Weitere:
`PORT`, `BIND_HOST`, `COOKIE_PATH`, `MAX_UPLOAD_MB`, `SESSION_TTL_HOURS`,
`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`. Vorlage: `deploy/.env.example`.

## API

| Methode    | Pfad                                             | Auth | Zweck                                                                                                  |
| ---------- | ------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------ |
| POST       | `/api/login`, `/api/logout`                      | –    | Anmelden / Abmelden                                                                                    |
| GET        | `/api/session`                                   | –    | `{ authenticated, serverCodeChanged, profile }` (`profile` = id, name, kind, siteUrl, languages, tabs) |
| GET / PUT  | `/api/content`                                   | ✓    | Content laden / validiert speichern                                                                    |
| POST       | `/api/upload`                                    | ✓    | Datei hochladen (Raw-Body, `X-Filename`, `X-Lang`)                                                     |
| GET        | `/api/uploads`, `/api/fonts`, `/api/fontawesome` | ✓    | Listen                                                                                                 |
| POST       | `/api/uploads/delete`, `/api/uploads/move`       | ✓    | Upload löschen / verschieben                                                                           |
| POST / GET | `/api/preview`, `/api/preview/status`            | ✓    | Vorschau bauen / Status                                                                                |
| POST / GET | `/api/publish`, `/api/publish/status`            | ✓    | Veröffentlichen / Status                                                                               |
| GET        | `/preview/…`                                     | ✓    | Ausgelieferte Vorschau                                                                                 |

Schreibende Aufrufe verlangen den Header `x-kodini-admin: 1` (CSRF-Schutz).

## Stand und nächste Schritte

- **Heute:** Backend vollständig profilgesteuert; Verhalten für Kodinitools-Home
  identisch zum eingebetteten Admin (gleiche Testsuite, gleiche Ergebnisse).
- **Noch seitenspezifisch:** das Frontend (feste Tabs, Feldnamen wie
  `tools.audioCutter`, Sektionen Audio/Bild/Diverse, URL-Präfix `/uploads`).
- **Nächste Schritte:** manifestgesteuerte Tabs/Felder je Profil, Live-Vorschau
  der echten Website im iframe (postMessage statt nachgebauter Komponenten),
  globales Marken-Theme über mehrere Profile, Profil-Umschalter im Kopf.
