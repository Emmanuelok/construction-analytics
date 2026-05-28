import { useMemo, useState } from 'react'
import {
  Gauge,
  Wallet,
  TrendingDown,
  CalendarClock,
  ShieldAlert,
  Target,
  Download,
  AlertTriangle,
  ArrowUpRight,
  PieChart,
  Activity,
  Radar,
  Layers,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  StatTile,
  Badge,
  ProgressBar,
  SectionHeading,
  Tabs,
  IconBadge,
} from '@/components/ui'
import { AreaTrend, Donut, RadarViz, ScatterViz } from '@/components/charts'
import { PROJECTS, MONTHS, type Project } from '@/data/platform'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber, formatDelta } from '@/lib/format'

const ACCENT_NAME = 'cyan' as const

/* --------------------------------------------------------- derived metrics */
const totalValue = PROJECTS.reduce((s, p) => s + p.value, 0)
const weightedCostVariance =
  PROJECTS.reduce((s, p) => s + p.costVariance * p.value, 0) / totalValue
const avgSlip = PROJECTS.reduce((s, p) => s + p.scheduleVariance, 0) / PROJECTS.length
const avgRisk = PROJECTS.reduce((s, p) => s + p.risk, 0) / PROJECTS.length
const onTrack = PROJECTS.filter((p) => p.costVariance < 5 && p.scheduleVariance < 14)
const onTrackPct = (onTrack.length / PROJECTS.length) * 100

/* ------------------------------------------------------ value by sector */
const SECTOR_ACCENTS: Accent[] = ['cyan', 'blue', 'violet', 'emerald', 'amber', 'rose', 'sky', 'teal', 'fuchsia', 'lime']
const sectorData = (() => {
  const map = new Map<string, number>()
  for (const p of PROJECTS) map.set(p.sector, (map.get(p.sector) ?? 0) + p.value)
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, accent: SECTOR_ACCENTS[i % SECTOR_ACCENTS.length] }))
})()

/* ------------------------------------------------------ scatter (risk map) */
const scatterData = PROJECTS.map((p) => ({
  name: p.name,
  costVariance: p.costVariance,
  scheduleVariance: p.scheduleVariance,
  value: p.value / 1_000_000,
}))

/* ------------------------------------------------------ portfolio radar */
type RadarRow = { metric: string; portfolio: number; target: number }
const radarData: RadarRow[] = [
  { metric: 'Cost', portfolio: 71, target: 90 },
  { metric: 'Schedule', portfolio: 64, target: 88 },
  { metric: 'Safety', portfolio: 91, target: 95 },
  { metric: 'Quality', portfolio: 87, target: 92 },
  { metric: 'Procurement', portfolio: 76, target: 90 },
  { metric: 'ESG', portfolio: 68, target: 85 },
]

/* ------------------------------------------------- earned value (11 months) */
type CashRow = { month: string; planned: number; earned: number; actual: number }
const cashFlow: CashRow[] = MONTHS.map((month, i) => {
  const planned = Math.round(120 + i * 58)
  const earned = Math.round(planned * (0.99 - i * 0.011))
  const actual = Math.round(earned * (1.0 + i * 0.014))
  return { month, planned, earned, actual }
})

/* ------------------------------------------------------ decision alerts */
type Severity = 'critical' | 'high' | 'watch'
type Alert = {
  project: string
  title: string
  detail: string
  action: string
  severity: Severity
  icon: typeof AlertTriangle
}
const ALERTS: Alert[] = [
  {
    project: 'Riverside Transit Hub',
    title: 'Cost & schedule breach on PPP critical path',
    detail: '+11.5% cost variance, +96 days late, risk index 83, 2,240 open RFIs.',
    action: 'Convene recovery board; re-baseline schedule and trigger PPP liquidated-damages review.',
    severity: 'critical',
    icon: AlertTriangle,
  },
  {
    project: 'Lumen Airport T4',
    title: 'Largest exposure trending over budget',
    detail: '$2.4B EPCM, +9.3% cost, +71 days, 158 clashes blocking MEP fit-out.',
    action: 'Escalate clash resolution sprint; ring-fence $42M contingency against fit-out delay.',
    severity: 'critical',
    icon: ShieldAlert,
  },
  {
    project: 'Northgate Hospital',
    title: 'Healthcare IPD slipping on quality gates',
    detail: '+7.8% cost, +42 days, quality 84, 1,610 RFIs against clinical compliance scope.',
    action: 'Add commissioning lead; lock design changes and prioritize regulated-space handover.',
    severity: 'high',
    icon: AlertTriangle,
  },
  {
    project: 'Solano Logistics Park',
    title: 'Mid-tier cost drift emerging',
    detail: '+5.6% cost, +24 days; risk index climbing to 55 on long-lead steel.',
    action: 'Lock supplier pricing now; expedite structural steel to protect topping-out date.',
    severity: 'high',
    icon: TrendingDown,
  },
  {
    project: 'Aurora Data Center',
    title: 'Procurement window for $1.2B EPC closing',
    detail: 'On budget (-2.4%) but only 22% complete; switchgear lead times extending.',
    action: 'Award long-lead electrical packages this quarter to hold the energization milestone.',
    severity: 'watch',
    icon: CalendarClock,
  },
]

