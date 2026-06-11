import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
  Download,
  ShieldCheck,
  BookOpen,
  Pencil,
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
import { ScrollableTable } from '@/components/ScrollableTable'
import { ExportMenu } from '@/components/ExportMenu'
import { CollabBar } from '@/components/CollabBar'
import { kpiToItem, tableToCsv, type ReportSpec, type ReportTable } from '@/lib/report'
import { downloadText } from '@/lib/download'
import { sampleObj, type ModelStats } from '@/lib/model-stats'
import type { KPI } from '@/lib/scenarios'
import { parseIfc, type ParsedIfc } from '@/lib/ifc'
import { auditModel, composition, auditCsv, type AuditSeverity } from '@/lib/bim-audit'
import { buildIfcScene, DISCIPLINE_COLOR, DISCIPLINE_LABEL, describeSelection, type Discipline, type SelectedElement } from '@/lib/ifc-model'
import type { IfcMesh } from '@/lib/ifc-geometry'
import { locateWasm } from '@/lib/ifc-wasm-url'
const IfcModelViewer = lazy(() => import('@/components/IfcModelViewer').then((m) => ({ default: m.IfcModelViewer })))
import { SAMPLE_IFC } from '@/lib/ifc-sample'
import { SAMPLE_IFC_GEO } from '@/lib/ifc-sample-geo'
const MeshModelViewer = lazy(() => import('@/components/MeshModelViewer').then((m) => ({ default: m.MeshModelViewer })))
import type { ModelFormat } from '@/components/MeshModelViewer'
import { ApsImport } from '@/components/ApsImport'
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
  const [source, setSource] = useState<string | null>(null) // raw text → web-ifc tessellation
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  function runParse(text: string, fileName: string) {
    setParsing(true)
    setParseError(null)
    try {
      const result = parseIfc(text, fileName)
      if (result.totalInstances === 0) throw new Error('No IFC instances found — is this a STEP/IFC file?')
      setParsed(result)
      setSource(text)
    } catch (err) {
      setParsed(null)
      setSource(null)
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

  // ---- import a neutral 3D model (glTF/GLB/OBJ/STL): view + extract stats ----
  const modelRef = useRef<HTMLInputElement>(null)
  const [model, setModel] = useState<{ data: ArrayBuffer; format: ModelFormat; name: string } | null>(null)
  const [modelStats, setModelStats] = useState<ModelStats | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const openModel = (data: ArrayBuffer, format: ModelFormat, name: string) => { setModelStats(null); setModelError(null); setModel({ data, format, name }) }
  const clearModel = () => { setModel(null); setModelStats(null); setModelError(null) }
  async function onModelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase()
    const format: ModelFormat = ext === 'glb' ? 'glb' : ext === 'gltf' ? 'gltf' : ext === 'stl' ? 'stl' : 'obj'
    openModel(await f.arrayBuffer(), format, f.name)
    e.target.value = ''
  }
  const loadSampleModel = () => openModel(new TextEncoder().encode(sampleObj()).buffer, 'obj', 'sample-massing.obj')
  const modelCsv = () => {
    if (!modelStats) return ''
    const summary = tableToCsv({ title: 'Model summary', columns: ['Metric', 'Value', 'Unit'], rows: [
      ['Meshes', modelStats.meshes, ''], ['Triangles', modelStats.triangles, ''], ['Vertices', modelStats.vertices, ''], ['Materials', modelStats.materials, ''],
      ['Width', modelStats.dimensions.x, 'units'], ['Height', modelStats.dimensions.y, 'units'], ['Depth', modelStats.dimensions.z, 'units'],
    ] })
    const parts = tableToCsv({ title: 'Parts', columns: ['Part', 'Triangles', 'Vertices'], rows: modelStats.parts.map((p) => [p.name, p.triangles, p.vertices]) })
    return `${summary}\n\n${parts}`
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
  const { scenarios, save, remove, importRaw } = useScenarios('bim')
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
        description="Drop in an IFC file — the universal BIM format every authoring tool exports (Revit, ArchiCAD, Tekla…) — and the studio reads it right here in your browser: what's inside in plain language, a graded model-health check (the QA pass a BIM manager runs), the real 3D geometry, quantities and data. Then coordinate the federated picture below: clashes, resolutions, severity and a live health score."
        actions={
          <>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost">
              <Upload className="h-4 w-4" /> Upload IFC
            </button>
            <button onClick={() => runParse(SAMPLE_IFC, 'MeridianTower-Sample.ifc')} className="btn-ghost" disabled={parsing}>
              <ScanSearch className="h-4 w-4" /> Parse sample
            </button>
            <button onClick={() => runParse(SAMPLE_IFC_GEO, 'MeridianTower-Geometry.ifc')} className="btn-primary" disabled={parsing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />} Sample with geometry
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

      {parsed && <ParsedModel data={parsed} source={source ?? ''} onClear={() => { setParsed(null); setSource(null) }} />}

      {/* import a neutral 3D model (glTF / OBJ / STL) — view + extract geometry data.
          Revit → export IFC (above) or glTF/OBJ → drop it here. */}
      <Card>
        <CardHeader
          icon={Boxes}
          accent="violet"
          title="Import a 3D model — glTF · GLB · OBJ · STL"
          subtitle="Upload a model exported from Revit, SketchUp, Rhino, Blender, etc. — view it and extract geometry data (meshes, triangles, dimensions, parts)."
          action={
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => modelRef.current?.click()} className="btn-ghost"><Upload className="h-4 w-4" /> Upload model</button>
              <button onClick={loadSampleModel} className="btn-primary"><Boxes className="h-4 w-4" /> Load sample</button>
              {model && <button onClick={clearModel} className="btn-ghost"><X className="h-4 w-4" /> Clear</button>}
              <input ref={modelRef} type="file" accept=".glb,.gltf,.obj,.stl,model/gltf-binary,model/gltf+json" className="hidden" onChange={onModelFile} />
            </div>
          }
        />
        {model ? (
          <div className="border-t border-edge/50">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/60 bg-elevated/30 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Boxes className="h-4 w-4 text-violet-400" /> {model.name}
                <Badge variant="neutral">{model.format.toUpperCase()}</Badge>
                {modelStats && <span className="text-[11px] text-slate-400">{formatNumber(modelStats.meshes)} meshes · {formatNumber(modelStats.triangles)} triangles</span>}
              </span>
              {modelStats && (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => downloadText('model-stats.csv', modelCsv(), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
                  <button onClick={() => downloadText('model-stats.json', JSON.stringify({ name: model.name, format: model.format, ...modelStats }, null, 2), 'JSON')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileCheck2 className="h-3.5 w-3.5" /> JSON</button>
                </div>
              )}
            </div>
            <Suspense fallback={<div style={{ height: 460 }} className="grid place-items-center text-sm text-slate-500">Loading viewer…</div>}>
              <MeshModelViewer data={model.data} format={model.format} onStats={setModelStats} onError={setModelError} height={460} />
            </Suspense>
            {modelError && <p className="flex items-center gap-2 border-t border-edge/60 px-4 py-2 text-xs text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> {modelError}</p>}
            {modelStats && (
              <div className="space-y-4 border-t border-edge/60 p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <MiniStat label="Meshes" value={formatNumber(modelStats.meshes)} accent="violet" />
                  <MiniStat label="Triangles" value={formatNumber(modelStats.triangles)} accent="blue" />
                  <MiniStat label="Vertices" value={formatNumber(modelStats.vertices)} accent="cyan" />
                  <MiniStat label="Materials" value={formatNumber(modelStats.materials)} accent="amber" />
                  <MiniStat label="Footprint" value={`${formatNumber(Math.round(modelStats.dimensions.x))}×${formatNumber(Math.round(modelStats.dimensions.z))}`} accent="teal" />
                  <MiniStat label="Height" value={`${formatNumber(Math.round(modelStats.dimensions.y))}`} accent="emerald" />
                </div>
                {modelStats.parts.length > 0 && (
                  <ScrollableTable label="Model parts" className="rounded-xl border border-edge/60">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2.5 font-medium">Part</th>
                          <th className="px-3 py-2.5 text-right font-medium">Triangles</th>
                          <th className="px-3 py-2.5 text-right font-medium">Vertices</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-edge/40">
                        {modelStats.parts.slice(0, 200).map((p, i) => (
                          <tr key={i} className="hover:bg-elevated/30">
                            <td className="px-4 py-2 font-medium text-slate-200">{p.name}</td>
                            <td className="px-3 py-2 text-right data-mono text-slate-300">{formatNumber(p.triangles)}</td>
                            <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(p.vertices)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollableTable>
                )}
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Drag or arrow-keys to orbit · scroll to zoom. Imported models are view + extract (not editable here — the editable generative models live in Project Workspace and Site &amp; Zoning). Native <code className="text-slate-400">.rvt</code> isn&apos;t web-readable — export IFC (parsed above) or glTF/OBJ from Revit.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-edge/50 px-5 py-8 text-center text-sm text-slate-500">
            Upload a <span className="text-slate-300">.glb / .gltf / .obj / .stl</span> model, or load the sample, to view it and pull out geometry data. For native Revit/AutoCAD, use the Autodesk connector below — or export <span className="text-slate-300">IFC</span> (uploader at the top).
          </div>
        )}
      </Card>

      <ApsImport />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            onImport={importRaw}
            module="bim"
            accent="blue"
            scenarios={scenarios}
            onSave={(name) => save(name, { pairs, elements }, summary)}
            onLoad={(s) => { const d = s.data as { pairs?: typeof pairs; elements?: number }; if (d.pairs) setPairs(d.pairs); if (typeof d.elements === 'number') setElements(d.elements); setEdited(true) }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent="blue" spec={reportSpec} csv={reportTable} />
      </div>

      <CollabBar subject="bim" accent="blue" />

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
        <ScrollableTable label="Clash coordination" className="border-t border-edge/50">
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
                        <input value={p.a} aria-label="Discipline A" onChange={(e) => set(p.id, { a: e.target.value })} className="w-20 rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
                        <span className="text-slate-600">×</span>
                        <input value={p.b} aria-label="Discipline B" onChange={(e) => set(p.id, { b: e.target.value })} className="w-20 rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
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
                        <button onClick={() => removePair(p.id)} aria-label={`Remove ${p.a}×${p.b} interface`} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
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

function MiniStat({ label, value, accent, sub }: { label: string; value: string; accent: Accent; sub?: string }) {
  const a = ACCENT[accent]
  return (
    <div className={cn('rounded-xl p-3 ring-1', a.bg, a.ring)}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={cn('data-mono text-lg font-semibold', a.text)}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{sub}</div>}
    </div>
  )
}

const DISCIPLINES: Discipline[] = ['struct', 'arch', 'mep', 'other']

const SEV_DOT: Record<AuditSeverity, string> = { critical: 'bg-rose-400', warning: 'bg-amber-400', good: 'bg-emerald-400', info: 'bg-sky-400' }
const AUDIT_GRADE_ACCENT: Record<string, Accent> = { A: 'emerald', B: 'lime', C: 'amber', D: 'rose', E: 'rose' }

function ParsedModel({ data, source, onClear }: { data: ParsedIfc; source: string; onClear: () => void }) {
  const maxEntity = data.entityCounts[0]?.count ?? 1
  const audit = useMemo(() => auditModel(data), [data])
  const comp = useMemo(() => composition(data.entityCounts), [data])
  const [showRaw, setShowRaw] = useState(false)
  const indicativeTotal = data.quantities.reduce((s, q) => s + q.total * (KIND_RATE[q.kind] ?? 0), 0)
  const [hidden, setHidden] = useState<Partial<Record<Discipline, boolean>>>({})
  const sceneInput = { entityCounts: data.entityCounts, storeys: Math.max(1, data.storeys.length) }
  const scene = buildIfcScene(sceneInput)
  const toggle = (d: Discipline) => setHidden((h) => ({ ...h, [d]: !h[d] }))

  // Tessellate the real file with web-ifc (lazy + async). On success we render the
  // actual triangulated solids; otherwise we keep the count-based reconstruction.
  const [meshes, setMeshes] = useState<IfcMesh[] | null>(null)
  const [geoState, setGeoState] = useState<'loading' | 'real' | 'recon'>('loading')
  const [selected, setSelected] = useState<SelectedElement | null>(null)
  const [explode, setExplode] = useState(0)
  const [section, setSection] = useState(1)
  const [resetNonce, setResetNonce] = useState(0)
  useEffect(() => {
    let cancelled = false
    setMeshes(null); setGeoState('loading'); setHidden({}); setSelected(null); setExplode(0); setSection(1)
    if (!source) { setGeoState('recon'); return }
    import('@/lib/ifc-geometry')
      .then(({ extractGeometry }) => extractGeometry(new TextEncoder().encode(source), { locateFile: locateWasm }))
      .then((res) => {
        if (cancelled) return
        if (res.meshes.length) { setMeshes(res.meshes); setGeoState('real') }
        else { setMeshes(null); setGeoState('recon') }
      })
      .catch(() => { if (!cancelled) { setMeshes(null); setGeoState('recon') } })
    return () => { cancelled = true }
  }, [source])

  const real = geoState === 'real' && meshes !== null
  const disciplines = real
    ? DISCIPLINES.map((d) => ({ discipline: d, count: meshes!.filter((m) => m.discipline === d).length })).filter((d) => d.count > 0)
    : scene.byDiscipline
  const elementCount = real ? meshes!.length : scene.placed
  const hasModel = real || scene.placed > 0
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
          <MiniStat label="Records in the file" value={formatNumber(data.totalInstances)} accent="blue" sub="Every numbered line — elements, geometry, links and data" />
          <MiniStat label="Building elements" value={formatNumber(data.elementCount)} accent="cyan" sub="The physical things: walls, slabs, columns, doors…" />
          <MiniStat label="Kinds of record" value={formatNumber(data.distinctTypes)} accent="violet" sub="Distinct IFC classes used by this file" />
          <MiniStat label="Storeys" value={data.storeys.length > 0 ? formatNumber(data.storeys.length) : '—'} accent={data.storeys.length > 0 ? 'teal' : 'rose'} sub={data.storeys.length > 0 ? 'Levels organising the elements' : 'None defined — see the health check'} />
        </div>

        {/* how to read an IFC — four-second literacy */}
        <div data-bim-explainer className="grid gap-2 rounded-xl border border-edge/60 bg-elevated/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['An IFC is a database, not a picture', 'Every line is a record with an id. Viewers rebuild the model by following the references between records.'],
            ['Elements vs plumbing', 'A handful of records are real building parts; most are the points, axes and profiles that position and shape them. High plumbing counts are normal.'],
            ['The spatial tree', 'Project → site → building → storeys → spaces. Containment links hang every element on this tree — it is how “show me Level 3” works.'],
            ['Data rides on elements', 'Property sets, quantities and types attach to elements through link records — that data is what schedules, costing and FM consume.'],
          ].map(([t, b]) => (
            <div key={t} className="flex gap-2">
              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
              <div><div className="text-xs font-medium text-slate-200">{t}</div><div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{b}</div></div>
            </div>
          ))}
        </div>

        {/* model health — the QA pass a BIM manager runs, in plain language */}
        <div data-bim-health className="overflow-hidden rounded-xl border border-edge/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/60 bg-elevated/30 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <ShieldCheck className={cn('h-4 w-4', ACCENT[AUDIT_GRADE_ACCENT[audit.grade]].text)} />
              Model health — {audit.score}/100
              <Badge variant={audit.grade <= 'B' ? 'success' : audit.grade === 'C' ? 'warn' : 'danger'}>Grade {audit.grade}</Badge>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">{audit.counts.good} pass · {audit.counts.warning} to tighten · {audit.counts.critical} blocking</span>
              <button onClick={() => downloadText(`${data.fileName.replace(/\.ifc$/i, '')}-audit.csv`, auditCsv(data), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
            </div>
          </div>
          <p className="border-b border-edge/50 bg-elevated/10 px-4 py-2 text-xs text-slate-400">{audit.headline}</p>
          <ul className="divide-y divide-edge/40">
            {audit.findings.map((x) => (
              <li key={x.id} className="px-4 py-2.5">
                <div className="flex items-start gap-2.5">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', SEV_DOT[x.severity])} aria-hidden />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-100">{x.title} <span className="ml-1 text-xs text-slate-400">{x.detail}</span></div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Why it matters: {x.why}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 3D model — real web-ifc tessellation when the file carries geometry,
            otherwise a reconstruction from the file's element counts + storeys */}
        {hasModel && (
          <div className="overflow-hidden rounded-xl border border-edge/60">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/60 bg-elevated/30 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Boxes className="h-4 w-4 text-blue-400" />
                {real
                  ? <>Tessellated geometry · {formatNumber(elementCount)} solids</>
                  : <>3D model · {formatNumber(elementCount)} elements across {scene.storeys} storeys</>}
                {real
                  ? <Badge variant="success">web-ifc</Badge>
                  : geoState === 'loading'
                    ? <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> tessellating…</span>
                    : <Badge variant="neutral">reconstruction</Badge>}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {disciplines.map((d) => (
                  <button
                    key={d.discipline}
                    onClick={() => toggle(d.discipline)}
                    aria-pressed={!hidden[d.discipline]}
                    className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors', hidden[d.discipline] ? 'text-slate-500 ring-edge/60' : 'text-slate-200 ring-edge/70 bg-elevated/60')}
                  >
                    <span className="h-2 w-2 rounded-sm" style={{ background: DISCIPLINE_COLOR[d.discipline] }} />
                    {DISCIPLINE_LABEL[d.discipline]} <span className="text-slate-500">{d.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-edge/60 bg-elevated/20 px-4 py-2 text-xs">
              <label className="flex items-center gap-2 text-slate-400">
                <span>Explode</span>
                <input type="range" min={0} max={1} step={0.02} value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="h-1 w-28 cursor-pointer accent-blue-500" aria-label="Explode model by height" />
              </label>
              <label className="flex items-center gap-2 text-slate-400">
                <span>Section</span>
                <input type="range" min={0.05} max={1} step={0.01} value={section} onChange={(e) => setSection(Number(e.target.value))} className="h-1 w-28 cursor-pointer accent-blue-500" aria-label="Section cut height" />
              </label>
              <button onClick={() => { setExplode(0); setSection(1); setSelected(null); setResetNonce((n) => n + 1) }} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-slate-300 ring-1 ring-inset ring-edge/70 hover:bg-elevated/60">
                <RotateCcw className="h-3.5 w-3.5" /> Reset view
              </button>
              <span className="text-slate-500">Drag or arrow-keys to orbit · scroll to zoom · click to inspect</span>
            </div>
            <div className="relative">
              <Suspense fallback={<div style={{ height: 460 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
                <IfcModelViewer input={sceneInput} meshes={real ? meshes! : undefined} hidden={hidden} selectedKey={selected?.key ?? null} onSelect={setSelected} explode={explode} section={section} resetNonce={resetNonce} height={460} />
              </Suspense>
              {selected && (
                <div className="absolute left-3 top-3 w-60 rounded-lg border border-edge/70 bg-base/90 p-3 text-xs shadow-xl backdrop-blur" role="status" aria-label={describeSelection(selected)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="data-mono font-semibold text-slate-100">{selected.ifcType}</span>
                    <button onClick={() => setSelected(null)} aria-label="Clear selection" className="text-slate-500 hover:text-slate-200"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <dl className="mt-2 space-y-1 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: DISCIPLINE_COLOR[selected.discipline] }} />
                      {DISCIPLINE_LABEL[selected.discipline]}
                    </div>
                    {selected.expressID != null && <div className="flex justify-between"><dt>Express ID</dt><dd className="data-mono text-slate-300">#{selected.expressID}</dd></div>}
                    {selected.storey != null && <div className="flex justify-between"><dt>Storey</dt><dd className="data-mono text-slate-300">{selected.storey}</dd></div>}
                    {selected.size && <div className="flex justify-between gap-2"><dt>Size</dt><dd className="data-mono text-slate-300">{selected.size.x.toFixed(1)} × {selected.size.y.toFixed(1)} × {selected.size.z.toFixed(1)} m</dd></div>}
                    {selected.triangles != null && <div className="flex justify-between"><dt>Triangles</dt><dd className="data-mono text-slate-300">{formatNumber(selected.triangles)}</dd></div>}
                  </dl>
                </div>
              )}
            </div>
            <p className="border-t border-edge/60 px-4 py-2 text-[11px] text-slate-500">
              {real
                ? <>Real triangulated geometry tessellated from the IFC file by the web-ifc WASM kernel, coloured by discipline. Drag to orbit, scroll to zoom, click an element to inspect it, toggle disciplines above.</>
                : <>This file carries no mesh geometry, so the model is reconstructed from its real element counts and storeys (columns on a grid, walls at the perimeter, slabs per floor, beams + MEP risers). Drag to orbit, scroll to zoom, click an element to inspect it, toggle disciplines above.</>}
            </p>
          </div>
        )}

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

        <div data-bim-composition>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-slate-300">What's inside this file <span className="text-slate-500">· {formatNumber(data.totalInstances)} records translated into plain language</span></h4>
            <button onClick={() => setShowRaw((v) => !v)} aria-pressed={showRaw} className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">{showRaw ? 'Hide raw IFC class names' : 'Show raw IFC class names'}</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comp.map((g, i) => (
              <div key={g.group} className="rounded-xl border border-edge/60 bg-elevated/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">{g.label}</span>
                  <span className="data-mono text-xs text-slate-400">{formatNumber(g.count)} · {g.pct}%</span>
                </div>
                <ProgressBar value={g.pct} accent={PALETTE[i % PALETTE.length]} className="mt-1.5" />
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{g.blurb}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {g.top.map((t) => (
                    <span key={t.label} title={t.type} className="inline-flex items-center gap-1 rounded-md bg-base/60 px-1.5 py-0.5 text-[10px] text-slate-300 ring-1 ring-inset ring-edge/50">{t.label} <span className="data-mono text-slate-500">{formatNumber(t.count)}</span></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {showRaw && (
            <div className="mt-4 space-y-3">
              {data.entityCounts.slice(0, 16).map((e, i) => (
                <div key={e.type}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="data-mono text-slate-300">{e.type}</span>
                    <span className="data-mono text-slate-400">{formatNumber(e.count)}</span>
                  </div>
                  <ProgressBar value={(e.count / maxEntity) * 100} accent={PALETTE[i % PALETTE.length]} />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Pencil className="h-3.5 w-3.5 shrink-0" /> Want to edit this building — move walls, re-type elements, re-run every engine on it? <Link to="/building-explorer" className="text-blue-300 underline-offset-2 hover:underline">Open Building Explorer</Link> and upload the same file under the “IFC / Revit” tab: it rebuilds into a fully editable model with schedules, egress, energy, cost and the walkthrough.
          </p>
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
