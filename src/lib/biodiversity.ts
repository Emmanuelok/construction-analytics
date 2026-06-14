/* Biodiversity Net Gain (BNG) — pure, unit-tested. Models the statutory biodiversity
 * metric for area habitats: biodiversity units = area (ha) × distinctiveness × condition
 * × strategic significance. It scores the site's baseline habitat, then the post-
 * development habitats (sealed footprint + hardstanding score zero; retained/created
 * green space and green roofs score by their type & condition), and reports the net
 * change and percentage gain against the +10% requirement — with the off-site units
 * needed to close any shortfall. The core of a BNG assessment / planning condition.
 * Indicative scores per the metric, tunable. No DOM. */

export type Distinctiveness = 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
export const DISTINCTIVENESS_SCORE: Record<Distinctiveness, number> = { 'very-low': 0, low: 2, medium: 4, high: 6, 'very-high': 8 }
export const DISTINCTIVENESS_LABEL: Record<Distinctiveness, string> = { 'very-low': 'Very low', low: 'Low', medium: 'Medium', high: 'High', 'very-high': 'Very high' }

export type Condition = 'poor' | 'moderate' | 'good'
export const CONDITION_SCORE: Record<Condition, number> = { poor: 1, moderate: 2, good: 3 }
export const CONDITION_LABEL: Record<Condition, string> = { poor: 'Poor', moderate: 'Moderate', good: 'Good' }

export type HabitatSpec = { distinctiveness: Distinctiveness; condition: Condition }

export type BngInput = {
  siteAreaM2: number
  footprintM2: number
  hardstandingM2: number
  baseline: HabitatSpec
  proposedGreen: HabitatSpec   // retained / created green space
  greenRoofM2?: number
  greenRoofCondition?: Condition
  strategicSignificance?: number // 1.0 (low) … 1.15 (high) — location multiplier
  targetGainPct?: number         // default +10%
}

export type HabitatLine = { name: string; areaHa: number; distinctiveness: Distinctiveness; condition: Condition; units: number }
export type Bng = {
  baselineLines: HabitatLine[]; postLines: HabitatLine[]
  baselineUnits: number; postUnits: number
  netChange: number; netGainPct: number
  target: number; meets: boolean
  shortfallUnits: number   // off-site units needed to reach the target (0 if met)
  sealedHa: number; greenHa: number
  note: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const HA = (m2: number) => m2 / 10000

/** Biodiversity units = area(ha) × distinctiveness × condition × strategic significance. */
export function habitatUnits(areaHa: number, spec: HabitatSpec, strategic = 1): number {
  return areaHa * DISTINCTIVENESS_SCORE[spec.distinctiveness] * CONDITION_SCORE[spec.condition] * strategic
}

/** Run the BNG assessment. */
export function biodiversity(input: BngInput): Bng {
  const site = Math.max(0, input.siteAreaM2)
  const strategic = input.strategicSignificance ?? 1
  const target = input.targetGainPct ?? 10

  const baselineUnits = r2(habitatUnits(HA(site), input.baseline, strategic))
  const baselineLines: HabitatLine[] = [{ name: 'Existing site habitat', areaHa: r2(HA(site)), distinctiveness: input.baseline.distinctiveness, condition: input.baseline.condition, units: baselineUnits }]

  const sealed = Math.min(site, Math.max(0, input.footprintM2) + Math.max(0, input.hardstandingM2))
  const greenRoof = Math.max(0, input.greenRoofM2 ?? 0)
  const green = Math.max(0, site - sealed)
  const greenUnits = r2(habitatUnits(HA(green), input.proposedGreen, strategic))
  // green roofs score as a created habitat at a reduced multiplier (roofs are less ecologically connected)
  const greenRoofUnits = r2(habitatUnits(HA(greenRoof), { distinctiveness: 'medium', condition: input.greenRoofCondition ?? 'moderate' }, strategic) * 0.5)

  const postLines: HabitatLine[] = [
    { name: 'Sealed (building + hardstanding)', areaHa: r2(HA(sealed)), distinctiveness: 'very-low', condition: 'poor', units: 0 },
    { name: 'Green space (retained / created)', areaHa: r2(HA(green)), distinctiveness: input.proposedGreen.distinctiveness, condition: input.proposedGreen.condition, units: greenUnits },
    ...(greenRoof > 0 ? [{ name: 'Green roof', areaHa: r2(HA(greenRoof)), distinctiveness: 'medium' as Distinctiveness, condition: input.greenRoofCondition ?? 'moderate', units: greenRoofUnits }] : []),
  ]
  const postUnits = r2(greenUnits + greenRoofUnits)
  const netChange = r2(postUnits - baselineUnits)
  const netGainPct = baselineUnits > 0 ? Math.round((netChange / baselineUnits) * 1000) / 10 : (postUnits > 0 ? 100 : 0)
  const requiredUnits = baselineUnits * (1 + target / 100)
  const shortfallUnits = r2(Math.max(0, requiredUnits - postUnits))
  const meets = postUnits >= requiredUnits - 1e-6

  const note = meets
    ? `Delivers ${netGainPct >= 0 ? '+' : ''}${netGainPct}% biodiversity net gain on-site — above the +${target}% requirement (${baselineUnits} → ${postUnits} units).`
    : `On-site change is ${netGainPct >= 0 ? '+' : ''}${netGainPct}% (${baselineUnits} → ${postUnits} units), short of +${target}%. Close the gap with ~${shortfallUnits} off-site units, richer planting, or more green roof.`

  return {
    baselineLines, postLines, baselineUnits, postUnits, netChange, netGainPct, target, meets, shortfallUnits,
    sealedHa: r2(HA(sealed)), greenHa: r2(HA(green)), note,
  }
}

/** BNG CSV. */
export function biodiversityCsv(b: Bng): string {
  const head = 'Stage,Habitat,Area (ha),Distinctiveness,Condition,Units'
  const base = b.baselineLines.map((l) => `Baseline,${l.name},${l.areaHa},${DISTINCTIVENESS_LABEL[l.distinctiveness]},${CONDITION_LABEL[l.condition]},${l.units}`)
  const post = b.postLines.map((l) => `Post,${l.name},${l.areaHa},${DISTINCTIVENESS_LABEL[l.distinctiveness]},${CONDITION_LABEL[l.condition]},${l.units}`)
  const meta = ['', 'Metric,Value', `Baseline units,${b.baselineUnits}`, `Post-development units,${b.postUnits}`, `Net change,${b.netChange}`, `Net gain,${b.netGainPct}%`, `Target,+${b.target}%`, `Meets target,${b.meets ? 'yes' : 'no'}`, `Off-site units needed,${b.shortfallUnits}`]
  return [head, ...base, ...post, ...meta].join('\n')
}
