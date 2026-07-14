import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import express from 'express';
import Database from 'better-sqlite3';

process.env.DB_PATH = ':memory:';
const { MIGRATIONS, _setTestDatabase, _resetTestDatabase } = await import('../server/db.js');
const { default: pantryRouter } = await import('../server/routes/pantry.js');

const database = new Database(':memory:');
database.pragma('foreign_keys = ON');
database.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`);
for (const migration of MIGRATIONS) {
  if (typeof migration.up === 'function') migration.up(database); else database.exec(migration.up);
  if (typeof migration.afterUp === 'function') migration.afterUp(database);
  database.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(migration.version, migration.description);
}
_setTestDatabase(database);
const userId = Number(database.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES ('pantry-test', 'Pantry Test', 'x', 'admin')").run().lastInsertRowid);

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.authUserId = userId; req.session = { userId, role: 'admin' }; next(); });
app.use('/api/v1/pantry', pantryRouter);
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1/pantry`;

async function call(method, path = '', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

after(async () => { await new Promise((resolve) => server.close(resolve)); _resetTestDatabase(); database.close(); });

let fridgeId;
let structuredId;
let textId;
let adjustmentId;

test('Migration 89 seeds stable pantry locations', async () => {
  const response = await call('GET', '/locations');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((location) => location.key), ['fridge', 'freezer', 'cupboard', 'cellar', 'other']);
  fridgeId = response.body.data[0].id;
});

test('structured create writes lot and initial movement atomically', async () => {
  const response = await call('POST', '', { name: 'Milk', category: 'Dairy', location_id: fridgeId, amount: 2, unit: 'l', minimum_amount: 1, expiry_date: '2026-07-20' });
  assert.equal(response.status, 201);
  structuredId = response.body.data.id;
  assert.equal(response.body.data.quantity_display, '2 l');
  const movement = database.prepare('SELECT * FROM inventory_movements WHERE pantry_item_id = ?').get(structuredId);
  assert.equal(movement.movement_type, 'initial');
  assert.equal(movement.balance_after, 2);
});

test('free-text create preserves explicit quantity', async () => {
  const response = await call('POST', '', { name: 'Tomatoes', category: 'Vegetables', location_id: fridgeId, quantity_display: '2 cans', expiry_date: '2026-07-15' });
  assert.equal(response.status, 201);
  textId = response.body.data.id;
  assert.equal(response.body.data.amount, null);
  assert.equal(response.body.data.quantity_display, '2 cans');
});

test('search, category, location, low-stock, and expiry filters work', async () => {
  assert.equal((await call('GET', '?q=milk')).body.data.length, 1);
  assert.equal((await call('GET', '?category=Dairy')).body.data.length, 1);
  assert.equal((await call('GET', `?location=${fridgeId}`)).body.data.length, 2);
  assert.equal((await call('GET', '?expires_before=2026-07-16')).body.data[0].name, 'Tomatoes');
  await call('POST', `/${structuredId}/adjust`, { idempotency_key: 'low-stock', delta_amount: -1.5, unit: 'l' });
  assert.deepEqual((await call('GET', '?low_stock=1')).body.data.map((item) => item.id), [structuredId]);
});

test('metadata PATCH rejects direct balance mutation', async () => {
  assert.equal((await call('PATCH', `/${structuredId}`, { amount: 99 })).status, 400);
  assert.equal((await call('PATCH', `/${structuredId}`, { minimum_amount: 1_000_000_001 })).status, 400);
  const updated = await call('PATCH', `/${structuredId}`, { notes: 'Use first', category: 'Cold' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.amount, 0.5);
});

test('delta converts compatible units and idempotency prevents duplicates', async () => {
  const input = { idempotency_key: 'add-500ml', delta_amount: 500, unit: 'ml', reason: 'Bought' };
  const response = await call('POST', `/${structuredId}/adjust`, input);
  assert.equal(response.status, 201);
  adjustmentId = response.body.data.movement.id;
  assert.equal(response.body.data.item.amount, 1);
  assert.equal(response.body.data.movement.amount_delta, 0.5);
  const replay = await call('POST', `/${structuredId}/adjust`, input);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.replayed, true);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM inventory_movements WHERE idempotency_key = 'add-500ml'").get().count, 1);
});

test('failed negative adjustment rolls back balance and journal', async () => {
  const before = database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(structuredId).amount;
  const count = database.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE pantry_item_id = ?').get(structuredId).count;
  assert.equal((await call('POST', `/${structuredId}/adjust`, { idempotency_key: 'too-low', delta_amount: -2, unit: 'l' })).status, 409);
  assert.equal(database.prepare('SELECT amount FROM pantry_items WHERE id = ?').get(structuredId).amount, before);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE pantry_item_id = ?').get(structuredId).count, count);
});

test('absolute and free-text corrections remain journaled', async () => {
  const structured = await call('POST', `/${textId}/adjust`, { idempotency_key: 'structure', amount: 800, unit: 'g', quantity_display: '800 g' });
  assert.equal(structured.body.data.item.amount, 800);
  const text = await call('POST', `/${textId}/adjust`, { idempotency_key: 'text', quantity_display: 'about one can' });
  assert.equal(text.body.data.item.amount, null);
  assert.equal(text.body.data.movement.quantity_display_before, '800 g');
});

test('reversal creates one counter-movement', async () => {
  const response = await call('POST', `/${structuredId}/adjust`, { idempotency_key: 'reverse-add', reverses_movement_id: adjustmentId });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.item.amount, 0.5);
  assert.equal(response.body.data.movement.movement_type, 'reversal');
  assert.equal((await call('POST', `/${structuredId}/adjust`, { idempotency_key: 'reverse-again', reverses_movement_id: adjustmentId })).status, 409);
});

test('soft delete hides lot and preserves movement history', async () => {
  assert.equal((await call('DELETE', `/${textId}`)).status, 204);
  assert.equal((await call('GET', `/${textId}`)).status, 404);
  assert.ok(database.prepare('SELECT deleted_at FROM pantry_items WHERE id = ?').get(textId).deleted_at);
  assert.ok(database.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE pantry_item_id = ?').get(textId).count >= 3);
});

test('Pantry frontend reuses shared modal, escaping, Kitchen tabs, and journal endpoint', () => {
  const source = readFileSync(new URL('../public/pages/pantry.js', import.meta.url), 'utf8');
  assert.match(source, /renderKitchenTabsBar\(container, '\/pantry'\)/);
  assert.match(source, /openModal/);
  assert.match(source, /esc\(/);
  assert.match(source, /idempotency_key/);
  assert.match(source, /pantry\.movement\.purchase/, 'shopping-linked movements need a purchase label');
  assert.match(source, /\[\+-\]\?\\d\+/, 'signed manual stock deltas must be accepted by the Pantry input parser');
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});
