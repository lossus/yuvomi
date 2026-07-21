# Yuvomi Tasks

Stand: 2026-07-21

Dieses Dokument ist die verbindliche Taskliste für das geplante Upstream-Update und die anschließende Verbesserung der Fork-Wartbarkeit.

## Arbeitsregel

- NO AUTOPILOT.
- Pro Session genau einen ausdrücklich freigegebenen Task bearbeiten.
- Ein abgeschlossener oder empfohlener Task gibt den nächsten Task nicht automatisch frei.
- Implementierende Agenten setzen höchstens `implemented_by_agent`; `accepted` erfordert externe Review.
- `upstream` bleibt read-only.
- Push, Merge nach Fork-`main` und Produktionseinsatz sind eigene Freigabeschritte.

## Statuswerte

`planned` · `in_progress` · `implemented_by_agent` · `merged` · `reviewed` · `accepted` · `needs_followup` · `rejected`

## Feste Update-Baseline

| Feld | Wert |
| --- | --- |
| Fork-Baseline | `origin/main` bei `ebe9a85f7d149868f2afa18ff66a925f051caaa0` |
| Upstream-Ziel | v1.43.0 |
| Upstream-SHA | `d506731fbf2fb628843398c231cde04e67e8e2f4` |
| Merge-Base | `dfa6729e9c5461030f620973d9b3012f08ce2c65` |
| Ausgangsdivergenz | 46 Fork-only / 145 Upstream-only Commits |
| Geplanter Integrationsbranch | `integration/upstream-v1.43.0` |
| Geplanter Härtungsbranch | `refactor/upstream-update-boundaries` |

---

# Arbeitsblock A: Upstream v1.43.0

## YUV-UP-001 — Integrationsbaseline und Migrationsmatrix

Status: `planned`

Abhängigkeiten: keine

Ziel: Eine vollständige, reproduzierbare Entscheidungsgrundlage erstellen, bevor ein Merge begonnen wird.

In Scope:

- Remotes, Working Tree, Fork-SHA und festen Upstream-SHA erneut verifizieren.
- Branch `integration/upstream-v1.43.0` vom aktuellen `origin/main` erstellen.
- Dateischnittmenge, Textkonflikte und semantische Hotspots dokumentieren.
- Migrationen von Fork und Upstream vollständig tabellarisch gegenüberstellen.
- Für jede Upstream-Migration 88–95 Zielidentität, Abhängigkeiten, SQL, Indizes, FKs und Backfill festlegen.
- Unterstützte Upgradepfade festhalten: frische DB und bestehende Fork-DB bei Schema 93.
- Eine Produktionsdatenbank wird dabei weder geöffnet noch verändert.

Nicht im Scope:

- Upstream-Merge
- Produktcodeänderungen
- Push oder Merge nach `main`
- Produktion

Akzeptanzkriterien:

- Ziel-SHA und Ausgangs-SHAs sind unveränderlich dokumentiert.
- Jede Migration 86–95 beider Linien besitzt eine eindeutige Integrationsentscheidung.
- Keine veröffentlichte Fork-Migration wird verändert.
- Offene Produkt- oder Upgradeentscheidungen sind als Blocker benannt.
- Session-Handoff enthält die exakten nächsten Merge-Schritte.

Prüfung:

- `git status --short --branch`
- `git rev-list --left-right --count origin/main...<target-sha>`
- `git diff --check`
- dokumentierte Links und SHAs prüfen

Stop-Gate: Nach Übergabe und externer Review stoppen. `YUV-UP-002` nicht automatisch beginnen.

## YUV-UP-002 — Konfliktbewusster Merge von v1.43.0

Status: `planned`

Abhängigkeiten: `YUV-UP-001 accepted`

Ziel: Den festen Upstream-SHA als echten Merge-Parent integrieren und alle Textkonflikte fachlich auflösen.

In Scope:

- `git merge --no-commit --no-ff d506731f...` auf dem Integrationsbranch.
- Die zwölf bekannten Konfliktbereiche einzeln lösen:
  - `CHANGELOG.md`
  - `docs/SPEC.md`
  - `package.json`
  - `public/components/datepicker.js`
  - `public/pages/meals.js`
  - `public/pages/shopping.js`
  - `public/router.js`
  - `public/styles/shopping.css`
  - `public/sw.js`
  - `server/openapi.js`
  - `server/routes/shopping.js`
  - `test/test-datepicker.js`
