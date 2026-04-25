/**
 * Renders KPI cards in hero, overview, and story sections.
 */

function pct(n, total) {
  if (!total) return 0;
  return +((n / total) * 100).toFixed(1);
}

export function renderHeroCards(kpi, container) {
  if (!container) return;
  container.innerHTML = `
    <div class="hero-card hero-card--teal" role="listitem">
      <div class="hero-card__value">${kpi.n?.toLocaleString() || 0}</div>
      <div class="hero-card__label">Employees in dataset</div>
    </div>
    <div class="hero-card hero-card--coral" role="listitem">
      <div class="hero-card__value">${kpi.highStressPct ?? 0}%</div>
      <div class="hero-card__label">Reporting high stress</div>
    </div>
    <div class="hero-card hero-card--amber" role="listitem">
      <div class="hero-card__value">${kpi.highRiskPct ?? 0}%</div>
      <div class="hero-card__label">Extreme risk group (4 factors)</div>
    </div>
  `;
}

export function renderKpiGrid(kpi, container) {
  if (!container) return;

  const remotePct = pct(kpi.remote || 0, kpi.n || 1);
  const hybridPct = pct(kpi.hybrid || 0, kpi.n || 1);
  const onsitePct = pct(kpi.onsite || 0, kpi.n || 1);

  container.setAttribute('aria-label', 'Dataset key metrics');
  container.innerHTML = [
    kpiCard(kpi.n?.toLocaleString(), 'Employees (filtered)', `of ${(kpi.totalN || 5000).toLocaleString()} total`),
    kpiCard(`${remotePct}%`, 'Work Remotely', `${(kpi.remote||0).toLocaleString()} employees`),
    kpiCard(`${hybridPct}%`, 'Work Hybrid', `${(kpi.hybrid||0).toLocaleString()} employees`),
    kpiCard(`${onsitePct}%`, 'Work Onsite', `${(kpi.onsite||0).toLocaleString()} employees`),
    kpiCard(`${kpi.highStressPct ?? 0}%`, 'High Stress', `${(kpi.highStress||0).toLocaleString()} employees`),
    kpiCard(kpi.avgWLB ?? '—', 'Avg Work-Life Balance', 'Scale 1–5'),
    kpiCard(kpi.avgIsolation ?? '—', 'Avg Social Isolation', 'Scale 1–5'),
    kpiCard(`${kpi.accessYesPct ?? 0}%`, 'Mental Health Access', 'Have access to resources'),
    kpiCard(`${kpi.veryHighRiskPct ?? 0}%`, 'Very High Risk', `Risk Score > 11`),
    kpiCard(kpi.avgRiskScore ?? '—', 'Avg Risk Score', 'Scale 4–14')
  ].join('');
}

function kpiCard(value, label, sub) {
  return `
    <div class="kpi-card" role="listitem">
      <span class="kpi-card__value">${value}</span>
      <span class="kpi-card__label">${label}</span>
      ${sub ? `<span class="kpi-card__sub">${sub}</span>` : ''}
    </div>`;
}

export function renderStoryStats(stats, allKpi) {
  // Story 1 — work mode stress
  const s1 = document.getElementById('story-stats-1');
  if (s1 && stats.wlHighStress) {
    s1.innerHTML = Object.entries(stats.wlHighStress).map(([wl, d]) =>
      `<div class="story-stat">
         <span class="story-stat__label">${wl}</span>
         <span class="story-stat__value">${d.highPct}% high stress (${d.n.toLocaleString()} employees)</span>
       </div>`
    ).join('');
  }

  // Story 2 — company support
  const s2 = document.getElementById('story-stats-2');
  if (s2 && stats.supportStats) {
    const ss = stats.supportStats;
    s2.innerHTML = `
      <div class="story-stat">
        <span class="story-stat__label">High company support (4–5)</span>
        <span class="story-stat__value">WLB avg: ${ss.highSupportWLB} · Isolation avg: ${ss.highSupportIso}</span>
      </div>
      <div class="story-stat">
        <span class="story-stat__label">Low company support (1–2)</span>
        <span class="story-stat__value">WLB avg: ${ss.lowSupportWLB} · Isolation avg: ${ss.lowSupportIso}</span>
      </div>`;
  }

  // Story 3 — risk
  const s3 = document.getElementById('story-stats-3');
  if (s3) {
    s3.innerHTML = `
      <div class="story-stat">
        <span class="story-stat__label">Very High Risk employees</span>
        <span class="story-stat__value">${stats.veryHighRiskCount?.toLocaleString()} (${stats.veryHighRiskPct}%)</span>
      </div>
      <div class="story-stat">
        <span class="story-stat__label">Extreme risk (all 4 factors)</span>
        <span class="story-stat__value">${stats.highRiskFlagCount?.toLocaleString()} (${stats.highRiskFlagPct}%)</span>
      </div>`;
  }
}

export function renderConclusionCards(kpi, stats, container) {
  if (!container) return;
  container.innerHTML = `
    <div class="conclusion-card">
      <div class="conclusion-card__icon">📍</div>
      <div class="conclusion-card__title">Work Mode Distribution</div>
      <div class="conclusion-card__body">
        Remote: ${pct(kpi.remote||0, kpi.n||1)}% · Hybrid: ${pct(kpi.hybrid||0, kpi.n||1)}% · Onsite: ${pct(kpi.onsite||0, kpi.n||1)}%
        of the ${(kpi.n||0).toLocaleString()} employees analyzed.
      </div>
    </div>
    <div class="conclusion-card">
      <div class="conclusion-card__icon">📊</div>
      <div class="conclusion-card__title">Stress &amp; Risk Patterns</div>
      <div class="conclusion-card__body">
        ${kpi.highStressPct}% report high stress. ${kpi.veryHighRiskPct}% fall into the Very High Risk tier
        (Risk Score > 11 across multiple wellbeing dimensions).
      </div>
    </div>
    <div class="conclusion-card">
      <div class="conclusion-card__icon">🏥</div>
      <div class="conclusion-card__title">Mental Health Resources</div>
      <div class="conclusion-card__body">
        ${kpi.accessYesPct}% of employees report having access to mental health resources.
        Use the Region filter to explore geographic disparities.
      </div>
    </div>
    <div class="conclusion-card">
      <div class="conclusion-card__icon">⚡</div>
      <div class="conclusion-card__title">Company Support Association</div>
      <div class="conclusion-card__body">
        Employees with high company support (4–5) show avg WLB of ${stats.supportStats?.highSupportWLB ?? '—'} vs
        ${stats.supportStats?.lowSupportWLB ?? '—'} for low support — a pattern worth exploring further.
      </div>
    </div>`;
}

export function updateSampleCounter(n, warn = false) {
  const counter = document.getElementById('sample-count');
  const warning = document.getElementById('sample-warning');
  if (counter) counter.textContent = n.toLocaleString();
  if (warning) {
    if (warn) { warning.removeAttribute('hidden'); }
    else      { warning.setAttribute('hidden', ''); }
  }
}
