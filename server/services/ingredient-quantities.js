import { validateStructuredQuantity } from '../../public/utils/quantity.js';

function sanitizeKitchenIngredients(value, { maxTitle, maxShort }) {
  if (!Array.isArray(value)) {
    return { value: null, error: 'ingredients muss ein Array sein.' };
  }

  const ingredients = [];
  for (let index = 0; index < value.length; index++) {
    const ingredient = value[index] ?? {};
    const structured = validateStructuredQuantity(ingredient.amount, ingredient.unit);
    if (structured.error) {
      return { value: null, error: `Zutat ${index + 1}: ${structured.error}` };
    }
    const name = String(ingredient.name || '').trim().slice(0, maxTitle);
    if (!name) continue;
    ingredients.push({
      name,
      quantity: String(ingredient.quantity || '').trim().slice(0, maxShort) || null,
      amount: structured.value.amount,
      unit: structured.value.unit,
      category: String(ingredient.category || '').trim().slice(0, maxShort) || 'Sonstiges',
    });
  }
  return { value: ingredients, error: null };
}

export { sanitizeKitchenIngredients };
