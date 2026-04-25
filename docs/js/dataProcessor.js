/**
 * CSV loading, missing value imputation, derived field computation,
 * EDA audit, and aggregate computation for all charts.
 */

// ─── Ordinal mappings ──────────────────────────────────────────────────────

const STRESS_SCORE   = { Low: 1, Medium: 2, High: 3 };
const SLEEP_SCORE    = { Poor: 1, Average: 2, Good: 3 };
const SATISFY_SCORE  = { Unsatisfied: 1, Neutral: 2, Satisfied: 3 };
const PRODUCT_SCORE  = { Decrease: 1, 'No Change': 2, Increase: 3 };

// ─── Process raw rows ─────────────────────────────────────────────────────

export function processData(rawRows) {
  const rows = rawRows.map(r => {
    // --- Missing value imputation ---
    const mhc = (r.Mental_Health_Condition || '').trim();
    const pa  = (r.Physical_Activity       || '').trim();

    const Mental_Health_Condition_Clean = mhc === '' ? 'Not Reported' : mhc;
    const Physical_Activity_Clean       = pa  === '' ? 'Not Reported' : pa;

    // --- Numeric casts ---
    const age       = +r.Age;
    const hours     = +r.Hours_Worked_Per_Week;
    const meetings  = +r.Number_of_Virtual_Meetings;
    const wlb       = +r.Work_Life_Balance_Rating;
    const isolation = +r.Social_Isolation_Rating;
    const yearsExp  = +r.Years_of_Experience;
    const companySup= +r.Company_Support_for_Remote_Work;

    // --- Grouped buckets ---
    const Age_Group = age < 30 ? '20s' : age < 40 ? '30s' : age < 50 ? '40s' : '50+';

    const Experience_Group =
      yearsExp <= 5  ? 'Junior (0–5)'  :
      yearsExp <= 15 ? 'Mid (6–15)'    : 'Senior (16+)';

    const Hours_Group =
      hours < 35  ? 'Light (<35)'     :
      hours <= 45 ? 'Normal (35–45)'  : 'Heavy (45+)';

    const Meetings_Group =
      meetings < 5  ? 'Few (0–4)'      :
      meetings < 10 ? 'Moderate (5–9)' : 'Many (10+)';

    // --- Ordinal scores ---
    const Stress_Score      = STRESS_SCORE[r.Stress_Level]   ?? 2;
    const Sleep_Quality_Score    = SLEEP_SCORE[r.Sleep_Quality]   ?? 2;
    const Satisfaction_Score     = SATISFY_SCORE[r.Satisfaction_with_Remote_Work] ?? 2;
    const Productivity_Score     = PRODUCT_SCORE[r.Productivity_Change]           ?? 2;

    // --- Composite risk score: range 4–14 ---
    // higher = more risk across 4 dimensions
    const Risk_Score =
      Stress_Score +                    // 1–3
      (4 - wlb) +                       // 3 (bad) → 0 (good) — wlb 1→3, wlb 5→-1 clamped to 0
      isolation +                       // 1–5
      (4 - Sleep_Quality_Score);        // 3 (poor) → 1 (good)

    const Risk_Level =
      Risk_Score <= 6  ? 'Low Risk'       :
      Risk_Score <= 9  ? 'Moderate Risk'  :
      Risk_Score <= 11 ? 'High Risk'      : 'Very High Risk';

    // --- Extreme-risk flag ---
    const High_Risk_Flag =
      r.Stress_Level === 'High' &&
      r.Sleep_Quality === 'Poor' &&
      isolation >= 4 &&
      wlb <= 2;

    return {
      ...r,
      // ensure numeric types
      Age:  age, Years_of_Experience: yearsExp, Hours_Worked_Per_Week: hours,
      Number_of_Virtual_Meetings: meetings, Work_Life_Balance_Rating: wlb,
      Social_Isolation_Rating: isolation, Company_Support_for_Remote_Work: companySup,
      Satisfaction_with_Remote_Work: r.Satisfaction_with_Remote_Work,
      // imputed
      Mental_Health_Condition_Clean,
      Physical_Activity_Clean,
      // grouped
      Age_Group, Experience_Group, Hours_Group, Meetings_Group,
      // scores
      Stress_Score, Sleep_Quality_Score, Satisfaction_Score, Productivity_Score,
      Risk_Score, Risk_Level, High_Risk_Flag
    };
  });

  return rows;
}

// ─── EDA Audit ────────────────────────────────────────────────────────────

