/* Interior partition walls — pure, unit-tested. Derives the walls that separate the
 * rooms (and screen them from the circulation core) from the very same floor grid that
 * lays out the rooms (building-rooms → floorGrid). Each interior grid line that borders
 * at least one room becomes a wall segment, merged along its run and clipped to the
 * floor outline, so what encloses a room in plan, in 3D, in the schedule and in the IFC
 * all agree. Perimeter is left to the façade walls. Scene units; no DOM, no Three.js. */

import { type Pt } from './zoning'
import { floorGrid, type GridOpts } from './building-rooms'
import type { Quad } from './building'

/** Ray-cast point-in-polygon (x east, z north). */
function pointInPoly(p: Pt, poly: Pt[]): boolean {
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
function clipSegment(a: Pt, b: Pt, poly: Pt[]): [Pt, Pt][] {
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

/** Interior partition walls for a floor — vertical panels (Quad) at base y, height h,
 *  on every interior grid line bordering a room. `base`/`height` place them between the
 *  slab and the floor above (matching the façade walls). */
export function floorPartitions(poly: Pt[], opts: GridOpts & { base?: number; height?: number } = {}): Quad[] {
  const g = floorGrid(poly, opts)
  if (!g) return []
  const level = opts.level ?? 0
  const base = opts.base ?? 0
  const height = opts.height ?? 1
  const occ = (i: number, j: number) => i >= 0 && i < g.cols && j >= 0 && j < g.rows && g.cells[j * g.cols + i].room
  const parts: Quad[] = []
  let n = 0
  const push = (a: Pt, b: Pt) => {
    for (const [s, e] of clipSegment(a, b, poly)) {
      if (Math.hypot(e.x - s.x, e.z - s.z) > 0.05) parts.push({ a: s, b: e, y: base, h: height, level, id: `part-${level}-${n++}` })
    }
  }
  // vertical interior grid lines (constant x) between columns i and i+1
  for (let i = 0; i < g.cols - 1; i++) {
    const x = g.minX + (i + 1) * g.cw
    let j = 0
    while (j < g.rows) {
      if (!(occ(i, j) || occ(i + 1, j))) { j++; continue }
      let k = j
      while (k < g.rows && (occ(i, k) || occ(i + 1, k))) k++
      push({ x, z: g.minZ + j * g.cd }, { x, z: g.minZ + k * g.cd })
      j = k
    }
  }
  // horizontal interior grid lines (constant z) between rows j and j+1
  for (let j = 0; j < g.rows - 1; j++) {
    const z = g.minZ + (j + 1) * g.cd
    let i = 0
    while (i < g.cols) {
      if (!(occ(i, j) || occ(i, j + 1))) { i++; continue }
      let k = i
      while (k < g.cols && (occ(k, j) || occ(k, j + 1))) k++
      push({ x: g.minX + i * g.cw, z }, { x: g.minX + k * g.cw, z })
      i = k
    }
  }
  return parts
}
