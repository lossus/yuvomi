import {
  MAX_STRUCTURED_AMOUNT,
  convertStructuredAmount,
  formatStructuredQuantity,
  normalizeUnit,
  unitDimension,
} from '../../public/utils/quantity.js';
import { adjustPantryItem, InventoryError } from './inventory.js';
import { insertShoppingItemSource } from './shopping-item-sources.js';

const EPSILON = 1e-9;

class MealCookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'MealCookingError';
    this.status = status;
  }
}

function mealSnapshot(database, mealId) {
  const id = Number(mealId);
  if (!Number.isInteger(id) || id < 1) throw new MealCookingError('Invalid meal ID.');
  const meal = database.prepare('SELECT * FROM meals WHERE id = ?').get(id);
  if (!meal) throw new MealCookingError('Meal not found.', 404);
  const ingredients = database.prepare(
    'SELECT * FROM meal_ingredients WHERE meal_id = ? ORDER BY id ASC'
  ).all(id);
  return { meal, ingredients };
}

function activeCookingEvent(database, mealId) {
  return database.prepare(`
    SELECT * FROM meal_cooking_events
    WHERE meal_id = ? AND status = 'confirmed'
    ORDER BY id DESC LIMIT 1
  `).get(mealId) || null;
}

function attachCookingEvents(database, meals = []) {
  if (!Array.isArray(meals) || !meals.length) return meals;
  const ids = meals.map((meal) => Number(meal.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return meals.map((meal) => ({ ...meal, cooking_event: null }));
  const placeholders = ids.map(() => '?').join(',');
  const events = database.prepare(`
    SELECT id, meal_id, status, cooked_at, actor_id
    FROM meal_cooking_events
    WHERE meal_id IN (${placeholders}) AND status = 'confirmed'
    ORDER BY id DESC
  `).all(...ids);
  const byMeal = new Map();
  for (const event of events) if (!byMeal.has(event.meal_id)) byMeal.set(event.meal_id, event);
  return meals.map((meal) => ({ ...meal, cooking_event: byMeal.get(meal.id) || null }));
}

function normalizeName(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase();
}

function roundAmount(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e9) / 1e9;
}

function baseUnit(unit) {
  return unitDimension(unit) === 'mass' ? 'g' : 'ml';
}

function toBase(amount, unit) {
  return convertStructuredAmount(amount, unit, baseUnit(unit));
}

function fromBase(amount, unit) {
  return convertStructuredAmount(amount, baseUnit(unit), unit);
}

function pantryLots(database) {
  return database.prepare(`
    SELECT pi.*, pl.key AS location_key, pl.name AS location_name, pl.label_key AS location_label_key
    FROM pantry_items pi
    JOIN pantry_locations pl ON pl.id = pi.location_id
    WHERE pi.deleted_at IS NULL AND pi.amount > 0 AND pi.unit IS NOT NULL
    ORDER BY CASE WHEN pi.expiry_date IS NULL THEN 1 ELSE 0 END ASC,
             pi.expiry_date ASC, pi.created_at ASC, pi.id ASC
  `).all();
}

function lotDto(lot, exactMatch) {
  return {
    pantry_item_id: lot.id,
    name: lot.name,
    amount: lot.amount,
    unit: lot.unit,
    expiry_date: lot.expiry_date,
    location_key: lot.location_key,
    location_name: lot.location_name,
    location_label_key: lot.location_label_key,
    exact_match: exactMatch,
  };
}

function previewIngredient(ingredient, lots) {
  const structured = ingredient.amount !== null && ingredient.unit !== null;
  const dimension = structured ? unitDimension(ingredient.unit) : null;
  const candidates = lots
    .filter((lot) => !dimension || unitDimension(lot.unit) === dimension)
    .map((lot) => lotDto(lot, normalizeName(lot.name) === normalizeName(ingredient.name)))
    .sort((a, b) => Number(b.exact_match) - Number(a.exact_match));

  if (!structured) {
    return {
      ingredient_id: ingredient.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      amount: null,
      unit: null,
      category: ingredient.category,
      status: 'unknown',
      remaining_amount: null,
      suggested_allocations: [],
      candidates,
    };
  }

  let remainingBase = toBase(ingredient.amount, ingredient.unit);
  const suggested = [];
  for (const candidate of candidates.filter((entry) => entry.exact_match)) {
    if (remainingBase <= EPSILON) break;
    const availableBase = toBase(candidate.amount, candidate.unit);
    const takeBase = Math.min(remainingBase, availableBase);
    if (takeBase <= EPSILON) continue;
    suggested.push({
      pantry_item_id: candidate.pantry_item_id,
      amount: roundAmount(fromBase(takeBase, candidate.unit)),
      unit: candidate.unit,
    });
    remainingBase -= takeBase;
  }

  const remaining = Math.max(0, roundAmount(fromBase(remainingBase, ingredient.unit)));
  return {
    ingredient_id: ingredient.id,
    name: ingredient.name,
    quantity: ingredient.quantity,
    amount: ingredient.amount,
    unit: ingredient.unit,
    category: ingredient.category,
    status: remaining <= EPSILON ? 'matched' : suggested.length ? 'partial' : 'missing',
    remaining_amount: remaining,
    suggested_allocations: suggested,
    candidates,
  };
}

function cookingPreview(database, mealId) {
  const { meal, ingredients } = mealSnapshot(database, mealId);
  const active = activeCookingEvent(database, meal.id);
  if (active) throw new MealCookingError('Meal already has an active cooking event.', 409);
  const lots = pantryLots(database);
  return {
    meal: {
      id: meal.id,
      title: meal.title,
      date: meal.date,
      meal_type: meal.meal_type,
      recipe_id: meal.recipe_id,
      recurrence_template_id: meal.recurrence_template_id,
    },
    ingredients: ingredients.map((ingredient) => previewIngredient(ingredient, lots)),
  };
}

function normalizeAllocations(input, ingredients) {
  const rows = Array.isArray(input) ? input : [];
  if (rows.length > 500) throw new MealCookingError('Too many cooking allocations.');
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const byIngredient = new Map();
  const seen = new Set();

  for (const row of rows) {
    const ingredientId = Number(row?.ingredient_id);
    const pantryItemId = Number(row?.pantry_item_id);
    const amount = row?.amount;
    const unit = normalizeUnit(row?.unit);
    if (!ingredientById.has(ingredientId)) throw new MealCookingError('Allocation references an unknown meal ingredient.');
    if (!Number.isInteger(pantryItemId) || pantryItemId < 1) throw new MealCookingError('pantry_item_id must be a positive integer.');
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_STRUCTURED_AMOUNT) {
      throw new MealCookingError('Allocation amount must be a positive finite number within the supported range.');
    }
    if (!unit) throw new MealCookingError('Allocation unit must be one of: g, kg, ml, l.');
    const key = `${ingredientId}:${pantryItemId}`;
    if (seen.has(key)) throw new MealCookingError('A pantry lot may only be allocated once per ingredient.');
    seen.add(key);
    if (!byIngredient.has(ingredientId)) byIngredient.set(ingredientId, []);
    byIngredient.get(ingredientId).push({ ingredientId, pantryItemId, amount, unit });
  }
  return byIngredient;
}

