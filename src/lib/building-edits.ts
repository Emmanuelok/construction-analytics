/* Direct-manipulation edits over a generated BuildingModel — pure, unit-tested.
 * An edit set records per-element moves, resizes and deletions plus any added
 * elements (keyed by the model's stable element ids); applyEdits() folds them into
 * a new model so the 3D view, plan and schedules all reflect the edits live. No
 * Three.js, no DOM. */

import type { BuildingModel, Box, Quad, Beam, Plate, Stair } from './building'
import type { Pt } from './zoning'
import { SCENE_LEN_TO_M } from './massing'
import { buildStair } from './building-stairs'

export type Vec3 = { x: number; y: number; z: number }
export type ElementEdit = { move?: Vec3; scale?: number; height?: number } // scale = section/size factor; height overrides h (or beam depth)
export type AddedColumn = { id: string; level: number; x: number; y: number; z: number; w: number; h: number; d: number }
export type AddedDoor = { id: string; level: number; a: Pt; b: Pt; y: number; h: number }
export type BuildingEdits = { deleted: string[]; edits: Record<string, ElementEdit>; added: AddedColumn[]; addedDoors: AddedDoor[]; addedStairs: Stair[] }

export const emptyEdits = (): BuildingEdits => ({ deleted: [], edits: {}, added: [], addedDoors: [], addedStairs: [] })
export const editCount = (e: BuildingEdits): number => e.deleted.length + Object.keys(e.edits).length + e.added.length + (e.addedDoors?.length ?? 0) + (e.addedStairs?.length ?? 0)

const mvPt = (p: Pt, mv?: Vec3): Pt => (mv ? { x: p.x + mv.x, z: p.z + mv.z } : p)

function editBox(c: Box, e?: ElementEdit): Box {
  if (!e) return c
  const s = e.scale ?? 1
  return { ...c, x: c.x + (e.move?.x ?? 0), y: c.y + (e.move?.y ?? 0), z: c.z + (e.move?.z ?? 0), w: c.w * s, d: c.d * s, h: e.height ?? c.h }
}
function editQuad(g: Quad, e?: ElementEdit): Quad {
  if (!e) return g
  const s = e.scale ?? 1
  const mid = { x: (g.a.x + g.b.x) / 2, z: (g.a.z + g.b.z) / 2 }
  const sa = { x: mid.x + (g.a.x - mid.x) * s, z: mid.z + (g.a.z - mid.z) * s }
  const sb = { x: mid.x + (g.b.x - mid.x) * s, z: mid.z + (g.b.z - mid.z) * s }
  return { ...g, a: mvPt(sa, e.move), b: mvPt(sb, e.move), y: g.y + (e.move?.y ?? 0), h: e.height ?? g.h }
}
function editBeam(b: Beam, e?: ElementEdit): Beam {
  if (!e) return b
  const s = e.scale ?? 1
  return { ...b, a: mvPt(b.a, e.move), b: mvPt(b.b, e.move), y: b.y + (e.move?.y ?? 0), depth: e.height ?? b.depth, width: b.width * s }
}
function editPlate(p: Plate, e?: ElementEdit): Plate {
  if (!e) return p
  return { ...p, polygon: p.polygon.map((q) => mvPt(q, e.move)), hole: p.hole?.map((q) => mvPt(q, e.move)), y: p.y + (e.move?.y ?? 0) }
}

