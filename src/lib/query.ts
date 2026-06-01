/* Deterministic natural-language analytics — pure, unit-tested. Parses a plain
 * English question and computes a real answer over the portfolio/supplier data:
 * superlatives (highest/lowest), aggregates (average/total/count), group-by
 * (compare across sectors), and filtered lists (over budget, late, high-risk).
 * No LLM, no canned prose — every number is computed. This is the deterministic
 * brain behind the Ask console when no model key is configured; if a question
 * isn't understood it says so (and suggests examples) instead of guessing. */

import type { Project, Supplier } from '@/data/platform'

export type Unit = 'pct' | 'days' | 'money' | 'num' | 'score'
export type QueryData = { projects: Project[]; suppliers: Supplier[] }
export type QChart = { data: { name: string; value: number }[]; label: string; unit: Unit; accent: string }
export type QueryResult = {
  matched: boolean
  answer: string
  sql: string
  domains: string[]
  chart?: QChart
}

const round = (n: number, d = 1) => { const m = 10 ** d; return Math.round(n * m) / m }
const short = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function money(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${round(n / 1e9, 2)}B`
  if (a >= 1e6) return `$${round(n / 1e6, 0)}M`
  if (a >= 1e3) return `$${round(n / 1e3, 0)}K`
  return `$${Math.round(n)}`
}
function fmt(unit: Unit, v: number, signed = false): string {
  const sign = signed && v > 0 ? '+' : ''
  switch (unit) {
    case 'pct': return `${sign}${round(v)}%`
    case 'days': return `${sign}${Math.round(v)} days`
    case 'money': return money(v)
    case 'score': return `${Math.round(v)}/100`
    default: return Math.round(v).toLocaleString()
  }
}

type Metric<T> = { id: string; kws: string[]; label: string; unit: Unit; get: (x: T) => number; better: 'high' | 'low'; domain: string; signed?: boolean }

const P_METRICS: Metric<Project>[] = [
  { id: 'costVariance', kws: ['cost variance', 'overrun', 'over budget', 'over-budget', 'over their budget', 'cost overrun', 'budget'], label: 'cost variance', unit: 'pct', get: (p) => p.costVariance, better: 'low', domain: 'Cost & Schedule', signed: true },
  { id: 'scheduleVariance', kws: ['schedule', 'slip', 'delay', 'behind', 'late', 'days late'], label: 'schedule slip', unit: 'days', get: (p) => p.scheduleVariance, better: 'low', domain: 'Schedule & Controls', signed: true },
  { id: 'value', kws: ['value', 'contract value', 'portfolio value', 'worth', 'capital', 'biggest', 'largest'], label: 'contract value', unit: 'money', get: (p) => p.value, better: 'high', domain: 'Project Master Data' },
  { id: 'progress', kws: ['progress', 'complete', 'completion'], label: 'progress', unit: 'pct', get: (p) => p.progress, better: 'high', domain: 'Schedule & Controls' },
  { id: 'risk', kws: ['risk'], label: 'risk index', unit: 'score', get: (p) => p.risk, better: 'low', domain: 'Health, Safety & Risk' },
  { id: 'safety', kws: ['safety'], label: 'safety score', unit: 'score', get: (p) => p.safety, better: 'high', domain: 'Health, Safety & Risk' },
  { id: 'quality', kws: ['quality'], label: 'quality score', unit: 'score', get: (p) => p.quality, better: 'high', domain: 'Quality' },
  { id: 'carbon', kws: ['carbon', 'embodied', 'emission', 'co2', 'co₂'], label: 'embodied carbon', unit: 'num', get: (p) => p.carbon, better: 'low', domain: 'Sustainability & ESG' },
  { id: 'gfa', kws: ['gfa', 'floor area', 'square met', 'square-met'], label: 'gross floor area', unit: 'num', get: (p) => p.gfa, better: 'high', domain: 'Project Master Data' },
  { id: 'rfis', kws: ['rfi', 'rfis', 'request for information'], label: 'open RFIs', unit: 'num', get: (p) => p.rfis, better: 'low', domain: 'Communications' },
  { id: 'clashes', kws: ['clash', 'clashes'], label: 'clashes', unit: 'num', get: (p) => p.clashes, better: 'low', domain: 'BIM & Models' },
]
const S_METRICS: Metric<Supplier>[] = [
  { id: 'leadTime', kws: ['lead time', 'lead-time', 'leadtime', 'delivery time', 'longest lead'], label: 'lead time', unit: 'days', get: (s) => s.leadTime, better: 'low', domain: 'Procurement' },
  { id: 'onTime', kws: ['on time', 'on-time', 'ontime', 'delivery rate'], label: 'on-time delivery', unit: 'pct', get: (s) => s.onTime, better: 'high', domain: 'Procurement' },
  { id: 'priceIndex', kws: ['price', 'price index', 'cheapest', 'expensive', 'cost index'], label: 'price index', unit: 'num', get: (s) => s.priceIndex, better: 'low', domain: 'Procurement' },
  { id: 'score', kws: ['supplier score', 'supplier rating', 'supplier performance', 'best supplier'], label: 'performance score', unit: 'score', get: (s) => s.score, better: 'high', domain: 'Procurement' },
  { id: 'squality', kws: ['supplier quality'], label: 'quality', unit: 'pct', get: (s) => s.quality, better: 'high', domain: 'Procurement' },
]

const SUGGESTIONS = [
  'Which projects exceeded budget?',
  'Which supplier has the longest lead time?',
  'Average schedule slip across the portfolio',
  'Compare embodied carbon by sector',
  'How many projects are high-risk?',
]

const ACCENT_FOR: Record<string, string> = { costVariance: 'rose', scheduleVariance: 'amber', value: 'blue', progress: 'cyan', risk: 'violet', safety: 'emerald', quality: 'cyan', carbon: 'emerald', gfa: 'sky', rfis: 'amber', clashes: 'rose', leadTime: 'lime', onTime: 'emerald', priceIndex: 'amber', score: 'lime', squality: 'cyan' }

function pick<T>(q: string, metrics: Metric<T>[]): Metric<T> | undefined {
  let best: { m: Metric<T>; len: number } | undefined
  for (const m of metrics) for (const k of m.kws) if (q.includes(k) && (!best || k.length > best.len)) best = { m, len: k.length }
  return best?.m
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function groupBy<T>(rows: T[], key: (x: T) => string, agg: (rows: T[]) => number): { name: string; value: number }[] {
  const map = new Map<string, T[]>()
  for (const r of rows) { const k = key(r); map.set(k, [...(map.get(k) ?? []), r]) }
  return [...map.entries()].map(([name, rs]) => ({ name: name.split(' ')[0], value: agg(rs) }))
}

/** Answer a free-text analytics question over the supplied data. */
export function answerQuestion(question: string, data: QueryData): QueryResult {
  const q = ' ' + question.toLowerCase().trim() + ' '
  const wantsSupplier = /supplier|vendor|subcontractor/.test(q)
  const sMetric = pick(q, S_METRICS)
  const pMetric = pick(q, P_METRICS)
  const useSupplier = wantsSupplier || (!!sMetric && !pMetric)

  const isCount = /how many|number of|\bcount\b/.test(q)
  const isAvg = /average|\bavg\b|\bmean\b|typical/.test(q)
  const isSum = /\btotal\b|\bsum\b|combined|altogether/.test(q)
  const wantsSector = /sector|\bby type\b|per type/.test(q)
  const perArea = /per m²|per m2|per square|cost per/.test(q)
  const hiDir = /highest|most|top|largest|biggest|worst|longest|greatest|\bmax\b/.test(q)
  const loDir = /lowest|least|smallest|best|shortest|fewest|\bmin\b|cheapest/.test(q)

  // ── cost per m² by sector (special) ─────────────────────────────────────────
  if (perArea && wantsSector) {
    const by = groupBy(data.projects, (p) => p.sector, (rows) => round(rows.reduce((s, p) => s + p.value, 0) / Math.max(1, rows.reduce((s, p) => s + p.gfa, 0)), 0))
    const sorted = by.sort((a, b) => b.value - a.value)
    return {
      matched: true,
      answer: `Cost intensity ranges from ${money(sorted[sorted.length - 1].value)}/m² (${sorted[sorted.length - 1].name}) to ${money(sorted[0].value)}/m² (${sorted[0].name}) across ${sorted.length} sectors.`,
      sql: `SELECT sector, SUM(value)/SUM(gfa) AS cost_per_m2\nFROM gold.project_master\nGROUP BY sector ORDER BY cost_per_m2 DESC;`,
      domains: ['Cost & Quantity', 'Project Master Data'],
      chart: { data: sorted.map((b) => ({ name: short(b.name), value: b.value })), label: 'Cost / m²', unit: 'money', accent: 'blue' },
    }
  }

  // ── group-by sector for a project metric ────────────────────────────────────
  if (wantsSector && pMetric && !useSupplier) {
    const agg = !isSum
    const by = groupBy(data.projects, (p) => p.sector, (rows) => round(rows.reduce((s, p) => s + pMetric.get(p), 0) / (agg ? rows.length : 1), pMetric.unit === 'money' ? 0 : 1))
    const sorted = by.sort((a, b) => b.value - a.value)
    return {
      matched: true,
      answer: `${cap(agg ? 'average ' : 'total ')}${pMetric.label} by sector ranges from ${fmt(pMetric.unit, sorted[sorted.length - 1].value, pMetric.signed)} (${sorted[sorted.length - 1].name}) to ${fmt(pMetric.unit, sorted[0].value, pMetric.signed)} (${sorted[0].name}).`,
      sql: `SELECT sector, ${agg ? 'AVG' : 'SUM'}(${pMetric.id}) AS v\nFROM gold.project_master GROUP BY sector ORDER BY v DESC;`,
      domains: [pMetric.domain, 'Project Master Data'],
      chart: { data: sorted.map((b) => ({ name: short(b.name), value: b.value })), label: `${agg ? 'Avg' : 'Total'} ${pMetric.label}`, unit: pMetric.unit, accent: ACCENT_FOR[pMetric.id] ?? 'blue' },
    }
  }

  // ── filtered lists (projects) ───────────────────────────────────────────────
  const filter = detectFilter(q)
  if (filter && !useSupplier) {
    const rows = data.projects.filter(filter.pred)
    const m = filter.metric
    const sorted = [...rows].sort((a, b) => m.get(b) - m.get(a))
    if (!sorted.length) return { matched: true, answer: `No projects match “${filter.label}”.`, sql: filter.sql, domains: [m.domain] }
    if (isCount) return countResult(sorted.length, data.projects.length, `projects ${filter.label}`, filter.sql, m.domain)
    return {
      matched: true,
      answer: `${sorted.length} of ${data.projects.length} projects are ${filter.label}. Most exposed: ${sorted[0].name} (${fmt(m.unit, m.get(sorted[0]), m.signed)})${sorted[1] ? `, then ${sorted[1].name} (${fmt(m.unit, m.get(sorted[1]), m.signed)})` : ''}.`,
      sql: filter.sql,
      domains: [m.domain, 'Project Master Data'],
      chart: { data: sorted.slice(0, 8).map((p) => ({ name: short(p.name), value: round(m.get(p), m.unit === 'money' ? 0 : 1) })), label: m.label, unit: m.unit, accent: ACCENT_FOR[m.id] ?? 'rose' },
    }
  }

  // ── supplier / project metric questions ─────────────────────────────────────
  if (useSupplier && sMetric) return metricAnswer(q, data.suppliers, sMetric, (s) => s.name, { isCount, isAvg, isSum, hiDir, loDir }, 'suppliers', ['Procurement'])
  if (!useSupplier && pMetric) return metricAnswer(q, data.projects, pMetric, (p) => p.name, { isCount, isAvg, isSum, hiDir, loDir }, 'projects', [pMetric.domain, 'Project Master Data'])

  // ── plain counts ────────────────────────────────────────────────────────────
  if (isCount) {
    if (useSupplier) return countResult(data.suppliers.length, data.suppliers.length, 'suppliers tracked', 'SELECT COUNT(*) FROM gold.supplier_performance;', 'Procurement')
    return countResult(data.projects.length, data.projects.length, 'active projects', 'SELECT COUNT(*) FROM gold.project_master;', 'Project Master Data')
  }

  // ── not understood — be honest, don't guess ─────────────────────────────────
  return {
    matched: false,
    answer: `I couldn't map that to the available data. Try metrics like cost variance, schedule slip, lead time, embodied carbon, safety or risk — e.g. “${SUGGESTIONS[0]}” or “${SUGGESTIONS[1]}”.`,
    sql: '-- no deterministic plan; rephrase around a known metric',
    domains: [],
  }
}

