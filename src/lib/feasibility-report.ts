/* Feasibility report — pure, unit-tested. Bundles every engine's output for a
 * scheme into one structured Markdown document: the deliverable a developer hands
 * to an investment committee or a planning authority. Zoning compliance, massing,
 * the accommodation schedule, the development pro forma, the time-phased cashflow
 * appraisal, affordable housing & viability, the sensitivity drivers and scenario
 * cone, and the daylight/sunlight environmental summary — assembled from the
 * already-computed result objects, with optional sections omitted gracefully.
 * Only depends on the formatting helpers; no DOM. */

import { formatCurrency, formatNumber } from './format'
import type { Zoning } from './zoning'
import type { Feasibility } from './feasibility'
import type { Accommodation } from './unit-mix'
import type { Obligations } from './obligations'
import type { Appraisal } from './appraisal'
import type { Scenario } from './sensitivity'
import type { ShadowStudy } from './shadow'
import type { AmenitySunlight } from './sunlight'
import type { ContextStudy } from './context-shadow'
import type { MassingCarbon } from './massing-carbon'

export type ReportInput = {
  title?: string
  location?: { lat: number; lng: number }
  district?: string
  date?: string
  zoning: Zoning
  proposedGFA: number
  proposedStoreys: number
  feasibility: Feasibility
  accommodation: Accommodation
  obligations: Obligations
  appraisal: Appraisal
  scenarios: Scenario[]
  shadow?: ShadowStudy | null
  sunlight?: AmenitySunlight | null
  context?: ContextStudy | null
  carbon?: MassingCarbon | null
}

const n = (v: number) => formatNumber(Math.round(v))
const m = (v: number) => formatCurrency(v, { compact: true })
const pct = (v: number) => `${Math.round(v)}%`
const yn = (b: boolean) => (b ? 'Yes' : 'No')