/** Fold an edit set into a new building model. */
export function applyEdits(m: BuildingModel, ed: BuildingEdits): BuildingModel {
  const del = new Set(ed.deleted)
  const keep = <T extends { id?: string }>(arr: T[]) => arr.filter((x) => !x.id || !del.has(x.id))
  const columns: Box[] = keep(m.columns).map((c) => editBox(c, ed.edits[c.id ?? ''])).concat(
    ed.added.filter((a) => !del.has(a.id)).map((a) => ({ x: a.x, y: a.y, z: a.z, w: a.w, h: a.h, d: a.d, level: a.level, id: a.id })),
  )
  const beams = keep(m.beams).map((b) => editBeam(b, ed.edits[b.id ?? '']))
  const walls = keep(m.walls).map((g) => editQuad(g, ed.edits[g.id ?? '']))
  const glazing = keep(m.glazing).map((g) => editQuad(g, ed.edits[g.id ?? '']))
  const doors = keep(m.doors).map((g) => editQuad(g, ed.edits[g.id ?? '']))
  const mullions = keep(m.mullions).map((c) => editBox(c, ed.edits[c.id ?? '']))
  const partitions = keep(m.partitions).map((g) => editQuad(g, ed.edits[g.id ?? '']))
  const addedDoors: Quad[] = (ed.addedDoors ?? []).filter((a) => !del.has(a.id)).map((a) => editQuad({ a: a.a, b: a.b, y: a.y, h: a.h, level: a.level, id: a.id }, ed.edits[a.id]))
  const interiorDoors = keep(m.interiorDoors).map((g) => editQuad(g, ed.edits[g.id ?? ''])).concat(addedDoors)
  const stairs = keep(m.stairs).concat((ed.addedStairs ?? []).filter((s) => !del.has(s.id ?? ''))) // stairs can be added (a shaft) or deleted
  const slabs = keep(m.slabs).map((s) => editPlate(s, ed.edits[s.id ?? '']))
  const foundations = keep(m.foundations).map((c) => editBox(c, ed.edits[c.id ?? '']))
  const groundBeams = keep(m.groundBeams).map((b) => editBeam(b, ed.edits[b.id ?? '']))
  const ceilings = keep(m.ceilings).map((s) => editPlate(s, ed.edits[s.id ?? '']))
  const floorFinishes = keep(m.floorFinishes).map((s) => editPlate(s, ed.edits[s.id ?? '']))
  const parapets = keep(m.parapets).map((g) => editQuad(g, ed.edits[g.id ?? '']))
  const core = m.core && !del.has('core') ? editBox(m.core, ed.edits['core']) : null
  const roof = m.roof && !del.has('roof') ? editPlate(m.roof, ed.edits['roof']) : null
  return {
    slabs, columns, beams, walls, glazing, doors, mullions, partitions, interiorDoors, stairs,
    foundations, groundBeams, ceilings, floorFinishes, parapets, core, roof, rooms: m.rooms,
    totalHeight: m.totalHeight, footprint: m.footprint,
    counts: { storeys: m.counts.storeys, columns: columns.length, beams: beams.length, windows: glazing.length, doors: doors.length, walls: walls.length, mullions: mullions.length, partitions: partitions.length, interiorDoors: interiorDoors.length, stairs: stairs.length, foundations: foundations.length, groundBeams: groundBeams.length, ceilings: ceilings.length, finishes: floorFinishes.length, parapets: parapets.length, slabs: slabs.length, rooms: m.counts.rooms },
  }
}

/* ---- immutable edit-set operations (used by the editor UI) ---- */

/** Nudge an element by (dx,dy,dz) — accumulates with any prior move. */
export function nudge(ed: BuildingEdits, id: string, mv: Vec3): BuildingEdits {
  const cur = ed.edits[id] ?? {}
  const move = { x: (cur.move?.x ?? 0) + mv.x, y: (cur.move?.y ?? 0) + mv.y, z: (cur.move?.z ?? 0) + mv.z }
  return { ...ed, edits: { ...ed.edits, [id]: { ...cur, move } } }
}
/** Multiply an element's size factor (clamped). */
export function rescale(ed: BuildingEdits, id: string, factor: number): BuildingEdits {
  const cur = ed.edits[id] ?? {}
  const scale = Math.max(0.2, Math.min(5, (cur.scale ?? 1) * factor))
  return { ...ed, edits: { ...ed.edits, [id]: { ...cur, scale } } }
}
/** Delete an element (drops any pending edit; removes an added element outright; an
 *  added stair removes the whole shaft it belongs to). */
