/* Field analytics — the real on-site execution math, pure and unit-tested.
 * From per-site manpower, output, hours and incident counts it derives the
 * canonical field KPIs: staffing level, productivity factor, and the OSHA
 * standard TRIR (Total Recordable Incident Rate = recordables × 200,000 /
 * hours worked), plus a transparent 0–100 safety score and a site status.
 * This is the analytical core of a real Construction Analytics workbench —
 * every number is computed from the inputs, none decorative. */

export type SiteInput = {
  id: string
  name: string
  /** Planned headcount for the period. */
  workersPlanned: number
  /** Actual headcount on site. */
  workersActual: number
  /** Planned installed quantity (units) for the period. */
  outputPlanned: number
  /** Actual installed quantity (units). */
  outputActual: number
  /** Total man-hours worked to date (drives TRIR). */
  hoursWorked: number
  /** Recordable incidents to date. */
  recordables: number
  /** Near-misses logged to date (a leading indicator). */
  nearMisses: number
}

export type SiteStatus = 'on-track' | 'watch' | 'at-risk'

export type SiteMetrics = SiteInput & {
  staffing: number // % manned = actual / planned × 100
  productivity: number // productivity factor % = outputActual / outputPlanned × 100
  trir: number // recordables × 200,000 / hours worked
  nearMissRatio: number // nearMisses / max(recordables, 1) — reporting-culture signal
  safetyScore: number // 0–100, derived transparently from TRIR
  status: SiteStatus
}

/** OSHA base: 100 equivalent full-time workers × 2,000 hours/year. */
export const TRIR_BASE = 200_000
/** Each unit of TRIR costs this many safety-score points (TRIR 2.5 ≈ 70). */
const SAFETY_K = 12

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** TRIR from recordables and hours worked. Zero hours → 0 (nothing worked yet). */
export function trir(recordables: number, hoursWorked: number): number {
  if (hoursWorked <= 0) return 0
  return round2((Math.max(0, recordables) * TRIR_BASE) / hoursWorked)
}

/** A transparent 0–100 safety score from TRIR (lower TRIR = safer). */
export function safetyScore(trirValue: number): number {
  return Math.round(clamp(100 - trirValue * SAFETY_K, 0, 100))
}

function statusFor(productivity: number, safety: number): SiteStatus {
  if (productivity >= 92 && safety >= 70) return 'on-track'
  if (productivity >= 85 && safety >= 55) return 'watch'
  return 'at-risk'
}

/** Compute the full field metric set for one site. */
export function computeSite(s: SiteInput): SiteMetrics {
  const staffing = s.workersPlanned > 0 ? round1((s.workersActual / s.workersPlanned) * 100) : 0
  const productivity = s.outputPlanned > 0 ? round1((s.outputActual / s.outputPlanned) * 100) : 0
  const t = trir(s.recordables, s.hoursWorked)
  const safety = safetyScore(t)
  const nearMissRatio = round1(s.nearMisses / Math.max(1, s.recordables))
  return { ...s, staffing, productivity, trir: t, nearMissRatio, safetyScore: safety, status: statusFor(productivity, safety) }
}

export type Portfolio = {
  sites: number
  workersActual: number
  workersPlanned: number
  staffing: number
  outputActual: number
  outputPlanned: number
  productivity: number
  hoursWorked: number
  recordables: number
  nearMisses: number
  trir: number
  safetyScore: number
  atRisk: number
}

/** Aggregate across sites — sum the counts, derive blended rates from totals. */
export function portfolio(sites: SiteInput[]): Portfolio {
  const metrics = sites.map(computeSite)
  const sum = (f: (s: SiteInput) => number) => sites.reduce((a, s) => a + f(s), 0)
  const workersActual = sum((s) => s.workersActual)
  const workersPlanned = sum((s) => s.workersPlanned)
  const outputActual = sum((s) => s.outputActual)
  const outputPlanned = sum((s) => s.outputPlanned)
  const hoursWorked = sum((s) => s.hoursWorked)
  const recordables = sum((s) => s.recordables)
  const nearMisses = sum((s) => s.nearMisses)
  const t = trir(recordables, hoursWorked)
  return {
    sites: sites.length,
    workersActual,
    workersPlanned,
    staffing: workersPlanned > 0 ? round1((workersActual / workersPlanned) * 100) : 0,
    outputActual,
    outputPlanned,
    productivity: outputPlanned > 0 ? round1((outputActual / outputPlanned) * 100) : 0,
    hoursWorked,
    recordables,
    nearMisses,
    trir: t,
    safetyScore: safetyScore(t),
    atRisk: metrics.filter((m) => m.status === 'at-risk').length,
  }
}

/** A plain-language read of the portfolio, for the insight strip. */
export function fieldNarrative(p: Portfolio): string {
  const prodWord = p.productivity >= 100 ? 'ahead of plan' : p.productivity >= 90 ? 'tracking close to plan' : 'behind plan'
  const safeWord = p.trir <= 2.5 ? 'below the construction-industry average' : 'above the industry average'
  return `Across ${p.sites} sites, output is at ${p.productivity}% of plan (${prodWord}) with ${p.workersActual.toLocaleString()} of ${p.workersPlanned.toLocaleString()} planned workers on site. The blended TRIR is ${p.trir.toFixed(2)} — ${safeWord} of ~2.5 — for a portfolio safety score of ${p.safetyScore}.`
}