const SEV_META: Record<Severity, { variant: 'danger' | 'warn' | 'cyan'; label: string; accent: Accent }> = {
  critical: { variant: 'danger', label: 'Critical', accent: 'rose' },
  high: { variant: 'warn', label: 'High', accent: 'amber' },
  watch: { variant: 'cyan', label: 'Watch', accent: 'cyan' },
}

/* ------------------------------------------------- variance / risk styling */
function costBadge(v: number): { variant: 'success' | 'warn' | 'danger'; label: string } {
  if (v >= 8) return { variant: 'danger', label: formatDelta(v) }
  if (v >= 4) return { variant: 'warn', label: formatDelta(v) }
  return { variant: 'success', label: formatDelta(v) }
}
function riskTone(v: number): string {
  if (v >= 70) return 'text-rose-400'
  if (v >= 45) return 'text-amber-400'
  return 'text-emerald-400'
}
function phaseVariant(phase: Project['phase']): 'brand' | 'violet' | 'cyan' | 'success' | 'neutral' {
  switch (phase) {
    case 'Design':
      return 'violet'
    case 'Procurement':
      return 'brand'
    case 'Construction':
      return 'cyan'
    case 'Handover':
      return 'success'
    default:
      return 'neutral'
  }
}

const RISK_TABS = [
  { id: 'value', label: 'By value' },
  { id: 'risk', label: 'By risk' },
  { id: 'slip', label: 'By slip' },
]