export function removeElement(ed: BuildingEdits, id: string): BuildingEdits {
  if (id.startsWith('add-stair-')) { const pre = id.replace(/-\d+$/, '') + '-'; return { ...ed, addedStairs: (ed.addedStairs ?? []).filter((s) => !(s.id ?? '').startsWith(pre)), edits: omit(ed.edits, id) } }
  if (id.startsWith('add-')) return { ...ed, added: ed.added.filter((a) => a.id !== id), addedDoors: (ed.addedDoors ?? []).filter((a) => a.id !== id), edits: omit(ed.edits, id) }
  return { ...ed, deleted: ed.deleted.includes(id) ? ed.deleted : [...ed.deleted, id], edits: omit(ed.edits, id) }
}
/** Add an egress stair shaft (a half-turn stair on every storey) at a plan point. */
export function addStairAt(ed: BuildingEdits, m: BuildingModel, x: number, z: number): BuildingEdits {
  const levels = [...new Set(m.slabs.map((s) => s.level ?? 0))].sort((a, b) => a - b)
  if (!levels.length) return ed
  const token = Math.random().toString(36).slice(2, 8)
  const box = { x, z, w: 2.6 / SCENE_LEN_TO_M, d: 4.8 / SCENE_LEN_TO_M } // ~2.6 × 4.8 m shaft
  const added: Stair[] = []
  for (const lvl of levels) {
    const ref = m.stairs.find((s) => s.level === lvl)
    let base: number, height: number
    if (ref) { base = ref.base; height = ref.top - ref.base }
    else { const slab = m.slabs.find((s) => (s.level ?? 0) === lvl); const next = m.slabs.find((s) => (s.level ?? 0) === lvl + 1); base = slab ? slab.y : lvl; height = slab && next ? next.y - slab.y : 1 }
    added.push(buildStair(box, { base, height, level: lvl }, 3.6, `add-stair-${token}-${lvl}`))
  }
  return { ...ed, addedStairs: [...(ed.addedStairs ?? []), ...added] }
}
/** Add an interior door onto the partition nearest a plan point (clamped to fit). */
export function addDoorAt(ed: BuildingEdits, m: BuildingModel, level: number, x: number, z: number): BuildingEdits {
  const parts = m.partitions.filter((p) => (p.level ?? 0) === level)
  if (!parts.length) return ed
  let best = parts[0], bestD = Infinity, bestT = 0.5
  for (const p of parts) {
    const dx = p.b.x - p.a.x, dz = p.b.z - p.a.z, L2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - p.a.x) * dx + (z - p.a.z) * dz) / L2))
    const d = Math.hypot(x - (p.a.x + dx * t), z - (p.a.z + dz * t))
    if (d < bestD) { bestD = d; best = p; bestT = t }
  }
  const dx = best.b.x - best.a.x, dz = best.b.z - best.a.z, L = Math.hypot(dx, dz) || 1
  const half = Math.min(0.9 / SCENE_LEN_TO_M / 2, L * 0.45) // 0.9 m leaf, clamped to the wall
  const t = Math.max(half / L, Math.min(1 - half / L, bestT))
  const cx = best.a.x + dx * t, cz = best.a.z + dz * t, ux = dx / L, uz = dz / L
  const id = `add-idoor-${level}-${Math.random().toString(36).slice(2, 8)}`
  return { ...ed, addedDoors: [...(ed.addedDoors ?? []), { id, level, a: { x: cx - ux * half, z: cz - uz * half }, b: { x: cx + ux * half, z: cz + uz * half }, y: best.y, h: best.h * 0.62 }] }
}
/** Add a column at a plan point on a level, copying the level's column profile. */
export function addColumnAt(ed: BuildingEdits, m: BuildingModel, level: number, x: number, z: number): BuildingEdits {
  const tmpl = m.columns.find((c) => c.level === level) ?? m.columns[0]
  if (!tmpl) return ed
  const id = `add-col-${level}-${Math.random().toString(36).slice(2, 8)}`
  return { ...ed, added: [...ed.added, { id, level, x, z, y: tmpl.y, w: tmpl.w, h: tmpl.h, d: tmpl.d }] }
}
/** Duplicate a column, offset slightly so it's visible. */
export function duplicateColumn(ed: BuildingEdits, m: BuildingModel, id: string): BuildingEdits {
  const src = m.columns.find((c) => c.id === id) ?? ed.added.find((a) => a.id === id)
  if (!src) return ed
  const lvl = src.level ?? 0
  return addColumnAt(ed, m, lvl, src.x + src.w * 1.5, src.z + src.w * 1.5)
}

function omit<T extends Record<string, unknown>>(o: T, k: string): T { const n = { ...o }; delete n[k]; return n }
