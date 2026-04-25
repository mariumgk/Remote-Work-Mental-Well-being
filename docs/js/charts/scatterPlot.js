/**
 * Chart 3: Scatter / Bubble Plot
 * Hours Worked vs Social Isolation, with Abstract (aggregate ↔ individual) toggle.
 * Interactions: Select, Filter, Encode, Connect, Abstract, Elaborate
 */

import { appState, emit, on } from '../appState.js';
import { getColorScale, getColorOrder, STRESS_ORDER, WORK_LOCATION_ORDER, SLEEP_ORDER, PRODUCTIVITY_ORDER } from '../utils/colorScales.js';
import { showTooltip, hideTooltip, buildTooltip } from '../utils/tooltips.js';
import { watchResize } from '../utils/responsive.js';

const MARGIN = { top: 16, right: 24, bottom: 56, left: 52 };
const MAX_BUBBLE_R = 22;
const MIN_BUBBLE_R = 5;

export function initScatterPlot() {
  const container = document.getElementById('chart-scatter');
  if (!container) return;

  // Abstract toggle
  document.getElementById('scatter-mode-agg')?.addEventListener('click', () => setScatterMode('aggregate'));
  document.getElementById('scatter-mode-ind')?.addEventListener('click', () => setScatterMode('individual'));

  watchResize(container, () => drawScatter(container));
  on('filters:changed',   () => drawScatter(container));
  on('encode:changed',    () => drawScatter(container));
  on('selection:changed', () => applyScatterDimming(container));

  drawScatter(container);
}

function setScatterMode(mode) {
  appState.abstractMode.scatter = mode;
  document.getElementById('scatter-mode-agg')?.classList.toggle('active', mode === 'aggregate');
  document.getElementById('scatter-mode-agg')?.setAttribute('aria-pressed', mode === 'aggregate');
  document.getElementById('scatter-mode-ind')?.classList.toggle('active', mode === 'individual');
  document.getElementById('scatter-mode-ind')?.setAttribute('aria-pressed', mode === 'individual');
  drawScatter(document.getElementById('chart-scatter'));
}

function drawScatter(container) {
  if (!container || !window.d3) return;

  const mode = appState.abstractMode.scatter;
  if (mode === 'aggregate') drawAggregateScatter(container);
  else                      drawIndividualScatter(container);
}

// ─── Aggregate mode ───────────────────────────────────────────────────────

