/**
 * Chart 1: Stacked / Grouped Bar Chart
 * Stress distribution by a configurable grouping dimension.
 * Interactions: Select, Filter, Encode, Connect, Reconfigure, Elaborate
 */

import { appState, emit, on } from '../appState.js';
import { computeBarData } from '../dataProcessor.js';
import { getColorScale, getColorOrder, STRESS_ORDER } from '../utils/colorScales.js';
import { showTooltip, hideTooltip, buildTooltip } from '../utils/tooltips.js';
import { watchResize } from '../utils/responsive.js';

const MARGIN = { top: 16, right: 16, bottom: 60, left: 52 };

let _svg = null, _g = null, _xScale, _yScale, _colorScale;
let _width = 0, _height = 0;
let _mode = 'stacked'; // 'stacked' | 'grouped'
let _cleanup = null;

export function initBarChart() {
  const container = document.getElementById('chart-bar');
  if (!container) return;

  // Mode toggle buttons
  document.getElementById('bar-mode-stacked')?.addEventListener('click', () => setMode('stacked'));
  document.getElementById('bar-mode-grouped')?.addEventListener('click', () => setMode('grouped'));

  _cleanup = watchResize(container, ({ width }) => {
    drawBarChart(container, width);
  });

  on('filters:changed', () => drawBarChart(container));
  on('encode:changed',  () => drawBarChart(container));
  on('reconfigure:changed', () => drawBarChart(container));
  on('selection:changed', applyDimming);

  drawBarChart(container);
}

function setMode(mode) {
  _mode = mode;
  document.getElementById('bar-mode-stacked')?.classList.toggle('active', mode === 'stacked');
  document.getElementById('bar-mode-stacked')?.setAttribute('aria-pressed', mode === 'stacked');
  document.getElementById('bar-mode-grouped')?.classList.toggle('active', mode === 'grouped');
  document.getElementById('bar-mode-grouped')?.setAttribute('aria-pressed', mode === 'grouped');
  drawBarChart(document.getElementById('chart-bar'));
}

function drawBarChart(container, forceWidth) {
  if (!container || !window.d3) return;

  const rows = appState.data.filteredRows;
  if (!rows?.length) {
    container.innerHTML = '<div class="no-data">No data matches current filters</div>';
    return;
  }

  const groupDim   = appState.reconfigure.barGroupBy;
  const data       = computeBarData(rows, groupDim);
  const colorBy    = appState.encode.colorBy;
  const stackKeys  = STRESS_ORDER; // always stack by stress; encode changes color mapping only

  const rect  = container.getBoundingClientRect();
  _width  = (forceWidth || rect.width || 400) - MARGIN.left - MARGIN.right;
  _height = Math.max(220, (rect.height || 280) - MARGIN.top - MARGIN.bottom);

  // Create or clear SVG
  d3.select(container).selectAll('*').remove();

  const svgEl = d3.select(container)
    .append('svg')
    .attr('width',  _width  + MARGIN.left + MARGIN.right)
    .attr('height', _height + MARGIN.top  + MARGIN.bottom)
    .attr('role', 'img')
    .attr('aria-label', `Bar chart: Stress levels by ${groupDim.replace(/_/g,' ')}`);

  _g = svgEl.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  _colorScale = getColorScale(d3, colorBy === 'Stress_Level' ? 'Stress_Level' : colorBy);

  const groups = data.map(d => d.group);
  _xScale = d3.scaleBand().domain(groups).range([0, _width]).padding(0.25);
  _yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.total) * 1.08]).range([_height, 0]);

  // Gridlines
  _g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(_yScale).tickSize(-_width).tickFormat(''))
    .selectAll('line').attr('class', 'grid-line');
  _g.select('.grid .domain').remove();

  // Axes
  _g.append('g').attr('class', 'axis axis--x')
    .attr('transform', `translate(0,${_height})`)
    .call(d3.axisBottom(_xScale).tickSize(0))
    .call(g => g.select('.domain').attr('stroke', 'var(--border)'))
    .selectAll('text')
      .attr('transform', groups.some(g => g.length > 8) ? 'rotate(-30)' : 'rotate(0)')
      .style('text-anchor', groups.some(g => g.length > 8) ? 'end' : 'middle')
      .attr('dy', groups.some(g => g.length > 8) ? '0.35em' : '1em');

  _g.append('g').attr('class', 'axis axis--y')
    .call(d3.axisLeft(_yScale).ticks(5).tickFormat(d3.format(',d')))
    .call(g => g.select('.domain').remove());

  // Y-axis label
  _g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -_height / 2).attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('Number of Employees');

  // X-axis label
  _g.append('text').attr('class', 'axis-label')
    .attr('x', _width / 2)
    .attr('y', _height + MARGIN.bottom - 8)
    .attr('text-anchor', 'middle')
    .text(groupDim.replace(/_/g, ' '));

  if (_mode === 'stacked') {
    drawStacked(data, stackKeys);
  } else {
    drawGrouped(data, stackKeys);
  }

  renderLegend(stackKeys, colorBy);
  applyDimming();
}

