/**
 * Modul: Datenbank-Test
 * Zweck: Schema-Migration mit node:sqlite (built-in) validieren.
 *        Kein Kompilieren nötig - läuft direkt mit Node 22+.
 *        Testet SQL-Korrektheit, FK-Reihenfolge, Triggers, Indizes.
 *
 * Ausführen: node test-db.js
 */

import { DatabaseSync } from 'node:sqlite';

// --------------------------------------------------------
// Migrations-SQL direkt aus db.js extrahieren
// (Nur für Tests - in Produktion läuft db.js mit better-sqlite3)
// --------------------------------------------------------
import { MIGRATIONS_SQL } from '../server/db-schema-test.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion fehlgeschlagen');
}

// --------------------------------------------------------
// Datenbank in Memory aufbauen
// --------------------------------------------------------
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

console.log('\n[DB-Test] Schema-Migration\n');

// --------------------------------------------------------
// Test 1: Migrations-Tabelle anlegen
// --------------------------------------------------------
test('schema_migrations Tabelle erstellen', () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT    NOT NULL,
      applied_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
  `);
  const count = db.prepare('SELECT count(*) as n FROM schema_migrations').get();
  assert(count.n === 0, 'Tabelle sollte leer sein');
});

// --------------------------------------------------------
// Test 2: Vollständige Migration v1 ausführen
// --------------------------------------------------------
test('Migration v1 ausführen (alle Tabellen und Triggers)', () => {
  db.exec(MIGRATIONS_SQL[1]);
  db.prepare('INSERT INTO schema_migrations (version, description) VALUES (1, ?)').run('Initiales Schema');
  const v = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get();
  assert(v.v === 1, 'Version sollte 1 sein');
});

// --------------------------------------------------------
// Test 3: Alle erwarteten Tabellen vorhanden
// --------------------------------------------------------
const EXPECTED_TABLES = [
  'users', 'tasks', 'shopping_lists', 'shopping_items',
  'meals', 'meal_ingredients', 'calendar_events',
  'notes', 'contacts', 'birthdays', 'budget_entries',
  'budget_categories', 'budget_subcategories', 'api_tokens',
];

EXPECTED_TABLES.forEach((table) => {
  test(`Tabelle "${table}" existiert`, () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table);
    assert(row, `Tabelle "${table}" nicht gefunden`);
  });
});

// --------------------------------------------------------
// Test 4: Alle updated_at-Triggers vorhanden
// --------------------------------------------------------
const EXPECTED_TRIGGERS = [
  'users',
  'tasks',
  'shopping_lists',
  'shopping_items',
  'meals',
  'meal_ingredients',
  'calendar_events',
  'notes',
  'contacts',
  'birthdays',
  'budget_entries',
].map((t) => `trg_${t}_updated_at`);

EXPECTED_TRIGGERS.forEach((trigger) => {
  test(`Trigger "${trigger}" existiert`, () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name=?"
    ).get(trigger);
    assert(row, `Trigger "${trigger}" nicht gefunden`);
  });
});

// --------------------------------------------------------
// Test 5: CRUD-Operationen
// --------------------------------------------------------
test('User anlegen', () => {
  const result = db.prepare(`
    INSERT INTO users (username, display_name, password_hash, role)
    VALUES ('admin', 'Admin', '$2b$12$test', 'admin')
  `).run();
  assert(result.lastInsertRowid === 1, 'User-ID sollte 1 sein');
});

test('Aufgabe anlegen und lesen', () => {
  const ins = db.prepare(`
    INSERT INTO tasks (title, created_by, priority) VALUES ('Testaufgabe', 1, 'high')
  `).run();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(ins.lastInsertRowid);
  assert(task.title === 'Testaufgabe', 'Titel stimmt nicht');
  assert(task.status === 'open', 'Status sollte open sein');
  assert(task.priority === 'high', 'Priorität stimmt nicht');
});

test('Mahlzeit und Einkaufsartikel mit FK-Referenz', () => {
  // Mahlzeit zuerst (FK-Reihenfolge)
  const meal = db.prepare(`
    INSERT INTO meals (date, meal_type, title, created_by) VALUES ('2026-03-24', 'dinner', 'Pizza', 1)
  `).run();

  const list = db.prepare(`
    INSERT INTO shopping_lists (name, created_by) VALUES ('REWE', 1)
  `).run();

  // Artikel mit Referenz auf Mahlzeit
  db.prepare(`
    INSERT INTO shopping_items (list_id, name, added_from_meal) VALUES (?, 'Mehl', ?)
  `).run(list.lastInsertRowid, meal.lastInsertRowid);

  const item = db.prepare('SELECT * FROM shopping_items WHERE name = ?').get('Mehl');
  assert(item.added_from_meal === meal.lastInsertRowid, 'FK zu meals stimmt nicht');
});

test('updated_at Trigger feuert bei UPDATE', () => {
  const before = db.prepare('SELECT updated_at FROM tasks WHERE id = 1').get();
  // Kurz warten damit Timestamp sich unterscheidet
  const start = Date.now();
  while (Date.now() - start < 1100) { /* busy wait 1s */ }
  db.prepare("UPDATE tasks SET title = 'Geändert' WHERE id = 1").run();
  const after = db.prepare('SELECT updated_at FROM tasks WHERE id = 1').get();
  assert(after.updated_at > before.updated_at, 'updated_at sollte nach UPDATE neuer sein');
});

test('FK ON DELETE CASCADE (User löschen → Aufgaben weg)', () => {
  // Zweiten User mit Aufgabe anlegen
  db.prepare(`INSERT INTO users (username, display_name, password_hash) VALUES ('user2', 'User 2', 'x')`).run();
  db.prepare(`INSERT INTO tasks (title, created_by) VALUES ('Zu löschen', 2)`).run();

  db.prepare('DELETE FROM users WHERE id = 2').run();

  const orphan = db.prepare("SELECT * FROM tasks WHERE title = 'Zu löschen'").get();
  assert(!orphan, 'Verwaiste Aufgaben sollten gelöscht sein');
});

test('CHECK constraint: ungültige Priorität wird abgelehnt', () => {
  let threw = false;
  try {
    db.prepare("INSERT INTO tasks (title, created_by, priority) VALUES ('x', 1, 'invalid')").run();
  } catch {
    threw = true;
  }
  assert(threw, 'CHECK constraint sollte Fehler werfen');
});

test('Idempotenz: Migration zweimal ausführen ändert nichts', () => {
  // CREATE TABLE IF NOT EXISTS + CREATE TRIGGER IF NOT EXISTS müssen idempotent sein
  db.exec(MIGRATIONS_SQL[1]);
  const tables = db.prepare("SELECT count(*) as n FROM sqlite_master WHERE type='table'").get();
  assert(tables.n > 0, 'Tabellen sollten noch vorhanden sein');
});

test('API-Token anlegen und lesen', () => {
  const result = db.prepare(`
    INSERT INTO api_tokens (name, token_hash, token_prefix, created_by, expires_at)
    VALUES ('MCP integration', 'hash-123', 'oikos_abc123', 1, '2026-12-31T23:59:59.000Z')
  `).run();
  const token = db.prepare('SELECT * FROM api_tokens WHERE id = ?').get(result.lastInsertRowid);
  assert(token.name === 'MCP integration', 'Token name stimmt nicht');
  assert(token.created_by === 1, 'Token creator stimmt nicht');
  assert(token.revoked_at === null, 'Token sollte nicht widerrufen sein');
});

test('Migration 64 legt wiederkehrende Mahlzeiten-Struktur an', () => {
  const recurrentDb = new DatabaseSync(':memory:');
  recurrentDb.exec('PRAGMA foreign_keys = ON;');
  recurrentDb.exec(MIGRATIONS_SQL[1]);
  recurrentDb.exec(MIGRATIONS_SQL[13]);
  recurrentDb.exec(MIGRATIONS_SQL[64]);

  for (const table of ['meal_recurrence_templates', 'meal_recurrence_ingredients', 'meal_recurrence_exceptions']) {
    const row = recurrentDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table);
    assert(row, `Tabelle "${table}" nicht gefunden`);
  }

  const recurrenceColumn = recurrentDb.prepare(`
    SELECT name FROM pragma_table_info('meals')
    WHERE name = 'recurrence_template_id'
  `).get();
  assert(recurrenceColumn, 'Spalte recurrence_template_id fehlt');

  const uniqueIndex = recurrentDb.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name='idx_meals_recurrence_occurrence'
  `).get();
  assert(uniqueIndex, 'Unique-Index für wiederkehrende Vorkommen fehlt');
  recurrentDb.close();
});

