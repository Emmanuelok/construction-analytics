/* BIM explorer — pure, unit-tested. Explodes the componentized building into an
 * inspectable element list (every floor slab, structural column, curtain-wall
 * panel, the core and the roof), groups them by level, and derives Revit-style
 * schedules with real-world quantities + a 2D plan projection per level. Vertical
 * dims use the storey-height assumption; plan dims convert scene→metres. No DOM,
 * no Three.js — the viewer + plan + schedules all read these same numbers, so what
 * you see, inspect and export agree. */

import { type Pt, polygonArea, polygonPerimeter, polygonCentroid } from './zoning'
import { bearing, compass } from './geo'
import { SCENE_LEN_TO_M } from './massing'
import type { BuildingModel, Box, Quad } from './building'

const LEN = SCENE_LEN_TO_M // scene plan unit → metres
const AREA = LEN * LEN
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export type ElementCategory = 'Floor' | 'Column' | 'Curtain Panel' | 'Core' | 'Roof'
export type ScheduleCol = { key: string; label: string; unit?: string; numeric?: boolean; total?: boolean }

export type BuildingElement = {
  id: string // stable, matches the plan + 3D viewer + schedule row
  category: ElementCategory
  level: number // storey index; -1 = whole-building (core)
  levelName: string
  mark: string // Revit-style mark, e.g. F-03, C-03-12, GP-03-04
  title: string
  cols: ScheduleCol[]
  data: Record<string, number | string>
}

export type LevelInfo = {
  index: number // -? roof = storeys
  name: string
  elevation: number // m, slab underside
  storeyHeight: number // m
  area: number // net plate area, m²
  perimeter: number // m
  facade: number // m²
  columns: number
  panels: number
  isRoof: boolean
}

export type Schedule = { group: string; category: ElementCategory; columns: ScheduleCol[]; rows: (Record<string, number | string> & { id: string })[]; totals: Record<string, number> }

export type ExplodeOpts = { storeyHeight?: number; slabThickness?: number; columnSection?: number }

export type BuildingExplosion = {
  elements: BuildingElement[]
  byId: Record<string, BuildingElement>
  levels: LevelInfo[]
  schedules: Schedule[]
  summary: {
    elements: number; storeys: number; columns: number; panels: number
    gfa: number; grossVolume: number; facadeArea: number; height: number
    concreteVolume: number; coreVolume: number
  }
  opts: Required<ExplodeOpts>
}

const FLOOR_COLS: ScheduleCol[] = [
  { key: 'mark', label: 'Mark' },
  { key: 'level', label: 'Level' },
  { key: 'elevation', label: 'Elevation', unit: 'm', numeric: true },
  { key: 'area', label: 'Area', unit: 'm²', numeric: true, total: true },
  { key: 'perimeter', label: 'Perimeter', unit: 'm', numeric: true },
  { key: 'facade', label: 'Façade', unit: 'm²', numeric: true, total: true },
  { key: 'thickness', label: 'Slab', unit: 'm', numeric: true },
  { key: 'volume', label: 'Slab vol', unit: 'm³', numeric: true, total: true },
  { key: 'columns', label: 'Columns', numeric: true, total: true },
  { key: 'panels', label: 'Panels', numeric: true, total: true },
]
const COLUMN_COLS: ScheduleCol[] = [
  { key: 'mark', label: 'Mark' },
  { key: 'level', label: 'Level' },
  { key: 'section', label: 'Section', unit: 'm', numeric: true },
  { key: 'height', label: 'Height', unit: 'm', numeric: true },
  { key: 'volume', label: 'Concrete', unit: 'm³', numeric: true, total: true },
  { key: 'x', label: 'X (E)', unit: 'm', numeric: true },
  { key: 'z', label: 'Z (N)', unit: 'm', numeric: true },
]
const PANEL_COLS: ScheduleCol[] = [
  { key: 'mark', label: 'Mark' },
  { key: 'level', label: 'Level' },
  { key: 'width', label: 'Width', unit: 'm', numeric: true },
  { key: 'height', label: 'Height', unit: 'm', numeric: true },
  { key: 'area', label: 'Area', unit: 'm²', numeric: true, total: true },
  { key: 'facing', label: 'Facing', unit: '°', numeric: true },
  { key: 'orientation', label: 'Orient.' },
]
const CORE_COLS: ScheduleCol[] = [
  { key: 'mark', label: 'Mark' },
  { key: 'footprint', label: 'Footprint', unit: 'm²', numeric: true, total: true },
  { key: 'height', label: 'Height', unit: 'm', numeric: true },
  { key: 'volume', label: 'Volume', unit: 'm³', numeric: true, total: true },
  { key: 'levelsServed', label: 'Levels', numeric: true },
]

