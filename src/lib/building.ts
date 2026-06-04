/* Componentized building — pure, unit-tested. Turns the parametric massing (per-
 * floor plates) into the parts of an actual building: floor slabs, a perimeter
 * structural column grid + edge beams, an articulated façade (opaque walls with a
 * grid of real windows + mullions), ground-floor doors, a central core and a roof.
 * The viewer renders these as real meshes you can see, toggle by trade, click to
 * inspect and schedule — so the model reads as a building, not a solid prism. No
 * Three.js, no DOM. Scene units; the viewer draws geometry at these coordinates. */

import { type Pt, polygonCentroid } from './zoning'
import { PLATE_SCALE, type Massing } from './massing'
import { floorRooms, type Room } from './building-rooms'
import { floorPartitions } from './building-partitions'
import { coreStairs, type Stair } from './building-stairs'
export type { Room } from './building-rooms'
export type { Stair } from './building-stairs'

export type Box = { x: number; y: number; z: number; w: number; h: number; d: number; level?: number; id?: string } // centre + full size
export type Quad = { a: Pt; b: Pt; y: number; h: number; level?: number; id?: string } // vertical panel along edge a→b, base y, height h
export type Beam = { a: Pt; b: Pt; y: number; depth: number; width: number; level?: number; id?: string } // horizontal member along a→b, centre y
export type Plate = { polygon: Pt[]; hole?: Pt[]; y: number; thickness: number; level?: number; id?: string } // slab/roof at elevation y

export type BuildingModel = {
  slabs: Plate[]
  columns: Box[]
  beams: Beam[]
  walls: Quad[] // opaque façade panel per edge per floor
  glazing: Quad[] // discrete window panels (a grid of real windows)
  doors: Quad[] // ground-floor entrance doors
  mullions: Box[] // vertical façade framing between windows
  partitions: Quad[] // interior walls between rooms / around the core
  stairs: Stair[] // a straight-run stair flight per storey, in the core
  core: Box | null
  roof: Plate | null
  rooms: Room[] // interior spaces, per floor
  totalHeight: number
  footprint: number
  counts: { storeys: number; columns: number; beams: number; windows: number; doors: number; walls: number; mullions: number; partitions: number; stairs: number; slabs: number; rooms: number }
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.z - a.z)
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
const extentOf = (poly: Pt[]) => {
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
}
/** Outward unit normal of edge a→b for a polygon with the given centroid (x=E, z=N). */
function outwardNormal(a: Pt, b: Pt, c: Pt): Pt {
  const dx = b.x - a.x, dz = b.z - a.z
  const L = Math.hypot(dx, dz) || 1
  let nx = dz / L, nz = -dx / L // one perpendicular
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2
  if ((mx - c.x) * nx + (mz - c.z) * nz < 0) { nx = -nx; nz = -nz } // flip to face away from centroid
  return { x: nx, z: nz }
}
const off = (p: Pt, n: Pt, d: number): Pt => ({ x: p.x + n.x * d, z: p.z + n.z * d })

/** Build the component model from a massing. Optional knobs articulate the façade
 *  (window bay width, window-to-wall ratio, mullions), the structure (column
 *  spacing, beam depth) and the core. */