export function runEDA(rows) {
  console.group('[EDA] Remote Work Mental Health Dataset Audit');

  // 1. Row count
  console.log(`Total rows: ${rows.length}`);

  // 2. Missing value check on original columns
  const missingMHC = rows.filter(r => (r.Mental_Health_Condition || '').trim() === '').length;
  const missingPA  = rows.filter(r => (r.Physical_Activity       || '').trim() === '').length;
  console.log(`Missing Mental_Health_Condition: ${missingMHC} (${pct(missingMHC, rows.length)}%)`);
  console.log(`Missing Physical_Activity: ${missingPA} (${pct(missingPA, rows.length)}%)`);

  // 3. Frequency counts for key categorical columns
  const cats = ['Work_Location','Stress_Level','Gender','Industry','Job_Role',
                 'Region','Sleep_Quality','Productivity_Change',
                 'Satisfaction_with_Remote_Work','Access_to_Mental_Health_Resources',
                 'Mental_Health_Condition_Clean','Physical_Activity_Clean'];

  cats.forEach(col => {
    const freq = freqCount(rows, col);
    console.log(`[${col}]`, Object.fromEntries(
      Object.entries(freq).sort((a,b) => b[1]-a[1])
    ));
  });

  // 4. Numeric summary
  const nums = ['Age','Hours_Worked_Per_Week','Number_of_Virtual_Meetings',
                 'Work_Life_Balance_Rating','Social_Isolation_Rating',
                 'Company_Support_for_Remote_Work','Stress_Score','Risk_Score'];

  nums.forEach(col => {
    const vals = rows.map(r => r[col]).filter(v => v != null && !isNaN(v));
    vals.sort((a,b) => a-b);
    console.log(`[${col}] min=${vals[0]} max=${vals[vals.length-1]} mean=${mean(vals).toFixed(2)} median=${median(vals)}`);
  });

  // 5. Stress by Work_Location
  console.log('[Stress by Work_Location]');
  const wlGroups = groupBy(rows, 'Work_Location');
  Object.entries(wlGroups).forEach(([wl, rs]) => {
    const freq = freqCount(rs, 'Stress_Level');
    const highPct = pct(freq.High || 0, rs.length);
    console.log(`  ${wl}: ${rs.length} employees, High Stress: ${highPct}%`);
  });

  // 6. Missing value breakdown by Work_Location
  console.log('[Missing Mental_Health_Condition by Work_Location]');
  Object.entries(wlGroups).forEach(([wl, rs]) => {
    const m = rs.filter(r => (r.Mental_Health_Condition || '').trim() === '').length;
    console.log(`  ${wl}: ${m} missing (${pct(m, rs.length)}%)`);
  });

  // 7. Risk_Level distribution
  const riskFreq = freqCount(rows, 'Risk_Level');
  console.log('[Risk_Level distribution]', riskFreq);

  // 8. High_Risk_Flag count
  const flagCount = rows.filter(r => r.High_Risk_Flag).length;
  console.log(`High_Risk_Flag (extreme): ${flagCount} (${pct(flagCount, rows.length)}%)`);

  // 9. Sankey flow volume check (min path count)
  let minFlow = Infinity;
  ['Remote','Hybrid','Onsite'].forEach(wl => {
    ['Low','Medium','High'].forEach(sl => {
      ['Decrease','No Change','Increase'].forEach(pc => {
        ['Unsatisfied','Neutral','Satisfied'].forEach(sat => {
          const n = rows.filter(r =>
            r.Work_Location === wl &&
            r.Stress_Level === sl &&
            r.Productivity_Change === pc &&
            r.Satisfaction_with_Remote_Work === sat
          ).length;
          if (n > 0 && n < minFlow) minFlow = n;
        });
      });
    });
  });
  console.log(`Sankey min path count: ${minFlow} (should be >= 1 for all visible paths)`);

  console.groupEnd();
}

// ─── Aggregate computation ────────────────────────────────────────────────

