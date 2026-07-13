# Kitchen Workflow Memory

Stand: 2026-07-13  
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
- Task 1 liegt als noch uncommitteter, vom Benutzer funktional bestätigter Stand auf `feature/shopping-list-order`. Er wurde für die Planungsarbeit sicher zwischengespeichert und wird nicht neu implementiert.

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
- Default-Verbraucher im Task-1-Stand: Shopping-GET, Meals-Listenauswahl über sortierte API-Reihenfolge, MCP, Housekeeping und CalDAV-Reminders.

### Datenmodell

- Mengen sind in `recipe_ingredients`, `meal_ingredients`, `meal_recurrence_ingredients` und `shopping_items` als `TEXT` gespeichert.
- Es gibt kein Zutatenstammdatenmodell, keine Vorratstabellen, kein Bewegungsjournal und kein Cooking-Event.
- Kategorien sind bei Zutaten/Artikeln als Text gespeichert; Shopping-Kategorien sind administrierbar und sortierbar.
- Zeitstempel und `updated_at`-Trigger folgen einem etablierten Muster. Migrationen sind fortlaufend versioniert und werden jeweils transaktional in `schema_migrations` registriert.

### Frontend

- Kitchen ist eine gemeinsame Navigation aus `/meals`, `/recipes`, `/shopping`; Definitionen liegen in `public/router.js` und `public/utils/kitchen-tabs.js`.
- Formulare verwenden das gemeinsame Modal aus `public/components/modal.js` und gemeinsame Ingredient-Row-Struktur aus `public/utils/ingredient-row.js`.
- Der gewünschte Microkalender ist bereits vorhanden: `public/components/datepicker.js` zeigt auf Desktop einen Monatskalender mit Heute-/Auswahlmarkierung, Monatsnavigation und Tastatursteuerung; auf Touch wird bevorzugt der native Picker geöffnet. Der Wert bleibt ISO `YYYY-MM-DD`.
- Der Rezept→Essensplan-Flow nutzt bereits `<yuvomi-datepicker type="date">` im Meal-Modal. KWF-005 ist daher eine Verifikations-/Integrationsaufgabe, keine neue Kalenderkomponente.
- Shopping-Abhaken erfolgt per Klick, Tastatur oder Swipe und endet derzeit nach dem `PATCH is_checked`.

### Tests

- Meals und Shopping haben kombinierte DB-, API-nahe und statische Frontend-Tests.
- Eigene Suiten existieren für DB-Migrationen, Datepicker, Kitchen-Tabs, Service-Worker-Cache, Navigation, MCP, Housekeeping und CalDAV.
- Task 1 wurde zuletzt erfolgreich geprüft mit: Shopping 51/51, DB 38/38, MCP 29/29, CalDAV-Reminders 9/9, Housekeeping 13/13, Meals 39/39, Frontend-Audit 141/141.
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
| 2026-07-13 | Hauptagent | KWF-002 / `feature/shopping-list-order` | Task-1-Dateien laut Handoff | Bestehende Implementierung analysiert und Testergebnisse dokumentiert; keine Änderung in dieser Session | implementiert, uncommittet | separater Review/Commit/Push nötig |
| 2026-07-13 | Hauptagent | KWF-001 | `docs/development/KITCHEN_WORKFLOW_MEMORY.md` | Zentrale Wissensbasis angelegt | abgeschlossen | bei jeder Session fortschreiben |
| 2026-07-13 | Hauptagent | KWF-001 | `docs/development/KITCHEN_WORKFLOW_PLAN.md` | Vollständige Task-Zerlegung angelegt | abgeschlossen | Architekturvorschläge im Review bestätigen |
| 2026-07-13 | Hauptagent | KWF-001 / Agent-Handoff | `docs/development/KITCHEN_WORKFLOW_TASK_MASTER_PROMPT.md` | Wiederverwendbaren, taskgebundenen Startprompt mit Reservierungs-, Analyse-, Test-, Memory- und Git-Gates angelegt | abgeschlossen | pro Session Task-ID und optional Branch/Vorgaben einsetzen |

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
- Status: **proposed**.

### ADR-KITCHEN-003 — Vorrat als Core-Kitchen-Bereich

