/* Data governance scoring — pure, unit-tested. Turns per-dataset attributes
 * into the numbers a data steward actually gates on: a weighted data-quality
 * score across five dimensions, a PII-exposure risk that falls as stronger
 * anonymization is applied, a composite trust score with a grade, and a
 * publish gate against editable thresholds. The analytical core of a real
 * Governance workbench — every verdict is computed from the inputs. */

export type Sensitivity = 'Public' | 'Internal' | 'Confidential' | 'Restricted'
export type Anonymization = 'None' | 'Masking' | 'k-Anonymity' | 'Differential'

export type DimensionScores = {
  completeness: number
  validity: number
  consistency: number
  timeliness: number
  uniqueness: number
}
export type QualityWeights = DimensionScores

export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  completeness: 0.25, validity: 0.25, consistency: 0.2, timeliness: 0.15, uniqueness: 0.15,
}

export type DatasetGov = {
  id: string
  name: string
  dimensions: DimensionScores
  containsPII: boolean
  sensitivity: Sensitivity
  anonymization: Anonymization
  records: number
}

export type ReIdTier = 'Low' | 'Medium' | 'High'
export type Grade = 'A' | 'B' | 'C' | 'D'

export type GovResult = DatasetGov & {
  qualityScore: number // 0–100 weighted across dimensions
  exposure: number // 0–100 PII / privacy exposure risk
  reId: ReIdTier // re-identification risk tier
  trust: number // composite 0–100 (quality + privacy safety)
  grade: Grade
  publishable: boolean
}

export type Thresholds = { minQuality: number; maxExposure: number }
export const DEFAULT_THRESHOLDS: Thresholds = { minQuality: 80, maxExposure: 40 }

/** Inherent exposure by data sensitivity (before anonymization). */
const SENSITIVITY_WEIGHT: Record<Sensitivity, number> = { Public: 10, Internal: 35, Confidential: 65, Restricted: 90 }
/** How much each anonymization technique multiplies residual exposure. */
const ANON_MITIGATION: Record<Anonymization, number> = { None: 1, Masking: 0.6, 'k-Anonymity': 0.35, Differential: 0.15 }

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

export function normalizeWeights(w: QualityWeights): QualityWeights {
  const sum = w.completeness + w.validity + w.consistency + w.timeliness + w.uniqueness
  if (sum <= 0) return DEFAULT_QUALITY_WEIGHTS
  return {
    completeness: w.completeness / sum, validity: w.validity / sum, consistency: w.consistency / sum,
    timeliness: w.timeliness / sum, uniqueness: w.uniqueness / sum,
  }
}

/** Weighted composite of the five quality dimensions, 0–100. */
export function qualityScore(d: DimensionScores, weights: QualityWeights = DEFAULT_QUALITY_WEIGHTS): number {
  const w = normalizeWeights(weights)
  const s =
    clamp(d.completeness) * w.completeness +
    clamp(d.validity) * w.validity +
    clamp(d.consistency) * w.consistency +
    clamp(d.timeliness) * w.timeliness +
    clamp(d.uniqueness) * w.uniqueness
  return round1(s)
}

/** PII / privacy exposure 0–100. Sensitivity sets the inherent risk; PII raises
 *  it; the anonymization technique mitigates the residual. */
export function exposure(d: Pick<DatasetGov, 'containsPII' | 'sensitivity' | 'anonymization'>): number {
  const inherent = SENSITIVITY_WEIGHT[d.sensitivity] * (d.containsPII ? 1 : 0.3)
  return Math.round(clamp(inherent * ANON_MITIGATION[d.anonymization]))
}

export function reIdTier(exp: number): ReIdTier {
  if (exp < 25) return 'Low'
  if (exp < 55) return 'Medium'
  return 'High'
}

export function gradeFor(trust: number): Grade {
  if (trust >= 85) return 'A'
  if (trust >= 70) return 'B'
  if (trust >= 55) return 'C'
  return 'D'
}

/** Full governance verdict for one dataset. */
export function computeDataset(d: DatasetGov, weights: QualityWeights = DEFAULT_QUALITY_WEIGHTS, thresholds: Thresholds = DEFAULT_THRESHOLDS): GovResult {
  const q = qualityScore(d.dimensions, weights)
  const exp = exposure(d)
  const trust = Math.round(0.6 * q + 0.4 * (100 - exp))
  return {
    ...d,
    qualityScore: q,
    exposure: exp,
    reId: reIdTier(exp),
    trust,
    grade: gradeFor(trust),
    publishable: q >= thresholds.minQuality && exp <= thresholds.maxExposure,
  }
}

export function scoreDatasets(list: DatasetGov[], weights: QualityWeights = DEFAULT_QUALITY_WEIGHTS, thresholds: Thresholds = DEFAULT_THRESHOLDS): GovResult[] {
  return list.map((d) => computeDataset(d, weights, thresholds))
}

export type GovSummary = {
  count: number
  avgQuality: number
  avgExposure: number
  publishable: number
  highRisk: number
  records: number
}

export function summarize(results: GovResult[]): GovSummary {
  if (!results.length) return { count: 0, avgQuality: 0, avgExposure: 0, publishable: 0, highRisk: 0, records: 0 }
  const avgQuality = round1(results.reduce((s, r) => s + r.qualityScore, 0) / results.length)
  const avgExposure = round1(results.reduce((s, r) => s + r.exposure, 0) / results.length)
  return {
    count: results.length,
    avgQuality,
    avgExposure,
    publishable: results.filter((r) => r.publishable).length,
    highRisk: results.filter((r) => r.reId === 'High').length,
    records: results.reduce((s, r) => s + r.records, 0),
  }
}

/** Average each quality dimension across the cohort — for the radar. */
export function dimensionAverages(list: DatasetGov[]): DimensionScores {
  if (!list.length) return { completeness: 0, validity: 0, consistency: 0, timeliness: 0, uniqueness: 0 }
  const sum = (f: (d: DimensionScores) => number) => list.reduce((s, d) => s + f(d.dimensions), 0) / list.length
  return {
    completeness: Math.round(sum((x) => x.completeness)),
    validity: Math.round(sum((x) => x.validity)),
    consistency: Math.round(sum((x) => x.consistency)),
    timeliness: Math.round(sum((x) => x.timeliness)),
    uniqueness: Math.round(sum((x) => x.uniqueness)),
  }
}

export function governanceNarrative(s: GovSummary): string {
  return `${s.publishable} of ${s.count} datasets clear the publish gate. Cohort data-quality averages ${s.avgQuality} with a mean exposure of ${s.avgExposure}; ${s.highRisk} dataset${s.highRisk === 1 ? '' : 's'} carry High re-identification risk and need stronger anonymization before release.`
}