export function computeAggregates(rows, reconfigure) {
  const groupBy_bar    = reconfigure?.barGroupBy    || 'Work_Location';
  const heatmapRows_   = reconfigure?.heatmapRows   || 'Job_Role';
  const heatmapMetric_ = reconfigure?.heatmapMetric || 'avgStress';
  const totalN = rows.length;

  // KPI stats
  const kpi = computeKPI(rows, totalN);

  // Bar chart data: group by chosen dimension × Stress_Level
  const barData = computeBarData(rows, groupBy_bar);

  // Heatmap: rows × Work_Location (or Region if heatmapRows = Industry × Region)
  const heatmapData = computeHeatmapData(rows, heatmapRows_, heatmapMetric_);

  // Scatter aggregate
  const scatterAgg = computeScatterAgg(rows);

  // Sankey
  const sankeyData = computeSankeyData(rows);

  // Regional
  const regionalData = computeRegionalData(rows);

  // Story stats
  const storyStats = computeStoryStats(rows);

  return { kpi, barData, heatmapData, scatterAgg, sankeyData, regionalData, storyStats };
}

// ─── KPI ──────────────────────────────────────────────────────────────────

function computeKPI(rows, totalN) {
  const n = rows.length;
  if (n === 0) return { n: 0 };

  const wlCount = freqCount(rows, 'Work_Location');
  const highStress = rows.filter(r => r.Stress_Level === 'High').length;
  const avgWLB = mean(rows.map(r => r.Work_Life_Balance_Rating));
  const avgIsolation = mean(rows.map(r => r.Social_Isolation_Rating));
  const highRisk = rows.filter(r => r.High_Risk_Flag).length;
  const veryHighRisk = rows.filter(r => r.Risk_Level === 'Very High Risk').length;
  const accessYes = rows.filter(r => r.Access_to_Mental_Health_Resources === 'Yes').length;
  const avgStressScore = mean(rows.map(r => r.Stress_Score));
  const avgRiskScore = mean(rows.map(r => r.Risk_Score));

  // missing count (frozen at dataset level)
  const missingMHC = rows.filter(r => r.Mental_Health_Condition_Clean === 'Not Reported').length;

  return {
    n, totalN,
    remote:  wlCount.Remote  || 0,
    hybrid:  wlCount.Hybrid  || 0,
    onsite:  wlCount.Onsite  || 0,
    highStress, highStressPct: pct(highStress, n),
    avgWLB:       +avgWLB.toFixed(2),
    avgIsolation: +avgIsolation.toFixed(2),
    highRisk, highRiskPct: pct(highRisk, n),
    veryHighRisk, veryHighRiskPct: pct(veryHighRisk, n),
    accessYes, accessYesPct: pct(accessYes, n),
    avgStressScore: +avgStressScore.toFixed(2),
    avgRiskScore:   +avgRiskScore.toFixed(2),
    missingMHC
  };
}

// ─── Bar chart ────────────────────────────────────────────────────────────

export function computeBarData(rows, groupDim) {
  const stressLevels = ['Low', 'Medium', 'High'];
  const groups = [...new Set(rows.map(r => r[groupDim]))].sort();

  return groups.map(g => {
    const subset = rows.filter(r => r[groupDim] === g);
    const entry = { group: g, total: subset.length };
    stressLevels.forEach(sl => {
      entry[sl] = subset.filter(r => r.Stress_Level === sl).length;
      entry[sl + '_pct'] = pct(entry[sl], subset.length);
    });
    return entry;
  });
}

// ─── Heatmap ──────────────────────────────────────────────────────────────

function computeHeatmapData(rows, rowDim, metric) {
  const rowKeys = [...new Set(rows.map(r => r[rowDim]))].sort();
  const colKeys = [...new Set(rows.map(r => r.Work_Location))].sort();

  const cells = [];
  rowKeys.forEach(rk => {
    colKeys.forEach(ck => {
      const subset = rows.filter(r => r[rowDim] === rk && r.Work_Location === ck);
      if (subset.length === 0) {
        cells.push({ rowKey: rk, colKey: ck, value: null, n: 0 });
        return;
      }
      const avgStress    = mean(subset.map(r => r.Stress_Score));
      const avgIsolation = mean(subset.map(r => r.Social_Isolation_Rating));
      const avgWLB       = mean(subset.map(r => r.Work_Life_Balance_Rating));

      const value = metric === 'avgStress'    ? avgStress    :
                    metric === 'avgIsolation' ? avgIsolation : avgWLB;

      cells.push({
        rowKey: rk, colKey: ck,
        value: +value.toFixed(2), n: subset.length,
        avgStress: +avgStress.toFixed(2),
        avgIsolation: +avgIsolation.toFixed(2),
        avgWLB: +avgWLB.toFixed(2)
      });
    });
  });

  return { cells, rowKeys, colKeys, metric };
}

// ─── Scatter aggregated ───────────────────────────────────────────────────

