# Master-Prompt für ein Yuvomi-Upstream-Update

Dieser Prompt aktualisiert den Yuvomi-Fork kontrolliert aus dem kanonischen Upstream-Repository. Er übernimmt wichtige Upstream-Funktionen und Fehlerkorrekturen, ohne Fork-Erweiterungen zu verlieren oder in das Original-Repository zu schreiben.

Kopiere den Abschnitt „Prompt“ vollständig in eine neue Codex-Session. Alle Parameter sind optional. Ohne Angaben gelten diese Defaults:

- Upstream-Ziel: aktueller Commit von `upstream/main`
- Integrationsbranch: automatisch aus der Zielversion, sonst `integration/upstream-update-YYYY-MM-DD`
- Abschluss: geprüften Branch zu `origin` pushen, anschließend mit `--no-ff` in Fork-`main` mergen und `origin/main` pushen
- Pull Request: keiner
- `upstream`: strikt read-only; es erfolgen weder Pushes noch Pull Requests oder andere Schreibvorgänge gegen das Original-Repository

---

## Prompt

Arbeite im aktuell geöffneten Yuvomi-Repository und führe genau ein konfliktbewusstes Upstream-Update vollständig durch.

```text
Upstream-Ziel: {{UPSTREAM_REF_ODER_MAIN}}
Integrationsbranch: {{BRANCH_ODER_AUTO}}
Abschluss: {{FORK_MAIN_ODER_NUR_BRANCH}}
Zusätzliche Vorgaben: {{OPTIONALE_VORGABEN}}
```

Wenn Parameter fehlen, verwende die oben dokumentierten Defaults. `origin` ist der Benutzer-Fork, `upstream` das kanonische Original. Schreibe niemals zu `upstream`.

### Verbindliche Arbeitsweise

NO AUTOPILOT.

Beginne nicht mit einem Merge. Schließe zuerst Repositoryprüfung, Upstream-Analyse, Überschneidungsprüfung und einen konkreten Integrationsplan ab.

Arbeite nur mit nachweislich vorhandenen Repository-Mustern. Das Projekt verwendet Node.js, Express, SQLite/SQLCipher, Vanilla JavaScript mit ES Modules, Plain CSS, eigenes i18n, eigene Migrationen und bestehende Testskripte.

Verboten sind:

- Push, Pull Request oder Merge gegen `upstream`
- direkte Integrationsarbeit auf `main`
- `git reset --hard`, Force-Push oder Umschreiben veröffentlichter Historie
- Verwerfen fremder oder vorhandener Änderungen
- pauschales Auflösen mit ausschließlich „ours“ oder ausschließlich „theirs“
- nachträgliches Ändern bereits veröffentlichter Migrationen
- neue Frameworks oder unnötige Abhängigkeiten
- Dateien außerhalb des Repository-Roots verändern
- ungeprüftes Deklarieren bestehender Fehler als Umgebungsproblem

### 1. Repository, Remotes und Arbeitsstand prüfen

Führe zuerst aus:

```bash
git remote -v
git status
git branch --show-current
git log -5 --oneline
git rev-parse main
git rev-parse origin/main
git rev-parse upstream/main
```

Bestätige ausdrücklich:

- `origin` zeigt auf den Fork, erwartbar `lossus/yuvomi`.
- `upstream` zeigt auf das Original, erwartbar `ulsklyc/yuvomi`.
- Der Working Tree ist sauber oder vorhandene Änderungen sind eindeutig zugeordnet und überschneiden sich nicht.
- Es wird nicht direkt auf `main` gearbeitet.

Bei einem schmutzigen Working Tree: Ursprung und Überschneidungen klären. Nichts stashen, löschen, verschieben oder zurücksetzen, solange Eigentum und Sicherheit nicht geklärt sind.

Synchronisiere die Remote-Referenzen, aber verändere noch keinen Branch:

```bash
git fetch --prune origin
git fetch --prune upstream
```

Aktualisiere lokales `main` ausschließlich aus dem Fork:

```bash
git switch main
git pull --ff-only origin main
```

Merge an dieser Stelle niemals `upstream/main` direkt nach `main`.

