/* Egress / life-safety analysis — pure, unit-tested. Builds a routed graph from the
 * model: rooms are nodes, connected to each other (and to the circulation core) only
 * where an interior door actually joins them, and the core is the egress source (it
 * holds the protected stairs). A multi-source shortest-path then gives each room its
 * real travel distance *through the doorways* — not a straight line — plus per-floor
 * occupant load, exit count and required-vs-provided exit width, checked against a code
 * preset. Scene units → metres via the plan scale. No DOM, no engines beyond the model. */

import type { BuildingModel } from './building'
import { SCENE_LEN_TO_M } from './massing'
import { CODE_PRESETS, type CodeKey } from './building-code'
import type { Pt } from './zoning'

const LEN = SCENE_LEN_TO_M
const r1 = (n: number) => Math.round(n * 10) / 10
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.z - a.z)

export type EgressRoom = { id: string; level: number; name: string; area: number; occupancy: number; travel: number; ok: boolean; reason?: string }
export type EgressFloor = { level: number; name: string; rooms: number; occupancy: number; exits: number; maxTravel: number; requiredWidth: number; providedWidth: number; area: number; maxCompartment: number; compartments: number; ok: boolean; issues: string[] }
export type EgressResult = {
  code: CodeKey
  rooms: EgressRoom[]
  floors: EgressFloor[]
  summary: { occupancy: number; maxTravel: number; maxTravelLimit: number; roomsOverTravel: number; maxCompartments: number; worstFloor: string; ok: boolean }
}

const levelName = (i: number, storeys: number) => (i === 0 ? 'Ground' : i >= storeys ? 'Roof' : `Level ${i}`)
const exitsFor = (m: BuildingModel, level: number): Pt[] => {
  const st = m.stairs.filter((s) => s.level === level).map((s) => ({ x: s.x, z: s.z }))
  return st.length ? st : m.core ? [{ x: m.core.x, z: m.core.z }] : []
}

/** Min distance from p to any edge of a polygon. */
function pointToPoly(p: Pt, poly: Pt[]): number {
  let min = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2))
    min = Math.min(min, Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)))
  }
  return min
}

type Graph = { center: Pt[]; coreNode: number; adj: { to: number; w: number }[][] }

/** Build the routed egress graph for one level: room nodes joined where a door links
 *  them, plus a core node (the egress source) reached by doors on the core boundary. */
function buildGraph(m: BuildingModel, level: number): Graph {
  const rooms = m.rooms.filter((r) => r.level === level)
  const doors = m.interiorDoors.filter((d) => (d.level ?? 0) === level)
  const n = rooms.length
  const coreNode = n
  const center = rooms.map((r) => r.center)
  const adj: { to: number; w: number }[][] = Array.from({ length: n + 1 }, () => [])
  const link = (a: number, b: number, w: number) => { adj[a].push({ to: b, w }); adj[b].push({ to: a, w }) }
  const core = exitsFor(m, level)[0] ?? null
  const tol = 0.12
  for (const d of doors) {
    const mid = { x: (d.a.x + d.b.x) / 2, z: (d.a.z + d.b.z) / 2 }
    const touch: number[] = []
    for (let i = 0; i < n; i++) if (pointToPoly(mid, rooms[i].polygon) < tol) touch.push(i)
    if (touch.length >= 2) link(touch[0], touch[1], dist(center[touch[0]], center[touch[1]]) * LEN)
    else if (touch.length === 1) link(touch[0], coreNode, (dist(center[touch[0]], mid) + (core ? dist(mid, core) : 0)) * LEN)
  }
  return { center, coreNode, adj }
}

/** Dijkstra from the core node → distance (m) + predecessor for every room. */
function shortestFromCore(g: Graph): { dist: number[]; prev: number[] } {
  const N = g.adj.length
  const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), seen = new Array(N).fill(false)
  dist[g.coreNode] = 0
  for (let it = 0; it < N; it++) {
    let u = -1, best = Infinity
    for (let i = 0; i < N; i++) if (!seen[i] && dist[i] < best) { best = dist[i]; u = i }
    if (u === -1) break
    seen[u] = true
    for (const e of g.adj[u]) if (dist[u] + e.w < dist[e.to]) { dist[e.to] = dist[u] + e.w; prev[e.to] = u }
  }
  return { dist, prev }
}

