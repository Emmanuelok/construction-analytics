/* Supplier scoring — a transparent weighted multi-criteria model, pure and
 * unit-tested. Normalizes four criteria to 0–100 (on-time & quality: higher is
 * better; lead time & price: lower is better, normalized against the cohort),
 * applies adjustable weights, and derives a composite score, rank and risk tier.
 * The analytical core of an operable Procurement workbench. */

export type SupplierInput = {
  id: string
  name: string
  category?: string
  region?: string
  onTime: number // % on-time delivery (higher better)
  quality: number // % quality acceptance (higher better)
  leadTime: number // days (lower better)
  priceIndex: number // 100 = market; lower is cheaper (lower better)
}

export type Weights = { onTime: number; quality: number; leadTime: number; price: number }
export const DEFAULT_WEIGHTS: Weights = { onTime: 0.3, quality: 0.3, leadTime: 0.2, price: 0.2 }

export type RiskTier = 'Low' | 'Medium' | 'High'
export type ScoredSupplier = SupplierInput & {
  score: number // 0–100 composite
  rank: number // 1 = best
  risk: RiskTier
  components: { onTime: number; quality: number; leadTime: number; price: number } // normalized 0–100
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Normalize a "lower is better" value to 0–100 within the cohort's [min,max]. */
function normLowerBetter(v: number, min: number, max: number): number {
  if (max === min) return 100
  return clamp01((max - v) / (max - min)) * 100
}
/** Normalize a "higher is better" %-style value (already ~0–100) to 0–100. */
function normHigherBetter(v: number): number {
  return Math.max(0, Math.min(100, v))
}

/** Normalize weights to sum to 1 (so any sliders are valid). */
export function normalizeWeights(w: Weights): Weights {
  const sum = w.onTime + w.quality + w.leadTime + w.price
  if (sum <= 0) return DEFAULT_WEIGHTS
  return { onTime: w.onTime / sum, quality: w.quality / sum, leadTime: w.leadTime / sum, price: w.price / sum }
}

function tierFor(score: number): RiskTier {
  if (score >= 85) return 'Low'
  if (score >= 70) return 'Medium'
  return 'High'
}

/** Score + rank a cohort of suppliers with the given weights. */
export function scoreSuppliers(suppliers: SupplierInput[], weights: Weights = DEFAULT_WEIGHTS): ScoredSupplier[] {
  if (!suppliers.length) return []
  const w = normalizeWeights(weights)
  const leads = suppliers.map((s) => s.leadTime)
  const prices = suppliers.map((s) => s.priceIndex)
  const lMin = Math.min(...leads), lMax = Math.max(...leads)
  const pMin = Math.min(...prices), pMax = Math.max(...prices)

  const scored = suppliers.map((s) => {
    const components = {
      onTime: normHigherBetter(s.onTime),
      quality: normHigherBetter(s.quality),
      leadTime: normLowerBetter(s.leadTime, lMin, lMax),
      price: normLowerBetter(s.priceIndex, pMin, pMax),
    }
    const score =
      components.onTime * w.onTime +
      components.quality * w.quality +
      components.leadTime * w.leadTime +
      components.price * w.price
    const rounded = Math.round(score * 10) / 10
    return { ...s, components, score: rounded, risk: tierFor(rounded), rank: 0 }
  })

  // rank by score (desc), stable on name
  const ordered = [...scored].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  ordered.forEach((s, i) => (s.rank = i + 1))
  // return in original order with ranks attached
  const rankById = new Map(ordered.map((s) => [s.id, s.rank]))
  return scored.map((s) => ({ ...s, rank: rankById.get(s.id) ?? 0 }))
}

/** Cohort summary for the KPI row. */
export function cohortStats(scored: ScoredSupplier[]) {
  if (!scored.length) return { avgScore: 0, highRisk: 0, avgLead: 0, best: null as ScoredSupplier | null }
  const avgScore = Math.round((scored.reduce((s, x) => s + x.score, 0) / scored.length) * 10) / 10
  const highRisk = scored.filter((s) => s.risk === 'High').length
  const avgLead = Math.round(scored.reduce((s, x) => s + x.leadTime, 0) / scored.length)
  const best = [...scored].sort((a, b) => a.rank - b.rank)[0]
  return { avgScore, highRisk, avgLead, best }
}