- Migrationen exakt nach der akzeptierten Matrix integrieren.
- Upstream-Release-Inhalte und Fork-Kitchen-Verträge gemeinsam erhalten.
- Lockfile mit dem vorhandenen npm-Workflow konsistent herstellen.
- Merge-Commit auf dem Integrationsbranch erstellen.

Nicht im Scope:

- zusätzliche Architekturhärtung aus Arbeitsblock B
- Fork-main-Merge
- Push zu `upstream`
- Produktion

Akzeptanzkriterien:

- `git ls-files -u` ist leer.
- Keine Konfliktmarker verbleiben.
- Upstream-SHA ist Parent des Merge-Commits.
- `server/db.js`, OpenAPI, Router, Service Worker und Locales wurden nicht nur textuell, sondern semantisch geprüft.
- Syntax-, JSON- und Lockfile-Basischecks bestehen.

Prüfung:

- `git diff --check`
- `node --check server/db.js`
- `node --check server/db-schema-test.js`
- alle Locale-JSON-Dateien parsen
- `npm ls --depth=0`

Stop-Gate: Merge-Commit und Befunde übergeben. Keine Behauptung vollständiger Funktionsfreigabe; `YUV-UP-003` benötigt separate Freigabe.

## YUV-UP-003 — Kategorien und Einkaufslisten-Reordering

Status: `planned`

Abhängigkeiten: `YUV-UP-002 implemented_by_agent` und ausdrücklich freigegeben

Ziel: Upstream-Kategorien-UX vollständig übernehmen und die unabhängige Fork-Listenreihenfolge erhalten.

In Scope:

- Einkauf auf den gemeinsamen `yuvomi-category-manager` umstellen.
- Veralteten speziellen Shopping-Category-Manager entfernen.
- Upstream-Drag-and-drop, Keyboard-Up/Down, Live-Announcements und Serverfehler-Rollback erhalten.
- Fork-Vertrag für `shopping_lists.sort_order`, `PATCH /shopping/reorder` und Default-Liste erhalten.
- Kategorie- und Listen-Reorder als getrennte API- und UI-Verträge testen.

Nicht im Scope:

- Pantry- oder Cooking-Verhaltensänderungen
- neue Kategorie-Funktionen
- Redesign außerhalb der übernommenen Upstream-Änderungen

Akzeptanzkriterien:

- Kategorien können in Shopping, Tasks, Kontakte und Budget konsistent verwaltet werden.
- Kategorie-Reordering funktioniert per Maus/Touch und Tastatur.
- Ein fehlgeschlagener Reorder stellt die Serverreihenfolge wieder her.
- Ganze Einkaufslisten bleiben frei sortierbar und die Default-Liste bleibt stabil.
- Kategorie-Löschschutz und Fallback-Kategorie funktionieren weiterhin.

Prüfung:

- `npm run test:category-manager`
- `npm run test:task-categories`
- `npm run test:contact-categories`
- `npm run test:shopping`
- neue fokussierte Tests für Kategorie- und Listen-Reorder
- Browser: Desktop, Tablet, Mobil und Tastatur

Stop-Gate: Ergebnisse übergeben; keine Kitchen-Folgearbeit beginnen.

## YUV-UP-004 — Kitchen-Verträge auf der neuen Upstream-Basis

Status: `planned`

Abhängigkeiten: `YUV-UP-003 implemented_by_agent` und ausdrücklich freigegeben

Ziel: Pantry-, Shopping- und Cooking-Funktionen vollständig gegen die neue Upstream-UI und API-Basis absichern.

In Scope:

- strukturierte Mengen in Recipes, Meals und Shopping erhalten;
- Shopping-Provenance und Meal-Plan-Import erhalten;
- Shopping-to-Pantry inklusive Idempotenz und Undo erhalten;
- Pantry-Lots und immutable Inventory Movements erhalten;
- Cooking Preview, manuelle Multi-Lot-Allokation, Missing-to-Shopping und Undo erhalten;
- neue Upstream-UX für Meals, Recipes und Shopping fachlich kombinieren;
- Berechtigungen und Transaktionsgrenzen prüfen.

