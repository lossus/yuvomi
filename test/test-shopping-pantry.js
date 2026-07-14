import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import express from 'express';
import Database from 'better-sqlite3';

process.env.DB_PATH = ':memory:';
const { MIGRATIONS, _setTestDatabase, _resetTestDatabase } = await import('../server/db.js');
const { default: shoppingRouter } = await import('../server/routes/shopping.js');

const database = new Database(':memory:');
database.pragma('foreign_keys = ON');
database.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`);
for (const migration of MIGRATIONS) {
  if (typeof migration.up === 'function') migration.up(database); else database.exec(migration.up);
  if (typeof migration.afterUp === 'function') migration.afterUp(database);
  database.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(migration.version, migration.description);
}
_setTestDatabase(database);
const userId = Number(database.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES ('kwf008', 'KWF 008', 'x', 'admin')").run().lastInsertRowid);
const listId = Number(database.prepare("INSERT INTO shopping_lists (name, created_by, sort_order) VALUES ('KWF 008', ?, 0)").run(userId).lastInsertRowid);
const fridgeId = database.prepare("SELECT id FROM pantry_locations WHERE key = 'fridge'").get().id;
const cupboardId = database.prepare("SELECT id FROM pantry_locations WHERE key = 'cupboard'").get().id;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.authUserId = userId;
  req.session = { userId };
  if (req.get('x-test-pantry-access') === 'token-deny') {
    req.authMethod = 'api_token';
    req.authScopes = ['shopping:write'];
  }
  if (req.get('x-test-pantry-access') === 'session-read') {
    req.sessionModuleAccess = { pantry: 'read' };
  }
  next();
});
app.use('/api/v1/shopping', shoppingRouter);
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1/shopping`;

async function call(method, path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function createItem(input) {
  const response = await call('POST', `/${listId}/items`, input);
  assert.equal(response.status, 201);
  return response.body.data;
}

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  _resetTestDatabase();
  database.close();
});

test('check-only opt-out preserves the existing Shopping behavior', async () => {
  const item = await createItem({ name: 'Non-food opt-out', quantity: 'one pack' });
  assert.equal((await call('PATCH', `/items/${item.id}`, { is_checked: 1 })).status, 200);
  assert.equal(database.prepare('SELECT is_checked FROM shopping_items WHERE id = ?').get(item.id).is_checked, 1);
  assert.equal(database.prepare('SELECT COUNT(*) count FROM inventory_movements WHERE shopping_item_id = ?').get(item.id).count, 0);
});

test('purchase transfer requires Pantry write in addition to Shopping write', async () => {
  const item = await createItem({ name: 'Permission milk', amount: 1, unit: 'l' });
  for (const access of ['token-deny', 'session-read']) {
    const response = await call('POST', `/items/${item.id}/to-pantry`, { amount: 1, unit: 'l', location_id: fridgeId }, { 'x-test-pantry-access': access });
    assert.equal(response.status, 403);
  }
  assert.equal(database.prepare('SELECT is_checked FROM shopping_items WHERE id = ?').get(item.id).is_checked, 0);
});

let transferItemId;
let transferPantryId;
test('parallel confirmed requests create one checked purchase transfer', async () => {
  const item = await createItem({ name: 'Transfer milk', quantity: 'one bottle', amount: 1.5, unit: 'l' });
  transferItemId = item.id;
  const requests = [1, 2].map(() => call('POST', `/items/${item.id}/to-pantry`, {
    amount: 1.5,
    unit: 'l',
    quantity_display: '1.5 l',
    location_id: fridgeId,
    reason: 'Purchased',
  }));
  const responses = await Promise.all(requests);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  transferPantryId = responses[0].body.data.item.id;
  assert.ok(responses.every((response) => response.body.data.item.id === transferPantryId));
  assert.equal(database.prepare('SELECT is_checked FROM shopping_items WHERE id = ?').get(item.id).is_checked, 1);
  assert.deepEqual(database.prepare('SELECT amount, unit FROM pantry_items WHERE id = ?').get(transferPantryId), { amount: 1.5, unit: 'l' });
  assert.equal(database.prepare('SELECT COUNT(*) count FROM inventory_movements WHERE shopping_item_id = ?').get(item.id).count, 1);
  const listed = (await call('GET', `/${listId}/items`)).body.data.find((entry) => entry.id === item.id);
  assert.equal(listed.pantry_transfer_active, true);
});

