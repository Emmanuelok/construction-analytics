/* BIM file audit — pure, unit-tested. Takes what the in-browser IFC parser found
 * and turns it into something a human can act on:
 *  · a plain-language translation of every IFC class (IFCCARTESIANPOINT → "Points —
 *    geometry plumbing"), rolled into six relatable groups, so "514 instances" reads
 *    as "42 building elements + the records that position and describe them";
 *  · a graded model-health check, like a BIM manager's QA pass: is there a spatial
 *    structure (project → site → building → storeys)? are elements contained in
 *    storeys, typed, carrying property sets and quantities? are there spaces,
 *    units, materials, real geometry? Each finding says what it means and why it
 *    matters, and the score/grade weight the failures.
 * No DOM, no Three.js — feed it any parsed file. */

export type AuditInput = {
  schema: string
  totalInstances: number
  elementCount: number
  distinctTypes: number
  storeys: string[]
  project?: string
  site?: string
  building?: string
  entityCounts: { type: string; count: number }[]
  quantities?: { name: string }[]
  properties?: { name: string }[]
}

/* ---------------------------------------------------- plain-language catalog */
export type EntityGroup = 'elements' | 'spatial' | 'geometry' | 'relationships' | 'data' | 'other'
export const GROUP_META: Record<EntityGroup, { label: string; blurb: string }> = {
  elements: { label: 'Building elements', blurb: 'The physical things — walls, slabs, columns, doors. What you would point at on site.' },
  spatial: { label: 'Spaces & storeys', blurb: 'The tree that organises the building: project → site → building → storeys → spaces.' },
  geometry: { label: 'Geometry plumbing', blurb: 'Points, axes, profiles and solids. IFC stores every coordinate as its own record — high counts here are normal.' },
  relationships: { label: 'Relationships (the glue)', blurb: 'Records that connect things: which storey holds a wall, which type a door follows, which property set describes a slab.' },
  data: { label: 'Properties & quantities', blurb: 'The data riding on elements — property sets, single values, quantity takeoffs, type definitions.' },
  other: { label: 'Presentation & misc', blurb: 'Styling, units, ownership stamps and everything else a STEP file carries.' },
}