function computeScatterAgg(rows) {
  const hoursGroups   = ['Light (<35)', 'Normal (35–45)', 'Heavy (45+)'];
  const stressLevels  = ['Low', 'Medium', 'High'];
  const result = [];

  hoursGroups.forEach(hg => {
    stressLevels.forEach(sl => {
      const subset = rows.filter(r => r.Hours_Group === hg && r.Stress_Level === sl);
      if (subset.length === 0) return;
      result.push({
        Hours_Group: hg,
        Stress_Level: sl,
        n: subset.length,
        avgHours:     +mean(subset.map(r => r.Hours_Worked_Per_Week)).toFixed(1),
        avgIsolation: +mean(subset.map(r => r.Social_Isolation_Rating)).toFixed(2),
        avgMeetings:  +mean(subset.map(r => r.Number_of_Virtual_Meetings)).toFixed(1),
        avgWLB:       +mean(subset.map(r => r.Work_Life_Balance_Rating)).toFixed(2),
        avgSleep:     +mean(subset.map(r => r.Sleep_Quality_Score)).toFixed(2)
      });
    });
  });

  return result;
}

// ─── Sankey ───────────────────────────────────────────────────────────────

export function computeSankeyData(rows) {
  const stages = [
    { field: 'Work_Location',             values: ['Remote','Hybrid','Onsite'] },
    { field: 'Stress_Level',              values: ['Low','Medium','High'] },
    { field: 'Productivity_Change',       values: ['Increase','No Change','Decrease'] },
    { field: 'Satisfaction_with_Remote_Work', values: ['Satisfied','Neutral','Unsatisfied'] }
  ];

  // Build nodes with stage index
  const nodes = [];
  const nodeIndex = {};
  stages.forEach((stage, si) => {
    stage.values.forEach(v => {
      const key = `${si}:${v}`;
      nodeIndex[key] = nodes.length;
      nodes.push({ name: v, stage: si });
    });
  });

  // Build links between consecutive stages
  const links = [];
  for (let si = 0; si < stages.length - 1; si++) {
    const src  = stages[si];
    const tgt  = stages[si + 1];
    src.values.forEach(sv => {
      tgt.values.forEach(tv => {
        const n = rows.filter(r => r[src.field] === sv && r[tgt.field] === tv).length;
        if (n > 0) {
          links.push({
            source: nodeIndex[`${si}:${sv}`],
            target: nodeIndex[`${si+1}:${tv}`],
            value: n
          });
        }
      });
    });
  }

  return { nodes, links, stages, total: rows.length };
}

// ─── Regional ─────────────────────────────────────────────────────────────

function computeRegionalData(rows) {
  const regions = [...new Set(rows.map(r => r.Region))].sort();
  return regions.map(region => {
    const subset = rows.filter(r => r.Region === region);
    const n = subset.length;
    return {
      region,
      n,
      avgStress:    +mean(subset.map(r => r.Stress_Score)).toFixed(2),
      avgIsolation: +mean(subset.map(r => r.Social_Isolation_Rating)).toFixed(2),
      avgWLB:       +mean(subset.map(r => r.Work_Life_Balance_Rating)).toFixed(2),
      sleepGoodRate:  +pct(subset.filter(r => r.Sleep_Quality === 'Good').length, n),
      accessRate:     +pct(subset.filter(r => r.Access_to_Mental_Health_Resources === 'Yes').length, n),
      highStressRate: +pct(subset.filter(r => r.Stress_Level === 'High').length, n),
      highRiskRate:   +pct(subset.filter(r => r.High_Risk_Flag).length, n)
    };
  });
}

// ─── Story stats ──────────────────────────────────────────────────────────

