import {
  ScanEye,
  Image as ImageIcon,
  MapPinned,
  CheckCircle2,
  ScanSearch,
  Boxes,
  Upload,
  TrendingUp,
  Grid3x3,
  Layers,
  Ruler,
  Plane,
  View,
  Radar,
  GitCompareArrows,
  Eye,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  StatTile,
  Badge,
  SectionHeading,
  FeatureRow,
  IconBadge,
} from '@/components/ui'
import { AreaTrend, BarSeries } from '@/components/charts'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber, formatPercent, formatBytes } from '@/lib/format'

const ACCENT_NAME = 'cyan' as const

/* --------------------------------------- progress verification (weeks) */
type ProgRow = { week: string; planned: number; claimed: number; verified: number }
const PROGRESS: ProgRow[] = [
  { week: 'W1', planned: 8, claimed: 9, verified: 7 },
  { week: 'W2', planned: 16, claimed: 18, verified: 14 },
  { week: 'W3', planned: 24, claimed: 27, verified: 21 },
  { week: 'W4', planned: 33, claimed: 36, verified: 29 },
  { week: 'W5', planned: 42, claimed: 47, verified: 38 },
  { week: 'W6', planned: 51, claimed: 58, verified: 46 },
  { week: 'W7', planned: 60, claimed: 67, verified: 53 },
  { week: 'W8', planned: 68, claimed: 76, verified: 61 },
]
const claimGap = PROGRESS[PROGRESS.length - 1].claimed - PROGRESS[PROGRESS.length - 1].verified

/* --------------------------------------- coverage heatmap (6 cols x 8 rows) */
// recency 0 = none captured, 1 = stale, 2 = aging, 3 = recent, 4 = today
const HEAT_COLS = 6
const HEAT_ROWS = 8
const HEAT: number[] = [
  4, 4, 3, 3, 2, 1,
  4, 4, 4, 3, 2, 2,
  3, 4, 4, 4, 3, 2,
  3, 3, 4, 4, 4, 3,
  2, 3, 3, 4, 4, 3,
  2, 2, 3, 3, 4, 4,
  1, 2, 2, 3, 4, 4,
  0, 1, 2, 3, 3, 4,
]
const HEAT_TONE: Record<number, string> = {
  0: 'bg-elevated/60 ring-edge/50',
  1: 'bg-cyan-500/15 ring-cyan-500/20',
  2: 'bg-cyan-500/30 ring-cyan-500/30',
  3: 'bg-cyan-500/55 ring-cyan-400/40',
  4: 'bg-cyan-400/90 ring-cyan-300/60',
}
const HEAT_LEGEND = [
  { tone: 0, label: 'No capture' },
  { tone: 1, label: '14d+' },
  { tone: 2, label: '7–14d' },
  { tone: 3, label: '< 7d' },
  { tone: 4, label: 'Today' },
]
const coveredCells = HEAT.filter((c) => c > 0).length
const coveragePct = (coveredCells / HEAT.length) * 100

/* --------------------------------------- computer vision detections */
type DetectRow = { label: string; count: number }
const DETECTIONS: DetectRow[] = [
  { label: 'PPE compliance', count: 4820 },
  { label: 'Installed equipment', count: 1264 },
  { label: 'Exposed rebar', count: 372 },
  { label: 'Water ingress', count: 88 },
  { label: 'Scaffolding', count: 1510 },
  { label: 'Debris / housekeeping', count: 642 },
]

/* --------------------------------------- as-built vs BIM deviations */
type DevStatus = 'Within tol.' | 'Review' | 'Out of tol.'
const DEV_BADGE: Record<DevStatus, 'success' | 'warn' | 'danger'> = {
  'Within tol.': 'success',
  Review: 'warn',
  'Out of tol.': 'danger',
}
type Deviation = { location: string; element: string; deviation: number; tolerance: number; status: DevStatus }
const DEVIATIONS: Deviation[] = [
  { location: 'L24 · Grid C4', element: 'Column face position', deviation: 9, tolerance: 10, status: 'Within tol.' },
  { location: 'L18 · Core wall', element: 'Slab edge setout', deviation: 14, tolerance: 12, status: 'Review' },
  { location: 'Pier B · Grid 7', element: 'Embed plate elevation', deviation: 23, tolerance: 15, status: 'Out of tol.' },
  { location: 'L12 · Riser 3', element: 'MEP sleeve centreline', deviation: 31, tolerance: 20, status: 'Out of tol.' },
  { location: 'Podium · Grid B2', element: 'PT duct cover', deviation: 7, tolerance: 10, status: 'Within tol.' },
  { location: 'L09 · Façade bay 4', element: 'Bracket plumb', deviation: 11, tolerance: 12, status: 'Review' },
]

