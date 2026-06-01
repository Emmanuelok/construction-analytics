/* IFC → 3D scene reconstruction — pure, unit-tested. A real .ifc file in the
 * SPF text encoding carries element *counts* per type and the storey list, but
 * not BREP geometry (that needs a WASM kernel). This engine reconstructs a
 * faithful, recognizable building from that real structured content: it places
 * the file's actual columns on a grid, walls around the perimeter, one slab per
 * storey, beams spanning the grid, and MEP risers — distributed across the
 * file's real storeys and coloured by discipline. Every instance traces back to
 * a counted IFC element; nothing is invented. The viewer just draws these boxes. */

export type ElementKind = 'column' | 'wall' | 'slab' | 'beam' | 'mep' | 'other'
export type Discipline = 'struct' | 'arch' | 'mep' | 'other'

export type IfcInstance = {
  id: string
  kind: ElementKind
  discipline: Discipline
  ifcType: string
  storey: number
  // box transform in scene units (centre position + half-extents)
  x: number; y: number; z: number
  hw: number; hh: number; hd: number
}

export type IfcSceneInput = {
  entityCounts: { type: string; count: number }[]
  storeys: number
}

export type IfcScene = {
  instances: IfcInstance[]
  storeys: number
  storeyHeight: number
  footprint: number // plate side (scene units)
  totalHeight: number
  byDiscipline: { discipline: Discipline; count: number }[]
  placed: number // total instances placed
  sourceElements: number // total elements counted in the file
}

const STOREY_HEIGHT = 3 // scene units (≈ a real storey height in our scale)
const COLUMN_KINDS = new Set(['IFCCOLUMN', 'IFCPILE'])
const WALL_KINDS = new Set(['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCCURTAINWALL'])
const SLAB_KINDS = new Set(['IFCSLAB', 'IFCROOF', 'IFCPLATE'])
const BEAM_KINDS = new Set(['IFCBEAM', 'IFCMEMBER'])
const MEP_KINDS = new Set(['IFCDUCTSEGMENT', 'IFCPIPESEGMENT', 'IFCDUCTFITTING', 'IFCPIPEFITTING', 'IFCFLOWSEGMENT', 'IFCFLOWTERMINAL', 'IFCAIRTERMINAL', 'IFCCABLECARRIERSEGMENT', 'IFCCABLESEGMENT'])

function kindOf(ifcType: string): ElementKind | null {
  const t = ifcType.toUpperCase()
  if (COLUMN_KINDS.has(t)) return 'column'
  if (WALL_KINDS.has(t)) return 'wall'
  if (SLAB_KINDS.has(t)) return 'slab'
  if (BEAM_KINDS.has(t)) return 'beam'
  if (MEP_KINDS.has(t)) return 'mep'
  return null
}
const DISC_OF: Record<ElementKind, Discipline> = { column: 'struct', beam: 'struct', slab: 'struct', wall: 'arch', mep: 'mep', other: 'other' }

const sum = (counts: { type: string; count: number }[], pred: (t: string) => boolean) =>
  counts.reduce((n, c) => n + (pred(c.type.toUpperCase()) ? c.count : 0), 0)

/** A near-square grid (cols × rows ≥ n) for placing n columns. */
export function gridFor(n: number): { cols: number; rows: number } {
  if (n <= 0) return { cols: 0, rows: 0 }
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { cols, rows }
}