function computeStoryStats(rows) {
  const n = rows.length;
  if (n === 0) return {};

  // Story 1: work mode stress
  const wlHighStress = {};
  ['Remote','Hybrid','Onsite'].forEach(wl => {
    const sub = rows.filter(r => r.Work_Location === wl);
    const hs  = sub.filter(r => r.Stress_Level === 'High').length;
    wlHighStress[wl] = { n: sub.length, highPct: pct(hs, sub.length) };
  });

  // Story 2: company support correlation
  const highSupport = rows.filter(r => r.Company_Support_for_Remote_Work >= 4);
  const lowSupport  = rows.filter(r => r.Company_Support_for_Remote_Work <= 2);
  const supportStats = {
    highSupportWLB:  +mean(highSupport.map(r => r.Work_Life_Balance_Rating)).toFixed(2),
    lowSupportWLB:   +mean(lowSupport.map(r => r.Work_Life_Balance_Rating)).toFixed(2),
    highSupportIso:  +mean(highSupport.map(r => r.Social_Isolation_Rating)).toFixed(2),
    lowSupportIso:   +mean(lowSupport.map(r => r.Social_Isolation_Rating)).toFixed(2)
  };

  // Story 3: risk group
  const vhr = rows.filter(r => r.Risk_Level === 'Very High Risk');
  const highRiskCount = rows.filter(r => r.High_Risk_Flag).length;

  return {
    wlHighStress, supportStats,
    veryHighRiskCount: vhr.length,
    veryHighRiskPct: pct(vhr.length, n),
    highRiskFlagCount: highRiskCount,
    highRiskFlagPct: pct(highRiskCount, n)
  };
}

// ─── Detail panel data ────────────────────────────────────────────────────

export function computeDetailData(rows, allRows) {
  const n = rows.length;
  const totalN = allRows.length;
  if (n === 0) return null;

  const overall = {
    avgStress:    mean(allRows.map(r => r.Stress_Score)),
    avgWLB:       mean(allRows.map(r => r.Work_Life_Balance_Rating)),
    avgIsolation: mean(allRows.map(r => r.Social_Isolation_Rating)),
    avgHours:     mean(allRows.map(r => r.Hours_Worked_Per_Week))
  };

  const avgStress    = mean(rows.map(r => r.Stress_Score));
  const avgWLB       = mean(rows.map(r => r.Work_Life_Balance_Rating));
  const avgIsolation = mean(rows.map(r => r.Social_Isolation_Rating));
  const avgHours     = mean(rows.map(r => r.Hours_Worked_Per_Week));
  const avgMeetings  = mean(rows.map(r => r.Number_of_Virtual_Meetings));

  const stressFreq  = freqCount(rows, 'Stress_Level');
  const mhcFreq     = freqCount(rows, 'Mental_Health_Condition_Clean');
  const riskFreq    = freqCount(rows, 'Risk_Level');
  const highRiskN   = rows.filter(r => r.High_Risk_Flag).length;

  return {
    n, pctOfTotal: pct(n, totalN),
    avgStress:    +avgStress.toFixed(2),
    avgWLB:       +avgWLB.toFixed(2),
    avgIsolation: +avgIsolation.toFixed(2),
    avgHours:     +avgHours.toFixed(1),
    avgMeetings:  +avgMeetings.toFixed(1),
    stressFreq,
    mhcFreq,
    riskFreq,
    highRiskN, highRiskPct: pct(highRiskN, n),
    deltas: {
      stress:    +(avgStress    - overall.avgStress).toFixed(2),
      wlb:       +(avgWLB       - overall.avgWLB).toFixed(2),
      isolation: +(avgIsolation - overall.avgIsolation).toFixed(2),
      hours:     +(avgHours     - overall.avgHours).toFixed(1)
    }
  };
}

// ─── Filtering ────────────────────────────────────────────────────────────

export function applyFilters(allRows, filters) {
  return allRows.filter(r => {
    if (filters.workLocation.size > 0 && !filters.workLocation.has(r.Work_Location)) return false;
    if (filters.region.size       > 0 && !filters.region.has(r.Region))             return false;
    if (filters.gender.size       > 0 && !filters.gender.has(r.Gender))             return false;
    if (filters.industry.size     > 0 && !filters.industry.has(r.Industry))         return false;
    if (filters.jobRole.size      > 0 && !filters.jobRole.has(r.Job_Role))          return false;
    if (filters.stressLevel.size  > 0 && !filters.stressLevel.has(r.Stress_Level))  return false;
    if (filters.ageGroup.size     > 0 && !filters.ageGroup.has(r.Age_Group))        return false;
    const [minH, maxH] = filters.hoursRange;
    // Only apply hours filter when range has been explicitly narrowed (default [0,100] = all-pass)
    if (!(minH === 0 && maxH === 100)) {
      if (r.Hours_Worked_Per_Week < minH || r.Hours_Worked_Per_Week > maxH) return false;
    }
    return true;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

export function freqCount(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? 'null';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function median(sorted) {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[m - 1] + sorted[m]) / 2
    : sorted[m];
}

export function pct(n, total) {
  if (!total) return 0;
  return +((n / total) * 100).toFixed(1);
}
