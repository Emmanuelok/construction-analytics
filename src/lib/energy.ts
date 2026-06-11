/* Energy & daylight — pure, unit-tested. From the model's glazing, walls, roof and
 * rooms it derives: per-room daylight (the exterior window area on the room's façade ÷
 * its floor area, a window-to-floor proxy for daylight, flagging interior/dark rooms);
 * per-orientation solar exposure (glazing area × an orientation factor); and a building
 * envelope estimate — heat-loss coefficient from U-values × areas and an indicative
 * energy-use intensity (kWh/m²·yr) with a rating. Indicative design-stage figures, not
 * a calibrated simulation. Scene units → metres via the plan scale + storey height. */

import type { BuildingModel, Quad } from './building'
import { SCENE_LEN_TO_M } from './massing'
import { polygonArea, polygonCentroid } from './zoning'
import { bearing, compass } from './geo'

const LEN = SCENE_LEN_TO_M
const AREA = LEN * LEN
const r1 = (n: number) => Math.round(n * 10) / 10
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(b.x - a.x, b.z - a.z)

export type EnergyOpts = { storeyHeight?: number; uWall?: number; uWindow?: number; uRoof?: number; uGround?: number; hdd?: number; minDaylight?: number }
export type DaylightRoom = { id: string; level: number; name: string; area: number; windowArea: number; daylight: number; ok: boolean }
export type Orientation = { dir: string; windowArea: number; solar: number }
export type EnergyResult = {
  rooms: DaylightRoom[]
  orientations: Orientation[]
  summary: {
    gfa: number; glazing: number; opaqueWall: number; roof: number; wwr: number
    heatLoss: number // W/K
    eui: number // kWh/m²·yr
    rating: string
    daylitRooms: number; darkRooms: number
  }
}

const ratingFor = (eui: number) => (eui < 100 ? 'A' : eui < 150 ? 'B' : eui < 200 ? 'C' : eui < 250 ? 'D' : eui < 300 ? 'E' : 'F')
const octant = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((deg % 360) + 360) % 360 / 45) % 8]
// northern-hemisphere solar exposure weight by facing
const SOLAR: Record<string, number> = { S: 1, SE: 0.85, SW: 0.85, E: 0.6, W: 0.6, NE: 0.4, NW: 0.4, N: 0.25 }

/** Min distance from a point to a polygon's edges. */
function pointToPoly(p: { x: number; z: number }, poly: { x: number; z: number }[]): number {
  let min = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2))
    min = Math.min(min, Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)))
  }
  return min
}

const winArea = (g: Quad, sh: number) => dist(g.a, g.b) * LEN * (g.h * sh)

/** Per-room daylight, per-orientation solar exposure and an envelope energy estimate. */
export function energyAnalysis(m: BuildingModel, opts: EnergyOpts = {}): EnergyResult {
  const sh = Math.max(0.1, opts.storeyHeight ?? 3.6)
  const uWall = opts.uWall ?? 0.3, uWindow = opts.uWindow ?? 1.8, uRoof = opts.uRoof ?? 0.2, uGround = opts.uGround ?? 0.25
  const hdd = opts.hdd ?? 2200 // heating degree-days (K·day)
  const minDaylight = opts.minDaylight ?? 0.1 // window-to-floor ratio threshold

  // per-room daylight: glazing whose midpoint sits on the room's façade edge
  // (circulation spaces are excluded — corridors don't need daylight)
  const rooms: DaylightRoom[] = m.rooms.filter((r) => r.use !== 'circulation').map((room) => {
    const lvlGlazing = m.glazing.filter((g) => (g.level ?? 0) === room.level)
    let wa = 0
    for (const g of lvlGlazing) { const mid = { x: (g.a.x + g.b.x) / 2, z: (g.a.z + g.b.z) / 2 }; if (pointToPoly(mid, room.polygon) < 0.25) wa += winArea(g, sh) }
    const daylight = room.area > 0 ? wa / room.area : 0
    return { id: room.id, level: room.level, name: room.name, area: room.area, windowArea: r1(wa), daylight: r1(daylight * 100), ok: daylight >= minDaylight }
  })

  // per-orientation solar exposure (windows grouped by compass facing)
  const byDir: Record<string, number> = {}
  for (const g of m.glazing) {
    const slab = m.slabs.find((s) => s.level === (g.level ?? 0))
    const c = slab ? polygonCentroid(slab.polygon) : { x: 0, z: 0 }
    const dir = octant(bearing(c, { x: (g.a.x + g.b.x) / 2, z: (g.a.z + g.b.z) / 2 }))
    byDir[dir] = (byDir[dir] ?? 0) + winArea(g, sh)
  }
  const orientations: Orientation[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    .filter((d) => byDir[d])
    .map((d) => ({ dir: d, windowArea: r1(byDir[d]), solar: r1(byDir[d] * (SOLAR[d] ?? 0.5)) }))

  // envelope quantities
  const glazing = m.glazing.reduce((s, g) => s + winArea(g, sh), 0)
  const wallArea = m.walls.reduce((s, w) => s + dist(w.a, w.b) * LEN * (w.h * sh), 0)
  const opaqueWall = Math.max(0, wallArea - glazing)
  const roof = m.roof ? polygonArea(m.roof.polygon) * AREA : 0
  const ground = m.slabs.find((s) => (s.level ?? 0) === 0) ? polygonArea(m.slabs[0].polygon) * AREA : 0
  const gfa = m.slabs.reduce((s, sl) => s + polygonArea(sl.polygon) * AREA, 0)

  const heatLoss = uWall * opaqueWall + uWindow * glazing + uRoof * roof + uGround * ground // W/K
  const fabricKWh = (heatLoss * hdd * 24) / 1000 // annual fabric heat loss
  const heatingEUI = gfa > 0 ? fabricKWh / gfa / 0.85 : 0 // boiler efficiency
  const solarKWh = glazing * 0.4 * 350 // g-value × effective annual incident
  const coolingEUI = gfa > 0 ? (solarKWh / gfa) * 0.3 : 0
  const baseEUI = 95 // office lighting + equipment + DHW
  const eui = Math.round(baseEUI + heatingEUI + coolingEUI)

  return {
    rooms, orientations,
    summary: {
      gfa: r1(gfa), glazing: r1(glazing), opaqueWall: r1(opaqueWall), roof: r1(roof),
      wwr: wallArea > 0 ? Math.round((glazing / wallArea) * 100) / 100 : 0,
      heatLoss: Math.round(heatLoss), eui, rating: ratingFor(eui),
      daylitRooms: rooms.filter((r) => r.ok).length, darkRooms: rooms.filter((r) => !r.ok).length,
    },
  }
}
