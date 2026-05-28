import { useMemo, useState } from 'react'
import {
  Leaf,
  FileText,
  Factory,
  Zap,
  Recycle,
  Droplets,
  Layers,
  Gauge,
  Target,
  TrendingDown,
  Building2,
  ShieldCheck,
  Sparkles,
  ClipboardCheck,
  Scale,
  Boxes,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  StatTile,
  Badge,
  ProgressBar,
  RingProgress,
  SectionHeading,
  FeatureRow,
  Tabs,
} from '@/components/ui'
import { BarSeries, AreaTrend, LineTrend, Donut } from '@/components/charts'
import { PROJECTS } from '@/data/platform'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber, formatPercent } from '@/lib/format'

const ACCENT_NAME = 'emerald' as const
const CARBON_BENCHMARK = 500 // kgCO2e/m² portfolio target

/* ----------------------------------------------------------- derived metrics */
const avgCarbon = PROJECTS.reduce((s, p) => s + p.carbon, 0) / PROJECTS.length
const overBenchmark = PROJECTS.filter((p) => p.carbon > CARBON_BENCHMARK)

/* ---------------------------------------------- embodied carbon by material */
type MaterialRow = { material: string; carbon: number; accent: Accent }
const MATERIALS: MaterialRow[] = [
  { material: 'Concrete', carbon: 214, accent: 'rose' },
  { material: 'Steel', carbon: 168, accent: 'amber' },
  { material: 'Glazing & Façade', carbon: 74, accent: 'cyan' },
  { material: 'MEP Systems', carbon: 58, accent: 'violet' },
  { material: 'Finishes', carbon: 41, accent: 'sky' },
  { material: 'Insulation', carbon: 19, accent: 'emerald' },
]

/* --------------------------------------------- whole-life carbon by stage */
type StageRow = { name: string; value: number; accent: Accent }
const LIFECYCLE_STAGES: StageRow[] = [
  { name: 'A1–A3 Product', value: 318, accent: 'emerald' },
  { name: 'A4–A5 Construction', value: 64, accent: 'teal' },
  { name: 'B1–B7 Use', value: 142, accent: 'sky' },
  { name: 'C1–C4 End-of-life', value: 38, accent: 'amber' },
]

/* ------------------------------------------------ carbon intensity by project */
const projectCarbon = [...PROJECTS]
  .sort((a, b) => b.carbon - a.carbon)
  .map((p) => ({ name: p.name, carbon: p.carbon }))

/* --------------------------------------------------------- net-zero pathway */
type PathwayRow = { year: string; trajectory: number; target: number }
const PATHWAY_YEARS = [2026, 2030, 2035, 2040, 2045, 2050]
const pathway: PathwayRow[] = PATHWAY_YEARS.map((year, i) => {
  // Linear target glide to net-zero by 2050; trajectory lags target slightly.
  const t = i / (PATHWAY_YEARS.length - 1)
  const target = Math.round(avgCarbon * (1 - t))
  const trajectory = Math.round(avgCarbon * (1 - t * 0.82))
  return { year: String(year), trajectory, target }
})

/* ------------------------------------------------------ operational profile */
const OPERATIONAL_TREND = [
  { year: '2021', eui: 142, carbon: 41 },
  { year: '2022', eui: 134, carbon: 37 },
  { year: '2023', eui: 121, carbon: 32 },
  { year: '2024', eui: 109, carbon: 27 },
  { year: '2025', eui: 98, carbon: 22 },
  { year: '2026', eui: 89, carbon: 18 },
]

/* ----------------------------------------------------------- ESG scorecard */
type ESGRow = { label: string; score: number; accent: Accent; note: string }
const ESG: ESGRow[] = [
  { label: 'Environmental', score: 82, accent: 'emerald', note: 'Carbon, energy, water & circularity tracked against science-based targets across the portfolio.' },
  { label: 'Social', score: 74, accent: 'cyan', note: 'Workforce safety, fair-labor supply chains and community impact captured from field & procurement data.' },
  { label: 'Governance', score: 88, accent: 'teal', note: 'Disclosure controls, data lineage and assurance-grade audit trails aligned to CSRD & TCFD.' },
]