- Problem: Pantry benötigt Core-Navigation, Scopes, DB-Transaktionen und enge Verknüpfung zu Shopping/Meals.
- Entscheidung: `/pantry` wird ein vierter Core-Kitchen-Child neben Meals, Recipes und Shopping.
- Begründung: Third-Party-Module sollen laut `MODULES.md` Core nicht verändern und sind für atomare Cross-Core-Workflows ungeeignet.
- Alternativen: echtes Drittanbieter-Modul; Unteransicht von Shopping.
- Auswirkungen: Router, Kitchen-Tabs, Module-Rechte, Settings-Navigation, Service Worker und Tests werden erweitert.
- Status: **proposed**.

### ADR-KITCHEN-004 — Bestandsänderungen über Bewegungsjournal

- Problem: Direktes Überschreiben eines Bestands ist nicht nachvollziehbar und schwer rückgängig zu machen.
- Entscheidung: Jede Erhöhung, Entnahme, Korrektur und Rücknahme erzeugt eine unveränderliche `inventory_movements`-Zeile; Rücknahmen erzeugen Gegenbewegungen.
- Begründung: Auditierbarkeit, Idempotenz und spätere Einkaufs-/Koch-Verknüpfungen.
- Alternativen: nur aktueller Bestand; veränderbare History-Zeilen.
- Auswirkungen: Bestandsanzeige wird aus Bewegungen berechnet oder mit geprüftem Cache abgeleitet; niemals stille Löschung historischer Bewegungen.
- Status: **proposed**.

### ADR-KITCHEN-005 — Mahlzeit und optionaler Einkaufsimport atomar

- Problem: Zwei Requests können „Mahlzeit gespeichert, Import fehlgeschlagen“ erzeugen.
- Entscheidung: `POST /api/v1/meals` akzeptiert einen optionalen Importblock und führt Mahlzeit, Zutaten, Einkaufsartikel, Herkunft und Flags in derselben SQLite-Transaktion aus.
- Begründung: Die fachliche Operation ist eine Einheit.
- Alternativen: Client-Kompensation; separater Batch-Endpunkt.
- Auswirkungen: Vollständige Vorabvalidierung der Zielliste; bei jedem Fehler vollständiger Rollback.
- Status: **proposed**.

### ADR-KITCHEN-006 — Freitextmenge bleibt erhalten

- Problem: Bestehende Mengen wie „etwas“ oder „1 Dose“ sind nicht sicher konvertierbar.
- Entscheidung: Bestehendes `quantity` bleibt unverändert als Anzeige-/Legacywert. Optionale numerische Felder `amount` und `unit` werden schrittweise ergänzt; unbekannte Werte bleiben unstrukturiert.
- Begründung: Keine Datenverluste und keine erfundene Interpretation.
- Alternativen: harte Migration; automatische/KI-basierte Parsingpflicht.
- Auswirkungen: Nur deterministisch kompatible strukturierte Mengen dürfen gerechnet werden.
- Status: **proposed**.

### ADR-KITCHEN-007 — Duplikate in zwei Stufen

- Problem: Gleiche Namen können inkompatible Freitextmengen und mehrere Quellen haben.
- Entscheidung: Stufe 1 erzeugt getrennte Shopping-Positionen mit Herkunft. Stufe 2 darf nur strukturierte, kompatible Einheiten optional aggregieren und bewahrt alle Quellen.
- Begründung: Korrektheit vor scheinbarer Bequemlichkeit.
- Alternativen: heutige heuristische Aggregation überall; reine Namensaggregation.
- Auswirkungen: Bestehender Bereichsimport muss beim Herkunftstask bewusst kompatibel angepasst werden.
- Status: **proposed**.

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
- Status: **accepted**.

### ADR-KITCHEN-011 — Checkbox-Präferenz zunächst nicht persistieren

- Problem: Automatischer Import kann unerwartete Einkaufsartikel erzeugen.
- Entscheidung: Im MVP ist die Checkbox standardmäßig aus und wird nicht als Benutzerpräferenz gespeichert; die Zielliste ist die Default-Liste.
- Begründung: Explizite Zustimmung und kleiner migrationsfreier Scope.
- Alternativen: global gespeicherter Default; immer aktiv.
- Auswirkungen: Eine Präferenz ist ein separater späterer UX-Task.
- Status: **proposed**.

## 6. Datenmodell-Mapping

