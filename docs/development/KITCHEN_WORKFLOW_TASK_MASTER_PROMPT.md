# Master-Prompt für einen Kitchen-Workflow-Task

Kopiere den folgenden Prompt in eine neue Codex-Session und ersetze mindestens `{{TASK_ID}}`. Optional können Zielbranch und zusätzliche Vorgaben gesetzt werden.

---

## Prompt

Arbeite im aktuell geöffneten Yuvomi-Repository.

Bearbeite ausschließlich diesen Task:

```text
Task-ID: {{TASK_ID}}
Gewünschter Branch: {{BRANCH_ODER_AUTO}}
Zusätzliche Vorgaben: {{OPTIONALE_VORGABEN}}
```

Wenn Branch oder Zusatzvorgaben nicht angegeben sind, entnimm den empfohlenen Branch und den vollständigen Scope dem zentralen Kitchen-Workflow-Plan.

### Verbindliche Arbeitsweise

NO AUTOPILOT.

Beginne nicht sofort mit der Implementierung. Führe zuerst die Analyse- und Reservierungsphase vollständig durch.

Keine Annahmen über Pfade, Tabellen, APIs, Komponenten oder Tests. Verwende ausschließlich nachweislich vorhandene Repository-Muster.

Keine neuen Frameworks oder unnötigen Abhängigkeiten. Das Projekt verwendet Node.js, Express, SQLite/SQLCipher, Vanilla JavaScript mit ES Modules, Plain CSS, eigenes i18n und eigene Migrationen.

Bearbeite genau einen Task. Beginne keinen Folge-Task, auch dann nicht, wenn Zeit oder Kontext übrig ist.

### 1. Repository und Arbeitsstand prüfen

Prüfe zuerst:

```bash
git remote -v
git status
git branch --show-current
git log -5 --oneline
```

Regeln:

- keine Arbeit direkt auf `main`
- kein `git reset --hard`
- kein Force-Push
- keine fremden oder bestehenden Änderungen verwerfen
- keine bestehenden Branches überschreiben
- keine Dateien außerhalb des Repository-Roots verändern
- bei einem schmutzigen Working Tree zuerst Ursprung und Überschneidungen klären
- bei fehlender GitHub-Berechtigung den exakt erforderlichen manuellen Schritt dokumentieren

Synchronisiere `main` nur dann mit `upstream/main`, wenn der Working Tree sicher ist und keine lokalen Änderungen gefährdet werden. Erstelle oder verwende danach den für `{{TASK_ID}}` vorgesehenen Feature-Branch.

### 2. Zentrale Wissensbasis vollständig lesen

Lies vor jeder weiteren Aktion vollständig:

```text
docs/development/KITCHEN_WORKFLOW_MEMORY.md
docs/development/KITCHEN_WORKFLOW_PLAN.md
```

Lies anschließend die im Task genannten und laut Memory betroffenen Dateien vollständig. Prüfe zusätzlich aktuelle Änderungen und Commits, da Memory und Plan älter als der Code sein können.

Wenn Memory, Plan und aktueller Code voneinander abweichen:

1. aktuelle Repository-Evidenz ermitteln
2. Abweichung als Finding dokumentieren
3. keine stillschweigende Architekturänderung vornehmen
4. bei einer Scope- oder Architekturentscheidung anhalten und Rückfrage stellen

### 3. Task reservieren und Überschneidungen prüfen

Ergänze vor der Implementierung in `KITCHEN_WORKFLOW_MEMORY.md` eine Zeile unter „Angegriffene Bereiche“ mit:

- Datum
- Agent
- Task und Branch
- reservierte Dateien/Bereiche
- Status `reserviert / Analyse läuft`
- bekannte Überschneidungen oder offene Punkte

Prüfe danach:

- vorhandene Einträge anderer Agents
- aktuelle Branches und uncommittete Änderungen
- Überschneidungen mit parallel bearbeiteten Dateien
- Abhängigkeiten des Tasks
- Status aller vorausgesetzten Tasks

Ändere keine Datei, die ein anderer aktiver Agent reserviert hat, ohne die Überschneidung vorher zu klären.

### 4. Analyse und Implementierungsplan

Identifiziere für `{{TASK_ID}}` exakt:

- Ausgangslage und aktueller Datenfluss
- betroffene Tabellen und Migrationen
- betroffene API-Routen und Services
- betroffene Frontend-Dateien, Modals und Handler
- betroffene i18n-Keys und Locale-Dateien
- betroffene Scopes, Permissions, OpenAPI und Service Worker
- bestehende Tests und neu erforderliche Tests
- Transaktionsgrenzen
- Rückwärtskompatibilität
- Risiken, Findings und nicht zum Task gehörenden Scope

Vergleiche diese Analyse mit dem Taskabschnitt in `KITCHEN_WORKFLOW_PLAN.md`.

Dokumentiere vor Codeänderungen einen kurzen konkreten Implementierungsplan im Chat und aktualisiere bei neuen Erkenntnissen das Memory. Erst danach darfst du implementieren.

### 5. Implementierung

Implementiere ausschließlich den bestätigten Scope von `{{TASK_ID}}`.

Allgemeine Regeln:

- vorhandene Validatoren, Services, Modals, Utilities und CSS-Muster wiederverwenden
- Migrationen nur additiv und nach dem aktuellen Yuvomi-Migrationsmuster erstellen
- veröffentlichte Migrationen nicht nachträglich umschreiben
- API-Verträge rückwärtskompatibel halten
- Cross-Domain-Schreibvorgänge in einer serverseitigen DB-Transaktion ausführen
- bei Fehlern keine teilweise Änderung hinterlassen
- sichtbare Texte nie im JavaScript hartcodieren
- Deutsch und Englisch vollständig pflegen; Key-Parität aller unterstützten Locales sicherstellen
- keine automatische Interpretation unklarer Freitextmengen erfinden
- keine externe Drag-and-drop-, Kalender- oder UI-Bibliothek hinzufügen
- Findings außerhalb des Task-Scope dokumentieren, aber nicht ungeplant beheben

Wenn während der Umsetzung eine Architekturentscheidung aus dem Memory geändert werden müsste, stoppe vor dieser Änderung und fordere eine Entscheidung an.

### 6. Tests und Verifikation

Führe mindestens alle im Taskabschnitt genannten fokussierten Tests aus. Zusätzlich:

```bash
git diff --check
```

Für Änderungen in den Kitchen-Bereichen sind je nach Scope typischerweise relevant:

```bash
npm run test:db
npm run test:shopping
npm run test:meals
npm run test:datepicker
npm run test:kitchen-tabs
npm run test:frontend-audit
```

Prüfe außerdem gezielt betroffene Regressionen, beispielsweise MCP, Scopes, Permissions, Housekeeping, CalDAV, Service Worker oder Settings-Navigation.

Führe abschließend nach Möglichkeit aus:

```bash
npm test
```

Dokumentiere für jeden Test:

- exakten Befehl
- bestanden/fehlgeschlagen
- Anzahl der Tests, sofern ausgegeben
- vollständige Fehlermeldung bei Fehlern
- ob der Fehler reproduzierbar, taskbezogen oder nachweislich vorbestehend ist

Ignoriere bestehende Fehler nicht und rechne neue Fehler nicht ohne Nachweis dem Umfeld zu. Beachte das im Memory dokumentierte Windows/Node-libuv-Finding.

Bei Frontendänderungen führe zusätzlich eine angemessene manuelle Prüfung für Desktop, Tablet/Mobil und Tastaturbedienung durch, sofern die lokale App startbar ist.

### 7. Memory und Dokumentation aktualisieren

Vor Abschluss muss `docs/development/KITCHEN_WORKFLOW_MEMORY.md` aktualisiert werden:

- Reservierungszeile auf tatsächlichen Status setzen
- untersuchte Dateien nennen
- geänderte Dateien nennen
- bestätigte Annahmen dokumentieren
- neue Findings fortlaufend als `KWF-FINDING-xxx` erfassen
- neue oder geänderte Entscheidungen als `ADR-KITCHEN-xxx` dokumentieren
- Datenmodell-, API-, Frontend- und Test-Mapping aktualisieren
- Testresultate ergänzen
- Session-Handoff vollständig ersetzen oder ergänzen

Der Handoff enthält mindestens:

- letzter abgeschlossener Schritt
- aktueller Branch
- Commit-/Working-Tree-Status
- geänderte Dateien
- ausgeführte und offene Tests
- offene Findings
- nächster sinnvoller Schritt
- Bereiche, die nicht erneut analysiert werden müssen

Keine relevante Erkenntnis darf ausschließlich im Chat verbleiben.

Aktualisiere außerdem, sofern durch den Task betroffen:

- `docs/SPEC.md`
- `CHANGELOG.md`
- `server/openapi.js`
- weitere bestehende Projektdokumentation

### 8. Git-Abschluss

Vor einem Commit:

```bash
git status
git diff --check
git diff --stat
```

Stelle sicher, dass nur taskbezogene Dateien enthalten sind.

Wenn `{{OPTIONALE_VORGABEN}}` keine andere Anweisung enthält:

- implementiere und teste vollständig
- erstelle einen klaren Commit auf dem Task-Branch
- pushe den Task-Branch zu `origin`
- erstelle keinen Pull Request
- merge nicht selbst nach `main`
- beginne keinen Folgetask

Commit-Nachricht nach Projektkonvention, beispielsweise:

```text
feat: add shopping item provenance
```

### 9. Abschlussbericht

Liefere im Chat:

1. Task-ID und Ziel
2. Ausgangslage
3. verwendeter Branch
4. Liste geänderter Dateien
5. Datenmodell und Migration
6. API-Änderungen
7. Frontend- und i18n-Änderungen
8. Transaktions- und Rückwärtskompatibilitätsverhalten
9. ausgeführte Tests mit Ergebnissen
10. neue oder offene Findings
11. aktualisierte Memory-/Dokumentationsbereiche
12. Commit-SHA
13. Push-Status
14. klare Aussage, ob der Task vollständig abgeschlossen ist
15. klare Aussage, dass kein Folge-Task begonnen wurde

Wenn der Task nicht vollständig abgeschlossen werden kann, nenne den konkreten Blocker und den kleinsten erforderlichen nächsten manuellen Schritt. Deklariere einen teilweise umgesetzten Task niemals als abgeschlossen.

---

## Beispiel zum Ausfüllen

```text
Task-ID: KWF-003
Gewünschter Branch: feature/shopping-item-sources
Zusätzliche Vorgaben: Implementieren, testen, committen und pushen; keinen Pull Request erstellen.
```