/* ----------------------------------------------------- EPD coverage detail */
type EpdRow = { source: string; records: string; comparable: number; quality: number; status: 'Normalized' | 'In review' | 'Flagged' }
const EPD_SOURCES: EpdRow[] = [
  { source: 'Manufacturer EPDs (Type III)', records: '184,200', comparable: 71, quality: 94, status: 'Normalized' },
  { source: 'Industry-average datasets', records: '96,400', comparable: 88, quality: 91, status: 'Normalized' },
  { source: 'Generic / proxy factors', records: '61,800', comparable: 64, quality: 82, status: 'In review' },
  { source: 'Self-declared (Type II)', records: '38,900', comparable: 39, quality: 67, status: 'Flagged' },
  { source: 'Regional LCA databases', records: '28,700', comparable: 79, quality: 88, status: 'Normalized' },
]

/* ------------------------------------------------------------- AI features */
const AI_FEATURES: { icon: typeof Leaf; title: string; body: string; accent: Accent }[] = [
  { icon: TrendingDown, title: 'Carbon optimization', body: 'Recommends lower-carbon material substitutions and mix designs while holding cost and performance constraints.', accent: 'emerald' },
  { icon: Scale, title: 'Lifecycle cost analysis', body: 'Couples embodied & operational carbon with whole-life cost to surface the true net-present trade-offs.', accent: 'teal' },
  { icon: ClipboardCheck, title: 'ESG reporting', body: 'Auto-generates assurance-ready CSRD, GRESB and TCFD disclosures straight from governed source data.', accent: 'sky' },
  { icon: Boxes, title: 'Material impact comparison', body: 'Normalizes non-comparable EPDs to a common functional unit so products can finally be ranked like-for-like.', accent: 'cyan' },
]

const STAGE_TABS = [
  { id: 'material', label: 'By material' },
  { id: 'stage', label: 'By lifecycle stage' },
]

/* ----------------------------------------------------------------- styling */
function carbonTone(v: number): string {
  if (v > 700) return 'text-rose-400'
  if (v > CARBON_BENCHMARK) return 'text-amber-400'
  return 'text-emerald-400'
}
function carbonBadge(v: number): 'success' | 'warn' | 'danger' {
  if (v > 700) return 'danger'
  if (v > CARBON_BENCHMARK) return 'warn'
  return 'success'
}
function epdVariant(s: EpdRow['status']): 'success' | 'warn' | 'danger' {
  if (s === 'Normalized') return 'success'
  if (s === 'In review') return 'warn'
  return 'danger'
}