| Tabelle | Zweck / wichtige Spalten | Beziehungen | Geplante Änderung | Migration / Rückwärtskompatibilität |
|---|---|---|---|---|
| `shopping_lists` | Listen; `id`, `name`, `created_by`, Zeitstempel; Task-1: `sort_order` | 1:n `shopping_items` | keine weitere Default-Spalte | Migration 86 backfillt 0..n-1 nach `created_at,id`; bestehende IDs bleiben |
| `shopping_items` | Positionen; `quantity TEXT`, `category`, `is_checked`, `notes`, `url`, `added_from_meal` | Liste; optional eine Mahlzeit | Quellen über Join-Tabelle; später optionale `amount`,`unit` | `added_from_meal` vorerst behalten/deprecaten, API kompatibel halten |
| `shopping_item_sources` (geplant) | Herkunft; `shopping_item_id`, `source_type`, `meal_id`, `recipe_id`, `source_label`, `meal_date_snapshot`, `quantity_snapshot`, `created_at` | n:1 Artikel; optionale FKs mit `ON DELETE SET NULL` | neu in KWF-003 | Backfill aus `added_from_meal`; Snapshot vor FK-Verlust |
| `meals` | geplante Instanz; Datum, Typ, Titel, Rezeptbezug, Serienbezug | Rezept/Template, Zutaten | kein bloßes `is_cooked`; Cooking-Events | additive Migrationen, bestehende Meals unverändert |
| `meal_ingredients` | Zutaten-Snapshot; `name`, `quantity TEXT`, `category`, `on_shopping_list` | n:1 Meal | optionale `amount`,`unit`; Importquellen | Freitext bleibt; Flag aus Kompatibilitätsgründen vorerst bestehen |
| `recipes` | Rezeptkopf | 1:n Zutaten; 1:n Meals | keine zwingende Änderung für KWF-004 | keine |
| `recipe_ingredients` | Rezeptzutaten-Snapshot | n:1 Rezept | optionale `amount`,`unit` | Freitext bleibt |
| `meal_recurrence_*` | Serienvorlage, Zutaten und Ausnahmen | materialisierte Meals | strukturierte Mengen analog; Importsemantik explizit | additive Spalten, keine Neuinterpretation alter Serien |
| `pantry_locations` (geplant) | anpassbare Lagerorte; `key`, `name`, `label_key`, `sort_order` | 1:n Pantry-Posten | Seeds für Kühlschrank, Gefrierschrank, Vorratsschrank, Keller, Sonstiges | neue Tabelle; Labels via i18n, Custom-Namen als Text |
| `pantry_items` (geplant) | Bestandslos/Artikel; Name, Kategorie, Lagerort, `amount`, `unit`, `quantity_display`, Mindestbestand, Ablaufdatum | Ort; 1:n Bewegungen | neu in KWF-007 | Freitextmenge zulassen; mehrere Lose gleichen Namens möglich |
| `inventory_movements` (geplant) | Journal; Typ, Menge/Einheit/Anzeige, Shopping-/Cooking-Bezug, Reversal, Idempotency-Key, Actor, Zeit | Pantry-Posten; optionale Quellen | neu in KWF-007/008/009 | unveränderlich; eindeutige Keys verhindern Doppelbuchung |
| `meal_cooking_events` (geplant) | bestätigter Kochvorgang; Meal, Status, Actor, Zeit | Meal; 1:n Bewegungen | neu in KWF-009 | keine Änderung bestehender Meals; aktives Event je Meal eindeutig |

Technische Grenze: Ohne ein bestätigtes Zutaten-Stammdatenmodell kann ein Name wie „Tomate“ nicht sicher automatisch einem Pantry-Posten „Tomaten“ zugeordnet werden. MVP-Matching muss als Vorschlag sichtbar und vom Benutzer bestätigbar sein; Einheit und Menge werden nicht geraten.

## 7. API-Mapping

### Bestehende relevante Endpunkte

