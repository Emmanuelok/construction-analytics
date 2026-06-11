/* Building services (MEP) — pure, unit-tested. Derives the services layer every
 * real building carries, room by room, with selectable types per system:
 * lighting (luminaires on a spacing grid → W/m² density), ventilation (supply
 * diffusers), fire protection (sprinkler heads + smoke detectors), small power
 * (socket outlets, counted per use) and per-floor sanitary clusters at the core.
 * Items are a few boxes in scene units (instanced by the viewer) with stable ids,
 * and the same pass prices the installation and builds the per-level schedule.
 * Spacings follow common design rules of thumb — indicative, not a design. */

import type { BuildingModel } from './building'
import { PLATE_SCALE } from './massing'
import { spaceType } from './room-types'

const M = PLATE_SCALE

export type SvcPart = { x: number; y: number; z: number; w: number; h: number; d: number; color: string }
export type SvcItem = { id: string; roomId: string; level: number; kind: string; system: 'lighting' | 'hvac' | 'fire' | 'sanitary'; parts: SvcPart[] }
export type SvcSelections = { luminaire?: string; diffuser?: string; sprinkler?: string; sanitary?: string }

export const SVC_TYPES: Record<string, { id: string; label: string; cost: number; watts?: number }[]> = {
  luminaire: [
    { id: 'led-panel', label: 'LED panel 600×600', cost: 145, watts: 32 },
    { id: 'linear', label: 'Linear pendant 1200', cost: 230, watts: 36 },
    { id: 'downlight', label: 'LED downlight', cost: 88, watts: 18 },
  ],
  diffuser: [
    { id: '4way', label: '4-way square diffuser', cost: 120 },
    { id: 'slot', label: 'Linear slot diffuser', cost: 185 },
    { id: 'swirl', label: 'Swirl diffuser', cost: 150 },
  ],
  sprinkler: [
    { id: 'pendent', label: 'Pendent head K80', cost: 64 },
    { id: 'concealed', label: 'Concealed head', cost: 92 },
    { id: 'sidewall', label: 'Sidewall head', cost: 78 },
  ],
  sanitary: [
    { id: 'standard', label: 'Standard WC + basin suite', cost: 2400 },
    { id: 'accessible', label: 'Accessible (DOC M) suite', cost: 3900 },
  ],
}
export const svcType = (kind: string, id?: string) => (SVC_TYPES[kind] ?? []).find((t) => t.id === id) ?? (SVC_TYPES[kind] ?? [{ id: 'none', label: '—', cost: 0 }])[0]

const DETECTOR_COST = 110
const SOCKET_COST = 38

export type SvcResult = {
  items: SvcItem[]
  byKind: { kind: string; label: string; count: number; unitCost: number; cost: number }[]
  schedule: { level: number; name: string; luminaires: number; diffusers: number; sprinklers: number; detectors: number; sockets: number; sanitary: number }[]
  totals: { items: number; cost: number; lightingWm2: number; sockets: number }
}

