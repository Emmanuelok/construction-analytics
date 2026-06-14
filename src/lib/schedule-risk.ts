/* Schedule risk analysis (Monte Carlo / PERT) — pure, unit-tested. Runs the CPM
 * network many times with each task duration drawn from a triangular three-point
 * estimate (optimistic / most-likely / pessimistic, derived from an uncertainty
 * spread), producing a distribution of project durations: the mean, the P10/P50/
 * P80/P90 confidence dates, the probability of meeting the deterministic (or a
 * target) finish, and a per-task criticality index — how often each activity lands
 * on the critical path. This exposes the optimism bias of a single-point CPM
 * (merge bias pushes the realistic finish past the deterministic one). Seeded RNG
 * for reproducibility. Builds on cpm.ts. No DOM. */

import { cpm, addWorkingDays, type CpmTask } from './cpm'

export type RiskInput = {
  tasks: CpmTask[]
  iterations?: number     // default 2000
  uncertainty?: number    // 0..1 spread (default 0.4): o = d·(1−0.5u), p = d·(1+u)
  targetDays?: number     // optional target finish to test probability against
  start?: string          // ISO start date for calendar P-dates
  seed?: number
}

export type RiskResult = {
  iterations: number
  deterministic: number
  mean: number; stdev: number
  min: number; max: number
  p10: number; p50: number; p80: number; p90: number
  histogram: { day: number; count: number }[]
  probOnTime: number      // P(duration ≤ deterministic)
  targetDays: number      // the date tested (deterministic or supplied target)
  probTarget: number      // P(duration ≤ targetDays)
  criticality: { id: string; name: string; index: number }[] // % of runs on the critical path
  pDates?: { p50: string; p80: string; p90: string }
}

/** Mulberry32 seeded RNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** Triangular-distribution sample given optimistic/most-likely/pessimistic. */
export function triangular(o: number, m: number, p: number, r: number): number {
  if (p <= o) return m
  const f = (m - o) / (p - o)
  return r < f ? o + Math.sqrt(r * (p - o) * (m - o)) : p - Math.sqrt((1 - r) * (p - o) * (p - m))
}

const pctile = (sorted: number[], q: number): number => {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))
  return sorted[i]
}

/** Run the Monte Carlo schedule risk simulation. */
export function scheduleRisk(input: RiskInput): RiskResult {
  const iterations = Math.max(100, Math.min(20000, input.iterations ?? 2000))
  const u = Math.max(0, Math.min(1, input.uncertainty ?? 0.4))
  const rand = rng(input.seed ?? 12345)
  const base = cpm(input.tasks)
  const deterministic = base.duration
  const targetDays = input.targetDays ?? deterministic

  const durations: number[] = []
  const critCount = new Map<string, number>(input.tasks.map((t) => [t.id, 0]))
  let onTime = 0, onTarget = 0

  for (let it = 0; it < iterations; it++) {
    const sampled = input.tasks.map((t) => {
      const d = Math.max(0, t.duration)
      const o = d * (1 - 0.5 * u), p = d * (1 + u)
      return { ...t, duration: triangular(o, d, p, rand()) }
    })
    const r = cpm(sampled)
    durations.push(r.duration)
    if (r.duration <= deterministic + 1e-9) onTime++
    if (r.duration <= targetDays + 1e-9) onTarget++
    for (const t of r.tasks) if (t.critical) critCount.set(t.id, (critCount.get(t.id) ?? 0) + 1)
  }

  durations.sort((a, b) => a - b)
  const mean = durations.reduce((s, d) => s + d, 0) / iterations
  const stdev = Math.sqrt(durations.reduce((s, d) => s + (d - mean) ** 2, 0) / iterations)
  const min = durations[0], max = durations[durations.length - 1]

  // histogram (~24 bins)
  const bins = 24
  const span = Math.max(1, max - min)
  const width = span / bins
  const histogram = Array.from({ length: bins }, (_, i) => ({ day: Math.round(min + (i + 0.5) * width), count: 0 }))
  for (const d of durations) { const bi = Math.min(bins - 1, Math.floor((d - min) / width)); histogram[bi].count++ }

  const criticality = input.tasks.map((t) => ({ id: t.id, name: t.name, index: Math.round((critCount.get(t.id)! / iterations) * 100) }))
    .sort((a, b) => b.index - a.index)

  const round = (n: number) => Math.round(n)
  const p50 = round(pctile(durations, 0.5)), p80 = round(pctile(durations, 0.8)), p90 = round(pctile(durations, 0.9))
  return {
    iterations, deterministic, mean: Math.round(mean * 10) / 10, stdev: Math.round(stdev * 10) / 10, min: round(min), max: round(max),
    p10: round(pctile(durations, 0.1)), p50, p80, p90,
    histogram, probOnTime: Math.round((onTime / iterations) * 100), targetDays: round(targetDays), probTarget: Math.round((onTarget / iterations) * 100),
    criticality,
    pDates: input.start ? { p50: addWorkingDays(input.start, Math.max(0, p50 - 1)), p80: addWorkingDays(input.start, Math.max(0, p80 - 1)), p90: addWorkingDays(input.start, Math.max(0, p90 - 1)) } : undefined,
  }
}

/** Schedule risk CSV. */
export function scheduleRiskCsv(r: RiskResult): string {
  const meta = [
    'Metric,Value',
    `Iterations,${r.iterations}`, `Deterministic (days),${r.deterministic}`, `Mean,${r.mean}`, `Std dev,${r.stdev}`,
    `P10,${r.p10}`, `P50,${r.p50}`, `P80,${r.p80}`, `P90,${r.p90}`, `Min,${r.min}`, `Max,${r.max}`,
    `P(on deterministic date),${r.probOnTime}%`, `Target (days),${r.targetDays}`, `P(on target),${r.probTarget}%`,
    '', 'Task,Criticality index', ...r.criticality.map((c) => `${c.name},${c.index}%`),
  ]
  return meta.join('\n')
}
