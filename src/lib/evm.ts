/* Earned Value Management (EVM) — the canonical project-controls math, pure and
 * unit-tested. Given budget, % complete, and cost/schedule variance, it derives
 * PV/EV/AC and the standard performance indices (CPI, SPI), variances (CV, SV),
 * forecasts (EAC, ETC, VAC) and TCPI. This is the analytical core of a real
 * Cost & Schedule module — every number is computed, none decorative. */

export type EvmInput = {
  /** Budget at completion (total contract/budget value). */
  bac: number
  /** Physical % complete, 0–100. */
  progressPct: number
  /** Cost variance as a % of earned value (+ = over budget). */
  costVariancePct: number
  /** Schedule slip in days (+ = behind), against a planned duration. */
  scheduleSlipDays: number
  /** Planned total duration in days (for SPI from time slip). */
  plannedDurationDays?: number
}

export type Evm = {
  bac: number
  pv: number // planned value
  ev: number // earned value
  ac: number // actual cost
  cv: number // cost variance (EV − AC)
  sv: number // schedule variance (EV − PV)
  cpi: number // cost performance index (EV / AC)
  spi: number // schedule performance index (EV / PV)
  eac: number // estimate at completion (BAC / CPI)
  etc: number // estimate to complete (EAC − AC)
  vac: number // variance at completion (BAC − EAC)
  tcpi: number // to-complete performance index
  health: 'on-track' | 'watch' | 'at-risk'
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))
const round = (n: number) => Math.round(n)

/** Compute the full EVM set from a project's budget + progress + variances. */
export function computeEvm(input: EvmInput): Evm {
  const bac = Math.max(0, input.bac)
  const frac = clampPct(input.progressPct) / 100
  const ev = bac * frac

  // Actual cost is implied by the cost variance %: CV% = (EV − AC) / EV  ⇒
  // AC = EV * (1 − CV%/100). (Positive costVariancePct means over budget, so AC > EV.)
  // The page passes costVariancePct as "+ = over budget", so AC = EV * (1 + cv/100).
  const ac = ev * (1 + input.costVariancePct / 100)
  const cv = ev - ac

  // Planned value from schedule: if behind (+slip), PV is higher than EV (we
  // should have earned more by now). Approximate planned fraction shifted by slip.
  const planned = input.plannedDurationDays && input.plannedDurationDays > 0
    ? clampPct(((frac * input.plannedDurationDays + input.scheduleSlipDays) / input.plannedDurationDays) * 100) / 100
    : clampPct(input.progressPct + input.scheduleSlipDays / 10) / 100
  const pv = bac * planned
  const sv = ev - pv

  const cpi = ac > 0 ? ev / ac : 1
  const spi = pv > 0 ? ev / pv : 1

  const eac = cpi > 0 ? bac / cpi : bac
  const etc = Math.max(0, eac - ac)
  const vac = bac - eac
  // TCPI: cost performance needed on remaining work to hit BAC.
  const tcpi = bac - ac !== 0 ? (bac - ev) / (bac - ac) : 1

  const health: Evm['health'] =
    cpi >= 0.98 && spi >= 0.98 ? 'on-track' : cpi >= 0.9 && spi >= 0.9 ? 'watch' : 'at-risk'

  return {
    bac: round(bac),
    pv: round(pv),
    ev: round(ev),
    ac: round(ac),
    cv: round(cv),
    sv: round(sv),
    cpi: Math.round(cpi * 1000) / 1000,
    spi: Math.round(spi * 1000) / 1000,
    eac: round(eac),
    etc: round(etc),
    vac: round(vac),
    tcpi: Math.round(tcpi * 1000) / 1000,
    health,
  }
}

/** Aggregate EVM across a portfolio (sum the dollar measures, value-weight the
 *  indices) — the portfolio-level read a controls lead needs. */
export function portfolioEvm(items: EvmInput[]): Evm {
  if (!items.length) return computeEvm({ bac: 0, progressPct: 0, costVariancePct: 0, scheduleSlipDays: 0 })
  const each = items.map(computeEvm)
  const sum = (f: (e: Evm) => number) => each.reduce((s, e) => s + f(e), 0)
  const bac = sum((e) => e.bac)
  const ev = sum((e) => e.ev)
  const ac = sum((e) => e.ac)
  const pv = sum((e) => e.pv)
  const eac = sum((e) => e.eac)
  const cpi = ac > 0 ? ev / ac : 1
  const spi = pv > 0 ? ev / pv : 1
  const tcpi = bac - ac !== 0 ? (bac - ev) / (bac - ac) : 1
  return {
    bac, pv, ev, ac,
    cv: ev - ac,
    sv: ev - pv,
    cpi: Math.round(cpi * 1000) / 1000,
    spi: Math.round(spi * 1000) / 1000,
    eac,
    etc: Math.max(0, eac - ac),
    vac: bac - eac,
    tcpi: Math.round(tcpi * 1000) / 1000,
    health: cpi >= 0.98 && spi >= 0.98 ? 'on-track' : cpi >= 0.9 && spi >= 0.9 ? 'watch' : 'at-risk',
  }
}

/** A plain-language read of one project's EVM, for the insight strip. */
export function evmNarrative(name: string, e: Evm): string {
  const costWord = e.cpi >= 1 ? 'under budget' : 'over budget'
  const schedWord = e.spi >= 1 ? 'ahead of schedule' : 'behind schedule'
  const overrun = e.vac < 0 ? ` Forecast overrun of ${money(Math.abs(e.vac))} at completion.` : e.vac > 0 ? ` Forecast saving of ${money(e.vac)}.` : ''
  return `${name} is ${costWord} (CPI ${e.cpi.toFixed(2)}) and ${schedWord} (SPI ${e.spi.toFixed(2)}).${overrun} To finish on budget it must run at TCPI ${e.tcpi.toFixed(2)}.`
}

function money(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n)}`
}
export { money as formatMoney }
