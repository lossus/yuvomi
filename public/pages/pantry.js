import { api } from '/api.js';
import { closeModal, confirmModal, openModal } from '/components/modal.js';
import { t } from '/i18n.js';
import { isNavModuleReadOnly } from '/permissions.js';
import { esc } from '/utils/html.js';
import { renderKitchenTabsBar } from '/utils/kitchen-tabs.js';
import { STRUCTURED_UNITS, formatStructuredQuantity, normalizeUnit, parseAmountInput } from '/utils/quantity.js';

const state = {
  items: [],
  locations: [],
  filters: { q: '', category: '', location: '', low_stock: false, expires_before: '' },
  readOnly: false,
};

const locationLabel = (location) => location?.name || t(location?.label_key || 'pantry.locations.other');
const stockLabel = (item) => item.quantity_display || formatStructuredQuantity(item.amount, item.unit) || t('pantry.quantityUnknown');
const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) : '';
const requestKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function toastError(error) {
  window.yuvomi?.showToast(error?.data?.error || error?.message || t('common.errorGeneric'), 'danger');
}

function queryString() {
  const params = new URLSearchParams();
  if (state.filters.q) params.set('q', state.filters.q);
  if (state.filters.category) params.set('category', state.filters.category);
  if (state.filters.location) params.set('location', state.filters.location);
  if (state.filters.low_stock) params.set('low_stock', '1');
  if (state.filters.expires_before) params.set('expires_before', state.filters.expires_before);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function loadItems() {
  const response = await api.get(`/pantry${queryString()}`);
  state.items = response.data || [];
}

function categoryOptions(selected = '') {
  const categories = [...new Set(state.items.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  return categories.map((category) => (
    `<option value="${esc(category)}"${category === selected ? ' selected' : ''}>${esc(category)}</option>`
  )).join('');
}

function locationOptions(selected = '') {
  return state.locations.map((location) => (
    `<option value="${location.id}"${Number(selected) === location.id ? ' selected' : ''}>${esc(locationLabel(location))}</option>`
  )).join('');
}

function card(item) {
  const badges = [];
  if (item.low_stock) badges.push(`<span class="pantry-badge pantry-badge--low">${t('pantry.lowStock')}</span>`);
  if (item.is_expired) badges.push(`<span class="pantry-badge pantry-badge--expired">${t('pantry.expired')}</span>`);
  return `
    <article class="pantry-card" data-item-id="${item.id}">
      <div class="pantry-card__main">
        <div class="pantry-card__heading">
          <h2 class="pantry-card__name">${esc(item.name)}</h2>
          <div class="pantry-card__badges">${badges.join('')}</div>
        </div>
        <p class="pantry-card__stock">${esc(stockLabel(item))}</p>
        <dl class="pantry-card__meta">
          <div><dt>${t('pantry.location')}</dt><dd>${esc(item.location_name || t(item.location_label_key))}</dd></div>
          ${item.category ? `<div><dt>${t('pantry.category')}</dt><dd>${esc(item.category)}</dd></div>` : ''}
          ${item.minimum_amount !== null ? `<div><dt>${t('pantry.minimum')}</dt><dd>${esc(formatStructuredQuantity(item.minimum_amount, item.unit))}</dd></div>` : ''}
          ${item.expiry_date ? `<div><dt>${t('pantry.expiry')}</dt><dd>${esc(dateLabel(item.expiry_date))}</dd></div>` : ''}
        </dl>
      </div>
      <div class="pantry-card__actions">
        <button class="btn btn--secondary" type="button" data-action="history">${t('pantry.history')}</button>
        ${state.readOnly ? '' : `<button class="btn btn--secondary" type="button" data-action="adjust">${t('pantry.adjust')}</button>
        <button class="btn btn--ghost" type="button" data-action="edit" aria-label="${esc(t('pantry.editItem', { name: item.name }))}"><i data-lucide="pencil" aria-hidden="true"></i></button>`}
      </div>
    </article>`;
}

function renderItems(container) {
  const list = container.querySelector('#pantry-list');
  if (!list) return;
  list.replaceChildren();
  if (!state.items.length) {
    list.insertAdjacentHTML('beforeend', `
      <div class="pantry-empty">
        <i data-lucide="box" aria-hidden="true"></i>
        <h2>${t('pantry.emptyTitle')}</h2>
        <p>${t('pantry.emptyText')}</p>
      </div>`);
  } else {
    list.insertAdjacentHTML('beforeend', state.items.map(card).join(''));
  }
  window.lucide?.createIcons({ el: list });
}

async function refresh(container) {
  await loadItems();
  renderItems(container);
}

function readStructured(panel, { allowDelta = false } = {}) {
  const amountInput = panel.querySelector('[data-field="amount"]');
  const unitInput = panel.querySelector('[data-field="unit"]');
  const amountText = amountInput?.value.trim() || '';
  const unit = normalizeUnit(unitInput?.value);
  if (!amountText && !unit) return { amount: null, unit: null };
  const amount = allowDelta
    ? (/^[+-]?\d+(?:[.,]\d+)?$/.test(amountText) ? Number(amountText.replace(',', '.')) : Number.NaN)
    : parseAmountInput(amountText);
  const validNumber = Number.isFinite(amount) && (allowDelta ? amount !== 0 : amount >= 0);
  if (!validNumber || !unit) {
    amountInput?.setAttribute('aria-invalid', 'true');
    unitInput?.setAttribute('aria-invalid', 'true');
    throw new Error(t(allowDelta ? 'pantry.invalidDelta' : 'pantry.invalidAmount'));
  }
  return { amount, unit };
}

function itemForm(item = null) {
  const creating = !item;
  return `
    <form id="pantry-item-form" class="pantry-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="pantry-name">${t('pantry.name')}</label>
        <input class="form-input" id="pantry-name" required maxlength="200" value="${esc(item?.name || '')}">
      </div>
      <div class="pantry-form__grid">
        <div class="form-group">
          <label class="form-label" for="pantry-category">${t('pantry.category')}</label>
          <input class="form-input" id="pantry-category" maxlength="100" value="${esc(item?.category || '')}">
        </div>
        <div class="form-group">
          <label class="form-label" for="pantry-location">${t('pantry.location')}</label>
          <select class="form-input" id="pantry-location" required>${locationOptions(item?.location_id || state.locations[0]?.id)}</select>
        </div>
      </div>
      ${creating ? `
        <fieldset class="pantry-form__fieldset">
          <legend>${t('pantry.initialStock')}</legend>
          <div class="pantry-form__grid pantry-form__grid--quantity">
            <div class="form-group">
              <label class="form-label" for="pantry-amount">${t('pantry.amount')}</label>
              <input class="form-input" id="pantry-amount" data-field="amount" inputmode="decimal">
            </div>
            <div class="form-group">
              <label class="form-label" for="pantry-unit">${t('pantry.unit')}</label>
              <select class="form-input" id="pantry-unit" data-field="unit"><option value="">${t('pantry.noUnit')}</option>${STRUCTURED_UNITS.map((unit) => `<option value="${unit}">${unit}</option>`).join('')}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="pantry-quantity-display">${t('pantry.quantityText')}</label>
            <input class="form-input" id="pantry-quantity-display" maxlength="100" placeholder="${esc(t('pantry.quantityTextHint'))}">
          </div>
        </fieldset>` : ''}
      <div class="pantry-form__grid">
        <div class="form-group">
          <label class="form-label" for="pantry-minimum">${t('pantry.minimum')}</label>
          <input class="form-input" id="pantry-minimum" inputmode="decimal" value="${esc(item?.minimum_amount ?? '')}">
        </div>
        <div class="form-group">
          <label class="form-label" for="pantry-expiry">${t('pantry.expiry')}</label>
          <input class="form-input" id="pantry-expiry" type="date" value="${esc(item?.expiry_date || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="pantry-notes">${t('pantry.notes')}</label>
        <textarea class="form-input" id="pantry-notes" rows="3" maxlength="5000">${esc(item?.notes || '')}</textarea>
      </div>
      <div class="modal-actions">
        ${item ? `<button class="btn btn--danger" type="button" id="pantry-delete">${t('common.delete')}</button>` : ''}
        <button class="btn btn--primary" type="submit">${t('common.save')}</button>
      </div>
    </form>`;
}

function openItemModal(container, item = null) {
  openModal({
    title: t(item ? 'pantry.editTitle' : 'pantry.addTitle'),
    content: itemForm(item),
    onSave: (panel) => {
      const form = panel.querySelector('#pantry-item-form');
      panel.querySelector('#pantry-delete')?.addEventListener('click', async () => {
        const confirmed = await confirmModal(t('pantry.deleteConfirm', { name: item.name }), { danger: true, confirmLabel: t('common.delete') });
        if (!confirmed) return;
        try {
          await api.delete(`/pantry/${item.id}`);
          await closeModal({ force: true });
          await refresh(container);
          window.yuvomi?.showToast(t('pantry.deleteSuccess'), 'success');
        } catch (error) { toastError(error); }
      });
      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = panel.querySelector('#pantry-name').value.trim();
        if (!name) return;
        try {
          const minimumText = panel.querySelector('#pantry-minimum').value.trim();
          const minimum = minimumText ? parseAmountInput(minimumText) : null;
          if (minimumText && (!Number.isFinite(minimum) || minimum < 0)) throw new Error(t('pantry.invalidMinimum'));
          const payload = {
            name,
            category: panel.querySelector('#pantry-category').value.trim() || null,
            location_id: Number(panel.querySelector('#pantry-location').value),
            minimum_amount: minimum,
            expiry_date: panel.querySelector('#pantry-expiry').value || null,
            notes: panel.querySelector('#pantry-notes').value.trim() || null,
          };
          if (!item) {
            const stock = readStructured(panel);
            payload.amount = stock.amount;
            payload.unit = stock.unit;
            payload.quantity_display = panel.querySelector('#pantry-quantity-display').value.trim() || null;
          }
          await (item ? api.patch(`/pantry/${item.id}`, payload) : api.post('/pantry', payload));
          await closeModal({ force: true });
          await refresh(container);
          window.yuvomi?.showToast(t(item ? 'pantry.updateSuccess' : 'pantry.createSuccess'), 'success');
        } catch (error) { toastError(error); }
      });
    },
  });
}

function adjustForm(item) {
  return `
    <form id="pantry-adjust-form" class="pantry-form" novalidate>
      <p class="pantry-adjust-current">${t('pantry.currentStock')}: <strong>${esc(stockLabel(item))}</strong></p>
      <fieldset class="pantry-adjust-modes">
        <legend>${t('pantry.adjustMode')}</legend>
        <label><input type="radio" name="mode" value="delta"${item.unit ? ' checked' : ' disabled'}> ${t('pantry.modeDelta')}</label>
        <label><input type="radio" name="mode" value="absolute"${item.unit ? '' : ' checked'}> ${t('pantry.modeAbsolute')}</label>
        <label><input type="radio" name="mode" value="text"> ${t('pantry.modeText')}</label>
      </fieldset>
      <div class="pantry-adjust-fields" data-mode-panel="delta"${item.unit ? '' : ' hidden'}>
        <div class="pantry-form__grid pantry-form__grid--quantity">
          <div class="form-group"><label class="form-label" for="pantry-adjust-delta">${t('pantry.delta')}</label><input class="form-input" id="pantry-adjust-delta" data-field="amount" inputmode="decimal"></div>
          <div class="form-group"><label class="form-label" for="pantry-adjust-unit">${t('pantry.unit')}</label><select class="form-input" id="pantry-adjust-unit" data-field="unit">${STRUCTURED_UNITS.map((unit) => `<option value="${unit}"${unit === item.unit ? ' selected' : ''}>${unit}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="pantry-adjust-fields" data-mode-panel="absolute"${item.unit ? ' hidden' : ''}>
        <div class="pantry-form__grid pantry-form__grid--quantity">
          <div class="form-group"><label class="form-label" for="pantry-adjust-amount">${t('pantry.amount')}</label><input class="form-input" id="pantry-adjust-amount" data-field="amount" inputmode="decimal" value="${esc(item.amount ?? '')}"></div>
          <div class="form-group"><label class="form-label" for="pantry-adjust-absolute-unit">${t('pantry.unit')}</label><select class="form-input" id="pantry-adjust-absolute-unit" data-field="unit">${STRUCTURED_UNITS.map((unit) => `<option value="${unit}"${unit === item.unit ? ' selected' : ''}>${unit}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="pantry-adjust-fields" data-mode-panel="text" hidden>
        <div class="form-group"><label class="form-label" for="pantry-adjust-text">${t('pantry.quantityText')}</label><input class="form-input" id="pantry-adjust-text" value="${esc(item.quantity_display || '')}" maxlength="100"></div>
      </div>
      <div class="form-group"><label class="form-label" for="pantry-adjust-reason">${t('pantry.reason')}</label><textarea class="form-input" id="pantry-adjust-reason" rows="2" maxlength="5000"></textarea></div>
      <div class="modal-actions"><button class="btn btn--primary" type="submit">${t('pantry.adjust')}</button></div>
    </form>`;
}

function openAdjustModal(container, item) {
  openModal({
    title: t('pantry.adjustTitle', { name: item.name }),
    content: adjustForm(item),
    onSave: (panel) => {
      const form = panel.querySelector('#pantry-adjust-form');
      const syncMode = () => {
        const mode = panel.querySelector('input[name="mode"]:checked')?.value;
        panel.querySelectorAll('[data-mode-panel]').forEach((section) => { section.hidden = section.dataset.modePanel !== mode; });
      };
      panel.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener('change', syncMode));
      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const mode = panel.querySelector('input[name="mode"]:checked')?.value;
        const payload = { idempotency_key: requestKey(), reason: panel.querySelector('#pantry-adjust-reason').value.trim() || null };
        try {
          if (mode === 'delta') {
            const section = panel.querySelector('[data-mode-panel="delta"]');
            const stock = readStructured(section, { allowDelta: true });
            payload.delta_amount = stock.amount;
            payload.unit = stock.unit;
          } else if (mode === 'absolute') {
            const section = panel.querySelector('[data-mode-panel="absolute"]');
            const stock = readStructured(section);
            payload.amount = stock.amount;
            payload.unit = stock.unit;
          } else {
            payload.quantity_display = panel.querySelector('#pantry-adjust-text').value.trim();
            if (!payload.quantity_display) throw new Error(t('pantry.quantityTextRequired'));
          }
          await api.post(`/pantry/${item.id}/adjust`, payload);
          await closeModal({ force: true });
          await refresh(container);
          window.yuvomi?.showToast(t('pantry.adjustSuccess'), 'success');
        } catch (error) { toastError(error); }
      });
    },
  });
}

