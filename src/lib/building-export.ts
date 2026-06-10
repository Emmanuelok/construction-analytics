/* Export a BuildingModel to a Wavefront OBJ — pure, unit-tested. Every part
 * (slabs, columns, beams, walls, windows, doors, mullions, core) becomes grouped
 * geometry (OBJ `g` groups), so the edited building round-trips into Blender,
 * Navisworks, Revit (via import) and other tools. Y is up; coordinates are scene
 * units (metres after the viewer's plan scale). No Three.js, no DOM. */

import type { BuildingModel, Quad, Beam, Plate, Box } from './building'

const r = (n: number) => Math.round(n * 1000) / 1000

type Mesh = { verts: [number, number, number][]; faces: { g: string; t: [number, number, number] }[] }

function quad(m: Mesh, i0: number, i1: number, i2: number, i3: number, g: string) {
  m.faces.push({ g, t: [i0, i1, i2] }, { g, t: [i0, i2, i3] })
}
const addV = (m: Mesh, x: number, y: number, z: number) => (m.verts.push([x, y, z]), m.verts.length - 1)

/** Axis-aligned box (columns, mullions, core). */
function emitBox(m: Mesh, c: Box, g: string) {
  const hw = c.w / 2, hh = c.h / 2, hd = c.d / 2
  const v = [
    addV(m, c.x - hw, c.y - hh, c.z - hd), addV(m, c.x + hw, c.y - hh, c.z - hd), addV(m, c.x + hw, c.y - hh, c.z + hd), addV(m, c.x - hw, c.y - hh, c.z + hd),
    addV(m, c.x - hw, c.y + hh, c.z - hd), addV(m, c.x + hw, c.y + hh, c.z - hd), addV(m, c.x + hw, c.y + hh, c.z + hd), addV(m, c.x - hw, c.y + hh, c.z + hd),
  ]
  quad(m, v[0], v[3], v[2], v[1], g) // bottom
  quad(m, v[4], v[5], v[6], v[7], g) // top
  quad(m, v[0], v[1], v[5], v[4], g); quad(m, v[1], v[2], v[6], v[5], g); quad(m, v[2], v[3], v[7], v[6], g); quad(m, v[3], v[0], v[4], v[7], g) // sides
}

/** Horizontal beam along edge a→b (cross-section depth×width). */
function emitBeam(m: Mesh, b: Beam, g: string) {
  const dx = b.b.x - b.a.x, dz = b.b.z - b.a.z, L = Math.hypot(dx, dz) || 1
  const nx = dz / L, nz = -dx / L // horizontal normal to the edge
  const hw = b.width / 2, hh = b.depth / 2
  const corner: [number, number, number][] = []
  for (const t of [b.a, b.b]) for (const sy of [-hh, hh]) for (const sn of [-hw, hw]) corner.push([t.x + nx * sn, b.y + sy, t.z + nz * sn])
  // order: 0 a-bot-n 1 a-bot+n 2 a-top-n 3 a-top+n 4 b-bot-n 5 b-bot+n 6 b-top-n 7 b-top+n
  const v = corner.map((p) => addV(m, p[0], p[1], p[2]))
  quad(m, v[0], v[1], v[3], v[2], g) // end A
  quad(m, v[4], v[6], v[7], v[5], g) // end B
  quad(m, v[0], v[4], v[5], v[1], g) // bottom
  quad(m, v[2], v[3], v[7], v[6], g) // top
  quad(m, v[0], v[2], v[6], v[4], g) // -normal side
  quad(m, v[1], v[5], v[7], v[3], g) // +normal side
}

/** Vertical panel along edge a→b (windows, walls, doors). */
function emitQuad(m: Mesh, p: Quad, g: string) {
  const v0 = addV(m, p.a.x, p.y, p.a.z), v1 = addV(m, p.b.x, p.y, p.b.z), v2 = addV(m, p.b.x, p.y + p.h, p.b.z), v3 = addV(m, p.a.x, p.y + p.h, p.a.z)
  quad(m, v0, v1, v2, v3, g)
}

