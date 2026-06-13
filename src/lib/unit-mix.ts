/* Unit mix & accommodation schedule — pure, unit-tested. Refines the feasibility's
 * single residential "units" figure into a typed accommodation schedule: a mix of
 * dwelling types (studio / 1–3 bed), each with a net floor area and a value factor
 * (smaller units fetch a higher $/m²), solved against the residential net area so
 * the integer unit counts fill the floorspace. Reports per-type counts, net area,
 * revenue, plus the planning numbers a submission needs — bed spaces, habitable
 * rooms, average dwelling size, dwelling density (units & habitable rooms per ha)
 * and a blended sales rate. No DOM. */

export type UnitType = { key: string; label: string; beds: number; size: number; priceFactor: number; persons: number }

/** Default dwelling types — net m², value factor vs the base sales rate, design occupancy. */
export const DEFAULT_UNIT_TYPES: UnitType[] = [
  { key: 'studio', label: 'Studio', beds: 0, size: 40, priceFactor: 1.18, persons: 1 },
  { key: '1b', label: '1 bed', beds: 1, size: 55, priceFactor: 1.08, persons: 2 },
  { key: '2b', label: '2 bed', beds: 2, size: 78, priceFactor: 1.0, persons: 3 },
  { key: '3b', label: '3 bed', beds: 3, size: 103, priceFactor: 0.94, persons: 4 },
]

export type UnitMix = Record<string, number> // type key → share by unit count (normalised internally)

export type UnitLine = {
  key: string; label: string; beds: number; size: number
  share: number; units: number; netArea: number
  pricePerM2: number; avgValue: number; revenue: number
  bedSpaces: number; habitableRooms: number
}

export type Accommodation = {
  lines: UnitLine[]
  totalUnits: number; totalNet: number; avgSize: number
  bedSpaces: number; habitableRooms: number
  revenue: number; blendedPricePerM2: number
  densityUnitsPerHa: number; densityHrPerHa: number
  reconciliation: { targetNet: number; usedNet: number; varianceNet: number; variancePct: number }
}

const r0 = (n: number) => Math.round(n)

/** Build the accommodation schedule from a residential net area + a count mix. */
export function accommodation(input: { residentialNet: number; mix: UnitMix; basePricePerM2: number; types?: UnitType[]; siteAreaM2?: number }): Accommodation {
  const types = input.types ?? DEFAULT_UNIT_TYPES
  const net = Math.max(0, input.residentialNet)
  const base = Math.max(0, input.basePricePerM2)
  const sum = types.reduce((s, t) => s + Math.max(0, input.mix[t.key] ?? 0), 0) || 1
  const shares = types.map((t) => Math.max(0, input.mix[t.key] ?? 0) / sum)

  // count-weighted average unit size → total units that fill the net area, then
  // integer counts per type (largest-remainder rounding to preserve the total).
  const avgSize = types.reduce((s, t, i) => s + shares[i] * t.size, 0) || 1
  const totalUnitsExact = net / avgSize
  const exact = shares.map((sh) => sh * totalUnitsExact)
  const floors = exact.map((e) => Math.floor(e))
  let remainder = Math.round(totalUnitsExact) - floors.reduce((s, f) => s + f, 0)
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac)
  const counts = floors.slice()
  for (let k = 0; k < order.length && remainder > 0; k++) { counts[order[k].i]++; remainder-- }

  let totalUnits = 0, totalNet = 0, revenue = 0, bedSpaces = 0, habitableRooms = 0
  const lines: UnitLine[] = types.map((t, i) => {
    const units = counts[i]
    const netArea = units * t.size
    const pricePerM2 = base * t.priceFactor
    const avgValue = t.size * pricePerM2
    const rev = units * avgValue
    const hr = t.beds + 1 // habitable rooms ≈ bedrooms + 1 living (studio = 1)
    totalUnits += units; totalNet += netArea; revenue += rev
    bedSpaces += units * t.persons; habitableRooms += units * hr
    return { key: t.key, label: t.label, beds: t.beds, size: t.size, share: shares[i], units, netArea: r0(netArea), pricePerM2: r0(pricePerM2), avgValue: r0(avgValue), revenue: r0(rev), bedSpaces: units * t.persons, habitableRooms: units * hr }
  })

  const ha = input.siteAreaM2 && input.siteAreaM2 > 0 ? input.siteAreaM2 / 10000 : 0
  return {
    lines,
    totalUnits, totalNet: r0(totalNet), avgSize: totalUnits > 0 ? Math.round((totalNet / totalUnits) * 10) / 10 : 0,
    bedSpaces, habitableRooms, revenue: r0(revenue),
    blendedPricePerM2: totalNet > 0 ? r0(revenue / totalNet) : 0,
    densityUnitsPerHa: ha > 0 ? Math.round((totalUnits / ha) * 10) / 10 : 0,
    densityHrPerHa: ha > 0 ? Math.round((habitableRooms / ha) * 10) / 10 : 0,
    reconciliation: { targetNet: r0(net), usedNet: r0(totalNet), varianceNet: r0(totalNet - net), variancePct: net > 0 ? Math.round(((totalNet - net) / net) * 1000) / 10 : 0 },
  }
}

/** Accommodation schedule CSV. */
export function accommodationCsv(a: Accommodation): string {
  const head = 'Type,Beds,Size (m² net),Mix %,Units,Net area (m²),$/m²,Avg value,Revenue,Bed spaces,Habitable rooms'
  const rows = a.lines.map((l) => `${l.label},${l.beds},${l.size},${Math.round(l.share * 100)}%,${l.units},${l.netArea},${l.pricePerM2},${l.avgValue},${l.revenue},${l.bedSpaces},${l.habitableRooms}`)
  const tot = `TOTAL,,,,${a.totalUnits},${a.totalNet},${a.blendedPricePerM2},,${a.revenue},${a.bedSpaces},${a.habitableRooms}`
  const meta = ['', 'Metric,Value', `Average dwelling size (m²),${a.avgSize}`, `Dwelling density (units/ha),${a.densityUnitsPerHa}`, `Habitable rooms/ha,${a.densityHrPerHa}`, `Blended sales rate ($/m²),${a.blendedPricePerM2}`, `Net area reconciliation (m²),${a.reconciliation.usedNet} of ${a.reconciliation.targetNet} (${a.reconciliation.variancePct}%)`]
  return [head, ...rows, tot, ...meta].join('\n')
}
