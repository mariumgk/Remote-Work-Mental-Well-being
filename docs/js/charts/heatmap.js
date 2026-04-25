/**
 * Chart 2: Heatmap
 * Average metric by Job_Role (or Industry) × Work_Location
 * Interactions: Select, Filter, Encode, Connect, Reconfigure, Elaborate, Abstract
 */

import { appState, emit, on } from '../appState.js';
import { heatmapColorScale } from '../utils/colorScales.js';
import { showTooltip, hideTooltip, buildTooltip } from '../utils/tooltips.js';
import { watchResize } from '../utils/responsive.js';

const MARGIN = { top: 20, right: 16, bottom: 80, left: 110 };

export function initHeatmap() {
  const container = document.getElementById('chart-heatmap');
  if (!container) return;

  watchResize(container, () => drawHeatmap(container));
  on('filters:changed',     () => drawHeatmap(container));
  on('encode:changed',      () => drawHeatmap(container));
  on('reconfigure:changed', () => drawHeatmap(container));
  on('selection:changed',   () => applyHeatmapDimming(container));

  drawHeatmap(container);
}

function drawHeatmap(container) {
  if (!container || !window.d3) return;

  const { cells, rowKeys, colKeys } = appState.data.aggregates?.heatmapData || {};
  if (!cells?.length) {
    container.innerHTML = '<div class="no-data">No data</div>';
    return;
  }

  const metric = appState.reconfigure.heatmapMetric;
  const validVals = cells.filter(c => c.value !== null).map(c => c.value);
  const domain = [d3.min(validVals), d3.max(validVals)];
  const colorScale = heatmapColorScale(d3, domain, metric);

  const rect = container.getBoundingClientRect();
  const totalW = rect.width || 380;
  const cellW  = Math.max(32, (totalW - MARGIN.left - MARGIN.right) / colKeys.length);
  const cellH  = Math.max(22, Math.min(38, (Math.max(260, rect.height || 300) - MARGIN.top - MARGIN.bottom) / rowKeys.length));
  const width  = cellW * colKeys.length;
  const height = cellH * rowKeys.length;

  d3.select(container).selectAll('*').remove();

  const svg = d3.select(container).append('svg')
    .attr('width',  width  + MARGIN.left + MARGIN.right)
    .attr('height', height + MARGIN.top  + MARGIN.bottom)
    .attr('role', 'img')
    .attr('aria-label', `Heatmap of ${metric.replace('avg','')} by ${appState.reconfigure.heatmapRows.replace(/_/g,' ')} and Work Mode`);

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const xScale = d3.scaleBand().domain(colKeys).range([0, width]).padding(0.04);
  const yScale = d3.scaleBand().domain(rowKeys).range([0, height]).padding(0.04);

  // Axes
  g.append('g').attr('class', 'axis axis--x')
    .call(d3.axisTop(xScale).tickSize(0))
    .call(ax => ax.select('.domain').remove());

  g.append('g').attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale).tickSize(0))
    .call(ax => ax.select('.domain').remove());

  // Cells
  g.selectAll('.heatmap-cell')
    .data(cells)
    .join('rect')
      .attr('class', 'heatmap-cell')
      .attr('data-row', d => d.rowKey)
      .attr('data-col', d => d.colKey)
      .attr('x', d => xScale(d.colKey))
      .attr('y', d => yScale(d.rowKey))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.value !== null ? colorScale(d.value) : 'var(--bg-primary)')
      .attr('tabindex', 0)
      .attr('aria-label', d => `${d.rowKey}, ${d.colKey}: ${metricLabel(metric)} ${d.value ?? 'N/A'}`)
      .on('mouseover', (event, d) => {
        if (d.value === null) return;
        showTooltip(event, buildTooltip(
          `${d.rowKey} · ${d.colKey}`,
          [
            { label: metricLabel(metric), value: d.value.toFixed(2) },
            { label: 'Avg Stress Score',  value: d.avgStress },
            { label: 'Avg Isolation',     value: d.avgIsolation },
            { label: 'Avg WLB',           value: d.avgWLB },
            { label: 'Employees',         value: d.n.toLocaleString() }
          ]
        ));
      })
      .on('mouseout', hideTooltip)
      .on('click', (event, d) => {
        if (!d.value) return;
        appState.selection.type = 'cell';
        appState.selection.keys = new Set([`${d.rowKey}|${d.colKey}`]);
        // Also emit with the job role / industry for cross-chart connect
        const rowDim = appState.reconfigure.heatmapRows;
        emit('selection:changed', {
          type: rowDim,
          keys: new Set([d.rowKey]),
          secondary: { Work_Location: d.colKey }
        });
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });

  // Cell value labels (when cells are large enough)
  if (cellH >= 26 && cellW >= 36) {
    g.selectAll('.heatmap-label')
      .data(cells.filter(c => c.value !== null))
      .join('text')
        .attr('class', 'heatmap-label')
        .attr('x', d => xScale(d.colKey) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.rowKey) + yScale.bandwidth() / 2)
        .text(d => d.value.toFixed(1))
        .style('fill', d => labelContrast(colorScale(d.value)));
  }

  // Color legend
  appendHeatmapLegend(container, colorScale, domain, metric);
  applyHeatmapDimming(container);
}

function applyHeatmapDimming(container) {
  const { type, keys } = appState.selection;
  const rowDim = appState.reconfigure.heatmapRows;

  d3.select(container).selectAll('.heatmap-cell')
    .classed('dimmed', function(d) {
      if (!type || !keys.size) return false;
      if (type === rowDim)  return !keys.has(d.rowKey);
      if (type === 'Work_Location') return !keys.has(d.colKey);
      return false;
    })
    .classed('selected', function(d) {
      if (type === 'cell') {
        return keys.has(`${d.rowKey}|${d.colKey}`);
      }
      return false;
    });
}

function appendHeatmapLegend(container, scale, domain, metric) {
  const steps = 5;
  const vals = d3.range(steps).map(i => domain[0] + (i / (steps - 1)) * (domain[1] - domain[0]));
  const legendDiv = d3.select(container).append('div')
    .attr('class', 'chart-legend')
    .attr('aria-label', `Heatmap color legend for ${metric}`);
  vals.forEach(v => {
    const item = legendDiv.append('div').attr('class', 'legend-item');
    item.append('span').attr('class', 'legend-swatch')
      .style('background', scale(v));
    item.append('span').text(v.toFixed(1));
  });
}

function metricLabel(metric) {
  return metric === 'avgStress'    ? 'Avg Stress Score'    :
         metric === 'avgIsolation' ? 'Avg Isolation'       : 'Avg Work-Life Balance';
}

function labelContrast(hexColor) {
  // Simple luminance check: return black or white text
  const c = d3.color(hexColor);
  if (!c) return '#fff';
  const { r, g, b } = c.rgb();
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#1a1a1a' : '#f0f0f0';
}
