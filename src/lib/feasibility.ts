/* Development feasibility / residual-land pro forma — pure, unit-tested. Turns a
 * proposed GFA + programme mix into the numbers a developer underwrites a site on:
 *  · programme — split GFA by use, apply an efficiency to get net saleable/lettable
 *    area and a unit count per use;
 *  · revenue (GDV) — sale price $/m² for sale uses, capitalised rent (rent ÷ yield)
 *    for investment uses;
 *  · cost — construction $/m² by use × GFA, demolition + site works, professional
 *    fees and contingency as % of build, finance, and parking;
 *  · returns — profit, profit-on-cost margin, profit-on-GDV, yield-on-cost, and the
 *    residual land value (what you can pay for the site to hit a target margin), per
 *    m² of site and per buildable area.
 *  · parking — required bays from the programme × ratios, with a build cost.
 * Indicative design-stage rates, fully tunable — a feasibility model, not an
 * appraisal. No DOM. */

export type Use = 'residential' | 'office' | 'retail'
export type ProgrammeMix = { residential: number; office: number; retail: number }

export type UseRates = {
  efficiency: number // net ÷ gross
  unitSize: number // m² net per unit (resi) / per tenancy
  buildCost: number // $/m² GFA
  salePrice: number // $/m² net (for-sale uses)
  rent: number // $/m²/yr net (for investment uses)
  tenure: 'sale' | 'investment'
}

export const DEFAULT_RATES: Record<Use, UseRates> = {
  residential: { efficiency: 0.82, unitSize: 85, buildCost: 2200, salePrice: 6500, rent: 320, tenure: 'sale' },
  office: { efficiency: 0.85, unitSize: 1200, buildCost: 2400, salePrice: 0, rent: 420, tenure: 'investment' },
  retail: { efficiency: 0.9, unitSize: 250, buildCost: 1900, salePrice: 0, rent: 650, tenure: 'investment' },
}

export type FeasibilityInput = {
  gfa: number
  mix: ProgrammeMix
  siteArea: number
  buildableArea?: number
  rates?: Partial<Record<Use, Partial<UseRates>>>
  investmentYield?: number // cap rate for investment uses (e.g. 0.06)
  parkingRatios?: Partial<Record<Use, number>> // bays per unit (resi) / per 100 m² (office/retail)
  parkingCost?: number // $/bay
  demolition?: number // $ lump
  siteWorks?: number // $ lump
  professionalFeesPct?: number // % of construction
  contingencyPct?: number // % of construction
  financePct?: number // % of (construction + fees) — proxy for interest over the build
  targetMarginPct?: number // profit-on-cost the residual land value solves for
}

export type UseLine = {
  use: Use; share: number; gfa: number; net: number; units: number
  buildCost: number; revenue: number; tenure: 'sale' | 'investment'
}
export type Feasibility = {
  lines: UseLine[]
  netArea: number; units: number
  gdv: number // gross development value (revenue)
  construction: number; fees: number; contingency: number; parking: number; demolition: number; siteWorks: number; finance: number
  totalCostExLand: number
  parkingBays: number
  residualLandValue: number // affordable land at the target margin
  landPerSiteM2: number; landPerBuildableM2: number
  profitAtZeroLand: number // GDV − costs (no land) = max land + profit pool
  marginOnCost: number // % at zero land (i.e. if land were free)
  yieldOnCost: number // NOI ÷ total cost (investment portion), %
  noi: number // annual net operating income from investment uses
  perM2: { gdv: number; cost: number } // per m² GFA
  headline: string
}

const r0 = (n: number) => Math.round(n)
const uses: Use[] = ['residential', 'office', 'retail']

