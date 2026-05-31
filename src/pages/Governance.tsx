import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  Database,
  Gauge,
  EyeOff,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  SlidersHorizontal,
  Radar as RadarIcon,
} from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { RadarViz, ScatterViz } from '@/components/charts'
import { DATASETS } from '@/data/platform'
import {
  scoreDatasets,
  summarize,
  dimensionAverages,
  normalizeWeights,
  governanceNarrative,
  DEFAULT_QUALITY_WEIGHTS,
  type DatasetGov,
  type QualityWeights,
  type Sensitivity,
  type Anonymization,
  type Grade,
} from '@/lib/governance'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import type { KPI } from '@/lib/scenarios'

const ACCENT_NAME = 'teal' as const

const SENS_ORDER: Sensitivity[] = ['Public', 'Internal', 'Confidential', 'Restricted']
const ANON_ORDER: Anonymization[] = ['None', 'Masking', 'k-Anonymity', 'Differential']

/* Deterministic privacy posture per dataset, so the seed is reproducible. */
const PII = new Set(['DS-005', 'DS-007', 'DS-010', 'DS-011'])
const SENS_FROM_LICENSE: Record<string, Sensitivity> = { Open: 'Public', Research: 'Internal', Commercial: 'Confidential', Enterprise: 'Restricted' }
const ANON_OVERRIDE: Record<string, Anonymization> = { 'DS-005': 'None', 'DS-010': 'None', 'DS-007': 'Masking', 'DS-011': 'Masking', 'DS-009': 'k-Anonymity' }

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

const seed = (): DatasetGov[] =>
  DATASETS.map((d) => ({
    id: d.id,
    name: d.name,
    dimensions: {
      completeness: clampPct(d.quality + 2),
      validity: clampPct(d.quality - 1),
      consistency: clampPct(d.quality - 4),
      timeliness: clampPct(d.quality - 9),
      uniqueness: clampPct(d.quality + 3),
    },
    containsPII: PII.has(d.id),
    sensitivity: SENS_FROM_LICENSE[d.license] ?? 'Internal',
    anonymization: ANON_OVERRIDE[d.id] ?? (d.anonymized ? 'Masking' : 'None'),
    records: d.records,
  }))

const GRADE_VARIANT: Record<Grade, 'success' | 'warn' | 'danger'> = { A: 'success', B: 'success', C: 'warn', D: 'danger' }
const SENS_VARIANT: Record<Sensitivity, 'neutral' | 'brand' | 'warn' | 'danger'> = { Public: 'neutral', Internal: 'brand', Confidential: 'warn', Restricted: 'danger' }
const ANON_VARIANT: Record<Anonymization, 'danger' | 'warn' | 'brand' | 'success'> = { None: 'danger', Masking: 'warn', 'k-Anonymity': 'brand', Differential: 'success' }

const QUALITY_TARGET = 97

