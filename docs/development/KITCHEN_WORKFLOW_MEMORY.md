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

### Recipes

- Tabellen: `recipes`, `recipe_ingredients`; eingeführt durch Migration 13.
- CRUD unter `/api/v1/recipes`; Rezept und Zutaten werden gemeinsam transaktional erstellt bzw. ersetzt.
- `public/pages/recipes.js` navigiert bei „Zum Essensplan“ nach `/meals?recipe=<id>`.
- `public/pages/meals.js` öffnet daraufhin das vorhandene Mahlzeitenmodal für heute, wählt den ersten sichtbaren Mahlzeittyp und kopiert Rezeptdaten/Zutaten in den Dialog.
- Das Rezept bleibt über `meals.recipe_id` verknüpft; spätere Rezeptänderungen überschreiben bestehende Mahlzeitenzutaten nicht.

### Shopping

- Tabellen: `shopping_lists`, `shopping_items`, `shopping_categories`.
- `shopping_items.quantity` ist Freitext. `added_from_meal` erlaubt nur genau einen Mahlzeitenbezug und wird bei Löschen der Mahlzeit `NULL`.
- `PATCH /api/v1/shopping/items/:itemId` setzt unter anderem `is_checked`; Abhaken erzeugt aktuell keine weitere Domänenaktion.
- `POST /api/v1/shopping/:listId/import-meal-plan` importiert einen Datumsbereich. `aggregateMealIngredients()` gruppiert gleiche Namen/Kategorien/Einheiten, wenn eine numerische Präfixmenge erkannt wird.
- Wenn eine aggregierte Position aus mehreren Mahlzeiten stammt, wird `added_from_meal` bewusst `NULL`; Herkunft geht damit verloren.
- Task-1-Arbeitsstand ergänzt Migration 86, `sort_order`, deterministische Legacy-Migration, zentralen Default-Listen-Helper, Reorder-API, responsive Reorder-UI und vollständige Locale-Texte. Der Benutzer hat die Funktion manuell bestätigt.
- KWF-003 ergänzt Migration 87 und `shopping_item_sources`. Einzel-, Wochen- und Bereichsimport erzeugen Einkaufsartikel, Herkunftssnapshot und Transfer-Flag atomar. Der Bereichsimport legt bis KWF-006 jede Freitextzutat getrennt an. REST-Antworten für Einkaufsartikel enthalten rückwärtskompatibel `sources: []`; die UI zeigt eine Quelle inline und mehrere Quellen in einem nativen, zugänglichen Aufklapper.
- KWF-006 ergänzt mit Migration 88 optionale `amount REAL`/`unit TEXT`-Felder in allen drei Ingredient-Tabellen und `shopping_items`. `quantity TEXT` bleibt unverändert. Nur `g`/`kg` sowie `ml`/`l` werden dimensionsgleich aggregiert; Freitext und inkompatible Einheiten bleiben getrennte Positionen mit allen Quellen.
- Default-Verbraucher im Task-1-Stand: Shopping-GET, Meals-Listenauswahl über sortierte API-Reihenfolge, MCP, Housekeeping und CalDAV-Reminders.

### Datenmodell

- Mengen sind in `recipe_ingredients`, `meal_ingredients`, `meal_recurrence_ingredients` und `shopping_items` weiterhin als `quantity TEXT` gespeichert und seit Migration 88 additiv über optionale `amount REAL`/`unit TEXT` strukturiert. Bestehende Freitextwerte wurden nicht zurückgefüllt oder interpretiert.
- Es gibt kein Zutatenstammdatenmodell, keine Vorratstabellen, kein Bewegungsjournal und kein Cooking-Event.
- Kategorien sind bei Zutaten/Artikeln als Text gespeichert; Shopping-Kategorien sind administrierbar und sortierbar.
- Zeitstempel und `updated_at`-Trigger folgen einem etablierten Muster. Migrationen sind fortlaufend versioniert und werden jeweils transaktional in `schema_migrations` registriert.

### Frontend

