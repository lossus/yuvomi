# Kitchen Workflow Implementation Plan

Stand: 2026-07-13  
Basis: [`KITCHEN_WORKFLOW_MEMORY.md`](./KITCHEN_WORKFLOW_MEMORY.md)

## Planungsgrundsätze

- Jede Aufgabe bleibt unabhängig reviewbar und erhält einen eigenen Branch/Commit-Scope.
- Keine Aufgabe erfindet neue Frameworks; vorhandene Express-, SQLite-, Modal-, i18n-, CSS- und Testmuster werden wiederverwendet.
- Additive Migrationen bewahren bestehende Daten und API-Felder.
- Cross-Domain-Operationen werden serverseitig in genau einer DB-Transaktion ausgeführt.
- Freitextmengen bleiben erhalten. Rechnen ist nur mit explizit strukturierten, kompatiblen Werten erlaubt.
- Neue sichtbare Texte erhalten vollständige Locale-Key-Parität; Deutsch und Englisch werden fachlich vollständig gepflegt.
- Vor jeder Implementierung wird der aktuelle Memory-Handoff gelesen und aktualisiert.

## Reihenfolge und Abhängigkeiten

```text
KWF-001 Baseline und Planung (dieser Commit)
  └─ KWF-002 Einkaufslisten sortierbar (über PR #2 in Fork-main abgeschlossen)
      └─ KWF-003 Herkunftsmodell
          └─ KWF-004 Direkter Rezept-Zutatenimport
              └─ KWF-005 Microkalender-Verifikation/Polish
          └─ KWF-006 Mengen- und Einheitenbasis
              └─ KWF-007 Vorratsmodul MVP
                  ├─ KWF-008 Einkauf → Vorrat
                  └─ KWF-009 Gekocht → Verbrauch
                      └─ KWF-010 Integration und UX-Polish
```

Begründete Anpassung der vorgeschlagenen Reihenfolge: KWF-003 kommt vor dem direkten Import, damit KWF-004 neue Artikel sofort mit belastbarer Herkunft erzeugt. KWF-005 bleibt nach KWF-004, ist aber klein, weil der gemeinsame Microkalender bereits existiert. KWF-006 liegt vor Pantry, da automatische Bestandsbewegungen strukturierte Mengen benötigen.

## Taskübersicht

| Reihenfolge | Task | Ergebnis | Komplexität | Status |
|---:|---|---|---|---|
| 1 | KWF-001 | Repository-, Architektur- und Planungsbaseline | mittel | abgeschlossen |
| 2 | KWF-002 | persistente Reihenfolge und Default-Liste | mittel | abgeschlossen und in `main` |
| 3 | KWF-003 | mehrquellenfähige Einkaufsartikel-Herkunft | groß | abgeschlossen |
| 4 | KWF-004 | atomarer Rezept→Meal→Shopping-Flow | mittel | abgeschlossen |
| 5 | KWF-005 | bestehender Microkalender verifiziert/gezielt ergänzt | klein | größtenteils vorhanden |
| 6 | KWF-006 | rückwärtskompatible strukturierte Mengenbasis | groß | implementiert und lokal verifiziert |
| 7 | KWF-007 | Core-Pantry-MVP mit Bewegungsjournal | groß | geplant |
| 8 | KWF-008 | idempotenter Einkauf→Vorrat-Transfer | groß | geplant |
| 9 | KWF-009 | Kochvorgang, Verbrauch und Undo | groß | geplant |
| 10 | KWF-010 | End-to-End-Regression und UX-Härtung | groß | geplant |

## KWF-001 — Repository- und Architektur-Baseline

- Ziel: Verbindliche, nachprüfbare Wissensbasis und vollständigen Umsetzungsplan anlegen.
- Scope: Git/Remotes prüfen; Pflichtdokumente und Kitchen-Code lesen; Daten-, API-, Frontend-, i18n-, PWA- und Testmapping; ADRs, Findings und Handoff.
- Nicht-Scope: jegliche Feature-Implementierung; Änderung bestehender APIs oder Migrationen.
- Betroffene Dateien: ausschließlich `docs/development/KITCHEN_WORKFLOW_MEMORY.md` und diese Datei.
- Datenmodelländerungen/Migration: keine.
- API: keine.
- Frontend: keine.
- i18n: keine.
- Tests: Markdown-Struktur, Pfade gegen Repository prüfen, `git diff --check`, sicherstellen, dass der Planungscommit nur Dokumentation enthält.
- Risiken: Übersehene indirekte Consumer; Drift des parallelen Task-1-Arbeitsstands.
- Abhängigkeiten: keine.
- Akzeptanzkriterien:
  - Pflichtdokumente und relevante Implementierung sind nachweislich analysiert.
  - Memory enthält Ist-Zustand, Mapping, ADRs, Findings, Testmatrix und Handoff.
  - Plan enthält KWF-001 bis KWF-010 mit allen geforderten Feldern.
  - Keine Featuredatei wurde geändert.
