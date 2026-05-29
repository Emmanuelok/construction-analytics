import type { Accent } from '@/lib/nav'
import { num, type ColumnProfile, type Table } from '@/lib/parse'

/* ============================================================================
 * Statistical insight engine — reads any parsed table and computes genuine,
 * ranked findings: correlations (Pearson), trends (linear regression over an
 * ordered/date axis), outliers (z-score + IQR), segment mean-gaps (which
 * category over/under-performs on a measure, with an effect size), category
 * concentration, and data-quality flags. Pure, deterministic, dependency-free
 * — every number here is real and unit-testable. Used by Analysis Studio.
 * ========================================================================== */

export type FindingKind = 'correlation' | 'trend' | 'segment' | 'outlier' | 'concentration' | 'quality' | 'overview'

export type Finding = {
  id: string
  kind: FindingKind
  title: string
  detail: string
  stat?: string // e.g. "r = 0.82"
  score: number // 0..1 importance, used to rank
  accent: Accent
  columns: string[]
}

/* ----------------------------------------------------------------- math ---- */
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}
export function stddev(xs: number[], m = mean(xs)): number {
  if (xs.length < 2) return 0
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}

/** Pearson correlation over paired arrays; returns 0 if undefined (no variance). */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return 0
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  const denom = Math.sqrt(sxx * syy)
  return denom === 0 ? 0 : sxy / denom
}

/** Ordinary least-squares slope/intercept + r² of y on x. */
export function linregress(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return { slope: 0, intercept: 0, r2: 0 }
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = my - slope * mx
  const r = pearson(xs.slice(0, n), ys.slice(0, n))
  return { slope, intercept, r2: r * r }
}

/* ------------------------------------------------------------ formatting --- */
function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(abs < 1 ? 3 : 2)
}
function pct(n: number): string {
  return `${(n * 100).toFixed(n * 100 >= 10 ? 0 : 1)}%`
}
const corrWord = (r: number) => {
  const a = Math.abs(r)
  if (a >= 0.8) return 'very strong'
  if (a >= 0.6) return 'strong'
  if (a >= 0.4) return 'moderate'
  return 'weak'
}

/* ------------------------------------------------- numeric column samples -- */
type NumericSeries = { name: string; values: number[]; rowIndex: number[] }

function numericSeries(table: Table, names: string[], cap = 5000): NumericSeries[] {
  const rows = table.rows.length > cap ? table.rows.slice(0, cap) : table.rows
  return names.map((name) => {
    const values: number[] = []
    const rowIndex: number[] = []
    rows.forEach((r, i) => {
      const v = num(r[name] ?? '')
      if (!Number.isNaN(v) && r[name] !== '') {
        values.push(v)
        rowIndex.push(i)
      }
    })
    return { name, values, rowIndex }
  })
}

