import {
  Bell,
  AlertTriangle,
  Plus,
  Trash2,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAlerts } from '@/store/alerts'
import { METRICS, OPS, SEVERITIES, type Severity } from '@/lib/alerts'

const SEV: Record<Severity, { variant: 'danger' | 'warn' | 'neutral'; dot: string }> = {
  High: { variant: 'danger', dot: 'bg-rose-400' },
  Medium: { variant: 'warn', dot: 'bg-amber-400' },
  Low: { variant: 'neutral', dot: 'bg-slate-400' },
}

function money(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n)}`
}
const fmtVal = (v: number, unit?: string) =>
  unit === '$' ? money(v) : unit === '%' ? `${v}%` : unit === 'd' ? `${v}d` : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : String(v)

export default function Alerts() {
  const { rules, alerts, summary, addRule, updateRule, removeRule, resetRules } = useAlerts()

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Bell}
        accent="rose"
        eyebrow="Studio"
        title="Alerts & Notifications"
        description="Define the thresholds that matter — CPI, schedule slip, embodied carbon, safety, exposure — and the studio watches every project, surfacing each breach the moment your data crosses the line."
        actions={
          <Badge variant={summary.high > 0 ? 'danger' : summary.total > 0 ? 'warn' : 'success'} dot>
            {summary.total} active {summary.total === 1 ? 'alert' : 'alerts'}
          </Badge>
        }
      />

      {/* breach KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Active alerts" value={String(summary.total)} icon={Bell} accent={summary.total > 0 ? 'rose' : 'emerald'} sub="Across the portfolio" />
        <StatTile label="High severity" value={String(summary.high)} icon={ShieldAlert} accent="rose" sub="Immediate attention" />
        <StatTile label="Medium" value={String(summary.medium)} icon={AlertTriangle} accent="amber" sub="Watch closely" />
        <StatTile label="Low" value={String(summary.low)} icon={AlertTriangle} accent="sky" sub="Informational" />
        <StatTile label="Projects affected" value={String(summary.subjects)} icon={AlertTriangle} accent="violet" sub="With ≥1 breach" />
      </div>

      {/* triggered alerts */}
      <Card>
        <CardHeader icon={AlertTriangle} accent="rose" title="Triggered alerts" subtitle="Every rule breach across the portfolio, worst-first" />
        <div className="border-t border-edge/50">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 p-8 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" /> No breaches — every project is within your thresholds.</div>
          ) : (
            <ul className="divide-y divide-edge/40">
              {alerts.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-elevated/30">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', SEV[a.severity].dot)} />
                  <Badge variant={SEV[a.severity].variant}>{a.severity}</Badge>
                  <span className="font-medium text-slate-100">{a.subjectName}</span>
                  <span className="text-sm text-slate-400">
                    {a.metricLabel} {a.op} {fmtVal(a.threshold, a.unit)}
                  </span>
                  <span className="ml-auto text-sm">
                    <span className="text-slate-500">actual</span> <span className="font-semibold text-rose-300 data-mono">{fmtVal(a.value, a.unit)}</span>
                  </span>
                  <span className="w-full text-[11px] text-slate-600 sm:w-auto sm:pl-2">· {a.ruleName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* rules editor */}
      <Card>
        <CardHeader
          icon={SlidersHorizontal}
          accent="rose"
          title="Alert rules — editable"
          subtitle="Each rule fires when a project's metric crosses the threshold"
          action={
            <div className="flex gap-2">
              <button onClick={resetRules} className="btn-ghost h-9 px-3 py-0 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Defaults</button>
              <button onClick={addRule} className="btn-ghost h-9 px-3 py-0 text-xs"><Plus className="h-3.5 w-3.5" /> Add rule</button>
            </div>
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">On</th>
                <th className="px-3 py-2.5 font-medium">Rule</th>
                <th className="px-3 py-2.5 font-medium">Metric</th>
                <th className="px-3 py-2.5 text-center font-medium">Op</th>
                <th className="px-3 py-2.5 text-right font-medium">Threshold</th>
                <th className="px-3 py-2.5 font-medium">Severity</th>
                <th className="px-3 py-2.5 text-right font-medium">Breaches</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {rules.map((r) => {
                const breaches = alerts.filter((a) => a.ruleId === r.id).length
                return (
                  <tr key={r.id} className={cn('hover:bg-elevated/30', !r.enabled && 'opacity-50')}>
                    <td className="px-4 py-2">
                      <button onClick={() => updateRule(r.id, { enabled: !r.enabled })} role="switch" aria-checked={r.enabled} className={cn('relative h-5 w-9 rounded-full transition-colors', r.enabled ? 'bg-rose-500/70' : 'bg-edge')}>
                        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', r.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <input value={r.name} onChange={(e) => updateRule(r.id, { name: e.target.value })} className="w-36 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={r.metric} onChange={(e) => updateRule(r.id, { metric: e.target.value })} className="rounded-md border border-edge/60 bg-elevated/60 px-2 py-1 text-xs text-slate-200 focus:outline-none">
                        {METRICS.map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <select value={r.op} onChange={(e) => updateRule(r.id, { op: e.target.value as typeof r.op })} className="rounded-md border border-edge/60 bg-elevated/60 px-2 py-1 text-center text-xs text-slate-200 focus:outline-none">
                        {OPS.map((o) => (<option key={o} value={o}>{o}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="any" value={r.threshold} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) updateRule(r.id, { threshold: n }) }} className="w-24 rounded border border-edge/60 bg-elevated/60 px-1.5 py-1 text-right text-sm text-slate-100 data-mono focus:border-rose-500/50 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={r.severity} onChange={(e) => updateRule(r.id, { severity: e.target.value as Severity })} className="rounded-md border border-edge/60 bg-elevated/60 px-2 py-1 text-xs text-slate-200 focus:outline-none">
                        {SEVERITIES.map((s) => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </td>
                    <td className={cn('px-3 py-2 text-right data-mono', breaches > 0 ? 'text-rose-300' : 'text-slate-600')}>{breaches}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeRule(r.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