- Branch: `planning/kitchen-workflow`.
- Komplexität: mittel.
- Empfohlene Reihenfolge: 1.

## KWF-002 — Einkaufslisten frei sortierbar

- Ziel: Reihenfolge persistent ändern; erste Liste ist systemweit die einzige Default-Liste.
- Scope: `sort_order`; Legacy-Backfill; zentraler Order-/Default-Helper; vollständige Reorder-Validierung; responsive DnD- und Button-UI; Default-Badge; alle Default-Consumer.
- Nicht-Scope: separates `is_default`; benutzerspezifische Reihenfolge; Zutatenimport oder Pantry.
- Betroffene Dateien (aktueller Arbeitsstand):
  - DB/Backend: `server/db.js`, `server/db-schema-test.js`, `server/routes/shopping.js`, `server/services/shopping-lists.js`, `server/routes/housekeeping.js`, `server/services/caldav-reminders-sync.js`, `server/mcp/tools.js`, `server/openapi.js`.
  - Frontend: `public/pages/shopping.js`, `public/styles/shopping.css`.
  - i18n: alle `public/locales/*.json`.
  - Tests/Doku: `test/test-shopping.js`, `test/test-db.js`, `test/test-mcp.js`, `test/test-caldav-reminders.js`, `CHANGELOG.md`, `docs/SPEC.md`.
- Datenmodelländerungen: `shopping_lists.sort_order INTEGER NOT NULL DEFAULT 0`, Index auf `(sort_order, created_at, id)`.
- Migration: reguläre Migration 86; Backfill über `ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)-1`.
- API: `PATCH /api/v1/shopping/reorder` mit `{order:[ids...]}`; nichtleer, nur Integer, eindeutig, exakt alle Listen; Update transaktional; Antwort vollständig sortiert.
- Frontend: Listenmanager mit HTML5-DnD ohne Bibliothek sowie „erste“, „hoch“, „runter“; nach jeder Änderung speichern; erste Liste als „Standard“ markieren.
- i18n: neue Shopping-Keys in allen 23 Locales; Deutsch/Englisch vollständig.
- Tests: Migration, next order, GET-Sortierung, Erfolg, unbekannte/doppelte/unvollständige IDs, keine Teilmutation, Default-Consumer, UI-Key/API-Wiring, MCP/Housekeeping/CalDAV.
- Risiken: versteckte Consumer mit `ORDER BY created_at`; konkurrierende Reorder-Requests. Der implementierte Stand wurde über PR #2 gemergt.
- Abhängigkeiten: KWF-001-Dokumentation.
- Akzeptanzkriterien:
  - Alle Listen haben deterministische, persistente Reihenfolge.
  - Alle Default-Auswahlen verwenden dieselbe Sortierung.
  - Ungültige Requests ändern keine Zeile.
  - Mobile/Tablet-Aktionen funktionieren ohne DnD.
  - Shopping/DB und betroffene Regressionstests bestehen.
- Branch: `feature/shopping-list-order`.
- Komplexität: mittel.
- Empfohlene Reihenfolge: 2; **abgeschlossen, funktional bestätigt und über PR #2 in Fork-`main` gemergt**.

## KWF-003 — Herkunftsmodell für Einkaufsartikel

- Ziel: Eine Einkaufsposition kann eine oder mehrere Rezept-/Mahlzeitenherkünfte dauerhaft und sichtbar tragen.
- Scope: Join-Tabelle mit FKs und Snapshots; Backfill; alle bestehenden Importpfade; API-Serialisierung; Quellenanzeige; konservatives Duplikatverhalten Stufe 1.
- Nicht-Scope: strukturierte Mengenaggregation; Pantry; KI-Namensmatching; Suche über historische Quellen, sofern FTS-Rebuild unverhältnismäßig wird.
- Betroffene Dateien:
  - `server/db.js`, `server/db-schema-test.js`.
  - `server/routes/meals.js`, `server/routes/shopping.js`, `server/services/shopping-import.js`.
  - `public/pages/shopping.js`, `public/styles/shopping.css`.
  - `server/openapi.js`, `docs/SPEC.md`, alle Locale-Dateien.
  - `test/test-shopping.js`, `test/test-meals.js`, `test/test-db.js`, optional `test/test-search.js`.
