/* A bundled IFC4 sample WITH real swept-solid geometry, so BIM Intelligence can
 * demonstrate true web-ifc tessellation (not just the structural reconstruction).
 * Each element is a properly-linked IfcProductDefinitionShape → IfcShapeRepresentation
 * → IfcExtrudedAreaSolid, which web-ifc meshes into vertices/indices. A compact
 * multi-storey frame: columns, floor slabs and perimeter walls per level. */

/** Format a number as a valid IFC REAL (must contain a '.'): 3.5 → "3.5",
 *  -6 → "-6.", 0 → "0.". Appending a bare '.' to a float ("3.5.") is invalid. */
function r(n: number): string {
  return Number.isInteger(n) ? `${n}.` : `${n}`
}

function build(): string {
  const L: string[] = []
  let id = 1
  const add = (s: string): number => { const cur = id; L.push(`#${id}=${s};`); id++; return cur }

  L.push(
    'ISO-10303-21;', 'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    "FILE_NAME('MeridianTower-Geometry.ifc','2026-05-20T09:14:00',('AEC Studio'),('AEC Data & Intelligence Studio'),'IFC4','Studio Geometry Generator','');",
    "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;',
  )

  const origin = add('IFCCARTESIANPOINT((0.,0.,0.))')
  const zDir = add('IFCDIRECTION((0.,0.,1.))')
  const xDir = add('IFCDIRECTION((1.,0.,0.))')
  const axis = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zDir},#${xDir})`)
  const ctx = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#${axis},$)`)
  // The project MUST reference its units + representation contexts. Without this
  // web-ifc reads past the parsed attributes ("expected REF 1") and, above ~11
  // elements, segfaults the WASM kernel ("memory access out of bounds").
  const lenUnit = add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')
  const areaUnit = add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')
  const volUnit = add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')
  const units = add(`IFCUNITASSIGNMENT((#${lenUnit},#${areaUnit},#${volUnit}))`)
  const project = add(`IFCPROJECT('1Meridian00000000000001',$,'Meridian Tower',$,$,$,$,(#${ctx}),#${units})`)
  // full spatial structure: project → site → building → storeys, so the file
  // organises by level in any receiving tool (and passes the model-health audit)
  const site = add(`IFCSITE('1MeridianSite0000000001',$,'Meridian Plaza',$,$,$,$,$,.ELEMENT.,$,$,$,$,$)`)
  const bldg = add(`IFCBUILDING('1MeridianBldg0000000001',$,'Meridian Tower',$,$,$,$,$,.ELEMENT.,$,$,$)`)

  // An axis-aligned box, centred at plan (cx,cy), rising from elevation z0 by
  // height h. IFC is Z-up: the W×D profile lies in the XY (plan) plane and is
  // extruded along +Z, so storeys stack in Z and the result is a real building.
  const boxShape = (cx: number, cy: number, z0: number, w: number, d: number, h: number): number => {
    const p = add(`IFCCARTESIANPOINT((${r(cx)},${r(cy)},${r(z0)}))`)
    const lp = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${xDir})`)
    const a = add(`IFCCARTESIANPOINT((${r(-w / 2)},${r(-d / 2)}))`)
    const b = add(`IFCCARTESIANPOINT((${r(w / 2)},${r(-d / 2)}))`)
    const c = add(`IFCCARTESIANPOINT((${r(w / 2)},${r(d / 2)}))`)
    const e = add(`IFCCARTESIANPOINT((${r(-w / 2)},${r(d / 2)}))`)
    const poly = add(`IFCPOLYLINE((#${a},#${b},#${c},#${e},#${a}))`)
    const prof = add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#${poly})`)
    const sol = add(`IFCEXTRUDEDAREASOLID(#${prof},#${lp},#${zDir},${r(h)})`)
    const rep = add(`IFCSHAPEREPRESENTATION(#${ctx},'Body','SweptSolid',(#${sol}))`)
    return add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${rep}))`)
  }

  let g = 0
  const guid = () => `'${(g++).toString(36).padStart(22, '0')}'`

  const STOREYS = 4
  const SH = 3.5 // storey height (in Z)
  const W = 16, D = 11 // plan extents (X × Y)
  const cols: [number, number][] = [[-6, -4], [0, -4], [6, -4], [-6, 4], [0, 4], [6, 4]]

  const storeyIds: number[] = []
  for (let s = 0; s < STOREYS; s++) {
    const z0 = s * SH // floor elevation
    const storey = add(`IFCBUILDINGSTOREY(${guid()},$,'${s === 0 ? 'Ground' : `Level ${s}`}',$,$,$,$,$,.ELEMENT.,${r(z0)})`)
    storeyIds.push(storey)
    const inStorey: number[] = []
    // floor slab (full footprint, 0.3 thick)
    inStorey.push(add(`IFCSLAB(${guid()},$,'Slab L${s}',$,$,$,#${boxShape(0, 0, z0, W, D, 0.3)},$,.FLOOR.)`))
    // columns rise from the slab top to the next floor
    for (const [x, y] of cols) inStorey.push(add(`IFCCOLUMN(${guid()},$,'Column',$,$,$,#${boxShape(x, y, z0 + 0.3, 0.6, 0.6, SH - 0.3)},$)`))
    // perimeter walls on the two long (X-running) faces — skip the roof for openness
    if (s < STOREYS - 1) {
      inStorey.push(add(`IFCWALLSTANDARDCASE(${guid()},$,'Wall N',$,$,$,#${boxShape(0, -D / 2, z0 + 0.3, W, 0.25, SH - 0.6)},$)`))
      inStorey.push(add(`IFCWALLSTANDARDCASE(${guid()},$,'Wall S',$,$,$,#${boxShape(0, D / 2, z0 + 0.3, W, 0.25, SH - 0.6)},$)`))
    }
    // two beams running along X just under the next slab
    inStorey.push(add(`IFCBEAM(${guid()},$,'Beam',$,$,$,#${boxShape(0, -4, z0 + SH - 0.4, W, 0.3, 0.4)},$)`))
    inStorey.push(add(`IFCBEAM(${guid()},$,'Beam',$,$,$,#${boxShape(0, 4, z0 + SH - 0.4, W, 0.3, 0.4)},$)`))
    add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid()},$,$,$,(${inStorey.map((i) => `#${i}`).join(',')}),#${storey})`)
  }
  add(`IFCRELAGGREGATES(${guid()},$,$,$,#${project},(#${site}))`)
  add(`IFCRELAGGREGATES(${guid()},$,$,$,#${site},(#${bldg}))`)
  add(`IFCRELAGGREGATES(${guid()},$,$,$,#${bldg},(${storeyIds.map((i) => `#${i}`).join(',')}))`)

  L.push('ENDSEC;', 'END-ISO-10303-21;')
  return L.join('\n')
}

export const SAMPLE_IFC_GEO: string = build()
