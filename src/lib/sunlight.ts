/* Amenity sunlight — pure, unit-tested. The complement to the overshadowing study:
 * instead of how the proposal shades its neighbours, this measures how much sun
 * actually reaches the scheme's own open space at ground level. It samples the
 * open-space polygon on a grid and, for each daylight hour, casts the shadows of
 * every obstacle (the proposal's massing and any context neighbours) and tests
 * each sample point — accumulating sun-hours per point and the share of the area
 * that meets a sunlight criterion (BRE uses ≥2h on 21 March for amenity space).
 * Builds on the shadow + sun engines; units are metres. No DOM. */

import type { Pt } from './zoning'
import { polygonArea } from './zoning'
import { castShadow } from './shadow'
import { sunPosition, sunDirection, momentOf } from './sun'

export type SunObstacle = { footprint: Pt[]; height: number }

export type SunMoment = { label: string; hour: number; altitude: number; sunlitFraction: number }
export type SunSample = { x: number; z: number; sunHours: number }
export type AmenitySunlight = {
  moments: SunMoment[]
  grid: SunSample[]
  area: number
  daylightHours: number     // hours sampled with the sun above the horizon
  avgSunHours: number       // mean sun-hours across the amenity
  sunlitArea2h: number      // m² receiving ≥ 2h
  sunlitFraction2h: number  // % of amenity meeting the ≥2h criterion
  maxSunHours: number
  month: number
}

/** Ray-cast point in polygon (x east, z north). */
function inPoly(p: Pt, poly: Pt[]): boolean {
  if (poly.length < 3) return false
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

const bbox = (poly: Pt[]) => ({ minX: Math.min(...poly.map((p) => p.x)), maxX: Math.max(...poly.map((p) => p.x)), minZ: Math.min(...poly.map((p) => p.z)), maxZ: Math.max(...poly.map((p) => p.z)) })

/** Sun-hours on an open-space polygon, given shadowing obstacles. Samples the
 *  area on an ~`n`×`n` grid and the day on hourly steps (`from`..`to`). */
export function amenitySunlight(
  openSpace: Pt[],
  obstacles: SunObstacle[],
  opts: { lat: number; lng: number; month?: number; from?: number; to?: number; n?: number } = { lat: 40.7, lng: -74 },
): AmenitySunlight {
  const month = opts.month ?? 6
  const from = opts.from ?? 7
  const to = opts.to ?? 18
  const n = opts.n ?? 12
  const toUtc = (localHour: number) => localHour - opts.lng / 15

  // build the grid of interior sample points
  const b = openSpace.length >= 3 ? bbox(openSpace) : { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = { x: b.minX + ((i + 0.5) / n) * (b.maxX - b.minX), z: b.minZ + ((j + 0.5) / n) * (b.maxZ - b.minZ) }
    if (inPoly(p, openSpace) && !obstacles.some((o) => inPoly(p, o.footprint))) pts.push(p)
  }
  const sun = new Array<number>(pts.length).fill(0) // sun-hours per point

  const moments: SunMoment[] = []
  let daylightHours = 0
  for (let h = from; h <= to; h++) {
    const pos = sunPosition(momentOf(month, toUtc(h)), opts.lat, opts.lng)
    if (pos.altitude <= 0) { moments.push({ label: `${h}:00`, hour: h, altitude: Math.round(pos.altitude), sunlitFraction: 0 }); continue }
    daylightHours++
    const dir = sunDirection(pos.azimuth, pos.altitude)
    const shadows = obstacles.filter((o) => o.height > 0 && o.footprint.length >= 3).map((o) => castShadow(o.footprint, o.height, dir).polygon)
    let lit = 0
    for (let k = 0; k < pts.length; k++) {
      const shaded = shadows.some((poly) => inPoly(pts[k], poly))
      if (!shaded) { sun[k] += 1; lit++ }
    }
    moments.push({ label: `${h}:00`, hour: h, altitude: Math.round(pos.altitude), sunlitFraction: pts.length ? Math.round((lit / pts.length) * 100) : 0 })
  }

  const area = openSpace.length >= 3 ? Math.round(polygonArea(openSpace)) : 0
  const grid: SunSample[] = pts.map((p, k) => ({ x: p.x, z: p.z, sunHours: sun[k] }))
  const total = sun.reduce((s, v) => s + v, 0)
  const meets2h = sun.filter((v) => v >= 2).length
  const cell = pts.length > 0 ? area / pts.length : 0
  return {
    moments, grid, area, daylightHours,
    avgSunHours: pts.length ? Math.round((total / pts.length) * 10) / 10 : 0,
    sunlitArea2h: Math.round(meets2h * cell),
    sunlitFraction2h: pts.length ? Math.round((meets2h / pts.length) * 100) : 0,
    maxSunHours: sun.length ? Math.max(...sun) : 0,
    month,
  }
}

/** Amenity sunlight CSV — the hourly arc + headline. */
export function sunlightCsv(s: AmenitySunlight): string {
  const head = 'Hour,Altitude,Sunlit %'
  const rows = s.moments.map((m) => `${m.label},${m.altitude},${m.sunlitFraction}`)
  const meta = ['', 'Metric,Value', `Amenity area (m²),${s.area}`, `Daylight hours sampled,${s.daylightHours}`, `Average sun-hours,${s.avgSunHours}`, `Area ≥2h (m²),${s.sunlitArea2h}`, `Share ≥2h,${s.sunlitFraction2h}%`, `Max sun-hours,${s.maxSunHours}`]
  return [head, ...rows, ...meta].join('\n')
}
