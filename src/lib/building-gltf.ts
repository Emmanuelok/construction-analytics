/* Export a BuildingModel to glTF/GLB — builds a Three.js scene from the model
 * (geometry merged per trade) and serializes it with GLTFExporter, so the edited
 * building round-trips into Blender, Navisworks, three.js viewers, etc. Heavy +
 * browser-only (three + the exporter), so it's dynamically imported on demand. */

import type { BuildingModel, Quad, Beam, Plate } from './building'
import type * as THREE_NS from 'three'

const COLOR: Record<string, number> = { Slabs: 0xb8c2d0, Roof: 0xb8c2d0, Columns: 0x64748b, Beams: 0x566173, Walls: 0x9aa7b8, Windows: 0x7dd3fc, Doors: 0x1f2a3a, Mullions: 0x2b3647, Core: 0x475569 }

function plateGeo(T: typeof THREE_NS, p: Plate): THREE_NS.BufferGeometry {
  const shape = new T.Shape()
  p.polygon.forEach((q, i) => (i ? shape.lineTo(q.x, -q.z) : shape.moveTo(q.x, -q.z)))
  shape.closePath()
  if (p.hole && p.hole.length >= 3) { const h = new T.Path(); p.hole.forEach((q, i) => (i ? h.lineTo(q.x, -q.z) : h.moveTo(q.x, -q.z))); h.closePath(); shape.holes.push(h) }
  const g = new T.ExtrudeGeometry(shape, { depth: p.thickness, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, p.y, 0)
  return g
}
function boxGeo(T: typeof THREE_NS, c: { x: number; y: number; z: number; w: number; h: number; d: number }): THREE_NS.BufferGeometry {
  const g = new T.BoxGeometry(c.w, c.h, c.d); g.translate(c.x, c.y, c.z); return g
}
function orient(T: typeof THREE_NS, g: THREE_NS.BufferGeometry, a: { x: number; z: number }, b: { x: number; z: number }, cy: number) {
  const ex = new T.Vector3(b.x - a.x, 0, b.z - a.z); ex.normalize()
  const up = new T.Vector3(0, 1, 0), ez = new T.Vector3().crossVectors(ex, up).normalize()
  const m = new T.Matrix4().makeBasis(ex, up, ez); m.setPosition((a.x + b.x) / 2, cy, (a.z + b.z) / 2)
  g.applyMatrix4(m); return g
}
function quadGeo(T: typeof THREE_NS, q: Quad): THREE_NS.BufferGeometry {
  const L = Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) || 1
  return orient(T, new T.PlaneGeometry(L, q.h), q.a, q.b, q.y + q.h / 2)
}
function beamGeo(T: typeof THREE_NS, b: Beam): THREE_NS.BufferGeometry {
  const L = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z) || 1
  return orient(T, new T.BoxGeometry(L, b.depth, b.width), b.a, b.b, b.y)
}

/** Build a Three.js group from the model, geometry merged per trade. */
export async function modelToGroup(model: BuildingModel): Promise<THREE_NS.Group> {
  const T = await import('three')
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  const group = new T.Group(); group.name = 'Building'
  const add = (name: string, geos: THREE_NS.BufferGeometry[], opts: { transparent?: boolean; opacity?: number } = {}) => {
    if (!geos.length) return
    const merged = mergeGeometries(geos.map((g) => { const n = g.clone(); n.deleteAttribute('uv'); return n }), false)
    geos.forEach((g) => g.dispose())
    if (!merged) return
    const mat = new T.MeshStandardMaterial({ color: COLOR[name] ?? 0x94a3b8, roughness: 0.7, metalness: 0.1, transparent: opts.transparent, opacity: opts.opacity ?? 1, side: T.DoubleSide })
    const mesh = new T.Mesh(merged, mat); mesh.name = name; group.add(mesh)
  }
  add('Slabs', model.slabs.map((p) => plateGeo(T, p)))
  if (model.roof) add('Roof', [plateGeo(T, model.roof)])
  add('Columns', model.columns.map((c) => boxGeo(T, c)))
  add('Beams', model.beams.map((b) => beamGeo(T, b)))
  add('Walls', model.walls.map((q) => quadGeo(T, q)))
  add('Windows', model.glazing.map((q) => quadGeo(T, q)), { transparent: true, opacity: 0.5 })
  add('Doors', model.doors.map((q) => quadGeo(T, q)), { transparent: true, opacity: 0.85 })
  add('Mullions', model.mullions.map((c) => boxGeo(T, c)))
  if (model.core) add('Core', [boxGeo(T, model.core)])
  return group
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click()
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url) }, 0)
}

/** Export the model as a binary glTF (.glb) download. */
export async function exportGlb(model: BuildingModel, filename: string): Promise<void> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const group = await modelToGroup(model)
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(group, { binary: true })
  download(filename, new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }))
  group.traverse((o) => { const m = o as THREE_NS.Mesh; if (m.geometry) m.geometry.dispose() })
}
