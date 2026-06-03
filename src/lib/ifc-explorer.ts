/* Turns a tessellated IFC model (from extractGeometry) into the same kind of
 * explorable structure the Building Explorer uses for the parametric model: one
 * element per IFC product (grouped from its meshes), grouped by building storey,
 * with real quantities measured from the geometry — bounding dimensions, solid
 * volume (divergence theorem over the triangles) and triangle counts — plus
 * Revit-style schedules per IFC category. Pure given the geometry arrays, so the
 * measurement is unit-tested. Coordinates follow the rendered space (Y up). */

import type { IfcGeometryResult, IfcMesh } from './ifc-geometry'
import type { ScheduleCol } from './building-explorer'

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000

export type IfcExplElement = {
  id: string // `ifc-${expressID}` — matches the viewer selection
  expressID: number
  category: string // friendly IFC type, e.g. Wall / Column / Window
  ifcType: string // raw, e.g. IFCWALLSTANDARDCASE
  level: number // level index; -1 = unassigned
  levelName: string
  mark: string
  title: string
  cols: ScheduleCol[]
  data: Record<string, number | string>
}
export type IfcLevel = { index: number; name: string; elevation: number; storeyExpressID: number | null; elements: number; volume: number; unassigned?: boolean }
export type IfcSchedule = { group: string; category: string; columns: ScheduleCol[]; rows: (Record<string, number | string> & { id: string })[]; totals: Record<string, number> }
export type IfcExplosion = {
  elements: IfcExplElement[]
  byId: Record<string, IfcExplElement>
  byExpress: Record<number, IfcExplElement>
  levels: IfcLevel[]
  schedules: IfcSchedule[]
  summary: { elements: number; storeys: number; categories: number; triangles: number; volume: number }
}

const FRIENDLY: Record<string, string> = {
  IFCWALL: 'Wall', IFCWALLSTANDARDCASE: 'Wall', IFCCURTAINWALL: 'Curtain Wall',
  IFCCOLUMN: 'Column', IFCBEAM: 'Beam', IFCSLAB: 'Slab', IFCROOF: 'Roof', IFCPLATE: 'Plate', IFCMEMBER: 'Member',
  IFCWINDOW: 'Window', IFCDOOR: 'Door', IFCSTAIR: 'Stair', IFCSTAIRFLIGHT: 'Stair Flight', IFCRAILING: 'Railing',
  IFCRAMP: 'Ramp', IFCRAMPFLIGHT: 'Ramp Flight', IFCCOVERING: 'Covering', IFCFOOTING: 'Footing', IFCPILE: 'Pile',
  IFCFURNISHINGELEMENT: 'Furniture', IFCFURNITURE: 'Furniture', IFCBUILDINGELEMENTPROXY: 'Generic',
  IFCSPACE: 'Space', IFCDUCTSEGMENT: 'Duct', IFCPIPESEGMENT: 'Pipe', IFCFLOWTERMINAL: 'Terminal', IFCFLOWSEGMENT: 'Flow Segment',
  IFCDUCTFITTING: 'Duct Fitting', IFCPIPEFITTING: 'Pipe Fitting', IFCCABLECARRIERSEGMENT: 'Cable Tray', IFCLIGHTFIXTURE: 'Light Fixture',
}

/** Friendly category for an IFC type name (e.g. IFCWALLSTANDARDCASE → "Wall"). */
export function friendlyType(ifcTypeName: string): string {
  if (FRIENDLY[ifcTypeName]) return FRIENDLY[ifcTypeName]
  if (!/^IFC[A-Z]/.test(ifcTypeName)) return 'Other'
  const base = ifcTypeName.replace(/^IFC/, '')
  return base.charAt(0) + base.slice(1).toLowerCase()
}

/** Bounding box (world), solid volume (divergence theorem) and triangle count of a
 *  single tessellated mesh. `matrix` is the 4×4 column-major placement; positions
 *  are local xyz triples. Pure. */