- Kitchen ist eine gemeinsame Navigation aus `/meals`, `/recipes`, `/shopping`; Definitionen liegen in `public/router.js` und `public/utils/kitchen-tabs.js`.
- Formulare verwenden das gemeinsame Modal aus `public/components/modal.js` und gemeinsame Ingredient-Row-Struktur aus `public/utils/ingredient-row.js`.
- KWF-006 erweitert die gemeinsame Ingredient-Row sowie Shopping-Quick-Add und -Details um manuell korrigierbare strukturierte Mengen. `public/utils/quantity.js` enthält die gemeinsame Browser-Validierung, Konvertierung und Anzeigeformatierung.
- Der gewünschte Microkalender ist in `public/components/datepicker.js` vorhanden. KWF-005 öffnet den Monatskalender mit Heute-/Auswahlmarkierung, Monatsnavigation und Tastatursteuerung für `type="date"` jetzt auf Desktop, Tablet und Smartphone; nur `type="time"` darf auf groben Pointern weiter den nativen Picker verwenden. Der Wert bleibt ISO `YYYY-MM-DD`.
- Der Rezept→Essensplan-Flow nutzt `<yuvomi-datepicker type="date">` im bestehenden Meal-Modal. KWF-005 änderte deshalb ausschließlich die gemeinsame Datepicker-Integration und keine Meals-/Recipes-/Modal-Implementierung.
- Shopping-Abhaken erfolgt per Klick, Tastatur oder Swipe und endet derzeit nach dem `PATCH is_checked`.

### Tests

- Meals und Shopping haben kombinierte DB-, API-nahe und statische Frontend-Tests.
- Eigene Suiten existieren für DB-Migrationen, Datepicker, Kitchen-Tabs, Service-Worker-Cache, Navigation, MCP, Housekeeping und CalDAV.
- Task 1 wurde zuletzt erfolgreich geprüft mit: Shopping 51/51, DB 38/38, MCP 29/29, CalDAV-Reminders 9/9, Housekeeping 13/13, Meals 39/39, Frontend-Audit 141/141.
- KWF-006 ergänzt die eigenständige Suite `npm run test:quantity` und erweitert DB-, Shopping- und Meals-Regressionen um Migration 88, API-Validierung, Snapshot-Propagation und Quellenaggregation.
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
| 2026-07-14 | Codex | KWF-007 / `feature/pantry-mvp` | Untersucht und geändert: Migration 89/Schema-Test, Inventory-Service, Pantry-Route, Scope/Rechte/OpenAPI, Pantry-Seite/-Styles, Router/Kitchen-Tabs/Settings/SW, alle 23 Locales, fokussierte Pantry-/DB-/Integrations-Tests, SPEC/Changelog/Kitchen-Doku | Core-Pantry-MVP mit Lot-Modell, atomarem unveränderlichem Bewegungsjournal und Network-only-API implementiert und lokal fokussiert verifiziert | Implementierung und fokussierte Verifikation abgeschlossen; Git-Abschluss ausstehend | keine aktive Fremdreservierung; KWF-006 ist in `main`; Fork-`main` vs. `upstream/main` live 20/10 divergent, daher kein Upstream-Merge; kein KWF-008/009-Scope begonnen |

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
- Status: **proposed**.

### ADR-KITCHEN-009 — Kochen als eigenes Event

