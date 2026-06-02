/* Building massing — pure, unit-tested. Turns a project's gross floor area,
 * storey count and % complete into a real 3D floor stack: per-floor positions,
 * sizes and a built/planned split (the bottom N floors that are "complete" at
 * the current progress). The geometry the WebGL viewer renders, computed here
 * so it's deterministic and testable — no Three.js, no DOM. Scene units are
 * metres / a fixed scale; the viewer just draws boxes at these coordinates. */

import { type Pt, polygonArea } from './zoning'
import { unitShape, holeFor, scaleAbout, rotatePolygon, shapeExtent, centerPolygon, type ShapeKind } from './shapes'
export type { ShapeKind } from './shapes'
export { SHAPE_KINDS } from './shapes'

export type FloorSpec = {
  index: number // 0 = ground floor
  label: string // 'G', 'L1', …
  y: number // centre height (scene units)
  height: number // storey height
  polygon: Pt[] // floor plate outline (plan, scene units) — any shape, not just a box
  hole?: Pt[] // inner void (courtyard/atrium), if any
  built: boolean // completed at the current % progress (bottom-up)
  t: number // 0..1 position up the building (for gradients)
}

export type Massing = {
  floors: FloorSpec[]
  storeys: number
  storeyHeight: number
  totalHeight: number
  footprint: number // base plate extent (scene units) — for camera framing
  builtCount: number
  builtPct: number // actual built fraction realized by whole floors, 0–100
}