function metricAnswer<T>(
  q: string,
  rows: T[],
  m: Metric<T>,
  name: (x: T) => string,
  ops: { isCount: boolean; isAvg: boolean; isSum: boolean; hiDir: boolean; loDir: boolean },
  noun: string,
  domains: string[],
): QueryResult {
  if (ops.isCount) return countResult(rows.length, rows.length, `${noun} tracked`, `SELECT COUNT(*) FROM gold;`, domains[0])
  if (ops.isAvg || ops.isSum) {
    const total = rows.reduce((s, x) => s + m.get(x), 0)
    const v = ops.isAvg ? total / Math.max(1, rows.length) : total
    return {
      matched: true,
      answer: `${cap(ops.isAvg ? 'average' : 'total')} ${m.label} across ${rows.length} ${noun} is ${fmt(m.unit, round(v, m.unit === 'money' ? 0 : 1), m.signed)}.`,
      sql: `SELECT ${ops.isAvg ? 'AVG' : 'SUM'}(${m.id}) FROM gold;`,
      domains,
      chart: { data: [...rows].sort((a, b) => m.get(b) - m.get(a)).slice(0, 8).map((x) => ({ name: short(name(x)), value: round(m.get(x), m.unit === 'money' ? 0 : 1) })), label: m.label, unit: m.unit, accent: ACCENT_FOR[m.id] ?? 'blue' },
    }
  }
  const wantWorst = /\bworst\b/.test(q)
  const wantBest = /\bbest\b/.test(q)
  let desc: boolean
  if (ops.loDir && !ops.hiDir) desc = false
  else if (ops.hiDir && !ops.loDir) desc = true
  else if (wantBest) desc = m.better === 'high'
  else if (wantWorst) desc = m.better === 'low'
  else desc = true
  const sorted = [...rows].sort((a, b) => (desc ? m.get(b) - m.get(a) : m.get(a) - m.get(b)))
  const lead = sorted[0]
  const second = sorted[1]
  const supl = m.unit === 'days' && desc ? 'longest' : m.unit === 'days' ? 'shortest' : desc ? 'highest' : 'lowest'
  return {
    matched: true,
    answer: `${name(lead)} has the ${supl} ${m.label} at ${fmt(m.unit, m.get(lead), m.signed)}${second ? `, followed by ${name(second)} (${fmt(m.unit, m.get(second), m.signed)})` : ''}.`,
    sql: `SELECT name, ${m.id} FROM gold ORDER BY ${m.id} ${desc ? 'DESC' : 'ASC'} LIMIT 6;`,
    domains,
    chart: { data: sorted.slice(0, 6).map((x) => ({ name: short(name(x)), value: round(m.get(x), m.unit === 'money' ? 0 : 1) })), label: m.label, unit: m.unit, accent: ACCENT_FOR[m.id] ?? 'blue' },
  }
}