/** Slab/roof — a solid plate (centroid-fan top & bottom + side walls). */
function emitPlate(m: Mesh, p: Plate, g: string) {
  const poly = p.polygon
  if (poly.length < 3) return
  const cx = poly.reduce((s, q) => s + q.x, 0) / poly.length, cz = poly.reduce((s, q) => s + q.z, 0) / poly.length
  const yb = p.y, yt = p.y + p.thickness
  const cb = addV(m, cx, yb, cz), ct = addV(m, cx, yt, cz)
  const bot: number[] = [], top: number[] = []
  for (const q of poly) { bot.push(addV(m, q.x, yb, q.z)); top.push(addV(m, q.x, yt, q.z)) }
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    m.faces.push({ g, t: [cb, bot[j], bot[i]] }) // bottom fan
    m.faces.push({ g, t: [ct, top[i], top[j]] }) // top fan
    quad(m, bot[i], bot[j], top[j], top[i], g) // side
  }
}

/** Serialize a building model to OBJ text. */
export function toObj(m: BuildingModel, name = 'building'): string {
  const mesh: Mesh = { verts: [], faces: [] }
  for (const s of m.slabs) emitPlate(mesh, s, 'Slabs')
  if (m.roof) emitPlate(mesh, m.roof, 'Roof')
  for (const c of m.columns) emitBox(mesh, c, 'Columns')
  for (const b of m.beams) emitBeam(mesh, b, 'Beams')
  for (const w of m.walls) emitQuad(mesh, w, 'Walls')
  for (const w of m.partitions) emitQuad(mesh, w, 'Partitions')
  for (const w of m.glazing) emitQuad(mesh, w, 'Windows')
  for (const d of m.doors) emitQuad(mesh, d, 'Doors')
  for (const d of m.interiorDoors) emitQuad(mesh, d, 'InteriorDoors')
  for (const c of m.mullions) emitBox(mesh, c, 'Mullions')
  for (const s of m.stairs) for (const t of [...s.treads, ...s.landings, ...s.rails]) emitBox(mesh, t, 'Stairs')
  for (const c of m.foundations) emitBox(mesh, c, 'Foundations')
  for (const b of m.groundBeams) emitBeam(mesh, b, 'GroundBeams')
  for (const p of m.ceilings) emitPlate(mesh, p, 'Ceilings')
  for (const p of m.floorFinishes) emitPlate(mesh, p, 'Finishes')
  for (const w of m.parapets) emitQuad(mesh, w, 'Parapets')
  if (m.core) emitBox(mesh, m.core, 'Core')

  const out: string[] = [`# ${name} — exported from AEC Data & Intelligence Studio`, `# ${m.counts.storeys} storeys · ${mesh.verts.length} vertices · ${mesh.faces.length} triangles`, `o ${name}`]
  for (const v of mesh.verts) out.push(`v ${r(v[0])} ${r(v[1])} ${r(v[2])}`)
  // group faces (1-indexed) so each trade is a selectable object in the importer
  const byGroup = new Map<string, [number, number, number][]>()
  for (const f of mesh.faces) { const a = byGroup.get(f.g) ?? []; if (!byGroup.has(f.g)) byGroup.set(f.g, a); a.push(f.t) }
  for (const [g, tris] of byGroup) { out.push(`g ${g}`); for (const t of tris) out.push(`f ${t[0] + 1} ${t[1] + 1} ${t[2] + 1}`) }
  return out.join('\n') + '\n'
}

/** Quick integrity stats for an OBJ string (used in tests). */
export function objStats(obj: string): { verts: number; faces: number; groups: string[]; maxIndex: number } {
  const verts = (obj.match(/^v /gm) || []).length
  const groups = [...obj.matchAll(/^g (.+)$/gm)].map((x) => x[1])
  const faceLines = obj.match(/^f .+$/gm) || []
  let maxIndex = 0
  for (const f of faceLines) for (const tok of f.slice(2).split(/\s+/)) { const i = parseInt(tok, 10); if (i > maxIndex) maxIndex = i }
  return { verts, faces: faceLines.length, groups, maxIndex }
}
