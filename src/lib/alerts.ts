/* Threshold alerts — pure, unit-tested. Turns a portfolio into a watchlist:
 * users define rules ("metric op threshold", e.g. CPI < 0.9) and the engine
 * evaluates them across every project, emitting severity-tagged alerts for each
 * breach. Metrics are computed via the unified project model, so a rule fires on
 * the same numbers the workbenches show. The brain behind the Alerts Center and
 * the notifications bell. */

import { deriveProjectModel, type ProjectVitals } from './project-model'

export type Op = '<' | '<=' | '>' | '>=' | '==' | '!='
export const OPS: Op[] = ['<', '<=', '>', '>=', '==', '!=']
export type Severity = 'High' | 'Medium' | 'Low'
export const SEVERITIES: Severity[] = ['High', 'Medium', 'Low']

export type MetricDef = { key: string; label: string; unit?: string }
export const METRICS: MetricDef[] = [
  { key: 'health', label: 'Composite health' },
  { key: 'cpi', label: 'Cost index (CPI)' },
  { key: 'spi', label: 'Schedule index (SPI)' },
  { key: 'exposure', label: 'Value at risk', unit: '$' },
  { key: 'costVariance', label: 'Cost variance', unit: '%' },
  { key: 'scheduleSlip', label: 'Schedule slip', unit: 'd' },
  { key: 'risk', label: 'Risk index' },
  { key: 'safety', label: 'Safety score' },
  { key: 'quality', label: 'Quality score' },
  { key: 'carbon', label: 'Embodied carbon' },
  { key: 'progress', label: '% complete', unit: '%' },
  { key: 'rfis', label: 'Open RFIs' },
  { key: 'clashes', label: 'Clashes' },
]
const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]))
export const metricLabel = (key: string) => METRIC_BY_KEY.get(key)?.label ?? key
export const metricUnit = (key: string) => METRIC_BY_KEY.get(key)?.unit

export type AlertRule = { id: string; name: string; metric: string; op: Op; threshold: number; severity: Severity; enabled: boolean }

export function compare(a: number, op: Op, b: number): boolean {
  switch (op) {
    case '<': return a < b
    case '<=': return a <= b
    case '>': return a > b
    case '>=': return a >= b
    case '==': return a === b
    case '!=': return a !== b
  }
}

export type Subject = { id: string; name: string; metrics: Record<string, number> }

/** Compute every evaluable metric for one project from its vitals. */
export function metricsForVitals(v: ProjectVitals): Record<string, number> {
  const m = deriveProjectModel(v)
  return {
    health: m.health,
    cpi: m.evm.cpi,
    spi: m.evm.spi,
    exposure: m.exposure,
    costVariance: v.costVariance,
    scheduleSlip: v.scheduleVariance,
    risk: v.risk,
    safety: v.safety,
    quality: v.quality,
    carbon: v.carbon,
    progress: v.progress,
    rfis: v.rfis,
    clashes: v.clashes,
  }
}

export type Alert = {
  ruleId: string
  ruleName: string
  severity: Severity
  subjectId: string
  subjectName: string
  metric: string
  metricLabel: string
  unit?: string
  value: number
  op: Op
  threshold: number
}

const SEV_RANK: Record<Severity, number> = { High: 0, Medium: 1, Low: 2 }

/** Evaluate enabled rules across all subjects; one alert per breach, worst-first. */
export function evaluate(rules: AlertRule[], subjects: Subject[]): Alert[] {
  const out: Alert[] = []
  for (const r of rules) {
    if (!r.enabled) continue
    for (const s of subjects) {
      const value = s.metrics[r.metric]
      if (typeof value !== 'number' || Number.isNaN(value)) continue
      if (compare(value, r.op, r.threshold)) {
        out.push({
          ruleId: r.id, ruleName: r.name, severity: r.severity,
          subjectId: s.id, subjectName: s.name,
          metric: r.metric, metricLabel: metricLabel(r.metric), unit: metricUnit(r.metric),
          value: Math.round(value * 100) / 100, op: r.op, threshold: r.threshold,
        })
      }
    }
  }
  return out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.subjectName.localeCompare(b.subjectName))
}

export type AlertSummary = { total: number; high: number; medium: number; low: number; subjects: number }
export function summarize(alerts: Alert[]): AlertSummary {
  return {
    total: alerts.length,
    high: alerts.filter((a) => a.severity === 'High').length,
    medium: alerts.filter((a) => a.severity === 'Medium').length,
    low: alerts.filter((a) => a.severity === 'Low').length,
    subjects: new Set(alerts.map((a) => a.subjectId)).size,
  }
}

let seq = 0
export function makeRule(partial: Partial<AlertRule> = {}): AlertRule {
  return {
    id: partial.id ?? `rule-${Date.now().toString(36)}-${(seq++).toString(36)}`,
    name: partial.name ?? 'New rule',
    metric: partial.metric ?? 'health',
    op: partial.op ?? '<',
    threshold: partial.threshold ?? 0,
    severity: partial.severity ?? 'Medium',
    enabled: partial.enabled ?? true,
  }
}

export const DEFAULT_RULES: AlertRule[] = [
  makeRule({ id: 'r-cpi', name: 'Cost overrun', metric: 'cpi', op: '<', threshold: 0.9, severity: 'High' }),
  makeRule({ id: 'r-slip', name: 'Major delay', metric: 'scheduleSlip', op: '>', threshold: 30, severity: 'High' }),
  makeRule({ id: 'r-health', name: 'At-risk project', metric: 'health', op: '<', threshold: 55, severity: 'High' }),
  makeRule({ id: 'r-carbon', name: 'High embodied carbon', metric: 'carbon', op: '>', threshold: 700, severity: 'Medium' }),
  makeRule({ id: 'r-safety', name: 'Safety below target', metric: 'safety', op: '<', threshold: 85, severity: 'Medium' }),
  makeRule({ id: 'r-rfi', name: 'RFI backlog', metric: 'rfis', op: '>', threshold: 2000, severity: 'Low' }),
]

function isRule(x: unknown): x is AlertRule {
  const r = x as AlertRule
  return !!r && typeof r.id === 'string' && typeof r.metric === 'string' && OPS.includes(r.op) && typeof r.threshold === 'number'
}
export function parseRules(raw: string | null): AlertRule[] {
  if (!raw) return []
  try { const v: unknown = JSON.parse(raw); return Array.isArray(v) ? v.filter(isRule) : [] } catch { return [] }
}