function validateAllocationLots(database, ingredients, allocations) {
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const itemIds = [...new Set([...allocations.values()].flat().map((allocation) => allocation.pantryItemId))];
  const items = new Map();
  if (itemIds.length) {
    const placeholders = itemIds.map(() => '?').join(',');
    for (const item of database.prepare(`
      SELECT * FROM pantry_items WHERE id IN (${placeholders}) AND deleted_at IS NULL
    `).all(...itemIds)) items.set(item.id, item);
  }

  for (const [ingredientId, rows] of allocations) {
    const ingredient = ingredientById.get(ingredientId);
    let allocatedBase = 0;
    for (const allocation of rows) {
      const item = items.get(allocation.pantryItemId);
      if (!item) throw new MealCookingError('Allocated pantry item not found.', 404);
      if (item.amount === null || !item.unit || unitDimension(item.unit) !== unitDimension(allocation.unit)) {
        throw new MealCookingError('Allocation unit is incompatible with the pantry item.');
      }
      if (ingredient.amount !== null && ingredient.unit !== null) {
        if (unitDimension(ingredient.unit) !== unitDimension(allocation.unit)) {
          throw new MealCookingError('Allocation unit is incompatible with the meal ingredient.');
        }
        allocatedBase += toBase(allocation.amount, allocation.unit);
      }
      allocation.item = item;
    }
    if (ingredient.amount !== null && ingredient.unit !== null) {
      const requiredBase = toBase(ingredient.amount, ingredient.unit);
      if (allocatedBase - requiredBase > EPSILON) {
        throw new MealCookingError('Confirmed allocations exceed the required ingredient amount.');
      }
    }
  }
}

