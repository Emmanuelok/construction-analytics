/* IFC → editable parametric model — pure, unit-tested. Rationalizes an uploaded,
 * tessellated IFC (from extractGeometry) into the SAME BuildingModel the Building
 * Explorer edits: every IFC product becomes an axis-aligned primitive (column / beam
 * / wall / window / door / slab / space) sized from its world bounding box and tagged
 * with its storey, so an imported model can be moved, resized, deleted, scheduled and
 * re-exported (IFC / OBJ / glTF) by the existing editor. It's a rationalization — a
 * bounding-box reconstruction, not the original B-rep — but it makes a real upload
 * genuinely editable. IFC world is metres, Y-up here (rendered space); the model's
 * scene units convert back via the plan scale + storey height. No DOM, no Three.js. */

import type { BuildingModel, Box, Quad, Beam, Plate, Room } from './building'
import type { IfcGeometryResult, IfcMesh } from './ifc-geometry'
import { meshGeom } from './ifc-explorer'
import { PLATE_SCALE, SCENE_LEN_TO_M } from './massing'

const LEN = SCENE_LEN_TO_M
const r1 = (n: number) => Math.round(n * 10) / 10

type Bucket = 'column' | 'beam' | 'wall' | 'window' | 'door' | 'slab' | 'space' | 'skip'

/** Map an IFC type (+ bbox proportions) to a parametric primitive bucket. */
function bucketFor(t: string, sx: number, sy: number, sz: number): Bucket {
  if (/^IFC(WALLSTANDARDCASE|WALL|CURTAINWALL|RAILING)/.test(t)) return 'wall'
  if (/^IFC(COLUMN|PILE)/.test(t)) return 'column'
  if (/^IFC(BEAM|MEMBER)/.test(t)) return 'beam'
  if (/^IFCWINDOW/.test(t)) return 'window'
  if (/^IFCDOOR/.test(t)) return 'door'
  if (/^IFC(SLAB|ROOF|PLATE|COVERING|FOOTING)/.test(t)) return 'slab'
  if (/^IFCSPACE/.test(t)) return 'space'
  // unknown product (proxy / furniture / MEP / stairs…) → classify by shape
  const hMax = Math.max(sx, sz, 1e-6), hMin = Math.min(sx, sz)
  if (sy <= hMax * 0.5) return 'slab' // flat
  if (sy >= hMax * 1.3 && hMin <= hMax * 0.4) return 'wall' // tall + planar
  return 'column' // box / stocky
}

type ElBox = { expressID: number; type: string; bucket: Bucket; level: number; name?: string; min: [number, number, number]; max: [number, number, number] }

/** Rationalize a tessellated IFC into an editable BuildingModel + the storey height
 *  it was reconstructed at. */