Nicht im Scope:

- neue Pantry-Funktionen
- automatische Mengen- oder Einheitenerkennung
- Änderung bestehender Bestandshistorie

Akzeptanzkriterien:

- Normales Shopping-Abhaken erzeugt keinen Bestand.
- Bestandsänderungen erfolgen nur nach expliziter Bestätigung.
- Wiederholte Requests erzeugen keine doppelten aktiven Transfers oder Cooking Events.
- Undo erzeugt Gegenbewegungen und löscht keine Historie.
- Freitextmengen bleiben exakt erhalten.
- Fehlende Berechtigungen verhindern jede Teilmutation.

Prüfung:

- `npm run test:quantity`
- `npm run test:kitchen-workflow`
- `npm run test:shopping-pantry`
- `npm run test:pantry`
- `npm run test:meal-cooking`
- `npm run test:meals`
- `npm run test:shopping`
- fokussierte Permission-, Rollback- und Idempotenztests

Stop-Gate: Übergabe ohne OpenAPI-/PWA-Folgetask.

## YUV-UP-005 — OpenAPI, Security und Abhängigkeiten

Status: `planned`

Abhängigkeiten: `YUV-UP-004 implemented_by_agent` und ausdrücklich freigegeben

Ziel: Die modulare Upstream-OpenAPI-Struktur und Security-Härtungen übernehmen, ohne Fork-Endpunkte oder Scopes zu verlieren.

In Scope:

- Upstream-OpenAPI-Modulstruktur als Basis verwenden.
- Pantry als eigenes Path-Modul dokumentieren.
- Shopping-/Meals-Kitchen-Erweiterungen ohne Verlust bestehender Methoden und Beschreibungen ergänzen.
- State-changing-Markierungen, Permissions, Token-Scopes und MCP-Verträge prüfen.
- zentralen Upstream-SSRF-Schutz und nativen HTTP-Client übernehmen.
- `node-fetch` nur entfernen, wenn keine Runtime- oder Testimporte verbleiben.
- `express-rate-limit` und Lockfile konsistent übernehmen.

Nicht im Scope:

- unabhängige Dependency-Major-Upgrades
- neue öffentliche API-Endpunkte
- Security-Redesign außerhalb der Upstream-Änderungen

Akzeptanzkriterien:

- Generierte OpenAPI enthält alle Upstream- und Fork-Pfade genau einmal.
- Pantry-, Shopping-to-Pantry- und Cooking-Endpunkte sind vollständig dokumentiert.
- Alle schreibenden Fork-Endpunkte tragen korrekte Auth-/Scope-Verträge.
- SSRF-Tests decken Redirects, Sondernetze und IPv4-mapped IPv6 ab.
- Kein ungenutztes `node-fetch` verbleibt.

Prüfung:

- OpenAPI-Strukturtest
- `npm run test:mcp`
- `npm run test:token-scopes`
- `npm run test:permissions`
- Upstream-SSRF- und HTTP-Tests
- `npm ls --depth=0`

Stop-Gate: Übergabe ohne UI-/PWA-Folgetask.

## YUV-UP-006 — Router, PWA, CSS und Locales

Status: `planned`

Abhängigkeiten: `YUV-UP-005 implemented_by_agent` und ausdrücklich freigegeben

Ziel: Alle sichtbaren Upstream-Änderungen und Fork-Kitchen-Oberflächen konsistent verdrahten.

In Scope:

- Pantry-Route und Kitchen-Tabs im neuen Upstream-Router erhalten.
- Service-Worker-Assets und Network-only-Regeln fachlich zusammenführen.
- Upstream-Layout-/UX-/Accessibility-Änderungen übernehmen.
- Fork-Kitchen-CSS ohne Überschreiben neuer Upstream-Regeln erhalten.
- alle 23 Locale-Dateien parsen und Key-Parität prüfen;
- Upstream- und Fork-Keys gemeinsam erhalten.
- Datepicker-Fix beider Linien kombinieren.

Nicht im Scope:

- neues visuelles Redesign
- neue Übersetzungen außerhalb vorhandener Keys
- Architekturarbeit aus Arbeitsblock B