### 2. Exaktes Upstream-Ziel festlegen

Wenn kein Ziel angegeben ist, verwende den nach dem Fetch aufgelösten Commit von `upstream/main`. Bei Tag, Branch oder SHA muss der Zielcommit eindeutig auflösbar sein.

Dokumentiere vor weiteren Schritten:

- Ziel-Ref und vollständigen Ziel-SHA
- Upstream-Version aus `package.json` und vorhandene Release-Tags
- aktuellen Fork-`main`-SHA
- Merge-Base
- Divergenz in beide Richtungen
- alle Upstream-Commits seit der Merge-Base

Typische Befehle:

```bash
git merge-base main <UPSTREAM_ZIEL>
git rev-list --left-right --count main...<UPSTREAM_ZIEL>
git log --oneline --decorate main..<UPSTREAM_ZIEL>
git log --oneline --decorate <UPSTREAM_ZIEL>..main
git diff --stat main...<UPSTREAM_ZIEL>
git diff --name-status main...<UPSTREAM_ZIEL>
```

Verwende ab jetzt für Analyse und Merge denselben aufgelösten Ziel-SHA, damit ein späterer Upstream-Push das geprüfte Ziel nicht verschiebt.

### 3. Upstream-Änderungen und Fork-Überschneidungen analysieren

Lies die vollständigen Upstream-Commits und Diffs. Gruppiere die Änderungen mindestens in:

- Datenmodell und Migrationen
- API-Routen, Services, Auth, Scopes und Permissions
- Frontend, Komponenten, Handler und CSS
- i18n und alle unterstützten Locale-Dateien
- OpenAPI, MCP und Service Worker
- Tests und Test-Harnesses
- Abhängigkeiten, Version, Lockfile und Security-Middleware
- Produktdokumentation, Installer, Deployment und Screenshots

Ermittle getrennt:

- Dateien, die nur Upstream geändert hat
- Dateien, die nur der Fork seit der Merge-Base geändert hat
- überlappende Dateien
- erwartete Textkonflikte
- semantische Konflikte trotz automatisch mergebarem Text

Prüfe insbesondere automatisch kombinierte Dateien fachlich. Ein konfliktfreier Git-Merge beweist keine korrekte Integration.

### 4. Migrationen und unterstützte Upgradepfade prüfen

Lies `server/db.js`, `server/db-schema-test.js` und die migrationsbezogenen Tests vollständig. Erstelle vor dem Merge eine Tabelle mit:

- Versionsnummer
- Fork-Bedeutung
- Upstream-Bedeutung
- bereits veröffentlicht ja/nein
- Abhängigkeiten von früheren Migrationen
- vorgesehenes Integrationsergebnis

Regeln:

- Veröffentlichte Fork-Migrationen bleiben unverändert und kanonisch.
- Neue Upstream-Schemafunktionen werden additiv auf die nächsten freien Fork-Migrationsnummern abgebildet, wenn Nummern bereits anders belegt sind.
- SQL-Semantik, FKs, Indizes, CHECKs, Backfills und Abhängigkeiten müssen erhalten bleiben.
- Bestehende Fork-Datenbanken und frische Installationen müssen unterstützt werden.
- Eine bereits separat mit kollidierenden Upstream-Migrationen aktualisierte Datenbank ist nicht automatisch unterstützt. Wenn dafür Reconciliation nötig wäre, halte vor der Architekturänderung an und fordere eine Entscheidung an.
- Destruktive Rebuilds, Datenverlust, Nummernüberschreibung oder unklare Lineage sind Blocker und dürfen nicht stillschweigend gelöst werden.

Ergänze Tests für mindestens:

- frische Datenbank bis zur höchsten Fork-Migration
- Upgrade von der aktuellen Fork-Version
- Erhalt bestehender Fork-Daten und FKs
- neue Upstream-Tabellen, Spalten, Indizes und Constraints
- Idempotenz des Migrationsrunners

### 5. Integrationsplan vor dem Merge

Dokumentiere im Chat einen kurzen, konkreten Plan mit:

1. Ziel-SHA und Branch
2. zu übernehmenden Upstream-Funktionen/Fixes
3. Konfliktdateien und jeweiliger Auflösungsstrategie
4. Migrationsnummerierung und unterstützten Upgradepfaden
5. Abhängigkeits-/Lockfile-Strategie
6. fokussierten Tests
7. erforderlicher Browserprüfung
8. geplantem Git-Abschluss

Wenn eine echte Produkt-, Sicherheits-, Datenmodell- oder Upgradeentscheidung offen ist, stoppe vor dem Merge und frage nach. Reine mechanische Konflikte werden nach vorhandener Repository-Evidenz gelöst.

### 6. Integrationsbranch erstellen und Merge durchführen

Erstelle einen neuen Branch vom aktuellen Fork-`main`. Überschreibe keinen vorhandenen Branch. Der Name beginnt bevorzugt mit `integration/upstream-`.

```bash
git switch -c <INTEGRATIONSBRANCH>
git merge --no-commit --no-ff <AUFGELÖSTER_UPSTREAM_SHA>
```

Löse jeden Konflikt einzeln:

- Fork-Funktionalität und veröffentlichte Fork-Verträge erhalten.
- Wichtige Upstream-Fixes und neue Funktionen vollständig übernehmen.
- `package.json`-Skripte beider Linien zusammenführen.
- Versions- und Abhängigkeitsänderungen mit `package-lock.json` konsistent halten.
- Changelog-Einträge beider Linien erhalten und chronologisch sinnvoll einordnen.
- OpenAPI, Scopes, Permissions, MCP, Service Worker und Locale-Keysets fachlich abgleichen.
- Keine sichtbaren Texte hartcodieren.
- Keine teilweise Cross-Domain-Mutation einführen; bestehende Transaktionsgrenzen erhalten.

Suche nach der Konfliktlösung nach Restmarkern und unaufgelösten Indexeinträgen:

```bash
git ls-files -u
git diff --check
```

### 7. Abhängigkeiten und statische Konsistenz prüfen

Wenn Upstream `package.json` oder das Lockfile ändert:

- prüfe den exakten Abhängigkeitsdiff
- verwende den vorhandenen Paketmanager
- regeneriere das Lockfile nur mit der im Repository vorgesehenen npm-Version und ohne unnötige Paketänderungen
- prüfe `npm ls --depth=0`
- dokumentiere Audit-Funde, behebe aber keine unabhängigen Major-Upgrades ungeplant

Prüfe zusätzlich:

```bash
node --check server/db.js
node --check server/db-schema-test.js
git diff --check
```

Parse alle geänderten JSON-Dateien und prüfe Locale-Key-Parität über sämtliche unterstützten Sprachen.

### 8. Tests und Verifikation

Führe zuerst die von den geänderten Bereichen betroffenen Suiten aus. Ermittle Testnamen aus dem aktuellen `package.json`; erfinde keine Skripte.

Für Yuvomi typischerweise relevant:

```bash
npm run test:db
npm run test:kitchen-workflow
npm run test:tasks
npm run test:documents
npm run test:task-documents
npm run test:holidays
npm run test:shopping
npm run test:shopping-pantry
npm run test:pantry
npm run test:meal-cooking
npm run test:meals
npm run test:datepicker
npm run test:kitchen-tabs
npm run test:permissions
npm run test:token-scopes
npm run test:mcp
npm run test:settings-navigation
npm run test:sw-api-cache
npm run test:frontend-audit
npm run test:mobile-scroll-layout
npm run test:typography
```

Führe danach aus:

```bash
npm test
git diff --check
```

Für jeden Test dokumentieren:

- exakter Befehl
- bestanden oder fehlgeschlagen
- Testanzahl, sofern ausgegeben
- vollständige Fehlermeldung bei Fehlern
- reproduzierbar ja/nein
- taskbezogen, Upstream-Regression oder nachweislich vorbestehend

Testisolation ist verpflichtend:

- Testdatenbanken müssen temporär oder in-memory sein.
- `DB_PATH` muss vor jedem Import gesetzt sein, der `server/db.js` transitiv laden kann.
- Die ignorierte lokale `yuvomi.db` darf durch Tests weder gelöscht noch unbeabsichtigt verändert werden.
- Testserver, Timer, Scheduler, DB-Handles und temporäre Sidecars müssen sauber geschlossen werden.

