# Kitchen Workflow Memory

Stand: 2026-07-14
Verbindliche Arbeitsbasis für das Kitchen-Workflow-Vorhaben. Erkenntnisse, Entscheidungen und Handovers gehören in diese Datei, nicht ausschließlich in Agent-Chats.

## 1. Projektziel

Der gewünschte durchgängige Ablauf lautet:

```text
Rezept
→ Essensplan
→ Einkaufsliste
→ gekauft
→ Vorrat
→ gekocht
→ Vorrat reduziert
```

Die Erweiterung bleibt im bestehenden Stack aus Node.js, Express, SQLite/SQLCipher, Vanilla-JavaScript, Plain CSS, projektinternem i18n und regulären Yuvomi-Migrationen. Bestehende Daten und APIs bleiben rückwärtskompatibel.

## 2. Verifizierte Repository-Baseline

- Repository-Root: `C:/Users/Fredi/Documents/Yuvomi 2`
- Fork-Remote: `origin = https://github.com/lossus/yuvomi.git`
- Upstream-Remote: `upstream = https://github.com/ulsklyc/yuvomi.git`
- Baseline-Commit: `e8e799bc` (`chore: release v1.19.1`)
- `main` war am 2026-07-13 ohne Abweichung zu `upstream/main`.
- Planungsbranch: `planning/kitchen-workflow`
- Task 1 wurde als Commit `7e6ce49d` über PR #2 in den Fork-`main` gemergt; Merge-Commit: `b524dbc2`. Die Planungsdokumentation wurde zuvor über PR #1 gemergt.

Vollständig gelesene Baseline-Dokumente:

- `README.md`, `README.de.md`, `CONTRIBUTING.md`
- `docs/SPEC.md`, `MODULES.md`, `BACKLOG.md`, `CHANGELOG.md`
- `package.json`

Analysierte Implementierungsbereiche:

- DB/Migrationen: `server/db.js`, `server/db-schema-test.js`
- Backend: `server/routes/meals.js`, `server/routes/recipes.js`, `server/routes/shopping.js`, `server/routes/dashboard.js`, `server/routes/housekeeping.js`, `server/services/shopping-import.js`, `server/services/meal-recurrence.js`, `server/services/caldav-reminders-sync.js`, `server/mcp/tools.js`, `server/openapi.js`, `server/scopes.js`, `server/index.js`
- Frontend: `public/pages/meals.js`, `public/pages/recipes.js`, `public/pages/shopping.js`, `public/components/modal.js`, `public/components/datepicker.js`, `public/components/shopping-category-manager.js`, `public/utils/ingredient-row.js`, `public/utils/kitchen-tabs.js`, `public/utils/date.js`, `public/router.js`, `public/settings/pages/modules-kitchen.js`
- Styling/PWA/i18n: `public/styles/meals.css`, `public/styles/recipes.css`, `public/styles/shopping.css`, `public/styles/datepicker.css`, `public/styles/kitchen-tabs.css`, `public/sw.js`, `public/i18n.js`, alle 23 Dateien unter `public/locales/`
- Tests: `test/test-meals.js`, `test/test-shopping.js`, `test/test-db.js`, `test/test-datepicker.js`, `test/test-kitchen-tabs.js`, `test/test-settings-navigation.js`, `test/test-sw-api-cache.js`, `test/test-frontend-audit.js`, `test/test-mcp.js`, `test/test-caldav-reminders.js`, `test/test-housekeeping.js`

## 3. Aktueller Ist-Zustand

### Meals

- Tabellen: `meals`, `meal_ingredients`, `meal_recurrence_templates`, `meal_recurrence_ingredients`, `meal_recurrence_exceptions`.
- `meals` speichert ISO-Datum, Mahlzeittyp, Titel, Notizen, optionale `recipe_url`, optionale `recipe_id` und optionalen Serienbezug.
- `POST /api/v1/meals` validiert Rezeptbezug und erstellt Mahlzeit, Zutaten und optionales Wiederholungstemplate bereits in einer DB-Transaktion.
- `POST /api/v1/meals/apply-plan` schreibt mehrere Zuweisungen transaktional.
- `POST /api/v1/meals/:id/to-shopping-list` und `POST /api/v1/meals/week-to-shopping-list` importieren noch nicht übertragene `meal_ingredients` in einer separaten Transaktion.
- `meal_ingredients.on_shopping_list` verhindert derzeit einen erneuten Import derselben Zutat, bildet aber weder Zielliste noch mehrere Importe oder eine belastbare Herkunft ab.
- Ein Rezept wird im Frontend mit `mealPayloadFromRecipe()` in eine neue Mahlzeit kopiert; die Rezeptzutaten werden zu eigenständigen `meal_ingredients`-Snapshots.
- Wiederkehrende Mahlzeiten speichern zusätzlich Zutaten im Template und materialisieren Instanzen. Das spätere Einkaufs-/Kochverhalten muss explizit zwischen Startinstanz, zukünftigen Instanzen und Serie unterscheiden.
- KWF-009 ergänzt für jede konkrete Meal-Instanz einen read-only Kochvorschlag sowie bestätigte Koch- und Undo-Endpunkte. `GET`-Antworten enthalten additiv `cooking_event`; ein aktives Event blockiert das Löschen der Instanz beziehungsweise einer betroffenen Serie.

### Recipes

- Tabellen: `recipes`, `recipe_ingredients`; eingeführt durch Migration 13.
- CRUD unter `/api/v1/recipes`; Rezept und Zutaten werden gemeinsam transaktional erstellt bzw. ersetzt.
- `public/pages/recipes.js` navigiert bei „Zum Essensplan“ nach `/meals?recipe=<id>`.
- `public/pages/meals.js` öffnet daraufhin das vorhandene Mahlzeitenmodal für heute, wählt den ersten sichtbaren Mahlzeittyp und kopiert Rezeptdaten/Zutaten in den Dialog.
- Das Rezept bleibt über `meals.recipe_id` verknüpft; spätere Rezeptänderungen überschreiben bestehende Mahlzeitenzutaten nicht.

### Shopping

- Tabellen: `shopping_lists`, `shopping_items`, `shopping_categories`.
- `shopping_items.quantity` ist Freitext. `added_from_meal` erlaubt nur genau einen Mahlzeitenbezug und wird bei Löschen der Mahlzeit `NULL`.
- `PATCH /api/v1/shopping/items/:itemId` setzt unter anderem `is_checked`; das schnelle Abhaken bleibt unverändert. KWF-008 ergänzt danach eine getrennte, ausdrücklich bestätigte Übernahmeaktion.
- `POST /api/v1/shopping/:listId/import-meal-plan` importiert einen Datumsbereich. `aggregateMealIngredients()` gruppiert gleiche Namen/Kategorien/Einheiten, wenn eine numerische Präfixmenge erkannt wird.
- Wenn eine aggregierte Position aus mehreren Mahlzeiten stammt, wird `added_from_meal` bewusst `NULL`; Herkunft geht damit verloren.
- Task-1-Arbeitsstand ergänzt Migration 86, `sort_order`, deterministische Legacy-Migration, zentralen Default-Listen-Helper, Reorder-API, responsive Reorder-UI und vollständige Locale-Texte. Der Benutzer hat die Funktion manuell bestätigt.
- KWF-003 ergänzt Migration 87 und `shopping_item_sources`. Einzel-, Wochen- und Bereichsimport erzeugen Einkaufsartikel, Herkunftssnapshot und Transfer-Flag atomar. Der Bereichsimport legt bis KWF-006 jede Freitextzutat getrennt an. REST-Antworten für Einkaufsartikel enthalten rückwärtskompatibel `sources: []`; die UI zeigt eine Quelle inline und mehrere Quellen in einem nativen, zugänglichen Aufklapper.
- KWF-006 ergänzt mit Migration 88 optionale `amount REAL`/`unit TEXT`-Felder in allen drei Ingredient-Tabellen und `shopping_items`. `quantity TEXT` bleibt unverändert. Nur `g`/`kg` sowie `ml`/`l` werden dimensionsgleich aggregiert; Freitext und inkompatible Einheiten bleiben getrennte Positionen mit allen Quellen.
- Default-Verbraucher im Task-1-Stand: Shopping-GET, Meals-Listenauswahl über sortierte API-Reihenfolge, MCP, Housekeeping und CalDAV-Reminders.

### Datenmodell

- Mengen sind in `recipe_ingredients`, `meal_ingredients`, `meal_recurrence_ingredients` und `shopping_items` weiterhin als `quantity TEXT` gespeichert und seit Migration 88 additiv über optionale `amount REAL`/`unit TEXT` strukturiert. Bestehende Freitextwerte wurden nicht zurückgefüllt oder interpretiert.
- Es gibt weiterhin kein Zutatenstammdatenmodell. Seit Migration 89 existieren Pantry-Lose und ein unveränderliches Bewegungsjournal; Migration 90 ergänzt den optionalen Shopping-Bezug für Kaufzugänge. Migration 91 ergänzt Cooking-Events, Zutaten-/Allokationssnapshots und den optionalen `cooking_event_id`-Bezug des Journals.
- Kategorien sind bei Zutaten/Artikeln als Text gespeichert; Shopping-Kategorien sind administrierbar und sortierbar.
- Zeitstempel und `updated_at`-Trigger folgen einem etablierten Muster. Migrationen sind fortlaufend versioniert und werden jeweils transaktional in `schema_migrations` registriert.

### Frontend

- Kitchen ist eine gemeinsame Navigation aus `/meals`, `/recipes`, `/shopping`, `/pantry`; Definitionen liegen in `public/router.js` und `public/utils/kitchen-tabs.js`.
- Formulare verwenden das gemeinsame Modal aus `public/components/modal.js` und gemeinsame Ingredient-Row-Struktur aus `public/utils/ingredient-row.js`.
- KWF-006 erweitert die gemeinsame Ingredient-Row sowie Shopping-Quick-Add und -Details um manuell korrigierbare strukturierte Mengen. `public/utils/quantity.js` enthält die gemeinsame Browser-Validierung, Konvertierung und Anzeigeformatierung.
- Der gewünschte Microkalender ist in `public/components/datepicker.js` vorhanden. KWF-005 öffnet den Monatskalender mit Heute-/Auswahlmarkierung, Monatsnavigation und Tastatursteuerung für `type="date"` jetzt auf Desktop, Tablet und Smartphone; nur `type="time"` darf auf groben Pointern weiter den nativen Picker verwenden. Der Wert bleibt ISO `YYYY-MM-DD`.
- Der Rezept→Essensplan-Flow nutzt `<yuvomi-datepicker type="date">` im bestehenden Meal-Modal. KWF-005 änderte deshalb ausschließlich die gemeinsame Datepicker-Integration und keine Meals-/Recipes-/Modal-Implementierung.
- Shopping-Abhaken erfolgt weiter per Klick, Tastatur oder Swipe. Abgehakte Artikel bieten bei kombiniertem `shopping:write`- und `pantry:write`-Zugriff zusätzlich den expliziten Transferdialog; „nur abhaken“ bleibt möglich.
- KWF-009 ergänzt auf Meal-Karten bei kombiniertem `meals:write`- und `pantry:write`-Zugriff „Als gekocht markieren“, einen Shared-Modal-Review mit editierbaren Mehrfachlos-Allokationen und optionaler Missing→Shopping-Auswahl sowie sichtbaren Gekocht-Status und Undo.

### Tests

- Meals und Shopping haben kombinierte DB-, API-nahe und statische Frontend-Tests.
- Eigene Suiten existieren für DB-Migrationen, Datepicker, Kitchen-Tabs, Service-Worker-Cache, Navigation, MCP, Housekeeping und CalDAV.
- Task 1 wurde zuletzt erfolgreich geprüft mit: Shopping 51/51, DB 38/38, MCP 29/29, CalDAV-Reminders 9/9, Housekeeping 13/13, Meals 39/39, Frontend-Audit 141/141.
- KWF-006 ergänzt die eigenständige Suite `npm run test:quantity` und erweitert DB-, Shopping- und Meals-Regressionen um Migration 88, API-Validierung, Snapshot-Propagation und Quellenaggregation.
- KWF-008 ergänzt `npm run test:shopping-pantry` für atomaren Transfer, Berechtigungen, Idempotenz, Undo/Redo, Freitextbestätigung und Rollback.
- KWF-009 ergänzt `npm run test:meal-cooking` für read-only Preview, Rechte, FIFO-Vorschläge, Mehrfachlose, Parallelbestätigung, Undo, Freitextgrenze, Missing→Shopping, Rollback, Rekurrenz und Lösch-/Snapshotverhalten.
- KWF-010 ergänzt `npm run test:kitchen-workflow`: produktives Upgrade einer belegten v85-DB bis v91, ein gemeinsamer Route-Level-Flow Recipe→Meal→Shopping→Pantry→Cook mit Purchase-/Cooking-Undo und erzwungenem Rollback sowie Verträge für OpenAPI, Scopes/Permissions, PWA und exakte Key-Parität aller 23 Locales.
- `npm test` ist auf Windows/Node 24.12.0 nach erfolgreichem `test:task-categories` durch eine Node/libuv-Assertion abgebrochen; siehe KWF-FINDING-009.

### i18n

