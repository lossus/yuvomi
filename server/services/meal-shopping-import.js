import { shoppingItemsFromMealIngredients } from './shopping-import.js';
import { insertShoppingItemSource } from './shopping-item-sources.js';

/**
 * Transfers every still-open ingredient of one concrete meal to a shopping list.
 *
 * The caller owns the transaction boundary. This keeps meal creation, optional
 * recurrence data, shopping items, provenance rows, and transfer flags atomic.
 */
function importMealIngredientsToShoppingList(database, { mealId, listId }) {
  const ingredients = database.prepare(`
    SELECT
      mi.*,
      m.title AS source_label,
      m.date AS meal_date_snapshot,
      m.recipe_id
    FROM meal_ingredients mi
    JOIN meals m ON m.id = mi.meal_id
    WHERE mi.meal_id = ?
      AND mi.on_shopping_list = 0
    ORDER BY mi.id ASC
  `).all(mealId);

  const items = shoppingItemsFromMealIngredients(ingredients);
  if (!items.length) return 0;

  const insertItem = database.prepare(`
    INSERT INTO shopping_items (list_id, name, quantity, amount, unit, category, added_from_meal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const markDone = database.prepare(`
    UPDATE meal_ingredients SET on_shopping_list = 1 WHERE id = ?
  `);

  for (const item of items) {
    const result = insertItem.run(
      listId,
      item.name,
      item.quantity,
      item.amount,
      item.unit,
      item.category,
      item.added_from_meal
    );
    for (const source of item.sources) {
      insertShoppingItemSource(database, result.lastInsertRowid, source);
    }
    for (const ingredientId of item.ingredientIds) markDone.run(ingredientId);
  }

  return items.length;
}

export { importMealIngredientsToShoppingList };
