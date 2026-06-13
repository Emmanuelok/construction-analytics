/* Development cashflow appraisal (DCF) — pure, unit-tested. Takes the static
 * residual pro forma and phases it over a development programme: land at close,
 * construction spend on an S-curve, professional fees front-loaded across design
 * + build, demolition / site works in pre-construction, for-sale settlements on
 * an absorption curve and investment assets realised as capital value at
 * stabilisation. A development facility funds the negative cashflow and its
 * interest rolls up monthly on the outstanding balance. Reports the monthly
 * cashflow, peak funding / debt, total rolled-up interest, profit, margin-on-
 * cost, the project NPV at a discount rate and the project IRR. Money is nominal
 * dollars, time is months. No DOM. */

export type AppraisalCosts = { construction: number; fees: number; contingency: number; parking: number; demolition: number; siteWorks: number }
export type AppraisalProgramme = { preMonths: number; constructionMonths: number; saleMonths: number }
export type AppraisalInput = {
  saleRevenue: number        // for-sale GDV — settles on an absorption curve
  investmentRevenue: number  // investment GDV — capital value realised at stabilisation
  costs: AppraisalCosts
  land: number               // land price paid at close (month 0)
  programme: AppraisalProgramme
  annualInterest: number     // development facility rate, e.g. 0.075
  discountRate: number       // annual discount rate for NPV, e.g. 0.10
}

export type CashflowRow = {
  month: number
  label: string
  land: number
  cost: number        // development cost outflow this month (ex land, ex finance)
  revenue: number     // inflow this month
  net: number         // revenue − cost − land (project / pre-finance)
  cumulative: number  // running project cashflow (pre-finance)
  interest: number    // finance interest charged this month
  funding: number     // outstanding funding incl. rolled-up interest (>0 = drawn, <0 = surplus)
}

export type Appraisal = {
  rows: CashflowRow[]
  months: number
  gdv: number
  devCostExFinance: number
  totalInterest: number
  totalCost: number       // land + dev cost + interest
  peakFunding: number     // max outstanding funding requirement (debt)
  peakFundingMonth: number
  profit: number
  marginOnCost: number    // %
  profitOnGdv: number     // %
  returnOnFunding: number // profit ÷ peak funding, %
  npv: number             // project NPV at the discount rate
  irrMonthly: number      // monthly IRR (NaN if undefined)
  irrAnnual: number       // annualised IRR, % (NaN if undefined)
  breakEvenMonth: number  // first month cumulative project cashflow ≥ 0 (−1 if never)
  headline: string
}

const r0 = (n: number) => Math.round(n)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) } // smoothstep S-curve
const linear = (x: number) => clamp01(x)

/** Distribute `total` over a window [start, start+len) using a cumulative curve. */
function spread(total: number, start: number, len: number, months: number, curve: (x: number) => number): number[] {
  const out = new Array<number>(months).fill(0)
  if (total === 0 || len <= 0) return out
  let prev = 0
  for (let i = 0; i < len; i++) {
    const c = curve((i + 1) / len)
    const w = c - prev
    prev = c
    const m = start + i
    if (m >= 0 && m < months) out[m] += total * w
  }
  return out
}

function npvAt(cf: number[], rate: number): number {
  let s = 0
  for (let i = 0; i < cf.length; i++) s += cf[i] / Math.pow(1 + rate, i)
  return s
}

/** Internal rate of return (per period) by bracketed bisection. NaN if the
 *  cashflow has no sign change or no root in a sane range. */
export function irr(cf: number[]): number {
  if (!cf.some((c) => c < 0) || !cf.some((c) => c > 0)) return NaN
  let lo = -0.9999, hi = 1
  let flo = npvAt(cf, lo), fhi = npvAt(cf, hi)
  let guard = 0
  while (flo * fhi > 0 && hi < 1e6 && guard < 80) { hi *= 2; fhi = npvAt(cf, hi); guard++ }
  if (flo * fhi > 0) return NaN
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    const fm = npvAt(cf, mid)
    if (Math.abs(fm) < 1e-6 || hi - lo < 1e-9) return mid
    if (flo * fm < 0) { hi = mid } else { lo = mid; flo = fm }
  }
  return (lo + hi) / 2
}

