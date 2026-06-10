/* Room & floor studio — pure, unit-tested. Gathers everything the preview panel shows
 * about a selected space and rolls it up per floor: dimensions + use + occupant load,
 * the windows on its façade (daylight), the doors that serve it (egress routes), wall
 * vs glazed perimeter, finish area + indicative fit-out cost, and the routed egress
 * travel/compliance reused from the egress engine. A focus region (scene bbox) is
 * derived so the 3D viewer can isolate and frame just that space. Scene units → metres
 * via the plan scale + storey height. No DOM, no Three.js. */

import type { BuildingModel, Quad, Room } from './building'
import { SCENE_LEN_TO_M } from './massing'
import { polygonArea, polygonPerimeter } from './zoning'
import { spaceType, finishGrade, occupants } from './room-types'
import { egressAnalysis } from './egress'
import type { CodeKey } from './building-code'

const LEN = SCENE_LEN_TO_M
const AREA = LEN * LEN
const r1 = (n: number) => Math.round(n * 10) / 10
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(b.x - a.x, b.z - a.z)
const mid = (q: Quad) => ({ x: (q.a.x + q.b.x) / 2, z: (q.a.z + q.b.z) / 2 })

/** Min distance from a point to a polygon's edges. */
function pointToPoly(p: { x: number; z: number }, poly: { x: number; z: number }[]): number {
  let m = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2))
    m = Math.min(m, Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)))
  }
  return m
}
const bbox = (poly: { x: number; z: number }[]) => {
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

export type FocusRegion = { level: number; minX: number; maxX: number; minZ: number; maxZ: number }
export type RoomReport = {
  id: string; level: number; name: string; use: string; useLabel: string; finish: string; finishLabel: string
  area: number; perimeter: number; widthM: number; depthM: number; heightM: number; volume: number
  occupancy: number; windows: number; glazedLength: number; daylight: number; daylit: boolean
  doors: number; egressTravel: number; egressOk: boolean; egressReason?: string
  finishArea: number; finishCost: number
  focus: FocusRegion
}

/** A full report for one room (geometry + use + daylight + egress + finishes takeoff). */
export function roomReport(m: BuildingModel, roomId: string, opts: { storeyHeight?: number; code?: CodeKey } = {}): RoomReport | null {
  const room = m.rooms.find((r) => r.id === roomId)
  if (!room) return null
  const sh = opts.storeyHeight ?? 3.6
  const t = spaceType(room.use)
  const fin = finishGrade(room.finish ?? t.finish)
  const bb = bbox(room.polygon)
  const widthM = (bb.maxX - bb.minX) * LEN, depthM = (bb.maxZ - bb.minZ) * LEN
  const slab = m.slabs.find((s) => s.level === room.level)
  const heightM = (slab ? (sh - 0.12) : sh) // floor-to-ceiling (under the suspended ceiling)

  // windows on the room's façade + interior doors on its boundary
  const lvlGlazing = m.glazing.filter((g) => (g.level ?? 0) === room.level)
  let glazedLength = 0, windows = 0
  for (const g of lvlGlazing) if (pointToPoly(mid(g), room.polygon) < 0.25) { windows++; glazedLength += dist(g.a, g.b) * LEN }
  const doors = m.interiorDoors.filter((d) => (d.level ?? 0) === room.level && pointToPoly(mid(d), room.polygon) < 0.25).length

  const occupancy = occupants(room.area, room.use)
  const daylight = room.area > 0 ? glazedLength * 1.5 * sh / room.area : 0 // window area ÷ floor area proxy
  const finishArea = r1(room.area * 2 + polygonPerimeter(room.polygon) * LEN * heightM) // floor + ceiling + walls
  const eg = egressAnalysis(m, { code: opts.code ?? 'IBC' })
  const er = eg.rooms.find((x) => x.id === roomId)

  return {
    id: room.id, level: room.level, name: room.name, use: t.id, useLabel: t.label, finish: fin.id, finishLabel: fin.label,
    area: room.area, perimeter: r1(polygonPerimeter(room.polygon) * LEN), widthM: r1(widthM), depthM: r1(depthM), heightM: r1(heightM), volume: r1(room.area * heightM),
    occupancy, windows, glazedLength: r1(glazedLength), daylight: r1(daylight * 100), daylit: daylight >= 0.1,
    doors, egressTravel: er ? er.travel : 0, egressOk: er ? er.ok : false, egressReason: er?.reason,
    finishArea, finishCost: Math.round(finishArea * fin.cost),
    focus: { level: room.level, ...bb },
  }
}

export type FinishRow = { id: string; level: number; room: string; use: string; grade: string; gradeLabel: string; floorArea: number; wallArea: number; ceilingArea: number; cost: number }
/** The room-by-room finishes schedule (floor + walls + ceiling areas, graded cost)
 *  — the takeoff a finishes package is bought against. Light: no egress routing. */
export function finishSchedule(m: BuildingModel, opts: { storeyHeight?: number } = {}): { rows: FinishRow[]; totals: { rooms: number; floorArea: number; cost: number } } {
  const sh = opts.storeyHeight ?? 3.6
  const hM = sh - 0.12
  const rows: FinishRow[] = m.rooms.filter((r) => r.level < m.counts.storeys).map((room) => {
    const t = spaceType(room.use)
    const fin = finishGrade(room.finish ?? t.finish)
    const per = polygonPerimeter(room.polygon) * LEN // unrounded, to match roomReport exactly
    const finishArea = r1(room.area * 2 + per * hM)
    return { id: room.id, level: room.level, room: room.name, use: t.label, grade: fin.id, gradeLabel: fin.label, floorArea: room.area, wallArea: r1(per * hM), ceilingArea: room.area, cost: Math.round(finishArea * fin.cost) }
  })
  return { rows, totals: { rooms: rows.length, floorArea: r1(rows.reduce((s, r) => s + r.floorArea, 0)), cost: rows.reduce((s, r) => s + r.cost, 0) } }
}
/** Finishes schedule CSV. */
export function finishCsv(f: ReturnType<typeof finishSchedule>): string {
  const head = 'Room,Level,Use,Finish grade,Floor (m²),Walls (m²),Ceiling (m²),Cost ($)'
  const rows = f.rows.map((r) => `${r.room},${r.level},${r.use},${r.gradeLabel},${r.floorArea},${r.wallArea},${r.ceilingArea},${r.cost}`)
  return [head, ...rows, `TOTAL,${f.totals.rooms} rooms,,,${f.totals.floorArea},,,${f.totals.cost}`].join('\n')
}

export type FloorReport = {
  level: number; name: string; area: number; rooms: number; occupancy: number
  windows: number; doors: number; columns: number; finishCost: number
  daylitRooms: number; egressOk: boolean
  uses: { use: string; label: string; count: number; area: number }[]
  focus: FocusRegion
}

/** A roll-up report for a whole floor (mix of uses, totals, focus region). */
export function floorReport(m: BuildingModel, level: number, opts: { storeyHeight?: number; code?: CodeKey } = {}): FloorReport | null {
  const slab = m.slabs.find((s) => s.level === level)
  if (!slab) return null
  const rooms = m.rooms.filter((r) => r.level === level)
  const sh = opts.storeyHeight ?? 3.6
  const heightM = sh - 0.12
  const eg = egressAnalysis(m, { code: opts.code ?? 'IBC' })
  const floorEg = eg.floors.find((x) => x.level === level)
  const byUse = new Map<string, { count: number; area: number }>()
  let occupancy = 0, daylitRooms = 0, finishCost = 0
  for (const r of rooms) {
    const t = spaceType(r.use)
    const cur = byUse.get(t.id) ?? { count: 0, area: 0 }
    byUse.set(t.id, { count: cur.count + 1, area: cur.area + r.area })
    occupancy += occupants(r.area, r.use)
    const rep = roomReport(m, r.id, opts)
    if (rep?.daylit) daylitRooms++
    finishCost += rep?.finishCost ?? 0
  }
  void heightM
  return {
    level, name: level === 0 ? 'Ground' : level >= m.counts.storeys ? 'Roof' : `Level ${level}`,
    area: r1(polygonArea(slab.polygon) * AREA), rooms: rooms.length, occupancy,
    windows: m.glazing.filter((g) => g.level === level).length, doors: m.interiorDoors.filter((d) => d.level === level).length,
    columns: m.columns.filter((c) => c.level === level).length, finishCost,
    daylitRooms, egressOk: floorEg ? floorEg.ok : false,
    uses: [...byUse.entries()].map(([use, v]) => ({ use, label: spaceType(use).label, count: v.count, area: r1(v.area) })).sort((a, b) => b.area - a.area),
    focus: { level, ...bbox(slab.polygon) },
  }
}
