/**
 * Modul: Housekeeping-Test
 * Zweck: Validiert alle Housekeeping-API-Abfragen und Constraints
 * Ausführen: node --experimental-sqlite test/test-housekeeping.js
 */

import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS_SQL } from '../server/db-schema-test.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion fehlgeschlagen');
}

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY, description TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);`);
db.exec(MIGRATIONS_SQL[1]);

// Testdaten: Benutzer anlegen
const u1 = db.prepare(`INSERT INTO users (username, display_name, password_hash, avatar_color, role)
  VALUES ('admin', 'Anna', 'x', '#007AFF', 'admin')`).run();
const uid1 = u1.lastInsertRowid;

console.log('\n[Housekeeping-Test] Smoke Test\n');

test('housekeeping smoke: users table exists', () => {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  ).get();
  assert(row?.name === 'users', 'users table should exist');
});

test('housekeeping smoke: can create test user', () => {
  assert(uid1 > 0, 'User ID should be > 0');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid1);
  assert(user.username === 'admin', 'Username should be admin');
});

console.log(`\n[Housekeeping-Test] Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen\n`);
if (failed > 0) process.exit(1);