- `public/i18n.js` unterstützt 23 Sprachen. Deutsch ist Fallback; Auflösung ist aktive Sprache → Deutsch → Schlüssel.
- Sichtbare neue Texte müssen mindestens Deutsch/Englisch semantisch vollständig und nach Projektkonvention in allen Locale-Dateien vorhanden sein.
- Tests prüfen bei gemeinsam genutzten Komponenten wie Datepicker explizit Namespace- und Key-Parität über alle Locales.

### Service Worker

- `public/sw.js` cached statische Seiten/Komponenten explizit und read-only GET-API-Pfade über eine Whitelist.
- Mutationen werden nicht offline gecached.
- Neue Pantry-Seite/Styles/Komponenten müssen in die statischen Listen aufgenommen werden. Ein Pantry-GET darf erst nach bewusster Datenschutz-/Staleness-Entscheidung in `API_CACHE_WHITELIST` aufgenommen werden.

## 4. Angegriffene Bereiche

| Datum | Agent | Branch/Task | Datei/Bereich | Änderung/Analyse | Status | Offene Punkte |
|---|---|---|---|---|---|---|
| 2026-07-13 | Hauptagent | KWF-001 / `planning/kitchen-workflow` | Baseline-Dokumente | Vollständig gelesen; Architektur- und Beitragskonventionen erfasst | abgeschlossen | keine |
| 2026-07-13 | Hauptagent | KWF-001 | DB/Migrationen | Tabellen, FKs, Migrationen 13/64/86 und Transaktionsmuster analysiert | abgeschlossen | geplante Migrationen erst je Task nummerieren |
| 2026-07-13 | Hauptagent | KWF-001 | Meals/Recipes/Shopping Backend | CRUD, Importpfade, Default-Liste, Rekurrenz und Fehlergrenzen kartiert | abgeschlossen | Details in Tasks KWF-003–009 |
| 2026-07-13 | Hauptagent | KWF-001 | Frontend/i18n/PWA | Modals, Datepicker, Navigation, Responsive-Pfade, 23 Locales und SW analysiert | abgeschlossen | Pantry-Offline-Verhalten entscheiden |
| 2026-07-13 | Hauptagent | KWF-002 / `feature/shopping-list-order` | Task-1-Dateien laut Handoff | Implementierung analysiert, funktional bestätigt, committed und über Fork-PR #2 gemergt | abgeschlossen | keine; KWF-003 ist nächster Implementierungstask |
| 2026-07-13 | Hauptagent | KWF-001 | `docs/development/KITCHEN_WORKFLOW_MEMORY.md` | Zentrale Wissensbasis angelegt | abgeschlossen | bei jeder Session fortschreiben |
| 2026-07-13 | Hauptagent | KWF-001 | `docs/development/KITCHEN_WORKFLOW_PLAN.md` | Vollständige Task-Zerlegung angelegt | abgeschlossen | Architekturvorschläge im Review bestätigen |
| 2026-07-13 | Hauptagent | KWF-001 / Agent-Handoff | `docs/development/KITCHEN_WORKFLOW_TASK_MASTER_PROMPT.md` | Wiederverwendbaren, taskgebundenen Startprompt mit Reservierungs-, Analyse-, Test-, Memory- und Git-Gates angelegt | abgeschlossen | pro Session Task-ID und optional Branch/Vorgaben einsetzen |
| 2026-07-13 | Codex | KWF-003 / `feature/shopping-item-sources` | Migration 87, Source-Service, alle drei Importpfade, Shopping-API/-UI/-CSS, OpenAPI, SPEC/Task-2-Analyse, Locales und Tests | Mehrquellenfähige Herkunft mit löschfesten Snapshots implementiert und verifiziert | extern akzeptiert; Commit `073c4d06` gepusht und ohne PR in Fork-`main` integriert | `upstream/main` bleibt 7/8 divergent und unverändert, KWF-FINDING-013 |
| 2026-07-13 | Codex | KWF-004 / `feature/recipe-meal-shopping-import` | `server/services/meal-shopping-import.js`, `server/routes/meals.js`, `server/openapi.js`, `public/pages/meals.js`, `public/styles/meals.css`, alle 23 Locale-Dateien, `test/test-meals.js`, `test/test-shopping.js`, `docs/SPEC.md`, `docs/TASK2_RECIPE_MEAL_SHOPPING_ANALYSIS.md`, `CHANGELOG.md` und Kitchen-Doku | Atomaren Create-und-Import-Flow mit expliziter Listenauswahl implementiert, dokumentiert und verifiziert | abgeschlossen; Feature-Commit `1de88813` und finaler Handoff-Abschluss zu `origin` gepusht | Benutzeränderung im KWF-005-Abschnitt von `KITCHEN_WORKFLOW_PLAN.md` ist im Feature-Commit enthalten, ohne KWF-005 zu implementieren; Fork-`main` vs. `upstream/main` bleibt 9/8 divergent; keine Überschneidung mit aktiver Fremdreservierung |
| 2026-07-13 | Codex | KWF-005 / `fix/mobile-recipe-meal-datepicker` | Vollständig untersucht: Datepicker JS/CSS, Meals/Recipes, Shared Modal und relevante Layout-/Glass-/Meals-Styles, SW, SPEC, Tests; geändert: Datepicker JS/CSS, Datepicker-/Meals-/UX-Tests, SPEC, Changelog und Kitchen-Memory | Gemeinsamen Microkalender auf groben Pointern aktiviert, Viewport begrenzt, Home/End ergänzt sowie Recipe-Query/ISO-Vertrag verifiziert | abgeschlossen; Feature-Commit `7ca92ac8` zu `origin` gepusht, finaler Handoff folgt als separater Doku-Commit | keine aktive Fremdreservierung; KWF-004 abgeschlossen; Fork-`main` vs. `upstream/main` live 12/8 divergent, daher kein Upstream-Merge; kein Folge-Task begonnen |
| 2026-07-14 | Codex | KWF-006 / `feature/structured-ingredient-quantities` | Untersucht und geändert: Migration 88/Schema-Test, Quantity-Utilities/-Service, Meals-/Recipes-/Shopping-Routen und -Services, drei Kitchen-Seiten, Ingredient-Row, Layout/Shopping-CSS, alle 23 Locales, OpenAPI, SPEC, Changelog, Plan, Package-Script und DB/Meals/Shopping/Quantity-Tests | Additive Mengenbasis, deterministische dimensionsgleiche Aggregation, manuelle Korrektur und rückwärtskompatible Freitextpfade implementiert, dokumentiert und verifiziert | abgeschlossen; Feature-Commit `76475386` und Handoff-Commits zu `origin` gepusht | keine aktive Fremdreservierung; KWF-003 bis KWF-005 abgeschlossen; Fork-`main` vs. `upstream/main` live 15/10 divergent, daher kein Upstream-Merge; bestätigte Benutzeränderung in `KITCHEN_WORKFLOW_TASK_MASTER_PROMPT.md` ist isoliert und blieb unstaged |
| 2026-07-14 | Codex | KWF-007 / `feature/pantry-mvp` | Untersucht und geändert: Migration 89/Schema-Test, Inventory-Service, Pantry-Route, Scope/Rechte/OpenAPI, Pantry-Seite/-Styles, Router/Kitchen-Tabs/Settings/SW, alle 23 Locales, fokussierte Pantry-/DB-/Integrations-Tests, SPEC/Changelog/Kitchen-Doku | Core-Pantry-MVP mit Lot-Modell, atomarem unveränderlichem Bewegungsjournal und Network-only-API implementiert und lokal fokussiert verifiziert | abgeschlossen; Feature-Commit `70ed5cfd` erstellt, finaler Handoff-/Push-Abschluss folgt | keine aktive Fremdreservierung; KWF-006 ist in `main`; Fork-`main` vs. `upstream/main` live 20/10 divergent, daher kein Upstream-Merge; kein KWF-008/009-Scope begonnen |
| 2026-07-14 | Codex | KWF-008 / `feature/shopping-to-pantry` | Untersucht und geändert: Migration 90/Schema-Test, Shopping-Route, Inventory-Service, OpenAPI, Shopping-/Pantry-Frontend, Client-Permission-Mapping, Shopping-CSS, alle 23 Locales, DB-/Shopping-/Pantry-/Transfer- und betroffene Regressionstests, SPEC/Changelog/Plan/Memory | Expliziten atomaren Einkauf→Vorrat-Transfer mit Zielauswahl, Freitextbestätigung, aktiver Idempotenz und journalisiertem Undo/Redo implementiert, dokumentiert sowie automatisch und im Browser verifiziert | extern akzeptiert und über Merge-Commit `245538f0` in Fork-`main` integriert | `main` und `origin/main` nach Push synchron; `upstream/main` blieb wegen dokumentierter Divergenz unberührt; kein KWF-009-Scope begonnen |
| 2026-07-14 | Codex | KWF-009 / `feature/meal-cooking-consumption` | Untersucht und geändert: Migration 91/Schema-Test, Meals-Route, Inventory-/Cooking-Service, OpenAPI, Meals-UI/-CSS, `meals.cook*` in 23 Locales, DB-/Meals-/Pantry-/Shopping-/Frontend-Regressionen, SPEC/Changelog/Plan/Memory | Cooking-Event mit read-only Preview, exakten kompatiblen FIFO-Vorschlägen, manueller Mehrfachlos-Allokation, atomarem Verbrauch und optionalem Missing→Shopping sowie journalisiertem Undo implementiert, dokumentiert und automatisch/im Browser verifiziert | extern akzeptiert und über Merge-Commit `f89b2ec6` in Fork-`main` integriert | `main` wird mit diesem Integrations-Handoff zu `origin/main` gepusht; `upstream/main` bleibt unverändert; KWF-FINDING-009 offen, kein KWF-010-Scope begonnen |
| 2026-07-14 | Codex | KWF-010 / `feature/kitchen-workflow-integration` | Untersucht: Migrationen 86–91, DB-/Route-/Service-/OpenAPI-/Scope-/Permission-/SW-/Locale-Verträge und KWF-002–009-Suiten; geändert: produktive Cross-Domain-/Upgrade-Suite, Datepicker-Escape/Fokus-Vertrag, Package-Script, SPEC/Changelog/Plan/Memory | Gesamtworkflow, Legacy-Upgrade, Rollbacks, Idempotenz, Undo und Verträge automatisiert; verschachteltes Escape im realen Browser gefunden und behoben; Desktop/Tablet/Mobil verifiziert | extern akzeptiert und über Merge-Commit `070f47a0` in Fork-`main` integriert | `main` und `origin/main` nach Merge-Push synchron; `upstream/main` blieb unverändert; KWF-FINDING-009 reproduziert, KWF-FINDING-022/-023 gelöst; kein Folge-Task |
| 2026-07-14 | Codex | KWF-FINDING-009 / `fix/windows-category-test-cleanup` | Untersucht und geändert: Task-/Contact-Categories-Harnesses, Admin-Passwort-Reset-/Setup-Entrypoint-Tests, exportierter Server-Handle und unrefte Calendar-Sync-Timer; fokussierte Reproduktion und Vollsuite | nicht abgewartetes `server.close()`, sofortiges `process.exit()` sowie ein nicht schließbarer echter Server-/Backup-Scheduler-Lifecycle waren die Ursache; keine Fachlogik betroffen | implementiert und lokal verifiziert; `npm test` Exit 0 | KWF-FINDING-013 folgt separat auf eigenem Integrationsbranch; keine aktive Fremdreservierung |

## 5. Architekturentscheidungen

### ADR-KITCHEN-001 — Default-Einkaufsliste aus Reihenfolge

- Problem: Die älteste Liste war implizit Standard; ein separates Default-Feld könnte der sichtbaren Reihenfolge widersprechen.
- Entscheidung: Die Liste mit dem niedrigsten `sort_order` ist Default. Kein `is_default`.
- Begründung: Eine einzige Quelle der Wahrheit, einfache UI und deterministische Fallback-Sortierung.
- Alternativen: `is_default`; Benutzerpräferenz pro Person.
- Auswirkungen: Jeder Default-Verbraucher muss denselben zentralen Query-Helper verwenden.
- Status: **accepted** (Task 1 implementiert und vom Benutzer bestätigt).

### ADR-KITCHEN-002 — Normalisierte Herkunft von Einkaufsartikeln

- Problem: `shopping_items.added_from_meal` unterstützt keine mehreren Quellen und verliert Herkunft bei Aggregation/Löschung.
- Entscheidung: Herkunft wird in `shopping_item_sources` als 1:n-Beziehung gespeichert; IDs und unveränderliche Anzeige-Snapshots werden kombiniert.
- Begründung: Mehrere Rezepte/Mahlzeiten bleiben darstellbar, Löschungen zerstören den historischen Kontext nicht.
- Alternativen: weitere Einzelspalten; Freitext in `notes`; nur JSON.
- Auswirkungen: Importfunktionen müssen Position plus Quellen in derselben Transaktion erzeugen; API liefert `sources[]`.
- Präzisierung für KWF-003: Bestehende Meal-Importe erzeugen `source_type = 'meal'`, bewahren optional `recipe_id` und speichern Titel, Meal-Datum und die unveränderte Zutatenmenge als Snapshots. `meal_id`/`recipe_id` dürfen durch `ON DELETE SET NULL` verschwinden; die Snapshots bleiben unverändert. Bis KWF-006 wird beim Bereichsimport jede Zutat als eigene Position angelegt, statt Freitextmengen heuristisch zusammenzuführen.
- Status: **accepted** (KWF-003 am 2026-07-13 extern durch den Benutzer bestätigt und zur Integration in Fork-`main` freigegeben).

