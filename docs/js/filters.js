/**
 * Filter panel UI rendering and filter application logic.
 */

import { appState, emit } from './appState.js';
import { applyFilters, computeAggregates, freqCount } from './dataProcessor.js';
import { updateSampleCounter } from './kpiCards.js';

// Unique sorted values for each categorical filter
let _allRows = [];

export function initFilters(allRows) {
  _allRows = allRows;
  renderFilterPanel(allRows);
  wireResetButton();
  wireMobileToggle();
}

function renderFilterPanel(rows) {
  const body = document.getElementById('filter-panel-body');
  if (!body) return;

  body.innerHTML = `
    ${checkboxGroup('workLocation', 'Work Mode',
      ['Remote','Hybrid','Onsite'],
      'Work_Location',
      { Remote: '#9f7aea', Hybrid: '#58a6ff', Onsite: '#38b2ac' }
    )}
    ${checkboxGroup('stressLevel', 'Stress Level',
      ['Low','Medium','High'],
      'Stress_Level',
      { Low: '#38b2ac', Medium: '#f6ad55', High: '#fc8181' }
    )}
    ${checkboxGroup('region', 'Region',
      [...new Set(rows.map(r => r.Region))].sort(),
      'Region'
    )}
    ${checkboxGroup('gender', 'Gender',
      [...new Set(rows.map(r => r.Gender))].sort(),
      'Gender'
    )}
    ${selectGroup('industry', 'Industry',
      [...new Set(rows.map(r => r.Industry))].sort()
    )}
    ${selectGroup('jobRole', 'Job Role',
      [...new Set(rows.map(r => r.Job_Role))].sort()
    )}
    ${checkboxGroup('ageGroup', 'Age Group',
      ['20s','30s','40s','50+'],
      'Age_Group'
    )}
    ${hoursSlider(rows)}
  `;

  wireCheckboxes(rows);
  wireSelects();
  wireHoursSlider();
}

// ─── Filter group builders ────────────────────────────────────────────────

function checkboxGroup(filterKey, label, values, fieldName, swatchColors) {
  // compute counts per value from the fieldName string
  const valCounts = {};
  _allRows.forEach(r => { const v = r[fieldName]; valCounts[v] = (valCounts[v]||0)+1; });

  const items = values.map(v => {
    const swatch = swatchColors
      ? `<span class="filter-swatch" style="background:${swatchColors[v]||'#888'}" aria-hidden="true"></span>`
      : '';
    return `
      <label class="filter-checkbox">
        <input type="checkbox" data-filter="${filterKey}" data-value="${v}" />
        ${swatch}
        <span>${v}</span>
        <span class="filter-checkbox__count" aria-label="${valCounts[v]||0} employees">${(valCounts[v]||0).toLocaleString()}</span>
      </label>`;
  }).join('');

  return `
    <div class="filter-group" data-group="${filterKey}">
      <span class="filter-group__label" id="filter-label-${filterKey}">${label}</span>
      <div class="filter-group__options" role="group" aria-labelledby="filter-label-${filterKey}">
        ${items}
      </div>
    </div>`;
}

function selectGroup(filterKey, label, values) {
  const opts = values.map(v => `<option value="${v}">${v}</option>`).join('');
  return `
    <div class="filter-group" data-group="${filterKey}">
      <label class="filter-group__label" for="filter-select-${filterKey}">${label}</label>
      <select id="filter-select-${filterKey}" class="filter-select"
              data-filter="${filterKey}"
              aria-label="Filter by ${label}">
        <option value="">All ${label}s</option>
        ${opts}
      </select>
    </div>`;
}

function hoursSlider(rows) {
  const hours = rows.map(r => r.Hours_Worked_Per_Week);
  const minH = Math.min(...hours);
  const maxH = Math.max(...hours);
  return `
    <div class="filter-group" data-group="hoursRange">
      <span class="filter-group__label" id="filter-label-hours">Hours / Week</span>
      <div class="slider-container" role="group" aria-labelledby="filter-label-hours">
        <div class="slider-value-display" id="hours-display">${minH}–${maxH} hrs</div>
        <input type="range" class="range-slider" id="hours-min"
               min="${minH}" max="${maxH}" value="${minH}"
               aria-label="Minimum hours per week" />
        <input type="range" class="range-slider" id="hours-max"
               min="${minH}" max="${maxH}" value="${maxH}"
               aria-label="Maximum hours per week" />
        <div class="slider-labels">
          <span>${minH}</span><span>${maxH}</span>
        </div>
      </div>
    </div>`;
}

