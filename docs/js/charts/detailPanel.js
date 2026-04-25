/**
 * Detail Panel — Elaborate interaction.
 * Slide-in drawer showing full stats for the selected group.
 */

import { appState, on, emit } from '../appState.js';
import { computeDetailData } from '../dataProcessor.js';
import { RISK_COLORS, RISK_ORDER, STRESS_COLORS, STRESS_ORDER } from '../utils/colorScales.js';

export function initDetailPanel() {
  on('selection:changed', payload => {
    if (!appState.selection.type || appState.selection.keys.size === 0) {
      closePanel();
    } else {
      const selectedRows = getSelectedRows(payload);
      if (selectedRows.length > 0) {
        openPanel(selectedRows, payload);
      } else {
        closePanel();
      }
    }
  });

  document.getElementById('detail-panel-close')?.addEventListener('click', () => {
    appState.selection.type = null;
    appState.selection.keys = new Set();
    emit('selection:changed', appState.selection);
  });

  document.getElementById('detail-panel-overlay')?.addEventListener('click', () => {
    document.getElementById('detail-panel-close')?.click();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('detail-panel')?.classList.contains('is-open')) {
      document.getElementById('detail-panel-close')?.click();
    }
  });
}

function getSelectedRows(payload) {
  const allRows = appState.data.filteredRows || [];
  const { type, keys } = appState.selection;
  if (!type || !keys.size) return [];

  // Map selection type to row field
  const fieldMap = {
    'Work_Location': 'Work_Location',
    'Stress_Level':  'Stress_Level',
    'Region':        'Region',
    'Job_Role':      'Job_Role',
    'Industry':      'Industry',
    'Age_Group':     'Age_Group',
    'cell':          null
  };

  const field = fieldMap[type];
  if (!field) {
    // Cell selection: combine row + col filter
    const rowDim = appState.reconfigure.heatmapRows;
    const secondary = payload?.secondary;
    if (secondary?.Work_Location) {
      return allRows.filter(r =>
        keys.has(r[rowDim]) && r.Work_Location === secondary.Work_Location
      );
    }
    return allRows.filter(r => keys.has(r[rowDim]));
  }

  return allRows.filter(r => keys.has(r[field]));
}

function openPanel(selectedRows, payload) {
  const panel   = document.getElementById('detail-panel');
  const overlay = document.getElementById('detail-panel-overlay');
  const content = document.getElementById('detail-panel-content');

  if (!panel || !content) return;

  const data = computeDetailData(selectedRows, appState.data.allRows);
  if (!data) { closePanel(); return; }

  const { type, keys } = appState.selection;
  const groupLabel = [...keys].join(', ');

  content.innerHTML = buildPanelHTML(groupLabel, type, data);
  renderMiniBars(content, data);

  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  if (overlay) { overlay.classList.add('is-visible'); }

  // Focus management
  panel.querySelector('[tabindex="0"], button, [href]')?.focus();
}

function closePanel() {
  const panel   = document.getElementById('detail-panel');
  const overlay = document.getElementById('detail-panel-overlay');
  if (panel)   { panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); }
  if (overlay) { overlay.classList.remove('is-visible'); }
}

function buildPanelHTML(groupLabel, type, d) {
  const deltaHtml = (val, label, higherIsBad = true) => {
    if (Math.abs(val) < 0.01) return `<span class="detail-delta detail-delta--same" aria-label="same as average">≈ avg</span>`;
    const dir = higherIsBad ? (val > 0 ? 'up' : 'down') : (val > 0 ? 'down' : 'up');
    const sign = val > 0 ? '+' : '';
    return `<span class="detail-delta detail-delta--${dir}" aria-label="${sign}${val} vs dataset average">${sign}${val} vs avg</span>`;
  };

  return `
    <div class="detail-group-label">${groupLabel}</div>
    <div class="detail-count">${d.n.toLocaleString()} employees · ${d.pctOfTotal}% of filtered set</div>

    <div class="detail-section-title">Key Averages</div>
    <div class="detail-stat-row">
      <span class="detail-stat-label">Stress Score</span>
      <span class="detail-stat-value">${d.avgStress} / 3 ${deltaHtml(d.deltas.stress, 'stress', true)}</span>
    </div>
    <div class="detail-stat-row">
      <span class="detail-stat-label">Work-Life Balance</span>
      <span class="detail-stat-value">${d.avgWLB} / 5 ${deltaHtml(d.deltas.wlb, 'WLB', false)}</span>
    </div>
    <div class="detail-stat-row">
      <span class="detail-stat-label">Social Isolation</span>
      <span class="detail-stat-value">${d.avgIsolation} / 5 ${deltaHtml(d.deltas.isolation, 'isolation', true)}</span>
    </div>
    <div class="detail-stat-row">
      <span class="detail-stat-label">Avg Hours / Week</span>
      <span class="detail-stat-value">${d.avgHours} hrs ${deltaHtml(d.deltas.hours, 'hours', true)}</span>
    </div>
    <div class="detail-stat-row">
      <span class="detail-stat-label">Avg Virtual Meetings</span>
      <span class="detail-stat-value">${d.avgMeetings} / week</span>
    </div>

    <div class="detail-section-title">Stress Distribution</div>
    <div id="detail-stress-bars" class="mini-bar-container" aria-label="Stress level breakdown"></div>

    <div class="detail-section-title">Risk Level Distribution</div>
    <div id="detail-risk-bars" class="mini-bar-container" aria-label="Risk level breakdown"></div>

    <div class="detail-section-title">Mental Health Conditions</div>
    <div id="detail-mhc-bars" class="mini-bar-container" aria-label="Mental health condition breakdown"></div>

    <div class="detail-section-title">Extreme Risk</div>
    <div class="detail-stat-row">
      <span class="detail-stat-label">High Risk Flag</span>
      <span class="detail-stat-value">${d.highRiskN.toLocaleString()} (${d.highRiskPct}%)</span>
    </div>
  `;
}

function renderMiniBars(container, d) {
  const stressEl = container.querySelector('#detail-stress-bars');
  if (stressEl) renderBarGroup(stressEl, d.stressFreq, d.n, STRESS_ORDER, STRESS_COLORS);

  const riskEl = container.querySelector('#detail-risk-bars');
  if (riskEl) renderBarGroup(riskEl, d.riskFreq, d.n, RISK_ORDER, RISK_COLORS);

  const mhcEl = container.querySelector('#detail-mhc-bars');
  if (mhcEl) {
    const mhcOrder = ['None', 'Anxiety', 'Depression', 'Burnout', 'Not Reported'];
    const mhcColors = { None: '#38b2ac', Anxiety: '#f6ad55', Depression: '#9f7aea', Burnout: '#fc8181', 'Not Reported': '#484f58' };
    renderBarGroup(mhcEl, d.mhcFreq, d.n, mhcOrder, mhcColors);
  }
}

function renderBarGroup(el, freq, total, order, colors) {
  el.innerHTML = order
    .filter(k => freq[k] > 0)
    .map(k => {
      const count = freq[k] || 0;
      const pctVal = total ? ((count / total) * 100).toFixed(1) : 0;
      const color = colors[k] || '#8b949e';
      return `
        <div class="mini-bar-row">
          <span class="mini-bar-label">${k}</span>
          <div class="mini-bar-track" role="progressbar" aria-valuenow="${pctVal}" aria-valuemin="0" aria-valuemax="100" aria-label="${k}: ${pctVal}%">
            <div class="mini-bar-fill" style="width:${pctVal}%;background:${color}"></div>
          </div>
          <span class="mini-bar-pct">${pctVal}%</span>
        </div>`;
    }).join('');
}
