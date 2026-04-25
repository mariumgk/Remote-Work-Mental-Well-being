/**
 * Chart 4: Sankey Diagram
 * Work_Location → Stress_Level → Productivity_Change → Satisfaction_with_Remote_Work
 * Interactions: Select, Filter, Abstract (absolute/proportional), Elaborate, Connect
 */

import { appState, emit, on } from '../appState.js';
import { computeSankeyData } from '../dataProcessor.js';
import { SANKEY_STAGE_COLORS } from '../utils/colorScales.js';
import { showTooltip, hideTooltip, buildTooltip } from '../utils/tooltips.js';
import { watchResize } from '../utils/responsive.js';

const MARGIN = { top: 20, right: 120, bottom: 20, left: 120 };
const NODE_WIDTH  = 14;
const NODE_PADDING = 10;
const MIN_ROWS_FOR_SANKEY = 80;

export function initSankey() {
  const container = document.getElementById('chart-sankey');
  if (!container) return;

  document.getElementById('sankey-mode-abs')?.addEventListener('click',  () => setSankeyMode('absolute'));
  document.getElementById('sankey-mode-prop')?.addEventListener('click', () => setSankeyMode('proportional'));

  watchResize(container, () => drawSankey(container));
  on('filters:changed',   () => drawSankey(container));
  on('selection:changed', () => applySankeyDimming(container));

  drawSankey(container);
}

function setSankeyMode(mode) {
  appState.abstractMode.sankey = mode;
  document.getElementById('sankey-mode-abs')?.classList.toggle('active',  mode === 'absolute');
  document.getElementById('sankey-mode-abs')?.setAttribute('aria-pressed', mode === 'absolute');
  document.getElementById('sankey-mode-prop')?.classList.toggle('active', mode === 'proportional');
  document.getElementById('sankey-mode-prop')?.setAttribute('aria-pressed', mode === 'proportional');
  drawSankey(document.getElementById('chart-sankey'));
}