- Datenmodelländerungen: neue `shopping_item_sources` mit `shopping_item_id`, `source_type`, optional `meal_id`, optional `recipe_id`, `source_label`, `meal_date_snapshot`, `quantity_snapshot`, Zeitstempel; CHECK für gültige Source-Typen; Indizes auf Item/Meal/Recipe.
- Migration: additiv; Backfill jeder nicht-null `shopping_items.added_from_meal`-Zeile über aktuellen Meal-Titel/Datum/Recipe-ID. `added_from_meal` bleibt für API/DB-Kompatibilität zunächst bestehen.
- API: Shopping-Item-Antworten erhalten `sources: []`; bestehende Felder bleiben. Importantworten behalten Counts und dürfen optional neue Item-IDs liefern.
- Frontend: unter dem Artikel „Aus: Rezept · Datum“; bei mehreren Quellen kompakte Zusammenfassung plus zugänglicher Aufklapper/Drawer; Snapshots nutzen, wenn Quelle gelöscht wurde.
- i18n: Labels für eine/mehrere Quellen, gelöschte Quelle und Datumsdarstellung.
- Tests:
  - Backfill bestehender `added_from_meal`-Daten.
  - Einzel-/Wochen-/Bereichsimport erzeugt Item und Source atomar.
  - Mehrere Quellen werden vollständig serialisiert und gerendert.
  - Löschen/Umbenennen von Meal oder Rezept bewahrt Snapshot.
  - Insertfehler rollt Item, Source und `on_shopping_list` zurück.
  - Stufe 1 führt inkompatible Freitextmengen nicht zusammen.
- Risiken: bestehender Bereichsimport aggregiert; Source-Zeilen müssen jeder aggregierten Position korrekt zugeordnet werden; FK-Löschung darf Snapshot nicht löschen.
- Abhängigkeiten: KWF-002 für Default-/Sortierkonsistenz.
- Akzeptanzkriterien:
  - Keine neu importierte Position verliert ihren Ursprung.
  - Mehrere Ursprünge sind API- und UI-seitig sichtbar.
  - Alte Clients funktionieren weiterhin mit `added_from_meal`.
  - Transaktionen verhindern verwaiste Sources oder halb gesetzte Flags.
- Branch: `feature/shopping-item-sources`.
- Komplexität: groß.
- Empfohlene Reihenfolge: 3; **abgeschlossen auf `feature/shopping-item-sources`**.

## KWF-004 — Zutaten direkt beim Einplanen eines Rezeptes übernehmen

- Ziel: Beim Erstellen einer Mahlzeit können deren Rezeptzutaten optional atomar in die gewählte Einkaufsliste übernommen werden.
- Scope: Checkbox, Listenauswahl, Default-Liste, erweiterter Meal-POST, Quellen, vollständiger Rollback, konkrete Semantik für Startinstanz wiederkehrender Meals.
- Nicht-Scope: persistierte Checkbox-Präferenz; automatischer Import zukünftiger Serieninstanzen; Mengenaggregation; Pantry.
- Betroffene Dateien:
  - Backend: `server/routes/meals.js`, ggf. neuer kleiner Service nach bestehendem Service-Muster, `server/openapi.js`.
  - Frontend: `public/pages/meals.js`; `public/pages/recipes.js` nur falls Query-State erweitert werden muss; `public/styles/meals.css`.
  - i18n: alle Locale-Dateien.
  - Tests: `test/test-meals.js`, `test/test-shopping.js`, `test/test-db.js`, `test/test-frontend-audit.js`.
- Datenmodelländerungen: keine zusätzlich zu KWF-003; Meal-Ingredients bleiben Snapshot.
- Migration: keine.
- API: `POST /api/v1/meals` erhält optional `shopping_import: { enabled: true, list_id: <id> }`. Server ignoriert keinen fehlerhaften aktivierten Block; er validiert Liste und Zutaten vollständig.
- Frontend:
  - Im Create-Modal: „Zutaten zur Einkaufsliste hinzufügen“ und Listenauswahl.
  - Checkbox standardmäßig aus; Select erst bei Aktivierung relevant.
  - `state.lists[0]` ist wegen KWF-002 die vorausgewählte Default-Liste.
  - Flow gilt für Recipe-Query, Rezeptauswahl im Modal und Recipe-Sidebar/Drag-Drop, sofern ein Bestätigungsmodal verwendet wird. Direkter Drag-Drop ohne Modal darf nicht still importieren.
- i18n: Checkbox, Zielliste, keine Listen, Importsummary und atomarer Fehler.
- Tests:
  - Meal ohne Import unverändert.
  - Meal mit Import erzeugt Meal, Meal-Ingredients, Shopping-Items und Sources.
  - Default-Liste ist niedrigster `sort_order`.
  - explizite andere Liste funktioniert.
  - unbekannte Liste/Rezept-ID oder künstlicher Source-/Item-Fehler hinterlässt keinerlei Meal/Template/Item/Flag.
  - wiederkehrend: nur materialisierte Startinstanz wird importiert.
  - Checkbox/Select sind übersetzt und mobil bedienbar.
