/* Real IFC geometry extraction via the web-ifc WASM kernel. Tessellates an
 * uploaded/sample .ifc into flat-array meshes (positions, normals, indices, a
 * placement matrix and an RGBA colour) the WebGL viewer can render directly.
 * Heavy + async, so it's dynamically imported only when the BIM 3D panel needs
 * it. Falls back gracefully: callers treat an empty mesh list (a coordination
 * IFC with no geometry, or a kernel failure) as "no geometry → reconstruct". */

import type { Discipline } from './ifc-model.ts'

export type IfcMesh = {
  expressID: number
  ifcType: number // web-ifc numeric type code
  ifcTypeName: string // e.g. "IFCCOLUMN" — for the inspector
  discipline: Discipline // mapped from ifcType, for consistent colouring/toggles
  positions: Float32Array // xyz triples (local geometry space)
  normals: Float32Array
  indices: Uint32Array
  matrix: number[] // 4x4 column-major placement (world = matrix · local)
  color: { r: number; g: number; b: number; a: number }
}

export type IfcGeometryResult = {
  meshes: IfcMesh[]
  vertexCount: number
  triangleCount: number
  bbox: { min: [number, number, number]; max: [number, number, number] } | null
}

/** How to locate the web-ifc WASM. In Node/tests pass `wasmPath` (a directory);
 *  in the browser pass `locateFile` returning the Vite-emitted asset URL — see
 *  ifc-wasm-url.ts. With neither, web-ifc uses its built-in default. */
export type ExtractOptions = {
  wasmPath?: string
  locateFile?: (path: string, prefix: string) => string
}

type TypeResolver = { disciplineOf: (code: number) => Discipline; nameOf: (code: number) => string }
let apiPromise: Promise<import('web-ifc').IfcAPI> | null = null
let typeResolverPromise: Promise<TypeResolver> | null = null

/** Lazily construct + init a single shared IfcAPI. On failure the cached promise
 *  is cleared so a later call (e.g. after a transient fetch error) can retry. */
function getApi(opts: ExtractOptions): Promise<import('web-ifc').IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const { IfcAPI } = await import('web-ifc')
      const api = new IfcAPI()
      if (opts.wasmPath) api.SetWasmPath(opts.wasmPath, true)
      await api.Init(opts.locateFile)
      return api
    })().catch((e) => { apiPromise = null; throw e })
  }
  return apiPromise
}

/** Map a web-ifc numeric type code → discipline (mirroring the reconstruction's
 *  classification so real geometry and reconstruction colour identically) and →
 *  a readable type name (e.g. "IFCCOLUMN") for the inspector. */
function getTypeResolver(): Promise<TypeResolver> {
  if (!typeResolverPromise) {
    typeResolverPromise = (async () => {
      const W = (await import('web-ifc')) as unknown as Record<string, unknown>
      // Reverse the package's IFC* numeric constants into code → name.
      const nameByCode = new Map<number, string>()
      for (const [k, v] of Object.entries(W)) {
        if (typeof v === 'number' && /^IFC[A-Z0-9]+$/.test(k) && !nameByCode.has(v)) nameByCode.set(v, k)
      }
      const set = (...names: string[]) => new Set(names.map((n) => W[n]).filter((v): v is number => typeof v === 'number'))
      const struct = set('IFCCOLUMN', 'IFCPILE', 'IFCBEAM', 'IFCMEMBER', 'IFCSLAB', 'IFCROOF', 'IFCPLATE', 'IFCFOOTING', 'IFCREINFORCINGBAR')
      const arch = set('IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCCURTAINWALL', 'IFCDOOR', 'IFCWINDOW', 'IFCSTAIR', 'IFCSTAIRFLIGHT', 'IFCRAILING', 'IFCRAMP', 'IFCCOVERING')
      const mep = set('IFCDUCTSEGMENT', 'IFCPIPESEGMENT', 'IFCDUCTFITTING', 'IFCPIPEFITTING', 'IFCFLOWSEGMENT', 'IFCFLOWTERMINAL', 'IFCAIRTERMINAL', 'IFCCABLECARRIERSEGMENT', 'IFCCABLESEGMENT')
      return {
        disciplineOf: (code: number): Discipline => (struct.has(code) ? 'struct' : arch.has(code) ? 'arch' : mep.has(code) ? 'mep' : 'other'),
        nameOf: (code: number): string => nameByCode.get(code) ?? `IFC#${code}`,
      }
    })()
  }
  return typeResolverPromise
}

/** Tessellate IFC bytes → meshes. Never throws; returns an empty result on any
 *  kernel/parse failure so the caller can fall back to the reconstruction. */
export async function extractGeometry(bytes: Uint8Array, opts: ExtractOptions = {}): Promise<IfcGeometryResult> {
  const empty: IfcGeometryResult = { meshes: [], vertexCount: 0, triangleCount: 0, bbox: null }
  let api: import('web-ifc').IfcAPI
  let resolver: TypeResolver
  try {
    api = await getApi(opts)
    resolver = await getTypeResolver()
  } catch {
    return empty
  }

  let modelID = -1
  try {
    modelID = api.OpenModel(bytes)
    const meshes: IfcMesh[] = []
    let vertexCount = 0
    let triangleCount = 0
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]

    api.StreamAllMeshes(modelID, (mesh) => {
      const g = mesh.geometries
      for (let i = 0; i < g.size(); i++) {
        const pg = g.get(i)
        const geo = api.GetGeometry(modelID, pg.geometryExpressID)
        const verts = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize()) // [x,y,z, nx,ny,nz, ...]
        const idx = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize())
        if (!verts.length || !idx.length) continue

        const n = verts.length / 6
        const positions = new Float32Array(n * 3)
        const normals = new Float32Array(n * 3)
        for (let v = 0; v < n; v++) {
          positions[v * 3] = verts[v * 6]
          positions[v * 3 + 1] = verts[v * 6 + 1]
          positions[v * 3 + 2] = verts[v * 6 + 2]
          normals[v * 3] = verts[v * 6 + 3]
          normals[v * 3 + 1] = verts[v * 6 + 4]
          normals[v * 3 + 2] = verts[v * 6 + 5]
        }
        const c = pg.color
        const ifcType = api.GetLineType(modelID, mesh.expressID)
        meshes.push({
          expressID: mesh.expressID,
          ifcType,
          ifcTypeName: resolver.nameOf(ifcType),
          discipline: resolver.disciplineOf(ifcType),
          positions,
          normals,
          indices: new Uint32Array(idx),
          matrix: Array.from(pg.flatTransformation as ArrayLike<number>),
          color: { r: c.x, g: c.y, b: c.z, a: c.w },
        })
        vertexCount += n
        triangleCount += idx.length / 3

        // bbox from placed positions (apply translation columns of the 4x4)
        const m = pg.flatTransformation as ArrayLike<number>
        for (let v = 0; v < n; v++) {
          const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2]
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
          const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
          const wz = m[2] * x + m[6] * y + m[10] * z + m[14]
          if (wx < min[0]) min[0] = wx; if (wy < min[1]) min[1] = wy; if (wz < min[2]) min[2] = wz
          if (wx > max[0]) max[0] = wx; if (wy > max[1]) max[1] = wy; if (wz > max[2]) max[2] = wz
        }
      }
    })

    return {
      meshes,
      vertexCount,
      triangleCount,
      bbox: meshes.length ? { min, max } : null,
    }
  } catch {
    return empty
  } finally {
    if (modelID >= 0) {
      try { api.CloseModel(modelID) } catch { /* ignore */ }
    }
  }
}
