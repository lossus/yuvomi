const MAX_STRUCTURED_AMOUNT = 1_000_000_000;

const UNIT_DEFINITIONS = Object.freeze({
  g: Object.freeze({ dimension: 'mass', factor: 1 }),
  kg: Object.freeze({ dimension: 'mass', factor: 1000 }),
  ml: Object.freeze({ dimension: 'volume', factor: 1 }),
  l: Object.freeze({ dimension: 'volume', factor: 1000 }),
});

const STRUCTURED_UNITS = Object.freeze(Object.keys(UNIT_DEFINITIONS));

function normalizeUnit(value) {
  if (value === undefined || value === null || value === '') return null;
  const unit = String(value).trim().toLowerCase();
  return Object.hasOwn(UNIT_DEFINITIONS, unit) ? unit : null;
}

function validateStructuredQuantity(amount, unit) {
  const amountMissing = amount === undefined || amount === null || amount === '';
  const unitMissing = unit === undefined || unit === null || String(unit).trim() === '';

  if (amountMissing && unitMissing) {
    return { value: { amount: null, unit: null }, error: null };
  }
  if (amountMissing || unitMissing) {
    return { value: null, error: 'Menge und Einheit müssen gemeinsam angegeben werden.' };
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { value: null, error: 'Strukturierte Menge muss eine endliche Zahl sein.' };
  }
  if (amount <= 0 || amount > MAX_STRUCTURED_AMOUNT) {
    return { value: null, error: `Strukturierte Menge muss größer als 0 und höchstens ${MAX_STRUCTURED_AMOUNT} sein.` };
  }

  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) {
    return { value: null, error: `Einheit muss eine von ${STRUCTURED_UNITS.join(', ')} sein.` };
  }
  return { value: { amount, unit: normalizedUnit }, error: null };
}

function parseAmountInput(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return Number.NaN;
  return Number(text.replace(',', '.'));
}

function structuredQuantityFromInput(amountValue, unitValue) {
  const amountText = String(amountValue ?? '').trim();
  const unitText = String(unitValue ?? '').trim();
  if (!amountText && !unitText) return { value: { amount: null, unit: null }, error: null };
  const amount = parseAmountInput(amountText);
  if (!Number.isFinite(amount)) {
    return { value: null, error: 'invalid_amount' };
  }
  const validated = validateStructuredQuantity(amount, unitText);
  return validated.error
    ? { value: null, error: 'invalid_structured_quantity' }
    : validated;
}

function unitDimension(unit) {
  return UNIT_DEFINITIONS[normalizeUnit(unit)]?.dimension ?? null;
}

function toBaseAmount(amount, unit) {
  const validated = validateStructuredQuantity(amount, unit);
  if (validated.error) return null;
  const definition = UNIT_DEFINITIONS[validated.value.unit];
  return Math.round(validated.value.amount * definition.factor * 1e9) / 1e9;
}

function convertStructuredAmount(amount, fromUnit, toUnit) {
  const base = toBaseAmount(amount, fromUnit);
  const target = UNIT_DEFINITIONS[normalizeUnit(toUnit)];
  if (base === null || !target || target.dimension !== unitDimension(fromUnit)) return null;
  return Math.round((base / target.factor) * 1e9) / 1e9;
}

function displayQuantityFromBase(baseAmount, dimension) {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return null;
  const largeUnit = dimension === 'mass' ? 'kg' : dimension === 'volume' ? 'l' : null;
  const baseUnit = dimension === 'mass' ? 'g' : dimension === 'volume' ? 'ml' : null;
  if (!largeUnit || !baseUnit) return null;
  const unit = baseAmount >= 1000 ? largeUnit : baseUnit;
  const amount = unit === baseUnit ? baseAmount : baseAmount / 1000;
  return { amount: Math.round(amount * 1e9) / 1e9, unit };
}

function formatStructuredQuantity(amount, unit) {
  if (!Number.isFinite(amount) || !normalizeUnit(unit)) return '';
  const rounded = Math.round(amount * 1000) / 1000;
  return `${rounded} ${normalizeUnit(unit)}`;
}

export {
  MAX_STRUCTURED_AMOUNT,
  STRUCTURED_UNITS,
  convertStructuredAmount,
  displayQuantityFromBase,
  formatStructuredQuantity,
  normalizeUnit,
  parseAmountInput,
  structuredQuantityFromInput,
  toBaseAmount,
  unitDimension,
  validateStructuredQuantity,
};
