import { useMemo, useState } from 'react'
import {
  CalendarClock,
  Sparkles,
  TrendingUp,
  Timer,
  Wallet,
  Activity,
  Gauge,
  AlertTriangle,
  Brain,
  Route,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  Badge,
  StatTile,
  ProgressBar,
  PageHeader,
  Tabs,
  FeatureRow,
} from '@/components/ui'
import { AreaTrend, LineTrend, BarSeries } from '@/components/charts'
import { PROJECTS, MONTHS } from '@/data/platform'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber, formatDelta } from '@/lib/format'

const ACCENT_R = 'rose' as const

/* ------------------------------------------------------------- mock series */
// Cumulative cost forecast ($M) across the program — baseline, actual to date, AI forecast.
const COST_FORECAST = MONTHS.map((month, i) => {
  const baseline = 380 + i * 96
  const actual = i <= 7 ? Math.round(baseline * (1 + 0.012 * i) + Math.sin(i) * 18) : null
  const aiForecast = Math.round(baseline * (1 + 0.018 * i) + i * 6)
  return { month, baseline, actual, aiForecast }
})

// S-curve: planned value, earned value, actual cost ($M). Last 3 months are AI-projected.
const S_CURVE = MONTHS.map((month, i) => {
  const planned = Math.round(420 + i * 102 + Math.pow(i, 1.5) * 4)
  const earned = i <= 7 ? Math.round(planned * (0.9 - i * 0.004)) : Math.round(planned * 0.88)
  const actualCost = i <= 7 ? Math.round(earned * 1.04 + i * 3) : Math.round(planned * 0.94)
  return { month, planned, earned, actualCost }
})

const DELAY_DRIVERS = [
  { driver: 'Procurement lead times', share: 31, trend: +4, accent: 'rose' as const, note: 'Long-lead MEP & vertical transport' },
  { driver: 'Design changes & RFIs', share: 24, trend: +2, accent: 'amber' as const, note: 'Late-stage scope evolution' },
  { driver: 'Labor availability', share: 18, trend: -3, accent: 'violet' as const, note: 'Skilled-trade shortfalls' },
  { driver: 'Weather & site access', share: 15, trend: +6, accent: 'sky' as const, note: 'Seasonal exposure on superstructure' },
  { driver: 'Permitting & approvals', share: 12, trend: -1, accent: 'teal' as const, note: 'Authority review cycles' },
]

const CAPABILITIES = [
  { icon: Banknote, title: 'Cost prediction', body: 'Estimate final cost from quantities, market indices and pooled actuals — within ±3.4% MAPE.', accent: 'rose' as const },
  { icon: Brain, title: 'Overrun forecasting', body: 'Probabilistic forecast-at-completion with P50 / P80 bands calibrated on 38k completed projects.', accent: 'amber' as const },
  { icon: Timer, title: 'Delay prediction', body: 'Surface slippage risk per activity 6–12 weeks ahead from progress velocity and lead-time signals.', accent: 'violet' as const },
  { icon: Route, title: 'Critical-path analytics', body: 'Detect near-critical chains, float erosion and the activities most likely to drive completion.', accent: 'sky' as const },
]

/* --------------------------------------------------------------- EVM model */
type EvmRow = {
  id: string
  name: string
  cpi: number
  spi: number
  cv: number // %
  sv: number // days
  forecast: 'On track' | 'Watch' | 'At risk'
}

function evmVariant(f: EvmRow['forecast']) {
  return f === 'On track' ? 'success' : f === 'Watch' ? 'warn' : 'danger'
}

