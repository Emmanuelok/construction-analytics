/* Clash & model-health analytics — pure, unit-tested. From inter-discipline
 * clash records (total detected, resolved, severity) and the federated element
 * count it derives the numbers a BIM coordinator runs on: open clashes,
 * resolution %, clash density per 10k elements, a severity-weighted model-health
 * score with a grade, and a severity breakdown. The analytical core of a real
 * coordination workbench — every number is computed from the inputs. */

export type Severity = 'Critical' | 'Major' | 'Minor'

export type ClashPair = {
  id: string
  a: string // discipline A
  b: string // discipline B
  total: number // clashes detected between the pair
  resolved: number // clashes resolved so far
  severity: Severity
}

export type PairStatus = 'clear' | 'watch' | 'critical'

export type ScoredPair = ClashPair & {
  open: number
  resolutionPct: number
  weightedOpen: number
  status: PairStatus
}

export type Grade = 'A' | 'B' | 'C' | 'D'

export type ModelHealth = {
  pairs: ScoredPair[]
  totalClashes: number
  totalResolved: number
  totalOpen: number
  resolutionPct: number
  elements: number
  density: number // open clashes per 10k elements
  weightedOpen: number
  weightedDensity: number // severity-weighted open per 10k elements
  health: number // 0–100
  grade: Grade
  criticalOpen: number // open clashes sitting in Critical pairs
  bySeverity: { severity: Severity; open: number }[]
}

export const SEVERITY_WEIGHT: Record<Severity, number> = { Critical: 5, Major: 2, Minor: 1 }
/** Each unit of severity-weighted clash density costs this many health points. */
const HEALTH_K = 6

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

function statusFor(open: number, severity: Severity): PairStatus {
  if (open <= 0) return 'clear'
  if (severity === 'Critical') return 'critical'
  return 'watch'
}

/** Score a single clash pair. Resolved is clamped to [0, total]. */
export function scorePair(p: ClashPair): ScoredPair {
  const total = Math.max(0, p.total)
  const resolved = clamp(p.resolved, 0, total)
  const open = total - resolved
  const resolutionPct = total > 0 ? round1((resolved / total) * 100) : 0
  return { ...p, total, resolved, open, resolutionPct, weightedOpen: open * SEVERITY_WEIGHT[p.severity], status: statusFor(open, p.severity) }
}

export function gradeFor(health: number): Grade {
  if (health >= 85) return 'A'
  if (health >= 70) return 'B'
  if (health >= 55) return 'C'
  return 'D'
}

/** Compute the full model-health picture from the clash records + element count. */
export function computeHealth(pairs: ClashPair[], elements: number): ModelHealth {
  const scored = pairs.map(scorePair)
  const totalClashes = scored.reduce((s, p) => s + p.total, 0)
  const totalResolved = scored.reduce((s, p) => s + p.resolved, 0)
  const totalOpen = scored.reduce((s, p) => s + p.open, 0)
  const weightedOpen = scored.reduce((s, p) => s + p.weightedOpen, 0)
  const elementsK = elements > 0 ? elements / 10_000 : 0
  const density = elementsK > 0 ? round1(totalOpen / elementsK) : 0
  const weightedDensity = elementsK > 0 ? round1(weightedOpen / elementsK) : 0
  const health = Math.round(clamp(100 - weightedDensity * HEALTH_K, 0, 100))

  const sev = (s: Severity) => scored.filter((p) => p.severity === s).reduce((a, p) => a + p.open, 0)

  return {
    pairs: scored,
    totalClashes,
    totalResolved,
    totalOpen,
    resolutionPct: totalClashes > 0 ? round1((totalResolved / totalClashes) * 100) : 0,
    elements,
    density,
    weightedOpen,
    weightedDensity,
    health,
    grade: gradeFor(health),
    criticalOpen: scored.filter((p) => p.severity === 'Critical').reduce((a, p) => a + p.open, 0),
    bySeverity: [
      { severity: 'Critical', open: sev('Critical') },
      { severity: 'Major', open: sev('Major') },
      { severity: 'Minor', open: sev('Minor') },
    ],
  }
}

export function clashNarrative(h: ModelHealth): string {
  const worst = [...h.pairs].filter((p) => p.open > 0).sort((a, b) => b.weightedOpen - a.weightedOpen)[0]
  const driver = worst ? ` The ${worst.a}×${worst.b} interface carries the most weighted risk with ${worst.open} open ${worst.severity.toLowerCase()} clashes.` : ' All interfaces are clear.'
  return `${h.totalOpen.toLocaleString()} of ${h.totalClashes.toLocaleString()} clashes remain open (${h.resolutionPct}% resolved) at a density of ${h.density} per 10k elements, for a model-health score of ${h.health} (grade ${h.grade}).${driver}`
}
