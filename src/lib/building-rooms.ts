/* Interior floor layout — pure, unit-tested. Lays a floor plate out the way a real
 * building is planned, not as a wall-to-wall grid of cells:
 *   · a lift-lobby ring of corridor around the core,
 *   · full-depth spine corridors along the core flanks,
 *   · cross corridors every two room bays (double-loaded), and
 *   · rooms only in the bands between corridors, clipped to the plate outline.
 * Corridors are emitted as real circulation spaces (use: 'circulation'), and every
 * room is assigned its entrance: a BFS over the cell graph from the corridors gives
 * each room the edge its door sits on (rooms far from a corridor chain through a
 * neighbouring room, like a suite). The same grid drives the partition walls
 * (building-partitions), so plan, 3D, schedules and egress all agree. Scene units;
 * areas in m² via the plan scale. No DOM, no Three.js. */

import { type Pt, polygonArea, polygonPerimeter, polygonCentroid } from './zoning'
import { SCENE_LEN_TO_M } from './massing'

const LEN = SCENE_LEN_TO_M
const AREA = LEN * LEN
const r1 = (n: number) => Math.round(n * 10) / 10

export type Room = { id: string; level: number; name: string; polygon: Pt[]; center: Pt; area: number; perimeter: number; use?: string; finish?: string }
export type GridOpts = { level?: number; roomSize?: number; corridorWidth?: number; core?: { x: number; z: number; w: number; d: number } | null; minArea?: number }

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
export function clipToRect(poly: Pt[], x0: number, x1: number, z0: number, z1: number): Pt[] {
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

export type CellKind = 'room' | 'corridor' | 'core' | 'void'
export type GridCell = { i: number; j: number; clipped: Pt[]; center: Pt; areaM2: number; kind: CellKind; room: boolean; doorTo: 'N' | 'S' | 'E' | 'W' | null }
export type FloorGrid = {
  minX: number; minZ: number; cols: number; rows: number
  xs: number[]; zs: number[] // band boundaries (cols+1 / rows+1) — bands are non-uniform
  cells: GridCell[] // row-major (cells[j*cols+i])
}

/* Band boundaries along one axis: room bands between corridor strips. With a core,
 * corridors hug both core edges (the lobby ring / spines) and march outward every
 * two room depths; without one, a single central corridor. The outermost zone stays
 * one (possibly deeper) band so it always faces the last corridor. Small spans get
 * no corridor at all. Returns boundaries plus the corridor intervals. */
function axisBands(min: number, max: number, core: [number, number] | null, room: number, corr: number): { bounds: number[]; corridors: [number, number][] } {
  const span = max - min
  const corridors: [number, number][] = []
  // ≤2 bands between corridors (double-loaded: each band faces its own corridor);
  // exactly 1 band in the outermost zones (a perimeter zone facing the last corridor)
  const subdivide = (a: number, b: number, maxBands: number) => {
    const out: number[] = []
    const len = b - a
    if (len <= 1e-9) return out
    const n = Math.min(maxBands, Math.max(1, Math.round(len / room)))
    for (let k = 1; k < n; k++) out.push(a + (len * k) / n)
    return out
  }
  if (span < 2 * room + corr) {
    const bounds = [min, ...subdivide(min, max, 8), max] // small plate: no corridor on this axis
    return { bounds, corridors }
  }
  if (core && core[1] - core[0] > 1e-6) {
    const lo = Math.max(min + room * 0.6, core[0] - corr), hi = Math.min(max - room * 0.6, core[1] + corr)
    corridors.push([lo, lo + corr])
    if (hi - corr > lo + corr + 1e-6) corridors.push([hi - corr, hi])
  } else {
    const mid = (min + max) / 2
    corridors.push([mid - corr / 2, mid + corr / 2])
  }
  // march outward every two room depths until the leftover perimeter zone is shallow
  // enough to face the last corridor directly (≤ ~2.6 room depths, drawn as one band)
  let top = corridors[corridors.length - 1][1]
  while (max - top > 2.6 * room + corr) { top += 2 * room; corridors.push([top, top + corr]); top += corr }
  let bot = corridors[0][0]
  while (bot - min > 2.6 * room + corr) { bot -= 2 * room; corridors.push([bot - corr, bot]); bot -= corr }
  corridors.sort((a, b) => a[0] - b[0])
  // boundaries: plate edges + corridor edges + room subdivisions between them
  const bounds: number[] = [min]
  let cursor = min
  for (let c = 0; c <= corridors.length; c++) {
    const segEnd = c < corridors.length ? corridors[c][0] : max
    const isOuter = c === 0 || c === corridors.length
    bounds.push(...subdivide(cursor, segEnd, isOuter ? 1 : 2))
    if (segEnd > cursor + 1e-9) bounds.push(segEnd)
    if (c < corridors.length) { bounds.push(corridors[c][1]); cursor = corridors[c][1] }
  }
  const uniq = [...new Set(bounds.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b)
  return { bounds: uniq, corridors }
}
const inAny = (v: number, ranges: [number, number][]) => ranges.some(([a, b]) => v > a + 1e-9 && v < b - 1e-9)

/** Lay out a floor plate: banded grid with cell kinds (room / corridor / core / void)
 *  and a door assignment per room (BFS from the corridors). Single source of truth
 *  for rooms, corridors and the partition walls between them. */
export function floorGrid(poly: Pt[], opts: GridOpts = {}): FloorGrid | null {
  if (poly.length < 3) return null
  const room = Math.max(2, opts.roomSize ?? 8) / LEN // metres → scene
  const corr = Math.max(1.2, opts.corridorWidth ?? 2.0) / LEN
  const minArea = opts.minArea ?? 4 // m²
  const core = opts.core ?? null
  const xs0 = poly.map((p) => p.x), zs0 = poly.map((p) => p.z)
  const minX = Math.min(...xs0), maxX = Math.max(...xs0), minZ = Math.min(...zs0), maxZ = Math.max(...zs0)
  const bx = axisBands(minX, maxX, core ? [core.x - core.w / 2, core.x + core.w / 2] : null, room, corr)
  const bz = axisBands(minZ, maxZ, core ? [core.z - core.d / 2, core.z + core.d / 2] : null, room, corr)
  const xs = bx.bounds, zs = bz.bounds
  const cols = xs.length - 1, rows = zs.length - 1
  const cells: GridCell[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1]
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
      const clipped = clipToRect(poly, x0, x1, z0, z1)
      let kind: CellKind = 'void'
      let areaM2 = 0
      let center: Pt = { x: cx, z: cz }
      if (clipped.length >= 3) {
        areaM2 = polygonArea(clipped) * AREA
        center = polygonCentroid(clipped)
        const isCorr = inAny(cx, bx.corridors) || inAny(cz, bz.corridors)
        if (core && inBox(center, core)) kind = 'core'
        else if (isCorr && areaM2 > 0.5) kind = 'corridor'
        else if (areaM2 >= minArea) kind = 'room'
      }
      cells.push({ i, j, clipped, center, areaM2, kind, room: kind === 'room', doorTo: null })
    }
  }
  // BFS from every corridor cell across room cells → each room's entrance edge
  // (rooms beyond the first depth chain through their neighbour, like a suite)
  const at = (i: number, j: number) => (i >= 0 && i < cols && j >= 0 && j < rows ? cells[j * cols + i] : null)
  const queue: GridCell[] = cells.filter((c) => c.kind === 'corridor')
  const seen = new Set(queue.map((c) => `${c.i},${c.j}`))
  const DIRS: ['N' | 'S' | 'E' | 'W', number, number][] = [['N', 0, 1], ['S', 0, -1], ['E', 1, 0], ['W', -1, 0]]
  while (queue.length) {
    const cur = queue.shift()!
    for (const [dir, di, dj] of DIRS) {
      const nb = at(cur.i + di, cur.j + dj)
      if (!nb || nb.kind !== 'room' || seen.has(`${nb.i},${nb.j}`)) continue
      // the neighbour's door faces back toward `cur`
      nb.doorTo = dir === 'N' ? 'S' : dir === 'S' ? 'N' : dir === 'E' ? 'W' : 'E'
      seen.add(`${nb.i},${nb.j}`)
      queue.push(nb)
    }
  }
  return { minX, minZ, cols, rows, xs, zs, cells }
}