test('Geburtstag mit Kalender-Referenz anlegen', () => {
  const event = db.prepare(`
    INSERT INTO calendar_events (title, start_datetime, all_day, created_by, recurrence_rule)
    VALUES ('Birthday: Alex', '2014-05-10', 1, 1, 'FREQ=YEARLY;INTERVAL=1')
  `).run();
  const birthday = db.prepare(`
    INSERT INTO birthdays (name, birth_date, calendar_event_id, created_by)
    VALUES ('Alex', '2014-05-10', ?, 1)
  `).run(event.lastInsertRowid);
  const row = db.prepare('SELECT * FROM birthdays WHERE id = ?').get(birthday.lastInsertRowid);
  assert(row.calendar_event_id === event.lastInsertRowid, 'Kalender-Referenz stimmt nicht');
});

test('Migration 86 ergänzt und initialisiert shopping_lists.sort_order', () => {
  const shoppingDb = new DatabaseSync(':memory:');
  shoppingDb.exec('PRAGMA foreign_keys = ON;');
  shoppingDb.exec(MIGRATIONS_SQL[1]);
  shoppingDb.prepare("INSERT INTO users (username, display_name, password_hash) VALUES ('sort-user', 'Sort', 'x')").run();
  shoppingDb.prepare("INSERT INTO shopping_lists (id, name, created_by, created_at) VALUES (8, 'Später', 1, '2026-02-02T00:00:00Z')").run();
  shoppingDb.prepare("INSERT INTO shopping_lists (id, name, created_by, created_at) VALUES (7, 'Früher', 1, '2026-02-01T00:00:00Z')").run();
  shoppingDb.exec(MIGRATIONS_SQL[86]);

  const column = shoppingDb.prepare("SELECT name, \"notnull\" AS is_not_null, dflt_value FROM pragma_table_info('shopping_lists') WHERE name = 'sort_order'").get();
  assert(column && column.is_not_null === 1 && column.dflt_value === '0', 'sort_order muss NOT NULL DEFAULT 0 sein');
  const rows = shoppingDb.prepare('SELECT id, sort_order FROM shopping_lists ORDER BY sort_order').all();
  assert(rows[0].id === 7 && rows[0].sort_order === 0, 'älteste Liste muss Position 0 erhalten');
  assert(rows[1].id === 8 && rows[1].sort_order === 1, 'nächste Liste muss Position 1 erhalten');
  shoppingDb.close();
});