function remainingForIngredient(ingredient, rows) {
  if (ingredient.amount === null || ingredient.unit === null) return null;
  const requiredBase = toBase(ingredient.amount, ingredient.unit);
  const allocatedBase = rows.reduce((sum, row) => sum + toBase(row.amount, row.unit), 0);
  return Math.max(0, roundAmount(fromBase(requiredBase - allocatedBase, ingredient.unit)));
}

function normalizeMissingShopping(value, ingredients) {
  if (value === undefined || value === null || value.enabled !== true) {
    return { enabled: false, listId: null, ingredientIds: new Set() };
  }
  if (typeof value !== 'object' || Array.isArray(value)) throw new MealCookingError('missing_to_shopping must be an object.');
  const listId = Number(value.list_id);
  if (!Number.isInteger(listId) || listId < 1) throw new MealCookingError('missing_to_shopping.list_id must be a positive integer.');
  if (!Array.isArray(value.ingredient_ids)) throw new MealCookingError('missing_to_shopping.ingredient_ids must be an array.');
  const validIds = new Set(ingredients.map((ingredient) => ingredient.id));
  const ingredientIds = new Set();
  for (const rawId of value.ingredient_ids) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || !validIds.has(id)) throw new MealCookingError('Missing-shopping selection references an unknown ingredient.');
    ingredientIds.add(id);
  }
  return { enabled: true, listId, ingredientIds };
}

function loadCookingEvent(database, eventId) {
  const event = database.prepare('SELECT * FROM meal_cooking_events WHERE id = ?').get(eventId);
  if (!event) return null;
  const ingredients = database.prepare(`
    SELECT * FROM meal_cooking_ingredients WHERE cooking_event_id = ? ORDER BY id ASC
  `).all(eventId);
  const allocations = ingredients.length
    ? database.prepare(`
        SELECT mca.* FROM meal_cooking_allocations mca
        JOIN meal_cooking_ingredients mci ON mci.id = mca.cooking_ingredient_id
        WHERE mci.cooking_event_id = ? ORDER BY mca.id ASC
      `).all(eventId)
    : [];
  const byIngredient = new Map();
  for (const allocation of allocations) {
    if (!byIngredient.has(allocation.cooking_ingredient_id)) byIngredient.set(allocation.cooking_ingredient_id, []);
    byIngredient.get(allocation.cooking_ingredient_id).push(allocation);
  }
  return {
    ...event,
    ingredients: ingredients.map((ingredient) => ({
      ...ingredient,
      allocations: byIngredient.get(ingredient.id) || [],
    })),
  };
}

