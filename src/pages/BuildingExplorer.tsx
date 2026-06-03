import { lazy, Suspense, useMemo, useState } from 'react'
import { Boxes, Layers, Building2, Download, FileJson, Table2, MousePointerClick, Eye, Columns3, SquareStack, Box as BoxIcon, PanelsTopLeft } from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, Tabs } from '@/components/ui'
import { ScrollableTable } from '@/components/ScrollableTable'
const ComponentBuildingViewer = lazy(() => import('@/components/ComponentBuildingViewer').then((m) => ({ default: m.ComponentBuildingViewer })))
const IfcExplorer = lazy(() => import('@/components/IfcExplorer').then((m) => ({ default: m.IfcExplorer })))
import { FloorPlan } from '@/components/FloorPlan'
import { buildMassing, deriveStoreys, SHAPE_KINDS, type ShapeKind } from '@/lib/massing'
import { buildBuilding } from '@/lib/building'
import { explodeBuilding, planForLevel, type Schedule, type ScheduleCol, type BuildingElement } from '@/lib/building-explorer'
import { PROJECTS } from '@/data/platform'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { downloadText, slug } from '@/lib/download'

const SEL_KEY = 'aec-active-project'
const CAT_ICON: Record<string, typeof Columns3> = { Floor: SquareStack, Column: Columns3, 'Curtain Panel': PanelsTopLeft, Core: BoxIcon, Roof: SquareStack }

const fmtCell = (v: number | string) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v)
const csvCell = (v: number | string) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function csvFor(s: Schedule): string {
  const head = s.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)).join(',')
  const rows = s.rows.map((r) => s.columns.map((c) => csvCell(r[c.key])).join(','))
  const totals = s.columns.map((c, i) => (c.total ? String(s.totals[c.key] ?? '') : i === 0 ? 'TOTAL' : '')).join(',')
  return [head, ...rows, totals].join('\n')
}

