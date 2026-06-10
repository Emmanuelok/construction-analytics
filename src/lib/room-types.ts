/* Room space-types + finishes — pure data + lookups, unit-tested. The vocabulary the
 * Room Studio modifies a space against: a use programmes its occupant-load factor,
 * indicative finish grade and a plan tint; a finish spec carries a build-up cost and
 * label. Indicative design-stage figures (occupancy factors echo common code tables;
 * finish rates are typical fit-out $/m²) — tunable assumptions, not certification. */

export type SpaceType = { id: string; label: string; occLoad: number; finish: string; color: string }
// occLoad = m² per person (lower = denser). Echoes common occupant-load factors.
export const SPACE_TYPES: SpaceType[] = [
  { id: 'office', label: 'Office', occLoad: 9.3, finish: 'standard', color: '#16243c' },
  { id: 'open-office', label: 'Open office', occLoad: 8, finish: 'standard', color: '#15304a' },
  { id: 'meeting', label: 'Meeting room', occLoad: 2, finish: 'premium', color: '#1c3a52' },
  { id: 'lab', label: 'Laboratory', occLoad: 14, finish: 'technical', color: '#1a3340' },
  { id: 'retail', label: 'Retail', occLoad: 3.7, finish: 'premium', color: '#34243f' },
  { id: 'residential', label: 'Residential', occLoad: 18.6, finish: 'residential', color: '#26314a' },
  { id: 'classroom', label: 'Classroom', occLoad: 1.9, finish: 'standard', color: '#22324a' },
  { id: 'storage', label: 'Storage', occLoad: 46, finish: 'basic', color: '#2a3142' },
  { id: 'plant', label: 'Plant / MEP', occLoad: 0, finish: 'basic', color: '#33302a' },
  { id: 'circulation', label: 'Circulation', occLoad: 0, finish: 'standard', color: '#222b3c' },
]

export type FinishGrade = { id: string; label: string; cost: number } // $/m² (floor+ceiling+wall build-up)
export const FINISHES: FinishGrade[] = [
  { id: 'basic', label: 'Basic (sealed/exposed)', cost: 420 },
  { id: 'standard', label: 'Standard (carpet + ceiling)', cost: 1100 },
  { id: 'residential', label: 'Residential (timber + paint)', cost: 1450 },
  { id: 'technical', label: 'Technical (vinyl + washable)', cost: 1750 },
  { id: 'premium', label: 'Premium (stone + feature)', cost: 2900 },
]

export const DEFAULT_USE = 'office'
export const spaceType = (id?: string): SpaceType => SPACE_TYPES.find((s) => s.id === id) ?? SPACE_TYPES[0]
export const finishGrade = (id?: string): FinishGrade => FINISHES.find((f) => f.id === id) ?? FINISHES[1]
/** Occupant load for an area under a use (people), min 1 for an occupiable space. */
export function occupants(areaM2: number, useId?: string): number {
  const f = spaceType(useId).occLoad
  return f <= 0 ? 0 : Math.max(1, Math.ceil(areaM2 / f))
}