const levelName = (i: number, storeys: number) => (i === 0 ? 'Ground' : i >= storeys ? 'Roof' : `Level ${i}`)
const pad = (n: number) => String(n).padStart(2, '0')

/** Columns belonging to a level, in stable order (shared by schedule, plan & viewer). */
export const levelColumns = (m: BuildingModel, level: number): Box[] => m.columns.filter((c) => c.level === level)
/** Curtain-wall panels belonging to a level, in stable order. */
export const levelPanels = (m: BuildingModel, level: number): Quad[] => m.glazing.filter((g) => g.level === level)

const plateBBox = (poly: Pt[]) => {
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

/** Explode the building into inspectable elements, levels and schedules. */
export function explodeBuilding(m: BuildingModel, opts: ExplodeOpts = {}): BuildingExplosion {
  const sh = Math.max(0.1, opts.storeyHeight ?? 3.6)
  const slabT = Math.max(0.05, opts.slabThickness ?? 0.3)
  const colSec = Math.max(0.1, opts.columnSection ?? 0.6)
  const storeys = m.counts.storeys
  const elements: BuildingElement[] = []

  const floorOf = (poly: Pt[], hole: Pt[] | undefined, level: number, isRoof: boolean): BuildingElement => {
    const area = (polygonArea(poly) - (hole ? polygonArea(hole) : 0)) * AREA
    const perimeter = (polygonPerimeter(poly) + (hole ? polygonPerimeter(hole) : 0)) * LEN
    const cols = levelColumns(m, level).length
    const pans = levelPanels(m, level)
    const facade = pans.reduce((s, g) => s + dist(g.a, g.b) * LEN * g.h * sh, 0)
    return {
      id: isRoof ? 'roof' : `floor-${level}`,
      category: isRoof ? 'Roof' : 'Floor',
      level: isRoof ? storeys : level,
      levelName: levelName(isRoof ? storeys : level, storeys),
      mark: isRoof ? 'ROOF' : level === 0 ? 'F-G' : `F-${pad(level)}`,
      title: isRoof ? 'Roof slab' : `${levelName(level, storeys)} floor slab`,
      cols: FLOOR_COLS,
      data: {
        mark: isRoof ? 'ROOF' : level === 0 ? 'F-G' : `F-${pad(level)}`,
        level: levelName(isRoof ? storeys : level, storeys),
        elevation: r2(level * sh), area: r1(area), perimeter: r1(perimeter),
        facade: r1(facade), thickness: slabT, volume: r1(area * slabT),
        columns: cols, panels: pans.length,
      },
    }
  }

  // floor slabs
  for (const s of m.slabs) elements.push(floorOf(s.polygon, s.hole, s.level ?? 0, false))
  // roof
  if (m.roof) elements.push(floorOf(m.roof.polygon, m.roof.hole, storeys, true))

  // columns
  for (let level = 0; level < storeys; level++) {
    levelColumns(m, level).forEach((c, i) => {
      const height = c.h * sh
      const volume = colSec * colSec * height
      const mark = `C-${level === 0 ? 'G' : pad(level)}-${pad(i + 1)}`
      elements.push({
        id: `col-${level}-${i}`, category: 'Column', level, levelName: levelName(level, storeys), mark,
        title: `Column ${mark}`, cols: COLUMN_COLS,
        data: { mark, level: levelName(level, storeys), section: colSec, height: r2(height), volume: r2(volume), x: r1(c.x * LEN), z: r1(c.z * LEN) },
      })
    })
  }

  // curtain-wall panels (facing = direction from the level centroid to the panel)
  for (let level = 0; level < storeys; level++) {
    const slab = m.slabs.find((s) => s.level === level)
    const c = slab ? polygonCentroid(slab.polygon) : { x: 0, z: 0 }
    levelPanels(m, level).forEach((g, i) => {
      const width = dist(g.a, g.b) * LEN
      const height = g.h * sh
      const mid = { x: (g.a.x + g.b.x) / 2, z: (g.a.z + g.b.z) / 2 }
      const facing = bearing(c, mid)
      const mark = `GP-${level === 0 ? 'G' : pad(level)}-${pad(i + 1)}`
      elements.push({
        id: `pan-${level}-${i}`, category: 'Curtain Panel', level, levelName: levelName(level, storeys), mark,
        title: `Curtain panel ${mark}`, cols: PANEL_COLS,
        data: { mark, level: levelName(level, storeys), width: r2(width), height: r2(height), area: r2(width * height), facing, orientation: compass(facing) },
      })
    })
  }

  // core
  if (m.core) {
    const footprint = m.core.w * m.core.d * AREA
    const height = m.core.h * sh
    elements.push({
      id: 'core', category: 'Core', level: -1, levelName: 'All levels', mark: 'CORE',
      title: 'Vertical circulation core', cols: CORE_COLS,
      data: { mark: 'CORE', footprint: r1(footprint), height: r2(height), volume: r1(footprint * height), levelsServed: storeys },
    })
  }

  const byId: Record<string, BuildingElement> = {}
  for (const e of elements) byId[e.id] = e

  // levels (navigator) — one per storey + the roof
  const levels: LevelInfo[] = []
  for (let i = 0; i < storeys; i++) {
    const f = byId[`floor-${i}`]
    levels.push({
      index: i, name: levelName(i, storeys), elevation: Number(f?.data.elevation ?? r2(i * sh)), storeyHeight: sh,
      area: Number(f?.data.area ?? 0), perimeter: Number(f?.data.perimeter ?? 0), facade: Number(f?.data.facade ?? 0),
      columns: Number(f?.data.columns ?? 0), panels: Number(f?.data.panels ?? 0), isRoof: false,
    })
  }
  if (m.roof) {
    const rf = byId['roof']
    levels.push({ index: storeys, name: 'Roof', elevation: r2(storeys * sh), storeyHeight: sh, area: Number(rf?.data.area ?? 0), perimeter: Number(rf?.data.perimeter ?? 0), facade: 0, columns: 0, panels: 0, isRoof: true })
  }

  // schedules — grouped by category
  const sched = (group: string, category: ElementCategory, columns: ScheduleCol[], els: BuildingElement[]): Schedule => {
    const totals: Record<string, number> = {}
    for (const col of columns) if (col.total) totals[col.key] = els.reduce((s, e) => s + (typeof e.data[col.key] === 'number' ? (e.data[col.key] as number) : 0), 0)
    for (const k of Object.keys(totals)) totals[k] = r1(totals[k])
    return { group, category, columns, rows: els.map((e) => ({ id: e.id, ...e.data })), totals }
  }
  const floorEls = elements.filter((e) => e.category === 'Floor' || e.category === 'Roof')
  const colEls = elements.filter((e) => e.category === 'Column')
  const panEls = elements.filter((e) => e.category === 'Curtain Panel')
  const coreEls = elements.filter((e) => e.category === 'Core')
  const schedules: Schedule[] = [
    sched('Floors & Roof', 'Floor', FLOOR_COLS, floorEls),
    sched('Columns', 'Column', COLUMN_COLS, colEls),
    sched('Curtain Panels', 'Curtain Panel', PANEL_COLS, panEls),
  ]
  if (coreEls.length) schedules.push(sched('Core', 'Core', CORE_COLS, coreEls))

  const gfa = floorEls.filter((e) => e.category === 'Floor').reduce((s, e) => s + Number(e.data.area), 0)
  const facadeArea = floorEls.reduce((s, e) => s + Number(e.data.facade), 0)
  const concreteVolume = floorEls.reduce((s, e) => s + Number(e.data.volume), 0) + colEls.reduce((s, e) => s + Number(e.data.volume), 0)
  const grossVolume = levels.filter((l) => !l.isRoof).reduce((s, l) => s + l.area * sh, 0)

  return {
    elements, byId, levels, schedules,
    summary: {
      elements: elements.length, storeys, columns: colEls.length, panels: panEls.length,
      gfa: r1(gfa), grossVolume: r1(grossVolume), facadeArea: r1(facadeArea), height: r1(storeys * sh),
      concreteVolume: r1(concreteVolume), coreVolume: coreEls.length ? Number(coreEls[0].data.volume) : 0,
    },
    opts: { storeyHeight: sh, slabThickness: slabT, columnSection: colSec },
  }
}

/* ---- 2D plan projection per level (scene units; the SVG scales to fit) ---- */

export type PlanColumn = { id: string; x: number; z: number; w: number; d: number }
export type PlanPanel = { id: string; a: Pt; b: Pt; facing: number }
export type LevelPlan = {
  level: number
  isRoof: boolean
  outline: Pt[]
  hole?: Pt[]
  columns: PlanColumn[]
  panels: PlanPanel[]
  core?: { id: string; x: number; z: number; w: number; d: number }
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

/** Top-down plan geometry for a level (or the roof) — element ids match explodeBuilding. */
export function planForLevel(m: BuildingModel, level: number): LevelPlan {
  const isRoof = !!m.roof && level >= m.counts.storeys
  const slab = isRoof ? m.roof! : m.slabs.find((s) => s.level === level)
  const outline = slab ? slab.polygon : []
  const cols = isRoof ? [] : levelColumns(m, level)
  const pans = isRoof ? [] : levelPanels(m, level)
  const slabFor = m.slabs.find((s) => s.level === level)
  const c = slabFor ? polygonCentroid(slabFor.polygon) : { x: 0, z: 0 }
  const bb = outline.length ? plateBBox(outline) : { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }
  return {
    level, isRoof,
    outline,
    hole: slab?.hole,
    columns: cols.map((col, i) => ({ id: `col-${level}-${i}`, x: col.x, z: col.z, w: col.w, d: col.d })),
    panels: pans.map((g, i) => ({ id: `pan-${level}-${i}`, a: g.a, b: g.b, facing: bearing(c, { x: (g.a.x + g.b.x) / 2, z: (g.a.z + g.b.z) / 2 }) })),
    core: m.core ? { id: 'core', x: m.core.x, z: m.core.z, w: m.core.w, d: m.core.d } : undefined,
    bounds: bb,
  }
}

/* ---- highlight geometry for the 3D viewer (scene units) ---- */

export type ElementGeom = { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; dir?: { x: number; z: number } }

/** Scene-space box (and edge direction for panels) for the selected element, so the
 *  viewer can draw a selection highlight. Null if the id isn't in the model. */
export function findElementGeom(m: BuildingModel, id: string): ElementGeom | null {
  if (id === 'core' && m.core) return { center: { x: m.core.x, y: m.core.y, z: m.core.z }, size: { x: m.core.w, y: m.core.h, z: m.core.d } }
  if (id === 'roof' && m.roof) { const b = plateBBox(m.roof.polygon); return { center: { x: (b.minX + b.maxX) / 2, y: m.roof.y + m.roof.thickness / 2, z: (b.minZ + b.maxZ) / 2 }, size: { x: b.maxX - b.minX, y: m.roof.thickness, z: b.maxZ - b.minZ } } }
  const fm = id.match(/^floor-(\d+)$/)
  if (fm) { const s = m.slabs.find((x) => x.level === Number(fm[1])); if (!s) return null; const b = plateBBox(s.polygon); return { center: { x: (b.minX + b.maxX) / 2, y: s.y + s.thickness / 2, z: (b.minZ + b.maxZ) / 2 }, size: { x: b.maxX - b.minX, y: s.thickness, z: b.maxZ - b.minZ } } }
  const cm = id.match(/^col-(\d+)-(\d+)$/)
  if (cm) { const c = levelColumns(m, Number(cm[1]))[Number(cm[2])]; if (!c) return null; return { center: { x: c.x, y: c.y, z: c.z }, size: { x: c.w, y: c.h, z: c.d } } }
  const pm = id.match(/^pan-(\d+)-(\d+)$/)
  if (pm) { const g = levelPanels(m, Number(pm[1]))[Number(pm[2])]; if (!g) return null; return { center: { x: (g.a.x + g.b.x) / 2, y: g.y + g.h / 2, z: (g.a.z + g.b.z) / 2 }, size: { x: dist(g.a, g.b), y: g.h, z: 0.16 }, dir: { x: g.b.x - g.a.x, z: g.b.z - g.a.z } } }
  return null
}

function dist(a: Pt, b: Pt): number { return Math.hypot(b.x - a.x, b.z - a.z) }