export default function CostSchedule() {
  const [tab, setTab] = useState('forecast')

  const portfolioBudget = useMemo(() => PROJECTS.reduce((s, p) => s + p.value, 0), [])
  const forecastAtCompletion = Math.round(portfolioBudget * 1.058)
  const overrunPct = ((forecastAtCompletion / portfolioBudget - 1) * 100)
  const avgSlip = useMemo(
    () => PROJECTS.reduce((s, p) => s + p.scheduleVariance, 0) / PROJECTS.length,
    [],
  )

  // Predicted overrun by project (cost variance %), sorted worst-first.
  const overrunByProject = useMemo(
    () =>
      [...PROJECTS]
        .sort((a, b) => b.costVariance - a.costVariance)
        .map((p) => ({ name: p.name.replace(/ .*/, ''), overrun: p.costVariance })),
    [],
  )

  // Per-project EVM derived from project signals.
  const evmRows = useMemo<EvmRow[]>(
    () =>
      PROJECTS.filter((p) => p.phase === 'Construction' || p.phase === 'Procurement')
        .slice(0, 7)
        .map((p) => {
          const cpi = Math.max(0.78, Math.min(1.08, 1 - p.costVariance / 100))
          const spi = Math.max(0.74, Math.min(1.06, 1 - p.scheduleVariance / 320))
          const forecast: EvmRow['forecast'] =
            p.risk >= 72 ? 'At risk' : p.risk >= 48 ? 'Watch' : 'On track'
          return { id: p.id, name: p.name, cpi: +cpi.toFixed(2), spi: +spi.toFixed(2), cv: p.costVariance, sv: p.scheduleVariance, forecast }
        }),
    [],
  )

  const tabs = [
    { id: 'forecast', label: 'Cost forecast', icon: TrendingUp },
    { id: 'scurve', label: 'Earned value S-curve', icon: Activity },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        icon={CalendarClock}
        eyebrow="Intelligence Engines"
        title="Cost & Schedule Intelligence"
        description="Forecast overruns, delays and earned value by calibrating predictive models on pooled historical actuals — because ~90% of large projects overrun, by ~28% on average. Get ahead of the curve, not behind it."
        accent={ACCENT_R}
        actions={
          <>
            <Badge variant="success" dot>
              Forecast: 92% conf.
            </Badge>
            <button className="btn-ghost">
              <Sparkles className="h-4 w-4" /> Run scenario
            </button>
          </>
        }
      />

      {/* ===================================================== KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatTile label="Portfolio budget" value={formatCurrency(portfolioBudget)} icon={Wallet} accent="rose" sub="10 active projects" />
        <StatTile
          label="Forecast at completion"
          value={formatCurrency(forecastAtCompletion)}
          delta={formatDelta(overrunPct)}
          deltaPositive={false}
          icon={TrendingUp}
          accent="amber"
          sub="P50 estimate"
        />
        <StatTile label="Predicted overrun" value={`${overrunPct.toFixed(1)}%`} delta="vs 28% peer avg" deltaPositive icon={AlertTriangle} accent="rose" sub="Below benchmark" />
        <StatTile label="Avg schedule slip" value={`${Math.round(avgSlip)}d`} delta="+11d QoQ" deltaPositive={false} icon={Timer} accent="violet" sub="Late = positive" />
        <StatTile label="Portfolio CPI" value="0.96" delta="cost efficiency" deltaPositive={false} icon={Gauge} accent="rose" sub="Earned / actual cost" />
        <StatTile label="Portfolio SPI" value="0.91" delta="schedule efficiency" deltaPositive={false} icon={Activity} accent="amber" sub="Earned / planned" />
      </div>

      {/* ===================================================== Forecast / S-curve */}
      <Card>
        <CardHeader
          title="Program cost & earned-value trajectory"
          subtitle="Cumulative $M — baseline plan vs. actuals vs. AI forecast, with budget ceiling"
          icon={TrendingUp}
          accent={ACCENT_R}
          action={<Tabs tabs={tabs} active={tab} onChange={setTab} />}
        />
        <div className="px-3 pb-4">
          {tab === 'forecast' ? (
            <AreaTrend
              data={COST_FORECAST}
              xKey="month"
              height={300}
              valueFormatter={(v) => `$${formatNumber(v)}M`}
              referenceY={{ y: 1480, label: 'Budget ceiling' }}
              series={[
                { key: 'baseline', name: 'Baseline plan', accent: 'sky' },
                { key: 'actual', name: 'Actual to date', accent: 'rose' },
                { key: 'aiForecast', name: 'AI forecast', accent: 'amber' },
              ]}
            />
          ) : (
            <LineTrend
              data={S_CURVE}
              xKey="month"
              height={300}
              valueFormatter={(v) => `$${formatNumber(v)}M`}
              dashedKeys={['planned']}
              series={[
                { key: 'planned', name: 'Planned value (PV)', accent: 'sky' },
                { key: 'earned', name: 'Earned value (EV)', accent: 'emerald' },
                { key: 'actualCost', name: 'Actual cost (AC)', accent: 'rose' },
              ]}
            />
          )}
        </div>
      </Card>

      {/* ===================================================== Overrun + drivers */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Predicted cost overrun by project"
            subtitle="Forecast variance to budget (%) — benchmark line at 28% industry average"
            icon={AlertTriangle}
            accent={ACCENT_R}
          />
          <div className="px-3 pb-4">
            <BarSeries
              data={overrunByProject}
              xKey="name"
              layout="vertical"
              height={300}
              valueFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
              series={[{ key: 'overrun', name: 'Forecast overrun', accent: 'rose' }]}
            />
            <p className="px-3 pt-2 text-xs text-slate-500">
              Negative bars indicate projects forecast to land under budget. All active projects sit well below the 28%
              peer benchmark.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Schedule delay drivers" subtitle="Attributed contribution to slippage" icon={Timer} accent="amber" />
          <div className="space-y-4 px-5 pb-5">
            {DELAY_DRIVERS.map((d) => {
              const up = d.trend > 0
              return (
                <div key={d.driver}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-200">{d.driver}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-semibold',
                          up ? 'text-rose-400' : 'text-emerald-400',
                        )}
                      >
                        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(d.trend)}pp
                      </span>
                      <span className="w-9 text-right text-sm font-semibold text-slate-100 data-mono">{d.share}%</span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={d.share} accent={d.accent} height="sm" />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{d.note}</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ===================================================== EVM table */}
      <Card>
        <CardHeader
          title="Earned-value performance by project"
          subtitle="CPI / SPI, cost & schedule variance and AI forecast outlook"
          icon={Gauge}
          accent={ACCENT_R}
          action={<Badge variant="neutral">{evmRows.length} active</Badge>}
        />
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 text-right font-medium">CPI</th>
                <th className="px-3 py-2.5 text-right font-medium">SPI</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost var.</th>
                <th className="px-3 py-2.5 text-right font-medium">Sched. var.</th>
                <th className="px-3 py-2.5 text-right font-medium">Outlook</th>
              </tr>
            </thead>
            <tbody>
              {evmRows.map((r) => (
                <tr key={r.id} className="border-b border-edge/40 transition-colors hover:bg-elevated/40">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-100">{r.name}</div>
                    <div className="text-xs text-slate-500 data-mono">{r.id}</div>
                  </td>
                  <td className={cn('px-3 py-3 text-right font-semibold data-mono', r.cpi >= 1 ? 'text-emerald-400' : r.cpi >= 0.95 ? 'text-amber-400' : 'text-rose-400')}>
                    {r.cpi.toFixed(2)}
                  </td>
                  <td className={cn('px-3 py-3 text-right font-semibold data-mono', r.spi >= 1 ? 'text-emerald-400' : r.spi >= 0.92 ? 'text-amber-400' : 'text-rose-400')}>
                    {r.spi.toFixed(2)}
                  </td>
                  <td className={cn('px-3 py-3 text-right data-mono', r.cv > 5 ? 'text-rose-300' : r.cv > 0 ? 'text-amber-300' : 'text-emerald-300')}>
                    {formatDelta(r.cv)}
                  </td>
                  <td className={cn('px-3 py-3 text-right data-mono', r.sv > 30 ? 'text-rose-300' : r.sv > 0 ? 'text-amber-300' : 'text-emerald-300')}>
                    {r.sv > 0 ? `+${r.sv}d` : `${r.sv}d`}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Badge variant={evmVariant(r.forecast)} dot>
                      {r.forecast}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===================================================== AI capabilities */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Sparkles className={cn('h-4 w-4', ACCENT[ACCENT_R].text)} />
          <h3 className="text-[15px] font-semibold text-slate-100">AI forecasting capabilities</h3>
          <span className="text-sm text-slate-500">— calibrated on pooled, anonymized actuals</span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <FeatureRow key={c.title} icon={c.icon} title={c.title} accent={c.accent}>
              {c.body}
            </FeatureRow>
          ))}
        </div>
      </Card>
    </div>
  )
}