function drawAggregateScatter(container) {
  const data = appState.data.aggregates?.scatterAgg || [];
  if (!data.length) { container.innerHTML = '<div class="no-data">No data</div>'; return; }

  const rect = container.getBoundingClientRect();
  const W = (rect.width  || 380) - MARGIN.left - MARGIN.right;
  const H = Math.max(220, (rect.height || 280) - MARGIN.top - MARGIN.bottom);

  d3.select(container).selectAll('*').remove();

  const svg = d3.select(container).append('svg')
    .attr('width',  W + MARGIN.left + MARGIN.right)
    .attr('height', H + MARGIN.top  + MARGIN.bottom)
    .attr('role', 'img')
    .attr('aria-label', 'Bubble chart: Hours worked vs social isolation (grouped by Hours Group and Stress Level)');

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const xScale = d3.scaleLinear().domain([18, 62]).range([0, W]);
  const yScale = d3.scaleLinear().domain([0.5, 5.5]).range([H, 0]);
  const rScale = d3.scaleSqrt().domain([0, d3.max(data, d => d.n)]).range([MIN_BUBBLE_R, MAX_BUBBLE_R]);
  const colorScale = getColorScale(d3, appState.encode.colorBy);

  drawAxes(g, xScale, yScale, W, H);

  // Background click to deselect
  g.append('rect')
    .attr('width', W).attr('height', H).attr('fill', 'transparent')
    .on('click', () => { appState.selection.type = null; appState.selection.keys = new Set(); emit('selection:changed', appState.selection); });

  const colorField = appState.encode.colorBy;

  g.selectAll('.bubble')
    .data(data)
    .join('circle')
      .attr('class', 'bubble')
      .attr('data-stress', d => d.Stress_Level)
      .attr('cx', d => xScale(d.avgHours))
      .attr('cy', d => yScale(d.avgIsolation))
      .attr('r',  d => rScale(d.n))
      .attr('fill', d => colorScale(d[colorField] || d.Stress_Level))
      .attr('fill-opacity', 0.75)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1)
      .attr('tabindex', 0)
      .attr('aria-label', d => `${d.Hours_Group}, ${d.Stress_Level} stress: ${d.n} employees, avg isolation ${d.avgIsolation}`)
      .on('mouseover', (event, d) => {
        showTooltip(event, buildTooltip(
          `${d.Hours_Group} · ${d.Stress_Level} Stress`,
          [
            { label: 'Employees',     value: d.n.toLocaleString() },
            { label: 'Avg Hours/wk',  value: d.avgHours },
            { label: 'Avg Isolation', value: d.avgIsolation },
            { label: 'Avg Meetings',  value: d.avgMeetings },
            { label: 'Avg WLB',       value: d.avgWLB }
          ]
        ));
      })
      .on('mouseout', hideTooltip)
      .on('click', (event, d) => {
        event.stopPropagation();
        appState.selection.type = 'Stress_Level';
        appState.selection.keys = new Set([d.Stress_Level]);
        emit('selection:changed', appState.selection);
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
          appState.selection.type = 'Stress_Level';
          appState.selection.keys = new Set([d.Stress_Level]);
          emit('selection:changed', appState.selection);
        }
      });

  // Bubble count labels
  g.selectAll('.bubble-label')
    .data(data.filter(d => rScale(d.n) >= 10))
    .join('text')
      .attr('class', 'bubble-label')
      .attr('x', d => xScale(d.avgHours))
      .attr('y', d => yScale(d.avgIsolation) + 4)
      .attr('text-anchor', 'middle')
      .style('fill', 'rgba(255,255,255,0.8)')
      .style('font-size', '9px')
      .style('pointer-events', 'none')
      .text(d => d.n.toLocaleString());

  renderScatterLegend(container, colorScale, appState.encode.colorBy);
  applyScatterDimming(container);
}

// ─── Individual mode ──────────────────────────────────────────────────────

