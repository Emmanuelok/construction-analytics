/* Vertical circulation stairs — pure, unit-tested. Builds a code-dimensioned half-turn
 * (dog-leg) stair inside the core for every storey: two flights climbing in opposite
 * directions with a mid-storey landing and handrails. Treads are sized to real targets
 * (≈170 mm rise / 280 mm going / 1.1 m wide) and centred in the core — then stairCheck
 * validates the result against building-code limits, so the Stairs schedule reports a
 * genuine compliance status. Exported as a decomposed IfcStair (IfcStairFlight + an
 * IfcSlab landing + IfcRailing). Scene units; metres via the plan scale + storey height.
 * No DOM, no Three.js. */

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

// code-check thresholds (m) — common office/commercial values; tunable assumptions
const MAX_RISE = 0.19, MIN_GOING = 0.25, MIN_WIDTH = 1.0, MAX_PITCH = 42, RG_LO = 0.55, RG_HI = 0.7, MAX_RISERS_PER_FLIGHT = 16

export type StairCheck = { riseM: number; goingM: number; widthM: number; pitch: number; twoRG: number; risersPerFlight: number; ok: boolean; issues: string[] }

/** Validate a stair against building-code limits (riser/going/width/pitch/2R+G/flight
 *  length). Pure; metres derived via the plan scale + storey height. */
export function stairCheck(s: Stair, storeyHeight = 3.6): StairCheck {
  const riseM = ((s.top - s.base) / Math.max(1, s.risers)) * storeyHeight
  const goingM = s.treadDepth * LEN
  const widthM = s.widthScene * LEN
  const pitch = (Math.atan2(riseM, goingM) * 180) / Math.PI
  const twoRG = 2 * riseM + goingM
  const risersPerFlight = Math.max(...s.flights.map((f) => f.risers), 0)
  const mm = (m: number) => Math.round(m * 1000)
  const issues: string[] = []
  if (riseM > MAX_RISE + 1e-6) issues.push(`riser ${mm(riseM)}mm > ${mm(MAX_RISE)}`)
  if (goingM < MIN_GOING - 1e-6) issues.push(`going ${mm(goingM)}mm < ${mm(MIN_GOING)}`)
  if (widthM < MIN_WIDTH - 1e-6) issues.push(`width ${mm(widthM)}mm < ${mm(MIN_WIDTH)}`)
  if (twoRG < RG_LO - 1e-6 || twoRG > RG_HI + 1e-6) issues.push(`2R+G ${mm(twoRG)}mm out of ${mm(RG_LO)}–${mm(RG_HI)}`)
  if (pitch > MAX_PITCH + 0.5) issues.push(`pitch ${Math.round(pitch)}° > ${MAX_PITCH}°`)
  if (risersPerFlight > MAX_RISERS_PER_FLIGHT) issues.push(`${risersPerFlight} risers/flight > ${MAX_RISERS_PER_FLIGHT}`)
  return { riseM, goingM, widthM, pitch, twoRG, risersPerFlight, ok: issues.length === 0, issues }
}

/** Generate one code-dimensioned half-turn stair (two flights + landing + rails) per
 *  storey inside the core. */
export function coreStairs(core: { x: number; z: number; w: number; d: number } | null, floors: Floor[], opts: { storeyHeight?: number } = {}): Stair[] {
  if (!core || floors.length === 0) return []
  const sh = Math.max(0.1, opts.storeyHeight ?? 3.6)
  const dir: 'x' | 'z' = core.d >= core.w ? 'z' : 'x'
  const alongDim = dir === 'z' ? core.d : core.w
  const crossDim = dir === 'z' ? core.w : core.d
  // targets (m) → scene: going horizontal (× plan scale), width horizontal, rise vertical (from storey)
  const TARGET_RISE = 0.17, TARGET_GOING = 0.28, TARGET_WIDTH = 1.1
  const flightWidth = Math.min(TARGET_WIDTH / LEN, crossDim * 0.4)
  const sideA = -crossDim * 0.22, sideB = crossDim * 0.22 // the two flights, side by side

  const stairs: Stair[] = []
  for (const f of floors) {
    const floorH = f.height, base = f.base, top = base + floorH, mid = base + floorH / 2, level = f.level
    const id = `stair-${level}`
    const R = Math.max(14, Math.min(30, Math.round((floorH * sh) / TARGET_RISE)))
    const tA = Math.ceil(R / 2), tB = R - tA
    const riseA = floorH / 2 / tA, riseB = floorH / 2 / tB
    // code-target going, compressed only if the flight + landing won't fit the core run
    let going = TARGET_GOING / LEN
    let landingDepth = Math.max(going * 1.5, flightWidth)
    const avail = alongDim * 0.94
    const wanted = tA * going + landingDepth
    if (wanted > avail) { const k = avail / wanted; going *= k; landingDepth *= k }
    const flightRun = tA * going
    const goingB = flightRun / tB
    const totalRun = flightRun + landingDepth
    const tt = Math.max(Math.min(riseA, riseB) * 0.6, 0.02)
    const along0 = (dir === 'z' ? core.z : core.x) - totalRun / 2
    const mkBox = (alongC: number, crossC: number, y: number, alongSize: number, crossSize: number, h: number): Box =>
      dir === 'z'
        ? { x: core.x + crossC, y, z: alongC, w: crossSize, h, d: alongSize, level, id }
        : { x: alongC, y, z: core.z + crossC, w: alongSize, h, d: crossSize, level, id }

    const treadsA: Box[] = []
    for (let k = 0; k < tA; k++) treadsA.push(mkBox(along0 + (k + 0.5) * going, sideA, base + (k + 1) * riseA - tt / 2, going, flightWidth, tt))
    const landing = mkBox(along0 + flightRun + landingDepth / 2, 0, mid - tt / 2, landingDepth, crossDim * 0.6, tt)
    const treadsB: Box[] = []
    for (let k = 0; k < tB; k++) treadsB.push(mkBox(along0 + flightRun - (k + 0.5) * goingB, sideB, mid + (k + 1) * riseB - tt / 2, goingB, flightWidth, tt))
    const railH = floorH * 0.26, railThk = Math.max(0.04, crossDim * 0.025), railBar = Math.max(0.05, tt)
    const railA = mkBox(along0 + flightRun / 2, sideA - flightWidth / 2 + railThk / 2, (base + mid) / 2 + railH, flightRun, railThk, railBar)
    const railB = mkBox(along0 + flightRun / 2, sideB + flightWidth / 2 - railThk / 2, (mid + top) / 2 + railH, flightRun, railThk, railBar)

    stairs.push({
      id, level, base, top,
      x: core.x, z: core.z, w: dir === 'z' ? crossDim * 0.6 : totalRun, d: dir === 'z' ? totalRun : crossDim * 0.6, dir,
      risers: R, treadDepth: going, widthScene: flightWidth,
      flights: [
        { risers: tA, treadDepth: going, widthScene: flightWidth, base, top: mid, treads: treadsA },
        { risers: tB, treadDepth: goingB, widthScene: flightWidth, base: mid, top, treads: treadsB },
      ],
      treads: [...treadsA, ...treadsB], landings: [landing], rails: [railA, railB],
    })
  }
  return stairs
}
