import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, Layers, Building2, Download, FileJson, Table2, MousePointerClick, Eye, Columns3, SquareStack, Box as BoxIcon, Rows3, Frame, DoorOpen, Square, Pencil, Trash2, Copy, Plus, RotateCcw, Move, Undo2, Redo2, Share2, Check, ShieldCheck } from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, Tabs } from '@/components/ui'
import { ScrollableTable } from '@/components/ScrollableTable'
const ComponentBuildingViewer = lazy(() => import('@/components/ComponentBuildingViewer').then((m) => ({ default: m.ComponentBuildingViewer })))
const IfcExplorer = lazy(() => import('@/components/IfcExplorer').then((m) => ({ default: m.IfcExplorer })))
import { FloorPlan } from '@/components/FloorPlan'
import { buildMassing, deriveStoreys, SHAPE_KINDS, type ShapeKind } from '@/lib/massing'
import { buildBuilding, type BuildingModel } from '@/lib/building'
import { explodeBuilding, planForLevel, type Schedule, type ScheduleCol, type BuildingElement } from '@/lib/building-explorer'
import { applyEdits, emptyEdits, nudge, rescale, removeElement, addColumnAt, addDoorAt, duplicateColumn, editCount, type BuildingEdits } from '@/lib/building-edits'
import { toObj } from '@/lib/building-export'
import { toIfc } from '@/lib/building-ifc'
import { egressAnalysis, egressPathFor } from '@/lib/egress'
import { CODE_PRESETS, CODE_KEYS, type CodeKey } from '@/lib/building-code'
import type { IfcLabels } from '@/lib/ifc-to-model'
import { idbGet, idbSet, idbDel } from '@/lib/idb'
import { PLATE_SCALE } from '@/lib/massing'
import { PROJECTS } from '@/data/platform'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { downloadText, slug } from '@/lib/download'

const SEL_KEY = 'aec-active-project'
const ROW_CAP = 300 // cap rendered schedule rows (export covers all)
const CAT_ICON: Record<string, typeof Columns3> = { Floor: SquareStack, Column: Columns3, Beam: Rows3, Window: Frame, Door: DoorOpen, 'Interior Door': DoorOpen, Wall: Square, Partition: Square, Room: Square, Stair: Rows3, Core: BoxIcon, Roof: SquareStack }

const fmtCell = (v: number | string) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v)
const csvCell = (v: number | string) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function csvFor(s: Schedule): string {
  const head = s.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)).join(',')
  const rows = s.rows.map((r) => s.columns.map((c) => csvCell(r[c.key])).join(','))
  const totals = s.columns.map((c, i) => (c.total ? String(s.totals[c.key] ?? '') : i === 0 ? 'TOTAL' : '')).join(',')
  return [head, ...rows, totals].join('\n')
}

// the persisted building design (params + manual edits), per project
type Cfg = { storeys: number; shape: ShapeKind; aspect: number; storeyHeight: number; slabThickness: number; wwr: number; bayWidth: number; mullions: boolean; code: CodeKey; edits: BuildingEdits }
const cfgKey = (id: string) => `aec-bld-${id}`
const loadCfg = (id: string): Partial<Cfg> | null => { try { return JSON.parse(localStorage.getItem(cfgKey(id)) || 'null') } catch { return null } }

