/* Native IFC4 export — pure, validated by round-tripping through the web-ifc
 * kernel. Emits a real IFC-SPF model: an IfcProject with metric units + a model
 * context, a spatial hierarchy (IfcSite → IfcBuilding → IfcBuildingStorey per
 * level), and typed products (IfcColumn / IfcBeam / IfcSlab / IfcWall / IfcWindow /
 * IfcDoor / IfcBuildingElementProxy) — each placed in space, given parametric
 * IfcExtrudedAreaSolid geometry and a property set. So the edited building re-opens
 * in Revit / Navisworks / Solibri as storey-organised BIM objects, not a mesh.
 * IFC is Z-up; the model's scene units convert to metres (plan × scale, vertical ×
 * storey height). No Three.js, no DOM. */

import type { BuildingModel, Quad, Beam, Box, Plate } from './building'
import type { Pt } from './zoning'
import { SCENE_LEN_TO_M } from './massing'

const LEN = SCENE_LEN_TO_M
const R = (n: number) => { const v = Math.round(n * 1e5) / 1e5; return Number.isInteger(v) ? `${v}.` : `${v}` }
const GA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'
const guid = () => { let s = ''; for (let i = 0; i < 22; i++) s += GA[Math.floor(Math.random() * 64)]; return s }

export function toIfc(m: BuildingModel, opts?: { name?: string; storeyHeight?: number }): string {
  const sh = opts?.storeyHeight ?? 3.6
  const name = opts?.name ?? 'Building'
  // IFC coords (Z-up, metres): X = x·LEN (East), Y = z·LEN (North), Z = y·sh (up)
  const ifc = (x: number, y: number, z: number): [number, number, number] => [x * LEN, z * LEN, y * sh]

  let id = 0
  const L: string[] = []
  const add = (s: string) => { id += 1; L.push(`#${id}=${s};`); return id }

  // ---- shared foundation ----
  const pt = (c: [number, number, number]) => add(`IFCCARTESIANPOINT((${R(c[0])},${R(c[1])},${R(c[2])}))`)
  const pt2 = (x: number, y: number) => add(`IFCCARTESIANPOINT((${R(x)},${R(y)}))`)
  const dir = (x: number, y: number, z: number) => add(`IFCDIRECTION((${R(x)},${R(y)},${R(z)}))`)
  const ORIGIN = pt([0, 0, 0]); const UP = dir(0, 0, 1)
  const WORLDCS = add(`IFCAXIS2PLACEMENT3D(#${ORIGIN},$,$)`)
  const CTX = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#${WORLDCS},$)`)
  const person = add(`IFCPERSON($,'Studio',$,$,$,$,$,$)`)
  const org = add(`IFCORGANIZATION($,'AEC Studio',$,$,$)`)
  const pao = add(`IFCPERSONANDORGANIZATION(#${person},#${org},$)`)
  const app = add(`IFCAPPLICATION(#${org},'1.0','AEC Data & Intelligence Studio','AECStudio')`)
  const OWNER = add(`IFCOWNERHISTORY(#${pao},#${app},$,.ADDED.,$,$,$,0)`)
  const lenU = add(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`)
  const areaU = add(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`)
  const volU = add(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`)
  const angU = add(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`)
  const UNITS = add(`IFCUNITASSIGNMENT((#${lenU},#${areaU},#${volU},#${angU}))`)
  const PROJECT = add(`IFCPROJECT('${guid()}',#${OWNER},'${esc(name)}',$,$,$,$,(#${CTX}),#${UNITS})`)

  const idP = add(`IFCLOCALPLACEMENT($,#${WORLDCS})`) // shared identity placement (geometry is in world coords)

  // ---- spatial structure ----
  const site = add(`IFCSITE('${guid()}',#${OWNER},'Site',$,$,#${idP},$,$,.ELEMENT.,$,$,$,$,$)`)
  const building = add(`IFCBUILDING('${guid()}',#${OWNER},'${esc(name)}',$,$,#${idP},$,$,.ELEMENT.,$,$,$)`)
  const storeys = m.counts.storeys
  const storeyIds: number[] = []
  for (let s = 0; s < storeys; s++) storeyIds.push(add(`IFCBUILDINGSTOREY('${guid()}',#${OWNER},'${s === 0 ? 'Ground' : `Level ${s}`}',$,$,#${idP},$,$,.ELEMENT.,${R(s * sh)})`))
  add(`IFCRELAGGREGATES('${guid()}',#${OWNER},$,$,#${PROJECT},(#${site}))`)
  add(`IFCRELAGGREGATES('${guid()}',#${OWNER},$,$,#${site},(#${building}))`)
  add(`IFCRELAGGREGATES('${guid()}',#${OWNER},$,$,#${building},(${storeyIds.map((i) => `#${i}`).join(',')}))`)

  // ---- geometry helpers (extruded solids) ----
  const rectCache = new Map<string, number>()
  const rect = (xd: number, yd: number) => { const k = `${R(xd)}x${R(yd)}`; let r = rectCache.get(k); if (!r) { const p = add(`IFCAXIS2PLACEMENT2D(#${pt2(0, 0)},$)`); r = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${p},${R(xd)},${R(yd)})`); rectCache.set(k, r) } return r }
  const arbProfile = (poly: Pt[]) => { const pts = poly.map((q) => pt2(q.x * LEN, q.z * LEN)); const closed = [...pts, pts[0]]; const pl = add(`IFCPOLYLINE((${closed.map((i) => `#${i}`).join(',')}))`); return add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#${pl})`) }
  const place = (origin: [number, number, number], axis: [number, number, number] | null, ref: [number, number, number] | null) =>
    add(`IFCAXIS2PLACEMENT3D(#${pt(origin)},${axis ? `#${dir(axis[0], axis[1], axis[2])}` : '$'},${ref ? `#${dir(ref[0], ref[1], ref[2])}` : '$'})`)
  const extrude = (profile: number, pos: number, depth: number) => add(`IFCEXTRUDEDAREASOLID(#${profile},#${pos},#${UP},${R(Math.max(0.001, depth))})`)
  const shapeOf = (solid: number) => { const rep = add(`IFCSHAPEREPRESENTATION(#${CTX},'Body','SweptSolid',(#${solid}))`); return add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${rep}))`) }

  // a vertical box/prism (columns, mullions, core, walls/windows/doors as thin slabs)
  const vSolid = (profile: number, base: [number, number, number], refDir: [number, number, number] | null, height: number) => extrude(profile, place(base, [0, 0, 1], refDir ?? [1, 0, 0]), height)
  // a horizontal beam extruded along its edge
  const beamSolid = (b: Beam) => {
    const a = ifc(b.a.x, b.y, b.a.z), bb = ifc(b.b.x, b.y, b.b.z)
    const ax = bb[0] - a[0], ay = bb[1] - a[1], len = Math.hypot(ax, ay) || 1
    const axis: [number, number, number] = [ax / len, ay / len, 0] // extrude direction = edge (horizontal)
    const prof = rect(b.depth * sh, b.width * LEN) // X=up after refdir, Y=horizontal-perp
    const pos = place(a, axis, [0, 0, 1]) // local Z = edge; local X (refdir) = up
    return extrude(prof, pos, len)
  }
  const edgeDir = (a: Pt, bp: Pt): [number, number, number] => { const A = ifc(a.x, 0, a.z), B = ifc(bp.x, 0, bp.z); const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l, 0] }

  // ---- products, grouped by storey for containment ----
  const byStorey: number[][] = storeyIds.map(() => [])
  const psetRels: string[] = []
  const inStorey = (eid: number, level: number) => { const s = Math.max(0, Math.min(storeys - 1, level)); byStorey[s].push(eid) }
  const pset = (eid: number, mark: string, level: string, dims: [string, number][]) => {
    const props = [add(`IFCPROPERTYSINGLEVALUE('Reference',$,IFCTEXT('${esc(mark)}'),$)`), add(`IFCPROPERTYSINGLEVALUE('Level',$,IFCLABEL('${esc(level)}'),$)`),
      ...dims.map(([n, v]) => add(`IFCPROPERTYSINGLEVALUE('${n}',$,IFCLENGTHMEASURE(${R(v)}),$)`))]
    const ps = add(`IFCPROPERTYSET('${guid()}',#${OWNER},'Pset_AECStudio',$,(${props.map((i) => `#${i}`).join(',')}))`)
    psetRels.push(`IFCRELDEFINESBYPROPERTIES('${guid()}',#${OWNER},$,$,(#${eid}),#${ps})`)
  }

  const lvlName = (lv: number) => (lv === 0 ? 'Ground' : lv >= storeys ? 'Roof' : `Level ${lv}`)
  const slab = (p: Plate, mark: string, pred: 'FLOOR' | 'ROOF', lvl: number) => {
    const solid = extrude(arbProfile(p.polygon), place(ifc(0, p.y, 0), null, null), p.thickness * sh)
    const e = add(`IFCSLAB('${guid()}',#${OWNER},'${esc(mark)}',$,$,#${idP},#${shapeOf(solid)},'${esc(mark)}',.${pred}.)`)
    inStorey(e, lvl === storeys ? storeys - 1 : lvl); pset(e, mark, lvlName(lvl), [['Thickness', p.thickness * sh]])
  }
  const column = (c: Box, mark: string, lvl: number) => {
    const base = ifc(c.x, c.y - c.h / 2, c.z); const solid = vSolid(rect(c.w * LEN, c.d * LEN), base, [1, 0, 0], c.h * sh)
    const e = add(`IFCCOLUMN('${guid()}',#${OWNER},'${esc(mark)}',$,$,#${idP},#${shapeOf(solid)},'${esc(mark)}',.COLUMN.)`)
    inStorey(e, lvl); pset(e, mark, lvlName(lvl), [['Width', c.w * LEN], ['Height', c.h * sh]])
  }
  const panel = (q: Quad, kind: 'WALL' | 'WINDOW' | 'DOOR', mark: string, lvl: number, thick: number) => {
    const mid = { x: (q.a.x + q.b.x) / 2, z: (q.a.z + q.b.z) / 2 }
    const len = Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) * LEN
    const solid = vSolid(rect(len, thick), ifc(mid.x, q.y, mid.z), edgeDir(q.a, q.b), q.h * sh)
    const shp = shapeOf(solid)
    let e: number
    if (kind === 'WALL') e = add(`IFCWALL('${guid()}',#${OWNER},'${esc(mark)}',$,$,#${idP},#${shp},'${esc(mark)}',.SOLIDWALL.)`)
    else if (kind === 'WINDOW') e = add(`IFCWINDOW('${guid()}',#${OWNER},'${esc(mark)}',$,$,#${idP},#${shp},'${esc(mark)}',${R(q.h * sh)},${R(len)},$,$,$)`)
    else e = add(`IFCDOOR('${guid()}',#${OWNER},'${esc(mark)}',$,$,#${idP},#${shp},'${esc(mark)}',${R(q.h * sh)},${R(len)},$,$,$)`)
    inStorey(e, lvl); pset(e, mark, lvlName(lvl), [['Width', len], ['Height', q.h * sh]])
  }
  const beam = (b: Beam, mark: string, lvl: number) => {
    const e = add(`IFCBEAM('${guid()}',#${OWNER},'${esc(mark)}',$,$,#${idP},#${shapeOf(beamSolid(b))},'${esc(mark)}',.BEAM.)`)
    inStorey(e, lvl); pset(e, mark, lvlName(lvl), [['Depth', b.depth * sh]])
  }

  const pad = (n: number) => String(n + 1).padStart(2, '0')
  m.slabs.forEach((s) => slab(s, `F-${(s.level ?? 0) === 0 ? 'G' : pad((s.level ?? 0) - 1)}`, 'FLOOR', s.level ?? 0))
  if (m.roof) slab(m.roof, 'ROOF', 'ROOF', storeys)
  m.columns.forEach((c, i) => column(c, c.id ?? `C-${pad(i)}`, c.level ?? 0))
  m.beams.forEach((b, i) => beam(b, b.id ?? `B-${pad(i)}`, b.level ?? 0))
  m.walls.forEach((q, i) => panel(q, 'WALL', q.id ?? `WL-${pad(i)}`, q.level ?? 0, 0.2))
  m.glazing.forEach((q, i) => panel(q, 'WINDOW', q.id ?? `W-${pad(i)}`, q.level ?? 0, 0.06))
  m.doors.forEach((q, i) => panel(q, 'DOOR', q.id ?? `D-${pad(i)}`, q.level ?? 0, 0.1))
  if (m.core) { const c = m.core; const solid = vSolid(rect(c.w * LEN, c.d * LEN), ifc(c.x, c.y - c.h / 2, c.z), [1, 0, 0], c.h * sh); const e = add(`IFCBUILDINGELEMENTPROXY('${guid()}',#${OWNER},'Core',$,$,#${idP},#${shapeOf(solid)},'CORE',$)`); inStorey(e, 0); pset(e, 'CORE', 'All levels', [['Width', c.w * LEN]]) }

  storeyIds.forEach((sid, i) => { if (byStorey[i].length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',#${OWNER},$,$,(${byStorey[i].map((e) => `#${e}`).join(',')}),#${sid})`) })
  for (const r of psetRels) add(r)

  const stamp = new Date().toISOString().replace(/\.\d+Z$/, '')
  const header = [
    'ISO-10303-21;', 'HEADER;',
    `FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');`,
    `FILE_NAME('${esc(name)}.ifc','${stamp}',('AEC Studio'),('AEC Data & Intelligence Studio'),'AECStudio','AEC Studio','');`,
    `FILE_SCHEMA(('IFC4'));`, 'ENDSEC;', 'DATA;',
  ]
  return [...header, ...L, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n')
}

function esc(s: string): string { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") }
