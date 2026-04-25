/**
 * Shared application state and minimal event bus.
 * All chart modules read from and write to this single object.
 */

const _listeners = {};

export const appState = {
  data: {
    allRows: [],
    filteredRows: [],
    aggregates: {}
  },

  filters: {
    workLocation: new Set(),
    region:       new Set(),
    gender:       new Set(),
    industry:     new Set(),
    jobRole:      new Set(),
    stressLevel:  new Set(),
    ageGroup:     new Set(),
    hoursRange:   [0, 100]
  },

  selection: {
    type: null,   // 'workLocation' | 'region' | 'jobRole' | 'industry' | 'cell' | null
    keys: new Set()
  },

  encode: {
    colorBy: 'Stress_Level'  // 'Stress_Level' | 'Sleep_Quality' | 'Work_Location' | 'Productivity_Change'
  },

  reconfigure: {
    barGroupBy:     'Work_Location',  // 'Work_Location' | 'Industry' | 'Job_Role' | 'Age_Group'
    heatmapRows:    'Job_Role',       // 'Job_Role' | 'Industry'
    heatmapMetric:  'avgStress',      // 'avgStress' | 'avgIsolation' | 'avgWLB'
    regionalMetric: 'avgStress'
  },

  abstractMode: {
    scatter: 'aggregate',   // 'individual' | 'aggregate'
    sankey:  'absolute'     // 'absolute' | 'proportional'
  }
};

/** Subscribe to an event. Returns unsubscribe function. */
export function on(event, cb) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(cb);
  return () => off(event, cb);
}

/** Unsubscribe a specific callback. */
export function off(event, cb) {
  if (_listeners[event]) {
    _listeners[event] = _listeners[event].filter(fn => fn !== cb);
  }
}

/** Emit an event to all subscribers. */
export function emit(event, payload) {
  (_listeners[event] || []).forEach(cb => cb(payload));
}

/** Clear selection and emit. */
export function clearSelection() {
  appState.selection.type = null;
  appState.selection.keys = new Set();
  emit('selection:changed', appState.selection);
}