export function meshGeom(positions: Float32Array, indices: ArrayLike<number>, matrix: number[]): { min: [number, number, number]; max: [number, number, number]; volume: number; triangles: number } {
  const m = matrix
  const n = positions.length / 3
  const wx = new Float64Array(n), wy = new Float64Array(n), wz = new Float64Array(n)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2]
    const X = m[0] * x + m[4] * y + m[8] * z + m[12]
    const Y = m[1] * x + m[5] * y + m[9] * z + m[13]
    const Z = m[2] * x + m[6] * y + m[10] * z + m[14]
    wx[i] = X; wy[i] = Y; wz[i] = Z
    if (X < min[0]) min[0] = X; if (Y < min[1]) min[1] = Y; if (Z < min[2]) min[2] = Z
    if (X > max[0]) max[0] = X; if (Y > max[1]) max[1] = Y; if (Z > max[2]) max[2] = Z
  }
  let vol6 = 0
  const tris = Math.floor(indices.length / 3)
  for (let t = 0; t < tris; t++) {
    const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2]
    // signed volume of the tetra (origin, a, b, c) = a · (b × c)
    const cxx = wy[b] * wz[c] - wz[b] * wy[c]
    const cyy = wz[b] * wx[c] - wx[b] * wz[c]
    const czz = wx[b] * wy[c] - wy[b] * wx[c]
    vol6 += wx[a] * cxx + wy[a] * cyy + wz[a] * czz
  }
  return { min: min[0] === Infinity ? [0, 0, 0] : min, max: max[0] === -Infinity ? [0, 0, 0] : max, volume: Math.abs(vol6) / 6, triangles: tris }
}

const IFC_COLS: ScheduleCol[] = [
  { key: 'mark', label: 'Element' },
  { key: 'level', label: 'Level' },
  { key: 'type', label: 'IFC type' },
  { key: 'width', label: 'Width', unit: 'm', numeric: true },
  { key: 'depth', label: 'Depth', unit: 'm', numeric: true },
  { key: 'height', label: 'Height', unit: 'm', numeric: true },
  { key: 'volume', label: 'Volume', unit: 'm³', numeric: true, total: true },
  { key: 'triangles', label: 'Tris', numeric: true, total: true },
]

/** Explode a tessellated IFC model into elements, storeys & schedules with real
 *  measured quantities. */
export function explodeIfc(res: IfcGeometryResult): IfcExplosion {
  const storeys = [...res.storeys].sort((a, b) => a.elevation - b.elevation)
  const levelOf = new Map<number, number>()
  storeys.forEach((s, i) => levelOf.set(s.expressID, i))

  // group meshes by IFC product (expressID)
  const groups = new Map<number, IfcMesh[]>()
  for (const m of res.meshes) { const g = groups.get(m.expressID); if (g) g.push(m); else groups.set(m.expressID, [m]) }

  const elements: IfcExplElement[] = []
  let unassignedSeen = false
  for (const [expressID, ms] of groups) {
    const first = ms[0]
    const category = friendlyType(first.ifcTypeName)
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    let volume = 0, triangles = 0
    for (const mm of ms) {
      const q = meshGeom(mm.positions, mm.indices, mm.matrix)
      for (let k = 0; k < 3; k++) { if (q.min[k] < min[k]) min[k] = q.min[k]; if (q.max[k] > max[k]) max[k] = q.max[k] }
      volume += q.volume; triangles += q.triangles
    }
    const storeyId = first.storey
    const level = storeyId !== undefined && levelOf.has(storeyId) ? levelOf.get(storeyId)! : -1
    if (level === -1) unassignedSeen = true
    const levelName = level >= 0 ? storeys[level].name : 'Unassigned'
    const mark = first.name && first.name.trim() ? first.name : `${category} #${expressID}`
    elements.push({
      id: `ifc-${expressID}`, expressID, category, ifcType: first.ifcTypeName, level, levelName, mark, title: mark,
      cols: IFC_COLS,
      data: { mark, level: levelName, type: first.ifcTypeName, width: r2(max[0] - min[0]), depth: r2(max[2] - min[2]), height: r2(max[1] - min[1]), volume: r3(volume), triangles },
    })
  }
  elements.sort((a, b) => (a.level - b.level) || a.category.localeCompare(b.category) || a.expressID - b.expressID)

  const byId: Record<string, IfcExplElement> = {}
  const byExpress: Record<number, IfcExplElement> = {}
  for (const e of elements) { byId[e.id] = e; byExpress[e.expressID] = e }

  // levels (navigator) — storeys + an Unassigned bucket if needed
  const levels: IfcLevel[] = storeys.map((s, i) => ({
    index: i, name: s.name, elevation: r3(s.elevation), storeyExpressID: s.expressID,
    elements: elements.filter((e) => e.level === i).length,
    volume: r3(elements.filter((e) => e.level === i).reduce((t, e) => t + Number(e.data.volume), 0)),
  }))
  if (unassignedSeen) levels.push({ index: -1, name: 'Unassigned', elevation: 0, storeyExpressID: null, unassigned: true, elements: elements.filter((e) => e.level === -1).length, volume: r3(elements.filter((e) => e.level === -1).reduce((t, e) => t + Number(e.data.volume), 0)) })

  // schedules grouped by friendly category
  const cats = [...new Set(elements.map((e) => e.category))].sort()
  const schedules: IfcSchedule[] = cats.map((cat) => {
    const els = elements.filter((e) => e.category === cat)
    const totals: Record<string, number> = { volume: r3(els.reduce((t, e) => t + Number(e.data.volume), 0)), triangles: els.reduce((t, e) => t + Number(e.data.triangles), 0) }
    return { group: cat, category: cat, columns: IFC_COLS, rows: els.map((e) => ({ id: e.id, ...e.data })), totals }
  })

  return {
    elements, byId, byExpress, levels, schedules,
    summary: {
      elements: elements.length, storeys: storeys.length, categories: cats.length,
      triangles: elements.reduce((t, e) => t + Number(e.data.triangles), 0),
      volume: r3(elements.reduce((t, e) => t + Number(e.data.volume), 0)),
    },
  }
}

