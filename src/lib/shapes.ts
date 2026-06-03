/* Footprint shape library — pure, unit-tested. Generates real plan polygons for
 * massing studies (rectangle, L, U/courtyard-open, cross, cylinder, octagon) and
 * the transforms to place them (scale-to-area, scale-about, rotate). Shared by the
 * project massing and zoning tools so buildings are actual forms, not just boxes.
 * Plain 2D geometry (scene units) — no Three.js, no DOM. */

import { type Pt, polygonArea, polygonCentroid } from './zoning'

export type ShapeKind = 'rect' | 'l' | 'u' | 'court' | 'cross' | 'cylinder' | 'octagon' | 'custom'

export const SHAPE_KINDS: { id: ShapeKind; label: string }[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'l', label: 'L-shape' },
  { id: 'u', label: 'U-shape' },
  { id: 'court', label: 'Courtyard' },
  { id: 'cross', label: 'Cross' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'octagon', label: 'Octagon' },
  { id: 'custom', label: 'Custom' },
]

/** A unit footprint (~1×1, centred on the origin) for the given kind. `aspect`
 *  stretches it in x. Normalise to a target area with scaleToArea(). */
export function unitShape(kind: ShapeKind, aspect = 1): Pt[] {
  const a = Math.max(0.3, Math.min(3, aspect))
  const w = 0.5 * Math.sqrt(a), d = 0.5 / Math.sqrt(a) // keep area ~constant as aspect varies
  switch (kind) {
    case 'rect':
      return [{ x: -w, z: -d }, { x: w, z: -d }, { x: w, z: d }, { x: -w, z: d }]
    case 'l':
      return [{ x: -w, z: -d }, { x: w, z: -d }, { x: w, z: 0 }, { x: 0, z: 0 }, { x: 0, z: d }, { x: -w, z: d }]
    case 'u': {
      const ix = w * 0.4, iz = d * 0.55 // inner notch (open at +z)
      return [
        { x: -w, z: -d }, { x: w, z: -d }, { x: w, z: d }, { x: ix, z: d },
        { x: ix, z: -d + iz }, { x: -ix, z: -d + iz }, { x: -ix, z: d }, { x: -w, z: d },
      ]
    }
    case 'cross': {
      const ax = w * 0.34, az = d * 0.34 // arm half-thickness
      return [
        { x: -ax, z: -d }, { x: ax, z: -d }, { x: ax, z: -az }, { x: w, z: -az }, { x: w, z: az }, { x: ax, z: az },
        { x: ax, z: d }, { x: -ax, z: d }, { x: -ax, z: az }, { x: -w, z: az }, { x: -w, z: -az }, { x: -ax, z: -az },
      ]
    }
    case 'cylinder': {
      const n = 48, pts: Pt[] = []
      for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push({ x: w * Math.cos(t), z: d * Math.sin(t) }) }
      return pts
    }
    case 'octagon': {
      const pts: Pt[] = []
      for (let i = 0; i < 8; i++) { const t = (Math.PI / 8) + (i / 8) * Math.PI * 2; pts.push({ x: w * 1.08 * Math.cos(t), z: d * 1.08 * Math.sin(t) }) }
      return pts
    }
    case 'court': // courtyard — full rectangular outer ring (atrium hole via holeFor)
      return [{ x: -w, z: -d }, { x: w, z: -d }, { x: w, z: d }, { x: -w, z: d }]
    case 'custom': // a recognizable starting pentagon the user can then edit
      return [{ x: -w, z: -d }, { x: w, z: -d }, { x: w, z: d * 0.35 }, { x: 0, z: d }, { x: -w, z: d * 0.35 }]
  }
}

/** The inner hole (atrium) for a shape, or null if it's solid. Only the courtyard
 *  has one — a centred rectangular void cut from the plate. */
export function holeFor(kind: ShapeKind, aspect = 1): Pt[] | null {
  if (kind !== 'court') return null
  const a = Math.max(0.3, Math.min(3, aspect))
  const hw = 0.42 * 0.5 * Math.sqrt(a), hd = 0.42 * 0.5 / Math.sqrt(a)
  return [{ x: -hw, z: -hd }, { x: hw, z: -hd }, { x: hw, z: hd }, { x: -hw, z: hd }]
}

/** Translate a polygon so its centroid sits on the origin. */
export function centerPolygon(poly: Pt[]): Pt[] {
  const c = polygonCentroid(poly)
  return poly.map((p) => ({ x: p.x - c.x, z: p.z - c.z }))
}

/** Scale a polygon (about the origin) so its area equals `area`. */
export function scaleToArea(poly: Pt[], area: number): Pt[] {
  const cur = polygonArea(poly)
  if (cur < 1e-9 || area <= 0) return poly.map((p) => ({ ...p }))
  const k = Math.sqrt(area / cur)
  return poly.map((p) => ({ x: p.x * k, z: p.z * k }))
}

/** Linear scale about a centre (default origin). */
export function scaleAbout(poly: Pt[], k: number, c: Pt = { x: 0, z: 0 }): Pt[] {
  return poly.map((p) => ({ x: c.x + (p.x - c.x) * k, z: c.z + (p.z - c.z) * k }))
}

/** Rotate a polygon about a centre (default origin) by `angle` radians. */
export function rotatePolygon(poly: Pt[], angle: number, c: Pt = { x: 0, z: 0 }): Pt[] {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return poly.map((p) => {
    const dx = p.x - c.x, dz = p.z - c.z
    return { x: c.x + dx * cos - dz * sin, z: c.z + dx * sin + dz * cos }
  })
}

/** Plan extent (bounding width × depth) of a polygon. */
export function shapeExtent(poly: Pt[]): { width: number; depth: number } {
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) }
}