/** Run the routed egress / occupancy / travel-distance analysis under a code. */
export function egressAnalysis(m: BuildingModel, opts: { code?: CodeKey } = {}): EgressResult {
  const code = opts.code ?? 'IBC'
  const lim = CODE_PRESETS[code].egress
  const storeys = m.counts.storeys

  const rooms: EgressRoom[] = []
  const floors: EgressFloor[] = []
  for (let lvl = 0; lvl < storeys; lvl++) {
    const rs = m.rooms.filter((r) => r.level === lvl)
    if (!rs.length) continue
    const exits = exitsFor(m, lvl)
    const g = buildGraph(m, lvl)
    const { dist } = shortestFromCore(g)
    const lvlRooms: EgressRoom[] = rs.map((room, i) => {
      const occupancy = Math.max(1, Math.ceil(room.area / lim.occLoadFactor))
      const reachable = isFinite(dist[i]) && exits.length > 0
      const travel = reachable ? r1(dist[i]) : 0
      return { id: room.id, level: lvl, name: room.name, area: room.area, occupancy, travel, ok: reachable && travel <= lim.maxTravel + 1e-6, reason: exits.length === 0 ? 'no exit on floor' : !reachable ? 'no door route to a stair' : travel > lim.maxTravel ? 'beyond travel limit' : undefined }
    })
    rooms.push(...lvlRooms)
    const occupancy = lvlRooms.reduce((s, r) => s + r.occupancy, 0)
    const maxTravel = Math.max(...lvlRooms.map((r) => r.travel), 0)
    const requiredWidth = (occupancy * lim.widthPerOccupantMm) / 1000
    const providedWidth = m.stairs.filter((s) => s.level === lvl).reduce((s, st) => s + st.widthScene * LEN, 0) || (m.core ? lim.minExitWidth : 0)
    const issues: string[] = []
    const stranded = lvlRooms.filter((r) => !!r.reason && r.reason !== 'beyond travel limit').length
    if (stranded) issues.push(`${stranded} room(s) with no door route to a stair`)
    if (maxTravel > lim.maxTravel + 1e-6) issues.push(`travel ${Math.round(maxTravel)}m > ${lim.maxTravel}m`)
    if (occupancy > lim.twoExitsAbove && exits.length < 2) issues.push(`${occupancy} occupants need ≥2 exits (have ${exits.length})`)
    if (providedWidth + 1e-6 < requiredWidth) issues.push(`exit width ${Math.round(providedWidth * 1000)}mm < ${Math.round(requiredWidth * 1000)}mm required`)
    else if (exits.length > 0 && providedWidth + 1e-6 < lim.minExitWidth) issues.push(`exit width ${Math.round(providedWidth * 1000)}mm < ${Math.round(lim.minExitWidth * 1000)}mm min`)
    if (exits.length === 0) issues.push('no exit serving this floor')
    const area = r1(rs.reduce((s, r) => s + r.area, 0))
    const compartments = Math.max(1, Math.ceil(area / lim.maxCompartment))
    floors.push({ level: lvl, name: levelName(lvl, storeys), rooms: rs.length, occupancy, exits: exits.length, maxTravel: r1(maxTravel), requiredWidth: Math.round(requiredWidth * 1000) / 1000, providedWidth: Math.round(providedWidth * 1000) / 1000, area, maxCompartment: lim.maxCompartment, compartments, ok: issues.length === 0, issues })
  }

  const occupancy = floors.reduce((s, f) => s + f.occupancy, 0)
  const maxTravel = Math.max(...rooms.map((r) => r.travel), 0)
  const worst = floors.find((f) => !f.ok)
  return {
    code, rooms, floors,
    summary: { occupancy, maxTravel: r1(maxTravel), maxTravelLimit: lim.maxTravel, roomsOverTravel: rooms.filter((r) => !r.ok).length, maxCompartments: Math.max(...floors.map((f) => f.compartments), 0), worstFloor: worst ? worst.name : '—', ok: floors.length > 0 && floors.every((f) => f.ok) },
  }
}

/** The routed egress path for one room (room → through doorways → core → nearest stair),
 *  as a polyline of plan points, for the plan overlay. */
export function egressPathFor(m: BuildingModel, roomId: string): { points: Pt[] } | null {
  const room = m.rooms.find((x) => x.id === roomId)
  if (!room) return null
  const rs = m.rooms.filter((r) => r.level === room.level)
  const idx = rs.findIndex((r) => r.id === roomId)
  const g = buildGraph(m, room.level)
  const { dist, prev } = shortestFromCore(g)
  const exits = exitsFor(m, room.level)
  const points: Pt[] = [room.center]
  if (idx >= 0 && isFinite(dist[idx])) {
    let u = idx
    const guard = rs.length + 2
    for (let i = 0; i < guard && u !== g.coreNode && prev[u] !== -1; i++) { u = prev[u]; if (u !== g.coreNode) points.push(g.center[u]) }
  }
  if (exits.length) {
    let best = exits[0], bd = Infinity
    for (const e of exits) { const d = Math.hypot(e.x - room.center.x, e.z - room.center.z); if (d < bd) { bd = d; best = e } }
    points.push(best)
  }
  return { points }
}