function movementLabel(movement) {
  const key = `pantry.movement.${movement.movement_type}`;
  if (movement.amount_delta !== null) {
    const prefix = movement.amount_delta > 0 ? '+' : '';
    return `${t(key)} · ${prefix}${movement.amount_delta} ${movement.unit}`;
  }
  return `${t(key)} · ${movement.quantity_display_after || t('pantry.quantityUnknown')}`;
}

async function openHistoryModal(container, item) {
  try {
    const response = await api.get(`/pantry/${item.id}`);
    const movements = response.data.movements || [];
    const reversed = new Set(movements.map((movement) => movement.reverses_movement_id).filter(Boolean));
    openModal({
      title: t('pantry.historyTitle', { name: item.name }),
      size: 'lg',
      content: `<div class="pantry-history">${movements.map((movement) => `
        <article class="pantry-history__entry">
          <div><strong>${esc(movementLabel(movement))}</strong><time datetime="${esc(movement.created_at)}">${esc(new Date(movement.created_at).toLocaleString())}</time>${movement.reason ? `<p>${esc(movement.reason)}</p>` : ''}</div>
          ${state.readOnly || reversed.has(movement.id) ? '' : `<button class="btn btn--ghost" type="button" data-reverse="${movement.id}">${t('pantry.reverse')}</button>`}
        </article>`).join('')}</div>`,
      onSave: (panel) => {
        panel.querySelectorAll('[data-reverse]').forEach((button) => button.addEventListener('click', async () => {
          try {
            await api.post(`/pantry/${item.id}/adjust`, { idempotency_key: requestKey(), reverses_movement_id: Number(button.dataset.reverse), reason: t('pantry.reversalReason') });
            await closeModal({ force: true });
            await refresh(container);
            window.yuvomi?.showToast(t('pantry.reverseSuccess'), 'success');
          } catch (error) { toastError(error); }
        }));
      },
    });
  } catch (error) { toastError(error); }
}

