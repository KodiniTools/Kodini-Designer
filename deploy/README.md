# Server-Setup (Kodini Designer)

Der Designer läuft als eigener Dienst **neben** dem bestehenden `kodini-admin`
aus dem Website-Repo. `kodini-admin` bleibt unverändert (Port 9020, `/admin`).

| Komponente                               | Ort                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Designer-Klon                            | `/opt/kodini/designer`                                                   |
| Website-Klon (Profil `kodinitools-home`) | `/opt/kodini/repo` (geteilt mit `kodini-admin`)                          |
| Webroot / Uploads                        | `/var/www/kodinitools.com` / `…/uploads` (geteilt)                       |
| Dienst                                   | `127.0.0.1:9030` (systemd `kodini-designer`), nginx `/designer`          |
| Status / Vorschau des Designers          | `/opt/kodini/designer-state`, `/opt/kodini/designer-preview`             |
| Konfiguration                            | `/opt/kodini/.env` (geteilt) + `/opt/kodini/designer.env` (nur Designer) |

Beide Dienste bearbeiten **dieselben Content-Dateien** in `/opt/kodini/repo`.
Entwürfe deshalb nicht gleichzeitig in beiden Oberflächen speichern (der letzte
Speichervorgang gewinnt). Veröffentlichen aus dem Designer committet dieselben
Dateien wie aus dem Admin.

## Einrichtung (Parallelbetrieb)

```bash
# 0. Service-User = Owner des Webroots (i. d. R. www-data)
U=$(stat -c %U /var/www/kodinitools.com)

# 1. Zugriff: Deploy-Key des Servers auch beim Designer-Repo hinterlegen
#    (GitHub → Kodini-Designer → Settings → Deploy keys, nur Lesen reicht)
sudo cat /opt/kodini/deploy_key.pub

# 2. Designer klonen
SSH_CMD="ssh -i /opt/kodini/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=/opt/kodini/known_hosts -o StrictHostKeyChecking=accept-new"
sudo -u "$U" GIT_SSH_COMMAND="$SSH_CMD" git clone -b main git@github.com:KodiniTools/Kodini-Designer.git /opt/kodini/designer
sudo -u "$U" git -C /opt/kodini/designer config core.sshCommand "$SSH_CMD"

# 3. Eigene Ordner + Konfiguration
sudo install -d -o "$U" -g "$U" /opt/kodini/designer-state /opt/kodini/designer-preview
sudo cp /opt/kodini/designer/deploy/designer.env.example /opt/kodini/designer.env
sudo chown "$U:$U" /opt/kodini/designer.env && sudo chmod 600 /opt/kodini/designer.env

# 4. Dienst
sudo cp /opt/kodini/designer/deploy/kodini-designer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kodini-designer
systemctl status kodini-designer --no-pager
journalctl -u kodini-designer -n 20 --no-pager
curl -s http://127.0.0.1:9030/api/session

# 5. nginx: Blöcke aus deploy/nginx-designer.conf in den Server-Block einfügen
sudo nginx -t && sudo systemctl reload nginx
```

Danach: https://kodinitools.com/designer/ – Anmeldung mit dem Admin-Passwort
(gleiche `.env`), Kopfzeile zeigt „Kodinitools Home“. Erst „Vorschau“ testen
(`/designer/preview/`), dann veröffentlichen.

Kein `npm install` nötig: der Dienst hat keine Laufzeit-Abhängigkeiten.
Ist der Service-User nicht `www-data`, `User=`/`Group=` in der Unit anpassen.

## Designer aktualisieren

```bash
sudo -u www-data git -C /opt/kodini/designer pull --ff-only
sudo systemctl restart kodini-designer
```

Ein Website-Deploy (`deploy.sh` im Website-Repo) berührt den Designer nicht.

## Ablösung von `kodini-admin` (später, optional)

Wenn der Designer den Admin ersetzen soll: in `designer.env` `PORT=9020`,
`COOKIE_PATH=/admin`, `PREVIEW_BASE=/admin/preview/` setzen, dann
`sudo systemctl disable --now kodini-admin && sudo systemctl restart kodini-designer`.
Die vorhandenen `/admin`-nginx-Blöcke zeigen dann auf den Designer.

## Video-Cutter anbinden (Profil `video-cutter`)

```bash
U=$(stat -c %U /var/www/kodinitools.com)
SSH_CMD="ssh -i /opt/kodini/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=/opt/kodini/known_hosts -o StrictHostKeyChecking=accept-new"
sudo install -d -o "$U" -g "$U" /opt/kodini/sites
sudo -u "$U" GIT_SSH_COMMAND="$SSH_CMD" git clone -b main git@github.com:KodiniTools/Video-Cutter.git /opt/kodini/sites/video-cutter
sudo -u "$U" git -C /opt/kodini/sites/video-cutter config core.sshCommand "$SSH_CMD"
sudo sed -i "s#^ReadWritePaths=.*#& /opt/kodini/sites/video-cutter#" /etc/systemd/system/kodini-designer.service
sudo sed -i "s#^PROFILES=.*#&,video-cutter#" /opt/kodini/designer.env
sudo systemctl daemon-reload && sudo systemctl restart kodini-designer
```

Voraussetzungen: Deploy-Key mit Schreibrecht beim Video-Cutter-Repo (der
Designer committet und pusht), Webroot `/var/www/kodinitools.com/video-cutter`
gehört dem Dienst-User (dann deployt `deploy/deploy.sh` ohne sudo; das Backend
wird mit `SKIP_API=1` nicht angefasst). Im Designer erscheint das Profil im
Umschalter mit dem Tab „Felder“.

## Weitere Profile

Pro Website ein Ordner `profiles/<id>/profile.json` (siehe `profiles/README.md`),
das Repo auf dem Server auschecken und dessen Pfad in `ReadWritePaths` der Unit
ergänzen. Dann die Kennung in `designer.env` anhängen und neu starten:

```bash
PROFILES=kodinitools-home,<id>
sudo systemctl restart kodini-designer
```

In der Kopfzeile erscheint ein Umschalter; die Wahl gilt pro Browser (Cookie).
Status und Vorschau liegen je Profil unter `designer-state/<id>` bzw.
`designer-preview/<id>`.