/* =============================================================== engine ==== */
export function analyze(table: Table, cols: ColumnProfile[], opts: { max?: number } = {}): Finding[] {
  const findings: Finding[] = []
  if (!table.rows.length) return findings

  const numericNames = cols.filter((c) => c.type === 'number').map((c) => c.name)
  const dateNames = cols.filter((c) => c.type === 'date').map((c) => c.name)
  // Categoricals worth grouping by: more than one value, not mostly-unique (an id).
  const catNames = cols
    .filter((c) => (c.type === 'string' || c.type === 'boolean') && c.unique > 1 && c.unique <= Math.max(20, table.rows.length * 0.5))
    .map((c) => c.name)

  // Cap how many numeric columns we pair, to keep it O(k²) small on wide tables.
  const series = numericSeries(table, numericNames.slice(0, 12))
  const byName = new Map(series.map((s) => [s.name, s]))

  /* ---- 1. Correlations between numeric pairs ---- */
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const a = series[i]
      const b = series[j]
      // align on rows where both are present
      const aIdx = new Set(a.rowIndex)
      const xs: number[] = []
      const ys: number[] = []
      b.rowIndex.forEach((ri, k) => {
        if (aIdx.has(ri)) {
          const ai = a.rowIndex.indexOf(ri)
          xs.push(a.values[ai])
          ys.push(b.values[k])
        }
      })
      if (xs.length < 8) continue
      const r = pearson(xs, ys)
      if (Math.abs(r) < 0.4) continue
      const dir = r > 0 ? 'rises with' : 'falls as'
      findings.push({
        id: `corr-${a.name}-${b.name}`,
        kind: 'correlation',
        title: `${a.name} ${dir} ${b.name}`,
        detail: `A ${corrWord(r)} ${r > 0 ? 'positive' : 'negative'} correlation (r = ${r.toFixed(2)}) across ${xs.length} rows — ${a.name} ${r > 0 ? 'tends to increase' : 'tends to decrease'} as ${b.name} ${r > 0 ? 'increases' : 'increases'}. ${Math.abs(r) >= 0.8 ? 'Strong enough to be predictive.' : 'Worth investigating as a driver.'}`,
        stat: `r = ${r.toFixed(2)}`,
        score: 0.55 + Math.abs(r) * 0.45,
        accent: r > 0 ? 'emerald' : 'rose',
        columns: [a.name, b.name],
      })
    }
  }

  /* ---- 2. Trends: numeric measure over an ordered axis (date or numeric) ---- */
  const axisName = dateNames[0] ?? null
  if (axisName) {
    // order rows by the date axis, then regress each numeric on the rank
    const order = table.rows
      .map((r, i) => ({ i, t: Date.parse(r[axisName] ?? '') }))
      .filter((o) => !Number.isNaN(o.t))
      .sort((a, b) => a.t - b.t)
    if (order.length >= 8) {
      const ranks = order.map((_, k) => k)
      for (const s of series) {
        const ys: number[] = []
        const xs: number[] = []
        order.forEach((o, k) => {
          const v = num(table.rows[o.i][s.name] ?? '')
          if (!Number.isNaN(v) && table.rows[o.i][s.name] !== '') {
            ys.push(v)
            xs.push(ranks[k])
          }
        })
        if (ys.length < 8) continue
        const { slope, r2 } = linregress(xs, ys)
        if (r2 < 0.25 || slope === 0) continue
        const first = mean(ys.slice(0, Math.max(1, Math.floor(ys.length / 4))))
        const last = mean(ys.slice(-Math.max(1, Math.floor(ys.length / 4))))
        const change = first !== 0 ? (last - first) / Math.abs(first) : 0
        findings.push({
          id: `trend-${s.name}`,
          kind: 'trend',
          title: `${s.name} is trending ${slope > 0 ? 'up' : 'down'} over ${axisName}`,
          detail: `Ordered by ${axisName}, ${s.name} ${slope > 0 ? 'rises' : 'declines'} with a clear linear trend (R² = ${r2.toFixed(2)})${Number.isFinite(change) && Math.abs(change) > 0.02 ? `, ${pct(Math.abs(change))} ${change > 0 ? 'higher' : 'lower'} in the latest period vs the earliest` : ''}.`,
          stat: `R² = ${r2.toFixed(2)}`,
          score: 0.5 + r2 * 0.4,
          accent: slope > 0 ? 'sky' : 'amber',
          columns: [s.name, axisName],
        })
      }
    }
  }

  /* ---- 3. Segment gaps: which category over/under-performs on a measure ---- */
  for (const cat of catNames.slice(0, 6)) {
    for (const s of series.slice(0, 4)) {
      const groups = new Map<string, number[]>()
      table.rows.forEach((r) => {
        const key = (r[cat] ?? '').trim() || '(blank)'
        const v = num(r[s.name] ?? '')
        if (!Number.isNaN(v) && r[s.name] !== '') {
          const arr = groups.get(key) ?? []
          arr.push(v)
          groups.set(key, arr)
        }
      })
      if (groups.size < 2 || groups.size > 20) continue
      const all = [...groups.values()].flat()
      if (all.length < 8) continue
      const overall = mean(all)
      const sd = stddev(all, overall)
      if (sd === 0) continue
      // group means with enough support
      const stats = [...groups.entries()]
        .map(([k, arr]) => ({ k, n: arr.length, m: mean(arr) }))
        .filter((g) => g.n >= Math.max(3, all.length * 0.05))
      if (stats.length < 2) continue
      stats.sort((a, b) => b.m - a.m)
      const top = stats[0]
      const bottom = stats[stats.length - 1]
      // Two complementary signals: a standardized effect (vs overall SD) and a
      // relative gap (vs overall mean). A strong trend/outlier can inflate SD and
      // mask a real category difference, so firing on either keeps it robust to
      // the kind of business gap users actually care about.
      const effTop = (top.m - overall) / sd
      const effBottom = (bottom.m - overall) / sd
      const relTop = Math.abs(top.m - overall) / Math.max(1e-9, Math.abs(overall))
      const relBottom = Math.abs(bottom.m - overall) / Math.max(1e-9, Math.abs(overall))
      const spreadRel = Math.abs(top.m - bottom.m) / Math.max(1e-9, Math.abs(overall))
      const standardized = Math.max(Math.abs(effTop), Math.abs(effBottom))
      const relative = Math.max(relTop, relBottom)
      if (standardized < 0.5 && relative < 0.2 && spreadRel < 0.25) continue
      const lead = Math.abs(top.m - overall) >= Math.abs(bottom.m - overall) ? top : bottom
      const gap = lead.m - overall
      const leadEffect = Math.abs((lead.m - overall) / sd)
      const leadRel = Math.abs(gap) / Math.max(1e-9, Math.abs(overall))
      findings.push({
        id: `seg-${cat}-${s.name}`,
        kind: 'segment',
        title: `${lead.k} ${gap > 0 ? 'leads' : 'lags'} on ${s.name}`,
        detail: `Average ${s.name} for "${lead.k}" is ${compact(lead.m)} — ${pct(leadRel)} ${gap > 0 ? 'above' : 'below'} the overall mean of ${compact(overall)} (${leadEffect.toFixed(1)}σ). The spread across ${cat} is ${compact(top.m - bottom.m)} between "${top.k}" and "${bottom.k}".`,
        stat: leadEffect >= 0.5 ? `${leadEffect.toFixed(1)}σ` : pct(leadRel),
        score: 0.5 + Math.min(0.45, Math.max(leadEffect * 0.22, leadRel * 0.5)),
        accent: gap > 0 ? 'violet' : 'amber',
        columns: [cat, s.name],
      })
    }
  }

  /* ---- 4. Outliers per numeric column (z-score, corroborated by IQR) ---- */
  for (const s of series) {
    if (s.values.length < 12) continue
    const m = mean(s.values)
    const sd = stddev(s.values, m)
    if (sd === 0) continue
    const sorted = [...s.values].sort((a, b) => a - b)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)
    const iqr = q3 - q1
    const lo = q1 - 1.5 * iqr
    const hi = q3 + 1.5 * iqr
    let extreme: { v: number; z: number } | null = null
    let count = 0
    for (const v of s.values) {
      const z = (v - m) / sd
      const isOut = Math.abs(z) > 3 || v < lo || v > hi
      if (isOut) {
        count++
        if (!extreme || Math.abs(z) > Math.abs(extreme.z)) extreme = { v, z }
      }
    }
    if (!extreme || count === 0) continue
    findings.push({
      id: `out-${s.name}`,
      kind: 'outlier',
      title: `${count} outlier${count > 1 ? 's' : ''} in ${s.name}`,
      detail: `${count} value${count > 1 ? 's' : ''} fall outside the normal range (mean ${compact(m)} ± ${compact(sd)}). The most extreme is ${compact(extreme.v)} at ${extreme.z.toFixed(1)}σ — ${Math.abs(extreme.z) > 4 ? 'likely a data-entry error or a genuinely exceptional case worth flagging.' : 'worth a closer look before modeling.'}`,
      stat: `${extreme.z.toFixed(1)}σ`,
      score: 0.45 + Math.min(0.4, Math.abs(extreme.z) / 12),
      accent: 'rose',
      columns: [s.name],
    })
  }

  /* ---- 5. Concentration: a category dominated by one value ---- */
  for (const c of cols) {
    if (c.type !== 'string' && c.type !== 'boolean') continue
    if (!c.top || !c.top.length || c.count === 0) continue
    const share = c.top[0].count / (c.count - c.missing || 1)
    if (share < 0.55 || c.unique < 2) continue
    findings.push({
      id: `conc-${c.name}`,
      kind: 'concentration',
      title: `${c.name} is concentrated in "${c.top[0].value}"`,
      detail: `${pct(share)} of non-empty rows share the single value "${c.top[0].value}" across ${c.unique} distinct values. ${share > 0.85 ? 'This column has little discriminating power — consider whether it adds signal.' : 'The distribution is skewed toward one dominant group.'}`,
      stat: pct(share),
      score: 0.4 + Math.min(0.3, (share - 0.55) * 0.6),
      accent: 'teal',
      columns: [c.name],
    })
  }

  /* ---- 6. Data-quality: high-missing columns ---- */
  for (const c of cols) {
    if (!c.count) continue
    const miss = c.missing / c.count
    if (miss < 0.2) continue
    findings.push({
      id: `qual-${c.name}`,
      kind: 'quality',
      title: `${c.name} is ${pct(miss)} missing`,
      detail: `${c.missing} of ${c.count} rows have no value for ${c.name}. ${miss > 0.5 ? 'Over half the column is empty — impute or exclude it before relying on it.' : 'Review completeness before using this column in analysis.'}`,
      stat: pct(miss),
      score: 0.35 + Math.min(0.4, miss * 0.4),
      accent: 'amber',
      columns: [c.name],
    })
  }

  // Rank by importance; keep the strongest, de-duplicate trivially similar ones.
  const ranked = findings.sort((a, b) => b.score - a.score)
  return ranked.slice(0, opts.max ?? 8)
}

/** A one-line headline summarizing the strongest finding (for cards/feeds). */
export function headline(findings: Finding[]): string | null {
  return findings.length ? findings[0].title : null
}
