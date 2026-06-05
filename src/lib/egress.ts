/* Egress / life-safety analysis — pure, unit-tested. Reads the building model (rooms,
 * stairs, core) and a code preset to compute, per room, its occupant load and the
 * estimated travel distance to the nearest protected stair, and per floor the occupancy,
 * required vs provided exit width and number of exits — with a pass/fail against the
 * jurisdiction's means-of-escape limits. Travel distance is a straight-line centre→exit
 * estimate inflated by a circuitous-route factor (design-stage, not a routed egress
 * model). Scene units → metres via the plan scale. No DOM, no engines beyond the model. */

import type { BuildingModel } from './building'
import { SCENE_LEN_TO_M } from './massing'
import { CODE_PRESETS, type CodeKey } from './building-code'
import type { Pt } from './zoning'

const LEN = SCENE_LEN_TO_M
const ROUTE_FACTOR = 1.3 // straight-line × circuitous factor → estimated travel distance
const r1 = (n: number) => Math.round(n * 10) / 10

export type EgressRoom = { id: string; level: number; name: string; area: number; occupancy: number; travel: number; exit: Pt; ok: boolean }
export type EgressFloor = { level: number; name: string; rooms: number; occupancy: number; exits: number; maxTravel: number; requiredWidth: number; providedWidth: number; ok: boolean; issues: string[] }
export type EgressResult = {
  code: CodeKey
  rooms: EgressRoom[]
  floors: EgressFloor[]
  summary: { occupancy: number; maxTravel: number; maxTravelLimit: number; roomsOverTravel: number; worstFloor: string; ok: boolean }
}

const levelName = (i: number, storeys: number) => (i === 0 ? 'Ground' : i >= storeys ? 'Roof' : `Level ${i}`)

/** The exit points serving a level — the protected stairs on it, else the core. */
function exitsFor(m: BuildingModel, level: number): Pt[] {
  const st = m.stairs.filter((s) => s.level === level).map((s) => ({ x: s.x, z: s.z }))
  if (st.length) return st
  return m.core ? [{ x: m.core.x, z: m.core.z }] : []
}

/** Run the egress / occupancy / travel-distance analysis for the model under a code. */
export function egressAnalysis(m: BuildingModel, opts: { code?: CodeKey; storeyHeight?: number } = {}): EgressResult {
  const code = opts.code ?? 'IBC'
  const lim = CODE_PRESETS[code].egress
  const storeys = m.counts.storeys

  const rooms: EgressRoom[] = m.rooms.map((room) => {
    const exits = exitsFor(m, room.level)
    let travel = Infinity, exit: Pt = room.center
    for (const e of exits) { const d = Math.hypot(e.x - room.center.x, e.z - room.center.z) * LEN * ROUTE_FACTOR; if (d < travel) { travel = d; exit = e } }
    if (!isFinite(travel)) travel = 0
    const occupancy = Math.max(1, Math.ceil(room.area / lim.occLoadFactor))
    return { id: room.id, level: room.level, name: room.name, area: room.area, occupancy, travel: r1(travel), exit, ok: exits.length > 0 && travel <= lim.maxTravel + 1e-6 }
  })

  const floors: EgressFloor[] = []
  for (let lvl = 0; lvl < storeys; lvl++) {
    const rs = rooms.filter((r) => r.level === lvl)
    if (!rs.length) continue
    const occupancy = rs.reduce((s, r) => s + r.occupancy, 0)
    const exits = exitsFor(m, lvl).length
    const maxTravel = Math.max(...rs.map((r) => r.travel), 0)
    const requiredWidth = (occupancy * lim.widthPerOccupantMm) / 1000 // m
    const providedWidth = m.stairs.filter((s) => s.level === lvl).reduce((s, st) => s + st.widthScene * LEN, 0) || (m.core ? lim.minExitWidth : 0)
    const issues: string[] = []
    if (maxTravel > lim.maxTravel + 1e-6) issues.push(`travel ${Math.round(maxTravel)}m > ${lim.maxTravel}m`)
    if (occupancy > lim.twoExitsAbove && exits < 2) issues.push(`${occupancy} occupants need ≥2 exits (have ${exits})`)
    if (providedWidth + 1e-6 < requiredWidth) issues.push(`exit width ${Math.round(providedWidth * 1000)}mm < ${Math.round(requiredWidth * 1000)}mm required`)
    else if (exits > 0 && providedWidth + 1e-6 < lim.minExitWidth) issues.push(`exit width ${Math.round(providedWidth * 1000)}mm < ${Math.round(lim.minExitWidth * 1000)}mm min`)
    if (exits === 0) issues.push('no exit serving this floor')
    floors.push({ level: lvl, name: levelName(lvl, storeys), rooms: rs.length, occupancy, exits, maxTravel: r1(maxTravel), requiredWidth: Math.round(requiredWidth * 1000) / 1000, providedWidth: Math.round(providedWidth * 1000) / 1000, ok: issues.length === 0, issues })
  }

  const occupancy = floors.reduce((s, f) => s + f.occupancy, 0)
  const maxTravel = Math.max(...rooms.map((r) => r.travel), 0)
  const worst = floors.find((f) => !f.ok)
  return {
    code, rooms, floors,
    summary: { occupancy, maxTravel: r1(maxTravel), maxTravelLimit: lim.maxTravel, roomsOverTravel: rooms.filter((r) => !r.ok).length, worstFloor: worst ? worst.name : '—', ok: floors.length > 0 && floors.every((f) => f.ok) },
  }
}

/** The estimated egress path for one room (centre → nearest exit) — for the plan overlay. */
export function egressPathFor(m: BuildingModel, roomId: string): { from: Pt; to: Pt } | null {
  const room = m.rooms.find((x) => x.id === roomId)
  if (!room) return null
  const exits = exitsFor(m, room.level)
  if (!exits.length) return null
  let best = exits[0], bd = Infinity
  for (const e of exits) { const d = Math.hypot(e.x - room.center.x, e.z - room.center.z); if (d < bd) { bd = d; best = e } }
  return { from: room.center, to: best }
}