function drawIndividualScatter(container) {
  const rows = appState.data.filteredRows || [];
  if (!rows.length) { container.innerHTML = '<div class="no-data">No data</div>'; return; }

  const rect = container.getBoundingClientRect();
  const W = (rect.width  || 380) - MARGIN.left - MARGIN.right;
  const H = Math.max(220, (rect.height || 280) - MARGIN.top - MARGIN.bottom);

  d3.select(container).selectAll('*').remove();

  // Canvas for individual dots (performance)
  const canvas = d3.select(container).append('canvas')
    .attr('width',  W + MARGIN.left + MARGIN.right)
    .attr('height', H + MARGIN.top  + MARGIN.bottom)
    .style('position', 'absolute').style('top', 0).style('left', 0);

  const svg = d3.select(container).append('svg')
    .attr('width',  W + MARGIN.left + MARGIN.right)
    .attr('height', H + MARGIN.top  + MARGIN.bottom)
    .style('position', 'relative')
    .attr('role', 'img')
    .attr('aria-label', 'Scatter plot: individual employee dots — Hours worked vs social isolation');

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const xScale = d3.scaleLinear().domain([18, 62]).range([0, W]);
  const yScale = d3.scaleLinear().domain([0.5, 5.5]).range([H, 0]);
  const colorScale = getColorScale(d3, appState.encode.colorBy);

  // Draw dots on canvas
  const ctx = canvas.node().getContext('2d');
  const colorField = appState.encode.colorBy;

  rows.forEach(r => {
    const x = xScale(r.Hours_Worked_Per_Week) + MARGIN.left;
    const y = yScale(r.Social_Isolation_Rating) + MARGIN.top;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fillStyle = colorScale(r[colorField]) + 'aa'; // 67% opacity
    ctx.fill();
  });

  drawAxes(g, xScale, yScale, W, H);

  // D3 quadtree for hover hit-testing on canvas
  const quadtree = d3.quadtree()
    .extent([[0,0],[W,H]])
    .addAll(rows.map(r => [xScale(r.Hours_Worked_Per_Week), yScale(r.Social_Isolation_Rating), r]));

  svg.on('mousemove', (event) => {
    const [mx, my] = d3.pointer(event, g.node());
    const radius = 12;
    let closest = null, closestDist = radius;
    quadtree.visit((node, x0, y0, x1, y1) => {
      if (!node.length) {
        const [px, py, row] = node.data;
        const d = Math.hypot(px - mx, py - my);
        if (d < closestDist) { closestDist = d; closest = row; }
      }
      return mx - radius > x1 || mx + radius < x0 || my - radius > y1 || my + radius < y0;
    });
    if (closest) {
      showTooltip(event, buildTooltip(
        `${closest.Job_Role} · ${closest.Work_Location}`,
        [
          { label: 'Hours/week',   value: closest.Hours_Worked_Per_Week },
          { label: 'Isolation',    value: closest.Social_Isolation_Rating },
          { label: 'Stress',       value: closest.Stress_Level },
          { label: 'Sleep',        value: closest.Sleep_Quality },
          { label: 'Risk Level',   value: closest.Risk_Level }
        ]
      ));
    } else {
      hideTooltip();
    }
  }).on('mouseleave', hideTooltip)
    .on('click', (event) => {
      const [mx, my] = d3.pointer(event, g.node());
      const radius = 14;
      let closest = null, closestDist = radius;
      quadtree.visit((node, x0, y0, x1, y1) => {
        if (!node.length) {
          const [px, py, row] = node.data;
          const d = Math.hypot(px - mx, py - my);
          if (d < closestDist) { closestDist = d; closest = row; }
        }
        return mx - radius > x1 || mx + radius < x0 || my - radius > y1 || my + radius < y0;
      });
      if (closest) {
        appState.selection.type = 'Stress_Level';
        appState.selection.keys = new Set([closest.Stress_Level]);
        emit('selection:changed', appState.selection);
      } else {
        appState.selection.type = null;
        appState.selection.keys = new Set();
        emit('selection:changed', appState.selection);
      }
    });

  renderScatterLegend(container, colorScale, appState.encode.colorBy);
}

function drawAxes(g, xScale, yScale, W, H) {
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).tickSize(-W).tickFormat(''))
    .selectAll('line').attr('class', 'grid-line');
  g.select('.grid .domain').remove();

  g.append('g').attr('class', 'axis axis--x')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(6))
    .call(ax => ax.select('.domain').attr('stroke', 'var(--border)'));

  g.append('g').attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale).ticks(5))
    .call(ax => ax.select('.domain').remove());

  g.append('text').attr('class', 'axis-label')
    .attr('x', W / 2).attr('y', H + 44).attr('text-anchor', 'middle')
    .text('Hours Worked Per Week');

  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 2).attr('y', -38).attr('text-anchor', 'middle')
    .text('Social Isolation Rating');
}

function renderScatterLegend(container, colorScale, colorBy) {
  const order = getColorOrder(colorBy);
  const div = d3.select(container).append('div')
    .attr('class', 'chart-legend')
    .attr('aria-label', `Color legend: ${colorBy.replace(/_/g,' ')}`);
  order.forEach(k => {
    const item = div.append('div').attr('class', 'legend-item');
    item.append('span').attr('class', 'legend-swatch').style('background', colorScale(k));
    item.append('span').text(k);
  });
}

function applyScatterDimming(container) {
  // Only applies to aggregate mode (SVG circles)
  const { type, keys } = appState.selection;
  d3.select(container).selectAll('.bubble')
    .classed('dimmed', function(d) {
      if (!type || !keys.size) return false;
      if (type === 'Stress_Level' && d?.Stress_Level) return !keys.has(d.Stress_Level);
      return false;
    });
}
