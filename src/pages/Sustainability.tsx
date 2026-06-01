import { useMemo, useState } from 'react'
import {
  Leaf,
  Factory,
  Gauge,
  TrendingDown,
  Building2,
  Target,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  Recycle,
} from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { BarSeries, Donut } from '@/components/charts'
import {
  computeCarbon,
  wholeLifeIntensity,
  carbonNarrative,
  tonnes,
  type MaterialInput,
  type Rating,
} from '@/lib/carbon'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import { ScrollableTable } from '@/components/ScrollableTable'
import type { KPI } from '@/lib/scenarios'
import { ExportMenu } from '@/components/ExportMenu'
import { CollabBar } from '@/components/CollabBar'
import { kpiToItem, type ReportSpec, type ReportTable } from '@/lib/report'

const ACCENT_NAME = 'emerald' as const
const PALETTE: Accent[] = ['rose', 'amber', 'violet', 'cyan', 'sky', 'emerald', 'teal', 'fuchsia']

/* A representative tower's material take-off — the editable carbon model. */
const seedLines = (): MaterialInput[] => [
  { id: 'concrete', name: 'In-situ concrete', quantity: 18_000, unit: 'm³', factor: 280, baselineFactor: 320 },
  { id: 'rebar', name: 'Reinforcement steel', quantity: 2_600, unit: 't', factor: 1_400, baselineFactor: 1_990 },
  { id: 'steel', name: 'Structural steel', quantity: 1_200, unit: 't', factor: 1_550, baselineFactor: 1_990 },
  { id: 'glazing', name: 'Glazing & façade', quantity: 9_500, unit: 'm²', factor: 220, baselineFactor: 300 },
  { id: 'mep', name: 'MEP systems', quantity: 24_000, unit: 'm²', factor: 38, baselineFactor: 45 },
  { id: 'finishes', name: 'Finishes', quantity: 24_000, unit: 'm²', factor: 28, baselineFactor: 34 },
  { id: 'insulation', name: 'Insulation', quantity: 24_000, unit: 'm²', factor: 9, baselineFactor: 14 },
]

const RATING: Record<Rating, { variant: 'success' | 'warn' | 'danger'; accent: Accent }> = {
  A: { variant: 'success', accent: 'emerald' },
  B: { variant: 'success', accent: 'lime' },
  C: { variant: 'warn', accent: 'amber' },
  D: { variant: 'danger', accent: 'rose' },
}