/** Render the full feasibility report as Markdown. */
export function feasibilityReport(input: ReportInput): string {
  const { zoning: z, feasibility: f, accommodation: a, obligations: o, appraisal: ap } = input
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const L: string[] = []
  const h = (s: string) => L.push('', s, '')
  const row = (cells: (string | number)[]) => L.push(`| ${cells.join(' | ')} |`)

  L.push(`# ${input.title ?? 'Development feasibility report'}`)
  L.push('')
  L.push(`*Generated ${date}${input.district ? ` · ${input.district}` : ''}${input.location ? ` · ${input.location.lat.toFixed(4)}, ${input.location.lng.toFixed(4)}` : ''}*`)

  // executive summary
  h('## Executive summary')
  L.push(`- **Scheme:** ${n(input.proposedGFA)} m² GFA over ${input.proposedStoreys} storeys (${n(z.proposed.height)} m), footprint ${n(z.proposed.footprint)} m² on a ${n(z.siteArea)} m² site.`)
  L.push(`- **Zoning:** ${z.compliance.overall ? 'compliant' : 'non-compliant'}, using ${pct(z.utilisation)} of the allowable GFA.`)
  L.push(`- **Value:** GDV ${m(f.gdv)}; residual land value ${m(f.residualLandValue)} at a ${f.marginOnCost >= 0 ? '' : ''}target margin.`)
  L.push(`- **Return:** ${m(ap.profit)} profit over ${ap.months} months — ${ap.marginOnCost}% on cost${Number.isFinite(ap.irrAnnual) ? `, ${ap.irrAnnual}% IRR` : ''}, peak debt ${m(ap.peakFunding)}.`)
  L.push(`- **Homes:** ${n(a.totalUnits)} dwellings (${n(a.bedSpaces)} bed spaces), ${o.affordableUnits} affordable — scheme is **${o.viable ? 'viable' : 'unviable'}** against the benchmark.`)

  // zoning
  h('## 1. Zoning & compliance')
  row(['Metric', 'Value']); row(['---', '---'])
  row(['Site area', `${n(z.siteArea)} m²`])
  row(['Buildable (after setback)', `${n(z.buildableArea)} m²`])
  row(['Max GFA (FAR)', `${n(z.maxGFA)} m²`])
  row(['Height limit', `${n(z.maxHeight)} m`])
  row(['Proposed GFA / utilisation', `${n(input.proposedGFA)} m² · ${pct(z.utilisation)}`])
  row(['Coverage', `${pct(z.proposed.coverage)}`])
  row(['Compliance', z.compliance.overall ? '✅ Compliant' : '❌ Non-compliant'])
  if (!z.compliance.overall) {
    const fails = Object.entries(z.compliance).filter(([k, v]) => k !== 'overall' && !v).map(([k]) => k)
    if (fails.length) L.push('', `> Breaches: ${fails.join(', ')}.`)
  }

  // accommodation
  h('## 2. Accommodation schedule')
  row(['Type', 'Size (m²)', 'Mix', 'Units', 'Net (m²)', '$/m²', 'Revenue']); row(['---', '---', '---', '---', '---', '---', '---'])
  for (const l of a.lines) row([l.label, l.size, pct(l.share * 100), l.units, n(l.netArea), `$${n(l.pricePerM2)}`, m(l.revenue)])
  row(['**Total**', '', '', `**${n(a.totalUnits)}**`, `**${n(a.totalNet)}**`, `$${n(a.blendedPricePerM2)}`, `**${m(a.revenue)}**`])
  L.push('', `Average dwelling ${a.avgSize} m² · ${n(a.bedSpaces)} bed spaces · ${n(a.habitableRooms)} habitable rooms · ${a.densityUnitsPerHa} dwellings/ha.`)

  // feasibility
  h('## 3. Development feasibility (residual land)')
  row(['Item', 'Value']); row(['---', '---'])
  row(['GDV', m(f.gdv)])
  row(['Construction', m(f.construction)])
  row(['Professional fees', m(f.fees)])
  row(['Contingency', m(f.contingency)])
  row(['Parking', `${m(f.parking)} (${n(f.parkingBays)} bays)`])
  row(['Finance (proxy)', m(f.finance)])
  row(['**Total cost (ex land)**', `**${m(f.totalCostExLand)}**`])
  row(['**Residual land value**', `**${m(f.residualLandValue)}**`])
  row(['Margin on cost (land-free)', `${f.marginOnCost}%`])
  L.push('', `> ${f.headline}`)

  // appraisal
  h('## 4. Cashflow appraisal (DCF)')
  row(['Metric', 'Value']); row(['---', '---'])
  row(['Programme', `${ap.months} months`])
  row(['Profit', m(ap.profit)])
  row(['Margin on cost', `${ap.marginOnCost}%`])
  row(['Profit on GDV', `${ap.profitOnGdv}%`])
  row(['Project IRR', Number.isFinite(ap.irrAnnual) ? `${ap.irrAnnual}%` : 'n/a'])
  row(['NPV', m(ap.npv)])
  row(['Peak debt', `${m(ap.peakFunding)} (month ${ap.peakFundingMonth})`])
  row(['Rolled-up interest', m(ap.totalInterest)])
  row(['Break-even', ap.breakEvenMonth >= 0 ? `month ${ap.breakEvenMonth}` : '—'])
  L.push('', `> ${ap.headline}`)

  // viability
  h('## 5. Affordable housing & viability')
  row(['Item', 'Value']); row(['---', '---'])
  row(['Affordable units', `${o.affordableUnits} of ${o.affordableUnits + o.marketUnits}`])
  for (const t of o.tenureLines) row([t.label, `${t.units} units @ ${pct(t.valueFactor * 100)} of market · ${m(t.gdv)}`])
  row(['GDV forgone', m(o.gdvForgone)])
  row(['CIL', m(o.cil)]); row(['Section 106', m(o.s106)])
  row(['Residual (policy)', m(o.residualLandValue)])
  row(['Benchmark surplus', m(o.surplusVsBenchmark)])
  row(['Viable', yn(o.viable)])
  row(['Viability-led max affordable', pct(o.maxAffordablePct * 100)])
  L.push('', `> ${o.headline}`)

  // sensitivity
  if (input.scenarios.length) {
    h('## 6. Sensitivity & scenarios')
    row(['Scenario', 'Profit', 'Margin', 'IRR', 'NPV']); row(['---', '---', '---', '---', '---'])
    for (const s of input.scenarios) row([s.name, m(s.result.profit), `${s.result.margin}%`, Number.isFinite(s.result.irr) ? `${s.result.irr}%` : 'n/a', m(s.result.npv)])
  }

  // environmental
  if (input.shadow || input.sunlight || input.context || input.carbon) {
    h('## 7. Daylight, sunlight, overshadowing & carbon')
    if (input.shadow) L.push(`- **Shadow:** the mass reaches up to ${n(input.shadow.maxReach)} m and casts ~${n(input.shadow.netShadowArea)} m² of net new shadow at the worst moment.`)
    if (input.sunlight) L.push(`- **Amenity sunlight:** ${n(input.sunlight.area)} m² of open space averages ${input.sunlight.avgSunHours}h of sun, ${pct(input.sunlight.sunlitFraction2h)} meeting the ≥2h target.`)
    if (input.context) L.push(`- **Overshadowing:** worst-affected neighbour is ${input.context.worstNeighbour}; ${n(input.context.totalShadedArea)} m² of neighbour ground shaded at each worst moment.`)
    if (input.carbon) L.push(`- **Whole-life carbon:** ${input.carbon.embodiedPerM2} kgCO₂e/m² embodied (band ${input.carbon.band}), ${input.carbon.wholeLifePerM2} kgCO₂e/m² whole-life — ${input.carbon.benchmarks[0].meets ? 'within' : 'over'} the RIBA 2030 target.`)
  }

  h('---')
  L.push('*Indicative, design-stage figures from tunable assumptions — a feasibility model, not a formal appraisal or planning determination.*')
  return L.join('\n')
}
