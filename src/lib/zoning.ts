/* Site & zoning engine — pure, unit-tested. Turns a site boundary polygon plus
 * zoning rules (FAR, height limit, setback, coverage) into the buildable area,
 * the legal massing envelope, and a compliance check against a proposed scheme.
 * Plain 2D geometry (metres) + a GeoJSON boundary importer — no Three.js, no DOM,
 * so it's deterministic and testable. The viewer just draws these polygons. */

export type Pt = { x: number; z: number } // plan metres (x east, z north)

export type ZoningInput = {
  boundary: Pt[] // site polygon
  far: number // floor area ratio — max GFA ÷ site area
  heightLimit: number // metres
  setback: number // uniform setback from the boundary, metres
  maxCoverage: number // 0–100 %, share of the site the footprint may cover
  storeyHeight: number // metres
  proposedGFA: number // m²
  proposedStoreys: number
  podium?: number // 0–1 fraction of storeys forming a full-plate podium base
  towerSetback?: number // 0–0.6 — the tower steps in by this much above the podium
}

/** A vertical slab of the proposed massing (podium or tower), metres. */
export type MassingTier = { footprint: number; base: number; top: number }

export type Compliance = { far: boolean; height: boolean; coverage: boolean; setback: boolean; overall: boolean }

export type Zoning = {
  siteArea: number
  sitePerimeter: number
  buildable: Pt[] // setback (inset) polygon — empty if the setback collapses the site
  buildableArea: number
  maxGFA: number // far × siteArea
  maxFootprint: number // min(buildableArea, coverage cap)
  maxHeight: number
  envelopeVolume: number // maxFootprint × heightLimit (indicative legal volume)
  proposed: { footprint: number; height: number; coverage: number; far: number }
  tiers: MassingTier[] // podium + tower slabs (one tier when no podium)
  compliance: Compliance
  utilisation: number // proposedGFA ÷ maxGFA, %
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Signed area (shoelace); positive = counter-clockwise in x/z. */
export function signedArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export const polygonArea = (pts: Pt[]): number => Math.abs(signedArea(pts))

export function polygonPerimeter(pts: Pt[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    s += Math.hypot(q.x - p.x, q.z - p.z)
  }
  return s
}

export function polygonCentroid(pts: Pt[]): Pt {
  let cx = 0, cz = 0, a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const cross = p.x * q.z - q.x * p.z
    a += cross; cx += (p.x + q.x) * cross; cz += (p.z + q.z) * cross
  }
  if (Math.abs(a) < 1e-9) {
    // degenerate → average of vertices
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length }
  }
  return { x: cx / (3 * a), z: cz / (3 * a) }
}

/** Uniformly inset a polygon by `d` (a setback). Edge-parallel offset with
 *  intersection of neighbours — exact for convex polygons. Returns [] if the
 *  inset collapses or inverts the polygon (setback larger than the site). */
export function insetPolygon(pts: Pt[], d: number): Pt[] {
  if (pts.length < 3) return []
  if (d <= 0) return pts.map((p) => ({ ...p }))
  // normalise to CCW so the left edge-normal points inward
  const ccw = signedArea(pts) >= 0 ? pts : [...pts].reverse()
  const n = ccw.length
  const lines = ccw.map((p, i) => {
    const q = ccw[(i + 1) % n]
    let nx = -(q.z - p.z), nz = q.x - p.x // left normal of the edge
    const len = Math.hypot(nx, nz) || 1
    nx /= len; nz /= len
    return { ox: p.x + nx * d, oz: p.z + nz * d, dx: q.x - p.x, dz: q.z - p.z }
  })
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n], b = lines[i]
    // intersect offset line a (point a.o, dir a.d) with offset line b
    const denom = a.dx * b.dz - a.dz * b.dx
    if (Math.abs(denom) < 1e-9) return [] // parallel adjacent edges → degenerate
    const t = ((b.ox - a.ox) * b.dz - (b.oz - a.oz) * b.dx) / denom
    out.push({ x: a.ox + a.dx * t, z: a.oz + a.dz * t })
  }
  // reject a collapsed / flipped result: an over-large setback makes opposite
  // edges cross, so a result edge runs opposite its source edge.
  if (polygonArea(out) < 1e-6) return []
  for (let i = 0; i < n; i++) {
    const e = { x: out[(i + 1) % n].x - out[i].x, z: out[(i + 1) % n].z - out[i].z }
    if (e.x * lines[i].dx + e.z * lines[i].dz <= 0) return [] // edge reversed → collapsed
  }
  return out
}

/** Scale a polygon about a centre by factor k (for nesting a smaller footprint). */
export function scalePolygon(pts: Pt[], k: number, centre?: Pt): Pt[] {
  const c = centre ?? polygonCentroid(pts)
  return pts.map((p) => ({ x: c.x + (p.x - c.x) * k, z: c.z + (p.z - c.z) * k }))
}

