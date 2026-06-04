/* Vertical circulation stairs — pure, unit-tested. Builds a realistic half-turn
 * (dog-leg) stair inside the core for every storey: two flights climbing in opposite
 * directions with a mid-storey landing between them and handrails along each flight —
 * real tread / landing / rail boxes you can see, schedule and export (IfcStair
 * decomposed into IfcStairFlight + an IfcSlab landing + IfcRailing). Riser count comes
 * from the storey height. Scene units; metres via the plan scale + storey height are
 * derived downstream. No DOM, no Three.js. */

import type { Box } from './building'
import { SCENE_LEN_TO_M } from './massing'

const LEN = SCENE_LEN_TO_M

export type Flight = { risers: number; treadDepth: number; widthScene: number; base: number; top: number; treads: Box[] }
export type Stair = {
  id: string
  level: number
  base: number // scene-y at the foot of the stair
  top: number // scene-y at the head (next floor)
  x: number; z: number; w: number; d: number // shaft footprint (scene)
  dir: 'x' | 'z' // run axis
  risers: number // total, both flights
  treadDepth: number // representative going (scene)
  widthScene: number // a single flight width (scene)
  flights: Flight[] // the two flights (for IfcStairFlight decomposition)
  treads: Box[] // every tread box (both flights) — for rendering / OBJ / glTF
  landings: Box[] // the mid-storey landing(s)
  rails: Box[] // handrail bars along the flights
}

export type Floor = { base: number; height: number; level: number }

/** Generate one half-turn stair (two flights + a mid-landing + rails) per storey
 *  inside the core. */
export function coreStairs(core: { x: number; z: number; w: number; d: number } | null, floors: Floor[], opts: { storeyHeight?: number } = {}): Stair[] {
  if (!core || floors.length === 0) return []
  const sh = Math.max(0.1, opts.storeyHeight ?? 3.6) // nominal — for riser count only
  const dir: 'x' | 'z' = core.d >= core.w ? 'z' : 'x'
  const alongDim = dir === 'z' ? core.d : core.w
  const crossDim = dir === 'z' ? core.w : core.d
  const runLen = alongDim * 0.84
  const crossLen = crossDim * 0.84
  const flightWidth = crossLen * 0.42
  const sideA = -crossLen * 0.23, sideB = crossLen * 0.23 // the two flights, side by side on the cross axis

  const stairs: Stair[] = []
  for (const f of floors) {
    const floorH = f.height, base = f.base, top = base + floorH, mid = base + floorH / 2, level = f.level
    const id = `stair-${level}`
    const R = Math.max(14, Math.min(28, Math.round((floorH * sh) / 0.18))) // ~180 mm risers, total
    const tA = Math.ceil(R / 2), tB = R - tA
    const riseA = floorH / 2 / tA, riseB = floorH / 2 / tB
    const landingDepth = runLen * 0.16
    const flightRun = runLen - landingDepth
    const goingA = flightRun / tA, goingB = flightRun / tB
    const tt = Math.max(Math.min(riseA, riseB) * 0.6, 0.025)
    const along0 = (dir === 'z' ? core.z : core.x) - runLen / 2
    // place a box from (along-centre, cross-centre, y) with sizes along the run / across it
    const mkBox = (alongC: number, crossC: number, y: number, alongSize: number, crossSize: number, h: number): Box =>
      dir === 'z'
        ? { x: core.x + crossC, y, z: alongC, w: crossSize, h, d: alongSize, level, id }
        : { x: alongC, y, z: core.z + crossC, w: alongSize, h, d: crossSize, level, id }

    // flight A: climbs base → mid going +along, on side A
    const treadsA: Box[] = []
    for (let k = 0; k < tA; k++) treadsA.push(mkBox(along0 + (k + 0.5) * goingA, sideA, base + (k + 1) * riseA - tt / 2, goingA, flightWidth, tt))
    // landing at the far (+along) end, at mid height, spanning the cross
    const landing = mkBox(along0 + flightRun + landingDepth / 2, 0, mid - tt / 2, landingDepth, crossLen, tt)
    // flight B: climbs mid → top going back (−along), on side B
    const treadsB: Box[] = []
    for (let k = 0; k < tB; k++) treadsB.push(mkBox(along0 + flightRun - (k + 0.5) * goingB, sideB, mid + (k + 1) * riseB - tt / 2, goingB, flightWidth, tt))
    // handrails: a bar along each flight, on its outer edge, ~1 m above the going
    const railH = floorH * 0.26, railThk = Math.max(0.04, crossLen * 0.03), railBar = Math.max(0.05, tt)
    const railA = mkBox(along0 + flightRun / 2, sideA - flightWidth / 2 + railThk / 2, (base + mid) / 2 + railH, flightRun, railThk, railBar)
    const railB = mkBox(along0 + flightRun / 2, sideB + flightWidth / 2 - railThk / 2, (mid + top) / 2 + railH, flightRun, railThk, railBar)

    stairs.push({
      id, level, base, top,
      x: core.x, z: core.z, w: dir === 'z' ? crossLen : runLen, d: dir === 'z' ? runLen : crossLen, dir,
      risers: R, treadDepth: goingA, widthScene: flightWidth,
      flights: [
        { risers: tA, treadDepth: goingA, widthScene: flightWidth, base, top: mid, treads: treadsA },
        { risers: tB, treadDepth: goingB, widthScene: flightWidth, base: mid, top, treads: treadsB },
      ],
      treads: [...treadsA, ...treadsB], landings: [landing], rails: [railA, railB],
    })
  }
  return stairs
}
