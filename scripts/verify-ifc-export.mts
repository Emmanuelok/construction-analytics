/* Round-trips the native IFC exporter through the web-ifc kernel (the same engine
 * Revit/Navisworks-class tools use): generate an IFC from a model, re-open it, and
 * confirm the spatial structure + typed products survive and the parametric
 * geometry tessellates. Run: npx tsx scripts/verify-ifc-export.mts */
import { buildBuilding } from '../src/lib/building.ts'
import { buildMassing } from '../src/lib/massing.ts'
import { toIfc } from '../src/lib/building-ifc.ts'
import { applyEdits, emptyEdits, removeElement } from '../src/lib/building-edits.ts'

let failures = 0
const ok = (n: string, c: boolean, extra?: unknown) => { if (c) console.log(`✓ ${n}`); else { failures++; console.error(`✗ ${n}`, extra ?? '') } }

const model = buildBuilding(buildMassing({ gfa: 30_000, progress: 100, storeys: 4, shape: 'rect' }), { coreRatio: 0.16 })
const ifc = toIfc(model, 'Roundtrip Tower')

const { IfcAPI, IFCBUILDINGSTOREY, IFCCOLUMN, IFCSLAB, IFCWINDOW, IFCWALL, IFCBEAM, IFCSPACE } = await import('web-ifc')
const api = new IfcAPI()
await api.Init((p: string, prefix: string) => (p.endsWith('.wasm') ? `${process.cwd()}/node_modules/web-ifc/${p}` : prefix + p))
const mid = api.OpenModel(new TextEncoder().encode(ifc))
ok('web-ifc opens the generated IFC (valid model)', mid >= 0, { mid })

const n = (t: number) => { try { return api.GetLineIDsWithType(mid, t).size() } catch { return -1 } }
ok('storeys round-trip (4 IfcBuildingStorey)', n(IFCBUILDINGSTOREY) === 4, { storeys: n(IFCBUILDINGSTOREY) })
ok('interior rooms round-trip as IfcSpace', n(IFCSPACE) === model.rooms.length && model.rooms.length > 0, { spaces: n(IFCSPACE), rooms: model.rooms.length })
ok('typed products round-trip (columns/slabs/walls/windows/beams)', n(IFCCOLUMN) === model.columns.length && n(IFCSLAB) === model.slabs.length + 1 && n(IFCWALL) === model.walls.length && n(IFCWINDOW) === model.glazing.length && n(IFCBEAM) === model.beams.length,
  { col: n(IFCCOLUMN), slab: n(IFCSLAB), wall: n(IFCWALL), win: n(IFCWINDOW), beam: n(IFCBEAM) })

let meshes = 0, tris = 0
api.StreamAllMeshes(mid, (mesh: { geometries: { size(): number; get(i: number): { geometryExpressID: number } } }) => {
  meshes++
  const g = mesh.geometries
  for (let i = 0; i < g.size(); i++) { const geo = api.GetGeometry(mid, g.get(i).geometryExpressID); tris += geo.GetIndexDataSize() / 3 }
})
ok('parametric geometry tessellates (meshes + triangles > 0)', meshes > 0 && tris > 0, { meshes, tris: Math.round(tris) })
api.CloseModel(mid)

// edits flow through the round-trip
const edited = toIfc(applyEdits(model, removeElement(emptyEdits(), model.columns[0].id!)), 'Edited')
const mid2 = api.OpenModel(new TextEncoder().encode(edited))
ok('edited model re-opens with one fewer IfcColumn', n2(api, mid2, IFCCOLUMN) === model.columns.length - 1)
api.CloseModel(mid2)

function n2(a: typeof api, m: number, t: number) { try { return a.GetLineIDsWithType(m, t).size() } catch { return -1 } }

console.log(failures ? `\n${failures} check(s) failed` : '\nall IFC round-trip checks passed')
process.exit(failures ? 1 : 0)