function bind(container) {
  const filters = container.querySelector('#pantry-filters');
  let timer = null;
  const applyFilters = async () => {
    state.filters = {
      q: filters.querySelector('#pantry-search').value.trim(),
      category: filters.querySelector('#pantry-filter-category').value,
      location: filters.querySelector('#pantry-filter-location').value,
      low_stock: filters.querySelector('#pantry-filter-low').checked,
      expires_before: filters.querySelector('#pantry-filter-expiry').value,
    };
    try { await refresh(container); } catch (error) { toastError(error); }
  };
  filters?.addEventListener('submit', (event) => { event.preventDefault(); applyFilters(); });
  filters?.addEventListener('change', applyFilters);
  filters?.querySelector('#pantry-search')?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(applyFilters, 250);
  });
  container.querySelector('#pantry-add')?.addEventListener('click', () => openItemModal(container));
  container.querySelector('#pantry-list')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    const itemId = Number(event.target.closest('[data-item-id]')?.dataset.itemId);
    const item = state.items.find((entry) => entry.id === itemId);
    if (!action || !item) return;
    if (action.dataset.action === 'edit') openItemModal(container, item);
    if (action.dataset.action === 'adjust') openAdjustModal(container, item);
    if (action.dataset.action === 'history') openHistoryModal(container, item);
  });
}

