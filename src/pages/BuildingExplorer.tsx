import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, Layers, Building2, Download, FileJson, Table2, MousePointerClick, Eye, Columns3, SquareStack, Box as BoxIcon, Rows3, Frame, DoorOpen, Square, Pencil, Trash2, Copy, Plus, RotateCcw, Move, Undo2, Redo2, Share2, Check, ShieldCheck, Flame, Gauge, Sun, CalendarClock, Sparkles, Wand2, Camera, EyeOff, LayoutGrid, Ruler, Users, Maximize2, Minimize2, X, Footprints, Armchair, Hammer, Library, Lamp, PaintRoller } from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, Tabs } from '@/components/ui'
import { ScrollableTable } from '@/components/ScrollableTable'
const ComponentBuildingViewer = lazy(() => import('@/components/ComponentBuildingViewer').then((m) => ({ default: m.ComponentBuildingViewer })))
const IfcExplorer = lazy(() => import('@/components/IfcExplorer').then((m) => ({ default: m.IfcExplorer })))
const DrawingExplorer = lazy(() => import('@/components/DrawingExplorer').then((m) => ({ default: m.DrawingExplorer })))
import { FloorPlan } from '@/components/FloorPlan'
import { buildMassing, deriveStoreys, SHAPE_KINDS, type ShapeKind } from '@/lib/massing'
import { buildBuilding, type BuildingModel } from '@/lib/building'
import { explodeBuilding, planForLevel, type Schedule, type ScheduleCol, type BuildingElement } from '@/lib/building-explorer'
import { applyEdits, emptyEdits, nudge, rescale, removeElement, addColumnAt, addDoorAt, addStairAt, duplicateColumn, editCount, setRoomName, setRoomUse, setRoomFinish, scaleRoom, type BuildingEdits } from '@/lib/building-edits'
import { roomReport, floorReport, finishSchedule, finishCsv } from '@/lib/room-studio'
import { SPACE_TYPES, FINISHES } from '@/lib/room-types'
import { furnitureFor, ffeCsv, FFE_CATALOG, FFE_ALTERNATES } from '@/lib/building-furniture'
import { FAMILIES, DEFAULT_TYPES, familyType, familyCount, engineeringFor, familiesCsv, type TypeSelections } from '@/lib/families'
import { buildingServices, servicesCsv, SVC_TYPES, type SvcSelections } from '@/lib/building-services'
import { fastenerTakeoff, fastenersCsv } from '@/lib/fasteners'
import { toObj } from '@/lib/building-export'
import { toIfc } from '@/lib/building-ifc'
import { egressAnalysis, egressPathFor } from '@/lib/egress'
import { buildingFire, floorCompartments } from '@/lib/fire'
import { structuralCheck } from '@/lib/structure'
import { energyAnalysis } from '@/lib/energy'
import { schedule4d } from '@/lib/schedule4d'
import { adviseBuilding, type AdvisorAction } from '@/lib/advisor'
import { sunPosition, momentOf } from '@/lib/sun'
import type { ViewerStyle } from '@/components/ComponentBuildingViewer'
import { useProfile } from '@/store/profile'
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
const STYLES: { id: ViewerStyle; label: string }[] = [
  { id: 'wire', label: 'Wireframe' }, { id: 'mono', label: 'Hidden line' }, { id: 'shaded', label: 'Shaded' }, { id: 'realistic', label: 'Realistic' }, { id: 'xray', label: 'X-ray' },
]
// the model browser — every layer of the building, like Revit's category tree
const CATS: { key: string; label: string; count: (m: BuildingModel) => number }[] = [
  { key: 'foundations', label: 'Substructure (footings + ground beams)', count: (m) => m.counts.foundations + m.counts.groundBeams },
  { key: 'slabs', label: 'Floor slabs', count: (m) => m.counts.slabs },
  { key: 'columns', label: 'Columns', count: (m) => m.counts.columns },
  { key: 'beams', label: 'Beams', count: (m) => m.counts.beams },
  { key: 'core', label: 'Core', count: (m) => (m.core ? 1 : 0) },
  { key: 'stairs', label: 'Stairs', count: (m) => m.counts.stairs },
  { key: 'walls', label: 'Façade walls', count: (m) => m.counts.walls },
  { key: 'mullions', label: 'Mullions', count: (m) => m.counts.mullions },
  { key: 'windows', label: 'Windows', count: (m) => m.counts.windows },
  { key: 'doors', label: 'Entrance doors', count: (m) => m.counts.doors },
  { key: 'partitions', label: 'Partitions', count: (m) => m.counts.partitions },
  { key: 'interiorDoors', label: 'Interior doors', count: (m) => m.counts.interiorDoors },
  { key: 'finishes', label: 'Floor finishes', count: (m) => m.counts.finishes },
  { key: 'ceilings', label: 'Ceilings', count: (m) => m.counts.ceilings },
  { key: 'parapets', label: 'Parapets', count: (m) => m.counts.parapets },
  { key: 'roof', label: 'Roof', count: (m) => (m.roof ? 1 : 0) },
]
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
type Cfg = { storeys: number; shape: ShapeKind; aspect: number; storeyHeight: number; slabThickness: number; wwr: number; bayWidth: number; mullions: boolean; code: CodeKey; edits: BuildingEdits; types?: TypeSelections; ffe?: Record<string, string>; svc?: SvcSelections }
const cfgKey = (id: string) => `aec-bld-${id}`
const loadCfg = (id: string): Partial<Cfg> | null => { try { return JSON.parse(localStorage.getItem(cfgKey(id)) || 'null') } catch { return null } }

