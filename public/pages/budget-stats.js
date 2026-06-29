/**
 * Modul: Budget-Statistik-View
 * Zweck: Statistik-Tab (Zeitraum-Filter, Summary-Cards, Trendlinie, Donut, CSV-Export).
 */
import { api } from '/api.js';
import { t } from '/i18n.js';
import { toLocalDateKey } from '/utils/date.js';

const view = { range: 'month', anchor: toLocalDateKey(new Date()), data: null, ctx: null, root: null };

export async function renderStats(panel, ctx) {
  view.ctx = ctx;
  view.root = panel;
  renderShell();
  await loadStats();
}

function fmtAmount(v) { return view.ctx.formatAmount(v); }

async function loadStats() {
  const body = view.root.querySelector('#budget-stats-body');
  try {
    const res = await api.get(`/budget/stats?range=${view.range}&anchor=${view.anchor}`);
    view.data = res.data;
  } catch (err) {
    console.error('[Budget] stats load error:', err);
    view.data = null;
  }
  renderBodyContent(body);
}

function renderShell() {
  view.root.replaceChildren();
  view.root.insertAdjacentHTML('beforeend', `
    <div class="budget-stats">
      <div class="budget-stats__controls">
        <div class="budget-stats__ranges" role="tablist">
          ${['week', 'month', 'year'].map((r) => `
            <button type="button" class="budget-stats__range${r === view.range ? ' is-active' : ''}"
              data-range="${r}">${t('budget.statsRange' + r[0].toUpperCase() + r.slice(1))}</button>`).join('')}
        </div>
        <div class="budget-stats__stepper">
          <button class="btn btn--icon" data-step="-1" aria-label="prev"><i data-lucide="chevron-left"></i></button>
          <span class="budget-stats__period" id="budget-stats-period"></span>
          <button class="btn btn--icon" data-step="1" aria-label="next"><i data-lucide="chevron-right"></i></button>
        </div>
      </div>
      <div id="budget-stats-body"></div>
    </div>
  `);
  if (window.lucide) lucide.createIcons({ el: view.root });
  wire();
}

function wire() {
  view.root.querySelectorAll('.budget-stats__range').forEach((b) =>
    b.addEventListener('click', () => { view.range = b.dataset.range; renderShell(); loadStats(); }));
  view.root.querySelectorAll('[data-step]').forEach((b) =>
    b.addEventListener('click', () => { stepAnchor(Number(b.dataset.step)); renderShell(); loadStats(); }));
}

function stepAnchor(dir) {
  const d = new Date(`${view.anchor}T00:00:00Z`);
  if (view.range === 'week') d.setUTCDate(d.getUTCDate() + 7 * dir);
  else if (view.range === 'month') d.setUTCMonth(d.getUTCMonth() + dir);
  else d.setUTCFullYear(d.getUTCFullYear() + dir);
  view.anchor = d.toISOString().slice(0, 10);
}

function renderBodyContent(body) {
  const d = view.data;
  if (!d || (d.totals.income === 0 && d.totals.expenses === 0 && !d.series.some((s) => s.income || s.expenses))) {
    body.replaceChildren();
    body.insertAdjacentHTML('beforeend', `
      <div class="empty-state">
        <div class="empty-state__title">${t('budget.statsEmptyTitle')}</div>
        <div class="empty-state__description">${t('budget.statsEmptyDescription')}</div>
      </div>`);
    return;
  }
  body.replaceChildren();
  body.insertAdjacentHTML('beforeend', `
    <div class="budget-summary">
      <div class="budget-summary-card budget-summary-card--income">
        <div class="budget-summary-card__label">${t('budget.statsIncome')}</div>
        <div class="budget-summary-card__amount">${fmtAmount(d.totals.income)}</div>
      </div>
      <div class="budget-summary-card budget-summary-card--expenses">
        <div class="budget-summary-card__label">${t('budget.statsExpenses')}</div>
        <div class="budget-summary-card__amount">${fmtAmount(Math.abs(d.totals.expenses))}</div>
      </div>
      <div class="budget-summary-card ${d.totals.balance >= 0 ? 'budget-summary-card--balance-positive' : 'budget-summary-card--balance-negative'}">
        <div class="budget-summary-card__label">${t('budget.statsBalance')}</div>
        <div class="budget-summary-card__amount">${fmtAmount(d.totals.balance)}</div>
      </div>
    </div>
    <div id="budget-stats-trend"></div>
    <div id="budget-stats-cat"></div>
    <div id="budget-stats-donut"></div>
    <div class="budget-stats__export"></div>
  `);
  updatePeriodLabel();
  renderTrendChart();
}

function renderTrendChart() {
  const host = view.root.querySelector('#budget-stats-trend');
  if (!host) return;
  const s = view.data.series;
  const W = 600, H = 180, PAD = 8;
  const incomes  = s.map((p) => p.income);
  const expenses = s.map((p) => Math.abs(p.expenses));
  const max = Math.max(1, ...incomes, ...expenses);
  const x = (i) => PAD + (s.length <= 1 ? 0 : (i * (W - 2 * PAD)) / (s.length - 1));
  const y = (v) => H - PAD - (v / max) * (H - 2 * PAD);
  const points = (arr) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  host.replaceChildren();
  host.insertAdjacentHTML('beforeend', `
    <div class="budget-chart-section">
      <div class="budget-chart-section__title">${t('budget.statsTrendTitle')}</div>
      <svg class="budget-stats__trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
           role="img" aria-label="${t('budget.statsTrendTitle')}">
        <polyline fill="none" stroke="var(--color-success)" stroke-width="2"
                  vector-effect="non-scaling-stroke" points="${points(incomes)}" />
        <polyline fill="none" stroke="var(--color-danger)" stroke-width="2"
                  vector-effect="non-scaling-stroke" points="${points(expenses)}" />
      </svg>
      <div class="budget-stats__legend">
        <span><i class="budget-stats__swatch budget-stats__swatch--income"></i>${t('budget.statsIncome')}</span>
        <span><i class="budget-stats__swatch budget-stats__swatch--expense"></i>${t('budget.statsExpenses')}</span>
      </div>
    </div>`);
}

function updatePeriodLabel() {
  const el = view.root.querySelector('#budget-stats-period');
  if (el && view.data) el.textContent = `${view.data.from} – ${view.data.to}`;
}
