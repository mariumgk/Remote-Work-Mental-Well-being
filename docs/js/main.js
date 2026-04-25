/**
 * App entry point.
 * Loads CSV → processes data → runs EDA → initializes all modules.
 */

import { appState, emit, on } from './appState.js';
import { processData, runEDA, computeAggregates, applyFilters } from './dataProcessor.js';
import { renderHeroCards, renderKpiGrid, renderStoryStats, renderConclusionCards, updateSampleCounter } from './kpiCards.js';
import { initFilters } from './filters.js';
import { initBarChart }      from './charts/barChart.js';
import { initHeatmap }       from './charts/heatmap.js';
import { initScatterPlot }   from './charts/scatterPlot.js';
import { initDetailPanel }   from './charts/detailPanel.js';
import { initRegionalChart } from './charts/regionalChart.js';
import { initSankey }        from './charts/sankey.js';

// ─── Loading overlay ──────────────────────────────────────────────────────

function showLoader() {
  const el = document.createElement('div');
  el.className = 'loading-overlay';
  el.id = 'loading-overlay';
  el.innerHTML = `
    <div class="loading-spinner" aria-hidden="true"></div>
    <p class="loading-text">Loading dataset…</p>`;
  document.body.appendChild(el);
}

function hideLoader() {
  const el = document.getElementById('loading-overlay');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 400);
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'error-overlay';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="error-title">Unable to load data</div>
    <p class="error-body">${msg}</p>
    <p class="error-body">
      If you are viewing this locally, open a static server:<br>
      <code class="error-code">npx serve docs</code>
    </p>`;
  document.body.appendChild(el);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────

showLoader();

Papa.parse('data/remote_work_mental_health.csv', {
  header:        true,
  download:      true,    // required: tells PapaParse to fetch the URL, not parse the string
  dynamicTyping: false,   // keep as strings, we cast manually in processData
  skipEmptyLines: true,
  complete: ({ data: rawRows, errors }) => {
    if (errors.length) {
      console.warn('[CSV parse warnings]', errors.slice(0, 5));
    }

    if (!rawRows?.length) {
      hideLoader();
      showError('CSV file parsed but no rows were found. Check the file path.');
      return;
    }

    try {
      initApp(rawRows);
    } catch (err) {
      console.error('[initApp error]', err);
      hideLoader();
      showError(`App initialization failed: ${err.message}`);
    }
  },
  error: (err) => {
    hideLoader();
    showError(`Could not fetch the CSV file: ${err.message || err}. Make sure you are running on a local server or GitHub Pages.`);
  }
});

// ─── App initialization ───────────────────────────────────────────────────

function initApp(rawRows) {
  // 1. Process and derive all fields
  const processedRows = processData(rawRows);

  // 2. Run EDA audit (console only)
  runEDA(processedRows);

  // 3. Store in state
  appState.data.allRows      = processedRows;
  appState.data.filteredRows = processedRows;
  appState.data.aggregates   = computeAggregates(processedRows, appState.reconfigure);

  // 4. KPI cards and overview
  const { kpi, storyStats } = appState.data.aggregates;
  renderHeroCards(kpi, document.getElementById('hero-cards'));
  renderKpiGrid(kpi, document.getElementById('kpi-grid'));
  renderStoryStats(storyStats, kpi);
  renderConclusionCards(kpi, storyStats, document.getElementById('conclusion-grid'));
  updateSampleCounter(processedRows.length);

  // 5. Update footer missing counts
  const missingMHCEl = document.getElementById('footer-missing-count');
  const missingPAEl  = document.getElementById('footer-pa-missing');
  if (missingMHCEl) missingMHCEl.textContent = (kpi.missingMHC || 0).toLocaleString();
  if (missingPAEl) {
    const paMissing = processedRows.filter(r => r.Physical_Activity_Clean === 'Not Reported').length;
    missingPAEl.textContent = paMissing.toLocaleString();
  }

  // 6. Init filter panel (wires controls + subscribes to state changes)
  initFilters(processedRows);

  // 7. Init all charts
  initDetailPanel();
  initBarChart();
  initHeatmap();
  initScatterPlot();
  initRegionalChart();
  initSankey();

  // 8. Wire control bar interactions
  wireEncodeControls();
  wireReconfigureControls();

  // 9. Subscribe to filters:changed to update KPI cards
  on('filters:changed', ({ filteredRows, aggregates }) => {
    renderKpiGrid(aggregates.kpi, document.getElementById('kpi-grid'));
    renderConclusionCards(aggregates.kpi, aggregates.storyStats, document.getElementById('conclusion-grid'));
  });

  hideLoader();
}

// ─── Encode controls ──────────────────────────────────────────────────────

function wireEncodeControls() {
  document.querySelectorAll('.seg-btn[data-encode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.encode;
      appState.encode.colorBy = value;

      // Update UI
      document.querySelectorAll('.seg-btn[data-encode]').forEach(b => {
        b.classList.toggle('active', b.dataset.encode === value);
        b.setAttribute('aria-checked', b.dataset.encode === value);
      });

      emit('encode:changed', { colorBy: value });
    });

    // Keyboard support
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') btn.click();
    });
  });
}

// ─── Reconfigure controls ─────────────────────────────────────────────────

function wireReconfigureControls() {
  const groupBySel  = document.getElementById('select-groupby');
  const heatMetric  = document.getElementById('select-heatmap-metric');
  const heatRows    = document.getElementById('select-heatmap-rows');

  groupBySel?.addEventListener('change', () => {
    appState.reconfigure.barGroupBy = groupBySel.value;
    recomputeAndEmit();
    emit('reconfigure:changed', appState.reconfigure);
  });

  heatMetric?.addEventListener('change', () => {
    appState.reconfigure.heatmapMetric = heatMetric.value;
    recomputeAndEmit();
    emit('reconfigure:changed', appState.reconfigure);
  });

  heatRows?.addEventListener('change', () => {
    appState.reconfigure.heatmapRows = heatRows.value;
    recomputeAndEmit();
    emit('reconfigure:changed', appState.reconfigure);
  });
}

function recomputeAndEmit() {
  appState.data.aggregates = computeAggregates(
    appState.data.filteredRows,
    appState.reconfigure
  );
}
