/* Embodied-carbon analytics — the real LCA take-off math, pure and unit-tested.
 * Embodied carbon for a line item is quantity × emission factor (kgCO₂e per
 * unit, A1–A3). Summed across the take-off and divided by GFA it yields the
 * carbon intensity (kgCO₂e/m²) that every benchmark and rating is built on.
 * Each line also carries a conventional-baseline factor so the saving from a
 * lower-carbon specification is computed, not asserted. This is the analytical
 * core of a real Sustainability workbench — every number is derived. */

export type MaterialInput = {
  id: string
  name: string
  quantity: number
  unit: string // display only (m³, t, m², …)
  factor: number // kgCO₂e per unit — the specified product
  baselineFactor: number // kgCO₂e per unit — the conventional baseline
}

export type ScoredLine = MaterialInput & {
  carbon: number // quantity × factor (kgCO₂e)
  baselineCarbon: number // quantity × baselineFactor
  saving: number // baselineCarbon − carbon
  share: number // % of total carbon
}

export type Rating = 'A' | 'B' | 'C' | 'D'

export type CarbonResult = {
  lines: ScoredLine[]
  totalCarbon: number // kgCO₂e
  baselineCarbon: number
  saving: number
  savingPct: number
  intensity: number // kgCO₂e/m²
  baselineIntensity: number
  benchmark: number
  overBenchmark: boolean
  rating: Rating
}

const round1 = (n: number) => Math.round(n * 10) / 10
const nn = (n: number) => Math.max(0, n) // non-negative guard

/** Rating band from intensity relative to the benchmark (≤60% = A … >100% = D). */
export function ratingFor(intensity: number, benchmark: number): Rating {
  if (benchmark <= 0) return 'D'
  const r = intensity / benchmark
  if (r <= 0.6) return 'A'
  if (r <= 0.85) return 'B'
  if (r <= 1) return 'C'
  return 'D'
}

/** Compute the full embodied-carbon picture for a take-off at a given GFA. */
export function computeCarbon(lines: MaterialInput[], opts: { gfa: number; benchmark: number }): CarbonResult {
  const base = lines.map((l) => {
    const carbon = nn(l.quantity) * nn(l.factor)
    const baselineCarbon = nn(l.quantity) * nn(l.baselineFactor)
    return { ...l, carbon, baselineCarbon, saving: baselineCarbon - carbon, share: 0 }
  })
  const totalCarbon = base.reduce((s, l) => s + l.carbon, 0)
  const baselineCarbon = base.reduce((s, l) => s + l.baselineCarbon, 0)
  const scored: ScoredLine[] = base.map((l) => ({ ...l, share: totalCarbon > 0 ? round1((l.carbon / totalCarbon) * 100) : 0 }))

  const intensity = opts.gfa > 0 ? Math.round(totalCarbon / opts.gfa) : 0
  const baselineIntensity = opts.gfa > 0 ? Math.round(baselineCarbon / opts.gfa) : 0
  const saving = baselineCarbon - totalCarbon
  const savingPct = baselineCarbon > 0 ? round1((saving / baselineCarbon) * 100) : 0

  return {
    lines: scored,
    totalCarbon: Math.round(totalCarbon),
    baselineCarbon: Math.round(baselineCarbon),
    saving: Math.round(saving),
    savingPct,
    intensity,
    baselineIntensity,
    benchmark: opts.benchmark,
    overBenchmark: intensity > opts.benchmark,
    rating: ratingFor(intensity, opts.benchmark),
  }
}

/** Whole-life intensity (kgCO₂e/m²) = embodied + operational over the study period. */
export function wholeLifeIntensity(embodiedIntensity: number, operationalAnnual: number, studyPeriodYears: number): number {
  return Math.round(embodiedIntensity + nn(operationalAnnual) * nn(studyPeriodYears))
}

/** kgCO₂e → a compact tonnes string for big figures. */
export function tonnes(kg: number): string {
  const t = kg / 1000
  if (Math.abs(t) >= 1000) return `${round1(t / 1000)} ktCO₂e`
  return `${Math.round(t).toLocaleString()} tCO₂e`
}

/** A plain-language read of the carbon model. */
export function carbonNarrative(r: CarbonResult): string {
  const vsBench = r.overBenchmark
    ? `${r.intensity - r.benchmark} kgCO₂e/m² over the ${r.benchmark} benchmark`
    : `${r.benchmark - r.intensity} kgCO₂e/m² under the ${r.benchmark} benchmark`
  const top = [...r.lines].sort((a, b) => b.carbon - a.carbon)[0]
  const driver = top ? ` ${top.name} is the largest source at ${top.share}% of the footprint.` : ''
  return `Upfront embodied carbon is ${tonnes(r.totalCarbon)} — an intensity of ${r.intensity} kgCO₂e/m² (rating ${r.rating}), ${vsBench}. The specified products cut ${r.savingPct}% versus a conventional baseline.${driver}`
}