| Methode/Pfad | Request / Response | Validierung / Transaktion | Relevante Tests |
|---|---|---|---|
| `GET /api/v1/shopping` | vollständige Listen mit Counts | Task-1-Sortierung `sort_order,created_at,id` | Shopping API/DB |
| `POST /api/v1/shopping` | `{name}` → Liste | Task 1 vergibt nächsten `sort_order` | Shopping API |
| `PATCH /api/v1/shopping/reorder` | `{order:[ids...]}` → alle Listen | vollständige, eindeutige ID-Menge; eine Transaktion | Shopping API/DB |
| `PATCH /api/v1/shopping/items/:id` | partielle Artikelfelder | `is_checked` ist derzeit einfache Mutation | Shopping |
| `POST /api/v1/shopping/:listId/import-meal-plan` | `{from,to}` → Counts | Import+Flag-Updates in Transaktion; heutige Aggregation | Shopping |
| `POST /api/v1/meals` | Meal + Zutaten + optional Wiederholung | Meal/Template/Zutaten in Transaktion | Meals |
| `POST /api/v1/meals/apply-plan` | Assignments | Batch/Replace in Transaktion | Meals |
| `POST /api/v1/meals/:id/to-shopping-list` | `{listId}` → Count | Artikel+Flags in Transaktion | Meals |
| `POST /api/v1/meals/week-to-shopping-list` | `{listId,week}` → Count | Artikel+Flags in Transaktion | Meals |
| `/api/v1/recipes` CRUD | Rezept + Zutaten | Create/Update transaktional | Meals/Recipes-Frontend |

### Geplante API-Verträge

| Methode/Pfad | Request / Response | Validierung / Transaktionsgrenze | Fehlerfälle / Tests |
|---|---|---|---|
| `POST /api/v1/meals` (erweitert) | optional `shopping_import:{enabled,list_id}`; Response Meal plus Importsummary | Liste und Rezept vorab prüfen; Meal, Zutaten, Artikel, Quellen und Flags in **einer** Transaktion | 400 ungültig/keine Liste; 404 ID; künstlicher Insertfehler rollt alles zurück |
| `GET /api/v1/shopping/:listId/items` (erweitert) | Artikel plus `sources[]` | FKs optional, Snapshots immer ausgeben | gelöschtes/umbenanntes Meal/Rezept; Mehrfachquellen |
| `GET /api/v1/pantry` | Filter `q,category,location,low_stock,expires_before` | read scope, param limits | Filter-/Scope-Tests |
| `POST /api/v1/pantry` | Name, Menge/Anzeige, Einheit, Kategorie, Ort, Minimum, Ablauf | strukturierte Werte optional; initiale Bewegung in einer Transaktion | unklare Menge bleibt Displaytext; keine negative Anfangsmenge |
| `PATCH /api/v1/pantry/:id` | Metadaten | Bestand nicht direkt überschreiben | 404, Validierung |
| `POST /api/v1/pantry/:id/adjust` | Delta/absolutes Ziel + Grund | erzeugt Korrekturbewegung transaktional | Einheit inkompatibel, ungültiges Delta |
| `POST /api/v1/shopping/items/:id/to-pantry` | bestätigte Menge, Einheit, Ort, optional Zielposten | Artikel prüfen; Check+Pantry+Movement atomar; Idempotency-Key eindeutig | Nicht-Lebensmittel abbrechen; Wiederholung liefert vorhandenes Ergebnis/409 ohne Doppelbuchung |
| `POST /api/v1/meals/:id/cook-preview` | optional Matching-Overrides → Verbrauchsvorschlag | read-only, keine Bewegung | fehlende/unklare Menge sichtbar |
| `POST /api/v1/meals/:id/cook` | bestätigte Allokationen und optionale Missing→Shopping-Aktion | Cooking-Event, Bewegungen und optionale Shoppingartikel in einer Transaktion | zweite aktive Buchung abweisen; Unterbestand/Einheitenkonflikt rollt zurück |
| `POST /api/v1/meals/:id/cook/undo` | Event-ID/Grund | Gegenbewegungen + Eventstatus atomar | bereits rückgängig, fremdes Event |

Alle neuen Pfade müssen in `server/openapi.js`, `server/scopes.js` und den Berechtigungstests abgebildet werden. Pantry erhält einen eigenen Scope-Key; Meals/Recipes bleiben beim bestehenden `meals`-Scope, Shopping beim `shopping`-Scope.

## 8. Frontend-Mapping

