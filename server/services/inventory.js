import { randomUUID } from 'node:crypto';
import {
  MAX_STRUCTURED_AMOUNT,
  convertStructuredAmount,
  formatStructuredQuantity,
  normalizeUnit,
  unitDimension,
} from '../../public/utils/quantity.js';

class InventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InventoryError';
    this.status = status;
  }
}

function pantryItem(database, id, { includeDeleted = false } = {}) {
  const deletedClause = includeDeleted ? '' : 'AND pi.deleted_at IS NULL';
  return database.prepare(`
    SELECT pi.*, pl.key AS location_key, pl.name AS location_name, pl.label_key AS location_label_key
    FROM pantry_items pi
    JOIN pantry_locations pl ON pl.id = pi.location_id
    WHERE pi.id = ? ${deletedClause}
  `).get(id) || null;
}

function inventoryMovements(database, itemId) {
  return database.prepare(`
    SELECT im.*, u.display_name AS actor_name
    FROM inventory_movements im
    LEFT JOIN users u ON u.id = im.actor_id
    WHERE im.pantry_item_id = ?
    ORDER BY im.created_at DESC, im.id DESC
  `).all(itemId);
}

function assertLocation(database, locationId) {
  if (!Number.isInteger(locationId) || locationId < 1) {
    throw new InventoryError('location_id must be a positive integer.');
  }
  const location = database.prepare('SELECT * FROM pantry_locations WHERE id = ?').get(locationId);
  if (!location) throw new InventoryError('Pantry location not found.', 404);
  return location;
}

function normalizeStock(amount, unit, { allowEmpty = true } = {}) {
  const amountMissing = amount === undefined || amount === null || amount === '';
  const unitMissing = unit === undefined || unit === null || String(unit).trim() === '';
  if (amountMissing && unitMissing && allowEmpty) return { amount: null, unit: null };
  if (amountMissing || unitMissing) throw new InventoryError('amount and unit must be provided together.');
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > MAX_STRUCTURED_AMOUNT) {
    throw new InventoryError(`amount must be a finite number between 0 and ${MAX_STRUCTURED_AMOUNT}.`);
  }
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) throw new InventoryError('unit must be one of: g, kg, ml, l.');
  return { amount, unit: normalizedUnit };
}

function normalizeMinimum(value, structured) {
  if (value === undefined || value === null || value === '') return null;
  const minimum = Number(value);
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > MAX_STRUCTURED_AMOUNT) {
    throw new InventoryError(`minimum_amount must be between 0 and ${MAX_STRUCTURED_AMOUNT}.`);
  }
  if (!structured.unit) throw new InventoryError('minimum_amount requires a structured amount and unit.');
  return minimum;
}

function quantityDisplay(value, structured) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text.length > 100) throw new InventoryError('quantity_display may be at most 100 characters long.');
  return text || (structured.unit ? formatStructuredQuantity(structured.amount, structured.unit) : null);
}

function insertMovement(database, movement) {
  const result = database.prepare(`
    INSERT INTO inventory_movements (
      pantry_item_id, movement_type, amount_delta, unit, balance_after,
      quantity_display_before, quantity_display_after, reason,
      idempotency_key, reverses_movement_id, actor_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    movement.itemId,
    movement.type,
    movement.delta,
    movement.unit,
    movement.balanceAfter,
    movement.displayBefore,
    movement.displayAfter,
    movement.reason,
    movement.idempotencyKey,
    movement.reversesMovementId,
    movement.actorId,
  );
  return database.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(result.lastInsertRowid);
}

function createPantryItem(database, input, actorId) {
  const structured = normalizeStock(input.amount, input.unit);
  assertLocation(database, input.location_id);
  const minimum = normalizeMinimum(input.minimum_amount, structured);
  const display = quantityDisplay(input.quantity_display, structured);

  return database.transaction(() => {
    const result = database.prepare(`
      INSERT INTO pantry_items (
        name, category, location_id, amount, unit, quantity_display,
        minimum_amount, expiry_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.name,
      input.category,
      input.location_id,
      structured.amount,
      structured.unit,
      display,
      minimum,
      input.expiry_date,
      input.notes,
      actorId,
    );

    const itemId = Number(result.lastInsertRowid);
    insertMovement(database, {
      itemId,
      type: 'initial',
      delta: structured.amount,
      unit: structured.unit,
      balanceAfter: structured.amount,
      displayBefore: null,
      displayAfter: display,
      reason: input.reason,
      idempotencyKey: `pantry:create:${randomUUID()}`,
      reversesMovementId: null,
      actorId,
    });
    return pantryItem(database, itemId);
  })();
}

function convertSignedAmount(amount, fromUnit, toUnit) {
  const converted = convertStructuredAmount(Math.abs(amount), fromUnit, toUnit);
  return converted === null ? null : Math.sign(amount) * converted;
}