/** Rooms + corridors for a floor. Rooms come first (Room L.NN), then the corridor
 *  segments as circulation spaces (Corridor L.CNN, use: 'circulation'). */
export function floorRooms(poly: Pt[], opts: GridOpts = {}): Room[] {
  const g = floorGrid(poly, opts)
  if (!g) return []
  const level = opts.level ?? 0
  const lvl = level === 0 ? 'G' : String(level)
  const out: Room[] = []
  let n = 0
  for (const c of g.cells) {
    if (c.kind !== 'room') continue
    n += 1
    out.push({
      id: `room-${level}-${n - 1}`, level, name: `Room ${lvl}.${String(n).padStart(2, '0')}`,
      polygon: c.clipped, center: c.center, area: r1(c.areaM2), perimeter: r1(polygonPerimeter(c.clipped) * LEN),
    })
  }
  let k = 0
  for (const c of g.cells) {
    if (c.kind !== 'corridor') continue
    k += 1
    out.push({
      id: `room-${level}-${n + k - 1}`, level, name: `Corridor ${lvl}.C${String(k).padStart(2, '0')}`,
      polygon: c.clipped, center: c.center, area: r1(c.areaM2), perimeter: r1(polygonPerimeter(c.clipped) * LEN),
      use: 'circulation',
    })
  }
  return out
}
