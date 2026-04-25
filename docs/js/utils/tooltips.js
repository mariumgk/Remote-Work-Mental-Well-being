/**
 * Shared tooltip utilities.
 * Creates a single floating tooltip div reused by all charts.
 */

let _tooltip = null;

export function getTooltip() {
  if (_tooltip) return _tooltip;
  _tooltip = document.createElement('div');
  _tooltip.className = 'd3-tooltip hidden';
  _tooltip.setAttribute('role', 'tooltip');
  _tooltip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_tooltip);
  return _tooltip;
}

/**
 * Show tooltip near pointer with arbitrary HTML content.
 * @param {MouseEvent} event
 * @param {string} html
 */
export function showTooltip(event, html) {
  const tip = getTooltip();
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  tip.setAttribute('aria-hidden', 'false');
  positionTooltip(event, tip);
}

export function hideTooltip() {
  const tip = getTooltip();
  tip.classList.add('hidden');
  tip.setAttribute('aria-hidden', 'true');
}

export function positionTooltip(event, tip) {
  const margin = 14;
  const { clientX: x, clientY: y } = event;
  const { innerWidth: vw, innerHeight: vh } = window;
  const tw = tip.offsetWidth  || 200;
  const th = tip.offsetHeight || 100;

  let left = x + margin;
  let top  = y + margin;

  if (left + tw > vw - margin) left = x - tw - margin;
  if (top  + th > vh - margin) top  = y - th - margin;

  tip.style.left = `${Math.max(margin, left)}px`;
  tip.style.top  = `${Math.max(margin, top)}px`;
}

/**
 * Build tooltip HTML from a title and array of {label, value} rows.
 */
export function buildTooltip(title, rows, extraRows) {
  const rowsHtml = rows.map(r =>
    `<div class="tooltip-row">
       <span>${r.label}</span>
       <span class="tooltip-row__value">${r.value}</span>
     </div>`
  ).join('');

  const extraHtml = extraRows
    ? `<hr class="tooltip-divider" />${extraRows.map(r =>
        `<div class="tooltip-row">
           <span>${r.label}</span>
           <span class="tooltip-row__value">${r.value}</span>
         </div>`
      ).join('')}`
    : '';

  return `<div class="tooltip-title">${title}</div>${rowsHtml}${extraHtml}`;
}
