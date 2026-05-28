import { useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Upload,
  Layers3,
  ScanSearch,
  Calculator,
  Workflow,
  GitCompare,
  Wand2,
  FileBox,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Ruler,
  Loader2,
  X,
  FileCheck2,
} from 'lucide-react'
import {
  PageHeader,
  StatTile,
  Card,
  CardHeader,
  Badge,
  Tabs,
  KeyValue,
  FeatureRow,
  ProgressBar,
  RingProgress,
} from '@/components/ui'
import { LineTrend, Donut } from '@/components/charts'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'
import { parseIfc, type ParsedIfc } from '@/lib/ifc'
import { SAMPLE_IFC } from '@/lib/ifc-sample'

const ACC: Accent = 'blue'

/* ----------------------------------------------------------- element counts */
type DisciplineKey = 'arch' | 'struct' | 'mep' | 'all'
const ELEMENT_BREAKDOWN: Record<DisciplineKey, { label: string; value: number; accent: Accent }[]> = {
  arch: [
    { label: 'Walls', value: 18_400_000, accent: 'blue' },
    { label: 'Doors & Windows', value: 6_200_000, accent: 'sky' },
    { label: 'Floors & Ceilings', value: 9_100_000, accent: 'cyan' },
    { label: 'Curtain Wall Panels', value: 4_700_000, accent: 'violet' },
    { label: 'Rooms & Spaces', value: 2_300_000, accent: 'teal' },
  ],
  struct: [
    { label: 'Beams', value: 12_800_000, accent: 'blue' },
    { label: 'Columns', value: 5_400_000, accent: 'sky' },
    { label: 'Slabs', value: 7_900_000, accent: 'cyan' },
    { label: 'Foundations', value: 1_900_000, accent: 'violet' },
    { label: 'Rebar Assemblies', value: 21_600_000, accent: 'teal' },
  ],
  mep: [
    { label: 'Ducts', value: 14_200_000, accent: 'blue' },
    { label: 'Pipes', value: 19_800_000, accent: 'sky' },
    { label: 'Cable Trays', value: 6_600_000, accent: 'cyan' },
    { label: 'Equipment', value: 3_400_000, accent: 'violet' },
    { label: 'Fittings & Valves', value: 11_300_000, accent: 'teal' },
  ],
  all: [
    { label: 'Architectural', value: 40_700_000, accent: 'blue' },
    { label: 'Structural', value: 49_600_000, accent: 'sky' },
    { label: 'MEP', value: 55_300_000, accent: 'cyan' },
    { label: 'Civil & Site', value: 9_800_000, accent: 'violet' },
    { label: 'Specialty', value: 4_200_000, accent: 'teal' },
  ],
}

/* --------------------------------------------------------- model federation */
type ModelStatus = 'Synced' | 'Processing' | 'Conflicts' | 'Stale'
const STATUS_VARIANT: Record<ModelStatus, 'success' | 'cyan' | 'danger' | 'warn'> = {
  Synced: 'success',
  Processing: 'cyan',
  Conflicts: 'danger',
  Stale: 'warn',
}
const MODELS: {
  file: string
  discipline: string
  version: string
  size: string
  elements: number
  sync: string
  status: ModelStatus
}[] = [
  { file: 'MeridianTower-ARCH.rvt', discipline: 'Architectural', version: 'v42', size: '1.84 GB', elements: 412_800, sync: '6 min ago', status: 'Synced' },
  { file: 'MeridianTower-STRUCT.ifc', discipline: 'Structural', version: 'v38', size: '2.10 GB', elements: 388_400, sync: '22 min ago', status: 'Synced' },
  { file: 'MeridianTower-MEP.rvt', discipline: 'MEP', version: 'v51', size: '3.42 GB', elements: 612_300, sync: '4 min ago', status: 'Conflicts' },
  { file: 'MeridianTower-CIVIL.dwg', discipline: 'Civil / Site', version: 'v17', size: '486 MB', elements: 74_100, sync: '3 h ago', status: 'Stale' },
  { file: 'MeridianTower-FIRE.ifc', discipline: 'Fire Protection', version: 'v23', size: '742 MB', elements: 96_700, sync: 'syncing…', status: 'Processing' },
  { file: 'MeridianTower-FACADE.rvt', discipline: 'Façade', version: 'v29', size: '1.21 GB', elements: 158_200, sync: '38 min ago', status: 'Synced' },
]