export default function BuildingExplorer() {
  const initialId = (() => { try { return localStorage.getItem(SEL_KEY) || PROJECTS[0].id } catch { return PROJECTS[0].id } })()
  const init0 = loadCfg(initialId)
  const proj0 = PROJECTS.find((p) => p.id === initialId) ?? PROJECTS[0]
  const [projectId, setProjectId] = useState(initialId)
  const project = useMemo(() => PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0], [projectId])

  const [source, setSource] = useState<'parametric' | 'ifc' | 'dxf'>('parametric')
  const [storeys, setStoreys] = useState(() => init0?.storeys ?? deriveStoreys(proj0.gfa))
  const [shape, setShape] = useState<ShapeKind>(() => init0?.shape ?? 'rect')
  const [aspect, setAspect] = useState(() => init0?.aspect ?? 1)
  const [storeyHeight, setStoreyHeight] = useState(() => init0?.storeyHeight ?? 3.6)
  const [slabThickness, setSlabThickness] = useState(() => init0?.slabThickness ?? 0.3)

  const [activeLevel, setActiveLevel] = useState(0)
  const [isolate, setIsolate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [schedTab, setSchedTab] = useState('Floor')
  const [cats, setCats] = useState<Record<string, boolean>>({})
  const [style, setStyle] = useState<ViewerStyle>('realistic')
  const [section, setSection] = useState(100) // % of height; 100 = section box off
  const [sunOn, setSunOn] = useState(false)
  const [month, setMonth] = useState(6)
  const [hour, setHour] = useState(14)
  const [wwr, setWwr] = useState(() => init0?.wwr ?? 0.55)
  const [bayWidth, setBayWidth] = useState(() => init0?.bayWidth ?? 3.4)
  const [mullions, setMullions] = useState(() => init0?.mullions ?? true)
  const [code, setCode] = useState<CodeKey>(() => init0?.code ?? 'IBC')
  const [editMode, setEditMode] = useState(false)
  const [showFire, setShowFire] = useState(false)
  const [addKind, setAddKind] = useState<'column' | 'door' | 'stair' | null>(null)
  const [studioFloor, setStudioFloor] = useState<number | null>(null) // floor open in the Floor Studio
  const [studioStyle, setStudioStyle] = useState<ViewerStyle>('realistic') // render style for the studio preview
  const [nameDraft, setNameDraft] = useState('') // room-rename text buffer (committed on blur/Enter)
  const [walk, setWalk] = useState<{ x: number; z: number; level: number } | null>(null) // first-person walkthrough spawn
  // family/type selections — the element catalog, persisted with the design
  const [types, setTypes] = useState<TypeSelections>(() => ({ ...DEFAULT_TYPES, ...(init0?.types ?? {}) }))
  const [ffeSel, setFfeSel] = useState<Record<string, string>>(() => init0?.ffe ?? {})
  const [svcSel, setSvcSel] = useState<SvcSelections>(() => init0?.svc ?? {})
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
    try { localStorage.setItem(cfgKey(projectId), JSON.stringify({ storeys, shape, aspect, storeyHeight, slabThickness, wwr, bayWidth, mullions, code, edits, types, ffe: ffeSel, svc: svcSel })) } catch { /* ignore */ }
  }, [imported, projectId, storeys, shape, aspect, storeyHeight, slabThickness, wwr, bayWidth, mullions, code, edits, types, ffeSel, svcSel])
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
    setTypes({ ...DEFAULT_TYPES, ...(c.types ?? {}) }); setFfeSel(c.ffe ?? {}); setSvcSel(c.svc ?? {})
  }
  const switchProject = (id: string) => { setProjectId(id); const p = PROJECTS.find((x) => x.id === id) ?? PROJECTS[0]; applyCfg(loadCfg(id) ?? {}, p.gfa) }
  const ex = useMemo(() => explodeBuilding(model, { storeyHeight, slabThickness, code }), [model, storeyHeight, slabThickness, code])
  const egress = useMemo(() => egressAnalysis(model, { code }), [model, code])
  const fireOpts = useMemo(() => ({ maxArea: CODE_PRESETS[code].egress.maxCompartment, occLoadFactor: CODE_PRESETS[code].egress.occLoadFactor, costPerM2: 1800 }), [code])
  const fire = useMemo(() => buildingFire(model, fireOpts), [model, fireOpts])
  const floorFire = useMemo(() => floorCompartments(model, activeLevel, fireOpts), [model, activeLevel, fireOpts])
  // family/type selections feed the engines: U-values → energy, section strength → structure
  const eng = useMemo(() => engineeringFor(types), [types])
  const struct = useMemo(() => structuralCheck(model, { storeyHeight, fc: eng.fcColumn }), [model, storeyHeight, eng.fcColumn])
  const energy = useMemo(() => energyAnalysis(model, { storeyHeight, uWall: eng.uWall, uWindow: eng.uWindow, uRoof: eng.uRoof }), [model, storeyHeight, eng.uWall, eng.uWindow, eng.uRoof])
  const sched = useMemo(() => schedule4d(model, {}), [model])
  const { profile } = useProfile()
  const advice = useMemo(() => adviseBuilding({ model, storeyHeight, code, wwr }, { role: profile.role }), [model, storeyHeight, code, wwr, profile.role])
  const applyAdvice = (a: AdvisorAction) => {
    if (a.kind === 'set-wwr') setWwr(a.value)
    else if (a.kind === 'set-shape') setShape(a.value as ShapeKind)
    else if (a.kind === 'set-code') setCode(a.value)
    else if (a.kind === 'add-stair') { const cx = model.core ? model.core.x + model.core.w * 1.6 : 2; const cz = model.core ? model.core.z : 0; edit((e) => addStairAt(e, model, cx, cz)) }
    else if (a.kind === 'strengthen-column') edit((e) => rescale(e, a.id, a.factor))
    else if (a.kind === 'deepen-beam') { const b = model.beams.find((x) => x.id === a.id); if (b) commit({ ...edits, edits: { ...edits.edits, [a.id]: { ...(edits.edits[a.id] ?? {}), height: b.depth * a.factor } } }) }
  }
  const sun = useMemo(() => { if (!sunOn) return undefined; const p = sunPosition(momentOf(month, hour), 40.71, -74.0); return { azimuth: p.azimuth, altitude: p.altitude } }, [sunOn, month, hour])
  const clipY = section >= 100 ? null : (section / 100) * model.totalHeight
  // FF&E: furnish every room from its programmed use; fixings: hardware down to the nails
  const furniture = useMemo(() => furnitureFor(model, { storeyHeight, ffe: ffeSel }), [model, storeyHeight, ffeSel])
  const fixings = useMemo(() => fastenerTakeoff(model, { storeyHeight }), [model, storeyHeight])
  const services = useMemo(() => buildingServices(model, { storeyHeight, types: svcSel }), [model, storeyHeight, svcSel])
  const finSched = useMemo(() => finishSchedule(model, { storeyHeight }), [model, storeyHeight])
  // first-person walkthrough: spawn inside a real room on a level (clear of the core)
  const walkTo = (level: number, at?: { x: number; z: number }) => {
    const lvl = Math.max(0, Math.min(model.counts.storeys - 1, level))
    const room = model.rooms.find((r) => r.level === lvl)
    const p = at ?? room?.center ?? { x: model.core ? model.core.x + model.core.w * 1.4 : 0, z: model.core ? model.core.z : 0 }
    setIsolate(false)
    setWalk({ x: p.x, z: p.z, level: lvl })
    document.querySelector('[data-main-viewer]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const snapshotInto = (root: ParentNode | null, name: string) => {
    const el = (root ?? document).querySelector('[aria-label^="3D building model"]') as (HTMLElement & { __snapshot?: () => string }) | null
    const url = el?.__snapshot?.()
    if (!url) return
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  }
  const snapshot = () => snapshotInto(document.querySelector('[data-main-viewer]'), `${slug(project.name)}-render.png`)
  const snapshotStudio = () => snapshotInto(document.querySelector('[data-studio-preview]'), `${slug(project.name)}-${roomRep ? slug(roomRep.name) : `floor-${studioFloor ?? 0}`}-render.png`)
  const topColumns = useMemo(() => [...struct.columns].sort((a, b) => b.utilization - a.utilization).slice(0, ROW_CAP), [struct])
  const darkFirst = useMemo(() => [...energy.rooms].sort((a, b) => a.daylight - b.daylight).slice(0, ROW_CAP), [energy])
  const plan = useMemo(() => planForLevel(model, activeLevel), [model, activeLevel])
  const egressPath = useMemo(() => (selectedId && selectedId.startsWith('room-') ? egressPathFor(model, selectedId) : null), [model, selectedId])

  // ---- Room / Floor Studio: a focused preview + deep modifications on the selected space ----
  const selectedRoom = useMemo(() => (selectedId ? model.rooms.find((r) => r.id === selectedId) ?? null : null), [model, selectedId])
  const roomRep = useMemo(() => (selectedRoom ? roomReport(model, selectedRoom.id, { storeyHeight, code }) : null), [model, selectedRoom, storeyHeight, code])
  const floorRep = useMemo(() => (studioFloor != null && !selectedRoom ? floorReport(model, studioFloor, { storeyHeight, code }) : null), [model, studioFloor, selectedRoom, storeyHeight, code])
  const studioFocus = roomRep?.focus ?? floorRep?.focus ?? null
  const studioOpen = !!(roomRep || floorRep)
  const curRoomScale = selectedRoom ? edits.rooms?.[selectedRoom.id]?.scale ?? 1 : 1
  useEffect(() => { setNameDraft(selectedRoom?.name ?? '') }, [selectedRoom?.id, selectedRoom?.name])

  const nEdits = editCount(edits)
  // nudge steps: 1 m in plan → scene via PLATE_SCALE; 0.5 m vertical → scene via storey height
  const stepXZ = 1 * PLATE_SCALE, stepY = 0.5 / storeyHeight
  const commit = (next: BuildingEdits) => { setPast((p) => [...p.slice(-60), edits]); setFuture([]); setEdits(next) }
  const edit = (fn: (e: BuildingEdits) => BuildingEdits) => commit(fn(edits))
  const del = (id: string) => { commit(removeElement(edits, id)); setSelectedId(null) }
  const resetEdits = () => { commit(emptyEdits()); setAddKind(null); setSelectedId(null) }
  // ---- studio actions (room re-programme/finish/resize + floor-wide re-finish/re-programme) ----
  const openFloorStudio = (lvl: number) => { setSelectedId(null); setStudioFloor(lvl); setActiveLevel(lvl) }
  const closeStudio = () => { setStudioFloor(null); setSelectedId(null) }
  const commitRoomName = () => { const n = nameDraft.trim(); if (selectedRoom && n && n !== selectedRoom.name) edit((e) => setRoomName(e, selectedRoom.id, n)) }
  const roomUse = (use: string) => { if (selectedRoom) edit((e) => setRoomUse(e, selectedRoom.id, use)) }
  const roomFinish = (fin: string) => { if (selectedRoom) edit((e) => setRoomFinish(e, selectedRoom.id, fin)) }
  const roomScale = (factor: number) => { if (selectedRoom) edit((e) => scaleRoom(e, selectedRoom.id, factor)) }
  const resetRoomSize = () => { if (selectedRoom && curRoomScale !== 1) edit((e) => scaleRoom(e, selectedRoom.id, 1 / curRoomScale)) }
  const floorRefinish = (fin: string) => { if (studioFloor == null) return; const ids = model.rooms.filter((r) => r.level === studioFloor).map((r) => r.id); if (!ids.length) return; commit(ids.reduce((e, id) => setRoomFinish(e, id, fin), edits)) }
  const floorReprogram = (use: string) => { if (studioFloor == null) return; const ids = model.rooms.filter((r) => r.level === studioFloor).map((r) => r.id); if (!ids.length) return; commit(ids.reduce((e, id) => setRoomUse(e, id, use), edits)) }
  const exportCfg = () => downloadText(`${slug(project.name)}-building-design.json`, JSON.stringify({ project: project.name, storeys, shape, aspect, storeyHeight, slabThickness, wwr, bayWidth, mullions, code, edits }, null, 2), 'JSON')
  const importCfg = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; try { applyCfg(JSON.parse(await f.text()), project.gfa) } catch { /* ignore */ } e.target.value = '' }
  const selectedEl: BuildingElement | null = selectedId ? ex.byId[selectedId] ?? null : null
  const activeSchedule = ex.schedules.find((s) => s.category === schedTab) ?? ex.schedules[0]

  const selectEl = (id: string | null) => {
    setSelectedId(id)
    if (!id) return
    const m = /^floor-(\d+)$/.exec(id) // clicking a floor slab opens the Floor Studio
    if (m) setStudioFloor(Number(m[1]))
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
        description="Review a building floor by floor and element by element — then walk through it in first person, fully furnished. Isolate any level, click any element to inspect its data, open the full schedules, and extract everything down to the nails. Use a generated model, upload an IFC/Revit export, or load 2D DXF drawings."
        accent="blue"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60">
              {([['parametric', 'Generated'], ['ifc', 'IFC / Revit'], ['dxf', 'Drawings']] as const).map(([id, label]) => (
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
      ) : source === 'dxf' ? (
        <Suspense fallback={<div className="grid h-64 place-items-center text-sm text-slate-500">Loading drawing workbench…</div>}><DrawingExplorer /></Suspense>
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

      {/* AI advisor — every engine, one prioritized list, one-click fixes */}
      <Card data-advisor className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-500/[0.07] via-transparent to-transparent" />
        <CardHeader icon={Sparkles} accent="violet" title={`AI advisor — design health ${advice.grade} (${advice.score}/100)`}
          subtitle={`Every engine ran on this exact model under ${CODE_PRESETS[code].label}: egress, structure, energy & daylight, fire, programme, plan efficiency. Findings are ordered for your role${profile.role ? ` (${profile.role})` : ''}; fixes apply in one click and everything recomputes.`}
          action={<div className="flex flex-wrap gap-1.5">{advice.phases.map((p) => (
            <span key={p.phase} data-phase={p.phase} title={p.headline} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ring-1 ring-inset', p.status === 'critical' ? 'bg-rose-500/10 text-rose-200 ring-rose-500/30' : p.status === 'warning' ? 'bg-amber-500/10 text-amber-200 ring-amber-500/30' : p.status === 'good' ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/25' : 'bg-elevated/40 text-slate-400 ring-edge/50')}>{p.phase}</span>
          ))}</div>}
        />
        <ul className="divide-y divide-edge/40 border-t border-edge/50">
          {advice.findings.filter((x) => x.severity !== 'good').slice(0, 6).map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', x.severity === 'critical' ? 'bg-rose-400' : x.severity === 'warning' ? 'bg-amber-400' : 'bg-sky-400')} aria-hidden />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-100">{x.title}</span>
                <span className="ml-2 hidden text-xs text-slate-400 lg:inline">{x.detail}</span>
              </div>
              {x.metric && <span className="data-mono shrink-0 text-[11px] text-slate-500">{x.metric}</span>}
              {x.action && <button data-advisor-apply onClick={() => applyAdvice(x.action!)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-inset ring-violet-500/40 transition-colors hover:bg-violet-500/25"><Wand2 className="h-3 w-3" /> {x.action.label}</button>}
            </li>
          ))}
          {advice.findings.filter((x) => x.severity !== 'good').length === 0 && (
            <li className="px-5 py-3 text-sm text-emerald-300">All clear — every engine passes for this design under {CODE_PRESETS[code].label}.</li>
          )}
        </ul>
      </Card>

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

      {/* families & types — the element catalog, like a CAD family tree */}
      <Card data-families>
        <CardHeader
          icon={Library} accent="sky" title={`Families & types — ${familyCount()} types across ${FAMILIES.length} families`}
          subtitle="Every critical element carries real alternatives, like swapping a family type in CAD: structural sections (RC / steel / PT / timber), façade systems, glazing builds, door sets, partitions, floor finishes, ceilings, roof build-ups, foundations and stairs. Selecting a type recolours the model and re-runs the engines — U-values into energy, section strength into structure, rates into cost."
          action={<button onClick={() => downloadText(`${slug(project.name)}-families.csv`, familiesCsv(types), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid gap-x-4 gap-y-3 border-t border-edge/50 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FAMILIES.map((f) => {
            const active = familyType(f.key, types[f.key])
            const props = Object.entries(active.props).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(' · ')
            return (
              <label key={f.key} className="block rounded-lg bg-base/40 p-2.5 ring-1 ring-inset ring-edge/50">
                <span className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500"><span>{f.label}</span><span className="data-mono normal-case text-slate-400">${formatNumber(active.cost)}/{active.unit}</span></span>
                <select value={types[f.key] ?? f.types[0].id} onChange={(e) => setTypes((t) => ({ ...t, [f.key]: e.target.value }))} aria-label={`${f.label} type`} className="w-full rounded-lg border border-edge/60 bg-elevated/50 px-2 py-1.5 text-sm text-slate-100 focus:border-sky-500/50 focus:outline-none">
                  {f.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <span className="mt-1 block truncate text-[11px] text-slate-500" title={`${active.material}${props ? ` · ${props}` : ''}`}>{active.material}{props ? ` · ${props}` : ''}</span>
              </label>
            )
          })}
        </div>
        <p className="border-t border-edge/50 px-5 py-2.5 text-[11px] text-slate-500">Active envelope: wall U {eng.uWall} · window U {eng.uWindow} · roof U {eng.uRoof} W/m²K → the Energy card. Column strength {eng.fcColumn} MPa-eq → the Structure card. Selections persist with the design and land in the families CSV schedule.</p>
      </Card>

      {/* 3D model + level navigator */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={Eye} accent="blue" title="3D model & studio" subtitle="Render styles, a sun study, a section box, PNG renders — and a first-person Walkthrough: WASD + mouse-look through every furnished room, Q/E between floors, like a Revit walkthrough with the building already decorated. Click any element to inspect; Edit to move / resize / delete — schedules update live."
            action={
              <div className="flex flex-wrap items-center gap-2">
                {isolate && <Badge variant="cyan">Isolated · {activeLevelInfo?.name ?? `Level ${activeLevel}`}</Badge>}
                <button onClick={() => setIsolate(false)} disabled={!isolate} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', isolate ? 'text-slate-300 ring-edge/60 hover:bg-elevated/50' : 'cursor-default text-slate-600 ring-edge/40')}>Whole building</button>
                <button onClick={() => { setEditMode((v) => !v); setAddKind(null) }} aria-pressed={editMode} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', editMode ? 'bg-amber-500/20 text-amber-100 ring-amber-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                {editMode && <>
                  <button onClick={() => setAddKind((k) => (k === 'column' ? null : 'column'))} aria-pressed={addKind === 'column'} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', addKind === 'column' ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Plus className="h-3.5 w-3.5" /> Add column</button>
                  <button onClick={() => setAddKind((k) => (k === 'door' ? null : 'door'))} aria-pressed={addKind === 'door'} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', addKind === 'door' ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><DoorOpen className="h-3.5 w-3.5" /> Add door</button>
                  <button onClick={() => setAddKind((k) => (k === 'stair' ? null : 'stair'))} aria-pressed={addKind === 'stair'} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', addKind === 'stair' ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Rows3 className="h-3.5 w-3.5" /> Add stair</button>
                  <button onClick={resetEdits} disabled={!nEdits} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', nEdits ? 'text-slate-300 ring-edge/60 hover:bg-elevated/50' : 'cursor-default text-slate-600 ring-edge/40')}><RotateCcw className="h-3.5 w-3.5" /> Reset{nEdits ? ` (${nEdits})` : ''}</button>
                </>}
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-edge/50 px-4 py-2.5">
            <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60">
              {STYLES.map((st) => (
                <button key={st.id} onClick={() => setStyle(st.id)} aria-pressed={style === st.id} className={cn('px-2.5 py-1 text-xs font-medium transition-colors', style === st.id ? 'bg-violet-500/20 text-violet-100' : 'text-slate-400 hover:bg-elevated/50 hover:text-slate-200')}>{st.label}</button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400" title="Horizontal section box — cut the model at a height">
              Section
              <input type="range" min={5} max={100} step={1} value={section} onChange={(e) => setSection(Number(e.target.value))} className="w-28 accent-violet-500" aria-label="Section height" />
              <span className="data-mono w-10 text-slate-300">{section >= 100 ? 'off' : `${section}%`}</span>
            </label>
            <button onClick={() => setSunOn((v) => !v)} aria-pressed={sunOn} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', sunOn ? 'bg-amber-500/20 text-amber-100 ring-amber-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Sun className="h-3.5 w-3.5" /> Sun study</button>
            {sunOn && <>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Month <input type="range" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20 accent-amber-500" aria-label="Sun month" /><span className="data-mono w-6 text-slate-300">{month}</span></label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Hour <input type="range" min={5} max={21} step={0.5} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-20 accent-amber-500" aria-label="Sun hour" /><span className="data-mono w-8 text-slate-300">{hour}:00</span></label>
            </>}
            <button onClick={() => (walk ? setWalk(null) : walkTo(activeLevel))} aria-pressed={!!walk} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', walk ? 'bg-amber-500/25 text-amber-100 ring-amber-500/50' : 'bg-amber-500/10 text-amber-200 ring-amber-500/30 hover:bg-amber-500/20')}><Footprints className="h-3.5 w-3.5" /> {walk ? 'Exit walkthrough' : 'Walkthrough'}</button>
            <button onClick={snapshot} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/25"><Camera className="h-3.5 w-3.5" /> Render PNG</button>
          </div>
          <div className="border-t border-edge/50" data-main-viewer>
            <Suspense fallback={<div style={{ height: 560 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
              <ComponentBuildingViewer model={model} cats={cats} style={style} clipY={clipY} sun={sun} furniture={furniture} services={services} types={types} walk={walk} onWalkEnd={() => setWalk(null)} isolateLevel={isolate ? activeLevel : null} selected={selectedId} onSelect={selectEl} height={560} />
            </Suspense>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
        <Card className="flex flex-col">
          <CardHeader icon={Layers} accent="violet" title="Model browser" subtitle="Every layer, substructure to finishes — toggle visibility per category." />
          <ul className="max-h-[300px] divide-y divide-edge/40 overflow-y-auto border-t border-edge/50">
            {[...CATS,
              { key: 'furniture', label: 'Furnishings (FF&E)', count: () => furniture.items.length },
              { key: 'lighting', label: 'Lighting (MEP)', count: () => services.items.filter((i) => i.system === 'lighting').length },
              { key: 'hvac', label: 'Air diffusers (MEP)', count: () => services.items.filter((i) => i.system === 'hvac').length },
              { key: 'fire', label: 'Sprinklers + detectors (MEP)', count: () => services.items.filter((i) => i.system === 'fire').length },
              { key: 'sanitary', label: 'Sanitary (MEP)', count: () => services.items.filter((i) => i.system === 'sanitary').length },
            ].map((c) => {
              const n = c.count(model)
              const hiddenCat = !!cats[c.key]
              return (
                <li key={c.key} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className={cn('truncate text-xs', hiddenCat ? 'text-slate-600' : 'text-slate-300')}>{c.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="data-mono text-[11px] text-slate-500">{formatNumber(n)}</span>
                    <button onClick={() => setCats((h) => ({ ...h, [c.key]: !h[c.key] }))} aria-pressed={!hiddenCat} aria-label={`Toggle ${c.label}`} className={cn('rounded p-1 transition-colors', hiddenCat ? 'text-slate-600 hover:text-slate-400' : 'text-violet-300 hover:text-violet-200')}>
                      {hiddenCat ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card className="flex flex-col">
          <CardHeader icon={Layers} accent="cyan" title="Levels" subtitle="Top-down. Click to isolate a floor & load its plan." />
          <div className="max-h-[300px] overflow-y-auto border-t border-edge/50">
            <ul className="divide-y divide-edge/40">
              {[...ex.levels].reverse().map((l) => {
                const on = l.index === activeLevel
                const inStudio = studioFloor === l.index && !selectedRoom
                return (
                  <li key={l.index} className={cn('flex items-stretch transition-colors', on ? 'bg-blue-500/10' : 'hover:bg-elevated/40')}>
                    <button onClick={() => gotoLevel(l.index)} aria-pressed={on} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-2.5 text-left">
                      <div className="min-w-0">
                        <div className={cn('truncate text-sm font-medium', on ? 'text-blue-100' : 'text-slate-200')}>{l.name}</div>
                        <div className="data-mono text-[11px] text-slate-500">+{l.elevation.toFixed(1)} m · {formatNumber(l.area)} m²</div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-slate-500">
                        {l.isRoof ? <span className="text-slate-500">roof</span> : <>{l.columns} col · {l.panels} pan</>}
                      </div>
                    </button>
                    {!l.isRoof && (
                      <button onClick={() => openFloorStudio(l.index)} aria-pressed={inStudio} title={`Open ${l.name} in Floor Studio`} aria-label={`Open ${l.name} in Floor Studio`} className={cn('flex shrink-0 items-center border-l border-edge/40 px-2.5 transition-colors', inStudio ? 'bg-violet-500/20 text-violet-200' : 'text-slate-400 hover:bg-violet-500/10 hover:text-violet-200')}>
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>
        </div>
      </div>

      {/* Room / Floor Studio — a focused, isolated preview + deep modifications on the selected space/floor */}
      {studioOpen && (
        <Card data-studio className="overflow-hidden ring-1 ring-inset ring-violet-500/25">
          <CardHeader
            icon={roomRep ? LayoutGrid : Layers} accent="violet"
            title={roomRep ? `Room Studio — ${roomRep.name}` : `Floor Studio — ${floorRep!.name}`}
            subtitle={roomRep
              ? 'A focused, isolated preview of this space with its real enclosure — re-programme the use, set a finish, rename and resize it; occupancy, daylight, egress and fit-out cost all recompute live.'
              : 'The whole floor, isolated and framed — totals, the use mix, and floor-wide re-finish / re-programme in one step. Click any room in the plan below to drill into it.'}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => (roomRep ? walkTo(roomRep.level, { x: selectedRoom!.center.x, z: selectedRoom!.center.z }) : walkTo(floorRep!.level))} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/20"><Footprints className="h-3.5 w-3.5" /> {roomRep ? 'Walk into this room' : 'Walk this floor'}</button>
                <button onClick={closeStudio} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><X className="h-3.5 w-3.5" /> Close</button>
              </div>
            }
          />
          <div className="grid gap-0 border-t border-edge/50 lg:grid-cols-[1.35fr_1fr]">
            {/* focused preview + render toolbar */}
            <div className="border-b border-edge/50 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60">
                  {STYLES.map((st) => (
                    <button key={st.id} onClick={() => setStudioStyle(st.id)} aria-pressed={studioStyle === st.id} className={cn('px-2.5 py-1 text-xs font-medium transition-colors', studioStyle === st.id ? 'bg-violet-500/20 text-violet-100' : 'text-slate-400 hover:bg-elevated/50 hover:text-slate-200')}>{st.label}</button>
                  ))}
                </div>
                <span className="data-mono text-[11px] text-slate-500">{roomRep ? `${roomRep.widthM}×${roomRep.depthM} m · ${formatNumber(roomRep.area)} m²` : `${formatNumber(floorRep!.area)} m² · ${floorRep!.rooms} rooms`}</span>
                <button onClick={snapshotStudio} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/25"><Camera className="h-3.5 w-3.5" /> Render PNG</button>
              </div>
              <div data-studio-preview className="border-t border-edge/50">
                <Suspense fallback={<div style={{ height: 420 }} className="grid place-items-center text-sm text-slate-500">Loading preview…</div>}>
                  <ComponentBuildingViewer model={model} cats={cats} style={studioStyle} focus={studioFocus} furniture={furniture} services={services} types={types} selected={selectedId} onSelect={selectEl} height={420} />
                </Suspense>
              </div>
            </div>

            {/* modifications + takeoff */}
            <div className="space-y-4 p-5">
              {roomRep ? (
                <>
                  <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-3">
                    <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-violet-300/90"><Pencil className="h-3.5 w-3.5" /> Modify space</div>
                    <label className="mb-2.5 block">
                      <span className="mb-1 block text-[11px] text-slate-400">Name</span>
                      <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={commitRoomName} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className="w-full rounded-lg border border-edge/60 bg-base/60 px-2.5 py-1.5 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none" aria-label="Room name" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-slate-400">Use</span>
                        <select value={roomRep.use} onChange={(e) => roomUse(e.target.value)} className="w-full rounded-lg border border-edge/60 bg-base/60 px-2 py-1.5 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none" aria-label="Room use">
                          {SPACE_TYPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-slate-400">Finish</span>
                        <select value={roomRep.finish} onChange={(e) => roomFinish(e.target.value)} className="w-full rounded-lg border border-edge/60 bg-base/60 px-2 py-1.5 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none" aria-label="Room finish">
                          {FINISHES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className="mr-auto text-[11px] text-slate-400">Size <span className="data-mono text-slate-300">{Math.round(curRoomScale * 100)}%</span></span>
                      <NudgeBtn label="Smaller" icon={Minimize2} onClick={() => roomScale(1 / 1.1)} />
                      <NudgeBtn label="Bigger" icon={Maximize2} onClick={() => roomScale(1.1)} />
                      <NudgeBtn label="Reset" icon={RotateCcw} onClick={resetRoomSize} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"><Ruler className="h-3.5 w-3.5" /> Space takeoff</div>
                    <div className="grid grid-cols-2 gap-2">
                      <StudioStat label="Floor area" value={`${formatNumber(roomRep.area)} m²`} />
                      <StudioStat label="Footprint" value={`${roomRep.widthM} × ${roomRep.depthM} m`} />
                      <StudioStat label="Clear height" value={`${roomRep.heightM} m`} />
                      <StudioStat label="Volume" value={`${formatNumber(roomRep.volume)} m³`} />
                      <StudioStat label="Occupancy" value={`${roomRep.occupancy} ppl`} icon={Users} />
                      <StudioStat label="Windows" value={`${roomRep.windows} · ${roomRep.glazedLength} m`} />
                      <StudioStat label="Daylight" value={`${roomRep.daylight}%`} tone={roomRep.daylit ? 'ok' : 'warn'} />
                      <StudioStat label="Doors" value={String(roomRep.doors)} />
                      <StudioStat label="Egress travel" value={`${roomRep.egressTravel} m`} tone={roomRep.egressOk ? 'ok' : 'warn'} />
                      <StudioStat label="Finish area" value={`${formatNumber(roomRep.finishArea)} m²`} />
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-violet-500/[0.08] px-3 py-2 ring-1 ring-inset ring-violet-500/25">
                      <span className="text-xs text-violet-200/90">Indicative fit-out</span>
                      <span className="data-mono text-sm font-semibold text-violet-100">${formatNumber(roomRep.finishCost)}</span>
                    </div>
                    {!roomRep.egressOk && roomRep.egressReason && <p className="mt-2 text-[11px] text-amber-300">Egress: {roomRep.egressReason}.</p>}
                  </div>
                </>
              ) : floorRep ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <StudioStat label="Floor area" value={`${formatNumber(floorRep.area)} m²`} />
                    <StudioStat label="Rooms" value={String(floorRep.rooms)} />
                    <StudioStat label="Occupancy" value={`${formatNumber(floorRep.occupancy)} ppl`} icon={Users} />
                    <StudioStat label="Daylit rooms" value={`${floorRep.daylitRooms}/${floorRep.rooms}`} tone={floorRep.rooms > 0 && floorRep.daylitRooms >= floorRep.rooms ? 'ok' : 'warn'} />
                    <StudioStat label="Windows · doors" value={`${floorRep.windows} · ${floorRep.doors}`} />
                    <StudioStat label="Columns" value={String(floorRep.columns)} />
                    <StudioStat label="Egress" value={floorRep.egressOk ? 'Pass' : 'Review'} tone={floorRep.egressOk ? 'ok' : 'warn'} />
                    <StudioStat label="Fit-out" value={`$${formatNumber(floorRep.finishCost)}`} />
                  </div>
                  {floorRep.uses.length > 0 && (
                    <div>
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Use mix</div>
                      <div className="space-y-1.5">
                        {floorRep.uses.map((u) => {
                          const pct = floorRep.area > 0 ? Math.round((u.area / floorRep.area) * 100) : 0
                          return (
                            <div key={u.use} className="flex items-center gap-2 text-xs">
                              <span className="w-24 shrink-0 truncate text-slate-300">{u.label}</span>
                              <div className="relative h-2.5 flex-1 overflow-hidden rounded bg-base/60 ring-1 ring-inset ring-edge/40"><div className="h-2.5 rounded bg-violet-500/60" style={{ width: `${Math.max(2, pct)}%` }} /></div>
                              <span className="data-mono w-24 shrink-0 text-right text-slate-500">{u.count} · {formatNumber(u.area)} m²</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-violet-300/90"><Wand2 className="h-3.5 w-3.5" /> Floor-wide</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-slate-400">Re-programme all</span>
                        <select value="" onChange={(e) => { if (e.target.value) floorReprogram(e.target.value) }} className="w-full rounded-lg border border-edge/60 bg-base/60 px-2 py-1.5 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none" aria-label="Re-programme all rooms on this floor">
                          <option value="">Choose use…</option>
                          {SPACE_TYPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-slate-400">Re-finish all</span>
                        <select value="" onChange={(e) => { if (e.target.value) floorRefinish(e.target.value) }} className="w-full rounded-lg border border-edge/60 bg-base/60 px-2 py-1.5 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none" aria-label="Re-finish all rooms on this floor">
                          <option value="">Choose finish…</option>
                          {FINISHES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">Applies to all {floorRep.rooms} rooms on {floorRep.name} in one step — undoable.</p>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      )}

      {/* floor plan + element inspector */}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader icon={Table2} accent="teal" title={`Floor plan — ${activeLevelInfo?.name ?? `Level ${activeLevel}`}`} subtitle="Scroll to zoom, drag the background to pan. Click an element to inspect it; in Edit mode, drag a column/window/door to move it, or use Add door and click a partition to place a doorway. Selection syncs with the 3D model & schedules."
            action={<button onClick={() => setShowFire((v) => !v)} aria-pressed={showFire} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', showFire ? 'bg-rose-500/20 text-rose-100 ring-rose-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Flame className="h-3.5 w-3.5" /> Fire compartments</button>} />
          <div className="border-t border-edge/50 p-4">
            <FloorPlan plan={plan} selected={selectedId} onSelect={selectEl} height={340} egressPath={egressPath} compartments={showFire ? floorFire : null}
              editable={editMode} addMode={addKind !== null}
              onMoveElement={(id, dx, dz) => edit((e) => nudge(e, id, { x: dx, y: 0, z: dz }))}
              onAddAt={(x, z) => { const lv = activeLevel < 0 ? 0 : Math.min(activeLevel, storeys - 1); edit((e) => (addKind === 'stair' ? addStairAt(e, model, x, z) : addKind === 'door' ? addDoorAt(e, model, lv, x, z) : addColumnAt(e, model, lv, x, z))); setAddKind(null) }} />
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
            ) : selectedId?.startsWith('fur-') || selectedId?.startsWith('pat-') ? (
              (() => {
                const item = furniture.items.find((it) => it.id === selectedId)
                const roomId = item?.roomId ?? selectedId.replace(/^pat-/, '')
                const room = model.rooms.find((r) => r.id === roomId)
                const cat = item ? FFE_CATALOG[item.kind] : null
                return (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', ACCENT.amber.bg)}><Armchair className={cn('h-4 w-4', ACCENT.amber.text)} /></span>
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{cat?.label ?? 'Floor finish patch'}</div>
                        <div className="data-mono text-[11px] text-slate-500">{selectedId} · {room ? room.name : ''}</div>
                      </div>
                      <Badge variant="warn" className="ml-auto">FF&E</Badge>
                    </div>
                    <dl className="divide-y divide-edge/40 rounded-lg ring-1 ring-edge/50">
                      {item && <div className="flex items-center justify-between gap-4 px-3 py-2"><dt className="text-xs text-slate-400">Catalog cost</dt><dd className="data-mono text-sm font-medium text-slate-200">${formatNumber(cat?.cost ?? 0)}</dd></div>}
                      {item && <div className="flex items-center justify-between gap-4 px-3 py-2"><dt className="text-xs text-slate-400">Parts</dt><dd className="data-mono text-sm font-medium text-slate-200">{item.parts.length} solids</dd></div>}
                      {room && <div className="flex items-center justify-between gap-4 px-3 py-2"><dt className="text-xs text-slate-400">Room</dt><dd className="data-mono text-sm font-medium text-slate-200">{room.name} · L{room.level}</dd></div>}
                      {room && <div className="flex items-center justify-between gap-4 px-3 py-2"><dt className="text-xs text-slate-400">Room use</dt><dd className="data-mono text-sm font-medium text-slate-200">{room.use ?? 'office'}</dd></div>}
                    </dl>
                    {room && <button onClick={() => selectEl(room.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-inset ring-violet-500/40 hover:bg-violet-500/25"><LayoutGrid className="h-3.5 w-3.5" /> Open this room in the studio</button>}
                    <p className="mt-2 text-[11px] text-slate-500">Furniture follows the room's programmed use — change the use in the Room Studio and the FF&E re-derives. Full takeoff in the Furnishings card below.</p>
                  </div>
                )
              })()
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

      {/* furnishings (FF&E) — derived from each room's programmed use */}
      <Card data-ffe>
        <CardHeader
          icon={Armchair} accent="amber" title="Furnishings (FF&E) — every room, decorated & priced"
          subtitle="Workstations, conference tables, classroom ranks, beds & wardrobes, lab benches, shelving, racking and plant skids — derived from each room's programmed use, drawn in the 3D model (toggle in the Model browser, or walk through them) and priced from the catalog. Re-programme a room in the Room Studio and its furniture re-derives."
          action={<button onClick={() => downloadText(`${slug(project.name)}-ffe.csv`, ffeCsv(furniture), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="flex flex-wrap items-end gap-3 border-t border-edge/50 px-5 py-3">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Type alternatives</span>
          {furniture.byKind.map((k) => {
            const alts = FFE_ALTERNATES[k.kind]
            if (!alts || alts.length < 2) return null
            return (
              <label key={k.kind} className="block">
                <span className="mb-0.5 block text-[11px] text-slate-500">{FFE_CATALOG[k.kind]?.label ?? k.kind}</span>
                <select value={ffeSel[k.kind] ?? alts[0].id} onChange={(e) => setFfeSel((s) => ({ ...s, [k.kind]: e.target.value }))} aria-label={`${FFE_CATALOG[k.kind]?.label ?? k.kind} type`} className="rounded-lg border border-edge/60 bg-elevated/50 px-2 py-1 text-xs text-slate-100 focus:border-amber-500/50 focus:outline-none">
                  {alts.map((a) => <option key={a.id} value={a.id}>{a.label} (${a.cost})</option>)}
                </select>
              </label>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-4">
          <StatTile label="FF&E items" value={formatNumber(furniture.total.items)} accent="amber" />
          <StatTile label="FF&E budget" value={`$${formatNumber(furniture.total.cost)}`} accent="emerald" />
          <StatTile label="Workstations" value={formatNumber(furniture.byKind.find((k) => k.kind === 'desk')?.count ?? 0)} accent="cyan" />
          <StatTile label="Furnished levels" value={String(furniture.byLevel.length)} accent="violet" />
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="FF&E by kind">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Item', 'Count', 'Unit cost ($)', 'Cost ($)'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {furniture.byKind.map((k) => (
                  <tr key={k.kind} className="border-b border-edge/30">
                    <td className="px-3 py-1.5 font-medium text-slate-200">{k.label}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(k.count)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(k.unitCost)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(k.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-edge/60 text-sm font-semibold text-slate-200"><td className="px-3 py-2">Total</td><td className="data-mono px-3 py-2 text-right">{formatNumber(furniture.total.items)}</td><td /><td className="data-mono px-3 py-2 text-right">{formatNumber(furniture.total.cost)}</td></tr></tfoot>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] text-slate-500">Click any piece of furniture in the 3D model to inspect it. Catalog rates are indicative procurement figures; the CSV adds a per-level roll-up.</p>
        </div>
      </Card>

      {/* building services (MEP) */}
      <Card data-mep>
        <CardHeader
          icon={Lamp} accent="cyan" title="Building services (MEP) — lighting, air, fire, power, sanitary"
          subtitle={`Every room is serviced on design spacing rules: luminaires (~1/12 m² → ${services.totals.lightingWm2} W/m² lighting density), supply diffusers (~1/16 m²), sprinkler heads (~1/12 m²) + smoke detectors, counted socket outlets per use, and a sanitary suite beside the core on every floor. Drawn in the 3D model (toggle each system in the Model browser) and priced; swap the head/fitting type and it reprices.`}
          action={<button onClick={() => downloadText(`${slug(project.name)}-mep.csv`, servicesCsv(services), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="flex flex-wrap items-end gap-3 border-t border-edge/50 px-5 py-3">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">System types</span>
          {(Object.keys(SVC_TYPES) as (keyof SvcSelections)[]).map((sys) => (
            <label key={sys} className="block">
              <span className="mb-0.5 block text-[11px] capitalize text-slate-500">{sys}</span>
              <select value={svcSel[sys] ?? SVC_TYPES[sys][0].id} onChange={(e) => setSvcSel((s) => ({ ...s, [sys]: e.target.value }))} aria-label={`${sys} type`} className="rounded-lg border border-edge/60 bg-elevated/50 px-2 py-1 text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none">
                {SVC_TYPES[sys].map((t) => <option key={t.id} value={t.id}>{t.label} (${t.cost})</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-4">
          <StatTile label="MEP items drawn" value={formatNumber(services.totals.items)} accent="cyan" />
          <StatTile label="Install budget" value={`$${formatNumber(services.totals.cost)}`} accent="emerald" />
          <StatTile label="Lighting density" value={`${services.totals.lightingWm2} W/m²`} accent="amber" />
          <StatTile label="Socket outlets" value={formatNumber(services.totals.sockets)} accent="violet" />
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="MEP schedule by level">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Level', 'Luminaires', 'Diffusers', 'Sprinklers', 'Detectors', 'Sockets', 'Sanitary suites'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {services.schedule.slice(0, ROW_CAP).map((r) => (
                  <tr key={r.level} onClick={() => gotoLevel(r.level)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', r.level === activeLevel ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                    <td className="px-3 py-1.5 font-medium text-slate-200">{r.name}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.luminaires)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.diffusers)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.sprinklers)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.detectors)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.sockets)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{r.sanitary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] text-slate-500">{services.byKind.map((k) => `${k.label}: ${formatNumber(k.count)}`).join(' · ')}. Spacings are design rules of thumb — an indicative installation takeoff, not a services design.</p>
        </div>
      </Card>

      {/* finishes schedule — room by room */}
      <Card data-finishes>
        <CardHeader
          icon={PaintRoller} accent="teal" title="Finishes schedule — room by room"
          subtitle={`Floor + wall + ceiling areas per room, priced at the room's finish grade (set it in the Room Studio, or floor-wide in the Floor Studio). ${formatNumber(finSched.totals.rooms)} rooms · ${formatNumber(finSched.totals.floorArea)} m² floor finish.`}
          action={<button onClick={() => downloadText(`${slug(project.name)}-finishes.csv`, finishCsv(finSched), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="Finishes schedule">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Room', 'Level', 'Use', 'Finish grade', 'Floor (m²)', 'Walls (m²)', 'Cost ($)'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 4 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {finSched.rows.slice(0, ROW_CAP).map((r) => (
                  <tr key={r.id} onClick={() => selectEl(r.id)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', r.id === selectedId ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                    <td className="px-3 py-1.5 font-medium text-slate-200">{r.room}</td>
                    <td className="data-mono px-3 py-1.5 text-slate-300">{r.level === 0 ? 'G' : r.level}</td>
                    <td className="px-3 py-1.5 text-slate-300">{r.use}</td>
                    <td className="px-3 py-1.5 text-slate-300">{r.gradeLabel}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{r.floorArea}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{r.wallArea}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.cost)}</td>
                  </tr>
                ))}
                {finSched.rows.length > ROW_CAP && <tr><td colSpan={7} className="px-3 py-2 text-center text-[11px] text-slate-500">Showing first {ROW_CAP} of {formatNumber(finSched.rows.length)} — export CSV for the full schedule.</td></tr>}
              </tbody>
              <tfoot><tr className="border-t border-edge/60 text-sm font-semibold text-slate-200"><td className="px-3 py-2">Total</td><td /><td /><td /><td className="data-mono px-3 py-2 text-right">{formatNumber(finSched.totals.floorArea)}</td><td /><td className="data-mono px-3 py-2 text-right">{formatNumber(finSched.totals.cost)}</td></tr></tfoot>
            </table>
          </ScrollableTable>
        </div>
      </Card>

      {/* hardware & fixings — the takeoff down to the nails */}
      <Card data-fixings>
        <CardHeader
          icon={Hammer} accent="rose" title="Hardware & fixings — down to the nails"
          subtitle={`Every secondary component the model implies, quantified: anchor bolts, beam connection bolts, partition tracks + studs, drywall screws, skirting nails, door hinges + locksets, curtain-wall clips, mullion brackets, ceiling hangers + grid, stair and railing fixings. ${fixings.headline}.`}
          action={<button onClick={() => downloadText(`${slug(project.name)}-fixings.csv`, fastenersCsv(fixings), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-5">
          <StatTile label="Total fixings" value={formatNumber(fixings.totals.fixings)} accent="rose" />
          <StatTile label="Nails" value={formatNumber(fixings.totals.nails)} accent="amber" />
          <StatTile label="Screws" value={formatNumber(fixings.totals.screws)} accent="cyan" />
          <StatTile label="Bolts" value={formatNumber(fixings.totals.bolts)} accent="violet" />
          <StatTile label="Hardware mass" value={`${formatNumber(Math.round(fixings.totals.massKg))} kg`} accent="emerald" />
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="Fixings takeoff">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Item', 'Host', 'Qty', 'Unit', 'Mass (kg)', 'Rule of thumb'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', (i === 2 || i === 4) && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {fixings.rows.map((r) => (
                  <tr key={r.id} className="border-b border-edge/30">
                    <td className="px-3 py-1.5 font-medium text-slate-200">{r.item}</td>
                    <td className="px-3 py-1.5 text-slate-400">{r.host}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.qty)}</td>
                    <td className="px-3 py-1.5 text-slate-400">{r.unit}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(r.massKg)}</td>
                    <td className="px-3 py-1.5 text-[11px] text-slate-500">{r.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] text-slate-500">Quantities re-derive live as you edit the model — add a partition and the studs, screws and skirting nails follow. Rules of thumb are indicative procurement rates, not a connection design.</p>
        </div>
      </Card>

      {/* life safety / egress */}
      <Card data-egress>
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
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Occupant load" value={`${formatNumber(egress.summary.occupancy)} ppl`} accent="violet" />
          <StatTile label="Max travel" value={`${egress.summary.maxTravel} / ${egress.summary.maxTravelLimit} m`} accent={egress.summary.maxTravel > egress.summary.maxTravelLimit ? 'rose' : 'teal'} />
          <StatTile label="Rooms over travel" value={String(egress.summary.roomsOverTravel)} accent={egress.summary.roomsOverTravel ? 'amber' : 'emerald'} />
          <StatTile label="Dead-ends" value={String(egress.summary.deadEnds)} accent={egress.summary.deadEnds ? 'amber' : 'emerald'} />
          <StatTile label="Fire compartments" value={`${fire.compartments}`} accent="rose" />
          <StatTile label="Worst floor" value={egress.summary.worstFloor} accent={egress.summary.ok ? 'emerald' : 'rose'} />
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="Egress by floor">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">
                  {['Level', 'Rooms', 'Occupants', 'Exits', 'Max travel (m)', 'Req. width (m)', 'Provided (m)', 'Dead-ends', 'Compartments', 'Status'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && i <= 8 && 'text-right')}>{h}</th>)}
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
                    <td className={cn('data-mono px-3 py-1.5 text-right', f.deadEnds ? 'text-amber-300' : 'text-slate-300')}>{f.deadEnds}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300" title={`${formatNumber(f.area)} m² ÷ ${formatNumber(f.maxCompartment)} m² max`}>{f.compartments}</td>
                    <td className="px-3 py-1.5">{f.ok ? <span className="text-emerald-300">Pass</span> : <span className="text-amber-300" title={f.issues.join('; ')}>{f.issues.length} issue{f.issues.length > 1 ? 's' : ''}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] text-slate-500">Travel distance is routed through the actual doorways (room → doors → core → nearest stair) via shortest path — select a room in the plan to see its route. A dead-end is a single-door room past the {CODE_PRESETS[code].egress.commonPath} m common-path limit (give it a 2nd door to clear it). Fire-rated subdivision: <span className="text-rose-300">{fire.compartments} compartments · {formatNumber(fire.ratedWall)} m rated wall · indicative fit-out ${formatNumber(fire.cost)}</span> — toggle “Fire compartments” on the plan. Occupant load {CODE_PRESETS[code].egress.occLoadFactor} m²/person (indicative, design-stage).</p>
        </div>
      </Card>

      {/* structure — preliminary gravity check */}
      <Card>
        <CardHeader
          icon={Gauge} accent={struct.summary.ok ? 'emerald' : 'amber'} title="Structure — preliminary gravity check"
          subtitle={`Per column: axial = tributary area × (${struct.loads.dead}+${struct.loads.live} kPa) × floors above, vs 0.4·f′c·Ag; per beam: wL²/8 vs the RC limit (f′c ${struct.loads.fc} MPa). Preliminary sizing, not a designed/reinforced structure.`}
          action={<button onClick={() => downloadText(`${slug(project.name)}-structure.csv`, structCsv(struct), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-4">
          <StatTile label="Max column util" value={`${Math.round(struct.summary.maxColUtil * 100)}%`} accent={struct.summary.maxColUtil > 1 ? 'rose' : 'emerald'} />
          <StatTile label="Max beam util" value={`${Math.round(struct.summary.maxBeamUtil * 100)}%`} accent={struct.summary.maxBeamUtil > 1 ? 'rose' : 'emerald'} />
          <StatTile label="Overstressed" value={`${struct.summary.colOver} col · ${struct.summary.beamOver} bm`} accent={struct.summary.colOver + struct.summary.beamOver ? 'amber' : 'emerald'} />
          <StatTile label="Gravity load" value={`${formatNumber(struct.summary.totalGravity)} kN`} accent="violet" />
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="Columns by utilisation">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Mark', 'Level', 'Section (m)', 'Axial (kN)', 'Capacity (kN)', 'Utilisation', 'Status'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && i <= 5 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {topColumns.map((c) => (
                  <tr key={c.id} onClick={() => selectEl(c.id)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', c.id === selectedId ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                    <td className="px-3 py-1.5 font-medium text-slate-200">{c.id}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{c.level === 0 ? 'G' : c.level}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{c.section.toFixed(2)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(c.axial)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(c.capacity)}</td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', c.utilization > 1 ? 'text-rose-300' : c.utilization > 0.85 ? 'text-amber-300' : 'text-slate-300')}>{Math.round(c.utilization * 100)}%</td>
                    <td className="px-3 py-1.5">{c.ok ? <span className="text-emerald-300">OK</span> : <span className="text-rose-300">Over</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] text-slate-500">Most-utilised columns first (click a row to locate it). {struct.summary.worst !== '—' ? <span className="text-amber-300">Worst: {struct.summary.worst}.</span> : 'All elements within capacity.'} Beam check + full list in the CSV.</p>
        </div>
      </Card>

      {/* energy & daylight */}
      {(() => { const eAcc = energy.summary.rating <= 'C' ? 'emerald' : energy.summary.rating <= 'E' ? 'amber' : 'rose'; return (
      <Card>
        <CardHeader
          icon={Sun} accent={eAcc} title="Energy & daylight"
          subtitle="Per-room daylight (exterior window area ÷ floor area), per-orientation solar exposure, and an envelope energy-use intensity from U-values × areas. Indicative design-stage figures."
          action={<button onClick={() => downloadText(`${slug(project.name)}-energy.csv`, energyCsv(energy), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-4">
          <StatTile label="Energy intensity" value={`${energy.summary.eui} kWh/m²`} accent={eAcc} />
          <StatTile label="Rating" value={energy.summary.rating} accent={eAcc} />
          <StatTile label="Window-to-wall" value={`${Math.round(energy.summary.wwr * 100)}%`} accent="sky" />
          <StatTile label="Dark rooms" value={String(energy.summary.darkRooms)} accent={energy.summary.darkRooms ? 'amber' : 'emerald'} />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-edge/50 px-5 py-3">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-500">Solar exposure by façade</span>
          {energy.orientations.map((o) => (
            <span key={o.dir} className="inline-flex items-center gap-1.5 rounded-lg bg-elevated/40 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-edge/50" title={`${o.windowArea} m² glazing · solar index ${o.solar}`}>
              <span className="font-medium text-amber-200">{o.dir}</span> {formatNumber(o.windowArea)} m²
            </span>
          ))}
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="Rooms by daylight">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Room', 'Level', 'Area (m²)', 'Window (m²)', 'Daylight', 'Status'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && i <= 4 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {darkFirst.map((r) => (
                  <tr key={r.id} onClick={() => selectEl(r.id)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', r.id === selectedId ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                    <td className="px-3 py-1.5 font-medium text-slate-200">{r.name}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{r.level === 0 ? 'G' : r.level}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{r.area}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{r.windowArea}</td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', r.ok ? 'text-slate-300' : 'text-amber-300')}>{r.daylight}%</td>
                    <td className="px-3 py-1.5">{r.ok ? <span className="text-emerald-300">Daylit</span> : <span className="text-amber-300">Dark</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] text-slate-500">Lowest-daylight rooms first (click to locate). “Dark” = window-to-floor below 10% (interior rooms have no external glazing). U-values follow the selected families — wall {eng.uWall} ({familyType('facade', types.facade).label}) / window {eng.uWindow} ({familyType('glazing', types.glazing).label}) / roof {eng.uRoof} W/m²K; envelope EUI is indicative.</p>
        </div>
      </Card>
      ) })()}

      {/* construction schedule (4D) */}
      <Card>
        <CardHeader
          icon={CalendarClock} accent="cyan" title="Construction schedule (4D)"
          subtitle="Floor-by-floor sequencing — structure → envelope → fit-out crews moving up, each trailing the one below. Working-day calendar from the start date; durations are tunable assumptions."
          action={<button onClick={() => downloadText(`${slug(project.name)}-schedule.csv`, schedCsv(sched), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-4">
          <StatTile label="Programme" value={`${sched.weeks} weeks`} accent="cyan" />
          <StatTile label="Floors" value={String(sched.floors.length)} accent="blue" />
          <StatTile label="Start" value={sched.startDate} accent="violet" />
          <StatTile label="Topping out → finish" value={sched.finishDate} accent="emerald" />
        </div>
        <div className="border-t border-edge/50 p-5">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {sched.phases.map((p) => <span key={p.name} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: p.color }} /> {p.name}</span>)}
          </div>
          <div className="space-y-1">
            {[...sched.floors].reverse().map((f) => (
              <div key={f.level} className="flex items-center gap-2">
                <div className="w-16 shrink-0 truncate text-[11px] text-slate-400">{f.name}</div>
                <div className="relative h-3 flex-1 overflow-hidden rounded bg-base/60 ring-1 ring-inset ring-edge/40">
                  {([['structure', '#64748b'], ['envelope', '#38bdf8'], ['fitout', '#34d399']] as const).map(([ph, col]) => { const p = f[ph]; return <div key={ph} className="absolute top-0 h-3" title={`${ph}: day ${p.start}–${p.end}`} style={{ left: `${(p.start / sched.totalDays) * 100}%`, width: `${Math.max(0.5, ((p.end - p.start) / sched.totalDays) * 100)}%`, background: col }} /> })}
                </div>
                <div className="data-mono w-24 shrink-0 text-right text-[11px] text-slate-500">{f.endDate}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Crews: structure {12} d/floor, envelope {8} d/floor, fit-out {10} d/floor (working days). Total {sched.totalDays} working days → {sched.finishDate}.</p>
        </div>
      </Card>
      </>
      )}
    </div>
  )
}

function structCsv(s: ReturnType<typeof structuralCheck>): string {
  const cols = ['Mark', 'Level', 'Section (m)', 'Tributary (m²)', 'Floors above', 'Axial (kN)', 'Capacity (kN)', 'Utilisation', 'Status']
  const cr = s.columns.map((c) => [c.id, c.level, c.section, c.tributary, c.floorsAbove, c.axial, c.capacity, c.utilization, c.ok ? 'OK' : 'OVER'].join(','))
  const bh = ['Beam', 'Level', 'Span (m)', 'Depth (m)', 'UDL (kN/m)', 'Moment (kNm)', 'Capacity (kNm)', 'Utilisation', 'Status']
  const br = s.beams.map((b) => [b.id, b.level, b.span, b.depth, b.udl, b.moment, b.capacity, b.utilization, b.ok ? 'OK' : 'OVER'].join(','))
  return ['COLUMNS', cols.join(','), ...cr, '', 'BEAMS', bh.join(','), ...br].join('\n')
}
function energyCsv(e: ReturnType<typeof energyAnalysis>): string {
  const h = ['Room', 'Level', 'Area (m²)', 'Window area (m²)', 'Daylight (%)', 'Status']
  const r = e.rooms.map((x) => [csvCell(x.name), x.level, x.area, x.windowArea, x.daylight, x.ok ? 'Daylit' : 'Dark'].join(','))
  const o = ['', 'ORIENTATION', 'Facing,Window area (m²),Solar index', ...e.orientations.map((x) => `${x.dir},${x.windowArea},${x.solar}`)]
  return [h.join(','), ...r, ...o].join('\n')
}
function schedCsv(s: ReturnType<typeof schedule4d>): string {
  const h = ['Level', 'Structure start (d)', 'Structure end (d)', 'Envelope start (d)', 'Envelope end (d)', 'Fit-out start (d)', 'Fit-out end (d)', 'Floor start', 'Floor finish']
  const r = s.floors.map((f) => [f.name, f.structure.start, f.structure.end, f.envelope.start, f.envelope.end, f.fitout.start, f.fitout.end, f.startDate, f.endDate].join(','))
  return [h.join(','), ...r].join('\n')
}

function egressCsv(e: ReturnType<typeof egressAnalysis>): string {
  const head = ['Level', 'Rooms', 'Occupants', 'Exits', 'Max travel (m)', 'Required width (m)', 'Provided width (m)', 'Dead-ends', 'Floor area (m²)', 'Fire compartments', 'Status', 'Issues'].join(',')
  const rows = e.floors.map((f) => [f.name, f.rooms, f.occupancy, f.exits, f.maxTravel, f.requiredWidth, f.providedWidth, f.deadEnds, f.area, f.compartments, f.ok ? 'Pass' : 'Fail', `"${f.issues.join('; ')}"`].join(','))
  return [head, ...rows].join('\n')
}

function StudioStat({ label, value, icon: Icon, tone }: { label: string; value: string; icon?: typeof Users; tone?: 'ok' | 'warn' }) {
  return (
    <div data-stat={label} data-stat-value={value} className="rounded-lg bg-base/50 px-3 py-2 ring-1 ring-inset ring-edge/50">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">{Icon && <Icon className="h-3 w-3" />}{label}</div>
      <div className={cn('data-mono mt-0.5 text-sm font-semibold', tone === 'ok' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-100')}>{value}</div>
    </div>
  )
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
