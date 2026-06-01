/* Progress-verification analytics — pure, unit-tested. Reality capture exists to
 * answer one question: is claimed progress actually built? This engine compares
 * planned, contractor-claimed and CV-verified installed quantities per zone,
 * weights verification by capture confidence, and derives the claim gap, the
 * value at risk (claimed-but-unverified work) and a verification score. The
 * analytical core of a real progress-verification workbench. */

export type ZoneInput = {
  id: string
  zone: string
  unit: string
  plannedQty: number
  claimedQty: number // contractor-claimed installed quantity
  verifiedQty: number // CV-verified from capture
  rate: number // cost per unit
  confidence: number // 0–1 capture/CV confidence for this zone
}

export type ZoneStatus = 'verified' | 'review' | 'over-claimed'

export type ScoredZone = ZoneInput & {
  claimedPct: number
  verifiedPct: number
  claimGapQty: number // claimed − verified
  claimGapPct: number // gap as % of planned
  claimGapValue: number // gap × rate
  verificationScore: number // 0–100, confidence-weighted
  status: ZoneStatus
}

export type Thresholds = { tolerancePct: number; minConfidence: number }
export const DEFAULT_THRESHOLDS: Thresholds = { tolerancePct: 3, minConfidence: 0.8 }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

/** Score one zone: completion %, claim gap and a confidence-weighted score. */
export function scoreZone(z: ZoneInput, t: Thresholds = DEFAULT_THRESHOLDS): ScoredZone {
  const planned = Math.max(0, z.plannedQty)
  const claimed = Math.max(0, z.claimedQty)
  const verified = Math.max(0, z.verifiedQty)
  const conf = clamp(z.confidence, 0, 1)

  const claimedPct = planned > 0 ? round1((claimed / planned) * 100) : 0
  const verifiedPct = planned > 0 ? round1((verified / planned) * 100) : 0
  const claimGapQty = claimed - verified
  const claimGapPct = planned > 0 ? round1((claimGapQty / planned) * 100) : 0
  const claimGapValue = Math.round(claimGapQty * z.rate)

  // How much of the claim is actually backed by verified capture, scaled by confidence.
  const coverage = claimed > 0 ? Math.min(1, verified / claimed) : 1
  const verificationScore = Math.round(clamp(coverage * conf * 100, 0, 100))

  const status: ZoneStatus =
    conf < t.minConfidence ? 'review' : claimGapPct > t.tolerancePct ? 'over-claimed' : 'verified'

  return { ...z, claimedPct, verifiedPct, claimGapQty, claimGapPct, claimGapValue, verificationScore, status }
}

export type VerifySummary = {
  zones: number
  plannedValue: number
  claimedValue: number
  verifiedValue: number
  claimedPct: number // value-weighted
  verifiedPct: number // value-weighted
  claimGapValue: number // total claimed − verified value
  valueAtRisk: number // sum of positive (over-claimed) gap value
  avgVerification: number
  overClaimed: number
  review: number
}

/** Value-weighted portfolio roll-up — quantities differ by unit, so value is the
 *  common denominator. Value at risk counts only claimed-but-unverified work. */
export function summarize(zones: ZoneInput[], t: Thresholds = DEFAULT_THRESHOLDS): VerifySummary {
  const scored = zones.map((z) => scoreZone(z, t))
  const plannedValue = scored.reduce((s, z) => s + Math.max(0, z.plannedQty) * z.rate, 0)
  const claimedValue = scored.reduce((s, z) => s + Math.max(0, z.claimedQty) * z.rate, 0)
  const verifiedValue = scored.reduce((s, z) => s + Math.max(0, z.verifiedQty) * z.rate, 0)
  return {
    zones: scored.length,
    plannedValue: Math.round(plannedValue),
    claimedValue: Math.round(claimedValue),
    verifiedValue: Math.round(verifiedValue),
    claimedPct: plannedValue > 0 ? round1((claimedValue / plannedValue) * 100) : 0,
    verifiedPct: plannedValue > 0 ? round1((verifiedValue / plannedValue) * 100) : 0,
    claimGapValue: Math.round(claimedValue - verifiedValue),
    valueAtRisk: Math.round(scored.reduce((s, z) => s + Math.max(0, z.claimGapValue), 0)),
    avgVerification: scored.length ? round1(scored.reduce((s, z) => s + z.verificationScore, 0) / scored.length) : 0,
    overClaimed: scored.filter((z) => z.status === 'over-claimed').length,
    review: scored.filter((z) => z.status === 'review').length,
  }
}

export function verifyNarrative(s: VerifySummary): string {
  const gapPts = round1(s.claimedPct - s.verifiedPct)
  return `Capture verifies ${s.verifiedPct}% of planned value built, against ${s.claimedPct}% claimed — a ${gapPts}-point gap. ${formatMoney(s.valueAtRisk)} of claimed work is not yet verified${s.overClaimed > 0 ? ` across ${s.overClaimed} over-claimed zone${s.overClaimed === 1 ? '' : 's'}` : ''}, and ${s.review} zone${s.review === 1 ? '' : 's'} need better capture before progress can be trusted.`
}

export function formatMoney(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n)}`
}