- Risiken: mehrere heutige Recipe-Einstiegspfade; „apply-plan“/Drag-Drop darf nicht unbemerkt andere Semantik erhalten.
- Abhängigkeiten: KWF-002, KWF-003.
- Akzeptanzkriterien:
  - Kein Zustand „Meal vorhanden, Import fehlgeschlagen“ ist möglich.
  - Default-Liste entspricht sichtbarer erster Liste.
  - Ohne Checkbox exakt bisheriges Verhalten.
  - Herkunft wird für jede importierte Position gespeichert.
- Branch: `feature/recipe-meal-shopping-import`.
- Komplexität: mittel.
- Empfohlene Reihenfolge: 4.

## KWF-005 — Microkalender auf Tablet und Mobilgeräten verfügbar machen

* Ziel: Sicherstellen, dass der bestehende Microkalender im Rezept→Essensplan-Flow nicht nur am Desktop, sondern auch auf Tablets und Smartphones korrekt angezeigt und bedient werden kann.
* Scope: Responsive Darstellung, Touch-Bedienung, mobile Modal-Integration, Recipe-Query-Flow, heutiger und gewählter Tag, Monatswechsel, Keyboard-Fallback, ISO-Persistenz; optional nach Review ein generisches Marker-Attribut für bereits geplante Tage.
* Nicht-Scope: neue Kalenderbibliothek; zweite Kalenderkomponente; Neuimplementierung des bestehenden Desktop-Datepickers; automatische Wochen- oder Monatsplanung.
* Betroffene Dateien: `public/pages/meals.js`, `public/components/datepicker.js`, `public/styles/datepicker.css`, ggf. `public/pages/recipes.js`, relevante Mobile-/Modal-Styles, Locale-Dateien, `test/test-datepicker.js`, `test/test-meals.js`, `test/test-ux-utils.js`.
* Datenmodelländerungen/Migration: keine.
* API: für den Basisscope keine; optionale Tagesmarker verwenden bereits geladene Meal-Daten statt eines neuen Endpoints.
* Frontend:

  * Der vorhandene `<yuvomi-datepicker type="date">` bleibt die einzige Kalenderkomponente.
  * Analysieren, warum der Microkalender auf Desktop verfügbar ist, auf Tablet und Smartphone jedoch nicht angezeigt oder durch ein natives beziehungsweise nacktes Datumsfeld ersetzt wird.
  * Responsive CSS, Viewport-Erkennung, Modal-Layout, Touch-Events und mögliche mobile Fallbacks prüfen.
  * Sicherstellen, dass der Kalender im mobilen Rezept→Essensplan-Dialog sichtbar bleibt, nicht abgeschnitten wird und innerhalb des Viewports bedienbar ist.
  * Query-Prefill darf Fokus, ausgewähltes Datum oder Kalenderanzeige nicht überschreiben.
  * Alle relevanten Recipe-Einstiege müssen dieselbe Datepicker-Komponente verwenden.
  * Drag-and-drop auf ein konkretes Meal-Slot gilt weiterhin als bereits eindeutige Datumswahl und benötigt keinen zusätzlichen Kalenderdialog.
* i18n: vorhandenen `datepicker.*`-Namespace verwenden; nur neue Marker- oder Hilfetexte ergänzen, falls tatsächlich notwendig.
* Tests:

  * Kalender-Grid
  * heutiger und ausgewählter Tag
  * vorheriger und nächster Monat
  * Arrow, Home, End, Enter, Escape und Tab
  * Touch-Bedienung
  * kleine Viewports und Tablet-Breakpoints
  * kein Abschneiden oder Überlagern im Modal
  * ISO-POST
  * Recipe-Query-Prefill
  * Verifikation, dass Desktop-Verhalten unverändert bleibt
* Risiken:

  * Mobile Styles oder Modal-Logik blenden den bestehenden Datepicker möglicherweise bewusst aus.
  * Native Date-Input-Fallbacks können je nach Browser unterschiedlich reagieren.
  * Änderungen dürfen den bereits funktionierenden Desktop-Flow nicht verschlechtern.
  * Touch- und Scroll-Gesten können miteinander kollidieren.
* Abhängigkeiten: KWF-004 für den vollständigen Recipe-Create-Dialog.
* Akzeptanzkriterien:

  * Der bestehende Microkalender ist auf Desktop, Tablet und Smartphone verfügbar.
  * Kein nacktes Text- oder Date-Feld ersetzt den Kalender im relevanten Dialog.
  * Der Kalender bleibt innerhalb kleiner Viewports vollständig sichtbar und bedienbar.
  * Touch- und Tastaturbedienung funktionieren.
  * Gespeicherte Werte bleiben immer im ISO-Format.
  * Es wird keine zweite Kalenderlogik eingeführt.
  * Das bestehende Desktop-Verhalten bleibt unverändert.
