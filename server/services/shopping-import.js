/**
 * Build one shopping item per meal ingredient.
 *
 * Quantities intentionally remain opaque text. KWF-003 preserves provenance and
 * must not guess whether two free-text quantities are compatible; structured
 * aggregation belongs to KWF-006.
 */
function shoppingItemsFromMealIngredients(ingredients = []) {
  return ingredients
    .map((ingredient) => ({
      name: String(ingredient?.name || '').trim(),
      category: String(ingredient?.category || 'Sonstiges').trim() || 'Sonstiges',
      quantity: String(ingredient?.quantity || '').trim() || null,
      added_from_meal: ingredient?.meal_id ?? null,
      ingredientIds: ingredient?.id == null ? [] : [ingredient.id],
      source: {
        source_type: 'meal',
        meal_id: ingredient?.meal_id ?? null,
        recipe_id: ingredient?.recipe_id ?? null,
        source_label: String(ingredient?.source_label || ingredient?.meal_title || '').trim(),
        meal_date_snapshot: ingredient?.meal_date_snapshot ?? ingredient?.meal_date ?? null,
        quantity_snapshot: String(ingredient?.quantity || '').trim() || null,
      },
    }))
    .filter((item) => item.name && item.added_from_meal != null && item.source.source_label);
}

export { shoppingItemsFromMealIngredients };
