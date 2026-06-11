/* Geometric clash detection on real tessellated IFC meshes — pure, unit-tested.
 * Every element's world AABB comes from its actual vertices × placement matrix;
 * pairs that overlap by more than a tolerance are clashes, with the penetration
 * box, its volume and a severity from the depth. By-design intersections are
 * suppressed (a window sits IN its wall, a railing ON its stair, finishes ON
 * slabs, the core THROUGH the plates…), so what's left is genuine coordination
 * risk: structure through architecture, element through element. The summary
 * groups by discipline pair, ready to drive the coordination workbench with
 * measured numbers instead of estimates. No DOM, no Three.js. */

export type ClashBox = {
  id: number // expressID
  type: string // IFCCOLUMN, IFCWALL, …
  discipline: string // struct | arch | mep | other
  min: [number, number, number]
  max: [number, number, number]
}

/** World AABB per mesh: transform each vertex by the 4×4 column-major matrix. */
export function meshBoxes(meshes: { expressID?: number; ifcTypeName?: string; discipline: string; positions: Float32Array; matrix: number[] }[]): ClashBox[] {
  const out: ClashBox[] = []
  for (const m of meshes) {
    const p = m.positions, M = m.matrix
    if (!p.length || M.length !== 16) continue
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2]
      const wx = M[0] * x + M[4] * y + M[8] * z + M[12]
      const wy = M[1] * x + M[5] * y + M[9] * z + M[13]
      const wz = M[2] * x + M[6] * y + M[10] * z + M[14]
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz
    }
    out.push({ id: m.expressID ?? -1, type: (m.ifcTypeName ?? 'IFC?').toUpperCase(), discipline: m.discipline, min: [minX, minY, minZ], max: [maxX, maxY, maxZ] })
  }
  return out
}

const baseType = (t: string) => t.replace(/^IFC/, '').replace(/STANDARDCASE$/, '').replace(/ELEMENTPROXY$/, 'PROXY')
// intersections that are how buildings are MEANT to fit together — not clashes
const BY_DESIGN: [RegExp, RegExp][] = [
  [/^WINDOW$/, /^WALL$/], [/^DOOR$/, /^WALL$/], // openings live in walls
  [/^COVERING$/, /./], // finishes are a dressing layer — they wash whatever they meet
  [/^RAILING$/, /^STAIR(FLIGHT)?$/], [/^RAILING$/, /^SLAB$/], [/^STAIR(FLIGHT)?$/, /^SLAB$/], // stairs land on slabs
  [/^BUILDINGPROXY$/, /./], [/^PROXY$/, /./], // the core proxy passes through the plates by design
  [/^FOOTING$/, /^(COLUMN|BEAM|SLAB|WALL)$/], // columns bear onto footings
  [/^(COLUMN|WALL|DOOR|WINDOW)$/, /^SLAB$/], [/^BEAM$/, /^(SLAB|COLUMN|WALL|BEAM)$/], // bearing seats + corner laps
  [/^COLUMN$/, /^WALL$/], // façade columns are embedded in the wall line by design
  [/^WALL$/, /^WALL$/], [/^DOOR$/, /^DOOR$/], // junctions between runs are corner laps
]
const byDesign = (a: string, b: string) => {
  const A = baseType(a), B = baseType(b)
  return BY_DESIGN.some(([x, y]) => (x.test(A) && y.test(B)) || (x.test(B) && y.test(A)))
}

export type GeoClash = {
  a: ClashBox; b: ClashBox
  overlap: [number, number, number] // penetration extents (m)
  volume: number // m³ of the penetration box
  depth: number // smallest penetration dimension (m)
  center: [number, number, number]
  severity: 'Minor' | 'Major' | 'Critical'
}
export type GeoClashResult = {
  clashes: GeoClash[]
  pairs: { a: string; b: string; count: number; worst: number }[] // by discipline pair
  checked: number
  suppressed: number
  headline: string
}