function countResult(n: number, total: number, label: string, sql: string, domain: string): QueryResult {
  return { matched: true, answer: `${n}${n !== total ? ` of ${total}` : ''} ${label}.`, sql, domains: [domain] }
}

function detectFilter(q: string): { pred: (p: Project) => boolean; label: string; sql: string; metric: Metric<Project> } | null {
  const cv = P_METRICS.find((m) => m.id === 'costVariance')!
  const sv = P_METRICS.find((m) => m.id === 'scheduleVariance')!
  const rk = P_METRICS.find((m) => m.id === 'risk')!
  if (/over budget|over-budget|exceeded budget|overrun|over their budget/.test(q)) return { pred: (p) => p.costVariance > 0, label: 'over budget', sql: `SELECT name, cost_variance_pct FROM gold.project_controls WHERE cost_variance_pct > 0 ORDER BY cost_variance_pct DESC;`, metric: cv }
  if (/behind schedule|behind|running late|\blate\b|slipping|delayed/.test(q)) return { pred: (p) => p.scheduleVariance > 0, label: 'behind schedule', sql: `SELECT name, schedule_variance_days FROM gold.project_controls WHERE schedule_variance_days > 0 ORDER BY schedule_variance_days DESC;`, metric: sv }
  if (/high[- ]?risk|risky|most at risk|at-risk/.test(q)) return { pred: (p) => p.risk >= 70, label: 'high-risk (risk ≥ 70)', sql: `SELECT name, risk FROM gold.project_master WHERE risk >= 70 ORDER BY risk DESC;`, metric: rk }
  if (/on track|on-track|within tolerance/.test(q)) return { pred: (p) => p.costVariance < 5 && p.scheduleVariance < 14, label: 'on track', sql: `SELECT name FROM gold.project_controls WHERE cost_variance_pct < 5 AND schedule_variance_days < 14;`, metric: cv }
  return null
}

export { SUGGESTIONS }
