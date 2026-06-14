/* Whole-life carbon for the massing — pure, unit-tested. Estimates a scheme's
 * carbon from its GFA and structural system: embodied carbon (RICS A1–A5, product
 * + construction) split by building element, plus biogenic sequestration for
 * timber, and operational carbon (B6, regulated energy) over a study period.
 * Element intensities (kgCO2e/m² GFA) scale with the structure (concrete / steel /
 * timber / hybrid) and a tall-building premium on the frame. Whole-life carbon is
 * benchmarked against the RIBA 2030 and LETI targets and given a band. Indicative
 * design-stage factors, fully tunable — a carbon model, not a verified LCA. This is
 * the massing-level companion to the line-item LCA take-off in carbon.ts. No DOM. */

export type StructureType = 'concrete' | 'steel' | 'timber' | 'hybrid'
export const STRUCTURE_LABEL: Record<StructureType, string> = { concrete: 'Concrete frame', steel: 'Steel frame', timber: 'Mass timber (CLT)', hybrid: 'Hybrid (concrete + timber)' }

export type MassingCarbonInput = {
  gfa: number
  structure: StructureType
  storeys: number
  energyIntensity?: number // kWh/m²/yr (regulated operational energy)
  gridFactor?: number      // kgCO2e/kWh (study-period average)
  studyPeriod?: number     // years (default 60)
}

export type CarbonElement = { key: string; label: string; intensity: number; total: number } // kgCO2e/m² GFA + kgCO2e
export type CarbonBenchmark = { name: string; target: number; meets: boolean; ratioPct: number }
export type MassingCarbon = {
  structure: StructureType
  elements: CarbonElement[]
  embodiedPerM2: number; embodiedTotal: number
  sequestration: number        // kgCO2e/m² stored in biogenic material (reported, negative)
  operationalPerM2Yr: number; operationalPerM2Life: number; operationalTotal: number
  wholeLifePerM2: number; wholeLifeTotal: number
  studyPeriod: number
  benchmarks: CarbonBenchmark[]        // whole-life vs targets
  embodiedBenchmarks: CarbonBenchmark[]
  band: string                         // LETI-style embodied band A++…E
  note: string
}

// Element base intensities (kgCO2e/m² GFA, A1–A5) for a typical mid-rise concrete scheme.
const ELEMENTS: { key: string; label: string; base: number; structural: boolean }[] = [
  { key: 'substructure', label: 'Substructure', base: 140, structural: true },
  { key: 'superstructure', label: 'Superstructure (frame + floors)', base: 320, structural: true },
  { key: 'envelope', label: 'Façade / envelope', base: 180, structural: false },
  { key: 'finishes', label: 'Internal finishes', base: 95, structural: false },
  { key: 'services', label: 'MEP / services', base: 130, structural: false },
]
const STRUCTURE_FACTOR: Record<StructureType, number> = { concrete: 1.0, steel: 0.92, timber: 0.55, hybrid: 0.78 }
const SEQUESTRATION: Record<StructureType, number> = { concrete: 0, steel: 0, timber: -110, hybrid: -45 }

const r0 = (n: number) => Math.round(n)

/** LETI-style embodied band from kgCO2e/m² (A1–A5). */
export function carbonBand(embodiedPerM2: number): string {
  const b: [number, string][] = [[100, 'A++'], [200, 'A+'], [350, 'A'], [500, 'B'], [675, 'C'], [800, 'D']]
  for (const [t, label] of b) if (embodiedPerM2 < t) return label
  return 'E'
}

