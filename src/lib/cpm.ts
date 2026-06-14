/* Critical Path Method (CPM) scheduler — pure, unit-tested. Takes a task network
 * (activities with durations and finish-to-start dependencies) and runs the classic
 * forward pass (earliest start/finish) and backward pass (latest start/finish) to
 * derive total float, free float, the project duration and the critical path — the
 * chain of zero-float activities that sets the end date. Detects dependency cycles.
 * Includes a realistic default building programme and a working-day → calendar-date
 * mapper (skips weekends). Durations are working days. No DOM. */

export type CpmTask = { id: string; name: string; duration: number; deps: string[]; group?: string }
export type CpmScheduled = CpmTask & {
  es: number; ef: number; ls: number; lf: number
  totalFloat: number; freeFloat: number; critical: boolean
  startDate?: string; endDate?: string
}
export type CpmResult = {
  tasks: CpmScheduled[]
  duration: number          // working days
  criticalPath: string[]    // task ids in sequence
  finishDate?: string
}

/** Topological order via Kahn's algorithm; throws on a dependency cycle. */
function topoOrder(tasks: CpmTask[]): CpmTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const indeg = new Map(tasks.map((t) => [t.id, 0]))
  for (const t of tasks) for (const d of t.deps) if (byId.has(d)) indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1)
  const queue = tasks.filter((t) => (indeg.get(t.id) ?? 0) === 0).map((t) => t.id)
  const order: CpmTask[] = []
  while (queue.length) {
    const id = queue.shift() as string
    order.push(byId.get(id) as CpmTask)
    for (const t of tasks) if (t.deps.includes(id)) { indeg.set(t.id, (indeg.get(t.id) ?? 0) - 1); if (indeg.get(t.id) === 0) queue.push(t.id) }
  }
  if (order.length !== tasks.length) throw new Error('CPM: dependency cycle detected')
  return order
}

/** Add `n` working days to an ISO date (skips Sat/Sun). n=0 returns the next working day. */
export function addWorkingDays(startISO: string, n: number): string {
  const d = new Date(startISO + 'T00:00:00Z')
  let added = 0
  // advance to the first working day if start falls on a weekend
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

/** Run CPM on a task network. */
export function cpm(tasks: CpmTask[], opts: { start?: string } = {}): CpmResult {
  if (!tasks.length) return { tasks: [], duration: 0, criticalPath: [] }
  const order = topoOrder(tasks)
  const byId = new Map<string, CpmScheduled>()
  const succ = new Map<string, string[]>(tasks.map((t) => [t.id, []]))
  for (const t of tasks) for (const d of t.deps) if (succ.has(d)) succ.get(d)!.push(t.id)

  // forward pass
  for (const t of order) {
    const es = t.deps.length ? Math.max(...t.deps.map((d) => byId.get(d)?.ef ?? 0)) : 0
    const ef = es + Math.max(0, t.duration)
    byId.set(t.id, { ...t, es, ef, ls: 0, lf: 0, totalFloat: 0, freeFloat: 0, critical: false })
  }
  const duration = Math.max(...[...byId.values()].map((t) => t.ef))

  // backward pass (reverse topological order)
  for (let i = order.length - 1; i >= 0; i--) {
    const t = byId.get(order[i].id)!
    const ss = succ.get(t.id) ?? []
    const lf = ss.length ? Math.min(...ss.map((s) => byId.get(s)!.ls)) : duration
    const ls = lf - Math.max(0, t.duration)
    t.lf = lf; t.ls = ls
    t.totalFloat = ls - t.es
    const freeRef = ss.length ? Math.min(...ss.map((s) => byId.get(s)!.es)) : t.ef
    t.freeFloat = Math.max(0, freeRef - t.ef)
    t.critical = t.totalFloat <= 1e-9
  }

  // critical path: from a critical task with no critical predecessor, follow critical successors
  const crit = [...byId.values()].filter((t) => t.critical)
  const critIds = new Set(crit.map((t) => t.id))
  const hasCritPred = (t: CpmScheduled) => t.deps.some((d) => critIds.has(d))
  let head = crit.find((t) => !hasCritPred(t))
  const criticalPath: string[] = []
  const seen = new Set<string>()
  while (head && !seen.has(head.id)) {
    criticalPath.push(head.id); seen.add(head.id)
    const nextId = (succ.get(head.id) ?? []).find((s) => critIds.has(s) && byId.get(s)!.es === head!.ef)
    head = nextId ? byId.get(nextId) : undefined
  }

  // dates (optional)
  if (opts.start) for (const t of byId.values()) { t.startDate = addWorkingDays(opts.start, t.es); t.endDate = addWorkingDays(opts.start, Math.max(t.es, t.ef - 1)) }
  const finishDate = opts.start ? addWorkingDays(opts.start, Math.max(0, duration - 1)) : undefined

  // return in input order
  return { tasks: tasks.map((t) => byId.get(t.id)!), duration, criticalPath, finishDate }
}

/** A realistic mid-rise building programme (working days), with parallel paths. */
export const DEFAULT_PROGRAMME: CpmTask[] = [
  { id: 'mob', name: 'Mobilisation & site setup', duration: 5, deps: [], group: 'Preliminaries' },
  { id: 'demo', name: 'Enabling works & demolition', duration: 10, deps: ['mob'], group: 'Preliminaries' },
  { id: 'sub', name: 'Substructure & foundations', duration: 25, deps: ['demo'], group: 'Structure' },
  { id: 'super', name: 'Superstructure frame', duration: 40, deps: ['sub'], group: 'Structure' },
  { id: 'roof', name: 'Roofing', duration: 12, deps: ['super'], group: 'Envelope' },
  { id: 'env', name: 'Envelope & cladding', duration: 30, deps: ['super'], group: 'Envelope' },
  { id: 'mep1', name: 'MEP first fix', duration: 28, deps: ['super'], group: 'Services' },
  { id: 'fit', name: 'Internal fit-out', duration: 35, deps: ['env', 'mep1'], group: 'Fit-out' },
  { id: 'mep2', name: 'MEP second fix', duration: 20, deps: ['fit'], group: 'Services' },
  { id: 'land', name: 'Landscaping & externals', duration: 15, deps: ['env'], group: 'External' },
  { id: 'comm', name: 'Commissioning & testing', duration: 15, deps: ['mep2', 'roof'], group: 'Handover' },
  { id: 'hand', name: 'Handover & completion', duration: 5, deps: ['comm', 'land'], group: 'Handover' },
]

/** CPM CSV. */
export function cpmCsv(r: CpmResult): string {
  const head = 'Task,Duration,ES,EF,LS,LF,Total float,Critical,Start,End'
  const rows = r.tasks.map((t) => `${t.name},${t.duration},${t.es},${t.ef},${t.ls},${t.lf},${t.totalFloat},${t.critical ? 'yes' : ''},${t.startDate ?? ''},${t.endDate ?? ''}`)
  const meta = ['', 'Metric,Value', `Project duration (working days),${r.duration}`, `Critical path,${r.criticalPath.join(' → ')}`, `Finish,${r.finishDate ?? ''}`]
  return [head, ...rows, ...meta].join('\n')
}