test('Migration 87 backfillt Herkunft und bewahrt Snapshots nach Quellenlöschung', () => {
  const sourceDb = new DatabaseSync(':memory:');
  sourceDb.exec('PRAGMA foreign_keys = ON;');
  sourceDb.exec(MIGRATIONS_SQL[1]);
  sourceDb.exec(MIGRATIONS_SQL[13]);
  sourceDb.prepare("INSERT INTO users (username, display_name, password_hash) VALUES ('source-user', 'Source', 'x')").run();
  const recipeId = sourceDb.prepare("INSERT INTO recipes (title, created_by) VALUES ('Original recipe', 1)").run().lastInsertRowid;
  const mealId = sourceDb.prepare("INSERT INTO meals (date, meal_type, title, recipe_id, created_by) VALUES ('2026-07-13', 'dinner', 'Original meal', ?, 1)").run(recipeId).lastInsertRowid;
  const listId = sourceDb.prepare("INSERT INTO shopping_lists (name, created_by) VALUES ('Source list', 1)").run().lastInsertRowid;
  const itemId = sourceDb.prepare("INSERT INTO shopping_items (list_id, name, quantity, added_from_meal) VALUES (?, 'Tomatoes', '2 cans', ?)").run(listId, mealId).lastInsertRowid;

  sourceDb.exec(MIGRATIONS_SQL[87]);
  const source = sourceDb.prepare('SELECT * FROM shopping_item_sources WHERE shopping_item_id = ?').get(itemId);
  assert(source && source.meal_id === mealId && source.recipe_id === recipeId, 'Meal-/Recipe-IDs müssen backfillen');
  assert(source.source_label === 'Original meal' && source.meal_date_snapshot === '2026-07-13', 'Titel-/Datum-Snapshots fehlen');
  assert(source.quantity_snapshot === '2 cans', 'Mengen-Snapshot fehlt');

  sourceDb.prepare('DELETE FROM meals WHERE id = ?').run(mealId);
  sourceDb.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);
  const preserved = sourceDb.prepare('SELECT * FROM shopping_item_sources WHERE shopping_item_id = ?').get(itemId);
  assert(preserved.meal_id === null && preserved.recipe_id === null, 'Gelöschte FKs müssen NULL werden');
  assert(preserved.source_label === 'Original meal' && preserved.meal_date_snapshot === '2026-07-13', 'Snapshots müssen unverändert bleiben');
  sourceDb.close();
});

