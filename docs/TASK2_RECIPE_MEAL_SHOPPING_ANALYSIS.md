# Task 2 analysis: recipe planning with optional shopping import

This document prepares the follow-up feature. It does not implement it.

## Existing flow and affected files

- `public/pages/recipes.js`: the `add-to-meals` action currently navigates to `/meals?recipe=<id>`; it does not create a meal itself.
- `public/pages/meals.js`: owns the create/edit dialog (`buildModalContent`, `saveModal`), loads recipes and the ordered shopping-list response, and already renders the date through `<yuvomi-datepicker type="date">`. `state.lists[0]` is therefore the default list after Task 1.
- `public/styles/meals.css`: would own the checkbox/list-picker layout. No new UI dependency is needed.
- `public/components/yuvomi-datepicker.js`: existing micro-calendar implementation to reuse. A native or free-text date input should not be introduced.
- `server/routes/meals.js`: `POST /api/v1/meals` already validates the recipe, creates the optional recurrence template, the meal, and its ingredients in one transaction. The separate `POST /api/v1/meals/:id/to-shopping-list` and `POST /api/v1/meals/week-to-shopping-list` routes demonstrate the current import behavior.
- `server/routes/shopping.js`: `GET /api/v1/shopping` supplies the ordered target lists; `POST /api/v1/shopping/:listId/import-meal-plan` demonstrates the provenance-aware, one-item-per-ingredient import.
- `server/services/shopping-import.js` keeps each free-text ingredient separate until the structured quantity task can determine compatibility without guessing. `server/services/shopping-item-sources.js` is the canonical insert/serialization helper for provenance rows.
- `server/services/shopping-lists.js`: `defaultShoppingList` is the canonical backend fallback for the list with the lowest `sort_order`.
- `server/db.js`, `server/db-schema-test.js`, `docs/SPEC.md`, `server/openapi.js`, all locale JSON files, `test/test-meals.js`, and `test/test-shopping.js` would also be affected.

## Proposed API contract

Extend `POST /api/v1/meals` without breaking existing clients:

```json
{
  "date": "2026-07-15",
  "meal_type": "dinner",
  "title": "Pasta",
  "recipe_id": 12,
  "ingredients": [],
  "add_to_shopping_list": true,
  "shopping_list_id": 3
}
```

Both new properties are optional. `add_to_shopping_list` defaults to `false`. If it is true, `shopping_list_id` must reference an existing list; if omitted, the backend may resolve `defaultShoppingList()` so API clients receive the same default as the UI. The response should continue returning the created meal and may add an import count without removing existing fields.

The existing transfer endpoints remain supported for later/manual transfers. They should eventually call the same internal import helper as meal creation so duplicate and provenance behavior cannot drift.

## UI behavior

In create mode, `buildModalContent` adds an i18n-backed checkbox “Add ingredients to shopping list” and a target-list select. The select is enabled only when the checkbox is checked and defaults to the first entry of the already sorted `state.lists`. With no lists, the option is disabled and the checkbox cannot be enabled. `saveModal` sends both new fields in the existing single `POST /meals` request; it must not perform a second client-side request.

The recipe action continues to open the meal creation flow with the selected recipe. That flow already uses the shared `yuvomi-datepicker` micro-calendar. If a creation dialog is later kept directly on the Recipes page instead of navigating to Meals, it should reuse or extract this same meal-dialog component rather than add a plain date field.

## Data model and provenance

The existing `shopping_items.added_from_meal` column can represent only one meal. It loses the recipe/ingredient-level origin and becomes `NULL` for aggregates spanning multiple meals. It must remain for backward compatibility, but it is not sufficient as the canonical provenance model.

A regular migration (v87, implemented by KWF-003) adds a normalized `shopping_item_sources` table:

```sql
CREATE TABLE shopping_item_sources (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  shopping_item_id     INTEGER NOT NULL REFERENCES shopping_items(id) ON DELETE CASCADE,
  source_type          TEXT NOT NULL CHECK(source_type IN ('meal', 'recipe')),
  meal_id              INTEGER REFERENCES meals(id) ON DELETE SET NULL,
  recipe_id            INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  source_label         TEXT NOT NULL,
  meal_date_snapshot   TEXT,
  quantity_snapshot    TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

Indexes cover `shopping_item_id`, `meal_id`, and `recipe_id`. `source_label`, `meal_date_snapshot`, and `quantity_snapshot` let the shopping UI explain an origin after a meal or recipe is renamed or deleted. For a recipe-planned meal, each source row links the shopping item to the concrete meal and its optional recipe. Existing `added_from_meal` continues to be filled for backward compatibility.

## Transaction boundary

Validation happens before writes: validate meal fields and ingredients, verify `recipe_id`, resolve and verify the target shopping list, and sanitize ingredients. One `db.transaction` then covers:

1. an optional recurrence template and its ingredients;
2. the concrete meal;
3. its `meal_ingredients` rows;
4. shopping items created from those concrete ingredient rows;
5. `shopping_item_sources` rows;
6. `meal_ingredients.on_shopping_list = 1`.

Any failure rolls back the meal and the import together. For a recurring meal, only the concrete occurrence being created is imported; future generated occurrences must not pre-create shopping items.

## Duplicate handling and quantity boundary

The direct meal, week, and date-range transfers now create one shopping item per open meal ingredient together with one provenance row in the same transaction. They do not merge against pre-existing items or combine free-text quantities. If later structured aggregation is introduced, it must preserve all source rows rather than overwrite a single `added_from_meal` value.

Quantities remain free text. The existing parser can add numeric prefixes only when the remaining unit text matches exactly (for example `1 kg` plus `0.5 kg`). It cannot safely equate `g` and `kg`, interpret fractions, packages, or recipe prose. Task 2 must preserve the raw quantity and must not invent conversions.

## Future pantry compatibility

Provenance rows provide auditability but are not a pantry ledger. A future pantry module should use explicit inventory items and stock-movement records for purchase, manual adjustment, and cooking consumption. Checked shopping items could create purchase movements, while cooking could create consumption movements linked to the meal/recipe source. Automatic deduction is valid only for structured, compatible quantities; free-text quantities must require confirmation or remain informational.

## Required tests for Task 2

- create without the checkbox: meal is saved and no shopping item/source is created;
- create with the checkbox and explicit list: meal, ingredients, items, flags, and provenance are created;
- omitted target resolves the lowest `sort_order`, while an explicit target wins;
- unknown target list and unknown recipe are rejected before any write;
- forced shopping/provenance failure rolls back the meal, recurrence data, ingredients, items, and flags;
- repeated submission/import cannot link the same meal ingredient twice;
- range imports retain one provenance row per source ingredient, including multiple meals/recipes, without free-text aggregation;
- existing manual meal and week transfer routes use the same provenance behavior;
- free-text and incompatible-unit quantities are preserved without conversion;
- recurring creation imports only the concrete occurrence;
- UI checkbox controls and disables the list selector correctly, defaults to the first ordered list, and sends one create request;
- recipe-to-meal flow uses `yuvomi-datepicker` and remains keyboard/touch accessible;
- migration/schema tests cover foreign keys, indexes, uniqueness, legacy `added_from_meal`, and deletion snapshots.