test('uncheck and recheck do not book again; undo and redo remain journaled', async () => {
  for (const is_checked of [0, 1]) assert.equal((await call('PATCH', `/items/${transferItemId}`, { is_checked })).status, 200);
  assert.equal(database.prepare('SELECT COUNT(*) count FROM inventory_movements WHERE shopping_item_id = ?').get(transferItemId).count, 1);

  assert.equal((await call('POST', `/items/${transferItemId}/to-pantry/undo`, { reason: 'Undo purchase' })).status, 201);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(transferPantryId).amount, 0);
  const redo = await call('POST', `/items/${transferItemId}/to-pantry`, {
    pantry_item_id: transferPantryId,
    amount: 1.5,
    unit: 'l',
    reason: 'Redo purchase',
  });
  assert.equal(redo.status, 201);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(transferPantryId).amount, 1.5);
  assert.equal(database.prepare('SELECT COUNT(*) count FROM inventory_movements WHERE shopping_item_id = ?').get(transferItemId).count, 2);
  assert.equal(database.prepare('SELECT COUNT(*) count FROM inventory_movements WHERE reverses_movement_id IS NOT NULL').get().count, 1);
});

test('free-text quantity requires explicit confirmation and is never parsed', async () => {
  const item = await createItem({ name: 'Tomato cans', quantity: '2 cans' });
  assert.equal((await call('POST', `/items/${item.id}/to-pantry`, { location_id: cupboardId })).status, 400);
  const confirmed = await call('POST', `/items/${item.id}/to-pantry`, { location_id: cupboardId, quantity_display: '2 cans' });
  assert.equal(confirmed.status, 201);
  assert.equal(confirmed.body.data.item.amount, null);
  assert.equal(confirmed.body.data.item.quantity_display, '2 cans');
});

test('invalid target and forced insert failure roll back check, lot, and movement', async () => {
  const item = await createItem({ name: 'Rollback transfer', amount: 500, unit: 'g' });
  assert.equal((await call('POST', `/items/${item.id}/to-pantry`, { pantry_item_id: 999999, amount: 500, unit: 'g' })).status, 404);
  const beforeLots = database.prepare('SELECT COUNT(*) count FROM pantry_items').get().count;
  database.exec(`CREATE TRIGGER kwf008_force_transfer_failure BEFORE UPDATE OF shopping_item_id ON inventory_movements WHEN NEW.shopping_item_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'forced KWF008 transfer failure'); END;`);
  try {
    assert.equal((await call('POST', `/items/${item.id}/to-pantry`, { location_id: cupboardId, amount: 500, unit: 'g' })).status, 500);
    assert.equal(database.prepare('SELECT is_checked FROM shopping_items WHERE id = ?').get(item.id).is_checked, 0);
    assert.equal(database.prepare('SELECT COUNT(*) count FROM pantry_items').get().count, beforeLots);
    assert.equal(database.prepare('SELECT COUNT(*) count FROM inventory_movements WHERE shopping_item_id = ?').get(item.id).count, 0);
  } finally {
    database.exec('DROP TRIGGER kwf008_force_transfer_failure');
  }
});

test('existing target rejects unstructured or incompatible additions without mutation', async () => {
  const item = await createItem({ name: 'Wrong unit', amount: 1, unit: 'kg' });
  const before = database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(transferPantryId).amount;
  assert.equal((await call('POST', `/items/${item.id}/to-pantry`, { pantry_item_id: transferPantryId, quantity_display: 'one bag' })).status, 400);
  assert.equal((await call('POST', `/items/${item.id}/to-pantry`, { pantry_item_id: transferPantryId, amount: 1, unit: 'kg' })).status, 400);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(transferPantryId).amount, before);
  assert.equal(database.prepare('SELECT is_checked FROM shopping_items WHERE id = ?').get(item.id).is_checked, 0);
});

test('Shopping UI keeps check-only fast and offers explicit accessible Pantry actions', () => {
  const shopping = readFileSync(new URL('../public/pages/shopping.js', import.meta.url), 'utf8');
  const permissions = readFileSync(new URL('../public/permissions.js', import.meta.url), 'utf8');
  assert.match(shopping, /function openPantryTransfer/);
  assert.match(shopping, /data-action="to-pantry"/);
  assert.match(shopping, /data-action="undo-pantry-transfer"/);
  assert.match(shopping, /shopping\.onlyCheck/);
  assert.match(shopping, /structuredQuantityFromInput/);
  assert.match(shopping, /moduleAccess\('shopping'\) === 'write' && moduleAccess\('pantry'\) === 'write'/);
  assert.match(permissions, /pantry:\s*'pantry'/);
  assert.doesNotMatch(shopping, /parse.*item\.quantity/i, 'Shopping free text must not be parsed for Pantry transfer');
});