Akzeptanzkriterien:

- Direkter Aufruf und Reload von `/pantry` bleiben auf Pantry.
- Kein veralteter PWA-Cache liefert alte dynamische Module.
- Alle Locale-Dateien haben dasselbe erwartete Keyset.
- Keine sichtbaren Texte sind neu hartcodiert.
- Desktop, Tablet und Mobil haben keinen horizontalen Überlauf oder unerreichbare Aktionen.

Prüfung:

- `npm run test:datepicker`
- `npm run test:kitchen-tabs`
- `npm run test:sw-api-cache`
- `npm run test:frontend-audit`
- `npm run test:mobile-scroll-layout`
- `npm run test:typography`
- Locale-JSON- und Key-Paritätstest
- vollständige Browsermatrix

Stop-Gate: Übergabe ohne vollständige Release-Abnahme.

## YUV-UP-007 — Vollständige Integrationsverifikation

Status: `planned`

Abhängigkeiten: `YUV-UP-006 implemented_by_agent` und ausdrücklich freigegeben

Ziel: Den gesamten Integrationsbranch als zusammenhängendes Release prüfen und ausschließlich zum Fork pushen.

In Scope:

- frische Datenbank bis zum integrierten Höchststand migrieren;
- realistische Kopie einer Fork-Schema-93-Datenbank migrieren;
- Pantry-/Cooking-Bestände vor und nach Upgrade vergleichen;
- SQLite-Integrität und Foreign Keys prüfen;
- vollständiges `npm test` mit sauberem Prozessende ausführen;
- vollständige Browsermatrix und Console-/Page-Error-Prüfung;
- Integrationsbranch zu `origin` pushen;
- vollständigen Handoff und Session-Record erstellen.

Nicht im Scope:

- Merge nach Fork-`main`
- Produktionseinsatz
- Architekturhärtung aus Arbeitsblock B

Akzeptanzkriterien:

- alle fokussierten Tests und `npm test` bestehen mit Exit-Code 0;
- keine offenen Migration-, Datenintegritäts-, Permission- oder PWA-Findings;
- Branch ist sauber und zu `origin` gepusht;
- `upstream` wurde nicht beschrieben;
- alle bekannten Risiken und bewusst nicht unterstützten Upgradepfade sind dokumentiert.

Stop-Gate: Auf externe Review und Benutzerentscheidung warten.

## YUV-UP-008 — Externe Review und Fork-main-Freigabe

Status: `planned`

Abhängigkeiten: `YUV-UP-007 implemented_by_agent`

Ziel: Integration unabhängig gegen Scope, Migrationen, Tests und kritische Datenflüsse prüfen.

In Scope:

- Merge-Commit, Konfliktauflösungen und Folgecommits reviewen;
- Migrationslineage und beide Upgradepfade prüfen;
- Category/List-Reorder, Pantry und Cooking direkt im Code prüfen;
- Testevidenz und Browserbefunde bewerten;
- Findings beheben lassen oder Akzeptanz dokumentieren;
- nur bei ausdrücklicher Benutzerfreigabe mit `--no-ff` nach Fork-`main` mergen und `origin/main` pushen.

Nicht im Scope:

- Selbstakzeptanz durch die implementierende Instanz
- Produktion
- Beginn von Arbeitsblock B

Akzeptanzkriterien:

- Review-Eintrag in `.agent/ACCEPTANCE_LOG.md`.
- `main...origin/main` ist nach einem freigegebenen Merge `0 0`.
- Working Tree ist sauber.
- Upstream-Ziel-SHA ist in der Merge-Historie enthalten.
- Kein Schreibvorgang gegen `upstream`.

Stop-Gate: Arbeitsblock B und Produktion benötigen jeweils neue Freigabe.

## YUV-UP-009 — Optionaler Produktionseinsatz

Status: `planned`

Abhängigkeiten: `YUV-UP-008 accepted` und ausdrückliche Produktionsfreigabe

Ziel: Die akzeptierte Fork-Version backup- und rollbackfähig produktiv ausrollen.

In Scope:

- aktives Ziel und Deploymentpfad live verifizieren;
- vollständiges wiederherstellbares Backup erstellen;
- Image/Stack aktualisieren und Migration ausführen;
- Health, HTTP, SQLite, Foreign Keys und Kitchen-Bestände prüfen;
- Browser-Smoke für Dashboard, Shopping, Meals und Pantry;
- Rollbackbereitschaft bis zur Abnahme erhalten.

Nicht im Scope:

- ungesicherte Änderungen anderer Homelab-Dienste
- Löschen des Backups
- Architekturhärtung aus Arbeitsblock B

Akzeptanzkriterien:

- Backup und Rollbackweg sind dokumentiert und auffindbar.
- App ist gesund und zentrale Seiten liefern erfolgreich.
- SQLite `integrity_check` ist `ok`, Foreign-Key-Verletzungen sind null.
- Pantry-/Movement-/Cooking-Zählwerte sind plausibel und erhalten.
- Produktions-Handoff enthält Image-/Commit- und Schema-Stand.

---

# Arbeitsblock B: Künftige Updates vereinfachen

Dieser Arbeitsblock beginnt erst nach akzeptiertem v1.43.0-Update. Er wird auf `refactor/upstream-update-boundaries` umgesetzt und nicht mit dem Upstream-Merge vermischt.

## YUV-MNT-001 — Stabile Migrationsidentitäten

Status: `planned`

Abhängigkeiten: `YUV-UP-008 accepted`

Ziel: Fork- und Upstream-Migrationen anhand stabiler Herkunftsidentitäten statt nur kollisionsanfälliger Nummern verfolgen.

In Scope:

- rückwärtskompatibles Schema für stabile Migration-Keys entwerfen und implementieren;
- bestehende Einträge 1–93 eindeutig und ohne Änderung ihrer veröffentlichten Bedeutung zuordnen;
- Schlüsselkonventionen wie `upstream:<version>` und `fork:<feature>` einführen;
- Upstream- und Fork-Registry trennen;
- Runner, Statusausgabe und Tests auf Key-basierte Anwendung umstellen;
- doppelte Keys, abweichende Fingerprints und still übersprungene Migrationen verhindern.

Nicht im Scope:

- Änderung bereits ausgeführter Business-Schemata
- Support für unbekannte, separat upstream-migrierte Kollisionsdatenbanken ohne eigene Entscheidung
- weitere Kitchen-Funktionen

Akzeptanzkriterien:

- bestehende Fork-Datenbank migriert ohne erneutes Ausführen alter Migrationen;
- frische DB erhält dasselbe fachliche Endschema;
- eine neue Upstream-Migration kann trotz gleicher historischer Nummer korrekt erkannt werden;
- Migration-Key und SQL-/Description-Fingerprint sind testbar;
- Wiederholung ist idempotent.

Stop-Gate: Externe Review vor weiteren Boundary-Änderungen.

## YUV-MNT-002 — Modulare Backend- und OpenAPI-Erweiterungsgrenzen

Status: `planned`

Abhängigkeiten: `YUV-MNT-001 accepted`

Ziel: Fork-Kitchen-Code aus häufig geänderten Upstream-Dateien herausziehen.

In Scope:

- Pantry-, Cooking-, Quantity- und Provenance-Routen/Services klar als Fork-Module registrieren;
- Fork-OpenAPI-Pfade in eigene Module verschieben;
- Path-Fragmente methodensicher zusammenführen, ohne gleichnamige Routenobjekte zu überschreiben;
- Permissions, Scopes und MCP-Metadaten aus derselben registrierten Moduldefinition ableiten, wo bestehende Muster dies erlauben;
- Layer-Boundary-Tests ergänzen.

Nicht im Scope:

- Änderung öffentlicher URLs oder Response-Verträge
- neues Plugin-Framework für Drittanbieter
- Frontend- oder Locale-Umbau

Akzeptanzkriterien:

- bestehende API-Verträge bleiben identisch;
- Fork-OpenAPI benötigt keine Änderungen an Upstream-Domain-Dateien;
- Router-Reihenfolge und spezifische Pfade vor `/:id` sind getestet;
- Kitchen- und Permission-Suiten bleiben grün.

Stop-Gate: Externe Review vor Frontend-Entkopplung.

## YUV-MNT-003 — Frontend-, CSS-, Locale- und PWA-Registries

