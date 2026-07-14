import {
  displayQuantityFromBase,
  formatStructuredQuantity,
  toBaseAmount,
  unitDimension,
  validateStructuredQuantity,
} from '../../public/utils/quantity.js';

function sourceFromIngredient(ingredient) {
  const quantitySnapshot = String(ingredient?.quantity || '').trim()
    || formatStructuredQuantity(ingredient?.amount, ingredient?.unit)
    || null;
  return {
    source_type: 'meal',
    meal_id: ingredient?.meal_id ?? null,
    recipe_id: ingredient?.recipe_id ?? null,
    source_label: String(ingredient?.source_label || ingredient?.meal_title || '').trim(),
    meal_date_snapshot: ingredient?.meal_date_snapshot ?? ingredient?.meal_date ?? null,
    quantity_snapshot: quantitySnapshot,
  };
}

/**
 * Keep opaque legacy quantities separate, but aggregate explicitly structured
 * mass/volume values when name, category, and unit dimension are compatible.
 */
function shoppingItemsFromMealIngredients(ingredients = []) {
  const items = [];
  const structuredGroups = new Map();

  for (const ingredient of ingredients) {
    const name = String(ingredient?.name || '').trim();
    const category = String(ingredient?.category || 'Sonstiges').trim() || 'Sonstiges';
    const source = sourceFromIngredient(ingredient);
    if (!name || ingredient?.meal_id == null || !source.source_label) continue;

    const structured = validateStructuredQuantity(ingredient?.amount, ingredient?.unit);
    const dimension = structured.error ? null : unitDimension(structured.value.unit);
    if (!dimension) {
      items.push({
        name,
        category,
        quantity: String(ingredient?.quantity || '').trim() || null,
        amount: null,
        unit: null,
        added_from_meal: ingredient.meal_id,
        ingredientIds: ingredient?.id == null ? [] : [ingredient.id],
        sources: [source],
        source,
      });
      continue;
    }

    const key = `${name.toLowerCase()}\u0000${category}\u0000${dimension}`;
    const baseAmount = toBaseAmount(structured.value.amount, structured.value.unit);
    const existing = structuredGroups.get(key);
    if (!existing) {
      const item = {
        name,
        category,
        quantity: String(ingredient?.quantity || '').trim() || null,
        amount: structured.value.amount,
        unit: structured.value.unit,
        baseAmount,
        added_from_meal: ingredient.meal_id,
        ingredientIds: ingredient?.id == null ? [] : [ingredient.id],
        sources: [source],
        source,
        dimension,
      };
      structuredGroups.set(key, item);
      items.push(item);
      continue;
    }

    existing.baseAmount += baseAmount;
    existing.ingredientIds.push(...(ingredient?.id == null ? [] : [ingredient.id]));
    existing.sources.push(source);
    if (existing.added_from_meal !== ingredient.meal_id) existing.added_from_meal = null;
    const display = displayQuantityFromBase(existing.baseAmount, dimension);
    existing.amount = display.amount;
    existing.unit = display.unit;
    existing.quantity = formatStructuredQuantity(display.amount, display.unit);
  }

  return items.map(({ baseAmount: _baseAmount, dimension: _dimension, ...item }) => item);
}

export { shoppingItemsFromMealIngredients };
