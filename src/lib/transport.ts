/* Transport & access assessment — pure, unit-tested. Estimates the travel demand a
 * scheme generates: person-trips by land use (residential per dwelling; office /
 * retail per 100 m²) at the AM & PM peaks and daily, split across modes by a
 * public-transport accessibility level (PTAL-style 1–6 — better transit shifts
 * trips out of cars), the resulting vehicle trips, and parking demand (car
 * ownership + commercial) against the supply provided. Reports a sustainable-
 * transport share and a parking surplus/deficit — the core of a Transport
 * Statement / Travel Plan. Indicative trip rates, tunable. No DOM. */

export type TransportInput = {
  residentialUnits: number
  officeNet: number   // m² net
  retailNet: number   // m² net
  transitLevel: number // 1 (poor) … 6 (excellent) public-transport accessibility
  parkingSupply: number // bays provided
}

export type TripLine = { use: string; daily: number; am: number; pm: number }
export type ModeSplit = { car: number; transit: number; walk: number; cycle: number } // shares 0..1
export type Transport = {
  person: { lines: TripLine[]; daily: number; am: number; pm: number }
  mode: ModeSplit
  vehicle: { daily: number; am: number; pm: number } // car trips
  parking: { residential: number; commercial: number; demand: number; supply: number; balance: number; utilisation: number }
  carOwnership: number          // cars per dwelling at this accessibility
  sustainableShare: number      // % of trips by non-car modes
  accessibility: { level: number; label: string }
  note: string
}

// Person-trip rates: residential per dwelling; office/retail per 100 m² net.
const RES = { daily: 6, am: 0.6, pm: 0.7 }
const OFF = { daily: 12, am: 2.0, pm: 2.0 }
const RET = { daily: 40, am: 1.0, pm: 3.0 }
const OCCUPANCY = 1.25 // persons per car
const PTAL_LABEL = ['', 'Poor (1)', 'Low (2)', 'Moderate (3)', 'Good (4)', 'Very good (5)', 'Excellent (6)']

const r1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Car mode share falls as transit accessibility rises (PTAL 1 ≈ 0.75 → 6 ≈ 0.20). */
export function carShare(transitLevel: number): number {
  return clamp(0.75 - (clamp(transitLevel, 1, 6) - 1) * 0.11, 0.12, 0.85)
}
/** Car ownership per dwelling falls with accessibility (≈1.3 at PTAL1 → 0.25 at 6). */
export function carOwnershipFor(transitLevel: number): number {
  return clamp(1.3 - (clamp(transitLevel, 1, 6) - 1) * 0.18, 0.25, 1.4)
}

/** Run the transport & access assessment. */
export function transport(input: TransportInput): Transport {
  const units = Math.max(0, input.residentialUnits)
  const off = Math.max(0, input.officeNet) / 100
  const ret = Math.max(0, input.retailNet) / 100
  const lines: TripLine[] = [
    { use: 'Residential', daily: r1(units * RES.daily), am: r1(units * RES.am), pm: r1(units * RES.pm) },
    { use: 'Office', daily: r1(off * OFF.daily), am: r1(off * OFF.am), pm: r1(off * OFF.pm) },
    { use: 'Retail', daily: r1(ret * RET.daily), am: r1(ret * RET.am), pm: r1(ret * RET.pm) },
  ].filter((l) => l.daily > 0)
  const daily = r1(lines.reduce((s, l) => s + l.daily, 0))
  const am = r1(lines.reduce((s, l) => s + l.am, 0))
  const pm = r1(lines.reduce((s, l) => s + l.pm, 0))

  const car = carShare(input.transitLevel)
  // distribute the non-car share: transit grows with accessibility, walk/cycle the rest
  const rest = 1 - car
  const transitS = rest * clamp(0.35 + (clamp(input.transitLevel, 1, 6) - 1) * 0.07, 0.3, 0.7)
  const walkS = rest * 0.4 * (1 - (transitS / rest))  // remaining split toward walk
  const cycleS = Math.max(0, rest - transitS - walkS)
  const mode: ModeSplit = { car: Math.round(car * 100) / 100, transit: Math.round(transitS * 100) / 100, walk: Math.round(walkS * 100) / 100, cycle: Math.round(cycleS * 100) / 100 }

  const veh = (persons: number) => r1((persons * car) / OCCUPANCY)
  const vehicle = { daily: veh(daily), am: veh(am), pm: veh(pm) }

  const ownership = carOwnershipFor(input.transitLevel)
  const resiBays = units * ownership
  const commercialBays = off * 1.2 + ret * 2.5 // per 100 m² net (matches feasibility ratios)
  const demand = Math.round(resiBays + commercialBays)
  const supply = Math.max(0, Math.round(input.parkingSupply))
  const balance = supply - demand
  const utilisation = supply > 0 ? Math.round((demand / supply) * 100) : (demand > 0 ? 999 : 0)

  const sustainableShare = Math.round((1 - car) * 100)
  const note = `${PTAL_LABEL[clamp(Math.round(input.transitLevel), 1, 6)]} accessibility → ${Math.round(car * 100)}% of trips by car. ${Math.round(daily)} daily person-trips generate ~${vehicle.daily} car trips/day. Parking ${balance >= 0 ? `surplus of ${balance} bays` : `shortfall of ${-balance} bays`} (${demand} needed, ${supply} provided).`

  return {
    person: { lines, daily, am, pm }, mode, vehicle,
    parking: { residential: Math.round(resiBays), commercial: Math.round(commercialBays), demand, supply, balance, utilisation },
    carOwnership: Math.round(ownership * 100) / 100, sustainableShare,
    accessibility: { level: clamp(Math.round(input.transitLevel), 1, 6), label: PTAL_LABEL[clamp(Math.round(input.transitLevel), 1, 6)] },
    note,
  }
}

/** Transport CSV. */
export function transportCsv(t: Transport): string {
  const head = 'Use,Daily,AM peak,PM peak'
  const rows = t.person.lines.map((l) => `${l.use},${l.daily},${l.am},${l.pm}`)
  const meta = [
    `TOTAL person-trips,${t.person.daily},${t.person.am},${t.person.pm}`,
    '', 'Mode,Share',
    `Car,${Math.round(t.mode.car * 100)}%`, `Public transport,${Math.round(t.mode.transit * 100)}%`, `Walk,${Math.round(t.mode.walk * 100)}%`, `Cycle,${Math.round(t.mode.cycle * 100)}%`,
    '', 'Metric,Value',
    `Vehicle trips daily,${t.vehicle.daily}`, `Vehicle trips AM,${t.vehicle.am}`, `Vehicle trips PM,${t.vehicle.pm}`,
    `Car ownership (per dwelling),${t.carOwnership}`,
    `Parking demand,${t.parking.demand}`, `Parking supply,${t.parking.supply}`, `Parking balance,${t.parking.balance}`,
    `Sustainable transport share,${t.sustainableShare}%`, `Accessibility,${t.accessibility.label}`,
  ]
  return [head, ...rows, ...meta].join('\n')
}
