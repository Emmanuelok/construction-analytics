/* Sensitivity & scenario analysis — pure, unit-tested. The risk lens on the
 * feasibility + cashflow appraisal: it re-runs the whole pipeline (programme →
 * residual pro forma → time-phased DCF) under shifted assumptions and reports
 * how the return moves. Three views:
 *  · evaluate() — run the pipeline once under a set of multipliers, returning the
 *    headline metrics (GDV, cost, profit, margin, IRR, NPV, residual land, peak debt);
 *  · tornado() — swing each driver ±x% on its own and rank by impact on a metric;
 *  · dataTable() — a two-way grid (e.g. sale price × build cost) of a metric;
 *  · scenarios() — combined downside / base / upside cases.
 * Land can be held at a fixed price (so revenue/cost swings hit profit) or struck
 * at the residual (so they flow to land value). No DOM. */

import { feasibility, DEFAULT_RATES, type ProgrammeMix, type Use, type UseRates } from './feasibility'
import { appraise, type AppraisalProgramme } from './appraisal'

export type ScenarioBase = {
  gfa: number
  mix: ProgrammeMix
  siteArea: number
  buildableArea: number
  investmentYield: number   // cap rate, e.g. 0.06
  targetMarginPct: number   // for the residual land value
  programme: AppraisalProgramme
  annualInterest: number    // facility rate, e.g. 0.075
  discountRate: number      // e.g. 0.10
  landMode: 'residual' | 'fixed'
  land?: number             // used when landMode = 'fixed'
}

/** Multiplicative adjustments to the drivers (1 = base / unchanged). */
export type Adjust = {
  salePriceMult?: number  // × sale price $/m²
  rentMult?: number       // × rent $/m²
  buildCostMult?: number  // × construction $/m²
  yieldMult?: number      // × investment yield (cap rate)
  interestMult?: number   // × facility interest rate
  gfaMult?: number        // × GFA
}

export type ScenarioResult = {
  gdv: number; totalCost: number; profit: number; margin: number
  irr: number; npv: number; rlv: number; peakDebt: number; land: number
}

export type Metric = 'profit' | 'margin' | 'irr' | 'npv' | 'rlv' | 'peakDebt'
export const METRIC_LABEL: Record<Metric, string> = {
  profit: 'Profit', margin: 'Margin on cost', irr: 'IRR', npv: 'NPV', rlv: 'Residual land', peakDebt: 'Peak debt',
}
const pick = (r: ScenarioResult, m: Metric): number => r[m]

/** Run the full pipeline once under a set of driver adjustments. */
export function evaluate(base: ScenarioBase, adj: Adjust = {}): ScenarioResult {
  const m = { salePriceMult: 1, rentMult: 1, buildCostMult: 1, yieldMult: 1, interestMult: 1, gfaMult: 1, ...adj }
  const rates: Partial<Record<Use, Partial<UseRates>>> = {}
  ;(Object.keys(DEFAULT_RATES) as Use[]).forEach((u) => {
    rates[u] = { salePrice: DEFAULT_RATES[u].salePrice * m.salePriceMult, rent: DEFAULT_RATES[u].rent * m.rentMult, buildCost: DEFAULT_RATES[u].buildCost * m.buildCostMult }
  })
  const gfa = base.gfa * m.gfaMult
  const yield_ = base.investmentYield * m.yieldMult
  const feas = feasibility({ gfa, mix: base.mix, siteArea: base.siteArea, buildableArea: base.buildableArea, investmentYield: yield_, targetMarginPct: base.targetMarginPct, rates })
  const land = base.landMode === 'fixed' ? (base.land ?? feas.residualLandValue) : feas.residualLandValue
  const saleRevenue = feas.lines.filter((l) => l.tenure === 'sale').reduce((s, l) => s + l.revenue, 0)
  const investmentRevenue = feas.lines.filter((l) => l.tenure === 'investment').reduce((s, l) => s + l.revenue, 0)
  const appr = appraise({
    saleRevenue, investmentRevenue,
    costs: { construction: feas.construction, fees: feas.fees, contingency: feas.contingency, parking: feas.parking, demolition: feas.demolition, siteWorks: feas.siteWorks },
    land, programme: base.programme, annualInterest: base.annualInterest * m.interestMult, discountRate: base.discountRate,
  })
  return { gdv: appr.gdv, totalCost: appr.totalCost, profit: appr.profit, margin: appr.marginOnCost, irr: appr.irrAnnual, npv: appr.npv, rlv: feas.residualLandValue, peakDebt: appr.peakFunding, land }
}