export async function render(container) {
  state.readOnly = isNavModuleReadOnly('pantry');
  try {
    const locations = await api.get('/pantry/locations');
    state.locations = locations.data || [];
    await loadItems();
  } catch (error) {
    toastError(error);
  }

  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', `
    <main class="pantry-page page">
      <header class="pantry-header">
        <div><h1 class="page__title">${t('pantry.title')}</h1><p>${t('pantry.subtitle')}</p></div>
        ${state.readOnly ? '' : `<button class="btn btn--primary" type="button" id="pantry-add"><i data-lucide="plus" aria-hidden="true"></i>${t('pantry.add')}</button>`}
      </header>
      <form class="pantry-filters" id="pantry-filters" role="search">
        <label class="pantry-search"><span class="sr-only">${t('pantry.search')}</span><i data-lucide="search" aria-hidden="true"></i><input class="form-input" id="pantry-search" type="search" placeholder="${esc(t('pantry.searchPlaceholder'))}"></label>
        <select class="form-input" id="pantry-filter-category" aria-label="${esc(t('pantry.category'))}"><option value="">${t('pantry.allCategories')}</option>${categoryOptions()}</select>
        <select class="form-input" id="pantry-filter-location" aria-label="${esc(t('pantry.location'))}"><option value="">${t('pantry.allLocations')}</option>${locationOptions()}</select>
        <label class="pantry-filter-check"><input type="checkbox" id="pantry-filter-low">${t('pantry.lowStockOnly')}</label>
        <label class="pantry-filter-date"><span>${t('pantry.expiresBefore')}</span><input class="form-input" type="date" id="pantry-filter-expiry"></label>
      </form>
      <section class="pantry-list" id="pantry-list" aria-live="polite"></section>
    </main>`);
  renderKitchenTabsBar(container, '/pantry');
  renderItems(container);
  bind(container);
  window.lucide?.createIcons({ el: container });
}