function drawStacked(data, keys) {
  const stacked = d3.stack().keys(keys)(data);

  stacked.forEach((layer, li) => {
    _g.selectAll(`.bar-layer-${li}`)
      .data(layer)
      .join('rect')
        .attr('class', d => `bar bar-stress-${d.data.group.replace(/\s/g,'-')}`)
        .attr('data-group', d => d.data.group)
        .attr('data-stress', () => keys[li])
        .attr('x', d => _xScale(d.data.group))
        .attr('y', d => _yScale(d[1]))
        .attr('width', _xScale.bandwidth())
        .attr('height', d => Math.max(0, _yScale(d[0]) - _yScale(d[1])))
        .attr('fill', () => _colorScale(keys[li]))
        .attr('rx', 2)
        .attr('tabindex', 0)
        .attr('aria-label', d => `${d.data.group}, ${keys[li]} stress: ${d.data[keys[li]]} employees`)
        .on('mouseover', (event, d) => {
          const total = d.data.total;
          const count = d.data[keys[li]];
          showTooltip(event, buildTooltip(
            `${d.data.group} — ${keys[li]} Stress`,
            [
              { label: 'Count', value: count.toLocaleString() },
              { label: '% of group', value: `${d.data[keys[li]+'_pct']}%` },
              { label: 'Group total', value: total.toLocaleString() }
            ]
          ));
        })
        .on('mousemove', (event) => {
          const tip = document.querySelector('.d3-tooltip');
          if (tip) {
            const { positionTooltip } = tooltipModule();
            positionTooltip(event, tip);
          }
        })
        .on('mouseout', hideTooltip)
        .on('click', (event, d) => selectGroup(d.data.group))
        .on('keydown', (event, d) => { if (event.key === 'Enter' || event.key === ' ') selectGroup(d.data.group); });
  });
}

function drawGrouped(data, keys) {
  const x1 = d3.scaleBand().domain(keys).range([0, _xScale.bandwidth()]).padding(0.05);

  data.forEach(d => {
    keys.forEach(k => {
      _g.append('rect')
        .attr('class', 'bar')
        .attr('data-group', d.group)
        .attr('data-stress', k)
        .attr('x', _xScale(d.group) + x1(k))
        .attr('y', _yScale(d[k]))
        .attr('width', x1.bandwidth())
        .attr('height', Math.max(0, _height - _yScale(d[k])))
        .attr('fill', _colorScale(k))
        .attr('rx', 2)
        .attr('tabindex', 0)
        .attr('aria-label', `${d.group}, ${k} stress: ${d[k]} employees`)
        .on('mouseover', (event) => {
          showTooltip(event, buildTooltip(
            `${d.group} — ${k} Stress`,
            [
              { label: 'Count', value: d[k].toLocaleString() },
              { label: '% of group', value: `${d[k+'_pct']}%` }
            ]
          ));
        })
        .on('mouseout', hideTooltip)
        .on('click', () => selectGroup(d.group))
        .on('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') selectGroup(d.group); });
    });
  });
}

function selectGroup(group) {
  const dim = appState.reconfigure.barGroupBy;
  // Toggle selection
  if (appState.selection.type === dim && appState.selection.keys.has(group)) {
    appState.selection.type = null;
    appState.selection.keys = new Set();
  } else {
    appState.selection.type = dim;
    appState.selection.keys = new Set([group]);
  }
  emit('selection:changed', appState.selection);
}

function applyDimming() {
  const { type, keys } = appState.selection;
  const dim = appState.reconfigure.barGroupBy;

  d3.select('#chart-bar').selectAll('.bar')
    .classed('dimmed', function(d) {
      if (!type || !keys.size) return false;
      if (type !== dim) return false;
      const group = d?.data?.group || this.getAttribute('data-group');
      return !keys.has(group);
    });
}

function renderLegend(keys, colorBy) {
  const legendContainer = d3.select('#chart-bar').append('div')
    .attr('class', 'chart-legend')
    .attr('aria-label', `Color legend: ${colorBy.replace(/_/g,' ')}`);

  keys.forEach(k => {
    const item = legendContainer.append('div').attr('class', 'legend-item');
    item.append('span').attr('class', 'legend-swatch')
      .style('background', _colorScale(k));
    item.append('span').text(k);
  });
}

// Lazy import workaround for tooltip repositioning
function tooltipModule() {
  return { positionTooltip: (event, tip) => {
    const { innerWidth: vw, innerHeight: vh } = window;
    const margin = 14;
    const x = event.clientX, y = event.clientY;
    const tw = tip.offsetWidth || 200, th = tip.offsetHeight || 100;
    let left = x + margin, top = y + margin;
    if (left + tw > vw - margin) left = x - tw - margin;
    if (top  + th > vh - margin) top  = y - th - margin;
    tip.style.left = `${Math.max(margin, left)}px`;
    tip.style.top  = `${Math.max(margin, top)}px`;
  }};
}
