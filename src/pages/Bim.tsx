import { useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Upload,
  ScanSearch,
  Loader2,
  X,
  AlertTriangle,
  FileCheck2,
  Ruler,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  GitCompare,
  CheckCircle2,
  Gauge,
  Wrench,
  Activity,
} from 'lucide-react'
import {
  PageHeader,
  StatTile,
  Card,
  CardHeader,
  Badge,
  KeyValue,
  ProgressBar,
} from '@/components/ui'
import { Donut, BarSeries } from '@/components/charts'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import { ExportMenu } from '@/components/ExportMenu'
import { kpiToItem, type ReportSpec, type ReportTable } from '@/lib/report'
import type { KPI } from '@/lib/scenarios'
import { parseIfc, type ParsedIfc } from '@/lib/ifc'
import { SAMPLE_IFC } from '@/lib/ifc-sample'
import {
  computeHealth,
  clashNarrative,
  type ClashPair,
  type Severity,
  type PairStatus,
  type Grade,
} from '@/lib/clash'

const ACC: Accent = 'blue'

/* Federated clash records between discipline pairs — the editable coordination model. */
const seed = (): ClashPair[] => [
  { id: 'as', a: 'Arch', b: 'Struct', total: 31, resolved: 20, severity: 'Major' },
  { id: 'am', a: 'Arch', b: 'MEP', total: 88, resolved: 40, severity: 'Critical' },
  { id: 'sm', a: 'Struct', b: 'MEP', total: 124, resolved: 60, severity: 'Critical' },
  { id: 'mp', a: 'MEP', b: 'Plumbing', total: 96, resolved: 70, severity: 'Major' },
  { id: 'sp', a: 'Struct', b: 'Plumbing', total: 57, resolved: 30, severity: 'Major' },
  { id: 'mf', a: 'MEP', b: 'Fire', total: 64, resolved: 50, severity: 'Major' },
  { id: 'af', a: 'Arch', b: 'Fire', total: 19, resolved: 15, severity: 'Minor' },
  { id: 'pf', a: 'Plumbing', b: 'Fire', total: 12, resolved: 12, severity: 'Minor' },
]

const SEV_ORDER: Severity[] = ['Minor', 'Major', 'Critical']
const SEV_VARIANT: Record<Severity, 'neutral' | 'warn' | 'danger'> = { Minor: 'neutral', Major: 'warn', Critical: 'danger' }
const SEV_ACCENT: Record<Severity, Accent> = { Minor: 'sky', Major: 'amber', Critical: 'rose' }
const STATUS_META: Record<PairStatus, { label: string; variant: 'success' | 'warn' | 'danger' }> = {
  clear: { label: 'Clear', variant: 'success' },
  watch: { label: 'Watch', variant: 'warn' },
  critical: { label: 'Critical', variant: 'danger' },
}
const GRADE_ACCENT: Record<Grade, Accent> = { A: 'emerald', B: 'lime', C: 'amber', D: 'rose' }