- Problem: Ein boolescher Meal-Status kann Verbrauch, Undo und Journalbezug nicht ausreichend abbilden.
- Entscheidung: `meal_cooking_events` protokolliert bestätigte Kochvorgänge; Bewegungen referenzieren das Event. Für eine konkrete geplante Mahlzeit ist zunächst höchstens ein aktives Event erlaubt.
- Begründung: Nachvollziehbarkeit und Gegenbuchung ohne Datenlöschung.
- Alternativen: `meals.is_cooked`; lose Bewegungsnotizen.
- Auswirkungen: Preview ist read-only, Bestätigung atomar, Undo erzeugt Gegenbewegungen.
- Status: **proposed**.

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
| `inventory_movements` | unveränderliches Journal; Typ, Delta/Einheit, Saldo, Anzeige vorher/nachher, Grund, eindeutiger Idempotency-Key, Reversal, Actor, Zeit | Pantry-Posten; Self-FK für Gegenbewegung | Basis in KWF-007 implementiert, spätere Quellen ausschließlich KWF-008/009 | keine Update-/Delete-API; eindeutiger Reversal-Index und Idempotency-Key verhindern Doppelbuchung |
| `meal_cooking_events` (geplant) | bestätigter Kochvorgang; Meal, Status, Actor, Zeit | Meal; 1:n Bewegungen | neu in KWF-009 | keine Änderung bestehender Meals; aktives Event je Meal eindeutig |

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
| `POST /api/v1/shopping/items/:id/to-pantry` | bestätigte Menge, Einheit, Ort, optional Zielposten | Artikel prüfen; Check+Pantry+Movement atomar; Idempotency-Key eindeutig | Nicht-Lebensmittel abbrechen; Wiederholung liefert vorhandenes Ergebnis/409 ohne Doppelbuchung |
| `POST /api/v1/meals/:id/cook-preview` | optional Matching-Overrides → Verbrauchsvorschlag | read-only, keine Bewegung | fehlende/unklare Menge sichtbar |
| `POST /api/v1/meals/:id/cook` | bestätigte Allokationen und optionale Missing→Shopping-Aktion | Cooking-Event, Bewegungen und optionale Shoppingartikel in einer Transaktion | zweite aktive Buchung abweisen; Unterbestand/Einheitenkonflikt rollt zurück |
| `POST /api/v1/meals/:id/cook/undo` | Event-ID/Grund | Gegenbewegungen + Eventstatus atomar | bereits rückgängig, fremdes Event |

Alle neuen Pfade müssen in `server/openapi.js`, `server/scopes.js` und den Berechtigungstests abgebildet werden. Pantry erhält einen eigenen Scope-Key; Meals/Recipes bleiben beim bestehenden `meals`-Scope, Shopping beim `shopping`-Scope.

## 8. Frontend-Mapping

| Ansicht/Datei | Geplante Verantwortung | Handler/Formulare | i18n / Mobil-Tablet |
|---|---|---|---|
| `public/pages/shopping.js` | Quellen anzeigen; KWF-006 strukturierte Menge in Quick-Add, Anzeige und Detailkorrektur; später Kauf→Vorrat | bestehende Check-/Swipe-Handler; strukturierte Felder werden gepaart validiert und per bestehendem POST/PATCH gespeichert | `quantity.*` in 23 Locales; 390/768/1440 px ohne Überlauf, Controls tastaturfokussierbar |
| `public/pages/meals.js` | KWF-004: optionaler Import; KWF-006 strukturierte Rezept-/Meal-/Serien-Snapshots und manuelle Korrektur | `buildModalContent`/`saveModal`, Einzel-Edit, Copy/Scale/Apply-Plan propagieren `amount`,`unit`; kein stiller Freitextparser | gemeinsamer `quantity.*`-Namespace; responsive Ingredient-Row |
| `public/pages/recipes.js` | bestehende Navigation; KWF-006 strukturierte Rezeptzutaten | Create/Update/Copy und `add-to-meals` erhalten `amount`,`unit` | gemeinsamer `quantity.*`-Namespace; Freitextanzeige bleibt Fallback |
| `public/components/datepicker.js` | gemeinsamer Microkalender; KWF-005 öffnet das Datumspopover auch bei grobem Pointer und ergänzt Home/End-Navigation | bestehendes Grid/Keyboard; nativer Touch-Picker bleibt nur für Uhrzeit | KWF-005 nutzt vorhandene Texte; keine Marker-API ohne separaten Reviewbedarf |
| `public/pages/pantry.js` | Liste/Karten, Suche, Kategorie/Ort/Mindestbestand/Ablauf-Filter, CRUD, Korrektur und History | Shared Modal; Add/Edit/Adjust/Reversal/Delete; Read-only blendet Schreibaktionen aus | `pantry.*` in 23 Locales; responsive Grid/Filter, Touch-Ziele und Reduced Motion in `pantry.css` |
| `public/router.js`, `public/utils/kitchen-tabs.js` | `/pantry` als Kitchen-Child | Route, Titel, Nav-Ziel, Shortcuts | `nav.pantry` in allen Locales |
| `public/settings/pages/modules-kitchen.js` | Pantry-bezogene bestätigte Defaults, falls später nötig | keine globale Autoübernahme im MVP | explizite, sichere Defaults |
| `public/sw.js` | Pantry-JS/CSS als statische Assets; Pantry-API bewusst nicht in der GET-Whitelist | Cachelisten/Network-only-API | keine Offline-Mutationen und keine veralteten Bestände im API-Cache |
| `public/styles/*.css` | Quellen, KWF-006 Mengenfelder, spätere Pantry | bestehende Tokens/Breakpoints | Desktop, Tablet, Mobile; Reduced Motion |