/** Run the massing-level whole-life carbon assessment. */
export function massingCarbon(input: MassingCarbonInput): MassingCarbon {
  const gfa = Math.max(0, input.gfa)
  const storeys = Math.max(1, Math.round(input.storeys))
  const sf = STRUCTURE_FACTOR[input.structure]
  const tall = 1 + 0.012 * Math.max(0, storeys - 8) // taller → more frame per m²

  const elements: CarbonElement[] = ELEMENTS.map((e) => {
    let intensity = e.base
    if (e.structural) intensity *= sf
    if (e.key === 'superstructure') intensity *= tall
    return { key: e.key, label: e.label, intensity: Math.round(intensity * 10) / 10, total: r0(intensity * gfa) }
  })
  const embodiedPerM2 = Math.round(elements.reduce((s, e) => s + e.intensity, 0) * 10) / 10
  const embodiedTotal = r0(embodiedPerM2 * gfa)
  const sequestration = SEQUESTRATION[input.structure]

  const studyPeriod = input.studyPeriod ?? 60
  const energyIntensity = input.energyIntensity ?? 75
  const gridFactor = input.gridFactor ?? 0.15
  const operationalPerM2Yr = Math.round(energyIntensity * gridFactor * 100) / 100
  const operationalPerM2Life = Math.round(operationalPerM2Yr * studyPeriod * 10) / 10
  const operationalTotal = r0(operationalPerM2Life * gfa)

  const wholeLifePerM2 = Math.round((embodiedPerM2 + operationalPerM2Life) * 10) / 10
  const wholeLifeTotal = r0(embodiedTotal + operationalTotal)

  const mk = (name: string, target: number, value: number): CarbonBenchmark => ({ name, target, meets: value <= target, ratioPct: Math.round((value / target) * 100) })
  const embodiedBenchmarks = [mk('RIBA 2030 embodied', 625, embodiedPerM2), mk('LETI band A', 350, embodiedPerM2)]
  const benchmarks = [mk('RIBA 2030 whole-life', 800, wholeLifePerM2), mk('LETI 2030 whole-life', 600, wholeLifePerM2)]

  const note = `${STRUCTURE_LABEL[input.structure]}: ${embodiedPerM2} kgCO₂e/m² embodied (band ${carbonBand(embodiedPerM2)})${sequestration < 0 ? `, ${Math.abs(sequestration)} kgCO₂e/m² biogenic storage` : ''}. Whole-life ${wholeLifePerM2} kgCO₂e/m² over ${studyPeriod} years ${wholeLifePerM2 <= 800 ? 'meets' : 'exceeds'} the RIBA 2030 target — ${input.structure === 'concrete' ? 'switching to timber or hybrid would cut embodied carbon sharply' : 'a low-carbon structure already helps'}.`

  return {
    structure: input.structure, elements, embodiedPerM2, embodiedTotal, sequestration,
    operationalPerM2Yr, operationalPerM2Life, operationalTotal,
    wholeLifePerM2, wholeLifeTotal, studyPeriod, benchmarks, embodiedBenchmarks, band: carbonBand(embodiedPerM2), note,
  }
}

/** Whole-life carbon CSV. */
export function massingCarbonCsv(c: MassingCarbon): string {
  const head = 'Element,kgCO2e/m²,kgCO2e total'
  const rows = c.elements.map((e) => `${e.label},${e.intensity},${e.total}`)
  const meta = [
    '', 'Metric,Value',
    `Structure,${STRUCTURE_LABEL[c.structure]}`,
    `Embodied (A1-A5) kgCO2e/m²,${c.embodiedPerM2}`, `Embodied total,${c.embodiedTotal}`,
    `Biogenic storage kgCO2e/m²,${c.sequestration}`,
    `Operational kgCO2e/m²/yr,${c.operationalPerM2Yr}`, `Operational over ${c.studyPeriod}y kgCO2e/m²,${c.operationalPerM2Life}`,
    `Whole-life kgCO2e/m²,${c.wholeLifePerM2}`, `Whole-life total,${c.wholeLifeTotal}`,
    `Embodied band,${c.band}`,
    ...c.benchmarks.map((b) => `${b.name} (${b.target}),${b.meets ? 'meets' : 'exceeds'} (${b.ratioPct}%)`),
  ]
  return [head, ...rows, ...meta].join('\n')
}
