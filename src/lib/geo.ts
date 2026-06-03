/* Geospatial analytics for a site boundary — pure, unit-tested. Areas in multiple
 * units, edge lengths + compass bearings, frontage, compactness, and a local-metres
 * ↔ lat/lng projection so a parcel can be placed on a real basemap. Plan coords are
 * x = East, z = North (matching zoning.parseGeoBoundary's projection). */

import { type Pt, polygonArea, polygonPerimeter, polygonCentroid } from './zoning'

export type LatLng = { lat: number; lng: number }
export type Edge = { index: number; length: number; bearing: number } // metres, degrees (0=N,90=E)
export type GeoAnalysis = {
  area: { m2: number; ha: number; acres: number; ft2: number }
  perimeter: { m: number; ft: number }
  edges: Edge[]
  frontage: { length: number; bearing: number } // the longest edge
  compactness: number // Polsby–Popper 0–1 (1 = circle)
  bbox: { width: number; depth: number }
  centroidLatLng?: LatLng
}

const M_TO_FT = 3.280839895
const M2_TO_ACRE = 1 / 4046.8564224
const r1 = (n: number) => Math.round(n * 10) / 10
const r3 = (n: number) => Math.round(n * 1000) / 1000

/** Compass bearing (deg; 0=N, 90=E, 180=S, 270=W) of edge a→b (x=E, z=N). */
export function bearing(a: Pt, b: Pt): number {
  let deg = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI
  if (deg < 0) deg += 360
  return r1(deg)
}

/** Project a local plan point (metres) to lat/lng about an anchor. */
export function toLatLng(p: Pt, anchor: LatLng): LatLng {
  const lat = anchor.lat + p.z / 110540
  const lng = anchor.lng + p.x / (111320 * Math.cos((anchor.lat * Math.PI) / 180))
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

export const boundaryToLatLng = (boundary: Pt[], anchor: LatLng): LatLng[] => boundary.map((p) => toLatLng(p, anchor))

/** Inverse of toLatLng: a lat/lng back to local plan metres about the anchor. */
export function fromLatLng(ll: LatLng, anchor: LatLng): Pt {
  return {
    x: (ll.lng - anchor.lng) * 111320 * Math.cos((anchor.lat * Math.PI) / 180),
    z: (ll.lat - anchor.lat) * 110540,
  }
}

/** Full geospatial analysis of a site boundary (optionally georeferenced). */
export function analyzeSite(boundary: Pt[], anchor?: LatLng): GeoAnalysis {
  const area = polygonArea(boundary)
  const perim = polygonPerimeter(boundary)
  const edges: Edge[] = boundary.map((p, i) => {
    const q = boundary[(i + 1) % boundary.length]
    return { index: i, length: r1(Math.hypot(q.x - p.x, q.z - p.z)), bearing: bearing(p, q) }
  })
  const front = edges.reduce((m, e) => (e.length > m.length ? e : m), edges[0] ?? { index: 0, length: 0, bearing: 0 })
  const xs = boundary.map((p) => p.x), zs = boundary.map((p) => p.z)
  const out: GeoAnalysis = {
    area: { m2: Math.round(area), ha: r3(area / 10000), acres: r3(area * M2_TO_ACRE), ft2: Math.round(area * M_TO_FT * M_TO_FT) },
    perimeter: { m: Math.round(perim), ft: Math.round(perim * M_TO_FT) },
    edges,
    frontage: { length: front.length, bearing: front.bearing },
    compactness: perim > 0 ? r3((4 * Math.PI * area) / (perim * perim)) : 0,
    bbox: { width: r1(Math.max(...xs) - Math.min(...xs)), depth: r1(Math.max(...zs) - Math.min(...zs)) },
  }
  if (anchor) out.centroidLatLng = toLatLng(polygonCentroid(boundary), anchor)
  return out
}

/** Compass label (N, NE, E, …) for a bearing in degrees. */
export function compass(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'][Math.round(((deg % 360) / 45))]
}

/* ---- site survey: clickable, georeferenced coordinate + boundary review ---- */

export type SiteVertex = { index: number; label: string; x: number; z: number; lat?: number; lng?: number }
export type SiteEdge = { index: number; label: string; from: string; to: string; length: number; bearing: number; compass: string }
export type SiteSurvey = {
  vertices: SiteVertex[]
  edges: SiteEdge[]
  area: GeoAnalysis['area']
  perimeter: GeoAnalysis['perimeter']
  frontage: { length: number; bearing: number; compass: string; index: number }
  compactness: number
  bbox: GeoAnalysis['bbox']
  centroid: { x: number; z: number; lat?: number; lng?: number }
}

/** A full survey of a parcel: each vertex with local metres + (optionally) lat/lng,
 *  each edge with length, bearing & compass — the data behind a clickable site plan. */
export function siteSurvey(boundary: Pt[], anchor?: LatLng): SiteSurvey {
  const g = analyzeSite(boundary, anchor)
  const n = boundary.length
  const vertices: SiteVertex[] = boundary.map((p, i) => {
    const v: SiteVertex = { index: i, label: `V${i + 1}`, x: r1(p.x), z: r1(p.z) }
    if (anchor) { const ll = toLatLng(p, anchor); v.lat = ll.lat; v.lng = ll.lng }
    return v
  })
  const edges: SiteEdge[] = g.edges.map((e) => ({ index: e.index, label: `E${e.index + 1}`, from: `V${e.index + 1}`, to: `V${((e.index + 1) % n) + 1}`, length: e.length, bearing: e.bearing, compass: compass(e.bearing) }))
  const frontIdx = g.edges.reduce((m, e) => (e.length > g.edges[m].length ? e.index : m), 0)
  const c = polygonCentroid(boundary)
  const centroid: SiteSurvey['centroid'] = { x: r1(c.x), z: r1(c.z) }
  if (anchor && g.centroidLatLng) { centroid.lat = g.centroidLatLng.lat; centroid.lng = g.centroidLatLng.lng }
  return { vertices, edges, area: g.area, perimeter: g.perimeter, frontage: { length: g.frontage.length, bearing: g.frontage.bearing, compass: compass(g.frontage.bearing), index: frontIdx }, compactness: g.compactness, bbox: g.bbox, centroid }
}