### ADR-KITCHEN-003 — Vorrat als Core-Kitchen-Bereich

- Problem: Pantry benötigt Core-Navigation, Scopes, DB-Transaktionen und enge Verknüpfung zu Shopping/Meals.
- Entscheidung: `/pantry` wird ein vierter Core-Kitchen-Child neben Meals, Recipes und Shopping.
- Begründung: Third-Party-Module sollen laut `MODULES.md` Core nicht verändern und sind für atomare Cross-Core-Workflows ungeeignet.
- Alternativen: echtes Drittanbieter-Modul; Unteransicht von Shopping.
- Auswirkungen: Router, Kitchen-Tabs, Module-Rechte, Settings-Navigation, Service Worker und Tests werden erweitert.
- Status: **accepted und in KWF-007 implementiert**; Pantry ist der vierte einzeln berechtigbare Core-Kitchen-Child.

### ADR-KITCHEN-004 — Bestandsänderungen über Bewegungsjournal

- Problem: Direktes Überschreiben eines Bestands ist nicht nachvollziehbar und schwer rückgängig zu machen.
- Entscheidung: Jede Erhöhung, Entnahme, Korrektur und Rücknahme erzeugt eine unveränderliche `inventory_movements`-Zeile; Rücknahmen erzeugen Gegenbewegungen.
- Begründung: Auditierbarkeit, Idempotenz und spätere Einkaufs-/Koch-Verknüpfungen.
- Alternativen: nur aktueller Bestand; veränderbare History-Zeilen.
- Auswirkungen: Bestandsanzeige wird aus Bewegungen berechnet oder mit geprüftem Cache abgeleitet; niemals stille Löschung historischer Bewegungen.
- Status: **accepted und in KWF-007 implementiert**; jede Bestandsänderung schreibt Cache und neue Journalzeile in derselben Transaktion, Rücknahmen sind Gegenbewegungen.

### ADR-KITCHEN-005 — Mahlzeit und optionaler Einkaufsimport atomar

- Problem: Zwei Requests können „Mahlzeit gespeichert, Import fehlgeschlagen“ erzeugen.
- Entscheidung: `POST /api/v1/meals` akzeptiert einen optionalen Importblock und führt Mahlzeit, Zutaten, Einkaufsartikel, Herkunft und Flags in derselben SQLite-Transaktion aus.
- Begründung: Die fachliche Operation ist eine Einheit.
- Alternativen: Client-Kompensation; separater Batch-Endpunkt.
- Auswirkungen: Vollständige Vorabvalidierung der Zielliste; bei jedem Fehler vollständiger Rollback.
- Status: **accepted und in KWF-004 implementiert**.

### ADR-KITCHEN-006 — Freitextmenge bleibt erhalten

- Problem: Bestehende Mengen wie „etwas“ oder „1 Dose“ sind nicht sicher konvertierbar.
- Entscheidung: Bestehendes `quantity` bleibt unverändert als Anzeige-/Legacywert. Optionale numerische Felder `amount` und `unit` werden schrittweise ergänzt; unbekannte Werte bleiben unstrukturiert.
- Begründung: Keine Datenverluste und keine erfundene Interpretation.
- Alternativen: harte Migration; automatische/KI-basierte Parsingpflicht.
- Auswirkungen: Nur deterministisch kompatible strukturierte Mengen dürfen gerechnet werden.
- Status: **accepted und in KWF-006 durch Migration 88 sowie gemeinsame Server-/Browser-Validatoren implementiert**.

### ADR-KITCHEN-007 — Duplikate in zwei Stufen

- Problem: Gleiche Namen können inkompatible Freitextmengen und mehrere Quellen haben.
- Entscheidung: Stufe 1 erzeugt getrennte Shopping-Positionen mit Herkunft. Stufe 2 darf nur strukturierte, kompatible Einheiten optional aggregieren und bewahrt alle Quellen.
- Begründung: Korrektheit vor scheinbarer Bequemlichkeit.
- Alternativen: heutige heuristische Aggregation überall; reine Namensaggregation.
- Auswirkungen: Der Bereichsimport gruppiert nur gleiche Namen/Kategorien mit kompatibler strukturierter Dimension, rechnet deterministisch über Basiseinheiten und erzeugt für jede Herkunft eine Source-Zeile. Freitext und inkompatible Werte bleiben getrennt.
- Status: **accepted und in KWF-006 implementiert**.

### ADR-KITCHEN-008 — Kaufübernahme ist bestätigt und idempotent

- Problem: Nicht jeder Artikel ist ein Lebensmittel; erneutes Abhaken darf nicht doppelt buchen.
- Entscheidung: Abhaken bietet optional einen Bestätigungsdialog. Eine eindeutige Einkaufsartikel-Referenz/Idempotency-Key verhindert Doppelbuchungen; „nicht in Vorrat“ bleibt möglich.
- Begründung: Sicherer Standard und robustes Undo/Redo.
- Alternativen: globale Vollautomatik; jeder Check erzeugt Bestand.
- Auswirkungen: `is_checked` und Transfer werden bei bestätigter Übernahme atomar aktualisiert.
- Status: **accepted für KWF-008**; die Bestätigung bleibt explizit, der serverseitige Transfer setzt Check, Vorrat und Journal atomar, ein aktiver Shopping-Bezug verhindert Doppelbuchungen und Undo erzeugt eine Gegenbewegung.

### ADR-KITCHEN-009 — Kochen als eigenes Event

- Problem: Ein boolescher Meal-Status kann Verbrauch, Undo und Journalbezug nicht ausreichend abbilden.
- Entscheidung: `meal_cooking_events` protokolliert bestätigte Kochvorgänge; Bewegungen referenzieren das Event. Für eine konkrete geplante Mahlzeit ist zunächst höchstens ein aktives Event erlaubt.
- Begründung: Nachvollziehbarkeit und Gegenbuchung ohne Datenlöschung.
- Alternativen: `meals.is_cooked`; lose Bewegungsnotizen.
- Auswirkungen: Preview ist read-only, Bestätigung atomar, Undo erzeugt Gegenbewegungen.
- Präzisierung für KWF-009: Zutatenanforderungen und bestätigte Allokationen werden als unveränderliche Event-Snapshots gespeichert. Das veröffentlichte `inventory_movements.movement_type`-CHECK bleibt unangetastet; Entnahmen verwenden den bestehenden Typ `adjustment` und werden additiv über `cooking_event_id` fachlich zugeordnet. Vorschläge sind ausschließlich exakte, case-insensitive Namensmatches mit kompatibler strukturierter Dimension und frühestem Ablaufdatum zuerst; Freitext und unsichere Namen werden nie geraten.
- Status: **accepted und in KWF-009 implementiert**; Migration 91 und Cooking-Service setzen die Entscheidung um.

### ADR-KITCHEN-010 — Vorhandenen Datepicker wiederverwenden

- Problem: Gewünscht ist ein Microkalender im Rezept→Essensplan-Flow.
- Entscheidung: Die bestehende `yuvomi-datepicker`-Komponente bleibt die einzige Kalenderimplementierung.
- Begründung: Sie erfüllt Monatsansicht, Heute-/Auswahlmarkierung, ISO-Wert, Touch und Tastatur bereits.
- Alternativen: neue Komponente; externe Bibliothek.
- Auswirkungen: KWF-005 prüft Integration und ergänzt nur gezielte Erweiterungen, z. B. geplante Tage, falls nach Review gewünscht.
- Status: **accepted und in KWF-005 für Desktop, Tablet und Smartphone umgesetzt**; der native Touch-Picker bleibt ausschließlich für Uhrzeitfelder bestehen.

### ADR-KITCHEN-011 — Checkbox-Präferenz zunächst nicht persistieren

- Problem: Automatischer Import kann unerwartete Einkaufsartikel erzeugen.
- Entscheidung: Im MVP ist die Checkbox standardmäßig aus und wird nicht als Benutzerpräferenz gespeichert. Das Frontend wählt die erste, nach KWF-002 sortierte Liste vor; bei aktiviertem Import sendet es deren oder die explizit gewählte `list_id`. Das Backend verwendet keinen stillen Default-Fallback.
- Begründung: Explizite Zustimmung und kleiner migrationsfreier Scope.
- Alternativen: global gespeicherter Default; immer aktiv.
- Auswirkungen: Eine Präferenz ist ein separater späterer UX-Task.
- Status: **accepted und in KWF-004 implementiert**.

## 6. Datenmodell-Mapping

| Tabelle | Zweck / wichtige Spalten | Beziehungen | Geplante Änderung | Migration / Rückwärtskompatibilität |
|---|---|---|---|---|
| `shopping_lists` | Listen; `id`, `name`, `created_by`, Zeitstempel; Task-1: `sort_order` | 1:n `shopping_items` | keine weitere Default-Spalte | Migration 86 backfillt 0..n-1 nach `created_at,id`; bestehende IDs bleiben |
| `shopping_items` | Positionen; `quantity TEXT`, optionale `amount REAL`,`unit TEXT`, `category`, `is_checked`, `notes`, `url`, `added_from_meal` | Liste; optional eine Mahlzeit | Quellen über Join-Tabelle; KWF-006 strukturiert Mengen additiv | Migration 88 ohne Backfill; `quantity` und `added_from_meal` bleiben API-/DB-kompatibel |
| `shopping_item_sources` | Herkunft; `shopping_item_id`, `source_type`, `meal_id`, `recipe_id`, `source_label`, `meal_date_snapshot`, `quantity_snapshot`, `created_at` | n:1 Artikel; Item `ON DELETE CASCADE`, optionale Quellen-FKs `ON DELETE SET NULL` | KWF-003 implementiert | Migration 87 backfillt `added_from_meal`; Snapshots bleiben nach FK-Verlust erhalten |
| `meals` | geplante Instanz; Datum, Typ, Titel, Rezeptbezug, Serienbezug | Rezept/Template, Zutaten | KWF-004 ändert das Schema nicht; kein bloßes `is_cooked`; Cooking-Events | bestehende Meals und Create-Response bleiben kompatibel |
| `meal_ingredients` | Zutaten-Snapshot; `name`, `quantity TEXT`, optionale `amount REAL`,`unit TEXT`, `category`, `on_shopping_list` | n:1 Meal | KWF-004 setzt das Flag nur für erfolgreich atomar importierte Startinstanz-Zutaten; KWF-006 propagiert strukturierte Snapshots | Migration 88 additiv; Freitext und Flag bleiben kompatibel |
| `recipes` | Rezeptkopf | 1:n Zutaten; 1:n Meals | keine zwingende Änderung für KWF-004 | keine |
| `recipe_ingredients` | Rezeptzutaten-Snapshot; `quantity TEXT`, optionale `amount REAL`,`unit TEXT` | n:1 Rezept | KWF-006 propagiert strukturierte Werte in neue Meals | Migration 88 additiv; Freitext bleibt unverändert |
| `meal_recurrence_*` | Serienvorlage, Zutaten und Ausnahmen; Ingredient-Tabelle mit optionalen `amount REAL`,`unit TEXT` | materialisierte Meals | strukturierte Mengen werden in Instanzen/Serienbearbeitung übernommen; Importsemantik bleibt explizit | Migration 88 additiv, keine Neuinterpretation alter Serien |
| `pantry_locations` | Lagerorte; stabiler `key`, Custom-`name`, `label_key`, `sort_order`, Zeitstempel | 1:n Pantry-Posten (`RESTRICT`) | in KWF-007 implementiert; Seeds Kühlschrank, Gefrierschrank, Vorratsschrank, Keller, Sonstiges | Migration 89 additiv; Seed-Labels via i18n, Custom-Namen als Text |
| `pantry_items` | Bestandslos; Name, Kategorie, Lagerort, optional `amount`/`unit` oder `quantity_display`, Mindestbestand, Ablaufdatum, Soft-Delete | Ort; 1:n Bewegungen; Creator `SET NULL` | in KWF-007 implementiert | Migration 89 additiv; Freitext bleibt uninterpretiert; mehrere Lose gleichen Namens möglich |
| `inventory_movements` | unveränderliches Journal; Typ, Delta/Einheit, Saldo, Anzeige vorher/nachher, Grund, eindeutiger Idempotency-Key, Reversal, Actor, Zeit; optional `shopping_item_id`, optional `cooking_event_id` | Pantry-Posten; Self-FK für Gegenbewegung; Shopping-Artikel/Cooking-Event `SET NULL` | Basis in KWF-007, Shopping-Kaufbezug in KWF-008 und Cooking-Bezug in KWF-009 implementiert | Migration 91 ergänzt nur FK und Index; Kochentnahmen bleiben `adjustment`, Undo bleibt `reversal` |
| `meal_cooking_events` | bestätigter Kochvorgang; konkretes Meal, Status, Meal-/Recipe-/Datums-/Typ-Snapshots, Actor, Bestätigungs-/Undozeit | Meal/Recipe optional `SET NULL`; 1:n Zutaten-Snapshots | in KWF-009 implementiert | Migration 91 additiv; bestehende Meals bleiben ungekocht; partieller Unique-Index erlaubt höchstens ein aktives Event je Meal |
| `meal_cooking_ingredients` | unveränderlicher Zutaten-Snapshot mit Name, Freitext-/Strukturmenge, Kategorie, Ergebnis und optional erzeugtem Missing-Shopping-Artikel | n:1 Cooking-Event; optionale Originalzutat/Shopping-Position `SET NULL` | in KWF-009 implementiert | bewahrt fachlichen Zustand nach Meal-/Recipe-/Shopping-Löschung |
| `meal_cooking_allocations` | bestätigte Pantry-Los-, Mengen-, Einheiten- und Bewegungs-Snapshots | n:1 Cooking-Ingredient; optionale Pantry-Referenz `SET NULL`; Movement `RESTRICT` | in KWF-009 implementiert | jede Entnahme ist genau einer Allocation und Journalbewegung zugeordnet |