export default function Sustainability() {
  const [breakdown, setBreakdown] = useState<string>('material')

  const totalLifecycle = useMemo(
    () => LIFECYCLE_STAGES.reduce((s, x) => s + x.value, 0),
    [],
  )

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Leaf}
        eyebrow="Intelligence Engines"
        title="Sustainability & ESG"
        description="Embodied and operational carbon, energy, waste, water and whole-life analysis — computed on normalized, quality-scored EPD data so material and design choices can finally be compared like-for-like."
        accent={ACCENT_NAME}
        actions={
          <>
            <Badge variant="success" dot>
              Net-zero 2050
            </Badge>
            <button className="btn-ghost">
              <FileText className="h-4 w-4" /> Generate ESG report
            </button>
          </>
        }
      />

      {/* ===================================================== KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Embodied carbon"
          value={`${formatNumber(avgCarbon, { digits: 0 })}`}
          delta="6.4%"
          deltaPositive
          icon={Factory}
          accent="emerald"
          sub="kgCO₂e/m² · portfolio average"
        />
        <StatTile
          label="Operational carbon"
          value="18"
          delta="3.1%"
          deltaPositive
          icon={Building2}
          accent="teal"
          sub="kgCO₂e/m²/yr in-use"
        />
        <StatTile
          label="Energy use intensity"
          value="89"
          delta="8.2%"
          deltaPositive
          icon={Zap}
          accent="amber"
          sub="kWh/m²/yr · benchmarked"
        />
        <StatTile
          label="Waste diversion"
          value="87.4%"
          delta="4.0 pts"
          deltaPositive
          icon={Recycle}
          accent="sky"
          sub="Diverted from landfill"
        />
        <StatTile
          label="Recycled content"
          value="34.2%"
          delta="2.6 pts"
          deltaPositive
          icon={Droplets}
          accent="cyan"
          sub="By material mass"
        />
      </section>

      {/* ===================================================== Carbon breakdown */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Embodied carbon breakdown"
            subtitle="kgCO₂e/m² — concrete and steel dominate the upfront footprint"
            icon={Layers}
            accent="emerald"
            action={<Tabs tabs={STAGE_TABS} active={breakdown} onChange={setBreakdown} />}
          />
          <div className="px-3 pb-5">
            {breakdown === 'material' ? (
              <BarSeries
                data={MATERIALS}
                xKey="material"
                series={[{ key: 'carbon', name: 'Embodied carbon', accent: 'emerald' }]}
                layout="vertical"
                height={300}
                valueFormatter={(v) => `${formatNumber(v)} kgCO₂e/m²`}
              />
            ) : (
              <BarSeries
                data={LIFECYCLE_STAGES}
                xKey="name"
                series={[{ key: 'value', name: 'Whole-life carbon', accent: 'teal' }]}
                layout="vertical"
                height={300}
                valueFormatter={(v) => `${formatNumber(v)} kgCO₂e/m²`}
              />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Whole-life carbon by stage"
            subtitle={`${formatNumber(totalLifecycle)} kgCO₂e/m² across RICS stages`}
            icon={Gauge}
            accent="teal"
          />
          <div className="px-5 pb-2">
            <Donut
              data={LIFECYCLE_STAGES}
              valueFormatter={(v) => `${formatNumber(v)} kgCO₂e/m²`}
            />
          </div>
          <div className="space-y-1 px-5 pb-5">
            {LIFECYCLE_STAGES.map((s) => (
              <div key={s.name} className="flex items-center gap-2.5 text-sm">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT[s.accent].dot)} />
                <span className="truncate text-slate-300">{s.name}</span>
                <span className="ml-auto shrink-0 text-slate-400 data-mono">
                  {formatPercent((s.value / totalLifecycle) * 100)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ===================================================== Carbon by project */}
      <section>
        <Card>
          <CardHeader
            title="Carbon intensity by project"
            subtitle={`kgCO₂e/m² vs ${CARBON_BENCHMARK} target — ${overBenchmark.length} of ${PROJECTS.length} projects exceed benchmark`}
            icon={Factory}
            accent="emerald"
            action={<Badge variant="danger">{overBenchmark.length} over target</Badge>}
          />
          <div className="px-3 pb-5">
            <BarSeries
              data={projectCarbon}
              xKey="name"
              series={[{ key: 'carbon', name: 'Carbon intensity', accent: 'emerald' }]}
              height={300}
              valueFormatter={(v) => `${formatNumber(v)} kgCO₂e/m²`}
            />
          </div>
          <div className="grid gap-x-6 gap-y-2 border-t border-edge/50 px-5 py-4 sm:grid-cols-2">
            {projectCarbon.slice(0, 6).map((p) => (
              <div key={p.name} className="flex items-center gap-2.5 text-sm">
                <Badge variant={carbonBadge(p.carbon)}>{p.carbon > CARBON_BENCHMARK ? 'Over' : 'On target'}</Badge>
                <span className="truncate text-slate-300">{p.name}</span>
                <span className={cn('ml-auto shrink-0 font-semibold data-mono', carbonTone(p.carbon))}>
                  {p.carbon}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ===================================================== ESG + pathway */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="ESG scorecard"
            subtitle="Composite scores against science-based targets"
            icon={ShieldCheck}
            accent="teal"
          />
          <div className="space-y-5 px-5 pb-5">
            {ESG.map((e) => (
              <div key={e.label} className="flex items-start gap-4">
                <RingProgress value={e.score} accent={e.accent} size={68} />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100">{e.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{e.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Pathway to net-zero"
            subtitle="Current decarbonization trajectory vs target glidepath (kgCO₂e/m²)"
            icon={Target}
            accent="emerald"
            action={
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                <TrendingDown className="h-3 w-3" /> 18% gap to 2050
              </span>
            }
          />
          <div className="px-3 pb-5">
            <LineTrend
              data={pathway}
              xKey="year"
              series={[
                { key: 'trajectory', name: 'Current trajectory', accent: 'emerald' },
                { key: 'target', name: 'Target reduction', accent: 'teal' },
              ]}
              dashedKeys={['target']}
              height={300}
              valueFormatter={(v) => `${formatNumber(v)} kgCO₂e/m²`}
            />
          </div>
        </Card>
      </section>

      {/* ===================================================== Operational trend */}
      <section>
        <Card>
          <CardHeader
            title="Operational performance trend"
            subtitle="Energy use intensity (kWh/m²/yr) and in-use carbon (kgCO₂e/m²/yr), 6-year trailing"
            icon={Zap}
            accent="amber"
          />
          <div className="px-3 pb-5">
            <AreaTrend
              data={OPERATIONAL_TREND}
              xKey="year"
              series={[
                { key: 'eui', name: 'Energy use intensity', accent: 'amber' },
                { key: 'carbon', name: 'Operational carbon', accent: 'teal' },
              ]}
              height={280}
              referenceY={{ y: 75, label: 'EUI target 75' }}
            />
          </div>
        </Card>
      </section>

      {/* ===================================================== EPD data quality */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Data quality"
          title="EPD normalization & coverage"
          description="Most published EPDs are not directly comparable — different functional units, scopes and reference periods. Every factor is normalized and quality-scored before it ever reaches a calculation."
          action={
            <div className="flex items-center gap-3 rounded-xl border border-edge/70 bg-elevated/40 px-4 py-2">
              <div className="text-right">
                <div className="text-lg font-semibold text-slate-50 data-mono">96.8%</div>
                <div className="text-xs text-slate-500">Carbon data coverage</div>
              </div>
              <RingProgress value={97} accent="emerald" size={52} stroke={6} />
            </div>
          }
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">EPD source</th>
                  <th className="px-3 py-3 text-right font-medium">Records</th>
                  <th className="px-3 py-3 font-medium">Comparability</th>
                  <th className="px-3 py-3 text-right font-medium">Quality</th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {EPD_SOURCES.map((e) => (
                  <tr
                    key={e.source}
                    className="border-b border-edge/40 transition-colors last:border-0 hover:bg-elevated/40"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-100">{e.source}</td>
                    <td className="px-3 py-3.5 text-right text-slate-300 data-mono">{e.records}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={e.comparable} accent="emerald" height="sm" />
                        <span className="w-9 shrink-0 text-right text-xs text-slate-400 data-mono">
                          {e.comparable}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right text-slate-200 data-mono">{e.quality}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge variant={epdVariant(e.status)}>{e.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ===================================================== AI capabilities */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="AI capabilities"
          title="What the engine automates"
          description="Models trained on normalized lifecycle data turn fragmented EPDs and meter readings into actionable, comparable sustainability intelligence."
        />
        <Card className="p-6">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {AI_FEATURES.map((f) => (
              <FeatureRow key={f.title} icon={f.icon} title={f.title} accent={f.accent}>
                {f.body}
              </FeatureRow>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-edge/50 pt-5 text-xs text-slate-500">
            <Sparkles className={cn('h-3.5 w-3.5', ACCENT.emerald.text)} />
            Recommendations are explainable and traceable to the underlying governed EPD and meter records.
          </div>
        </Card>
      </section>
    </div>
  )
}
