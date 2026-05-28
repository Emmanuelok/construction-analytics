import { useMemo, useState } from 'react'
import {
  Truck,
  Plus,
  Users,
  Timer,
  ShieldAlert,
  CircleDollarSign,
  Gavel,
  Award,
  GitCompareArrows,
  TrendingUp,
  Sparkles,
  CalendarClock,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  Badge,
  StatTile,
  ProgressBar,
  RingProgress,
  PageHeader,
  KeyValue,
  Tabs,
  FeatureRow,
} from '@/components/ui'
import { RadarViz, BarSeries } from '@/components/charts'
import { SUPPLIERS, type Supplier } from '@/data/platform'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'

const ACCENT_L = 'lime' as const

function riskVariant(risk: Supplier['risk']) {
  return risk === 'Low' ? 'success' : risk === 'Medium' ? 'warn' : 'danger'
}

function ringAccent(score: number) {
  return score >= 88 ? 'lime' : score >= 75 ? 'amber' : 'rose'
}

/* ----------------------------------------------- lead-time prediction (days) */
const LEAD_TIME = [
  { category: 'Elevators', predicted: 140 },
  { category: 'Switchgear', predicted: 120 },
  { category: 'Façade', predicted: 110 },
  { category: 'Glazing', predicted: 96 },
  { category: 'MEP Equip.', predicted: 68 },
  { category: 'Structural Steel', predicted: 42 },
]

/* ------------------------------------------------------- bid comparison set */
type Bid = {
  bidder: string
  price: number
  weeks: number
  technical: number
  best?: boolean
}
const BID_PACKAGE = 'Curtain Wall — Tower B'
const BIDS: Bid[] = [
  { bidder: 'Vertex Curtain Wall', price: 18_400_000, weeks: 32, technical: 88 },
  { bidder: 'Orient Glass Works', price: 16_900_000, weeks: 41, technical: 80 },
  { bidder: 'Apex Façade Partners', price: 17_600_000, weeks: 34, technical: 92, best: true },
]

/* --------------------------------------------------------- long-lead items */
type LongLead = { item: string; lead: number; orderBy: string; risk: Supplier['risk'] }
const LONG_LEAD: LongLead[] = [
  { item: 'Elevators (8 cars)', lead: 140, orderBy: '2026-06-12', risk: 'High' },
  { item: 'MV Switchgear', lead: 120, orderBy: '2026-06-30', risk: 'High' },
  { item: 'Curtain wall units', lead: 110, orderBy: '2026-07-08', risk: 'Medium' },
  { item: 'Air-cooled chillers', lead: 96, orderBy: '2026-07-24', risk: 'Medium' },
  { item: 'Standby generators', lead: 84, orderBy: '2026-08-05', risk: 'Low' },
]

const CAPABILITIES = [
  { icon: Award, title: 'Supplier recommendation', body: 'Rank vendors per package by weighted performance, price index and delivery risk against pooled history.', accent: 'lime' as const },
  { icon: GitCompareArrows, title: 'Bid comparison', body: 'Normalize commercial and technical bids into a single best-value score with anomaly flags.', accent: 'emerald' as const },
  { icon: Timer, title: 'Lead-time prediction', body: 'Forecast procurement lead times per category from market signals and supplier track records.', accent: 'amber' as const },
  { icon: ShieldAlert, title: 'Procurement risk analysis', body: 'Detect single-source exposure, late-order risk and supply-chain concentration before it bites.', accent: 'rose' as const },
]