Wenn UI, CSS, Navigation oder Client-Handler betroffen sind, starte die App mit isolierter Testdatenbank und prüfe mindestens:

- Desktop 1440×900
- Tablet 768×1024
- Mobil 390×844
- Tastaturbedienung und Fokus
- keine Console-/Page-Errors
- kein horizontaler Überlauf
- betroffene neue Funktionen und zentrale Fork-Funktionen

### 9. Produktdokumentation aktualisieren

Aktualisiere nur tatsächlich betroffene, bestehende Produktdokumentation:

- `CHANGELOG.md`
- `docs/SPEC.md`
- `server/openapi.js`
- README-/Installations-/Deployment-Dokumentation, falls Upstream sie fachlich geändert hat

Lege keine neue Session-Memory, Taskhistorie oder fortlaufende Planungsdatei an. Integrationsentscheidungen gehören in nachvollziehbare Commit-Nachrichten, Tests und den Abschlussbericht.

### 10. Git-Abschluss auf dem Integrationsbranch

Prüfe vor dem Commit:

```bash
git status
git diff --check
git diff --stat
git diff --cached --check
git diff --cached --stat
```

Stelle sicher, dass ausschließlich Upstream-Integration, notwendige Konfliktauflösung, Tests und betroffene Produktdokumentation enthalten sind.

Erstelle einen Merge-Commit, beispielsweise:

```text
merge: integrate upstream vX.Y.Z into fork
```

Pushe nur zum Fork:

```bash
git push -u origin <INTEGRATIONSBRANCH>
```

Erstelle keinen Pull Request, sofern die Zusatzvorgaben keinen verlangen.

### 11. Optionaler Abschluss in Fork-`main`

Wenn `Abschluss` fehlt oder `fork-main` lautet, integriere nach vollständig grüner Verifikation direkt in den Fork:

```bash
git switch main
git pull --ff-only origin main
git merge --no-ff <INTEGRATIONSBRANCH> -m "merge: integrate upstream vX.Y.Z into fork main"
```

Führe auf `main` mindestens DB-, Migrations-, neue Upstream-Feature- und Frontend-Smoke-Tests erneut aus. Pushe erst danach:

```bash
git push origin main
git rev-list --left-right --count origin/main...main
git rev-parse upstream/main
git status
```

Erfolgskriterien:

- `main...origin/main` ist `0 0`.
- Working Tree ist sauber.
- Der zuvor dokumentierte Upstream-Ziel-SHA ist als Parent im Integrationscommit enthalten.
- `upstream/main` wurde nicht beschrieben und nicht durch einen lokalen Push verändert.

Wenn `Abschluss` ausdrücklich `nur-branch` lautet, stoppe nach dem Push des Integrationsbranches und merge nicht nach `main`.

### 12. Abschlussbericht

Liefere im Chat:

1. Upstream-Ziel, Version und SHA
2. Ausgangsdivergenz und Merge-Base
3. verwendeter Integrationsbranch
4. übernommene Funktionen und Fixes
5. Konfliktdateien und Auflösung
6. Datenmodell, Migrationen und unterstützte Upgradepfade
7. API-, OpenAPI-, Scope- und Permission-Auswirkungen
8. Frontend-, CSS-, i18n- und Service-Worker-Auswirkungen
9. Abhängigkeits- und Lockfile-Änderungen
10. alle Tests mit Ergebnissen
11. Browserprüfung
12. offene Findings oder bewusst ausgeschlossene Pfade
13. Integrationscommit-SHA
14. Fork-`main`-Merge-SHA, falls ausgeführt
15. Push- und Synchronisationsstatus
16. klare Bestätigung, dass `upstream` nicht beschrieben wurde
17. klare Aussage, ob das Update vollständig abgeschlossen ist

Wenn das Update nicht vollständig abgeschlossen werden kann, nenne den konkreten Blocker und den kleinsten erforderlichen manuellen Schritt. Deklariere einen teilweise integrierten Stand niemals als abgeschlossen.