/** Derive the full services layer for a model. */
export function buildingServices(m: BuildingModel, opts: { storeyHeight?: number; types?: SvcSelections } = {}): SvcResult {
  const sh = opts.storeyHeight ?? 3.6
  const sel = opts.types ?? {}
  const storeys = m.counts.storeys
  const sceneSh = m.totalHeight / Math.max(1, storeys)
  const vFac = sceneSh / sh
  const lum = svcType('luminaire', sel.luminaire), dif = svcType('diffuser', sel.diffuser)
  const spr = svcType('sprinkler', sel.sprinkler), san = svcType('sanitary', sel.sanitary)

  const items: SvcItem[] = []
  const perLevel = new Map<number, { luminaires: number; diffusers: number; sprinklers: number; detectors: number; sockets: number; sanitary: number }>()
  const lvl = (i: number) => { let r = perLevel.get(i); if (!r) { r = { luminaires: 0, diffusers: 0, sprinklers: 0, detectors: 0, sockets: 0, sanitary: 0 }; perLevel.set(i, r) } return r }
  let n = 0
  let totalArea = 0

  for (const room of m.rooms) {
    if (room.level >= storeys) continue
    const slab = m.slabs.find((s) => (s.level ?? 0) === room.level)
    const ceil = m.ceilings.find((c) => (c.level ?? 0) === room.level)
    if (!slab) continue
    const ceilY = (ceil ? ceil.y : slab.y + sceneSh - 0.12 * vFac) - 0.02 * vFac
    totalArea += room.area
    const L = lvl(room.level)
    const use = spaceType(room.use).id
    const xs = room.polygon.map((p) => p.x), zs = room.polygon.map((p) => p.z)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs)
    const grid = (perM2: number, cap: number) => {
      const count = Math.max(1, Math.min(cap, Math.round(room.area / perM2)))
      const nx = Math.max(1, Math.round(Math.sqrt(count * ((x1 - x0) / Math.max(z1 - z0, 1e-6)))))
      const nz = Math.max(1, Math.ceil(count / nx))
      const pts: { x: number; z: number }[] = []
      for (let j = 0; j < nz && pts.length < count; j++) for (let i = 0; i < nx && pts.length < count; i++) {
        pts.push({ x: x0 + ((i + 0.5) / nx) * (x1 - x0), z: z0 + ((j + 0.5) / nz) * (z1 - z0) })
      }
      return pts
    }
    const push = (kind: string, system: SvcItem['system'], p: { x: number; z: number }, wM: number, hM: number, dM: number, color: string) =>
      items.push({ id: `svc-${room.id}-${n++}`, roomId: room.id, level: room.level, kind, system, parts: [{ x: p.x, z: p.z, y: ceilY - (hM / 2) * vFac, w: wM * M, h: hM * vFac, d: dM * M, color }] })

    // lighting @ ~1/12 m² (storage/plant sparser); diffusers @ ~1/16 m²; sprinklers @ ~1/12 m²
    const lit = use === 'storage' || use === 'plant' ? 24 : 12
    for (const p of grid(lit, 64)) { push('luminaire', 'lighting', p, lum.id === 'linear' ? 1.2 : 0.6, 0.06, lum.id === 'linear' ? 0.16 : 0.6, '#f1f5fb'); L.luminaires++ }
    for (const p of grid(16, 48)) { push('diffuser', 'hvac', p, 0.6, 0.1, 0.6, '#c4cfdb'); L.diffusers++ }
    for (const p of grid(12, 64)) { push('sprinkler', 'fire', p, 0.09, 0.12, 0.09, '#b3543e'); L.sprinklers++ }
    const det = room.area > 80 ? 2 : 1
    for (const p of grid(room.area / det + 1, det)) { push('detector', 'fire', p, 0.14, 0.05, 0.14, '#dde3ec'); L.detectors++ }
    // small power: counted (not drawn) — 4 per cellular office/meeting, 1 per 8 m² open/retail/class, 2 elsewhere
    L.sockets += use === 'office' || use === 'meeting' ? 4 : use === 'open-office' || use === 'retail' || use === 'classroom' ? Math.max(2, Math.round(room.area / 8)) : 2
  }

  // sanitary cluster per occupied floor, beside the core
  if (m.core) {
    for (let i = 0; i < storeys; i++) {
      const slab = m.slabs.find((s) => (s.level ?? 0) === i)
      if (!slab) continue
      const L = lvl(i)
      const bx = m.core.x + (m.core.w / 2) + 0.5 * M, bz = m.core.z
      const floorY = slab.y + slab.thickness
      const mk = (dx: number, wM: number, hM: number, dM: number, color: string, kind: string) =>
        items.push({ id: `svc-wc-${i}-${n++}`, roomId: `core-${i}`, level: i, kind, system: 'sanitary', parts: [{ x: bx + dx * M, z: bz, y: floorY + (hM / 2) * vFac, w: wM * M, h: hM * vFac, d: dM * M, color }] })
      mk(0, 0.42, 0.42, 0.65, '#e8ecf2', 'wc'); mk(0.7, 0.42, 0.42, 0.65, '#e8ecf2', 'wc')
      mk(1.5, 1.1, 0.85, 0.5, '#dce4ee', 'basin')
      L.sanitary += 1
    }
  }

  const sched = [...perLevel.entries()].map(([level, v]) => ({ level, name: level === 0 ? 'Ground' : `Level ${level}`, ...v })).sort((a, b) => a.level - b.level)
  const count = (k: string) => items.filter((it) => it.kind === k).length
  const sockets = sched.reduce((s, r) => s + r.sockets, 0)
  const byKind = [
    { kind: 'luminaire', label: lum.label, count: count('luminaire'), unitCost: lum.cost, cost: count('luminaire') * lum.cost },
    { kind: 'diffuser', label: dif.label, count: count('diffuser'), unitCost: dif.cost, cost: count('diffuser') * dif.cost },
    { kind: 'sprinkler', label: spr.label, count: count('sprinkler'), unitCost: spr.cost, cost: count('sprinkler') * spr.cost },
    { kind: 'detector', label: 'Smoke detector', count: count('detector'), unitCost: DETECTOR_COST, cost: count('detector') * DETECTOR_COST },
    { kind: 'socket', label: 'Twin socket outlet', count: sockets, unitCost: SOCKET_COST, cost: sockets * SOCKET_COST },
    { kind: 'sanitary', label: san.label, count: sched.reduce((s, r) => s + r.sanitary, 0), unitCost: san.cost, cost: sched.reduce((s, r) => s + r.sanitary, 0) * san.cost },
  ].filter((r) => r.count > 0)
  const lightingWm2 = totalArea > 0 ? Math.round(((count('luminaire') * (lum.watts ?? 30)) / totalArea) * 10) / 10 : 0
  return { items, byKind, schedule: sched, totals: { items: items.length, cost: byKind.reduce((s, r) => s + r.cost, 0), lightingWm2, sockets } }
}

/** MEP schedule CSV — by kind + per level. */
export function servicesCsv(s: SvcResult): string {
  const head = 'Item,Count,Unit cost ($),Cost ($)'
  const rows = s.byKind.map((k) => `${k.label},${k.count},${k.unitCost},${k.cost}`)
  const lv = ['', 'LEVEL,Luminaires,Diffusers,Sprinklers,Detectors,Sockets,Sanitary suites',
    ...s.schedule.map((r) => `${r.name},${r.luminaires},${r.diffusers},${r.sprinklers},${r.detectors},${r.sockets},${r.sanitary}`)]
  return [head, ...rows, `TOTAL,${s.totals.items + s.totals.sockets},,${s.totals.cost}`, ...lv].join('\n')
}
