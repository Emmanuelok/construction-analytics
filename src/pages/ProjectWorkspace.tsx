import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building,
  Gauge,
  Wallet,
  Timer,
  Leaf,
  RotateCcw,
  Sparkles,
  ArrowRight,
  CalendarClock,
  HardHat,
  Boxes,
  ShieldAlert,
  Ruler,
  Download,
  FileJson,
} from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge } from '@/components/ui'
import { RadarViz } from '@/components/charts'
const BuildingViewer = lazy(() => import('@/components/BuildingViewer').then((m) => ({ default: m.BuildingViewer })))
import { COLOR_MODES, SHAPE_KINDS, buildMassing, massingSchedule, type ColorMode, type ShapeKind } from '@/lib/massing'
import { unitShape } from '@/lib/shapes'
import { type Pt } from '@/lib/zoning'
import { PolygonEditor } from '@/components/PolygonEditor'
import { PROJECTS, type Project } from '@/data/platform'
import { deriveProjectModel, projectNarrative, type ProjectVitals, type ProjectModel } from '@/lib/project-model'
import { formatMoney } from '@/lib/evm'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import { ExportMenu } from '@/components/ExportMenu'
import { ScrollableTable } from '@/components/ScrollableTable'
import { downloadText, slug } from '@/lib/download'
import { CollabBar } from '@/components/CollabBar'
import { kpiToItem, tableToCsv, type ReportSpec, type ReportTable } from '@/lib/report'
import type { KPI } from '@/lib/scenarios'

const ACCENT_NAME: Accent = 'blue'
const SEL_KEY = 'aec-active-project'

const toVitals = (p: Project): ProjectVitals => ({
  id: p.id, name: p.name, sector: p.sector, location: p.location,
  value: p.value, gfa: p.gfa, progress: p.progress,
  costVariance: p.costVariance, scheduleVariance: p.scheduleVariance,
  risk: p.risk, safety: p.safety, quality: p.quality, carbon: p.carbon,
  rfis: p.rfis, clashes: p.clashes,
})

const STATUS: Record<ProjectModel['status'], { label: string; variant: 'success' | 'warn' | 'danger'; accent: Accent }> = {
  healthy: { label: 'On track', variant: 'success', accent: 'emerald' },
  watch: { label: 'On watch', variant: 'warn', accent: 'amber' },
  'at-risk': { label: 'At risk', variant: 'danger', accent: 'rose' },
}

const LENSES: { to: string; label: string; icon: typeof CalendarClock; accent: Accent }[] = [
  { to: '/cost-schedule', label: 'Cost & Schedule', icon: CalendarClock, accent: 'rose' },
  { to: '/sustainability', label: 'Sustainability', icon: Leaf, accent: 'emerald' },
  { to: '/field', label: 'Construction Analytics', icon: HardHat, accent: 'amber' },
  { to: '/bim', label: 'BIM Intelligence', icon: Boxes, accent: 'blue' },
  { to: '/insights', label: 'Executive Insights', icon: Gauge, accent: 'cyan' },
]

const DIM_TARGET = 90