* Branch: `fix/mobile-recipe-meal-datepicker`.
* Komplexität: klein bis mittel.
* Empfohlene Reihenfolge: 5; zuerst Ursache des mobilen Ausblendens oder Fallbacks identifizieren, danach nur die notwendige responsive und Touch-spezifische Korrektur umsetzen.


## KWF-006 — Mengen- und Einheiten-Basismodell

- Ziel: Strukturierte Mengen ermöglichen, ohne bestehende Freitextdaten zu verlieren oder unklare Werte zu raten.
- Scope: additive Felder, deterministische Validierung/Konvertierung, manuelle Korrektur, API-Kompatibilität, UI für strukturierte Eingabe, Stufe-2-Aggregationsbasis.
- Nicht-Scope: KI-Parsing; universelles Einheitenlexikon; automatische Konvertierung von Dose/Packung/Bund/Prise/„etwas“; Pantry-Buchungen selbst.
- Betroffene Dateien:
  - `server/db.js`, `server/db-schema-test.js`.
  - Meals-/Recipes-/Shopping-Routen und `server/services/shopping-import.js`.
  - neuer Utility/Service nur nach vorhandenem Muster, z. B. serverseitige Quantity-Validierung plus geteilter statischer Unit-Katalog.
  - `public/utils/ingredient-row.js`, `public/pages/meals.js`, `public/pages/recipes.js`, `public/pages/shopping.js`, Styles, Locales.
  - `test/test-meals.js`, `test/test-shopping.js`, `test/test-db.js`, neue fokussierte Quantity-Tests.
- Datenmodelländerungen: optionale `amount REAL` und `unit TEXT` an Recipe-, Meal-, Recurrence-Ingredients und Shopping-Items; bestehendes `quantity TEXT` bleibt.
- Migration: nur additive nullable Spalten/Indizes. Kein automatischer Backfill außer exakt validierbaren, ausdrücklich freigegebenen Formen; empfohlen zunächst **kein** Datenbackfill.
- API: akzeptiert/antwortet weiterhin `quantity`; optional `amount`/`unit`. Bei Strukturwerten wird `quantity` als Anzeige-Snapshot mitgeführt, aber nicht still umgeschrieben.
- Frontend: Nutzer kann Freitext belassen oder Menge/Einheit explizit strukturieren; unklare Werte zeigen keinen Fehler, solange keine Rechenoperation verlangt wird.
- i18n: Einheit, Menge, Freitext, nicht konvertierbar, manuelle Bestätigung.
- Tests:
  - Legacy-Text roundtrip unverändert.
  - `1000 g ↔ 1 kg`, `1000 ml ↔ 1 l` deterministisch.
  - nicht konvertierbare Einheiten bleiben getrennt.
  - Dezimal-/Negativ-/NaN-/Grenzwertvalidierung.
  - Aggregation nur bei gleicher Dimension und kompatibler Einheit; Sources bleiben vollständig.
- Risiken: SQLite REAL-Rundung; Locale-Dezimaltrennzeichen; API-Clients senden inkonsistente Kombinationen.
- Abhängigkeiten: KWF-003; kann nach KWF-004 parallel geplant, aber nicht unkoordiniert in denselben Dateien implementiert werden.
- Akzeptanzkriterien:
  - Kein Legacywert geht verloren oder wird geraten.
  - Nur sichere Konvertierungen werden gerechnet.
  - API bleibt abwärtskompatibel.
  - Manuelle Korrektur ist immer möglich.
- Branch: `feature/structured-ingredient-quantities`.
- Komplexität: groß.
- Empfohlene Reihenfolge: 6.

## KWF-007 — Vorratsmodul MVP

- Ziel: Core-Kitchen-Bereich für manuelle Vorräte, Suche/Filter, Mindestbestand, Ablaufdatum und nachvollziehbare Korrekturen.
- Scope: Pantry-Tab, Core-Route/Scope/Rechte, Tabellen für Orte/Posten/Bewegungen, CRUD, initiale und Korrekturbewegungen, Suche/Filter, responsive UI, OpenAPI/PWA-Integration.
- Nicht-Scope: automatische Einkaufsübernahme; Kochverbrauch; Barcode; Cloud-Sync; komplexe FIFO-Automatik; Lebensmittel-Stammdatenbank.
- Betroffene Dateien:
  - DB/API: `server/db.js`, `server/db-schema-test.js`, neuer `server/routes/pantry.js`, ggf. `server/services/inventory.js`, `server/index.js`, `server/scopes.js`, `server/openapi.js`.
  - Frontend: neuer `public/pages/pantry.js`, `public/styles/pantry.css`; `public/router.js`, `public/utils/kitchen-tabs.js`, `public/settings/module-order.js`, Settings-Navigation/Kitchen-Dateien, `public/sw.js`.
  - i18n: alle Locale-Dateien.
  - Tests: neue `test/test-pantry.js`, DB, Scopes/Permissions, Kitchen-Tabs, Settings-Navigation, SW, Frontend-Audit, Typografie/Mobile-Layout.
