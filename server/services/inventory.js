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
      idempotency_key, reverses_movement_id, actor_id, shopping_item_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    movement.shoppingItemId ?? null,
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
      shoppingItemId: null,
    });
    return pantryItem(database, itemId);
  })();
}

function activeShoppingTransfer(database, shoppingItemId) {
  return database.prepare(`
    SELECT im.*, pi.name AS pantry_item_name, pi.deleted_at AS pantry_item_deleted_at
    FROM inventory_movements im
    JOIN pantry_items pi ON pi.id = im.pantry_item_id
    WHERE im.shopping_item_id = ?
      AND im.reverses_movement_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements reversal
        WHERE reversal.reverses_movement_id = im.id
      )
    ORDER BY im.id DESC
    LIMIT 1
  `).get(shoppingItemId) || null;
}

function shoppingTransferFlags(database, shoppingItems) {
  const items = Array.isArray(shoppingItems) ? shoppingItems : [];
  if (!items.length) return items;
  const ids = items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return items.map((item) => ({ ...item, pantry_transfer_active: false }));
  const placeholders = ids.map(() => '?').join(', ');
  const active = new Set(database.prepare(`
    SELECT DISTINCT im.shopping_item_id
    FROM inventory_movements im
    WHERE im.shopping_item_id IN (${placeholders})
      AND im.reverses_movement_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements reversal
        WHERE reversal.reverses_movement_id = im.id
      )
  `).all(...ids).map((row) => row.shopping_item_id));
  return items.map((item) => ({ ...item, pantry_transfer_active: active.has(item.id) }));
}

function transferQuantity(input) {
  const structured = normalizeStock(input.amount, input.unit);
  const display = quantityDisplay(input.quantity_display, structured);
  if (structured.amount !== null && structured.amount <= 0) {
    throw new InventoryError('Purchase amount must be greater than zero.');
  }
  if (structured.amount === null && !display) {
    throw new InventoryError('Confirm amount and unit or provide an explicit quantity_display.');
  }
  return { ...structured, display };
}

function transferShoppingItemToPantry(database, shoppingItemId, input, actorId) {
  const id = Number(shoppingItemId);
  if (!Number.isInteger(id) || id < 1) throw new InventoryError('Invalid shopping item ID.');

  return database.transaction(() => {
    const shoppingItem = database.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id);
    if (!shoppingItem) throw new InventoryError('Shopping item not found.', 404);

    const existingTransfer = activeShoppingTransfer(database, id);
    if (existingTransfer) {
      database.prepare('UPDATE shopping_items SET is_checked = 1 WHERE id = ?').run(id);
      return {
        item: pantryItem(database, existingTransfer.pantry_item_id, { includeDeleted: true }),
        movement: existingTransfer,
        replayed: true,
      };
    }

    const quantity = transferQuantity(input || {});
    const requestedTargetId = input?.pantry_item_id === undefined || input?.pantry_item_id === null || input?.pantry_item_id === ''
      ? null
      : Number(input.pantry_item_id);
    if (requestedTargetId !== null && (!Number.isInteger(requestedTargetId) || requestedTargetId < 1)) {
      throw new InventoryError('pantry_item_id must be a positive integer.');
    }

    let item;
    let movement;
    if (requestedTargetId !== null) {
      item = pantryItem(database, requestedTargetId);
      if (!item) throw new InventoryError('Pantry item not found.', 404);
      if (quantity.amount === null) {
        throw new InventoryError('A structured amount and unit are required when adding to an existing pantry item.');
      }
      const adjustment = adjustPantryItem(database, item.id, {
        idempotency_key: `shopping:purchase:${id}:${randomUUID()}`,
        delta_amount: quantity.amount,
        unit: quantity.unit,
        reason: input?.reason,
      }, actorId);
      movement = adjustment.movement;
      database.prepare('UPDATE inventory_movements SET shopping_item_id = ? WHERE id = ?').run(id, movement.id);
      item = adjustment.item;
    } else {
      const locationId = Number(input?.location_id);
      assertLocation(database, locationId);
      item = createPantryItem(database, {
        name: shoppingItem.name,
        category: shoppingItem.category,
        location_id: locationId,
        amount: quantity.amount,
        unit: quantity.unit,
        quantity_display: quantity.display,
        minimum_amount: null,
        expiry_date: null,
        notes: null,
        reason: input?.reason,
      }, actorId);
      movement = database.prepare(
        'SELECT * FROM inventory_movements WHERE pantry_item_id = ? ORDER BY id DESC LIMIT 1'
      ).get(item.id);
      database.prepare('UPDATE inventory_movements SET shopping_item_id = ? WHERE id = ?').run(id, movement.id);
    }

    database.prepare('UPDATE shopping_items SET is_checked = 1 WHERE id = ?').run(id);
    return {
      item: pantryItem(database, item.id),
      movement: database.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(movement.id),
      replayed: false,
    };
  })();
}

function undoShoppingItemTransfer(database, shoppingItemId, actorId, reason = null) {
  const id = Number(shoppingItemId);
  if (!Number.isInteger(id) || id < 1) throw new InventoryError('Invalid shopping item ID.');
  return database.transaction(() => {
    const shoppingItem = database.prepare('SELECT id FROM shopping_items WHERE id = ?').get(id);
    if (!shoppingItem) throw new InventoryError('Shopping item not found.', 404);
    const transfer = activeShoppingTransfer(database, id);
    if (!transfer) throw new InventoryError('Shopping item has no active pantry transfer.', 409);
    const reversal = adjustPantryItem(database, transfer.pantry_item_id, {
      idempotency_key: `shopping:purchase:${id}:undo:${transfer.id}`,
      reverses_movement_id: transfer.id,
      reason,
    }, actorId, { includeDeleted: true });
    return { ...reversal, transfer_movement_id: transfer.id };
  })();
}

function convertSignedAmount(amount, fromUnit, toUnit) {
  const converted = convertStructuredAmount(Math.abs(amount), fromUnit, toUnit);
  return converted === null ? null : Math.sign(amount) * converted;
}

function adjustPantryItem(database, itemId, input, actorId, { includeDeleted = false } = {}) {
  const key = String(input.idempotency_key || '').trim();
  if (!key || key.length > 200) throw new InventoryError('A valid idempotency_key is required.');

  const prior = database.prepare('SELECT * FROM inventory_movements WHERE idempotency_key = ?').get(key);
  if (prior) {
    if (prior.pantry_item_id !== itemId) throw new InventoryError('Idempotency key is already in use.', 409);
    return { item: pantryItem(database, itemId, { includeDeleted }), movement: prior, replayed: true };
  }

  return database.transaction(() => {
    const current = pantryItem(database, itemId, { includeDeleted });
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
    return { item: pantryItem(database, itemId, { includeDeleted }), movement, replayed: false };
  })();
}

export {
  InventoryError,
  adjustPantryItem,
  activeShoppingTransfer,
  assertLocation,
  createPantryItem,
  inventoryMovements,
  normalizeMinimum,
  pantryItem,
  shoppingTransferFlags,
  transferShoppingItemToPantry,
  undoShoppingItemTransfer,
};
