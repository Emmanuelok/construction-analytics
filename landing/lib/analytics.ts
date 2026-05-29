/* In-browser tabular analytics — parser + profiler + statistical insight engine.
 * Ported verbatim from the studio app (src/lib/parse.ts + src/lib/insights.ts),
 * whose math is unit-tested. Self-contained (no app imports) so the landing page
 * can run REAL analysis on a user's file: this is the product, not a demo. */

export type Accent =
  | 'blue' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'teal' | 'fuchsia' | 'lime'

export type Table = { columns: string[]; rows: Record<string, string>[] }
export type ColType = 'number' | 'date' | 'boolean' | 'string'

export type ColumnProfile = {
  name: string
  type: ColType
  count: number
  missing: number
  unique: number
  min?: number
  max?: number
  mean?: number
  median?: number
  top?: { value: string; count: number }[]
  sample: string[]
}

/* ----------------------------------------------------------------- parsing */
export function parseDelimited(text: string, delimiter?: string): Table {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!clean) return { columns: [], rows: [] }
  const delim = delimiter ?? (clean.split('\n')[0].includes('\t') ? '\t' : ',')

  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      records.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  records.push(row)

  const header = (records.shift() ?? []).map((h, i) => h.trim() || `col_${i + 1}`)
  const rows = records
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {}
      header.forEach((h, i) => (obj[h] = (r[i] ?? '').trim()))
      return obj
    })
  return { columns: header, rows }
}

export function parseJsonTable(text: string): Table {
  const data = JSON.parse(text)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let arr: any[] = []
  if (Array.isArray(data)) arr = data
  else if (Array.isArray(data?.data)) arr = data.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else if (Array.isArray(data?.features)) arr = data.features.map((f: any) => ({ ...f.properties }))
  else if (data && typeof data === 'object') arr = [data]
  const columns = Array.from(new Set(arr.flatMap((o) => Object.keys(o ?? {}))))
  const rows = arr.map((o) => {
    const obj: Record<string, string> = {}
    columns.forEach((c) => {
      const v = o?.[c]
      obj[c] = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    })
    return obj
  })
  return { columns, rows }
}

export function parseAny(text: string, format?: string): Table {
  const f = (format ?? '').toUpperCase()
  if (f === 'JSON' || f === 'GEOJSON' || text.trim().startsWith('[') || text.trim().startsWith('{')) {
    try {
      return parseJsonTable(text)
    } catch {
      /* fall through to delimited */
    }
  }
  return parseDelimited(text)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/
function detectType(values: string[]): ColType {
  const nonEmpty = values.filter((v) => v !== '')
  if (!nonEmpty.length) return 'string'
  if (nonEmpty.every((v) => v === 'true' || v === 'false')) return 'boolean'
  if (nonEmpty.every((v) => !isNaN(Number(v.replace(/[,%$]/g, ''))))) return 'number'
  if (nonEmpty.every((v) => DATE_RE.test(v))) return 'date'
  return 'string'
}

export function num(v: string): number {
  return Number(String(v).replace(/[,%$\s]/g, ''))
}

export function profile(table: Table): ColumnProfile[] {
  return table.columns.map((name) => {
    const values = table.rows.map((r) => r[name] ?? '')
    const nonEmpty = values.filter((v) => v !== '')
    const type = detectType(values)
    const base: ColumnProfile = {
      name,
      type,
      count: values.length,
      missing: values.length - nonEmpty.length,
      unique: new Set(nonEmpty).size,
      sample: nonEmpty.slice(0, 3),
    }
    if (type === 'number') {
      const nums = nonEmpty.map(num).filter((n) => !isNaN(n)).sort((a, b) => a - b)
      if (nums.length) {
        base.min = nums[0]
        base.max = nums[nums.length - 1]
        base.mean = nums.reduce((s, n) => s + n, 0) / nums.length
        base.median = nums[Math.floor(nums.length / 2)]
      }
    } else {
      const counts = new Map<string, number>()
      nonEmpty.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1))
      base.top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }))
    }
    return base
  })
}

/* ----------------------------------------------------------------- stats */
export type FindingKind = 'correlation' | 'trend' | 'segment' | 'outlier' | 'concentration' | 'quality'
export type Finding = {
  id: string
  kind: FindingKind
  title: string
  detail: string
  stat?: string
  score: number
  accent: Accent
  columns: string[]
}

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

export function analyze(table: Table, cols: ColumnProfile[], opts: { max?: number } = {}): Finding[] {
  const findings: Finding[] = []
  if (!table.rows.length) return findings

  const numericNames = cols.filter((c) => c.type === 'number').map((c) => c.name)
  const dateNames = cols.filter((c) => c.type === 'date').map((c) => c.name)
  const catNames = cols
    .filter((c) => (c.type === 'string' || c.type === 'boolean') && c.unique > 1 && c.unique <= Math.max(20, table.rows.length * 0.5))
    .map((c) => c.name)

  const series = numericSeries(table, numericNames.slice(0, 12))

  /* 1. correlations */
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const a = series[i]
      const b = series[j]
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
        detail: `A ${corrWord(r)} ${r > 0 ? 'positive' : 'negative'} correlation (r = ${r.toFixed(2)}) across ${xs.length} rows — ${a.name} ${r > 0 ? 'tends to increase' : 'tends to decrease'} as ${b.name} increases. ${Math.abs(r) >= 0.8 ? 'Strong enough to be predictive.' : 'Worth investigating as a driver.'}`,
        stat: `r = ${r.toFixed(2)}`,
        score: 0.55 + Math.abs(r) * 0.45,
        accent: r > 0 ? 'emerald' : 'rose',
        columns: [a.name, b.name],
      })
    }
  }

  /* 2. trends */
  const axisName = dateNames[0] ?? null
  if (axisName) {
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

  /* 3. segment gaps */
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
      const stats = [...groups.entries()]
        .map(([k, arr]) => ({ k, n: arr.length, m: mean(arr) }))
        .filter((g) => g.n >= Math.max(3, all.length * 0.05))
      if (stats.length < 2) continue
      stats.sort((a, b) => b.m - a.m)
      const top = stats[0]
      const bottom = stats[stats.length - 1]
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

  /* 4. outliers */
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

  /* 5. concentration */
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

  /* 6. data quality */
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

  return findings.sort((a, b) => b.score - a.score).slice(0, opts.max ?? 8)
}
