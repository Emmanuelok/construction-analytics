/* 3D model import stats — the data extracted from an uploaded mesh model
 * (glTF / GLB / OBJ / STL). The viewer traverses the loaded scene; this pure
 * module summarises the per-mesh parts into totals + a bounding box, and ships a
 * small sample model so the feature is demonstrable without a file. */

export type MeshPart = { name: string; triangles: number; vertices: number }

export type ModelStats = {
  meshes: number
  triangles: number
  vertices: number
  materials: number
  dimensions: { x: number; y: number; z: number } // bounding box size, model units
  parts: MeshPart[]
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

/** Summarise traversed mesh parts + material count + bbox size into totals. */
export function summarizeModel(parts: MeshPart[], materials: number, dims: { x: number; y: number; z: number }): ModelStats {
  return {
    meshes: parts.length,
    triangles: parts.reduce((s, p) => s + p.triangles, 0),
    vertices: parts.reduce((s, p) => s + p.vertices, 0),
    materials,
    dimensions: { x: r3(dims.x), y: r3(dims.y), z: r3(dims.z) },
    parts,
  }
}

// ── a bundled sample OBJ (a stepped massing) for the "Load sample" demo + tests ──
function emitBox(out: string[], offset: { n: number }, name: string, cx: number, cy: number, cz: number, w: number, h: number, d: number): void {
  out.push(`o ${name}`)
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy, y1 = cy + h, z0 = cz - d / 2, z1 = cz + d / 2
  const verts: [number, number, number][] = [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  ]
  for (const v of verts) out.push(`v ${v[0]} ${v[1]} ${v[2]}`)
  const b = offset.n // vertices already emitted (OBJ is 1-indexed, cumulative)
  const f = (a: number, c: number, e: number, g: number) => out.push(`f ${b + a} ${b + c} ${b + e} ${b + g}`)
  f(1, 2, 3, 4); f(5, 8, 7, 6); f(1, 5, 6, 2); f(2, 6, 7, 3); f(3, 7, 8, 4); f(4, 8, 5, 1)
  offset.n += 8
}

/** A small stepped-massing model (podium + two setback tiers) in OBJ text. */
export function sampleObj(): string {
  const out: string[] = ['# AEC Data & Intelligence Studio — sample massing']
  const offset = { n: 0 }
  emitBox(out, offset, 'podium', 0, 0, 0, 24, 8, 16)
  emitBox(out, offset, 'midblock', 0, 8, 0, 16, 18, 11)
  emitBox(out, offset, 'tower', 0, 26, 0, 10, 26, 8)
  return out.join('\n')
}