export function buildBuilding(m: Massing, opts?: {
  columnSpacing?: number; coreRatio?: number; bayWidth?: number; wwr?: number; beamDepth?: number; mullions?: boolean
}): BuildingModel {
  const spacing = Math.max(0.5, opts?.columnSpacing ?? 3.2)
  const coreRatio = Math.max(0, Math.min(0.6, opts?.coreRatio ?? 0.16))
  const bayWidth = Math.max(1.2, opts?.bayWidth ?? 3.4) * PLATE_SCALE // metres → scene
  const wwr = Math.max(0.15, Math.min(0.85, opts?.wwr ?? 0.55))
  const beamDepth = Math.max(0.06, Math.min(0.3, opts?.beamDepth ?? 0.14)) // scene-Y; ≈ depth/storey
  const withMullions = opts?.mullions ?? true
  const slabT = 0.12
  const facadeOff = 0.06 // windows/mullions sit proud of the wall plane

  const slabs: Plate[] = []
  const columns: Box[] = []
  const beams: Beam[] = []
  const walls: Quad[] = []
  const glazing: Quad[] = []
  const doors: Quad[] = []
  const mullions: Box[] = []

  // ground-floor frontage = the longest edge, where entrance doors go
  const f0 = m.floors[0]
  let frontEdge = -1
  if (f0) {
    let best = -1
    for (let i = 0; i < f0.polygon.length; i++) { const L = dist(f0.polygon[i], f0.polygon[(i + 1) % f0.polygon.length]); if (L > best) { best = L; frontEdge = i } }
  }

  for (const f of m.floors) {
    const base = f.y - f.height / 2
    const floorH = f.height
    slabs.push({ polygon: f.polygon, hole: f.hole, y: base, thickness: slabT, level: f.index, id: `floor-${f.index}` })
    const poly = f.polygon
    const c = polygonCentroid(poly)
    const winBase = base + slabT
    const winH = (floorH - slabT) * wwr
    const sill = winBase + ((floorH - slabT) - winH) * 0.5
    let bi = 0, wi = 0, pi = 0, di = 0, mi = 0, ci = 0 // per-level element counters → stable ids

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length]
      const L = dist(a, b)
      if (L < 1e-3) continue
      const n = outwardNormal(a, b, c)

      // edge beam under the slab above (the structural frame)
      beams.push({ a, b, y: base + floorH - beamDepth / 2, depth: beamDepth, width: 0.12, level: f.index, id: `beam-${f.index}-${bi++}` })
      // opaque façade wall (full edge)
      walls.push({ a, b, y: winBase, h: floorH - slabT, level: f.index, id: `wall-${f.index}-${wi++}` })

      const bays = Math.max(1, Math.round(L / bayWidth))
      for (let k = 0; k < bays; k++) {
        const wa = off(lerp(a, b, (k + 0.16) / bays), n, facadeOff)
        const wb = off(lerp(a, b, (k + 0.84) / bays), n, facadeOff)
        const isDoor = f.index === 0 && i === frontEdge && Math.abs(k - (bays - 1) / 2) < 0.6 // centre bay(s) of the frontage
        if (isDoor) doors.push({ a: wa, b: wb, y: base, h: winBase - base + (sill - winBase) + winH * 0.95, level: 0, id: `door-0-${di++}` })
        else glazing.push({ a: wa, b: wb, y: sill, h: winH, level: f.index, id: `pan-${f.index}-${pi++}` })
      }
      if (withMullions) {
        for (let k = 0; k <= bays; k++) {
          const p = off(lerp(a, b, k / bays), n, facadeOff)
          mullions.push({ x: p.x, y: winBase + (floorH - slabT) / 2, z: p.z, w: 0.09, h: floorH - slabT, d: 0.14, level: f.index, id: `mull-${f.index}-${mi++}` })
        }
      }

      const segs = Math.max(1, Math.round(L / spacing))
      for (let s = 0; s < segs; s++) {
        const t = s / segs
        columns.push({ x: a.x + (b.x - a.x) * t, y: base + floorH / 2, z: a.z + (b.z - a.z) * t, w: 0.12, h: floorH, d: 0.12, level: f.index, id: `col-${f.index}-${ci++}` })
      }
    }
  }

  let core: Box | null = null
  if (coreRatio > 0 && f0) {
    const cc = polygonCentroid(f0.polygon)
    const side = extentOf(f0.polygon) * coreRatio
    core = { x: cc.x, y: m.totalHeight / 2, z: cc.z, w: side, h: m.totalHeight, d: side, id: 'core' }
  }

  const top = m.floors[m.floors.length - 1]
  const roof = top ? { polygon: top.polygon, hole: top.hole, y: top.y + top.height / 2 - slabT, thickness: slabT, level: m.floors.length, id: 'roof' } : null

  const coreBox = core ? { x: core.x, z: core.z, w: core.w, d: core.d } : null
  const rooms: Room[] = []
  const partitions: Quad[] = []
  for (const f of m.floors) {
    rooms.push(...floorRooms(f.polygon, { level: f.index, core: coreBox }))
    const base = f.y - f.height / 2
    partitions.push(...floorPartitions(f.polygon, { level: f.index, core: coreBox, base: base + slabT, height: f.height - slabT }))
  }
  // a stair flight per storey, climbing inside the core
  const stairs = coreStairs(coreBox, m.floors.map((f) => ({ base: f.y - f.height / 2, height: f.height, level: f.index })))

  return {
    slabs, columns, beams, walls, glazing, doors, mullions, partitions, stairs, core, roof, rooms,
    totalHeight: m.totalHeight,
    footprint: m.footprint,
    counts: { storeys: m.storeys, columns: columns.length, beams: beams.length, windows: glazing.length, doors: doors.length, walls: walls.length, mullions: mullions.length, partitions: partitions.length, stairs: stairs.length, slabs: slabs.length, rooms: rooms.length },
  }
}