function cookMeal(database, mealId, input, actorId) {
  const { meal, ingredients } = mealSnapshot(database, mealId);
  const allocations = normalizeAllocations(input?.allocations, ingredients);
  validateAllocationLots(database, ingredients, allocations);
  const missing = normalizeMissingShopping(input?.missing_to_shopping, ingredients);
  if (missing.enabled) {
    const list = database.prepare('SELECT id FROM shopping_lists WHERE id = ?').get(missing.listId);
    if (!list) throw new MealCookingError('Shopping list not found.', 404);
  }

  const run = database.transaction(() => {
    if (activeCookingEvent(database, meal.id)) throw new MealCookingError('Meal already has an active cooking event.', 409);
    const insertedEvent = database.prepare(`
      INSERT INTO meal_cooking_events
        (meal_id, recipe_id, meal_title_snapshot, meal_date_snapshot, meal_type_snapshot, actor_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(meal.id, meal.recipe_id, meal.title, meal.date, meal.meal_type, actorId);
    const eventId = Number(insertedEvent.lastInsertRowid);
    let shoppingItemsCreated = 0;

    const insertEventIngredient = database.prepare(`
      INSERT INTO meal_cooking_ingredients
        (cooking_event_id, meal_ingredient_id, name_snapshot, quantity_snapshot,
         amount_snapshot, unit_snapshot, category_snapshot, outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAllocation = database.prepare(`
      INSERT INTO meal_cooking_allocations
        (cooking_ingredient_id, pantry_item_id, pantry_item_name_snapshot, amount, unit, movement_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertShoppingItem = database.prepare(`
      INSERT INTO shopping_items (list_id, name, quantity, amount, unit, category, added_from_meal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ingredient of ingredients) {
      const rows = allocations.get(ingredient.id) || [];
      const remaining = remainingForIngredient(ingredient, rows);
      const outcome = remaining === null
        ? 'unknown'
        : remaining <= EPSILON
          ? 'consumed'
          : rows.length
            ? 'partial'
            : 'missing';
      const eventIngredientId = Number(insertEventIngredient.run(
        eventId,
        ingredient.id,
        ingredient.name,
        ingredient.quantity,
        ingredient.amount,
        ingredient.unit,
        ingredient.category,
        outcome,
      ).lastInsertRowid);

      for (const allocation of rows) {
        const adjustment = adjustPantryItem(database, allocation.pantryItemId, {
          idempotency_key: `meal:cook:${eventId}:${eventIngredientId}:${allocation.pantryItemId}`,
          delta_amount: -allocation.amount,
          unit: allocation.unit,
          reason: meal.title,
        }, actorId);
        database.prepare('UPDATE inventory_movements SET cooking_event_id = ? WHERE id = ?')
          .run(eventId, adjustment.movement.id);
        insertAllocation.run(
          eventIngredientId,
          allocation.pantryItemId,
          allocation.item.name,
          allocation.amount,
          allocation.unit,
          adjustment.movement.id,
        );
      }

      if (missing.enabled && missing.ingredientIds.has(ingredient.id)) {
        if (remaining !== null && remaining <= EPSILON) {
          throw new MealCookingError('A fully allocated ingredient cannot be added as missing.');
        }
        const quantity = remaining === null
          ? ingredient.quantity
          : formatStructuredQuantity(remaining, ingredient.unit);
        const item = insertShoppingItem.run(
          missing.listId,
          ingredient.name,
          quantity,
          remaining,
          remaining === null ? null : ingredient.unit,
          ingredient.category,
          meal.id,
        );
        insertShoppingItemSource(database, item.lastInsertRowid, {
          source_type: 'meal',
          meal_id: meal.id,
          recipe_id: meal.recipe_id,
          source_label: meal.title,
          meal_date_snapshot: meal.date,
          quantity_snapshot: quantity,
        });
        database.prepare(`
          UPDATE meal_cooking_ingredients SET missing_shopping_item_id = ? WHERE id = ?
        `).run(item.lastInsertRowid, eventIngredientId);
        shoppingItemsCreated++;
      }
    }

    return { event: loadCookingEvent(database, eventId), shopping_items_created: shoppingItemsCreated };
  });

  try {
    return run();
  } catch (error) {
    if (error instanceof MealCookingError || error instanceof InventoryError) throw error;
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' && /meal_cooking_events|idx_meal_cooking_events_active/.test(error.message)) {
      throw new MealCookingError('Meal already has an active cooking event.', 409);
    }
    throw error;
  }
}

function undoCookedMeal(database, mealId, actorId) {
  const { meal } = mealSnapshot(database, mealId);
  return database.transaction(() => {
    const event = activeCookingEvent(database, meal.id);
    if (!event) throw new MealCookingError('Meal has no active cooking event.', 409);
    const movements = database.prepare(`
      SELECT im.* FROM inventory_movements im
      WHERE im.cooking_event_id = ? AND im.reverses_movement_id IS NULL
      ORDER BY im.id DESC
    `).all(event.id);
    const reversals = [];
    for (const movement of movements) {
      const result = adjustPantryItem(database, movement.pantry_item_id, {
        idempotency_key: `meal:cook:${event.id}:undo:${movement.id}`,
        reverses_movement_id: movement.id,
        reason: meal.title,
      }, actorId, { includeDeleted: true });
      database.prepare('UPDATE inventory_movements SET cooking_event_id = ? WHERE id = ?')
        .run(event.id, result.movement.id);
      reversals.push(result.movement);
    }
    database.prepare(`
      UPDATE meal_cooking_events
      SET status = 'undone', undone_by = ?, undone_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(actorId, event.id);
    return {
      event: loadCookingEvent(database, event.id),
      reversals,
      shopping_items_retained: database.prepare(`
        SELECT COUNT(*) AS count FROM meal_cooking_ingredients
        WHERE cooking_event_id = ? AND missing_shopping_item_id IS NOT NULL
      `).get(event.id).count,
    };
  })();
}

export {
  MealCookingError,
  activeCookingEvent,
  attachCookingEvents,
  cookMeal,
  cookingPreview,
  loadCookingEvent,
  undoCookedMeal,
};