/** Compute buildable area, legal envelope and compliance for a proposed scheme. */
export function buildZoning(input: ZoningInput): Zoning {
  const boundary = input.boundary ?? []
  const siteArea = polygonArea(boundary)
  const sitePerimeter = polygonPerimeter(boundary)
  const setback = Math.max(0, input.setback)
  const buildable = insetPolygon(boundary, setback)
  const buildableArea = buildable.length ? polygonArea(buildable) : 0

  const far = Math.max(0, input.far)
  const maxCoverage = clamp(input.maxCoverage, 0, 100)
  const storeyHeight = Math.max(0.1, input.storeyHeight)
  const maxHeight = Math.max(0, input.heightLimit)

  const maxGFA = far * siteArea
  const coverageCap = (maxCoverage / 100) * siteArea
  const maxFootprint = Math.min(buildableArea, coverageCap)

  const proposedGFA = Math.max(0, input.proposedGFA)
  const proposedStoreys = Math.max(1, Math.round(input.proposedStoreys))
  const height = proposedStoreys * storeyHeight

  // Split the scheme into a podium + tower (GFA-conserving): with a setback the
  // tower plate is (1−setback) of the podium plate, so the podium is the binding
  // (largest) footprint for coverage. No podium → a single uniform tier.
  const podiumFrac = clamp(input.podium ?? 0, 0, 1)
  const towerSetback = clamp(input.towerSetback ?? 0, 0, 0.6)
  const podiumStoreys = Math.round(podiumFrac * proposedStoreys)
  const towerStoreys = proposedStoreys - podiumStoreys
  const hasTower = podiumStoreys > 0 && towerStoreys > 0 && towerSetback > 0
  let footprint: number
  let tiers: MassingTier[]
  if (hasTower) {
    const podiumPlate = proposedGFA / (podiumStoreys + (1 - towerSetback) * towerStoreys)
    const towerPlate = podiumPlate * (1 - towerSetback)
    const podiumTop = podiumStoreys * storeyHeight
    tiers = [{ footprint: podiumPlate, base: 0, top: podiumTop }, { footprint: towerPlate, base: podiumTop, top: height }]
    footprint = podiumPlate // the larger, binding plate
  } else {
    footprint = proposedGFA / proposedStoreys
    tiers = [{ footprint, base: 0, top: height }]
  }
  const coverage = siteArea > 0 ? (footprint / siteArea) * 100 : 0
  const pFar = siteArea > 0 ? proposedGFA / siteArea : 0

  const EPS = 1e-6
  const c = {
    far: proposedGFA <= maxGFA + EPS,
    height: height <= maxHeight + EPS,
    coverage: footprint <= coverageCap + EPS,
    setback: footprint <= buildableArea + EPS,
  }
  return {
    siteArea,
    sitePerimeter,
    buildable,
    buildableArea,
    maxGFA,
    maxFootprint,
    maxHeight,
    envelopeVolume: maxFootprint * maxHeight,
    proposed: { footprint, height, coverage, far: pFar },
    tiers,
    compliance: { ...c, overall: c.far && c.height && c.coverage && c.setback },
    utilisation: maxGFA > 0 ? (proposedGFA / maxGFA) * 100 : 0,
  }
}

/** Parse a site boundary from GeoJSON (Feature/FeatureCollection/Geometry Polygon)
 *  or a bare ring of [x,y] pairs. Lon/lat rings are projected to local metres
 *  (equirectangular about the centroid); metre rings are used as-is. Returns the
 *  exterior ring as plan points, or null if nothing usable is found. */
export function parseGeoBoundary(text: string): Pt[] | null {
  let data: unknown
  try { data = JSON.parse(text) } catch { return null }

  const findRing = (obj: unknown): number[][] | null => {
    if (Array.isArray(obj)) {
      // a bare ring: [[x,y],[x,y],...]
      if (obj.length >= 3 && Array.isArray(obj[0]) && typeof (obj[0] as unknown[])[0] === 'number') return obj as number[][]
      return null
    }
    if (obj && typeof obj === 'object') {
      const o = obj as Record<string, unknown>
      if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
        for (const f of o.features) { const r = findRing(f); if (r) return r }
        return null
      }
      if (o.type === 'Feature') return findRing(o.geometry)
      if (o.type === 'Polygon' && Array.isArray(o.coordinates)) return (o.coordinates as number[][][])[0] ?? null
      if (o.type === 'MultiPolygon' && Array.isArray(o.coordinates)) return (o.coordinates as number[][][][])[0]?.[0] ?? null
      if (Array.isArray(o.coordinates)) return findRing(o.coordinates)
    }
    return null
  }

  const ring = findRing(data)
  if (!ring || ring.length < 3) return null
  // drop a duplicated closing vertex
  const r = ring.slice()
  const first = r[0], last = r[r.length - 1]
  if (first && last && first[0] === last[0] && first[1] === last[1]) r.pop()
  if (r.length < 3) return null

  const lonlat = r.every((c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90)
  if (lonlat) {
    const lon0 = r.reduce((s, c) => s + c[0], 0) / r.length
    const lat0 = r.reduce((s, c) => s + c[1], 0) / r.length
    const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180)
    return r.map((c) => ({ x: (c[0] - lon0) * mPerLon, z: (c[1] - lat0) * 110540 }))
  }
  return r.map((c) => ({ x: c[0], z: c[1] }))
}

/** A rectangular site boundary centred on the origin (handy default/preset). */
export function rectSite(width: number, depth: number): Pt[] {
  const w = width / 2, d = depth / 2
  return [{ x: -w, z: -d }, { x: w, z: -d }, { x: w, z: d }, { x: -w, z: d }]
}