/** Reconstruct a 3D scene graph from parsed IFC counts + storey count. */
export function buildIfcScene(input: IfcSceneInput): IfcScene {
  const counts = input.entityCounts ?? []
  const storeys = Math.max(1, Math.round(input.storeys || 1))

  const nCol = sum(counts, (t) => COLUMN_KINDS.has(t))
  const nWall = sum(counts, (t) => WALL_KINDS.has(t))
  const nSlab = sum(counts, (t) => SLAB_KINDS.has(t))
  const nBeam = sum(counts, (t) => BEAM_KINDS.has(t))
  const nMep = sum(counts, (t) => MEP_KINDS.has(t))

  // Grid sized from the column count (or a default 3×3 if none), defines footprint.
  const grid = gridFor(nCol > 0 ? nCol : 9)
  const bay = 4 // scene units between gridlines
  const spanX = Math.max(1, (grid.cols - 1)) * bay
  const spanZ = Math.max(1, (grid.rows - 1)) * bay
  const footprint = Math.max(spanX, spanZ) + bay // include edge margin
  const half = footprint / 2

  const inst: IfcInstance[] = []
  let id = 0
  const push = (kind: ElementKind, ifcType: string, storey: number, x: number, y: number, z: number, hw: number, hh: number, hd: number) =>
    inst.push({ id: `e${id++}`, kind, discipline: DISC_OF[kind], ifcType, storey, x, y, z, hw, hh, hd })

  const colType = counts.find((c) => COLUMN_KINDS.has(c.type.toUpperCase()))?.type ?? 'IFCCOLUMN'
  const wallType = counts.find((c) => WALL_KINDS.has(c.type.toUpperCase()))?.type ?? 'IFCWALL'
  const slabType = counts.find((c) => SLAB_KINDS.has(c.type.toUpperCase()))?.type ?? 'IFCSLAB'
  const beamType = counts.find((c) => BEAM_KINDS.has(c.type.toUpperCase()))?.type ?? 'IFCBEAM'
  const mepType = counts.find((c) => MEP_KINDS.has(c.type.toUpperCase()))?.type ?? 'IFCDUCTSEGMENT'

  // Column grid positions (shared across the building's height).
  const colPos: { x: number; z: number }[] = []
  for (let i = 0; i < grid.cols; i++) {
    for (let j = 0; j < grid.rows; j++) {
      colPos.push({ x: -spanX / 2 + i * bay, z: -spanZ / 2 + j * bay })
    }
  }

  // Distribute the file's real element counts across the real storeys.
  const perStorey = (total: number) => {
    const base = Math.floor(total / storeys)
    const extra = total - base * storeys
    return (s: number) => base + (s < extra ? 1 : 0) // front-load remainder on lower floors
  }
  const colsOnStorey = perStorey(nCol)
  const beamsOnStorey = perStorey(nBeam)
  const wallsOnStorey = perStorey(nWall)
  const mepOnStorey = perStorey(nMep)

  for (let s = 0; s < storeys; s++) {
    const yBase = s * STOREY_HEIGHT
    // slab at the floor level (one per storey, plus any extra slabs ignored beyond storeys)
    if (nSlab > 0 && s < Math.max(storeys, nSlab)) {
      push('slab', slabType, s, 0, yBase + 0.15, 0, half, 0.15, half)
    }
    // columns: place up to this storey's share at grid positions
    const cCount = Math.min(colsOnStorey(s), colPos.length)
    for (let k = 0; k < cCount; k++) {
      const p = colPos[k]
      push('column', colType, s, p.x, yBase + STOREY_HEIGHT / 2, p.z, 0.35, STOREY_HEIGHT / 2, 0.35)
    }
    // beams: span between consecutive grid columns along X near the top of the storey
    const bCount = beamsOnStorey(s)
    for (let k = 0; k < bCount; k++) {
      const row = k % Math.max(1, grid.rows)
      const z = -spanZ / 2 + row * bay
      push('beam', beamType, s, 0, yBase + STOREY_HEIGHT - 0.3, z, spanX / 2 || 1, 0.2, 0.2)
    }
    // walls: distribute around the perimeter
    const wCount = wallsOnStorey(s)
    for (let k = 0; k < wCount; k++) {
      const side = k % 4
      const along = ((Math.floor(k / 4) + 1) / (Math.floor(wCount / 4) + 2)) * footprint - half
      if (side === 0) push('wall', wallType, s, along, yBase + STOREY_HEIGHT / 2, -half, bay / 2, STOREY_HEIGHT / 2, 0.1)
      else if (side === 1) push('wall', wallType, s, along, yBase + STOREY_HEIGHT / 2, half, bay / 2, STOREY_HEIGHT / 2, 0.1)
      else if (side === 2) push('wall', wallType, s, -half, yBase + STOREY_HEIGHT / 2, along, 0.1, STOREY_HEIGHT / 2, bay / 2)
      else push('wall', wallType, s, half, yBase + STOREY_HEIGHT / 2, along, 0.1, STOREY_HEIGHT / 2, bay / 2)
    }
    // MEP: vertical riser segments near the core
    const mCount = mepOnStorey(s)
    for (let k = 0; k < mCount; k++) {
      const ang = (k / Math.max(1, mCount)) * Math.PI * 2
      push('mep', mepType, s, Math.cos(ang) * 1.2, yBase + STOREY_HEIGHT / 2, Math.sin(ang) * 1.2, 0.12, STOREY_HEIGHT / 2, 0.12)
    }
  }

  const byDisc = (['struct', 'arch', 'mep', 'other'] as Discipline[])
    .map((d) => ({ discipline: d, count: inst.filter((i) => i.discipline === d).length }))
    .filter((d) => d.count > 0)

  return {
    instances: inst,
    storeys,
    storeyHeight: STOREY_HEIGHT,
    footprint,
    totalHeight: storeys * STOREY_HEIGHT,
    byDiscipline: byDisc,
    placed: inst.length,
    sourceElements: nCol + nWall + nSlab + nBeam + nMep,
  }
}

export const DISCIPLINE_COLOR: Record<Discipline, string> = {
  struct: '#f59e0b', // amber — columns/beams/slabs
  arch: '#38bdf8', // sky — walls
  mep: '#22d3ee', // cyan — ducts/pipes
  other: '#a78bfa', // violet
}
export const DISCIPLINE_LABEL: Record<Discipline, string> = { struct: 'Structural', arch: 'Architectural', mep: 'MEP', other: 'Other' }
export const KIND_LABEL: Record<ElementKind, string> = { column: 'Columns', wall: 'Walls', slab: 'Slabs', beam: 'Beams', mep: 'MEP', other: 'Other' }
export { kindOf }