export default function BuildingExplorer() {
  const initialId = (() => { try { return localStorage.getItem(SEL_KEY) || PROJECTS[0].id } catch { return PROJECTS[0].id } })()
  const [projectId, setProjectId] = useState(initialId)
  const project = useMemo(() => PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0], [projectId])

  const [source, setSource] = useState<'parametric' | 'ifc'>('parametric')
  const [storeys, setStoreys] = useState(() => deriveStoreys(project.gfa))
  const [shape, setShape] = useState<ShapeKind>('rect')
  const [aspect, setAspect] = useState(1)
  const [storeyHeight, setStoreyHeight] = useState(3.6)
  const [columnSection, setColumnSection] = useState(0.6)
  const [slabThickness, setSlabThickness] = useState(0.3)

  const [activeLevel, setActiveLevel] = useState(0)
  const [isolate, setIsolate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [schedTab, setSchedTab] = useState('Floor')
  const [hidden, setHidden] = useState<{ glazing?: boolean; structure?: boolean; slabs?: boolean }>({})

  const model = useMemo(() => buildBuilding(buildMassing({ gfa: project.gfa, progress: 100, storeys, shape: shape === 'custom' ? 'rect' : shape, aspect }), { coreRatio: 0.16 }), [project.gfa, storeys, shape, aspect])
  const ex = useMemo(() => explodeBuilding(model, { storeyHeight, slabThickness, columnSection }), [model, storeyHeight, slabThickness, columnSection])
  const plan = useMemo(() => planForLevel(model, activeLevel), [model, activeLevel])
  const selectedEl: BuildingElement | null = selectedId ? ex.byId[selectedId] ?? null : null
  const activeSchedule = ex.schedules.find((s) => s.category === schedTab) ?? ex.schedules[0]

  const selectEl = (id: string | null) => {
    setSelectedId(id)
    if (!id) return
    const el = ex.byId[id]
    if (el && el.level >= 0 && el.level <= storeys) { setActiveLevel(el.level); setSchedTab(el.category === 'Roof' ? 'Floor' : el.category) }
  }
  const gotoLevel = (i: number) => { setActiveLevel(i); setIsolate(true) }

  const exportAll = () => downloadText(`${slug(project.name)}-building-model.json`, JSON.stringify({ project: project.name, parameters: ex.opts, summary: ex.summary, levels: ex.levels, schedules: ex.schedules.map((s) => ({ group: s.group, rows: s.rows, totals: s.totals })) }, null, 2), 'JSON')

  const activeLevelInfo = ex.levels.find((l) => l.index === activeLevel)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Boxes}
        eyebrow="BIM review"
        title="Building Explorer"
        description="Review a building floor by floor and element by element — like a model browser. Isolate any level, click any element to inspect its data, and open the full schedules. Use a generated model, or upload your own IFC/Revit export."
        accent="blue"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60">
              {([['parametric', 'Generated'], ['ifc', 'IFC model']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setSource(id)} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', source === id ? 'bg-blue-500/20 text-blue-100' : 'text-slate-400 hover:bg-elevated/50 hover:text-slate-200')}>{label}</button>
              ))}
            </div>
            {source === 'parametric' && <>
              <label className="sr-only" htmlFor="explorer-project">Project</label>
              <select id="explorer-project" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSelectedId(null) }} className="rounded-lg border border-edge/60 bg-elevated/50 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none">
                {PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={exportAll} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileJson className="h-4 w-4" /> Export model JSON</button>
            </>}
          </div>
        }
      />

      {source === 'ifc' ? (
        <Suspense fallback={<div className="grid h-64 place-items-center text-sm text-slate-500">Loading IFC explorer…</div>}><IfcExplorer /></Suspense>
      ) : (
      <>
      {/* summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Storeys" value={String(ex.summary.storeys)} accent="blue" />
        <StatTile label="Elements" value={formatNumber(ex.summary.elements)} accent="cyan" />
        <StatTile label="Columns" value={formatNumber(ex.summary.columns)} accent="violet" />
        <StatTile label="Curtain panels" value={formatNumber(ex.summary.panels)} accent="sky" />
        <StatTile label="Gross floor area" value={`${formatNumber(ex.summary.gfa)} m²`} accent="emerald" />
        <StatTile label="Concrete (slab+col)" value={`${formatNumber(ex.summary.concreteVolume)} m³`} accent="amber" />
      </div>

      {/* model parameters */}
      <Card>
        <CardHeader icon={Building2} accent="blue" title="Model parameters" subtitle="The building is generated from the project GFA and these assumptions; every schedule quantity updates live." />
        <div className="grid gap-4 border-t border-edge/50 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Footprint shape</div>
            <div className="flex flex-wrap gap-1.5">
              {SHAPE_KINDS.filter((s) => s.id !== 'custom').map((s) => (
                <button key={s.id} onClick={() => setShape(s.id)} aria-pressed={shape === s.id} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', shape === s.id ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}>{s.label}</button>
              ))}
            </div>
          </div>
          <Field label="Storeys" value={storeys} min={1} max={60} step={1} onChange={(v) => { setStoreys(v); if (activeLevel > v) setActiveLevel(0) }} />
          <Field label="Plan aspect" value={aspect} min={0.4} max={2.5} step={0.05} onChange={setAspect} fmt={(v) => `${v.toFixed(2)}:1`} />
          <Field label="Storey height" unit="m" value={storeyHeight} min={2.5} max={6} step={0.1} onChange={setStoreyHeight} />
          <Field label="Column section" unit="m" value={columnSection} min={0.2} max={1.5} step={0.05} onChange={setColumnSection} />
          <Field label="Slab thickness" unit="m" value={slabThickness} min={0.1} max={0.6} step={0.05} onChange={setSlabThickness} />
        </div>
      </Card>

      {/* 3D model + level navigator */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={Eye} accent="blue" title="3D model" subtitle="Click any slab, column, panel or the core to inspect it. Use the levels panel to isolate a single floor."
            action={
              <div className="flex flex-wrap items-center gap-2">
                {isolate && <Badge variant="cyan">Isolated · {activeLevelInfo?.name ?? `Level ${activeLevel}`}</Badge>}
                <button onClick={() => setIsolate(false)} disabled={!isolate} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', isolate ? 'text-slate-300 ring-edge/60 hover:bg-elevated/50' : 'cursor-default text-slate-600 ring-edge/40')}>Whole building</button>
                <div className="flex flex-wrap gap-1.5">
                  {([['glazing', 'Façade'], ['structure', 'Structure'], ['slabs', 'Slabs']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setHidden((h) => ({ ...h, [k]: !h[k] }))} aria-pressed={!hidden[k]} className={cn('rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors', hidden[k] ? 'text-slate-500 ring-edge/60' : 'bg-blue-500/15 text-blue-200 ring-blue-500/40')}>{label}</button>
                  ))}
                </div>
              </div>
            }
          />
          <div className="border-t border-edge/50">
            <Suspense fallback={<div style={{ height: 460 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
              <ComponentBuildingViewer model={model} hidden={hidden} isolateLevel={isolate ? activeLevel : null} selected={selectedId} onSelect={selectEl} height={460} />
            </Suspense>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={Layers} accent="cyan" title="Levels" subtitle="Top-down. Click to isolate a floor & load its plan." />
          <div className="max-h-[460px] overflow-y-auto border-t border-edge/50">
            <ul className="divide-y divide-edge/40">
              {[...ex.levels].reverse().map((l) => {
                const on = l.index === activeLevel
                return (
                  <li key={l.index}>
                    <button onClick={() => gotoLevel(l.index)} aria-pressed={on} className={cn('flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors', on ? 'bg-blue-500/10' : 'hover:bg-elevated/40')}>
                      <div className="min-w-0">
                        <div className={cn('truncate text-sm font-medium', on ? 'text-blue-100' : 'text-slate-200')}>{l.name}</div>
                        <div className="data-mono text-[11px] text-slate-500">+{l.elevation.toFixed(1)} m · {formatNumber(l.area)} m²</div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-slate-500">
                        {l.isRoof ? <span className="text-slate-500">roof</span> : <>{l.columns} col · {l.panels} pan</>}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>
      </div>

      {/* floor plan + element inspector */}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader icon={Table2} accent="teal" title={`Floor plan — ${activeLevelInfo?.name ?? `Level ${activeLevel}`}`} subtitle="Plan of the active level. Click a column or panel to inspect it; the selection syncs with the 3D model & schedules." />
          <div className="border-t border-edge/50 p-4">
            <FloorPlan plan={plan} selected={selectedId} onSelect={selectEl} height={340} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" /> Column</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-sky-400" /> Curtain panel</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 border border-slate-500 bg-slate-600/40" /> Core</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Selected</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={MousePointerClick} accent="violet" title="Element inspector" subtitle="Properties & quantities of the selected element." />
          <div className="border-t border-edge/50 p-5">
            {selectedEl ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  {(() => { const Icon = CAT_ICON[selectedEl.category] ?? BoxIcon; return <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', ACCENT.blue.bg)}><Icon className={cn('h-4 w-4', ACCENT.blue.text)} /></span> })()}
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{selectedEl.title}</div>
                    <div className="data-mono text-[11px] text-slate-500">{selectedEl.mark} · {selectedEl.levelName}</div>
                  </div>
                  <Badge variant="neutral" className="ml-auto">{selectedEl.category}</Badge>
                </div>
                <dl className="divide-y divide-edge/40 rounded-lg ring-1 ring-edge/50">
                  {selectedEl.cols.filter((c) => c.key !== 'mark' && c.key !== 'level').map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-4 px-3 py-2">
                      <dt className="text-xs text-slate-400">{c.label}</dt>
                      <dd className="data-mono text-sm font-medium text-slate-200">{fmtCell(selectedEl.data[c.key])}{c.unit ? ` ${c.unit}` : ''}</dd>
                    </div>
                  ))}
                </dl>
                <button onClick={() => selectEl(null)} className="mt-3 text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">Clear selection</button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <MousePointerClick className="h-7 w-7 text-slate-600" />
                <p className="text-sm text-slate-400">Click any element in the 3D model, the plan, or a schedule row to inspect its full data.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* schedules */}
      <Card>
        <CardHeader
          icon={Table2} accent="cyan" title="Schedules" subtitle="Every element, scheduled with real quantities. Click a row to locate it; export any schedule."
          action={<button onClick={() => downloadText(`${slug(project.name)}-${slug(activeSchedule.group)}.csv`, csvFor(activeSchedule), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="border-t border-edge/50 p-4">
          <Tabs tabs={ex.schedules.map((s) => ({ id: s.category, label: `${s.group} (${s.rows.length})` }))} active={schedTab} onChange={setSchedTab} className="mb-3" />
          <ScrollableTable label={`${activeSchedule.group} schedule`}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">
                  {activeSchedule.columns.map((c) => <th key={c.key} className={cn('px-3 py-2 font-medium', c.numeric && 'text-right')}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}
                </tr>
              </thead>
              <tbody>
                {activeSchedule.rows.map((r) => {
                  const on = r.id === selectedId
                  return (
                    <tr key={r.id} onClick={() => selectEl(r.id)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', on ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                      {activeSchedule.columns.map((c) => <td key={c.key} className={cn('px-3 py-1.5', c.numeric ? 'data-mono text-right text-slate-300' : 'text-slate-200', c.key === 'mark' && 'font-medium')}>{fmtCell(r[c.key])}</td>)}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-edge/60 text-sm font-semibold text-slate-200">
                  {activeSchedule.columns.map((c, i) => <td key={c.key} className={cn('px-3 py-2', c.numeric && 'data-mono text-right')}>{c.total ? fmtCell(activeSchedule.totals[c.key]) : i === 0 ? 'Total' : ''}</td>)}
                </tr>
              </tfoot>
            </table>
          </ScrollableTable>
        </div>
      </Card>
      </>
      )}
    </div>
  )
}

function Field({ label, unit, value, min, max, step, onChange, fmt }: { label: string; unit?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>{label}</span><span className="data-mono text-slate-300">{fmt ? fmt(value) : value}{unit ? ` ${unit}` : ''}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-500" aria-label={label} />
    </label>
  )
}