export default function Governance() {
  const [rows, setRows] = useState<DatasetGov[]>(seed)
  const [weights, setWeights] = useState<QualityWeights>(DEFAULT_QUALITY_WEIGHTS)
  const [minQuality, setMinQuality] = useState(80)
  const [maxExposure, setMaxExposure] = useState(40)
  const [edited, setEdited] = useState(false)

  const touch = () => setEdited(true)
  const setDim = (id: string, key: keyof DatasetGov['dimensions'], v: number) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, dimensions: { ...r.dimensions, [key]: clampPct(v) } } : r)))
    touch()
  }
  const set = (id: string, patch: Partial<DatasetGov>) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); touch() }
  const cycle = <T,>(id: string, key: 'sensitivity' | 'anonymization', order: T[], cur: T) => {
    const next = order[(order.indexOf(cur) + 1) % order.length]
    set(id, { [key]: next } as Partial<DatasetGov>)
  }
  const addRow = () => { setRows((rs) => [...rs, { id: `DS-${Math.floor(100 + Math.random() * 899)}`, name: 'New dataset', dimensions: { completeness: 85, validity: 85, consistency: 82, timeliness: 78, uniqueness: 88 }, containsPII: false, sensitivity: 'Internal', anonymization: 'None', records: 10_000 }]); touch() }
  const removeRow = (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); touch() }
  const reset = () => { setRows(seed()); setWeights(DEFAULT_QUALITY_WEIGHTS); setMinQuality(80); setMaxExposure(40); setEdited(false) }

  const thresholds = { minQuality, maxExposure }
  const results = useMemo(() => scoreDatasets(rows, weights, thresholds), [rows, weights, minQuality, maxExposure])
  const summary = useMemo(() => summarize(results), [results])
  const { scenarios, save, remove } = useScenarios('governance')
  const kpis: KPI[] = [
    { label: 'Avg quality', value: summary.avgQuality },
    { label: 'Avg exposure', value: summary.avgExposure },
    { label: 'Publishable', value: summary.publishable },
    { label: 'High re-ID risk', value: summary.highRisk },
  ]
  const normW = normalizeWeights(weights)

  const radarData = useMemo(() => {
    const avg = dimensionAverages(rows)
    return [
      { metric: 'Completeness', score: avg.completeness, target: QUALITY_TARGET },
      { metric: 'Validity', score: avg.validity, target: QUALITY_TARGET },
      { metric: 'Consistency', score: avg.consistency, target: QUALITY_TARGET },
      { metric: 'Timeliness', score: avg.timeliness, target: QUALITY_TARGET },
      { metric: 'Uniqueness', score: avg.uniqueness, target: QUALITY_TARGET },
    ]
  }, [rows])
  const scatter = results.map((r) => ({ x: r.qualityScore, y: r.exposure, name: r.name }))
  const gated = results.filter((r) => !r.publishable)

  const setWeight = (key: keyof QualityWeights, v: number) => { setWeights((w) => ({ ...w, [key]: v })); touch() }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Data Platform"
        title="Governance & Trust"
        accent={ACCENT_NAME}
        description="A live data-governance workbench. Edit each dataset's quality dimensions and privacy posture, weight what quality means to you, and set the publish gate — the composite quality score, PII-exposure risk, trust grade and publish verdict recompute instantly. Real data-quality and privacy math, not a static dashboard."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={summary.highRisk > 0 ? 'danger' : 'success'} dot>
              {summary.publishable}/{summary.count} publishable
            </Badge>
          </>
        }
      />

      <ScenarioBar
        accent="teal"
        scenarios={scenarios}
        onSave={(name) => save(name, { rows, weights, minQuality, maxExposure }, kpis)}
        onLoad={(s) => {
          const d = s.data as { rows?: typeof rows; weights?: typeof weights; minQuality?: number; maxExposure?: number }
          if (d.rows) setRows(d.rows)
          if (d.weights) setWeights(d.weights)
          if (typeof d.minQuality === 'number') setMinQuality(d.minQuality)
          if (typeof d.maxExposure === 'number') setMaxExposure(d.maxExposure)
          setEdited(true)
        }}
        onRemove={remove}
      />

      {/* KPIs — recompute as you edit */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Datasets governed" value={String(summary.count)} icon={Database} accent="teal" sub={`${formatNumber(summary.records, { compact: true })} records`} />
        <StatTile label="Avg quality score" value={summary.avgQuality.toFixed(1)} icon={Gauge} accent={summary.avgQuality >= 90 ? 'emerald' : 'amber'} sub="Weighted across dimensions" />
        <StatTile label="Avg exposure" value={summary.avgExposure.toFixed(1)} icon={EyeOff} accent={summary.avgExposure <= 25 ? 'emerald' : summary.avgExposure <= 45 ? 'amber' : 'rose'} sub="0–100 PII/privacy risk" />
        <StatTile label="Publishable" value={`${summary.publishable}/${summary.count}`} icon={CheckCircle2} accent={summary.publishable === summary.count ? 'emerald' : 'amber'} sub={`q ≥ ${minQuality}, exp ≤ ${maxExposure}`} />
        <StatTile label="High re-ID risk" value={String(summary.highRisk)} icon={AlertTriangle} accent="rose" sub="Need stronger anonymization" />
      </div>

      {/* controls: quality weights + publish gate */}
      <Card>
        <CardHeader
          icon={SlidersHorizontal}
          accent={ACCENT_NAME}
          title="Quality weighting & publish gate"
          subtitle="Weight the five quality dimensions to your standard and set the gate every dataset must clear to publish"
        />
        <div className="grid gap-6 border-t border-edge/50 p-5 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
            <WeightSlider label="Completeness" value={weights.completeness} pct={normW.completeness} onChange={(v) => setWeight('completeness', v)} />
            <WeightSlider label="Validity" value={weights.validity} pct={normW.validity} onChange={(v) => setWeight('validity', v)} />
            <WeightSlider label="Consistency" value={weights.consistency} pct={normW.consistency} onChange={(v) => setWeight('consistency', v)} />
            <WeightSlider label="Timeliness" value={weights.timeliness} pct={normW.timeliness} onChange={(v) => setWeight('timeliness', v)} />
            <WeightSlider label="Uniqueness" value={weights.uniqueness} pct={normW.uniqueness} onChange={(v) => setWeight('uniqueness', v)} />
          </div>
          <div className="grid grid-cols-2 gap-5 sm:max-w-md">
            <Param label="Min quality to publish" value={minQuality} step={1} onChange={(v) => { setMinQuality(clampPct(v)); touch() }} />
            <Param label="Max exposure to publish" value={maxExposure} step={1} onChange={(v) => { setMaxExposure(clampPct(v)); touch() }} />
            <p className="col-span-2 text-xs leading-relaxed text-slate-500">
              A dataset publishes only when its weighted quality is at least the minimum <em>and</em> its PII-exposure risk is at or below the maximum. Apply stronger anonymization to bring exposure down.
            </p>
          </div>
        </div>
      </Card>

      {/* editable dataset governance table */}
      <Card>
        <CardHeader
          icon={KeyRound}
          accent={ACCENT_NAME}
          title="Dataset governance — editable"
          subtitle="Edit dimension scores; click PII, sensitivity or anonymization to cycle. Quality, exposure, grade and the publish verdict recompute live."
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add dataset
            </button>
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Dataset</th>
                <th className="px-2 py-2.5 text-right font-medium" title="Completeness">Cmpl</th>
                <th className="px-2 py-2.5 text-right font-medium" title="Validity">Vld</th>
                <th className="px-2 py-2.5 text-right font-medium" title="Consistency">Cnst</th>
                <th className="px-2 py-2.5 text-right font-medium" title="Timeliness">Tml</th>
                <th className="px-2 py-2.5 text-right font-medium" title="Uniqueness">Unq</th>
                <th className="px-2 py-2.5 text-center font-medium">PII</th>
                <th className="px-2 py-2.5 text-center font-medium">Sensitivity</th>
                <th className="px-2 py-2.5 text-center font-medium">Anonymization</th>
                <th className="px-3 py-2.5 font-medium">Quality</th>
                <th className="px-3 py-2.5 text-right font-medium">Exposure</th>
                <th className="px-3 py-2.5 text-center font-medium">Publish</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-elevated/30">
                  <td className="px-4 py-2">
                    <input value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} className="w-44 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-teal-500/40" />
                    <div className="text-[10px] text-slate-600">{r.id}</div>
                  </td>
                  <DimCell value={r.dimensions.completeness} onChange={(v) => setDim(r.id, 'completeness', v)} />
                  <DimCell value={r.dimensions.validity} onChange={(v) => setDim(r.id, 'validity', v)} />
                  <DimCell value={r.dimensions.consistency} onChange={(v) => setDim(r.id, 'consistency', v)} />
                  <DimCell value={r.dimensions.timeliness} onChange={(v) => setDim(r.id, 'timeliness', v)} />
                  <DimCell value={r.dimensions.uniqueness} onChange={(v) => setDim(r.id, 'uniqueness', v)} />
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => set(r.id, { containsPII: !r.containsPII })} title="Toggle PII">
                      <Badge variant={r.containsPII ? 'danger' : 'neutral'}>{r.containsPII ? 'Yes' : 'No'}</Badge>
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => cycle(r.id, 'sensitivity', SENS_ORDER, r.sensitivity)} title="Cycle sensitivity">
                      <Badge variant={SENS_VARIANT[r.sensitivity]}>{r.sensitivity}</Badge>
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => cycle(r.id, 'anonymization', ANON_ORDER, r.anonymization)} title="Cycle anonymization">
                      <Badge variant={ANON_VARIANT[r.anonymization]}>{r.anonymization}</Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={r.qualityScore} accent={r.qualityScore >= 90 ? 'emerald' : r.qualityScore >= 75 ? 'amber' : 'rose'} height="sm" className="w-14" />
                      <span className="w-10 text-sm font-semibold text-slate-100 data-mono">{r.qualityScore}</span>
                      <Badge variant={GRADE_VARIANT[r.grade]}>{r.grade}</Badge>
                    </div>
                  </td>
                  <td className={cn('px-3 py-2 text-right data-mono', r.reId === 'Low' ? 'text-emerald-300' : r.reId === 'Medium' ? 'text-amber-300' : 'text-rose-300')}>
                    {r.exposure}
                    <span className="ml-1 text-[10px] text-slate-500">{r.reId}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.publishable ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Publish</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-300"><Lock className="h-3.5 w-3.5" /> Gated</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => removeRow(r.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* charts driven by the live model */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader icon={RadarIcon} accent={ACCENT_NAME} title="Quality dimensions" subtitle={`Cohort average vs ${QUALITY_TARGET} target`} />
          <div className="px-3 pb-5 pt-2">
            <RadarViz data={radarData} series={[{ key: 'score', name: 'Average', accent: 'teal' }, { key: 'target', name: 'Target', accent: 'cyan' }]} height={300} />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader icon={ShieldCheck} accent={ACCENT_NAME} title="Quality vs exposure" subtitle="Each dataset — the publishable zone is high quality (right) and low exposure (bottom)" />
          <div className="border-t border-edge/50 p-5">
            <ScatterViz data={scatter} xKey="x" yKey="y" xName="Quality" yName="Exposure" height={300} accent="teal" />
            <p className="mt-2 text-xs text-slate-500">Points high on the exposure axis are gated until anonymization brings them under your {maxExposure} threshold.</p>
          </div>
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-teal-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACCENT_NAME} title="Governance read-out" subtitle="Computed from your current policy" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{governanceNarrative(summary)}</p>
          {gated.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {gated.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  <Lock className="h-3 w-3" /> {r.name} · q{r.qualityScore} · exp {r.exposure}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* A quality-weight slider 0–100% (stored 0–1), showing the normalized share. */
function WeightSlider({ label, value, pct, onChange }: { label: string; value: number; pct: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-xs font-semibold text-teal-300 data-mono">{Math.round(pct * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-teal-500" />
    </div>
  )
}

/* A labelled, controlled numeric parameter input. */
function Param({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-200">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n) }}
        className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-3 py-1.5 text-sm text-slate-100 data-mono focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
      />
    </label>
  )
}

/* A compact inline-editable dimension score (0–100). */
function DimCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const tone = value >= 90 ? 'text-emerald-300' : value >= 75 ? 'text-amber-300' : 'text-rose-300'
  return (
    <td className="px-2 py-2 text-right">
      {editing ? (
        <input
          autoFocus
          type="number"
          defaultValue={value}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-14 rounded border border-teal-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', tone)} title="Click to edit">{value}</button>
      )}
    </td>
  )
}
