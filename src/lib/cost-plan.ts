/* Elemental cost plan — pure, unit-tested. Rolls the model's measured quantities
 * (column lm, beam lm, slab/wall/finish m², door/stair counts, foundation m³ …)
 * against the selected family rates — honouring per-element type overrides, so
 * re-typing four columns to steel splits them onto their own priced line — then
 * groups everything NRM-style: substructure, frame, envelope, internal finishes,
 * services, FF&E and fixings, with a $/m² GFA rate per group. Soft systems
 * (MEP, FF&E, fixings) come in as totals from their own engines. Scene units →
 * metres via the plan scale (LEN) and the vertical factor (storey height). No DOM. */

import type { BuildingModel, Quad, Beam, Box, Plate } from './building'
import { SCENE_LEN_TO_M } from './massing'
import { polygonArea } from './zoning'
import { familyType, familyOfElement, type TypeSelections } from './families'

const LEN = SCENE_LEN_TO_M
const AREA = LEN * LEN
const r0 = (n: number) => Math.round(n)
const qlen = (q: { a: { x: number; z: number }; b: { x: number; z: number } }) => Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) * LEN
const plateArea = (p: Plate) => Math.max(0, (polygonArea(p.polygon) - (p.hole && p.hole.length >= 3 ? polygonArea(p.hole) : 0)) * AREA)

export type CostLine = { family: string; familyLabel: string; type: string; typeLabel: string; qty: number; unit: string; rate: number; cost: number; overridden: boolean }
export type CostGroup = { key: string; label: string; lines: CostLine[]; cost: number; perM2: number }
export type CostPlan = { groups: CostGroup[]; total: number; gfa: number; perM2: number; shellCost: number }

export type CostOpts = { types?: TypeSelections; overrides?: Record<string, string>; storeyHeight?: number; ffeCost?: number; mepCost?: number; fixingsCost?: number; liftCount?: number }

const GROUPS: { key: string; label: string; families: string[] }[] = [
  { key: 'substructure', label: 'Substructure', families: ['foundation', 'groundBeam'] },
  { key: 'frame', label: 'Frame & upper floors', families: ['column', 'beam', 'slab', 'core', 'stair'] },
  { key: 'envelope', label: 'Envelope & roof', families: ['facade', 'glazing', 'door', 'mullion', 'balustrade', 'roof'] },
  { key: 'internal', label: 'Internal finishes & fit-out', families: ['partition', 'interiorDoor', 'floorFinish', 'ceiling', 'wallFinish', 'ironmongery'] },
  { key: 'services', label: 'Services (MEP)', families: ['lift'] },
  { key: 'ffe', label: 'Furniture & equipment (FF&E)', families: [] },
  { key: 'fixings', label: 'Fittings & fixings', families: [] },
]

