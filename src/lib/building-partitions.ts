/* Interior partition walls — pure, unit-tested. Derives the walls from the same
 * banded floor grid that lays out the rooms and corridors (building-rooms →
 * floorGrid), so plan, 3D, schedules and egress agree:
 *   · room ↔ room and room ↔ corridor edges get a wall,
 *   · each room's entrance edge (its BFS doorTo) gets a doorway carved in — one
 *     door per room, opening onto the corridor (or chaining through a suite),
 *   · corridor ↔ corridor and corridor ↔ core edges stay open (that's the lobby),
 *   · room ↔ core edges are solid.
 * Perimeter is left to the façade. Scene units; no DOM, no Three.js. */

import { type Pt } from './zoning'
import { floorGrid, type GridOpts, type GridCell } from './building-rooms'
import { SCENE_LEN_TO_M } from './massing'
import type { Quad } from './building'

const LEN = SCENE_LEN_TO_M
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.z - a.z)
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })

/** Ray-cast point-in-polygon (x east, z north). */
export function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.z > p.z) !== (b.z > p.z)) {
      const x = a.x + ((p.z - a.z) / (b.z - a.z)) * (b.x - a.x)
      if (p.x < x) inside = !inside
    }
  }
  return inside
}

/** Sub-segments of a→b that lie inside the polygon (handles convex & non-convex
 *  floors: splits at every edge crossing, keeps the spans whose midpoint is inside). */
export function clipSegment(a: Pt, b: Pt, poly: Pt[]): [Pt, Pt][] {
  const dx = b.x - a.x, dz = b.z - a.z
  const ts = [0, 1]
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    const ex = q.x - p.x, ez = q.z - p.z
    const den = dx * ez - dz * ex
    if (Math.abs(den) < 1e-12) continue
    const t = ((p.x - a.x) * ez - (p.z - a.z) * ex) / den
    const u = ((p.x - a.x) * dz - (p.z - a.z) * dx) / den
    if (t > -1e-9 && t < 1 + 1e-9 && u > -1e-9 && u < 1 + 1e-9) ts.push(Math.max(0, Math.min(1, t)))
  }
  ts.sort((m, n) => m - n)
  const out: [Pt, Pt][] = []
  for (let i = 0; i < ts.length - 1; i++) {
    const t0 = ts[i], t1 = ts[i + 1]
    if (t1 - t0 < 1e-6) continue
    const mp = { x: a.x + dx * (t0 + t1) / 2, z: a.z + dz * (t0 + t1) / 2 }
    if (pointInPoly(mp, poly)) out.push([{ x: a.x + dx * t0, z: a.z + dz * t0 }, { x: a.x + dx * t1, z: a.z + dz * t1 }])
  }
  return out
}

/** Interior partition walls + entrance doors for a floor — vertical panels (Quad) at
 *  base y, height h. One doorway per room, on its assigned entrance edge. */
export function floorPartitions(poly: Pt[], opts: GridOpts & { base?: number; height?: number; doorHeight?: number } = {}): { partitions: Quad[]; doors: Quad[] } {
  const g = floorGrid(poly, opts)
  if (!g) return { partitions: [], doors: [] }
  const level = opts.level ?? 0
  const base = opts.base ?? 0
  const height = opts.height ?? 1
  const doorH = Math.min(opts.doorHeight ?? height * 0.62, height) // ~2.1 m clear for a 3.6 m storey
  const doorW = 0.9 / LEN // 0.9 m leaf
  const at = (i: number, j: number): GridCell | null => (i >= 0 && i < g.cols && j >= 0 && j < g.rows ? g.cells[j * g.cols + i] : null)
  const partitions: Quad[] = []
  const doors: Quad[] = []
  let pn = 0, dn = 0
  const wall = (s: Pt, e: Pt) => { if (dist(s, e) > 0.05) partitions.push({ a: s, b: e, y: base, h: height, level, id: `part-${level}-${pn++}` }) }
  // emit one wall run, optionally carving a centred doorway (gap + a door leaf)
  const push = (a: Pt, b: Pt, withDoor: boolean) => {
    for (const [s, e] of clipSegment(a, b, poly)) {
      const L = dist(s, e)
      if (L < 0.05) continue
      if (withDoor && L >= doorW * 1.6) {
        const half = Math.min(doorW, L * 0.5) / 2 / L
        const p0 = lerp(s, e, 0.5 - half), p1 = lerp(s, e, 0.5 + half)
        wall(s, p0); wall(p1, e)
        doors.push({ a: p0, b: p1, y: base, h: doorH, level, id: `idoor-${level}-${dn++}` })
        withDoor = false // one doorway per run
      } else wall(s, e)
    }
  }
  // does the shared edge between cell c (room) and its neighbour carry c's door?
  const doorOnEdge = (c: GridCell, dir: 'N' | 'S' | 'E' | 'W', nb: GridCell) =>
    (c.kind === 'room' && c.doorTo === dir) ||
    (nb.kind === 'room' && nb.doorTo === (dir === 'N' ? 'S' : dir === 'S' ? 'N' : dir === 'E' ? 'W' : 'E'))
  const solidPair = (a: GridCell, b: GridCell) => {
    const k = `${a.kind}|${b.kind}`
    // walls wherever a room meets anything; corridors stay open to each other & the core
    return k === 'room|room' || k === 'room|corridor' || k === 'corridor|room' || k === 'room|core' || k === 'core|room'
  }
  // vertical edges (between i and i+1)
  for (let i = 0; i < g.cols - 1; i++) {
    const x = g.xs[i + 1]
    for (let j = 0; j < g.rows; j++) {
      const a = at(i, j)!, b = at(i + 1, j)!
      if (!solidPair(a, b)) continue
      push({ x, z: g.zs[j] }, { x, z: g.zs[j + 1] }, doorOnEdge(a, 'E', b))
    }
  }
  // horizontal edges (between j and j+1)
  for (let j = 0; j < g.rows - 1; j++) {
    const z = g.zs[j + 1]
    for (let i = 0; i < g.cols; i++) {
      const a = at(i, j)!, b = at(i, j + 1)!
      if (!solidPair(a, b)) continue
      push({ x: g.xs[i], z }, { x: g.xs[i + 1], z }, doorOnEdge(a, 'N', b))
    }
  }
  return { partitions, doors }
}
