/* Portfolio decision analytics — pure, unit-tested. Scores every capital
 * project across six dimensions (cost, schedule, risk, safety, quality, carbon)
 * normalized to 0–100, applies the executive's weighting, and derives a project
 * health score, a status, and a dollar exposure (value at risk). Rolled up
 * value-weighted into a portfolio-health score and total exposure, with a
 * worst-first watchlist. The analytical core of an operable decision console. */

export type ProjectInput = {
  id: string
  name: string
  sector: string
  value: number
  costVariance: number // % (+ = over budget)
  scheduleSlip: number // days (+ = late)
  risk: number // 0–100 (higher = worse)
  safety: number // 0–100 (higher = better)
  quality: number // 0–100 (higher = better)
  carbon: number // kgCO₂e/m² (lower = better)
}

export type Dimensions = { cost: number; schedule: number; risk: number; safety: number; quality: number; carbon: number }
export type Weights = Dimensions

export const DEFAULT_WEIGHTS: Weights = { cost: 0.25, schedule: 0.2, risk: 0.2, safety: 0.15, quality: 0.1, carbon: 0.1 }

export type Status = 'healthy' | 'watch' | 'at-risk'
export type ScoredProject = ProjectInput & {
  dims: Dimensions // per-dimension 0–100 scores (higher = better)
  health: number // 0–100 weighted composite
  status: Status
  exposure: number // value × (1 − health/100)
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

/** Map each raw project metric to a 0–100 score where higher is always better. */
export function dimensionScores(p: ProjectInput): Dimensions {
  return {
    cost: clamp(100 - Math.max(0, p.costVariance) * 6),
    schedule: clamp(100 - Math.max(0, p.scheduleSlip) * 0.8),
    risk: clamp(100 - p.risk),
    safety: clamp(p.safety),
    quality: clamp(p.quality),
    carbon: clamp(100 - Math.max(0, p.carbon - 400) * 0.25),
  }
}

export function normalizeWeights(w: Weights): Weights {
  const sum = w.cost + w.schedule + w.risk + w.safety + w.quality + w.carbon
  if (sum <= 0) return DEFAULT_WEIGHTS
  return { cost: w.cost / sum, schedule: w.schedule / sum, risk: w.risk / sum, safety: w.safety / sum, quality: w.quality / sum, carbon: w.carbon / sum }
}

function statusFor(health: number): Status {
  if (health >= 75) return 'healthy'
  if (health >= 55) return 'watch'
  return 'at-risk'
}

/** Score one project's health under the given weighting. */
export function computeProject(p: ProjectInput, weights: Weights = DEFAULT_WEIGHTS): ScoredProject {
  const dims = dimensionScores(p)
  const w = normalizeWeights(weights)
  const health =
    dims.cost * w.cost + dims.schedule * w.schedule + dims.risk * w.risk +
    dims.safety * w.safety + dims.quality * w.quality + dims.carbon * w.carbon
  const h = Math.round(health)
  return { ...p, dims, health: h, status: statusFor(h), exposure: Math.round(Math.max(0, p.value) * (1 - h / 100)) }
}

export type Portfolio = {
  projects: ScoredProject[]
  totalValue: number
  health: number // value-weighted portfolio health
  exposure: number // total value at risk
  onTrack: number
  atRisk: number
  wtdCostVariance: number // value-weighted
  avgSlip: number
  watchlist: ScoredProject[] // worst health first
}

/** Roll up the portfolio — health is value-weighted; exposure is the sum. */
export function scorePortfolio(projects: ProjectInput[], weights: Weights = DEFAULT_WEIGHTS): Portfolio {
  const scored = projects.map((p) => computeProject(p, weights))
  const totalValue = scored.reduce((s, p) => s + Math.max(0, p.value), 0)
  const health = totalValue > 0 ? Math.round(scored.reduce((s, p) => s + p.health * Math.max(0, p.value), 0) / totalValue) : 0
  return {
    projects: scored,
    totalValue,
    health,
    exposure: scored.reduce((s, p) => s + p.exposure, 0),
    onTrack: scored.filter((p) => p.status === 'healthy').length,
    atRisk: scored.filter((p) => p.status === 'at-risk').length,
    wtdCostVariance: totalValue > 0 ? round1(scored.reduce((s, p) => s + p.costVariance * Math.max(0, p.value), 0) / totalValue) : 0,
    avgSlip: scored.length ? Math.round(scored.reduce((s, p) => s + p.scheduleSlip, 0) / scored.length) : 0,
    watchlist: [...scored].sort((a, b) => a.health - b.health || b.exposure - a.exposure),
  }
}

/** Average each dimension across the portfolio — for the radar. */
export function dimensionAverages(projects: ProjectInput[]): Dimensions {
  if (!projects.length) return { cost: 0, schedule: 0, risk: 0, safety: 0, quality: 0, carbon: 0 }
  const d = projects.map(dimensionScores)
  const avg = (f: (x: Dimensions) => number) => Math.round(d.reduce((s, x) => s + f(x), 0) / d.length)
  return { cost: avg((x) => x.cost), schedule: avg((x) => x.schedule), risk: avg((x) => x.risk), safety: avg((x) => x.safety), quality: avg((x) => x.quality), carbon: avg((x) => x.carbon) }
}

export function portfolioNarrative(p: Portfolio): string {
  const worst = p.watchlist[0]
  const driver = worst ? ` ${worst.name} carries the most exposure at ${formatMoney(worst.exposure)} (health ${worst.health}).` : ''
  return `Portfolio health is ${p.health}/100 across ${p.projects.length} projects worth ${formatMoney(p.totalValue)}, with ${formatMoney(p.exposure)} of value at risk. ${p.onTrack} project${p.onTrack === 1 ? '' : 's'} are on track and ${p.atRisk} at risk.${driver}`
}

export function formatMoney(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n)}`
}