/** AABB clash pass with by-design suppression. `tol` (m) ignores grazing contact. */
export function detectClashes(boxes: ClashBox[], opts: { tol?: number } = {}): GeoClashResult {
  const tol = opts.tol ?? 0.015 // 15 mm: touching ≠ clashing
  const clashes: GeoClash[] = []
  let checked = 0, suppressed = 0
  // sweep on X to keep it near-linear for building-sized sets
  const order = boxes.map((b, i) => i).sort((i, j) => boxes[i].min[0] - boxes[j].min[0])
  for (let oi = 0; oi < order.length; oi++) {
    const A = boxes[order[oi]]
    for (let oj = oi + 1; oj < order.length; oj++) {
      const B = boxes[order[oj]]
      if (B.min[0] > A.max[0] - tol) break // no further X overlap possible
      checked++
      const ox = Math.min(A.max[0], B.max[0]) - Math.max(A.min[0], B.min[0])
      const oy = Math.min(A.max[1], B.max[1]) - Math.max(A.min[1], B.min[1])
      const oz = Math.min(A.max[2], B.max[2]) - Math.max(A.min[2], B.min[2])
      if (ox <= tol || oy <= tol || oz <= tol) continue
      if (byDesign(A.type, B.type)) { suppressed++; continue }
      const depth = Math.min(ox, oy, oz)
      const volume = ox * oy * oz
      const severity: GeoClash['severity'] = depth > 0.25 || volume > 0.5 ? 'Critical' : depth > 0.08 || volume > 0.05 ? 'Major' : 'Minor'
      clashes.push({
        a: A, b: B, overlap: [ox, oy, oz], volume: Math.round(volume * 1000) / 1000, depth: Math.round(depth * 1000) / 1000,
        center: [(Math.max(A.min[0], B.min[0]) + Math.min(A.max[0], B.max[0])) / 2, (Math.max(A.min[1], B.min[1]) + Math.min(A.max[1], B.max[1])) / 2, (Math.max(A.min[2], B.min[2]) + Math.min(A.max[2], B.max[2])) / 2],
        severity,
      })
    }
  }
  clashes.sort((x, y) => y.volume - x.volume)
  const pairMap = new Map<string, { a: string; b: string; count: number; worst: number }>()
  for (const c of clashes) {
    const [a, b] = [c.a.discipline, c.b.discipline].sort()
    const k = `${a}|${b}`
    const cur = pairMap.get(k) ?? { a, b, count: 0, worst: 0 }
    cur.count++; cur.worst = Math.max(cur.worst, c.volume)
    pairMap.set(k, cur)
  }
  const pairs = [...pairMap.values()].sort((x, y) => y.count - x.count)
  const headline = clashes.length === 0
    ? `Geometry coordinated — ${boxes.length} elements checked, no real clashes (by-design fits suppressed: ${suppressed}).`
    : `${clashes.length} geometric clash${clashes.length > 1 ? 'es' : ''} found across ${pairs.length} discipline pair${pairs.length > 1 ? 's' : ''}; worst penetration ${clashes[0].depth} m.`
  return { clashes, pairs, checked, suppressed, headline }
}

/** Per-class takeoff from the same world boxes: count + bounding volume (m³). */
export function geometryTakeoff(boxes: ClashBox[]): { type: string; label: string; count: number; volume: number }[] {
  const label = (t: string) => baseType(t).charAt(0) + baseType(t).slice(1).toLowerCase().replace('flight', ' flight')
  const map = new Map<string, { count: number; volume: number }>()
  for (const b of boxes) {
    const v = (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2])
    const cur = map.get(b.type) ?? { count: 0, volume: 0 }
    cur.count++; cur.volume += v
    map.set(b.type, cur)
  }
  return [...map.entries()].map(([type, v]) => ({ type, label: label(type), count: v.count, volume: Math.round(v.volume * 10) / 10 })).sort((a, b) => b.count - a.count)
}

/** Clash list CSV. */
export function clashCsv(r: GeoClashResult): string {
  const head = 'Element A,Type A,Element B,Type B,Severity,Penetration (m),Volume (m³),X,Y,Z'
  const rows = r.clashes.map((c) => `#${c.a.id},${c.a.type},#${c.b.id},${c.b.type},${c.severity},${c.depth},${c.volume},${c.center.map((v) => v.toFixed(2)).join(',')}`)
  return [head, ...rows, `TOTAL,${r.clashes.length} clashes,checked ${r.checked},suppressed ${r.suppressed},,,,,,`].join('\n')
}
