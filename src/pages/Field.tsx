import { useMemo, useState } from 'react'
import {
  HardHat,
  Users,
  Gauge,
  ShieldCheck,
  ClipboardX,
  Truck,
  Activity,
  Hammer,
  AlertTriangle,
  CalendarDays,
  Sun,
  Cloud,
  CloudRain,
  Wind,
  ListChecks,
  PieChart,
  TrendingUp,
  UserCog,
  GitBranch,
  Radar,
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
  FeatureRow,
  IconBadge,
} from '@/components/ui'
import { LineTrend, BarSeries, AreaTrend, Donut } from '@/components/charts'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber, formatPercent } from '@/lib/format'

const ACCENT_NAME = 'amber' as const

/* --------------------------------------------------- productivity (10 days) */
type ProdRow = { day: string; planned: number; actual: number }
const PRODUCTIVITY: ProdRow[] = [
  { day: 'May 12', planned: 320, actual: 308 },
  { day: 'May 13', planned: 320, actual: 331 },
  { day: 'May 14', planned: 340, actual: 297 },
  { day: 'May 15', planned: 340, actual: 312 },
  { day: 'May 16', planned: 360, actual: 286 },
  { day: 'May 19', planned: 360, actual: 349 },
  { day: 'May 20', planned: 380, actual: 372 },
  { day: 'May 21', planned: 380, actual: 318 },
  { day: 'May 22', planned: 400, actual: 391 },
  { day: 'May 23', planned: 400, actual: 364 },
]

/* ------------------------------------------------------- manpower by trade */
type TradeRow = { trade: string; planned: number; actual: number }
const MANPOWER: TradeRow[] = [
  { trade: 'Concrete', planned: 210, actual: 188 },
  { trade: 'Steel', planned: 145, actual: 152 },
  { trade: 'MEP', planned: 320, actual: 274 },
  { trade: 'Electrical', planned: 180, actual: 166 },
  { trade: 'Finishing', planned: 240, actual: 231 },
  { trade: 'Earthworks', planned: 90, actual: 84 },
]
const workersOnSite = MANPOWER.reduce((s, t) => s + t.actual, 0)
const workersPlanned = MANPOWER.reduce((s, t) => s + t.planned, 0)

/* ------------------------------------------------- safety incidents (months) */
type SafetyRow = { month: string; incidents: number; nearMiss: number }
const SAFETY: SafetyRow[] = [
  { month: 'Dec', incidents: 3, nearMiss: 14 },
  { month: 'Jan', incidents: 2, nearMiss: 19 },
  { month: 'Feb', incidents: 4, nearMiss: 22 },
  { month: 'Mar', incidents: 1, nearMiss: 28 },
  { month: 'Apr', incidents: 2, nearMiss: 31 },
  { month: 'May', incidents: 1, nearMiss: 37 },
]

type Risk = 'High' | 'Medium' | 'Low'
const RISK_BADGE: Record<Risk, 'danger' | 'warn' | 'success'> = {
  High: 'danger',
  Medium: 'warn',
  Low: 'success',
}
type Observation = { id: string; site: string; hazard: string; trade: string; risk: Risk }
const OBSERVATIONS: Observation[] = [
  { id: 'OBS-4471', site: 'Meridian Tower · L24', hazard: 'Unprotected leading edge at slab perimeter', trade: 'Concrete', risk: 'High' },
  { id: 'OBS-4468', site: 'Lumen Airport T4 · Pier B', hazard: 'Mobile crane operating near live overhead lines', trade: 'Steel', risk: 'High' },
  { id: 'OBS-4462', site: 'Northgate Hospital · Ward C', hazard: 'Housekeeping — cabling trip hazard in riser', trade: 'Electrical', risk: 'Medium' },
  { id: 'OBS-4455', site: 'Solano Logistics · Bay 3', hazard: 'Operative without cut-resistant gloves on rebar', trade: 'Concrete', risk: 'Medium' },
  { id: 'OBS-4449', site: 'Harbour Point · Podium', hazard: 'Fire extinguisher obstructed by material storage', trade: 'Finishing', risk: 'Low' },
]