export default function Insights() {
  const [sort, setSort] = useState<string>('value')

  const sortedProjects = useMemo(() => {
    const rows = [...PROJECTS]
    if (sort === 'risk') return rows.sort((a, b) => b.risk - a.risk)
    if (sort === 'slip') return rows.sort((a, b) => b.scheduleVariance - a.scheduleVariance)
    return rows.sort((a, b) => b.value - a.value)
  }, [sort])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Gauge}
        eyebrow="Core"
        title="Executive Insights"
        description="Portfolio-level KPIs, cross-project risk and the decisions that move money — built for owners, developers, investors and executives steering capital across the built environment."
        accent={ACCENT_NAME}
        actions={
          <>
            <Badge variant="success" dot>
              Live
            </Badge>
            <button className="btn-ghost">
              <Download className="h-4 w-4" /> Export brief
            </button>
          </>
        }
      />

      {/* ===================================================== KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Portfolio value"
          value={formatCurrency(totalValue)}
          delta="6.2%"
          deltaPositive
          icon={Wallet}
          accent="cyan"
          sub={`${PROJECTS.length} active capital projects`}
        />
        <StatTile
          label="Wtd. cost variance"
          value={formatDelta(weightedCostVariance)}
          delta="1.4 pts"
          deltaPositive={false}
          icon={TrendingDown}
          accent="rose"
          sub="Value-weighted vs budget"
        />
        <StatTile
          label="Avg. schedule slip"
          value={`${avgSlip >= 0 ? '+' : ''}${Math.round(avgSlip)}d`}
          delta="4 days"
          deltaPositive={false}
          icon={CalendarClock}
          accent="amber"
          sub="Across portfolio baseline"
        />
        <StatTile
          label="Portfolio risk index"
          value={Math.round(avgRisk)}
          delta="2 pts"
          deltaPositive={false}
          icon={ShieldAlert}
          accent="violet"
          sub="0–100 composite score"
        />
        <StatTile
          label="Projects on track"
          value={`${Math.round(onTrackPct)}%`}
          delta="5 pts"
          deltaPositive
          icon={Target}
          accent="emerald"
          sub={`${onTrack.length} of ${PROJECTS.length} within tolerance`}
        />
      </section>

      {/* ===================================================== Value + scatter */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Portfolio value by sector"
            subtitle="Capital deployed across asset classes"
            icon={PieChart}
            accent="cyan"
          />
          <div className="px-5 pb-2">
            <Donut data={sectorData} valueFormatter={(v) => formatCurrency(v)} />
          </div>
          <div className="space-y-1 px-5 pb-5">
            {sectorData.slice(0, 5).map((s) => (
              <div key={s.name} className="flex items-center gap-2.5 text-sm">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT[s.accent].dot)} />
                <span className="truncate text-slate-300">{s.name}</span>
                <span className="ml-auto shrink-0 text-slate-400 data-mono">{formatCurrency(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Cost vs schedule risk"
            subtitle="Bubble size = project value · top-right quadrant is danger"
            icon={Activity}
            accent="rose"
            action={<Badge variant="danger">{PROJECTS.filter((p) => p.costVariance >= 8).length} red</Badge>}
          />
          <div className="px-3 pb-5">
            <ScatterViz
              data={scatterData}
              xKey="costVariance"
              yKey="scheduleVariance"
              zKey="value"
              xName="Cost variance %"
              yName="Schedule slip (days)"
              accent="rose"
              height={300}
            />
          </div>
        </Card>
      </section>

      {/* ===================================================== Radar + EVA */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Portfolio risk radar"
            subtitle="Current performance vs board target"
            icon={Radar}
            accent="violet"
          />
          <div className="px-3 pb-5">
            <RadarViz
              data={radarData}
              series={[
                { key: 'portfolio', name: 'Portfolio', accent: 'cyan' },
                { key: 'target', name: 'Target', accent: 'violet' },
              ]}
              height={300}
            />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Earned value & cash flow"
            subtitle="Planned vs earned vs actual cost ($M, trailing 11 months)"
            icon={Layers}
            accent="cyan"
            action={
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                <ArrowUpRight className="h-3 w-3" /> CPI 0.94
              </span>
            }
          />
          <div className="px-3 pb-5">
            <AreaTrend
              data={cashFlow}
              xKey="month"
              series={[
                { key: 'planned', name: 'Planned value', accent: 'sky' },
                { key: 'earned', name: 'Earned value', accent: 'cyan' },
                { key: 'actual', name: 'Actual cost', accent: 'rose' },
              ]}
              valueFormatter={(v) => `$${formatNumber(v)}M`}
              height={300}
            />
          </div>
        </Card>
      </section>

      {/* ===================================================== Projects table */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Portfolio detail"
          title="Active projects"
          description="Every capital project with live cost, schedule and risk posture."
          action={<Tabs tabs={RISK_TABS} active={sort} onChange={setSort} />}
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-3 py-3 font-medium">Phase</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                  <th className="px-3 py-3 font-medium">Progress</th>
                  <th className="px-3 py-3 text-right font-medium">Cost var.</th>
                  <th className="px-3 py-3 text-right font-medium">Slip</th>
                  <th className="px-5 py-3 text-right font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((p) => {
                  const cb = costBadge(p.costVariance)
                  return (
                    <tr key={p.id} className="border-b border-edge/40 transition-colors last:border-0 hover:bg-elevated/40">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-100">{p.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {p.sector} · {p.location}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge variant={phaseVariant(p.phase)}>{p.phase}</Badge>
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-200 data-mono">{formatCurrency(p.value)}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={p.progress} accent="cyan" height="sm" />
                          <span className="w-9 shrink-0 text-right text-xs text-slate-400 data-mono">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <Badge variant={cb.variant}>{cb.label}</Badge>
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-300 data-mono">
                        {p.scheduleVariance > 0 ? '+' : ''}
                        {p.scheduleVariance}d
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn('font-semibold data-mono', riskTone(p.risk))}>{p.risk}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ===================================================== Decisions */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Action required"
          title="Decisions that need attention"
          description="Ranked by exposure — each item pairs the signal with a recommended executive action."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {ALERTS.map((a) => {
            const meta = SEV_META[a.severity]
            return (
              <Card key={a.project} className="flex gap-4 p-5" hover>
                <IconBadge icon={a.icon} accent={meta.accent} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">{a.project}</div>
                      <h3 className="mt-0.5 font-semibold leading-snug text-slate-100">{a.title}</h3>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{a.detail}</p>
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-edge/60 bg-elevated/40 px-3 py-2">
                    <Target className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', ACCENT[meta.accent].text)} />
                    <p className="text-xs leading-relaxed text-slate-300">{a.action}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