function adjustPantryItem(database, itemId, input, actorId) {
  const key = String(input.idempotency_key || '').trim();
  if (!key || key.length > 200) throw new InventoryError('A valid idempotency_key is required.');

  const prior = database.prepare('SELECT * FROM inventory_movements WHERE idempotency_key = ?').get(key);
  if (prior) {
    if (prior.pantry_item_id !== itemId) throw new InventoryError('Idempotency key is already in use.', 409);
    return { item: pantryItem(database, itemId), movement: prior, replayed: true };
  }

  return database.transaction(() => {
    const current = pantryItem(database, itemId);
    if (!current) throw new InventoryError('Pantry item not found.', 404);

    let type = 'adjustment';
    let delta = null;
    let nextAmount = current.amount;
    let nextUnit = current.unit;
    let nextDisplay = current.quantity_display;
    let reversesMovementId = null;

    if (input.reverses_movement_id !== undefined && input.reverses_movement_id !== null) {
      const reverseId = Number(input.reverses_movement_id);
      const original = database.prepare(
        'SELECT * FROM inventory_movements WHERE id = ? AND pantry_item_id = ?'
      ).get(reverseId, itemId);
      if (!original) throw new InventoryError('Movement to reverse not found.', 404);
      const existingReverse = database.prepare(
        'SELECT id FROM inventory_movements WHERE reverses_movement_id = ?'
      ).get(reverseId);
      if (existingReverse) throw new InventoryError('Movement has already been reversed.', 409);
      type = 'reversal';
      reversesMovementId = reverseId;
      if (original.amount_delta !== null) {
        if (!current.unit || unitDimension(current.unit) !== unitDimension(original.unit)) {
          throw new InventoryError('Movement unit is incompatible with the current stock unit.', 409);
        }
        delta = -convertSignedAmount(original.amount_delta, original.unit, current.unit);
        nextAmount = current.amount + delta;
        if (nextAmount < 0) throw new InventoryError('Reversal would create a negative stock balance.', 409);
        nextDisplay = formatStructuredQuantity(nextAmount, current.unit);
      } else {
        nextAmount = null;
        nextUnit = null;
        nextDisplay = original.quantity_display_before;
      }
    } else if (input.delta_amount !== undefined) {
      const rawDelta = input.delta_amount;
      const deltaUnit = normalizeUnit(input.unit);
      if (typeof rawDelta !== 'number' || !Number.isFinite(rawDelta) || rawDelta === 0 || Math.abs(rawDelta) > MAX_STRUCTURED_AMOUNT) {
        throw new InventoryError('delta_amount must be a non-zero finite number within the supported range.');
      }
      if (!current.unit || !deltaUnit || unitDimension(current.unit) !== unitDimension(deltaUnit)) {
        throw new InventoryError('Adjustment unit is incompatible with the pantry item.');
      }
      delta = convertSignedAmount(rawDelta, deltaUnit, current.unit);
      nextAmount = current.amount + delta;
      if (nextAmount < 0) throw new InventoryError('Adjustment would create a negative stock balance.', 409);
      nextDisplay = formatStructuredQuantity(nextAmount, current.unit);
    } else if (input.amount !== undefined || input.unit !== undefined) {
      type = 'correction';
      const structured = normalizeStock(input.amount, input.unit, { allowEmpty: false });
      if (current.unit && unitDimension(current.unit) !== unitDimension(structured.unit)) {
        throw new InventoryError('Corrected unit is incompatible with the current stock unit.');
      }
      const oldInNewUnit = current.amount === null
        ? null
        : convertStructuredAmount(current.amount, current.unit, structured.unit);
      delta = oldInNewUnit === null ? null : structured.amount - oldInNewUnit;
      nextAmount = structured.amount;
      nextUnit = structured.unit;
      nextDisplay = quantityDisplay(input.quantity_display, structured);
    } else if (input.quantity_display !== undefined) {
      type = 'correction';
      nextAmount = null;
      nextUnit = null;
      nextDisplay = quantityDisplay(input.quantity_display, { amount: null, unit: null });
      if (!nextDisplay) throw new InventoryError('quantity_display must not be empty for an unstructured correction.');
    } else {
      throw new InventoryError('Provide delta_amount, amount/unit, quantity_display, or reverses_movement_id.');
    }

    database.prepare(`
      UPDATE pantry_items SET amount = ?, unit = ?, quantity_display = ? WHERE id = ?
    `).run(nextAmount, nextUnit, nextDisplay, itemId);

    const movement = insertMovement(database, {
      itemId,
      type,
      delta,
      unit: delta === null ? null : nextUnit,
      balanceAfter: nextAmount,
      displayBefore: current.quantity_display,
      displayAfter: nextDisplay,
      reason: input.reason,
      idempotencyKey: key,
      reversesMovementId,
      actorId,
    });
    return { item: pantryItem(database, itemId), movement, replayed: false };
  })();
}

export {
  InventoryError,
  adjustPantryItem,
  assertLocation,
  createPantryItem,
  inventoryMovements,
  normalizeMinimum,
  pantryItem,
};