/** Run the feasibility pro forma. */
export function feasibility(input: FeasibilityInput): Feasibility {
  const gfa = Math.max(0, input.gfa)
  const sumMix = uses.reduce((s, u) => s + Math.max(0, input.mix[u] ?? 0), 0) || 1
  const yield_ = input.investmentYield ?? 0.06
  const ratesFor = (u: Use): UseRates => ({ ...DEFAULT_RATES[u], ...(input.rates?.[u] ?? {}) })
  const pr = { residential: input.parkingRatios?.residential ?? 0.7, office: input.parkingRatios?.office ?? 1.2, retail: input.parkingRatios?.retail ?? 2.5 }
  const parkingCost = input.parkingCost ?? 35000

  let netArea = 0, units = 0, gdv = 0, construction = 0, noi = 0, bays = 0
  const lines: UseLine[] = uses.map((u) => {
    const share = (Math.max(0, input.mix[u] ?? 0)) / sumMix
    const g = gfa * share
    const rt = ratesFor(u)
    const net = g * rt.efficiency
    const unitCount = rt.unitSize > 0 ? Math.round(net / rt.unitSize) : 0
    const build = g * rt.buildCost
    const revenue = rt.tenure === 'sale' ? net * rt.salePrice : (rt.rent * net) / yield_
    if (rt.tenure === 'investment') noi += rt.rent * net
    // parking: resi by unit, commercial per 100 m² net
    bays += u === 'residential' ? unitCount * pr.residential : (net / 100) * pr[u]
    netArea += net; units += unitCount; gdv += revenue; construction += build
    return { use: u, share, gfa: r0(g), net: r0(net), units: unitCount, buildCost: r0(build), revenue: r0(revenue), tenure: rt.tenure }
  })

  bays = Math.round(bays)
  const parking = bays * parkingCost
  const feesPct = input.professionalFeesPct ?? 12
  const contPct = input.contingencyPct ?? 8
  const finPct = input.financePct ?? 6
  const fees = (construction * feesPct) / 100
  const contingency = (construction * contPct) / 100
  const demolition = input.demolition ?? 0
  const siteWorks = input.siteWorks ?? 0
  const finance = ((construction + fees + parking) * finPct) / 100
  const totalCostExLand = construction + fees + contingency + parking + demolition + siteWorks + finance

  const profitAtZeroLand = gdv - totalCostExLand
  const targetMargin = (input.targetMarginPct ?? 18) / 100
  // residual land value: land + (margin on (cost incl. land))… solve so profit = margin × (cost+land)
  // profit = GDV − cost − land; require profit ≥ margin × (cost + land)
  // GDV − cost − land = margin·(cost + land)  →  land = (GDV − cost·(1+margin)) / (1+margin)
  const residualLandValue = Math.max(0, (gdv - totalCostExLand * (1 + targetMargin)) / (1 + targetMargin))
  const marginOnCost = totalCostExLand > 0 ? (profitAtZeroLand / totalCostExLand) * 100 : 0
  const yieldOnCost = totalCostExLand > 0 ? (noi / totalCostExLand) * 100 : 0

  const head = profitAtZeroLand <= 0
    ? `Underwater before land — costs (${fmtM(totalCostExLand)}) exceed value (${fmtM(gdv)}). The scheme doesn't stack up.`
    : `Supports up to ${fmtM(residualLandValue)} of land at a ${Math.round((input.targetMarginPct ?? 18))}% margin (GDV ${fmtM(gdv)}, cost ${fmtM(totalCostExLand)}); margin-on-cost is ${Math.round(marginOnCost)}% if land were free.`

  return {
    lines, netArea: r0(netArea), units, gdv: r0(gdv),
    construction: r0(construction), fees: r0(fees), contingency: r0(contingency), parking: r0(parking), demolition: r0(demolition), siteWorks: r0(siteWorks), finance: r0(finance),
    totalCostExLand: r0(totalCostExLand), parkingBays: bays,
    residualLandValue: r0(residualLandValue),
    landPerSiteM2: input.siteArea > 0 ? r0(residualLandValue / input.siteArea) : 0,
    landPerBuildableM2: input.buildableArea && input.buildableArea > 0 ? r0(residualLandValue / input.buildableArea) : 0,
    profitAtZeroLand: r0(profitAtZeroLand), marginOnCost: Math.round(marginOnCost * 10) / 10,
    yieldOnCost: Math.round(yieldOnCost * 100) / 100, noi: r0(noi),
    perM2: { gdv: gfa > 0 ? r0(gdv / gfa) : 0, cost: gfa > 0 ? r0(totalCostExLand / gfa) : 0 },
    headline: head,
  }
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}b`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}m`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}k`
  return `$${r0(n)}`
}

/** Cost + revenue waterfall rows (for a chart/table). */
export function feasibilityWaterfall(f: Feasibility): { label: string; value: number; kind: 'cost' | 'value' | 'result' }[] {
  return [
    { label: 'Construction', value: f.construction, kind: 'cost' },
    { label: 'Prof. fees', value: f.fees, kind: 'cost' },
    { label: 'Contingency', value: f.contingency, kind: 'cost' },
    { label: 'Parking', value: f.parking, kind: 'cost' },
    { label: 'Finance', value: f.finance, kind: 'cost' },
    ...(f.demolition ? [{ label: 'Demolition', value: f.demolition, kind: 'cost' as const }] : []),
    ...(f.siteWorks ? [{ label: 'Site works', value: f.siteWorks, kind: 'cost' as const }] : []),
    { label: 'Residual land', value: f.residualLandValue, kind: 'cost' },
    { label: 'GDV', value: f.gdv, kind: 'value' },
  ]
}

/** Feasibility CSV — programme, cost stack and returns. */
export function feasibilityCsv(f: Feasibility): string {
  const prog = ['Use,Share,GFA (m²),Net (m²),Units,Build cost ($),Revenue ($)', ...f.lines.map((l) => `${l.use},${Math.round(l.share * 100)}%,${l.gfa},${l.net},${l.units},${l.buildCost},${l.revenue}`)]
  const cost = ['', 'Cost item,$', `Construction,${f.construction}`, `Professional fees,${f.fees}`, `Contingency,${f.contingency}`, `Parking (${f.parkingBays} bays),${f.parking}`, `Demolition,${f.demolition}`, `Site works,${f.siteWorks}`, `Finance,${f.finance}`, `Total (ex land),${f.totalCostExLand}`]
  const ret = ['', 'Return,Value', `GDV,${f.gdv}`, `Residual land value,${f.residualLandValue}`, `Land $/site m²,${f.landPerSiteM2}`, `Margin on cost (land-free),${f.marginOnCost}%`, `Yield on cost,${f.yieldOnCost}%`, `NOI (investment),${f.noi}`]
  return [...prog, ...cost, ...ret].join('\n')
}