Technische Grenze: Ohne ein bestätigtes Zutaten-Stammdatenmodell kann ein Name wie „Tomate“ nicht sicher automatisch einem Pantry-Posten „Tomaten“ zugeordnet werden. MVP-Matching muss als Vorschlag sichtbar und vom Benutzer bestätigbar sein; Einheit und Menge werden nicht geraten.

## 7. API-Mapping

### Bestehende relevante Endpunkte

| Methode/Pfad | Request / Response | Validierung / Transaktion | Relevante Tests |
|---|---|---|---|
| `GET /api/v1/shopping` | vollständige Listen mit Counts | Task-1-Sortierung `sort_order,created_at,id` | Shopping API/DB |
| `POST /api/v1/shopping` | `{name}` → Liste | Task 1 vergibt nächsten `sort_order` | Shopping API |
| `PATCH /api/v1/shopping/reorder` | `{order:[ids...]}` → alle Listen | vollständige, eindeutige ID-Menge; eine Transaktion | Shopping API/DB |
| `POST /api/v1/shopping/:listId/items`, `PATCH /api/v1/shopping/items/:id` | bestehende Felder plus optional gepaartes `amount`,`unit` | strukturierte Teilwerte, nicht-positive/nicht-endliche Werte und unbekannte Einheiten werden abgelehnt; Legacy-Requests bleiben gültig | Shopping/Quantity |
| `POST /api/v1/shopping/:listId/import-meal-plan` | `{from,to}` → Counts | Import+Flag-Updates in Transaktion; nur `g↔kg`/`ml↔l` dimensionsgleich aggregiert, alle Quellen bewahrt | Shopping/Quantity |
| `POST /api/v1/meals` | Meal + Zutaten + optional Wiederholung und optional `shopping_import:{enabled,list_id}`; bei aktivem Import additive Summary | Rezept und explizite Liste vor Schreibbeginn validiert; Template, Meal, Zutaten, Shopping-Items, Quellen und Flags in einer Transaktion | Meals/Shopping |
| `POST /api/v1/meals/apply-plan` | Assignments plus additive Zutatenfelder `amount`,`unit` | Batch/Replace in Transaktion; strukturierte Werte serverseitig validiert | Meals/Quantity |
| `POST /api/v1/meals/:id/to-shopping-list` | `{listId}` → Count | Artikel+Flags in Transaktion | Meals |
| `POST /api/v1/meals/week-to-shopping-list` | `{listId,week}` → Count | Artikel+Flags in Transaktion | Meals |
| `/api/v1/recipes` CRUD | Rezept + Zutaten; additive `amount`,`unit` | Create/Update transaktional; strukturierte Werte serverseitig validiert | Meals/Recipes-Frontend/Quantity |

### Geplante API-Verträge

| Methode/Pfad | Request / Response | Validierung / Transaktionsgrenze | Fehlerfälle / Tests |
|---|---|---|---|
| `POST /api/v1/meals` (KWF-004) | optional `shopping_import:{enabled,list_id}`; unverändertes `data`-Meal plus additive `shopping_import:{enabled,list_id,transferred}` nur bei Aktivierung | Block strikt validiert; Liste und Rezept vorab geprüft; Template, Meal, Zutaten, Artikel, Quellen und Flags in **einer** Transaktion | deaktiviert/fehlend unverändert; 400 Block/Listen-ID, 404 Liste/Rezept; künstlicher Source-Fehler rollt alles zurück |
| `GET /api/v1/shopping/:listId/items` | Artikel plus `sources[]` | KWF-003: FKs optional, Snapshots immer ausgeben | gelöschtes Meal/Rezept und Mehrfachquellen getestet |
| `GET /api/v1/pantry`, `GET /locations`, `GET /:id` | Filter `q,category,location,low_stock,expires_before`; Detail enthält absteigende History | `pantry:read`, validierte Parameter; bewusst network-only | Filter, Seeds und History getestet |
| `POST /api/v1/pantry` | Name, optionale strukturierte oder explizite Freitextmenge, Kategorie, Ort, Minimum, Ablauf | Lot und initiale Bewegung in einer Transaktion; keine negative Anfangsmenge | strukturierte und Freitextanlage, Rollback/Constraints getestet |
| `PATCH/DELETE /api/v1/pantry/:id` | Metadaten beziehungsweise Soft-Delete | `pantry:write`; Stockfelder im PATCH verboten, History bleibt beim Delete | direkte Bestandsmutation, 404 und History-Erhalt getestet |
| `POST /api/v1/pantry/:id/adjust` | Delta, absolutes Ziel, Freitextkorrektur oder Reversal plus verpflichtender Idempotency-Key | Cache und unveränderliche Bewegung in einer Transaktion | Einheitenkonvertierung, Unterbestand-Rollback, Replay und einmalige Gegenbewegung getestet |
| `POST /api/v1/shopping/items/:id/to-pantry` | bestätigte strukturierte Menge oder explizite Freitextanzeige, Ort und optional Zielposten | Artikel prüfen; zusätzlich `pantry:write`; Check+Pantry+Movement in einer Transaktion; aktiver Shopping-Bezug macht Replay idempotent | Opt-out nutzt weiterhin nur PATCH; Wiederholung liefert vorhandenes Ergebnis ohne Doppelbewegung; Ziel-/Insertfehler rollen alles zurück |
| `POST /api/v1/shopping/items/:id/to-pantry/undo` | optionaler Grund → Gegenbewegung und Transferstatus | zusätzlich `pantry:write`; Gegenbuchung in bestehender Journaltransaktion, Shopping-Check bleibt unverändert | kein aktiver Transfer → 409; wiederholtes Undo erzeugt keine zweite Gegenbewegung; danach ist Redo erlaubt |
| `POST /api/v1/meals/:id/cook-preview` | Ingredient-Anforderungen, Status, kompatible Lose und frühestes Ablaufdatum zuerst vorgeschlagene Allokationen | `meals:write` + `pantry:read`; strikt read-only; exakter case-insensitiver Name und kompatible Dimension | fehlend/unklar sichtbar; Freitext erzeugt nie Autoallokation |
| `POST /api/v1/meals/:id/cook` | bestätigte Allokationen und optional `missing_to_shopping:{list_id,ingredient_ids}` | `meals:write` + `pantry:write`, optional `shopping:write`; Event, Snapshots, Entnahmen und Shoppingartikel in **einer** Transaktion | zweite/parallel aktive Buchung 409; Überallokation, Unterbestand und Einheitenkonflikt rollen vollständig zurück |
| `POST /api/v1/meals/:id/cook/undo` | kein Event vom Client nötig; aktives Event der konkreten Meal-Instanz | `meals:write` + `pantry:write`; exakte Gegenbewegungen und Eventstatus in einer Transaktion | kein aktives Event 409; Missing-Shoppingartikel bleiben bewusst als nachvollziehbare Benutzerentscheidung erhalten |

Die KWF-009-Pfade sind in `server/openapi.js` dokumentiert und verwenden die vorhandenen Scope-Keys: Meals bleibt `meals`, Pantry bleibt `pantry`, Shopping bleibt `shopping`. Cross-Domain-Schreibzugriffe werden zusätzlich in der Meals-Route für Token und Mitglieder geprüft; neue Scope-Keys oder Service-Worker-Regeln waren nicht erforderlich.

KWF-010 fand keinen Datenmodell-, Migrations-, API-, OpenAPI-, Scope-, Permission- oder Service-Worker-Drift. Die produktiven Migrationen 86–91 aktualisieren eine mit Legacy-Rezept, -Meal und -Shoppingdaten belegte v85-DB verlustfrei; der gemeinsame Route-Level-Test bestätigt die vorhandenen Transaktionsgrenzen und unveränderten Verträge. Daher wurde bewusst keine Migration und kein API-Vertrag ergänzt oder umgeschrieben.

## 8. Frontend-Mapping

| Ansicht/Datei | Geplante Verantwortung | Handler/Formulare | i18n / Mobil-Tablet |
|---|---|---|---|
| `public/pages/shopping.js` | Quellen und strukturierte Mengen; KWF-008 zeigt abgehakten Artikeln Transferstatus und explizite Übernahme | bestehende Check-/Swipe-Handler bleiben; Transfermodal wählt Neuanlage oder vorhandenes Los, verlangt bei Freitext eine ausdrückliche Bestätigung und bietet Undo | `shopping.toPantry*` in 23 Locales; Deutsch/Englisch fachlich vollständig; 390/768/Desktop ohne Überlauf und mit logischer Fokusfolge |
| `public/pages/meals.js` | KWF-004: optionaler Import; KWF-006 strukturierte Snapshots; KWF-009 Cooking-Status/Review/Undo | `buildModalContent`/`saveModal`, Einzel-Edit, Copy/Scale/Apply-Plan propagieren `amount`,`unit`; Cooking-Review editiert Mehrfachlos-Allokationen und ausgewählte Missing-Artikel; kein stiller Freitextparser | `quantity.*` und `meals.cook*`; Shared Modal, Desktop/768/390 px ohne Überlauf und tastaturbedienbar |
| `public/pages/recipes.js` | bestehende Navigation; KWF-006 strukturierte Rezeptzutaten | Create/Update/Copy und `add-to-meals` erhalten `amount`,`unit` | gemeinsamer `quantity.*`-Namespace; Freitextanzeige bleibt Fallback |
| `public/components/datepicker.js` | gemeinsamer Microkalender; KWF-005 öffnet das Datumspopover auch bei grobem Pointer und ergänzt Home/End-Navigation; KWF-010 isoliert Escape im verschachtelten Popover | bestehendes Grid/Keyboard; Escape stoppt Propagation, schließt nur den Picker und fokussiert den Trigger; nativer Touch-Picker bleibt nur für Uhrzeit | vorhandene Texte; keine neuen i18n-Keys oder Marker-API |
| `public/pages/pantry.js` | Liste/Karten, Suche, Filter, CRUD, Korrektur und History; KWF-008 kennzeichnet Shopping-Kaufzugänge | Shared Modal; Add/Edit/Adjust/Reversal/Delete; Read-only blendet Schreibaktionen aus | `pantry.*` einschließlich `pantry.movement.purchase` in 23 Locales; responsive Grid/Filter, Touch-Ziele und Reduced Motion |
| `public/router.js`, `public/utils/kitchen-tabs.js` | `/pantry` als Kitchen-Child | Route, Titel, Nav-Ziel, Shortcuts | `nav.pantry` in allen Locales |
| `public/settings/pages/modules-kitchen.js` | Pantry-bezogene bestätigte Defaults, falls später nötig | keine globale Autoübernahme im MVP | explizite, sichere Defaults |
| `public/sw.js` | Pantry-JS/CSS als statische Assets; Pantry-API bewusst nicht in der GET-Whitelist | Cachelisten/Network-only-API | keine Offline-Mutationen und keine veralteten Bestände im API-Cache |
| `public/styles/*.css` | Quellen, KWF-006 Mengenfelder, spätere Pantry | bestehende Tokens/Breakpoints | Desktop, Tablet, Mobile; Reduced Motion |

Neue i18n-Namensräume: KWF-006 implementiert `quantity.*`; KWF-007 implementiert `nav.pantry` und `pantry.*`; KWF-008 ergänzt `shopping.toPantry*` und `pantry.movement.purchase`; KWF-009 ergänzt 29 `meals.cook*`-Keys. Deutsch/Englisch sind fachlich vollständig, alle 23 Locale-Dateien haben Key-Parität.

## 9. Test-Matrix