function drawSankey(container) {
  if (!container || !window.d3 || !window.d3?.sankey) return;

  const filteredRows = appState.data.filteredRows || [];

  if (filteredRows.length < MIN_ROWS_FOR_SANKEY) {
    container.innerHTML = `<div class="no-data">Too few data points for Sankey (need ≥ ${MIN_ROWS_FOR_SANKEY} employees)</div>`;
    return;
  }

  let { nodes, links, stages, total } = computeSankeyData(filteredRows);

  // Proportional mode: normalize link values by source node total
  if (appState.abstractMode.sankey === 'proportional') {
    const sourceTotals = {};
    links.forEach(l => { sourceTotals[l.source] = (sourceTotals[l.source] || 0) + l.value; });
    links = links.map(l => ({
      ...l,
      value: Math.max(1, Math.round((l.value / (sourceTotals[l.source] || 1)) * 1000))
    }));
  }

  const rect = container.getBoundingClientRect();
  const W = Math.max(400, (rect.width  || 700)) - MARGIN.left - MARGIN.right;
  const H = Math.max(160, (rect.height || 220)) - MARGIN.top  - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  const svg = d3.select(container).append('svg')
    .attr('width',  W + MARGIN.left + MARGIN.right)
    .attr('height', H + MARGIN.top  + MARGIN.bottom)
    .attr('role', 'img')
    .attr('aria-label', 'Sankey diagram showing employee flow from work mode through stress, productivity change, to satisfaction');

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // d3-sankey@0.12 CDN extends the global d3 object with d3.sankey() and d3.sankeyLinkHorizontal()
  if (typeof d3.sankey !== 'function') {
    container.innerHTML = '<div class="no-data">Sankey library not loaded — check CDN connection</div>';
    return;
  }

  const sankeyGen = d3.sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .extent([[1, 1], [W - 1, H - 1]]);

  let graph;
  try {
    graph = sankeyGen({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d }))
    });
  } catch (e) {
    container.innerHTML = '<div class="no-data">Could not render Sankey for current filter selection</div>';
    return;
  }

  // Links
  const link = g.append('g').attr('fill', 'none')
    .selectAll('.sankey-link')
    .data(graph.links)
    .join('path')
      .attr('class', 'sankey-link')
      .attr('data-source', d => d.source.name)
      .attr('data-target', d => d.target.name)
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', d => SANKEY_STAGE_COLORS[d.source.stage] + '55')
      .attr('stroke-width', d => Math.max(1, d.width))
      .style('opacity', 0.45)
      .on('mouseover', (event, d) => {
        const rawVal = appState.abstractMode.sankey === 'proportional'
          ? `${((d.value / 1000) * 100).toFixed(1)}% of source`
          : d.value.toLocaleString();
        showTooltip(event, buildTooltip(
          `${d.source.name} → ${d.target.name}`,
          [{ label: appState.abstractMode.sankey === 'proportional' ? 'Proportion' : 'Employees', value: rawVal }]
        ));
      })
      .on('mouseout', hideTooltip);

  // Nodes
  const node = g.append('g')
    .selectAll('.sankey-node')
    .data(graph.nodes)
    .join('g')
      .attr('class', 'sankey-node')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

  node.append('rect')
    .attr('height', d => Math.max(1, d.y1 - d.y0))
    .attr('width',  d => d.x1 - d.x0)
    .attr('fill', d => SANKEY_STAGE_COLORS[d.stage])
    .attr('rx', 3)
    .attr('tabindex', 0)
    .attr('aria-label', d => `${d.name}: ${d.value.toLocaleString()} employees`)
    .on('mouseover', (event, d) => {
      const stageNames = ['Work Mode', 'Stress Level', 'Productivity', 'Satisfaction'];
      showTooltip(event, buildTooltip(
        d.name,
        [
          { label: 'Stage',     value: stageNames[d.stage] || '' },
          { label: 'Employees', value: d.value.toLocaleString() },
          { label: '% of total', value: `${((d.value / total) * 100).toFixed(1)}%` }
        ]
      ));
    })
    .on('mouseout', hideTooltip)
    .on('click', (event, d) => {
      event.stopPropagation();
      const stageFields = ['Work_Location', 'Stress_Level', 'Productivity_Change', 'Satisfaction_with_Remote_Work'];
      const field = stageFields[d.stage];
      if (!field) return;

      if (appState.selection.type === field && appState.selection.keys.has(d.name)) {
        appState.selection.type = null;
        appState.selection.keys = new Set();
      } else {
        appState.selection.type = field;
        appState.selection.keys = new Set([d.name]);
      }
      emit('selection:changed', appState.selection);
    })
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

  // Node labels (left of first column, right of last column, outside for middle)
  node.append('text')
    .attr('class', 'sankey-node-label')
    .attr('x', d => d.x0 < W / 2 ? -(NODE_WIDTH + 4) : (d.x1 - d.x0) + 4)
    .attr('y', d => (d.y1 - d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < W / 2 ? 'end' : 'start')
    .text(d => d.name)
    .style('pointer-events', 'none');

  // Stage headers
  const stageHeaders = ['Work Mode', 'Stress', 'Productivity', 'Satisfaction'];
  if (graph.nodes.length > 0) {
    const stageXPositions = [0, 1, 2, 3].map(si => {
      const stageNodes = graph.nodes.filter(n => n.stage === si);
      return stageNodes.length > 0 ? stageNodes[0].x0 + NODE_WIDTH / 2 : 0;
    });
    stageHeaders.forEach((label, si) => {
      if (stageXPositions[si]) {
        g.append('text')
          .attr('x', stageXPositions[si])
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .style('fill', SANKEY_STAGE_COLORS[si])
          .style('font-size', '10px')
          .style('font-weight', '600')
          .style('text-transform', 'uppercase')
          .style('letter-spacing', '0.05em')
          .text(label);
      }
    });
  }

  applySankeyDimming(container, graph);
}

function applySankeyDimming(container, graphArg) {
  const { type, keys } = appState.selection;

  d3.select(container).selectAll('.sankey-node rect')
    .classed('dimmed', function(d) {
      if (!type || !keys.size || !d) return false;
      const stageFields = ['Work_Location', 'Stress_Level', 'Productivity_Change', 'Satisfaction_with_Remote_Work'];
      return stageFields[d?.stage] === type && !keys.has(d.name);
    });

  d3.select(container).selectAll('.sankey-link')
    .classed('dimmed', function(d) {
      if (!type || !keys.size || !d) return false;
      if (type === 'Work_Location') return !keys.has(d.source?.name);
      if (type === 'Stress_Level')  return d.source?.name !== [...keys][0] && d.target?.name !== [...keys][0];
      return false;
    });
}
