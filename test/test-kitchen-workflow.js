import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import test, { after } from 'node:test';
import express from 'express';
import Database from 'better-sqlite3';

process.env.DB_PATH = ':memory:';

const { MIGRATIONS, _setTestDatabase, _resetTestDatabase } = await import('../server/db.js');
const { default: mealsRouter } = await import('../server/routes/meals.js');
const { default: pantryRouter } = await import('../server/routes/pantry.js');
const { default: recipesRouter } = await import('../server/routes/recipes.js');
const { default: shoppingRouter } = await import('../server/routes/shopping.js');
const { buildOpenApiSpec } = await import('../server/openapi.js');
const { moduleForPath, tokenAllows } = await import('../server/scopes.js');
const { PERMISSION_MODULES } = await import('../server/permissions.js');

function createMigrationTable(database) {
  database.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
}

function applyMigration(database, migration) {
  database.transaction(() => {
    if (typeof migration.up === 'function') migration.up(database);
    else database.exec(migration.up);
    if (typeof migration.afterUp === 'function') migration.afterUp(database);
    database.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)')
      .run(migration.version, migration.description);
  })();
}

function applyMigrations(database, predicate = () => true) {
  for (const migration of MIGRATIONS.filter(predicate)) applyMigration(database, migration);
}

test('production migrations upgrade populated schema v85 to v93 without rewriting legacy kitchen data', () => {
  const legacy = new Database(':memory:');
  legacy.pragma('foreign_keys = ON');
  createMigrationTable(legacy);
  applyMigrations(legacy, (migration) => migration.version <= 85);

  const userId = Number(legacy.prepare(`
    INSERT INTO users (username, display_name, password_hash, role)
    VALUES ('kwf010-upgrade', 'KWF 010 Upgrade', 'x', 'admin')
  `).run().lastInsertRowid);
  const recipeId = Number(legacy.prepare(`
    INSERT INTO recipes (title, created_by) VALUES ('Legacy soup', ?)
  `).run(userId).lastInsertRowid);
  const mealId = Number(legacy.prepare(`
    INSERT INTO meals (date, meal_type, title, recipe_id, created_by)
    VALUES ('2026-07-14', 'dinner', 'Legacy soup', ?, ?)
  `).run(recipeId, userId).lastInsertRowid);
  legacy.prepare(`
    INSERT INTO meal_ingredients (meal_id, name, quantity, category)
    VALUES (?, 'Tomatoes', '2 cans', 'Vegetables')
  `).run(mealId);
  const listId = Number(legacy.prepare(`
    INSERT INTO shopping_lists (name, created_by, created_at)
    VALUES ('Legacy list', ?, '2026-01-01T00:00:00Z')
  `).run(userId).lastInsertRowid);
  const itemId = Number(legacy.prepare(`
    INSERT INTO shopping_items (list_id, name, quantity, category, added_from_meal)
    VALUES (?, 'Tomatoes', '2 cans', 'Vegetables', ?)
  `).run(listId, mealId).lastInsertRowid);

  applyMigrations(legacy, (migration) => migration.version >= 86);

  assert.equal(legacy.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, 93);
  assert.deepEqual(
    legacy.prepare('SELECT name, quantity, amount, unit, added_from_meal FROM shopping_items WHERE id = ?').get(itemId),
    { name: 'Tomatoes', quantity: '2 cans', amount: null, unit: null, added_from_meal: mealId },
  );
  assert.equal(legacy.prepare('SELECT sort_order FROM shopping_lists WHERE id = ?').get(listId).sort_order, 0);
  assert.deepEqual(
    legacy.prepare(`
      SELECT shopping_item_id, source_type, meal_id, recipe_id, source_label,
             meal_date_snapshot, quantity_snapshot
      FROM shopping_item_sources WHERE shopping_item_id = ?
    `).get(itemId),
    {
      shopping_item_id: itemId,
      source_type: 'meal',
      meal_id: mealId,
      recipe_id: recipeId,
      source_label: 'Legacy soup',
      meal_date_snapshot: '2026-07-14',
      quantity_snapshot: '2 cans',
    },
  );
  assert.deepEqual(
    legacy.prepare('SELECT key FROM pantry_locations ORDER BY sort_order, id').all().map((row) => row.key),
    ['fridge', 'freezer', 'cupboard', 'cellar', 'other'],
  );
  assert.equal(legacy.prepare('SELECT COUNT(*) AS count FROM pantry_items').get().count, 0);
  assert.equal(legacy.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get().count, 0);
  assert.equal(legacy.prepare('SELECT COUNT(*) AS count FROM meal_cooking_events').get().count, 0);
  assert.equal(legacy.prepare('SELECT COUNT(*) AS count FROM task_documents').get().count, 0);
  assert.ok(
    legacy.prepare("SELECT name FROM pragma_table_info('holiday_cache') WHERE name = 'group_code'").get(),
    'holiday_cache.group_code must be present after migration 93',
  );
  assert.equal(legacy.pragma('foreign_key_check').length, 0);
  legacy.close();
});

