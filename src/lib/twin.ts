/* Digital-twin asset analytics — pure, unit-tested. From live sensor readings
 * against setpoints, runtime against service intervals, and business
 * criticality, it derives the numbers an operations team runs on: a deviation
 * alarm, an asset-health index, remaining service life and a predictive-
 * maintenance priority. Plus a comfort check for zone telemetry. The analytical
 * core of an operable Digital Twin — every value is computed from the inputs. */

export type AssetInput = {
  id: string
  name: string
  type: string
  location: string
  unit: string // sensor unit (mm/s, °C, …)
  reading: number // current sensor reading
  setpoint: number // nominal / target value
  tolerance: number // allowed deviation band (± unit)
  runtimeHours: number // hours since last service
  serviceInterval: number // hours between services
  criticality: number // 1–5 business criticality
}

export type AssetStatus = 'healthy' | 'monitor' | 'service-due' | 'at-risk'

export type ScoredAsset = AssetInput & {
  deviation: number // reading − setpoint (signed)
  deviationRatio: number // |deviation| / tolerance
  inBand: boolean
  alarm: boolean // out of tolerance band
  wear: number // runtime / interval (1 = due, >1 overdue)
  remainingPct: number // remaining service life %
  health: number // 0–100 asset-health index
  priority: number // 0–100 maintenance priority (criticality-weighted)
  status: AssetStatus
}

const DEV_K = 25 // health points per unit of out-of-band deviation ratio
const DEV_CAP = 50
const WEAR_K = 30 // health points per unit of wear
const WEAR_CAP = 45

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Score one asset from its telemetry + maintenance state. */
export function computeAsset(a: AssetInput): ScoredAsset {
  const tol = Math.max(0, a.tolerance)
  const deviation = a.reading - a.setpoint
  const absDev = Math.abs(deviation)
  const deviationRatio = tol > 0 ? absDev / tol : absDev > 0 ? Infinity : 0
  const inBand = deviationRatio <= 1
  const deviationLoad = Math.min(DEV_CAP, Math.max(0, deviationRatio - 1) * DEV_K)

  const wear = a.serviceInterval > 0 ? a.runtimeHours / a.serviceInterval : 0
  const wearLoad = Math.min(WEAR_CAP, clamp(wear, 0, 1.5) * WEAR_K)

  const health = Math.round(clamp(100 - deviationLoad - wearLoad, 0, 100))
  const remainingPct = Math.round(clamp((1 - wear) * 100, 0, 100))
  const crit = clamp(a.criticality, 1, 5)
  const priority = Math.round((100 - health) * (crit / 5))

  const status: AssetStatus =
    health < 45 ? 'at-risk' : wear > 1 || health < 65 ? 'service-due' : health < 80 ? 'monitor' : 'healthy'

  return {
    ...a,
    deviation: Math.round(deviation * 100) / 100,
    deviationRatio: Number.isFinite(deviationRatio) ? Math.round(deviationRatio * 100) / 100 : deviationRatio,
    inBand,
    alarm: !inBand,
    wear: Math.round(wear * 100) / 100,
    remainingPct,
    health,
    priority,
    status,
  }
}

export type AssetSummary = {
  count: number
  avgHealth: number
  alarms: number
  overdue: number
  criticalAtRisk: number
  topPriority: ScoredAsset | null
}

export function summarize(assets: AssetInput[]): AssetSummary {
  const scored = assets.map(computeAsset)
  if (!scored.length) return { count: 0, avgHealth: 0, alarms: 0, overdue: 0, criticalAtRisk: 0, topPriority: null }
  return {
    count: scored.length,
    avgHealth: Math.round(scored.reduce((s, a) => s + a.health, 0) / scored.length),
    alarms: scored.filter((a) => a.alarm).length,
    overdue: scored.filter((a) => a.wear > 1).length,
    criticalAtRisk: scored.filter((a) => a.status === 'at-risk' && a.criticality >= 4).length,
    topPriority: [...scored].sort((a, b) => b.priority - a.priority)[0],
  }
}

export function maintenanceNarrative(s: AssetSummary): string {
  if (!s.topPriority) return 'No assets connected to the twin yet.'
  const t = s.topPriority
  return `Mean asset health is ${s.avgHealth} across ${s.count} assets, with ${s.alarms} sensor alarm${s.alarms === 1 ? '' : 's'} and ${s.overdue} overdue service${s.overdue === 1 ? '' : 's'}. ${t.name} is the top maintenance priority (health ${t.health}, criticality ${t.criticality}) — its reading of ${t.reading}${t.unit} sits ${t.inBand ? 'within' : Math.round((t.deviationRatio - 1) * 100) + '% beyond'} the ±${t.tolerance}${t.unit} band.`
}

/* ---- zone comfort telemetry ---- */
export type Comfort = 'ok' | 'warn'
export function comfortStatus(temp: number, setpoint: number, band: number): Comfort {
  return Math.abs(temp - setpoint) <= Math.max(0, band) ? 'ok' : 'warn'
}
/** % of zones whose temperature sits within the comfort band. */
export function comfortIndex(temps: number[], setpoint: number, band: number): number {
  if (!temps.length) return 0
  const ok = temps.filter((t) => comfortStatus(t, setpoint, band) === 'ok').length
  return Math.round((ok / temps.length) * 100)
}