| Ansicht/Datei | Geplante Verantwortung | Handler/Formulare | i18n / Mobil-Tablet |
|---|---|---|---|
| `public/pages/shopping.js` | Quellen anzeigen; Kauf→Vorrat anbieten | bestehende Check-/Swipe-Handler; neuer Bestätigungsdialog | kompakte Quellenzeile, aufklappbar bei mehreren Quellen; Touch-Ziele erhalten |
| `public/pages/meals.js` | Checkbox + Default-Listenauswahl beim Create; Kochpreview/-bestätigung | `buildModalContent`, `saveModal`, `mealPayloadFromRecipe`, Rezept-Drop/-Sidebar | keine hartcodierten Texte; responsive Modal; Checkbox default off |
| `public/pages/recipes.js` | bestehende Navigation beibehalten | `add-to-meals` → Query-Flow | kein separater Kalender nötig |
| `public/components/datepicker.js` | vorhandener Microkalender | bestehendes Grid/Keyboard/native Touch | nur optionaler, generischer Day-Marker-API nach Review |
| `public/pages/pantry.js` (geplant) | Liste, Suche, Filter, CRUD, Korrektur | Modal/Drawer nach vorhandenem Muster | große Touch-Ziele, kompakte Filter, Ablauf-/Mindeststatus |
| `public/router.js`, `public/utils/kitchen-tabs.js` | `/pantry` als Kitchen-Child | Route, Titel, Nav-Ziel, Shortcuts | `nav.pantry` in allen Locales |
| `public/settings/pages/modules-kitchen.js` | Pantry-bezogene bestätigte Defaults, falls später nötig | keine globale Autoübernahme im MVP | explizite, sichere Defaults |
| `public/sw.js` | neue statische Dateien; Offline-GET nur nach Entscheidung | Cachelisten/Whitelist | keine Offline-Mutationen |
| `public/styles/*.css` | Quellen, Modalergänzungen, Pantry | bestehende Tokens/Breakpoints | Desktop, Tablet, Mobile; Reduced Motion |

Neue i18n-Namensräume: `pantry.*`, `shopping.sources*`, `shopping.addToPantry*`, `meals.addIngredientsToShopping*`, `meals.cook*`. Deutsch und Englisch werden fachlich formuliert; alle 23 Locale-Dateien müssen vollständige Key-Parität behalten.

## 9. Test-Matrix

| Feature | Unit | API | DB/Migration | Frontend | Regression | Status |
|---|---|---|---|---|---|---|
| KWF-001 Baseline/Plan | Dokumentstruktur | – | – | – | Git-Diff nur Docs | abgeschlossen |
| KWF-002 Listensortierung | Default-Helper | Reorder-Validierung | Migration 86/next order | DnD + Buttons + Default-Badge | MCP/Housekeeping/CalDAV/Meals | implementiert, Review/Commit offen |
| KWF-003 Herkunft | Snapshot-/Serializer | Quellen in Importantworten | Backfill/FK-Löschung | eine/mehrere Quellen | bestehende Importcounts | geplant |
| KWF-004 Direkter Import | Payload/Validierung | Erfolg und Rollback | keine halbe Speicherung | Checkbox/Default-Auswahl | Rekurrenz/normaler Meal-Create | geplant |
| KWF-005 Microkalender | Datepicker-Grid | – | – | Recipe-Flow, Keyboard, Touch | Datepicker/Kitchen | größtenteils vorhanden |
| KWF-006 Mengenbasis | Parser nur deterministisch | kompatible/incompatible Einheiten | additive Spalten/Legacywerte | manuelle Korrektur | alte Freitextanzeigen | geplant |
| KWF-007 Pantry MVP | Saldo/Validierung | CRUD/Filter/Adjust | Tabellen, Seeds, Journal | responsive CRUD/Filter | Scopes/Nav/SW | geplant |
| KWF-008 Einkauf→Vorrat | Idempotenz | Transfer/Undo/Recheck | eindeutiger Transferbezug | Bestätigungsdialog | normales Abhaken | geplant |
| KWF-009 Kochen→Verbrauch | Matching/FIFO-Vorschlag | Preview/Commit/Undo | Event+Bewegungen | Reviewdialog/Missing | Meal/Shopping/Pantry | geplant |
| KWF-010 Integration | Cross-Domain | E2E API-Flows | Upgrade-Szenarien | Desktop/Tablet/Mobile/a11y | `npm test` | geplant |

## 10. Offene Findings

### KWF-FINDING-001 — Task 1 ist noch nicht committed

- Betroffene Dateien: Migration/Shopping/UI/i18n/Tests sowie Default-Verbraucher auf `feature/shopping-list-order`.
- Schweregrad: mittel.
- Auswirkung: Funktioniert lokal, ist aber noch kein reviewbarer Git-Stand.
- Empfehlung: Separat reviewen, committen und pushen; nicht mit Folgefeatures vermischen.
- Status: offen.
- Task: KWF-002.

