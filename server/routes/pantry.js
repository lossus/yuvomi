/** Core Pantry REST API: locations, stock lots, filters, metadata, and journaled adjustments. */
import express from 'express';
import * as db from '../db.js';
import { createLogger } from '../logger.js';
import { date, str, MAX_SHORT, MAX_TEXT, MAX_TITLE } from '../middleware/validate.js';
import {
  InventoryError,
  adjustPantryItem,
  assertLocation,
  createPantryItem,
  inventoryMovements,
  normalizeMinimum,
  pantryItem,
} from '../services/inventory.js';

const router = express.Router();
const log = createLogger('Pantry');

function viewerId(req) {
  return req.authUserId || req.session.userId;
}

function idParam(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function nullableString(value, field, max) {
  return str(value, field, { max, required: false });
}

function handleError(res, err, context) {
  if (err instanceof InventoryError) {
    return res.status(err.status).json({ error: err.message, code: err.status });
  }
  log.error(`${context}:`, err);
  return res.status(500).json({ error: 'Internal server error.', code: 500 });
}

function itemPayload(body, { partial = false } = {}) {
  const input = body || {};
  const output = {};
  const errors = [];
  const fields = [
    ['name', MAX_TITLE],
    ['category', MAX_SHORT],
    ['quantity_display', MAX_SHORT],
    ['notes', MAX_TEXT],
    ['reason', MAX_TEXT],
  ];
  for (const [field, max] of fields) {
    if (partial && input[field] === undefined) continue;
    const result = field === 'name'
      ? str(input[field], field, { max, required: !partial })
      : nullableString(input[field], field, max);
    if (result.error) errors.push(result.error);
    else output[field] = result.value;
  }
  if (!partial || input.expiry_date !== undefined) {
    const result = date(input.expiry_date, 'expiry_date');
    if (result.error) errors.push(result.error);
    else output.expiry_date = result.value;
  }
  for (const field of ['location_id', 'amount', 'unit', 'minimum_amount']) {
    if (!partial || input[field] !== undefined) output[field] = input[field];
  }
  return { value: output, errors };
}

router.get('/locations', (_req, res) => {
  try {
    const locations = db.get().prepare(
      'SELECT * FROM pantry_locations ORDER BY sort_order ASC, id ASC'
    ).all();
    res.json({ data: locations });
  } catch (err) {
    handleError(res, err, 'GET /locations');
  }
});

router.get('/', (req, res) => {
  try {
    const params = [];
    let sql = `
      SELECT pi.*, pl.key AS location_key, pl.name AS location_name, pl.label_key AS location_label_key,
        CASE WHEN pi.amount IS NOT NULL AND pi.minimum_amount IS NOT NULL AND pi.amount <= pi.minimum_amount THEN 1 ELSE 0 END AS low_stock,
        CASE WHEN pi.expiry_date IS NOT NULL AND pi.expiry_date < date('now') THEN 1 ELSE 0 END AS is_expired
      FROM pantry_items pi
      JOIN pantry_locations pl ON pl.id = pi.location_id
      WHERE pi.deleted_at IS NULL
    `;
    const q = String(req.query.q || '').trim();
    if (q) {
      if (q.length > 100) return res.status(400).json({ error: 'q may be at most 100 characters long.', code: 400 });
      sql += " AND (pi.name LIKE ? ESCAPE '\\' OR COALESCE(pi.category, '') LIKE ? ESCAPE '\\')";
      const escaped = q.replace(/[\\%_]/g, '\\$&');
      params.push(`%${escaped}%`, `%${escaped}%`);
    }
    if (req.query.category) {
      const category = nullableString(req.query.category, 'category', MAX_SHORT);
      if (category.error) return res.status(400).json({ error: category.error, code: 400 });
      sql += ' AND pi.category = ?'; params.push(category.value);
    }
    if (req.query.location) {
      const location = idParam(req.query.location);
      if (!location) return res.status(400).json({ error: 'location must be a positive integer.', code: 400 });
      sql += ' AND pi.location_id = ?'; params.push(location);
    }
    if (req.query.low_stock === '1' || req.query.low_stock === 'true') {
      sql += ' AND pi.amount IS NOT NULL AND pi.minimum_amount IS NOT NULL AND pi.amount <= pi.minimum_amount';
    }
    if (req.query.expires_before) {
      const expiry = date(req.query.expires_before, 'expires_before');
      if (expiry.error) return res.status(400).json({ error: expiry.error, code: 400 });
      sql += ' AND pi.expiry_date IS NOT NULL AND pi.expiry_date <= ?'; params.push(expiry.value);
    }
    sql += ' ORDER BY pi.expiry_date IS NULL, pi.expiry_date ASC, pi.name COLLATE NOCASE ASC, pi.id ASC';
    res.json({ data: db.get().prepare(sql).all(...params) });
  } catch (err) {
    handleError(res, err, 'GET /');
  }
});

router.post('/', (req, res) => {
  const parsed = itemPayload(req.body);
  if (parsed.errors.length) return res.status(400).json({ error: parsed.errors.join(' '), code: 400 });
  try {
    const item = createPantryItem(db.get(), parsed.value, viewerId(req));
    res.status(201).json({ data: item });
  } catch (err) {
    handleError(res, err, 'POST /');
  }
});

router.get('/:id', (req, res) => {
  const id = idParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid pantry item ID.', code: 400 });
  try {
    const item = pantryItem(db.get(), id);
    if (!item) return res.status(404).json({ error: 'Pantry item not found.', code: 404 });
    res.json({ data: { ...item, movements: inventoryMovements(db.get(), id) } });
  } catch (err) {
    handleError(res, err, 'GET /:id');
  }
});

router.patch('/:id', (req, res) => {
  const id = idParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid pantry item ID.', code: 400 });
  const forbidden = ['amount', 'unit', 'quantity_display'].filter((field) => req.body?.[field] !== undefined);
  if (forbidden.length) {
    return res.status(400).json({ error: 'Stock fields may only be changed through /adjust.', code: 400 });
  }
  const parsed = itemPayload(req.body, { partial: true });
  if (parsed.errors.length) return res.status(400).json({ error: parsed.errors.join(' '), code: 400 });
  try {
    const existing = pantryItem(db.get(), id);
    if (!existing) return res.status(404).json({ error: 'Pantry item not found.', code: 404 });
    const fields = parsed.value;
    if (fields.location_id !== undefined) assertLocation(db.get(), Number(fields.location_id));
    if (fields.minimum_amount !== undefined) {
      fields.minimum_amount = normalizeMinimum(fields.minimum_amount, { unit: existing.unit });
    }
    delete fields.reason;
    const keys = Object.keys(fields);
    if (keys.length) {
      db.get().prepare(`UPDATE pantry_items SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`)
        .run(...keys.map((key) => fields[key]), id);
    }
    res.json({ data: pantryItem(db.get(), id) });
  } catch (err) {
    handleError(res, err, 'PATCH /:id');
  }
});

router.delete('/:id', (req, res) => {
  const id = idParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid pantry item ID.', code: 400 });
  try {
    const result = db.get().prepare(
      "UPDATE pantry_items SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ? AND deleted_at IS NULL"
    ).run(id);
    if (!result.changes) return res.status(404).json({ error: 'Pantry item not found.', code: 404 });
    res.status(204).end();
  } catch (err) {
    handleError(res, err, 'DELETE /:id');
  }
});

router.post('/:id/adjust', (req, res) => {
  const id = idParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid pantry item ID.', code: 400 });
  const reason = nullableString(req.body?.reason, 'reason', MAX_TEXT);
  if (reason.error) return res.status(400).json({ error: reason.error, code: 400 });
  try {
    const result = adjustPantryItem(db.get(), id, { ...req.body, reason: reason.value }, viewerId(req));
    res.status(result.replayed ? 200 : 201).json({ data: result });
  } catch (err) {
    handleError(res, err, 'POST /:id/adjust');
  }
});

export default router;
