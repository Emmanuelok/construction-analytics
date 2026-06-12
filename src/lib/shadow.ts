/* Shadow / right-to-light study — pure, unit-tested. Casts the proposed massing's
 * ground shadow for a sun position: a vertical prism of height h throws its footprint
 * plus that footprint slid along the sun's ground vector, so the shadow is the convex
 * hull of the base ring and the slid ring. Runs the key solar moments (9am / noon /
 * 3pm at a chosen month) to show how far the building shades neighbours through the
 * day, with the net new-shadow area (beyond the footprint itself). Uses the real sun
 * engine. Scene/site units are metres. No DOM, no Three.js. */

import type { Pt } from './zoning'
import { polygonArea } from './zoning'
import { sunPosition, sunDirection, momentOf } from './sun'

/** Andrew's monotone-chain convex hull (x,z plane). */
export function convexHull(pts: Pt[]): Pt[] {
  const ps = [...pts].sort((a, b) => (a.x - b.x) || (a.z - b.z))
  if (ps.length < 3) return ps
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  const lower: Pt[] = []
  for (const p of ps) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p) }
  const upper: Pt[] = []
  for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p) }
  lower.pop(); upper.pop()
  return lower.concat(upper)
}

export type Shadow = { polygon: Pt[]; area: number; reach: number; offset: { x: number; z: number } }

/** Ground shadow of a prism (footprint × height h) under a sun direction (toward
 *  the sun: x=East, y=up, z=North). Returns the shadow polygon, its area, the
 *  furthest reach beyond the footprint, and the ground offset vector. */
export function castShadow(footprint: Pt[], h: number, dir: { x: number; y: number; z: number }): Shadow {
  if (footprint.length < 3 || h <= 0 || dir.y <= 0.02) return { polygon: footprint.slice(), area: polygonArea(footprint), reach: 0, offset: { x: 0, z: 0 } }
  const k = h / dir.y // how far a point at height h projects along the ground
  const off = { x: -dir.x * k, z: -dir.z * k } // shadow falls away from the sun
  const slid = footprint.map((p) => ({ x: p.x + off.x, z: p.z + off.z }))
  const hull = convexHull([...footprint, ...slid])
  return { polygon: hull, area: Math.round(polygonArea(hull) * 10) / 10, reach: Math.round(Math.hypot(off.x, off.z) * 10) / 10, offset: { x: Math.round(off.x * 100) / 100, z: Math.round(off.z * 100) / 100 } }
}

export type ShadowMoment = { label: string; hour: number; altitude: number; azimuth: number; shadow: Shadow }
export type ShadowStudy = {
  moments: ShadowMoment[]
  footprintArea: number
  maxReach: number // furthest the shadow extends from the building, m
  netShadowArea: number // largest shadow area minus the footprint, m²
  month: number
}

/** Run a day's shadow study (09:00 / 12:00 / 15:00) for a site location + month. */
export function shadowStudy(footprint: Pt[], heightM: number, opts: { lat: number; lng: number; month?: number } = { lat: 40.7, lng: -74 }): ShadowStudy {
  const month = opts.month ?? 6
  const hours = [{ label: '09:00', h: 9 }, { label: '12:00 (noon)', h: 12 }, { label: '15:00', h: 15 }]
  const fpArea = Math.round(polygonArea(footprint) * 10) / 10
  // momentOf builds a UTC time; convert the site's *local* clock hour to UTC via
  // its longitude (~15°/hour) so 12:00 reads as true local midday, not 12:00 UTC.
  const toUtc = (localHour: number) => localHour - opts.lng / 15
  const moments: ShadowMoment[] = hours.map(({ label, h }) => {
    const pos = sunPosition(momentOf(month, toUtc(h)), opts.lat, opts.lng)
    const dir = sunDirection(pos.azimuth, pos.altitude)
    return { label, hour: h, altitude: pos.altitude, azimuth: pos.azimuth, shadow: castShadow(footprint, heightM, dir) }
  })
  const maxReach = Math.max(0, ...moments.map((m) => m.shadow.reach))
  const maxArea = Math.max(fpArea, ...moments.map((m) => m.shadow.area))
  return { moments, footprintArea: fpArea, maxReach, netShadowArea: Math.round((maxArea - fpArea) * 10) / 10, month }
}
