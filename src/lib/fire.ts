/* Fire compartmentation — pure, unit-tested. Subdivides each floor into fire
 * compartments no larger than the code's maximum compartment area, draws the
 * fire-rated boundary walls between them (clipped to the floor outline), assigns the
 * rooms to compartments, and runs a per-compartment takeoff: area, room + occupant
 * counts, rated-wall run and an indicative fit-out cost. It's a design-stage
 * subdivision (an even grid sized to the code limit), not an authored fire strategy —
 * labelled as such. Scene units → metres via the plan scale. No DOM, no Three.js. */

import { type Pt, polygonArea, polygonPerimeter, polygonCentroid } from './zoning'
import { clipToRect } from './building-rooms'
import { clipSegment } from './building-partitions'
import { SCENE_LEN_TO_M } from './massing'
import type { BuildingModel } from './building'

const LEN = SCENE_LEN_TO_M
const AREA = LEN * LEN
const r1 = (n: number) => Math.round(n * 10) / 10

export type Compartment = { id: string; level: number; polygon: Pt[]; center: Pt; area: number; rooms: number; occupancy: number; ratedWall: number; cost: number }
export type FireWall = { a: Pt; b: Pt }
export type FloorFire = { level: number; compartments: Compartment[]; walls: FireWall[] }
export type FireOpts = { maxArea: number; occLoadFactor: number; costPerM2?: number }

const inCell = (p: Pt, x0: number, x1: number, z0: number, z1: number) => p.x >= x0 && p.x < x1 && p.z >= z0 && p.z < z1

/** Subdivide one floor into fire compartments + the rated walls between them. */
export function floorCompartments(m: BuildingModel, level: number, opts: FireOpts): FloorFire {
  const slab = m.slabs.find((s) => (s.level ?? 0) === level)
  if (!slab || slab.polygon.length < 3) return { level, compartments: [], walls: [] }
  const poly = slab.polygon
  const floorArea = polygonArea(poly) * AREA
  const n = Math.max(1, Math.ceil(floorArea / opts.maxArea))
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const wsp = maxX - minX || 1, dsp = maxZ - minZ || 1
  // grid into cols×rows ≈ n, proportioned to the bbox aspect
  const cols = Math.max(1, Math.round(Math.sqrt((n * wsp) / dsp)))
  const rows = Math.max(1, Math.ceil(n / cols))
  const cw = wsp / cols, cd = dsp / rows
  const rate = opts.costPerM2 ?? 1800
  const roomsLvl = m.rooms.filter((r) => r.level === level)
  const compartments: Compartment[] = []
  let ci = 0
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = minX + i * cw, x1 = x0 + cw, z0 = minZ + j * cd, z1 = z0 + cd
      const clipped = clipToRect(poly, x0, x1, z0, z1)
      if (clipped.length < 3) continue
      const a = polygonArea(clipped) * AREA
      if (a < opts.maxArea * 0.02) continue // drop slivers
      const rooms = roomsLvl.filter((r) => inCell(r.center, x0, x1, z0, z1))
      const occupancy = rooms.reduce((s, r) => s + Math.max(1, Math.ceil(r.area / opts.occLoadFactor)), 0)
      compartments.push({ id: `comp-${level}-${ci++}`, level, polygon: clipped, center: polygonCentroid(clipped), area: r1(a), rooms: rooms.length, occupancy, ratedWall: r1(polygonPerimeter(clipped) * LEN), cost: Math.round(a * rate) })
    }
  }
  const walls: FireWall[] = []
  for (let i = 1; i < cols; i++) { const x = minX + i * cw; for (const [a, b] of clipSegment({ x, z: minZ }, { x, z: maxZ }, poly)) walls.push({ a, b }) }
  for (let j = 1; j < rows; j++) { const z = minZ + j * cd; for (const [a, b] of clipSegment({ x: minX, z }, { x: maxX, z }, poly)) walls.push({ a, b }) }
  return { level, compartments, walls }
}

export type BuildingFire = { floors: FloorFire[]; compartments: number; ratedWall: number; cost: number; maxArea: number }

/** Fire compartmentation + takeoff across every storey. */
export function buildingFire(m: BuildingModel, opts: FireOpts): BuildingFire {
  const floors: FloorFire[] = []
  for (let lvl = 0; lvl < m.counts.storeys; lvl++) { const f = floorCompartments(m, lvl, opts); if (f.compartments.length) floors.push(f) }
  const all = floors.flatMap((f) => f.compartments)
  return {
    floors,
    compartments: all.length,
    ratedWall: r1(floors.reduce((s, f) => s + f.walls.reduce((t, w) => t + Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) * LEN, 0), 0)),
    cost: all.reduce((s, c) => s + c.cost, 0),
    maxArea: opts.maxArea,
  }
}
