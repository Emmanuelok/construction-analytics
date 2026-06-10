/* FF&E — furnishings for every room, derived from its programmed use. Pure, unit-
 * tested, deterministic: offices get workstations (desk + pedestal + task chair),
 * meeting rooms a conference table with chairs around it, classrooms ranked desks
 * facing a teacher, residential gets bed/wardrobe/sofa, labs get benches, retail
 * shelving + a counter, storage racking, plant rooms equipment skids. Each item is
 * a few boxes in scene units (so the 3D viewer instances them cheaply), carries a
 * stable id (selectable) and a catalog cost — so the same engine that decorates the
 * model also prices the FF&E takeoff. Per-room floor tints (carpet/finish patches)
 * come from the same pass. No DOM, no Three.js. */

import type { BuildingModel } from './building'
import type { Pt } from './zoning'
import { PLATE_SCALE, SCENE_LEN_TO_M } from './massing'
import { spaceType } from './room-types'

const M = PLATE_SCALE // metres → scene (plan)
const LEN = SCENE_LEN_TO_M // scene → metres (plan)

export type FurniturePart = { x: number; y: number; z: number; w: number; h: number; d: number; color: string }
export type FurnitureItem = { id: string; roomId: string; level: number; kind: string; parts: FurniturePart[] }
export type RoomPatch = { id: string; roomId: string; level: number; polygon: Pt[]; y: number; color: string }
export type FfeLine = { kind: string; label: string; count: number; unitCost: number; cost: number }
export type FfeResult = {
  items: FurnitureItem[]
  patches: RoomPatch[]
  byKind: FfeLine[]
  byLevel: { level: number; items: number; cost: number }[]
  total: { items: number; cost: number }
}

export const FFE_CATALOG: Record<string, { label: string; cost: number }> = {
  desk: { label: 'Workstation desk', cost: 420 },
  chair: { label: 'Task / side chair', cost: 160 },
  'meeting-table': { label: 'Conference table', cost: 1450 },
  bed: { label: 'Bed + headboard', cost: 780 },
  wardrobe: { label: 'Wardrobe', cost: 520 },
  sofa: { label: 'Sofa', cost: 940 },
  shelf: { label: 'Retail shelving bay', cost: 310 },
  counter: { label: 'Service counter', cost: 760 },
  bench: { label: 'Lab bench (lm priced as unit)', cost: 680 },
  rack: { label: 'Storage rack bay', cost: 260 },
  'plant-unit': { label: 'Plant / AHU skid', cost: 9400 },
}

// Alternatives per kind — like swapping a family type in CAD. The first entry is
// the default and matches the base catalog rate; widthFactor stretches the drawn
// footprint so the swap is visible in 3D, not just in the budget.
export type FfeAlt = { id: string; label: string; cost: number; widthFactor?: number }
export const FFE_ALTERNATES: Record<string, FfeAlt[]> = {
  desk: [
    { id: 'standard', label: 'Standard 1400', cost: 420 },
    { id: 'sit-stand', label: 'Sit-stand electric', cost: 680 },
    { id: 'bench', label: 'Bench 1600 (shared spine)', cost: 360, widthFactor: 1.14 },
  ],
  chair: [
    { id: 'task', label: 'Task chair', cost: 160 },
    { id: 'ergonomic', label: 'Ergonomic mesh', cost: 420 },
    { id: 'stacking', label: 'Stacking side chair', cost: 95 },
  ],
  'meeting-table': [
    { id: 'board-8', label: 'Boardroom 8-seat', cost: 1450 },
    { id: 'board-12', label: 'Boardroom 12-seat', cost: 2100, widthFactor: 1.2 },
    { id: 'huddle', label: 'Huddle round', cost: 820, widthFactor: 0.7 },
  ],
  bed: [
    { id: 'double', label: 'Double', cost: 780 },
    { id: 'queen', label: 'Queen', cost: 920, widthFactor: 1.07 },
    { id: 'king', label: 'King', cost: 1100, widthFactor: 1.15 },
  ],
  wardrobe: [
    { id: 'hinged', label: 'Hinged 2-door', cost: 520 },
    { id: 'sliding', label: 'Sliding mirrored', cost: 740, widthFactor: 1.12 },
  ],
  sofa: [
    { id: 'two-seat', label: '2-seat', cost: 940 },
    { id: 'three-seat', label: '3-seat', cost: 1280, widthFactor: 1.25 },
  ],
  shelf: [
    { id: 'standard', label: 'Standard bay', cost: 310 },
    { id: 'heavy', label: 'Heavy-duty bay', cost: 460 },
  ],
  counter: [
    { id: 'laminate', label: 'Laminate', cost: 760 },
    { id: 'stone', label: 'Stone-top premium', cost: 1600 },
  ],
  bench: [
    { id: 'standard', label: 'Standard lab', cost: 680 },
    { id: 'fume', label: 'Fume-cupboard ready', cost: 1400 },
  ],
  rack: [
    { id: 'shelving', label: 'Boltless shelving', cost: 260 },
    { id: 'pallet', label: 'Pallet racking', cost: 520, widthFactor: 1.2 },
  ],
  'plant-unit': [
    { id: 'ahu', label: 'AHU skid', cost: 9400 },
    { id: 'chiller', label: 'Chiller package', cost: 16800, widthFactor: 1.15 },
  ],
}
export const ffeAlt = (kind: string, id?: string): FfeAlt => (FFE_ALTERNATES[kind] ?? []).find((a) => a.id === id) ?? (FFE_ALTERNATES[kind] ?? [{ id: 'standard', label: 'Standard', cost: FFE_CATALOG[kind]?.cost ?? 0 }])[0]