| Feature | Unit | API | DB/Migration | Frontend | Regression | Status |
|---|---|---|---|---|---|---|
| KWF-001 Baseline/Plan | Dokumentstruktur | – | – | – | Git-Diff nur Docs | abgeschlossen |
| KWF-002 Listensortierung | Default-Helper | Reorder-Validierung | Migration 86/next order | DnD + Buttons + Default-Badge | MCP/Housekeeping/CalDAV/Meals | abgeschlossen und in `main` |
| KWF-003 Herkunft | konservativer Import-/Source-Helper | `sources[]`, Einzel-/Wochen-/Bereichsimport | Migration 87, Backfill/FK-Löschung | eine/mehrere Quellen; Desktop/390/768 px | Search, Scopes, Permissions, SW, Kitchen, Frontend-Audit | abgeschlossen |
| KWF-004 Direkter Import | Block-/Listenvalidierung und gemeinsamer Importservice | unverändert ohne Import; explizite Liste; Herkunft; vollständiger Rollback | keine Migration; keine halbe Speicherung | Checkbox/Select/Ein-Request-Wiring; 390/768 px | Rekurrenz nur Startinstanz; Scopes/Permissions/SW/MCP/Housekeeping/CalDAV | abgeschlossen |
| KWF-005 Microkalender | Datepicker-Grid/Plattformzweig/Home-End | – | – | Recipe-Query, ISO-POST, Keyboard, Touch, 390/768/Desktop/Landscape | Datepicker 24/24; Meals 44/44; UX 17/17; Mobile 5/5; Frontend 141/141; Browser grün | abgeschlossen; Feature-Commit `7ca92ac8` gepusht |
| KWF-006 Mengenbasis | Quantity 4/4: gepaarte Validierung, Bounds, Dimension/Konvertierung | Shopping 62/62; Meals 46/46; kompatible/incompatible Einheiten und Quellen | DB 40/40; Migration 88 additiv, kein Legacy-Backfill | Ingredient-Row, Quick-Add/Details; Browser 390/768/1440 px + Tastaturfokus | Frontend 141/141; Scopes/Permissions/SW/MCP/Kitchen grün | abgeschlossen |
| KWF-007 Pantry MVP | Servicevalidierung, Konvertierung, Idempotenz und Rollback | 11/11: CRUD/Filter/Adjust/Reversal/History | DB 41/41; Migration 89, Seeds, FKs/Checks/Indizes | Shared Modal, responsive CRUD/Filter, Tastatur-/Touchmuster | Scopes/Permissions/Kitchen/Settings/SW/Frontend grün | implementiert und fokussiert verifiziert |
| KWF-008 Einkauf→Vorrat | Transfermenge, aktiver Bezug, Reversal | Transfer/Undo/Redo/Recheck, Zweitrechteprüfung, Parallel-Replay und Rollback 8/8 | DB 42/42; Migration 90 additiv, kein Backfill | Bestätigungsdialog, Zielauswahl, Freitextkorrektur; Desktop/768/390 px + Tastatur | Shopping 62/62, Pantry 11/11, Scopes/Permissions/SW/MCP/Frontend grün | implementiert und lokal verifiziert |
| KWF-009 Kochen→Verbrauch | exaktes Matching, kompatible Dimension, FIFO-Vorschlag | Cooking 8/8: Preview/Commit/Undo, Rechte, Parallelität, Missing, Rollback, Rekurrenz/Delete | DB 43/43; Migration 91, Event-/Ingredient-/Allocation-Snapshots und Journal-FK | Shared Reviewdialog, editierbare Mehrfachlose/Missing; Desktop/768/390 px + Tastatur | Meals 48/48, Shopping 62/62, Pantry 11/11, Scopes/Permissions/SW/MCP/Frontend grün | implementiert und lokal verifiziert |
| KWF-010 Integration | produktive Verträge/Replay/Rollback | 3/3: gemeinsamer Route-Level-Flow, OpenAPI/Scopes/Permissions/PWA/Locales | belegte v85→v91-DB, Legacy-Daten/FKs/Snapshots | Datepicker-Escape/Fokus 25/25; Browser 1440/768/390 px, Touch-/Tastaturpfad, keine Console-Fehler | fokussierte Kitchen-/MCP-/Housekeeping-/CalDAV-/Installer-/Frontend-Suiten grün; `npm test` auf Windows/Node 24 nach KWF-FINDING-009-Fix vollständig mit Exit 0 | implementiert und lokal verifiziert |

## 10. Offene Findings

### KWF-FINDING-001 — Task 1 war noch nicht committed

- Betroffene Dateien: Migration/Shopping/UI/i18n/Tests sowie Default-Verbraucher auf `feature/shopping-list-order`.
- Schweregrad: mittel.
- Auswirkung: Funktioniert lokal, ist aber noch kein reviewbarer Git-Stand.
- Empfehlung: Separat reviewen, committen und pushen; nicht mit Folgefeatures vermischen.
- Status: **resolved** durch PR #2, Merge-Commit `b524dbc2`.
- Task: KWF-002.

### KWF-FINDING-002 — `added_from_meal` ist nicht mehrquellenfähig

- Betroffene Dateien: `server/db.js`, Meals-/Shopping-Import-Routen.
- Schweregrad: hoch für Herkunftsanforderung.
- Auswirkung: Aggregation oder mehrere Rezepte verlieren Nachvollziehbarkeit.
- Empfehlung: `shopping_item_sources` mit Snapshots.
- Status: **resolved** durch Migration 87, `sources[]`-Serialisierung und atomare Source-Erzeugung in allen bestehenden Importpfaden.
- Task: KWF-003.

### KWF-FINDING-003 — Bereichsimport aggregiert heuristisch

- Betroffene Dateien: `server/services/shopping-import.js`, `server/routes/shopping.js`.
- Schweregrad: mittel.
- Auswirkung: numerische Präfixe werden summiert; mehrere Meal-IDs werden zu `NULL` Herkunft.
- Empfehlung: Bis KWF-006 getrennte Positionen oder konservative Aggregation mit allen Quellen.
- Status: **resolved für KWF-003/Stufe 1**: Der Bereichsimport legt jede Freitextzutat getrennt an. Strukturierte Aggregation bleibt ausschließlich KWF-006.
- Task: KWF-003/KWF-006.

### KWF-FINDING-004 — Meal-Create und Import sind heute getrennt

- Betroffene Dateien: `public/pages/meals.js`, `server/routes/meals.js`.
- Schweregrad: hoch für Feature 2.
- Auswirkung: Clientseitige Folgeoperation wäre nicht atomar.
- Empfehlung: optionalen Importblock in denselben POST und dieselbe DB-Transaktion aufnehmen.
- Status: **resolved durch KWF-004**; Meal, Zutaten, Shopping-Items, Quellen und Flags liegen bei aktiviertem Block in derselben serverseitigen Transaktion.
- Task: KWF-004.

### KWF-FINDING-005 — Microkalender bereits vorhanden

- Betroffene Dateien: `public/components/datepicker.js`, `public/pages/meals.js`.
- Schweregrad: Information.
- Auswirkung: Eine zweite Komponente würde Architektur und UX duplizieren.
- Empfehlung: Bestehenden Picker verifizieren/erweitern.
- Status: bestätigt.
- Task: KWF-005.

### KWF-FINDING-006 — Freitextmenge begrenzt Automatik

- Betroffene Tabellen: alle Ingredient-Tabellen, Shopping Items, geplantes Pantry.
- Schweregrad: hoch.
- Auswirkung: Keine sichere Aggregation, Bestandsaddition oder Entnahme für beliebige Werte.
- Empfehlung: additive strukturierte Felder; niemals unklare Werte raten.
- Status: **resolved durch KWF-006**: optionale `amount`/`unit`-Felder, strikte Paarvalidierung und ausschließlich dimensionsgleiche `g`/`kg`- bzw. `ml`/`l`-Aggregation; unklare Werte bleiben unverändert.
- Task: KWF-006.

### KWF-FINDING-007 — Abhaken ist keine idempotente Domänenoperation

- Betroffene Dateien: `public/pages/shopping.js`, `server/routes/shopping.js`.
- Schweregrad: hoch für Einkauf→Vorrat.
- Auswirkung: Check/Uncheck kann ohne Transferjournal keine Doppelbuchung verhindern.
- Empfehlung: separater bestätigter Transfer mit eindeutiger Referenz und atomarer Check-Aktualisierung.
- Status: **resolved in KWF-008** durch expliziten atomaren Transfer, eindeutigen aktiven `shopping_item_id`-Bezug und journalisiertes Undo/Redo; normales Abhaken bleibt unabhängig.
- Task: KWF-008.

### KWF-FINDING-008 — Pantry benötigt neue Core-Integrationspunkte

- Betroffene Dateien: Router, Kitchen-Tabs, Scopes, Permissions, OpenAPI, SW, Settings-Navigation, Tests.
- Schweregrad: mittel.
- Auswirkung: Eine reine neue Seite wäre unvollständig bzw. ungeschützt.
- Empfehlung: Core-Kitchen-Task mit vollständiger Integrationscheckliste.
- Status: **resolved durch KWF-007**; Route, vierter Kitchen-Tab, eigener Scope/Permission-Key, Settings-Navigation, OpenAPI, statische SW-Assets und Integrations-Tests sind implementiert.
- Task: KWF-007.

### KWF-FINDING-009 — Vollsuite-Abbruch auf Windows/Node 24