export default function Bim() {
  // ---- real in-browser IFC parser (kept) ----
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedIfc | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  function runParse(text: string, fileName: string) {
    setParsing(true)
    setParseError(null)
    try {
      const result = parseIfc(text, fileName)
      if (result.totalInstances === 0) throw new Error('No IFC instances found — is this a STEP/IFC file?')
      setParsed(result)
    } catch (err) {
      setParsed(null)
      setParseError(err instanceof Error ? err.message : 'Failed to parse file')
    } finally {
      setParsing(false)
    }
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    runParse(await f.text(), f.name)
    e.target.value = ''
  }

  // ---- operable clash / model-health workbench ----
  const [pairs, setPairs] = useState<ClashPair[]>(seed)
  const [elements, setElements] = useState(1_500_000)
  const [edited, setEdited] = useState(false)

  const touch = () => setEdited(true)
  const set = (id: string, patch: Partial<ClashPair>) => { setPairs((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))); touch() }
  const cycleSeverity = (id: string, cur: Severity) => set(id, { severity: SEV_ORDER[(SEV_ORDER.indexOf(cur) + 1) % SEV_ORDER.length] })
  const resolveAll = (id: string, total: number) => set(id, { resolved: total })
  const addPair = () => { setPairs((ps) => [...ps, { id: `cp-${Math.floor(1000 + Math.random() * 9000)}`, a: 'Disc A', b: 'Disc B', total: 20, resolved: 0, severity: 'Major' }]); touch() }
  const removePair = (id: string) => { setPairs((ps) => ps.filter((p) => p.id !== id)); touch() }
  const reset = () => { setPairs(seed()); setElements(1_500_000); setEdited(false) }

  const h = useMemo(() => computeHealth(pairs, elements), [pairs, elements])
  const { scenarios, save, remove } = useScenarios('bim')
  const summary: KPI[] = [
    { label: 'Model health', value: h.health },
    { label: 'Open clashes', value: h.totalOpen },
    { label: 'Resolution rate', value: h.resolutionPct, unit: '%' },
    { label: 'Critical open', value: h.criticalOpen },
  ]
  const burndown = h.pairs.map((p) => ({ name: `${p.a}×${p.b}`, Resolved: p.resolved, Open: p.open }))
  const severityData = h.bySeverity.filter((s) => s.open > 0).map((s) => ({ name: s.severity, value: s.open, accent: SEV_ACCENT[s.severity] }))
  const critical = h.pairs.filter((p) => p.status === 'critical')

  const reportTable: ReportTable = {
    title: 'Clash coordination',
    columns: ['Interface', 'Severity', 'Detected', 'Resolved', 'Open', 'Resolution', 'Status'],
    rows: h.pairs.map((p) => [`${p.a}×${p.b}`, p.severity, p.total, p.resolved, p.open, `${p.resolutionPct}%`, p.status]),
  }
  const reportSpec: ReportSpec = {
    title: 'BIM Intelligence',
    subtitle: `Clash & model-health brief · health ${h.health}`,
    module: 'bim',
    kpis: summary.map(kpiToItem),
    narrative: clashNarrative(h),
    table: reportTable,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Boxes}
        accent={ACC}
        eyebrow="Intelligence"
        title="BIM Intelligence"
        description="Parse real IFC models in your browser, then coordinate them live: edit inter-discipline clash counts, mark resolutions and set severity, and watch open clashes, resolution rate, clash density and a weighted model-health score recompute instantly. Real coordination math, not a static matrix."
        actions={
          <>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost">
              <Upload className="h-4 w-4" /> Upload IFC
            </button>
            <button onClick={() => runParse(SAMPLE_IFC, 'MeridianTower-Sample.ifc')} className="btn-primary" disabled={parsing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} Parse sample
            </button>
            <input ref={fileRef} type="file" accept=".ifc,.step,.stp,.txt,text/plain" className="hidden" onChange={onFile} />
          </>
        }
      />

      {parseError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {parseError}</span>
          <button onClick={() => setParseError(null)} className="text-rose-300/70 hover:text-rose-200"><X className="h-4 w-4" /></button>
        </div>
      )}

      {parsed && <ParsedModel data={parsed} onClear={() => setParsed(null)} />}

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            accent="blue"
            scenarios={scenarios}
            onSave={(name) => save(name, { pairs, elements }, summary)}
            onLoad={(s) => { const d = s.data as { pairs?: typeof pairs; elements?: number }; if (d.pairs) setPairs(d.pairs); if (typeof d.elements === 'number') setElements(d.elements); setEdited(true) }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent="blue" spec={reportSpec} csv={reportTable} />
      </div>

      {/* model-health KPIs — recompute as you coordinate */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Model health" value={`${h.health}`} icon={Gauge} accent={GRADE_ACCENT[h.grade]} sub={`Grade ${h.grade} · severity-weighted`} />
        <StatTile label="Open clashes" value={formatNumber(h.totalOpen)} icon={AlertTriangle} accent={h.totalOpen === 0 ? 'emerald' : 'rose'} sub={`of ${formatNumber(h.totalClashes)} detected`} />
        <StatTile label="Resolution rate" value={`${h.resolutionPct}%`} icon={CheckCircle2} accent={h.resolutionPct >= 80 ? 'emerald' : 'amber'} sub="Resolved ÷ detected" />
        <StatTile label="Clash density" value={`${h.density}`} icon={Activity} accent={h.density <= 1 ? 'emerald' : h.density <= 2 ? 'amber' : 'rose'} sub="Open per 10k elements" />
        <StatTile label="Critical open" value={formatNumber(h.criticalOpen)} icon={GitCompare} accent="rose" sub="In Critical interfaces" />
      </div>

      {/* element count param */}
      <Card>
        <CardHeader icon={Boxes} accent={ACC} title="Federated model size" subtitle="Total elements across the merged model — drives clash density and the health score" />
        <div className="flex flex-wrap items-end gap-5 border-t border-edge/50 p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-200">Total elements</span>
            <input
              type="number"
              step={50_000}
              value={elements}
              onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) { setElements(Math.max(0, n)); touch() } }}
              className="w-48 rounded-lg border border-edge/60 bg-elevated/40 px-3 py-1.5 text-sm text-slate-100 data-mono focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </label>
          <p className="max-w-md text-xs leading-relaxed text-slate-500">
            Density normalizes open clashes against model size, so a 1.5M-element tower and a 200k-element fit-out can be compared like-for-like. A larger, more complete model dilutes the same clash count.
          </p>
        </div>
      </Card>

      {/* editable clash table */}
      <Card>
        <CardHeader
          icon={GitCompare}
          accent="rose"
          title="Clash coordination — editable"
          subtitle="Edit detected/resolved counts, click severity to cycle, or Resolve a whole interface. Open clashes, density and health recompute live."
          action={
            <button onClick={addPair} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add interface
            </button>
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Interface</th>
                <th className="px-3 py-2.5 text-center font-medium">Severity</th>
                <th className="px-3 py-2.5 text-right font-medium">Detected</th>
                <th className="px-3 py-2.5 text-right font-medium">Resolved</th>
                <th className="px-3 py-2.5 text-right font-medium">Open</th>
                <th className="px-3 py-2.5 font-medium">Resolution</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {h.pairs.map((p) => {
                const st = STATUS_META[p.status]
                return (
                  <tr key={p.id} className="hover:bg-elevated/30">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <input value={p.a} onChange={(e) => set(p.id, { a: e.target.value })} className="w-20 rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
                        <span className="text-slate-600">×</span>
                        <input value={p.b} onChange={(e) => set(p.id, { b: e.target.value })} className="w-20 rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => cycleSeverity(p.id, p.severity)} title="Cycle severity">
                        <Badge variant={SEV_VARIANT[p.severity]} dot>{p.severity}</Badge>
                      </button>
                    </td>
                    <NumCell value={p.total} onChange={(v) => set(p.id, { total: Math.max(0, v) })} />
                    <NumCell value={p.resolved} onChange={(v) => set(p.id, { resolved: Math.max(0, v) })} tone="good" />
                    <td className={cn('px-3 py-2 text-right data-mono', p.open === 0 ? 'text-emerald-300' : p.severity === 'Critical' ? 'text-rose-300' : 'text-amber-300')}>{p.open}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <ProgressBar value={p.resolutionPct} accent={p.resolutionPct >= 80 ? 'emerald' : p.resolutionPct >= 50 ? 'amber' : 'rose'} height="sm" className="w-16" />
                        <span className="w-11 text-xs text-slate-400 data-mono">{p.resolutionPct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.open > 0 && (
                          <button onClick={() => resolveAll(p.id, p.total)} title="Resolve all in this interface" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/15">
                            <Wrench className="h-3 w-3" /> Resolve
                          </button>
                        )}
                        <button onClick={() => removePair(p.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* charts driven by the live model */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={Activity} accent="rose" title="Clash burndown by interface" subtitle="Resolved vs open per discipline pair" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries
              data={burndown}
              xKey="name"
              layout="vertical"
              stacked
              height={320}
              series={[{ key: 'Resolved', name: 'Resolved', accent: 'emerald' }, { key: 'Open', name: 'Open', accent: 'rose' }]}
              valueFormatter={(v) => formatNumber(v)}
            />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader icon={GitCompare} accent="rose" title="Open clashes by severity" subtitle="Where the unresolved risk sits" />
          <div className="px-5 pb-3 pt-2">
            {severityData.length > 0 ? (
              <Donut data={severityData} valueFormatter={(v) => formatNumber(v)} />
            ) : (
              <p className="grid h-[240px] place-items-center text-sm text-emerald-300">All clashes resolved — model clear.</p>
            )}
          </div>
          {severityData.length > 0 && (
            <div className="space-y-1 px-5 pb-5">
              {h.bySeverity.filter((s) => s.open > 0).map((s) => (
                <div key={s.severity} className="flex items-center gap-2.5 text-sm">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT[SEV_ACCENT[s.severity]].dot)} />
                  <span className="text-slate-300">{s.severity}</span>
                  <span className="ml-auto text-slate-400 data-mono">{formatNumber(s.open)} open</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-500/20 opacity-20 blur-3xl" />
        <CardHeader
          icon={Sparkles}
          accent={ACC}
          title="Coordination read-out"
          subtitle="Computed from your current clash model"
          action={edited ? <button onClick={reset} className="btn-ghost h-9 px-3 py-0 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Reset</button> : undefined}
        />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{clashNarrative(h)}</p>
          {critical.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {critical.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {p.a}×{p.b} · {p.open} open
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* Inline-editable numeric cell — shows formatted value, edits the raw number. */
function NumCell({ value, onChange, tone }: { value: number; onChange: (v: number) => void; tone?: 'good' }) {
  const [editing, setEditing] = useState(false)
  return (
    <td className="px-3 py-2 text-right">
      {editing ? (
        <input
          autoFocus
          type="number"
          defaultValue={value}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 rounded border border-blue-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', tone === 'good' ? 'text-emerald-300' : 'text-slate-300')} title="Click to edit">
          {formatNumber(value)}
        </button>
      )}
    </td>
  )
}

/* ----------------------------------------------- parsed-IFC results panel (kept) */
const PALETTE: Accent[] = ['blue', 'sky', 'cyan', 'violet', 'teal', 'emerald', 'amber', 'rose', 'fuchsia', 'lime']
const KIND_VARIANT: Record<string, 'cyan' | 'violet' | 'warn' | 'success' | 'neutral'> = {
  Volume: 'cyan', Area: 'violet', Weight: 'warn', Length: 'success', Count: 'neutral',
}
const KIND_RATE: Record<string, number> = { Volume: 165, Weight: 1.28, Area: 85, Length: 70, Count: 0 }

function MiniStat({ label, value, accent }: { label: string; value: string; accent: Accent }) {
  const a = ACCENT[accent]
  return (
    <div className={cn('rounded-xl p-3 ring-1', a.bg, a.ring)}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={cn('data-mono text-lg font-semibold', a.text)}>{value}</div>
    </div>
  )
}

function ParsedModel({ data, onClear }: { data: ParsedIfc; onClear: () => void }) {
  const maxEntity = data.entityCounts[0]?.count ?? 1
  const indicativeTotal = data.quantities.reduce((s, q) => s + q.total * (KIND_RATE[q.kind] ?? 0), 0)
  return (
    <Card>
      <CardHeader
        title={`Parsed model — ${data.fileName}`}
        subtitle={`${data.schema} · ${formatNumber(data.totalInstances)} instances · parsed in your browser`}
        icon={FileCheck2}
        accent="emerald"
        action={
          <button onClick={onClear} className="btn-ghost">
            <X className="h-4 w-4" /> Clear
          </button>
        }
      />
      <div className="space-y-6 border-t border-edge/60 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Total instances" value={formatNumber(data.totalInstances)} accent="blue" />
          <MiniStat label="Physical elements" value={formatNumber(data.elementCount)} accent="cyan" />
          <MiniStat label="Distinct types" value={formatNumber(data.distinctTypes)} accent="violet" />
          <MiniStat label="Storeys" value={formatNumber(data.storeys.length)} accent="teal" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="space-y-1">
              <KeyValue label="Project" value={data.project ?? '—'} />
              <KeyValue label="Site" value={data.site ?? '—'} />
              <KeyValue label="Building" value={data.building ?? '—'} />
              <KeyValue label="Schema" value={data.schema} mono />
              {data.authoringTool && <KeyValue label="Authoring tool" value={data.authoringTool} />}
              {data.timestamp && <KeyValue label="Timestamp" value={data.timestamp} mono />}
            </div>
            {data.storeys.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.storeys.map((s) => (
                  <Badge key={s} variant="neutral">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="lg:col-span-2">
            {data.disciplines.length > 0 ? (
              <>
                <Donut data={data.disciplines.map((d) => ({ name: d.label, value: d.value, accent: d.accent }))} valueFormatter={(v) => formatNumber(v)} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {data.disciplines.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-xs">
                      <span className={cn('h-2 w-2 rounded-full', ACCENT[d.accent].dot)} />
                      <span className="text-slate-400">{d.label}</span>
                      <span className="ml-auto data-mono text-slate-300">{formatNumber(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="grid h-full place-items-center text-sm text-slate-500">No classified elements.</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-medium text-slate-300">
            Entity breakdown <span className="text-slate-500">· top {Math.min(12, data.entityCounts.length)} of {data.entityCounts.length}</span>
          </h4>
          <div className="space-y-3">
            {data.entityCounts.slice(0, 12).map((e, i) => (
              <div key={e.type}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="data-mono text-slate-300">{e.type}</span>
                  <span className="data-mono text-slate-400">{formatNumber(e.count)}</span>
                </div>
                <ProgressBar value={(e.count / maxEntity) * 100} accent={PALETTE[i % PALETTE.length]} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Ruler className="h-4 w-4 text-emerald-400" /> Quantity takeoff <span className="text-slate-500">· from IfcElementQuantity</span>
          </h4>
          {data.quantities.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-edge/60">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2.5 font-medium">Quantity</th>
                      <th className="px-4 py-2.5 font-medium">Kind</th>
                      <th className="px-4 py-2.5 text-right font-medium">Total</th>
                      <th className="px-4 py-2.5 text-right font-medium">Elements</th>
                      <th className="px-4 py-2.5 text-right font-medium">Indicative cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge/40">
                    {data.quantities.map((q) => (
                      <tr key={`${q.kind}-${q.name}`} className="hover:bg-elevated/40">
                        <td className="px-4 py-2.5 font-medium text-slate-200">{q.name}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={KIND_VARIANT[q.kind] ?? 'neutral'}>{q.kind}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right data-mono text-slate-300">
                          {q.total.toFixed(1)} {q.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right data-mono text-slate-400">{formatNumber(q.count)}</td>
                        <td className="px-4 py-2.5 text-right data-mono text-slate-300">
                          {KIND_RATE[q.kind] ? formatCurrency(q.total * KIND_RATE[q.kind]) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-edge/60 bg-elevated/30">
                      <td className="px-4 py-2.5 font-semibold text-slate-200" colSpan={4}>
                        Indicative total
                      </td>
                      <td className="px-4 py-2.5 text-right data-mono font-bold text-emerald-300">{formatCurrency(indicativeTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Indicative cost applies nominal unit rates to model-derived quantities — calibrate against the Cost Benchmarks dataset for project-grade estimates.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              No explicit quantities (IfcElementQuantity) found in this model. Element counts and properties above are still extracted.
            </p>
          )}
        </div>

        {data.properties.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium text-slate-300">
              Property single values <span className="text-slate-500">· {data.properties.length} parsed</span>
            </h4>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {data.properties.slice(0, 12).map((p, i) => (
                <KeyValue key={`${p.name}-${i}`} label={p.name} value={p.value} mono />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
