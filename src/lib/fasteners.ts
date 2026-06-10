/* Hardware & fixings takeoff — literally down to the nails. Pure, unit-tested.
 * Walks the generated/imported model and derives the secondary-element and fixing
 * quantities a contractor would order: anchor bolts under ground-floor columns,
 * beam end-connection bolts, partition framing (tracks + studs), drywall screws by
 * wall area, skirting nails by wall run, door ironmongery (hinges + screws + sets),
 * window/curtain-wall fixing clips, mullion brackets, suspended-ceiling hangers +
 * grid, stair tread fixings and railing bolts. Quantities follow common rules of
 * thumb (spacings/m² rates noted per row) — an indicative procurement takeoff, not
 * a connection design. Scene units → metres via the plan scale; vertical via the
 * storey height. */

import type { BuildingModel, Quad } from './building'
import { SCENE_LEN_TO_M } from './massing'
import { polygonArea } from './zoning'

const LEN = SCENE_LEN_TO_M
const r1 = (n: number) => Math.round(n * 10) / 10
const qlen = (q: Quad) => Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) * LEN

export type FixRow = { id: string; item: string; host: string; unit: 'ea' | 'm'; qty: number; massKg: number; rule: string }
export type FixResult = {
  rows: FixRow[]
  totals: { fixings: number; nails: number; screws: number; bolts: number; massKg: number; rows: number }
  headline: string
}

/** Run the hardware/fixings takeoff over a building model. */
export function fastenerTakeoff(m: BuildingModel, opts: { storeyHeight?: number } = {}): FixResult {
  const sh = opts.storeyHeight ?? 3.6
  const storeys = Math.max(1, m.counts.storeys)
  const vFac = (sh * storeys) / Math.max(m.totalHeight, 1e-9) // metres per scene (vertical)

  const groundCols = m.columns.filter((c) => (c.level ?? 0) === 0).length
  const partLm = m.partitions.reduce((s, p) => s + qlen(p), 0)
  const partAreaFaces = m.partitions.reduce((s, p) => s + qlen(p) * (p.h * vFac), 0) * 2 // both faces
  const doorsAll = m.doors.length + m.interiorDoors.length
  const panLm = m.glazing.reduce((s, g) => s + qlen(g), 0)
  const ceilArea = m.ceilings.reduce((s, c) => s + polygonArea(c.polygon) * LEN * LEN - (c.hole ? polygonArea(c.hole) * LEN * LEN : 0), 0)
  const treads = m.stairs.reduce((s, st) => s + st.treads.length, 0)
  const rails = m.stairs.reduce((s, st) => s + st.rails.length, 0)

  const rows: FixRow[] = []
  const add = (id: string, item: string, host: string, unit: 'ea' | 'm', qty: number, unitKg: number, rule: string) => {
    const q = unit === 'ea' ? Math.round(qty) : r1(qty)
    if (q <= 0) return
    rows.push({ id, item, host, unit, qty: q, massKg: r1(q * unitKg), rule })
  }

  add('anchor', 'M20 anchor bolts', 'Column bases', 'ea', groundCols * 4, 0.42, '4 per ground-floor column base')
  add('beam-bolt', 'M16 connection bolts', 'Beam ends', 'ea', m.beams.length * 8, 0.19, '4 per end, 2 ends per beam')
  add('track-pin', 'Track shot-pins', 'Partition head + base tracks', 'ea', (partLm * 2) / 0.6, 0.01, '@600 mm, top + bottom track')
  add('stud', 'Steel C-studs', 'Partition framing', 'ea', partLm / 0.6 + m.partitions.length, 3.2, '@600 mm + 1 per wall end')
  add('dw-screw', 'Drywall screws', 'Partition boards', 'ea', partAreaFaces * 22, 0.004, '≈22 per m² of board, both faces')
  add('skirt-nail', 'Skirting nails', 'Partition skirtings', 'ea', partLm * 4, 0.003, '4 per lm of skirting — yes, the nails')
  add('hinge', 'Door hinges', 'Doors', 'ea', doorsAll * 3, 0.18, '3 per leaf')
  add('hinge-screw', 'Hinge screws', 'Doors', 'ea', doorsAll * 24, 0.004, '8 per hinge')
  add('lockset', 'Locksets', 'Doors', 'ea', doorsAll, 0.6, '1 per leaf')
  add('cw-clip', 'Curtain-wall fixing clips', 'Glazed panels', 'ea', (panLm * 2) / 0.5, 0.02, '@500 mm, head + sill')
  add('mull-bkt', 'Mullion brackets', 'Mullions', 'ea', m.mullions.length * 2, 0.08, '2 per mullion')
  add('ceil-hanger', 'Ceiling hangers', 'Suspended ceilings', 'ea', ceilArea / 1.44, 0.15, '1 per 1.2 × 1.2 m grid')
  add('ceil-tee', 'Ceiling grid tees', 'Suspended ceilings', 'm', ceilArea / 0.6, 0.45, '≈1.67 lm per m² of grid')
  add('tread-fix', 'Stair tread fixings', 'Stairs', 'ea', treads * 4, 0.012, '4 per tread')
  add('rail-bolt', 'Railing bolts', 'Stair railings', 'ea', rails * 6, 0.06, '6 per rail run')

  const sum = (pred: (r: FixRow) => boolean) => rows.filter(pred).filter((r) => r.unit === 'ea').reduce((s, r) => s + r.qty, 0)
  const nails = sum((r) => r.id === 'skirt-nail')
  const screws = sum((r) => /screw/i.test(r.item))
  const bolts = sum((r) => /bolt/i.test(r.item))
  const fixings = sum((r) => r.id !== 'stud') // studs are framing members, not fixings
  const massKg = r1(rows.reduce((s, r) => s + r.massKg, 0))
  return {
    rows,
    totals: { fixings, nails, screws, bolts, massKg, rows: rows.length },
    headline: `≈ ${fixings.toLocaleString()} fixings — including ${nails.toLocaleString()} nails`,
  }
}

/** CSV export of the takeoff. */
export function fastenersCsv(f: FixResult): string {
  const head = 'Item,Host,Unit,Quantity,Mass (kg),Rule'
  const rows = f.rows.map((r) => `${r.item},${r.host},${r.unit},${r.qty},${r.massKg},"${r.rule}"`)
  return [head, ...rows, `TOTAL fixings,,ea,${f.totals.fixings},${f.totals.massKg},"nails ${f.totals.nails} · screws ${f.totals.screws} · bolts ${f.totals.bolts}"`].join('\n')
}
