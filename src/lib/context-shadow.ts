/* Site context + overshadowing — pure, unit-tested. Models the neighbouring
 * buildings around a parcel (footprint + height) and measures how much the
 * proposed mass shades them through the day: each neighbour footprint is sampled
 * on a grid and tested against the proposal's cast-shadow polygons at 9 / 12 / 15h,
 * giving a worst-moment shadow coverage and a "sun-hours retained" proxy (the share
 * of sampled moments its centre stays sunlit). Generates a default ring of context
 * lots around the site bbox so a study has neighbours to shade. Builds on the shadow
 * engine; units are metres. No DOM, no Three.js. */

import type { Pt } from './zoning'
import { polygonArea } from './zoning'
import { shadowStudy, type ShadowMoment } from './shadow'

export type Neighbour = { id: string; name: string; footprint: Pt[]; height: number }

const bbox = (poly: Pt[]) => {
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}
const centroid = (poly: Pt[]) => ({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, z: poly.reduce((s, p) => s + p.z, 0) / poly.length })
const rect = (cx: number, cz: number, w: number, d: number): Pt[] => [{ x: cx - w / 2, z: cz - d / 2 }, { x: cx + w / 2, z: cz - d / 2 }, { x: cx + w / 2, z: cz + d / 2 }, { x: cx - w / 2, z: cz + d / 2 }]

/** A ring of four context lots (N/E/S/W) hugging the site bbox at `gap` metres. */
export function defaultNeighbours(boundary: Pt[], gap = 8, height = 24): Neighbour[] {
  if (boundary.length < 3) return []
  const b = bbox(boundary)
  const w = b.maxX - b.minX, d = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2
  const t = Math.max(12, Math.min(w, d) * 0.6) // neighbour depth
  return [
    { id: 'n-n', name: 'North neighbour', footprint: rect(cx, b.maxZ + gap + t / 2, w, t), height },
    { id: 'n-s', name: 'South neighbour', footprint: rect(cx, b.minZ - gap - t / 2, w, t), height },
    { id: 'n-e', name: 'East neighbour', footprint: rect(b.maxX + gap + t / 2, cz, t, d), height: Math.round(height * 0.8) },
    { id: 'n-w', name: 'West neighbour', footprint: rect(b.minX - gap - t / 2, cz, t, d), height: Math.round(height * 0.8) },
  ]
}

/** Ray-cast point in polygon (x east, z north). */
function inPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export type NeighbourShadow = {
  id: string; name: string; height: number; area: number
  worstCoverage: number // % of the footprint shaded at the worst moment
  avgCoverage: number // mean across the day's moments
  sunlitMoments: number; totalMoments: number
  sunHours: number // proxy: sunlit share × a 10h working day
  byMoment: { label: string; coverage: number }[]
}
export type ContextStudy = {
  neighbours: NeighbourShadow[]
  worstNeighbour: string
  totalShadedArea: number // m² of neighbour footprints shaded at each one's worst moment
  month: number
}

/** Sample a footprint on an ~`n`×`n` grid; fraction of interior samples in any shadow. */
function coverage(footprint: Pt[], shadow: Pt[], n = 8): number {
  const b = bbox(footprint)
  let inside = 0, shaded = 0
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = { x: b.minX + ((i + 0.5) / n) * (b.maxX - b.minX), z: b.minZ + ((j + 0.5) / n) * (b.maxZ - b.minZ) }
    if (!inPoly(p, footprint)) continue
    inside++
    if (shadow.length >= 3 && inPoly(p, shadow)) shaded++
  }
  return inside > 0 ? shaded / inside : 0
}

/** Overshadowing of a set of neighbours by the proposal across the day. */
export function overshadowing(proposalFootprint: Pt[], proposalHeight: number, neighbours: Neighbour[], opts: { lat: number; lng: number; month?: number } = { lat: 40.7, lng: -74 }): ContextStudy {
  const study = shadowStudy(proposalFootprint, proposalHeight, opts)
  const moments: ShadowMoment[] = study.moments
  const out: NeighbourShadow[] = neighbours.map((nb) => {
    const byMoment = moments.map((m) => ({ label: m.label, coverage: Math.round(coverage(nb.footprint, m.shadow.polygon) * 100) }))
    const worst = Math.max(0, ...byMoment.map((b) => b.coverage))
    const avg = byMoment.length ? Math.round(byMoment.reduce((s, b) => s + b.coverage, 0) / byMoment.length) : 0
    const c = centroid(nb.footprint)
    const sunlit = moments.filter((m) => !(m.shadow.polygon.length >= 3 && inPoly(c, m.shadow.polygon))).length
    return {
      id: nb.id, name: nb.name, height: nb.height, area: Math.round(polygonArea(nb.footprint)),
      worstCoverage: worst, avgCoverage: avg, sunlitMoments: sunlit, totalMoments: moments.length,
      sunHours: Math.round((sunlit / Math.max(1, moments.length)) * 10 * 10) / 10,
      byMoment,
    }
  })
  const worstN = out.reduce((w, n) => (n.worstCoverage > (w?.worstCoverage ?? -1) ? n : w), out[0])
  const totalShaded = out.reduce((s, n) => s + (n.area * n.worstCoverage) / 100, 0)
  return { neighbours: out, worstNeighbour: worstN ? worstN.name : '—', totalShadedArea: Math.round(totalShaded), month: study.month }
}

/** Overshadowing CSV. */
export function overshadowingCsv(c: ContextStudy): string {
  const head = 'Neighbour,Height (m),Area (m²),Worst shadow %,Avg shadow %,Sunlit moments,Sun-hours (proxy)'
  const rows = c.neighbours.map((n) => `${n.name},${n.height},${n.area},${n.worstCoverage},${n.avgCoverage},${n.sunlitMoments}/${n.totalMoments},${n.sunHours}`)
  return [head, ...rows, `TOTAL shaded,,,${c.totalShadedArea} m² at worst,,,`].join('\n')
}
