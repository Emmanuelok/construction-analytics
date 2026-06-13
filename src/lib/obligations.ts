/* Affordable housing & planning obligations / viability — pure, unit-tested. The
 * policy layer real feasibility turns on: a share of the homes must be affordable
 * (sold/let below market by tenure), and the scheme carries planning obligations
 * — a community infrastructure levy (per m²) and Section 106 contributions (per
 * unit / lump). Both shrink the residual land value. This engine applies the
 * policy, re-strikes the residual, and tests it against a benchmark land value
 * (existing use + premium): if the policy-compliant scheme falls short, it solves
 * the viability-led affordable percentage the site can actually support. Mirrors
 * the residual identity used in feasibility.ts. No DOM. */

export type AffordableTenure = 'socialRent' | 'affordableRent' | 'sharedOwnership'
export const AFFORDABLE_TENURES: AffordableTenure[] = ['socialRent', 'affordableRent', 'sharedOwnership']
export const TENURE_LABEL: Record<AffordableTenure, string> = { socialRent: 'Social rent', affordableRent: 'Affordable rent', sharedOwnership: 'Shared ownership' }

/** Default value of each affordable tenure as a fraction of market value. */
export const DEFAULT_VALUE_FACTOR: Record<AffordableTenure, number> = { socialRent: 0.35, affordableRent: 0.5, sharedOwnership: 0.65 }

export type ObligationsInput = {
  marketGdv: number           // total scheme GDV at 100% market
  residentialGdv: number      // residential-only GDV (affordable applies here)
  totalUnits: number          // residential dwellings
  gfa: number                 // total GFA (for CIL)
  affordablePct: number       // 0..1 share of dwellings that are affordable
  tenureSplit?: Partial<Record<AffordableTenure, number>>      // shares within affordable
  valueFactor?: Partial<Record<AffordableTenure, number>>      // value vs market
  cilPerM2?: number           // community infrastructure levy, $/m²
  s106PerUnit?: number        // Section 106 contributions, $/unit
  s106Lump?: number           // lump-sum contributions, $
  totalCostExLand: number     // development cost ex land (from feasibility)
  benchmarkLandValue: number  // existing use value + premium — the land value test
  targetMarginPct?: number    // profit-on-cost the residual solves for
}

export type TenureLine = { tenure: AffordableTenure; label: string; units: number; valueFactor: number; gdv: number }
export type Obligations = {
  affordableUnits: number; marketUnits: number
  tenureLines: TenureLine[]
  marketResiGdv: number; affordableGdv: number; gdvForgone: number
  cil: number; s106: number; obligationsTotal: number
  policyGdv: number           // scheme GDV with affordable discount applied
  residualLandValue: number   // after affordable + obligations
  surplusVsBenchmark: number  // residual − benchmark (≥0 = viable)
  viable: boolean
  maxAffordablePct: number    // affordable % that just meets the benchmark
  headline: string
}

const r0 = (n: number) => Math.round(n)
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Residual land value for a given affordable % (everything else fixed). */
function residualAt(input: ObligationsInput, affordablePct: number): { residual: number; policyGdv: number; affordableGdv: number; marketResiGdv: number; affordableUnits: number; tenureLines: TenureLine[]; cil: number; s106: number } {
  const margin = (input.targetMarginPct ?? 18) / 100
  const split = { ...{ socialRent: 0.3, affordableRent: 0.3, sharedOwnership: 0.4 }, ...(input.tenureSplit ?? {}) }
  const vf = { ...DEFAULT_VALUE_FACTOR, ...(input.valueFactor ?? {}) }
  const totalUnits = Math.max(0, input.totalUnits)
  const avgMarketValue = totalUnits > 0 ? input.residentialGdv / totalUnits : 0
  const affordableUnits = Math.round(totalUnits * clamp01(affordablePct))
  const marketUnits = totalUnits - affordableUnits
  const splitSum = AFFORDABLE_TENURES.reduce((s, t) => s + Math.max(0, split[t] ?? 0), 0) || 1

  let assigned = 0
  const tenureLines: TenureLine[] = AFFORDABLE_TENURES.map((t, i) => {
    const share = Math.max(0, split[t] ?? 0) / splitSum
    const units = i === AFFORDABLE_TENURES.length - 1 ? affordableUnits - assigned : Math.round(affordableUnits * share)
    assigned += units
    const gdv = units * avgMarketValue * vf[t]
    return { tenure: t, label: TENURE_LABEL[t], units, valueFactor: vf[t], gdv }
  })
  const affordableGdv = tenureLines.reduce((s, l) => s + l.gdv, 0)
  const marketResiGdv = marketUnits * avgMarketValue
  const nonResiGdv = input.marketGdv - input.residentialGdv
  const policyGdv = nonResiGdv + marketResiGdv + affordableGdv

  const cil = Math.max(0, input.gfa) * Math.max(0, input.cilPerM2 ?? 0)
  const s106 = totalUnits * Math.max(0, input.s106PerUnit ?? 0) + Math.max(0, input.s106Lump ?? 0)
  const cost = input.totalCostExLand + cil + s106
  const residual = Math.max(0, (policyGdv - cost * (1 + margin)) / (1 + margin))
  return { residual, policyGdv, affordableGdv, marketResiGdv, affordableUnits, tenureLines, cil, s106 }
}