export function ifcToModel(res: IfcGeometryResult, opts: { storeyHeight?: number } = {}): { model: BuildingModel; storeyHeight: number; name?: string } {
  const storeys = [...res.storeys].sort((a, b) => a.elevation - b.elevation)
  const levelOf = new Map<number, number>()
  storeys.forEach((s, i) => levelOf.set(s.expressID, i))

  // group meshes per product, measure world bbox + classify
  const groups = new Map<number, IfcMesh[]>()
  for (const m of res.meshes) { const g = groups.get(m.expressID); if (g) g.push(m); else groups.set(m.expressID, [m]) }
  const els: ElBox[] = []
  for (const [expressID, ms] of groups) {
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    for (const mm of ms) { const q = meshGeom(mm.positions, mm.indices, mm.matrix); for (let k = 0; k < 3; k++) { if (q.min[k] < min[k]) min[k] = q.min[k]; if (q.max[k] > max[k]) max[k] = q.max[k] } }
    if (min[0] === Infinity) continue
    const type = ms[0].ifcTypeName
    const bucket = bucketFor(type, max[0] - min[0], max[1] - min[1], max[2] - min[2])
    const storeyId = ms[0].storey
    const level = storeyId != null && levelOf.has(storeyId) ? levelOf.get(storeyId)! : -1
    els.push({ expressID, type, bucket, level, name: ms[0].name, min, max })
  }
  if (!els.length) return { model: emptyModel(), storeyHeight: opts.storeyHeight ?? 3.6 }

  // storey height: explicit, else the median storey gap, else a default
  const elevs = storeys.map((s) => s.elevation)
  const gaps = elevs.slice(1).map((e, i) => e - elevs[i]).filter((g) => g > 0.5).sort((a, b) => a - b)
  const sh = Math.max(2, opts.storeyHeight ?? (gaps.length ? gaps[Math.floor(gaps.length / 2)] : 3.6))

  // overall bbox → plan centre + vertical datum (lowest point)
  const oMin = [Infinity, Infinity, Infinity], oMax = [-Infinity, -Infinity, -Infinity]
  for (const e of els) for (let k = 0; k < 3; k++) { if (e.min[k] < oMin[k]) oMin[k] = e.min[k]; if (e.max[k] > oMax[k]) oMax[k] = e.max[k] }
  const cx = (oMin[0] + oMax[0]) / 2, cz = (oMin[2] + oMax[2]) / 2
  const y0 = storeys.length ? Math.min(storeys[0].elevation, oMin[1]) : oMin[1]
  const SX = (x: number) => (x - cx) * PLATE_SCALE
  const SZ = (z: number) => (z - cz) * PLATE_SCALE
  const SY = (y: number) => (y - y0) / sh
  const SL = (m: number) => m * PLATE_SCALE // horizontal length → scene
  const SV = (m: number) => m / sh // vertical length → scene

  // unassigned elements → the storey whose elevation sits just below their mid-height
  const levelByY = (ym: number) => { let lv = 0; for (let i = 0; i < storeys.length; i++) if (storeys[i].elevation <= ym + 1e-6) lv = i; return storeys.length ? lv : 0 }
  for (const e of els) if (e.level < 0) e.level = levelByY((e.min[1] + e.max[1]) / 2)

  const columns: Box[] = [], beams: Beam[] = [], walls: Quad[] = [], glazing: Quad[] = [], doors: Quad[] = [], slabEls: ElBox[] = [], rooms: Room[] = []
  const id = (e: ElBox) => `ifc-${e.expressID}`
  for (const e of els) {
    const midX = (e.min[0] + e.max[0]) / 2, midZ = (e.min[2] + e.max[2]) / 2, midY = (e.min[1] + e.max[1]) / 2
    const sx = e.max[0] - e.min[0], sy = e.max[1] - e.min[1], sz = e.max[2] - e.min[2]
    const alongX = sx >= sz // longer horizontal axis
    const a = alongX ? { x: SX(e.min[0]), z: SZ(midZ) } : { x: SX(midX), z: SZ(e.min[2]) }
    const b = alongX ? { x: SX(e.max[0]), z: SZ(midZ) } : { x: SX(midX), z: SZ(e.max[2]) }
    if (e.bucket === 'column') columns.push({ x: SX(midX), y: SY(midY), z: SZ(midZ), w: Math.max(SL(sx), 0.02), h: Math.max(SV(sy), 0.02), d: Math.max(SL(sz), 0.02), level: e.level, id: id(e) })
    else if (e.bucket === 'beam') beams.push({ a, b, y: SY(midY), depth: Math.max(SV(sy), 0.02), width: Math.max(SL(Math.min(sx, sz)), 0.02), level: e.level, id: id(e) })
    else if (e.bucket === 'wall') walls.push({ a, b, y: SY(e.min[1]), h: Math.max(SV(sy), 0.05), level: e.level, id: id(e) })
    else if (e.bucket === 'window') glazing.push({ a, b, y: SY(e.min[1]), h: Math.max(SV(sy), 0.05), level: e.level, id: id(e) })
    else if (e.bucket === 'door') doors.push({ a, b, y: SY(e.min[1]), h: Math.max(SV(sy), 0.05), level: e.level, id: id(e) })
    else if (e.bucket === 'slab') slabEls.push(e)
    else if (e.bucket === 'space') rooms.push({ id: id(e), level: e.level, name: e.name?.trim() || `Space ${e.expressID}`, polygon: rect(SX(e.min[0]), SX(e.max[0]), SZ(e.min[2]), SZ(e.max[2])), center: { x: SX(midX), z: SZ(midZ) }, area: r1(sx * sz), perimeter: r1(2 * (sx + sz)) })
  }

  // one floor slab per level (id floor-N, matching the explorer's convention) —
  // aggregated from that level's IFC slabs, or synthesized so the plan + isolate work
  const S = Math.max(1, storeys.length)
  const slabs: Plate[] = []
  for (let lv = 0; lv < S; lv++) {
    const onSlabs = slabEls.filter((e) => e.level === lv)
    const onAny = els.filter((e) => e.level === lv && e.bucket !== 'space')
    const u = unionXZ(onSlabs.length ? onSlabs : (onAny.length ? onAny : els))
    const yBase = storeys.length ? SY(storeys[lv].elevation) : lv
    const thick = onSlabs.length ? Math.max(...onSlabs.map((e) => SV(e.max[1] - e.min[1]))) : 0.04
    slabs.push({ polygon: rect(SX(u.x0), SX(u.x1), SZ(u.z0), SZ(u.z1)), y: yBase, thickness: Math.max(thick, 0.02), level: lv, id: `floor-${lv}` })
  }

  const totalHeight = Math.max(0.6, SV(oMax[1] - y0))
  const footprint = r1(Math.max((oMax[0] - oMin[0]) * PLATE_SCALE, (oMax[2] - oMin[2]) * PLATE_SCALE))
  const model: BuildingModel = {
    slabs, columns, beams, walls, glazing, doors, mullions: [], partitions: [], interiorDoors: [], stairs: [], core: null, roof: null, rooms,
    totalHeight, footprint,
    counts: { storeys: S, columns: columns.length, beams: beams.length, windows: glazing.length, doors: doors.length, walls: walls.length, mullions: 0, partitions: 0, interiorDoors: 0, stairs: 0, slabs: slabs.length, rooms: rooms.length },
  }
  return { model, storeyHeight: sh }
}

const rect = (x0: number, x1: number, z0: number, z1: number) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]
function unionXZ(els: ElBox[]) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const e of els) { if (e.min[0] < x0) x0 = e.min[0]; if (e.max[0] > x1) x1 = e.max[0]; if (e.min[2] < z0) z0 = e.min[2]; if (e.max[2] > z1) z1 = e.max[2] }
  return { x0, x1, z0, z1 }
}
function emptyModel(): BuildingModel {
  return { slabs: [], columns: [], beams: [], walls: [], glazing: [], doors: [], mullions: [], partitions: [], interiorDoors: [], stairs: [], core: null, roof: null, rooms: [], totalHeight: 1, footprint: 1, counts: { storeys: 1, columns: 0, beams: 0, windows: 0, doors: 0, walls: 0, mullions: 0, partitions: 0, interiorDoors: 0, stairs: 0, slabs: 0, rooms: 0 } }
}