- Datenmodelländerungen: `pantry_locations`, `pantry_items`, `inventory_movements`; FKs, Zeitstempel, CHECKs, Such-/Filterindizes, eindeutiger Idempotency-Key.
- Migration: neue Tabellen plus Default-Orte mit stabilen Keys/`label_key`; keine bestehende Tabelle wird zerstörerisch umgebaut.
- API: `GET/POST /api/v1/pantry`, `GET/PATCH/DELETE /api/v1/pantry/:id`, `POST /api/v1/pantry/:id/adjust`, optional read-only Locations-CRUD nach bestehendem Kategorienmuster.
- Frontend: Kitchen-Tab „Vorrat“; Karten/Liste mit Name, Bestand/Anzeige, Einheit, Kategorie, Ort, Minimum, Ablauf; Suche und Filter; Add/Edit/Adjust-Modals; mobile Bottom-/Drawer-Muster des Projekts.
- i18n: `nav.pantry`, `pantry.*`, Default-Orte via label keys; alle Locales.
- Tests:
  - Migration/Seeds/FKs/Upgrade bestehender DB.
  - CRUD, Filter, Low-stock, Expiry, Scope read/write.
  - Initialbestand und Korrektur erzeugen Bewegungen; direkte Bestandsmutation nicht möglich.
  - Gegenbewegung/History-Sortierung.
  - Kitchen-Nav, Disabled-Module, Mobile-Nav, SW-Assets, Accessibility.
- Risiken: „Artikel“ vs. „Los“ bei mehreren Ablaufdaten; Saldo-Berechnung/Performance; neue Scope-Migration für bestehende Token/Rechte.
- Abhängigkeiten: KWF-006, ADR-KITCHEN-003/004 Reviewentscheidung.
- Akzeptanzkriterien:
  - Pantry ist als vierter Kitchen-Child vollständig navigierbar und berechtigt.
  - Manuelle Anlage/Korrektur ist mobil möglich.
  - Jede Bestandsänderung ist im Journal nachvollziehbar.
  - Suche, Kategorie-/Ortfilter, Mindestbestand und Ablaufdatum funktionieren.
  - Bestehende Installationen migrieren ohne Datenverlust.
- Branch: `feature/pantry-mvp`.
- Komplexität: groß.
- Empfohlene Reihenfolge: 7.

## KWF-008 — Gekaufte Artikel in den Vorrat übernehmen

- Ziel: Ein abgehakter Einkaufsartikel kann nach Bestätigung genau einmal als Vorratszugang verbucht werden.
- Scope: Bestätigungsdialog, Zielposten/Neuanlage, Menge/Einheit/Ort, atomarer Check+Transfer, Idempotenz, Undo, nicht lebensmittelbezogene Opt-out-Logik.
- Nicht-Scope: globale unbestätigte Automatik; automatische Interpretation unklarer Freitextmenge; Barcode/Belegimport.
- Betroffene Dateien: `server/routes/shopping.js`, Pantry-/Inventory-Service, `server/openapi.js`, `public/pages/shopping.js`, Shopping/Pantry-Styles, Locale-Dateien, `test/test-shopping.js`, `test/test-pantry.js`, DB-/API-Regressionstests.
- Datenmodelländerungen: `inventory_movements.shopping_item_id`; eindeutiger partieller Index oder Idempotency-Key für aktiven Purchase-Transfer. Optional explizite Transferentscheidung am Shopping Item nur, wenn API/Undo dies erfordert.
- Migration: additive FK/Index-Spalten; bestehende abgehakte Artikel werden **nicht** nachträglich importiert.
- API: `POST /api/v1/shopping/items/:id/to-pantry`; Body mit bestätigtem Amount/Unit/Display, Location und optionaler Pantry-Item-ID. Optional `POST .../undo` oder generischer Movement-Reversal-Endpunkt.
- Frontend:
  - normales Abhaken bleibt schnell.
  - Für geeignete Artikel wird ein bestätigbarer Vorratsdialog angeboten; „nur abhaken“ ist immer möglich.
  - Bei unstrukturierter Menge ist Bestätigung/Korrektur Pflicht.
  - Erneutes Abhaken zeigt bestehenden Transfer statt erneut zu buchen.