/* --------------------------------------- capture timeline */
type CapType = 'Drone' | '360' | 'LiDAR'
const CAP_META: Record<CapType, { icon: typeof Plane; accent: Accent }> = {
  Drone: { icon: Plane, accent: 'cyan' },
  '360': { icon: View, accent: 'violet' },
  LiDAR: { icon: ScanSearch, accent: 'sky' },
}
type Capture = { id: string; type: CapType; area: string; date: string; bytes: number; processed: boolean }
const CAPTURES: Capture[] = [
  { id: 'CAP-9821', type: 'Drone', area: 'Meridian Tower — full envelope', date: 'May 23 · 07:40', bytes: 12_400_000_000, processed: true },
  { id: 'CAP-9818', type: 'LiDAR', area: 'Lumen T4 — baggage hall', date: 'May 22 · 16:10', bytes: 48_200_000_000, processed: true },
  { id: 'CAP-9814', type: '360', area: 'Northgate — Ward C fit-out', date: 'May 22 · 11:25', bytes: 3_100_000_000, processed: true },
  { id: 'CAP-9809', type: 'Drone', area: 'Solano Logistics — roof & yard', date: 'May 21 · 08:05', bytes: 9_800_000_000, processed: false },
  { id: 'CAP-9803', type: 'LiDAR', area: 'Harbour Point — podium core', date: 'May 20 · 14:50', bytes: 31_600_000_000, processed: true },
  { id: 'CAP-9799', type: '360', area: 'Cedar Park — L1–L4 walkthrough', date: 'May 20 · 09:15', bytes: 2_400_000_000, processed: false },
]

const CAPABILITIES = [
  { icon: Eye, title: 'Computer vision', accent: 'cyan' as const, body: '14 trained models segment site imagery — detecting elements, conditions, PPE and hazards frame by frame.' },
  { icon: TrendingUp, title: 'Progress verification', accent: 'sky' as const, body: 'Measures installed work against the model and schedule so claimed progress can be objectively confirmed.' },
  { icon: GitCompareArrows, title: 'As-built comparison', accent: 'violet' as const, body: 'Registers point clouds to BIM and computes element-level deviation against tolerance automatically.' },
  { icon: Radar, title: 'Defect detection', accent: 'rose' as const, body: 'Flags cracking, water ingress, exposed rebar and finish defects from photos before they are buried.' },
]

