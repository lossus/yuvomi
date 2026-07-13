function insertShoppingItemSource(database, shoppingItemId, source) {
  return database.prepare(`
    INSERT INTO shopping_item_sources
      (shopping_item_id, source_type, meal_id, recipe_id, source_label, meal_date_snapshot, quantity_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    shoppingItemId,
    source.source_type,
    source.meal_id ?? null,
    source.recipe_id ?? null,
    source.source_label,
    source.meal_date_snapshot ?? null,
    source.quantity_snapshot ?? null
  );
}

function attachShoppingItemSources(database, items = []) {
  if (!items.length) return [];

  const ids = items.map((item) => item.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = database.prepare(`
    SELECT *
    FROM shopping_item_sources
    WHERE shopping_item_id IN (${placeholders})
    ORDER BY shopping_item_id ASC, created_at ASC, id ASC
  `).all(...ids);

  const byItem = new Map();
  for (const source of rows) {
    if (!byItem.has(source.shopping_item_id)) byItem.set(source.shopping_item_id, []);
    byItem.get(source.shopping_item_id).push(source);
  }

  return items.map((item) => ({ ...item, sources: byItem.get(item.id) || [] }));
}

function attachShoppingItemSourcesOne(database, item) {
  if (!item) return item;
  return attachShoppingItemSources(database, [item])[0];
}

export { insertShoppingItemSource, attachShoppingItemSources, attachShoppingItemSourcesOne };