- i18n: Übernehmen, nur abhaken, Menge bestätigen, Lagerort, bereits übernommen, rückgängig, Nicht-Lebensmittel.
- Tests:
  - nur Check ohne Pantry unverändert.
  - bestätigter Transfer setzt Check, erzeugt/erhöht Pantry und Movement atomar.
  - wiederholter identischer Request erzeugt keine Doppelbewegung.
  - Uncheck/Recheck, Undo/Redo und Parallelrequests.
  - ungültige Einheit/Ziel/Insertfehler rollt Check und Bestand zurück.
  - nicht lebensmittelbezogener Artikel kann übersprungen werden.
- Risiken: Swipe-UX darf nicht mit Modals kollidieren; bestehende schnelle Check-Interaktion; Merge in vorhandenen Pantry-Posten braucht Benutzerbestätigung.
- Abhängigkeiten: KWF-006, KWF-007.
- Akzeptanzkriterien:
  - Kein Einkauf erzeugt unbeabsichtigt Vorrat.
  - Bestätigte Übernahme ist atomar, nachvollziehbar und idempotent.
  - Rückgängig hinterlässt Gegenbewegung statt History-Löschung.
  - Bestehende Shopping-Checks funktionieren weiter.
- Branch: `feature/shopping-to-pantry`.
- Komplexität: groß.
- Empfohlene Reihenfolge: 8.

## KWF-009 — Mahlzeit gekocht → Vorratsverbrauch

- Ziel: Eine geplante Mahlzeit kann nach Review als gekocht verbucht werden; bestätigte Zutaten reduzieren Vorrat nachvollziehbar und genau einmal.
- Scope: Cooking-Event, read-only Preview, Matching-Vorschläge, manuelle Allokation, Teilmengen, mehrere Pantry-Lose, fehlende Zutaten, optionale Missing→Shopping-Aktion, atomare Bestätigung, Undo.
- Nicht-Scope: vollautomatisches unbestätigtes Kochen; KI-Matching; nicht-deterministische Einheiten; komplexe Ersatzproduktlogik im ersten Slice.
- Betroffene Dateien:
  - DB/Backend: `server/db.js`, `server/db-schema-test.js`, `server/routes/meals.js`, Pantry-/Inventory-Service, ggf. neuer Cooking-Service, `server/openapi.js`.
  - Frontend: `public/pages/meals.js`, `public/styles/meals.css`, Pantry-/Shopping-Komponenten nur für Links/Resultate.
  - i18n: `meals.cook*` in allen Locales.
  - Tests: `test/test-meals.js`, `test/test-pantry.js`, `test/test-shopping.js`, DB/Frontend/Regression.
- Datenmodelländerungen: `meal_cooking_events`; Movement-FK `cooking_event_id`; eindeutige aktive Event-Regel; Snapshot von Meal-/Recipe-Titel und Zutatenallokationen, falls nötig als Event-Detailtabelle.
- Migration: additive Tabellen/Spalten/Indizes; bestehende Meals gelten nicht automatisch als gekocht.
- API:
  - `POST /api/v1/meals/:id/cook-preview` liefert Ingredient, strukturierte Anforderung, vorgeschlagene Lots, Missing/Unknown und keine Mutation.
  - `POST /api/v1/meals/:id/cook` akzeptiert bestätigte Allokationen und optionales Shopping-Ziel für Fehlmengen; Event, Entnahmen und Missing-Items atomar.
  - `POST /api/v1/meals/:id/cook/undo` erzeugt Gegenbewegungen und markiert Event rückgängig.
- Frontend: „Als gekocht markieren“ → Reviewdialog mit Verbraucht/Nicht gefunden/Unklare Menge; Allokation editierbar; erst Bestätigung mutiert; Ergebnis und Undo sichtbar.
- i18n: gekocht, Verbrauch, nicht gefunden, unklare Menge, Bestand nicht ausreichend, bestätigen, rückgängig, fehlende Zutaten einkaufen.
- Tests:
  - Preview mutiert nichts.
  - korrekte Entnahme aus einem/mehreren Lots; FIFO nur als Vorschlag, bevorzugt frühestes Ablaufdatum.
  - Teilmenge und Unterbestand.
  - unstrukturierte Menge bleibt ungebucht bis manueller Bestätigung.
  - doppelte Bestätigung/Parallelrequest verhindert Mehrfachverbrauch.
  - Undo erzeugt exakte Gegenbewegungen.
  - gelöschtes Rezept ist durch Meal-/Event-Snapshot kein Problem.
  - wiederkehrende Mahlzeit: Event gehört zur konkreten Instanz, nicht pauschal zur Serie.
  - optionales Missing→Shopping bewahrt Herkunft und rollt bei Fehler alles zurück.
