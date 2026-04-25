/**
 * Centralized D3 color scale definitions — light theme.
 * All charts import from here to keep encoding consistent.
 */

// ─── Stress Level ─────────────────────────────────────────────────────────

export const STRESS_COLORS = {
  Low:    '#0d9488',
  Medium: '#d97706',
  High:   '#e85d5d'
};

export const STRESS_ORDER = ['Low', 'Medium', 'High'];

export function stressColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(STRESS_ORDER)
    .range(STRESS_ORDER.map(k => STRESS_COLORS[k]));
}

// ─── Sleep Quality ────────────────────────────────────────────────────────

export const SLEEP_COLORS = {
  Good:    '#0d9488',
  Average: '#d97706',
  Poor:    '#e85d5d'
};

export const SLEEP_ORDER = ['Good', 'Average', 'Poor'];

export function sleepColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(SLEEP_ORDER)
    .range(SLEEP_ORDER.map(k => SLEEP_COLORS[k]));
}

// ─── Work Location ────────────────────────────────────────────────────────

export const WORK_LOCATION_COLORS = {
  Remote: '#7c3aed',
  Hybrid: '#2b7de9',
  Onsite: '#0d9488'
};

export const WORK_LOCATION_ORDER = ['Remote', 'Hybrid', 'Onsite'];

export function workLocationColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(WORK_LOCATION_ORDER)
    .range(WORK_LOCATION_ORDER.map(k => WORK_LOCATION_COLORS[k]));
}

// ─── Productivity Change ──────────────────────────────────────────────────

export const PRODUCTIVITY_COLORS = {
  Increase:    '#0d9488',
  'No Change': '#d97706',
  Decrease:    '#e85d5d'
};

export const PRODUCTIVITY_ORDER = ['Increase', 'No Change', 'Decrease'];

export function productivityColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(PRODUCTIVITY_ORDER)
    .range(PRODUCTIVITY_ORDER.map(k => PRODUCTIVITY_COLORS[k]));
}

// ─── Risk Level ───────────────────────────────────────────────────────────

export const RISK_COLORS = {
  'Low Risk':       '#0d9488',
  'Moderate Risk':  '#d97706',
  'High Risk':      '#c2610c',
  'Very High Risk': '#e85d5d'
};

export const RISK_ORDER = ['Low Risk', 'Moderate Risk', 'High Risk', 'Very High Risk'];

// ─── Heatmap sequential ───────────────────────────────────────────────────

export function heatmapColorScale(d3, domain, metric) {
  // For WLB: low = red (bad), high = teal (good) — inverted
  const isInverted = metric === 'avgWLB';

  if (isInverted) {
    return d3.scaleSequential()
      .domain(domain)
      .interpolator(d3.interpolateRgb('#e85d5d', '#0d9488'));
  }
  return d3.scaleSequential()
    .domain(domain)
    .interpolator(d3.interpolateRgb('#b8f0ec', '#c2160c'));
}

// ─── Encode-aware scale factory ───────────────────────────────────────────

export function getColorScale(d3, colorBy) {
  switch (colorBy) {
    case 'Sleep_Quality':        return sleepColorScale(d3);
    case 'Work_Location':        return workLocationColorScale(d3);
    case 'Productivity_Change':  return productivityColorScale(d3);
    case 'Risk_Level': {
      return d3.scaleOrdinal()
        .domain(RISK_ORDER)
        .range(RISK_ORDER.map(k => RISK_COLORS[k]));
    }
    case 'Stress_Level':
    default:                     return stressColorScale(d3);
  }
}

export function getColorOrder(colorBy) {
  switch (colorBy) {
    case 'Sleep_Quality':        return SLEEP_ORDER;
    case 'Work_Location':        return WORK_LOCATION_ORDER;
    case 'Productivity_Change':  return PRODUCTIVITY_ORDER;
    case 'Risk_Level':           return RISK_ORDER;
    case 'Stress_Level':
    default:                     return STRESS_ORDER;
  }
}

export function getColorField(colorBy) {
  return colorBy;  // field name matches the colorBy key
}

// Sankey stage colors (one per stage column) — vivid on white
export const SANKEY_STAGE_COLORS = ['#7c3aed', '#e85d5d', '#d97706', '#0d9488'];