/** Build the elemental cost plan for a model under the selected types + overrides. */
export function costPlan(m: BuildingModel, opts: CostOpts = {}): CostPlan {
  const sel = opts.types ?? {}
  const ov = opts.overrides ?? {}
  const sh = opts.storeyHeight ?? 3.6
  const storeys = Math.max(1, m.counts.storeys)
  const vFac = (sh * storeys) / Math.max(m.totalHeight, 1e-9) // metres per scene-Y
  const gfa = m.slabs.reduce((s, p) => s + plateArea(p), 0)

  // accumulate quantity per (family|type), splitting by per-element override
  const acc = new Map<string, { family: string; type: string; qty: number; overridden: boolean }>()
  const addQ = (family: string, id: string | undefined, qty: number) => {
    if (qty <= 0) return
    const overridden = !!(id && ov[id])
    const type = (id && ov[id]) || sel[family] || familyType(family).id
    const k = `${family}|${type}`
    const cur = acc.get(k) ?? { family, type, qty: 0, overridden: false }
    cur.qty += qty; cur.overridden = cur.overridden || overridden
    acc.set(k, cur)
  }

  m.columns.forEach((c: Box) => addQ('column', c.id, c.h * vFac)) // lm
  m.beams.forEach((b: Beam) => addQ('beam', b.id, qlen(b))) // lm
  m.slabs.forEach((p) => addQ('slab', p.id, plateArea(p))) // m²
  if (m.core) addQ('core', 'core', 2 * (m.core.w + m.core.d) * LEN * (m.core.h * vFac)) // wall m²
  m.stairs.forEach((s) => addQ('stair', s.id, s.flights.length)) // flights
  m.foundations.forEach((c: Box) => addQ('foundation', c.id, c.w * LEN * (c.d * LEN) * (c.h * vFac))) // m³
  m.groundBeams.forEach((b: Beam) => addQ('groundBeam', b.id, qlen(b))) // lm
  m.walls.forEach((q: Quad) => addQ('facade', q.id, qlen(q) * (q.h * vFac))) // m²
  m.glazing.forEach((q: Quad) => addQ('glazing', q.id, qlen(q) * (q.h * vFac))) // m²
  m.doors.forEach((q: Quad) => addQ('door', q.id, 1)) // ea
  m.mullions.forEach((c: Box) => addQ('mullion', c.id, c.h * vFac)) // lm
  m.parapets.forEach((q: Quad) => addQ('balustrade', q.id, qlen(q))) // lm
  if (m.roof) addQ('roof', 'roof', plateArea(m.roof)) // m²
  m.partitions.forEach((q: Quad) => addQ('partition', q.id, qlen(q) * (q.h * vFac))) // m²
  m.interiorDoors.forEach((q: Quad) => addQ('interiorDoor', q.id, 1)) // ea
  m.floorFinishes.forEach((p) => addQ('floorFinish', p.id, plateArea(p))) // m²
  m.ceilings.forEach((p) => addQ('ceiling', p.id, plateArea(p))) // m²

  // families without 1:1 model elements — measured off the model, global type only
  const partitionArea = m.partitions.reduce((s, q) => s + qlen(q) * (q.h * vFac), 0)
  const facadeArea = m.walls.reduce((s, q) => s + qlen(q) * (q.h * vFac), 0)
  addQ('wallFinish', undefined, partitionArea * 2 + facadeArea) // both partition faces + inner façade
  addQ('ironmongery', undefined, m.doors.length + m.interiorDoors.length) // sets
  const lifts = opts.liftCount ?? (storeys > 1 ? Math.max(1, Math.round(storeys / 6)) + (storeys > 8 ? 1 : 0) : 0)
  if (lifts > 0) addQ('lift', undefined, lifts) // ea

  const whole = new Set(['ea', 'set', 'flight', 'item'])
  const lineFor = (entry: { family: string; type: string; qty: number; overridden: boolean }): CostLine => {
    const t = familyType(entry.family, entry.type)
    const q = whole.has(t.unit) ? r0(entry.qty) : Math.round(entry.qty * 10) / 10
    // price off the displayed quantity so each line reconciles (qty × rate = cost)
    return { family: entry.family, familyLabel: FAMILY_LABEL[entry.family] ?? entry.family, type: t.id, typeLabel: t.label, qty: q, unit: t.unit, rate: t.cost, cost: r0(q * t.cost), overridden: entry.overridden }
  }

  const groups: CostGroup[] = GROUPS.map((g) => {
    const lines = [...acc.values()].filter((e) => g.families.includes(e.family)).map(lineFor).sort((a, b) => b.cost - a.cost)
    if (g.key === 'services' && opts.mepCost) lines.unshift({ family: 'mep', familyLabel: 'MEP installation', type: 'mep', typeLabel: 'Lighting · HVAC · fire · power · sanitary', qty: 1, unit: 'item', rate: r0(opts.mepCost), cost: r0(opts.mepCost), overridden: false })
    if (g.key === 'ffe' && opts.ffeCost) lines.push({ family: 'ffe', familyLabel: 'Furniture (FF&E)', type: 'ffe', typeLabel: 'Loose + fixed furniture', qty: 1, unit: 'item', rate: r0(opts.ffeCost), cost: r0(opts.ffeCost), overridden: false })
    if (g.key === 'fixings' && opts.fixingsCost) lines.push({ family: 'fixings', familyLabel: 'Hardware & fixings', type: 'fixings', typeLabel: 'Bolts · studs · screws · nails …', qty: 1, unit: 'item', rate: r0(opts.fixingsCost), cost: r0(opts.fixingsCost), overridden: false })
    const cost = lines.reduce((s, l) => s + l.cost, 0)
    return { key: g.key, label: g.label, lines, cost, perM2: gfa > 0 ? Math.round((cost / gfa) * 10) / 10 : 0 }
  }).filter((g) => g.lines.length > 0)

  const total = groups.reduce((s, g) => s + g.cost, 0)
  const shellCost = groups.filter((g) => ['substructure', 'frame', 'envelope'].includes(g.key)).reduce((s, g) => s + g.cost, 0)
  return { groups, total, gfa: Math.round(gfa), perM2: gfa > 0 ? Math.round(total / gfa) : 0, shellCost }
}

const FAMILY_LABEL: Record<string, string> = {
  foundation: 'Foundations', groundBeam: 'Ground beams', column: 'Columns', beam: 'Beams', slab: 'Floor slabs',
  core: 'Core walls', stair: 'Stairs', facade: 'Façade', glazing: 'Glazing', door: 'Entrance doors', mullion: 'Mullions',
  balustrade: 'Parapets & balustrades', roof: 'Roof', partition: 'Partitions', interiorDoor: 'Interior doors',
  floorFinish: 'Floor finishes', ceiling: 'Ceilings', wallFinish: 'Wall finishes', ironmongery: 'Ironmongery', lift: 'Lifts',
}

/** Cost-plan CSV — every line + group subtotals + the grand total and $/m². */
export function costPlanCsv(p: CostPlan): string {
  const head = 'Group,Element,Type,Quantity,Unit,Rate ($),Cost ($)'
  const rows: string[] = []
  for (const g of p.groups) {
    for (const l of g.lines) rows.push(`${g.label},${l.familyLabel}${l.overridden ? ' *' : ''},${l.typeLabel},${l.qty},${l.unit},${l.rate},${l.cost}`)
    rows.push(`${g.label},SUBTOTAL,,,,,${g.cost}`)
  }
  return [head, ...rows, `TOTAL,,,,,${p.total},`, `TOTAL,$/m² GFA (${p.gfa} m²),,,,,${p.perM2}`].join('\n')
}