export type MassingInput = {
  gfa: number // gross floor area, m²
  progress: number // % complete, 0–100
  storeys?: number // explicit storey count; otherwise derived from GFA
  shape?: ShapeKind // footprint form (default rectangle)
  customShape?: Pt[] // user-drawn footprint, used when shape === 'custom'
  towerShape?: ShapeKind // a distinct plate for the tower above the podium (preset)
  aspect?: number // plan aspect ratio (x ÷ z), 0.3–3
  taper?: number // 0 = none, up to ~0.6 = upper floors shrink (tower taper)
  podium?: number // 0–1 fraction of storeys forming a full-plate podium base
  towerSetback?: number // 0–0.6 — above the podium the tower steps in by this much
  twist?: number // degrees of rotation added per floor (twisting tower)
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

const STOREY_HEIGHT = 1 // scene units per storey
const PLATE_SCALE = 0.16 // metres → scene units (plate area scales by PLATE_SCALE²)

/** Derive a plausible storey count from GFA when none is given. */
export function deriveStoreys(gfa: number): number {
  if (gfa <= 0) return 1
  // assume ~2,500 m² average floor plate; clamp to a sane building range
  return clamp(Math.round(gfa / 2500), 3, 40)
}

/** Build the floor stack for a project — a real form (shape + taper + podium/tower
 *  setback + twist), one polygon per floor, with a built/planned split. */
export function buildMassing(input: MassingInput): Massing {
  const gfa = Math.max(0, input.gfa)
  const storeys = Math.max(1, Math.round(input.storeys ?? deriveStoreys(gfa)))
  const progress = clamp(input.progress, 0, 100)
  const shape = input.shape ?? 'rect'
  const aspect = clamp(input.aspect ?? 1, 0.3, 3)
  const taper = clamp(input.taper ?? 0, 0, 0.6)
  const podiumFrac = clamp(input.podium ?? 0, 0, 1)
  const towerSetback = clamp(input.towerSetback ?? 0, 0, 0.6)
  const twistRad = ((input.twist ?? 0) * Math.PI) / 180

  // base plate area in scene units, from GFA per storey
  const plateArea = gfa > 0 ? gfa / storeys : 0
  const sceneArea = Math.max(1, plateArea) * PLATE_SCALE * PLATE_SCALE
  const podiumFloors = Math.round(podiumFrac * storeys)
  const hasSplit = podiumFloors > 0 && podiumFloors < storeys // podium ↔ tower boundary
  const hasTower = hasSplit && towerSetback > 0

  // normalise a shape (outer + optional courtyard void) to the net per-storey area
  const prep = (outer: Pt[], hole: Pt[] | null) => {
    const net = polygonArea(outer) - (hole ? polygonArea(hole) : 0)
    const kk = Math.sqrt(sceneArea / Math.max(1e-4, net))
    return { base: scaleAbout(outer, kk), hole: hole ? scaleAbout(hole, kk) : null }
  }
  // podium / base plate — a custom (user-drawn) footprint or a preset shape
  const podiumOuter = shape === 'custom' && input.customShape && input.customShape.length >= 3
    ? centerPolygon(input.customShape)
    : unitShape(shape, aspect)
  const podium = prep(podiumOuter, holeFor(shape, aspect))
  // a distinct tower plate above the podium (preset shapes), else reuse the podium
  const useTowerShape = hasSplit && !!input.towerShape && input.towerShape !== 'custom' && input.towerShape !== shape
  const tower = useTowerShape ? prep(unitShape(input.towerShape!, aspect), holeFor(input.towerShape!, aspect)) : podium
  const ext = shapeExtent(podium.base)

  const builtCount = clamp(Math.round((progress / 100) * storeys), 0, storeys)

  const floors: FloorSpec[] = []
  for (let i = 0; i < storeys; i++) {
    const t = storeys > 1 ? i / (storeys - 1) : 0
    const isTower = hasSplit && i >= podiumFloors
    const src = isTower ? tower : podium
    const step = hasTower && isTower ? 1 - towerSetback : 1 // tower steps in above the podium
    const scale = (1 - taper * t) * step
    let poly = scaleAbout(src.base, scale)
    let hole = src.hole ? scaleAbout(src.hole, scale) : undefined
    if (twistRad) { poly = rotatePolygon(poly, twistRad * i); if (hole) hole = rotatePolygon(hole, twistRad * i) }
    floors.push({
      index: i,
      label: i === 0 ? 'G' : `L${i}`,
      y: i * STOREY_HEIGHT + STOREY_HEIGHT / 2,
      height: STOREY_HEIGHT * 0.92, // small gap between slabs
      polygon: poly,
      hole,
      built: i < builtCount,
      t,
    })
  }

  return {
    floors,
    storeys,
    storeyHeight: STOREY_HEIGHT,
    totalHeight: storeys * STOREY_HEIGHT,
    footprint: round1(Math.max(ext.width, ext.depth)),
    builtCount,
    builtPct: round1((builtCount / storeys) * 100),
  }
}

/* ---- metric → colour mapping (pure, so the legend + meshes agree) ---- */

export type ColorMode = 'progress' | 'risk' | 'safety' | 'carbon' | 'status'

/** A hex colour for a floor under the chosen colour mode. `metric` is the
 *  project-level value (0–100 for risk/safety, kgCO₂e/m² for carbon, health
 *  for status); progress uses each floor's own built flag. */
export function floorColor(mode: ColorMode, floor: FloorSpec, metric: number): string {
  if (mode === 'progress') return floor.built ? '#22c55e' /* built */ : '#334155' /* planned */
  if (mode === 'risk') return scale3(metric, 30, 70) // low risk green → high risk red
  if (mode === 'safety') return scale3(100 - metric, 10, 25) // invert: high safety green
  if (mode === 'carbon') return scale3(metric, 450, 650) // kgCO₂e/m² thresholds
  // status: metric = composite health (higher better) → invert for the green-good scale
  return scale3(100 - metric, 25, 45)
}

/** Green→amber→red as v crosses [lo, hi]. */
function scale3(v: number, lo: number, hi: number): string {
  if (v <= lo) return '#22c55e' // green
  if (v >= hi) return '#ef4444' // red
  return '#f59e0b' // amber (between thresholds)
}

export const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: 'progress', label: 'Construction progress (4D)' },
  { id: 'status', label: 'Composite health' },
  { id: 'risk', label: 'Risk' },
  { id: 'safety', label: 'Safety' },
  { id: 'carbon', label: 'Embodied carbon' },
]
