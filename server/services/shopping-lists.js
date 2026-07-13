const SHOPPING_LIST_ORDER = 'sort_order ASC, created_at ASC, id ASC';

function createShoppingList(database, name, createdBy) {
  const result = database.prepare(`
    INSERT INTO shopping_lists (name, created_by, sort_order)
    SELECT ?, ?, COALESCE(MAX(sort_order), -1) + 1
    FROM shopping_lists
  `).run(name, createdBy);

  return database.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(result.lastInsertRowid);
}

function defaultShoppingList(database) {
  return database.prepare(`
    SELECT * FROM shopping_lists
    ORDER BY ${SHOPPING_LIST_ORDER}
    LIMIT 1
  `).get();
}

export { SHOPPING_LIST_ORDER, createShoppingList, defaultShoppingList };