export default function RealityCapture() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={ScanEye}
        eyebrow="Intelligence Engines"
        title="Reality Capture & Computer Vision"
        description="Turn site photos, drone maps, laser scans and 360° walks into analyzable, queryable progress data — connected to the model, schedule and cost so capture stops being a data graveyard and becomes a living layer."
        accent={ACCENT_NAME}
        actions={
          <>
            <Badge variant="cyan" dot>
              CV models: 14
            </Badge>
            <button className="btn-ghost">
              <Upload className="h-4 w-4" /> Upload capture
            </button>
          </>
        }
      />

      {/* ===================================================== KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Captures processed"
          value={formatNumber(8740)}
          delta="12.6%"
          deltaPositive
          icon={ImageIcon}
          accent="cyan"
          sub="Photos, drone & 360° this month"
        />
        <StatTile
          label="Site coverage"
          value={formatPercent(coveragePct)}
          delta="4.2 pts"
          deltaPositive
          icon={MapPinned}
          accent="sky"
          sub={`${coveredCells} of ${HEAT.length} zones captured`}
        />
        <StatTile
          label="Progress verified"
          value="61%"
          delta="vs 76% claimed"
          deltaPositive={false}
          icon={CheckCircle2}
          accent="amber"
          sub="CV-verified vs reported"
        />
        <StatTile
          label="Defects detected"
          value={formatNumber(372)}
          delta="58"
          deltaPositive
          icon={ScanSearch}
          accent="rose"
          sub="Flagged by CV, last 30d"
        />
        <StatTile
          label="Point clouds registered"
          value={formatNumber(184)}
          delta="9.1%"
          deltaPositive
          icon={Boxes}
          accent="violet"
          sub="Aligned to BIM coordinate"
        />
      </section>

      {/* ===================================================== Progress verification */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Trust, but verify"
          title="Progress verification"
          description="Planned vs claimed vs computer-vision-verified completion — the gap between claimed and verified is where payment risk hides."
        />
        <Card>
          <CardHeader
            title="Planned vs claimed vs CV-verified progress"
            subtitle="Cumulative % complete, trailing 8 weeks"
            icon={TrendingUp}
            accent="cyan"
            action={<Badge variant="warn">{claimGap} pt claim gap</Badge>}
          />
          <div className="px-3 pb-5">
            <AreaTrend
              data={PROGRESS}
              xKey="week"
              series={[
                { key: 'planned', name: 'Planned', accent: 'sky' },
                { key: 'claimed', name: 'Claimed', accent: 'amber' },
                { key: 'verified', name: 'CV-verified', accent: 'cyan' },
              ]}
              valueFormatter={(v) => `${v}%`}
              height={300}
            />
          </div>
        </Card>
      </section>

      {/* ===================================================== Coverage + detections */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Site coverage heatmap"
            subtitle="Capture recency by zone across the site grid"
            icon={Grid3x3}
            accent="cyan"
          />
          <div className="px-5 pb-5">
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${HEAT_COLS}, minmax(0, 1fr))` }}
            >
              {HEAT.map((tone, i) => {
                const row = Math.floor(i / HEAT_COLS) + 1
                const col = (i % HEAT_COLS) + 1
                return (
                  <div
                    key={i}
                    title={`Zone ${String.fromCharCode(64 + col)}${row}`}
                    className={cn('aspect-square rounded-md ring-1 transition-transform hover:scale-105', HEAT_TONE[tone])}
                  />
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {HEAT_LEGEND.map((l) => (
                <span key={l.tone} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={cn('h-3 w-3 rounded ring-1', HEAT_TONE[l.tone])} />
                  {l.label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {HEAT_ROWS} levels × {HEAT_COLS} zones · {formatPercent(coveragePct)} captured in the current cycle.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Computer vision detections"
            subtitle="Objects & conditions classified across processed captures"
            icon={ScanSearch}
            accent="cyan"
            action={<Badge variant="cyan">avg conf. 0.91</Badge>}
          />
          <div className="px-3 pb-3">
            <BarSeries
              data={DETECTIONS}
              xKey="label"
              series={[{ key: 'count', name: 'Detections', accent: 'cyan' }]}
              layout="vertical"
              valueFormatter={(v) => formatNumber(v)}
              height={300}
            />
          </div>
          <p className="px-5 pb-5 text-xs text-slate-500">
            Counts above a 0.75 confidence threshold; low-confidence detections are queued for human review before
            they enter the lakehouse.
          </p>
        </Card>
      </section>

      {/* ===================================================== As-built deviations */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="As-built vs BIM"
          title="Detected deviations"
          description="Point-cloud-to-model comparison surfaces where the build diverges from design beyond tolerance."
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Ruler className="h-3.5 w-3.5" /> Millimetre comparison
            </span>
          }
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Element</th>
                  <th className="px-3 py-3 text-right font-medium">Deviation</th>
                  <th className="px-3 py-3 text-right font-medium">Tolerance</th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEVIATIONS.map((d, i) => (
                  <tr key={i} className="border-b border-edge/40 transition-colors last:border-0 hover:bg-elevated/40">
                    <td className="px-5 py-3.5 font-medium text-slate-100 data-mono">{d.location}</td>
                    <td className="px-3 py-3.5 text-slate-300">{d.element}</td>
                    <td
                      className={cn(
                        'px-3 py-3.5 text-right font-semibold data-mono',
                        d.deviation > d.tolerance ? 'text-rose-400' : 'text-slate-300',
                      )}
                    >
                      {d.deviation} mm
                    </td>
                    <td className="px-3 py-3.5 text-right text-slate-500 data-mono">±{d.tolerance} mm</td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge variant={DEV_BADGE[d.status]}>{d.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ===================================================== Capture timeline */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Ingest log"
          title="Capture timeline"
          description="Recent drone, 360° and LiDAR captures and their processing status."
        />
        <Card className="overflow-hidden">
          <div className="divide-y divide-edge/40">
            {CAPTURES.map((c) => {
              const meta = CAP_META[c.type]
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-elevated/40">
                  <IconBadge icon={meta.icon} accent={meta.accent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-100">{c.area}</span>
                      <Badge variant="neutral">{c.type}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="data-mono">{c.id}</span> · {c.date} · {formatBytes(c.bytes)}
                    </p>
                  </div>
                  {c.processed ? (
                    <Badge variant="success" dot>
                      Processed
                    </Badge>
                  ) : (
                    <Badge variant="warn" dot>
                      Processing
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      {/* ===================================================== AI capabilities */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Powered by AEC intelligence"
          title="What this engine automates"
          description="Captures connect to the model, schedule and cost so they remain queryable long after the drone lands."
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

      <div className="flex items-center gap-3 rounded-2xl border border-edge/60 bg-gradient-to-r from-cyan-500/10 via-surface/40 to-transparent p-5">
        <IconBadge icon={Layers} accent="cyan" />
        <p className="text-sm text-slate-300">
          Instead of terabytes of unsearchable imagery, every capture becomes a timestamped, georeferenced layer linked
          to BIM elements and schedule activities — a queryable record of reality, not a data graveyard.
        </p>
      </div>
    </div>
  )
}