const database = new Database(':memory:');
database.pragma('foreign_keys = ON');
createMigrationTable(database);
applyMigrations(database);
_setTestDatabase(database);

const userId = Number(database.prepare(`
  INSERT INTO users (username, display_name, password_hash, role)
  VALUES ('kwf010-flow', 'KWF 010 Flow', 'x', 'admin')
`).run().lastInsertRowid);
const cupboardId = database.prepare("SELECT id FROM pantry_locations WHERE key = 'cupboard'").get().id;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.authUserId = userId;
  req.session = { userId, role: 'admin' };
  next();
});
app.use('/api/v1/recipes', recipesRouter);
app.use('/api/v1/meals', mealsRouter);
app.use('/api/v1/shopping', shoppingRouter);
app.use('/api/v1/pantry', pantryRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  _resetTestDatabase();
  database.close();
});

test('recipe to meal to shopping to pantry to cooking and both undo paths stay traceable', async () => {
  const listResponse = await call('POST', '/shopping', { name: 'KWF 010 groceries' });
  assert.equal(listResponse.status, 201);
  const listId = listResponse.body.data.id;

  const recipeResponse = await call('POST', '/recipes', {
    title: 'KWF 010 bread',
    meal_types: ['dinner'],
    ingredients: [
      { name: 'Flour', quantity: '1 kg', amount: 1, unit: 'kg', category: 'Baking' },
    ],
  });
  assert.equal(recipeResponse.status, 201);
  const recipe = recipeResponse.body.data;

  const mealResponse = await call('POST', '/meals', {
    date: '2026-07-14',
    meal_type: 'dinner',
    title: recipe.title,
    recipe_id: recipe.id,
    ingredients: recipe.ingredients.map(({ name, quantity, amount, unit, category }) => (
      { name, quantity, amount, unit, category }
    )),
    shopping_import: { enabled: true, list_id: listId },
  });
  assert.equal(mealResponse.status, 201);
  assert.deepEqual(mealResponse.body.shopping_import, { enabled: true, list_id: listId, transferred: 1 });
  const meal = mealResponse.body.data;
  const ingredient = meal.ingredients[0];
  assert.equal(ingredient.on_shopping_list, 1);

  const shoppingResponse = await call('GET', `/shopping/${listId}/items`);
  assert.equal(shoppingResponse.status, 200);
  assert.equal(shoppingResponse.body.data.length, 1);
  const shoppingItem = shoppingResponse.body.data[0];
  assert.deepEqual([shoppingItem.amount, shoppingItem.unit], [1, 'kg']);
  assert.equal(shoppingItem.sources.length, 1);
  assert.equal(shoppingItem.sources[0].meal_id, meal.id);
  assert.equal(shoppingItem.sources[0].recipe_id, recipe.id);

  const transferBody = {
    amount: 1,
    unit: 'kg',
    quantity_display: '1 kg',
    location_id: cupboardId,
    reason: 'KWF 010 purchase',
  };
  const transferResponse = await call('POST', `/shopping/items/${shoppingItem.id}/to-pantry`, transferBody);
  assert.equal(transferResponse.status, 201);
  const pantryItem = transferResponse.body.data.item;
  const replayResponse = await call('POST', `/shopping/items/${shoppingItem.id}/to-pantry`, transferBody);
  assert.equal(replayResponse.status, 200);
  assert.equal(replayResponse.body.data.replayed, true);
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE shopping_item_id = ?').get(shoppingItem.id).count,
    1,
  );

  const previewResponse = await call('POST', `/meals/${meal.id}/cook-preview`, {});
  assert.equal(previewResponse.status, 200);
  assert.deepEqual(previewResponse.body.data.ingredients[0].suggested_allocations, [
    { pantry_item_id: pantryItem.id, amount: 1, unit: 'kg' },
  ]);

  const cookBody = {
    allocations: [
      { ingredient_id: ingredient.id, pantry_item_id: pantryItem.id, amount: 1, unit: 'kg' },
    ],
  };
  database.exec(`
    CREATE TRIGGER kwf010_force_cook_failure
    BEFORE UPDATE OF cooking_event_id ON inventory_movements
    WHEN NEW.cooking_event_id IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'forced KWF010 cooking failure'); END
  `);
  try {
    assert.equal((await call('POST', `/meals/${meal.id}/cook`, cookBody)).status, 500);
    assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(pantryItem.id).amount, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM meal_cooking_events WHERE meal_id = ?').get(meal.id).count, 0);
  } finally {
    database.exec('DROP TRIGGER kwf010_force_cook_failure');
  }

  const cookResponse = await call('POST', `/meals/${meal.id}/cook`, cookBody);
  assert.equal(cookResponse.status, 201);
  const cookingEventId = cookResponse.body.data.event.id;
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(pantryItem.id).amount, 0);
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE cooking_event_id = ? AND reverses_movement_id IS NULL').get(cookingEventId).count,
    1,
  );

  const cookingUndo = await call('POST', `/meals/${meal.id}/cook/undo`, {});
  assert.equal(cookingUndo.status, 201);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(pantryItem.id).amount, 1);
  assert.equal(cookingUndo.body.data.event.status, 'undone');

  const purchaseUndo = await call('POST', `/shopping/items/${shoppingItem.id}/to-pantry/undo`, {
    reason: 'KWF 010 purchase undo',
  });
  assert.equal(purchaseUndo.status, 201);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(pantryItem.id).amount, 0);
  assert.equal(database.pragma('foreign_key_check').length, 0);

  const source = database.prepare(`
    SELECT source_label, meal_date_snapshot, quantity_snapshot
    FROM shopping_item_sources WHERE shopping_item_id = ?
  `).get(shoppingItem.id);
  assert.deepEqual(source, {
    source_label: 'KWF 010 bread',
    meal_date_snapshot: '2026-07-14',
    quantity_snapshot: '1 kg',
  });
});

