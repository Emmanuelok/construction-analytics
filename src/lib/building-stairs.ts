/* Vertical circulation stairs — pure, unit-tested. Drops a straight-run stair flight
 * inside the circulation core for every storey: real tread boxes that climb from each
 * floor to the one above, so the core reads as a stair you can see, schedule and
 * export (stepped IfcStair + tread geometry in OBJ/glTF). The flight runs along the
 * core's longer axis; riser count comes from the storey height. Scene units; metres
 * via the plan scale + storey height are derived downstream so the schedule stays in
 * step with the rest of the model. No DOM, no Three.js. */

import type { Box } from './building'
import { SCENE_LEN_TO_M } from './massing'

const LEN = SCENE_LEN_TO_M

export type Stair = {
  id: string
  level: number
  base: number // scene-y at the foot of the flight
  top: number // scene-y at the head (next floor)
  x: number; z: number; w: number; d: number // shaft footprint (scene)
  dir: 'x' | 'z' // run axis
  risers: number
  treadDepth: number // scene (the going, before metre conversion)
  widthScene: number // scene
  treads: Box[] // step geometry (scene), all tagged with the flight id
}

export type Floor = { base: number; height: number; level: number }

/** Generate one straight-run stair flight per storey inside the core. */
export function coreStairs(core: { x: number; z: number; w: number; d: number } | null, floors: Floor[], opts: { storeyHeight?: number } = {}): Stair[] {
  if (!core || floors.length === 0) return []
  const sh = Math.max(0.1, opts.storeyHeight ?? 3.6) // nominal — for riser count only
  // run along the longer core axis; occupy ~64% of it, ~46% of the other for width
  const dir: 'x' | 'z' = core.d >= core.w ? 'z' : 'x'
  const runSpan = (dir === 'z' ? core.d : core.w) * 0.64
  const widthScene = Math.min((dir === 'z' ? core.w : core.d) * 0.46, 1.4 / LEN) // ≤ 1.4 m clear
  const stairs: Stair[] = []
  for (const f of floors) {
    const floorH = f.height
    const risers = Math.max(12, Math.min(26, Math.round((floorH * sh) / 0.18))) // ~180 mm risers
    const treadsN = Math.max(1, risers - 1)
    const rise = floorH / risers // scene
    const going = runSpan / treadsN // scene
    const treadThick = Math.max(rise * 0.6, 0.03)
    const start = (dir === 'z' ? core.z : core.x) - runSpan / 2
    const treads: Box[] = []
    for (let k = 0; k < treadsN; k++) {
      const along = start + (k + 0.5) * going
      const y = f.base + (k + 1) * rise - treadThick / 2
      treads.push(dir === 'z'
        ? { x: core.x, y, z: along, w: widthScene, h: treadThick, d: going, level: f.level, id: `stair-${f.level}` }
        : { x: along, y, z: core.z, w: going, h: treadThick, d: widthScene, level: f.level, id: `stair-${f.level}` })
    }
    stairs.push({
      id: `stair-${f.level}`, level: f.level, base: f.base, top: f.base + floorH,
      x: core.x, z: core.z, w: dir === 'z' ? widthScene : runSpan, d: dir === 'z' ? runSpan : widthScene,
      dir, risers, treadDepth: going, widthScene, treads,
    })
  }
  return stairs
}
