# Yuvomi Wartung mit Coding Agents

## Zweck

Dieses Runbook überträgt die persönliche Standardarbeitsweise des Repository-Eigentümers auf Yuvomi. Es gilt für Reparaturen, Features, Upstream-Integrationen, Architekturpflege und produktionsnahe Änderungen.

## Phase A: Task und Scope festlegen

Vor dem ersten Edit schriftlich festhalten:

- Task-ID aus `tasks.md` oder eindeutig benannter Einzelauftrag;
- gewünschtes beobachtbares Ergebnis;
- betroffene Module und Datenflüsse;
- ausdrücklich nicht betroffener Scope;
- Risiken für Datenbank, Auth, Scopes, PWA, externe Dienste und Produktion;
- geplante Tests und Browserprüfungen.

Ohne expliziten Scope keine Schema-, Auth-, Berechtigungs-, Deployment- oder produktive Konfigurationsänderung. Ein Folgetask beginnt nie automatisch.

## Phase B: Zustand erheben

Mindestens:

```bash
git status --short --branch
git branch --show-current
git remote -v
git log -5 --oneline
git rev-parse HEAD
git rev-parse origin/main
git rev-parse upstream/main
```

Regeln:

- Vorhandene Änderungen gehören dem Benutzer und werden nicht überschrieben.
- Mit `rg` zuerst Aufrufer, Routen, Services, UI, Tests und Dokumentation finden.
- Remote-Referenzen dürfen gefetcht werden; `upstream` bleibt read-only.
- `.env`, Datenbanken und Secrets werden weder ausgegeben noch in Dokumente übernommen.

## Phase C: Datenfluss nachvollziehen

Für fachliche Änderungen mindestens:

```text
UI oder API-Trigger
→ Router
→ Service
→ Transaktion und Datenbank
→ Antwortvertrag
→ OpenAPI/MCP
→ PWA/Cache
→ Tests
```

Bei Kitchen-Änderungen zusätzlich:

```text
Rezept/Mahlzeit
→ strukturierte oder freie Menge
→ Einkaufsimport und Provenance
→ Pantry-Lot und Inventory Movement
→ Cooking Event/Undo
→ Berechtigungen und Auditierbarkeit
```

## Phase D: Kleine Änderung implementieren

- Node.js-, Express-, SQLite- und Vanilla-JavaScript-Muster des Repositories verwenden.
- Router dünn und Cross-Domain-Logik in Services halten.
- Mehrere Datenänderungen atomar in einer Transaktion ausführen.
- Bestehende API-Verträge additiv und rückwärtskompatibel erweitern, sofern der Task keinen Bruch erlaubt.
- Sichtbare Texte über i18n führen und alle unterstützten Locale-Keysets prüfen.
- Neue App-Routen über Router, Navigation, Berechtigungen und Service Worker vollständig verdrahten.
- Testserver, Scheduler, Timer und DB-Handles zuverlässig schließen.

## Phase E: Prüfen

| Änderung | Mindestprüfung |
| --- | --- |
| Nur Dokumentation | Links/Pfade, `git diff --check`, Markdown-Struktur |
| Migration/DB | frische DB, Upgrade vom aktuellen Fork-Schema, FKs, Indizes, Backfill, Idempotenz |
| Router/Service | fokussierte Routentests, Permission-/Scope-Tests, Fehler- und Rollbackpfad |
| Kitchen | Quantity, Provenance, Shopping-Pantry, Pantry, Meal-Cooking, Undo |
| Kategorien | gemeinsame Komponente, API-Reorder, Keyboard, Drag-and-drop, Serverfehler-Rollback |
| UI/CSS/PWA | fokussierte UI-Tests, Service-Worker-Tests, Browsermatrix |
| Abhängigkeiten | Lockfile-Konsistenz, `npm ls --depth=0`, betroffene Security-Tests |
| Breite Änderung | vollständiges `npm test` mit Exit-Code 0 |

Browsermatrix für sichtbare Änderungen:

- Desktop 1440×900
- Tablet 768×1024
- Mobil 390×844
- Tastatur und sichtbarer Fokus
- keine Console-/Page-Errors
- kein horizontaler Überlauf

## Phase F: Dokumentieren und übergeben

Mindestens:

- neue `.agent/memory/YYYYMMDD_<thema>.md` aus dem Template;
- `.agent/SESSION_HANDOFF.md` mit Scope, Änderungen, Checks und offenen Punkten;
- `.agent/CURRENT_STATE.md`, wenn sich Projekt- oder Reviewstatus geändert hat;
- `.agent/MEMORY.md`, `.agent/DECISIONS.md` oder `.agent/ARCHITECTURE.md` nur für dauerhafte Erkenntnisse;
- `tasks.md` mit korrektem Status, aber niemals selbst `accepted` setzen.

Abschlussbericht:

- Ursache oder Ziel und Repository-Belege;
- geänderte Dateien und Verhalten;
- alle ausgeführten Checks mit Ergebnis;
- Risiken, offene Findings und bewusst ausgeschlossener Scope;
- Branch-, Commit-, Push- und Merge-Status;
- genaue Empfehlung für externe Review.

## Besondere Regeln für Upstream-Updates

Bei Upstream-Arbeit gilt zusätzlich der vollständige Master-Prompt unter `docs/development/UPSTREAM_UPDATE_MASTER_PROMPT.md`.

- Ziel-SHA vor Analyse und Merge fixieren.
- Integration nur auf `integration/upstream-*`.
- Migrationen, APIs, Locales, PWA und Tests semantisch prüfen.
- Fork-Funktionen erhalten und Upstream-Fixes vollständig übernehmen.
- Kein Merge nach `main` und kein produktiver Deploy ohne separate Freigabe.

## Besondere Regeln für Produktion

Vor einem produktiven Deploy oder Schema-Upgrade:

1. Zielsystem und aktiven Stack verifizieren.
2. Wiederherstellbares Backup mit Zielpfad und Zeitstempel erstellen.
3. Rollbackweg dokumentieren.
4. Deploy/Migration durchführen.
5. Health, HTTP, SQLite-Integrität, Foreign Keys und fachliche Bestandsdaten prüfen.
6. Backup nicht automatisch löschen.