const CATALOG: [RegExp, string, EntityGroup][] = [
  [/TYPE$/, 'Element types (families)', 'data'], // before the element rules: IFCWALLTYPE is a type, not a wall
  [/^IFCWALL/, 'Walls', 'elements'],
  [/^IFCSLAB/, 'Floor slabs', 'elements'],
  [/^IFCCOLUMN/, 'Columns', 'elements'],
  [/^IFCBEAM/, 'Beams', 'elements'],
  [/^IFCDOOR/, 'Doors', 'elements'],
  [/^IFCWINDOW/, 'Windows', 'elements'],
  [/^IFCSTAIRFLIGHT/, 'Stair flights', 'elements'],
  [/^IFCSTAIR/, 'Stairs', 'elements'],
  [/^IFCRAILING/, 'Railings', 'elements'],
  [/^IFCROOF/, 'Roofs', 'elements'],
  [/^IFCCOVERING/, 'Finishes (coverings)', 'elements'],
  [/^IFCCURTAINWALL/, 'Curtain walls', 'elements'],
  [/^IFCPLATE/, 'Plates / panels', 'elements'],
  [/^IFCMEMBER/, 'Framing members', 'elements'],
  [/^IFCFOOTING/, 'Footings', 'elements'],
  [/^IFCPILE/, 'Piles', 'elements'],
  [/^IFCFURNISHINGELEMENT/, 'Furniture', 'elements'],
  [/^IFCFLOWTERMINAL|^IFCFLOWSEGMENT|^IFCFLOWFITTING|^IFCDUCT|^IFCPIPE|^IFCCABLECARRIER/, 'MEP elements', 'elements'],
  [/^IFCBUILDINGELEMENTPROXY/, 'Unclassified elements (proxies)', 'elements'],
  [/^IFCOPENINGELEMENT/, 'Openings (holes)', 'elements'],
  [/^IFCSPACE/, 'Spaces (rooms)', 'spatial'],
  [/^IFCBUILDINGSTOREY/, 'Storeys (levels)', 'spatial'],
  [/^IFCBUILDING\b|^IFCBUILDING\(/, 'Building', 'spatial'],
  [/^IFCSITE/, 'Site', 'spatial'],
  [/^IFCPROJECT/, 'Project', 'spatial'],
  [/^IFCZONE/, 'Zones', 'spatial'],
  [/^IFCCARTESIANPOINT/, 'Points (coordinates)', 'geometry'],
  [/^IFCDIRECTION/, 'Directions (axes)', 'geometry'],
  [/^IFCAXIS2PLACEMENT/, 'Placements (position + rotation)', 'geometry'],
  [/^IFCLOCALPLACEMENT/, 'Local placements', 'geometry'],
  [/^IFCPOLYLINE|^IFCCOMPOSITECURVE|^IFCTRIMMEDCURVE|^IFCCIRCLE\b/, 'Outlines (curves)', 'geometry'],
  [/^IFCEXTRUDEDAREASOLID|^IFCBOOLEAN|^IFCFACETEDBREP|^IFCTRIANGULATED/, 'Solids (3D bodies)', 'geometry'],
  [/PROFILEDEF/, 'Section profiles', 'geometry'],
  [/^IFCSHAPEREPRESENTATION|^IFCPRODUCTDEFINITIONSHAPE/, 'Shape definitions', 'geometry'],
  [/^IFCRELCONTAINEDINSPATIALSTRUCTURE/, 'Storey containment links', 'relationships'],
  [/^IFCRELAGGREGATES/, 'Assembly links', 'relationships'],
  [/^IFCRELDEFINESBYPROPERTIES/, 'Property links', 'relationships'],
  [/^IFCRELDEFINESBYTYPE/, 'Type links', 'relationships'],
  [/^IFCRELASSOCIATESMATERIAL/, 'Material links', 'relationships'],
  [/^IFCRELVOIDSELEMENT|^IFCRELFILLSELEMENT/, 'Opening links', 'relationships'],
  [/^IFCREL/, 'Other links', 'relationships'],
  [/^IFCPROPERTYSET/, 'Property sets', 'data'],
  [/^IFCPROPERTYSINGLEVALUE/, 'Property values', 'data'],
  [/^IFCELEMENTQUANTITY|^IFCQUANTITY/, 'Quantities (takeoff)', 'data'],
  [/^IFCMATERIAL/, 'Materials', 'data'],
  [/^IFCSIUNIT|^IFCUNITASSIGNMENT|^IFCCONVERSIONBASEDUNIT|^IFCMEASUREWITHUNIT/, 'Units', 'other'],
  [/^IFCOWNERHISTORY|^IFCPERSON|^IFCORGANIZATION|^IFCAPPLICATION/, 'Authorship stamps', 'other'],
  [/STYLE|COLOURRGB|^IFCPRESENTATION/, 'Colours & styles', 'other'],
  [/^IFCGEOMETRICREPRESENTATIONCONTEXT/, 'Model context', 'other'],
]

/** Plain-language meaning of one IFC class. Unknown classes land in "other". */
export function explainEntity(ifcType: string): { label: string; group: EntityGroup } {
  const t = ifcType.toUpperCase()
  for (const [re, label, group] of CATALOG) if (re.test(t)) return { label, group }
  return { label: t.replace(/^IFC/, '').toLowerCase().replace(/^./, (c) => c.toUpperCase()), group: 'other' }
}

export type CompositionGroup = { group: EntityGroup; label: string; blurb: string; count: number; pct: number; top: { type: string; label: string; count: number }[] }
/** Roll the raw entity counts into the six relatable groups. */
export function composition(entityCounts: { type: string; count: number }[]): CompositionGroup[] {
  const total = Math.max(1, entityCounts.reduce((s, e) => s + e.count, 0))
  const byGroup = new Map<EntityGroup, { count: number; items: Map<string, { type: string; label: string; count: number }> }>()
  for (const e of entityCounts) {
    const ex = explainEntity(e.type)
    const g = byGroup.get(ex.group) ?? { count: 0, items: new Map() }
    g.count += e.count
    const it = g.items.get(ex.label) ?? { type: e.type, label: ex.label, count: 0 }
    it.count += e.count
    g.items.set(ex.label, it)
    byGroup.set(ex.group, g)
  }
  const order: EntityGroup[] = ['elements', 'spatial', 'geometry', 'relationships', 'data', 'other']
  return order.filter((g) => byGroup.has(g)).map((g) => {
    const v = byGroup.get(g)!
    return {
      group: g, label: GROUP_META[g].label, blurb: GROUP_META[g].blurb,
      count: v.count, pct: Math.round((v.count / total) * 100),
      top: [...v.items.values()].sort((a, b) => b.count - a.count).slice(0, 4),
    }
  })
}

/* ----------------------------------------------------------- the health check */
export type AuditSeverity = 'good' | 'info' | 'warning' | 'critical'
export type AuditFinding = { id: string; severity: AuditSeverity; title: string; detail: string; why: string }
export type AuditGrade = 'A' | 'B' | 'C' | 'D' | 'E'
export type BimAudit = {
  score: number; grade: AuditGrade
  findings: AuditFinding[]
  counts: { good: number; info: number; warning: number; critical: number }
  headline: string
}

const count = (input: AuditInput, re: RegExp) => input.entityCounts.filter((e) => re.test(e.type.toUpperCase())).reduce((s, e) => s + e.count, 0)

/** Run the QA pass a BIM manager would, in plain language. */
export function auditModel(input: AuditInput): BimAudit {
  const f: AuditFinding[] = []
  const add = (id: string, severity: AuditSeverity, title: string, detail: string, why: string) => f.push({ id, severity, title, detail, why })

  const storeys = input.storeys.length
  const elements = input.elementCount
  const spaces = count(input, /^IFCSPACE/)
  const contained = count(input, /^IFCRELCONTAINEDINSPATIALSTRUCTURE/)
  const typed = count(input, /^IFCRELDEFINESBYTYPE/)
  const psetLinks = count(input, /^IFCRELDEFINESBYPROPERTIES/)
  const materials = count(input, /^IFCMATERIAL/) + count(input, /^IFCRELASSOCIATESMATERIAL/)
  const units = count(input, /^IFCSIUNIT|^IFCUNITASSIGNMENT/)
  const solids = count(input, /^IFCEXTRUDEDAREASOLID|^IFCFACETEDBREP|^IFCTRIANGULATED|^IFCBOOLEAN/)
  const proxies = count(input, /^IFCBUILDINGELEMENTPROXY/)
  const quantities = input.quantities?.length ?? 0

  // 1 — spatial structure
  if (input.project && storeys > 0) add('spatial', 'good', 'Spatial structure present', `Project “${input.project}” with ${storeys} storey${storeys > 1 ? 's' : ''}${input.building ? ` in building “${input.building}”` : ''}.`, 'The project → site → building → storey tree is how every BIM tool organises, filters and schedules a model.')
  else if (storeys === 0) add('spatial', 'critical', 'No storeys defined', 'The file has no IfcBuildingStorey records, so nothing can be organised by level.', 'Without storeys, Revit/Navisworks/Solibri can’t group elements per floor — schedules, level filters and 4D sequencing all break.')
  else add('spatial', 'warning', 'Spatial structure incomplete', `${input.project ? '' : 'No IfcProject. '}${input.site ? '' : 'No IfcSite. '}${input.building ? '' : 'No IfcBuilding.'}`.trim(), 'Receiving tools rebuild the model tree from these records; gaps make federation and QA harder.')

  // 2 — containment
  if (elements > 0 && contained > 0) add('contain', 'good', 'Elements are placed in storeys', `${contained} containment link${contained > 1 ? 's' : ''} assign elements to their levels.`, 'Storey containment is what makes “show me Level 3” possible downstream.')
  else if (elements > 0) add('contain', storeys > 0 ? 'warning' : 'info', 'Elements not assigned to storeys', 'No IfcRelContainedInSpatialStructure links were found.', 'Unassigned elements pile up at the project root — they render, but level-based views and takeoffs miss them.')

  // 3 — geometry
  if (solids > 0) add('geometry', 'good', 'Carries real 3D geometry', `${solids} solid bodies (extrusions/breps) tessellate into the true shapes.`, 'With real solids the model can be measured, clashed and rendered — not just counted.')
  else add('geometry', 'info', 'No explicit 3D solids', 'This file lists elements but no solid bodies — the viewer falls back to a reconstruction from counts.', 'Counts-only exports are fine for registers and audits, but clash detection and quantity checks need geometry.')

  // 4 — types
  if (typed > 0) add('types', 'good', 'Elements follow named types', `${typed} type link${typed > 1 ? 's' : ''} (IfcRelDefinesByType) bind elements to families.`, 'Types are the CAD “families”: consistent naming, properties and rates flow from them.')
  else if (elements > 0) add('types', 'warning', 'No element types (families)', 'Every element stands alone — no IfcTypeObject definitions.', 'Untyped models schedule poorly: nothing groups, and type-based costing or specification can’t attach.')

  // 5 — property sets
  if (psetLinks > 0) add('psets', 'good', 'Property sets attached', `${psetLinks} property link${psetLinks > 1 ? 's' : ''} carry data on the elements.`, 'Psets hold the real information — fire ratings, U-values, references — that turn shapes into a database.')
  else if (elements > 0) add('psets', 'warning', 'No property sets', 'Elements carry no attached data records.', 'Without psets the model is geometry only — no data to schedule, filter or verify against the spec.')

  // 6 — quantities
  if (quantities > 0) add('qto', 'good', 'Quantity takeoff included', `${quantities} quantity definitions (IfcElementQuantity) ride with the model.`, 'Embedded quantities let cost plans verify against the authoring tool’s own measurements.')
  else add('qto', 'info', 'No embedded quantities', 'No IfcElementQuantity records — quantities must be measured from geometry instead.', 'Most exports omit them; it just means takeoffs are computed, not author-certified.')

  // 7 — spaces
  if (spaces > 0) add('spaces', 'good', 'Rooms exported as spaces', `${spaces} IfcSpace records carry the room layout.`, 'Spaces drive area schedules, FM handover (COBie) and room-by-room requirements checking.')
  else if (elements > 0) add('spaces', 'info', 'No room/space objects', 'The file has building fabric but no IfcSpace records.', 'Fine for structure-only models; architectural exports should include spaces for area and FM workflows.')

  // 8 — units
  if (units > 0) add('units', 'good', 'Units declared', 'The file declares its measurement units (SI).', 'Receiving tools scale everything from this — a missing declaration is how 1000× size errors happen.')
  else add('units', 'warning', 'No unit declaration found', 'No IfcSIUnit/IfcUnitAssignment records.', 'Without declared units, importers guess — the classic source of millimetre/metre mix-ups.')

  // 9 — materials
  if (materials > 0) add('materials', 'good', 'Materials assigned', `${materials} material record${materials > 1 ? 's' : ''}/links describe what things are made of.`, 'Materials feed rendering, specification and carbon/cost analysis.')
  else if (elements > 0) add('materials', 'info', 'No materials', 'Elements carry no material assignments.', 'Models render grey and carbon/cost tools fall back to assumptions.')

  // 10 — proxies
  if (elements > 0 && proxies / Math.max(1, elements) > 0.3) add('proxies', 'warning', 'Heavy use of unclassified proxies', `${proxies} of ${elements} elements are IfcBuildingElementProxy (${Math.round((proxies / elements) * 100)}%).`, 'Proxies are “misc object” — they carry no discipline meaning, so filters, schedules and clash rules treat them as noise.')

  // 11 — schema
  add('schema', 'info', `Schema ${input.schema}`, input.schema.toUpperCase().startsWith('IFC4') ? 'A current-generation schema with full type and quantity support.' : 'An older schema — still widely supported, but IFC4 carries richer types and quantities.', 'The schema decides which records a file can express; both directions exchange fine for everyday coordination.')

  const counts = {
    good: f.filter((x) => x.severity === 'good').length,
    info: f.filter((x) => x.severity === 'info').length,
    warning: f.filter((x) => x.severity === 'warning').length,
    critical: f.filter((x) => x.severity === 'critical').length,
  }
  const score = Math.max(0, Math.min(100, 100 - counts.critical * 22 - counts.warning * 9 - counts.info * 2))
  const grade: AuditGrade = score >= 88 ? 'A' : score >= 74 ? 'B' : score >= 58 ? 'C' : score >= 40 ? 'D' : 'E'
  const worst = f.find((x) => x.severity === 'critical') ?? f.find((x) => x.severity === 'warning')
  const headline = counts.critical > 0
    ? `Grade ${grade} — fix first: ${worst!.title.toLowerCase()}.`
    : counts.warning > 0
      ? `Grade ${grade} — usable for coordination; tighten: ${worst!.title.toLowerCase()}.`
      : `Grade ${grade} — a well-structured model, ready to federate.`
  // findings ordered: critical → warning → good → info
  const rank: Record<AuditSeverity, number> = { critical: 0, warning: 1, good: 2, info: 3 }
  f.sort((a, b) => rank[a.severity] - rank[b.severity])
  return { score, grade, findings: f, counts, headline }
}

/** Audit + composition as CSV (one sheet each). */
export function auditCsv(input: AuditInput): string {
  const a = auditModel(input)
  const head = 'Check,Severity,Finding,Why it matters'
  const rows = a.findings.map((x) => `${x.title.replace(/,/g, ';')},${x.severity},"${x.detail.replace(/"/g, '""')}","${x.why.replace(/"/g, '""')}"`)
  const comp = composition(input.entityCounts)
  const c = ['', 'Group,Share,Records,Top contents', ...comp.map((g) => `${g.label},${g.pct}%,${g.count},"${g.top.map((t) => `${t.label} ${t.count}`).join(' · ')}"`)]
  return [`Model health,${a.score}/100 (grade ${a.grade})`, head, ...rows, ...c].join('\n')
}
