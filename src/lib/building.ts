/* Componentized building — pure, unit-tested. Turns the parametric massing (per-
 * floor plates) into the parts of an actual building: floor slabs, a perimeter
 * structural column grid, a glazed curtain-wall façade per edge, a central core and
 * a roof. The viewer renders these as real meshes you can see + toggle by trade, so
 * the model reads as a building, not a solid prism. No Three.js, no DOM. */

import { type Pt, polygonCentroid } from './zoning'
import type { Massing } from './massing'

export type Box = { x: number; y: number; z: number; w: number; h: number; d: number; level?: number } // centre + full size
export type Quad = { a: Pt; b: Pt; y: number; h: number; level?: number } // façade panel: edge a→b (plan), base y, height
export type Plate = { polygon: Pt[]; hole?: Pt[]; y: number; thickness: number; level?: number } // slab/roof at elevation y

export type BuildingModel = {
  slabs: Plate[]
  columns: Box[]
  glazing: Quad[]
  core: Box | null
  roof: Plate | null
  totalHeight: number
  footprint: number
  counts: { storeys: number; columns: number; glazingPanels: number; slabs: number }
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.z - a.z)
const extentOf = (poly: Pt[]) => {
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
}

/** Build the component model from a massing. `columnSpacing` is in scene units;
 *  `coreRatio` (0–1) sizes a central core (0 to omit). */
export function buildBuilding(m: Massing, opts?: { columnSpacing?: number; coreRatio?: number }): BuildingModel {
  const spacing = Math.max(0.5, opts?.columnSpacing ?? 3.2)
  const coreRatio = Math.max(0, Math.min(0.6, opts?.coreRatio ?? 0.16))
  const slabT = 0.12

  const slabs: Plate[] = []
  const columns: Box[] = []
  const glazing: Quad[] = []

  for (const f of m.floors) {
    const base = f.y - f.height / 2
    slabs.push({ polygon: f.polygon, hole: f.hole, y: base, thickness: slabT, level: f.index })
    const poly = f.polygon
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length]
      const L = dist(a, b)
      if (L < 1e-3) continue
      glazing.push({ a, b, y: base + slabT, h: f.height - slabT, level: f.index })
      const segs = Math.max(1, Math.round(L / spacing))
      for (let s = 0; s < segs; s++) {
        const t = s / segs
        columns.push({ x: a.x + (b.x - a.x) * t, y: base + f.height / 2, z: a.z + (b.z - a.z) * t, w: 0.18, h: f.height, d: 0.18, level: f.index })
      }
    }
  }

  let core: Box | null = null
  const f0 = m.floors[0]
  if (coreRatio > 0 && f0) {
    const c = polygonCentroid(f0.polygon)
    const side = extentOf(f0.polygon) * coreRatio
    core = { x: c.x, y: m.totalHeight / 2, z: c.z, w: side, h: m.totalHeight, d: side }
  }

  const top = m.floors[m.floors.length - 1]
  const roof = top ? { polygon: top.polygon, hole: top.hole, y: top.y + top.height / 2 - slabT, thickness: slabT, level: m.floors.length } : null

  return {
    slabs,
    columns,
    glazing,
    core,
    roof,
    totalHeight: m.totalHeight,
    footprint: m.footprint,
    counts: { storeys: m.storeys, columns: columns.length, glazingPanels: glazing.length, slabs: slabs.length },
  }
}
