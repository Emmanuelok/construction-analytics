/* Building massing — pure, unit-tested. Turns a project's gross floor area,
 * storey count and % complete into a real 3D floor stack: per-floor positions,
 * sizes and a built/planned split (the bottom N floors that are "complete" at
 * the current progress). The geometry the WebGL viewer renders, computed here
 * so it's deterministic and testable — no Three.js, no DOM. Scene units are
 * metres / a fixed scale; the viewer just draws boxes at these coordinates. */

export type FloorSpec = {
  index: number // 0 = ground floor
  label: string // 'G', 'L1', …
  y: number // centre height (scene units)
  height: number // storey height
  halfW: number // half-width (x) of the floor plate
  halfD: number // half-depth (z)
  built: boolean // completed at the current % progress (bottom-up)
  t: number // 0..1 position up the building (for gradients)
}

export type Massing = {
  floors: FloorSpec[]
  storeys: number
  storeyHeight: number
  totalHeight: number
  footprint: number // plate side length (scene units) at the base
  builtCount: number
  builtPct: number // actual built fraction realized by whole floors, 0–100
}

export type MassingInput = {
  gfa: number // gross floor area, m²
  progress: number // % complete, 0–100
  storeys?: number // explicit storey count; otherwise derived from GFA
  taper?: number // 0 = none, up to ~0.6 = upper floors shrink (tower taper)
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

const STOREY_HEIGHT = 1 // scene units per storey
const PLATE_SCALE = 0.16 // metres → scene units for the plate side (keeps plates ~proportional to height)

/** Derive a plausible storey count from GFA when none is given. */
export function deriveStoreys(gfa: number): number {
  if (gfa <= 0) return 1
  // assume ~2,500 m² average floor plate; clamp to a sane building range
  return clamp(Math.round(gfa / 2500), 3, 40)
}

/** Build the floor stack for a project. */
export function buildMassing(input: MassingInput): Massing {
  const gfa = Math.max(0, input.gfa)
  const storeys = Math.max(1, Math.round(input.storeys ?? deriveStoreys(gfa)))
  const progress = clamp(input.progress, 0, 100)
  const taper = clamp(input.taper ?? 0, 0, 0.6)

  const plateArea = gfa > 0 ? gfa / storeys : 0
  // side length of a square plate, in metres, mapped to scene units
  const baseSide = Math.max(1, Math.sqrt(Math.max(1, plateArea)) * PLATE_SCALE)

  // whole floors completed, bottom-up, at this progress
  const builtCount = clamp(Math.round((progress / 100) * storeys), 0, storeys)

  const floors: FloorSpec[] = []
  for (let i = 0; i < storeys; i++) {
    const t = storeys > 1 ? i / (storeys - 1) : 0
    const shrink = 1 - taper * t // upper floors get smaller when tapered
    const side = baseSide * shrink
    floors.push({
      index: i,
      label: i === 0 ? 'G' : `L${i}`,
      y: i * STOREY_HEIGHT + STOREY_HEIGHT / 2,
      height: STOREY_HEIGHT * 0.92, // small gap between slabs
      halfW: side / 2,
      halfD: side / 2,
      built: i < builtCount,
      t,
    })
  }

  return {
    floors,
    storeys,
    storeyHeight: STOREY_HEIGHT,
    totalHeight: storeys * STOREY_HEIGHT,
    footprint: round1(baseSide),
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
