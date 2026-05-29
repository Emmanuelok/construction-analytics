/* A realistic AEC sample the analyzer loads on "Try sample data" — deterministic,
 * with planted relationships (cost rises with GFA; data-center/aviation lead
 * cost/m²; a couple of outliers) so the computed findings are real and notable. */

function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export function sampleCsv(): string {
  const r = rng(42)
  const sectors = ['Commercial', 'Residential', 'Healthcare', 'Data Center', 'Aviation', 'Education']
  const regions = ['North America', 'Europe', 'Middle East', 'APAC']
  const delivery = ['Design-Build', 'Design-Bid-Build', 'CM at Risk', 'IPD', 'EPC']
  // sector cost multipliers (data center & aviation are MEP-dense → pricier)
  const mult: Record<string, number> = {
    Commercial: 1.0, Residential: 0.82, Healthcare: 1.35, 'Data Center': 1.9, Aviation: 1.6, Education: 0.95,
  }
  const header = 'project_id,sector,region,delivery,gfa_m2,cost_per_m2,cost_total_usd,schedule_days,mep_pct,co2e_per_m2'
  const base = Date.parse('2021-01-01')
  const rows: string[] = []
  for (let i = 0; i < 80; i++) {
    const sector = sectors[Math.floor(r() * sectors.length)]
    const gfa = Math.round(6000 + r() * 180000)
    // cost/m² rises gently with GFA (economies invert for complexity) × sector
    const perM2 = Math.round((1600 + gfa * 0.004 + (r() - 0.5) * 400) * mult[sector])
    const total = gfa * perM2
    const mep = Math.round(18 + mult[sector] * 14 + (r() - 0.5) * 6)
    const schedule = Math.round(180 + gfa * 0.0016 + mep * 4 + (r() - 0.5) * 80)
    const co2 = Math.round(380 + mep * 4 + (r() - 0.5) * 90)
    rows.push(
      [`PRJ-${4200 + i}`, sector, regions[Math.floor(r() * regions.length)], delivery[Math.floor(r() * delivery.length)], gfa, perM2, total, schedule, mep, co2].join(','),
    )
  }
  // two planted outliers (data-entry style)
  rows.push(`PRJ-9001,Data Center,APAC,EPC,240000,${9999},2399760000,2200,52,1480`)
  rows.push(`PRJ-9002,Commercial,Europe,IPD,12000,148000,1776000000,140,28,210`)
  void base
  return [header, ...rows].join('\n')
}
