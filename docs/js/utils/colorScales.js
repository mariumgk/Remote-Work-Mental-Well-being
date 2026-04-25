/**
 * Centralized D3 color scale definitions.
 * All charts import from here to keep encoding consistent.
 */

// ─── Stress Level ─────────────────────────────────────────────────────────

export const STRESS_COLORS = {
  Low:    '#38b2ac',
  Medium: '#f6ad55',
  High:   '#fc8181'
};

export const STRESS_ORDER = ['Low', 'Medium', 'High'];

export function stressColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(STRESS_ORDER)
    .range(STRESS_ORDER.map(k => STRESS_COLORS[k]));
}

// ─── Sleep Quality ────────────────────────────────────────────────────────

export const SLEEP_COLORS = {
  Good:    '#38b2ac',
  Average: '#f6ad55',
  Poor:    '#fc8181'
};

export const SLEEP_ORDER = ['Good', 'Average', 'Poor'];

export function sleepColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(SLEEP_ORDER)
    .range(SLEEP_ORDER.map(k => SLEEP_COLORS[k]));
}

// ─── Work Location ────────────────────────────────────────────────────────

export const WORK_LOCATION_COLORS = {
  Remote: '#9f7aea',
  Hybrid: '#58a6ff',
  Onsite: '#38b2ac'
};

export const WORK_LOCATION_ORDER = ['Remote', 'Hybrid', 'Onsite'];

export function workLocationColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(WORK_LOCATION_ORDER)
    .range(WORK_LOCATION_ORDER.map(k => WORK_LOCATION_COLORS[k]));
}

// ─── Productivity Change ──────────────────────────────────────────────────

export const PRODUCTIVITY_COLORS = {
  Increase:    '#38b2ac',
  'No Change': '#f6ad55',
  Decrease:    '#fc8181'
};

export const PRODUCTIVITY_ORDER = ['Increase', 'No Change', 'Decrease'];

export function productivityColorScale(d3) {
  return d3.scaleOrdinal()
    .domain(PRODUCTIVITY_ORDER)
    .range(PRODUCTIVITY_ORDER.map(k => PRODUCTIVITY_COLORS[k]));
}

// ─── Risk Level ───────────────────────────────────────────────────────────

export const RISK_COLORS = {
  'Low Risk':       '#38b2ac',
  'Moderate Risk':  '#f6ad55',
  'High Risk':      '#ed8936',
  'Very High Risk': '#fc8181'
};

export const RISK_ORDER = ['Low Risk', 'Moderate Risk', 'High Risk', 'Very High Risk'];

// ─── Heatmap sequential ───────────────────────────────────────────────────

export function heatmapColorScale(d3, domain, metric) {
  // For stress: low = teal, high = coral
  // For isolation: low = teal, high = coral
  // For WLB: low = coral (bad), high = teal (good)
  const isInverted = metric === 'avgWLB';

  if (isInverted) {
    return d3.scaleSequential()
      .domain(domain)
      .interpolator(d3.interpolateRgb('#fc8181', '#38b2ac'));
  }
  return d3.scaleSequential()
    .domain(domain)
    .interpolator(d3.interpolateRgb('#38b2ac', '#fc8181'));
}

// ─── Encode-aware scale factory ───────────────────────────────────────────

export function getColorScale(d3, colorBy) {
  switch (colorBy) {
    case 'Sleep_Quality':        return sleepColorScale(d3);
    case 'Work_Location':        return workLocationColorScale(d3);
    case 'Productivity_Change':  return productivityColorScale(d3);
    case 'Stress_Level':
    default:                     return stressColorScale(d3);
  }
}

export function getColorOrder(colorBy) {
  switch (colorBy) {
    case 'Sleep_Quality':        return SLEEP_ORDER;
    case 'Work_Location':        return WORK_LOCATION_ORDER;
    case 'Productivity_Change':  return PRODUCTIVITY_ORDER;
    case 'Stress_Level':
    default:                     return STRESS_ORDER;
  }
}

export function getColorField(colorBy) {
  return colorBy;  // field name matches the colorBy key
}

// Sankey stage colors (one per stage column)
export const SANKEY_STAGE_COLORS = ['#9f7aea', '#fc8181', '#f6ad55', '#38b2ac'];