Neue i18n-Namensräume: KWF-006 implementiert `quantity.*`; KWF-007 implementiert `nav.pantry` und `pantry.*` mit fachlichem Deutsch/Englisch und vollständiger Key-Parität in allen 23 Locale-Dateien. Geplant bleiben `shopping.addToPantry*` und `meals.cook*`.

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
| KWF-008 Einkauf→Vorrat | Idempotenz | Transfer/Undo/Recheck | eindeutiger Transferbezug | Bestätigungsdialog | normales Abhaken | geplant |
| KWF-009 Kochen→Verbrauch | Matching/FIFO-Vorschlag | Preview/Commit/Undo | Event+Bewegungen | Reviewdialog/Missing | Meal/Shopping/Pantry | geplant |
| KWF-010 Integration | Cross-Domain | E2E API-Flows | Upgrade-Szenarien | Desktop/Tablet/Mobile/a11y | `npm test` | geplant |

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
- Status: offen.
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
- Empfehlung: Separat gegen unterstützte Node-LTS-Version und isolierten Testprozess prüfen; nicht als Featurefehler deklarieren.
- Status: offen, reproduziert.
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
- Status: **resolved für KWF-004**; nur die konkret erzeugte Startinstanz wird importiert. Die spätere Materialisierung weiterer Instanzen bleibt expliziter Scope von KWF-009.
- Task: KWF-004/KWF-009.

### KWF-FINDING-012 — Löschungen benötigen Snapshots

- Betroffen: geplante Quellen/Cooking-Events, bestehende Rezept-/Meal-Löschung.
- Schweregrad: mittel.
- Auswirkung: `ON DELETE SET NULL` allein bewahrt keinen Anzeigenamen und kein Datum.
- Empfehlung: Label-, Datums- und Mengen-Snapshots beim Erzeugen speichern.
- Status: **resolved für Shopping-Quellen in KWF-003**; Cooking-Event-Snapshots bleiben Teil von KWF-009.
- Task: KWF-003/KWF-009.

### KWF-FINDING-013 — Fork-`main` und `upstream/main` sind divergent

- Betroffen: Repository-Baseline vor KWF-003; Überschneidungen insbesondere in `docs/SPEC.md`, `CHANGELOG.md`, allen Locale-Dateien und `test/test-frontend-audit.js`.
- Schweregrad: mittel für spätere Upstream-Integration, niedrig für den isolierten KWF-003-Scope.
- Auswirkung: `main` kann nicht per Fast-Forward synchronisiert werden. Vor KWF-003 betrug `main...upstream/main` 7/8 Commits; vor KWF-004 sind es nach der KWF-003-Integration 9/8 Commits. Ein ungeprüfter Merge würde Kitchen-Historie und die Upstream-v1.20.0-Änderungen vermischen.
- Empfehlung: KWF-003 auf dem aktuellen, sauberen Fork-`main` implementieren; Upstream-Integration separat und konfliktbewusst durchführen.
- Status: offen; für KWF-006 erneut live mit 15/10 Commits verifiziert, keine taskbezogene Upstream-Synchronisierung vorgenommen.
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

