/**
 * Modul: Einkaufslisten-Test
 * Zweck: Validiert alle Shopping-API-Abfragen, Sortierung, Constraints
 * Ausführen: node --experimental-sqlite test-shopping.js
 */

import { DatabaseSync } from 'node:sqlite';
import fs, { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { MIGRATIONS_SQL } from '../server/db-schema-test.js';
import { url } from '../server/middleware/validate.js';
import { shoppingItemsFromMealIngredients } from '../server/services/shopping-import.js';
import { attachShoppingItemSources } from '../server/services/shopping-item-sources.js';
import { defaultShoppingList } from '../server/services/shopping-lists.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}
async function asyncTest(name, fn) {
  try { await fn(); console.log(`  âœ“ ${name}`); passed++; }
  catch (err) { console.error(`  âœ— ${name}: ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion fehlgeschlagen'); }

// --------------------------------------------------------
// Migration 86: bestehende Listen stabil durchnummerieren
// --------------------------------------------------------
{
  const migrationDb = new DatabaseSync(':memory:');
  migrationDb.exec('PRAGMA foreign_keys = ON;');
  migrationDb.exec(MIGRATIONS_SQL[1]);
  migrationDb.prepare("INSERT INTO users (username, display_name, password_hash) VALUES ('migration-user', 'Migration', 'x')").run();
  migrationDb.prepare("INSERT INTO shopping_lists (id, name, created_by, created_at) VALUES (30, 'SpÃ¤t', 1, '2026-03-03T00:00:00Z')").run();
  migrationDb.prepare("INSERT INTO shopping_lists (id, name, created_by, created_at) VALUES (20, 'FrÃ¼h B', 1, '2026-03-01T00:00:00Z')").run();
  migrationDb.prepare("INSERT INTO shopping_lists (id, name, created_by, created_at) VALUES (10, 'FrÃ¼h A', 1, '2026-03-01T00:00:00Z')").run();
  migrationDb.exec(MIGRATIONS_SQL[86]);

  test('Migration 86 sortiert Bestandslisten nach created_at und id', () => {
    const rows = migrationDb.prepare('SELECT id, sort_order FROM shopping_lists ORDER BY sort_order').all();
    assert(JSON.stringify(rows) === JSON.stringify([
      { id: 10, sort_order: 0 },
      { id: 20, sort_order: 1 },
      { id: 30, sort_order: 2 },
    ]), `Unerwartete Migration: ${JSON.stringify(rows)}`);
  });
  migrationDb.close();
}

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY, description TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);`);
db.exec(MIGRATIONS_SQL[1]);
db.exec(MIGRATIONS_SQL[13]);
db.exec(MIGRATIONS_SQL[86]);
db.exec(MIGRATIONS_SQL[87]);
db.exec(MIGRATIONS_SQL[44]); // FTS5 search_index + Item-Trigger (indiziert notes)

const u1 = db.prepare(`INSERT INTO users (username, display_name, password_hash, role)
  VALUES ('admin', 'Admin', 'x', 'admin')`).run();
const uid = u1.lastInsertRowid;

console.log('\n[Shopping-Test] Listen, Artikel, Sortierung\n');

test('Einkaufslisten-Zeilen toggeln nur außerhalb interaktiver Controls', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  assert(/function shouldIgnoreShoppingRowToggle/.test(source), 'Row-Toggle-Guard muss als Helper existieren');
  assert(/button, a, input, select, textarea, details, summary, \[data-no-row-toggle\]/.test(source), 'Interaktive Controls müssen ignoriert werden');
  assert(/closest\('\.shopping-item'\)/.test(source), 'Klicks müssen auf Einkaufszeilen begrenzt sein');
  assert(/data-item-id/.test(source), 'Zeilen-Toggle muss die Artikel-ID aus data-item-id lesen');
});

// --------------------------------------------------------
// Kategorie-Verwaltung wandert nach Shopping (Task 7)
// --------------------------------------------------------
test('Shopping-Seite importiert den Category-Manager und öffnet ihn bei manage=categories', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  assert(/components\/shopping-category-manager\.js/.test(source), 'shopping.js muss den Category-Manager importieren');
  assert(/yuvomi-shopping-category-manager/.test(source), 'shopping.js muss das Custom Element verwenden');
  assert(/manage.*===\s*'categories'|get\('manage'\)|manage=categories|'manage'/.test(source), 'shopping.js muss den manage-Query-Parameter auswerten');
  assert(/shopping\.manageCategories/.test(source), 'Eine übersetzte „Kategorien verwalten"-Aktion muss vorhanden sein');
  assert(/shopping-categories-changed/.test(source), 'shopping.js muss auf das shopping-categories-changed-Event reagieren');
});

test('Shopping-Seite bietet einen Essensplan-Import mit Datumsbereich an', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  assert(/data-action="import-meals"/.test(source), 'Shopping-Header muss eine Import-Aktion aus dem Essensplan anbieten');
  assert(/function openMealPlanImport/.test(source), 'Shopping-Seite muss einen Import-Dialog für den Essensplan besitzen');
  assert(/api\.post\(`\/shopping\/\$\{state\.activeListId\}\/import-meal-plan`/.test(source), 'Import-Dialog muss die Shopping-Range-Import-Route aufrufen');
  assert(/shopping\.importMealsEmpty/.test(source), 'Import-Dialog muss leere Bereiche mit einer Shopping-spezifischen Meldung behandeln');
  assert(/type="date" id="shopping-import-from"/.test(source), 'Import-Dialog muss ein Von-Datum anbieten');
  assert(/type="date" id="shopping-import-to"/.test(source), 'Import-Dialog muss ein Bis-Datum anbieten');
  assert(/addLocalDays\(today, 6\)/.test(source), 'Import-Dialog muss standardmäßig 7 Tage (heute + 6) vorauswählen');
});

test('Shopping-Category-Manager-Komponente erfüllt die Web-Component-Verträge', () => {
  const source = readFileSync(new URL('../public/components/shopping-category-manager.js', import.meta.url), 'utf8');
  assert(/customElements\.define\(\s*'yuvomi-shopping-category-manager'/.test(source), 'Tag-Name muss yuvomi-shopping-category-manager sein');
  assert(/connectedCallback/.test(source) && /disconnectedCallback/.test(source), 'Lifecycle-Callbacks müssen vorhanden sein');
  assert(/api\.get\('\/shopping\/categories'\)/.test(source), 'Komponente muss Kategorien per API laden');
  assert(/api\.post\('\/shopping\/categories'/.test(source), 'Hinzufügen muss POST nutzen');
  assert(/api\.put\(`\/shopping\/categories\/\$\{[^}]+\}`/.test(source), 'Umbenennen muss PUT nutzen');
  assert(/api\.patch\('\/shopping\/categories\/reorder'/.test(source), 'Reorder muss PATCH nutzen');
  assert(/api\.delete\(`\/shopping\/categories\/\$\{[^}]+\}`/.test(source), 'Löschen muss DELETE nutzen');
  assert(/shopping-categories-changed/.test(source), 'Mutationen müssen shopping-categories-changed dispatchen');
  assert(/import\s*\{\s*esc\s*\}\s*from\s*'\/utils\/html\.js'/.test(source), 'User-Daten müssen via esc() escaped werden');
  assert(!/\.innerHTML\s*=/.test(source), 'Komponente darf innerHTML nicht zuweisen');
  // disconnectedCallback muss Listener wieder abräumen (kein Leak)
  const disconnectFn = source.match(/disconnectedCallback\(\)\s*\{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert(/removeEventListener/.test(disconnectFn), 'disconnectedCallback muss Listener entfernen');
});

test('Shopping-Category-Manager rollt optimistisches Reorder bei API-Fehler zurück', () => {
  const source = readFileSync(new URL('../public/components/shopping-category-manager.js', import.meta.url), 'utf8');
  const moveFn = source.match(/async _move\([\s\S]*?\n  \}/)?.[0] ?? '';
  assert(moveFn, '_move-Methode muss auffindbar sein');
  // Snapshot vor der Mutation, Rollback im catch (analog zu den Task-5/6-Leaves).
  assert(/const snapshot = \[\.\.\.this\._cats\]/.test(moveFn), '_move muss vor der Mutation einen Snapshot ziehen');
  const catchBlock = moveFn.match(/catch \(err\) \{[\s\S]*?\n    \}/)?.[0] ?? '';
  assert(catchBlock, '_move muss einen catch-Block besitzen');
  assert(/this\._cats = snapshot/.test(catchBlock), 'catch muss this._cats auf den Snapshot zurücksetzen');
  assert(/this\._renderList\(\)/.test(catchBlock), 'catch muss die wiederhergestellte Liste neu rendern');
  assert(!/this\._notifyChanged\(\)/.test(catchBlock), 'catch darf kein shopping-categories-changed dispatchen');
});

test('Shopping-Seite räumt den shopping-categories-changed-Listener in onClose ab', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  const fn = source.match(/async function openCategoryManager[\s\S]*?\n\}/)?.[0] ?? '';
  assert(fn, 'openCategoryManager muss auffindbar sein');
  // Manager-Referenz im äußeren Scope, damit onClose ihn abräumen kann (kein Leak bei Modal-Reuse).
  assert(/let manager = null/.test(fn), 'Manager-Referenz muss im äußeren Scope gehalten werden');
  assert(/manager\.addEventListener\('shopping-categories-changed'/.test(fn), 'onSave muss den Listener registrieren');
  assert(/manager\?\.removeEventListener\('shopping-categories-changed'/.test(fn), 'onClose muss den Listener wieder entfernen');
});

let listId, list2Id, itemId1, itemId2, itemId3;

// --------------------------------------------------------
// Listen-CRUD
// --------------------------------------------------------
test('Liste erstellen', () => {
  const r = db.prepare(`INSERT INTO shopping_lists (name, created_by) VALUES ('REWE', ?)`).run(uid);
  listId = r.lastInsertRowid;
  assert(listId > 0);
});

test('Zweite Liste erstellen', () => {
  const r = db.prepare(`INSERT INTO shopping_lists (name, created_by) VALUES ('dm', ?)`).run(uid);
  list2Id = r.lastInsertRowid;
  assert(list2Id > 0);
});

test('Alle Listen mit Zähler abrufbar', () => {
  const lists = db.prepare(`
    SELECT sl.*,
      COUNT(si.id) AS item_total,
      SUM(CASE WHEN si.is_checked = 1 THEN 1 ELSE 0 END) AS item_checked
    FROM shopping_lists sl
    LEFT JOIN shopping_items si ON si.list_id = sl.id
    GROUP BY sl.id ORDER BY sl.sort_order ASC, sl.created_at ASC, sl.id ASC
  `).all();
  assert(lists.length === 2, `Erwartet 2, erhalten ${lists.length}`);
  assert(lists[0].name === 'REWE');
  assert(lists[0].item_total === 0, 'Noch keine Artikel');
});

test('Liste umbenennen', () => {
  db.prepare(`UPDATE shopping_lists SET name = 'REWE Wocheneinkauf' WHERE id = ?`).run(listId);
  const l = db.prepare('SELECT name FROM shopping_lists WHERE id = ?').get(listId);
  assert(l.name === 'REWE Wocheneinkauf', 'Name aktualisiert');
});

// --------------------------------------------------------
// Artikel-CRUD
// --------------------------------------------------------
test('Artikel hinzufügen - Obst & Gemüse', () => {
  const r = db.prepare(`INSERT INTO shopping_items (list_id, name, quantity, category)
    VALUES (?, 'Äpfel', '1 kg', 'Obst & Gemüse')`).run(listId);
  itemId1 = r.lastInsertRowid;
  assert(itemId1 > 0);
});

test('Artikel hinzufügen - Milchprodukte', () => {
  const r = db.prepare(`INSERT INTO shopping_items (list_id, name, quantity, category)
    VALUES (?, 'Milch', '1 Liter', 'Milchprodukte')`).run(listId);
  itemId2 = r.lastInsertRowid;
  assert(itemId2 > 0);
});

test('Artikel hinzufügen - Backwaren', () => {
  const r = db.prepare(`INSERT INTO shopping_items (list_id, name, category)
    VALUES (?, 'Brot', 'Backwaren')`).run(listId);
  itemId3 = r.lastInsertRowid;
  assert(itemId3 > 0);
});

// --------------------------------------------------------
// Supermarkt-Gang-Sortierung
// --------------------------------------------------------
test('Sortierung nach Supermarkt-Gang-Logik', () => {
  const categories = [
    'Obst & Gemüse', 'Backwaren', 'Milchprodukte', 'Fleisch & Fisch',
    'Tiefkühl', 'Getränke', 'Haushalt', 'Drogerie', 'Sonstiges',
  ];
  const caseExpr = categories.map((c, i) => `WHEN '${c}' THEN ${i}`).join(' ');

  const items = db.prepare(`
    SELECT * FROM shopping_items
    WHERE list_id = ?
    ORDER BY CASE category ${caseExpr} ELSE 9 END, is_checked ASC, created_at ASC
  `).all(listId);

  assert(items.length === 3, `Erwartet 3, erhalten ${items.length}`);
  assert(items[0].category === 'Obst & Gemüse', `Erste Kategorie: ${items[0].category}`);
  assert(items[1].category === 'Backwaren',     `Zweite Kategorie: ${items[1].category}`);
  assert(items[2].category === 'Milchprodukte', `Dritte Kategorie: ${items[2].category}`);
});

test('Abgehakte Artikel ans Ende innerhalb der Kategorie', () => {
  // Zweiten Artikel in Obst einfügen
  db.prepare(`INSERT INTO shopping_items (list_id, name, category, is_checked)
    VALUES (?, 'Bananen', 'Obst & Gemüse', 1)`).run(listId);

  const categories = [
    'Obst & Gemüse', 'Backwaren', 'Milchprodukte', 'Fleisch & Fisch',
    'Tiefkühl', 'Getränke', 'Haushalt', 'Drogerie', 'Sonstiges',
  ];
  const caseExpr = categories.map((c, i) => `WHEN '${c}' THEN ${i}`).join(' ');

  const items = db.prepare(`
    SELECT * FROM shopping_items WHERE list_id = ?
    ORDER BY CASE category ${caseExpr} ELSE 9 END, is_checked ASC, created_at ASC
  `).all(listId);

  const obst = items.filter((i) => i.category === 'Obst & Gemüse');
  assert(obst[0].name === 'Äpfel',   'Nicht abgehakt zuerst');
  assert(obst[1].name === 'Bananen', 'Abgehakt danach');
  assert(obst[1].is_checked === 1,   'Bananen ist abgehakt');
});

// --------------------------------------------------------
// Artikel abhaken
// --------------------------------------------------------
test('Artikel abhaken (toggle)', () => {
  db.prepare(`UPDATE shopping_items SET is_checked = 1 WHERE id = ?`).run(itemId1);
  const item = db.prepare('SELECT is_checked FROM shopping_items WHERE id = ?').get(itemId1);
  assert(item.is_checked === 1, 'Artikel abgehakt');
});

test('Artikel wieder aktivieren', () => {
  db.prepare(`UPDATE shopping_items SET is_checked = 0 WHERE id = ?`).run(itemId1);
  const item = db.prepare('SELECT is_checked FROM shopping_items WHERE id = ?').get(itemId1);
  assert(item.is_checked === 0, 'Artikel wieder aktiv');
});

// --------------------------------------------------------
// Abgehakte löschen
// --------------------------------------------------------
test('"Abgehakte löschen" entfernt nur is_checked=1', () => {
  db.prepare(`UPDATE shopping_items SET is_checked = 1 WHERE id IN (?, ?)`).run(itemId1, itemId2);

  // Äpfel (itemId1) + Milch (itemId2) + Bananen (bereits checked aus vorherigem Test) = 3
  const result = db.prepare(`DELETE FROM shopping_items WHERE list_id = ? AND is_checked = 1`).run(listId);
  assert(result.changes === 3, `Gelöscht: ${result.changes}, erwartet: 3`);

  const remaining = db.prepare(`SELECT * FROM shopping_items WHERE list_id = ?`).all(listId);
  assert(remaining.every((i) => i.is_checked === 0), 'Nur nicht-abgehakte verbleiben');
  assert(remaining.length === 1, `Verbleibend: ${remaining.length} (nur Brot)`);
});

// --------------------------------------------------------
// Autocomplete
// --------------------------------------------------------
test('Autocomplete-Suggestions nach Prefix', () => {
  db.prepare(`INSERT INTO shopping_items (list_id, name, category) VALUES (?, 'Joghurt', 'Milchprodukte')`).run(listId);
  db.prepare(`INSERT INTO shopping_items (list_id, name, category) VALUES (?, 'Käse', 'Milchprodukte')`).run(listId);

  const results = db.prepare(`
    SELECT DISTINCT name FROM shopping_items
    WHERE name LIKE ? COLLATE NOCASE
    ORDER BY name ASC LIMIT 8
  `).all('J%');

  assert(results.length >= 1, 'Mindestens 1 Vorschlag');
  assert(results[0].name === 'Joghurt', `Erwartet Joghurt, erhalten: ${results[0].name}`);
});

test('Autocomplete - kein Match gibt leeres Array', () => {
  const results = db.prepare(`
    SELECT DISTINCT name FROM shopping_items WHERE name LIKE ? COLLATE NOCASE
  `).all('XXXXXXXX%');
  assert(results.length === 0, 'Kein Match erwartet');
});

test('Essensplan-Import bewahrt gleiche Freitext-Zutaten als getrennte Positionen mit Snapshot', () => {
  const result = shoppingItemsFromMealIngredients([
    { id: 1, meal_id: 10, name: 'Tomaten', quantity: '2', category: 'Obst & Gemüse', source_label: 'Pasta', meal_date_snapshot: '2026-07-13', recipe_id: 4 },
    { id: 2, meal_id: 11, name: 'Tomaten', quantity: '3', category: 'Obst & Gemüse', source_label: 'Salat', meal_date_snapshot: '2026-07-14', recipe_id: null },
  ]);
  assert(result.length === 2, `Erwartet 2 getrennte Einträge, erhalten ${result.length}`);
  assert(result[0].quantity === '2' && result[1].quantity === '3', 'Freitextmengen müssen unverändert bleiben');
  assert(result[0].source.source_label === 'Pasta', 'Quellenlabel muss erhalten bleiben');
  assert(result[0].source.quantity_snapshot === '2', 'Mengen-Snapshot muss erhalten bleiben');
  assert(result[0].added_from_meal === 10, 'Legacy-Meal-Verweis muss kompatibel bleiben');
});

test('Quellen-Serializer liefert mehrere Quellen und für manuelle Artikel ein leeres Array', () => {
  const manual = db.prepare("INSERT INTO shopping_items (list_id, name) VALUES (?, 'Manuell')").run(listId).lastInsertRowid;
  const sourced = db.prepare("INSERT INTO shopping_items (list_id, name) VALUES (?, 'Tomaten')").run(listId).lastInsertRowid;
  db.prepare(`INSERT INTO shopping_item_sources
    (shopping_item_id, source_type, source_label, meal_date_snapshot)
    VALUES (?, 'meal', 'Pasta', '2026-07-13'), (?, 'recipe', 'Tomatensalat', NULL)`)
    .run(sourced, sourced);
  const items = db.prepare('SELECT * FROM shopping_items WHERE id IN (?, ?) ORDER BY id').all(manual, sourced);
  const serialized = attachShoppingItemSources(db, items);
  assert(serialized[0].sources.length === 0, 'Manueller Artikel braucht sources: []');
  assert(serialized[1].sources.length === 2, 'Beide Quellen müssen serialisiert werden');
});

test('Source-Insertfehler rollt Item und Transfer-Flag vollständig zurück', () => {
  const meal = db.prepare("INSERT INTO meals (date, meal_type, title, created_by) VALUES ('2026-07-15', 'dinner', 'Rollback', ?)").run(uid).lastInsertRowid;
  const ingredient = db.prepare("INSERT INTO meal_ingredients (meal_id, name) VALUES (?, 'Test')").run(meal).lastInsertRowid;
  let failedAsExpected = false;
  try {
    db.exec('BEGIN');
    const item = db.prepare("INSERT INTO shopping_items (list_id, name, added_from_meal) VALUES (?, 'Test', ?)").run(listId, meal).lastInsertRowid;
    db.prepare("INSERT INTO shopping_item_sources (shopping_item_id, source_type, source_label) VALUES (?, 'invalid', 'Rollback')").run(item);
    db.prepare('UPDATE meal_ingredients SET on_shopping_list = 1 WHERE id = ?').run(ingredient);
    db.exec('COMMIT');
  } catch {
    failedAsExpected = true;
    db.exec('ROLLBACK');
  }
  assert(failedAsExpected, 'Ungültiger Source-Typ muss scheitern');
  assert(!db.prepare("SELECT id FROM shopping_items WHERE name = 'Test' AND added_from_meal = ?").get(meal), 'Item darf nicht verbleiben');
  assert(db.prepare('SELECT on_shopping_list FROM meal_ingredients WHERE id = ?').get(ingredient).on_shopping_list === 0, 'Flag darf nicht gesetzt bleiben');
});

// --------------------------------------------------------
// Zähler-Abfrage
// --------------------------------------------------------
test('Listen-Zähler korrekt nach Änderungen', () => {
  const list = db.prepare(`
    SELECT sl.*,
      COUNT(si.id) AS item_total,
      SUM(CASE WHEN si.is_checked = 1 THEN 1 ELSE 0 END) AS item_checked
    FROM shopping_lists sl
    LEFT JOIN shopping_items si ON si.list_id = sl.id
    WHERE sl.id = ?
    GROUP BY sl.id
  `).get(listId);
  assert(list.item_total > 0, `item_total=${list.item_total}`);
  assert(list.item_checked === 0, 'Keine abgehakten mehr');
});

// --------------------------------------------------------
// Cascade-Löschung
// --------------------------------------------------------
test('Liste löschen entfernt alle Artikel (CASCADE)', () => {
  db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(list2Id);
  const items = db.prepare('SELECT * FROM shopping_items WHERE list_id = ?').all(list2Id);
  assert(items.length === 0, 'Keine Artikel nach Listen-Löschung');
});

test('Nicht existierende Liste gibt keine Zeile', () => {
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(99999);
  assert(!list, 'Sollte undefined sein');
});

// --------------------------------------------------------
// Scroll-Erhalt beim Abhaken (Issue #276)
// --------------------------------------------------------
test('Abhaken aktualisiert nur die betroffene Zeile statt die ganze Liste neu zu rendern', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  assert(/function updateItemRow\(container, item\)/.test(source), 'updateItemRow-Helper muss existieren');

  // toggleShoppingItem darf die Liste nicht mehr komplett neu aufbauen (würde scrollTop auf 0 klemmen)
  const toggleFn = source.match(/async function toggleShoppingItem[\s\S]*?\n}/)?.[0] ?? '';
  assert(toggleFn, 'toggleShoppingItem muss auffindbar sein');
  assert(/updateItemRow\(container, item\)/.test(toggleFn), 'Klick-Toggle muss updateItemRow nutzen');
  assert(!/updateItemsList\(/.test(toggleFn), 'Klick-Toggle darf updateItemsList nicht mehr aufrufen');

  // updateItemRow darf den Listen-Container nicht leeren
  const rowFn = source.match(/function updateItemRow[\s\S]*?\n}/)?.[0] ?? '';
  assert(!/#items-list/.test(rowFn), 'updateItemRow darf den Listen-Container nicht ansprechen/leeren');
});

// --------------------------------------------------------
test('Klick-Delegation wird pro #list-content nur einmal gebunden (Issue #398)', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  const wireFn = source.match(/function wireListContentEvents[\s\S]*?\n}/)?.[0] ?? '';
  assert(wireFn, 'wireListContentEvents muss auffindbar sein');

  // Die Klick-Delegation hängt am stabilen #list-content (nur Kinder werden via
  // replaceChildren ersetzt). switchList/rename rufen wireListContentEvents erneut auf —
  // ohne Guard würde der Listener dupliziert und ein Toggle-Klick höbe sich auf.
  const guardIdx = wireFn.search(/dataset\.eventsWired/);
  const clickIdx = wireFn.search(/addEventListener\('click'/);
  assert(guardIdx >= 0, 'wireListContentEvents muss einen Einmal-Guard (dataset.eventsWired) besitzen');
  assert(clickIdx >= 0, 'wireListContentEvents muss die Klick-Delegation binden');
  assert(guardIdx < clickIdx, 'Der Einmal-Guard muss vor der Klick-Bindung greifen');

  // Rename-per-Enter hängt an einem pro Render neu erzeugten Element und muss
  // weiterhin bei jedem Aufruf verdrahtet werden.
  assert(/function wireRenameKeydown/.test(source), 'wireRenameKeydown-Helper muss existieren');
});

// --------------------------------------------------------
// Rich-Attribute: notes + url (#426)
// --------------------------------------------------------
test('Artikel speichert notes + url und gibt sie zurück', () => {
  const r = db.prepare(`INSERT INTO shopping_items (list_id, name, category, notes, url)
    VALUES (?, 'Wasserfilter', 'Haushalt', 'Modell BWT 814873', 'https://example.com/filter')`).run(listId);
  const item = db.prepare('SELECT notes, url FROM shopping_items WHERE id = ?').get(r.lastInsertRowid);
  assert(item.notes === 'Modell BWT 814873', `notes: ${item.notes}`);
  assert(item.url === 'https://example.com/filter', `url: ${item.url}`);
});

test('notes/url sind optional (NULL erlaubt)', () => {
  const r = db.prepare(`INSERT INTO shopping_items (list_id, name, category) VALUES (?, 'Salz', 'Sonstiges')`).run(listId);
  const item = db.prepare('SELECT notes, url FROM shopping_items WHERE id = ?').get(r.lastInsertRowid);
  assert(item.notes === null && item.url === null, 'notes/url default NULL');
});

test('FTS-Suche findet Artikel über die Notiz (body indiziert notes)', () => {
  const r = db.prepare(`INSERT INTO shopping_items (list_id, name, category, notes)
    VALUES (?, 'Batterien', 'Haushalt', 'Zzxglobber Spezialgroesse')`).run(listId);
  const hit = db.prepare(`SELECT entity_id FROM search_index WHERE entity = 'item' AND search_index MATCH ?`).get('Zzxglobber');
  assert(hit && Number(hit.entity_id) === Number(r.lastInsertRowid), 'Artikel muss über die Notiz auffindbar sein');
});

test('FTS-Update spiegelt geänderte Notiz', () => {
  const r = db.prepare(`INSERT INTO shopping_items (list_id, name, category, notes)
    VALUES (?, 'Kaffee', 'Getränke', 'alteNotiz')`).run(listId);
  db.prepare('UPDATE shopping_items SET notes = ? WHERE id = ?').run('Qwxplumbus', r.lastInsertRowid);
  const hit = db.prepare(`SELECT entity_id FROM search_index WHERE entity = 'item' AND search_index MATCH ?`).get('Qwxplumbus');
  assert(hit && Number(hit.entity_id) === Number(r.lastInsertRowid), 'Aktualisierte Notiz muss im Index landen');
  const stale = db.prepare(`SELECT entity_id FROM search_index WHERE entity = 'item' AND search_index MATCH ?`).get('alteNotiz');
  assert(!stale, 'Alte Notiz darf nicht mehr im Index sein');
});

// --------------------------------------------------------
// url()-Validator (XSS-Härtung: nur http/https)
// --------------------------------------------------------
test('url() akzeptiert http/https', () => {
  assert(url('https://example.com', 'URL').value === 'https://example.com', 'https ok');
  assert(url('http://x.io/pfad?q=1', 'URL').value === 'http://x.io/pfad?q=1', 'http ok');
  assert(url('https://example.com', 'URL').error === null, 'kein Fehler bei gültiger URL');
});

test('url() blockt javascript:/data:/ftp: (XSS-Schutz)', () => {
  assert(url('javascript:alert(1)', 'URL').error, 'javascript: muss abgelehnt werden');
  assert(url('data:text/html,<script>', 'URL').error, 'data: muss abgelehnt werden');
  assert(url('ftp://host/file', 'URL').error, 'ftp: muss abgelehnt werden');
  assert(url('javascript:alert(1)', 'URL').value === null, 'kein Wert bei Ablehnung');
});

test('url() lehnt Unsinn ab und erlaubt Leerwert', () => {
  assert(url('kein link', 'URL').error, 'ungültige URL muss Fehler geben');
  assert(url('', 'URL').value === null && url('', 'URL').error === null, 'leer ist erlaubt (optional)');
  assert(url(null, 'URL').error === null, 'null ist erlaubt');
  assert(url('https://x.io/' + 'a'.repeat(2100), 'URL').error, 'Überlänge muss abgelehnt werden');
});

// --------------------------------------------------------
// Frontend: Detail-Drawer (Progressive Disclosure)
// --------------------------------------------------------
test('shopping.js rendert Detail-Button + Indikatoren und öffnet den Drawer', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  assert(/data-action="item-details"/.test(source), 'Zeile muss einen Details-Button (item-details) haben');
  assert(/function renderItemMeta/.test(source), 'renderItemMeta muss die Indikatoren rendern');
  assert(/function openItemDetails/.test(source), 'openItemDetails muss existieren');
  const fn = source.match(/function openItemDetails[\s\S]*?\n\}/)?.[0] ?? '';
  assert(/openModal\(/.test(fn), 'Detail-Drawer muss openModal nutzen');
  assert(/api\.patch\(`\/shopping\/items\/\$\{item\.id\}`/.test(fn), 'Speichern muss per PATCH erfolgen');
  assert(/rel="noopener noreferrer"/.test(fn) && /target="_blank"/.test(fn), 'Link-Vorschau muss rel=noopener + target=_blank setzen');
  assert(/esc\(/.test(fn), 'User-Daten im Drawer müssen via esc() escaped werden');
  assert(!/\.innerHTML\s*=/.test(fn), 'Drawer darf innerHTML nicht zuweisen');
  // Aktion muss verdrahtet sein.
  assert(/action === 'item-details'/.test(source), 'wireListContentEvents muss die item-details-Aktion behandeln');
});

test('Detail-Refresh ersetzt nur die Meta-Indikatoren, nicht das .shopping-item (Swipe-Closures bleiben intakt)', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  const fn = source.match(/function refreshItemMeta[\s\S]*?\n\}/)?.[0] ?? '';
  assert(fn, 'refreshItemMeta muss existieren');
  assert(!/#items-list/.test(fn), 'refreshItemMeta darf die Liste nicht neu aufbauen');
});

// --------------------------------------------------------
// Route: notes/url-Validierung
// --------------------------------------------------------
test('shopping-Route validiert und persistiert notes/url', () => {
  const source = readFileSync(new URL('../server/routes/shopping.js', import.meta.url), 'utf8');
  assert(/import\s*\{[^}]*\burl\b[^}]*\}\s*from\s*'\.\.\/middleware\/validate\.js'/.test(source), 'Route muss den url()-Validator importieren');
  assert(/url\(req\.body\.url,\s*'URL'\)/.test(source), 'POST muss req.body.url über url() validieren');
  assert(/INSERT INTO shopping_items \(list_id, name, quantity, category, notes, url\)/.test(source), 'INSERT muss notes/url enthalten');
  assert(/SET is_checked = \?, name = \?, quantity = \?, category = \?, notes = \?, url = \?/.test(source), 'UPDATE muss notes/url enthalten');
});

test('shopping-Route bietet einen Datumsbereich-Import aus dem Essensplan an', () => {
  const source = readFileSync(new URL('../server/routes/shopping.js', import.meta.url), 'utf8');
  assert(/router\.post\('\/:listId\/import-meal-plan'/.test(source), 'Shopping-Route muss eine Import-Route für den Essensplan bereitstellen');
  assert(/shoppingItemsFromMealIngredients/.test(source), 'Import-Route muss konservative Importpositionen verwenden');
  assert(/insertShoppingItemSource/.test(source), 'Import-Route muss Herkunft atomar speichern');
  assert(/m\.date BETWEEN \? AND \?/.test(source), 'Import-Route muss Mahlzeiten nach Datumsbereich filtern');
  assert(/mi\.on_shopping_list = 0/.test(source), 'Bereits übertragene Zutaten dürfen nicht erneut importiert werden');
});

test('Shopping-UI rendert einzelne und mehrere Quellen zugänglich', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  assert(/function renderItemSources/.test(source), 'Quellen-Renderer fehlt');
  assert(/<details class="item-sources item-sources--multiple">/.test(source), 'Mehrere Quellen benötigen einen zugänglichen Aufklapper');
  assert(/shopping\.sourcesMultiple/.test(source), 'Mehrquellen-Label muss übersetzt sein');
  assert(/formatDate\(source\.meal_date_snapshot\)/.test(source), 'Snapshot-Datum muss das gemeinsame Datumsformat nutzen');
});

test('Shopping-UI bietet Drag-and-drop, Touch-Aktionen und Default-Kennzeichnung', () => {
  const source = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  assert(/draggable="true"/.test(source), 'Listenzeilen müssen per Drag-and-drop verschiebbar sein');
  assert(/data-action="move-list-up"/.test(source), 'Nach-oben-Aktion fehlt');
  assert(/data-action="move-list-down"/.test(source), 'Nach-unten-Aktion fehlt');
  assert(/data-action="move-list-first"/.test(source), 'An-erste-Stelle-Aktion fehlt');
  assert(/api\.patch\('\/shopping\/reorder'/.test(source), 'Reihenfolge muss über den neuen Endpunkt gespeichert werden');
  assert(/shopping\.defaultList/.test(source), 'Erste Liste muss übersetzt als Standard markiert werden');
});

// --------------------------------------------------------
// Echte Shopping-Routen: Anlegen, Sortieren und Validierung
// --------------------------------------------------------
process.env.DB_PATH = path.join(os.tmpdir(), `yuvomi-shopping-order-${process.pid}.db`);
process.env.SESSION_SECRET = 'shopping-order-test-secret-32bytes-long';
const routeDb = await import('../server/db.js');
const { default: shoppingRouter } = await import('../server/routes/shopping.js');
const { default: mealsRouter } = await import('../server/routes/meals.js');
const routeDatabase = routeDb.get();
routeDatabase.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES ('shopping-owner', 'Owner', 'x', 'admin')").run();

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.authUserId = 1;
  req.authRole = 'admin';
  req.session = { userId: 1 };
  next();
});
app.use('/shopping', shoppingRouter);
app.use('/meals', mealsRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const apiBase = `http://127.0.0.1:${server.address().port}`;
const base = `${apiBase}/shopping`;
const jget = async () => {
  const response = await fetch(base);
  return { status: response.status, body: await response.json() };
};
const jsend = async (method, body) => {
  const response = await fetch(method === 'POST' ? base : `${base}/reorder`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

try {
  const createdIds = [];
  await asyncTest('Neue Listen erhalten jeweils den nächsten sort_order', async () => {
    for (const name of ['Markt', 'Drogerie', 'Baumarkt']) {
      const { status, body } = await jsend('POST', { name });
      assert(status === 201, `POST-Status ${status}`);
      createdIds.push(body.data.id);
    }
    const orders = routeDatabase.prepare('SELECT sort_order FROM shopping_lists ORDER BY id').all().map((row) => row.sort_order);
    assert(JSON.stringify(orders) === JSON.stringify([0, 1, 2]), `sort_order: ${JSON.stringify(orders)}`);
  });

  await asyncTest('Manuelle Item-Antwort enthält sources: []', async () => {
    const response = await fetch(`${base}/${createdIds[0]}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Manual item' }),
    });
    const body = await response.json();
    assert(response.status === 201, `POST-Status ${response.status}`);
    assert(Array.isArray(body.data.sources) && body.data.sources.length === 0, 'sources: [] fehlt');
  });

  await asyncTest('Einzel- und Wochen-Meal-Import erzeugen Herkunftszeilen', async () => {
    const singleMeal = routeDatabase.prepare("INSERT INTO meals (date, meal_type, title, created_by) VALUES ('2026-07-16', 'dinner', 'Single source', 1)").run().lastInsertRowid;
    routeDatabase.prepare("INSERT INTO meal_ingredients (meal_id, name, quantity) VALUES (?, 'Single ingredient', 'one')").run(singleMeal);
    const singleResponse = await fetch(`${apiBase}/meals/${singleMeal}/to-shopping-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: createdIds[0] }),
    });
    assert(singleResponse.status === 200, `Single-Status ${singleResponse.status}`);

    const weekMeal = routeDatabase.prepare("INSERT INTO meals (date, meal_type, title, created_by) VALUES ('2026-07-20', 'lunch', 'Week source', 1)").run().lastInsertRowid;
    routeDatabase.prepare("INSERT INTO meal_ingredients (meal_id, name, quantity) VALUES (?, 'Week ingredient', 'some')").run(weekMeal);
    const weekResponse = await fetch(`${apiBase}/meals/week-to-shopping-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: createdIds[0], week: '2026-07-20' }),
    });
    assert(weekResponse.status === 200, `Week-Status ${weekResponse.status}`);

    const sources = routeDatabase.prepare("SELECT source_label, quantity_snapshot FROM shopping_item_sources WHERE source_label IN ('Single source', 'Week source') ORDER BY source_label").all();
    assert(sources.length === 2, `Erwartet 2 Quellen, erhalten ${sources.length}`);
    assert(sources.some((source) => source.source_label === 'Single source' && source.quantity_snapshot === 'one'), 'Einzel-Snapshot fehlt');
    assert(sources.some((source) => source.source_label === 'Week source' && source.quantity_snapshot === 'some'), 'Wochen-Snapshot fehlt');
  });

  await asyncTest('Bereichsimport hält gleiche Mengen getrennt und liefert löschfeste Quellen-Snapshots', async () => {
    const recipeId = routeDatabase.prepare("INSERT INTO recipes (title, created_by) VALUES ('Tomato recipe', 1)").run().lastInsertRowid;
    const mealId = routeDatabase.prepare("INSERT INTO meals (date, meal_type, title, recipe_id, created_by) VALUES ('2026-07-13', 'dinner', 'Tomato dinner', ?, 1)").run(recipeId).lastInsertRowid;
    routeDatabase.prepare("INSERT INTO meal_ingredients (meal_id, name, quantity) VALUES (?, 'Tomatoes', '2'), (?, 'Tomatoes', '3')").run(mealId, mealId);

    const imported = await fetch(`${base}/${createdIds[0]}/import-meal-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: '2026-07-13', to: '2026-07-13' }),
    });
    const importBody = await imported.json();
    assert(imported.status === 200, `Import-Status ${imported.status}`);
    assert(importBody.data.transferred === 2 && importBody.data.added === 2, `Import-Counts ${JSON.stringify(importBody.data)}`);

    routeDatabase.prepare('DELETE FROM meals WHERE id = ?').run(mealId);
    routeDatabase.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);
    const response = await fetch(`${base}/${createdIds[0]}/items`);
    const body = await response.json();
    const tomatoes = body.data.filter((item) => item.name === 'Tomatoes');
    assert(tomatoes.length === 2, 'Freitextmengen dürfen nicht aggregiert werden');
    assert(tomatoes.every((item) => item.sources.length === 1), 'Jedes Item braucht genau eine Quelle');
    assert(tomatoes.every((item) => item.sources[0].meal_id === null && item.sources[0].recipe_id === null), 'Gelöschte FKs müssen null sein');
    assert(tomatoes.every((item) => item.sources[0].source_label === 'Tomato dinner' && item.sources[0].meal_date_snapshot === '2026-07-13'), 'Snapshots müssen erhalten bleiben');
  });

  await asyncTest('GET liefert Einkaufslisten nach sort_order', async () => {
    routeDatabase.prepare('UPDATE shopping_lists SET sort_order = 20 WHERE id = ?').run(createdIds[0]);
    routeDatabase.prepare('UPDATE shopping_lists SET sort_order = 10 WHERE id = ?').run(createdIds[1]);
    routeDatabase.prepare('UPDATE shopping_lists SET sort_order = 0 WHERE id = ?').run(createdIds[2]);
    const { status, body } = await jget();
    assert(status === 200, `GET-Status ${status}`);
    assert(JSON.stringify(body.data.map((row) => row.id)) === JSON.stringify([createdIds[2], createdIds[1], createdIds[0]]), 'GET-Reihenfolge falsch');
  });

  const wantedOrder = [createdIds[1], createdIds[0], createdIds[2]];
  await asyncTest('PATCH /reorder speichert und liefert die vollständige neue Reihenfolge', async () => {
    const { status, body } = await jsend('PATCH', { order: wantedOrder });
    assert(status === 200, `PATCH-Status ${status}`);
    assert(JSON.stringify(body.data.map((row) => row.id)) === JSON.stringify(wantedOrder), 'Antwort ist nicht neu sortiert');
    assert(JSON.stringify(body.data.map((row) => row.sort_order)) === JSON.stringify([0, 1, 2]), 'Positionen nicht fortlaufend');
  });

  const persistedOrder = () => routeDatabase.prepare('SELECT id FROM shopping_lists ORDER BY sort_order, created_at, id').all().map((row) => row.id);
  await asyncTest('Reorder lehnt eine unbekannte ID ab', async () => {
    const { status } = await jsend('PATCH', { order: [wantedOrder[0], wantedOrder[1], 999999] });
    assert(status === 400, `Status ${status}`);
  });
  await asyncTest('Reorder lehnt doppelte IDs ab', async () => {
    const { status } = await jsend('PATCH', { order: [wantedOrder[0], wantedOrder[0], wantedOrder[2]] });
    assert(status === 400, `Status ${status}`);
  });
  await asyncTest('Reorder lehnt eine unvollständige Reihenfolge ab', async () => {
    const { status } = await jsend('PATCH', { order: wantedOrder.slice(0, 2) });
    assert(status === 400, `Status ${status}`);
  });
  await asyncTest('Reorder lehnt ein leeres order-Array ab', async () => {
    const { status } = await jsend('PATCH', { order: [] });
    assert(status === 400, `Status ${status}`);
  });
  await asyncTest('Ungültige Requests ändern keine sort_order teilweise', async () => {
    assert(JSON.stringify(persistedOrder()) === JSON.stringify(wantedOrder), 'Persistierte Reihenfolge wurde trotz Fehler verändert');
  });
  await asyncTest('Die erste sortierte Liste wird als Default verwendet', async () => {
    const selected = defaultShoppingList(routeDatabase);
    assert(selected.id === wantedOrder[0], `Default-ID ${selected.id}`);
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
  routeDatabase.close();
  try { fs.unlinkSync(process.env.DB_PATH); } catch { /* bereits entfernt */ }
}

// --------------------------------------------------------
// Ergebnis
// --------------------------------------------------------
console.log(`\n[Shopping-Test] Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen\n`);
if (failed > 0) process.exit(1);
