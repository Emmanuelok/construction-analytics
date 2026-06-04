/* Interior room layout — pure, unit-tested. Subdivides a floor plate into a grid of
 * rooms (offices), clipping each cell to the floor outline (Sutherland–Hodgman) and
 * dropping cells that fall in the core. Gives the building real interior spaces with
 * areas — a room schedule, plan regions, and IfcSpace on export. The same grid feeds
 * the interior partition walls (building-partitions), so rooms and the walls that
 * enclose them stay in lock-step. Scene units; areas convert to m² via the plan
 * scale. No DOM, no Three.js. */

import { type Pt, polygonArea, polygonPerimeter, polygonCentroid } from './zoning'
import { SCENE_LEN_TO_M } from './massing'

const LEN = SCENE_LEN_TO_M
const AREA = LEN * LEN
const r1 = (n: number) => Math.round(n * 10) / 10

export type Room = { id: string; level: number; name: string; polygon: Pt[]; center: Pt; area: number; perimeter: number }
export type GridOpts = { level?: number; roomSize?: number; core?: { x: number; z: number; w: number; d: number } | null; minArea?: number }

/** Clip a polygon by one half-plane: keep points where inside(p), inserting the
 *  boundary crossing where an edge exits/enters. */
function clipHalf(poly: Pt[], inside: (p: Pt) => boolean, cross: (a: Pt, b: Pt) => Pt): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const ina = inside(a), inb = inside(b)
    if (ina) out.push(a)
    if (ina !== inb) out.push(cross(a, b))
  }
  return out
}
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })

/** Intersection of polygon with the axis-aligned rectangle [x0,x1]×[z0,z1]. */
function clipToRect(poly: Pt[], x0: number, x1: number, z0: number, z1: number): Pt[] {
  let p = poly
  p = clipHalf(p, (q) => q.x >= x0, (a, b) => lerp(a, b, (x0 - a.x) / (b.x - a.x)))
  if (p.length < 3) return []
  p = clipHalf(p, (q) => q.x <= x1, (a, b) => lerp(a, b, (x1 - a.x) / (b.x - a.x)))
  if (p.length < 3) return []
  p = clipHalf(p, (q) => q.z >= z0, (a, b) => lerp(a, b, (z0 - a.z) / (b.z - a.z)))
  if (p.length < 3) return []
  p = clipHalf(p, (q) => q.z <= z1, (a, b) => lerp(a, b, (z1 - a.z) / (b.z - a.z)))
  return p.length >= 3 ? p : []
}

const inBox = (p: Pt, c: { x: number; z: number; w: number; d: number }) => Math.abs(p.x - c.x) <= c.w / 2 && Math.abs(p.z - c.z) <= c.d / 2

export type GridCell = { i: number; j: number; clipped: Pt[]; center: Pt; areaM2: number; room: boolean }
export type FloorGrid = { minX: number; minZ: number; cols: number; rows: number; cw: number; cd: number; cells: GridCell[] }

/** Grid a floor plate into clipped cells, flagging which become rooms (cell big
 *  enough and not inside the core). Row-major (cells[j*cols+i]); the single source of
 *  truth for both the room layout and the partition walls between them. */
export function floorGrid(poly: Pt[], opts: GridOpts = {}): FloorGrid | null {
  if (poly.length < 3) return null
  const cell = Math.max(2, opts.roomSize ?? 8) * (1 / LEN) // metres → scene
  const minArea = opts.minArea ?? 4 // m²
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const cols = Math.max(1, Math.round((maxX - minX) / cell)), rows = Math.max(1, Math.round((maxZ - minZ) / cell))
  const cw = (maxX - minX) / cols, cd = (maxZ - minZ) / rows
  const cells: GridCell[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = minX + i * cw, x1 = x0 + cw, z0 = minZ + j * cd, z1 = z0 + cd
      const clipped = clipToRect(poly, x0, x1, z0, z1)
      let room = false, areaM2 = 0, center: Pt = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 }
      if (clipped.length >= 3) {
        areaM2 = polygonArea(clipped) * AREA
        center = polygonCentroid(clipped)
        room = areaM2 >= minArea && !(opts.core ? inBox(center, opts.core) : false)
      }
      cells.push({ i, j, clipped, center, areaM2, room })
    }
  }
  return { minX, minZ, cols, rows, cw, cd, cells }
}

/** Subdivide a floor plate into rooms. `roomSize` is the target room dimension (m);
 *  cells overlapping the core are dropped (circulation). */
export function floorRooms(poly: Pt[], opts: GridOpts = {}): Room[] {
  const g = floorGrid(poly, opts)
  if (!g) return []
  const level = opts.level ?? 0
  const rooms: Room[] = []
  let n = 0
  for (const c of g.cells) {
    if (!c.room) continue
    n += 1
    rooms.push({
      id: `room-${level}-${n - 1}`, level, name: `Room ${level === 0 ? 'G' : level}.${String(n).padStart(2, '0')}`,
      polygon: c.clipped, center: c.center, area: r1(c.areaM2), perimeter: r1(polygonPerimeter(c.clipped) * LEN),
    })
  }
  return rooms
}