- Letzter abgeschlossener Schritt: KWF-007 wurde vollständig analysiert, reserviert, implementiert, dokumentiert sowie automatisch und im Browser verifiziert; ausschließlich Git-Abschluss folgt.
- Aktueller Branch: `feature/pantry-mvp`, Basis Fork-`main` `f734c466`; `main` entspricht `origin/main`. `upstream/main` wurde wegen live bestätigter 20/10-Divergenz weder gemergt noch verändert.
- Commit-/Working-Tree-Status: ausschließlich KWF-007-Dateien sind geändert beziehungsweise neu; Commit und Push stehen noch aus. Kein Pull Request, kein Merge, kein Folge-Task.
- Geänderte Task-Dateien: Migration/Schema in `server/{db,db-schema-test}.js`; `server/services/inventory.js`, `server/routes/pantry.js`, `server/{index,openapi,permissions,scopes}.js`; `public/pages/pantry.js`, `public/styles/{pantry,kitchen-tabs,tokens}.css`, Router/Kitchen-Tabs/Settings/SW; alle 23 Locale-Dateien; Pantry-, DB- und Integrations-Tests; `package.json`, SPEC, Changelog, Plan und Memory.
- Untersucht, aber nicht fachlich geändert: bestehende Quantity-Utility, Shared Modal/API/i18n/HTML-Escaping, Auth-/Scope-Middleware, Kitchen-/Navigation-/Permission-Muster, Shopping/Meals/Recipes und MCP/OpenAPI-Bridge. KWF-008 Einkaufstransfer und KWF-009 Kochverbrauch wurden nicht begonnen.
- Bestätigte Annahmen/Entscheidungen: ein Pantry-Posten ist ein Los; gleiche Namen dürfen mehrfach vorkommen. `amount`/`unit` sind optional gepaart, endlich, nicht negativ und höchstens `1e9`; Freitext wird nie interpretiert. Jede Initialisierung/Korrektur/Gegenbuchung aktualisiert Cache und Journal atomar. Metadaten-PATCH kann Bestand nicht ändern; Soft-Delete bewahrt History. Pantry-API bleibt network-only.
- Automatische Tests bestanden: `test:pantry` 11/11, `test:db` 41/41, `test:shopping` 62/62, `test:meals` 46/46, `test:datepicker` 24/24, `test:kitchen-tabs` 8/8, `test:token-scopes` 16/16, `test:permissions` 15/15, `test:settings-navigation` 65/65, `test:sw-api-cache` 9/9, `test:mcp` 29/29, `test:api` 11/11, `test:changelog` 5/5, `test:mobile-scroll-layout` 6/6, `test:typography` 12/12 und `test:frontend-audit` 142/142; Locale-JSON-Parsing und Syntaxchecks bestanden. `npm test` bestand einschließlich Pantry 11/11 bis Task-Categories 13/13 und reproduzierte danach ausschließlich KWF-FINDING-009 mit `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76`.
- Browserprüfung: isolierte Migration-89-DB und lokaler Server; Desktop 1440×900, Tablet 768×1024 und Mobil 390×844 ohne horizontalen Überlauf. Vier Kitchen-Tabs sichtbar, Add-Modal in logischer Fokusreihenfolge, Anlage `2 l`, negative manuelle Entnahme auf `1,5 l` und zwei absteigende Journalbewegungen bestätigt; keine Console-Fehler. Dabei gefundener positiver-only Delta-Parser wurde taskbezogen korrigiert und automatisiert abgesichert. Testserver und temporäre DB/Scriptdateien wurden entfernt.
- Findings: KWF-FINDING-008, -010 und -018 sind gelöst. Offen bleiben KWF-FINDING-009 (Windows/Node-libuv) und KWF-FINDING-013 (separate Upstream-Integration); KWF-FINDING-007 und spätere Pantry-Quellen gehören ausdrücklich KWF-008/009.
- Nächster sinnvoller Schritt: finaler Diff-/Git-Abschluss; danach externe Prüfung des gepushten Task-Branches. Kein Pull Request, kein Merge und kein Folge-Task.
- Nicht erneut analysieren: KWF-007-Scope, Lot-/Journalmodell, Migration 89, Route-/Scope-/Permission-Zuordnung, Kitchen-Integration, Locale-Keyset und Network-only-Entscheidung sind geklärt.
