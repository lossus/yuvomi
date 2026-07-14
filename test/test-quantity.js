import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_STRUCTURED_AMOUNT,
  convertStructuredAmount,
  parseAmountInput,
  validateStructuredQuantity,
} from '../public/utils/quantity.js';
import { shoppingItemsFromMealIngredients } from '../server/services/shopping-import.js';

test('structured quantities validate empty, decimal, boundary, and invalid values', () => {
  assert.deepEqual(validateStructuredQuantity(null, null).value, { amount: null, unit: null });
  assert.deepEqual(validateStructuredQuantity(1.5, 'KG').value, { amount: 1.5, unit: 'kg' });
  for (const [amount, unit] of [[1, null], [null, 'g'], [0, 'g'], [-1, 'g'], [Number.NaN, 'g'], [Infinity, 'g'], [MAX_STRUCTURED_AMOUNT + 1, 'g'], [1, 'can']]) {
    assert.ok(validateStructuredQuantity(amount, unit).error, `${String(amount)} ${String(unit)} must be rejected`);
  }
});

test('mass and volume conversions are deterministic and dimension-safe', () => {
  assert.equal(convertStructuredAmount(1000, 'g', 'kg'), 1);
  assert.equal(convertStructuredAmount(1, 'kg', 'g'), 1000);
  assert.equal(convertStructuredAmount(1000, 'ml', 'l'), 1);
  assert.equal(convertStructuredAmount(1, 'l', 'ml'), 1000);
  assert.equal(convertStructuredAmount(1, 'kg', 'l'), null);
  assert.equal(parseAmountInput('1,25'), 1.25);
  assert.ok(Number.isNaN(parseAmountInput('1e3')));
});

test('structured imports aggregate compatible dimensions and preserve every source', () => {
  const rows = [
    { id: 1, meal_id: 10, name: 'Flour', quantity: null, amount: 1000, unit: 'g', category: 'Baking', source_label: 'Bread', meal_date_snapshot: '2026-07-14' },
    { id: 2, meal_id: 11, name: 'flour', quantity: '1 kg', amount: 1, unit: 'kg', category: 'Baking', source_label: 'Cake', meal_date_snapshot: '2026-07-15' },
  ];
  const [item] = shoppingItemsFromMealIngredients(rows);
  assert.equal(item.amount, 2);
  assert.equal(item.unit, 'kg');
  assert.equal(item.quantity, '2 kg');
  assert.equal(item.added_from_meal, null);
  assert.deepEqual(item.ingredientIds, [1, 2]);
  assert.equal(item.sources.length, 2);
  assert.deepEqual(item.sources.map((source) => source.quantity_snapshot), ['1000 g', '1 kg']);
});

test('legacy text and incompatible structured units remain separate without guessing', () => {
  const rows = [
    { id: 1, meal_id: 10, name: 'Tomato', quantity: '2 cans', category: 'Other', source_label: 'Soup' },
    { id: 2, meal_id: 10, name: 'Tomato', quantity: 'some', category: 'Other', source_label: 'Soup' },
    { id: 3, meal_id: 10, name: 'Tomato', quantity: '1 can', amount: 1, unit: 'can', category: 'Other', source_label: 'Soup' },
  ];
  const items = shoppingItemsFromMealIngredients(rows);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((item) => item.quantity), ['2 cans', 'some', '1 can']);
  assert.ok(items.every((item) => item.amount === null && item.unit === null && item.sources.length === 1));
});