- Betroffen: `npm test`, isoliert nach erfolgreichem `test:task-categories`.
- Schweregrad: mittel für lokale Verifikation.
- Auswirkung: Die restliche Suite startet in diesem Lauf nicht; Meldung: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`.
- Empfehlung: Testserver und Datenbank explizit schließen, Testresultate über `process.exitCode` an Node übergeben und echte Entrypoint-Tests über einen exportierten Server-Handle plus gestoppten Backup-Scheduler beenden; langfristige Sync-Timer dürfen den allein geschlossenen HTTP-Server nicht künstlich am Leben halten.
- Status: **resolved am 2026-07-14**. Task-/Contact-Categories warten `server.close()` ab, schließen ihre Datenbank und verwenden `process.exitCode`. Admin-Passwort-Reset und Setup schließen Server, Backup-Scheduler und Datenbank explizit. `server/index.js` exportiert den bestehenden Listen-Handle; Calendar-Sync-Timer sind `unref()` und laufen im normalen Serverbetrieb unverändert weiter. Isolierte Tests und `npm test` bestehen auf Windows/Node 24.12.0 mit Exit 0.
- Task: KWF-010 / Tooling-Follow-up.

### KWF-FINDING-010 — Pantry-Offlineverhalten ist unentschieden

- Betroffene Datei: `public/sw.js`.
- Schweregrad: niedrig.
- Auswirkung: Pantry kann online-only sein oder veraltete sensible Bestände offline anzeigen.
- Empfehlung: Vor Whitelist-Aufnahme Produktentscheidung treffen; Mutationen immer network-only.
- Status: **resolved für KWF-007**: Pantry-API-GETs bleiben bewusst network-only; nur statische Pantry-Assets werden vorgecached. Eine spätere Offline-Produktentscheidung bleibt außerhalb des MVP.
- Task: KWF-007/KWF-010.

### KWF-FINDING-011 — Wiederkehrende Mahlzeiten brauchen klare Importsemantik

- Betroffene Dateien/Tabellen: Meals-Route, Rekurrenzservice, Templates/Instanzen.
- Schweregrad: mittel.
- Auswirkung: Ein Import am Erstelltag darf nicht unbemerkt alle zukünftigen Wochen importieren.
- Empfehlung: KWF-004 importiert nur die konkret materialisierte Startinstanz; weitere Instanzen separat bei Materialisierung/Benutzeraktion.
- Status: **resolved für KWF-004 und KWF-009**; Import betrifft nur die konkrete Startinstanz, und jedes Cooking-Event gehört ausschließlich zur konkret materialisierten Meal-ID statt zur Serie.
- Task: KWF-004/KWF-009.

### KWF-FINDING-012 — Löschungen benötigen Snapshots

- Betroffen: geplante Quellen/Cooking-Events, bestehende Rezept-/Meal-Löschung.
- Schweregrad: mittel.
- Auswirkung: `ON DELETE SET NULL` allein bewahrt keinen Anzeigenamen und kein Datum.
- Empfehlung: Label-, Datums- und Mengen-Snapshots beim Erzeugen speichern.
- Status: **resolved für Shopping-Quellen in KWF-003 und Cooking-Events in KWF-009**; Meal-/Recipe-/Datums-/Typ-, Zutaten-, Allokations- und Lot-Snapshots bleiben nach FK-Verlust erhalten.
- Task: KWF-003/KWF-009.

### KWF-FINDING-013 — Fork-`main` und `upstream/main` sind divergent

- Betroffen: Repository-Baseline vor KWF-003; Überschneidungen insbesondere in `docs/SPEC.md`, `CHANGELOG.md`, allen Locale-Dateien und `test/test-frontend-audit.js`.
- Schweregrad: mittel für spätere Upstream-Integration, niedrig für den isolierten KWF-003-Scope.
- Auswirkung: `main` kann nicht per Fast-Forward synchronisiert werden. Vor KWF-003 betrug `main...upstream/main` 7/8 Commits; vor KWF-004 sind es nach der KWF-003-Integration 9/8 Commits. Ein ungeprüfter Merge würde Kitchen-Historie und die Upstream-v1.20.0-Änderungen vermischen.
- Empfehlung: KWF-003 auf dem aktuellen, sauberen Fork-`main` implementieren; Upstream-Integration separat und konfliktbewusst durchführen.
- Status: offen; vor KWF-010 live mit 32/20 Commits verifiziert, keine taskbezogene Upstream-Synchronisierung vorgenommen.
- Task: Repository-Integration, nicht KWF-003-Feature-Scope.

### KWF-FINDING-014 — KWF-004-API-Vertrag ist in der Task-2-Analyse veraltet

- Betroffene Dateien: `docs/TASK2_RECIPE_MEAL_SHOPPING_ANALYSIS.md`, `docs/development/KITCHEN_WORKFLOW_PLAN.md`, geplant `server/routes/meals.js` und `public/pages/meals.js`.
- Schweregrad: mittel vor Implementierung.
- Auswirkung: Die zentrale Planung verlangt den optionalen Block `shopping_import: { enabled: true, list_id }` und eine vollständige Zielvalidierung. Die ältere Task-2-Analyse beschreibt dagegen `add_to_shopping_list`, `shopping_list_id` sowie einen optionalen serverseitigen Default-Fallback. Sie nennt außerdem den nicht vorhandenen Pfad `public/components/yuvomi-datepicker.js` statt `public/components/datepicker.js` und fordert eine nicht spezifizierte Idempotenz für wiederholte Meal-Create-Requests.
- Empfehlung: Den zentralen Plan als kanonischen Vertrag bestätigen, `list_id` bei aktiviertem Block verpflichtend machen, die sichtbare erste Liste ausschließlich im bestehenden Frontend vorauswählen und die Task-2-Analyse im selben Task anpassen. Keine neue Create-Idempotenz ohne eigenes Datenmodell einführen.
- Status: **resolved durch Benutzerfreigabe und KWF-004**; zentraler Blockvertrag implementiert und Task-2-Analyse angeglichen, ohne neue Create-Idempotenz.
- Task: KWF-004.

### KWF-FINDING-015 — Grobe Pointer umgehen den Microkalender bewusst

- Betroffene Dateien: `public/components/datepicker.js`, `test/test-datepicker.js`, `docs/SPEC.md`.
- Schweregrad: hoch für KWF-005.
- Auswirkung: Der Datepicker erkennt `(pointer: coarse)` und öffnet über `showPicker()` den nativen OS-Picker. Damit ist das gemeinsame Kalender-Grid im Recipe→Meals-Modal auf Tablet und Smartphone nicht verfügbar; der bisherige Test und die SPEC schreiben dieses Verhalten sogar fest.
- Empfehlung: Für `type="date"` unabhängig vom Pointer immer das vorhandene Top-Layer-Popover öffnen; den nativen Touch-Pfad nur für `type="time"` beibehalten. Tests und SPEC an den neuen, taskbestätigten Vertrag anpassen.
- Status: **resolved durch KWF-005**; Datumsfelder öffnen auch bei grobem Pointer das gemeinsame Popover, Zeitfelder behalten den nativen Touch-Picker. SPEC und Testvertrag sind angeglichen.
- Task: KWF-005.

### KWF-FINDING-016 — Datumsraster unterstützt Home/End noch nicht explizit

- Betroffene Dateien: `public/components/datepicker.js`, `test/test-datepicker.js`.
- Schweregrad: mittel für Tastatur-Akzeptanz.
- Auswirkung: Arrow- und PageUp/PageDown-Navigation sind implementiert; Escape/Tab werden am Popover behandelt und Enter aktiviert nativ den fokussierten Button. Home/End aus dem KWF-005-Testscope fehlen jedoch im Grid-Handler.
- Empfehlung: Home/End nach bestehendem Montag-basierten Gridmuster auf Wochenanfang/-ende abbilden und fokussierbare/gesperrte Tage weiterhin korrekt behandeln.
- Status: **resolved durch KWF-005**; Home/End navigieren Montag-basiert zum Wochenanfang/-ende und wurden im realen Browser zusammen mit Arrow/Tab/Escape geprüft.
- Task: KWF-005.

### KWF-FINDING-017 — Parallele Benutzeränderung am Task-Master-Prompt

- Betroffene Datei: `docs/development/KITCHEN_WORKFLOW_TASK_MASTER_PROMPT.md`.
- Schweregrad: Information.
- Auswirkung: Während KWF-006 entfernte der Benutzer den Beispielblock; die Änderung überschneidet sich nicht mit der Implementierung, darf aber nicht in den Task-Commit aufgenommen werden.
- Empfehlung: Änderung unverändert im Working Tree belassen und beim selektiven Staging ausschließen.
- Status: durch Benutzer als eigene Änderung bestätigt und für KWF-006 isoliert.
- Task: Benutzeränderung außerhalb KWF-006.

### KWF-FINDING-018 — Empfohlener nächster Schritt im Plan ist veraltet

- Betroffene Datei: `docs/development/KITCHEN_WORKFLOW_PLAN.md`, Abschnitt „Empfohlener nächster Schritt“.
- Schweregrad: niedrig.
- Auswirkung: Der Abschnitt nennt KWF-004/KWF-005 als aktuellen Stand, obwohl Tasktabelle, Memory, Migration 88 und Git-Historie KWF-003 bis KWF-006 als abgeschlossen bzw. in `main` integriert belegen.
- Empfehlung: Im KWF-007-Abschluss auf den aktuellen Pantry-Stand aktualisieren; Task-ID und Branch weiterhin aus dem kanonischen KWF-007-Abschnitt ableiten.
- Status: **resolved in KWF-007**; der Plan verweist nun auf die externe Prüfung von `feature/pantry-mvp` und grenzt KWF-008/009 ausdrücklich aus.
- Task: KWF-007-Dokumentationsabgleich.

### KWF-FINDING-019 — Positiver Mengenparser blockierte negative Pantry-Deltas

- Betroffene Datei: `public/pages/pantry.js`.
- Schweregrad: hoch für die manuelle Bestandsentnahme im KWF-007-MVP.
- Auswirkung: Der vorhandene `parseAmountInput()` akzeptiert absichtlich nur nicht vorzeichenbehaftete strukturierte Mengen; seine erste Wiederverwendung im Delta-Modus wies deshalb `-0,5` clientseitig ab, obwohl Service und API negative Deltas korrekt und transaktional verarbeiten.
- Empfehlung: Ausschließlich im Pantry-Delta-Modus ein explizites, locale-tolerantes Vorzeichenformat erlauben; absolute Mengen weiter über den bestehenden Parser validieren.
- Status: **resolved in KWF-007**; Browserprüfung bestätigte eine Entnahme von `2 l` auf `1,5 l`, und `test:pantry` sichert das vorzeichenbehaftete Format ab.
- Task: KWF-007.

### KWF-FINDING-020 — Cross-Domain-Transfer benötigt Pantry-Zweitprüfung und Client-Mapping

- Betroffene Dateien: `server/routes/shopping.js`, `public/permissions.js`, `public/pages/shopping.js`, Token-/Permissions- und Shopping-Tests.
- Schweregrad: hoch für KWF-008.
- Auswirkung: Der geplante Endpunkt liegt unter `/shopping` und wird durch das globale Gate zunächst nur als `shopping:write` klassifiziert, obwohl er Pantry-Bestand schreibt. Gleichzeitig fehlt `pantry: 'pantry'` im Client-`NAV_TO_MODULE`, sodass `isNavModuleReadOnly('pantry')` einen vorhandenen Read-only-Status nicht erkennt.
- Empfehlung: Transfer und Undo zusätzlich serverseitig gegen `pantry:write` für Token und Mitgliedsrechte prüfen; das bestehende Client-Mapping minimal ergänzen und die Transfer-UI ohne Pantry-Schreibrecht ausblenden. Keine neuen Scope-Keys einführen.
- Status: **resolved in KWF-008**; Transfer und Undo prüfen Token-Scopes sowie Mitgliedsrechte zusätzlich auf `pantry:write`, das Client-Mapping erkennt Pantry-Rechte und die Aktion wird ohne beide Schreibrechte ausgeblendet.
- Task: KWF-008.

### KWF-FINDING-021 — Veröffentlichter Movement-Type-CHECK ist nicht additiv erweiterbar

- Betroffene Dateien: `server/db.js`, `server/db-schema-test.js`, `server/services/inventory.js`, geplanter Cooking-Service.
- Schweregrad: mittel für KWF-009-Schemadesign.
- Auswirkung: `inventory_movements.movement_type` ist seit Migration 89 auf `initial`, `adjustment`, `correction` und `reversal` begrenzt. Ein neuer Wert `consumption` würde unter SQLite einen Tabellen-Rebuild und damit eine unnötig invasive Migration erfordern.
- Empfehlung: Bestehenden Journaltyp `adjustment` für negative Kochentnahmen weiterverwenden und die Domänenherkunft additiv über `cooking_event_id` speichern; Undo bleibt `reversal`.
- Status: **resolved in KWF-009**; Migration 91 ergänzt `cooking_event_id`, Entnahmen verwenden `adjustment`, Undo `reversal`, und keine veröffentlichte Migration wurde verändert.
- Task: KWF-009.

### KWF-FINDING-022 — Gesamtworkflow und echtes KWF-Upgrade sind nicht durch eine Suite abgesichert

- Betroffene Bereiche: produktive Migrationen 86–91, Meals-/Shopping-/Pantry-Routen und -Services, OpenAPI, Scopes/Permissions, PWA-/Locale-Verträge und `package.json`.
- Schweregrad: mittel für KWF-010.
- Auswirkung: Die fokussierten Suiten prüfen die einzelnen Domänen erfolgreich, führen aber weder Rezept/Meal→Shopping→Pantry→Cook→Undo in einer gemeinsamen DB aus noch ein mit Legacy-Daten belegtes Schema v85 über die produktiven `MIGRATIONS` bis v91.
- Empfehlung: Eine fokussierte KWF-010-Integrationssuite mit realen Express-Routen, produktiven Migrationen, Cross-Domain-Journal-/Snapshot-Prüfungen, Rollback/Idempotenz sowie statischen OpenAPI-/Scope-/PWA-/Locale-Gates ergänzen und in `npm test` aufnehmen.
- Status: **resolved in KWF-010** durch `test/test-kitchen-workflow.js` und `npm run test:kitchen-workflow` (3/3); kein Schema- oder API-Defekt gefunden.
- Task: KWF-010.

### KWF-FINDING-023 — Datepicker-Escape schließt das übergeordnete Meal-Modal

- Betroffene Dateien: `public/components/datepicker.js`, `public/components/modal.js`, `test/test-datepicker.js`.
- Schweregrad: mittel für Tastaturbedienung und verschachtelte Dialoge.
- Auswirkung: Im realen Recipe→Meals-Modal schließt `Escape` zuerst das Kalender-Popover und läuft danach bis zum dokumentweiten Shared-Modal-Handler weiter, wodurch auch das vollständige Meal-Formular geschlossen wird.
- Empfehlung: Escape im bestehenden Datepicker-Popover behandeln, Default unterbinden und Propagation stoppen; das Shared-Modal-Verhalten außerhalb eines offenen Pickers unverändert lassen.
- Status: **resolved in KWF-010**; Datepicker 25/25 und reale Browserprüfung bestätigen isoliertes Schließen, `aria-expanded=false`, offenen Meal-Dialog und Fokusrückgabe an den Trigger.
- Task: KWF-010.

## 11. Session-Handoff

### Vorheriger Handoff — KWF-006

- Letzter abgeschlossener Schritt: KWF-006 wurde implementiert, dokumentiert, verifiziert, als Feature-Commit `76475386` abgeschlossen und zusammen mit dem finalen Handoff zu `origin/feature/structured-ingredient-quantities` gepusht.
- Aktueller Branch: `feature/structured-ingredient-quantities`, Basis Fork-`main` `fb27ab19`; `main` entspricht `origin/main`. `upstream/main` wurde wegen live bestätigter 15/10-Divergenz weder gemergt noch verändert.
- Commit-/Working-Tree-Status: Der Task-Branch ist zu `origin` gepusht und trackt den Remote-Branch. Taskbezogen ist der Working Tree sauber; ausschließlich die vom Benutzer bestätigte, nicht zu KWF-006 gehörende Änderung in `docs/development/KITCHEN_WORKFLOW_TASK_MASTER_PROMPT.md` bleibt unstaged. Kein Pull Request, kein Merge.
- Geänderte Task-Dateien: `server/db.js`, `server/db-schema-test.js`, `server/routes/{meals,recipes,shopping}.js`, `server/services/{ingredient-quantities,meal-shopping-import,shopping-import}.js`, `public/utils/{ingredient-row,quantity}.js`, `public/pages/{meals,recipes,shopping}.js`, `public/styles/{layout,shopping}.css`, alle 23 `public/locales/*.json`, `server/openapi.js`, `test/{test-db,test-meals,test-shopping,test-quantity}.js`, `package.json`, `docs/SPEC.md`, `CHANGELOG.md`, `docs/development/{KITCHEN_WORKFLOW_MEMORY,KITCHEN_WORKFLOW_PLAN}.md`.
- Untersucht, aber unverändert: `public/components/modal.js`, `public/styles/{glass,meals,recipes}.css`, `public/sw.js`, `server/services/{meal-recurrence,shopping-item-sources}.js`, `server/scopes.js`, `server/mcp/tools.js`, `public/settings/pages/modules-kitchen.js` sowie Scopes-, Permissions-, MCP-, SW-, Housekeeping-, CalDAV-, Settings- und Kitchen-Tests. Keine neue Route, kein neuer Scope/Permission-Key und keine explizite SW-Änderung nötig; die neue gleiche-origin Utility nutzt das vorhandene Laufzeit-Cache-Muster.
- Bestätigte Annahmen: `quantity` bleibt unverändert und wird nie automatisch geparst. `amount`/`unit` müssen gemeinsam vorhanden, endlich, positiv und höchstens `1e9` sein; unterstützte Einheiten sind `g`, `kg`, `ml`, `l`. Aggregation erfolgt nur bei gleichem Namen, gleicher Kategorie und gleicher Dimension; jede Source bleibt erhalten. Recipe→Meal, Rekurrenzmaterialisierung, Serienbearbeitung, Einzelbearbeitung und alle Shopping-Importpfade propagieren strukturierte Werte additiv. Bestehende Transaktionsgrenzen bleiben erhalten.
- Automatische Tests bestanden: `test:quantity` 4/4, `test:db` 40/40, `test:shopping` 62/62, `test:meals` 46/46, `test:frontend-audit` 141/141, `test:datepicker` 24/24, `test:kitchen-tabs` 8/8, `test:sw-api-cache` 9/9, `test:token-scopes` 16/16, `test:permissions` 15/15, `test:mcp` 29/29, `test:housekeeping` 13/13, `test:caldav-reminders` 9/9, `test:settings-navigation` 65/65, `test:api` 11/11 und `test:changelog` 5/5; Syntaxchecks und Locale-JSON-Parsing bestanden; `git diff --check` bestanden.
- Vollsuite: `npm test` bestand alle gestarteten Suiten bis einschließlich DB 40/40, Shopping 62/62, Meals 46/46, Calendar 48/48, Notes/Contacts/Budget 52/52 und Task-Categories 13/13. Danach brach Node 24.12.0 reproduzierbar mit `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76` ab; entspricht KWF-FINDING-009 und trat außerhalb der KWF-006-Suiten auf.
- Browserprüfung: isolierte DB und lokaler Server; Recipe-Ingredient-Row sowie Shopping-Quick-Add/-Details zeigten und persistierten `1,5 kg` als strukturierte `1.5 kg`. Desktop 1440×900, Tablet 768×1024 und Mobil 390×844 ohne horizontalen Überlauf; Amount/Unit in logischer Tastaturreihenfolge und fokussierbar. Testserver beendet und Test-DB samt Sidecars entfernt. Der Login-Router blieb im Headless-Wartepunkt hängen; die API-Anmeldung war 200 und wurde für die ausschließlich Kitchen-bezogene Prüfung sessiongleich direkt verwendet.
- Findings: KWF-FINDING-006 ist gelöst. Offen bleiben KWF-FINDING-009 (Windows/Node-libuv) und KWF-FINDING-013 (separate Upstream-Integration). KWF-FINDING-017 dokumentiert die isolierte Benutzeränderung. Weitere offene Findings gehören ausschließlich zu späteren Tasks.
- Nächster sinnvoller Schritt: externe Prüfung des gepushten Task-Branches; keinen Pull Request erstellen, nicht nach `main` mergen und keinen Folge-Task beginnen. Die KWF-006-Analyse muss nicht erneut durchgeführt werden.
- Nicht erneut analysieren: Ursache des mobilen Fallbacks, vorhandener Recipe-Query-/ISO-POST-Datenfluss, Modal-Top-Layer-/Viewport-Verhalten, Home-/End-Semantik sowie Nichtbetroffenheit von DB/API/OpenAPI/Scopes/Permissions/i18n/SW sind verifiziert.

### Aktueller Handoff — KWF-007

- Letzter abgeschlossener Schritt: KWF-007 wurde vollständig analysiert, reserviert, implementiert, dokumentiert sowie automatisch und im Browser verifiziert und als Feature-Commit `70ed5cfd` erstellt; dieser Handoff-Dokumentationscommit und der Branch-Push schließen die Session ab.
- Aktueller Branch: `feature/pantry-mvp`, Basis Fork-`main` `f734c466`; `main` entspricht `origin/main`. `upstream/main` wurde wegen live bestätigter 20/10-Divergenz weder gemergt noch verändert.
- Commit-/Working-Tree-Status: Feature-Commit `70ed5cfd` enthält ausschließlich KWF-007-Dateien; nur dieser finale Handoff ist danach noch geändert. Beide Commits werden gemeinsam zu `origin/feature/pantry-mvp` gepusht. Kein Pull Request, kein Merge, kein Folge-Task.
- Geänderte Task-Dateien: Migration/Schema in `server/{db,db-schema-test}.js`; `server/services/inventory.js`, `server/routes/pantry.js`, `server/{index,openapi,permissions,scopes}.js`; `public/pages/pantry.js`, `public/styles/{pantry,kitchen-tabs,tokens}.css`, Router/Kitchen-Tabs/Settings/SW; alle 23 Locale-Dateien; Pantry-, DB- und Integrations-Tests; `package.json`, SPEC, Changelog, Plan und Memory.
- Untersucht, aber nicht fachlich geändert: bestehende Quantity-Utility, Shared Modal/API/i18n/HTML-Escaping, Auth-/Scope-Middleware, Kitchen-/Navigation-/Permission-Muster, Shopping/Meals/Recipes und MCP/OpenAPI-Bridge. KWF-008 Einkaufstransfer und KWF-009 Kochverbrauch wurden nicht begonnen.
- Bestätigte Annahmen/Entscheidungen: ein Pantry-Posten ist ein Los; gleiche Namen dürfen mehrfach vorkommen. `amount`/`unit` sind optional gepaart, endlich, nicht negativ und höchstens `1e9`; Freitext wird nie interpretiert. Jede Initialisierung/Korrektur/Gegenbuchung aktualisiert Cache und Journal atomar. Metadaten-PATCH kann Bestand nicht ändern; Soft-Delete bewahrt History. Pantry-API bleibt network-only.
- Automatische Tests bestanden: `test:pantry` 11/11, `test:db` 41/41, `test:shopping` 62/62, `test:meals` 46/46, `test:datepicker` 24/24, `test:kitchen-tabs` 8/8, `test:token-scopes` 16/16, `test:permissions` 15/15, `test:settings-navigation` 65/65, `test:sw-api-cache` 9/9, `test:mcp` 29/29, `test:api` 11/11, `test:changelog` 5/5, `test:mobile-scroll-layout` 6/6, `test:typography` 12/12 und `test:frontend-audit` 142/142; Locale-JSON-Parsing und Syntaxchecks bestanden. `npm test` bestand einschließlich Pantry 11/11 bis Task-Categories 13/13 und reproduzierte danach ausschließlich KWF-FINDING-009 mit `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76`.
- Browserprüfung: isolierte Migration-89-DB und lokaler Server; Desktop 1440×900, Tablet 768×1024 und Mobil 390×844 ohne horizontalen Überlauf. Vier Kitchen-Tabs sichtbar, Add-Modal in logischer Fokusreihenfolge, Anlage `2 l`, negative manuelle Entnahme auf `1,5 l` und zwei absteigende Journalbewegungen bestätigt; keine Console-Fehler. Dabei gefundener positiver-only Delta-Parser wurde taskbezogen korrigiert und automatisiert abgesichert. Testserver und temporäre DB/Scriptdateien wurden entfernt.
- Findings: KWF-FINDING-008, -010 und -018 sind gelöst. Offen bleiben KWF-FINDING-009 (Windows/Node-libuv) und KWF-FINDING-013 (separate Upstream-Integration); KWF-FINDING-007 und spätere Pantry-Quellen gehören ausdrücklich KWF-008/009.
- Nächster sinnvoller Schritt: externe Prüfung des gepushten Task-Branches. Kein Pull Request, kein Merge und kein Folge-Task.
- Nicht erneut analysieren: KWF-007-Scope, Lot-/Journalmodell, Migration 89, Route-/Scope-/Permission-Zuordnung, Kitchen-Integration, Locale-Keyset und Network-only-Entscheidung sind geklärt.

### Aktueller Handoff — KWF-008

- Letzter abgeschlossener Schritt: Der Benutzer hat KWF-008 extern akzeptiert; `feature/shopping-to-pantry` wurde mit `--no-ff` als Merge-Commit `245538f0` nach `main` integriert und zu `origin/main` gepusht.
- Aktueller Branch: `main`; `main...origin/main` wurde nach dem Merge-Push mit `0 0` bestätigt. `upstream/main` blieb wegen der dokumentierten Divergenz unverändert.
- Commit-/Working-Tree-Status: Feature-Commit `f77f092d`, Feature-Handoff `571f12c7` und Merge-Commit `245538f0` sind in `origin/main`; dieser reine Integrations-Handoff folgt als letzter Doku-Commit. Kein Pull Request und kein Folge-Task.
- Geänderte Dateien: `server/{db,db-schema-test,openapi}.js`, `server/routes/shopping.js`, `server/services/inventory.js`, `public/pages/{shopping,pantry}.js`, `public/permissions.js`, `public/styles/shopping.css`, alle 23 `public/locales/*.json`, `test/{test-db,test-pantry,test-shopping-pantry}.js`, `package.json`, `docs/SPEC.md`, `CHANGELOG.md` und Kitchen-Plan/-Memory.
- Untersucht, aber nicht fachlich geändert: bestehende Shopping-Check-/Swipe-Route, Pantry-Route, Quantity-Utility, Shared Modal/API/i18n/HTML-Escaping, globale Scope-/Permission-Middleware, Kitchen-Navigation, Service Worker, MCP/OpenAPI-Bridge, Meals/Recipes, Housekeeping und CalDAV. Kein neuer Scope-Key und keine SW-Änderung nötig.
- Bestätigte Annahmen/Entscheidungen: normales Abhaken bleibt unabhängig und erzeugt nie automatisch Bestand. Transfer verlangt `shopping:write` und `pantry:write`, ist explizit und atomar. Strukturierte Mengen werden nur bestätigt übernommen; Freitext wird nie geparst und muss sichtbar bestätigt werden. Vorhandene Lose werden nur mit strukturierter kompatibler Menge erhöht. Ein nicht gegengebuchter `shopping_item_id`-Bezug macht Replay und Parallelrequests idempotent; Undo erzeugt eine Gegenbewegung, lässt den Check stehen und erlaubt Redo.
- Automatische Tests bestanden: `test:shopping-pantry` 8/8, `test:db` 42/42, `test:pantry` 11/11, `test:shopping` 62/62, `test:meals` 46/46, `test:datepicker` 24/24, `test:kitchen-tabs` 8/8, `test:token-scopes` 16/16, `test:permissions` 15/15, `test:settings-navigation` 65/65, `test:sw-api-cache` 9/9, `test:mcp` 29/29, `test:housekeeping` 13/13, `test:caldav-reminders` 9/9, `test:api` 11/11, `test:changelog` 5/5, `test:mobile-scroll-layout` 6/6, `test:typography` 12/12 und `test:frontend-audit` 142/142; Syntaxchecks, Locale-JSON-/Key-Parität und `git diff --check` bestanden.
- Vollsuite: `npm test` bestand alle gestarteten Suiten einschließlich DB 42/42, Shopping 62/62, Shopping→Pantry 8/8, Pantry 11/11, Meals 46/46, Calendar 48/48, Notes/Contacts/Budget 52/52 und Task-Categories 13/13. Danach reproduzierte Node 24.12.0 ausschließlich KWF-FINDING-009: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76`; die danach verketteten Suiten wurden deshalb im Vollkommando nicht gestartet, aber die taskrelevanten davon separat erfolgreich ausgeführt.
- Browserprüfung: isolierte Migration-90-DB und lokaler Server; normales Checken, explizite Übernahme eines Legacy-Freitexts `2 l` ohne automatisches Parsing, Pantry-Kaufjournal, Undo und erneute Transferbereitschaft bestätigt. Desktop, Tablet 768×1024 und Mobil 390×844 ohne horizontalen Überlauf; logische Modal-Fokusfolge und keine Console-Fehler. Testserver und temporäre DB samt Sidecars wurden entfernt.
- Findings: KWF-FINDING-020 ist gelöst. Offen bleiben KWF-FINDING-009 (Windows/Node-libuv) und KWF-FINDING-013 (separate Upstream-Integration); KWF-009/010 bleiben ausdrücklich außerhalb dieses Tasks.
- Nächster sinnvoller Schritt: KWF-009 erst in einer neuen, ausdrücklich reservierten Session analysieren. In dieser Session wurde kein Folge-Task begonnen.
- Nicht erneut analysieren: Migration-90-Transferbezug, aktive Idempotenz, Reversal-/Redo-Semantik, kombinierte Rechteprüfung, Freitextgrenze, Transfermodal, Locale-Keyset und Network-only-Verhalten sind geklärt.

### Aktueller Handoff — KWF-009

- Letzter abgeschlossener Schritt: Der Benutzer hat KWF-009 extern akzeptiert; `feature/meal-cooking-consumption` wurde mit `--no-ff` als Merge-Commit `f89b2ec6` nach `main` integriert.
- Aktueller Branch: `main`; vor dem Merge entsprachen `main` und `origin/main` exakt `d8b98cf6`. `upstream/main` wurde wegen der dokumentierten Divergenz weder gemergt noch verändert.
- Commit-/Working-Tree-Status: Feature-Commit `cc836440`, Feature-Handoffs `395c70b3`/`64e7868b` und Merge-Commit `f89b2ec6` liegen auf `main`; nur dieser Integrations-Handoff ist danach geändert und wird als eigener Doku-Commit zusammen mit dem Merge zu `origin/main` gepusht. Kein Pull Request und kein KWF-010-Scope.
- Geänderte Dateien: Migration/Schema in `server/{db,db-schema-test}.js`; `server/services/{inventory,meal-cooking}.js`; `server/routes/meals.js`; `server/openapi.js`; `public/pages/meals.js`; `public/styles/meals.css`; alle 23 `public/locales/*.json`; `test/{test-db,test-meals,test-meal-cooking}.js`; `package.json`; `docs/SPEC.md`; `CHANGELOG.md`; Kitchen-Plan und -Memory.
- Untersucht, aber nicht fachlich geändert: Pantry-/Shopping-Routen und -Services, Ingredient-Quantity-Utility, Shared Modal/API/i18n/HTML-Escaping, globale Scope-/Permission-Middleware, Client-Permission-Mapping, Rekurrenzservice, Service Worker, MCP/OpenAPI-Bridge, Housekeeping, CalDAV und Settings-Navigation. Vorhandene Scope-Keys und statische Cachepfade reichen aus.
- Bestätigte Annahmen/Entscheidungen: Preview ist strikt read-only. Automatische Vorschläge verlangen exakten case-insensitiven Namen, strukturierte kompatible Dimension und ordnen frühestes nichtleeres Ablaufdatum zuerst; sie bleiben editierbar. Freitext und unsichere Namen werden nie geraten. Bestätigung verlangt `meals:write` und `pantry:write`, optional zusätzlich `shopping:write`, und schreibt Event, Snapshots, Bestandsentnahmen sowie ausgewählte Missing-Artikel atomar. Ein partieller Unique-Index verhindert parallelen Doppelverbrauch. Undo erzeugt exakte Gegenbewegungen; bewusst erzeugte Shoppingartikel bleiben erhalten.
- Automatische Tests bestanden: `test:meal-cooking` 8/8, `test:db` 43/43, `test:meals` 48/48, `test:frontend-audit` 142/142, `test:shopping-pantry` 8/8, `test:pantry` 11/11, `test:shopping` 62/62, `test:datepicker` 24/24, `test:kitchen-tabs` 8/8, `test:token-scopes` 16/16, `test:permissions` 15/15, `test:settings-navigation` 65/65, `test:sw-api-cache` 9/9, `test:mcp` 29/29, `test:housekeeping` 13/13, `test:caldav-reminders` 9/9, `test:api` 11/11, `test:changelog` 5/5, `test:mobile-scroll-layout` 6/6, `test:typography` 12/12; Syntaxchecks, Locale-JSON-/29-Key-Parität über 23 Locales und `git diff --check` bestanden.
- Vollsuite: `npm test` bestand alle gestarteten Suiten einschließlich DB 43/43, Shopping 62/62, Shopping→Pantry 8/8, Pantry 11/11, Meal-Cooking 8/8, Meals 48/48, Calendar 48/48, Notes/Contacts/Budget 52/52 und Task-Categories 13/13. Danach reproduzierte Node 24.12.0 ausschließlich KWF-FINDING-009: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76`; die danach verketteten Suiten wurden deshalb im Vollkommando nicht gestartet, taskrelevante spätere Suiten wurden separat erfolgreich ausgeführt.
- Browserprüfung: isolierte Migration-91-DB und lokaler Server; zwei strukturierte Flour-Lose wurden im Review korrekt als 500 g plus 1 kg nach Ablauf vorgeschlagen und bestätigt. Die unstrukturierte Pepper-Menge wurde nicht automatisch allokiert, sondern nur nach expliziter Missing-Auswahl mit Meal-Herkunft zur Einkaufsliste geschrieben. Undo stellte beide Lose über zwei exakte Gegenbewegungen wieder her und behielt den Shoppingartikel. Desktop, Tablet 768×1024 und Mobil 390×844 ohne horizontalen Überlauf; Dialogfokus/Escape funktionierten, keine Console- oder Page-Errors. Testserver und temporäre Dateien wurden entfernt.
- Findings: KWF-FINDING-011, -012 und -021 sind für KWF-009 gelöst. Offen bleiben KWF-FINDING-009 (Windows/Node-libuv) und KWF-FINDING-013 (separate Upstream-Integration); kein neues ungeklärtes KWF-009-Finding.
- Nächster sinnvoller Schritt: KWF-010 erst in einer neuen, ausdrücklich reservierten Session analysieren. In dieser Integrationssession wurde kein Folge-Task begonnen.
- Nicht erneut analysieren: Migration-91-Event-/Snapshotmodell, bestehender Movement-Type, Matching-/Einheitengrenze, konkrete Rekurrenzinstanz, Delete-Guard, kombinierte Rechteprüfung, atomare Transaktionsgrenze, Missing-Herkunft, Undo-Semantik, Modal-/Responsive-Verhalten und Locale-Keyset sind geklärt.

### Aktueller Handoff — KWF-010

- Letzter abgeschlossener Schritt: Der Benutzer hat KWF-010 extern akzeptiert; `feature/kitchen-workflow-integration` wurde mit `--no-ff` als Merge-Commit `070f47a0` nach `main` integriert und zu `origin/main` gepusht. Die Post-Merge-Suiten `test:kitchen-workflow` 3/3 und `test:datepicker` 25/25 bestanden.
- Aktueller Branch: `main`; `main...origin/main` wurde nach dem Merge-Push mit `0 0` bestätigt. `upstream/main` wurde wegen der dokumentierten Divergenz weder gemergt noch verändert.
- Commit-/Working-Tree-Status: Feature-Commit `77f5de84`, Feature-Handoff `0d3c5ce6` und Merge-Commit `070f47a0` liegen in `origin/main`; dieser reine Integrations-Handoff folgt als letzter Dokumentationscommit. Kein Pull Request, keine Branch-Löschung und kein Folge-Task.
- Geänderte Dateien: `test/test-kitchen-workflow.js`, `test/test-datepicker.js`, `public/components/datepicker.js`, `package.json`, `docs/SPEC.md`, `CHANGELOG.md`, Kitchen-Plan und -Memory. Keine Migration, Route, Service-, OpenAPI-, Scope-, Permission-, Locale-, CSS- oder Service-Worker-Datei musste geändert werden.
- Untersucht, aber fachlich unverändert: produktive Migrationen 86–91 und Schema-Tests; Meals-/Shopping-/Pantry-Routen und Import-/Inventory-/Cooking-Services; Recipe-/Meal-/Shopping-/Pantry-Frontend; OpenAPI/MCP-Bridge; Token-Scopes, Mitgliederrechte, Service Worker, Kitchen-/Settings-Navigation, alle 23 Locale-Dateien, Installer-Schema, Housekeeping und CalDAV.
- Bestätigte Annahmen/Entscheidungen: v85→v91 ist additiv und erhält Legacy-Daten. Der Fachfluss bewahrt Herkunft, Snapshots, aktive Idempotenz und Gegenbewegungen; erzwungene Cooking-Fehler hinterlassen weder Event noch Allokation oder Teilbewegung. Pantry-API bleibt network-only, statische Assets bleiben precached. Alle 23 Locales besitzen exakt dasselbe Keyset mit 3060 Blatt-Keys. Keine neue ADR war nötig. Datepicker-Escape gehört dem offenen Picker, stoppt dort die Propagation und gibt den Fokus zurück; ohne offenen Picker bleibt das bestehende Modal-Escape unverändert.
- Automatische Tests bestanden: `test:kitchen-workflow` 3/3, `test:db` 43/43, `test:quantity` 4/4, `test:shopping` 62/62, `test:shopping-pantry` 8/8, `test:pantry` 11/11, `test:meal-cooking` 8/8, `test:meals` 48/48, `test:datepicker` 25/25, `test:kitchen-tabs` 8/8, `test:frontend-audit` 142/142, `test:sw-api-cache` 9/9, `test:token-scopes` 16/16, `test:permissions` 15/15, `test:settings-navigation` 65/65, `test:mcp` 29/29, `test:housekeeping` 13/13, `test:caldav-reminders` 9/9, `test:api` 11/11, `test:installer-schema` 27/27, `test:mobile-scroll-layout` 6/6, `test:typography` 12/12 und `test:changelog` 5/5.
- Vollsuite: `npm test` bestand alle gestarteten Suiten einschließlich DB 43/43, Shopping 62/62, Shopping→Pantry 8/8, Pantry 11/11, Meal-Cooking 8/8, KWF-Integration 3/3, Meals 48/48, Calendar 48/48, Notes/Contacts/Budget 52/52 und Task-Categories 13/13. Danach reproduzierte die einzige installierte Node-LTS-Version 24.12.0 KWF-FINDING-009 exakt mit `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`; die taskrelevanten späteren Suiten wurden separat erfolgreich ausgeführt.
- Browserprüfung: isolierte Migration-91-DB und lokaler Server; Rezept „Browser Brot“ wurde in das vorbefüllte Meal-Modal übernommen, mit strukturiertem `1 kg` und explizitem Shopping-Import angelegt und als Shoppingartikel samt Herkunft „Aus: Browser Brot · 14.07.2026“ angezeigt. Home/End und Escape wurden per Tastatur geprüft. Der zunächst reproduzierte doppelte Escape-Close wurde behoben: Kalender schließt allein, Meal-Modal bleibt offen und Fokus kehrt zum Trigger zurück. Desktop 1440×900, Tablet 768×1024 und Mobil 390×844 ohne horizontalen Überlauf; mobiles Modal und Kalender vollständig im Viewport; keine Console-Warnungen/-Fehler. Testserver und temporäre DB samt Sidecars wurden entfernt. Die Browser-Skill-Anleitung führte zur echten UI-, Fokus- und Viewportprüfung statt nur statischer Frontend-Verträge.
- Findings: KWF-FINDING-007 war bereits durch KWF-008 gelöst und ist korrigiert dokumentiert. KWF-FINDING-022 und KWF-FINDING-023 sind gelöst. Offen bleiben KWF-FINDING-009 (Windows/Node-libuv; reproduziert, Tooling-Follow-up) und KWF-FINDING-013 (separate Upstream-Integration); beide blockieren den isolierten KWF-010-Feature-Branch nicht.
- Nächster sinnvoller Schritt: Der geplante Kitchen-Workflow KWF-001 bis KWF-010 ist abgeschlossen. Nur auf neue ausdrückliche Anweisung einen weiteren Task beginnen.
- Nicht erneut analysieren: produktiver v85→v91-Upgradepfad, Recipe→Meal→Shopping→Pantry→Cook/Undo-Datenfluss, bestehende Transaktions-/Rollback-/Replay-Grenzen, OpenAPI-/Scope-/Permission-Zuordnung, Network-only-Pantry-API, vollständiges Locale-Keyset und verschachteltes Datepicker-Escape/Fokusverhalten sind geklärt.

### Aktueller Handoff — KWF-FINDING-009

- Letzter abgeschlossener Schritt: Der Windows/Node-24-Prozessabbruch wurde in den vier betroffenen Test-Harnesses und im Server-Lifecycle behoben; der vollständige `npm test`-Lauf endete mit Exit 0.
- Aktueller Branch: `main`; der Fix-Branch `fix/windows-category-test-cleanup` wurde über Merge-Commit `9a4d6a94` integriert. `upstream/main` wurde nur gefetcht und nicht verändert.
- Commit-/Working-Tree-Status: Feature-Commit `bb72733f` ist zu `origin/fix/windows-category-test-cleanup` gepusht und über `9a4d6a94` in `main` integriert; dieser Handoff-Abgleich folgt als reiner Dokumentationscommit vor dem Push von `origin/main`.
- Geänderte Dateien: `server/index.js`, `test/test-task-categories.js`, `test/test-contact-categories.js`, `test/test-admin-password-reset.js`, `test/test-setup.js`, Kitchen-Plan und -Memory.
- Untersucht, aber fachlich unverändert: Task-/Contact-Category-Routen und Datenmodelle, Auth-/Setup-API, Calendar-Sync-Aufgaben, Push-/Medication-/Split-Expense-Scheduler sowie sämtliche durch `npm test` abgedeckten Fachbereiche.
- Bestätigte Annahmen/Entscheidungen: Der Fehler war ein Test-Lifecycle-Problem, kein Kitchen-Fachfehler. Abgewartetes `server.close()`, geschlossene SQLite-Verbindungen und `process.exitCode` verhindern die libuv-Assertion. Der bestehende HTTP-Listen-Handle kann additiv exportiert werden; `unref()` ändert Scheduler-Ausführung bei laufendem Server nicht, verhindert aber künstliches Offenhalten nach dessen Schließung. Keine neue ADR, Migration, API-, OpenAPI-, Scope-, Permission-, Frontend-, i18n- oder Service-Worker-Änderung war nötig.
- Automatische Tests bestanden: `npm run test:task-categories` 13/13, `npm run test:contact-categories` 12/12, `npm run test:admin-password-reset` 3/3 und `npm run test:setup` 13/13, jeweils unter Windows/Node 24.12.0; `npm test` vollständig mit Exit 0. `git diff --check` bestand.
- Offene Findings: KWF-FINDING-009 ist gelöst. KWF-FINDING-013 (Fork-/Upstream-Divergenz) bleibt als separater Repository-Integrations-Follow-up offen.
- Nächster sinnvoller Schritt: Diesen Handoff committen, `main` zu `origin` pushen und danach KWF-FINDING-013 auf einem eigenen Integrationsbranch analysieren.
- Nicht erneut analysieren: libuv-Reproduktion, Category-Harness-Ursache, Entrypoint-Test-Lifecycle, Server-/Backup-Scheduler-Cleanup und Nichtbetroffenheit der Fachverträge sind geklärt.
