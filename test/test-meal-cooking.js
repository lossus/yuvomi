import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after } from 'node:test';
import express from 'express';
import Database from 'better-sqlite3';

process.env.DB_PATH = ':memory:';
const { MIGRATIONS, _setTestDatabase, _resetTestDatabase } = await import('../server/db.js');
const { default: mealsRouter } = await import('../server/routes/meals.js');

const database = new Database(':memory:');
database.pragma('foreign_keys = ON');
database.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`);
for (const migration of MIGRATIONS) {
  if (typeof migration.up === 'function') migration.up(database); else database.exec(migration.up);
  if (typeof migration.afterUp === 'function') migration.afterUp(database);
  database.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(migration.version, migration.description);
}
_setTestDatabase(database);
const userId = Number(database.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES ('kwf009', 'KWF 009', 'x', 'admin')").run().lastInsertRowid);
const listId = Number(database.prepare("INSERT INTO shopping_lists (name, created_by, sort_order) VALUES ('Missing', ?, 0)").run(userId).lastInsertRowid);
const fridgeId = database.prepare("SELECT id FROM pantry_locations WHERE key = 'fridge'").get().id;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.authUserId = userId;
  req.session = { userId };
  const access = req.get('x-test-access');
  if (access === 'pantry-none') req.sessionModuleAccess = { pantry: 'none' };
  if (access === 'pantry-read') req.sessionModuleAccess = { pantry: 'read' };
  if (access === 'shopping-read') req.sessionModuleAccess = { pantry: 'write', shopping: 'read' };
  if (access === 'token-pantries-only') {
    req.authMethod = 'api_token';
    req.authScopes = ['meals:write', 'pantry:write'];
  }
  next();
});
app.use('/api/v1/meals', mealsRouter);
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1/meals`;

