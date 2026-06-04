/* Direct-manipulation edits over a generated BuildingModel — pure, unit-tested.
 * An edit set records per-element moves, resizes and deletions plus any added
 * elements (keyed by the model's stable element ids); applyEdits() folds them into
 * a new model so the 3D view, plan and schedules all reflect the edits live. No
 * Three.js, no DOM. */

import type { BuildingModel, Box, Quad, Beam, Plate } from './building'
import type { Pt } from './zoning'

export type Vec3 = { x: number; y: number; z: number }
export type ElementEdit = { move?: Vec3; scale?: number; height?: number } // scale = section/size factor; height overrides h (or beam depth)
export type AddedColumn = { id: string; level: number; x: number; y: number; z: number; w: number; h: number; d: number }
export type BuildingEdits = { deleted: string[]; edits: Record<string, ElementEdit>; added: AddedColumn[] }

export const emptyEdits = (): BuildingEdits => ({ deleted: [], edits: {}, added: [] })
export const editCount = (e: BuildingEdits): number => e.deleted.length + Object.keys(e.edits).length + e.added.length

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
  const slabs = keep(m.slabs).map((s) => editPlate(s, ed.edits[s.id ?? '']))
  const core = m.core && !del.has('core') ? editBox(m.core, ed.edits['core']) : null
  const roof = m.roof && !del.has('roof') ? editPlate(m.roof, ed.edits['roof']) : null
  return {
    slabs, columns, beams, walls, glazing, doors, mullions, core, roof,
    totalHeight: m.totalHeight, footprint: m.footprint,
    counts: { storeys: m.counts.storeys, columns: columns.length, beams: beams.length, windows: glazing.length, doors: doors.length, walls: walls.length, mullions: mullions.length, slabs: slabs.length },
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
/** Delete an element (drops any pending edit; removes an added element outright). */
export function removeElement(ed: BuildingEdits, id: string): BuildingEdits {
  if (id.startsWith('add-')) return { ...ed, added: ed.added.filter((a) => a.id !== id), edits: omit(ed.edits, id) }
  return { ...ed, deleted: ed.deleted.includes(id) ? ed.deleted : [...ed.deleted, id], edits: omit(ed.edits, id) }
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