export default function Sustainability() {
  const [lines, setLines] = useState<MaterialInput[]>(seedLines)
  const [gfa, setGfa] = useState(24_000)
  const [benchmark, setBenchmark] = useState(500)
  const [operational, setOperational] = useState(18)
  const [studyPeriod, setStudyPeriod] = useState(60)
  const [edited, setEdited] = useState(false)

  const touch = () => setEdited(true)
  const set = (id: string, patch: Partial<MaterialInput>) => { setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))); touch() }
  const addRow = () => { setLines((ls) => [...ls, { id: `mat-${Math.floor(1000 + Math.random() * 9000)}`, name: 'New material', quantity: 1_000, unit: 'm²', factor: 50, baselineFactor: 60 }]); touch() }
  const removeRow = (id: string) => { setLines((ls) => ls.filter((l) => l.id !== id)); touch() }
  const reset = () => { setLines(seedLines()); setGfa(24_000); setBenchmark(500); setOperational(18); setStudyPeriod(60); setEdited(false) }
  const applySpec = (mode: 'conventional' | 'low') => {
    setLines((ls) => ls.map((l) => ({ ...l, factor: mode === 'conventional' ? l.baselineFactor : Math.round(l.baselineFactor * 0.6) })))
    touch()
  }

  const r = useMemo(() => computeCarbon(lines, { gfa, benchmark }), [lines, gfa, benchmark])
  const wholeLife = wholeLifeIntensity(r.intensity, operational, studyPeriod)
  const { scenarios, save, remove, importRaw } = useScenarios('sustainability')
  const summary: KPI[] = [
    { label: 'Carbon intensity', value: r.intensity },
    { label: 'Reduction vs baseline', value: r.savingPct, unit: '%' },
    { label: 'Embodied (tCO₂e)', value: Math.round(r.totalCarbon / 1000) },
    { label: 'Whole-life intensity', value: wholeLife },
  ]
  const reportTable: ReportTable = {
    title: 'Material take-off',
    columns: ['Material', 'Quantity', 'Factor (kgCO₂e/unit)', 'Carbon (tCO₂e)', 'Saving (tCO₂e)'],
    rows: r.lines.map((l) => [l.name, `${formatNumber(l.quantity)} ${l.unit}`, formatNumber(l.factor), Math.round(l.carbon / 1000), Math.round(l.saving / 1000)]),
  }
  const reportSpec: ReportSpec = {
    title: 'Sustainability & ESG',
    subtitle: `Embodied-carbon brief · rating ${r.rating} · ${gfa.toLocaleString()} m²`,
    module: 'sustainability',
    kpis: summary.map(kpiToItem),
    narrative: carbonNarrative(r),
    table: reportTable,
  }
  const accentFor = (id: string) => PALETTE[lines.findIndex((l) => l.id === id) % PALETTE.length]

  const compareData = r.lines.map((l) => ({ name: l.name.length > 16 ? l.name.slice(0, 15) + '…' : l.name, Specified: Math.round(l.carbon / 1000), Baseline: Math.round(l.baselineCarbon / 1000) }))
  const shareData = r.lines.filter((l) => l.carbon > 0).map((l) => ({ name: l.name, value: Math.round(l.carbon / 1000), accent: accentFor(l.id) }))

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Leaf}
        eyebrow="Intelligence"
        title="Sustainability & ESG"
        accent={ACCENT_NAME}
        description="A live embodied-carbon workbench. Edit the material take-off — quantities and EPD emission factors — or swap to a lower-carbon specification, and watch total carbon, intensity per m², the saving versus a conventional baseline and the rating band recompute. Real LCA math, not a static dashboard."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={RATING[r.rating].variant} dot>
              Rating {r.rating}
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            onImport={importRaw}
            module="sustainability"
            accent="emerald"
            scenarios={scenarios}
            onSave={(name) => save(name, { lines, gfa, benchmark, operational, studyPeriod }, summary)}
            onLoad={(s) => {
              const d = s.data as { lines?: typeof lines; gfa?: number; benchmark?: number; operational?: number; studyPeriod?: number }
              if (d.lines) setLines(d.lines)
              if (typeof d.gfa === 'number') setGfa(d.gfa)
              if (typeof d.benchmark === 'number') setBenchmark(d.benchmark)
              if (typeof d.operational === 'number') setOperational(d.operational)
              if (typeof d.studyPeriod === 'number') setStudyPeriod(d.studyPeriod)
              setEdited(true)
            }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent="emerald" spec={reportSpec} csv={reportTable} />
      </div>

      <CollabBar subject="sustainability" accent="emerald" />

      {/* KPIs — recompute as you edit */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Embodied carbon" value={tonnes(r.totalCarbon)} icon={Factory} accent="emerald" sub="Upfront A1–A3 total" />
        <StatTile label="Carbon intensity" value={`${formatNumber(r.intensity)}`} icon={Gauge} accent={r.overBenchmark ? 'rose' : 'emerald'} sub="kgCO₂e/m²" />
        <StatTile label="vs benchmark" value={`${r.overBenchmark ? '+' : '−'}${Math.abs(r.intensity - r.benchmark)}`} icon={Target} accent={r.overBenchmark ? 'rose' : 'emerald'} sub={`${benchmark} kgCO₂e/m² target`} />
        <StatTile label="Reduction vs baseline" value={`${r.savingPct}%`} icon={TrendingDown} accent={r.savingPct > 0 ? 'emerald' : 'amber'} sub={`${tonnes(r.saving)} saved`} />
        <StatTile label="Whole-life intensity" value={formatNumber(wholeLife)} icon={Building2} accent="teal" sub={`+${operational}×${studyPeriod}yr operational`} />
      </div>

      {/* model parameters + spec presets */}
      <Card>
        <CardHeader
          icon={Target}
          accent={ACCENT_NAME}
          title="Model parameters & specification"
          subtitle="Set GFA and the benchmark, tune the operational profile, or apply a specification to every material at once"
          action={
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => applySpec('low')} className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/40 transition-colors hover:bg-emerald-500/15">Low-carbon spec</button>
              <button onClick={() => applySpec('conventional')} className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-edge/60 transition-colors hover:bg-elevated/50 hover:text-slate-200">Conventional spec</button>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-5 border-t border-edge/50 p-5 sm:grid-cols-4">
          <Param label="GFA" unit="m²" value={gfa} step={1000} onChange={(v) => { setGfa(Math.max(0, v)); touch() }} />
          <Param label="Benchmark" unit="kgCO₂e/m²" value={benchmark} step={25} onChange={(v) => { setBenchmark(Math.max(0, v)); touch() }} />
          <Param label="Operational" unit="kgCO₂e/m²/yr" value={operational} step={1} onChange={(v) => { setOperational(Math.max(0, v)); touch() }} />
          <Param label="Study period" unit="years" value={studyPeriod} step={5} onChange={(v) => { setStudyPeriod(Math.max(0, v)); touch() }} />
        </div>
      </Card>

      {/* editable take-off */}
      <Card>
        <CardHeader
          icon={Leaf}
          accent={ACCENT_NAME}
          title="Material take-off — editable"
          subtitle="Click any quantity or emission factor to edit; carbon, share and saving recompute live"
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add material
            </button>
          }
        />
        <ScrollableTable label="Material take-off" className="border-t border-edge/50">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Material</th>
                <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                <th className="px-3 py-2.5 text-right font-medium">Factor (kgCO₂e/unit)</th>
                <th className="px-3 py-2.5 text-right font-medium">Baseline</th>
                <th className="px-3 py-2.5 text-right font-medium">Carbon</th>
                <th className="px-3 py-2.5 font-medium">Share</th>
                <th className="px-3 py-2.5 text-right font-medium">Saving</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {r.lines.map((l) => (
                <tr key={l.id} className="hover:bg-elevated/30">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', ACCENT[accentFor(l.id)].dot)} />
                      <input value={l.name} aria-label="Material name" onChange={(e) => set(l.id, { name: e.target.value })} className="w-40 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <NumCell value={l.quantity} onChange={(v) => set(l.id, { quantity: Math.max(0, v) })} />
                      <input value={l.unit} aria-label="Unit" onChange={(e) => set(l.id, { unit: e.target.value })} className="w-9 rounded bg-transparent text-[11px] text-slate-500 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <NumCell value={l.factor} onChange={(v) => set(l.id, { factor: Math.max(0, v) })} tone={l.factor < l.baselineFactor ? 'good' : undefined} />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 data-mono">{formatNumber(l.baselineFactor)}</td>
                  <td className="px-3 py-2 text-right text-slate-200 data-mono">{tonnes(l.carbon)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <ProgressBar value={l.share} accent={accentFor(l.id)} height="sm" className="w-16" />
                      <span className="w-10 text-xs text-slate-400 data-mono">{l.share}%</span>
                    </div>
                  </td>
                  <td className={cn('px-3 py-2 text-right data-mono', l.saving > 0 ? 'text-emerald-300' : l.saving < 0 ? 'text-rose-300' : 'text-slate-500')}>
                    {l.saving !== 0 ? tonnes(l.saving) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => removeRow(l.id)} aria-label={`Remove ${l.name}`} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* charts driven by the live model */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={TrendingDown} accent={ACCENT_NAME} title="Specified vs baseline carbon" subtitle="Per material (tCO₂e) — the gap is the saving from a lower-carbon spec" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries
              data={compareData}
              xKey="name"
              layout="vertical"
              height={320}
              series={[{ key: 'Baseline', name: 'Conventional baseline', accent: 'rose' }, { key: 'Specified', name: 'Specified', accent: 'emerald' }]}
              valueFormatter={(v) => `${formatNumber(v)} tCO₂e`}
            />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader icon={Recycle} accent={ACCENT_NAME} title="Footprint share" subtitle="Where the carbon sits (tCO₂e)" />
          <div className="px-5 pb-3 pt-2">
            <Donut data={shareData} valueFormatter={(v) => `${formatNumber(v)} tCO₂e`} />
          </div>
          <div className="space-y-1 px-5 pb-5">
            {r.lines.filter((l) => l.carbon > 0).sort((a, b) => b.share - a.share).slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center gap-2.5 text-sm">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT[accentFor(l.id)].dot)} />
                <span className="truncate text-slate-300">{l.name}</span>
                <span className="ml-auto shrink-0 text-slate-400 data-mono">{l.share}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACCENT_NAME} title="Carbon read-out" subtitle="Computed from your current take-off" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{carbonNarrative(r)}</p>
          <p className="text-sm leading-relaxed text-slate-400">
            Including {operational} kgCO₂e/m²/yr of operational carbon over a {studyPeriod}-year study period, whole-life intensity is{' '}
            <span className="font-semibold text-slate-200">{formatNumber(wholeLife)} kgCO₂e/m²</span>.
            {r.overBenchmark ? (
              <> The model is <span className="text-rose-300">{r.intensity - r.benchmark} kgCO₂e/m² over</span> the {benchmark} benchmark — try the low-carbon spec or reduce the concrete and steel factors.</>
            ) : (
              <> The model is <span className="text-emerald-300">within</span> the {benchmark} kgCO₂e/m² benchmark.</>
            )}
          </p>
        </div>
      </Card>
    </div>
  )
}

/* A labelled, controlled numeric parameter input. */
function Param({ label, unit, value, onChange, step = 1 }: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n) }}
        className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-3 py-1.5 text-sm text-slate-100 data-mono focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
      />
    </label>
  )
}

/* Inline-editable numeric cell — shows formatted value, edits the raw number. */
function NumCell({ value, onChange, tone }: { value: number; onChange: (v: number) => void; tone?: 'good' | 'bad' }) {
  const [editing, setEditing] = useState(false)
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-300'
  return editing ? (
    <input
      autoFocus
      type="number"
      defaultValue={value}
      onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
      className="w-24 rounded border border-emerald-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
    />
  ) : (
    <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', toneClass)} title="Click to edit">
      {formatNumber(value)}
    </button>
  )
}