/** Apply the affordable policy + obligations and test viability. */
export function obligations(input: ObligationsInput): Obligations {
  const pct = clamp01(input.affordablePct)
  const a = residualAt(input, pct)
  const allMarket = residualAt(input, 0)
  const gdvForgone = allMarket.policyGdv - a.policyGdv
  const surplus = a.residual - input.benchmarkLandValue
  const viable = surplus >= 0

  // viability-led: the largest affordable % whose residual still clears the
  // benchmark (residual decreases monotonically with the affordable share).
  let maxPct = 0
  for (let p = 0; p <= 1.0001; p += 0.01) {
    if (residualAt(input, p).residual >= input.benchmarkLandValue) maxPct = p; else break
  }
  maxPct = Math.round(maxPct * 100) / 100

  const head = viable
    ? `Viable at ${Math.round(pct * 100)}% affordable — residual ${fmtM(a.residual)} clears the ${fmtM(input.benchmarkLandValue)} benchmark by ${fmtM(surplus)}. The site could support up to ${Math.round(maxPct * 100)}% affordable.`
    : `Unviable at ${Math.round(pct * 100)}% affordable — residual ${fmtM(a.residual)} is ${fmtM(-surplus)} below the ${fmtM(input.benchmarkLandValue)} benchmark. Viability-led maximum is ~${Math.round(maxPct * 100)}% affordable.`

  return {
    affordableUnits: a.affordableUnits, marketUnits: input.totalUnits - a.affordableUnits,
    tenureLines: a.tenureLines.map((l) => ({ ...l, gdv: r0(l.gdv) })),
    marketResiGdv: r0(a.marketResiGdv), affordableGdv: r0(a.affordableGdv), gdvForgone: r0(gdvForgone),
    cil: r0(a.cil), s106: r0(a.s106), obligationsTotal: r0(a.cil + a.s106),
    policyGdv: r0(a.policyGdv), residualLandValue: r0(a.residual), surplusVsBenchmark: r0(surplus), viable,
    maxAffordablePct: maxPct, headline: head,
  }
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}b`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}m`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}k`
  return `$${r0(n)}`
}

/** Planning obligations & viability CSV. */
export function obligationsCsv(o: Obligations): string {
  const head = 'Affordable tenure,Units,Value factor,GDV'
  const rows = o.tenureLines.map((l) => `${l.label},${l.units},${Math.round(l.valueFactor * 100)}%,${l.gdv}`)
  const meta = [
    '', 'Item,Value',
    `Affordable units,${o.affordableUnits}`, `Market units,${o.marketUnits}`,
    `Affordable GDV,${o.affordableGdv}`, `GDV forgone vs all-market,${o.gdvForgone}`,
    `CIL,${o.cil}`, `Section 106,${o.s106}`, `Obligations total,${o.obligationsTotal}`,
    `Policy GDV,${o.policyGdv}`, `Residual land value,${o.residualLandValue}`,
    `Benchmark land value surplus,${o.surplusVsBenchmark}`, `Viable,${o.viable ? 'yes' : 'no'}`,
    `Viability-led max affordable,${Math.round(o.maxAffordablePct * 100)}%`,
  ]
  return [head, ...rows, ...meta].join('\n')
}