function flattenKeys(value, prefix = '', out = []) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flattenKeys(child, path, out);
    else out.push(path);
  }
  return out;
}

test('OpenAPI, scopes, permissions, PWA policy, and every locale match the integrated workflow', () => {
  const spec = buildOpenApiSpec({}, 'test');
  const operations = [
    ['/api/v1/shopping/reorder', 'patch'],
    ['/api/v1/shopping/{listId}/items', 'get'],
    ['/api/v1/shopping/items/{itemId}/to-pantry', 'post'],
    ['/api/v1/shopping/items/{itemId}/to-pantry/undo', 'post'],
    ['/api/v1/pantry', 'get'],
    ['/api/v1/pantry/{id}/adjust', 'post'],
    ['/api/v1/meals', 'post'],
    ['/api/v1/meals/{id}/cook-preview', 'post'],
    ['/api/v1/meals/{id}/cook', 'post'],
    ['/api/v1/meals/{id}/cook/undo', 'post'],
    ['/api/v1/recipes', 'post'],
  ];
  for (const [path, method] of operations) {
    assert.ok(spec.paths[path]?.[method], `${method.toUpperCase()} ${path} must be documented`);
  }

  assert.equal(moduleForPath('/recipes'), 'meals');
  assert.equal(moduleForPath('/meals/1/cook'), 'meals');
  assert.equal(moduleForPath('/shopping/items/1/to-pantry'), 'shopping');
  assert.equal(moduleForPath('/pantry/1'), 'pantry');
  assert.equal(tokenAllows(['meals:write', 'pantry:read'], 'pantry', 'read'), true);
  assert.equal(tokenAllows(['meals:write', 'pantry:read'], 'pantry', 'write'), false);
  assert.equal(tokenAllows(['shopping:write'], 'pantry', 'write'), false);
  assert.ok(PERMISSION_MODULES.some((module) => module.key === 'pantry' && module.navIds.includes('pantry')));

  const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(serviceWorker, /'\/pages\/pantry\.js'/);
  assert.match(serviceWorker, /'\/styles\/pantry\.css'/);
  const whitelist = serviceWorker.match(/const API_CACHE_WHITELIST\s*=\s*\[[^\]]*\]/s)?.[0] || '';
  assert.doesNotMatch(whitelist, /['"]\/pantry/);

  const localeDirectory = new URL('../public/locales/', import.meta.url);
  const localeFiles = readdirSync(localeDirectory).filter((file) => file.endsWith('.json')).sort();
  assert.equal(localeFiles.length, 23);
  const referenceKeys = flattenKeys(JSON.parse(readFileSync(new URL('de.json', localeDirectory), 'utf8'))).sort();
  for (const file of localeFiles) {
    const keys = flattenKeys(JSON.parse(readFileSync(new URL(file, localeDirectory), 'utf8'))).sort();
    assert.deepEqual(keys, referenceKeys, `${file} must have exact key parity with de.json`);
  }
});