/** Run the time-phased development appraisal. */
export function appraise(input: AppraisalInput): Appraisal {
  const P = Math.max(0, Math.round(input.programme.preMonths))
  const C = Math.max(1, Math.round(input.programme.constructionMonths))
  const S = Math.max(0, Math.round(input.programme.saleMonths))
  const months = Math.max(1, P + C + S)
  const { construction, fees, contingency, parking, demolition, siteWorks } = input.costs

  // cost timing: build (+ contingency, parking) on an S-curve over construction;
  // fees linear across design+build; demolition / site works over pre-construction.
  const preLen = Math.max(1, P)
  const cBuild = spread(construction, P, C, months, smooth)
  const cCont = spread(contingency, P, C, months, smooth)
  const cPark = spread(parking, P, C, months, smooth)
  const cFees = spread(fees, 0, P + C, months, linear)
  const cDemo = spread(demolition, 0, preLen, months, linear)
  const cSite = spread(siteWorks, 0, preLen, months, linear)
  const costByMonth = Array.from({ length: months }, (_, i) => cBuild[i] + cCont[i] + cPark[i] + cFees[i] + cDemo[i] + cSite[i])

  // revenue timing: for-sale settlements from ~40% through construction to the
  // end on an S-curve; investment capital value realised at stabilisation (end).
  const saleStart = Math.min(months - 1, P + Math.floor(C * 0.4))
  const saleLen = Math.max(1, months - saleStart)
  const rSale = spread(input.saleRevenue, saleStart, saleLen, months, smooth)
  const revByMonth = rSale.slice()
  revByMonth[months - 1] += input.investmentRevenue

  const landByMonth = new Array<number>(months).fill(0)
  landByMonth[0] = input.land

  // monthly walk — project cashflow + a facility whose interest rolls up monthly
  const mRate = input.annualInterest / 12
  const rows: CashflowRow[] = []
  let cum = 0, funding = 0, totalInterest = 0, peakFunding = 0, peakFundingMonth = 0
  for (let i = 0; i < months; i++) {
    const cost = costByMonth[i], land = landByMonth[i], revenue = revByMonth[i]
    const net = revenue - cost - land
    cum += net
    funding += cost + land - revenue       // draw to spend, repay from revenue
    const interest = funding > 0 ? funding * mRate : 0
    funding += interest                     // roll up onto the balance
    totalInterest += interest
    if (funding > peakFunding) { peakFunding = funding; peakFundingMonth = i }
    rows.push({ month: i, label: `M${i}`, land: r0(land), cost: r0(cost), revenue: r0(revenue), net: r0(net), cumulative: r0(cum), interest: r0(interest), funding: r0(funding) })
  }

  const devCostExFinance = construction + fees + contingency + parking + demolition + siteWorks
  const gdv = input.saleRevenue + input.investmentRevenue
  const totalCost = input.land + devCostExFinance + totalInterest
  const profit = gdv - totalCost
  const marginOnCost = totalCost > 0 ? (profit / totalCost) * 100 : 0
  const profitOnGdv = gdv > 0 ? (profit / gdv) * 100 : 0
  const returnOnFunding = peakFunding > 0 ? (profit / peakFunding) * 100 : 0

  // project (pre-finance, unrounded) net cashflow → NPV / IRR / break-even
  const cf = revByMonth.map((v, i) => v - costByMonth[i] - landByMonth[i])
  const dMonthly = Math.pow(1 + input.discountRate, 1 / 12) - 1
  const npv = npvAt(cf, dMonthly)
  const irrMonthly = irr(cf)
  const irrAnnual = Number.isFinite(irrMonthly) ? (Math.pow(1 + irrMonthly, 12) - 1) * 100 : NaN
  let breakEvenMonth = -1, c = 0
  for (let i = 0; i < months; i++) { c += cf[i]; if (c >= 0) { breakEvenMonth = i; break } }

  const head = profit <= 0
    ? `Loss of ${fmtM(-profit)} over ${months} months — at this land price and a ${(input.annualInterest * 100).toFixed(1)}% facility the scheme doesn't return.`
    : `${fmtM(profit)} profit over ${months} months — ${marginOnCost.toFixed(0)}% on cost${Number.isFinite(irrAnnual) ? `, ${irrAnnual.toFixed(0)}% IRR` : ''}, peak debt ${fmtM(peakFunding)} with ${fmtM(totalInterest)} of rolled-up interest.`

  return {
    rows, months, gdv: r0(gdv), devCostExFinance: r0(devCostExFinance), totalInterest: r0(totalInterest), totalCost: r0(totalCost),
    peakFunding: r0(peakFunding), peakFundingMonth,
    profit: r0(profit), marginOnCost: Math.round(marginOnCost * 10) / 10, profitOnGdv: Math.round(profitOnGdv * 10) / 10,
    returnOnFunding: Math.round(returnOnFunding * 10) / 10,
    npv: r0(npv), irrMonthly, irrAnnual: Number.isFinite(irrAnnual) ? Math.round(irrAnnual * 10) / 10 : NaN,
    breakEvenMonth, headline: head,
  }
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}b`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}m`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}k`
  return `$${r0(n)}`
}

/** Aggregate the monthly rows into quarters for a compact display table. */
export function quarterly(a: Appraisal): { label: string; cost: number; revenue: number; net: number; cumulative: number; interest: number; funding: number }[] {
  const out: { label: string; cost: number; revenue: number; net: number; cumulative: number; interest: number; funding: number }[] = []
  for (let q = 0; q * 3 < a.rows.length; q++) {
    const slice = a.rows.slice(q * 3, q * 3 + 3)
    const last = slice[slice.length - 1]
    out.push({
      label: `Q${q + 1}`,
      cost: slice.reduce((s, r) => s + r.cost + r.land, 0),
      revenue: slice.reduce((s, r) => s + r.revenue, 0),
      net: slice.reduce((s, r) => s + r.net, 0),
      interest: slice.reduce((s, r) => s + r.interest, 0),
      cumulative: last.cumulative,
      funding: last.funding,
    })
  }
  return out
}

/** Appraisal CSV — month-by-month cashflow + a summary block. */
export function appraisalCsv(a: Appraisal): string {
  const head = 'Month,Land,Cost,Revenue,Net,Cumulative,Interest,Funding (debt)'
  const rows = a.rows.map((r) => [r.month, r.land, r.cost, r.revenue, r.net, r.cumulative, r.interest, r.funding].join(','))
  const sum = [
    '', 'Summary,Value',
    `GDV,${a.gdv}`, `Dev cost (ex finance),${a.devCostExFinance}`, `Rolled-up interest,${a.totalInterest}`, `Total cost (incl land+finance),${a.totalCost}`,
    `Profit,${a.profit}`, `Margin on cost,${a.marginOnCost}%`, `Profit on GDV,${a.profitOnGdv}%`,
    `Peak debt,${a.peakFunding}`, `Return on peak funding,${a.returnOnFunding}%`,
    `NPV,${a.npv}`, `IRR (annual),${Number.isFinite(a.irrAnnual) ? a.irrAnnual + '%' : 'n/a'}`,
    `Break-even month,${a.breakEvenMonth}`, `Development period (months),${a.months}`,
  ]
  return [head, ...rows, ...sum].join('\n')
}
