/* Cost-loaded schedule (S-curve) — pure, unit-tested. Spreads each scheduled task's
 * cost across its working-day window (earliest start → finish) and buckets the spend
 * into periods to produce the project cashflow: period spend, the cumulative S-curve,
 * the planned-value curve a forecast is tracked against, the peak drawdown period and
 * the total. Task cost defaults to duration × a discipline day-rate, or can be given
 * explicitly. Consumes the CPM schedule (cpm.ts). No DOM. */

import { addWorkingDays, type CpmScheduled } from './cpm'

export type CostPeriod = { label: string; startDay: number; spend: number; cumulative: number; pct: number; startDate?: string }
export type CostLoading = {
  periods: CostPeriod[]
  taskCosts: { id: string; name: string; cost: number }[]
  totalCost: number
  peakSpend: number; peakPeriod: string
  durationDays: number
  bucketDays: number
}

/** Indicative day-rates by programme group ($/working day of that activity). */
export const GROUP_DAY_RATE: Record<string, number> = {
  Preliminaries: 4000, Structure: 14000, Envelope: 11000, Services: 9000, 'Fit-out': 8000, External: 3500, Handover: 3000,
}
const DEFAULT_RATE = 8000

/** Cost-load a CPM schedule into period spend + a cumulative S-curve. */
export function costLoad(
  tasks: CpmScheduled[],
  opts: { bucketDays?: number; rates?: Record<string, number>; costs?: Record<string, number>; start?: string } = {},
): CostLoading {
  const bucketDays = Math.max(1, Math.round(opts.bucketDays ?? 20))
  const duration = tasks.length ? Math.max(...tasks.map((t) => t.ef)) : 0
  const rateFor = (t: CpmScheduled) => (opts.rates?.[t.group ?? ''] ?? GROUP_DAY_RATE[t.group ?? ''] ?? DEFAULT_RATE)
  const costFor = (t: CpmScheduled) => opts.costs?.[t.id] ?? Math.round(Math.max(0, t.duration) * rateFor(t))

  const taskCosts = tasks.map((t) => ({ id: t.id, name: t.name, cost: costFor(t) }))
  const totalCost = taskCosts.reduce((s, t) => s + t.cost, 0)

  // spread each task's cost evenly across its working-day span into a per-day array
  const perDay = new Array<number>(Math.max(1, duration)).fill(0)
  for (const t of tasks) {
    const cost = costFor(t)
    const span = Math.max(1, t.ef - t.es)
    const daily = cost / span
    for (let d = t.es; d < t.ef && d < perDay.length; d++) perDay[d] += daily
  }

  // bucket days into periods
  const nPeriods = Math.max(1, Math.ceil(duration / bucketDays))
  const periods: CostPeriod[] = []
  let cumulative = 0
  for (let p = 0; p < nPeriods; p++) {
    let spend = 0
    for (let d = p * bucketDays; d < Math.min((p + 1) * bucketDays, perDay.length); d++) spend += perDay[d]
    spend = Math.round(spend)
    cumulative += spend
    periods.push({ label: `M${p + 1}`, startDay: p * bucketDays, spend, cumulative, pct: totalCost > 0 ? Math.round((cumulative / totalCost) * 1000) / 10 : 0, startDate: opts.start ? addWorkingDays(opts.start, p * bucketDays) : undefined })
  }

  const peak = periods.reduce((m, p) => (p.spend > m.spend ? p : m), periods[0] ?? { label: '—', spend: 0 })
  return { periods, taskCosts, totalCost, peakSpend: peak.spend, peakPeriod: peak.label, durationDays: duration, bucketDays }
}

/** Cost-loading CSV. */
export function costLoadCsv(c: CostLoading): string {
  const head = 'Period,Start day,Spend,Cumulative,% complete,Start date'
  const rows = c.periods.map((p) => `${p.label},${p.startDay},${p.spend},${p.cumulative},${p.pct}%,${p.startDate ?? ''}`)
  const meta = ['', 'Metric,Value', `Total cost,${c.totalCost}`, `Peak period spend,${c.peakSpend} (${c.peakPeriod})`, `Duration (days),${c.durationDays}`, `Bucket (days),${c.bucketDays}`]
  return [head, ...rows, ...meta].join('\n')
}
