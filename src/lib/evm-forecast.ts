/* Time-phased Earned Value forecast — pure, unit-tested. Takes the cost-loaded
 * baseline (cumulative planned value per period, the S-curve) plus a data date,
 * physical % complete and actual cost to date, and computes the earned-value
 * position — PV / EV / AC, cost & schedule variances, CPI & SPI — then forecasts
 * the outturn: estimate at completion (EAC), to-complete (ETC), variance at
 * completion (VAC), the to-complete performance index (TCPI) and the forecast
 * finish (planned duration ÷ SPI). Emits the PV / EV / AC / forecast curves for the
 * classic three-line EVM chart. Complements the portfolio snapshot in evm.ts. No DOM. */

export type EvmForecastInput = {
  pv: number[]            // cumulative planned value per period (last = BAC)
  dataDatePeriod: number  // current period index (0-based, inclusive)
  percentComplete: number // physical progress 0..1
  actualCost: number      // AC to date
  periodLabels?: string[]
}

export type EvmSeriesPoint = { label: string; pv: number; ev: number | null; ac: number | null; forecast: number | null }
export type EvmForecast = {
  bac: number; pv: number; ev: number; ac: number
  cv: number; sv: number; cpi: number; spi: number
  eac: number; etc: number; vac: number; tcpi: number
  forecastPeriods: number   // periods to complete at the current SPI
  totalPeriods: number
  series: EvmSeriesPoint[]
  health: 'on-track' | 'watch' | 'at-risk'
  headline: string
}

const r0 = (n: number) => Math.round(n)
const r2 = (n: number) => Math.round(n * 100) / 100

const fmtM = (n: number): string => {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}b`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}m`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}k`
  return `$${r0(n)}`
}

/** Compute the time-phased earned-value forecast. */
export function evmForecast(input: EvmForecastInput): EvmForecast {
  const pv = input.pv.length ? input.pv : [0]
  const totalPeriods = pv.length
  const bac = pv[pv.length - 1] || 0
  const dd = Math.max(0, Math.min(totalPeriods - 1, Math.round(input.dataDatePeriod)))
  const pct = Math.max(0, Math.min(1, input.percentComplete))

  const pvNow = pv[dd]
  const ev = pct * bac
  const ac = Math.max(0, input.actualCost)
  const cv = ev - ac
  const sv = ev - pvNow
  const cpi = ac > 0 ? ev / ac : 1
  const spi = pvNow > 0 ? ev / pvNow : 1

  const eac = cpi > 0 ? bac / cpi : bac          // EAC = BAC / CPI (cost performance continues)
  const etc = Math.max(0, eac - ac)
  const vac = bac - eac
  const tcpi = bac - ac !== 0 ? (bac - ev) / (bac - ac) : 1
  const forecastPeriods = spi > 0 ? Math.round((totalPeriods / spi) * 10) / 10 : totalPeriods

  // curves: PV full baseline; EV/AC ramped to the data date following the planned
  // shape; forecast from the data date projecting to EAC along the remaining shape.
  const labels = input.periodLabels ?? pv.map((_, i) => `M${i + 1}`)
  const series: EvmSeriesPoint[] = pv.map((p, i) => {
    const shapeToDD = pvNow > 0 ? p / pvNow : 0
    const evi = i <= dd ? r0(ev * shapeToDD) : null
    const aci = i <= dd ? r0(ac * shapeToDD) : null
    let forecast: number | null = null
    if (i >= dd) {
      const rem = bac - pvNow
      const shapeRem = rem > 0 ? (p - pvNow) / rem : 1
      forecast = r0(ac + (eac - ac) * Math.max(0, Math.min(1, shapeRem)))
    }
    return { label: labels[i] ?? `M${i + 1}`, pv: r0(p), ev: evi, ac: aci, forecast }
  })

  const health: EvmForecast['health'] = cpi >= 0.97 && spi >= 0.97 ? 'on-track' : cpi >= 0.9 && spi >= 0.9 ? 'watch' : 'at-risk'
  const headline = `At the data date, ${Math.round(pct * 100)}% complete: CPI ${r2(cpi)} / SPI ${r2(spi)}. ` +
    (vac < 0 ? `Forecast ${fmtM(eac)} at completion — a ${fmtM(-vac)} overrun` : `Forecast ${fmtM(eac)} — a ${fmtM(vac)} saving`) +
    `${spi < 0.999 ? `, finishing ~${Math.round((forecastPeriods - totalPeriods))} period(s) late` : spi > 1.001 ? ', ahead of programme' : ', on programme'}.`

  return {
    bac: r0(bac), pv: r0(pvNow), ev: r0(ev), ac: r0(ac),
    cv: r0(cv), sv: r0(sv), cpi: r2(cpi), spi: r2(spi),
    eac: r0(eac), etc: r0(etc), vac: r0(vac), tcpi: r2(tcpi),
    forecastPeriods, totalPeriods, series, health, headline,
  }
}

/** EVM forecast CSV. */
export function evmForecastCsv(f: EvmForecast): string {
  const head = 'Period,PV,EV,AC,Forecast'
  const rows = f.series.map((s) => `${s.label},${s.pv},${s.ev ?? ''},${s.ac ?? ''},${s.forecast ?? ''}`)
  const meta = [
    '', 'Metric,Value',
    `BAC,${f.bac}`, `PV (to date),${f.pv}`, `EV (to date),${f.ev}`, `AC (to date),${f.ac}`,
    `Cost variance,${f.cv}`, `Schedule variance,${f.sv}`, `CPI,${f.cpi}`, `SPI,${f.spi}`,
    `EAC,${f.eac}`, `ETC,${f.etc}`, `VAC,${f.vac}`, `TCPI,${f.tcpi}`, `Forecast periods,${f.forecastPeriods}`, `Health,${f.health}`,
  ]
  return [head, ...rows, ...meta].join('\n')
}
