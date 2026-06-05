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
import { CODE_PRESETS, type StairLimits } from './building-code'

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

export type StairCheck = { riseM: number; goingM: number; widthM: number; pitch: number; twoRG: number; risersPerFlight: number; ok: boolean; issues: string[] }

/** Validate a stair against a jurisdiction's geometry limits (riser/going/width/pitch/
 *  2R+G/flight length). Pure; metres derived via the plan scale + storey height. */
export function stairCheck(s: Stair, storeyHeight = 3.6, limits: StairLimits = CODE_PRESETS.IBC.stair): StairCheck {
  const riseM = ((s.top - s.base) / Math.max(1, s.risers)) * storeyHeight
  const goingM = s.treadDepth * LEN
  const widthM = s.widthScene * LEN
  const pitch = (Math.atan2(riseM, goingM) * 180) / Math.PI
  const twoRG = 2 * riseM + goingM
  const risersPerFlight = Math.max(...s.flights.map((f) => f.risers), 0)
  const mm = (m: number) => Math.round(m * 1000)
  const issues: string[] = []
  if (riseM > limits.maxRise + 1e-6) issues.push(`riser ${mm(riseM)}mm > ${mm(limits.maxRise)}`)
  if (goingM < limits.minGoing - 1e-6) issues.push(`going ${mm(goingM)}mm < ${mm(limits.minGoing)}`)
  if (widthM < limits.minWidth - 1e-6) issues.push(`width ${mm(widthM)}mm < ${mm(limits.minWidth)}`)
  if (twoRG < limits.rgLo - 1e-6 || twoRG > limits.rgHi + 1e-6) issues.push(`2R+G ${mm(twoRG)}mm out of ${mm(limits.rgLo)}–${mm(limits.rgHi)}`)
  if (pitch > limits.maxPitch + 0.5) issues.push(`pitch ${Math.round(pitch)}° > ${limits.maxPitch}°`)
  if (risersPerFlight > limits.maxRisersPerFlight) issues.push(`${risersPerFlight} risers/flight > ${limits.maxRisersPerFlight}`)
  return { riseM, goingM, widthM, pitch, twoRG, risersPerFlight, ok: issues.length === 0, issues }
}

type CoreBox = { x: number; z: number; w: number; d: number }

/** One code-dimensioned half-turn stair (two flights + landing + rails) in a (sub-)core. */
function buildStair(core: CoreBox, f: Floor, sh: number, id: string): Stair {
  const { base, height: floorH, level } = f
  const top = base + floorH, mid = base + floorH / 2
  const dir: 'x' | 'z' = core.d >= core.w ? 'z' : 'x'
  const alongDim = dir === 'z' ? core.d : core.w
  const crossDim = dir === 'z' ? core.w : core.d
  // targets (m) → scene: going horizontal (× plan scale), width horizontal, rise vertical (from storey)
  const TARGET_RISE = 0.16, TARGET_GOING = 0.29, TARGET_WIDTH = 1.2
  const flightWidth = Math.min(TARGET_WIDTH / LEN, crossDim * 0.4)
  const sideA = -crossDim * 0.22, sideB = crossDim * 0.22 // the two flights, side by side
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

  return {
    id, level, base, top,
    x: core.x, z: core.z, w: dir === 'z' ? crossDim * 0.6 : totalRun, d: dir === 'z' ? totalRun : crossDim * 0.6, dir,
    risers: R, treadDepth: going, widthScene: flightWidth,
    flights: [
      { risers: tA, treadDepth: going, widthScene: flightWidth, base, top: mid, treads: treadsA },
      { risers: tB, treadDepth: goingB, widthScene: flightWidth, base: mid, top, treads: treadsB },
    ],
    treads: [...treadsA, ...treadsB], landings: [landing], rails: [railA, railB],
  }
}

/** Generate the egress stairs in the core, per storey. Codes require ≥2 independent
 *  means of escape, so when the core is big enough two stairs are placed side by side
 *  (the shorter axis split in half); a small core gets one. */
export function coreStairs(core: CoreBox | null, floors: Floor[], opts: { storeyHeight?: number } = {}): Stair[] {
  if (!core || floors.length === 0) return []
  const sh = Math.max(0.1, opts.storeyHeight ?? 3.6)
  const twoFit = Math.min(core.w, core.d) >= 4 / LEN // ≥ 4 m on the short side → two stairs fit
  const subs: CoreBox[] = !twoFit
    ? [core]
    : core.w <= core.d
      ? [{ ...core, x: core.x - core.w / 4, w: core.w / 2 }, { ...core, x: core.x + core.w / 4, w: core.w / 2 }]
      : [{ ...core, z: core.z - core.d / 4, d: core.d / 2 }, { ...core, z: core.z + core.d / 4, d: core.d / 2 }]
  const stairs: Stair[] = []
  for (const f of floors) subs.forEach((sub, n) => stairs.push(buildStair(sub, f, sh, `stair-${f.level}-${n + 1}`)))
  return stairs
}
