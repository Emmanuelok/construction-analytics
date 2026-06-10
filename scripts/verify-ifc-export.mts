/* Round-trips the native IFC exporter through the web-ifc kernel (the same engine
 * Revit/Navisworks-class tools use): generate an IFC from a model, re-open it, and
 * confirm the spatial structure + typed products survive and the parametric
 * geometry tessellates. Run: npx tsx scripts/verify-ifc-export.mts */
import { buildBuilding } from '../src/lib/building.ts'
import { buildMassing } from '../src/lib/massing.ts'
import { toIfc } from '../src/lib/building-ifc.ts'
import { applyEdits, emptyEdits, removeElement } from '../src/lib/building-edits.ts'
import { extractGeometry } from '../src/lib/ifc-geometry.ts'

let failures = 0
const ok = (n: string, c: boolean, extra?: unknown) => { if (c) console.log(`✓ ${n}`); else { failures++; console.error(`✗ ${n}`, extra ?? '') } }

const model = buildBuilding(buildMassing({ gfa: 30_000, progress: 100, storeys: 4, shape: 'rect' }), { coreRatio: 0.16 })
const ifc = toIfc(model, { name: 'Roundtrip Tower' })

const { IfcAPI, IFCBUILDINGSTOREY, IFCCOLUMN, IFCSLAB, IFCWINDOW, IFCWALL, IFCBEAM, IFCSPACE, IFCSTAIR, IFCSTAIRFLIGHT, IFCRAILING, IFCDOOR, IFCFOOTING, IFCCOVERING } = await import('web-ifc')
const api = new IfcAPI()
await api.Init((p: string, prefix: string) => (p.endsWith('.wasm') ? `${process.cwd()}/node_modules/web-ifc/${p}` : prefix + p))
const mid = api.OpenModel(new TextEncoder().encode(ifc))
ok('web-ifc opens the generated IFC (valid model)', mid >= 0, { mid })

const n = (t: number) => { try { return api.GetLineIDsWithType(mid, t).size() } catch { return -1 } }
ok('storeys round-trip (4 IfcBuildingStorey)', n(IFCBUILDINGSTOREY) === 4, { storeys: n(IFCBUILDINGSTOREY) })
ok('interior rooms round-trip as IfcSpace', n(IFCSPACE) === model.rooms.length && model.rooms.length > 0, { spaces: n(IFCSPACE), rooms: model.rooms.length })
ok('stairs round-trip as half-turn IfcStair + IfcStairFlight + IfcRailing', n(IFCSTAIR) === model.stairs.length && model.stairs.length === 8 && n(IFCSTAIRFLIGHT) === model.stairs.length * 2 && n(IFCRAILING) === model.stairs.length * 2, { stair: n(IFCSTAIR), flight: n(IFCSTAIRFLIGHT), rail: n(IFCRAILING) })
ok('typed products round-trip (cols/slabs+landings/walls+partitions+parapets/windows/beams+ground/doors+interior)', n(IFCCOLUMN) === model.columns.length && n(IFCSLAB) === model.slabs.length + 1 + model.stairs.length && n(IFCWALL) === model.walls.length + model.partitions.length + model.parapets.length && n(IFCWINDOW) === model.glazing.length && n(IFCBEAM) === model.beams.length + model.groundBeams.length && n(IFCDOOR) === model.doors.length + model.interiorDoors.length,
  { col: n(IFCCOLUMN), slab: n(IFCSLAB), wall: n(IFCWALL), win: n(IFCWINDOW), beam: n(IFCBEAM), door: n(IFCDOOR) })
ok('substructure + finishes round-trip (IfcFooting + IfcCovering)', n(IFCFOOTING) === model.foundations.length && model.foundations.length > 0 && n(IFCCOVERING) === model.ceilings.length + model.floorFinishes.length, { footing: n(IFCFOOTING), covering: n(IFCCOVERING) })

let meshes = 0, tris = 0
api.StreamAllMeshes(mid, (mesh: { geometries: { size(): number; get(i: number): { geometryExpressID: number } } }) => {
  meshes++
  const g = mesh.geometries
  for (let i = 0; i < g.size(); i++) { const geo = api.GetGeometry(mid, g.get(i).geometryExpressID); tris += geo.GetIndexDataSize() / 3 }
})
ok('parametric geometry tessellates (meshes + triangles > 0)', meshes > 0 && tris > 0, { meshes, tris: Math.round(tris) })
api.CloseModel(mid)

// the importer reads our exported property sets back (full pset round-trip)
const geo = await extractGeometry(new TextEncoder().encode(ifc), { locateFile: (p: string, prefix: string) => (p.endsWith('.wasm') ? `${process.cwd()}/node_modules/web-ifc/${p}` : prefix + p) })
const propSets = Object.values(geo.props ?? {})
ok('extractGeometry reads the exported IfcPropertySets back', propSets.length > 0 && propSets.some((ps) => ps.some((p) => p.name === 'Reference' || p.name === 'Width' || p.name === 'Level')),
  { elementsWithProps: propSets.length, sample: propSets[0]?.slice(0, 3) })

// edits flow through the round-trip
const edited = toIfc(applyEdits(model, removeElement(emptyEdits(), model.columns[0].id!)), { name: 'Edited' })
const mid2 = api.OpenModel(new TextEncoder().encode(edited))
ok('edited model re-opens with one fewer IfcColumn', n2(api, mid2, IFCCOLUMN) === model.columns.length - 1)
api.CloseModel(mid2)

function n2(a: typeof api, m: number, t: number) { try { return a.GetLineIDsWithType(m, t).size() } catch { return -1 } }

console.log(failures ? `\n${failures} check(s) failed` : '\nall IFC round-trip checks passed')
process.exit(failures ? 1 : 0)