/* ------------------------------------------------------------- clash matrix */
const CLASH_DISCIPLINES = ['Arch', 'Struct', 'MEP', 'Plumbing', 'Fire'] as const
// Upper-triangle clash counts between discipline pairs; 0 on the diagonal.
const CLASH_GRID: Record<string, Record<string, number>> = {
  Arch: { Arch: 0, Struct: 31, MEP: 88, Plumbing: 42, Fire: 19 },
  Struct: { Arch: 31, Struct: 0, MEP: 124, Plumbing: 57, Fire: 23 },
  MEP: { Arch: 88, Struct: 124, MEP: 0, Plumbing: 96, Fire: 64 },
  Plumbing: { Arch: 42, Struct: 57, MEP: 96, Plumbing: 0, Fire: 12 },
  Fire: { Arch: 19, Struct: 23, MEP: 64, Plumbing: 12, Fire: 0 },
}
function clashSeverity(n: number): { variant: 'success' | 'warn' | 'danger'; accent: Accent } {
  if (n >= 80) return { variant: 'danger', accent: 'rose' }
  if (n >= 30) return { variant: 'warn', accent: 'amber' }
  return { variant: 'success', accent: 'emerald' }
}

const CLASH_TREND = [
  { week: 'W1', detected: 410, resolved: 120 },
  { week: 'W2', detected: 468, resolved: 210 },
  { week: 'W3', detected: 512, resolved: 318 },
  { week: 'W4', detected: 540, resolved: 402 },
  { week: 'W5', detected: 498, resolved: 470 },
  { week: 'W6', detected: 526, resolved: 540 },
  { week: 'W7', detected: 504, resolved: 588 },
  { week: 'W8', detected: 482, resolved: 642 },
]

/* ---------------------------------------------------------- quantity takeoff */
const QUANTITIES: { type: string; quantity: number; unit: string; rate: number }[] = [
  { type: 'In-situ Concrete', quantity: 84_200, unit: 'm³', rate: 165 },
  { type: 'Reinforcement Steel', quantity: 11_640, unit: 't', rate: 1_280 },
  { type: 'Structural Steel', quantity: 8_950, unit: 't', rate: 2_450 },
  { type: 'Curtain Wall', quantity: 46_800, unit: 'm²', rate: 920 },
  { type: 'Ductwork', quantity: 128_400, unit: 'lm', rate: 86 },
  { type: 'Piping', quantity: 214_600, unit: 'lm', rate: 54 },
  { type: 'Raised Access Floor', quantity: 62_300, unit: 'm²', rate: 78 },
]

/* ---------------------------------------------------------- classification */
const OBJECT_CATEGORIES: { name: string; value: number; accent: Accent }[] = [
  { name: 'Walls', value: 28, accent: 'blue' },
  { name: 'Floors & Slabs', value: 17, accent: 'sky' },
  { name: 'MEP Systems', value: 24, accent: 'cyan' },
  { name: 'Structure', value: 16, accent: 'violet' },
  { name: 'Doors & Windows', value: 9, accent: 'teal' },
  { name: 'Furniture & FF&E', value: 6, accent: 'amber' },
]

const AI_CAPABILITIES: { icon: typeof Wand2; title: string; body: string; accent: Accent }[] = [
  { icon: GitCompare, title: 'Clash prediction', body: 'Forecast where disciplines will collide before federation, from historical clash patterns.', accent: 'blue' },
  { icon: Calculator, title: 'Quantity extraction', body: 'Auto-derive BOQ-ready quantities from geometry with rate-linked cost estimates.', accent: 'cyan' },
  { icon: ScanSearch, title: 'Object recognition', body: 'Classify ambiguous and unmapped elements to OmniClass / Uniclass with confidence scoring.', accent: 'violet' },
  { icon: Wand2, title: 'Design optimization', body: 'Suggest routing, layout and material changes that cut clashes, cost and embodied carbon.', accent: 'emerald' },
]

const DISCIPLINE_TABS = [
  { id: 'arch', label: 'Architectural', icon: Layers3 },
  { id: 'struct', label: 'Structural', icon: Boxes },
  { id: 'mep', label: 'MEP', icon: Workflow },
  { id: 'all', label: 'All', icon: FileBox },
]