export type Factor = { key: string; label: string; field: keyof Adjust }
export const FACTORS: Factor[] = [
  { key: 'sale', label: 'Sale price', field: 'salePriceMult' },
  { key: 'rent', label: 'Rent', field: 'rentMult' },
  { key: 'build', label: 'Build cost', field: 'buildCostMult' },
  { key: 'yield', label: 'Cap rate (yield)', field: 'yieldMult' },
  { key: 'interest', label: 'Interest rate', field: 'interestMult' },
  { key: 'gfa', label: 'GFA', field: 'gfaMult' },
]

export type TornadoBar = { key: string; label: string; low: number; high: number; base: number; impact: number }

/** Swing each driver ±`swing` on its own; rank by absolute impact on `metric`. */
export function tornado(base: ScenarioBase, metric: Metric = 'profit', swing = 0.1): TornadoBar[] {
  const b = pick(evaluate(base), metric)
  const bars = FACTORS.map((f) => {
    const low = pick(evaluate(base, { [f.field]: 1 - swing } as Adjust), metric)
    const high = pick(evaluate(base, { [f.field]: 1 + swing } as Adjust), metric)
    const impact = Number.isFinite(high) && Number.isFinite(low) ? Math.abs(high - low) : 0
    return { key: f.key, label: f.label, low, high, base: b, impact }
  })
  return bars.sort((a, c) => c.impact - a.impact)
}

export type DataTable = { metric: Metric; xField: keyof Adjust; yField: keyof Adjust; xVals: number[]; yVals: number[]; cells: number[][]; baseX: number; baseY: number }

/** Two-way grid: a metric across two drivers (rows = y, cols = x). */
export function dataTable(base: ScenarioBase, xField: keyof Adjust, xVals: number[], yField: keyof Adjust, yVals: number[], metric: Metric = 'profit'): DataTable {
  const cells = yVals.map((yv) => xVals.map((xv) => pick(evaluate(base, { [xField]: xv, [yField]: yv } as Adjust), metric)))
  return { metric, xField, yField, xVals, yVals, cells, baseX: 1, baseY: 1 }
}

export type Scenario = { name: 'Downside' | 'Base' | 'Upside'; result: ScenarioResult }

/** Combined downside / base / upside: revenue, cost, finance and yield all move
 *  the same direction-of-pain together. */
export function scenarios(base: ScenarioBase, swing = 0.1): Scenario[] {
  return [
    { name: 'Downside', result: evaluate(base, { salePriceMult: 1 - swing, rentMult: 1 - swing, buildCostMult: 1 + swing, interestMult: 1 + swing, yieldMult: 1 + swing }) },
    { name: 'Base', result: evaluate(base) },
    { name: 'Upside', result: evaluate(base, { salePriceMult: 1 + swing, rentMult: 1 + swing, buildCostMult: 1 - swing, interestMult: 1 - swing, yieldMult: 1 - swing }) },
  ]
}

/** Sensitivity CSV — the tornado plus the scenario cases. */
export function sensitivityCsv(base: ScenarioBase, metric: Metric = 'profit', swing = 0.1): string {
  const t = tornado(base, metric, swing)
  const head = `Driver,Low (−${Math.round(swing * 100)}%),Base,High (+${Math.round(swing * 100)}%),Impact`
  const rows = t.map((b) => `${b.label},${Math.round(b.low)},${Math.round(b.base)},${Math.round(b.high)},${Math.round(b.impact)}`)
  const sc = scenarios(base, swing)
  const scHead = ['', 'Scenario,GDV,Total cost,Profit,Margin %,IRR %,Residual land,Peak debt']
  const scRows = sc.map((s) => `${s.name},${s.result.gdv},${s.result.totalCost},${s.result.profit},${s.result.margin},${Number.isFinite(s.result.irr) ? s.result.irr : 'n/a'},${s.result.rlv},${s.result.peakDebt}`)
  return [`Sensitivity of ${METRIC_LABEL[metric]} (±${Math.round(swing * 100)}%)`, head, ...rows, ...scHead, ...scRows].join('\n')
}
