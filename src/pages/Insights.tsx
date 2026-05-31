import { useMemo, useState } from 'react'
import {
  Gauge,
  Wallet,
  TrendingDown,
  ShieldAlert,
  Target,
  AlertTriangle,
  Activity,
  Radar as RadarIcon,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { RadarViz, BarSeries } from '@/components/charts'
import { PROJECTS } from '@/data/platform'
import {
  scorePortfolio,
  dimensionAverages,
  normalizeWeights,
  portfolioNarrative,
  formatMoney,
  DEFAULT_WEIGHTS,
  type ProjectInput,
  type Weights,
  type Status,
} from '@/lib/portfolio'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import type { KPI } from '@/lib/scenarios'
import { ExportMenu } from '@/components/ExportMenu'
import { kpiToItem, type ReportSpec, type ReportTable } from '@/lib/report'

const ACCENT_NAME = 'cyan' as const

const seed = (): ProjectInput[] =>
  PROJECTS.map((p) => ({
    id: p.id,
    name: p.name,
    sector: p.sector,
    value: p.value,
    costVariance: p.costVariance,
    scheduleSlip: p.scheduleVariance,
    risk: p.risk,
    safety: p.safety,
    quality: p.quality,
    carbon: p.carbon,
  }))

const STATUS_META: Record<Status, { label: string; variant: 'success' | 'warn' | 'danger' }> = {
  healthy: { label: 'On track', variant: 'success' },
  watch: { label: 'Watch', variant: 'warn' },
  'at-risk': { label: 'At risk', variant: 'danger' },
}

const PRESETS: { id: string; label: string; weights: Weights }[] = [
  { id: 'balanced', label: 'Balanced', weights: DEFAULT_WEIGHTS },
  { id: 'cost', label: 'Cost-focused', weights: { cost: 0.4, schedule: 0.25, risk: 0.15, safety: 0.1, quality: 0.05, carbon: 0.05 } },
  { id: 'risk', label: 'Risk-averse', weights: { cost: 0.15, schedule: 0.15, risk: 0.3, safety: 0.25, quality: 0.1, carbon: 0.05 } },
  { id: 'esg', label: 'ESG-led', weights: { cost: 0.1, schedule: 0.1, risk: 0.1, safety: 0.2, quality: 0.15, carbon: 0.35 } },
]
const sameW = (a: Weights, b: Weights) => (['cost', 'schedule', 'risk', 'safety', 'quality', 'carbon'] as const).every((k) => a[k] === b[k])

const TARGET: Record<string, number> = { Cost: 85, Schedule: 85, Risk: 80, Safety: 95, Quality: 90, Carbon: 80 }
const healthAccent = (h: number) => (h >= 75 ? 'emerald' : h >= 55 ? 'amber' : 'rose')

export default function Insights() {
  const [rows, setRows] = useState<ProjectInput[]>(seed)
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [edited, setEdited] = useState(false)

  const touch = () => setEdited(true)
  const set = (id: string, patch: Partial<ProjectInput>) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); touch() }
  const setWeight = (k: keyof Weights, v: number) => { setWeights((w) => ({ ...w, [k]: v })); touch() }
  const addRow = () => { setRows((rs) => [...rs, { id: `PRJ-${Math.floor(1000 + Math.random() * 9000)}`, name: 'New project', sector: 'Commercial', value: 200_000_000, costVariance: 0, scheduleSlip: 0, risk: 40, safety: 90, quality: 88, carbon: 450 }]); touch() }
  const removeRow = (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); touch() }
  const reset = () => { setRows(seed()); setWeights(DEFAULT_WEIGHTS); setEdited(false) }

  const pf = useMemo(() => scorePortfolio(rows, weights), [rows, weights])
  const { scenarios, save, remove } = useScenarios('insights')
  const summary: KPI[] = [
    { label: 'Portfolio health', value: pf.health },
    { label: 'Value at risk', value: pf.exposure, unit: '$' },
    { label: 'At-risk projects', value: pf.atRisk },
    { label: 'Wtd cost variance', value: pf.wtdCostVariance, unit: '%' },
  ]
  const reportTable: ReportTable = {
    title: 'Project watchlist (worst-first)',
    columns: ['Project', 'Sector', 'Value', 'Health', 'Exposure', 'Status'],
    rows: pf.watchlist.map((p) => [p.name, p.sector, formatMoney(p.value), p.health, formatMoney(p.exposure), STATUS_META[p.status].label]),
  }
  const reportSpec: ReportSpec = {
    title: 'Executive Insights',
    subtitle: `Portfolio decision brief · ${pf.projects.length} projects`,
    module: 'insights',
    kpis: summary.map(kpiToItem),
    narrative: portfolioNarrative(pf),
    table: reportTable,
  }
  const normW = normalizeWeights(weights)
  const activePreset = PRESETS.find((p) => sameW(normalizeWeights(p.weights), normW))?.id

  const radarData = useMemo(() => {
    const a = dimensionAverages(rows)
    return [
      { metric: 'Cost', score: a.cost, target: TARGET.Cost },
      { metric: 'Schedule', score: a.schedule, target: TARGET.Schedule },
      { metric: 'Risk', score: a.risk, target: TARGET.Risk },
      { metric: 'Safety', score: a.safety, target: TARGET.Safety },
      { metric: 'Quality', score: a.quality, target: TARGET.Quality },
      { metric: 'Carbon', score: a.carbon, target: TARGET.Carbon },
    ]
  }, [rows])
  const exposureData = pf.watchlist.slice(0, 8).map((p) => ({ name: p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name, exposure: Math.round(p.exposure / 1e6) }))
  const atRiskList = pf.watchlist.filter((p) => p.status === 'at-risk')

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Gauge}
        eyebrow="Core"
        title="Executive Insights"
        accent={ACCENT_NAME}
        description="A live portfolio decision console. Weight the dimensions that matter to your board — cost, schedule, risk, safety, quality, carbon — and edit any project's metrics. The composite portfolio-health score, the dollar value at risk and the worst-first watchlist re-rank instantly. Your risk appetite, made computable."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={pf.health >= 75 ? 'success' : pf.health >= 55 ? 'warn' : 'danger'} dot>
              Health {pf.health}
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            accent="cyan"
            scenarios={scenarios}
            onSave={(name) => save(name, { rows, weights }, summary)}
            onLoad={(s) => { const d = s.data as { rows?: typeof rows; weights?: typeof weights }; if (d.rows) setRows(d.rows); if (d.weights) setWeights(d.weights); setEdited(true) }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent="cyan" spec={reportSpec} csv={reportTable} />
      </div>

      {/* KPIs — recompute as you weight & edit */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Portfolio health" value={`${pf.health}`} icon={Gauge} accent={healthAccent(pf.health)} sub={`${formatMoney(pf.totalValue)} · ${pf.projects.length} projects`} />
        <StatTile label="Value at risk" value={formatMoney(pf.exposure)} icon={ShieldAlert} accent="rose" sub="Exposure-weighted by health" />
        <StatTile label="At-risk projects" value={`${pf.atRisk}`} icon={AlertTriangle} accent="rose" sub="Health below 55" />
        <StatTile label="Wtd cost variance" value={`${pf.wtdCostVariance > 0 ? '+' : ''}${pf.wtdCostVariance}%`} icon={TrendingDown} accent={pf.wtdCostVariance > 4 ? 'rose' : 'amber'} sub="Value-weighted vs budget" />
        <StatTile label="On track" value={`${Math.round((pf.onTrack / Math.max(1, pf.projects.length)) * 100)}%`} icon={Target} accent="emerald" sub={`${pf.onTrack} of ${pf.projects.length} healthy`} />
      </div>

      {/* weighting controls — the board's risk appetite */}
      <Card>
        <CardHeader
          icon={SlidersHorizontal}
          accent={ACCENT_NAME}
          title="Decision weighting — your risk appetite"
          subtitle="Weight what health means to your board, or pick a stance. Health, exposure and the watchlist re-rank live."
          action={
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setWeights(p.weights); touch() }}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    activePreset === p.id ? 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <WeightSlider label="Cost" value={weights.cost} pct={normW.cost} onChange={(v) => setWeight('cost', v)} />
          <WeightSlider label="Schedule" value={weights.schedule} pct={normW.schedule} onChange={(v) => setWeight('schedule', v)} />
          <WeightSlider label="Risk" value={weights.risk} pct={normW.risk} onChange={(v) => setWeight('risk', v)} />
          <WeightSlider label="Safety" value={weights.safety} pct={normW.safety} onChange={(v) => setWeight('safety', v)} />
          <WeightSlider label="Quality" value={weights.quality} pct={normW.quality} onChange={(v) => setWeight('quality', v)} />
          <WeightSlider label="Carbon" value={weights.carbon} pct={normW.carbon} onChange={(v) => setWeight('carbon', v)} />
        </div>
      </Card>

      {/* editable, ranked watchlist */}
      <Card>
        <CardHeader
          icon={Activity}
          accent={ACCENT_NAME}
          title="Project watchlist — editable, worst-first"
          subtitle="Edit any metric; health, status and exposure recompute and the list re-ranks under your weighting."
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add project
            </button>
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[1140px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 text-right font-medium">Value</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost %</th>
                <th className="px-3 py-2.5 text-right font-medium">Slip (d)</th>
                <th className="px-3 py-2.5 text-right font-medium">Risk</th>
                <th className="px-3 py-2.5 text-right font-medium">Safety</th>
                <th className="px-3 py-2.5 text-right font-medium">Quality</th>
                <th className="px-3 py-2.5 text-right font-medium">Carbon</th>
                <th className="px-3 py-2.5 font-medium">Health</th>
                <th className="px-3 py-2.5 text-right font-medium">Exposure</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {pf.watchlist.map((p) => {
                const st = STATUS_META[p.status]
                return (
                  <tr key={p.id} className="hover:bg-elevated/30">
                    <td className="px-4 py-2">
                      <input value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} className="w-40 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-cyan-500/40" />
                      <div className="text-[10px] text-slate-600">{p.sector}</div>
                    </td>
                    <NumCell value={p.value} onChange={(v) => set(p.id, { value: Math.max(0, v) })} fmt={(v) => formatMoney(v)} />
                    <NumCell value={p.costVariance} onChange={(v) => set(p.id, { costVariance: v })} fmt={(v) => `${v > 0 ? '+' : ''}${v}`} tone={p.costVariance > 4 ? 'bad' : p.costVariance <= 0 ? 'good' : undefined} />
                    <NumCell value={p.scheduleSlip} onChange={(v) => set(p.id, { scheduleSlip: v })} fmt={(v) => `${v > 0 ? '+' : ''}${v}`} tone={p.scheduleSlip > 14 ? 'bad' : p.scheduleSlip <= 0 ? 'good' : undefined} />
                    <NumCell value={p.risk} onChange={(v) => set(p.id, { risk: Math.max(0, Math.min(100, v)) })} tone={p.risk >= 70 ? 'bad' : p.risk < 45 ? 'good' : undefined} />
                    <NumCell value={p.safety} onChange={(v) => set(p.id, { safety: Math.max(0, Math.min(100, v)) })} />
                    <NumCell value={p.quality} onChange={(v) => set(p.id, { quality: Math.max(0, Math.min(100, v)) })} />
                    <NumCell value={p.carbon} onChange={(v) => set(p.id, { carbon: Math.max(0, v) })} tone={p.carbon > 600 ? 'bad' : p.carbon <= 400 ? 'good' : undefined} />
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={p.health} accent={healthAccent(p.health)} height="sm" className="w-14" />
                        <span className="w-7 text-sm font-semibold text-slate-100 data-mono">{p.health}</span>
                      </div>
                    </td>
                    <td className={cn('px-3 py-2 text-right data-mono', p.exposure > p.value * 0.4 ? 'text-rose-300' : 'text-slate-300')}>{formatMoney(p.exposure)}</td>
                    <td className="px-3 py-2 text-center"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeRow(p.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* charts driven by the live portfolio */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={ShieldAlert} accent="rose" title="Value at risk by project" subtitle="Exposure ($M) — where capital is most threatened" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries data={exposureData} xKey="name" layout="vertical" height={320} series={[{ key: 'exposure', name: 'Exposure', accent: 'rose' }]} valueFormatter={(v) => `$${formatNumber(v)}M`} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader icon={RadarIcon} accent="violet" title="Portfolio scorecard" subtitle="Dimension averages vs board target" />
          <div className="px-3 pb-5 pt-2">
            <RadarViz data={radarData} series={[{ key: 'score', name: 'Portfolio', accent: 'cyan' }, { key: 'target', name: 'Target', accent: 'violet' }]} height={300} />
          </div>
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACCENT_NAME} title="Board read-out" subtitle="Computed from your current weighting & metrics" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{portfolioNarrative(pf)}</p>
          {atRiskList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {atRiskList.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {p.name} · health {p.health} · {formatMoney(p.exposure)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* A decision-weight slider 0–100% (stored 0–1), showing the normalized share. */
function WeightSlider({ label, value, pct, onChange }: { label: string; value: number; pct: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-xs font-semibold text-cyan-300 data-mono">{Math.round(pct * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-cyan-500" />
    </div>
  )
}

/* Inline-editable numeric cell. */
function NumCell({ value, onChange, fmt, tone }: { value: number; onChange: (v: number) => void; fmt?: (v: number) => string; tone?: 'good' | 'bad' }) {
  const [editing, setEditing] = useState(false)
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-300'
  return (
    <td className="px-3 py-2 text-right">
      {editing ? (
        <input
          autoFocus
          type="number"
          step="any"
          defaultValue={value}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-24 rounded border border-cyan-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', toneClass)} title="Click to edit">
          {fmt ? fmt(value) : formatNumber(value)}
        </button>
      )}
    </td>
  )
}
