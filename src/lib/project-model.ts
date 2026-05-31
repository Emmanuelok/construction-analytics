/* Unified project model — pure, unit-tested. The heart of "one project, every
 * lens": from a single project's editable vitals it runs the existing engines —
 * Earned Value (cost/schedule), the six-dimension composite health + exposure
 * (portfolio), and the embodied-carbon rating — so every workbench reads from
 * one coherent dataset instead of seeding its own demo. */

import { computeEvm, type Evm } from './evm'
import { computeProject, type Dimensions, type Status } from './portfolio'
import { ratingFor, type Rating } from './carbon'

export type ProjectVitals = {
  id: string
  name: string
  sector: string
  location: string
  value: number // contract value / budget at completion
  gfa: number // gross floor area, m²
  progress: number // % complete
  costVariance: number // % (+ over budget)
  scheduleVariance: number // days (+ late)
  risk: number // 0–100
  safety: number // 0–100
  quality: number // 0–100
  carbon: number // kgCO₂e/m²
  rfis: number
  clashes: number
}

export const CARBON_BENCHMARK = 500

export type ProjectModel = {
  vitals: ProjectVitals
  evm: Evm
  health: number // composite 0–100
  status: Status
  dims: Dimensions // six 0–100 dimension scores
  exposure: number // $ value at risk (value × (1 − health))
  carbonIntensity: number // kgCO₂e/m²
  carbonRating: Rating
  costPerM2: number // value ÷ gfa
}

/** Run every project-level engine off one coherent set of vitals. */
export function deriveProjectModel(v: ProjectVitals): ProjectModel {
  const evm = computeEvm({
    bac: Math.max(0, v.value),
    progressPct: v.progress,
    costVariancePct: v.costVariance,
    scheduleSlipDays: v.scheduleVariance,
    plannedDurationDays: 1000,
  })
  const cp = computeProject({
    id: v.id,
    name: v.name,
    sector: v.sector,
    value: v.value,
    costVariance: v.costVariance,
    scheduleSlip: v.scheduleVariance,
    risk: v.risk,
    safety: v.safety,
    quality: v.quality,
    carbon: v.carbon,
  })
  return {
    vitals: v,
    evm,
    health: cp.health,
    status: cp.status,
    dims: cp.dims,
    exposure: cp.exposure,
    carbonIntensity: v.carbon,
    carbonRating: ratingFor(v.carbon, CARBON_BENCHMARK),
    costPerM2: v.gfa > 0 ? Math.round(v.value / v.gfa) : 0,
  }
}

const STATUS_WORD: Record<Status, string> = { healthy: 'on track', watch: 'on watch', 'at-risk': 'at risk' }

export function projectNarrative(m: ProjectModel): string {
  const v = m.vitals
  const cost = m.evm.cpi >= 1 ? 'under budget' : 'over budget'
  const sched = m.evm.spi >= 1 ? 'ahead of schedule' : 'behind schedule'
  return `${v.name} (${v.sector}, ${v.location}) is ${STATUS_WORD[m.status]} with a composite health of ${m.health}/100. At ${v.progress}% complete it is ${cost} (CPI ${m.evm.cpi.toFixed(2)}) and ${sched} (SPI ${m.evm.spi.toFixed(2)}), forecasting EAC against a ${(v.value / 1e6).toFixed(0)}M budget. Embodied carbon is ${m.carbonIntensity} kgCO₂e/m² (rating ${m.carbonRating}); safety ${v.safety}, quality ${v.quality}, ${v.rfis.toLocaleString()} open RFIs and ${v.clashes} clashes.`
}
