import { useMemo, useState } from 'react'
import {
  BrainCircuit,
  Tags,
  Shuffle,
  Database,
  Cpu,
  Sparkles,
  CheckCircle2,
  Lock,
  RotateCcw,
  Plus,
  Trash2,
  AlertTriangle,
  FlaskConical,
  Gauge,
  Layers,
  SlidersHorizontal,
} from 'lucide-react'
import { Card, CardHeader, PageHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { Donut, BarSeries } from '@/components/charts'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import { ScrollableTable } from '@/components/ScrollableTable'
import { ExportMenu } from '@/components/ExportMenu'
import { CollabBar } from '@/components/CollabBar'
import { kpiToItem, type ReportSpec, type ReportTable } from '@/lib/report'
import type { KPI } from '@/lib/scenarios'
import {
  computeReadiness,
  summarize,
  readinessNarrative,
  type MLDataset,
  type Severity,
  type Grade,
} from '@/lib/mldata'

const ACC: Accent = 'fuchsia'

const seed = (): MLDataset[] => [
  { id: 'bim', name: 'Classified BIM objects', task: 'Object classification', modality: 'BIM Model', examples: 2_100_000, labelCompleteness: 98, numClasses: 24, majorityClassPct: 8, trainPct: 80, valPct: 10, testPct: 10, annotatorAgreement: 0.92, duplicateRate: 3, piiClean: true },
  { id: 'dwg', name: 'Labeled drawings corpus', task: 'Detection / OCR', modality: 'Imagery', examples: 482_000, labelCompleteness: 95, numClasses: 12, majorityClassPct: 18, trainPct: 80, valPct: 10, testPct: 10, annotatorAgreement: 0.88, duplicateRate: 6, piiClean: true },
  { id: 'rfi', name: 'RFI → response pairs', task: 'LLM fine-tuning', modality: 'Document', examples: 1_280_000, labelCompleteness: 90, numClasses: 1, majorityClassPct: 100, trainPct: 90, valPct: 5, testPct: 5, annotatorAgreement: 0.81, duplicateRate: 12, piiClean: true },
  { id: 'sch', name: 'Schedule outcomes', task: 'Forecasting', modality: 'Tabular', examples: 38_000, labelCompleteness: 97, numClasses: 1, majorityClassPct: 100, trainPct: 70, valPct: 15, testPct: 15, annotatorAgreement: 0.95, duplicateRate: 2, piiClean: true },
  { id: 'ncr', name: 'Defect & NCR images', task: 'Segmentation', modality: 'Imagery', examples: 760_000, labelCompleteness: 88, numClasses: 8, majorityClassPct: 45, trainPct: 75, valPct: 15, testPct: 10, annotatorAgreement: 0.74, duplicateRate: 9, piiClean: false },
]

const MODALITY = [
  { name: 'Imagery', value: 38, accent: 'cyan' as const }, { name: 'Tabular', value: 24, accent: 'rose' as const },
  { name: 'Documents', value: 18, accent: 'amber' as const }, { name: 'BIM Models', value: 12, accent: 'blue' as const },
  { name: 'Time-series', value: 5, accent: 'sky' as const }, { name: 'Point clouds', value: 3, accent: 'violet' as const },
]

const GRADE_ACCENT: Record<Grade, Accent> = { A: 'emerald', B: 'lime', C: 'amber', D: 'rose' }
const SEV_VARIANT: Record<Severity, 'danger' | 'warn' | 'neutral'> = { High: 'danger', Medium: 'warn', Low: 'neutral' }
const COMPONENTS: { key: keyof ReturnType<typeof computeReadiness>['scores']; label: string }[] = [
  { key: 'completeness', label: 'Label completeness' }, { key: 'balance', label: 'Class balance' },
  { key: 'agreement', label: 'Annotator agreement' }, { key: 'cleanliness', label: 'De-duplication' },
  { key: 'volume', label: 'Volume adequacy' }, { key: 'split', label: 'Split validity' },
]

export default function AiStudio() {
  const [rows, setRows] = useState<MLDataset[]>(seed)
  const [selectedId, setSelectedId] = useState('ncr')
  const [edited, setEdited] = useState(false)

  const touch = () => setEdited(true)
  const set = (id: string, patch: Partial<MLDataset>) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); touch() }
  const addRow = () => { const id = `ds-${Math.floor(1000 + Math.random() * 9000)}`; setRows((rs) => [...rs, { id, name: 'New dataset', task: 'Classification', modality: 'Tabular', examples: 50_000, labelCompleteness: 90, numClasses: 3, majorityClassPct: 50, trainPct: 80, valPct: 10, testPct: 10, annotatorAgreement: 0.8, duplicateRate: 5, piiClean: false }]); setSelectedId(id); touch() }
  const removeRow = (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); touch() }
  const reset = () => { setRows(seed()); setSelectedId('ncr'); setEdited(false) }

  const scored = useMemo(() => rows.map((d) => computeReadiness(d)), [rows])
  const s = useMemo(() => summarize(rows), [rows])
  const { scenarios, save, remove, importRaw } = useScenarios('ai-studio')
  const summary: KPI[] = [
    { label: 'Avg readiness', value: s.avgReadiness },
    { label: 'Ready to train', value: s.ready },
    { label: 'Usable examples', value: s.totalEffective },
    { label: 'With warnings', value: s.withWarnings },
  ]
  const selected = scored.find((d) => d.id === selectedId) ?? scored[0]
  const readinessData = scored.map((d) => ({ name: d.name.length > 16 ? d.name.slice(0, 15) + '…' : d.name, readiness: d.readiness }))

  const reportTable: ReportTable = {
    title: 'Dataset readiness',
    columns: ['Dataset', 'Task', 'Examples', 'Readiness', 'Grade', 'Ready'],
    rows: scored.map((d) => [d.name, d.task, d.examples, d.readiness, d.grade, d.readyToTrain ? 'Yes' : 'Gated']),
  }
  const reportSpec: ReportSpec = {
    title: 'AI Training Studio',
    subtitle: `Dataset readiness brief · ${s.ready}/${s.count} ready to train`,
    module: 'ai-studio',
    kpis: summary.map(kpiToItem),
    narrative: `${s.ready} of ${s.count} datasets are ready to train, averaging ${s.avgReadiness}/100 readiness. ${formatNumber(s.totalEffective)} of ${formatNumber(s.totalExamples)} labeled examples are usable after de-duplication and incomplete-label removal; ${s.withWarnings} dataset${s.withWarnings === 1 ? '' : 's'} carry blocking or quality warnings.`,
    table: reportTable,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={BrainCircuit}
        accent={ACC}
        eyebrow="Data Platform"
        title="AI Training Studio"
        description="A live dataset-readiness workbench. Edit a dataset's volume, label completeness, class balance, train/val/test split, annotator agreement, duplicate rate and anonymization — the readiness score, split counts, imbalance warnings and the ready-to-train gate recompute instantly. Real ML data-prep math, not a static catalogue."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={s.ready === s.count ? 'success' : 'violet'} dot>
              {s.ready}/{s.count} ready to train
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            onImport={importRaw}
            module="ai-studio"
            accent="fuchsia"
            scenarios={scenarios}
            onSave={(name) => save(name, { rows }, summary)}
            onLoad={(sc) => { const d = sc.data as { rows?: typeof rows }; if (d.rows) { setRows(d.rows); setEdited(true) } }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent="fuchsia" spec={reportSpec} csv={reportTable} />
      </div>

      <CollabBar subject="ai-studio" accent="fuchsia" />

      {/* KPIs — recompute as you curate */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Avg readiness" value={`${s.avgReadiness}`} icon={Gauge} accent={s.avgReadiness >= 85 ? 'emerald' : s.avgReadiness >= 70 ? 'amber' : 'rose'} sub="0–100 composite" />
        <StatTile label="Ready to train" value={`${s.ready}/${s.count}`} icon={CheckCircle2} accent={s.ready === s.count ? 'emerald' : 'amber'} sub="Pass every gate" />
        <StatTile label="Labeled examples" value={formatNumber(s.totalExamples, { compact: true })} icon={Tags} accent="amber" sub="Total across datasets" />
        <StatTile label="Usable examples" value={formatNumber(s.totalEffective, { compact: true })} icon={Database} accent="fuchsia" sub="After dedup & label clean" />
        <StatTile label="Datasets with warnings" value={`${s.withWarnings}`} icon={AlertTriangle} accent="rose" sub="Blocking or quality issues" />
      </div>

      {/* editable dataset table */}
      <Card>
        <CardHeader
          icon={Database}
          accent={ACC}
          title="Datasets — editable"
          subtitle="Edit any attribute; readiness, grade and the ready-to-train gate recompute. Click a row to inspect & tune its split."
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add dataset
            </button>
          }
        />
        <ScrollableTable label="Datasets" className="border-t border-edge/50">
          <table className="w-full min-w-[1140px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Dataset</th>
                <th className="px-3 py-2.5 text-right font-medium">Examples</th>
                <th className="px-3 py-2.5 text-right font-medium">Labeled %</th>
                <th className="px-2 py-2.5 text-right font-medium">Classes</th>
                <th className="px-3 py-2.5 text-right font-medium">Majority %</th>
                <th className="px-3 py-2.5 text-right font-medium">κ</th>
                <th className="px-3 py-2.5 text-right font-medium">Dup %</th>
                <th className="px-2 py-2.5 text-center font-medium">PII</th>
                <th className="px-3 py-2.5 font-medium">Readiness</th>
                <th className="px-3 py-2.5 text-center font-medium">Gate</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {scored.map((d) => (
                <tr key={d.id} className={cn('cursor-pointer hover:bg-elevated/30', d.id === selectedId && 'bg-fuchsia-500/[0.06]')} onClick={() => setSelectedId(d.id)}>
                  <td className="px-4 py-2">
                    <input value={d.name} aria-label="Dataset name" onClick={(e) => e.stopPropagation()} onChange={(e) => set(d.id, { name: e.target.value })} className="w-44 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40" />
                    <div className="text-[10px] text-slate-600">{d.task}</div>
                  </td>
                  <NumCell value={d.examples} onChange={(v) => set(d.id, { examples: Math.max(0, v) })} fmt={(v) => formatNumber(v, { compact: true })} />
                  <NumCell value={d.labelCompleteness} onChange={(v) => set(d.id, { labelCompleteness: clampPct(v) })} fmt={(v) => `${v}%`} tone={d.labelCompleteness >= 95 ? 'good' : 'warn'} />
                  <NumCell value={d.numClasses} onChange={(v) => set(d.id, { numClasses: Math.max(1, Math.round(v)) })} />
                  <NumCell value={d.majorityClassPct} onChange={(v) => set(d.id, { majorityClassPct: clampPct(v) })} fmt={(v) => `${v}%`} tone={d.imbalanceRatio > 2 ? 'bad' : undefined} />
                  <NumCell value={d.annotatorAgreement} onChange={(v) => set(d.id, { annotatorAgreement: Math.max(0, Math.min(1, v)) })} fmt={(v) => v.toFixed(2)} tone={d.annotatorAgreement < 0.7 ? 'bad' : undefined} />
                  <NumCell value={d.duplicateRate} onChange={(v) => set(d.id, { duplicateRate: clampPct(v) })} fmt={(v) => `${v}%`} tone={d.duplicateRate > 10 ? 'bad' : undefined} />
                  <td className="px-2 py-2 text-center">
                    <button onClick={(e) => { e.stopPropagation(); set(d.id, { piiClean: !d.piiClean }) }} title="Toggle anonymization">
                      <Badge variant={d.piiClean ? 'success' : 'danger'}>{d.piiClean ? 'Clean' : 'PII'}</Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={d.readiness} accent={GRADE_ACCENT[d.grade]} height="sm" className="w-16" />
                      <span className="w-7 text-sm font-semibold text-slate-100 data-mono">{d.readiness}</span>
                      <Badge variant={d.grade === 'A' || d.grade === 'B' ? 'success' : d.grade === 'C' ? 'warn' : 'danger'}>{d.grade}</Badge>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {d.readyToTrain ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Ready</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-300"><Lock className="h-3.5 w-3.5" /> Gated</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={(e) => { e.stopPropagation(); removeRow(d.id) }} aria-label={`Remove ${d.name}`} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* readiness breakdown for the selected dataset */}
      {selected && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader icon={SlidersHorizontal} accent={ACC} title={`Readiness breakdown — ${selected.name}`} subtitle="Component scores and the train/val/test split" />
            <div className="grid gap-5 border-t border-edge/50 p-5 sm:grid-cols-2">
              <div className="space-y-2.5">
                {COMPONENTS.map((c) => (
                  <div key={c.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{c.label}</span>
                      <span className="data-mono text-slate-300">{selected.scores[c.key]}</span>
                    </div>
                    <ProgressBar value={selected.scores[c.key]} accent={selected.scores[c.key] >= 80 ? 'emerald' : selected.scores[c.key] >= 55 ? 'amber' : 'rose'} height="sm" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-edge/60 bg-elevated/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Train / Val / Test split</span>
                    <span className={cn('data-mono', selected.splitValid ? 'text-emerald-300' : 'text-rose-300')}>Σ {selected.splitSum}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['trainPct', 'valPct', 'testPct'] as const).map((k, i) => (
                      <label key={k} className="block">
                        <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">{['Train', 'Val', 'Test'][i]}</span>
                        <input
                          type="number"
                          value={selected[k]}
                          onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) set(selected.id, { [k]: Math.max(0, n) }) }}
                          className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-2 py-1 text-right text-sm text-slate-100 data-mono focus:border-fuchsia-500/50 focus:outline-none"
                        />
                        <span className="mt-1 block text-right text-[10px] text-slate-500 data-mono">{formatNumber([selected.trainCount, selected.valCount, selected.testCount][i], { compact: true })}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-edge/60 bg-elevated/30 p-2.5">
                    <div className="text-slate-500">Usable examples</div>
                    <div className="data-mono text-base font-semibold text-slate-100">{formatNumber(selected.effectiveExamples, { compact: true })}</div>
                  </div>
                  <div className="rounded-lg border border-edge/60 bg-elevated/30 p-2.5">
                    <div className="text-slate-500">Imbalance ratio</div>
                    <div className={cn('data-mono text-base font-semibold', selected.imbalanceRatio > 2 ? 'text-rose-300' : 'text-slate-100')}>{selected.imbalanceRatio}×</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader icon={AlertTriangle} accent="rose" title="Diagnostics" subtitle={selected.readyToTrain ? 'Passes every gate' : 'Issues blocking training'} action={<Badge variant={selected.readyToTrain ? 'success' : 'danger'} dot>{selected.readyToTrain ? 'Ready' : 'Gated'}</Badge>} />
            <div className="border-t border-edge/50 p-5">
              {selected.warnings.length ? (
                <ul className="space-y-2.5">
                  {selected.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <Badge variant={SEV_VARIANT[w.severity]} dot>{w.severity}</Badge>
                      <span className="leading-relaxed text-slate-300">{w.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> No warnings — this dataset is ready to train.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={Gauge} accent={ACC} title="Readiness by dataset" subtitle="Composite readiness score" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries data={readinessData} xKey="name" layout="vertical" height={280} series={[{ key: 'readiness', name: 'Readiness', accent: 'fuchsia' }]} valueFormatter={(v) => `${v}`} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader icon={Shuffle} accent="cyan" title="Data by modality" subtitle="Multimodal coverage" />
          <div className="px-3 pt-2">
            <Donut data={MODALITY} height={220} valueFormatter={(v) => `${v}%`} />
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {MODALITY.map((m) => (
              <div key={m.name} className="flex items-center gap-2 text-xs">
                <span className={cn('h-2 w-2 rounded-full', ACCENT[m.accent].dot)} />
                <span className="text-slate-400">{m.name}</span>
                <span className="ml-auto data-mono text-slate-300">{m.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-fuchsia-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACC} title="Curation read-out" subtitle="Computed from your current datasets" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{readinessNarrative(s)}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {scored.filter((d) => !d.readyToTrain).map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                <Lock className="h-3 w-3" /> {d.name} · {d.warnings.length} issue{d.warnings.length === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* contextual capabilities */}
      <div>
        <div className="section-label mb-4">Studio capabilities</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Tags, title: 'Auto-labeling', body: 'Model-assisted labeling with human-in-the-loop review and agreement scoring.', accent: 'amber' as const },
            { icon: Lock, title: 'Anonymization', body: 'PII redaction, k-anonymity and differential privacy before any data leaves a clean room.', accent: 'teal' as const },
            { icon: FlaskConical, title: 'Synthetic data', body: 'Generate balanced, privacy-safe synthetic examples to fill rare-class gaps.', accent: 'violet' as const },
            { icon: Cpu, title: 'Versioned & licensed', body: 'Every dataset is provenance-tracked, versioned and licensed for auditable reuse.', accent: 'emerald' as const },
          ].map((c) => (
            <Card key={c.title} className="p-5" hover>
              <span className={cn('grid h-9 w-9 place-items-center rounded-lg ring-1', ACCENT[c.accent].bg, ACCENT[c.accent].ring)}>
                <c.icon className={cn('h-4 w-4', ACCENT[c.accent].text)} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">{c.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{c.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/* Inline-editable numeric cell. */
function NumCell({ value, onChange, fmt, tone }: { value: number; onChange: (v: number) => void; fmt?: (v: number) => string; tone?: 'good' | 'warn' | 'bad' }) {
  const [editing, setEditing] = useState(false)
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-300'
  return (
    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <input
          autoFocus
          type="number"
          step="any"
          defaultValue={value}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 rounded border border-fuchsia-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', toneClass)} title="Click to edit">
          {fmt ? fmt(value) : formatNumber(value)}
        </button>
      )}
    </td>
  )
}