/* ------------------------------------------------------- quality / defects */
const DEFECTS: { name: string; value: number; accent: Accent }[] = [
  { name: 'Workmanship', value: 142, accent: 'amber' },
  { name: 'Materials', value: 68, accent: 'rose' },
  { name: 'Documentation', value: 51, accent: 'sky' },
  { name: 'Design', value: 39, accent: 'violet' },
  { name: 'Installation', value: 87, accent: 'emerald' },
]
const totalDefects = DEFECTS.reduce((s, d) => s + d.value, 0)
const punchTotal = 1840
const punchClosed = 1327
const punchPct = (punchClosed / punchTotal) * 100

/* ----------------------------------------------------------- daily reports */
type Weather = 'Clear' | 'Cloudy' | 'Rain' | 'Windy'
const WEATHER_ICON: Record<Weather, typeof Sun> = {
  Clear: Sun,
  Cloudy: Cloud,
  Rain: CloudRain,
  Windy: Wind,
}
type DailyLog = {
  date: string
  site: string
  weather: Weather
  manpower: number
  completed: string
  blocker: string | null
}
const DAILY_LOGS: DailyLog[] = [
  {
    date: 'May 23',
    site: 'Meridian Tower',
    weather: 'Clear',
    manpower: 312,
    completed: 'L23 deck pour complete (640 m³); core jump-form advanced to L25.',
    blocker: 'MEP riser inserts late from supplier — 1 day float consumed.',
  },
  {
    date: 'May 23',
    site: 'Lumen Airport T4',
    weather: 'Windy',
    manpower: 488,
    completed: 'Roof truss lift 7 of 12 set; baggage hall slab rebar 70% fixed.',
    blocker: 'High winds halted crane lifts 11:00–14:00 (45 km/h gusts).',
  },
  {
    date: 'May 22',
    site: 'Northgate Hospital',
    weather: 'Rain',
    manpower: 226,
    completed: 'Ward C blockwork to 2.4 m; mechanical plant room ductwork started.',
    blocker: 'Inspection hold on fire-stopping pending RFI-1188 response.',
  },
  {
    date: 'May 22',
    site: 'Solano Logistics Park',
    weather: 'Cloudy',
    manpower: 174,
    completed: 'Tilt-up panel erection bays 1–4; dock leveler pits formed.',
    blocker: null,
  },
  {
    date: 'May 21',
    site: 'Harbour Point Mixed-Use',
    weather: 'Clear',
    manpower: 198,
    completed: 'Podium post-tension stressing zone 2; façade unitized panels to L6.',
    blocker: 'Two finishing crews stood down — access conflict with MEP.',
  },
]

const PROD_TABS = [
  { id: 'rate', label: 'Production rate', icon: TrendingUp },
  { id: 'manpower', label: 'Manpower', icon: Users },
]

const CAPABILITIES = [
  { icon: Activity, title: 'Productivity analytics', accent: 'amber' as const, body: 'Earned vs installed quantities per crew, trade and zone — surfaces underperformance before it hits the critical path.' },
  { icon: UserCog, title: 'Workforce planning', accent: 'sky' as const, body: 'Forecasts manpower curves against the look-ahead and flags trade-stacking and access conflicts.' },
  { icon: GitBranch, title: 'Delay root-cause analysis', accent: 'violet' as const, body: 'Correlates daily logs, weather, RFIs and blockers to attribute lost time to actual drivers.' },
  { icon: Radar, title: 'Safety risk prediction', accent: 'rose' as const, body: 'Scores high-risk activities from observation patterns, headcount density and task mix.' },
]