### KWF-FINDING-002 — `added_from_meal` ist nicht mehrquellenfähig

- Betroffene Dateien: `server/db.js`, Meals-/Shopping-Import-Routen.
- Schweregrad: hoch für Herkunftsanforderung.
- Auswirkung: Aggregation oder mehrere Rezepte verlieren Nachvollziehbarkeit.
- Empfehlung: `shopping_item_sources` mit Snapshots.
- Status: offen.
- Task: KWF-003.

### KWF-FINDING-003 — Bereichsimport aggregiert heuristisch

- Betroffene Dateien: `server/services/shopping-import.js`, `server/routes/shopping.js`.
- Schweregrad: mittel.
- Auswirkung: numerische Präfixe werden summiert; mehrere Meal-IDs werden zu `NULL` Herkunft.
- Empfehlung: Bis KWF-006 getrennte Positionen oder konservative Aggregation mit allen Quellen.
- Status: offen.
- Task: KWF-003/KWF-006.

### KWF-FINDING-004 — Meal-Create und Import sind heute getrennt

- Betroffene Dateien: `public/pages/meals.js`, `server/routes/meals.js`.
- Schweregrad: hoch für Feature 2.
- Auswirkung: Clientseitige Folgeoperation wäre nicht atomar.
- Empfehlung: optionalen Importblock in denselben POST und dieselbe DB-Transaktion aufnehmen.
- Status: offen.
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
- Status: offen.
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
- Status: offen.
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
- Status: offen.
- Task: KWF-007/KWF-010.

### KWF-FINDING-011 — Wiederkehrende Mahlzeiten brauchen klare Importsemantik

- Betroffene Dateien/Tabellen: Meals-Route, Rekurrenzservice, Templates/Instanzen.
- Schweregrad: mittel.
- Auswirkung: Ein Import am Erstelltag darf nicht unbemerkt alle zukünftigen Wochen importieren.
- Empfehlung: KWF-004 importiert nur die konkret materialisierte Startinstanz; weitere Instanzen separat bei Materialisierung/Benutzeraktion.
- Status: offen.
- Task: KWF-004/KWF-009.

### KWF-FINDING-012 — Löschungen benötigen Snapshots

- Betroffen: geplante Quellen/Cooking-Events, bestehende Rezept-/Meal-Löschung.
- Schweregrad: mittel.
- Auswirkung: `ON DELETE SET NULL` allein bewahrt keinen Anzeigenamen und kein Datum.
- Empfehlung: Label-, Datums- und Mengen-Snapshots beim Erzeugen speichern.
- Status: offen.
- Task: KWF-003/KWF-009.

## 11. Session-Handoff

- Letzter abgeschlossener Schritt: vollständige Repository- und Workflow-Analyse; Memory und Taskplan erstellt.
- Planungsbranch: `planning/kitchen-workflow`.
- Geänderte Dateien der Planungs-/Handoff-Sessions: diese Memory-Datei, `KITCHEN_WORKFLOW_PLAN.md` und `KITCHEN_WORKFLOW_TASK_MASTER_PROMPT.md`; kein Featurecode.
- Ergänzte Agentenvorlage: `KITCHEN_WORKFLOW_TASK_MASTER_PROMPT.md`; sie startet genau einen KWF-Task und verbietet ungeplante Folgeaufgaben.
- Separater Arbeitsstand: KWF-002 auf `feature/shopping-list-order`, sicher erhalten, funktional bestätigt, noch uncommittet.
- Offene Tests dieser Session: Dokumentationsprüfung/Git-Diff; keine Featuretests nötig, da kein Featurecode geändert wurde.
- Offene Findings: KWF-FINDING-001 bis -012.
- Nächster sinnvoller Schritt: KWF-002 separat reviewen/committen; danach KWF-003 Herkunftsmodell implementieren.
- Nicht erneut blind analysieren: Baseline-Dokumente, bestehende DB-Tabellen, aktuelle Meals/Recipes/Shopping-Flows, Datepicker-Funktion, Kitchen-Navigation, i18n-Konvention und Service-Worker-Grundmuster sind oben kartiert.
- Pflicht für Folgesessions/Agents: diese Datei zuerst lesen, eigene Zeile in „Angegriffene Bereiche“ ergänzen, neue ADRs/Findings fortlaufend nummerieren und den Handoff aktualisieren.