export default function Procurement() {
  const [region, setRegion] = useState('all')

  const avgOnTime = useMemo(
    () => Math.round(SUPPLIERS.reduce((s, x) => s + x.onTime, 0) / SUPPLIERS.length),
    [],
  )
  const avgLead = useMemo(
    () => Math.round(SUPPLIERS.reduce((s, x) => s + x.leadTime, 0) / SUPPLIERS.length),
    [],
  )
  const bidsAnalyzed = 1_284

  // Filtered + ranked leaderboard.
  const ranked = useMemo(() => {
    const rows = region === 'all' ? SUPPLIERS : SUPPLIERS.filter((s) => s.region === region)
    return [...rows].sort((a, b) => b.score - a.score)
  }, [region])

  // Top-3 suppliers compared across normalized metrics (lead-time inverted so higher = better).
  const top3 = useMemo(() => [...SUPPLIERS].sort((a, b) => b.score - a.score).slice(0, 3), [])
  const maxLead = Math.max(...SUPPLIERS.map((s) => s.leadTime))
  const radarData = useMemo(() => {
    const metrics: { metric: string; pick: (s: Supplier) => number }[] = [
      { metric: 'Score', pick: (s) => s.score },
      { metric: 'On-time', pick: (s) => s.onTime },
      { metric: 'Quality', pick: (s) => s.quality },
      { metric: 'Lead-time', pick: (s) => Math.round(100 - (s.leadTime / maxLead) * 100) },
      { metric: 'Price', pick: (s) => Math.max(60, Math.round(200 - s.priceIndex)) },
    ]
    return metrics.map((m) => {
      const row: Record<string, number | string> = { metric: m.metric }
      top3.forEach((s) => {
        row[s.name] = m.pick(s)
      })
      return row
    })
  }, [top3, maxLead])

  const regionTabs = [
    { id: 'all', label: 'All regions' },
    { id: 'NA', label: 'North America' },
    { id: 'EU', label: 'Europe' },
    { id: 'APAC', label: 'APAC' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Truck}
        eyebrow="Intelligence Engines"
        title="Procurement Intelligence"
        description="Score supplier performance, normalize bid comparisons and forecast lead-time risk across the entire supply chain — turning fragmented PO, vendor and logistics data into procurement decisions you can defend."
        accent={ACCENT_L}
        actions={
          <button className="btn-ghost">
            <Plus className="h-4 w-4" /> New procurement package
          </button>
        }
      />

      {/* ===================================================== KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Suppliers tracked" value={formatNumber(4200)} delta="+180 QoQ" deltaPositive icon={Users} accent="lime" sub="Across 6 categories" />
        <StatTile label="Avg on-time delivery" value={`${avgOnTime}%`} delta="+2.4pp" deltaPositive icon={TrendingUp} accent="emerald" sub="Trailing 12 months" />
        <StatTile label="Avg lead time" value={`${avgLead}d`} delta="-4d" deltaPositive icon={Timer} accent="amber" sub="Weighted by spend" />
        <StatTile label="Value at risk" value={formatCurrency(214_000_000)} delta="+9.1%" deltaPositive={false} icon={CircleDollarSign} accent="rose" sub="Late-order exposure" />
        <StatTile label="Bids analyzed" value={formatNumber(bidsAnalyzed)} delta="+312 QoQ" deltaPositive icon={Gavel} accent="lime" sub="Across 86 packages" />
      </div>

      {/* ===================================================== Leaderboard */}
      <Card>
        <CardHeader
          title="Supplier performance leaderboard"
          subtitle="Composite score from on-time delivery, quality, lead time and price index"
          icon={Award}
          accent={ACCENT_L}
          action={<Tabs tabs={regionTabs} active={region} onChange={setRegion} />}
        />
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-medium">Supplier</th>
                <th className="px-3 py-2.5 font-medium">Region</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 text-right font-medium">On-time</th>
                <th className="px-3 py-2.5 text-right font-medium">Quality</th>
                <th className="px-3 py-2.5 text-right font-medium">Lead time</th>
                <th className="px-3 py-2.5 text-right font-medium">Price idx</th>
                <th className="px-3 py-2.5 text-right font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => (
                <tr key={s.id} className="border-b border-edge/40 transition-colors hover:bg-elevated/40">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.category}</div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="neutral">{s.region}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <ProgressBar value={s.score} accent={ringAccent(s.score)} height="sm" className="w-24" />
                      <span className="w-7 text-sm font-semibold text-slate-100 data-mono">{s.score}</span>
                    </div>
                  </td>
                  <td className={cn('px-3 py-3 text-right data-mono', s.onTime >= 90 ? 'text-emerald-300' : s.onTime >= 75 ? 'text-amber-300' : 'text-rose-300')}>
                    {s.onTime}%
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300 data-mono">{s.quality}%</td>
                  <td className="px-3 py-3 text-right text-slate-300 data-mono">{s.leadTime}d</td>
                  <td className={cn('px-3 py-3 text-right data-mono', s.priceIndex > 100 ? 'text-rose-300' : 'text-emerald-300')}>
                    {s.priceIndex}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Badge variant={riskVariant(s.risk)} dot>
                      {s.risk}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===================================================== Radar + lead time */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Top-supplier comparison"
            subtitle="Normalized 0–100; lead-time & price inverted so outer = better"
            icon={GitCompareArrows}
            accent={ACCENT_L}
          />
          <div className="px-3 pb-4">
            <RadarViz
              data={radarData}
              height={300}
              series={[
                { key: top3[0].name, name: top3[0].name, accent: 'lime' },
                { key: top3[1].name, name: top3[1].name, accent: 'cyan' },
                { key: top3[2].name, name: top3[2].name, accent: 'violet' },
              ]}
            />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Predicted lead time by category"
            subtitle="Forecast procurement duration (days) — amber/rose flag long-lead risk"
            icon={Timer}
            accent="amber"
          />
          <div className="px-3 pb-4">
            <BarSeries
              data={LEAD_TIME}
              xKey="category"
              layout="vertical"
              height={300}
              valueFormatter={(v) => `${v} days`}
              series={[{ key: 'predicted', name: 'Predicted lead time', accent: 'lime' }]}
            />
            <p className="px-3 pt-2 text-xs text-slate-500">
              Elevators, switchgear and glazing exceed the 90-day high-risk threshold — order these first to protect the
              critical path.
            </p>
          </div>
        </Card>
      </div>

      {/* ===================================================== Bid comparison + watchlist */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Bid comparison"
            subtitle={BID_PACKAGE}
            icon={Gavel}
            accent={ACCENT_L}
            action={<Badge variant="brand">3 bids</Badge>}
          />
          <div className="space-y-3 px-5 pb-5">
            {BIDS.map((b) => (
              <div
                key={b.bidder}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  b.best ? 'border-lime-500/40 bg-lime-500/[0.06]' : 'border-edge/60 bg-elevated/30',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-slate-100">{b.bidder}</span>
                    {b.best && (
                      <Badge variant="success" dot>
                        AI: best value
                      </Badge>
                    )}
                  </div>
                  <span className="text-base font-semibold text-slate-50 data-mono">{formatCurrency(b.price)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <KeyValue label="Schedule" value={`${b.weeks} wks`} mono />
                  <KeyValue label="Technical" value={`${b.technical}/100`} mono />
                  <KeyValue label="Price idx" value={b.price === Math.min(...BIDS.map((x) => x.price)) ? 'Lowest' : '—'} />
                </div>
                <div className="mt-2">
                  <ProgressBar value={b.technical} accent={b.best ? 'lime' : 'cyan'} height="sm" showValue />
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              Recommendation weighs technical (40%), price (35%) and schedule (25%). Apex wins on best-value despite not
              being the lowest bid.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Long-lead watchlist" subtitle="Order-by dates to protect the schedule" icon={CalendarClock} accent="rose" />
          <div className="space-y-2.5 px-5 pb-5">
            {LONG_LEAD.map((l) => (
              <div key={l.item} className="flex items-center justify-between gap-3 rounded-lg border border-edge/50 bg-elevated/20 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-200">{l.item}</div>
                  <div className="text-xs text-slate-500">
                    Order by <span className="data-mono text-slate-400">{l.orderBy}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-slate-100 data-mono">{l.lead}d</span>
                  <Badge variant={riskVariant(l.risk)} dot>
                    {l.risk}
                  </Badge>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <RingProgress value={62} accent="rose" size={56} stroke={6} />
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-300">62%</span> of long-lead value is exposed to schedule risk
                if orders slip past the recommended dates.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ===================================================== AI capabilities */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Sparkles className={cn('h-4 w-4', ACCENT[ACCENT_L].text)} />
          <h3 className="text-[15px] font-semibold text-slate-100">AI procurement capabilities</h3>
          <span className="text-sm text-slate-500">— learned across 4,200 suppliers and 86 live packages</span>
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
