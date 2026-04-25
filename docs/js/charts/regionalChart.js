/**
 * Chart 5: Regional Comparison — horizontal bar chart
 * Interactions: Select, Filter, Encode, Connect, Reconfigure, Elaborate
 */

import { appState, emit, on } from '../appState.js';
import { showTooltip, hideTooltip, buildTooltip } from '../utils/tooltips.js';
import { watchResize } from '../utils/responsive.js';

const MARGIN = { top: 10, right: 60, bottom: 40, left: 100 };

const METRIC_LABELS = {
  avgStress:    'Avg Stress Score (1–3)',
  sleepGoodRate: 'Good Sleep %',
  accessRate:   'Mental Health Access %',
  highRiskRate: 'High Risk %'
};

const METRIC_COLORS = {
  avgStress:    '#fc8181',
  sleepGoodRate: '#38b2ac',
  accessRate:   '#f6ad55',
  highRiskRate: '#ed8936'
};

export function initRegionalChart() {
  const container = document.getElementById('chart-regional');
  if (!container) return;

  const metricSel = document.getElementById('select-regional-metric');
  metricSel?.addEventListener('change', () => {
    appState.reconfigure.regionalMetric = metricSel.value;
    emit('reconfigure:changed', appState.reconfigure);
  });

  watchResize(container, () => drawRegional(container));
  on('filters:changed',     () => drawRegional(container));
  on('reconfigure:changed', () => drawRegional(container));
  on('selection:changed',   () => applyRegionalDimming(container));

  drawRegional(container);
}

function drawRegional(container) {
  if (!container || !window.d3) return;

  const data = appState.data.aggregates?.regionalData || [];
  if (!data.length) { container.innerHTML = '<div class="no-data">No data</div>'; return; }

  const metric = appState.reconfigure.regionalMetric || 'avgStress';
  const metricMax = metric.endsWith('Rate') || metric.endsWith('Pct')
    ? 100
    : d3.max(data, d => d[metric]) * 1.15;

  const rect = container.getBoundingClientRect();
  const W = (rect.width  || 380) - MARGIN.left - MARGIN.right;
  const H = Math.max(180, (rect.height || 280) - MARGIN.top  - MARGIN.bottom);

  d3.select(container).selectAll('*').remove();

  const svg = d3.select(container).append('svg')
    .attr('width',  W + MARGIN.left + MARGIN.right)
    .attr('height', H + MARGIN.top  + MARGIN.bottom)
    .attr('role', 'img')
    .attr('aria-label', `Horizontal bar chart: ${METRIC_LABELS[metric]} by region`);

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const regions = data.map(d => d.region);
  const yScale = d3.scaleBand().domain(regions).range([0, H]).padding(0.3);
  const xScale = d3.scaleLinear().domain([0, metricMax]).range([0, W]);
  const barColor = METRIC_COLORS[metric] || '#38b2ac';

  // Gridlines
  g.append('g').attr('class', 'grid')
    .call(d3.axisTop(xScale).tickSize(-H).tickFormat(''))
    .selectAll('line').attr('class', 'grid-line');
  g.select('.grid .domain').remove();

  // Axes
  g.append('g').attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale).tickSize(0))
    .call(ax => ax.select('.domain').remove())
    .selectAll('text').style('font-size', '11px');

  g.append('g').attr('class', 'axis axis--x')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => metric.endsWith('Rate') ? d+'%' : d))
    .call(ax => ax.select('.domain').attr('stroke', 'var(--border)'));

  // Background click to deselect
  g.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent')
    .on('click', () => { appState.selection.type = null; appState.selection.keys = new Set(); emit('selection:changed', appState.selection); });

  // Bars
  g.selectAll('.regional-bar')
    .data(data)
    .join('rect')
      .attr('class', 'regional-bar')
      .attr('data-region', d => d.region)
      .attr('y', d => yScale(d.region))
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', d => Math.max(0, xScale(d[metric] || 0)))
      .attr('fill', barColor)
      .attr('rx', 3)
      .attr('tabindex', 0)
      .attr('aria-label', d => `${d.region}: ${METRIC_LABELS[metric]} ${formatMetric(d[metric], metric)} (${d.n} employees)`)
      .on('mouseover', (event, d) => {
        showTooltip(event, buildTooltip(
          d.region,
          [
            { label: METRIC_LABELS[metric], value: formatMetric(d[metric], metric) },
            { label: 'Avg Stress Score',    value: d.avgStress },
            { label: 'Avg Isolation',       value: d.avgIsolation },
            { label: 'Good Sleep %',        value: `${d.sleepGoodRate}%` },
            { label: 'MH Access %',         value: `${d.accessRate}%` },
            { label: 'High Risk %',         value: `${d.highRiskRate}%` },
            { label: 'Employees',           value: d.n.toLocaleString() }
          ]
        ));
      })
      .on('mouseout', hideTooltip)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (appState.selection.type === 'Region' && appState.selection.keys.has(d.region)) {
          appState.selection.type = null;
          appState.selection.keys = new Set();
        } else {
          appState.selection.type = 'Region';
          appState.selection.keys = new Set([d.region]);
        }
        emit('selection:changed', appState.selection);
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
          appState.selection.type = 'Region';
          appState.selection.keys = new Set([d.region]);
          emit('selection:changed', appState.selection);
        }
      });

  // Value labels
  g.selectAll('.bar-value-label')
    .data(data)
    .join('text')
      .attr('y', d => yScale(d.region) + yScale.bandwidth() / 2 + 4)
      .attr('x', d => Math.max(0, xScale(d[metric] || 0)) + 5)
      .style('fill', 'var(--text-secondary)')
      .style('font-size', '11px')
      .style('pointer-events', 'none')
      .text(d => formatMetric(d[metric], metric));

  // X axis label
  g.append('text').attr('class', 'axis-label')
    .attr('x', W / 2).attr('y', H + 35).attr('text-anchor', 'middle')
    .text(METRIC_LABELS[metric]);

  applyRegionalDimming(container);
}

function applyRegionalDimming(container) {
  const { type, keys } = appState.selection;
  d3.select(container).selectAll('.regional-bar')
    .classed('dimmed', function(d) {
      if (!type || !keys.size) return false;
      if (type === 'Region') return !keys.has(d.region);
      return false;
    })
    .classed('selected', function(d) {
      return type === 'Region' && keys.has(d.region);
    });
}

function formatMetric(val, metric) {
  if (val == null) return 'N/A';
  if (metric.endsWith('Rate') || metric.endsWith('Pct')) return `${val}%`;
  return val.toString();
}