async function call(method, path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function createMeal(title, ingredients, { templateId = null, date = '2026-07-14' } = {}) {
  const mealId = Number(database.prepare(`
    INSERT INTO meals (date, meal_type, title, recurrence_template_id, created_by)
    VALUES (?, 'dinner', ?, ?, ?)
  `).run(date, title, templateId, userId).lastInsertRowid);
  const insert = database.prepare(`
    INSERT INTO meal_ingredients (meal_id, name, quantity, amount, unit, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const ingredient of ingredients) {
    insert.run(mealId, ingredient.name, ingredient.quantity ?? null, ingredient.amount ?? null, ingredient.unit ?? null, ingredient.category || 'Lebensmittel');
  }
  return mealId;
}

function createLot(name, amount, unit, expiryDate) {
  return Number(database.prepare(`
    INSERT INTO pantry_items (name, category, location_id, amount, unit, quantity_display, expiry_date, created_by)
    VALUES (?, 'Lebensmittel', ?, ?, ?, ?, ?, ?)
  `).run(name, fridgeId, amount, unit, `${amount} ${unit}`, expiryDate, userId).lastInsertRowid);
}

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  _resetTestDatabase();
  database.close();
});

const firstLotId = createLot('Flour', 500, 'g', '2026-07-15');
const secondLotId = createLot('flour', 2, 'kg', '2026-08-01');
const mealId = createMeal('Bread', [{ name: 'FLOUR', quantity: '1.5 kg', amount: 1.5, unit: 'kg' }]);

test('cook preview is read-only and suggests exact-name lots by earliest expiry', async () => {
  const beforeMovements = database.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get().count;
  const response = await call('POST', `/${mealId}/cook-preview`, {});
  assert.equal(response.status, 200);
  const ingredient = response.body.data.ingredients[0];
  assert.equal(ingredient.status, 'matched');
  assert.deepEqual(ingredient.suggested_allocations.map((entry) => entry.pantry_item_id), [firstLotId, secondLotId]);
  assert.deepEqual(ingredient.suggested_allocations.map((entry) => [entry.amount, entry.unit]), [[500, 'g'], [1, 'kg']]);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM meal_cooking_events').get().count, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get().count, beforeMovements);
});

test('preview and mutation enforce Pantry access; Missing-to-Shopping enforces Shopping write', async () => {
  assert.equal((await call('POST', `/${mealId}/cook-preview`, {}, { 'x-test-access': 'pantry-none' })).status, 403);
  assert.equal((await call('POST', `/${mealId}/cook`, { allocations: [] }, { 'x-test-access': 'pantry-read' })).status, 403);
  const protectedMeal = createMeal('Protected missing', [{ name: 'Salt', quantity: 'some' }]);
  const body = { allocations: [], missing_to_shopping: { enabled: true, list_id: listId, ingredient_ids: [database.prepare('SELECT id FROM meal_ingredients WHERE meal_id = ?').get(protectedMeal).id] } };
  assert.equal((await call('POST', `/${protectedMeal}/cook`, body, { 'x-test-access': 'shopping-read' })).status, 403);
  assert.equal((await call('POST', `/${protectedMeal}/cook`, body, { 'x-test-access': 'token-pantries-only' })).status, 403);
});

test('parallel confirmation consumes multiple lots exactly once and exposes active state', async () => {
  const ingredientId = database.prepare('SELECT id FROM meal_ingredients WHERE meal_id = ?').get(mealId).id;
  const body = { allocations: [
    { ingredient_id: ingredientId, pantry_item_id: firstLotId, amount: 500, unit: 'g' },
    { ingredient_id: ingredientId, pantry_item_id: secondLotId, amount: 1, unit: 'kg' },
  ] };
  const responses = await Promise.all([call('POST', `/${mealId}/cook`, body), call('POST', `/${mealId}/cook`, body)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(firstLotId).amount, 0);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(secondLotId).amount, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE cooking_event_id IS NOT NULL AND reverses_movement_id IS NULL').get().count, 2);
  const listed = await call('GET', `/?week=2026-07-14`);
  assert.ok(listed.body.data.find((meal) => meal.id === mealId).cooking_event);
});

test('undo appends exact counter-movements and permits a later cooking event', async () => {
  const response = await call('POST', `/${mealId}/cook/undo`, {});
  assert.equal(response.status, 201);
  assert.equal(response.body.data.reversals.length, 2);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(firstLotId).amount, 500);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(secondLotId).amount, 2);
  assert.equal(database.prepare("SELECT status FROM meal_cooking_events WHERE meal_id = ? ORDER BY id DESC LIMIT 1").get(mealId).status, 'undone');
});

test('unstructured ingredient is only consumed by explicit manual allocation', async () => {
  const lotId = createLot('Oil', 1, 'l', null);
  const unstructuredMeal = createMeal('Dressing', [{ name: 'Oil', quantity: 'a splash' }]);
  const ingredientId = database.prepare('SELECT id FROM meal_ingredients WHERE meal_id = ?').get(unstructuredMeal).id;
  const response = await call('POST', `/${unstructuredMeal}/cook`, { allocations: [
    { ingredient_id: ingredientId, pantry_item_id: lotId, amount: 100, unit: 'ml' },
  ] });
  assert.equal(response.status, 201);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(lotId).amount, 0.9);
  assert.equal(response.body.data.event.ingredients[0].outcome, 'unknown');
});

test('missing ingredients create shopping items with Meal provenance in the same transaction', async () => {
  const missingMeal = createMeal('Tomato soup', [
    { name: 'Tomatoes', quantity: '500 g', amount: 500, unit: 'g' },
    { name: 'Pepper', quantity: 'to taste' },
  ]);
  const ids = database.prepare('SELECT id FROM meal_ingredients WHERE meal_id = ? ORDER BY id').all(missingMeal).map((row) => row.id);
  const response = await call('POST', `/${missingMeal}/cook`, {
    allocations: [],
    missing_to_shopping: { enabled: true, list_id: listId, ingredient_ids: ids },
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.shopping_items_created, 2);
  const items = database.prepare('SELECT * FROM shopping_items WHERE added_from_meal = ? ORDER BY id').all(missingMeal);
  assert.equal(items.length, 2);
  assert.deepEqual([items[0].amount, items[0].unit], [500, 'g']);
  assert.equal(items[1].quantity, 'to taste');
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM shopping_item_sources WHERE meal_id = ?').get(missingMeal).count, 2);
});

test('understock rolls back event, snapshots, and every partial movement', async () => {
  const lowLot = createLot('Rice', 100, 'g', null);
  const rollbackMeal = createMeal('Rice bowl', [{ name: 'Rice', quantity: '500 g', amount: 500, unit: 'g' }]);
  const ingredientId = database.prepare('SELECT id FROM meal_ingredients WHERE meal_id = ?').get(rollbackMeal).id;
  const beforeEvents = database.prepare('SELECT COUNT(*) AS count FROM meal_cooking_events').get().count;
  const response = await call('POST', `/${rollbackMeal}/cook`, { allocations: [
    { ingredient_id: ingredientId, pantry_item_id: lowLot, amount: 500, unit: 'g' },
  ] });
  assert.equal(response.status, 409);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(lowLot).amount, 100);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM meal_cooking_events').get().count, beforeEvents);
});

test('cooking belongs to one concrete recurring instance and snapshots survive deletion', async () => {
  const templateId = Number(database.prepare(`
    INSERT INTO meal_recurrence_templates (start_date, weekday, meal_type, title, created_by)
    VALUES ('2026-07-20', 0, 'dinner', 'Weekly soup', ?)
  `).run(userId).lastInsertRowid);
  const first = createMeal('Weekly soup', [], { templateId, date: '2026-07-20' });
  const second = createMeal('Weekly soup', [], { templateId, date: '2026-07-27' });
  assert.equal((await call('POST', `/${first}/cook`, { allocations: [] })).status, 201);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM meal_cooking_events WHERE meal_id = ? AND status = 'confirmed'").get(second).count, 0);
  assert.equal((await call('DELETE', `/${first}`)).status, 409, 'Active cooking must be undone before deleting its Meal');
  database.prepare('DELETE FROM meals WHERE id = ?').run(first);
  const event = database.prepare("SELECT * FROM meal_cooking_events WHERE meal_title_snapshot = 'Weekly soup' ORDER BY id DESC LIMIT 1").get();
  assert.equal(event.meal_id, null);
  assert.equal(event.meal_title_snapshot, 'Weekly soup');
});