test('Migration 88 ergänzt strukturierte Mengen additiv ohne Legacy-Backfill', () => {
  const quantityDb = new DatabaseSync(':memory:');
  quantityDb.exec('PRAGMA foreign_keys = ON;');
  quantityDb.exec(MIGRATIONS_SQL[1]);
  quantityDb.exec(MIGRATIONS_SQL[13]);
  quantityDb.exec(MIGRATIONS_SQL[64]);
  quantityDb.prepare("INSERT INTO users (username, display_name, password_hash) VALUES ('quantity-user', 'Quantity', 'x')").run();
  const recipeId = quantityDb.prepare("INSERT INTO recipes (title, created_by) VALUES ('Legacy recipe', 1)").run().lastInsertRowid;
  quantityDb.prepare("INSERT INTO recipe_ingredients (recipe_id, name, quantity) VALUES (?, 'Flour', 'some')").run(recipeId);

  quantityDb.exec(MIGRATIONS_SQL[88]);
  for (const table of ['recipe_ingredients', 'meal_ingredients', 'meal_recurrence_ingredients', 'shopping_items']) {
    const columns = quantityDb.prepare(`SELECT name FROM pragma_table_info('${table}') WHERE name IN ('amount', 'unit') ORDER BY name`).all();
    assert(columns.length === 2, `${table} muss amount und unit enthalten`);
  }
  const legacy = quantityDb.prepare("SELECT quantity, amount, unit FROM recipe_ingredients WHERE name = 'Flour'").get();
  assert(legacy.quantity === 'some' && legacy.amount === null && legacy.unit === null, 'Legacy-Freitext darf nicht interpretiert werden');
  quantityDb.close();
});

test('Migration 89 creates Pantry lots, stable locations, and movement constraints', () => {
  const pantryDb = new DatabaseSync(':memory:');
  pantryDb.exec('PRAGMA foreign_keys = ON;');
  pantryDb.exec(MIGRATIONS_SQL[1]);
  pantryDb.exec(MIGRATIONS_SQL[89]);
  const locations = pantryDb.prepare('SELECT key, label_key FROM pantry_locations ORDER BY sort_order').all();
  assert(locations.length === 5 && locations[0].key === 'fridge' && locations[4].key === 'other', 'Default pantry locations missing');
  const columns = pantryDb.prepare("SELECT name FROM pragma_table_info('pantry_items')").all().map((row) => row.name);
  assert(columns.includes('minimum_amount') && columns.includes('expiry_date') && columns.includes('deleted_at'), 'Pantry filter/history columns missing');
  const movementColumns = pantryDb.prepare("SELECT name FROM pragma_table_info('inventory_movements')").all().map((row) => row.name);
  assert(movementColumns.includes('idempotency_key') && movementColumns.includes('reverses_movement_id'), 'Movement idempotency missing');
  let negativeStockRejected = false;
  try {
    pantryDb.prepare("INSERT INTO pantry_items (name, location_id, amount, unit) VALUES ('Bad', 1, -1, 'g')").run();
  } catch (error) {
    negativeStockRejected = /CHECK/.test(error.message);
  }
  assert(negativeStockRejected, 'Negative stock must fail');
  pantryDb.close();
});

test('Migration 90 links purchase movements to shopping items without backfill', () => {
  const transferDb = new DatabaseSync(':memory:');
  transferDb.exec('PRAGMA foreign_keys = ON;');
  transferDb.exec(MIGRATIONS_SQL[1]);
  transferDb.exec(MIGRATIONS_SQL[89]);
  transferDb.exec(MIGRATIONS_SQL[90]);
  const column = transferDb.prepare("SELECT * FROM pragma_table_info('inventory_movements') WHERE name = 'shopping_item_id'").get();
  assert(column, 'shopping_item_id fehlt an inventory_movements');
  const index = transferDb.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_inventory_movements_shopping_item'").get();
  assert(index, 'Shopping-Transferindex fehlt');
  assert(transferDb.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE shopping_item_id IS NOT NULL').get().count === 0, 'Bestehende Bewegungen dürfen nicht backfillt werden');
  transferDb.close();
});

// --------------------------------------------------------
// Ergebnis
// --------------------------------------------------------
console.log(`\n[DB-Test] Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen\n`);
if (failed > 0) process.exit(1);