export default function ProjectWorkspace() {
  const initialId = (() => { try { return localStorage.getItem(SEL_KEY) || PROJECTS[0].id } catch { return PROJECTS[0].id } })()
  const [projectId, setProjectId] = useState(initialId)
  const baseProject = useMemo(() => PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0], [projectId])
  const [vitals, setVitals] = useState<ProjectVitals>(() => toVitals(PROJECTS.find((p) => p.id === initialId) ?? PROJECTS[0]))
  const [edited, setEdited] = useState(false)
  const { scenarios, save, remove, importRaw } = useScenarios('project')

  const selectProject = (id: string) => {
    const p = PROJECTS.find((x) => x.id === id) ?? PROJECTS[0]
    setProjectId(id)
    setVitals(toVitals(p))
    setEdited(false)
    try { localStorage.setItem(SEL_KEY, id) } catch { /* ignore */ }
  }
  const setV = (patch: Partial<ProjectVitals>) => { setVitals((v) => ({ ...v, ...patch })); setEdited(true) }
  const reset = () => { setVitals(toVitals(baseProject)); setEdited(false) }

  const [colorMode, setColorMode] = useState<ColorMode>('progress')
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  // massing form — real shapes + vertical articulation, not just a square stack
  const [shape, setShape] = useState<ShapeKind>('rect')
  const [customShape, setCustomShape] = useState<Pt[]>(() => unitShape('custom').map((p) => ({ x: p.x * 24, z: p.z * 24 })))
  const [towerShape, setTowerShape] = useState<ShapeKind | undefined>(undefined)
  const [aspect, setAspect] = useState(1)
  const [taper, setTaper] = useState(0.2)
  const [podium, setPodium] = useState(0)
  const [towerSetback, setTowerSetback] = useState(0.35)
  const [twist, setTwist] = useState(0)
  // takeoff assumptions for the schedule/quantities
  const [storeyHeight, setStoreyHeight] = useState(3.6)
  const [slabThickness, setSlabThickness] = useState(0.3)

  const massingInput = { gfa: vitals.gfa, progress: vitals.progress, shape, customShape, towerShape, aspect, taper, podium, towerSetback, twist }
  const massing = useMemo(() => buildMassing(massingInput), [vitals.gfa, vitals.progress, shape, customShape, towerShape, aspect, taper, podium, towerSetback, twist])
  const sched = useMemo(() => massingSchedule(massing, { storeyHeight, slabThickness }), [massing, storeyHeight, slabThickness])
  const schedCsv = () => tableToCsv({
    title: `${vitals.name} — Massing schedule`,
    columns: ['Level', 'Elevation (m)', 'Plate area (m2)', 'Perimeter (m)', 'Facade (m2)', 'Volume (m3)', 'Status'],
    rows: sched.floors.slice().reverse().map((f) => [f.label, f.elevation, Math.round(f.area), Math.round(f.perimeter), Math.round(f.facade), Math.round(f.volume), f.built ? 'Built' : 'Planned']),
  })
  const m = useMemo(() => deriveProjectModel(vitals), [vitals])

  // the project-level metric the 3D model colours floors by, per mode
  const colorMetric =
    colorMode === 'risk' ? vitals.risk
    : colorMode === 'safety' ? vitals.safety
    : colorMode === 'carbon' ? vitals.carbon
    : colorMode === 'status' ? m.health
    : 0

  const summary: KPI[] = [
    { label: 'Composite health', value: m.health },
    { label: 'CPI', value: m.evm.cpi },
    { label: 'Forecast EAC', value: m.evm.eac, unit: '$' },
    { label: 'Carbon intensity', value: m.carbonIntensity },
  ]
  const radar = [
    { metric: 'Cost', score: m.dims.cost, target: DIM_TARGET },
    { metric: 'Schedule', score: m.dims.schedule, target: DIM_TARGET },
    { metric: 'Risk', score: m.dims.risk, target: DIM_TARGET },
    { metric: 'Safety', score: m.dims.safety, target: DIM_TARGET },
    { metric: 'Quality', score: m.dims.quality, target: DIM_TARGET },
    { metric: 'Carbon', score: m.dims.carbon, target: DIM_TARGET },
  ]
  const reportTable: ReportTable = {
    title: 'Performance scorecard',
    columns: ['Dimension', 'Score (0–100)'],
    rows: [['Cost', m.dims.cost], ['Schedule', m.dims.schedule], ['Risk', m.dims.risk], ['Safety', m.dims.safety], ['Quality', m.dims.quality], ['Carbon', m.dims.carbon]],
  }
  const reportSpec: ReportSpec = {
    title: `${vitals.name} — Project Brief`,
    subtitle: `${vitals.sector} · ${vitals.location}`,
    module: 'project',
    kpis: summary.map(kpiToItem),
    narrative: projectNarrative(m),
    table: reportTable,
  }
  const st = STATUS[m.status]

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Building}
        accent={ACCENT_NAME}
        eyebrow="Studio"
        title="Project Workspace"
        description="One project, every lens. Pick a project and edit its vitals — earned value, the six-dimension health scorecard and the carbon rating recompute together, from one coherent dataset. Then open any workbench to go deeper."
        actions={
          <>
            <select
              value={projectId}
              onChange={(e) => selectProject(e.target.value)}
              aria-label="Select project"
              className="rounded-lg border border-edge/70 bg-elevated/60 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none"
            >
              {PROJECTS.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
            {edited && <button onClick={reset} className="btn-ghost"><RotateCcw className="h-4 w-4" /> Reset</button>}
            <Badge variant={st.variant} dot>{st.label}</Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            onImport={importRaw}
            module="project"
            accent={ACCENT_NAME}
            scenarios={scenarios}
            onSave={(name) => save(name, { projectId, vitals, form: { shape, customShape, towerShape, aspect, taper, podium, towerSetback, twist } }, summary)}
            onLoad={(s) => {
              const d = s.data as { projectId?: string; vitals?: ProjectVitals; form?: Partial<{ shape: ShapeKind; customShape: Pt[]; towerShape: ShapeKind; aspect: number; taper: number; podium: number; towerSetback: number; twist: number }> }
              if (d.projectId) setProjectId(d.projectId)
              if (d.vitals) { setVitals(d.vitals); setEdited(true) }
              const f = d.form
              if (f) {
                if (f.shape) setShape(f.shape)
                if (f.customShape) setCustomShape(f.customShape)
                setTowerShape(f.towerShape)
                if (typeof f.aspect === 'number') setAspect(f.aspect)
                if (typeof f.taper === 'number') setTaper(f.taper)
                if (typeof f.podium === 'number') setPodium(f.podium)
                if (typeof f.towerSetback === 'number') setTowerSetback(f.towerSetback)
                if (typeof f.twist === 'number') setTwist(f.twist)
              }
            }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent={ACCENT_NAME} spec={reportSpec} csv={reportTable} />
      </div>

      <CollabBar subject={`project:${projectId}`} accent={ACCENT_NAME} />

      {/* unified KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Composite health" value={`${m.health}`} icon={Gauge} accent={st.accent} sub={`${st.label} · exposure ${formatMoney(m.exposure)}`} />
        <StatTile label="Cost index (CPI)" value={m.evm.cpi.toFixed(2)} icon={Wallet} accent={m.evm.cpi >= 1 ? 'emerald' : 'rose'} sub={m.evm.cpi >= 1 ? 'under budget' : 'over budget'} />
        <StatTile label="Schedule index (SPI)" value={m.evm.spi.toFixed(2)} icon={Timer} accent={m.evm.spi >= 1 ? 'emerald' : 'amber'} sub={m.evm.spi >= 1 ? 'ahead' : 'behind'} />
        <StatTile label="Forecast (EAC)" value={formatMoney(m.evm.eac)} icon={Wallet} accent={m.evm.vac < 0 ? 'rose' : 'emerald'} sub={`VAC ${formatMoney(m.evm.vac)}`} />
        <StatTile label="Embodied carbon" value={`${formatNumber(m.carbonIntensity)}`} icon={Leaf} accent={m.carbonRating === 'A' || m.carbonRating === 'B' ? 'emerald' : m.carbonRating === 'C' ? 'amber' : 'rose'} sub={`kgCO₂e/m² · rating ${m.carbonRating}`} />
      </div>

      {/* real 3D building model — driven by GFA / storeys / % complete, coloured by analytics */}
      <Card className="overflow-hidden">
        <CardHeader
          icon={Boxes}
          accent={ACCENT_NAME}
          title="3D building model"
          subtitle="Orbit · scroll to zoom · click a floor. Colour shows the selected analytics layer; in 4D mode, solid floors are built and ghosted floors are planned."
          action={
            <div className="flex flex-wrap gap-1.5">
              {COLOR_MODES.map((cm) => (
                <button
                  key={cm.id}
                  onClick={() => setColorMode(cm.id)}
                  className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', colorMode === cm.id ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}
                >
                  {cm.label}
                </button>
              ))}
            </div>
          }
        />
        <div className="grid gap-0 border-t border-edge/50 lg:grid-cols-[1.6fr_1fr]">
          <Suspense fallback={<div style={{ height: 460 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
            <BuildingViewer input={massingInput} mode={colorMode} metric={colorMetric} selected={selectedFloor} onSelectFloor={setSelectedFloor} height={460} />
          </Suspense>
          <div className="flex flex-col gap-3 border-t border-edge/50 p-4 lg:border-l lg:border-t-0">
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Footprint shape</div>
              <div className="flex flex-wrap gap-1.5">
                {SHAPE_KINDS.map((s) => (
                  <button key={s.id} onClick={() => setShape(s.id)} aria-pressed={shape === s.id}
                    className={cn('rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors', shape === s.id ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {shape === 'custom' && <PolygonEditor value={customShape} onChange={setCustomShape} accent="#60a5fa" height={200} />}
            {shape !== 'custom' && <Slider label="Aspect ratio" value={aspect} min={0.4} max={2.5} step={0.05} onChange={setAspect} fmt={(v) => `${v.toFixed(2)}:1`} />}
            <Slider label="Taper" value={taper} min={0} max={0.6} step={0.02} onChange={setTaper} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Podium" value={podium} min={0} max={0.8} step={0.05} onChange={setPodium} fmt={(v) => (v === 0 ? 'none' : `${Math.round(v * 100)}%`)} />
            <Slider label="Tower setback" value={towerSetback} min={0} max={0.6} step={0.02} onChange={setTowerSetback} fmt={(v) => `${Math.round(v * 100)}%`} />
            {podium > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Tower shape (above podium)</div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setTowerShape(undefined)} aria-pressed={!towerShape} className={cn('rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors', !towerShape ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}>Same</button>
                  {SHAPE_KINDS.filter((s) => s.id !== 'custom').map((s) => (
                    <button key={s.id} onClick={() => setTowerShape(s.id)} aria-pressed={towerShape === s.id} className={cn('rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors', towerShape === s.id ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}>{s.label}</button>
                  ))}
                </div>
              </div>
            )}
            <Slider label="Twist / floor" value={twist} min={0} max={8} step={0.5} onChange={setTwist} fmt={(v) => `${v}°`} />
            {selectedFloor !== null && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5">
                <div className="text-[11px] uppercase tracking-wide text-blue-300/80">Selected floor · {selectedFloor === 0 ? 'Ground' : `Level ${selectedFloor}`}</div>
                <div className="text-xs text-slate-400">{selectedFloor < Math.round((vitals.progress / 100) * Math.max(1, Math.round(vitals.gfa / 2500))) ? 'Built' : 'Planned'}</div>
              </div>
            )}
            <div className="mt-auto text-[11px] leading-relaxed text-slate-500">
              {Math.max(1, Math.round(vitals.gfa / 2500))} storeys · {formatNumber(vitals.gfa)} m² · {vitals.progress}% built. Full IFC mesh geometry renders in BIM Intelligence.
            </div>
          </div>
        </div>
      </Card>

      {/* schedule & quantities — structured data extracted from the 3D massing */}
      <Card>
        <CardHeader
          icon={Ruler}
          accent="cyan"
          title="Massing schedule & quantities"
          subtitle="Per-floor areas, perimeters, façade and volumes derived from the model geometry — tune the takeoff assumptions and export"
          action={
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => downloadText(`${slug(vitals.name)}-massing-schedule.csv`, schedCsv(), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
              <button onClick={() => downloadText(`${slug(vitals.name)}-massing.json`, JSON.stringify({ project: vitals.name, target_gfa: vitals.gfa, ...sched }, null, 2), 'JSON')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileJson className="h-3.5 w-3.5" /> JSON</button>
            </div>
          }
        />
        <div className="space-y-5 border-t border-edge/50 p-5">
          <div className="flex flex-wrap items-end gap-5">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Storey height (m)</span>
              <input type="number" step={0.1} value={storeyHeight} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setStoreyHeight(Math.max(2, n)) }} className="w-28 rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 data-mono focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Slab thickness (m)</span>
              <input type="number" step={0.05} value={slabThickness} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setSlabThickness(Math.max(0, n)) }} className="w-28 rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 data-mono focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
            </label>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">Quantities scale with the form — taper, podium/tower setback and the courtyard void all change the modeled GFA, façade and concrete below.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <DataTile label="Modeled GFA" value={`${formatNumber(Math.round(sched.grossFloorArea))} m²`} accent="cyan" sub={`${Math.round((sched.grossFloorArea / Math.max(1, vitals.gfa)) * 100)}% of ${formatNumber(vitals.gfa)} target`} />
            <DataTile label="Footprint" value={`${formatNumber(Math.round(sched.footprint))} m²`} accent="blue" sub={`${sched.storeys} storeys`} />
            <DataTile label="Building height" value={`${formatNumber(sched.height)} m`} accent="violet" sub={`${storeyHeight} m / storey`} />
            <DataTile label="Gross volume" value={`${formatNumber(Math.round(sched.grossVolume))} m³`} accent="teal" />
            <DataTile label="Façade area" value={`${formatNumber(Math.round(sched.facadeArea))} m²`} accent="amber" sub="incl. any atrium" />
            <DataTile label="Slab concrete" value={`${formatNumber(Math.round(sched.slabVolume))} m³`} accent="rose" sub={`@ ${slabThickness} m`} />
            <DataTile label="Built area (4D)" value={`${formatNumber(Math.round(sched.builtArea))} m²`} accent="emerald" sub={`${Math.round((sched.builtArea / Math.max(1, sched.grossFloorArea)) * 100)}% complete`} />
            <DataTile label="Planned area" value={`${formatNumber(Math.round(sched.plannedArea))} m²`} accent="sky" />
            <DataTile label="Built volume" value={`${formatNumber(Math.round(sched.builtVolume))} m³`} accent="lime" />
            <DataTile label="Avg plate" value={`${formatNumber(Math.round(sched.avgPlate))} m²`} accent="cyan" />
            <DataTile label="Roof area" value={`${formatNumber(Math.round(sched.roofArea))} m²`} accent="violet" />
            <DataTile label="Floors" value={`${sched.storeys}`} accent="blue" sub={`G–L${sched.storeys - 1}`} />
          </div>

          <ScrollableTable label="Floor schedule" className="rounded-xl border border-edge/60">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Level</th>
                  <th className="px-3 py-2.5 text-right font-medium">Elev (m)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Plate (m²)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Perimeter (m)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Façade (m²)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Volume (m³)</th>
                  <th className="px-3 py-2.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/40">
                {sched.floors.slice().reverse().map((f) => (
                  <tr key={f.index} className="hover:bg-elevated/30">
                    <td className="px-4 py-2 font-medium text-slate-200">{f.label}</td>
                    <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(f.elevation)}</td>
                    <td className="px-3 py-2 text-right data-mono text-slate-300">{formatNumber(Math.round(f.area))}</td>
                    <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(Math.round(f.perimeter))}</td>
                    <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(Math.round(f.facade))}</td>
                    <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(Math.round(f.volume))}</td>
                    <td className="px-3 py-2 text-center"><Badge variant={f.built ? 'success' : 'neutral'} dot>{f.built ? 'Built' : 'Planned'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* editable vitals */}
        <Card className="lg:col-span-3">
          <CardHeader icon={Building} accent={ACCENT_NAME} title="Project vitals — editable" subtitle="Edit any driver; every lens above and the scorecard recompute live" />
          <div className="grid grid-cols-2 gap-5 border-t border-edge/50 p-5 sm:grid-cols-3">
            <Param label="Budget (value)" unit="$" value={vitals.value} step={10_000_000} onChange={(v) => setV({ value: Math.max(0, v) })} />
            <Param label="GFA" unit="m²" value={vitals.gfa} step={1000} onChange={(v) => setV({ gfa: Math.max(0, v) })} />
            <Param label="% complete" unit="0–100" value={vitals.progress} step={1} onChange={(v) => setV({ progress: clamp(v) })} />
            <Param label="Cost variance" unit="%" value={vitals.costVariance} step={0.5} onChange={(v) => setV({ costVariance: v })} />
            <Param label="Schedule slip" unit="days" value={vitals.scheduleVariance} step={1} onChange={(v) => setV({ scheduleVariance: v })} />
            <Param label="Embodied carbon" unit="kgCO₂e/m²" value={vitals.carbon} step={10} onChange={(v) => setV({ carbon: Math.max(0, v) })} />
            <Param label="Risk index" unit="0–100" value={vitals.risk} step={1} onChange={(v) => setV({ risk: clamp(v) })} />
            <Param label="Safety" unit="0–100" value={vitals.safety} step={1} onChange={(v) => setV({ safety: clamp(v) })} />
            <Param label="Quality" unit="0–100" value={vitals.quality} step={1} onChange={(v) => setV({ quality: clamp(v) })} />
          </div>
        </Card>

        {/* scorecard */}
        <Card className="lg:col-span-2">
          <CardHeader icon={Gauge} accent={ACCENT_NAME} title="Performance scorecard" subtitle="Six dimensions vs a 90 target" />
          <div className="px-3 pb-5 pt-2">
            <RadarViz data={radar} series={[{ key: 'score', name: vitals.name, accent: 'blue' }, { key: 'target', name: 'Target', accent: 'violet' }]} height={300} />
          </div>
        </Card>
      </div>

      {/* earned value detail */}
      <Card>
        <CardHeader icon={Wallet} accent="rose" title="Earned value detail" subtitle="Computed from budget, % complete and variances" />
        <div className="grid grid-cols-2 gap-px border-t border-edge/50 bg-edge/40 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: 'Planned value', v: formatMoney(m.evm.pv) },
            { k: 'Earned value', v: formatMoney(m.evm.ev) },
            { k: 'Actual cost', v: formatMoney(m.evm.ac) },
            { k: 'Cost variance', v: formatMoney(m.evm.cv) },
            { k: 'Schedule variance', v: formatMoney(m.evm.sv) },
            { k: 'TCPI', v: m.evm.tcpi.toFixed(2) },
          ].map((x) => (
            <div key={x.k} className="bg-panel/80 p-4">
              <div className="text-lg font-bold text-slate-50 data-mono">{x.v}</div>
              <div className="mt-1 text-xs text-slate-500">{x.k}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* open in workbench */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300"><ArrowRight className="h-4 w-4 text-blue-400" /> Go deeper in a workbench</div>
        <div className="flex flex-wrap gap-2.5">
          {LENSES.map((l) => {
            const a = ACCENT[l.accent]
            return (
              <Link key={l.to} to={l.to} className={cn('inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors', 'border-edge/60 bg-elevated/40 text-slate-200 hover:bg-elevated/70')}>
                <span className={cn('grid h-6 w-6 place-items-center rounded-lg', a.bg)}><l.icon className={cn('h-3.5 w-3.5', a.text)} /></span>
                {l.label}
                <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              </Link>
            )
          })}
        </div>
      </Card>

      {/* read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACCENT_NAME} title="Project read-out" subtitle="Computed from the current vitals" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{projectNarrative(m)}</p>
          {(vitals.rfis > 1500 || vitals.clashes > 60 || m.status === 'at-risk') && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {m.status === 'at-risk' && <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300"><ShieldAlert className="h-3 w-3" /> Composite health {m.health} — recovery review</span>}
              {vitals.rfis > 1500 && <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">{vitals.rfis.toLocaleString()} open RFIs</span>}
              {vitals.clashes > 60 && <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">{vitals.clashes} clashes</span>}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function DataTile({ label, value, accent, sub }: { label: string; value: string; accent: Accent; sub?: string }) {
  const a = ACCENT[accent]
  return (
    <div className={cn('rounded-xl p-3 ring-1', a.bg, a.ring)}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={cn('data-mono text-base font-semibold', a.text)}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{sub}</div>}
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="data-mono text-slate-200">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-full cursor-pointer accent-blue-500" aria-label={label} />
    </label>
  )
}

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
        className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-3 py-1.5 text-sm text-slate-100 data-mono focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
      />
    </label>
  )
}