export default function Field() {
  const [view, setView] = useState<string>('rate')

  const prodIndex = useMemo(() => {
    const p = PRODUCTIVITY.reduce((s, r) => s + r.planned, 0)
    const a = PRODUCTIVITY.reduce((s, r) => s + r.actual, 0)
    return (a / p) * 100
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={HardHat}
        eyebrow="Intelligence Engines"
        title="Construction Analytics"
        description="Capture real-time field execution data — daily reports, manpower, equipment, productivity, safety and quality — and turn it into a queryable record of how the build is actually progressing on the ground."
        accent={ACCENT_NAME}
        actions={
          <>
            <Badge variant="warn" dot>
              12 active sites
            </Badge>
            <button className="btn-ghost">
              <ClipboardX className="h-4 w-4" /> Daily report
            </button>
          </>
        }
      />

      {/* ===================================================== KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Workers on site"
          value={formatNumber(workersOnSite)}
          delta="3.1%"
          deltaPositive
          icon={Users}
          accent="amber"
          sub={`vs ${formatNumber(workersPlanned)} planned today`}
        />
        <StatTile
          label="Productivity index"
          value={formatPercent(prodIndex)}
          delta="2.4 pts"
          deltaPositive={false}
          icon={Gauge}
          accent="sky"
          sub="Actual output vs plan"
        />
        <StatTile
          label="Safety score"
          value="92"
          delta="3 pts"
          deltaPositive
          icon={ShieldCheck}
          accent="emerald"
          sub="0–100 composite, 12 sites"
        />
        <StatTile
          label="Open NCRs"
          value="47"
          delta="11"
          deltaPositive
          icon={ClipboardX}
          accent="rose"
          sub="Non-conformance reports"
        />
        <StatTile
          label="Equipment utilization"
          value="78%"
          delta="1.6 pts"
          deltaPositive
          icon={Truck}
          accent="violet"
          sub="Plant hours vs available"
        />
      </section>

      {/* ===================================================== Productivity + manpower */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Field execution"
          title="Productivity & resourcing"
          description="Planned vs actual production and the trade headcount delivering it."
          action={<Tabs tabs={PROD_TABS} active={view} onChange={setView} />}
        />
        <Card>
          {view === 'rate' ? (
            <>
              <CardHeader
                title="Production rate — planned vs actual"
                subtitle="Installed units per day, trailing 10 working days"
                icon={TrendingUp}
                accent="amber"
                action={<Badge variant="warn">{formatPercent(prodIndex)} of plan</Badge>}
              />
              <div className="px-3 pb-5">
                <LineTrend
                  data={PRODUCTIVITY}
                  xKey="day"
                  series={[
                    { key: 'planned', name: 'Planned', accent: 'sky' },
                    { key: 'actual', name: 'Actual', accent: 'amber' },
                  ]}
                  dashedKeys={['planned']}
                  valueFormatter={(v) => `${formatNumber(v)} u`}
                  height={300}
                />
              </div>
            </>
          ) : (
            <>
              <CardHeader
                title="Manpower by trade"
                subtitle="Headcount on site today vs planned allocation"
                icon={Users}
                accent="amber"
                action={<Badge variant="neutral">{formatNumber(workersOnSite)} total</Badge>}
              />
              <div className="px-3 pb-5">
                <BarSeries
                  data={MANPOWER}
                  xKey="trade"
                  series={[
                    { key: 'planned', name: 'Planned', accent: 'sky' },
                    { key: 'actual', name: 'Actual', accent: 'amber' },
                  ]}
                  valueFormatter={(v) => formatNumber(v)}
                  height={300}
                />
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ===================================================== Safety */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Safety performance"
            subtitle="Recordable incidents vs near-misses logged (6 months)"
            icon={ShieldCheck}
            accent="emerald"
            action={<Badge variant="success" dot>Trending safe</Badge>}
          />
          <div className="px-3 pb-3">
            <AreaTrend
              data={SAFETY}
              xKey="month"
              series={[
                { key: 'nearMiss', name: 'Near-misses', accent: 'amber' },
                { key: 'incidents', name: 'Recordable incidents', accent: 'rose' },
              ]}
              height={240}
            />
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-edge/60 bg-edge/40">
            {[
              { label: 'TRIR', value: '0.82', accent: 'emerald' as const },
              { label: 'Days since LTI', value: '146', accent: 'amber' as const },
              { label: 'Observations', value: '1,512', accent: 'sky' as const },
            ].map((k) => (
              <div key={k.label} className="bg-panel/80 p-4">
                <div className={cn('text-xl font-bold text-slate-50 data-mono')}>{k.value}</div>
                <div className="mt-1 text-xs text-slate-500">{k.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent observations" subtitle="Logged hazards by risk level" icon={AlertTriangle} accent="rose" />
          <div className="divide-y divide-edge/40 px-5 pb-4">
            {OBSERVATIONS.map((o) => (
              <div key={o.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-slate-200">{o.hazard}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {o.site} · {o.trade} · <span className="data-mono">{o.id}</span>
                  </p>
                </div>
                <Badge variant={RISK_BADGE[o.risk]}>{o.risk}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ===================================================== Quality */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Defect & NCR categories" subtitle={`${formatNumber(totalDefects)} open quality issues`} icon={PieChart} accent="amber" />
          <div className="px-5 pb-2">
            <Donut data={DEFECTS} valueFormatter={(v) => formatNumber(v)} />
          </div>
          <div className="space-y-1 px-5 pb-5">
            {DEFECTS.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 text-sm">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT[d.accent].dot)} />
                <span className="truncate text-slate-300">{d.name}</span>
                <span className="ml-auto shrink-0 text-slate-400 data-mono">{formatNumber(d.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Punch-list closeout"
            subtitle="Open vs closed items across active handover zones"
            icon={ListChecks}
            accent="emerald"
            action={<Badge variant="success">{formatPercent(punchPct)} closed</Badge>}
          />
          <div className="space-y-5 px-5 pb-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Overall closeout</span>
                <span className="text-slate-300 data-mono">
                  {formatNumber(punchClosed)} / {formatNumber(punchTotal)}
                </span>
              </div>
              <ProgressBar value={punchPct} accent="emerald" height="md" showValue />
            </div>
            {[
              { zone: 'Cedar Park Residences — L1–L4', open: 38, closed: 462, accent: 'emerald' as const },
              { zone: 'Greenfield Civic Center — Atrium', open: 12, closed: 318, accent: 'amber' as const },
              { zone: 'Harbour Point — Retail Podium', open: 191, closed: 287, accent: 'sky' as const },
              { zone: 'Meridian Tower — Sky Lobby', open: 272, closed: 260, accent: 'rose' as const },
            ].map((z) => {
              const pct = (z.closed / (z.open + z.closed)) * 100
              return (
                <div key={z.zone}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate text-slate-300">{z.zone}</span>
                    <span className="ml-3 shrink-0 text-xs text-slate-500 data-mono">{z.open} open</span>
                  </div>
                  <ProgressBar value={pct} accent={z.accent} height="sm" />
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      {/* ===================================================== Daily report feed */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Field log"
          title="Daily report feed"
          description="Site-level daily logs with weather, manpower, work completed and blockers."
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> Auto-synced from 12 sites
            </span>
          }
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Site</th>
                  <th className="px-3 py-3 font-medium">Weather</th>
                  <th className="px-3 py-3 text-right font-medium">Manpower</th>
                  <th className="px-5 py-3 font-medium">Work completed · blockers</th>
                </tr>
              </thead>
              <tbody>
                {DAILY_LOGS.map((log, i) => {
                  const WIcon = WEATHER_ICON[log.weather]
                  return (
                    <tr key={i} className="border-b border-edge/40 align-top transition-colors last:border-0 hover:bg-elevated/40">
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-300 data-mono">{log.date}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-medium text-slate-100">{log.site}</td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-slate-300">
                          <WIcon className="h-4 w-4 text-amber-400" /> {log.weather}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-200 data-mono">{formatNumber(log.manpower)}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-slate-300">{log.completed}</p>
                        {log.blocker ? (
                          <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-rose-300">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {log.blocker}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-emerald-400">No blockers reported</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ===================================================== AI capabilities */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Powered by AEC intelligence"
          title="What this engine automates"
          description="Field data becomes predictive once it is standardized against the lakehouse."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <Card key={c.title} className="p-5" hover>
              <FeatureRow icon={c.icon} title={c.title} accent={c.accent}>
                {c.body}
              </FeatureRow>
            </Card>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-2xl border border-edge/60 bg-gradient-to-r from-amber-500/10 via-surface/40 to-transparent p-5">
        <IconBadge icon={Hammer} accent="amber" />
        <p className="text-sm text-slate-300">
          Every daily log, inspection and timesheet is standardized into the shared field schema — making 12 live sites
          comparable, benchmarkable and ready for productivity and safety models.
        </p>
      </div>
    </div>
  )
}