export default function BuildingExplorer() {
  const initialId = (() => { try { return localStorage.getItem(SEL_KEY) || PROJECTS[0].id } catch { return PROJECTS[0].id } })()
  const init0 = loadCfg(initialId)
  const proj0 = PROJECTS.find((p) => p.id === initialId) ?? PROJECTS[0]
  const [projectId, setProjectId] = useState(initialId)
  const project = useMemo(() => PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0], [projectId])

  const [source, setSource] = useState<'parametric' | 'ifc'>('parametric')
  const [storeys, setStoreys] = useState(() => init0?.storeys ?? deriveStoreys(proj0.gfa))
  const [shape, setShape] = useState<ShapeKind>(() => init0?.shape ?? 'rect')
  const [aspect, setAspect] = useState(() => init0?.aspect ?? 1)
  const [storeyHeight, setStoreyHeight] = useState(() => init0?.storeyHeight ?? 3.6)
  const [slabThickness, setSlabThickness] = useState(() => init0?.slabThickness ?? 0.3)

  const [activeLevel, setActiveLevel] = useState(0)
  const [isolate, setIsolate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [schedTab, setSchedTab] = useState('Floor')
  const [hidden, setHidden] = useState<{ glazing?: boolean; structure?: boolean; slabs?: boolean; facade?: boolean; interior?: boolean }>({})
  const [wwr, setWwr] = useState(() => init0?.wwr ?? 0.55)
  const [bayWidth, setBayWidth] = useState(() => init0?.bayWidth ?? 3.4)
  const [mullions, setMullions] = useState(() => init0?.mullions ?? true)
  const [code, setCode] = useState<CodeKey>(() => init0?.code ?? 'IBC')
  const [editMode, setEditMode] = useState(false)
  const [addKind, setAddKind] = useState<'column' | 'door' | null>(null)
  const [edits, setEdits] = useState<BuildingEdits>(() => init0?.edits ?? emptyEdits())
  const [past, setPast] = useState<BuildingEdits[]>([])
  const [future, setFuture] = useState<BuildingEdits[]>([])
  // an uploaded IFC rationalized into the editable model (persisted to IndexedDB)
  const [imported, setImported] = useState<{ model: BuildingModel; name: string; labels: IfcLabels } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const IMPORT_KEY = 'aec-imported-model'

  const generatedModel = useMemo(() => buildBuilding(buildMassing({ gfa: project.gfa, progress: 100, storeys, shape: shape === 'custom' ? 'rect' : shape, aspect }), { coreRatio: 0.16, wwr, bayWidth, mullions }), [project.gfa, storeys, shape, aspect, wwr, bayWidth, mullions])
  const baseModel = imported?.model ?? generatedModel
  const model = useMemo(() => applyEdits(baseModel, edits), [baseModel, edits])
  // auto-save the generated design (params + edits) per project; imported models are in-memory only
  useEffect(() => {
    if (imported) return
    try { localStorage.setItem(cfgKey(projectId), JSON.stringify({ storeys, shape, aspect, storeyHeight, slabThickness, wwr, bayWidth, mullions, code, edits })) } catch { /* ignore */ }
  }, [imported, projectId, storeys, shape, aspect, storeyHeight, slabThickness, wwr, bayWidth, mullions, code, edits])
  // bring an uploaded IFC into the editor; rebuild the editing state around it + persist
  const importIfcModel = (m: BuildingModel, sh: number, name: string, labels: IfcLabels) => {
    const h = Math.round(sh * 10) / 10
    setImported({ model: m, name, labels }); setStoreyHeight(h)
    setEdits(emptyEdits()); setPast([]); setFuture([]); setSelectedId(null)
    setActiveLevel(0); setIsolate(false); setAddKind(null); setEditMode(false); setSource('parametric')
    idbSet(IMPORT_KEY, { model: m, name, labels, storeyHeight: h }).catch(() => { /* over quota — stays in memory */ })
  }
  const discardImport = () => { setImported(null); setEdits(emptyEdits()); setPast([]); setFuture([]); setSelectedId(null); setActiveLevel(0); setIsolate(false); idbDel(IMPORT_KEY).catch(() => {}) }
  // restore a previously imported model on load (survives reloads)
  useEffect(() => {
    let live = true
    idbGet<{ model: BuildingModel; name: string; labels?: IfcLabels; storeyHeight?: number }>(IMPORT_KEY).then((r) => {
      if (live && r && r.model && r.model.counts) { setImported({ model: r.model, name: r.name, labels: r.labels ?? {} }); if (r.storeyHeight) setStoreyHeight(r.storeyHeight) }
    }).catch(() => {})
    return () => { live = false }
  }, [])
  // undo / redo (Ctrl/Cmd+Z, Shift for redo)
  const undo = () => setPast((p) => { if (!p.length) return p; setFuture((f) => [edits, ...f]); setEdits(p[p.length - 1]); return p.slice(0, -1) })
  const redo = () => setFuture((f) => { if (!f.length) return f; setPast((p) => [...p, edits]); setEdits(f[0]); return f.slice(1) })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })
  const applyCfg = (c: Partial<Cfg>, gfa: number) => {
    setStoreys(c.storeys ?? deriveStoreys(gfa)); setShape(c.shape ?? 'rect'); setAspect(c.aspect ?? 1)
    setStoreyHeight(c.storeyHeight ?? 3.6); setSlabThickness(c.slabThickness ?? 0.3)
    setWwr(c.wwr ?? 0.55); setBayWidth(c.bayWidth ?? 3.4); setMullions(c.mullions ?? true); setCode(c.code ?? 'IBC')
    setEdits(c.edits ?? emptyEdits()); setPast([]); setFuture([]); setSelectedId(null)
  }
  const switchProject = (id: string) => { setProjectId(id); const p = PROJECTS.find((x) => x.id === id) ?? PROJECTS[0]; applyCfg(loadCfg(id) ?? {}, p.gfa) }
  const ex = useMemo(() => explodeBuilding(model, { storeyHeight, slabThickness, code }), [model, storeyHeight, slabThickness, code])
  const egress = useMemo(() => egressAnalysis(model, { code }), [model, code])
  const plan = useMemo(() => planForLevel(model, activeLevel), [model, activeLevel])
  const egressPath = useMemo(() => (selectedId && selectedId.startsWith('room-') ? egressPathFor(model, selectedId) : null), [model, selectedId])
  const nEdits = editCount(edits)
  // nudge steps: 1 m in plan → scene via PLATE_SCALE; 0.5 m vertical → scene via storey height
  const stepXZ = 1 * PLATE_SCALE, stepY = 0.5 / storeyHeight
  const commit = (next: BuildingEdits) => { setPast((p) => [...p.slice(-60), edits]); setFuture([]); setEdits(next) }
  const edit = (fn: (e: BuildingEdits) => BuildingEdits) => commit(fn(edits))
  const del = (id: string) => { commit(removeElement(edits, id)); setSelectedId(null) }
  const resetEdits = () => { commit(emptyEdits()); setAddKind(null); setSelectedId(null) }
  const exportCfg = () => downloadText(`${slug(project.name)}-building-design.json`, JSON.stringify({ project: project.name, storeys, shape, aspect, storeyHeight, slabThickness, wwr, bayWidth, mullions, code, edits }, null, 2), 'JSON')
  const importCfg = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; try { applyCfg(JSON.parse(await f.text()), project.gfa) } catch { /* ignore */ } e.target.value = '' }
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
  const exportObj = () => downloadText(`${slug(project.name)}-building.obj`, toObj(model, project.name), 'OBJ')
  const exportIfc = () => downloadText(`${slug(project.name)}-building.ifc`, toIfc(model, { name: project.name, storeyHeight }), 'IFC')
  const [gltfBusy, setGltfBusy] = useState(false)
  const exportGltf = async () => { setGltfBusy(true); try { const { exportGlb } = await import('@/lib/building-gltf'); await exportGlb(model, `${slug(project.name)}-building.glb`) } catch { /* ignore */ } setGltfBusy(false) }

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
              {imported ? (
                <span className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100 ring-1 ring-inset ring-amber-500/40" title="Editing a rationalized IFC import">
                  <Pencil className="h-3.5 w-3.5" /> Imported · {imported.name}
                  <button onClick={discardImport} className="ml-1 rounded px-1 text-amber-200/80 hover:bg-amber-500/20 hover:text-white" title="Discard the import and return to the generated model">Back to generated</button>
                </span>
              ) : (
                <>
                  <label className="sr-only" htmlFor="explorer-project">Project</label>
                  <select id="explorer-project" value={projectId} onChange={(e) => switchProject(e.target.value)} className="rounded-lg border border-edge/60 bg-elevated/50 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none">
                    {PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </>
              )}
              <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60">
                <button onClick={undo} disabled={!past.length} title="Undo (Ctrl/Cmd+Z)" className={cn('px-2 py-1.5', past.length ? 'text-slate-300 hover:bg-elevated/60' : 'cursor-default text-slate-600')}><Undo2 className="h-4 w-4" /></button>
                <button onClick={redo} disabled={!future.length} title="Redo (Ctrl/Cmd+Shift+Z)" className={cn('border-l border-edge/60 px-2 py-1.5', future.length ? 'text-slate-300 hover:bg-elevated/60' : 'cursor-default text-slate-600')}><Redo2 className="h-4 w-4" /></button>
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/25"><Check className="h-3.5 w-3.5" /> {imported ? 'In-memory' : 'Auto-saved'}{nEdits ? ` · ${nEdits} edit${nEdits > 1 ? 's' : ''}` : ''}</span>
              {!imported && <>
                <button onClick={exportCfg} title="Export this design to share" className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Share2 className="h-4 w-4" /> Share</button>
                <button onClick={() => fileRef.current?.click()} title="Import a shared design" className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileJson className="h-4 w-4" /> Import</button>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importCfg} />
              </>}
              <div className="flex items-center overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60" title="Export the building (edits included)">
                <Download className="ml-2 h-3.5 w-3.5 text-slate-500" />
                <button onClick={exportIfc} title="Export IFC4 (typed BIM products for Revit / Navisworks / Solibri)" className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60">IFC</button>
                <button onClick={exportObj} className="border-l border-edge/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60">OBJ</button>
                <button onClick={exportGltf} disabled={gltfBusy} className="border-l border-edge/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60 disabled:opacity-60">{gltfBusy ? '…' : 'glTF'}</button>
                <button onClick={exportAll} className="border-l border-edge/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60">JSON</button>
              </div>
            </>}
          </div>
        }
      />

      {source === 'ifc' ? (
        <Suspense fallback={<div className="grid h-64 place-items-center text-sm text-slate-500">Loading IFC explorer…</div>}><IfcExplorer onEditModel={importIfcModel} /></Suspense>
      ) : (
      <>
      {/* summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Storeys" value={String(ex.summary.storeys)} accent="blue" />
        <StatTile label="Elements" value={formatNumber(ex.summary.elements)} accent="cyan" />
        <StatTile label="Columns + beams" value={`${formatNumber(ex.summary.columns)} · ${formatNumber(ex.summary.beams)}`} accent="violet" />
        <StatTile label="Windows + doors" value={`${formatNumber(ex.summary.windows)} · ${formatNumber(ex.summary.doors)}`} accent="sky" />
        <StatTile label="Partitions · doors · stairs" value={`${formatNumber(ex.summary.partitions)} · ${formatNumber(ex.summary.interiorDoors)} · ${formatNumber(ex.summary.stairs)}`} accent="fuchsia" />
        <StatTile label="Rooms · net" value={`${formatNumber(ex.summary.rooms)} · ${formatNumber(ex.summary.netArea)} m²`} accent="teal" />
        <StatTile label="Gross floor area" value={`${formatNumber(ex.summary.gfa)} m²`} accent="emerald" />
        <StatTile label="Concrete" value={`${formatNumber(ex.summary.concreteVolume)} m³`} accent="amber" />
      </div>

      {/* model parameters (generated model) — or an import banner */}
      {imported ? (
        <Card>
          <CardHeader icon={Pencil} accent="amber" title={`Editing imported model — ${imported.name}`} subtitle={`Rationalized from your IFC into ${formatNumber(model.counts.columns)} columns · ${formatNumber(model.counts.walls)} walls · ${formatNumber(model.counts.windows)} windows · ${formatNumber(model.counts.slabs)} slabs across ${model.counts.storeys} storeys. Move / resize / delete elements, read the schedules, and re-export to IFC / OBJ / glTF. This is a bounding-box reconstruction (not the original B-rep); it lives in memory for this session.`} />
        </Card>
      ) : (
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
          <Field label="Slab thickness" unit="m" value={slabThickness} min={0.1} max={0.6} step={0.05} onChange={setSlabThickness} />
          <Field label="Window-to-wall" value={wwr} min={0.2} max={0.85} step={0.05} onChange={setWwr} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Field label="Window bay" unit="m" value={bayWidth} min={1.5} max={9} step={0.1} onChange={setBayWidth} />
          <label className="flex items-end pb-1">
            <button onClick={() => setMullions((v) => !v)} aria-pressed={mullions} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors', mullions ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50')}>Mullions {mullions ? 'on' : 'off'}</button>
          </label>
        </div>
      </Card>
      )}

      {/* 3D model + level navigator */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={Eye} accent="blue" title="3D model" subtitle="Click any element to inspect it; isolate a floor from the levels panel. Turn on Edit to move / resize / delete / duplicate elements (or drag a column in the plan) and add columns or interior doors — the schedules update live."
            action={
              <div className="flex flex-wrap items-center gap-2">
                {isolate && <Badge variant="cyan">Isolated · {activeLevelInfo?.name ?? `Level ${activeLevel}`}</Badge>}
                <button onClick={() => setIsolate(false)} disabled={!isolate} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', isolate ? 'text-slate-300 ring-edge/60 hover:bg-elevated/50' : 'cursor-default text-slate-600 ring-edge/40')}>Whole building</button>
                <button onClick={() => { setEditMode((v) => !v); setAddKind(null) }} aria-pressed={editMode} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', editMode ? 'bg-amber-500/20 text-amber-100 ring-amber-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                {editMode && <>
                  <button onClick={() => setAddKind((k) => (k === 'column' ? null : 'column'))} aria-pressed={addKind === 'column'} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', addKind === 'column' ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Plus className="h-3.5 w-3.5" /> Add column</button>
                  <button onClick={() => setAddKind((k) => (k === 'door' ? null : 'door'))} aria-pressed={addKind === 'door'} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', addKind === 'door' ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><DoorOpen className="h-3.5 w-3.5" /> Add door</button>
                  <button onClick={resetEdits} disabled={!nEdits} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', nEdits ? 'text-slate-300 ring-edge/60 hover:bg-elevated/50' : 'cursor-default text-slate-600 ring-edge/40')}><RotateCcw className="h-3.5 w-3.5" /> Reset{nEdits ? ` (${nEdits})` : ''}</button>
                </>}
                <div className="flex flex-wrap gap-1.5">
                  {([['structure', 'Structure'], ['facade', 'Walls'], ['interior', 'Interior'], ['glazing', 'Windows'], ['slabs', 'Slabs']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setHidden((h) => ({ ...h, [k]: !h[k] }))} aria-pressed={!hidden[k]} className={cn('rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors', hidden[k] ? 'text-slate-500 ring-edge/60' : 'bg-blue-500/15 text-blue-200 ring-blue-500/40')}>{label}</button>
                  ))}
                </div>
              </div>
            }
          />
          <div className="border-t border-edge/50">
            <Suspense fallback={<div style={{ height: 560 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
              <ComponentBuildingViewer model={model} hidden={hidden} isolateLevel={isolate ? activeLevel : null} selected={selectedId} onSelect={selectEl} height={560} />
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
          <CardHeader icon={Table2} accent="teal" title={`Floor plan — ${activeLevelInfo?.name ?? `Level ${activeLevel}`}`} subtitle="Scroll to zoom, drag the background to pan. Click an element to inspect it; in Edit mode, drag a column/window/door to move it, or use Add door and click a partition to place a doorway. Selection syncs with the 3D model & schedules." />
          <div className="border-t border-edge/50 p-4">
            <FloorPlan plan={plan} selected={selectedId} onSelect={selectEl} height={340} egressPath={egressPath}
              editable={editMode} addMode={addKind !== null}
              onMoveElement={(id, dx, dz) => edit((e) => nudge(e, id, { x: dx, y: 0, z: dz }))}
              onAddAt={(x, z) => { const lv = activeLevel < 0 ? 0 : Math.min(activeLevel, storeys - 1); edit((e) => (addKind === 'door' ? addDoorAt(e, model, lv, x, z) : addColumnAt(e, model, lv, x, z))); setAddKind(null) }} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#16243c] ring-1 ring-[#2c4a6e]" /> Room</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" /> Column</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-[#6b7a93]" /> Partition</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-[#d6a85f]" /> Int. door</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-sky-400" /> Window</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-emerald-400" /> Door</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 border border-[#6b7a93] bg-[#1f2c44]" /> Stair</span>
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
                {imported && selectedId && imported.labels[selectedId] && (
                  <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
                    IFC source — <span className="font-medium text-amber-100">{imported.labels[selectedId].name || 'unnamed'}</span> · <span className="data-mono">{imported.labels[selectedId].ifcType}</span>
                  </div>
                )}
                {imported && selectedId && (imported.labels[selectedId]?.props?.length ?? 0) > 0 && (
                  <div className="mb-3 overflow-hidden rounded-lg ring-1 ring-edge/50">
                    <div className="bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">IFC properties</div>
                    <dl className="max-h-44 divide-y divide-edge/40 overflow-y-auto">
                      {imported.labels[selectedId]!.props!.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 px-3 py-1.5">
                          <dt className="truncate text-xs text-slate-400">{p.name}</dt>
                          <dd className="data-mono shrink-0 text-xs text-slate-200">{typeof p.value === 'number' ? p.value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : p.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                <dl className="divide-y divide-edge/40 rounded-lg ring-1 ring-edge/50">
                  {selectedEl.cols.filter((c) => c.key !== 'mark' && c.key !== 'level').map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-4 px-3 py-2">
                      <dt className="text-xs text-slate-400">{c.label}</dt>
                      <dd className="data-mono text-sm font-medium text-slate-200">{fmtCell(selectedEl.data[c.key])}{c.unit ? ` ${c.unit}` : ''}</dd>
                    </div>
                  ))}
                </dl>
                {editMode && selectedId && (
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-300/90"><Move className="h-3.5 w-3.5" /> Edit element</div>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <NudgeBtn label="◀ X" onClick={() => edit((e) => nudge(e, selectedId, { x: -stepXZ, y: 0, z: 0 }))} />
                      <NudgeBtn label="▲ N" onClick={() => edit((e) => nudge(e, selectedId, { x: 0, y: 0, z: stepXZ }))} />
                      <NudgeBtn label="X ▶" onClick={() => edit((e) => nudge(e, selectedId, { x: stepXZ, y: 0, z: 0 }))} />
                      <NudgeBtn label="Up" onClick={() => edit((e) => nudge(e, selectedId, { x: 0, y: stepY, z: 0 }))} />
                      <NudgeBtn label="▼ S" onClick={() => edit((e) => nudge(e, selectedId, { x: 0, y: 0, z: -stepXZ }))} />
                      <NudgeBtn label="Down" onClick={() => edit((e) => nudge(e, selectedId, { x: 0, y: -stepY, z: 0 }))} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <NudgeBtn label="Bigger" onClick={() => edit((e) => rescale(e, selectedId, 1.15))} />
                      <NudgeBtn label="Smaller" onClick={() => edit((e) => rescale(e, selectedId, 1 / 1.15))} />
                      {selectedEl.category === 'Column' && <NudgeBtn label="Duplicate" icon={Copy} onClick={() => edit((e) => duplicateColumn(e, model, selectedId))} />}
                      <button onClick={() => del(selectedId)} className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-200 ring-1 ring-inset ring-rose-500/40 hover:bg-rose-500/25"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">Or drag the column in the plan. Move steps: 1 m plan · 0.5 m vertical.</p>
                  </div>
                )}
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
                {activeSchedule.rows.slice(0, ROW_CAP).map((r) => {
                  const on = r.id === selectedId
                  return (
                    <tr key={r.id} onClick={() => selectEl(r.id)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', on ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                      {activeSchedule.columns.map((c) => <td key={c.key} className={cn('px-3 py-1.5', c.numeric ? 'data-mono text-right text-slate-300' : 'text-slate-200', c.key === 'mark' && 'font-medium')}>{fmtCell(r[c.key])}</td>)}
                    </tr>
                  )
                })}
                {activeSchedule.rows.length > ROW_CAP && (
                  <tr><td colSpan={activeSchedule.columns.length} className="px-3 py-2 text-center text-[11px] text-slate-500">Showing first {ROW_CAP} of {formatNumber(activeSchedule.rows.length)} — export CSV for the full schedule.</td></tr>
                )}
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

      {/* life safety / egress */}
      <Card>
        <CardHeader
          icon={ShieldCheck} accent={egress.summary.ok ? 'emerald' : 'amber'} title="Life safety — egress & occupancy"
          subtitle={`Occupant load, travel distance to the nearest protected stair and exit-width capacity per floor, checked against the selected code. ${CODE_PRESETS[code].note} Indicative design-stage check, not certification.`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="egress-code">Code</label>
              <select id="egress-code" value={code} onChange={(e) => setCode(e.target.value as CodeKey)} className="rounded-lg border border-edge/60 bg-elevated/50 px-2.5 py-1.5 text-xs text-slate-200 focus:border-blue-500/50 focus:outline-none">
                {CODE_KEYS.map((k) => <option key={k} value={k}>{CODE_PRESETS[k].label}</option>)}
              </select>
              <Badge variant={egress.summary.ok ? 'success' : 'warn'} dot>{egress.summary.ok ? 'Compliant' : 'Review egress'}</Badge>
              <button onClick={() => downloadText(`${slug(project.name)}-egress-${code}.csv`, egressCsv(egress), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-4">
          <StatTile label="Occupant load" value={`${formatNumber(egress.summary.occupancy)} ppl`} accent="violet" />
          <StatTile label="Max travel" value={`${egress.summary.maxTravel} / ${egress.summary.maxTravelLimit} m`} accent={egress.summary.maxTravel > egress.summary.maxTravelLimit ? 'rose' : 'teal'} />
          <StatTile label="Rooms over travel" value={String(egress.summary.roomsOverTravel)} accent={egress.summary.roomsOverTravel ? 'amber' : 'emerald'} />
          <StatTile label="Worst floor" value={egress.summary.worstFloor} accent={egress.summary.ok ? 'emerald' : 'rose'} />
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="Egress by floor">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">
                  {['Level', 'Rooms', 'Occupants', 'Exits', 'Max travel (m)', 'Req. width (m)', 'Provided (m)', 'Status'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && i <= 6 && 'text-right')}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {egress.floors.map((f) => (
                  <tr key={f.level} onClick={() => gotoLevel(f.level)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', f.level === activeLevel ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                    <td className="px-3 py-1.5 font-medium text-slate-200">{f.name}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{f.rooms}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(f.occupancy)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{f.exits}</td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', f.maxTravel > egress.summary.maxTravelLimit ? 'text-rose-300' : 'text-slate-300')}>{f.maxTravel}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{f.requiredWidth.toFixed(2)}</td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', f.providedWidth < f.requiredWidth ? 'text-rose-300' : 'text-slate-300')}>{f.providedWidth.toFixed(2)}</td>
                    <td className="px-3 py-1.5">{f.ok ? <span className="text-emerald-300">Pass</span> : <span className="text-amber-300" title={f.issues.join('; ')}>{f.issues.length} issue{f.issues.length > 1 ? 's' : ''}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] text-slate-500">Travel distance is a straight-line room-centre → nearest stair estimate × 1.3 (circuitous factor). Select a room in the plan to see its egress path. Occupant load factor: {CODE_PRESETS[code].egress.occLoadFactor} m²/person.</p>
        </div>
      </Card>
      </>
      )}
    </div>
  )
}

function egressCsv(e: ReturnType<typeof egressAnalysis>): string {
  const head = ['Level', 'Rooms', 'Occupants', 'Exits', 'Max travel (m)', 'Required width (m)', 'Provided width (m)', 'Status', 'Issues'].join(',')
  const rows = e.floors.map((f) => [f.name, f.rooms, f.occupancy, f.exits, f.maxTravel, f.requiredWidth, f.providedWidth, f.ok ? 'Pass' : 'Fail', `"${f.issues.join('; ')}"`].join(','))
  return [head, ...rows].join('\n')
}

function NudgeBtn({ label, icon: Icon, onClick }: { label: string; icon?: typeof Copy; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center justify-center gap-1 rounded-md bg-base/70 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-inset ring-edge/60 transition-colors hover:bg-elevated/70 active:bg-amber-500/20">
      {Icon && <Icon className="h-3.5 w-3.5" />} {label}
    </button>
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