// ─── Event wiring ─────────────────────────────────────────────────────────

function wireCheckboxes(rows) {
  const body = document.getElementById('filter-panel-body');
  if (!body) return;

  body.querySelectorAll('input[type="checkbox"][data-filter]').forEach(cb => {
    cb.addEventListener('change', () => {
      const key   = cb.dataset.filter;   // e.g. 'workLocation'
      const value = cb.dataset.value;

      if (cb.checked) appState.filters[key].add(value);
      else            appState.filters[key].delete(value);

      markGroupActive(key);
      triggerFilterUpdate();
    });
  });
}

function wireSelects() {
  const body = document.getElementById('filter-panel-body');
  if (!body) return;

  body.querySelectorAll('select[data-filter]').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.filter;
      appState.filters[key] = sel.value ? new Set([sel.value]) : new Set();
      markGroupActive(key);
      triggerFilterUpdate();
    });
  });
}

function wireHoursSlider() {
  const minSlider = document.getElementById('hours-min');
  const maxSlider = document.getElementById('hours-max');
  const display   = document.getElementById('hours-display');
  if (!minSlider || !maxSlider) return;

  const dataMin = +minSlider.min;
  const dataMax = +maxSlider.max;

  const update = () => {
    let lo = +minSlider.value;
    let hi = +maxSlider.value;
    if (lo > hi) { [lo, hi] = [hi, lo]; }
    // Use [0, 100] sentinel when at full range (all-pass)
    appState.filters.hoursRange = (lo === dataMin && hi === dataMax) ? [0, 100] : [lo, hi];
    if (display) display.textContent = `${lo}–${hi} hrs`;
    markGroupActive('hoursRange');
    triggerFilterUpdate();
  };

  minSlider.addEventListener('input', update);
  maxSlider.addEventListener('input', update);
}

function wireResetButton() {
  const btn = document.getElementById('btn-reset-filters');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // Reset state
    Object.keys(appState.filters).forEach(k => {
      if (appState.filters[k] instanceof Set) {
        appState.filters[k] = new Set();
      }
    });
    const minS2 = document.getElementById('hours-min');
    const maxS2 = document.getElementById('hours-max');
    appState.filters.hoursRange = [
      minS2 ? +minS2.min : 0,
      maxS2 ? +maxS2.max : 100
    ];

    // Reset UI
    const body = document.getElementById('filter-panel-body');
    if (body) {
      body.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      body.querySelectorAll('select').forEach(sel => sel.selectedIndex = 0);
      const minS = document.getElementById('hours-min');
      const maxS = document.getElementById('hours-max');
      if (minS) minS.value = minS.min;
      if (maxS) maxS.value = maxS.max;
      const disp = document.getElementById('hours-display');
      if (disp && minS && maxS) disp.textContent = `${minS.min}–${maxS.max} hrs`;
    }

    // Remove active indicators
    document.querySelectorAll('.filter-group__label.has-active')
      .forEach(el => el.classList.remove('has-active'));

    triggerFilterUpdate();
  });
}

function wireMobileToggle() {
  const toggle  = document.getElementById('filter-toggle');
  const panel   = document.getElementById('filter-panel');
  if (!toggle || !panel) return;

  // Create overlay element
  let overlay = document.querySelector('.filter-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'filter-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
    overlay.classList.toggle('is-visible', open);
  });

  overlay.addEventListener('click', () => {
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    overlay.classList.remove('is-visible');
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('is-visible');
      toggle.focus();
    }
  });
}

function markGroupActive(filterKey) {
  const group = document.querySelector(`.filter-group[data-group="${filterKey}"] .filter-group__label`);
  if (!group) return;

  const f = appState.filters[filterKey];
  const isActive = f instanceof Set ? f.size > 0 : (f[0] !== 0 || f[1] !== 100);
  group.classList.toggle('has-active', isActive);
}

// ─── Filter dispatch ──────────────────────────────────────────────────────

export function triggerFilterUpdate() {
  const filtered = applyFilters(_allRows, appState.filters);
  appState.data.filteredRows = filtered;
  appState.data.aggregates   = computeAggregates(filtered, appState.reconfigure);

  const warn = filtered.length < 30;
  updateSampleCounter(filtered.length, warn);

  emit('filters:changed', {
    filteredRows: filtered,
    aggregates:   appState.data.aggregates
  });
}