Status: `planned`

Abhängigkeiten: `YUV-MNT-002 accepted`

Ziel: Fork-UI-Erweiterungen deklarativ registrieren und Änderungen an Upstream-Hotspots deutlich reduzieren.

In Scope:

- zentrale Fork-Moduldefinition für Route, Navigation, Permissions und PWA-Assets;
- Pantry-, Shopping-Transfer- und Cooking-UI in eigene Komponenten/Module extrahieren;
- Fork-Kitchen-CSS aus Upstream-Seitenstyles lösen;
- Kitchen-i18n als validierte Locale-Overlays laden und mit Upstream-Locales zusammenführen;
- Router-Reload, Service Worker und Key-Parität testen.

Nicht im Scope:

- visuelles Redesign
- Änderung bestehender URLs
- neue PWA-Caching-Strategie außerhalb der Fork-Module

Akzeptanzkriterien:

- Pantry kann über eine einzige Moduldefinition vollständig registriert werden.
- Fork-Kitchen-Keys müssen nicht mehr direkt in allen Upstream-Locale-Dateien liegen.
- Shopping-/Meals-Upstreamdateien enthalten nur kleine, dokumentierte Erweiterungspunkte.
- Browser- und PWA-Verhalten bleibt unverändert oder verbessert.

Stop-Gate: Externe Review vor Audit-Automatisierung.

## YUV-MNT-004 — Automatischer Upstream-Audit

Status: `planned`

Abhängigkeiten: `YUV-MNT-003 accepted`

Ziel: Vor einem Merge automatisch die konflikt- und lineage-relevanten Unterschiede berichten.

In Scope:

- read-only Script unter `scripts/` oder `tools/`;
- Parameter für Upstream-Ref/SHA;
- Bericht zu Divergenz, Dateischnittmenge und bekannten Hotspots;
- Migration-Key-, Versions- und Fingerprint-Prüfung;
- OpenAPI-Pfad- und Methodenüberschneidungen;
- Locale-Key- und Overlay-Parität;
- Router-, Modul- und Service-Worker-Registrierungen;
- Dependency- und Lockfile-Diff;
- klarer Nonzero-Exit bei Blockern und maschinenlesbarer Bericht für Tests.

Nicht im Scope:

- automatischer Merge oder Konfliktauflösung
- Push, PR oder Branch-Erstellung
- Codegenerierung, die Produktdateien ungefragt verändert

Akzeptanzkriterien:

- Script verändert Working Tree und Git-Refs nicht.
- Bekannte v1.22.2→v1.43.0-Migrationskollision wird zuverlässig erkannt.
- Ein sauberer unveränderter Vergleich ist reproduzierbar.
- Tests decken Blocker und erfolgreiche Prüfung ab.
- Upstream-Master-Prompt verweist auf das Audit-Script.

Stop-Gate: Härtungsbranch zur vollständigen Review übergeben.

## YUV-MNT-005 — Review und Wirksamkeitsnachweis der Update-Härtung

Status: `planned`

Abhängigkeiten: `YUV-MNT-004 implemented_by_agent`

Ziel: Nachweisen, dass die Architekturänderungen spätere Updates tatsächlich vereinfachen und keine Verträge brechen.

In Scope:

- vollständige Test- und Browsermatrix;
- frische und bestehende DB testen;
- Audit-Script gegen bekannte alte und aktuelle Upstream-Stände ausführen;
- verbleibende Fork-Änderungen in Upstream-Hotspots messen und dokumentieren;
- externe Review und gegebenenfalls freigegebener Fork-main-Merge.

Nicht im Scope:

- neues Upstream-Featureupdate
- Produktion ohne eigene Freigabe

Akzeptanzkriterien:

- alle bestehenden Fork-Verträge bleiben grün;
- künftige Migrationskollisionen werden vor dem Merge sichtbar;
- Locale-, OpenAPI-, Router- und PWA-Erweiterungen sind getrennt prüfbar;
- verbleibende bewusste Upstream-Hotspots sind dokumentiert;
- Akzeptanz ist in `.agent/ACCEPTANCE_LOG.md` festgehalten.

Stop-Gate: Keine weitere Roadmap-Arbeit ohne neuen Benutzerauftrag.