// 3D floor tints per use (carpet / finish tone — lighter than the plan tints)
export const FLOOR_TINT: Record<string, string> = {
  office: '#54719c', 'open-office': '#4d6890', meeting: '#73639f', lab: '#4f8f98',
  retail: '#995f80', residential: '#8a7a5c', classroom: '#5f8a64', storage: '#646c7a',
  plant: '#6f7464', circulation: '#5a6884',
}

// part colours
const C = { top: '#a07a4e', metal: '#3a4250', seat: '#41608a', timber: '#8a6f4a', bedding: '#a9b4d6', frame: '#5d6788', shelfc: '#5b6573', equip: '#7e8a74', counter: '#7a5d46' }

/** One furniture engine pass over every room. `storeyHeight` (m) sets vertical
 *  scale; `ffe` picks an alternate type per kind (cost + drawn footprint). */
export function furnitureFor(m: BuildingModel, opts: { storeyHeight?: number; ffe?: Record<string, string> } = {}): FfeResult {
  const sh = opts.storeyHeight ?? 3.6
  const altOf = (kind: string) => ffeAlt(kind, opts.ffe?.[kind])
  const storeys = m.counts.storeys
  const sceneSh = m.totalHeight / Math.max(1, storeys)
  const vFac = sceneSh / sh // scene per metre (vertical)
  const items: FurnitureItem[] = []
  const patches: RoomPatch[] = []

  for (const room of m.rooms) {
    if (room.level >= storeys) continue
    const slab = m.slabs.find((s) => (s.level ?? 0) === room.level)
    if (!slab) continue
    const floorY = slab.y + slab.thickness + 0.02 * vFac // on top of the floor finish
    const use = spaceType(room.use).id
    patches.push({ id: `pat-${room.id}`, roomId: room.id, level: room.level, polygon: room.polygon, y: floorY - 0.012 * vFac, color: FLOOR_TINT[use] ?? FLOOR_TINT.office })

    const xs = room.polygon.map((p) => p.x), zs = room.polygon.map((p) => p.z)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
    const inset = 0.55 * M
    const x0 = minX + inset, x1 = maxX - inset, z0 = minZ + inset, z1 = maxZ - inset
    const wIn = (x1 - x0) * LEN, dIn = (z1 - z0) * LEN // usable metres
    if (wIn < 1.6 || dIn < 1.6) continue
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
    let n = 0
    const part = (px: number, pz: number, wM: number, hM: number, dM: number, elevM: number, color: string): FurniturePart =>
      ({ x: px, z: pz, y: floorY + (elevM + hM / 2) * vFac, w: wM * M, h: hM * vFac, d: dM * M, color })
    const add = (kind: string, parts: FurniturePart[]) => {
      const wf = altOf(kind).widthFactor ?? 1
      items.push({ id: `fur-${room.id}-${n++}`, roomId: room.id, level: room.level, kind, parts: wf === 1 ? parts : parts.map((p) => ({ ...p, w: p.w * wf })) })
    }
    const workstation = (px: number, pz: number) => {
      add('desk', [part(px, pz, 1.4, 0.04, 0.7, 0.72, C.top), part(px + 0.45 * M, pz, 0.4, 0.6, 0.5, 0.08, C.metal)])
      add('chair', [part(px, pz + 0.62 * M, 0.46, 0.06, 0.46, 0.44, C.seat), part(px, pz + 0.82 * M, 0.46, 0.5, 0.07, 0.5, C.seat)])
    }

    if (use === 'office' || use === 'open-office') {
      const target = Math.max(1, Math.min(use === 'office' ? 8 : 16, Math.floor(room.area / (use === 'office' ? 9.3 : 6))))
      const nx = Math.max(1, Math.floor(wIn / 2.4)), nz = Math.max(1, Math.floor(dIn / 2.3))
      const count = Math.min(target, nx * nz)
      for (let i = 0; i < count; i++) {
        const gx = i % nx, gz = Math.floor(i / nx)
        workstation(x0 + (gx + 0.5) * ((x1 - x0) / nx), z0 + (gz + 0.42) * ((z1 - z0) / nz))
      }
    } else if (use === 'meeting') {
      const L = Math.min(Math.max(wIn - 1.7, 1.8), 4.4), W = Math.min(Math.max(dIn - 2.0, 0.9), 1.5)
      add('meeting-table', [part(cx, cz, L, 0.05, W, 0.71, C.top), part(cx - (L / 2 - 0.18) * M, cz, 0.08, 0.7, W * 0.8, 0, C.metal), part(cx + (L / 2 - 0.18) * M, cz, 0.08, 0.7, W * 0.8, 0, C.metal)])
      const perSide = Math.max(2, Math.min(5, Math.floor(L / 0.7)))
      for (let i = 0; i < perSide; i++) {
        const px = cx + (-(L / 2) + (i + 0.5) * (L / perSide)) * M
        for (const s of [-1, 1]) add('chair', [part(px, cz + s * (W / 2 + 0.42) * M, 0.46, 0.06, 0.46, 0.44, C.seat), part(px, cz + s * (W / 2 + 0.62) * M, 0.46, 0.5, 0.07, 0.5, C.seat)])
      }
    } else if (use === 'classroom') {
      const nx = Math.max(2, Math.min(5, Math.floor(wIn / 1.5))), nz = Math.max(2, Math.min(5, Math.floor((dIn - 1.6) / 1.3)))
      for (let i = 0; i < nx * nz; i++) {
        const gx = i % nx, gz = Math.floor(i / nx)
        const px = x0 + (gx + 0.5) * ((x1 - x0) / nx), pz = z0 + 1.6 * M + (gz + 0.4) * ((z1 - z0 - 1.6 * M) / nz)
        add('desk', [part(px, pz, 1.1, 0.04, 0.5, 0.72, C.top), part(px, pz, 0.08, 0.7, 0.45, 0, C.metal)])
        add('chair', [part(px, pz + 0.5 * M, 0.42, 0.06, 0.42, 0.43, C.seat), part(px, pz + 0.68 * M, 0.42, 0.45, 0.06, 0.49, C.seat)])
      }
      add('desk', [part(cx, z0 + 0.6 * M, 1.5, 0.05, 0.7, 0.73, C.timber), part(cx, z0 + 0.6 * M, 1.4, 0.68, 0.55, 0.02, C.metal)])
    } else if (use === 'residential') {
      add('bed', [part(x0 + 0.85 * M, cz - 0.4 * M, 1.5, 0.45, 2.0, 0, C.frame), part(x0 + 0.85 * M, cz - 0.4 * M, 1.45, 0.16, 1.9, 0.46, C.bedding), part(x0 + 0.85 * M, cz - (0.4 + 0.97) * M, 1.5, 0.85, 0.09, 0, C.timber)])
      add('wardrobe', [part(x1 - 0.4 * M, cz - 0.4 * M, 0.62, 2.05, 1.6, 0, C.timber)])
      add('sofa', [part(cx, z1 - 0.55 * M, 1.9, 0.42, 0.85, 0, C.seat), part(cx, z1 - 0.25 * M, 1.9, 0.45, 0.25, 0.42, C.seat)])
      add('desk', [part(cx, cz + 0.7 * M, 0.9, 0.05, 0.9, 0.71, C.timber)])
    } else if (use === 'lab') {
      for (const s of [-1, 1]) add('bench', [part(cx, cz + s * (dIn / 2 - 0.45) * M, Math.max(1.2, wIn - 0.5), 0.9, 0.75, 0, C.shelfc), part(cx, cz + s * (dIn / 2 - 0.45) * M, Math.max(1.2, wIn - 0.5), 0.05, 0.78, 0.9, C.top)])
      if (dIn > 4.4) add('bench', [part(cx, cz, Math.max(1.2, wIn - 1.6), 0.9, 0.8, 0, C.shelfc), part(cx, cz, Math.max(1.2, wIn - 1.6), 0.05, 0.84, 0.9, C.top)])
    } else if (use === 'retail') {
      add('counter', [part(cx, z0 + 0.5 * M, Math.min(2.2, wIn - 1), 0.95, 0.6, 0, C.counter)])
      const rows = Math.max(1, Math.min(4, Math.floor((dIn - 1.8) / 1.6)))
      for (let r = 0; r < rows; r++) add('shelf', [part(cx, z0 + (1.9 + (r + 0.5) * ((dIn - 1.9) / rows)) * M, Math.max(1.2, wIn - 1.2), 1.7, 0.45, 0, C.shelfc)])
    } else if (use === 'storage') {
      const rows = Math.max(1, Math.min(5, Math.floor(dIn / 1.5)))
      for (let r = 0; r < rows; r++) add('rack', [part(cx, z0 + (r + 0.5) * ((z1 - z0) / rows), Math.max(1.2, wIn - 0.6), 2.1, 0.6, 0, C.shelfc)])
    } else if (use === 'plant') {
      add('plant-unit', [part(cx - Math.min(1.1, wIn / 4) * M, cz, Math.min(2.4, wIn / 2), 1.6, Math.min(1.2, dIn / 2.4), 0, C.equip)])
      add('plant-unit', [part(cx + Math.min(1.2, wIn / 4) * M, cz + 0.3 * M, Math.min(1.3, wIn / 3), 1.1, Math.min(1.0, dIn / 3), 0, C.equip)])
    }
    // circulation: kept clear (it's the escape route)
  }

  const kindCount = new Map<string, number>()
  for (const it of items) kindCount.set(it.kind, (kindCount.get(it.kind) ?? 0) + 1)
  const byKind: FfeLine[] = [...kindCount.entries()].map(([kind, count]) => {
    const cat = FFE_CATALOG[kind] ?? { label: kind, cost: 0 }
    const alt = altOf(kind)
    return { kind, label: `${cat.label} — ${alt.label}`, count, unitCost: alt.cost, cost: count * alt.cost }
  }).sort((a, b) => b.cost - a.cost)
  const lvlMap = new Map<number, { items: number; cost: number }>()
  for (const it of items) {
    const cur = lvlMap.get(it.level) ?? { items: 0, cost: 0 }
    lvlMap.set(it.level, { items: cur.items + 1, cost: cur.cost + altOf(it.kind).cost })
  }
  const byLevel = [...lvlMap.entries()].map(([level, v]) => ({ level, ...v })).sort((a, b) => a.level - b.level)
  return { items, patches, byKind, byLevel, total: { items: items.length, cost: byKind.reduce((s, k) => s + k.cost, 0) } }
}

/** FF&E schedule CSV — by kind, then a per-level roll-up. */
export function ffeCsv(f: FfeResult): string {
  const head = 'Item,Count,Unit cost ($),Cost ($)'
  const rows = f.byKind.map((k) => `${k.label},${k.count},${k.unitCost},${k.cost}`)
  const lv = ['', 'LEVEL,Items,Cost ($)', ...f.byLevel.map((l) => `${l.level === 0 ? 'Ground' : `Level ${l.level}`},${l.items},${l.cost}`)]
  return [head, ...rows, `TOTAL,${f.total.items},,${f.total.cost}`, ...lv].join('\n')
}
