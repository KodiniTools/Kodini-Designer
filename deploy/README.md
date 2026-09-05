# Server-Setup (Kodini Designer)

Der Designer läuft als eigener Dienst neben der Website. Er ersetzt den
bisherigen Dienst `kodini-admin` aus dem Website-Repo (gleicher Port 9020,
gleiche nginx-Blöcke, gleiche `.env`).

| Komponente                               | Ort                                          |
| ---------------------------------------- | -------------------------------------------- |
| Designer-Klon                            | `/opt/kodini/designer`                       |
| Website-Klon (Profil `kodinitools-home`) | `/opt/kodini/repo`                           |
| Webroot / Uploads                        | `/var/www/kodinitools.com` / `…/uploads`     |
| Dienst                                   | `127.0.0.1:9020` (systemd `kodini-designer`) |
| Secrets                                  | `/opt/kodini/.env` (chmod 600)               |

## Umstellung von `kodini-admin` auf `kodini-designer`

```bash
# 1. Designer klonen (Service-User = Owner des Webroots, i. d. R. www-data)
sudo -u www-data git clone https://github.com/KodiniTools/Kodini-Designer.git /opt/kodini/designer

# 2. Profil in die bestehende .env eintragen (Rest bleibt gültig)
echo 'PROFILE=kodinitools-home' | sudo tee -a /opt/kodini/.env

# 3. Alten Dienst stoppen, neuen installieren
sudo systemctl disable --now kodini-admin
sudo cp /opt/kodini/designer/deploy/kodini-designer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kodini-designer
systemctl status kodini-designer --no-pager
```

nginx braucht keine Änderung, solange die Blöcke aus `nginx-designer.conf`
(identisch zu den bisherigen `nginx-admin.conf`-Blöcken) bereits eingebunden sind.

## Designer aktualisieren

```bash
sudo -u www-data git -C /opt/kodini/designer pull --ff-only
sudo systemctl restart kodini-designer
```

Der Designer hat keine Laufzeit-Abhängigkeiten (`npm install` ist nur für
Lint/Tests nötig). Ein Website-Deploy (`deploy.sh` im Website-Repo) berührt den
Designer nicht mehr.

## Weitere Profile

Pro Website ein Ordner `profiles/<id>/profile.json` (siehe `profiles/README.md`),
das Repo auf dem Server auschecken und dessen Pfad in `ReadWritePaths` der Unit
ergänzen. Aktiv ist immer genau ein Profil (`PROFILE=<id>` in der `.env`).
