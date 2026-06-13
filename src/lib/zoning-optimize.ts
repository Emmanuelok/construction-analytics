/* As-of-right massing maximiser — pure, unit-tested. Finds the GFA-maximal scheme
 * that still passes every zoning test, and names the binding constraint (the rule
 * that stops you building more). It searches storey counts: at each count the
 * footprint is capped by setback + coverage, height is count × storey height, and
 * GFA = min(FAR cap, footprint × count). The best compliant GFA wins; the limit
 * that pins it (FAR / height / coverage / setback / sky-plane) is reported so the
 * UI can say *why*. Mirrors buildZoning's geometry so the result round-trips
 * through the same compliance check. No DOM. */

import { buildZoning, type ZoningInput, type Zoning } from './zoning'

export type OptimizedScheme = {
  proposedGFA: number
  proposedStoreys: number
  height: number
  utilisation: number
  binding: 'FAR' | 'Height' | 'Coverage' | 'Setback' | 'Sky plane' | 'None'
  bindingNote: string
  zoning: Zoning
}

type Rules = Omit<ZoningInput, 'proposedGFA' | 'proposedStoreys'>

/** Maximise compliant GFA over storey counts (1…maxStoreys). */
export function maximizeScheme(rules: Rules, opts: { maxStoreys?: number } = {}): OptimizedScheme {
  const maxStoreys = opts.maxStoreys ?? Math.max(1, Math.floor((rules.heightLimit ?? 60) / Math.max(2, rules.storeyHeight ?? 3.6)))
  let best: OptimizedScheme | null = null
  for (let storeys = 1; storeys <= maxStoreys; storeys++) {
    const height = storeys * rules.storeyHeight
    if (height > rules.heightLimit + 1e-6) break
    // probe with a GFA above any cap so buildZoning reports the real footprint cap,
    // then settle GFA = footprintCap × storeys, itself capped by FAR.
    const probe = buildZoning({ ...rules, proposedGFA: rules.far * 1e9, proposedStoreys: storeys })
    const footprintCap = probe.maxFootprint // min(buildable, coverage)
    const farCap = probe.maxGFA
    const gfa = Math.min(farCap, footprintCap * storeys)
    if (gfa <= 0) continue
    const z = buildZoning({ ...rules, proposedGFA: gfa, proposedStoreys: storeys })
    if (!z.compliance.overall) continue
    if (!best || gfa > best.proposedGFA + 1e-6) {
      best = { proposedGFA: Math.round(gfa), proposedStoreys: storeys, height: Math.round(z.proposed.height), utilisation: Math.round(z.utilisation), binding: 'None', bindingNote: '', zoning: z }
    }
  }
  if (!best) {
    const z = buildZoning({ ...rules, proposedGFA: 0, proposedStoreys: 1 })
    return { proposedGFA: 0, proposedStoreys: 1, height: 0, utilisation: 0, binding: 'Setback', bindingNote: 'The setback collapses the buildable area — no scheme fits.', zoning: z }
  }
  // identify the binding constraint: which cap does the optimum sit against?
  const z = best.zoning
  const farUsed = best.proposedGFA / Math.max(1, z.maxGFA)
  const heightUsed = best.height / Math.max(1, z.maxHeight)
  const coverageUsed = z.proposed.coverage / Math.max(1, rules.maxCoverage)
  const footprintUsed = z.proposed.footprint / Math.max(1, z.buildableArea)
  const near = (v: number) => v >= 0.985
  if (near(farUsed)) { best.binding = 'FAR'; best.bindingNote = `FAR ${rules.far} caps GFA at ${Math.round(z.maxGFA).toLocaleString()} m² — add site area or seek a FAR bonus to build more.` }
  else if (best.proposedStoreys + 1 > Math.floor(rules.heightLimit / rules.storeyHeight) && near(heightUsed)) { best.binding = 'Height'; best.bindingNote = `The ${rules.heightLimit} m height limit stops the tower — the FAR isn't fully used.` }
  else if (near(coverageUsed) || near(footprintUsed)) { best.binding = 'Coverage'; best.bindingNote = `Footprint is pinned by ${near(footprintUsed) ? 'the setback line' : `the ${rules.maxCoverage}% coverage cap`}; a slimmer, taller tower would unlock GFA up to the height limit.` }
  else { best.binding = 'None'; best.bindingNote = 'The scheme reaches the FAR within all other limits.' }
  return best
}

import { feasibility, type ProgrammeMix } from './feasibility'

export type ValueOptimum = {
  proposedGFA: number
  proposedStoreys: number
  residualLandValue: number
  perStorey: { storeys: number; gfa: number; rlv: number; compliant: boolean }[]
  note: string
}

/** Value-optimal massing: among the compliant storey counts, the one whose
 *  development pro forma yields the highest residual land value (developers
 *  maximise value, not just GFA — a tall slim tower can beat a fatter low one,
 *  or vice-versa, depending on rates). Reuses the same compliance + feasibility. */
export function maximizeValue(
  rules: Rules,
  feasInput: { mix: ProgrammeMix; investmentYield?: number; targetMarginPct?: number },
  opts: { maxStoreys?: number } = {},
): ValueOptimum {
  const maxStoreys = opts.maxStoreys ?? Math.max(1, Math.floor((rules.heightLimit ?? 60) / Math.max(2, rules.storeyHeight ?? 3.6)))
  const perStorey: ValueOptimum['perStorey'] = []
  let best: { storeys: number; gfa: number; rlv: number } | null = null
  for (let storeys = 1; storeys <= maxStoreys; storeys++) {
    if (storeys * rules.storeyHeight > rules.heightLimit + 1e-6) break
    const probe = buildZoning({ ...rules, proposedGFA: rules.far * 1e9, proposedStoreys: storeys })
    const gfa = Math.min(probe.maxGFA, probe.maxFootprint * storeys)
    if (gfa <= 0) continue
    const z = buildZoning({ ...rules, proposedGFA: gfa, proposedStoreys: storeys })
    const compliant = z.compliance.overall
    const f = feasibility({ gfa, mix: feasInput.mix, siteArea: z.siteArea, buildableArea: z.buildableArea, investmentYield: feasInput.investmentYield, targetMarginPct: feasInput.targetMarginPct })
    perStorey.push({ storeys, gfa: Math.round(gfa), rlv: f.residualLandValue, compliant })
    if (compliant && (!best || f.residualLandValue > best.rlv)) best = { storeys, gfa: Math.round(gfa), rlv: f.residualLandValue }
  }
  if (!best) return { proposedGFA: 0, proposedStoreys: 1, residualLandValue: 0, perStorey, note: 'No compliant scheme fits the zoning.' }
  const note = `${best.storeys} storeys (${best.gfa.toLocaleString()} m²) yields the highest residual land value of the compliant options.`
  return { proposedGFA: best.gfa, proposedStoreys: best.storeys, residualLandValue: best.rlv, perStorey, note }
}