/* ---- horizontal section (a real floor plan sliced from the geometry) ---- */

export type PlanSegment = { ax: number; az: number; bx: number; bz: number; expressID: number; ifcType: string }
type SliceMesh = { positions: Float32Array; indices: ArrayLike<number>; matrix: number[]; expressID: number; ifcTypeName: string }

/** Intersect one triangle (world coords) with the horizontal plane y=Y → the cut
 *  segment in plan (x,z), or null if it doesn't cross. */
function triSeg(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, y: number): [number, number, number, number] | null {
  const sa = ay - y, sb = by - y, sc = cy - y
  const pts: [number, number][] = []
  const edge = (x0: number, z0: number, s0: number, x1: number, z1: number, s1: number) => {
    if ((s0 > 0 && s1 < 0) || (s0 < 0 && s1 > 0)) { const t = s0 / (s0 - s1); pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]) }
  }
  edge(ax, az, sa, bx, bz, sb); edge(bx, bz, sb, cx, cz, sc); edge(cx, cz, sc, ax, az, sa)
  return pts.length === 2 ? [pts[0][0], pts[0][1], pts[1][0], pts[1][1]] : null
}

/** Slice a set of tessellated meshes with the horizontal plane y=Y, returning the
 *  cut segments in plan (x = East, z = North) tagged with their IFC product — a real
 *  floor-plan section through the model. Pure. */
export function sliceMeshes(meshes: SliceMesh[], y: number): PlanSegment[] {
  const out: PlanSegment[] = []
  for (const m of meshes) {
    const mat = m.matrix, pos = m.positions, idx = m.indices
    const n = pos.length / 3
    const wx = new Float64Array(n), wy = new Float64Array(n), wz = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], yv = pos[i * 3 + 1], z = pos[i * 3 + 2]
      wx[i] = mat[0] * x + mat[4] * yv + mat[8] * z + mat[12]
      wy[i] = mat[1] * x + mat[5] * yv + mat[9] * z + mat[13]
      wz[i] = mat[2] * x + mat[6] * yv + mat[10] * z + mat[14]
    }
    const tris = Math.floor(idx.length / 3)
    for (let t = 0; t < tris; t++) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]
      const s = triSeg(wx[a], wy[a], wz[a], wx[b], wy[b], wz[b], wx[c], wy[c], wz[c], y)
      if (s) out.push({ ax: s[0], az: s[1], bx: s[2], bz: s[3], expressID: m.expressID, ifcType: m.ifcTypeName })
    }
  }
  return out
}

/** A sensible plan-cut height for a set of meshes: a fraction up from their lowest
 *  point (≈ just above the floor, through walls/columns). Pure. */
export function cutHeightFor(meshes: SliceMesh[], frac = 0.3): number {
  let min = Infinity, max = -Infinity
  for (const m of meshes) { const g = meshGeom(m.positions, m.indices, m.matrix); if (g.min[1] < min) min = g.min[1]; if (g.max[1] > max) max = g.max[1] }
  return min === Infinity ? 0 : min + (max - min) * frac
}