export default function Bim() {
  const [discipline, setDiscipline] = useState<DisciplineKey>('all')

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

  const elements = ELEMENT_BREAKDOWN[discipline]
  const maxElements = Math.max(...elements.map((e) => e.value))
  const disciplineTotal = useMemo(() => elements.reduce((s, e) => s + e.value, 0), [elements])

  const quantityTotal = useMemo(() => QUANTITIES.reduce((s, q) => s + q.quantity * q.rate, 0), [])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Boxes}
        accent={ACC}
        eyebrow="Intelligence Engines"
        title="BIM Intelligence"
        description="Parse, classify, clash-detect and quantify model data across IFC, Revit and DWG. Turn federated authoring files into a structured, queryable, AI-ready source of truth."
        actions={
          <>
            <Badge variant="brand" dot>
              IFC 2x3 · 4 · 4.3
            </Badge>
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

      {/* ----------------------------------------------------------- KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Models hosted" value={formatNumber(38_400)} delta="6.2%" deltaPositive icon={FileBox} accent="blue" sub="Across 12.8k projects" />
        <StatTile label="Objects classified" value="142M" delta="4.1%" deltaPositive icon={ScanSearch} accent="cyan" sub="Geometry + metadata" />
        <StatTile label="Open clashes" value={formatNumber(482)} delta="11.4%" deltaPositive icon={AlertTriangle} accent="rose" sub="Down week-over-week" />
        <StatTile label="Auto-quantified value" value={formatCurrency(quantityTotal)} delta="2.8%" deltaPositive icon={Calculator} accent="emerald" sub="Live BOQ estimate" />
        <StatTile label="Classification accuracy" value="97.4%" delta="0.9%" deltaPositive icon={Cpu} accent="violet" sub="OmniClass mapping" />
      </div>

      {/* ----------------------------------------- element breakdown by discipline */}
      <Card>
        <CardHeader
          title="Element-count breakdown"
          subtitle="Parsed objects grouped by category for the selected discipline"
          icon={Layers3}
          accent={ACC}
          action={<Tabs tabs={DISCIPLINE_TABS} active={discipline} onChange={(id) => setDiscipline(id as DisciplineKey)} />}
        />
        <div className="border-t border-edge/60 p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-sm text-slate-400">Total elements in scope</span>
            <span className="data-mono text-lg font-semibold text-slate-100">{formatNumber(disciplineTotal)}</span>
          </div>
          <div className="space-y-4">
            {elements.map((e) => (
              <div key={e.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{e.label}</span>
                  <span className="data-mono text-slate-400">{formatNumber(e.value, { compact: true })}</span>
                </div>
                <ProgressBar value={(e.value / maxElements) * 100} accent={e.accent} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ----------------------------------------------------- model federation */}
      <Card>
        <CardHeader
          title="Model federation"
          subtitle="Live status of authoring files merged into the federated model"
          icon={Workflow}
          accent={ACC}
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <RefreshCw className="h-3.5 w-3.5 text-blue-400" /> Auto-sync on
            </span>
          }
        />
        <div className="overflow-x-auto border-t border-edge/60">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">Model file</th>
                <th className="px-5 py-3 font-medium">Discipline</th>
                <th className="px-5 py-3 text-center font-medium">Version</th>
                <th className="px-5 py-3 text-right font-medium">Size</th>
                <th className="px-5 py-3 text-right font-medium">Elements</th>
                <th className="px-5 py-3 font-medium">Last sync</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {MODELS.map((m) => (
                <tr key={m.file} className="transition-colors hover:bg-elevated/40">
                  <td className="px-5 py-3 font-medium text-slate-200">{m.file}</td>
                  <td className="px-5 py-3 text-slate-400">{m.discipline}</td>
                  <td className="px-5 py-3 text-center"><span className="data-mono text-slate-300">{m.version}</span></td>
                  <td className="px-5 py-3 text-right data-mono text-slate-300">{m.size}</td>
                  <td className="px-5 py-3 text-right data-mono text-slate-300">{formatNumber(m.elements)}</td>
                  <td className="px-5 py-3 text-slate-400">{m.sync}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge variant={STATUS_VARIANT[m.status]} dot>
                      {m.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ------------------------------------------------- clash detection grid */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Clash matrix" subtitle="Inter-discipline collision counts" icon={GitCompare} accent="rose" />
          <div className="border-t border-edge/60 p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2" />
                    {CLASH_DISCIPLINES.map((d) => (
                      <th key={d} className="p-2 font-medium">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CLASH_DISCIPLINES.map((row) => (
                    <tr key={row}>
                      <th className="p-2 text-right font-medium text-slate-500">{row}</th>
                      {CLASH_DISCIPLINES.map((col) => {
                        const n = CLASH_GRID[row][col]
                        if (row === col) {
                          return (
                            <td key={col} className="p-1">
                              <div className="grid h-10 place-items-center rounded-lg bg-elevated/40 text-slate-700">—</div>
                            </td>
                          )
                        }
                        const sev = clashSeverity(n)
                        const a = ACCENT[sev.accent]
                        return (
                          <td key={col} className="p-1">
                            <div className={cn('grid h-10 place-items-center rounded-lg ring-1', a.bg, a.ring)}>
                              <span className={cn('data-mono font-semibold', a.text)}>{n}</span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> &lt;30</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> 30–79</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> 80+</span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Clashes detected vs resolved" subtitle="Rolling 8-week clash burndown" icon={AlertTriangle} accent="rose" />
          <div className="border-t border-edge/60 p-5">
            <LineTrend
              data={CLASH_TREND}
              xKey="week"
              series={[
                { key: 'detected', name: 'Detected', accent: 'rose' },
                { key: 'resolved', name: 'Resolved', accent: 'emerald' },
              ]}
              height={240}
              valueFormatter={(v) => formatNumber(v)}
            />
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------- quantity extraction */}
      <Card>
        <CardHeader
          title="Quantity extraction"
          subtitle="Model-derived takeoff with rate-linked cost estimates"
          icon={Ruler}
          accent="emerald"
          action={<Badge variant="success">Auto-quantified</Badge>}
        />
        <div className="overflow-x-auto border-t border-edge/60">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">Element type</th>
                <th className="px-5 py-3 text-right font-medium">Quantity</th>
                <th className="px-5 py-3 text-center font-medium">Unit</th>
                <th className="px-5 py-3 text-right font-medium">Unit rate</th>
                <th className="px-5 py-3 text-right font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {QUANTITIES.map((q) => (
                <tr key={q.type} className="transition-colors hover:bg-elevated/40">
                  <td className="px-5 py-3 font-medium text-slate-200">{q.type}</td>
                  <td className="px-5 py-3 text-right data-mono text-slate-300">{formatNumber(q.quantity)}</td>
                  <td className="px-5 py-3 text-center text-slate-400">{q.unit}</td>
                  <td className="px-5 py-3 text-right data-mono text-slate-400">{formatCurrency(q.rate, { compact: false })}</td>
                  <td className="px-5 py-3 text-right data-mono font-semibold text-slate-100">{formatCurrency(q.quantity * q.rate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-edge/60 bg-elevated/30">
                <td className="px-5 py-3 font-semibold text-slate-200" colSpan={4}>
                  Total estimated value
                </td>
                <td className="px-5 py-3 text-right data-mono text-base font-bold text-emerald-300">{formatCurrency(quantityTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ------------------------------------------------ object classification */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Object classification" subtitle="Share of classified objects by category" icon={ScanSearch} accent="violet" />
          <div className="border-t border-edge/60 p-5">
            <Donut data={OBJECT_CATEGORIES} valueFormatter={(v) => `${v}%`} />
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {OBJECT_CATEGORIES.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-2 w-2 rounded-full', ACCENT[c.accent].dot)} />
                  <span className="text-slate-400">{c.name}</span>
                  <span className="ml-auto data-mono text-slate-300">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Standard auto-mapping" subtitle="Crosswalked to industry classification systems" icon={CheckCircle2} accent="violet" />
          <div className="border-t border-edge/60 p-5">
            <p className="text-sm leading-relaxed text-slate-400">
              Every parsed object is auto-mapped to <span className="text-slate-200">OmniClass</span>,{' '}
              <span className="text-slate-200">Uniclass 2015</span> and <span className="text-slate-200">CoClass</span> with a
              per-object confidence score. Low-confidence matches are routed to human review before they enter the lakehouse.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-edge/60 bg-elevated/30 p-4">
                <RingProgress value={97.4} accent="violet" label={<span className="data-mono text-sm font-semibold text-violet-300">97%</span>} />
                <span className="text-xs text-slate-400">OmniClass</span>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-edge/60 bg-elevated/30 p-4">
                <RingProgress value={94.1} accent="blue" label={<span className="data-mono text-sm font-semibold text-blue-300">94%</span>} />
                <span className="text-xs text-slate-400">Uniclass 2015</span>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-edge/60 bg-elevated/30 p-4">
                <RingProgress value={91.8} accent="teal" label={<span className="data-mono text-sm font-semibold text-teal-300">92%</span>} />
                <span className="text-xs text-slate-400">CoClass</span>
              </div>
            </div>
            <div className="mt-5 space-y-1 border-t border-edge/50 pt-4">
              <KeyValue label="Objects pending review" value="3.1M" mono />
              <KeyValue label="Avg. confidence" value="96.2%" mono />
              <KeyValue label="Unmapped property sets" value="0.7%" mono />
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------ AI capabilities */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-blue-400" />
          <h3 className="text-[15px] font-semibold text-slate-100">AI capabilities</h3>
          <Badge variant="brand">Model-native</Badge>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {AI_CAPABILITIES.map((c) => (
            <FeatureRow key={c.title} icon={c.icon} title={c.title} accent={c.accent}>
              {c.body}
            </FeatureRow>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ----------------------------------------------- parsed-IFC results panel */
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