- Risiken: Namensmatching ohne Ingredient Catalog; Einheitendimensionen; negativer Bestand; Lösch-/Undo-Semantik.
- Abhängigkeiten: KWF-003, KWF-006, KWF-007; optional KWF-008 für bewährte Movement-Idempotenz.
- Akzeptanzkriterien:
  - Benutzer sieht vorab exakt, was gebucht werden soll.
  - Keine unbestätigte oder doppelte Entnahme.
  - Jede Entnahme/Umkehr ist journalisiert.
  - Fehlende/unklare Zutaten werden sichtbar, nicht geraten.
  - Transaktionsfehler hinterlassen weder Event noch Teilbewegungen/Shoppingartikel.
- Branch: `feature/meal-cooking-consumption`.
- Komplexität: groß.
- Empfohlene Reihenfolge: 9.

## KWF-010 — Integration, Regression und UX-Polish

- Ziel: Den vollständigen Workflow auf Upgrade, API, Desktop, Tablet, Mobile, Accessibility und Fehlerfälle härten.
- Scope: Cross-Domain-E2E, OpenAPI/Spec/Changelog, PWA-Entscheidung, Performance/Indizes, A11y, responsive Layouts, vollständige Locale-Parität, Windows-/CI-Testabgleich.
- Nicht-Scope: neue Fachfeatures; riskante Mengenautomatik; ungeplante UI-Neugestaltung.
- Betroffene Dateien: alle in KWF-002–009 geänderten Dateien plus `docs/SPEC.md`, `CHANGELOG.md`, `server/openapi.js`, `public/sw.js`, relevante Test-Suiten und ggf. Installer-Schema-Tests.
- Datenmodelländerungen/Migration: nur korrigierende additive Migration, falls Review ein reales Upgradeproblem findet; keine Umschreibung bestehender Migrationen nach Veröffentlichung.
- API: Verträge, Fehlercodes, Scope-Zuordnung und OpenAPI vollständig abgleichen.
- Frontend: durchgängiger Flow Rezept→Plan→Shopping→Pantry→Cook→Undo; Desktop/Tablet/Mobile; Tastatur/Screenreader/Reduced Motion.
- i18n: Key-Parität aller 23 Locales, Deutsch/Englisch sprachlich reviewt, kein sichtbarer Hardcode.
- Tests:
  - frische DB und Upgrade von Pre-KWF-Version.
  - vollständige Fach-E2E-Szenarien inklusive Rollbacks, Delete/rename snapshots, Recurrence, Idempotenz und Undo.
  - `npm run test:db`, `test:shopping`, `test:meals`, Pantry-Suite, Datepicker, Kitchen-Tabs, Scopes/Permissions, SW, Frontend-Audit und `npm test`.
  - Windows/Node-LTS separat; KWF-FINDING-009 reproduzieren oder schließen.
  - manuelle Browsermatrix für Maus, Touch und Tastatur.
- Risiken: späte Integrationskonflikte; große Vollsuite; Offline-Staleness; Performance der Source-/Movement-Joins.
- Abhängigkeiten: KWF-002 bis KWF-009.
- Akzeptanzkriterien:
  - Vollständiger Workflow ist nachvollziehbar, atomar und rückgängig machbar.
  - Upgrade bestehender DB ist erfolgreich und Daten bleiben erhalten.
  - Keine bekannten P0/P1-Findings; niedrigere Findings dokumentiert.
  - Dokumentation/OpenAPI/i18n/PWA entsprechen dem Code.
  - Alle lokal ausführbaren Tests bestehen; Umgebungsfehler sind isoliert und vollständig dokumentiert.
- Branch: `feature/kitchen-workflow-integration`.
- Komplexität: groß.
- Empfohlene Reihenfolge: 10.

## Empfohlener nächster Schritt

1. KWF-004 ist auf `feature/recipe-meal-shopping-import` implementiert und lokal verifiziert; `upstream` bleibt unverändert.
2. Erst in einer neuen, separat reservierten Session KWF-005 beginnen.
3. Für KWF-005 den vorhandenen `public/components/datepicker.js` wiederverwenden und die im KWF-005-Abschnitt dokumentierte Drag-and-drop-Semantik beachten.

KWF-004 erzeugt beim bestätigten Meal-Create optional und atomar neue Einkaufsartikel mit belastbarer Herkunft. KWF-005 wurde in dieser Session nicht implementiert.

## Review-Gates pro Task

Vor Code:

1. Memory lesen und Taskbereich reservieren.
2. Branch/Status und Überschneidungen prüfen.
3. Betroffene Dateien und Migrationversion gegen aktuellen `main` neu verifizieren.
4. ADRs für den Task akzeptieren oder mit Begründung ersetzen.

Vor Übergabe:

1. Memory-Zeile, Findings und Session-Handoff aktualisieren.
2. Migration auf frischer und bestehender DB testen.
3. fokussierte Suiten plus betroffene Regressionen ausführen.
4. `git diff --check`, OpenAPI, i18n-Key-Parität und sichtbare Hardcodes prüfen.
5. Keine offenen Annahmen ausschließlich im Chat belassen.
