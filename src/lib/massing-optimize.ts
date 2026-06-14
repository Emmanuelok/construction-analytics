/* Massing design-space optimiser — pure, unit-tested. Where maximizeScheme finds
 * the single GFA-maximal scheme and maximizeValue the single value-maximal one,
 * this sweeps the whole massing design space — storey count × podium fraction ×
 * tower setback — and evaluates every configuration (compliance, GFA, height,
 * coverage, residual land value). It then extracts the Pareto frontier on value
 * vs height: the schemes where you cannot win more residual land value without
 * building taller. Reuses buildZoning + feasibility so every candidate round-trips
 * through the same compliance + pro-forma maths. No DOM. */

import { buildZoning, type ZoningInput } from './zoning'
import { feasibility, type ProgrammeMix } from './feasibility'

type Rules = Omit<ZoningInput, 'proposedGFA' | 'proposedStoreys'>

export type MassingCandidate = {
  storeys: number; podium: number; towerSetback: number
  gfa: number; height: number; footprint: number; coverage: number
  rlv: number; compliant: boolean; onFrontier: boolean
}
export type MassingStudy = {
  candidates: MassingCandidate[]
  frontier: MassingCandidate[]
  maxGfa?: MassingCandidate
  maxValue?: MassingCandidate
  mostCompact?: MassingCandidate // shortest scheme within 5% of the best value
  note: string
}

const PODIUM_CONFIGS: { podium: number; towerSetback: number }[] = [
  { podium: 0, towerSetback: 0 },
  { podium: 0.3, towerSetback: 0.25 },
  { podium: 0.3, towerSetback: 0.4 },
  { podium: 0.5, towerSetback: 0.25 },
  { podium: 0.5, towerSetback: 0.4 },
]

/** Sweep storeys × podium × tower-setback; evaluate + find the value/height frontier. */
export function optimizeMassing(
  rules: Rules,
  feasInput: { mix: ProgrammeMix; investmentYield?: number; targetMarginPct?: number },
  opts: { maxStoreys?: number } = {},
): MassingStudy {
  const maxStoreys = opts.maxStoreys ?? Math.max(1, Math.floor((rules.heightLimit ?? 60) / Math.max(2, rules.storeyHeight ?? 3.6)))
  const candidates: MassingCandidate[] = []
  for (let storeys = 1; storeys <= maxStoreys; storeys++) {
    if (storeys * rules.storeyHeight > rules.heightLimit + 1e-6) break
    const probe = buildZoning({ ...rules, proposedGFA: rules.far * 1e9, proposedStoreys: storeys })
    const plate = probe.maxFootprint // setback / coverage cap
    const farCap = probe.maxGFA
    if (plate <= 0 || farCap <= 0) continue
    for (const { podium, towerSetback } of PODIUM_CONFIGS) {
      const podiumStoreys = Math.round(podium * storeys)
      const towerStoreys = storeys - podiumStoreys
      const hasTower = podiumStoreys > 0 && towerStoreys > 0 && towerSetback > 0
      if (podium > 0 && !hasTower) continue // config degenerates to the flat case
      const gfaCoverage = hasTower ? plate * (podiumStoreys + (1 - towerSetback) * towerStoreys) : plate * storeys
      const gfa = Math.min(farCap, gfaCoverage)
      if (gfa <= 0) continue
      const z = buildZoning({ ...rules, proposedGFA: gfa, proposedStoreys: storeys, podium, towerSetback })
      const f = feasibility({ gfa, mix: feasInput.mix, siteArea: z.siteArea, buildableArea: z.buildableArea, investmentYield: feasInput.investmentYield, targetMarginPct: feasInput.targetMarginPct })
      candidates.push({
        storeys, podium, towerSetback,
        gfa: Math.round(gfa), height: Math.round(z.proposed.height * 10) / 10,
        footprint: Math.round(z.proposed.footprint), coverage: Math.round(z.proposed.coverage * 10) / 10,
        rlv: f.residualLandValue, compliant: z.compliance.overall, onFrontier: false,
      })
    }
  }

  // Pareto frontier on (residual land value ↑, height ↓): keep a compliant scheme
  // unless another compliant one is at least as valuable AND no taller.
  const compliant = candidates.filter((c) => c.compliant)
  const frontier = compliant.filter((c) => !compliant.some((o) => o !== c && o.rlv >= c.rlv && o.height <= c.height && (o.rlv > c.rlv || o.height < c.height)))
    .sort((a, b) => a.height - b.height)
  for (const c of frontier) c.onFrontier = true

  const maxGfa = compliant.reduce<MassingCandidate | undefined>((m, c) => (!m || c.gfa > m.gfa ? c : m), undefined)
  const maxValue = compliant.reduce<MassingCandidate | undefined>((m, c) => (!m || c.rlv > m.rlv ? c : m), undefined)
  const mostCompact = maxValue
    ? compliant.filter((c) => c.rlv >= maxValue.rlv * 0.95).reduce<MassingCandidate | undefined>((m, c) => (!m || c.height < m.height ? c : m), undefined)
    : undefined

  const note = maxValue
    ? `Swept ${candidates.length} massing options; ${frontier.length} sit on the value/height frontier. Peak value at ${maxValue.storeys} storeys${maxValue.podium > 0 ? ' with a podium+tower' : ''}.`
    : 'No compliant massing fits the zoning envelope.'
  return { candidates, frontier, maxGfa, maxValue, mostCompact, note }
}

/** Massing study CSV — every candidate + a frontier flag. */
export function massingCsv(s: MassingStudy): string {
  const head = 'Storeys,Podium %,Tower setback %,GFA (m²),Height (m),Footprint (m²),Coverage %,Residual land,Compliant,On frontier'
  const rows = s.candidates.map((c) => `${c.storeys},${Math.round(c.podium * 100)},${Math.round(c.towerSetback * 100)},${c.gfa},${c.height},${c.footprint},${c.coverage},${c.rlv},${c.compliant ? 'yes' : 'no'},${c.onFrontier ? 'yes' : 'no'}`)
  return [head, ...rows].join('\n')
}
