/* Resource levelling — pure, unit-tested. From a scheduled CPM network with a crew
 * demand per task it builds the resource histogram (peak concurrent crew over the
 * programme), then levels it: a greedy, finish-preserving heuristic that delays
 * each task only within its total float to the start that most reduces the overall
 * peak — so critical tasks never move and the project end is unchanged, but the
 * labour profile is smoothed below the histogram's spikes. Reports the before/after
 * profiles, the peak reduction, the shifts made and the over-capacity periods.
 * Day-resolution internally; bucketed for display. No DOM. */

export type LevelTask = { id: string; name: string; es: number; ef: number; duration: number; totalFloat: number; critical: boolean; crew: number }
export type ResourceProfile = { periods: { label: string; demand: number; over: number }[]; peak: number; mean: number; bucketDays: number; overPeriods: number }
export type LevelingResult = {
  capacity: number
  before: ResourceProfile
  after: ResourceProfile
  shifted: { id: string; name: string; delay: number }[]
  peakBefore: number; peakAfter: number
  finishBefore: number; finishAfter: number
}

/** Crew (people on site) by programme group — indicative. */
export const GROUP_CREW: Record<string, number> = {
  Preliminaries: 6, Structure: 20, Envelope: 14, Services: 12, 'Fit-out': 16, External: 8, Handover: 5,
}
const DEFAULT_CREW = 10

/** Per-day demand array from a set of task start offsets. */
function dayDemand(tasks: LevelTask[], starts: Map<string, number>, horizon: number): number[] {
  const days = new Array<number>(horizon).fill(0)
  for (const t of tasks) {
    const s = starts.get(t.id) ?? t.es
    for (let d = s; d < s + t.duration && d < horizon; d++) days[d] += t.crew
  }
  return days
}

/** Bucket a day-demand array into a period histogram (period demand = peak crew that period). */
function bucketProfile(days: number[], capacity: number, bucketDays: number): ResourceProfile {
  const nPeriods = Math.max(1, Math.ceil(days.length / bucketDays))
  const periods = Array.from({ length: nPeriods }, (_, p) => {
    let peak = 0
    for (let d = p * bucketDays; d < Math.min((p + 1) * bucketDays, days.length); d++) peak = Math.max(peak, days[d])
    return { label: `M${p + 1}`, demand: peak, over: Math.max(0, peak - capacity) }
  })
  const peak = days.length ? Math.max(...days) : 0
  const active = days.filter((d) => d > 0)
  const mean = active.length ? Math.round((active.reduce((s, d) => s + d, 0) / active.length) * 10) / 10 : 0
  return { periods, peak, mean, bucketDays, overPeriods: periods.filter((p) => p.over > 0).length }
}

/** Resource histogram for the schedule at earliest starts. */
export function resourceProfile(tasks: LevelTask[], capacity: number, bucketDays = 20): ResourceProfile {
  const horizon = tasks.length ? Math.max(...tasks.map((t) => t.ef)) : 1
  return bucketProfile(dayDemand(tasks, new Map(), horizon), capacity, bucketDays)
}

/** Level the resource profile within float (finish-preserving greedy heuristic). */
export function levelResources(tasks: LevelTask[], capacity: number, bucketDays = 20): LevelingResult {
  const horizon = tasks.length ? Math.max(...tasks.map((t) => t.ef)) : 1
  const starts = new Map<string, number>(tasks.map((t) => [t.id, t.es]))
  const before = bucketProfile(dayDemand(tasks, starts, horizon), capacity, bucketDays)

  // running per-day demand we mutate as we place tasks
  const days = dayDemand(tasks, starts, horizon)
  const addLoad = (t: LevelTask, s: number, sign: number) => { for (let d = s; d < s + t.duration && d < horizon; d++) days[d] += sign * t.crew }
  const peakIfMovedTo = (t: LevelTask, s: number): number => {
    // temporarily remove from current, evaluate peak with it at s, restore handled by caller
    let peak = 0
    for (let d = 0; d < horizon; d++) {
      const inNew = d >= s && d < s + t.duration
      const v = days[d] + (inNew ? t.crew : 0)
      if (v > peak) peak = v
    }
    return peak
  }

  const shifted: { id: string; name: string; delay: number }[] = []
  // place floatable tasks (most float last → move the flexible ones), earliest first
  const movable = tasks.filter((t) => !t.critical && t.totalFloat > 0).sort((a, b) => a.es - b.es || a.totalFloat - b.totalFloat)
  for (const t of movable) {
    const cur = starts.get(t.id) ?? t.es
    addLoad(t, cur, -1) // lift this task out
    let bestStart = cur, bestPeak = peakIfMovedTo(t, cur)
    for (let delay = 1; delay <= t.totalFloat; delay++) {
      const cand = t.es + delay
      const peak = peakIfMovedTo(t, cand)
      if (peak < bestPeak - 1e-9) { bestPeak = peak; bestStart = cand }
    }
    addLoad(t, bestStart, +1) // drop it back at the best position
    starts.set(t.id, bestStart)
    if (bestStart !== cur) shifted.push({ id: t.id, name: t.name, delay: bestStart - t.es })
  }

  const after = bucketProfile(days, capacity, bucketDays)
  const finishBefore = horizon
  const finishAfter = Math.max(...tasks.map((t) => (starts.get(t.id) ?? t.es) + t.duration))
  return { capacity, before, after, shifted, peakBefore: before.peak, peakAfter: after.peak, finishBefore, finishAfter }
}

/** Resource levelling CSV. */
export function levelingCsv(r: LevelingResult): string {
  const head = 'Period,Demand (before),Demand (after),Capacity'
  const rows = r.before.periods.map((p, i) => `${p.label},${p.demand},${r.after.periods[i]?.demand ?? ''},${r.capacity}`)
  const meta = ['', 'Metric,Value', `Peak before,${r.peakBefore}`, `Peak after,${r.peakAfter}`, `Capacity,${r.capacity}`, `Finish before (days),${r.finishBefore}`, `Finish after (days),${r.finishAfter}`, `Tasks shifted,${r.shifted.length}`, ...r.shifted.map((s) => `,${s.name} +${s.delay}d`)]
  return [head, ...rows, ...meta].join('\n')
}
